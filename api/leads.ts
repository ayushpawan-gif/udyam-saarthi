// POST /api/leads { productName, category, annualTurnover, netProfit }
// Returns structured JSON: { b2b, retail, export, government, schemes, nextStep }
import Anthropic from "@anthropic-ai/sdk";

export const config = { runtime: "nodejs", maxDuration: 30 };

const client = new Anthropic();

const SYSTEM = `You are a business development expert for Indian MSME entrepreneurs. Identify specific buyers and go-to-market channels.

Return ONLY valid JSON — no markdown fences, no explanation:
{
  "b2b": ["<buyer type>: <specific example company or segment>"],
  "retail": ["<channel>: <how to access it>"],
  "export": ["<country or region>: <demand reason + programs>"],
  "government": ["<portal or scheme>: <how to register / apply>"],
  "schemes": ["<GoI scheme name>: <specific benefit in Rs. or %>"],
  "nextStep": "<single most important first action to take this week>"
}

Rules:
- b2b: 4 items — specific Indian companies or buyer types (not generic)
- retail: 3 items — concrete channel names
- export: 2–3 items — countries with real demand for this product
- government: 2–3 items — always include GeM (gem.gov.in) if applicable
- schemes: 2–3 items — only schemes directly relevant to this product/sector
- nextStep: one sentence, specific and actionable
Return ONLY the JSON object. No other text.`;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const { productName, category, annualTurnover, netProfit } =
    await req.json().catch(() => ({}));
  if (!productName)
    return new Response(JSON.stringify({ error: "productName required" }), { status: 400 });

  const fmtL = (n: number) =>
    n >= 1_00_000 ? `₹${(n / 1_00_000).toFixed(1)}L` : `₹${Math.round(n).toLocaleString("en-IN")}`;

  const prompt = `Product: ${productName}
Sector: ${category}
Annual turnover (govt profile, 2003): ${fmtL(annualTurnover)} → ~${fmtL(annualTurnover * 4)} in 2026 terms
Net profit: ${fmtL(netProfit)} → ~${fmtL(netProfit * 4)} in 2026 terms

Identify buyers, channels, export markets, government opportunities, and the most important first step for an Indian entrepreneur starting this in 2026.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("");

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```(?:json)?\n?/g, "").trim();
    const json = JSON.parse(cleaned);

    return new Response(JSON.stringify(json), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}
