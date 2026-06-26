/**
 * Indian Financial Calculators  — POST /api/calculate/*
 *
 * Endpoints:
 *   POST /api/calculate/pocket-money  — Student allowance breakdown
 *   POST /api/calculate/salaried      — Indian income tax (new & old regime, FY 2024-25)
 *   POST /api/calculate/retired       — Retirement corpus & withdrawal sustainability
 *   POST /api/calculate/sip           — SIP / step-up SIP projection
 *
 * Each endpoint:
 *   1. Validates input with Zod
 *   2. Runs pure mathematical calculation
 *   3. Builds a structured summary and sends it to the AI service
 *   4. Returns { result, aiAdvice }
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { generateCalculatorAdvice, type CalculatorType } from "../services/aiService";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/** Format number as Indian Rupee string (e.g. ₹12,34,567) */
function inr(amount: number, decimals = 0): string {
  return "₹" + amount.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Round to 2 decimal places */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Clamp to minimum 0 */
const pos = (n: number) => Math.max(0, n);

// ═══════════════════════════════════════════════════════════════════════════
// INDIAN TAX BRACKETS  (FY 2024-25 / AY 2025-26)
// ═══════════════════════════════════════════════════════════════════════════

/** New tax regime brackets (Budget 2024 — default for most filers) */
const NEW_REGIME_BRACKETS = [
  { min: 0,          max: 300_000,   rate: 0.00 },
  { min: 300_000,    max: 700_000,   rate: 0.05 },
  { min: 700_000,    max: 1_000_000, rate: 0.10 },
  { min: 1_000_000,  max: 1_200_000, rate: 0.15 },
  { min: 1_200_000,  max: 1_500_000, rate: 0.20 },
  { min: 1_500_000,  max: Infinity,  rate: 0.30 },
];

/** Old tax regime brackets */
const OLD_REGIME_BRACKETS = [
  { min: 0,          max: 250_000,   rate: 0.00 },
  { min: 250_000,    max: 500_000,   rate: 0.05 },
  { min: 500_000,    max: 1_000_000, rate: 0.20 },
  { min: 1_000_000,  max: Infinity,  rate: 0.30 },
];

function computeTaxOnBrackets(
  taxableIncome: number,
  brackets: typeof NEW_REGIME_BRACKETS,
): number {
  let tax = 0;
  for (const b of brackets) {
    if (taxableIncome <= b.min) break;
    const slice = Math.min(taxableIncome, b.max) - b.min;
    tax += slice * b.rate;
  }
  return tax;
}

/** Surcharge rates (same slabs for both regimes except new regime caps at 25%) */
function surchargeRate(income: number, regime: "new" | "old"): number {
  if (income <= 5_000_000)  return 0;
  if (income <= 10_000_000) return 0.10;
  if (income <= 20_000_000) return 0.15;
  if (regime === "new")     return 0.25; // capped at 25% under new regime
  if (income <= 50_000_000) return 0.25;
  return 0.37;
}

// ═══════════════════════════════════════════════════════════════════════════
// CALCULATION FUNCTIONS (pure, no side effects)
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. Pocket Money ────────────────────────────────────────────────────────
interface ExpenseItem { category: string; amount: number }

interface PocketMoneyInput {
  monthlyAllowance: number;
  expenses: ExpenseItem[];
  savingsGoal?: number;
  savingsGoalName?: string;
  savingsRate?: number;   // % to save from surplus (default 20%)
}

interface PocketMoneyResult {
  monthlyAllowance: number;
  totalExpenses: number;
  balance: number;
  savingsAmount: number;
  spendingMoney: number;
  savingsRate: number;
  expenseBreakdown: Array<{ category: string; amount: number; percentage: number }>;
  savingsGoal?: number;
  savingsGoalName?: string;
  monthsToGoal?: number;
  budgetScore: number;          // 0-100 health score
  alerts: string[];
}

function calcPocketMoney(input: PocketMoneyInput): PocketMoneyResult {
  const { monthlyAllowance, expenses, savingsGoal, savingsGoalName } = input;
  const savingsRate = Math.min(100, Math.max(0, input.savingsRate ?? 20));

  const totalExpenses = r2(expenses.reduce((s, e) => s + e.amount, 0));
  const balance = pos(monthlyAllowance - totalExpenses);
  const savingsAmount = r2(balance * savingsRate / 100);
  const spendingMoney = r2(balance - savingsAmount);

  // Category rollup
  const catMap: Record<string, number> = {};
  for (const e of expenses) {
    catMap[e.category] = (catMap[e.category] ?? 0) + e.amount;
  }
  const expenseBreakdown = Object.entries(catMap).map(([category, amount]) => ({
    category,
    amount: r2(amount),
    percentage: r2(totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0),
  }));

  // Months to savings goal
  let monthsToGoal: number | undefined;
  if (savingsGoal && savingsGoal > 0 && savingsAmount > 0) {
    monthsToGoal = Math.ceil(savingsGoal / savingsAmount);
  }

  // Budget health score (0–100)
  const expenseRatio = totalExpenses / monthlyAllowance;
  let budgetScore = 100;
  if (expenseRatio > 1.0)  budgetScore = 20;
  else if (expenseRatio > 0.9) budgetScore = 40;
  else if (expenseRatio > 0.8) budgetScore = 60;
  else if (expenseRatio > 0.7) budgetScore = 75;
  else budgetScore = 90 + Math.round(savingsRate / 10);
  budgetScore = Math.min(100, budgetScore);

  // Alerts
  const alerts: string[] = [];
  if (totalExpenses > monthlyAllowance) {
    alerts.push(`You're overspending by ${inr(totalExpenses - monthlyAllowance)}/month.`);
  }
  if (expenseRatio > 0.8 && expenseRatio <= 1.0) {
    alerts.push("Over 80% of allowance spent — little room for savings.");
  }
  if (!savingsGoal) {
    alerts.push("No savings goal set. Having a target motivates disciplined saving.");
  }

  return {
    monthlyAllowance,
    totalExpenses,
    balance,
    savingsAmount,
    spendingMoney,
    savingsRate,
    expenseBreakdown,
    ...(savingsGoal       ? { savingsGoal }     : {}),
    ...(savingsGoalName   ? { savingsGoalName } : {}),
    ...(monthsToGoal      ? { monthsToGoal }    : {}),
    budgetScore,
    alerts,
  };
}

// ── 2. Salaried (Indian Income Tax) ───────────────────────────────────────
interface SalariedInput {
  grossAnnualSalary: number;
  regime: "new" | "old";
  age: number;
  epfPercent?: number;       // % of basic salary (default 12); basic ~ 50% of gross
  section80c?: number;       // deductions u/s 80C (old regime only, max 1.5L)
  section80d?: number;       // medical insurance (old regime)
  npsContribution?: number;  // 80CCD(1B) additional NPS (max 50K, old regime)
  hra?: number;              // HRA exemption (old regime)
  otherDeductions?: number;  // any other old-regime deductions
}

interface SalariedResult {
  grossAnnualSalary: number;
  grossMonthlySalary: number;
  regime: string;
  epfContributionAnnual: number;
  epfContributionMonthly: number;
  standardDeduction: number;
  totalDeductions: number;
  taxableIncome: number;
  incomeTax: number;
  surcharge: number;
  cess: number;
  totalTaxPayable: number;
  effectiveTaxRate: number;         // %
  marginalTaxRate: number;          // %
  netAnnualTakeHome: number;
  netMonthlyTakeHome: number;
  taxBracketDetail: Array<{ slab: string; rate: string; tax: number }>;
  regime87ARebate: number;
  professionalTax: number;
  summary: string;
}

function calcSalaried(input: SalariedInput): SalariedResult {
  const {
    grossAnnualSalary: gross,
    regime,
    age,
    epfPercent = 12,
    section80c = 0,
    section80d = 0,
    npsContribution = 0,
    hra = 0,
    otherDeductions = 0,
  } = input;

  const basicSalary = gross * 0.5; // convention: basic = 50% of CTC
  const epfAnnual = r2(basicSalary * (epfPercent / 100));
  const professionalTax = 2400; // ₹200/month — applicable in most states

  let taxableIncome: number;
  let deductionList: number[] = [];

  if (regime === "new") {
    const stdDeduction = 75_000; // Budget 2024
    taxableIncome = pos(gross - stdDeduction - epfAnnual);
    deductionList = [stdDeduction, epfAnnual];
  } else {
    const stdDeduction = 50_000;
    const cap80c = Math.min(section80c, 150_000);
    const cap80d = Math.min(section80d, age >= 60 ? 50_000 : 25_000);
    const capNps = Math.min(npsContribution, 50_000);
    const totalOldDeductions = stdDeduction + epfAnnual + cap80c + cap80d + capNps + hra + otherDeductions;
    taxableIncome = pos(gross - totalOldDeductions);
    deductionList = [stdDeduction, epfAnnual, cap80c, cap80d, capNps, hra, otherDeductions];
  }

  const totalDeductions = r2(deductionList.reduce((a, b) => a + b, 0));
  const standardDeduction = regime === "new" ? 75_000 : 50_000;

  const brackets = regime === "new" ? NEW_REGIME_BRACKETS : OLD_REGIME_BRACKETS;
  let rawTax = computeTaxOnBrackets(taxableIncome, brackets);

  // Section 87A rebate
  let rebate = 0;
  if (regime === "new" && taxableIncome <= 700_000) {
    rebate = Math.min(rawTax, 25_000);
  } else if (regime === "old" && taxableIncome <= 500_000) {
    rebate = Math.min(rawTax, 12_500);
  }
  rawTax = pos(rawTax - rebate);

  // Surcharge
  const surchRate = surchargeRate(taxableIncome, regime);
  const surcharge = r2(rawTax * surchRate);
  const taxPlusSurcharge = rawTax + surcharge;

  // Cess 4%
  const cess = r2(taxPlusSurcharge * 0.04);
  const totalTaxPayable = r2(taxPlusSurcharge + cess);

  const effectiveTaxRate = r2(gross > 0 ? (totalTaxPayable / gross) * 100 : 0);

  // Marginal rate
  let marginalTaxRate = 0;
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (taxableIncome > brackets[i].min) {
      marginalTaxRate = brackets[i].rate * 100;
      break;
    }
  }

  const netAnnualTakeHome = r2(pos(gross - epfAnnual - totalTaxPayable - professionalTax));
  const netMonthlyTakeHome = r2(netAnnualTakeHome / 12);

  // Bracket detail for breakdown
  const taxBracketDetail = brackets
    .filter((b) => taxableIncome > b.min && b.rate > 0)
    .map((b) => {
      const slice = Math.min(taxableIncome, b.max) - b.min;
      const minL = (b.min / 100_000).toFixed(1);
      const maxL = b.max === Infinity ? "above" : `${(b.max / 100_000).toFixed(1)}L`;
      return {
        slab: b.min === 0 ? `Up to ₹${(b.max / 100_000).toFixed(1)}L` : `₹${minL}L – ${maxL}`,
        rate: `${b.rate * 100}%`,
        tax: r2(slice * b.rate),
      };
    });

  const summary =
    `${regime === "new" ? "New" : "Old"} regime | Gross ₹${(gross / 100_000).toFixed(1)}L → ` +
    `Taxable ₹${(taxableIncome / 100_000).toFixed(1)}L | ` +
    `Tax ${inr(totalTaxPayable)} (${effectiveTaxRate}% effective) | ` +
    `Take-home ${inr(netMonthlyTakeHome)}/month`;

  return {
    grossAnnualSalary: gross,
    grossMonthlySalary: r2(gross / 12),
    regime,
    epfContributionAnnual: epfAnnual,
    epfContributionMonthly: r2(epfAnnual / 12),
    standardDeduction,
    totalDeductions,
    taxableIncome: r2(taxableIncome),
    incomeTax: r2(rawTax + rebate > 0 ? rawTax : 0),   // show pre-rebate tax separately below
    surcharge,
    cess,
    totalTaxPayable,
    effectiveTaxRate,
    marginalTaxRate,
    netAnnualTakeHome,
    netMonthlyTakeHome,
    taxBracketDetail,
    regime87ARebate: r2(rebate),
    professionalTax,
    summary,
  };
}

