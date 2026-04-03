import { Router, type IRouter } from "express";
import { GetFinancialAdviceBody } from "@workspace/api-zod";

const router: IRouter = Router();

const STUDENT_ADVICE: Record<string, { advice: string; tips: string[]; relatedTopics: string[] }> = {
  default: {
    advice: "As a student, building smart financial habits early is one of the best investments you can make. Start by tracking every dollar you spend for one month — most people are shocked by how much goes to small, unnoticed purchases. The 50/30/20 rule is a great framework: 50% on needs (food, transport), 30% on wants (entertainment, dining out), and 20% toward savings goals.",
    tips: [
      "Open a high-yield savings account — many offer 4-5% APY and have no minimum balance",
      "Use the 24-hour rule: wait a day before any non-essential purchase over $20",
      "Track your spending with a free app — awareness alone often reduces spending by 15-20%",
      "Automate a small transfer to savings each payday, even if it is just $5",
      "Take advantage of student discounts — many brands offer 10-25% off with a valid student ID",
    ],
    relatedTopics: ["Budgeting Basics", "High-Yield Savings", "Student Discounts", "Emergency Fund"],
  },
  budget: {
    advice: "Budgeting as a student does not have to be complicated. The key is knowing your income (allowance, part-time work, grants) and mapping it against your non-negotiable expenses first. What is left is your discretionary money — and that is where you have control. Start with a simple spreadsheet or our Pocket Money Calculator to see exactly where you stand.",
    tips: [
      "List all income sources: allowance, part-time job, any grants or scholarships",
      "Categorize expenses into Fixed (rent, subscriptions) and Variable (food, entertainment)",
      "Find the 2-3 variable categories where you can cut spending immediately",
      "Set a weekly cash limit for discretionary spending — withdrawing cash makes spending feel more real",
      "Review your budget at the end of each week, not just the end of the month",
    ],
    relatedTopics: ["Pocket Money Calculator", "Expense Tracking", "Saving Goals", "Side Income"],
  },
  saving: {
    advice: "Saving as a student feels hard because amounts are small — but the habit is what matters. Compound interest is your biggest ally: money saved at 18 is worth dramatically more than money saved at 28. Even $25 a month invested at 7% annual return becomes over $65,000 by retirement. Your most valuable asset right now is time.",
    tips: [
      "Start with a specific, concrete goal — 'save for a new laptop by December' beats 'save more money'",
      "Automate your savings on payday — pay yourself first before discretionary spending",
      "Use a savings challenge: try the 52-week challenge where you save $1 in week 1, $2 in week 2, etc.",
      "Look for savings opportunities: library books vs buying, streaming sharing vs individual subscriptions",
      "Celebrate milestones — when you hit a savings goal, acknowledge it and set the next one",
    ],
    relatedTopics: ["Compound Interest", "Savings Goals", "Investment Basics", "Emergency Fund"],
  },
};

const CAREER_ADVICE: Record<string, { advice: string; tips: string[]; relatedTopics: string[] }> = {
  default: {
    advice: "Starting a new career is a pivotal financial moment. Your first move should be understanding your true take-home pay, not your gross salary. After taxes, benefits deductions, and retirement contributions, many people take home 65-75% of their stated salary. Use our Salary Calculator to get an accurate picture. Then build your budget around net income, not gross.",
    tips: [
      "Contribute at least enough to your 401(k) to get the full employer match — that is an instant 50-100% return",
      "Build a 3-6 month emergency fund before aggressively paying down student loans",
      "Negotiate your starting salary — even a $3,000 increase compounds significantly over a career",
      "Review your benefits package carefully: health insurance, FSA, HSA, and life insurance can be worth thousands",
      "Set up automatic contributions to retirement — you will not miss what you never see",
    ],
    relatedTopics: ["Salary Calculator", "401(k) Basics", "Tax Optimization", "Career Growth"],
  },
  tax: {
    advice: "Understanding taxes on your new salary is crucial. Many first-job earners are surprised by the effective tax rate versus the marginal rate. Your effective rate is what you actually pay on total income, while your marginal rate is what you pay on the last dollar earned. Strategic deductions — like 401(k) contributions, HSA contributions, and student loan interest — can meaningfully reduce your taxable income.",
    tips: [
      "Maximize pre-tax retirement contributions to reduce your taxable income dollar-for-dollar",
      "If your employer offers an HSA-eligible health plan, HSA contributions triple-tax-advantaged",
      "Track deductible expenses if you work from home or have significant unreimbursed job expenses",
      "Adjust your W-4 withholding if you consistently get a large refund or owe money at filing",
      "Consider consulting a CPA in your first year of full-time employment to optimize your situation",
    ],
    relatedTopics: ["Salary Calculator", "Tax Brackets", "Pre-Tax Accounts", "W-4 Withholding"],
  },
};

