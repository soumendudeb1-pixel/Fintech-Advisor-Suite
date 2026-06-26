import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useMode } from "@/hooks/use-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Bot,
  X,
  Send,
  Loader2,
  Minimize2,
  Sparkles,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  text: string;
}

// ─── Base URL helper (same pattern as advisor.tsx) ──────────────────────────

function getApiBase(): string {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api`;
}

// ─── Quick-fire suggestion chips per mode ───────────────────────────────────

const SUGGESTIONS: Record<string, string[]> = {
  student: [
    "How much should I save each month?",
    "What is a SIP?",
    "Best index funds for beginners?",
  ],
  career: [
    "How to save tax with 80C?",
    "New vs old tax regime — which is better?",
    "How to start investing with ₹5,000/month?",
  ],
  retiree: [
    "Is 4% withdrawal rate safe in India?",
    "Tell me about SCSS benefits",
    "How to beat inflation in retirement?",
  ],
};

// ─── Simple markdown bold renderer ─────────────────────────────────────────

function FormatText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ─── Typing indicator ───────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-end gap-1 px-3 py-2.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary/60"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function FloatingChat() {
  const [location] = useLocation();
  const { mode } = useMode();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimised, setIsMinimised] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [unread, setUnread] = useState(0);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hi! I'm KnowEdge AI — ask me anything about investing, tax saving, or financial planning in India. 🇮🇳",
    },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hide on Advisor page (it has its own full-page chat)
  if (location === "/advisor") return null;

  // Auto-scroll
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (isOpen && !isMinimised) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen, isMinimised]);

  // Focus input when opened
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (isOpen && !isMinimised) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen, isMinimised]);

  // Reset unread when opened
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (isOpen) setUnread(0);
  }, [isOpen]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setIsLoading(true);

    try {
      const res = await fetch(`${getApiBase()}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, session_id: sessionId, mode }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as { response: string; session_id: string };
      setSessionId(data.session_id);
      setMessages((prev) => [...prev, { role: "assistant", text: data.response }]);

      // Count unread when panel is closed / minimised
      if (!isOpen || isMinimised) setUnread((n) => n + 1);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Sorry, I couldn't reach the server. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, sessionId, mode, isOpen, isMinimised]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimised(false);
    setUnread(0);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimised(false);
  };

  const handleMinimise = () => setIsMinimised(true);

  return (
    <>
      {/* ── Floating trigger button ── */}
      <AnimatePresence>
        {(!isOpen || isMinimised) && (
          <motion.div
            key="fab"
            className="fixed bottom-6 right-6 z-50"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <button
              onClick={handleOpen}
              aria-label="Open AI chat"
              className={cn(
                "relative group w-14 h-14 rounded-full shadow-2xl",
                "bg-gradient-to-br from-primary to-blue-600",
                "flex items-center justify-center",
                "transition-transform duration-200 hover:scale-110 active:scale-95",
                "ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
              )}
            >
              {/* Pulse ring */}
              <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
              <Bot className="h-6 w-6 text-white relative z-10" />

              {/* Unread badge */}
              <AnimatePresence>
                {unread > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
                  >
                    {unread > 9 ? "9+" : unread}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Chat panel ── */}
      <AnimatePresence>
        {isOpen && !isMinimised && (
          <motion.div
            key="panel"
            className="fixed bottom-6 right-6 z-50 w-[360px] sm:w-[400px]"
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <div className={cn(
              "flex flex-col rounded-2xl overflow-hidden shadow-2xl",
              "border border-border/60",
              "bg-card/95 backdrop-blur-xl",
              "h-[520px]",
            )}>

              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-muted/40 shrink-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">KnowEdge AI</span>
                    <Badge variant="outline" className="text-[10px] capitalize py-0 px-1.5 h-4">
                      {mode}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-muted-foreground">Online</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={handleMinimise} aria-label="Minimise">
                    <Minimize2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={handleClose} aria-label="Close">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "flex gap-2 items-end",
                      msg.role === "user" ? "flex-row-reverse" : "flex-row",
                    )}
                  >
                    {/* Avatar */}
                    {msg.role === "assistant" && (
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mb-0.5">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted/70 text-foreground rounded-bl-sm border border-border/40",
                      )}
                    >
                      <FormatText text={msg.text} />
                    </div>
                  </motion.div>
                ))}

                {/* Typing indicator */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2 items-end"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="bg-muted/70 border border-border/40 rounded-2xl rounded-bl-sm">
                      <TypingDots />
                    </div>
                  </motion.div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Suggestion chips — show only for first interaction */}
              {messages.length === 1 && !isLoading && (
                <div className="px-3 pb-2 flex gap-1.5 flex-wrap shrink-0">
                  {(SUGGESTIONS[mode] ?? SUGGESTIONS.student).map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className={cn(
                        "text-[10px] px-2.5 py-1 rounded-full border border-border/60",
                        "bg-muted/50 hover:bg-primary/10 hover:border-primary/40",
                        "text-muted-foreground hover:text-primary",
                        "transition-colors duration-150 flex items-center gap-1",
                      )}
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="px-3 pb-3 shrink-0 border-t border-border/50 pt-3 bg-muted/20">
                <form onSubmit={handleSubmit} className="flex gap-2 items-center">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything about finance…"
                    disabled={isLoading}
                    className={cn(
                      "flex-1 h-9 text-sm rounded-full px-4",
                      "bg-background border-border/60",
                      "focus-visible:ring-primary/40",
                    )}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(input);
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isLoading || !input.trim()}
                    className="h-9 w-9 rounded-full shrink-0 bg-primary hover:bg-primary/90"
                    aria-label="Send"
                  >
                    {isLoading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Send className="h-4 w-4" />
                    }
                  </Button>
                </form>
                <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
                  KnowEdge AI · Indian market context · Not financial advice
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
