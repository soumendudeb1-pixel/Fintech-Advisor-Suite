/**
 * POST /api/stock-analysis
 *
 * Fetches 15-minute OHLCV candles from Yahoo Finance (last 5 days),
 * computes RSI(14), SMA9, SMA21, MACD(12,26,9), and Volume Trend,
 * derives a UP / DOWN / HOLD prediction with confidence %,
 * then sends all indicators to the AI service for a plain-language explanation.
 *
 * Never crashes — every data-fetch and calculation step has a fallback.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { generateAiResponse, KNOWEDGE_SYSTEM_PROMPT } from "../services/aiService";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── Request schema ────────────────────────────────────────────────────────
const StockAnalysisBody = z.object({
  symbol: z.string().min(1).max(20).default("^NSEI"),
});

// ─── Well-known display names ──────────────────────────────────────────────
const DISPLAY_NAMES: Record<string, string> = {
  "^NSEI":     "NIFTY 50",
  "^BSESN":    "BSE SENSEX",
  "^NSEBANK":  "NIFTY Bank",
  "RELIANCE.NS": "Reliance Industries",
  "TCS.NS":    "Tata Consultancy Services",
  "INFY.NS":   "Infosys",
  "HDFCBANK.NS": "HDFC Bank",
  "ICICIBANK.NS": "ICICI Bank",
  "WIPRO.NS":  "Wipro",
  "TATAMOTORS.NS": "Tata Motors",
  "ZOMATO.NS": "Zomato",
  "BAJFINANCE.NS": "Bajaj Finance",
  "ADANIPORTS.NS": "Adani Ports",
  "AAPL":  "Apple Inc.",
  "MSFT":  "Microsoft Corp.",
  "GOOGL": "Alphabet Inc.",
  "AMZN":  "Amazon.com Inc.",
  "TSLA":  "Tesla Inc.",
  "NVDA":  "NVIDIA Corp.",
  "META":  "Meta Platforms",
  "JPM":   "JPMorgan Chase",
  "SPY":   "S&P 500 ETF",
};

// ─── Yahoo Finance fetch ───────────────────────────────────────────────────
interface YFCandle {
  timestamp: number;   // Unix seconds
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

async function fetchCandles(symbol: string): Promise<YFCandle[]> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=15m&range=5d&includePrePost=false`;

  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!resp.ok) throw new Error(`Yahoo Finance HTTP ${resp.status}`);

  const json = await resp.json() as any;
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("No result in Yahoo Finance response");

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const opens:   number[] = quote.open   ?? [];
  const highs:   number[] = quote.high   ?? [];
  const lows:    number[] = quote.low    ?? [];
  const closes:  number[] = quote.close  ?? [];
  const volumes: number[] = quote.volume ?? [];

  const candles: YFCandle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c == null || isNaN(c)) continue;       // skip null candles
    candles.push({
      timestamp: timestamps[i],
      open:   opens[i]   ?? c,
      high:   highs[i]   ?? c,
      low:    lows[i]    ?? c,
      close:  c,
      volume: volumes[i] ?? 0,
    });
  }

  if (candles.length < 20) throw new Error(`Too few candles: ${candles.length}`);
  return candles;
}

// ─── Technical indicator calculations ─────────────────────────────────────

/** Exponential Moving Average over an array of values */
function ema(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  // Seed with SMA of first `period` values
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

/** Simple Moving Average — returns last value */
function smaLast(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** RSI(14) — returns last value (0–100) */
function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  // Seed averages
  const seed = changes.slice(0, period);
  let avgGain = seed.filter((x) => x > 0).reduce((a, b) => a + b, 0) / period;
  let avgLoss = seed.filter((x) => x < 0).reduce((a, b) => a + Math.abs(b), 0) / period;

  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

interface MACDResult {
  macd:      number;
  signal:    number;
  histogram: number;
}

/** MACD(12, 26, 9) — returns last values */
function macd(closes: number[]): MACDResult | null {
  if (closes.length < 35) return null;  // need at least 26 + 9 for signal
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);

  // Align: ema26 starts at index 25 of closes, ema12 starts at index 11
  // So macdLine aligns with ema26
  const offset = 26 - 12;   // = 14
  const macdLine = ema26.map((v, i) => ema12[i + offset] - v);

  const signalLine = ema(macdLine, 9);
  if (signalLine.length === 0) return null;

  const lastMacd   = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];

  return {
    macd:      round2(lastMacd),
    signal:    round2(lastSignal),
    histogram: round2(lastMacd - lastSignal),
  };
}