const RETIREE_ADVICE: Record<string, { advice: string; tips: string[]; relatedTopics: string[] }> = {
  default: {
    advice: "Managing income in retirement is fundamentally different from accumulation — the psychology shifts from saving to spending, which can be emotionally difficult. The foundational principle is sequencing: drawing from different accounts in the right order minimizes taxes and extends portfolio longevity. Generally: spend taxable accounts first, then tax-deferred (Traditional IRA/401k), and let Roth accounts grow last.",
    tips: [
      "Delay Social Security as long as possible — each year past 62 increases your benefit by 6-8%",
      "Maintain 1-2 years of expenses in cash or short-term bonds to avoid selling in down markets",
      "Consider a bucket strategy: short-term (1-3 years), medium-term (3-10 years), long-term (10+ years)",
      "Rebalance your portfolio annually — retirement is a 20-30 year phase, not a single event",
      "Plan for healthcare costs — they often increase 5-7% annually versus general inflation of 3%",
    ],
    relatedTopics: ["Retirement Calculator", "Social Security", "Required Minimum Distributions", "Healthcare Planning"],
  },
  withdrawal: {
    advice: "The 4% rule — withdrawing 4% of your portfolio in year one, then adjusting for inflation — has historically supported 30-year retirements in most market conditions. However, it is not a guarantee. In years when markets decline significantly (10%+), consider reducing withdrawals by 10-15% to extend portfolio longevity. Conversely, in strong bull markets, you may be able to spend more.",
    tips: [
      "Model multiple withdrawal scenarios using our Retirement Calculator before committing to a strategy",
      "Consider a variable withdrawal strategy: spend less in down years, more in up years",
      "Required Minimum Distributions (RMDs) start at age 73 — plan for the tax impact in advance",
      "Roth conversions in your 60s can reduce future RMD obligations and pass more wealth tax-free",
      "A fee-only financial advisor is worth the cost when managing a seven-figure retirement portfolio",
    ],
    relatedTopics: ["Retirement Calculator", "4% Rule", "RMDs", "Roth Conversion Strategy"],
  },
};

function getAdvice(mode: string, question: string): { advice: string; tips: string[]; relatedTopics: string[] } {
  const q = question.toLowerCase();

  if (mode === "student") {
    if (q.includes("budget") || q.includes("spend") || q.includes("expense")) {
      return STUDENT_ADVICE.budget;
    }
    if (q.includes("save") || q.includes("saving") || q.includes("goal")) {
      return STUDENT_ADVICE.saving;
    }
    return STUDENT_ADVICE.default;
  }

  if (mode === "career") {
    if (q.includes("tax") || q.includes("withhold") || q.includes("deduct")) {
      return CAREER_ADVICE.tax;
    }
    return CAREER_ADVICE.default;
  }

  if (mode === "retiree") {
    if (q.includes("withdraw") || q.includes("4%") || q.includes("rmd") || q.includes("distribution")) {
      return RETIREE_ADVICE.withdrawal;
    }
    return RETIREE_ADVICE.default;
  }

  return STUDENT_ADVICE.default;
}

router.post("/ai/financial-advice", async (req, res): Promise<void> => {
  const parsed = GetFinancialAdviceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userMode, question } = parsed.data;
  const adviceData = getAdvice(userMode, question);

  res.json(adviceData);
});

export default router;
