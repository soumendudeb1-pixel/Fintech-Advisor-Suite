/**
 * Axios API client for KnowEdge backend.
 *
 * Base URL resolution order:
 *  1. REACT_APP_BACKEND_URL  env var (set via Replit secrets or .env)
 *  2. VITE_BACKEND_URL       env var (Vite-native alias)
 *  3. <app base path>/api    — same host, handled by the reverse proxy
 */
import axios from "axios";

const explicitBase =
  import.meta.env.REACT_APP_BACKEND_URL ??
  import.meta.env.VITE_BACKEND_URL ??
  null;

const appBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

export const api = axios.create({
  baseURL: explicitBase ?? `${appBase}/api`,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// ─── Types for the new /calculate/* endpoints ──────────────────────────────

export interface ExpenseItem {
  category: string;
  amount: number;
  percentage?: number;
}

export interface PocketMoneyResult {
  monthlyAllowance: number;
  totalExpenses: number;
  balance: number;
  savingsAmount: number;
  spendingMoney: number;
  savingsRate: number;
  budgetScore: number;
  expenseBreakdown: ExpenseItem[];
  alerts: string[];
  savingsGoal?: number;
  savingsGoalName?: string;
  monthsToGoal?: number;
}

export interface SalariedResult {
  grossAnnualSalary: number;
  grossMonthlySalary: number;
  regime: "new" | "old";
  taxableIncome: number;
  totalTaxPayable: number;
  effectiveTaxRate: number;
  marginalTaxRate: number;
  netMonthlyTakeHome: number;
  netAnnualTakeHome: number;
  epfContributionAnnual: number;
  epfContributionMonthly: number;
  standardDeduction: number;
  totalDeductions: number;
  regime87ARebate: number;
  cess: number;
  surcharge: number;
  taxBracketDetail: Array<{ slab: string; rate: string; tax: number }>;
}

export interface RetiredResult {
  portfolioValue: number;
  monthlyPension: number;
  monthlyWithdrawal: number;
  totalMonthlyIncome: number;
  monthlyExpenses: number;
  monthlySurplusDeficit: number;
  withdrawalRate: number;
  portfolioHealth: "excellent" | "good" | "fair" | "poor";
  sustainableYears: number | null;
  corpusRequired: number;
  corpusShortfall: number;
  scss: { maxInvestment: number; annualIncome: number; quarterlyIncome: number };
  yearlyProjection: Array<{ year: number; corpus: number; withdrawal: number }>;
}

export interface SipResult {
  monthlyAmount: number;
  totalInvested: number;
  estimatedReturns: number;
  maturityValue: number;
  wealthRatio: number;
  realValue: number;
  investmentYears: number;
  totalMonths: number;
  annualReturnRate: number;
  stepUpPercent: number;
  inflationRate: number;
  milestones: Array<{ year: number; label: string; value: number }>;
  yearWiseBreakdown: Array<{ year: number; portfolioValue: number; invested: number; gains: number }>;
}

export interface CalcResponse<T> {
  calculation_result: T;
  ai_advice: string;
}

// ─── API call helpers ──────────────────────────────────────────────────────

export const calcApi = {
  pocketMoney: (body: Record<string, unknown>) =>
    api.post<CalcResponse<PocketMoneyResult>>("/calculate/pocket-money", body),

  salaried: (body: Record<string, unknown>) =>
    api.post<CalcResponse<SalariedResult>>("/calculate/salaried", body),

  retired: (body: Record<string, unknown>) =>
    api.post<CalcResponse<RetiredResult>>("/calculate/retired", body),

  sip: (body: Record<string, unknown>) =>
    api.post<CalcResponse<SipResult>>("/calculate/sip", body),
};

// ─── Formatting helpers ────────────────────────────────────────────────────

export function inr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function pct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}
