// POST /api/ask { "question": "..." }  →  SSE stream of {text}/{citation}/{quality}.
// Vercel serverless function (Node runtime).
import { answer } from "../rag/answer.js";

export const config = { runtime: "nodejs", maxDuration: 60 };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const { question } = await req.json().catch(() => ({ question: "" }));
  if (!question || typeof question !== "string")
    return new Response(JSON.stringify({ error: "question required" }), { status: 400 });

  const startTime = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      let hasCitation = false;

      try {
        for await (const chunk of answer(question)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          if (chunk.text) fullText += chunk.text;
          if (chunk.citation?.profile) hasCitation = true;
        }

        // Runtime quality check — logged to Vercel function logs (free, no extra infra)
        const quality = {
          has_citation: hasCitation || /Vol [IVX]|Source:/.test(fullText),
          has_numbers: /Rs\.|%|\d+\.\d+/.test(fullText),
          response_length_ok: fullText.length > 80 && fullText.length < 5000,
          latency_ms: Date.now() - startTime,
        };
        console.log(JSON.stringify({ event: "query_quality", ...quality, q: question.slice(0, 80) }));

        // Warn if answer appears ungrounded
        if (!quality.has_citation) {
          const warning =
            "\n\n⚠️ This answer may not be fully grounded in the profile data. Try rephrasing or use Browse to filter profiles directly.";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: warning })}\n\n`));
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}
