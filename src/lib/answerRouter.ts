// Instant deterministic answer router.
// Classifies a question; for structured intents it answers in <1ms from profile
// data with ZERO LLM call. Only open-ended/advisory questions fall through to the LLM.
import type { Profile } from './profiles'
import { SECTORS, fmtRs, fmtPct } from './profiles'

export interface InstantAnswer {
  kind: 'instant'
  intent: 'ranking' | 'capital' | 'sector' | 'lookup' | 'composite'
  title: string
  note?: string
  profiles: Profile[] // matched/ranked set (already trimmed)
}
export interface LlmFallback {
  kind: 'llm'
  reason: string
}
export type RouterResult = InstantAnswer | LlmFallback

type SortKey = 'cheapest' | 'payback' | 'ror' | 'profit' | 'score'

// Markers that demand reasoning/narrative → always send to the LLM.
const ADVICE_RE = /\b(why|should i|is it|which is better|better than|compare|versus|\bvs\b|explain|how do i|how to|pros and cons|risks?|worth it|advice|recommend|suggest|difference between|what if|what are the|tell me how|good or bad)\b/i

// Clearly off-topic (not MSME business models) → let the LLM refuse gracefully.
const OFFTOPIC_RE = /\b(mutual fund|stock|stocks|share market|crypto|bitcoin|weather|poem|cricket|football|movie|song|us stocks|nifty|sensex|sip)\b/i

// ---- Capital parsing ---------------------------------------------------------
// Returns rupee amount from phrases like "5 lakh", "₹5L", "5,00,000", "1 crore".
function parseCapital(q: string): number | null {
  // Strip thousands separators so Indian formatting ("1,00,000") parses.
  const cleaned = q.replace(/(\d),(?=\d)/g, '$1')
  const m = cleaned.match(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(crore|cr|lakhs?|lac|l\b|k\b)?/i)
  if (!m) return null
  const n = parseFloat(m[1])
  const unit = (m[2] ?? '').toLowerCase()
  if (/^cr|crore/.test(unit)) return n * 1_00_00_000
  if (/^l|lakh|lac/.test(unit)) return n * 1_00_000
  if (/^k/.test(unit)) return n * 1_000
  // bare number: only treat as capital if it's plausibly a rupee amount
  if (n >= 10_000) return n
  return null
}

function detectSector(q: string): string | null {
  const lower = q.toLowerCase()
  // direct sector-name hits
  for (const s of SECTORS) {
    if (lower.includes(s.toLowerCase())) return s
  }
  // common synonyms → canonical sector (mapped to the nine real categories)
  const syn: Record<string, string> = {
    electronic: 'IT & Electronics', electronics: 'IT & Electronics', software: 'IT & Electronics', computer: 'IT & Electronics',
    leather: 'Leather & Sports', sports: 'Leather & Sports', sport: 'Leather & Sports',
    metallurgy: 'Metallurgical', metal: 'Metallurgical', alloy: 'Metallurgical', casting: 'Metallurgical',
    engineering: 'Mechanical', machine: 'Mechanical', fabrication: 'Mechanical',
    eatable: 'Food', snack: 'Food', bakery: 'Food', edible: 'Food', spice: 'Food',
    soap: 'Chemical', cosmetic: 'Chemical', paint: 'Chemical', chemicals: 'Chemical',
    glass: 'Glass & Ceramics', ceramic: 'Glass & Ceramics', ceramics: 'Glass & Ceramics', pottery: 'Glass & Ceramics', tiles: 'Glass & Ceramics',
    hosiery: 'Hosiery', garment: 'Hosiery', textile: 'Hosiery', knitting: 'Hosiery', knitted: 'Hosiery',
  }
  for (const [k, v] of Object.entries(syn)) {
    if (new RegExp(`\\b${k}\\b`).test(lower)) return v
  }
  return null
}

function detectSort(q: string): SortKey | null {
  const l = q.toLowerCase()
  if (/\b(cheap|cheapest|lowest capital|least (investment|capital)|smallest (investment|capital)|low cost|low investment|minimum (investment|capital))\b/.test(l)) return 'cheapest'
  if (/\b(fast(est)? payback|quick(est)? (payback|return)|payback|recover|break even fast)\b/.test(l)) return 'payback'
  if (/\b(highest return|best return|rate of return|\bror\b|most return|return on investment|\broi\b)\b/.test(l)) return 'ror'
  if (/\b(most profit|highest profit|profitable|biggest profit|max profit)\b/.test(l)) return 'profit'
  if (/\b(best|top|highest score|best score|highest rated|most viable|recommended)\b/.test(l)) return 'score'
  return null
}

function applySort(list: Profile[], key: SortKey): Profile[] {
  const by: Record<SortKey, (a: Profile, b: Profile) => number> = {
    cheapest: (a, b) => a.cap_adj - b.cap_adj,
    payback: (a, b) => a.payback_years - b.payback_years,
    ror: (a, b) => (b.rate_of_return_pct ?? 0) - (a.rate_of_return_pct ?? 0),
    profit: (a, b) => b.net_profit - a.net_profit,
    score: (a, b) => b.combined_score - a.combined_score,
  }
  return [...list].sort(by[key])
}

const SORT_LABEL: Record<SortKey, string> = {
  cheapest: 'lowest capital (2026-adjusted)',
  payback: 'fastest payback',
  ror: 'highest rate of return',
  profit: 'highest net profit',
  score: 'best overall viability score',
}

