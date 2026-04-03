import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function healthHandler(_req: unknown, res: { json: (d: unknown) => void }) {
  const base = HealthCheckResponse.parse({ status: "ok" });
  (res as any).json({
    ...base,
    timestamp: new Date().toISOString(),
    service: "KnowEdge API",
    version: "1.0.0",
    // Expose LLM availability so the frontend can display the correct badge
    llmEnabled: !!process.env["LLM_API_KEY"],
    llmModel: process.env["LLM_MODEL"] ?? "gpt-4o-mini (default)",
  });
}

router.get("/healthz", healthHandler);
router.get("/health", healthHandler);

export default router;
