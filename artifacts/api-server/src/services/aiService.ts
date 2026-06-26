/**
 * KnowEdge AI Service
 *
 * Reusable LLM integration supporting any OpenAI-compatible endpoint.
 * Configuration (all via environment variables — nothing hardcoded):
 *   LLM_API_KEY   — your API key  (required for live LLM)
 *   LLM_MODEL     — model name    (default: gpt-4o-mini)
 *   LLM_BASE_URL  — base URL      (default: OpenAI; override for Groq, Azure, OpenRouter, etc.)
 */

import OpenAI from "openai";
import { logger } from "../lib/logger";

// ── Configuration (env-driven, nothing hardcoded) ─────────────────────────
const LLM_API_KEY = process.env["LLM_API_KEY"];
const LLM_MODEL   = process.env["LLM_MODEL"]    ?? "gpt-4o-mini";
const LLM_BASE_URL = process.env["LLM_BASE_URL"];   // undefined → OpenAI default

// ── System prompt ─────────────────────────────────────────────────────────
export const KNOWEDGE_SYSTEM_PROMPT =
  "You are KnowEdge AI, an expert financial advisor specializing in Indian markets (NSE, BSE, NIFTY 50, SENSEX). " +
  "You provide clear, practical, actionable financial advice in plain language. " +
  "You are deeply familiar with Indian financial instruments: SIP, ELSS, PPF, NPS, SCSS, FD, ULIPs, and Sovereign Gold Bonds. " +
  "You also understand global markets and US stocks. " +
  "Always tailor advice to the user's situation, give specific actionable next steps, and keep responses concise (under 200 words unless asked for detail). " +
  "When discussing probabilities or forecasts, always add appropriate disclaimers that past performance does not guarantee future results.";

// ── OpenAI client (initialised once, reused) ──────────────────────────────
let aiClient: OpenAI | null = null;

if (LLM_API_KEY) {
  aiClient = new OpenAI({
    apiKey: LLM_API_KEY,
    ...(LLM_BASE_URL ? { baseURL: LLM_BASE_URL } : {}),
  });
  logger.info(
    { model: LLM_MODEL, endpoint: LLM_BASE_URL ?? "https://api.openai.com/v1" },
    "LLM client initialised — live AI responses enabled",
  );
} else {
  logger.warn(
    "LLM_API_KEY not set — AI advisor will use smart rule-based fallback responses. " +
    "Set LLM_API_KEY (and optionally LLM_MODEL, LLM_BASE_URL) to enable live LLM.",
  );
}

// ── Types ─────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Core function ─────────────────────────────────────────────────────────
/**
 * Generate an AI response using the configured LLM.
 *
 * @param systemPrompt  Instruction context for the model
 * @param userPrompt    The user's message
 * @param history       Prior conversation turns (oldest first)
 * @returns             The model's text response
 */
export async function generateAiResponse(
  systemPrompt: string,
  userPrompt: string,
  history: ChatMessage[] = [],
): Promise<string> {
  if (!aiClient) {
    return buildFallbackResponse(userPrompt);
  }

  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userPrompt },
    ];

    const completion = await aiClient.chat.completions.create({
      model: LLM_MODEL,
      messages,
      max_tokens: 512,
      temperature: 0.7,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty response from LLM");
    return text;
  } catch (err) {
    logger.error({ err }, "LLM API call failed — falling back to rule-based response");
    return buildFallbackResponse(userPrompt);
  }
}

// ── Calculator advice (structured 4-section format) ──────────────────────
export type CalculatorType = "pocket-money" | "salaried" | "retired" | "sip";

