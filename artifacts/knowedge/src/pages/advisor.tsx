import { useState, useRef, useEffect } from "react";
import { useMode } from "@/hooks/use-mode";
import { useCurrency } from "@/hooks/use-currency";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, User, Send, Sparkles, ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTED: Record<string, string[]> = {
  student: [
    "How much of my allowance should I save?",
    "What is a SIP and how do I start?",
    "Should I invest in NIFTY 50 index funds?",
  ],
  career: [
    "How do I save tax using Section 80C?",
    "Should I max my NPS before paying EMIs?",
    "What is the best ELSS fund for tax saving?",
  ],
  retiree: [
    "Is a 3.5% withdrawal rate safe in India?",
    "What are Senior Citizen Savings Scheme benefits?",
    "How to protect my portfolio from inflation?",
  ],
};

function getBaseUrl(): string {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api`;
}

export default function Advisor() {
  const { mode } = useMode();
  const { currency } = useCurrency();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: `Hello! I'm KnowEdge AI, your expert financial advisor for Indian & global markets. I'm currently in **${mode}** mode. Ask me anything — stocks, SIP, tax planning, NIFTY analysis, and more.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLive, setIsLive] = useState<boolean | null>(null); // null = unknown

  // Check if LLM is live by peeking at health endpoint
  useEffect(() => {
    fetch(`${getBaseUrl()}/health`)
      .then((r) => r.json())
      .then((d) => setIsLive(d.llmEnabled === true))
      .catch(() => setIsLive(false));
  }, []);

  // Reset greeting when mode changes
  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        text: `Switched to **${mode}** mode. ${
          mode === "student"
            ? "Ask me about saving, SIP, index funds, or budgeting tips."
            : mode === "career"
            ? "Ask me about tax saving, salary planning, EPF, NPS, or equity investments."
            : "Ask me about retirement income, SCSS, withdrawal strategy, or wealth preservation."
        }`,
      },
    ]);
    setSessionId(undefined);
  }, [mode]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage = text.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch(`${getBaseUrl()}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          session_id: sessionId,
          mode,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json() as { response: string; session_id: string };
      setSessionId(data.session_id);
      setMessages((prev) => [...prev, { role: "assistant", text: data.response }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "I encountered an issue reaching the server. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const formatText = (text: string) => {
    // Simple bold markdown rendering
    return text.split("**").map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  };

  return (
    <div className="h-[calc(100dvh-80px)] sm:h-[calc(100dvh-90px)] flex flex-col max-w-3xl mx-auto border border-border/50 rounded-2xl overflow-hidden bg-card/30 backdrop-blur shadow-2xl">

      {/* Header */}
      <div className="bg-muted/50 px-3 sm:px-5 py-3 border-b border-border/50 flex items-center gap-3">
        <div className="bg-primary/20 p-2 rounded-full shrink-0">
          <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-base sm:text-lg">KnowEdge AI</h2>
            <Badge variant="outline" className="text-xs capitalize hidden sm:inline-flex">
              {mode} Mode
            </Badge>
            <Badge
              className={cn(
                "text-xs",
                isLive === true
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : isLive === false
                  ? "bg-muted text-muted-foreground border-border/40"
                  : "bg-muted text-muted-foreground border-border/40"
              )}
            >
              {isLive === true ? (
                <><Zap className="h-3 w-3 mr-1" />Live LLM</>
              ) : (
                <><Sparkles className="h-3 w-3 mr-1" />AI Advisor</>
              )}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground capitalize hidden sm:block">
            Indian & global markets · {currency} mode · session {sessionId ? sessionId.slice(0, 8) : "new"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex gap-2.5 sm:gap-3",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-full flex items-center justify-center mt-0.5",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted border border-border text-foreground"
              )}>
                {msg.role === "user"
                  ? <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  : <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              </div>
              <div className={cn(
                "px-3 sm:px-4 py-2 sm:py-3 rounded-2xl text-sm leading-relaxed max-w-[85%] sm:max-w-[80%]",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-muted/50 border border-border/50 rounded-tl-sm"
              )}>
                {formatText(msg.text)}
              </div>
            </motion.div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2.5 sm:gap-3 flex-row"
            >
              <div className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-full flex items-center justify-center mt-0.5 bg-muted border border-border">
                <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-muted/50 border border-border/50 rounded-tl-sm flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-2 w-2 bg-primary/60 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground ml-1">Analyzing...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Suggested questions */}
        {messages.length <= 1 && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap gap-2 pt-2"
          >
            {SUGGESTED[mode].map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-xs border border-border/50 bg-background/50 hover:bg-muted px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 text-left"
              >
                {q} <ArrowRight className="h-3 w-3 shrink-0" />
              </button>
            ))}
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-3 sm:px-5 py-3 bg-background/80 border-t border-border/50 backdrop-blur">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
          <Input
            placeholder={`Ask about Indian markets, SIP, tax planning...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-muted/50 border-border/50 h-10 sm:h-11 rounded-xl text-sm"
            disabled={isLoading}
            autoComplete="off"
          />
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl shrink-0"
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground mt-1.5">
          KnowEdge AI · Not financial advice · Always consult a SEBI-registered advisor
        </p>
      </div>
    </div>
  );
}
