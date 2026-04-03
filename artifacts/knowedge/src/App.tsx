import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AppLayout } from "@/components/layout/app-layout";
import { ModeProvider } from "@/hooks/use-mode";
import { CurrencyProvider } from "@/hooks/use-currency";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Stocks from "@/pages/stocks";
import Calculator from "@/pages/calculator";
import Learn from "@/pages/learn";
import Advisor from "@/pages/advisor";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/stocks" component={Stocks} />
        <Route path="/calculator" component={Calculator} />
        <Route path="/learn" component={Learn} />
        <Route path="/advisor" component={Advisor} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="knowedge-theme">
      <CurrencyProvider>
        <ModeProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </QueryClientProvider>
        </ModeProvider>
      </CurrencyProvider>
    </ThemeProvider>
  );
}

export default App;