/** System prompt that forces the LLM into a consistent 4-section structure. */
const CALCULATOR_SYSTEM_PROMPT =
  KNOWEDGE_SYSTEM_PROMPT +
  "\n\nIMPORTANT: Always respond in this exact 4-section format — no deviations:\n\n" +
  "📊 What This Means\n[2–3 plain-language sentences explaining what the numbers mean for this person's financial life]\n\n" +
  "⚠️ Risks Detected\n[2–3 bullet points — specific financial risks or vulnerabilities, each starting with •]\n\n" +
  "✅ How to Improve\n[3 bullet points — concrete, actionable improvements with specific rupee amounts where possible, each starting with •]\n\n" +
  "🎯 Your Next Step\n[Exactly one action they should take THIS WEEK, with a specific amount or deadline]";

/**
 * Generate structured AI advice for a calculator result.
 * Falls back to rich, data-driven template responses when no LLM key is set.
 */
export async function generateCalculatorAdvice(
  type: CalculatorType,
  prompt: string,
  metrics: Record<string, number | string>,
): Promise<string> {
  if (aiClient) {
    try {
      const completion = await aiClient.chat.completions.create({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: CALCULATOR_SYSTEM_PROMPT },
          { role: "user",   content: prompt },
        ],
        max_tokens: 450,
        temperature: 0.65,
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (text) return text;
    } catch (err) {
      logger.error({ err, type }, "LLM error for calculator advice — using fallback");
    }
  }
  return buildCalculatorFallback(type, metrics);
}

// ── Fallback for general chat (no API key or LLM error) ──────────────────
function buildFallbackResponse(message: string): string {
  const m = message.toLowerCase();

  if (m.includes("nifty") || m.includes("sensex") || m.includes("indian market") || m.includes("nse") || m.includes("bse")) {
    return "Indian markets (NIFTY 50 & SENSEX) have shown strong long-term growth averaging 12–14% CAGR over the past decade. For most retail investors, a low-cost NIFTY 50 index fund via monthly SIP is the most reliable path to wealth creation. Avoid timing the market — stay invested through volatility.";
  }
  if (m.includes("sip") || m.includes("mutual fund") || m.includes("invest")) {
    return "SIP (Systematic Investment Plan) is one of the most powerful wealth-building tools available to Indian investors. Starting with just ₹500/month in a NIFTY 50 index fund leverages rupee cost averaging and compounding. Increase your SIP amount by 10% every year (step-up SIP) for dramatically better outcomes. Use ELSS funds for tax savings under Section 80C.";
  }
  if (m.includes("tax") || m.includes("80c") || m.includes("elss") || m.includes("ppf")) {
    return "Key tax-saving options under Section 80C (up to ₹1.5L/year): ELSS mutual funds (best returns, 3-year lock-in), PPF (safe, 15-year, 7.1% p.a.), EPF contributions, NSC, and 5-year FDs. ELSS is recommended for most earners under 50 for its balance of growth and tax efficiency. NPS offers an additional ₹50,000 deduction under 80CCD(1B).";
  }
  if (m.includes("retirement") || m.includes("pension") || m.includes("corpus") || m.includes("scss")) {
    return "For retirement planning in India: NPS (National Pension Scheme) offers tax benefits and market-linked returns with an equity option (Tier I, up to 75% equity allocation). Senior Citizen Savings Scheme (SCSS) gives 8.2% p.a. with quarterly payouts. A healthy retirement corpus target: 25× your annual expenses, following a 4% safe withdrawal rate.";
  }
  if (m.includes("reliance") || m.includes("tcs") || m.includes("infosys") || m.includes("zomato") || m.includes("hdfc")) {
    return "Blue-chip NSE stocks like Reliance, TCS, and Infosys have strong fundamentals and consistent revenue growth. Before investing, check: P/E ratio vs sector average, 52-week range position, promoter holding, and debt-to-equity ratio. For beginners, a diversified large-cap mutual fund provides exposure to all top NSE companies without concentration risk.";
  }
  if (m.includes("crypto") || m.includes("bitcoin")) {
    return "Cryptocurrency carries very high risk and is subject to 30% flat tax + 1% TDS in India. Treat it as highly speculative — allocate no more than 5% of your portfolio if you decide to invest. SEBI currently does not regulate crypto, so there is no investor protection. Build a solid equity + debt foundation first.";
  }
  if (m.includes("emergency") || m.includes("save") || m.includes("saving")) {
    return "Every solid financial plan starts with an emergency fund covering 3–6 months of expenses in a liquid account. Use a high-yield savings account (currently 6–7% in India) or liquid mutual funds for easy access. Do not invest this money in stocks or ELSS. Once the emergency fund is set, redirect surplus to long-term investments.";
  }

  return (
    "I'm KnowEdge AI, your expert for Indian and global financial markets. " +
    "I can help with: NSE/BSE stock analysis, SIP and mutual fund strategy, tax planning (80C, ELSS, PPF, NPS), " +
    "and retirement planning. " +
    "Set LLM_API_KEY to enable live AI responses. What would you like to know?"
  );
}

