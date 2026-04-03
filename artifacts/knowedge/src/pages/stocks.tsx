import { useState } from "react";
import { useSearchStocks, useGetStockDetails, useGetStockHistory, useGetStockAnalysis, getGetStockDetailsQueryKey, getGetStockHistoryQueryKey, getGetStockAnalysisQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle, Info, IndianRupee, DollarSign } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useLocation } from "wouter";

const INDIAN_STOCKS = [
  { symbol: "RELIANCE.NS", label: "Reliance" },
  { symbol: "TCS.NS", label: "TCS" },
  { symbol: "INFY.NS", label: "Infosys" },
  { symbol: "ZOMATO.NS", label: "Zomato" },
  { symbol: "HDFCBANK.NS", label: "HDFC Bank" },
  { symbol: "ICICIBANK.NS", label: "ICICI Bank" },
  { symbol: "WIPRO.NS", label: "Wipro" },
  { symbol: "TATAMOTORS.NS", label: "Tata Motors" },
  { symbol: "BAJFINANCE.NS", label: "Bajaj Finance" },
  { symbol: "ADANIPORTS.NS", label: "Adani Ports" },
];

const US_STOCKS = [
  { symbol: "AAPL", label: "Apple" },
  { symbol: "NVDA", label: "NVIDIA" },
  { symbol: "MSFT", label: "Microsoft" },
  { symbol: "TSLA", label: "Tesla" },
  { symbol: "AMZN", label: "Amazon" },
  { symbol: "META", label: "Meta" },
];

const PERIODS = ["1W", "1M", "3M", "6M", "1Y"] as const;
type Period = typeof PERIODS[number];

function isIndianSymbol(symbol: string) {
  return symbol.endsWith(".NS") || symbol.endsWith(".BO");
}

