import { useGetMarketSummary } from "@workspace/api-client-react";
import { useMode } from "@/hooks/use-mode";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Activity, Lightbulb, ArrowRight, DollarSign, MessageSquare, IndianRupee, Globe } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const INDIAN_QUICK = [
  { symbol: "RELIANCE.NS", label: "Reliance" },
  { symbol: "TCS.NS", label: "TCS" },
  { symbol: "INFY.NS", label: "Infosys" },
  { symbol: "ZOMATO.NS", label: "Zomato" },
  { symbol: "HDFCBANK.NS", label: "HDFC Bank" },
];

const US_QUICK = [
  { symbol: "AAPL", label: "Apple" },
  { symbol: "NVDA", label: "NVIDIA" },
  { symbol: "TSLA", label: "Tesla" },
];

export default function Dashboard() {
  const { mode } = useMode();
  const { currency, format } = useCurrency();
  const { data: marketSummary, isLoading } = useGetMarketSummary();

  const getTipForMode = () => {
    switch (mode) {
      case "student":
        return currency === "INR"
          ? "Start with ₹500/month in a NIFTY 50 index fund or SIP. Over 20 years, small contributions compound dramatically — that's how wealth is built in India."
          : "Start small. Even $10 a week in an index fund can grow significantly due to compound interest over your lifetime.";
      case "career":
        return currency === "INR"
          ? "Maximize your EPF contribution and invest in ELSS funds for Section 80C benefits. Aim to save 30% of your in-hand salary and diversify across large-cap and mid-cap stocks."
          : "Maximize your employer 401(k) match. It's literally free money. After that, focus on building a 3-6 month emergency fund.";
      case "retiree":
        return currency === "INR"
          ? "Consider Senior Citizen Savings Scheme (SCSS) and RBI Floating Rate Bonds for stable income. A withdrawal rate of 3.5% of your corpus is conservative and sustainable."
          : "Focus on wealth preservation and dividend yield. A safe withdrawal rate of 4% is a good rule of thumb, but adjust based on market conditions.";
    }
  };

  const getGreeting = () => {
    switch (mode) {
      case "student": return "Ready to build your financial future?";
      case "career": return "Let's optimize your wealth creation.";
      case "retiree": return "Managing your legacy and income.";
    }
  };

  const indianIndices = marketSummary?.indices.filter(i => i.name === "NIFTY 50" || i.name === "SENSEX") ?? [];
  const usIndices = marketSummary?.indices.filter(i => i.name !== "NIFTY 50" && i.name !== "SENSEX") ?? [];
  const showIndices = currency === "INR" ? [...indianIndices, ...usIndices] : [...usIndices, ...indianIndices];

  const formatPrice = (price: number, symbol: string) => {
    const isIndian = symbol.endsWith(".NS") || symbol.endsWith(".BO");
    const from = isIndian ? "INR" : "USD";
    return format(price, from);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1 sm:gap-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-base sm:text-lg">{getGreeting()}</p>
      </div>

      {/* Market Indices */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 sm:h-32 rounded-xl" />
          ))
        ) : showIndices.slice(0, 4).map((index, i) => {
          const isIndian = index.name === "NIFTY 50" || index.name === "SENSEX";
          return (
            <motion.div
              key={index.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className={cn(
                "bg-card/50 backdrop-blur border-border/50 relative overflow-hidden",
                isIndian && "border-orange-500/20 bg-orange-500/5"
              )}>
                {isIndian && (
                  <div className="absolute top-2 right-2 text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-medium">
                    🇮🇳 IN
                  </div>
                )}
                <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 pr-8">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    {index.name}
                  </CardTitle>
                  <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold">
                    {isIndian ? index.value.toLocaleString("en-IN") : index.value.toLocaleString()}
                  </div>
                  <div className={cn(
                    "text-xs font-medium mt-1 flex items-center gap-1",
                    index.changePercent >= 0 ? "text-emerald-500" : "text-destructive"
                  )}>
                    {index.changePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {index.changePercent >= 0 ? "+" : ""}{index.changePercent.toFixed(2)}%
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Indian Market Spotlight */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-orange-400" />
          <h2 className="text-lg sm:text-xl font-semibold">Indian Market — NSE Spotlight</h2>
          <span className="text-xs bg-orange-500/15 text-orange-400 border border-orange-500/25 px-2 py-0.5 rounded-full font-medium">Live</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {INDIAN_QUICK.map((s) => (
            <Link key={s.symbol} href={`/stocks?q=${s.symbol}`}>
              <Card className="border-border/40 bg-card/40 hover:border-orange-500/40 hover:bg-orange-500/5 transition-all cursor-pointer group">
                <CardContent className="p-3">
                  <div className="font-bold text-sm group-hover:text-orange-400 transition-colors">{s.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.symbol.replace(".NS", "")} · NSE</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* AI Tip + Quick Actions */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="md:col-span-1 lg:col-span-2 bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              AI Tip of the Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm sm:text-base leading-relaxed">{getTipForMode()}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Tailored for your current mode</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Link href="/calculator" className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="bg-primary/20 p-1.5 sm:p-2 rounded-md group-hover:bg-primary/30 transition-colors shrink-0">
                  <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                </div>
                <span className="font-medium text-sm">Financial Calculator</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0" />
            </Link>
            <Link href="/stocks?q=RELIANCE.NS" className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="bg-orange-500/20 p-1.5 sm:p-2 rounded-md group-hover:bg-orange-500/30 transition-colors shrink-0">
                  <IndianRupee className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-400" />
                </div>
                <span className="font-medium text-sm">Indian Market Analysis</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0" />
            </Link>
            <Link href="/advisor" className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="bg-primary/20 p-1.5 sm:p-2 rounded-md group-hover:bg-primary/30 transition-colors shrink-0">
                  <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                </div>
                <span className="font-medium text-sm">Ask AI Advisor</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Top Gainers / Losers */}
      {!isLoading && marketSummary && (
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-emerald-500 flex items-center gap-2 text-base sm:text-lg">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                Top Gainers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 sm:space-y-3">
                {marketSummary.topGainers.map(stock => {
                  const isIN = stock.symbol.endsWith(".NS") || stock.symbol.endsWith(".BO");
                  return (
                    <Link key={stock.symbol} href={`/stocks?q=${stock.symbol}`} className="flex items-center justify-between group hover:bg-muted/50 p-2 -mx-2 rounded-lg transition-colors">
                      <div className="min-w-0">
                        <div className="font-bold group-hover:text-primary transition-colors flex items-center gap-1.5 text-sm">
                          {isIN && <span className="text-orange-400 text-xs">🇮🇳</span>}
                          {stock.symbol.replace(".NS", "").replace(".BO", "")}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-[150px]">{stock.name}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-medium text-sm">{formatPrice(stock.price, stock.symbol)}</div>
                        <div className="text-xs text-emerald-500">+{stock.changePercent.toFixed(2)}%</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-destructive flex items-center gap-2 text-base sm:text-lg">
                <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
                Top Losers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 sm:space-y-3">
                {marketSummary.topLosers.map(stock => {
                  const isIN = stock.symbol.endsWith(".NS") || stock.symbol.endsWith(".BO");
                  return (
                    <Link key={stock.symbol} href={`/stocks?q=${stock.symbol}`} className="flex items-center justify-between group hover:bg-muted/50 p-2 -mx-2 rounded-lg transition-colors">
                      <div className="min-w-0">
                        <div className="font-bold group-hover:text-primary transition-colors flex items-center gap-1.5 text-sm">
                          {isIN && <span className="text-orange-400 text-xs">🇮🇳</span>}
                          {stock.symbol.replace(".NS", "").replace(".BO", "")}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-[150px]">{stock.name}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-medium text-sm">{formatPrice(stock.price, stock.symbol)}</div>
                        <div className="text-xs text-destructive">{stock.changePercent.toFixed(2)}%</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Global Markets Quick Links */}
      <Card className="border-border/40 bg-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Globe className="h-4 w-4 text-primary" />
            Global Market Quick Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground mr-1 self-center">🇮🇳 NSE:</span>
            {INDIAN_QUICK.map(s => (
              <Link key={s.symbol} href={`/stocks?q=${s.symbol}`}>
                <span className="text-xs bg-orange-500/10 border border-orange-500/25 text-orange-300 px-2 py-1 rounded-md hover:bg-orange-500/20 transition-colors cursor-pointer font-medium">
                  {s.label}
                </span>
              </Link>
            ))}
            <span className="text-xs text-muted-foreground mx-1 self-center">🇺🇸 US:</span>
            {US_QUICK.map(s => (
              <Link key={s.symbol} href={`/stocks?q=${s.symbol}`}>
                <span className="text-xs bg-primary/10 border border-primary/25 text-primary/80 px-2 py-1 rounded-md hover:bg-primary/20 transition-colors cursor-pointer font-medium">
                  {s.label}
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