// ── 3. Retired ─────────────────────────────────────────────────────────────
interface RetiredInput {
  portfolioValue: number;       // total investable corpus in ₹
  monthlyPension?: number;      // pension / annuity / EPF withdrawal per month
  monthlyExpenses: number;
  age: number;
  withdrawalRate?: number;      // % per annum (default 3.5 for India — conservative)
  inflationRate?: number;       // % (default 6 — Indian avg)
  portfolioReturnRate?: number; // % (default 8 — balanced Indian portfolio)
}

interface RetiredResult {
  portfolioValue: number;
  monthlyPension: number;
  monthlyWithdrawal: number;
  totalMonthlyIncome: number;
  monthlyExpenses: number;
  monthlySurplusDeficit: number;
  withdrawalRate: number;
  sustainableYears: number | null;
  portfolioHealth: "excellent" | "good" | "fair" | "at-risk";
  corpusRequired: number;       // corpus needed to cover expenses fully
  corpusShortfall: number;      // shortfall vs required (0 if surplus)
  scss: {
    maxInvestment: number;
    annualIncome: number;
    quarterlyIncome: number;
  };
  yearlyProjection: Array<{ year: number; corpus: number; withdrawal: number }>;
  recommendations: string[];
}

function calcRetired(input: RetiredInput): RetiredResult {
  const {
    portfolioValue,
    monthlyPension = 0,
    monthlyExpenses,
    age,
    withdrawalRate = 3.5,
    inflationRate = 6,
    portfolioReturnRate = 8,
  } = input;

  const annualWithdrawalRate = withdrawalRate / 100;
  const annualReturn = portfolioReturnRate / 100;

  const monthlyPortfolioWithdrawal = r2((portfolioValue * annualWithdrawalRate) / 12);
  const totalMonthlyIncome = r2(monthlyPension + monthlyPortfolioWithdrawal);
  const monthlySurplusDeficit = r2(totalMonthlyIncome - monthlyExpenses);

  // Simulate year-by-year corpus depletion
  const annualExpenses = monthlyExpenses * 12;
  const annualPension = monthlyPension * 12;
  let corpus = portfolioValue;
  let sustainableYears: number | null = null;
  const yearlyProjection: RetiredResult["yearlyProjection"] = [];

  for (let yr = 1; yr <= 50; yr++) {
    const inflationFactor = Math.pow(1 + inflationRate / 100, yr - 1);
    const yearExpenses = annualExpenses * inflationFactor;
    const yearPension = annualPension;
    const yearWithdrawal = pos(yearExpenses - yearPension);
    corpus = corpus * (1 + annualReturn) - yearWithdrawal;

    if (yr <= 30) {
      yearlyProjection.push({
        year: yr,
        corpus: r2(Math.max(0, corpus)),
        withdrawal: r2(yearWithdrawal),
      });
    }

    if (corpus <= 0 && sustainableYears === null) {
      sustainableYears = yr;
      break;
    }
  }

  const lifeExpectancy = 85;
  const yearsLeft = lifeExpectancy - age;
  const portfolioHealth: RetiredResult["portfolioHealth"] =
    sustainableYears === null                    ? "excellent"
    : sustainableYears > yearsLeft + 10          ? "excellent"
    : sustainableYears > yearsLeft               ? "good"
    : sustainableYears > yearsLeft * 0.75        ? "fair"
    : "at-risk";

  // Corpus required to self-fund expenses without pension (at withdrawalRate)
  const corpusRequired = r2((annualExpenses / annualWithdrawalRate));
  const corpusShortfall = r2(pos(corpusRequired - portfolioValue));

  // SCSS (Senior Citizen Savings Scheme — rate 8.2% p.a. as of 2024)
  const scssMax = Math.min(portfolioValue, 3_000_000); // max ₹30L
  const scssAnnualIncome = r2(scssMax * 0.082);
  const scss = {
    maxInvestment: scssMax,
    annualIncome: scssAnnualIncome,
    quarterlyIncome: r2(scssAnnualIncome / 4),
  };

  // Recommendations
  const recs: string[] = [];
  if (portfolioHealth === "at-risk" || portfolioHealth === "fair") {
    recs.push(`Consider investing up to ${inr(scss.maxInvestment)} in SCSS at 8.2% p.a. for guaranteed quarterly income of ${inr(scss.quarterlyIncome)}.`);
    recs.push("Reduce discretionary spending by 10–15% in early retirement years to preserve the corpus.");
    recs.push("RBI Floating Rate Savings Bonds (7.35% p.a.) offer safe income for the conservative portion of your portfolio.");
  }
  if (portfolioHealth === "excellent") {
    recs.push("Your corpus is robust. Consider leaving a legacy through SWP (Systematic Withdrawal Plan) from balanced advantage funds.");
    recs.push("Explore tax-efficient withdrawal: long-term capital gains from equity MFs taxed at only 12.5% (above ₹1.25L).");
  }
  recs.push(`At ${inflationRate}% inflation, your ₹${(monthlyExpenses / 1000).toFixed(0)}K/month expenses will require ${inr(Math.round(monthlyExpenses * Math.pow(1.06, 10)))} in 10 years.`);
  recs.push("Maintain 12–24 months of expenses in a liquid fund or savings account as your retirement emergency buffer.");

  return {
    portfolioValue,
    monthlyPension,
    monthlyWithdrawal: monthlyPortfolioWithdrawal,
    totalMonthlyIncome,
    monthlyExpenses,
    monthlySurplusDeficit,
    withdrawalRate,
    sustainableYears,
    portfolioHealth,
    corpusRequired,
    corpusShortfall,
    scss,
    yearlyProjection,
    recommendations: recs,
  };
}

