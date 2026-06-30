// Sync source data from the canonical New Ideas/ folder into rag/source/ (in-repo).
// Run after the daily J8 enrichment job adds new profiles: npm run rag:sync
// This keeps the repo self-contained so Vercel can build the corpus.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const canonical = join(here, "..", "..", "..", "..", "..", "New Ideas", "PMRY-Project-Profiles");
const srcData = join(canonical, "00-DATA.json");
const srcTracker = join(canonical, "00-AIKosh-Contributions", "00-TRACKER.json");
const srcProfiles = join(canonical, "00-AIKosh-Contributions", "profiles");

const destDir = join(here, "source");
const destProfiles = join(destDir, "profiles");

if (!existsSync(srcData)) {
  console.error(`ERROR: Canonical data not found at ${srcData}\nRun this from the Seva OS working tree, not a standalone clone.`);
  process.exit(1);
}

mkdirSync(destProfiles, { recursive: true });
writeFileSync(join(destDir, "00-DATA.json"), readFileSync(srcData));
writeFileSync(join(destDir, "00-TRACKER.json"), readFileSync(srcTracker));

let count = 0;
for (const f of readdirSync(srcProfiles).filter((n) => n.endsWith(".md"))) {
  writeFileSync(join(destProfiles, f), readFileSync(join(srcProfiles, f)));
  count++;
}

console.log(`rag:sync — copied 00-DATA.json, 00-TRACKER.json, and ${count} enriched profile(s) into rag/source/`);
console.log(`Next: git add rag/source && git commit && git push to redeploy with the latest enrichments.`);
