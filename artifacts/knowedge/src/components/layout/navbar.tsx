import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  GraduationCap, Briefcase, Home, TrendingUp, DollarSign,
  BookOpen, MessageSquare, Sun, Moon, Menu, X, IndianRupee,
} from "lucide-react";
import { useMode, UserMode } from "@/hooks/use-mode";
import { useCurrency } from "@/hooks/use-currency";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const modes: { id: UserMode; label: string; icon: React.ReactNode }[] = [
  { id: "student", label: "Student", icon: <GraduationCap className="h-4 w-4" /> },
  { id: "career", label: "Career", icon: <Briefcase className="h-4 w-4" /> },
  { id: "retiree", label: "Retiree", icon: <Home className="h-4 w-4" /> },
];

const navItems = [
  { href: "/", label: "Dashboard", icon: <TrendingUp className="h-5 w-5" /> },
  { href: "/stocks", label: "Stocks", icon: <TrendingUp className="h-5 w-5" /> },
  { href: "/calculator", label: "Calculator", icon: <DollarSign className="h-5 w-5" /> },
  { href: "/learn", label: "Learn", icon: <BookOpen className="h-5 w-5" /> },
  { href: "/advisor", label: "AI Advisor", icon: <MessageSquare className="h-5 w-5" /> },
];

export function Navbar() {
  const [location] = useLocation();
  const { mode, setMode } = useMode();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-14 sm:h-16 max-w-screen-2xl items-center px-3 sm:px-4 gap-2">

        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 shrink-0 mr-2 sm:mr-6" onClick={() => setMobileOpen(false)}>
          <div className="bg-primary/20 p-1.5 sm:p-2 rounded-lg">
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          </div>
          <span className="font-bold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
            KnowEdge
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden lg:flex flex-1 items-center space-x-5 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors hover:text-foreground flex items-center gap-1.5 whitespace-nowrap",
                  isActive ? "text-foreground" : "text-foreground/60"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">

          {/* Currency toggle */}
          <button
            onClick={() => setCurrency(currency === "USD" ? "INR" : "USD")}
            className={cn(
              "flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border text-xs sm:text-sm font-semibold transition-all",
              currency === "INR"
                ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                : "bg-primary/10 border-primary/30 text-primary"
            )}
            title="Toggle currency"
            data-testid="button-currency-toggle"
          >
            {currency === "INR" ? (
              <><IndianRupee className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">INR</span></>
            ) : (
              <><DollarSign className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">USD</span></>
            )}
          </button>

          {/* Desktop mode switcher */}
          <div className="hidden lg:flex items-center bg-muted/50 p-0.5 sm:p-1 rounded-xl border border-border/50">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                  mode === m.id
                    ? "bg-background shadow-sm text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
                data-testid={`button-mode-${m.id}`}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-full h-8 w-8 sm:h-9 sm:w-9"
            data-testid="button-theme-toggle"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8 sm:h-9 sm:w-9 rounded-full"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-border/40 bg-background/98 backdrop-blur">
          <div className="container max-w-screen-2xl px-3 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/70 hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}

            {/* Mobile mode switcher */}
            <div className="pt-2 border-t border-border/40">
              <p className="text-xs text-muted-foreground px-3 mb-2 font-medium uppercase tracking-wider">Mode</p>
              <div className="grid grid-cols-3 gap-1.5">
                {modes.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setMode(m.id); setMobileOpen(false); }}
                    className={cn(
                      "flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-all duration-200",
                      mode === m.id
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                    )}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