interface VolumeTrend {
  currentAvg:    number;
  previousAvg:   number;
  trend:         "up" | "down" | "flat";
  changePercent: number;
}

/** Compare last 5 candle volumes vs previous 5 */
function volumeTrend(candles: YFCandle[]): VolumeTrend | null {
  if (candles.length < 10) return null;
  const last5 = candles.slice(-5).map((c) => c.volume);
  const prev5 = candles.slice(-10, -5).map((c) => c.volume);
  const curAvg  = last5.reduce((a, b) => a + b, 0)  / 5;
  const prevAvg = prev5.reduce((a, b) => a + b, 0) / 5;
  const changePct = prevAvg > 0 ? ((curAvg - prevAvg) / prevAvg) * 100 : 0;
  return {
    currentAvg:    Math.round(curAvg),
    previousAvg:   Math.round(prevAvg),
    trend:         changePct > 5 ? "up" : changePct < -5 ? "down" : "flat",
    changePercent: round2(changePct),
  };
}

// ─── Signal scoring & prediction ──────────────────────────────────────────

type SignalDir = "bullish" | "bearish" | "neutral";

function rsiSignal(v: number): SignalDir {
  if (v < 35)      return "bullish";   // oversold → likely bounce
  if (v > 65)      return "bearish";   // overbought → likely pullback
  if (v < 45)      return "bullish";   // mild bullish
  if (v > 55)      return "bearish";   // mild bearish
  return "neutral";
}

function rsiInterpretation(v: number): string {
  if (v > 80) return "Severely overbought — high reversal risk.";
  if (v > 70) return "Overbought — momentum may be fading.";
  if (v > 60) return "Mildly overbought — watch for resistance.";
  if (v < 20) return "Severely oversold — potential sharp bounce.";
  if (v < 30) return "Oversold — buyers likely stepping in.";
  if (v < 40) return "Mildly oversold — cautious accumulation zone.";
  return "Neutral zone — no strong directional bias.";
}

interface PredictionResult {
  direction:      "UP" | "DOWN" | "HOLD";
  confidence:     number;          // 0–100
  bullSignals:    number;
  bearSignals:    number;
  neutralSignals: number;
  signalBreakdown: Array<{ indicator: string; signal: SignalDir; weight: number }>;
}

function buildPrediction(
  rsiVal: number | null,
  sma9:   number | null,
  sma21:  number | null,
  macdR:  MACDResult | null,
  volT:   VolumeTrend | null,
  lastClose: number,
): PredictionResult {
  type Entry = { indicator: string; signal: SignalDir; weight: number };
  const signals: Entry[] = [];

  // RSI signal (weight 2)
  if (rsiVal !== null) {
    signals.push({ indicator: "RSI(14)", signal: rsiSignal(rsiVal), weight: 2 });
  }

  // SMA cross signal (weight 2)
  if (sma9 !== null && sma21 !== null) {
    const crossSig: SignalDir = sma9 > sma21 ? "bullish" : sma9 < sma21 ? "bearish" : "neutral";
    signals.push({ indicator: "SMA Cross (9/21)", signal: crossSig, weight: 2 });
  }

  // Price vs SMA9 (weight 1)
  if (sma9 !== null) {
    const priceSig: SignalDir = lastClose > sma9 * 1.002 ? "bullish"
      : lastClose < sma9 * 0.998 ? "bearish" : "neutral";
    signals.push({ indicator: "Price vs SMA9", signal: priceSig, weight: 1 });
  }

  // MACD signal (weight 2)
  if (macdR !== null) {
    const macdSig: SignalDir = macdR.histogram > 0 ? "bullish"
      : macdR.histogram < 0 ? "bearish" : "neutral";
    signals.push({ indicator: "MACD Histogram", signal: macdSig, weight: 2 });
    // MACD line above/below zero (weight 1)
    const zeroSig: SignalDir = macdR.macd > 0 ? "bullish" : macdR.macd < 0 ? "bearish" : "neutral";
    signals.push({ indicator: "MACD Zero Line", signal: zeroSig, weight: 1 });
  }

  // Volume trend (weight 1 — confirms other signals)
  if (volT !== null) {
    const volSig: SignalDir = volT.trend === "up" ? "bullish"
      : volT.trend === "down" ? "bearish" : "neutral";
    signals.push({ indicator: "Volume Trend", signal: volSig, weight: 1 });
  }

  // Weighted score
  let score = 0;
  let maxScore = 0;
  let bull = 0, bear = 0, neut = 0;

  for (const s of signals) {
    maxScore += s.weight;
    if (s.signal === "bullish") { score += s.weight; bull++; }
    else if (s.signal === "bearish") { score -= s.weight; bear++; }
    else neut++;
  }

  const normalised = maxScore > 0 ? score / maxScore : 0;   // -1 to +1
  const confidence = Math.min(100, Math.round(Math.abs(normalised) * 100));

  let direction: "UP" | "DOWN" | "HOLD";
  if (normalised > 0.15)       direction = "UP";
  else if (normalised < -0.15) direction = "DOWN";
  else                         direction = "HOLD";

  return {
    direction,
    confidence,
    bullSignals:    bull,
    bearSignals:    bear,
    neutralSignals: neut,
    signalBreakdown: signals,
  };
}

