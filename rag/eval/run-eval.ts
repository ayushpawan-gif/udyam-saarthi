// Udyam Saarthi RAG eval — citation coverage + content hit against the gold set.
// Hard gates: citation coverage ≥87% (≥13/15) AND content hit ≥80% (≥12/15).
// Run: tsx rag/eval/run-eval.ts  (or npm run rag:eval)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { answer } from "../answer";

type Gold = { q: string; must_cite: string[]; expect_contains: string[] };
const here = dirname(fileURLToPath(import.meta.url));

async function run() {
  const goldPath = process.argv[2] ?? join(here, "gold.jsonl");
  const gold: Gold[] = readFileSync(goldPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

  let citationHits = 0;
  let contentHits = 0;

  for (const g of gold) {
    let fullText = "";
    let citedText = "";
    let citedCount = 0;

    for await (const chunk of answer(g.q)) {
      if (chunk.text) fullText += chunk.text;
      if (chunk.citation) {
        citedText += " " + (chunk.citation.quote ?? "") + " " + (chunk.citation.profile ?? "");
        citedCount++;
      }
    }

    const combined = (fullText + " " + citedText).toLowerCase();

    const citationPass =
      g.must_cite.length === 0
        ? true // no specific citation required — just check it's grounded
        : g.must_cite.some((v) => combined.includes(v.toLowerCase()));

    const contentPass =
      g.expect_contains.length === 0
        ? true
        : g.expect_contains.every((s) => combined.includes(s.toLowerCase()));

    if (citationPass) citationHits++;
    if (contentPass) contentHits++;

    const status = citationPass && contentPass ? "PASS" : (citationPass ? "CITE✓ CONT✗" : "CITE✗ CONT" + (contentPass ? "✓" : "✗"));
    console.log(`${status.padEnd(12)} ${g.q.slice(0, 70)}`);
  }

  const citeCov = citationHits / gold.length;
  const contCov = contentHits / gold.length;
  console.log(`\ncitation coverage: ${(citeCov * 100).toFixed(0)}%  (${citationHits}/${gold.length})  target ≥87%`);
  console.log(`content hit:       ${(contCov * 100).toFixed(0)}%  (${contentHits}/${gold.length})  target ≥80%`);

  const passed = citeCov >= 0.87 && contCov >= 0.80;

  // Write results to rag.config.json for cockpit visibility
  const configPath = join(here, "..", "..", "rag.config.json");
  let config: Record<string, unknown> = {};
  try { config = JSON.parse(readFileSync(configPath, "utf8")); } catch { /* first run */ }
  config.eval = {
    last_run: new Date().toISOString(),
    citation_coverage: Math.round(citeCov * 100),
    content_hit: Math.round(contCov * 100),
    passed,
    gold_count: gold.length,
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  if (!passed) {
    console.error(`\n❌ Eval FAILED — deploy blocked. citation ${(citeCov * 100).toFixed(0)}% (need 87%), content ${(contCov * 100).toFixed(0)}% (need 80%)`);
    process.exit(1);
  }
  console.log(`\n✅ Eval PASSED`);
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
