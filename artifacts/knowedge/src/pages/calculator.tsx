import { useState, useCallback } from "react";
import { useMode } from "@/hooks/use-mode";
import { calcApi, inr, pct } from "@/lib/api";
import type {
  PocketMoneyResult,
  SalariedResult,
  RetiredResult,
  SipResult,
} from "@/lib/api";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Briefcase,
  GraduationCap,
  Home,
  IndianRupee,
  Loader2,
  PiggyBank,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ─── Shared sub-components ────────────────────────────────────────────────

function CalcError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

function CalcSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">Calculating and generating AI advice…</p>
    </div>
  );
}

/** Renders the 4-section AI advice block (📊 / ⚠️ / ✅ / 🎯) */
function AiAdvicePanel({ text }: { text: string }) {
  const SECTION_EMOJIS = ["📊", "⚠️", "✅", "🎯"];
  const SECTION_COLORS: Record<string, string> = {
    "📊": "border-blue-500/30 bg-blue-500/5",
    "⚠️": "border-yellow-500/30 bg-yellow-500/5",
    "✅": "border-emerald-500/30 bg-emerald-500/5",
    "🎯": "border-primary/30 bg-primary/5",
  };

  // Split on lines that START with one of the emoji headers
  const lines = text.split("\n");
  const sections: Array<{ emoji: string; title: string; body: string[] }> = [];
  let current: { emoji: string; title: string; body: string[] } | null = null;

  for (const line of lines) {
    const matchedEmoji = SECTION_EMOJIS.find((e) => line.startsWith(e));
    if (matchedEmoji) {
      if (current) sections.push(current);
      current = { emoji: matchedEmoji, title: line.trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) sections.push(current);

  // If parsing failed, just show raw text
  if (sections.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-border/50 bg-muted/30 text-sm whitespace-pre-wrap leading-relaxed">
        {text}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        <Bot className="h-4 w-4 text-primary" />
        AI Analysis
      </div>
      <div className="space-y-2">
        {sections.map((s) => (
          <div
            key={s.emoji}
            className={cn("rounded-lg border p-3", SECTION_COLORS[s.emoji] ?? "border-border/50 bg-muted/20")}
          >
            <div className="font-semibold text-sm mb-1">{s.title}</div>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {s.body.join("\n").trim()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  highlight,
  negative,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold",
          highlight && "text-primary",
          negative && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Generic axios error extractor ────────────────────────────────────────
function extractError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; details?: Array<{ message: string }> } | undefined;
    if (data?.details && data.details.length > 0) return data.details.map((d) => d.message).join("; ");
    if (data?.error) return data.error;
    if (err.message) return err.message;
  }
  return "Something went wrong. Please try again.";
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. STUDENT — Pocket Money Calculator
// ─────────────────────────────────────────────────────────────────────────────

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const EXPENSE_CATEGORIES = ["Food", "Transport", "Entertainment", "Shopping", "Education", "Misc"];

function StudentCalculator() {
  const [allowance, setAllowance] = useState("5000");
  const [expenses, setExpenses] = useState([
    { category: "Food", amount: "1500" },
    { category: "Transport", amount: "600" },
    { category: "Entertainment", amount: "500" },
  ]);
  const [savingsGoalName, setSavingsGoalName] = useState("");
  const [savingsGoal, setSavingsGoal] = useState("");
  const [savingsRate, setSavingsRate] = useState("20");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PocketMoneyResult | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await calcApi.pocketMoney({
        monthlyAllowance: Number(allowance) || 0,
        expenses: expenses
          .filter((ex) => ex.amount && Number(ex.amount) > 0)
          .map((ex) => ({ category: ex.category || "Misc", amount: Number(ex.amount) })),
        savingsGoal: savingsGoal ? Number(savingsGoal) : undefined,
        savingsGoalName: savingsGoalName || undefined,
        savingsRate: Number(savingsRate) || 20,
      });
      setResult(data.calculation_result);
      setAiAdvice(data.ai_advice);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [allowance, expenses, savingsGoal, savingsGoalName, savingsRate]);

  const healthColor =
    (result?.budgetScore ?? 0) >= 80 ? "text-emerald-500" :
    (result?.budgetScore ?? 0) >= 60 ? "text-yellow-500" : "text-destructive";

  return (
    <div className="grid md:grid-cols-2 gap-6 items-start">
      {/* Form */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Pocket Money Planner
          </CardTitle>
          <CardDescription>Track allowance and build your first savings habit.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Monthly Allowance / Income</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9" type="number" min="0"
                  value={allowance} onChange={(e) => setAllowance(e.target.value)}
                  placeholder="e.g. 5000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Monthly Expenses</Label>
              <div className="space-y-2">
                {expenses.map((exp, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Select value={exp.category} onValueChange={(v) => {
                      const next = [...expenses]; next[i].category = v; setExpenses(next);
                    }}>
                      <SelectTrigger className="flex-1 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative w-28">
                      <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input className="pl-6 h-9" type="number" min="0"
                        value={exp.amount} placeholder="0"
                        onChange={(e) => {
                          const next = [...expenses]; next[i].amount = e.target.value; setExpenses(next);
                        }}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setExpenses(expenses.filter((_, idx) => idx !== i))}>
                      ×
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="w-full"
                  onClick={() => setExpenses([...expenses, { category: "Misc", amount: "" }])}>
                  + Add Expense
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Savings Rate (%)</Label>
                <Input type="number" min="0" max="100" value={savingsRate}
                  onChange={(e) => setSavingsRate(e.target.value)} placeholder="20" />
              </div>
              <div className="space-y-2">
                <Label>Savings Goal (₹)</Label>
                <div className="relative">
                  <PiggyBank className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" type="number" min="0" value={savingsGoal}
                    onChange={(e) => setSavingsGoal(e.target.value)} placeholder="Optional" />
                </div>
              </div>
            </div>

            {savingsGoal && (
              <div className="space-y-2">
                <Label>Goal Name (Optional)</Label>
                <Input value={savingsGoalName} onChange={(e) => setSavingsGoalName(e.target.value)}
                  placeholder="e.g. New phone, Trip to Goa" />
              </div>
            )}

            {error && <CalcError message={error} />}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calculating…</> : "Calculate Budget"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="border-border/50"><CardContent><CalcSkeleton /></CardContent></Card>
          </motion.div>
        )}
        {!loading && result && (
          <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Budget Results
                  <span className={cn("text-2xl font-bold", healthColor)}>
                    {result.budgetScore}/100
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Key stats */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Allowance", val: inr(result.monthlyAllowance) },
                    { label: "Total Expenses", val: inr(result.totalExpenses), neg: true },
                    { label: "Savings", val: inr(result.savingsAmount), hi: true },
                    { label: "Spending Money", val: inr(result.spendingMoney) },
                  ].map(({ label, val, hi, neg }) => (
                    <div key={label} className={cn(
                      "p-3 rounded-lg border text-center",
                      hi ? "bg-primary/10 border-primary/20" : neg ? "bg-destructive/5 border-destructive/20" : "bg-background/50 border-border/50"
                    )}>
                      <div className="text-xs text-muted-foreground mb-1">{label}</div>
                      <div className={cn("font-bold text-lg", hi && "text-primary", neg && "text-destructive")}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Savings goal */}
                {result.savingsGoal && (
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-sm">
                    <span className="font-medium">{result.savingsGoalName ?? "Goal"}:</span>{" "}
                    {inr(result.savingsGoal)} —{" "}
                    {result.monthsToGoal
                      ? <span className="text-primary font-medium">{result.monthsToGoal} months away</span>
                      : <span className="text-muted-foreground">Goal amount not reachable at current rate</span>}
                  </div>
                )}

                {/* Pie chart */}
                {result.expenseBreakdown.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">Expense Breakdown</div>
                    <div className="h-36">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={result.expenseBreakdown} dataKey="amount" nameKey="category"
                            cx="50%" cy="50%" innerRadius={30} outerRadius={55}>
                            {result.expenseBreakdown.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(v: number, name: string) => [inr(v), name]}
                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Alerts */}
                {result.alerts.length > 0 && (
                  <div className="space-y-1">
                    {result.alerts.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-yellow-600 dark:text-yellow-400">
                        <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" /> {a}
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Advice */}
                {aiAdvice && <AiAdvicePanel text={aiAdvice} />}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CAREER — Indian Salary & Tax Calculator
// ─────────────────────────────────────────────────────────────────────────────

function CareerCalculator() {
  const [salary, setSalary] = useState("1200000");
  const [regime, setRegime] = useState<"new" | "old">("new");
  const [age, setAge] = useState("30");
  const [epf, setEpf] = useState("12");
  const [section80c, setSection80c] = useState("150000");
  const [nps, setNps] = useState("50000");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SalariedResult | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await calcApi.salaried({
        grossAnnualSalary: Number(salary) || 0,
        regime,
        age: Number(age) || 30,
        epfPercent: Number(epf) || 12,
        section80c: Number(section80c) || 0,
        npsContribution: Number(nps) || 0,
      });
      setResult(data.calculation_result);
      setAiAdvice(data.ai_advice);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [salary, regime, age, epf, section80c, nps]);

  const healthBadge =
    (result?.effectiveTaxRate ?? 0) < 10 ? { label: "Low Tax", cls: "bg-emerald-500/20 text-emerald-600" } :
    (result?.effectiveTaxRate ?? 0) < 20 ? { label: "Moderate", cls: "bg-yellow-500/20 text-yellow-600" } :
    { label: "High Tax", cls: "bg-destructive/20 text-destructive" };

  return (
    <div className="grid md:grid-cols-2 gap-6 items-start">
      {/* Form */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Salary & Tax Calculator
          </CardTitle>
          <CardDescription>Indian income tax for FY 2024-25 with new &amp; old regime comparison.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Gross Annual CTC (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" type="number" min="0"
                  value={salary} onChange={(e) => setSalary(e.target.value)}
                  placeholder="e.g. 1200000" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tax Regime</Label>
              <Select value={regime} onValueChange={(v: "new" | "old") => setRegime(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New Regime (default, simpler slabs)</SelectItem>
                  <SelectItem value="old">Old Regime (allows deductions)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Age</Label>
                <Input type="number" min="18" max="100" value={age}
                  onChange={(e) => setAge(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>EPF Contribution (%)</Label>
                <Input type="number" min="0" max="100" value={epf}
                  onChange={(e) => setEpf(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Section 80C (₹)</Label>
                <Input type="number" min="0" max="150000" value={section80c}
                  onChange={(e) => setSection80c(e.target.value)} placeholder="0–1,50,000" />
              </div>
              <div className="space-y-2">
                <Label>NPS 80CCD(1B) (₹)</Label>
                <Input type="number" min="0" max="50000" value={nps}
                  onChange={(e) => setNps(e.target.value)} placeholder="0–50,000" />
              </div>
            </div>

            {error && <CalcError message={error} />}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calculating…</> : "Calculate Tax & Take-Home"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="border-border/50"><CardContent><CalcSkeleton /></CardContent></Card>
          </motion.div>
        )}
        {!loading && result && (
          <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Tax Breakdown
                  <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", healthBadge.cls)}>
                    {healthBadge.label}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Take-home hero */}
                <div className="p-5 rounded-xl bg-background/80 border border-border text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Monthly Take-Home</div>
                  <div className="text-4xl font-bold text-primary">{inr(result.netMonthlyTakeHome)}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {inr(result.netAnnualTakeHome)} / year
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-0">
                  <StatRow label="Gross Annual CTC" value={inr(result.grossAnnualSalary)} />
                  <StatRow label="Standard Deduction" value={`− ${inr(result.standardDeduction)}`} />
                  <StatRow label="EPF (Employee)" value={`− ${inr(result.epfContributionAnnual)}/yr`} />
                  <StatRow label="Total Deductions" value={`− ${inr(result.totalDeductions)}`} />
                  <StatRow label="Taxable Income" value={inr(result.taxableIncome)} />
                  <StatRow label="Income Tax + Cess" value={inr(result.totalTaxPayable)} negative />
                  <StatRow label="Effective Tax Rate" value={pct(result.effectiveTaxRate)} />
                  <StatRow label="Marginal Tax Rate" value={pct(result.marginalTaxRate)} />
                </div>

                {/* Tax slab breakdown */}
                {result.taxBracketDetail.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Tax Slabs ({result.regime === "new" ? "New" : "Old"} Regime)
                    </div>
                    <div className="space-y-1">
                      {result.taxBracketDetail.map((b, i) => (
                        <div key={i} className="flex justify-between text-xs py-1 px-2 rounded bg-muted/30">
                          <span className="text-muted-foreground">{b.slab} @ {b.rate}</span>
                          <span className="font-medium">{inr(b.tax)}</span>
                        </div>
                      ))}
                      {result.regime87ARebate > 0 && (
                        <div className="flex justify-between text-xs py-1 px-2 rounded bg-emerald-500/10 text-emerald-600">
                          <span>Section 87A Rebate</span>
                          <span>− {inr(result.regime87ARebate)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* AI Advice */}
                {aiAdvice && <AiAdvicePanel text={aiAdvice} />}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. RETIREE — Withdrawal Strategy Calculator
// ─────────────────────────────────────────────────────────────────────────────

const HEALTH_CONFIG: Record<string, { label: string; cls: string }> = {
  excellent: { label: "Excellent", cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" },
  good:      { label: "Good",      cls: "bg-blue-500/10 border-blue-500/30 text-blue-500" },
  fair:      { label: "Fair",      cls: "bg-yellow-500/10 border-yellow-500/30 text-yellow-500" },
  poor:      { label: "Poor",      cls: "bg-destructive/10 border-destructive/30 text-destructive" },
};

function RetireeCalculator() {
  const [portfolio, setPortfolio] = useState("5000000");
  const [pension, setPension] = useState("15000");
  const [expenses, setExpenses] = useState("40000");
  const [age, setAge] = useState("62");
  const [rate, setRate] = useState("4");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RetiredResult | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await calcApi.retired({
        portfolioValue: Number(portfolio) || 0,
        monthlyPension: Number(pension) || 0,
        monthlyExpenses: Number(expenses) || 0,
        age: Number(age) || 62,
        withdrawalRate: Number(rate) || 4,
      });
      setResult(data.calculation_result);
      setAiAdvice(data.ai_advice);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [portfolio, pension, expenses, age, rate]);

  const health = result ? HEALTH_CONFIG[result.portfolioHealth] ?? HEALTH_CONFIG.fair : null;
  const isSurplus = (result?.monthlySurplusDeficit ?? 0) >= 0;

  return (
    <div className="grid md:grid-cols-2 gap-6 items-start">
      {/* Form */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            Retirement Withdrawal Planner
          </CardTitle>
          <CardDescription>Model corpus longevity with Indian instruments like SCSS &amp; bucket strategy.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Total Portfolio / Corpus (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" type="number" min="0"
                  value={portfolio} onChange={(e) => setPortfolio(e.target.value)}
                  placeholder="e.g. 50,00,000" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Monthly Pension (₹)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" type="number" min="0" value={pension}
                    onChange={(e) => setPension(e.target.value)} placeholder="0 if none" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Monthly Expenses (₹)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" type="number" min="0" value={expenses}
                    onChange={(e) => setExpenses(e.target.value)} placeholder="e.g. 40,000" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Current Age</Label>
                <Input type="number" min="40" max="100" value={age}
                  onChange={(e) => setAge(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Withdrawal Rate (%)</Label>
                <Input type="number" min="1" max="10" step="0.5" value={rate}
                  onChange={(e) => setRate(e.target.value)} placeholder="4%" />
              </div>
            </div>

            {error && <CalcError message={error} />}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysing…</> : "Analyse Retirement Health"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="border-border/50"><CardContent><CalcSkeleton /></CardContent></Card>
          </motion.div>
        )}
        {!loading && result && health && (
          <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle>Retirement Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Health + income */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={cn("p-4 rounded-xl border text-center", health.cls)}>
                    <div className="text-xs uppercase tracking-wider font-semibold opacity-70 mb-1">Portfolio Health</div>
                    <div className="text-2xl font-bold capitalize">{health.label}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-background border border-border/50 text-center">
                    <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">Total Monthly Income</div>
                    <div className="text-2xl font-bold text-primary">{inr(result.totalMonthlyIncome)}</div>
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-0">
                  <StatRow label="Portfolio Corpus" value={inr(result.portfolioValue)} />
                  <StatRow label={`Monthly Withdrawal (${result.withdrawalRate}% rate)`} value={inr(result.monthlyWithdrawal)} />
                  <StatRow label="Monthly Pension" value={inr(result.monthlyPension)} />
                  <StatRow label="Monthly Expenses" value={inr(result.monthlyExpenses)} />
                  <StatRow
                    label="Monthly Surplus / Deficit"
                    value={`${isSurplus ? "+" : "−"} ${inr(Math.abs(result.monthlySurplusDeficit))}`}
                    highlight={isSurplus} negative={!isSurplus}
                  />
                  <StatRow
                    label="Corpus Lasts"
                    value={result.sustainableYears != null ? `~${result.sustainableYears} years` : "50+ years"}
                  />
                  <StatRow label="Corpus Required (full)" value={inr(result.corpusRequired)} />
                  <StatRow label="Shortfall" value={inr(result.corpusShortfall)} negative={result.corpusShortfall > 0} />
                </div>

                {/* SCSS opportunity */}
                {result.scss.maxInvestment > 0 && (
                  <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-sm">
                    <div className="font-semibold text-emerald-600 mb-1">📮 SCSS Opportunity</div>
                    <div className="text-muted-foreground">
                      Invest <span className="font-medium text-foreground">{inr(result.scss.maxInvestment)}</span> in Senior Citizen Savings Scheme →{" "}
                      <span className="font-medium text-emerald-600">{inr(result.scss.quarterlyIncome)}/quarter</span> guaranteed at 8.2% p.a.
                    </div>
                  </div>
                )}

                {/* AI Advice */}
                {aiAdvice && <AiAdvicePanel text={aiAdvice} />}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SIP Calculator (available for all modes)
// ─────────────────────────────────────────────────────────────────────────────

function SipCalculator() {
  const [amount, setAmount] = useState("10000");
  const [years, setYears] = useState("15");
  const [returnRate, setReturnRate] = useState("12");
  const [stepUp, setStepUp] = useState("0");
  const [inflation, setInflation] = useState("6");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SipResult | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await calcApi.sip({
        monthlyAmount: Number(amount) || 0,
        investmentYears: Number(years) || 15,
        annualReturnRate: Number(returnRate) || 12,
        stepUpPercent: Number(stepUp) || 0,
        inflationRate: Number(inflation) || 6,
      });
      setResult(data.calculation_result);
      setAiAdvice(data.ai_advice);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [amount, years, returnRate, stepUp, inflation]);

  const yr5  = result?.yearWiseBreakdown?.find((y) => y.year === 5);
  const yr10 = result?.yearWiseBreakdown?.find((y) => y.year === 10);
  const yr15 = result?.yearWiseBreakdown?.find((y) => y.year === 15);
  const yr20 = result?.yearWiseBreakdown?.find((y) => y.year === 20);

  return (
    <div className="grid md:grid-cols-2 gap-6 items-start">
      {/* Form */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            SIP Calculator
          </CardTitle>
          <CardDescription>Project your mutual fund SIP with step-up &amp; inflation adjustment.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Monthly SIP Amount (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" type="number" min="100"
                  value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 10,000" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duration (Years)</Label>
                <Input type="number" min="1" max="40" value={years}
                  onChange={(e) => setYears(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Expected Return (%)</Label>
                <Input type="number" min="1" max="30" step="0.5" value={returnRate}
                  onChange={(e) => setReturnRate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Annual Step-Up (%)</Label>
                <Input type="number" min="0" max="50" value={stepUp}
                  onChange={(e) => setStepUp(e.target.value)} placeholder="0 = flat" />
              </div>
              <div className="space-y-2">
                <Label>Inflation Rate (%)</Label>
                <Input type="number" min="0" max="20" step="0.5" value={inflation}
                  onChange={(e) => setInflation(e.target.value)} />
              </div>
            </div>

            {error && <CalcError message={error} />}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Projecting…</> : "Project SIP Returns"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="border-border/50"><CardContent><CalcSkeleton /></CardContent></Card>
          </motion.div>
        )}
        {!loading && result && (
          <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  SIP Projection
                  <Badge variant="secondary" className="text-primary font-bold text-sm">
                    {result.wealthRatio}× wealth
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Hero */}
                <div className="p-5 rounded-xl bg-background/80 border border-border text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Maturity Value</div>
                  <div className="text-4xl font-bold text-primary">{inr(result.maturityValue)}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Real value: {inr(result.realValue)} (after {result.inflationRate}% inflation)
                  </div>
                </div>

                {/* Key stats */}
                <div className="space-y-0">
                  <StatRow label="Total Invested" value={inr(result.totalInvested)} />
                  <StatRow label="Estimated Returns" value={inr(result.estimatedReturns)} highlight />
                  <StatRow label="Inflation Erosion" value={`−${inr(result.maturityValue - result.realValue)}`} negative />
                  <StatRow label="Wealth Ratio" value={`${result.wealthRatio}×`} highlight />
                </div>

                {/* Year checkpoints */}
                {(yr5 || yr10 || yr15 || yr20) && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Corpus at Key Milestones</div>
                    <div className="grid grid-cols-2 gap-2">
                      {[yr5, yr10, yr15, yr20].filter(Boolean).map((y) => y && (
                        <div key={y.year} className="p-2 rounded-lg bg-muted/30 border border-border/50 text-center">
                          <div className="text-xs text-muted-foreground">Year {y.year}</div>
                          <div className="text-sm font-bold">{inr(y.portfolioValue)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Milestones */}
                {result.milestones.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Wealth Milestones</div>
                    {result.milestones.map((m, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <ArrowRight className="h-3 w-3 text-primary" /> {m.label}
                        </span>
                        <span className="font-medium">Year {m.year}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Advice */}
                {aiAdvice && <AiAdvicePanel text={aiAdvice} />}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root page — picks the right calculator based on mode
// ─────────────────────────────────────────────────────────────────────────────

const MODE_LABELS: Record<string, string> = {
  student: "Student",
  career:  "Career",
  retiree: "Retiree",
};

export default function Calculator() {
  const { mode } = useMode();

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Financial Calculator</h1>
        <p className="text-muted-foreground">
          Tailored tools for your <span className="text-primary font-medium capitalize">{MODE_LABELS[mode] ?? mode}</span> stage — with AI-powered analysis and Indian market context.
        </p>
      </div>

      {mode === "student"  && <StudentCalculator />}
      {mode === "career"   && <CareerCalculator />}
      {mode === "retiree"  && <RetireeCalculator />}

      {/* SIP calculator shown for all modes */}
      <div className="pt-2">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1 bg-border/60" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">SIP Projector</span>
          <div className="h-px flex-1 bg-border/60" />
        </div>
        <SipCalculator />
      </div>
    </div>
  );
}
