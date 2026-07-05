// GET /api/browse?sector=Food&maxCap=500000&quadrant=SEND-FIRST&sort=payback&q=soap&limit=20
// Pure JS filter+sort over 00-DATA.json — no LLM call, zero Anthropic cost.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(readFileSync(join(here, "..", "data", "profiles.json"), "utf8")) as Profile[];

export const config = { runtime: "nodejs" };

interface Profile {
  id: string;
  category: string;
  product_name: string;
  quadrant: string;
  combined_score: number;
  ease_score: number;
  return_score: number;
  total_capital_investment: number;
  cap_adj: number;
  annual_turnover: number;
  net_profit: number;
  net_profit_ratio_pct: number;
  rate_of_return_pct: number;
  break_even_pct: number;
  payback_years: number;
}

export default function handler(req: Request): Response {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });

  const url = new URL(req.url);
  const sector = url.searchParams.get("sector")?.toLowerCase();
  const maxCap = url.searchParams.get("maxCap") ? Number(url.searchParams.get("maxCap")) : null;
  const minCap = url.searchParams.get("minCap") ? Number(url.searchParams.get("minCap")) : null;
  const quadrant = url.searchParams.get("quadrant")?.toLowerCase();
  const sort = url.searchParams.get("sort") ?? "combined_score";
  const q = url.searchParams.get("q")?.toLowerCase();
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 225);

  let results = DATA.slice();

  if (sector) results = results.filter((p) => p.category.toLowerCase().includes(sector));
  if (quadrant) results = results.filter((p) => p.quadrant.toLowerCase().includes(quadrant));
  if (maxCap != null) results = results.filter((p) => p.cap_adj <= maxCap);
  if (minCap != null) results = results.filter((p) => p.cap_adj >= minCap);
  if (q) results = results.filter((p) => p.product_name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));

  const sortFn: Record<string, (a: Profile, b: Profile) => number> = {
    combined_score: (a, b) => b.combined_score - a.combined_score,
    payback: (a, b) => a.payback_years - b.payback_years,
    ror: (a, b) => b.rate_of_return_pct - a.rate_of_return_pct,
    capital: (a, b) => a.cap_adj - b.cap_adj,
    profit: (a, b) => b.net_profit - a.net_profit,
  };
  results.sort(sortFn[sort] ?? sortFn.combined_score);

  return new Response(JSON.stringify({ total: results.length, results: results.slice(0, limit) }), {
    headers: { "content-type": "application/json" },
  });
}
