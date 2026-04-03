import { Router, type IRouter } from "express";
import {
  CalculatePocketMoneyBody,
  CalculateSalaryBody,
  CalculateRetirementBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const TAX_BRACKETS_SINGLE = [
  { min: 0, max: 11600, rate: 0.10 },
  { min: 11600, max: 47150, rate: 0.12 },
  { min: 47150, max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 },
];

const TAX_BRACKETS_MARRIED = [
  { min: 0, max: 23200, rate: 0.10 },
  { min: 23200, max: 94300, rate: 0.12 },
  { min: 94300, max: 201050, rate: 0.22 },
  { min: 201050, max: 383900, rate: 0.24 },
  { min: 383900, max: 487450, rate: 0.32 },
  { min: 487450, max: 731200, rate: 0.35 },
  { min: 731200, max: Infinity, rate: 0.37 },
];

const STATE_TAX_RATES: Record<string, number> = {
  AL: 0.05, AK: 0.0, AZ: 0.025, AR: 0.047, CA: 0.093, CO: 0.044,
  CT: 0.069, DE: 0.066, FL: 0.0, GA: 0.055, HI: 0.11, ID: 0.058,
  IL: 0.0495, IN: 0.031, IA: 0.057, KS: 0.057, KY: 0.045, LA: 0.042,
  ME: 0.0715, MD: 0.0575, MA: 0.05, MI: 0.0425, MN: 0.0985, MS: 0.05,
  MO: 0.054, MT: 0.069, NE: 0.068, NV: 0.0, NH: 0.0, NJ: 0.1075,
  NM: 0.059, NY: 0.0685, NC: 0.0499, ND: 0.029, OH: 0.0399, OK: 0.0475,
  OR: 0.099, PA: 0.0307, RI: 0.0599, SC: 0.065, SD: 0.0, TN: 0.0,
  TX: 0.0, UT: 0.0485, VT: 0.0875, VA: 0.0575, WA: 0.0, WV: 0.065,
  WI: 0.0765, WY: 0.0,
};

function calculateFederalTax(income: number, brackets: typeof TAX_BRACKETS_SINGLE): number {
  let tax = 0;
  for (const bracket of brackets) {
    if (income <= bracket.min) break;
    const taxableInThisBracket = Math.min(income, bracket.max) - bracket.min;
    tax += taxableInThisBracket * bracket.rate;
  }
  return tax;
}

function getMarginalRate(income: number, brackets: typeof TAX_BRACKETS_SINGLE): number {
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (income > brackets[i].min) {
      return brackets[i].rate;
    }
  }
  return brackets[0].rate;
}

router.post("/calculator/pocket-money", async (req, res): Promise<void> => {
  const parsed = CalculatePocketMoneyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { monthlyAllowance, expenses, savingsGoal, savingsGoalName } = parsed.data;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remainingFunMoney = Math.max(0, monthlyAllowance - totalExpenses);

  const categoryTotals: Record<string, number> = {};
  for (const expense of expenses) {
    categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
  }

  const expenseBreakdown = Object.entries(categoryTotals).map(([category, total]) => ({
    category,
    total,
    percentage: totalExpenses > 0 ? parseFloat(((total / totalExpenses) * 100).toFixed(1)) : 0,
  }));

  let savingsAmount: number | null = null;
  let remainingAfterSavings: number | null = null;
  let daysToGoal: number | null = null;

  if (savingsGoal && savingsGoal > 0 && remainingFunMoney > 0) {
    savingsAmount = Math.min(remainingFunMoney * 0.2, remainingFunMoney);
    remainingAfterSavings = remainingFunMoney - savingsAmount;
    daysToGoal = Math.ceil((savingsGoal / savingsAmount) * 30);
  }

  const tips: string[] = [];
  if (totalExpenses > monthlyAllowance * 0.8) {
    tips.push("You are spending more than 80% of your allowance. Try cutting non-essential expenses.");
  }
  if (categoryTotals["Food"] && categoryTotals["Food"] > monthlyAllowance * 0.3) {
    tips.push("Food spending is high. Consider meal prepping or cooking at home more often.");
  }
  if (remainingFunMoney < 20) {
    tips.push("Very little fun money remaining. Review your largest expenses for potential savings.");
  } else if (remainingFunMoney > monthlyAllowance * 0.3) {
    tips.push("Great job! You have a healthy amount of fun money. Consider putting some into savings.");
  }
  if (!savingsGoal) {
    tips.push("Set a savings goal to stay motivated. Even saving 10% each month adds up quickly.");
  }
  if (savingsGoalName && daysToGoal) {
    tips.push(`At your current savings rate, you will reach your goal of "${savingsGoalName}" in approximately ${daysToGoal} days.`);
  }

  res.json({
    monthlyAllowance,
    totalExpenses,
    remainingFunMoney,
    savingsAmount,
    remainingAfterSavings,
    daysToGoal,
    expenseBreakdown,
    tips,
  });
});

