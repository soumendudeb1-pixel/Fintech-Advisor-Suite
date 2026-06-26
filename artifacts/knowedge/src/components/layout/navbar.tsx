import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  GraduationCap, Briefcase, Home, TrendingUp, DollarSign,
  BookOpen, MessageSquare, Sun, Moon, Menu, X, IndianRupee,
  LayoutDashboard, Bot,
} from "lucide-react";
import { useMode, UserMode } from "@/hooks/use-mode";
import { useCurrency } from "@/hooks/use-currency";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const modes: { id: UserMode; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "student", label: "Student", icon: <GraduationCap className="h-3.5 w-3.5" />, color: "text-violet-400" },
  { id: "career",  label: "Career",  icon: <Briefcase className="h-3.5 w-3.5" />,     color: "text-blue-400" },
  { id: "retiree", label: "Retiree", icon: <Home className="h-3.5 w-3.5" />,          color: "text-amber-400" },
];

const navItems = [
  { href: "/",           label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/stocks",     label: "Stocks",    icon: <TrendingUp className="h-4 w-4" /> },
  { href: "/calculator", label: "Calculator",icon: <DollarSign className="h-4 w-4" /> },
  { href: "/learn",      label: "Learn",     icon: <BookOpen className="h-4 w-4" /> },
  { href: "/advisor",    label: "AI Advisor",icon: <Bot className="h-4 w-4" /> },
];

export function Navbar() {
  const [location] = useLocation();
  const { mode, setMode } = useMode();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  /* Shadow on scroll */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const activeMode = modes.find((m) => m.id === mode)!;

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 border-b transition-all duration-300",
        "bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70",
        scrolled
          ? "border-border/60 shadow-[0_1px_40px_-12px_hsl(var(--primary)/0.2)]"
          : "border-border/30",
      )}
    >
      <div className="container flex h-14 sm:h-16 max-w-screen-2xl items-center px-3 sm:px-4 gap-2">

        {/* ── Logo ── */}
        <Link
          href="/"
          className="flex items-center gap-2.5 shrink-0 mr-2 sm:mr-6 group"
          onClick={() => setMobileOpen(false)}
        >
          {/* Icon: gradient circle with ₹ */}
          <div className={cn(
            "relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl",
            "bg-gradient-to-br from-primary to-blue-600 shadow-md",
            "transition-transform duration-200 group-hover:scale-105",
          )}>
            <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5 text-white" strokeWidth={2.5} />
            {/* Glow */}
            <span className="absolute inset-0 rounded-xl bg-primary/30 blur-md -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Wordmark */}
          <span className={cn(
            "font-extrabold text-lg sm:text-xl tracking-tight",
            "bg-gradient-to-r from-primary via-blue-400 to-primary/80 bg-clip-text text-transparent",
            "transition-all duration-200 group-hover:from-blue-400 group-hover:to-primary",
          )}>
            KnowEdge
          </span>
        </Link>

        {/* ── Desktop nav links ── */}
        <div className="hidden lg:flex flex-1 items-center gap-1 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap",
                  "transition-all duration-200",
                  isActive
                    ? "text-foreground bg-primary/8"
                    : "text-foreground/55 hover:text-foreground hover:bg-muted/50",
                )}
              >
                {item.icon}
                {item.label}
                {/* Active underline dot */}
                {isActive && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>

        {/* ── Right controls ── */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">

          {/* Currency toggle */}
          <button
            onClick={() => setCurrency(currency === "USD" ? "INR" : "USD")}
            className={cn(
              "flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-semibold",
              "transition-all duration-200 hover:scale-105 active:scale-95",
              currency === "INR"
                ? "bg-orange-500/15 border-orange-500/40 text-orange-400 hover:bg-orange-500/25"
                : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20",
            )}
            title="Toggle currency"
            data-testid="button-currency-toggle"
          >
            {currency === "INR" ? (
              <><IndianRupee className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">INR</span></>
            ) : (
              <><DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">USD</span></>
            )}
          </button>

          {/* Desktop mode switcher */}
          <div className="hidden lg:flex items-center bg-muted/50 p-0.5 rounded-xl border border-border/50">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] text-sm font-medium",
                  "transition-all duration-200",
                  mode === m.id
                    ? cn("bg-background shadow-sm", m.color)
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50",
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
            className="rounded-full h-8 w-8 sm:h-9 sm:w-9 hover:bg-muted/60 transition-colors"
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
            className="lg:hidden h-8 w-8 sm:h-9 sm:w-9 rounded-full hover:bg-muted/60"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* ── Mobile dropdown ── */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-border/40 bg-background/98 backdrop-blur-xl">
          <div className="container max-w-screen-2xl px-3 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-foreground/70 hover:text-foreground hover:bg-muted/50 border border-transparent",
                  )}
                >
                  {item.icon}
                  {item.label}
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}

            {/* Mobile mode switcher */}
            <div className="pt-3 mt-1 border-t border-border/40">
              <p className="text-xs text-muted-foreground px-3 mb-2 font-semibold uppercase tracking-wider">
                Your Mode
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {modes.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setMode(m.id); setMobileOpen(false); }}
                    className={cn(
                      "flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-xs font-medium",
                      "transition-all duration-200 border",
                      mode === m.id
                        ? cn("bg-primary/10 border-primary/30", m.color)
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent",
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