// ── 4. SIP ─────────────────────────────────────────────────────────────────
interface SipInput {
  monthlyAmount: number;
  annualReturnRate: number;    // % e.g. 12
  investmentYears: number;
  stepUpPercent?: number;      // annual step-up % (default 0 = flat SIP)
  inflationRate?: number;      // to compute real value (default 6)
}

interface SipResult {
  monthlyAmount: number;
  annualReturnRate: number;
  investmentYears: number;
  stepUpPercent: number;
  totalMonths: number;
  totalInvested: number;
  estimatedReturns: number;
  maturityValue: number;
  wealthRatio: number;         // maturityValue / totalInvested
  realValue: number;           // inflation-adjusted maturity value
  inflationRate: number;
  yearWiseBreakdown: Array<{
    year: number;
    monthlyAmount: number;
    totalInvestedTillYear: number;
    portfolioValue: number;
    gains: number;
  }>;
  milestones: Array<{ label: string; year: number; value: number }>;
}

function calcSip(input: SipInput): SipResult {
  const {
    monthlyAmount,
    annualReturnRate,
    investmentYears,
    stepUpPercent = 0,
    inflationRate = 6,
  } = input;

  const monthlyRate = annualReturnRate / 12 / 100;
  const totalMonths = investmentYears * 12;

  let portfolio = 0;
  let totalInvested = 0;
  let currentMonthly = monthlyAmount;

  const yearWiseBreakdown: SipResult["yearWiseBreakdown"] = [];

  for (let yr = 1; yr <= investmentYears; yr++) {
    for (let m = 1; m <= 12; m++) {
      portfolio = (portfolio + currentMonthly) * (1 + monthlyRate);
      totalInvested += currentMonthly;
    }
    yearWiseBreakdown.push({
      year: yr,
      monthlyAmount: r2(currentMonthly),
      totalInvestedTillYear: r2(totalInvested),
      portfolioValue: r2(portfolio),
      gains: r2(portfolio - totalInvested),
    });
    if (stepUpPercent > 0) {
      currentMonthly = currentMonthly * (1 + stepUpPercent / 100);
    }
  }

  const maturityValue = r2(portfolio);
  const estimatedReturns = r2(maturityValue - totalInvested);
  const wealthRatio = r2(totalInvested > 0 ? maturityValue / totalInvested : 1);

  // Real (inflation-adjusted) value
  const inflationFactor = Math.pow(1 + inflationRate / 100, investmentYears);
  const realValue = r2(maturityValue / inflationFactor);

  // Milestone detection — when corpus first crosses key amounts
  const milestoneTargets = [1_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000];
  const milestones: SipResult["milestones"] = [];
  for (const target of milestoneTargets) {
    const hit = yearWiseBreakdown.find((y) => y.portfolioValue >= target);
    if (hit) {
      milestones.push({
        label: target >= 10_000_000
          ? `₹${(target / 10_000_000).toFixed(0)} Cr`
          : `₹${(target / 100_000).toFixed(0)}L`,
        year: hit.year,
        value: hit.portfolioValue,
      });
    }
  }

  return {
    monthlyAmount,
    annualReturnRate,
    investmentYears,
    stepUpPercent,
    totalMonths,
    totalInvested: r2(totalInvested),
    estimatedReturns,
    maturityValue,
    wealthRatio,
    realValue,
    inflationRate,
    yearWiseBreakdown,
    milestones,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AI PROMPT BUILDERS  (rich context so LLM can reason deeply)
// ═══════════════════════════════════════════════════════════════════════════

function pocketMoneyPrompt(r: PocketMoneyResult): string {
  const bd = r.expenseBreakdown
    .sort((a, b) => b.amount - a.amount)
    .map((e) => `  • ${e.category}: ${inr(e.amount)} (${e.percentage}% of expenses)`)
    .join("\n");
  const bigCat = r.expenseBreakdown.sort((a, b) => b.amount - a.amount)[0];
  const expenseRatioPct = r.monthlyAllowance > 0
    ? ((r.totalExpenses / r.monthlyAllowance) * 100).toFixed(0) : "0";

  return [
    "=== STUDENT BUDGET ANALYSIS (Indian Rupees) ===",
    `Monthly allowance : ${inr(r.monthlyAllowance)}`,
    `Total expenses    : ${inr(r.totalExpenses)} (${expenseRatioPct}% of allowance)`,
    `Balance remaining : ${inr(r.balance)}`,
    `Savings amount    : ${inr(r.savingsAmount)} (${r.savingsRate}% of balance)`,
    `Spending money    : ${inr(r.spendingMoney)}`,
    `Budget score      : ${r.budgetScore}/100`,
    "",
    "Expense breakdown (largest first):",
    bd,
    "",
    r.savingsGoal
      ? `Savings goal: ${inr(r.savingsGoal)}${r.savingsGoalName ? ` for "${r.savingsGoalName}"` : ""} — estimated ${r.monthsToGoal} months at current rate`
      : "No savings goal set.",
    "",
    `Alerts: ${r.alerts.length > 0 ? r.alerts.join(" | ") : "None"}`,
    `Biggest expense category: ${bigCat?.category ?? "N/A"} at ${inr(bigCat?.amount ?? 0)}`,
    "",
    "Using the data above, respond with the 4-section format.",
    "Explain what the numbers mean for this student's financial health.",
    "Flag specific risks (e.g. overspending, no emergency buffer).",
    "Suggest 3 concrete improvements using the actual figures.",
    "Give one actionable next step with a specific rupee amount.",
  ].join("\n");
}

function pocketMoneyMetrics(r: PocketMoneyResult): Record<string, number | string> {
  const sorted = [...r.expenseBreakdown].sort((a, b) => b.amount - a.amount);
  return {
    monthlyAllowance:       r.monthlyAllowance,
    totalExpenses:          r.totalExpenses,
    balance:                r.balance,
    savingsAmount:          r.savingsAmount,
    spendingMoney:          r.spendingMoney,
    savingsRate:            r.savingsRate,
    budgetScore:            r.budgetScore,
    biggestCategory:        sorted[0]?.category ?? "",
    biggestCategoryAmount:  sorted[0]?.amount   ?? 0,
    monthsToGoal:           r.monthsToGoal ?? "",
    savingsGoalName:        r.savingsGoalName ?? "",
    savingsGoal:            r.savingsGoal ?? 0,
  };
}

function salariedPrompt(r: SalariedResult): string {
  const slabs = r.taxBracketDetail
    .map((b) => `  • ${b.slab} @ ${b.rate} → tax ${inr(b.tax)}`)
    .join("\n");
  const unused80c = Math.max(0, 150_000 - (r.totalDeductions - r.standardDeduction - r.epfContributionAnnual));

  return [
    "=== INDIAN SALARY TAX ANALYSIS (FY 2024-25) ===",
    `Gross annual CTC       : ${inr(r.grossAnnualSalary)} (${inr(r.grossMonthlySalary)}/month)`,
    `Tax regime             : ${r.regime === "new" ? "New regime (FY24 Budget)" : "Old regime"}`,
    `Standard deduction     : ${inr(r.standardDeduction)}`,
    `EPF contribution       : ${inr(r.epfContributionAnnual)}/year (${inr(r.epfContributionMonthly)}/month)`,
    `Total deductions       : ${inr(r.totalDeductions)}`,
    `Taxable income         : ${inr(r.taxableIncome)}`,
    "",
    "Tax computation:",
    slabs || "  • Fully exempt (no taxable income in brackets)",
    `  Section 87A rebate   : ${inr(r.regime87ARebate)}`,
    `  Surcharge            : ${inr(r.surcharge)}`,
    `  Cess (4%)            : ${inr(r.cess)}`,
    `  Total tax payable    : ${inr(r.totalTaxPayable)}`,
    `  Effective rate       : ${r.effectiveTaxRate}%`,
    `  Marginal rate        : ${r.marginalTaxRate}%`,
    "",
    `Net annual take-home   : ${inr(r.netAnnualTakeHome)}`,
    `Net monthly take-home  : ${inr(r.netMonthlyTakeHome)}`,
    `Unused 80C capacity    : ${inr(unused80c)} (potential annual tax saving: ${inr(Math.round(unused80c * r.marginalTaxRate / 100))})`,
    "",
    "Using the data above, respond with the 4-section format.",
    "Explain what the effective vs marginal rate means in plain language.",
    "Identify tax risks (unused deductions, wrong regime choice).",
    "Suggest 3 specific actions using actual rupee amounts (80C/80D/NPS).",
    "Give one concrete next step this week.",
  ].join("\n");
}

function salariedMetrics(r: SalariedResult): Record<string, number | string> {
  return {
    grossAnnualSalary:      r.grossAnnualSalary,
    taxableIncome:          r.taxableIncome,
    totalTaxPayable:        r.totalTaxPayable,
    effectiveTaxRate:       r.effectiveTaxRate,
    marginalTaxRate:        r.marginalTaxRate,
    netMonthlyTakeHome:     r.netMonthlyTakeHome,
    netAnnualTakeHome:      r.netAnnualTakeHome,
    epfContributionAnnual:  r.epfContributionAnnual,
    regime:                 r.regime,
    regime87ARebate:        r.regime87ARebate,
    section80c:             Math.max(0, r.totalDeductions - r.standardDeduction - r.epfContributionAnnual),
    npsContribution:        0,
  };
}

function retiredPrompt(r: RetiredResult): string {
  const proj = r.yearlyProjection.slice(0, 10)
    .map((y) => `  Year ${y.year}: corpus ${inr(y.corpus)}, withdrawal ${inr(y.withdrawal)}`)
    .join("\n");
  const isDeficit = r.monthlySurplusDeficit < 0;

  return [
    "=== INDIAN RETIREMENT CORPUS ANALYSIS ===",
    `Portfolio value        : ${inr(r.portfolioValue)}`,
    `Monthly pension income : ${inr(r.monthlyPension)}`,
    `Monthly portfolio draw : ${inr(r.monthlyWithdrawal)} (at ${r.withdrawalRate}% annual rate)`,
    `Total monthly income   : ${inr(r.totalMonthlyIncome)}`,
    `Monthly expenses       : ${inr(r.monthlyExpenses)}`,
    `Monthly surplus/deficit: ${isDeficit ? "-" : "+"}${inr(Math.abs(r.monthlySurplusDeficit))} ${isDeficit ? "(SHORTFALL)" : "(SURPLUS)"}`,
    "",
    `Portfolio health       : ${r.portfolioHealth.toUpperCase()}`,
    `Corpus sustainable for : ${r.sustainableYears !== null ? `~${r.sustainableYears} years` : "50+ years"}`,
    `Required corpus (full) : ${inr(r.corpusRequired)}`,
    `Corpus shortfall       : ${inr(r.corpusShortfall)}`,
    "",
    "SCSS opportunity:",
    `  Max investment : ${inr(r.scss.maxInvestment)} (capped at ₹30L)`,
    `  Annual income  : ${inr(r.scss.annualIncome)} at 8.2% p.a.`,
    `  Quarterly payout: ${inr(r.scss.quarterlyIncome)}`,
    "",
    "10-year corpus projection:",
    proj,
    "",
    "Using the data above, respond with the 4-section format.",
    "Explain what portfolio health means and the shortfall/surplus impact.",
    "Identify risks: sequence of returns, inflation erosion, longevity.",
    "Suggest 3 instrument-specific improvements (SCSS, RBI bonds, bucket strategy).",
    "Give one action they can take at a bank or post office this week.",
  ].join("\n");
}

function retiredMetrics(r: RetiredResult): Record<string, number | string> {
  return {
    portfolioValue:         r.portfolioValue,
    monthlyPension:         r.monthlyPension,
    monthlyWithdrawal:      r.monthlyWithdrawal,
    totalMonthlyIncome:     r.totalMonthlyIncome,
    monthlyExpenses:        r.monthlyExpenses,
    monthlySurplusDeficit:  r.monthlySurplusDeficit,
    portfolioHealth:        r.portfolioHealth,
    sustainableYears:       r.sustainableYears ?? "",
    corpusRequired:         r.corpusRequired,
    corpusShortfall:        r.corpusShortfall,
    scssMaxInvestment:      r.scss.maxInvestment,
    scssAnnualIncome:       r.scss.annualIncome,
    scssQuarterlyIncome:    r.scss.quarterlyIncome,
    withdrawalRate:         r.withdrawalRate,
  };
}

function sipPrompt(r: SipResult): string {
  const msText = r.milestones.map((m) => `${m.label} at year ${m.year}`).join(", ");
  const yr5  = r.yearWiseBreakdown.find((y) => y.year === 5);
  const yr10 = r.yearWiseBreakdown.find((y) => y.year === 10);
  const yr15 = r.yearWiseBreakdown.find((y) => y.year === 15);

  return [
    "=== INDIAN SIP PROJECTION ===",
    `Monthly SIP amount     : ${inr(r.monthlyAmount)}${r.stepUpPercent > 0 ? ` with ${r.stepUpPercent}% annual step-up` : " (flat — no step-up)"}`,
    `Investment duration    : ${r.investmentYears} years (${r.totalMonths} months)`,
    `Expected return        : ${r.annualReturnRate}% p.a. (monthly compounding)`,
    `Inflation assumption   : ${r.inflationRate}% p.a.`,
    "",
    `Total amount invested  : ${inr(r.totalInvested)}`,
    `Estimated returns      : ${inr(r.estimatedReturns)}`,
    `Maturity value (nominal): ${inr(r.maturityValue)}`,
    `Wealth ratio           : ${r.wealthRatio}× (every ₹1 invested grows to ₹${r.wealthRatio})`,
    `Real value (inflation-adj): ${inr(r.realValue)} — actual purchasing power`,
    `Inflation erosion      : ${inr(r.maturityValue - r.realValue)} lost to inflation`,
    "",
    "Corpus at key checkpoints:",
    yr5  ? `  Year  5: portfolio ${inr(yr5.portfolioValue)}, gains ${inr(yr5.gains)}` : "",
    yr10 ? `  Year 10: portfolio ${inr(yr10.portfolioValue)}, gains ${inr(yr10.gains)}` : "",
    yr15 ? `  Year 15: portfolio ${inr(yr15.portfolioValue)}, gains ${inr(yr15.gains)}` : "",
    "",
    msText ? `Milestones: ${msText}` : "No major milestones reached.",
    "",
    "Using the data above, respond with the 4-section format.",
    "Explain the power of compounding and what the wealth ratio means.",
    "Identify risks: return rate realism, inflation erosion, flat SIP vs step-up.",
    "Suggest 3 fund-category improvements (large-cap, ELSS, mid-cap mix).",
    "Give one specific platform action (Zerodha Coin / Groww / Kuvera) this week.",
  ].filter(Boolean).join("\n");
}

function sipMetrics(r: SipResult): Record<string, number | string> {
  return {
    monthlyAmount:    r.monthlyAmount,
    totalInvested:    r.totalInvested,
    estimatedReturns: r.estimatedReturns,
    maturityValue:    r.maturityValue,
    wealthRatio:      r.wealthRatio,
    realValue:        r.realValue,
    investmentYears:  r.investmentYears,
    annualReturnRate: r.annualReturnRate,
    stepUpPercent:    r.stepUpPercent,
    inflationRate:    r.inflationRate,
    milestonesText:   r.milestones.map((m) => `${m.label} at year ${m.year}`).join(", "),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ZOD SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const ExpenseItemSchema = z.object({
  category: z.string().min(1).max(50),
  amount:   z.number().nonnegative(),
});

const PocketMoneySchema = z.object({
  monthlyAllowance: z.number().positive("Monthly allowance must be positive"),
  expenses:         z.array(ExpenseItemSchema).min(1, "Provide at least one expense"),
  savingsGoal:      z.number().positive().optional(),
  savingsGoalName:  z.string().max(100).optional(),
  savingsRate:      z.number().min(0).max(100).optional().default(20),
});

const SalariedSchema = z.object({
  grossAnnualSalary: z.number().positive("Annual salary must be positive"),
  regime:            z.enum(["new", "old"]).default("new"),
  age:               z.number().int().min(18).max(80),
  epfPercent:        z.number().min(0).max(12).optional().default(12),
  section80c:        z.number().min(0).max(150_000).optional().default(0),
  section80d:        z.number().min(0).max(100_000).optional().default(0),
  npsContribution:   z.number().min(0).max(50_000).optional().default(0),
  hra:               z.number().min(0).optional().default(0),
  otherDeductions:   z.number().min(0).optional().default(0),
});

const RetiredSchema = z.object({
  portfolioValue:      z.number().positive("Portfolio value must be positive"),
  monthlyPension:      z.number().nonnegative().optional().default(0),
  monthlyExpenses:     z.number().positive("Monthly expenses must be positive"),
  age:                 z.number().int().min(40).max(100),
  withdrawalRate:      z.number().min(1).max(10).optional().default(3.5),
  inflationRate:       z.number().min(1).max(15).optional().default(6),
  portfolioReturnRate: z.number().min(1).max(20).optional().default(8),
});

const SipSchema = z.object({
  monthlyAmount:    z.number().positive("Monthly SIP amount must be positive"),
  annualReturnRate: z.number().min(1).max(30),
  investmentYears:  z.number().int().min(1).max(40),
  stepUpPercent:    z.number().min(0).max(30).optional().default(0),
  inflationRate:    z.number().min(1).max(15).optional().default(6),
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generic wrapper: validate → calculate → AI advice → respond
 * Response shape: { calculation_result, ai_advice }
 */
async function handleCalc<T, R>(
  req: any, res: any,
  schema: z.ZodType<T>,
  calcFn:    (input: T) => R,
  promptFn:  (result: R) => string,
  metricsFn: (result: R) => Record<string, number | string>,
  type: CalculatorType,
): Promise<void> {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parsed.error.issues.map((i: any) => ({
        field:   i.path.join(".") || "body",
        message: i.message,
      })),
    });
    return;
  }

  try {
    const calculation_result = calcFn(parsed.data);
    const prompt   = promptFn(calculation_result);
    const metrics  = metricsFn(calculation_result);

    logger.info({ type }, "Generating structured AI advice for calculator result");
    const ai_advice = await generateCalculatorAdvice(type, prompt, metrics);

    res.json({ calculation_result, ai_advice });
  } catch (err) {
    logger.error({ err, type }, "Calculation or AI error");
    res.status(500).json({ error: "Internal calculation error", detail: String(err) });
  }
}

router.post("/calculate/pocket-money", (req, res) =>
  handleCalc(req, res, PocketMoneySchema, calcPocketMoney, pocketMoneyPrompt, pocketMoneyMetrics, "pocket-money"),
);

router.post("/calculate/salaried", (req, res) =>
  handleCalc(req, res, SalariedSchema, calcSalaried, salariedPrompt, salariedMetrics, "salaried"),
);

router.post("/calculate/retired", (req, res) =>
  handleCalc(req, res, RetiredSchema, calcRetired, retiredPrompt, retiredMetrics, "retired"),
);

router.post("/calculate/sip", (req, res) =>
  handleCalc(req, res, SipSchema, calcSip, sipPrompt, sipMetrics, "sip"),
);

export default router;
