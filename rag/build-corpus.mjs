// Rebuild rag/corpus-latest.json from PMRY 00-DATA.json + enriched profile .md files.
// Run: node rag/build-corpus.mjs  (or npm run rag:build)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// Source data is bundled into the repo at rag/source/ so Vercel can build it.
// Refresh from the canonical New Ideas/ folder with: npm run rag:sync
const dataPath = join(here, "source", "00-DATA.json");
const enrichedDir = join(here, "source", "profiles");
const trackerPath = join(here, "source", "00-TRACKER.json");

if (!existsSync(dataPath)) {
  console.error(`ERROR: Cannot find 00-DATA.json at:\n  ${dataPath}\n  Run "npm run rag:sync" to copy source data into the repo.`);
  process.exit(1);
}

const profiles = JSON.parse(readFileSync(dataPath, "utf8"));

// Build a map of id → enriched filename from the tracker
const tracker = existsSync(trackerPath) ? JSON.parse(readFileSync(trackerPath, "utf8")) : { profiles: [] };
const enrichedMap = Object.fromEntries(
  tracker.profiles
    .filter((p) => p.status === "done" && p.filename)
    .map((p) => [p.id, p.filename])
);

// Format currency as Rs.X.XL / Rs.XX,XX,XXX
function fmtRs(n) {
  if (!n && n !== 0) return "N/A";
  if (n >= 10_000_000) return `Rs.${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `Rs.${(n / 100_000).toFixed(1)}L`;
  return `Rs.${Math.round(n).toLocaleString("en-IN")}`;
}

function fmtPct(n) {
  return n != null ? `${n.toFixed(1)}%` : "N/A";
}

function buildDocText(p) {
  const lines = [
    `PMRY Business Model: ${p.product_name}`,
    `ID: ${p.id} | Sector: ${p.category} | Quadrant: ${p.quadrant} | Score: ${p.combined_score}/100`,
    `Capital Required (2003): ${fmtRs(p.total_capital_investment)} | Adjusted (2026 ×4): ${fmtRs(p.cap_adj)}`,
    `Annual Turnover (2003): ${fmtRs(p.annual_turnover)}`,
    `Net Profit (2003): ${fmtRs(p.net_profit)} | Net Profit Ratio: ${fmtPct(p.net_profit_ratio_pct)}`,
    `Rate of Return: ${fmtPct(p.rate_of_return_pct)} | Payback: ${p.payback_years != null ? p.payback_years.toFixed(2) + " years" : "N/A"} | Break-even: ${fmtPct(p.break_even_pct)}`,
    `Ease Score: ${p.ease_score}/100 | Return Score: ${p.return_score}/100`,
  ];

  if (p.notes) lines.push(`Notes: ${p.notes}`);

  // Append enriched market context if available
  const enrichedFile = enrichedMap[p.id];
  if (enrichedFile) {
    const mdPath = join(enrichedDir, enrichedFile);
    if (existsSync(mdPath)) {
      const md = readFileSync(mdPath, "utf8");
      // Extract the sections after "## Business Model in Plain Terms"
      const marketIdx = md.indexOf("## India Market Context");
      const viabilityIdx = md.indexOf("## Viability");
      if (marketIdx !== -1) {
        const marketSection = md.slice(marketIdx, viabilityIdx !== -1 ? viabilityIdx : md.length);
        lines.push("", marketSection.trim());
      }
      if (viabilityIdx !== -1) {
        lines.push("", md.slice(viabilityIdx).trim());
      }
    }
  }

  return lines.join("\n");
}

const documents = profiles.map((p, i) => {
  const doc = {
    type: "document",
    source: {
      type: "text",
      media_type: "text/plain",
      data: buildDocText(p),
    },
    title: `${p.id} — ${p.product_name}`,
    citations: { enabled: true },
  };
  // Prompt caching: mark the last document so Claude caches everything up to it
  if (i === profiles.length - 1) {
    doc.cache_control = { type: "ephemeral" };
  }
  return doc;
});

const totalChars = documents.reduce((s, d) => s + d.source.data.length, 0);
const approxTokens = Math.round(totalChars / 4);
const enrichedCount = Object.keys(enrichedMap).length;

const out = {
  built_at: new Date().toISOString(),
  profile_count: documents.length,
  enriched_count: enrichedCount,
  approx_tokens: approxTokens,
  documents,
};

const outPath = join(here, "corpus-latest.json");
writeFileSync(outPath, JSON.stringify(out));

// Also write a bundled copy of the profile data for the browse API
// (Vercel serverless functions can't reach outside the project directory)
import { mkdirSync } from "node:fs";
const dataDir = join(here, "..", "data");
mkdirSync(dataDir, { recursive: true });
writeFileSync(join(dataDir, "profiles.json"), JSON.stringify(profiles));

if (approxTokens > 150_000) {
  console.error(`ERROR: Corpus too large (${approxTokens} tokens > 150K limit). Reduce enrichment sections.`);
  process.exit(1);
}

console.log(`rag/corpus-latest.json: ${documents.length} documents, ${enrichedCount} enriched, ~${approxTokens.toLocaleString()} tokens`);
if (approxTokens < 80_000) {
  console.log(`✅ tier-0 eligible (fits comfortably in single prompt-cached prefix)`);
} else {
  console.log(`⚠️  approaching tier-1 territory — monitor token count as enrichments grow`);
}
