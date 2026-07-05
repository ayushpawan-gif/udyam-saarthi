// GET /api/warm — cheaply warms the serverless container so the next real
// question doesn't pay the cold-start corpus prefill. Hit it every ~5 min from an
// external pinger (UptimeRobot / cron-job.org) or the Make.com cadence infra.
// No LLM call, no tokens spent.
import { getDocBlocks } from "../rag/answer.js";

export const config = { runtime: "nodejs" };

function handler(): Response {
  // Touch the corpus singleton so it's resident in this container's memory.
  const docs = getDocBlocks();
  return new Response(
    JSON.stringify({ ok: true, warmed: docs.length, ts: Date.now() }),
    { headers: { "content-type": "application/json", "cache-control": "no-store" } }
  );
}

export default { fetch: handler };
