import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, TrendingUp, PieChart, ShieldAlert } from "lucide-react";

export default function Learn() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Market 101</h1>
        <p className="text-muted-foreground">Master the fundamentals of investing without the jargon.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              What is a Stock?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              When you buy a stock, you are buying a tiny slice of ownership in a real company. You become a "shareholder."
            </p>
            <div className="p-4 bg-muted rounded-lg text-foreground">
              <strong className="block mb-2 text-primary">Why do prices move?</strong>
              Stock prices change every second based on supply and demand. If more people want to buy a stock than sell it, the price goes up. If more people want to sell, it goes down. This demand is driven by expectations of the company's future profits.
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Indexes & ETFs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              Picking individual winning stocks is incredibly hard, even for professionals. This is where Indexes and ETFs come in.
            </p>
            <div className="p-4 bg-muted rounded-lg text-foreground">
              <strong className="block mb-2 text-primary">The S&P 500</strong>
              An index like the S&P 500 tracks the 500 largest US companies. By buying an S&P 500 ETF (Exchange Traded Fund), you instantly own a tiny piece of all 500 companies. It's the ultimate diversification tool.
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-2xl font-bold tracking-tight mt-12 mb-6 border-b border-border/50 pb-4">Glossary of Terms</h2>
      
      <div className="grid gap-4 md:grid-cols-3">
        <GlossaryCard 
          term="Market Cap" 
          definition="The total value of a company. Calculated by multiplying the current stock price by the total number of shares." 
        />
        <GlossaryCard 
          term="P/E Ratio" 
          definition="Price-to-Earnings ratio. How much you pay for $1 of the company's profit. A high P/E means investors expect high future growth." 
        />
        <GlossaryCard 
          term="Dividend" 
          definition="A portion of a company's profit paid out directly to shareholders, usually every quarter. Free cash flow for owning the stock." 
        />
        <GlossaryCard 
          term="Bull Market" 
          definition="A market condition where prices are rising or expected to rise. Optimism is high." 
        />
        <GlossaryCard 
          term="Bear Market" 
          definition="A market condition where prices are falling by 20% or more from recent highs. Pessimism is high." 
        />
        <GlossaryCard 
          term="Volatility" 
          definition="How wildly a stock's price swings up and down. High volatility means higher risk, but potentially higher reward." 
        />
      </div>

      <div className="mt-12 p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive-foreground">
        <div className="flex items-center gap-2 mb-2 font-bold">
          <ShieldAlert className="h-5 w-5" />
          The Golden Rule of Investing
        </div>
        <p className="text-sm opacity-90 leading-relaxed">
          Never invest money you will need in the next 3-5 years into the stock market. The market always goes up over long periods of time (decades), but it can crash significantly in the short term. Time in the market beats timing the market.
        </p>
      </div>
    </div>
  );
}

function GlossaryCard({ term, definition }: { term: string, definition: string }) {
  return (
    <Card className="bg-card/30 border-border/40 hover:bg-card/60 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-primary">{term}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">{definition}</p>
      </CardContent>
    </Card>
  );
}