// "I have X" / "budget X" → band around X; "under X" → ceiling.
function detectCapitalMode(q: string): 'under' | 'have' | null {
  const l = q.toLowerCase()
  if (/\b(under|below|less than|upto|up to|within|max|maximum|cheaper than)\b/.test(l)) return 'under'
  if (/\b(i have|i've got|budget|with|invest|capital of|around|about)\b/.test(l)) return 'have'
  return null
}

/**
 * Classify a question. Returns an instant structured answer when the question
 * is a ranking / capital filter / sector filter / composite of those, else 'llm'.
 */
export function route(question: string, profiles: Profile[]): RouterResult {
  const q = question.trim()
  if (!q || profiles.length === 0) return { kind: 'llm', reason: 'empty or no data' }

  // Reasoning/advice/comparison and off-topic queries go to the LLM.
  if (ADVICE_RE.test(q)) return { kind: 'llm', reason: 'advisory/comparison' }
  if (OFFTOPIC_RE.test(q)) return { kind: 'llm', reason: 'off-topic' }

  // Profile-name lookup FIRST — so a product named "Computer Furniture" or
  // "Leather Garment" isn't misread as a sector query by the synonym matcher.
  const named = findSingleProfile(q, profiles)
  if (named) return { kind: 'instant', intent: 'lookup', title: named.product_name, profiles: [named] }

  const sector = detectSector(q)
  let sort = detectSort(q)
  const capital = parseCapital(q)
  const capMode = capital != null ? (detectCapitalMode(q) ?? 'under') : null

  // The generic "best/top" (score) signal is weak — only honour it as a ranking
  // when there's MSME context, so "best mutual fund" doesn't get a business list.
  const BUSINESS_CTX = /\b(business|model|sector|start|invest|venture|manufactur|profile|opportunit|scheme|pmry|msme)/i
  if (sort === 'score' && !sector && capital == null && !BUSINESS_CTX.test(q)) {
    sort = null
  }

  const hasStructured = !!sector || !!sort || capital != null
  if (!hasStructured) {
    return { kind: 'llm', reason: 'open-ended' }
  }

  // Compose filters then sort.
  let list = profiles
  const notes: string[] = []

  if (sector) {
    list = list.filter((p) => p.category === sector)
    notes.push(`sector: ${sector}`)
  }
  if (capital != null) {
    // Both "under ₹X" and "I have ₹X" mean: businesses I can afford within that budget.
    list = list.filter((p) => p.cap_adj <= capital)
    notes.push(capMode === 'have' ? `within ${fmtRs(capital)} budget` : `capital under ${fmtRs(capital)}`)
  }

  const sortKey: SortKey = sort ?? (capital != null ? 'cheapest' : 'score')
  list = applySort(list, sortKey)

  const intent: InstantAnswer['intent'] =
    sector && (capital != null || sort) ? 'composite' : capital != null ? 'capital' : sector ? 'sector' : 'ranking'

  const top = list.slice(0, 5)
  const title =
    top.length === 0
      ? 'No matching business models'
      : intent === 'ranking'
        ? `Ranked by ${SORT_LABEL[sortKey]}`
        : `${list.length} matching ${list.length === 1 ? 'model' : 'models'}${notes.length ? ` — ${notes.join(', ')}` : ''}`

  const note =
    top.length === 0
      ? `No PMRY profiles match ${notes.join(' + ')}. Try a higher budget or a different sector.`
      : `Sorted by ${SORT_LABEL[sortKey]}. Showing ${top.length} of ${list.length}.`

  return { kind: 'instant', intent, title, note, profiles: top }
}

// Normalize for name matching: drop punctuation ("M.S." → "m s"), collapse spaces.
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

// Match when the question is basically just one profile's name (lookup-like).
function findSingleProfile(q: string, profiles: Profile[]): Profile | null {
  const stripped = q.toLowerCase().replace(/\b(tell me about|what is|details? (of|on|about)?|profile of|info on|show me)\b/g, '')
  const l = norm(stripped)
  if (l.length < 4) return null

  // 1) Exact (punctuation-insensitive) name match wins.
  const exact = profiles.filter((p) => norm(p.product_name) === l)
  if (exact.length >= 1) return exact[0]

  // 2) Containment, but the matched name must cover most of the query (so a long
  //    advisory sentence doesn't match a short product name buried inside it).
  const matches = profiles.filter((p) => {
    const name = norm(p.product_name)
    if (l.includes(name) && name.length / l.length >= 0.7) return true
    if (name.includes(l) && l.length / name.length >= 0.7) return true
    return false
  })
  return matches.length === 1 ? matches[0] : null
}

// Render an instant answer to plain text (used by the benchmark + as a fallback).
export function instantToText(a: InstantAnswer): string {
  if (a.profiles.length === 0) return a.note ?? a.title
  const rows = a.profiles
    .map((p, i) =>
      `${i + 1}. ${p.product_name} (${p.id}, ${p.category}) — capital ${fmtRs(p.cap_adj)} (2026), RoR ${fmtPct(p.rate_of_return_pct)}, payback ${p.payback_years.toFixed(2)}y, score ${p.combined_score}/100`)
    .join('\n')
  return `${a.title}\n${rows}\n\nSource: Government of India, DC(MSME) PMRY Project Profiles`
}