// ── Rich, data-driven fallbacks for each calculator type ─────────────────

function fmt(n: number | string): string {
  if (typeof n === "string") return n;
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function buildCalculatorFallback(
  type: CalculatorType,
  m: Record<string, number | string>,
): string {
  switch (type) {
    case "pocket-money": {
      const allowance    = Number(m["monthlyAllowance"] ?? 0);
      const expenses     = Number(m["totalExpenses"]    ?? 0);
      const balance      = Number(m["balance"]          ?? 0);
      const savings      = Number(m["savingsAmount"]    ?? 0);
      const spending     = Number(m["spendingMoney"]    ?? 0);
      const score        = Number(m["budgetScore"]      ?? 0);
      const ratio        = allowance > 0 ? (expenses / allowance) * 100 : 0;
      const bigCat       = String(m["biggestCategory"]  ?? "your largest category");
      const bigAmt       = Number(m["biggestCategoryAmount"] ?? 0);
      const monthsToGoal = m["monthsToGoal"] ? Number(m["monthsToGoal"]) : null;
      const goalName     = m["savingsGoalName"] ? `"${m["savingsGoalName"]}"` : "your savings goal";
      const cut15        = Math.round(bigAmt * 0.15);

      const riskLine = ratio > 90
        ? `• Critical: you're using ${ratio.toFixed(0)}% of your income — one unexpected expense will push you into debt.`
        : ratio > 80
        ? `• High expense ratio (${ratio.toFixed(0)}%) — very little cushion for surprises.`
        : `• No emergency buffer — a single unexpected expense could wipe out your balance.`;

      return [
        "📊 What This Means",
        `You earn ${fmt(allowance)} and spend ${fmt(expenses)} (${ratio.toFixed(0)}% of your income), leaving ${fmt(balance)}. ` +
        `After saving ${fmt(savings)}/month you have ${fmt(spending)} for personal spending. ` +
        (monthsToGoal
          ? `At this rate you'll reach ${goalName} in ${monthsToGoal} months — keep the habit going.`
          : "Setting a specific savings goal will sharpen your focus and speed up wealth building."),
        "",
        "⚠️ Risks Detected",
        riskLine,
        `• ${bigCat} is your biggest spend at ${fmt(bigAmt)}/month — it's worth reviewing whether every rupee here is essential.`,
        `• A savings rate of only ${Number(m["savingsRate"] ?? 20)}% may not be enough if income doesn't grow — aim for 30%+ over time.`,
        "",
        "✅ How to Improve",
        `• Trim ${bigCat} by 15% (${fmt(cut15)}/month) — redirect it straight to savings for a bigger impact.`,
        `• Follow the 50/30/20 rule: ${fmt(allowance * 0.5)} for needs, ${fmt(allowance * 0.3)} for wants, ${fmt(allowance * 0.2)} for savings.`,
        `• Open a separate savings account so your ${fmt(savings)} is out of sight and out of temptation.`,
        "",
        "🎯 Your Next Step",
        `Transfer ${fmt(savings)} into a dedicated savings account today — before you spend anything else. ` +
        `Even one month of this habit will improve your budget score above ${Math.min(100, score + 8)}/100.`,
      ].join("\n");
    }

    case "salaried": {
      const gross       = Number(m["grossAnnualSalary"]   ?? 0);
      const taxable     = Number(m["taxableIncome"]        ?? 0);
      const totalTax    = Number(m["totalTaxPayable"]      ?? 0);
      const effRate     = Number(m["effectiveTaxRate"]     ?? 0);
      const margRate    = Number(m["marginalTaxRate"]      ?? 0);
      const takeHomeMo  = Number(m["netMonthlyTakeHome"]   ?? 0);
      const epf         = Number(m["epfContributionAnnual"]?? 0);
      const regime      = String(m["regime"]               ?? "new");
      const rebate      = Number(m["regime87ARebate"]      ?? 0);
      // Potential 80C saving at marginal rate
      const unused80c   = Math.max(0, 150_000 - Number(m["section80c"] ?? 0));
      const tax80cSave  = Math.round(unused80c * margRate / 100);
      const npsMax      = 50_000;
      const npsUsed     = Number(m["npsContribution"] ?? 0);
      const unusedNps   = Math.max(0, npsMax - npsUsed);
      const npsGain     = Math.round(unusedNps * margRate / 100);
      const regimeTip   = regime === "new"
        ? "The new regime is simpler but loses deduction benefits. If you invest heavily in 80C/NPS, compare with the old regime."
        : "The old regime works best when you fully use 80C (₹1.5L), 80D, and NPS deductions.";

      return [
        "📊 What This Means",
        `Your gross CTC of ${fmt(gross)} becomes a taxable income of ${fmt(taxable)} after deductions. ` +
        `You pay ${fmt(totalTax)} in tax (${effRate}% effective rate), bringing your take-home to ${fmt(takeHomeMo)}/month. ` +
        (rebate > 0 ? `You benefited from a ₹${rebate.toLocaleString("en-IN")} Section 87A rebate that reduced your tax bill. ` : "") +
        `Your marginal tax rate is ${margRate}% — meaning every extra rupee earned beyond your current income is taxed at ${margRate}%.`,
        "",
        "⚠️ Risks Detected",
        `• At a ${margRate}% marginal rate, failing to use available deductions is an expensive mistake — every ₹1L undeducted costs you ₹${Math.round(margRate * 1000).toLocaleString("en-IN")} in tax.`,
        `• Relying solely on EPF (${fmt(epf)}/year) for long-term savings is insufficient — equity exposure through ELSS or NPS is needed for wealth creation.`,
        `• ${regimeTip}`,
        "",
        "✅ How to Improve",
        unused80c > 0
          ? `• Invest ${fmt(unused80c)} more under Section 80C (ELSS/PPF/NSC) — saves you ${fmt(tax80cSave)} in tax this year.`
          : `• You've maximised 80C (₹1.5L) — great. Now explore Section 80D medical insurance premiums for additional savings.`,
        unusedNps > 0
          ? `• Contribute ${fmt(unusedNps)} to NPS under 80CCD(1B) — saves another ${fmt(npsGain)} in tax and builds your retirement corpus.`
          : `• You've maximised NPS deductions. Consider Voluntary Provident Fund (VPF) at 8.25% p.a., fully tax-free on maturity.`,
        `• Start a monthly SIP of at least ${fmt(Math.round(takeHomeMo * 0.2))} (20% of take-home) into a flexi-cap or large-cap mutual fund to build long-term wealth.`,
        "",
        "🎯 Your Next Step",
        `This week, open an ELSS account (e.g., Mirae Asset or Axis) and set up a monthly SIP for ${fmt(Math.round(Math.min(unused80c, 150_000) / 12))} to claim your full 80C benefit and get equity market returns simultaneously.`,
      ].join("\n");
    }

    case "retired": {
      const portfolio   = Number(m["portfolioValue"]         ?? 0);
      const pension     = Number(m["monthlyPension"]         ?? 0);
      const withdrawal  = Number(m["monthlyWithdrawal"]      ?? 0);
      const income      = Number(m["totalMonthlyIncome"]     ?? 0);
      const expenses    = Number(m["monthlyExpenses"]        ?? 0);
      const surplus     = Number(m["monthlySurplusDeficit"]  ?? 0);
      const health      = String(m["portfolioHealth"]        ?? "fair");
      const susYears    = m["sustainableYears"] !== "" ? Number(m["sustainableYears"]) : null;
      const shortfall   = Number(m["corpusShortfall"]        ?? 0);
      const scssQtr     = Number(m["scssQuarterlyIncome"]    ?? 0);
      const scssMax     = Number(m["scssMaxInvestment"]      ?? 0);
      const wdRate      = Number(m["withdrawalRate"]         ?? 3.5);

      const healthDesc: Record<string, string> = {
        excellent: "Your corpus is very well-positioned — you have significant margin above your needs.",
        good:      "Your corpus is healthy and should comfortably support your retirement.",
        fair:      "Your corpus is stretched — it covers your needs but leaves little room for surprises.",
        "at-risk": "Your corpus is under significant pressure — immediate action is needed to extend its life.",
      };
      const isDeficit = surplus < 0;

      return [
        "📊 What This Means",
        `Your ${fmt(portfolio)} corpus generates ${fmt(withdrawal)}/month at a ${wdRate}% withdrawal rate. ` +
        `Combined with your ${fmt(pension)}/month pension, total income is ${fmt(income)} vs expenses of ${fmt(expenses)}/month. ` +
        (isDeficit
          ? `This leaves a monthly shortfall of ${fmt(Math.abs(surplus))}. `
          : `This gives you a monthly surplus of ${fmt(surplus)} — use it to reinvest or build a buffer. `) +
        `Portfolio health: **${health}**. ` + (healthDesc[health] ?? ""),
        "",
        "⚠️ Risks Detected",
        isDeficit
          ? `• Monthly shortfall of ${fmt(Math.abs(surplus))} means your corpus is being drawn down faster than projected.`
          : `• Even with a surplus, sequence-of-returns risk remains — a 30% market drop early in retirement can permanently damage your corpus.`,
        susYears !== null && susYears < 25
          ? `• At current withdrawal pace, your corpus may be depleted in ~${susYears} years — review if life expectancy exceeds this.`
          : `• Inflation (6% p.a.) will erode purchasing power — ₹40,000 today costs ~₹72,000 in 10 years.`,
        shortfall > 0
          ? `• Your corpus is ${fmt(shortfall)} short of the ideal ${fmt(expenses * 12 / (wdRate / 100))} needed to fully self-fund expenses.`
          : `• Market concentration risk — ensure your corpus is diversified across equity, debt, and guaranteed income instruments.`,
        "",
        "✅ How to Improve",
        scssMax > 0
          ? `• Park ${fmt(scssMax)} in SCSS at 8.2% p.a. — guaranteed ${fmt(scssQtr)}/quarter income with zero market risk.`
          : `• Explore RBI Floating Rate Savings Bonds (currently 8.05% p.a.) for safe, inflation-linked income.`,
        isDeficit
          ? `• Reduce discretionary expenses by 10–15% (save ~${fmt(Math.round(expenses * 0.12))}/month) to reduce corpus drawdown immediately.`
          : `• Invest your ${fmt(surplus)}/month surplus into a liquid fund — it becomes an emergency buffer that also earns 6–7%.`,
        `• Maintain a "bucket strategy": 1–2 years of expenses (${fmt(expenses * 18)}) in FD/liquid fund, rest in balanced advantage or hybrid funds.`,
        "",
        "🎯 Your Next Step",
        scssMax > 0
          ? `Visit your nearest post office or SBI branch this week to open an SCSS account with ${fmt(scssMax)} — you'll receive ${fmt(scssQtr)} guaranteed every quarter starting next month.`
          : `This week, move ${fmt(expenses * 12)} (one year of expenses) into a short-duration debt fund or FD — this ensures you never have to sell equity during a market downturn.`,
      ].join("\n");
    }

    case "sip": {
      const monthly    = Number(m["monthlyAmount"]    ?? 0);
      const invested   = Number(m["totalInvested"]    ?? 0);
      const maturity   = Number(m["maturityValue"]    ?? 0);
      const returns    = Number(m["estimatedReturns"] ?? 0);
      const ratio      = Number(m["wealthRatio"]      ?? 1);
      const realVal    = Number(m["realValue"]        ?? 0);
      const years      = Number(m["investmentYears"]  ?? 0);
      const rate       = Number(m["annualReturnRate"] ?? 12);
      const stepUp     = Number(m["stepUpPercent"]    ?? 0);
      const inflation  = Number(m["inflationRate"]    ?? 6);
      const milestones = String(m["milestonesText"]   ?? "");

      // What a 10% step-up would add vs flat
      const stepUpTip = stepUp === 0
        ? `Adding just a 10% annual step-up to your SIP could grow the final corpus by 40–60% more over ${years} years.`
        : `Your ${stepUp}% annual step-up is excellent — this dramatically accelerates corpus growth compared to a flat SIP.`;

      // Is 12% realistic?
      const returnRisk = rate > 14
        ? `A ${rate}% return assumption is optimistic — Indian equity historically averages 12–13%. Consider modelling at 11–12% for a conservative estimate.`
        : rate >= 11
        ? `A ${rate}% return is reasonable for a diversified equity SIP in India, but not guaranteed — markets can underperform for 3–5 year stretches.`
        : `A ${rate}% assumption is conservative — diversified equity SIPs in India have historically delivered 12–14% over 10+ year periods.`;

      return [
        "📊 What This Means",
        `You invest ${fmt(monthly)}/month for ${years} years, putting in a total of ${fmt(invested)}. ` +
        `At ${rate}% p.a., your corpus grows to ${fmt(maturity)} — generating ${fmt(returns)} in returns (${ratio.toFixed(1)}× your investment). ` +
        `After adjusting for ${inflation}% inflation, the real purchasing power of that corpus is ${fmt(realVal)}. ` +
        (milestones ? `Key milestones: ${milestones}.` : ""),
        "",
        "⚠️ Risks Detected",
        `• ${returnRisk}`,
        `• Inflation erosion is significant — your real corpus of ${fmt(realVal)} is ${fmt(maturity - realVal)} less than the nominal figure.`,
        stepUp === 0
          ? `• A flat SIP means you invest less and less in real terms every year as inflation rises — step-up SIPs are strongly recommended.`
          : `• Ensure you actually increase your SIP each year — many investors set step-up intentions but forget to execute.`,
        "",
        "✅ How to Improve",
        stepUp === 0
          ? `• Add a 10% annual step-up — this alone could increase your final corpus by ₹${fmt(Math.round(maturity * 0.5))} or more over ${years} years.`
          : `• Increase step-up to ${stepUp + 5}% if salary increments allow — even 2–3% more step-up creates significant compounding benefit.`,
        `• Diversify across fund categories: 50% large-cap index fund, 30% flexi-cap, 20% mid-cap — this balances stability and growth.`,
        `• Use ELSS funds for up to ${fmt(Math.min(monthly, 12500))}/month of your SIP to claim Section 80C deduction and save up to ${fmt(Math.min(monthly * 12, 150000) * 0.3)} in tax annually.`,
        "",
        "🎯 Your Next Step",
        stepUp === 0
          ? `Set up a 10% step-up instruction with your mutual fund platform today — most apps (Zerodha Coin, Groww, Kuvera) let you do this in under 2 minutes.`
          : `Log into your mutual fund platform this week and confirm your step-up instruction is active for next April — then set a calendar reminder to verify it triggers.`,
      ].join("\n");
    }

    default:
      return buildFallbackResponse("");
  }
}

export { LLM_MODEL };