router.post("/calculator/salary", async (req, res): Promise<void> => {
  const parsed = CalculateSalaryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { grossSalary, payPeriod, filingStatus, state, additionalDeductions, retirement401k } = parsed.data;

  const annualSalary = payPeriod === "annual" ? grossSalary
    : payPeriod === "monthly" ? grossSalary * 12
    : payPeriod === "biweekly" ? grossSalary * 26
    : grossSalary * 52;

  const standardDeduction = filingStatus === "married" ? 29200 : 14600;
  const retirement401kAmount = retirement401k ? (annualSalary * retirement401k / 100) : 0;
  const additionalDeductionAmount = additionalDeductions || 0;

  const taxableIncome = Math.max(0, annualSalary - standardDeduction - retirement401kAmount - additionalDeductionAmount);

  const brackets = filingStatus === "married" ? TAX_BRACKETS_MARRIED : TAX_BRACKETS_SINGLE;
  const federalTax = calculateFederalTax(taxableIncome, brackets);
  const marginalRate = getMarginalRate(taxableIncome, brackets);

  const stateTaxRate = STATE_TAX_RATES[state.toUpperCase()] || 0.05;
  const stateTax = annualSalary * stateTaxRate;

  const socialSecurityTax = Math.min(annualSalary * 0.062, 168600 * 0.062);
  const medicareTax = annualSalary * 0.0145 + (annualSalary > 200000 ? (annualSalary - 200000) * 0.009 : 0);

  const totalTax = federalTax + stateTax + socialSecurityTax + medicareTax;
  const netAnnual = annualSalary - totalTax - retirement401kAmount - additionalDeductionAmount;
  const netMonthly = netAnnual / 12;
  const netBiweekly = netAnnual / 26;
  const effectiveTaxRate = (totalTax / annualSalary) * 100;

  res.json({
    grossSalary: annualSalary,
    grossMonthly: annualSalary / 12,
    netAnnual,
    netMonthly,
    netBiweekly,
    effectiveTaxRate: parseFloat(effectiveTaxRate.toFixed(2)),
    marginalTaxRate: parseFloat((marginalRate * 100).toFixed(1)),
    taxes: {
      federal: parseFloat(federalTax.toFixed(2)),
      state: parseFloat(stateTax.toFixed(2)),
      socialSecurity: parseFloat(socialSecurityTax.toFixed(2)),
      medicare: parseFloat(medicareTax.toFixed(2)),
      total: parseFloat(totalTax.toFixed(2)),
    },
    retirement401kContribution: retirement401kAmount > 0 ? parseFloat(retirement401kAmount.toFixed(2)) : null,
    takeHomeMessage: `You take home $${netMonthly.toFixed(0)}/month ($${netBiweekly.toFixed(0)}/paycheck), keeping ${(100 - effectiveTaxRate).toFixed(1)}% of your gross income.`,
  });
});

router.post("/calculator/retirement", async (req, res): Promise<void> => {
  const parsed = CalculateRetirementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { portfolioValue, monthlyPension, monthlyExpenses, age, withdrawalRate } = parsed.data;

  const annualWithdrawalRate = (withdrawalRate || 4) / 100;
  const safeWithdrawalAmount = (portfolioValue * annualWithdrawalRate) / 12;
  const monthlyPensionAmount = monthlyPension || 0;
  const monthlyIncome = safeWithdrawalAmount + monthlyPensionAmount;
  const monthlySurplusDeficit = monthlyIncome - monthlyExpenses;

  let sustainableYears: number | null = null;
  if (monthlyExpenses > monthlyPensionAmount) {
    const annualPortfolioWithdrawal = (monthlyExpenses - monthlyPensionAmount) * 12;
    const portfolioGrowthRate = 0.05;
    let currentPortfolio = portfolioValue;
    let years = 0;
    while (currentPortfolio > 0 && years < 100) {
      currentPortfolio = currentPortfolio * (1 + portfolioGrowthRate) - annualPortfolioWithdrawal;
      years++;
    }
    sustainableYears = years < 100 ? years : null;
  }

  const lifeExpectancy = 85;
  const yearsInRetirement = lifeExpectancy - age;
  const portfolioHealth =
    sustainableYears === null ? "excellent"
    : sustainableYears > yearsInRetirement + 10 ? "excellent"
    : sustainableYears > yearsInRetirement ? "good"
    : sustainableYears > yearsInRetirement * 0.7 ? "fair"
    : "at-risk";

  const strategies: string[] = [];

  if (monthlySurplusDeficit > 0) {
    strategies.push(`You have a monthly surplus of $${monthlySurplusDeficit.toFixed(0)}. Consider reinvesting or building an emergency fund.`);
  } else {
    strategies.push(`You have a monthly shortfall of $${Math.abs(monthlySurplusDeficit).toFixed(0)}. Consider reducing expenses or increasing withdrawal rate temporarily.`);
  }

  strategies.push(`The 4% Rule suggests withdrawing $${(portfolioValue * 0.04 / 12).toFixed(0)}/month from your portfolio for sustainable income.`);

  if (monthlyPension) {
    strategies.push(`Your pension of $${monthlyPension}/month covers ${((monthlyPension / monthlyExpenses) * 100).toFixed(0)}% of your expenses — a strong foundation.`);
  }

  if (portfolioHealth === "at-risk") {
    strategies.push("Consider delaying Social Security benefits to maximize monthly payments and reduce portfolio withdrawals early.");
    strategies.push("A part-time income of even $500-1000/month significantly extends portfolio longevity.");
  } else if (portfolioHealth === "excellent") {
    strategies.push("Your portfolio is well-positioned. Consider leaving a legacy or increasing discretionary spending guilt-free.");
  }

  strategies.push("Maintain 1-2 years of expenses in cash or short-term bonds to avoid selling equities during market downturns.");

  res.json({
    portfolioValue,
    monthlyIncome: parseFloat(monthlyIncome.toFixed(2)),
    monthlyExpenses,
    monthlySurplusDeficit: parseFloat(monthlySurplusDeficit.toFixed(2)),
    sustainableYears,
    recommendedWithdrawal: parseFloat(safeWithdrawalAmount.toFixed(2)),
    safeWithdrawalAmount: parseFloat(safeWithdrawalAmount.toFixed(2)),
    strategies,
    portfolioHealth,
  });
});

export default router;