// ─── AI explanation prompt ─────────────────────────────────────────────────
function buildAnalysisPrompt(
  symbol:    string,
  name:      string,
  lastClose: number,
  rsiVal:    number | null,
  sma9:      number | null,
  sma21:     number | null,
  macdR:     MACDResult | null,
  volT:      VolumeTrend | null,
  pred:      PredictionResult,
  candles:   YFCandle[],
): string {
  const priceChange = candles.length > 1
    ? round2(lastClose - candles[candles.length - 2].close) : 0;

  return [
    `=== 15-MINUTE TECHNICAL ANALYSIS: ${name} (${symbol}) ===`,
    `Latest price  : ₹${lastClose.toLocaleString("en-IN")} (${priceChange >= 0 ? "+" : ""}${priceChange})`,
    `Candles used  : ${candles.length} (15-minute, last 5 trading days)`,
    "",
    "INDICATOR VALUES:",
    rsiVal !== null ? `  RSI(14)       : ${round2(rsiVal)} — ${rsiInterpretation(rsiVal)}` : "  RSI(14)       : unavailable",
    sma9  !== null  ? `  SMA 9         : ₹${sma9.toLocaleString("en-IN")} (price is ${lastClose > sma9 ? "ABOVE" : "BELOW"})` : "  SMA 9         : unavailable",
    sma21 !== null  ? `  SMA 21        : ₹${sma21.toLocaleString("en-IN")} (price is ${lastClose > sma21 ? "ABOVE" : "BELOW"})` : "  SMA 21        : unavailable",
    sma9 !== null && sma21 !== null
      ? `  SMA Cross     : SMA9 is ${sma9 > sma21 ? "ABOVE" : "BELOW"} SMA21 — ${sma9 > sma21 ? "bullish" : "bearish"} crossover`
      : "",
    macdR !== null
      ? [
          `  MACD          : ${macdR.macd} | Signal: ${macdR.signal} | Histogram: ${macdR.histogram}`,
          `  MACD trend    : histogram is ${macdR.histogram > 0 ? "POSITIVE (bullish momentum)" : "NEGATIVE (bearish momentum)"}`,
        ].join("\n")
      : "  MACD          : unavailable",
    volT !== null
      ? `  Volume trend  : ${volT.trend.toUpperCase()} — current avg ${volT.currentAvg.toLocaleString("en-IN")} vs prev avg ${volT.previousAvg.toLocaleString("en-IN")} (${volT.changePercent > 0 ? "+" : ""}${volT.changePercent}%)`
      : "  Volume trend  : unavailable",
    "",
    "PREDICTION RESULT:",
    `  Direction  : ${pred.direction}`,
    `  Confidence : ${pred.confidence}%`,
    `  Bull signals: ${pred.bullSignals} | Bear signals: ${pred.bearSignals} | Neutral: ${pred.neutralSignals}`,
    "",
    "As KnowEdge AI, explain this technical analysis to an Indian retail investor in plain language.",
    "Structure your response with these 4 sections:",
    "📊 What the Indicators Show",
    "   [Explain RSI, SMA cross, MACD, and volume in 3–4 sentences — what each means for this stock right now]",
    "⚠️ Key Risks",
    "   [2–3 specific risks based on the indicators — e.g. overbought RSI, weak volume, bearish MACD]",
    "🎯 Trading Outlook",
    `   [Explain the ${pred.direction} prediction and ${pred.confidence}% confidence — what would confirm or invalidate it]`,
    "💡 What to Watch Next",
    "   [2–3 specific price levels or events to monitor — support/resistance near SMA9/SMA21, RSI thresholds]",
  ].filter(Boolean).join("\n");
}

