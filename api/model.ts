// POST /api/model { productName, category, capAdj, baseRevenue, baseProfit, baseMarginPct, scenarios }
// Streams a 3-paragraph Haiku narration of the 5-year financial projections.
import Anthropic from "@anthropic-ai/sdk";

export const config = { runtime: "nodejs", maxDuration: 60 };

const client = new Anthropic();

function fmtL(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const body = await req.json().catch(() => null);
  if (!body?.productName)
    return new Response(JSON.stringify({ error: "productName required" }), { status: 400 });

  const { productName, category, capAdj, baseRevenue, baseProfit, baseMarginPct, scenarios } = body;
  const { conservative: c, base: b, optimistic: o } = scenarios ?? {};

  const prompt = `You are a financial advisor for Indian MSME entrepreneurs.

Business: ${productName} (${category})
Initial capital (2026-adjusted): ${fmtL(capAdj)}
Year 1 revenue: ${fmtL(baseRevenue)} | Year 1 profit: ${fmtL(baseProfit)} | Net margin: ${baseMarginPct?.toFixed(1)}%

5-Year scenario summary:
                Conservative (5%/yr growth)   Base (10%/yr)        Optimistic (15%/yr)
Year 5 Revenue: ${fmtL(c?.yr5rev)}            ${fmtL(b?.yr5rev)}   ${fmtL(o?.yr5rev)}
Year 5 Profit:  ${fmtL(c?.yr5profit)}         ${fmtL(b?.yr5profit)} ${fmtL(o?.yr5profit)}
Net vs capital: ${fmtL(c?.yr5net)}            ${fmtL(b?.yr5net)}   ${fmtL(o?.yr5net)}
Payback:        ${c?.payback === Infinity ? ">10yr" : c?.payback + "yr"}  ${b?.payback === Infinity ? ">10yr" : b?.payback + "yr"}  ${o?.payback === Infinity ? ">10yr" : o?.payback + "yr"}

Write exactly 3 short paragraphs (no headings, no bullets):
1. The single most critical assumption embedded in these projections — be specific, not generic.
2. The biggest realistic risk that could cause the base scenario to fail — give a concrete example from the Indian market.
3. One specific operational or market decision the entrepreneur could make to shift outcomes toward the optimistic scenario.

Speak directly to the entrepreneur. Use Indian market context. Be concise.`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const s = client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }],
        });
        s.on("text", (text: string) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        });
        await s.finalMessage();
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" },
  });
}

export default { fetch: handler };
