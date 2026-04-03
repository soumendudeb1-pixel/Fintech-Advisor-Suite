import { useState } from "react";
import { useMode } from "@/hooks/use-mode";
import { useCalculatePocketMoney, useCalculateSalary, useCalculateRetirement } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { DollarSign, Wallet, ArrowRight, PiggyBank, Briefcase, GraduationCap, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Calculator() {
  const { mode } = useMode();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Financial Calculator</h1>
        <p className="text-muted-foreground">Tailored planning tools for your current life stage.</p>
      </div>

      {mode === "student" && <StudentCalculator />}
      {mode === "career" && <CareerCalculator />}
      {mode === "retiree" && <RetireeCalculator />}
    </div>
  );
}

function StudentCalculator() {
  const calc = useCalculatePocketMoney();
  const [allowance, setAllowance] = useState("");
  const [expenses, setExpenses] = useState([{ name: "Food", amount: "50", category: "Needs" }]);
  const [goal, setGoal] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    calc.mutate({
      data: {
        monthlyAllowance: Number(allowance) || 0,
        expenses: expenses.map(ex => ({ name: ex.name, amount: Number(ex.amount) || 0, category: ex.category })),
        savingsGoal: Number(goal) || undefined
      }
    });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Pocket Money Planner
          </CardTitle>
          <CardDescription>Track allowance and save for small goals.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Monthly Allowance / Income</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={allowance} onChange={e => setAllowance(e.target.value)} placeholder="0.00" type="number" />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Monthly Expenses</Label>
              {expenses.map((exp, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={exp.name} onChange={e => {
                    const newEx = [...expenses];
                    newEx[i].name = e.target.value;
                    setExpenses(newEx);
                  }} placeholder="Name" />
                  <div className="relative w-32">
                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input className="pl-7" value={exp.amount} onChange={e => {
                      const newEx = [...expenses];
                      newEx[i].amount = e.target.value;
                      setExpenses(newEx);
                    }} placeholder="0" type="number" />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setExpenses(expenses.filter((_, idx) => idx !== i))}>&times;</Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setExpenses([...expenses, { name: "", amount: "", category: "Misc" }])}>+ Add Expense</Button>
            </div>

            <div className="space-y-2">
              <Label>Savings Goal (Optional)</Label>
              <div className="relative">
                <PiggyBank className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. 500 for a new console" type="number" />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={calc.isPending}>Calculate</Button>
          </form>
        </CardContent>
      </Card>

      {calc.data && (
        <Card className="border-border/50 bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-background/50 border border-border/50">
                <div className="text-sm text-muted-foreground mb-1">Total Expenses</div>
                <div className="text-2xl font-bold">${calc.data.totalExpenses.toFixed(2)}</div>
              </div>
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="text-sm text-primary/80 font-medium mb-1">Fun Money</div>
                <div className="text-2xl font-bold text-primary">${calc.data.remainingFunMoney.toFixed(2)}</div>
              </div>
            </div>

            {calc.data.expenseBreakdown && calc.data.expenseBreakdown.length > 0 && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={calc.data.expenseBreakdown} dataKey="total" nameKey="category" cx="50%" cy="50%" innerRadius={40} outerRadius={60}>
                      {calc.data.expenseBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(val: number) => `$${val.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="space-y-2">
              <div className="font-medium">Tips</div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {calc.data.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2"><ArrowRight className="h-4 w-4 text-primary shrink-0" /> {tip}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CareerCalculator() {
  const calc = useCalculateSalary();
  const [salary, setSalary] = useState("85000");
  const [period, setPeriod] = useState<"annual" | "monthly" | "biweekly" | "weekly">("annual");
  const [status, setStatus] = useState<"single" | "married" | "head-of-household">("single");
  const [k401, setK401] = useState("5");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    calc.mutate({
      data: {
        grossSalary: Number(salary) || 0,
        payPeriod: period,
        filingStatus: status,
        state: "NY",
        retirement401k: Number(k401) || 0
      }
    });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Salary & Tax Estimator
          </CardTitle>
          <CardDescription>Calculate take-home pay and tax breakdown.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Gross Pay</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" value={salary} onChange={e => setSalary(e.target.value)} type="number" />
                </div>
                <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annually</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Filing Status</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="married">Married Filing Jointly</SelectItem>
                  <SelectItem value="head-of-household">Head of Household</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>401(k) Contribution (%)</Label>
              <Input value={k401} onChange={e => setK401(e.target.value)} type="number" max="100" />
            </div>

            <Button type="submit" className="w-full" disabled={calc.isPending}>Calculate Take Home</Button>
          </form>
        </CardContent>
      </Card>

      {calc.data && (
        <Card className="border-border/50 bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Paycheck Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center p-6 bg-background/80 rounded-xl border border-border">
              <div className="text-sm font-medium text-muted-foreground mb-2">Estimated Take Home (Monthly)</div>
              <div className="text-5xl font-bold tracking-tight text-primary">${calc.data.netMonthly.toFixed(2)}</div>
              <div className="text-sm mt-2 text-muted-foreground">Effective Tax Rate: {(calc.data.effectiveTaxRate * 100).toFixed(1)}%</div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted-foreground">Gross Monthly Pay</span>
                <span className="font-medium">${calc.data.grossMonthly.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50 text-destructive">
                <span>Federal Tax</span>
                <span>-${calc.data.taxes.federal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50 text-destructive">
                <span>State Tax</span>
                <span>-${calc.data.taxes.state.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50 text-chart-4">
                <span>Social Security & Med</span>
                <span>-${(calc.data.taxes.socialSecurity + calc.data.taxes.medicare).toFixed(2)}</span>
              </div>
              {calc.data.retirement401kContribution ? (
                <div className="flex justify-between items-center py-2 border-b border-border/50 text-chart-1">
                  <span>401(k) Pre-tax</span>
                  <span>-${calc.data.retirement401kContribution.toFixed(2)}</span>
                </div>
              ) : null}
            </div>

            <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              {calc.data.takeHomeMessage}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RetireeCalculator() {
  const calc = useCalculateRetirement();
  const [portfolio, setPortfolio] = useState("1000000");
  const [expenses, setExpenses] = useState("4500");
  const [age, setAge] = useState("65");
  const [rate, setRate] = useState("4");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    calc.mutate({
      data: {
        portfolioValue: Number(portfolio) || 0,
        monthlyExpenses: Number(expenses) || 0,
        age: Number(age) || 65,
        withdrawalRate: Number(rate) || 4
      }
    });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            Withdrawal Strategist
          </CardTitle>
          <CardDescription>Plan a sustainable income from your nest egg.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Total Portfolio Value</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={portfolio} onChange={e => setPortfolio(e.target.value)} type="number" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Expected Monthly Expenses</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={expenses} onChange={e => setExpenses(e.target.value)} type="number" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Current Age</Label>
                <Input value={age} onChange={e => setAge(e.target.value)} type="number" />
              </div>
              <div className="space-y-2">
                <Label>Withdrawal Rate (%)</Label>
                <Input value={rate} onChange={e => setRate(e.target.value)} type="number" step="0.1" />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={calc.isPending}>Analyze Portfolio</Button>
          </form>
        </CardContent>
      </Card>

      {calc.data && (
        <Card className="border-border/50 bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Retirement Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-4">
              <div className={cn(
                "flex-1 p-4 rounded-xl border flex flex-col items-center justify-center text-center",
                calc.data.portfolioHealth === 'excellent' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                calc.data.portfolioHealth === 'good' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                calc.data.portfolioHealth === 'fair' ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500" :
                "bg-destructive/10 border-destructive/20 text-destructive"
              )}>
                <div className="text-xs uppercase tracking-wider font-semibold opacity-80 mb-1">Health Score</div>
                <div className="text-2xl font-bold capitalize">{calc.data.portfolioHealth}</div>
              </div>
              
              <div className="flex-1 p-4 rounded-xl bg-background border border-border/50 flex flex-col items-center justify-center text-center">
                <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">Monthly Income</div>
                <div className="text-2xl font-bold">${calc.data.monthlyIncome.toFixed(0)}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Safe Monthly Withdrawal</span>
                <span className="font-medium">${calc.data.safeWithdrawalAmount.toFixed(0)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Monthly Gap</span>
                <span className={cn("font-medium", calc.data.monthlySurplusDeficit >= 0 ? "text-emerald-500" : "text-destructive")}>
                  {calc.data.monthlySurplusDeficit >= 0 ? "+" : ""}${calc.data.monthlySurplusDeficit.toFixed(0)}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border/50">
              <div className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Strategy Recommendations</div>
              <ul className="space-y-3">
                {calc.data.strategies.map((strategy, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{strategy}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
