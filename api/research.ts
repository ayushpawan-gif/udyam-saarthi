// POST /api/research { productName, category }
// Streams market research using Anthropic's built-in web search (beta).
// Model: claude-sonnet-4-6 with web-search-2025-03-05 beta.
import Anthropic from "@anthropic-ai/sdk";

export const config = { runtime: "nodejs", maxDuration: 60 };

const client = new Anthropic();

const SYSTEM =
  "You are a market research analyst specialising in Indian MSME and manufacturing sectors. " +
  "Research the given product and provide a structured market intelligence report with these sections:\n" +
  "1. **Current Prices** — wholesale/ex-factory prices in India (₹) with sources\n" +
  "2. **Demand Trends** — growing/stable/declining, key demand drivers, market size if available\n" +
  "3. **Buyers & Channels** — top B2B buyers, distribution channels, key distributors\n" +
  "4. **Competition** — major competitors, market leaders, import competition\n" +
  "5. **GeM Opportunity** — whether the product is listed on GeM portal, bid volumes\n" +
  "6. **Export Potential** — target markets, APEDA/FIEO programs, typical FOB prices\n\n" +
  "Use markdown headers (##). Be specific with numbers. Cite all sources with URLs.";

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const { productName, category } = await req.json().catch(() => ({}));
  if (!productName)
    return new Response(JSON.stringify({ error: "productName required" }), { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const s = client.beta.messages.stream(
          {
            model: "claude-sonnet-4-6",
            max_tokens: 1500,
            system: SYSTEM,
            messages: [
              {
                role: "user",
                content: `Research the current Indian market for: **${productName}** (DC(MSME) sector: ${category}). Focus on actionable intelligence for a first-time Indian MSME entrepreneur starting this business in 2026.`,
              },
            ],
            tools: [{ type: "web_search_20250305", name: "web_search" }] as unknown as Anthropic.Beta.Messages.BetaTool[],
            betas: ["web-search-2025-03-05" as Anthropic.AnthropicBeta],
          },
        );

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