// ─── Fallback response ─────────────────────────────────────────────────────
function buildAnalysisFallback(
  symbol: string,
  name: string,
  rsiVal: number | null,
  sma9: number | null,
  sma21: number | null,
  macdR: MACDResult | null,
  volT: VolumeTrend | null,
  pred: PredictionResult,
): string {
  const rsiLine = rsiVal !== null
    ? `RSI is at ${round2(rsiVal)} — ${rsiInterpretation(rsiVal)}`
    : "RSI data unavailable.";
  const smaLine = sma9 !== null && sma21 !== null
    ? `SMA9 (${sma9.toLocaleString("en-IN")}) is ${sma9 > sma21 ? "above" : "below"} SMA21 (${sma21.toLocaleString("en-IN")}), indicating a ${sma9 > sma21 ? "short-term bullish" : "short-term bearish"} crossover.`
    : "SMA data unavailable.";
  const macdLine = macdR !== null
    ? `MACD histogram is ${macdR.histogram > 0 ? "positive (" + macdR.histogram + ") — bullish momentum building" : "negative (" + macdR.histogram + ") — bearish pressure"}.`
    : "MACD data unavailable.";
  const volLine = volT !== null
    ? `Volume is trending ${volT.trend} (${volT.changePercent > 0 ? "+" : ""}${volT.changePercent}% vs prior period) — ${volT.trend === "up" ? "confirming the move with conviction" : volT.trend === "down" ? "weak participation, move may lack follow-through" : "neutral participation"}.`
    : "Volume data unavailable.";

  const riskLines = [
    rsiVal !== null && rsiVal > 65 ? "• RSI is elevated — risk of short-term pullback before continuation." : null,
    rsiVal !== null && rsiVal < 35 ? "• RSI is oversold — could bounce, but trend may still be down." : null,
    sma9 !== null && sma21 !== null && sma9 < sma21 ? "• Bearish SMA crossover — short-term trend is down, caution on longs." : null,
    macdR !== null && macdR.histogram < 0 ? "• MACD histogram is negative — sellers have momentum." : null,
    volT !== null && volT.trend === "down" && pred.direction !== "DOWN" ? "• Rising price on falling volume — weak conviction, may not sustain." : null,
    "• 15-minute data captures intraday noise — always validate with daily chart before acting.",
  ].filter(Boolean).slice(0, 3);

  const confirmLine = pred.direction === "UP"
    ? `A sustained break above SMA21 (${sma21 ? sma21.toLocaleString("en-IN") : "N/A"}) on increasing volume would confirm the uptrend.`
    : pred.direction === "DOWN"
    ? `A close below SMA9 (${sma9 ? sma9.toLocaleString("en-IN") : "N/A"}) with RSI continuing lower would confirm bearish momentum.`
    : `Price is consolidating — wait for a clear break of the SMA9/SMA21 range before taking a directional trade.`;

  return [
    "📊 What the Indicators Show",
    `${rsiLine} ${smaLine} ${macdLine} ${volLine}`,
    "",
    "⚠️ Key Risks",
    ...riskLines.map((l) => l ?? ""),
    "",
    "🎯 Trading Outlook",
    `The model signals **${pred.direction}** with ${pred.confidence}% confidence (${pred.bullSignals} bull vs ${pred.bearSignals} bear signals). ` +
    confirmLine,
    "",
    "💡 What to Watch Next",
    sma9 !== null ? `• SMA9 (${sma9.toLocaleString("en-IN")}) — a close above/below this level on the 15m chart shifts short-term bias.` : "• Monitor near-term support and resistance levels.",
    sma21 !== null ? `• SMA21 (${sma21.toLocaleString("en-IN")}) — the medium-term pivot; a sustained break signals trend change.` : "",
    rsiVal !== null ? `• RSI threshold — watch for RSI crossing ${rsiVal > 50 ? "70 (overbought)" : "30 (oversold)"} on the next impulse.` : "",
  ].filter((l) => l !== undefined && l !== "").join("\n");
}

