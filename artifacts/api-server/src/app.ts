import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── Environment variable validation ──────────────────────────────────────────
// Required at runtime:
const REQUIRED_ENV: string[] = [];          // none strictly required for base features
// Optional — logged at startup so it's clear what is/isn't configured:
const OPTIONAL_ENV: string[] = [
  "LLM_API_KEY",          // API key for OpenAI-compatible LLM (required for live AI chat)
  "LLM_MODEL",            // model name, e.g. gpt-4o-mini, llama-3-70b, claude-3-haiku (default: gpt-4o-mini)
  "LLM_BASE_URL",         // override base URL for Groq, Azure, OpenRouter, or self-hosted models
  "SESSION_SECRET",       // used for session management
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  logger.error({ missing }, "Missing required environment variables — server cannot start");
  process.exit(1);
}

for (const key of OPTIONAL_ENV) {
  if (process.env[key]) {
    logger.info({ key }, "Optional env var present");
  } else {
    logger.warn({ key }, "Optional env var not set — related features may be limited");
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS — allow all origins (development); restrict in production via CORS_ORIGIN env
const corsOrigin = process.env["CORS_ORIGIN"] ?? "*";
app.use(cors({ origin: corsOrigin }));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found", status: 404 });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error", status: 500 });
});

export default app;
