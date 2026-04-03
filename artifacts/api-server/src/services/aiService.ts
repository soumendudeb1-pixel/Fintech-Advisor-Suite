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

// ── Fallback (no API key or LLM error) ───────────────────────────────────
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
  if (m.includes("reliance") || m.includes("tcs") || m.includes("infosys") || m.includes("zomato") || m.includes("hdfc")) {
    return "Blue-chip NSE stocks like Reliance, TCS, and Infosys have strong fundamentals and consistent revenue growth. Before investing, check: P/E ratio vs sector average, 52-week range position, promoter holding, and debt-to-equity ratio. For beginners, a diversified large-cap mutual fund provides exposure to all top NSE companies without concentration risk.";
  }
  if (m.includes("retirement") || m.includes("pension") || m.includes("nps")) {
    return "For retirement planning in India: NPS (National Pension Scheme) offers tax benefits and market-linked returns with an equity option (Tier I, up to 75% equity allocation). Senior Citizen Savings Scheme (SCSS) gives 8.2% p.a. with quarterly payouts. A healthy retirement corpus target: 25× your annual expenses, following the 4% safe withdrawal rule.";
  }
  if (m.includes("crypto") || m.includes("bitcoin")) {
    return "Cryptocurrency carries very high risk and is subject to 30% flat tax + 1% TDS in India (as of FY 2022-23). Treat it as highly speculative — allocate no more than 5% of your portfolio if you decide to invest. SEBI currently does not regulate crypto, so there's no investor protection. Focus on building a solid equity + debt foundation first.";
  }
  if (m.includes("emergency") || m.includes("fund") || m.includes("save")) {
    return "Every solid financial plan starts with an emergency fund: 3–6 months of expenses in a liquid account. Use a high-yield savings account (currently 6–7% in India via major banks) or liquid mutual funds for easy access. Do not invest this money in stocks or ELSS. Once the emergency fund is set, then redirect surplus to long-term investments.";
  }

  return (
    "I'm KnowEdge AI, your expert for Indian and global financial markets. " +
    "I can help with: NSE/BSE stock analysis, SIP and mutual fund strategy, tax planning (80C, ELSS, PPF, NPS), " +
    "retirement planning, and portfolio allocation. " +
    "For live AI responses powered by a language model, ask your administrator to configure the LLM_API_KEY environment variable. " +
    "What financial question can I help you with today?"
  );
}

export { LLM_MODEL };
