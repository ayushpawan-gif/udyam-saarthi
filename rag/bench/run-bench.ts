// Self-benchmark harness. Runs every question, records routing (instant vs LLM),
// latency (first-token + total for LLM), and correctness vs. data-derived truth.
// Writes a dated markdown report. Run: tsx rag/bench/run-bench.ts [label]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { route } from "../../src/lib/answerRouter";
import { answer } from "../answer";
import type { Profile } from "../../src/lib/profiles";

const here = dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] ?? "run";
const CONCURRENCY = 4;
const HAS_KEY = !!process.env.ANTHROPIC_API_KEY; // offline mode validates routing + instant only

interface Question {
  id: string; category: string; q: string;
  expectInstant: boolean; expectTopId?: string; expectNonEmpty?: boolean;
  sector?: string; capCeil?: number; expectContains?: string[]; expectRefusal?: boolean;
}
interface Result {
  id: string; category: string; q: string; path: "instant" | "llm";
  routingOk: boolean; correct: boolean; firstTokenMs?: number; totalMs?: number; citation?: boolean; detail: string;
}

const profiles: Profile[] = JSON.parse(readFileSync(join(here, "..", "source", "00-DATA.json"), "utf8"));
const questions: Question[] = JSON.parse(readFileSync(join(here, "questions.json"), "utf8"));

const REFUSAL_RE = /outside|scope|cannot|can't|don't have|do not have|not (cover|include|about)|rephrase|only (answer|help)/i;

async function runOne(q: Question): Promise<Result> {
  const r = route(q.q, profiles);
  const routedInstant = r.kind === "instant";
  const routingOk = routedInstant === q.expectInstant;

  if (routedInstant) {
    // If we expected LLM but answered instant, that's wrong regardless.
    if (!q.expectInstant) {
      return { id: q.id, category: q.category, q: q.q, path: "instant", routingOk, correct: false, detail: "wrongly answered instant" };
    }
    const r2 = r as Extract<typeof r, { kind: "instant" }>;
    const got = r2.profiles;
    let ok = true;
    const notes: string[] = [];
    if (q.expectTopId) { ok = got[0]?.id === q.expectTopId; notes.push(`top=${got[0]?.id ?? "∅"} want=${q.expectTopId}`); }
    if (q.sector) { ok = ok && got.every((p) => p.category === q.sector); notes.push(`${got.length} in ${q.sector}`); }
    if (q.capCeil) { ok = ok && got.every((p) => p.cap_adj <= q.capCeil!); }
    if (q.expectNonEmpty === true) { ok = ok && got.length > 0; notes.push(`${got.length} results`); }
    if (q.expectNonEmpty === false) { ok = ok && got.length === 0; notes.push(`expected empty, got ${got.length}`); }
    return { id: q.id, category: q.category, q: q.q, path: "instant", routingOk, correct: ok, detail: notes.join(" · ") };
  }

  // LLM path
  if (q.expectInstant) {
    // Expected instant but fell through to the slow LLM path → routing miss, skip the call.
    return { id: q.id, category: q.category, q: q.q, path: "llm", routingOk: false, correct: false, detail: "missed instant route" };
  }

  // Offline mode: validate routing only; don't call the API.
  if (!HAS_KEY) {
    return { id: q.id, category: q.category, q: q.q, path: "llm", routingOk, correct: routingOk, detail: "routing-only (no key)" };
  }

  const start = performance.now();
  let firstTokenMs: number | undefined, text = "", citation = false;
  try {
    for await (const chunk of answer(q.q)) {
      if (chunk.text) { if (firstTokenMs === undefined) firstTokenMs = performance.now() - start; text += chunk.text; }
      if (chunk.citation?.profile) citation = true;
    }
  } catch (e) {
    return { id: q.id, category: q.category, q: q.q, path: "llm", routingOk, correct: false, detail: `error: ${(e as Error).message}` };
  }
  const totalMs = performance.now() - start;
  const low = text.toLowerCase();

  let correct = true, detail = "";
  if (q.expectRefusal) { correct = REFUSAL_RE.test(text); detail = correct ? "refused" : "did NOT refuse"; }
  else if (q.expectContains) { const miss = q.expectContains.filter((s) => !low.includes(s.toLowerCase())); correct = miss.length === 0; detail = miss.length ? `missing: ${miss.join(",")}` : "ok"; }
  else correct = text.length > 40;

  return { id: q.id, category: q.category, q: q.q, path: "llm", routingOk, correct, firstTokenMs, totalMs, citation, detail };
}