// ─── Helper ────────────────────────────────────────────────────────────────
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Route ────────────────────────────────────────────────────────────────
router.post("/stock-analysis", async (req, res): Promise<void> => {
  const parsed = StockAnalysisBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parsed.error.issues.map((i) => ({ field: i.path.join(".") || "body", message: i.message })),
    });
    return;
  }

  const symbol = parsed.data.symbol.toUpperCase();
  const name   = DISPLAY_NAMES[symbol] ?? symbol;
  const fetchedAt = new Date().toISOString();

  logger.info({ symbol }, "Stock analysis requested");

  // ── 1. Fetch candles — graceful fallback if unavailable ──────────────────
  let candles: YFCandle[] = [];
  let fetchError: string | null = null;

  try {
    candles = await fetchCandles(symbol);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
    logger.warn({ symbol, err: fetchError }, "Yahoo Finance fetch failed for stock analysis");
  }

  // If we couldn't fetch, return a structured error (not a crash)
  if (candles.length === 0) {
    res.status(200).json({
      symbol,
      name,
      fetchedAt,
      interval: "15m",
      range: "5d",
      error: "live_data_unavailable",
      errorDetail: fetchError ?? "No candles returned",
      message: "Live market data could not be fetched. Please try again or check the symbol.",
      indicators: null,
      prediction: null,
      ai_explanation: null,
    });
    return;
  }

  // ── 2. Extract close prices and compute indicators ───────────────────────
  const closes  = candles.map((c) => c.close);
  const lastClose  = closes[closes.length - 1];
  const firstClose = closes[0];

  const rsiVal = rsi(closes);
  const sma9v  = smaLast(closes, 9);
  const sma21v = smaLast(closes, 21);
  const macdR  = macd(closes);
  const volT   = volumeTrend(candles);

  // ── 3. Build indicators response object ──────────────────────────────────
  const indicators = {
    rsi: rsiVal !== null ? {
      value:          round2(rsiVal),
      signal:         rsiSignal(rsiVal),
      interpretation: rsiInterpretation(rsiVal),
    } : null,
    sma9: sma9v !== null ? {
      value:  round2(sma9v),
      signal: (lastClose > sma9v ? "bullish" : "bearish") as SignalDir,
    } : null,
    sma21: sma21v !== null ? {
      value:  round2(sma21v),
      signal: (lastClose > sma21v ? "bullish" : "bearish") as SignalDir,
    } : null,
    smaCross: sma9v !== null && sma21v !== null ? {
      signal:        (sma9v > sma21v ? "bullish" : sma9v < sma21v ? "bearish" : "neutral") as SignalDir,
      interpretation: sma9v > sma21v
        ? "SMA9 is above SMA21 — short-term uptrend"
        : "SMA9 is below SMA21 — short-term downtrend",
    } : null,
    macd: macdR ?? null,
    volumeTrend: volT ?? null,
  };

  // ── 4. Derive prediction ──────────────────────────────────────────────────
  const prediction = buildPrediction(rsiVal, sma9v, sma21v, macdR, volT, lastClose);

  // ── 5. AI explanation ─────────────────────────────────────────────────────
  let ai_explanation: string;
  try {
    const prompt = buildAnalysisPrompt(symbol, name, lastClose, rsiVal, sma9v, sma21v, macdR, volT, prediction, candles);
    ai_explanation = await generateAiResponse(KNOWEDGE_SYSTEM_PROMPT, prompt, []);
    // If AI returned something generic, replace with rich fallback
    if (ai_explanation.length < 100 || !ai_explanation.includes("RSI") && !ai_explanation.includes("SMA") && !ai_explanation.includes("MACD")) {
      ai_explanation = buildAnalysisFallback(symbol, name, rsiVal, sma9v, sma21v, macdR, volT, prediction);
    }
  } catch (err) {
    logger.error({ err, symbol }, "AI explanation failed — using fallback");
    ai_explanation = buildAnalysisFallback(symbol, name, rsiVal, sma9v, sma21v, macdR, volT, prediction);
  }

  // ── 6. Return structured JSON ─────────────────────────────────────────────
  res.json({
    symbol,
    name,
    fetchedAt,
    interval: "15m",
    range: "5d",
    candleCount: candles.length,
    latestPrice: round2(lastClose),
    priceChange: {
      absolute: round2(lastClose - firstClose),
      percent:  round2(((lastClose - firstClose) / firstClose) * 100),
    },
    indicators,
    prediction,
    ai_explanation,
  });
});

export default router;