export default function Stocks() {
  const [, setLocation] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get("q") || "";

  const [searchQuery, setSearchQuery] = useState("");
  const [activeSymbol, setActiveSymbol] = useState(q);
  const [period, setPeriod] = useState<Period>("1M");
  const [marketTab, setMarketTab] = useState<"IN" | "US">("IN");

  const { currency, format } = useCurrency();

  const { data: searchResults } = useSearchStocks({ q: searchQuery }, { query: { enabled: searchQuery.length > 1 } });

  const { data: stock, isLoading: isLoadingStock } = useGetStockDetails(activeSymbol, {
    query: { enabled: !!activeSymbol, queryKey: getGetStockDetailsQueryKey(activeSymbol) },
  });
  const { data: history, isLoading: isLoadingHistory } = useGetStockHistory(activeSymbol, { period }, {
    query: { enabled: !!activeSymbol, queryKey: getGetStockHistoryQueryKey(activeSymbol, { period }) },
  });
  const { data: analysis, isLoading: isLoadingAnalysis } = useGetStockAnalysis(activeSymbol, {
    query: { enabled: !!activeSymbol, queryKey: getGetStockAnalysisQueryKey(activeSymbol) },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery) {
      setActiveSymbol(searchQuery.toUpperCase());
      setLocation(`/stocks?q=${searchQuery.toUpperCase()}`);
    }
  };

  const handleSelectResult = (symbol: string) => {
    setActiveSymbol(symbol);
    setSearchQuery("");
    setLocation(`/stocks?q=${symbol}`);
  };

  const priceFormatter = (price: number) => {
    const from = activeSymbol && isIndianSymbol(activeSymbol) ? "INR" : "USD";
    return format(price, from);
  };

  const stockPricePrefix = activeSymbol && isIndianSymbol(activeSymbol) ? "₹" : "$";
  const isIndian = activeSymbol ? isIndianSymbol(activeSymbol) : false;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header + Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            Stock Market
            <span className="text-xs font-normal bg-orange-500/15 text-orange-400 border border-orange-500/25 px-2 py-1 rounded-full">NSE · BSE · NYSE</span>
          </h1>
          <p className="text-muted-foreground text-sm">Research Indian & global stocks with AI probability analysis</p>
        </div>

        <div className="relative w-full sm:w-80 md:w-96">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search e.g. RELIANCE or TCS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card/50 border-border/50"
            />
          </form>

          {searchQuery.length > 1 && searchResults && searchResults.length > 0 && (
            <Card className="absolute top-full mt-2 w-full z-50 max-h-64 overflow-auto border-border/50 shadow-xl">
              <div className="p-2 flex flex-col gap-1">
                {searchResults.map((res) => (
                  <button
                    key={res.symbol}
                    onClick={() => handleSelectResult(res.symbol)}
                    className="flex justify-between items-center p-2 rounded-md hover:bg-muted text-left gap-2"
                  >
                    <div className="flex items-center gap-2">
                      {isIndianSymbol(res.symbol) && <span className="text-orange-400 text-xs">🇮🇳</span>}
                      <span className="font-bold text-sm">{res.symbol.replace(".NS", "").replace(".BO", "")}</span>
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{res.name}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Quick pick tabs */}
      {!activeSymbol && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMarketTab("IN")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                marketTab === "IN"
                  ? "bg-orange-500/15 border-orange-500/40 text-orange-400"
                  : "border-border/40 text-muted-foreground hover:text-foreground"
              )}
            >
              <IndianRupee className="h-3.5 w-3.5" /> Indian (NSE)
            </button>
            <button
              onClick={() => setMarketTab("US")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                marketTab === "US"
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "border-border/40 text-muted-foreground hover:text-foreground"
              )}
            >
              <DollarSign className="h-3.5 w-3.5" /> US Markets
            </button>
          </div>

          {marketTab === "IN" ? (
            <Card className="border-orange-500/20 bg-orange-500/5 min-h-[300px] sm:min-h-[380px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-orange-400 flex items-center gap-2 text-base sm:text-lg">
                  🇮🇳 NSE / BSE — Indian Stocks
                </CardTitle>
                <CardDescription>Tap a stock to view live data, charts & AI probability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {INDIAN_STOCKS.map((s) => (
                    <button
                      key={s.symbol}
                      onClick={() => handleSelectResult(s.symbol)}
                      className="flex flex-col items-start p-3 rounded-xl border border-orange-500/20 bg-background/50 hover:border-orange-500/50 hover:bg-orange-500/10 transition-all text-left group"
                    >
                      <span className="font-bold text-sm group-hover:text-orange-400 transition-colors">{s.label}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">{s.symbol.replace(".NS", "")} · NSE</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 bg-card/50 min-h-[300px] sm:min-h-[380px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-primary flex items-center gap-2 text-base sm:text-lg">
                  🇺🇸 NYSE / NASDAQ — US Stocks
                </CardTitle>
                <CardDescription>Tap a stock to view live data, charts & AI probability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {US_STOCKS.map((s) => (
                    <button
                      key={s.symbol}
                      onClick={() => handleSelectResult(s.symbol)}
                      className="flex flex-col items-start p-3 rounded-xl border border-border/40 bg-background/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                    >
                      <span className="font-bold text-sm group-hover:text-primary transition-colors">{s.label}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">{s.symbol} · {s.symbol === "JPM" ? "NYSE" : "NASDAQ"}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeSymbol && (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Left: price card + chart */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">

            {/* Stock price card */}
            <Card className={cn(
              "border-border/50 bg-card/50 backdrop-blur overflow-hidden relative",
              isIndian && "border-orange-500/20"
            )}>
              {isLoadingStock ? (
                <div className="p-4 sm:p-6 space-y-4">
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-14 w-1/4" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
                  </div>
                </div>
              ) : stock ? (
                <>
                  <div className={cn(
                    "absolute top-0 left-0 right-0 h-1",
                    isIndian ? "bg-orange-500" : stock.changePercent >= 0 ? "bg-emerald-500" : "bg-destructive"
                  )} />
                  <CardHeader className="pb-2 px-4 sm:px-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-xl sm:text-2xl lg:text-3xl">
                            {activeSymbol.replace(".NS", "").replace(".BO", "")}
                          </CardTitle>
                          {isIndian && <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/20">🇮🇳 NSE</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{stock.name}</p>
                      </div>
                      <button
                        onClick={() => { setActiveSymbol(""); setLocation("/stocks"); }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline self-start sm:self-auto shrink-0"
                      >
                        ← Back
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6">
                    <div className="flex flex-wrap items-end gap-3 mb-4">
                      <span className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                        {priceFormatter(stock.price)}
                      </span>
                      {currency !== (isIndian ? "INR" : "USD") && (
                        <span className="text-sm text-muted-foreground">
                          ≈ {format(stock.price, isIndian ? "INR" : "USD")}
                        </span>
                      )}
                      <div className={cn(
                        "flex items-center gap-1 text-base sm:text-lg font-medium mb-0.5",
                        stock.changePercent >= 0 ? "text-emerald-500" : "text-destructive"
                      )}>
                        {stock.changePercent >= 0 ? <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" /> : <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />}
                        {Math.abs(stock.changePercent).toFixed(2)}%
                        <span className="text-xs text-muted-foreground ml-1">Today</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 py-3 border-t border-border/50">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Market Cap</div>
                        <div className="font-medium text-sm">
                          {stock.marketCap ? format(stock.marketCap, isIndian ? "INR" : "USD") : "N/A"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Volume</div>
                        <div className="font-medium text-sm">{(stock.volume / 1e6).toFixed(2)}M</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">P/E Ratio</div>
                        <div className="font-medium text-sm">{stock.pe ? stock.pe.toFixed(2) : "N/A"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">52W Range</div>
                        <div className="font-medium text-sm text-xs">
                          {stockPricePrefix}{stock.low52w.toFixed(0)} – {stockPricePrefix}{stock.high52w.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </>
              ) : (
                <div className="p-6 text-center text-destructive">Stock not found. Try RELIANCE.NS or AAPL.</div>
              )}
            </Card>

            {/* Price History Chart */}
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2 px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="text-base sm:text-lg">Price History</CardTitle>
                  <div className="flex gap-1">
                    {PERIODS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium transition-all",
                          period === p
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-2 sm:px-4">
                {isLoadingHistory ? (
                  <Skeleton className="h-[220px] sm:h-[280px] w-full" />
                ) : history && history.data.length > 0 ? (
                  <div className="h-[220px] sm:h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history.data} margin={{ top: 10, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isIndian ? "#f97316" : "hsl(var(--primary))"} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={isIndian ? "#f97316" : "hsl(var(--primary))"} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          domain={["auto", "auto"]}
                          tickFormatter={(val) => `${stockPricePrefix}${val.toFixed(0)}`}
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                          width={60}
                        />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
                          labelFormatter={(val) => new Date(val).toLocaleDateString()}
                          formatter={(value: number) => [priceFormatter(value), "Price"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="close"
                          stroke={isIndian ? "#f97316" : "hsl(var(--primary))"}
                          fillOpacity={1}
                          fill="url(#colorPrice)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[220px] sm:h-[280px] flex items-center justify-center text-muted-foreground">No historical data available</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: AI Analysis */}
          <div>
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="px-4 sm:px-6 pb-2">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  AI Probability Engine
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {isIndian ? "Based on NSE/BSE patterns (last 30 days)" : "Based on market trend analysis"}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {isLoadingAnalysis ? (
                  <div className="space-y-4">
                    <Skeleton className="h-44 w-full rounded-xl" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : analysis ? (
                  <div className="space-y-5">

                    {/* Probability bars — Indian market focused display */}
                    <div className="space-y-3 p-3 rounded-xl border border-border/40 bg-background/50">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weekly Trend Probability</p>
                      {isIndian && (
                        <p className="text-xs text-orange-400/80">
                          Based on recent NSE patterns, there is a <span className="font-bold text-orange-400">{analysis.probabilityIncrease}%</span> chance of an upward trend this week.
                        </p>
                      )}

                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="flex items-center gap-1 text-emerald-400"><TrendingUp className="h-3 w-3" />Upward</span>
                            <span className="font-bold text-emerald-400">{analysis.probabilityIncrease}%</span>
                          </div>
                          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${analysis.probabilityIncrease}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="flex items-center gap-1 text-blue-400"><Activity className="h-3 w-3" />Sideways</span>
                            <span className="font-bold text-blue-400">{analysis.probabilityNeutral}%</span>
                          </div>
                          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${analysis.probabilityNeutral}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="flex items-center gap-1 text-red-400"><TrendingDown className="h-3 w-3" />Downward</span>
                            <span className="font-bold text-red-400">{analysis.probabilityDecrease}%</span>
                          </div>
                          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-destructive rounded-full transition-all duration-700" style={{ width: `${analysis.probabilityDecrease}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Donut chart */}
                    <div className="flex justify-center">
                      <div className="relative h-36 w-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: "Upward", value: analysis.probabilityIncrease },
                                { name: "Sideways", value: analysis.probabilityNeutral },
                                { name: "Downward", value: analysis.probabilityDecrease },
                              ]}
                              cx="50%" cy="50%"
                              innerRadius={42} outerRadius={60}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              <Cell fill="#10b981" />
                              <Cell fill="#3b82f6" />
                              <Cell fill="hsl(var(--destructive))" />
                            </Pie>
                            <RechartsTooltip
                              formatter={(value: number) => [`${value}%`, "Probability"]}
                              contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: 11 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                          <span className="text-2xl font-bold">{analysis.probabilityIncrease}%</span>
                          <span className="text-xs text-muted-foreground">Bullish</span>
                        </div>
                      </div>
                    </div>

                    {/* Sentiment + summary */}
                    <div className={cn(
                      "p-3 rounded-xl border",
                      analysis.overallSentiment === "bullish" ? "border-emerald-500/30 bg-emerald-500/5" :
                      analysis.overallSentiment === "bearish" ? "border-destructive/30 bg-destructive/5" :
                      "border-blue-500/30 bg-blue-500/5"
                    )}>
                      <div className="flex items-center gap-2 mb-1.5">
                        {analysis.overallSentiment === "bullish" ? <TrendingUp className="h-4 w-4 text-emerald-500" /> :
                         analysis.overallSentiment === "bearish" ? <TrendingDown className="h-4 w-4 text-destructive" /> :
                         <Activity className="h-4 w-4 text-blue-500" />}
                        <span className="font-semibold capitalize text-sm">{analysis.overallSentiment} Sentiment</span>
                        <Badge variant="outline" className="text-xs ml-auto">{analysis.confidence}% confident</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{analysis.summary}</p>
                    </div>

                    {/* Recommendation */}
                    <div className="p-3 rounded-xl border border-border/40 bg-muted/30">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Recommendation</p>
                      <p className="text-sm font-medium">{analysis.recommendation}</p>
                    </div>

                    {/* Key signals */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key Signals</p>
                      {analysis.signals.map((signal, i) => (
                        <div key={i} className="flex gap-2.5 items-start p-2.5 rounded-lg border border-border/40 bg-background/50">
                          <div className="mt-0.5 shrink-0">
                            {signal.impact === "positive" ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> :
                             signal.impact === "negative" ? <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> :
                             <Info className="h-3.5 w-3.5 text-blue-500" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold">{signal.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{signal.description}</div>
                          </div>
                          <span className={cn(
                            "text-xs font-bold shrink-0 ml-auto",
                            signal.impact === "positive" ? "text-emerald-400" :
                            signal.impact === "negative" ? "text-red-400" : "text-blue-400"
                          )}>{signal.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8 text-sm">Analysis unavailable</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