// Simple concurrency pool.
async function pool<T, R>(items: T[], k: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: k }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); process.stdout.write("."); }
  }));
  process.stdout.write("\n");
  return out;
}

function pct(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

function report(results: Result[]): string {
  const cats = [...new Set(results.map((r) => r.category))];
  const routingOk = results.filter((r) => r.routingOk).length;
  const correct = results.filter((r) => r.correct).length;
  const instant = results.filter((r) => r.path === "instant");
  const llm = results.filter((r) => r.path === "llm" && r.totalMs != null);
  const ft = llm.map((r) => r.firstTokenMs ?? 0), tot = llm.map((r) => r.totalMs ?? 0);
  const llmCited = llm.filter((r) => r.citation).length;

  const lines: string[] = [];
  lines.push(`# Udyam Saarthi — Self-Benchmark "${label}"`);
  lines.push(`\n_${new Date().toISOString()} · ${results.length} questions_\n`);
  lines.push(`## Headline`);
  lines.push(`- **Routing accuracy:** ${(100 * routingOk / results.length).toFixed(1)}% (${routingOk}/${results.length}) — sent to the right engine (instant vs LLM)`);
  lines.push(`- **Answer correctness:** ${(100 * correct / results.length).toFixed(1)}% (${correct}/${results.length})`);
  lines.push(`- **Instant (no-LLM) share:** ${(100 * instant.length / results.length).toFixed(1)}% (${instant.length} answered in <1ms, $0 cost)`);
  if (llm.length) {
    lines.push(`- **LLM first-token latency:** p50 ${(pct(ft, 50) / 1000).toFixed(1)}s · p90 ${(pct(ft, 90) / 1000).toFixed(1)}s · p99 ${(pct(ft, 99) / 1000).toFixed(1)}s`);
    lines.push(`- **LLM total latency:** p50 ${(pct(tot, 50) / 1000).toFixed(1)}s · p90 ${(pct(tot, 90) / 1000).toFixed(1)}s · max ${(Math.max(...tot) / 1000).toFixed(1)}s`);
    lines.push(`- **LLM citation coverage:** ${(100 * llmCited / llm.length).toFixed(0)}% (${llmCited}/${llm.length})`);
  }

  lines.push(`\n## By category`);
  lines.push(`| Category | n | routing ok | correct | instant | avg first-token |`);
  lines.push(`|---|--:|--:|--:|--:|--:|`);
  for (const c of cats) {
    const rs = results.filter((r) => r.category === c);
    const ll = rs.filter((r) => r.path === "llm" && r.firstTokenMs != null);
    const avgFt = ll.length ? (ll.reduce((s, r) => s + (r.firstTokenMs ?? 0), 0) / ll.length / 1000).toFixed(1) + "s" : "—";
    lines.push(`| ${c} | ${rs.length} | ${(100 * rs.filter((r) => r.routingOk).length / rs.length).toFixed(0)}% | ${(100 * rs.filter((r) => r.correct).length / rs.length).toFixed(0)}% | ${rs.filter((r) => r.path === "instant").length} | ${avgFt} |`);
  }

  const fails = results.filter((r) => !r.correct);
  lines.push(`\n## Failures (${fails.length})`);
  if (!fails.length) lines.push(`_None — all questions correct._`);
  else for (const f of fails.slice(0, 40)) lines.push(`- [${f.category}/${f.path}] "${f.q}" — ${f.detail}`);

  return lines.join("\n");
}

(async () => {
  console.log(`Running ${questions.length} questions (label="${label}", concurrency=${CONCURRENCY})…`);
  const results = await pool(questions, CONCURRENCY, runOne);
  const md = report(results);
  const dir = join(here, "reports");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const path = join(dir, `${stamp}-${label}.md`);
  writeFileSync(path, md);
  writeFileSync(join(here, "results-latest.json"), JSON.stringify(results, null, 2));
  console.log("\n" + md.split("\n## By category")[0]);
  console.log(`\nFull report → ${path}`);
})();
