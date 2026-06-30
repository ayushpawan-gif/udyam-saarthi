// Generate ~200 benchmark questions across the full query taxonomy, with
// deterministically-computed expectations derived from the profile data.
// Output: rag/bench/questions.json   Run: node rag/bench/generate-questions.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const profiles = JSON.parse(readFileSync(join(here, "..", "source", "00-DATA.json"), "utf8"));

const byCheapest = [...profiles].sort((a, b) => a.cap_adj - b.cap_adj);
const byPayback = [...profiles].sort((a, b) => a.payback_years - b.payback_years);
const byRor = [...profiles].sort((a, b) => (b.rate_of_return_pct ?? 0) - (a.rate_of_return_pct ?? 0));
const byScore = [...profiles].sort((a, b) => b.combined_score - a.combined_score);
const byProfit = [...profiles].sort((a, b) => b.net_profit - a.net_profit);

const SECTORS = [...new Set(profiles.map((p) => p.category))];
const Q = [];
let n = 0;
const add = (o) => Q.push({ id: `Q${String(++n).padStart(3, "0")}`, ...o });

// 1) Ranking — expect instant, known top profile
add({ category: "ranking", q: "What is the cheapest business to start?", expectInstant: true, expectTopId: byCheapest[0].id });
add({ category: "ranking", q: "Which business has the lowest capital requirement?", expectInstant: true, expectTopId: byCheapest[0].id });
add({ category: "ranking", q: "Show me the fastest payback business", expectInstant: true, expectTopId: byPayback[0].id });
add({ category: "ranking", q: "Which business gives the quickest return?", expectInstant: true, expectTopId: byPayback[0].id });
add({ category: "ranking", q: "Highest rate of return business?", expectInstant: true, expectTopId: byRor[0].id });
add({ category: "ranking", q: "Which has the best return on investment?", expectInstant: true, expectTopId: byRor[0].id });
add({ category: "ranking", q: "Best business by viability score", expectInstant: true, expectTopId: byScore[0].id });
add({ category: "ranking", q: "Top recommended business model", expectInstant: true, expectTopId: byScore[0].id });
add({ category: "ranking", q: "Most profitable business per year", expectInstant: true, expectTopId: byProfit[0].id });

// 2) Capital filter — expect instant; non-emptiness derived from the data
// (the cheapest 2026-adjusted business is ~₹6.76L, so small budgets correctly return none).
for (const amt of [50000, 100000, 200000, 500000, 1000000, 2000000, 5000000]) {
  const set = profiles.filter((p) => p.cap_adj <= amt);
  add({ category: "capital", q: `What businesses can I start under ₹${amt.toLocaleString("en-IN")}?`, expectInstant: true, capCeil: amt, expectNonEmpty: set.length > 0 });
  add({ category: "capital", q: `I have ${(amt / 100000).toFixed(0)} lakh to invest. Show me options.`, expectInstant: true, capCeil: amt, expectNonEmpty: set.length > 0 });
}

// 3) Sector filter — expect instant, all in sector
for (const s of SECTORS) {
  const top = [...profiles].filter((p) => p.category === s).sort((a, b) => b.combined_score - a.combined_score)[0];
  add({ category: "sector", q: `Best ${s} sector business`, expectInstant: true, sector: s, expectTopId: top?.id });
  add({ category: "sector", q: `Show me ${s} businesses`, expectInstant: true, sector: s, expectNonEmpty: true });
}

// 4) Composite — sector + capital (use a generous ceiling so most sectors have matches)
for (const s of SECTORS.slice(0, 6)) {
  const amt = 50_00_000;
  const set = profiles.filter((p) => p.category === s && p.cap_adj <= amt);
  add({ category: "composite", q: `Cheapest ${s} business under ₹50 lakh`, expectInstant: true, sector: s, capCeil: amt, expectNonEmpty: set.length > 0 });
}

// 5) Single-profile lookup — sample across the catalog, expect instant top = that id
const step = Math.max(1, Math.floor(profiles.length / 40));
for (let i = 0; i < profiles.length; i += step) {
  const p = profiles[i];
  add({ category: "lookup", q: p.product_name, expectInstant: true, expectTopId: p.id });
}

// 6) Comparison — expect LLM, mention both names
for (let i = 0; i < 14; i += 1) {
  const a = byScore[i], b = byScore[i + 20];
  add({ category: "comparison", q: `Compare ${a.product_name} vs ${b.product_name}`, expectInstant: false, expectContains: [a.product_name.split(" ")[0], b.product_name.split(" ")[0]] });
}

// 7) Advisory / open — expect LLM, mention the business
for (let i = 0; i < 30; i += 1) {
  const p = byScore[i % byScore.length];
  const templates = [
    `How do I start ${p.product_name}?`,
    `What are the risks of ${p.product_name}?`,
    `Why is ${p.product_name} a good or bad idea?`,
  ];
  add({ category: "advisory", q: templates[i % 3], expectInstant: false, expectContains: [p.product_name.split(" ")[0]] });
}

// 8) Meta — expect LLM
add({ category: "meta", q: "What is PMRY and where does this data come from?", expectInstant: false, expectContains: ["government"] });
add({ category: "meta", q: "How reliable is this data?", expectInstant: false });
add({ category: "meta", q: "What years are these figures from?", expectInstant: false });

// 9) Out-of-scope — expect LLM refusal
for (const q of [
  "What's the weather in Mumbai today?",
  "Write me a poem about the ocean",
  "Who won the cricket world cup?",
  "How do I invest in US stocks?",
  "What's the best mutual fund in India?",
]) add({ category: "out_of_scope", q, expectInstant: false, expectRefusal: true });

mkdirSync(here, { recursive: true });
writeFileSync(join(here, "questions.json"), JSON.stringify(Q, null, 2));
const counts = Q.reduce((m, x) => ((m[x.category] = (m[x.category] || 0) + 1), m), {});
console.log(`Generated ${Q.length} questions →`, counts);
