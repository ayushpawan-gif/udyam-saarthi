// Typed client access to the 225 PMRY/DC(MSME) profiles.
// Fetched once from /profiles.json (emitted by rag:build) and cached in memory.

export interface Profile {
  id: string
  product_name: string
  category: string
  product_code?: string
  year_prepared?: string
  total_capital_investment: number
  cap_adj: number
  annual_turnover: number
  net_profit: number
  profit_adj: number
  net_profit_ratio_pct: number | null
  rate_of_return_pct: number | null
  payback_years: number
  break_even_pct: number
  ease_score: number
  return_score: number
  combined_score: number
  quadrant: string
  notes?: string
}

// The nine real DC(MSME) categories present in the data (25 profiles each).
export const SECTORS = [
  'Chemical', 'Electrical', 'Food', 'Glass & Ceramics', 'Hosiery',
  'IT & Electronics', 'Leather & Sports', 'Mechanical', 'Metallurgical',
] as const

let cache: Profile[] | null = null
let inflight: Promise<Profile[]> | null = null

/** Load all 225 profiles once; subsequent calls return the in-memory cache. */
export async function loadProfiles(): Promise<Profile[]> {
  if (cache) return cache
  if (inflight) return inflight
  inflight = fetch('/profiles.json')
    .then((r) => r.json())
    .then((data: Profile[]) => {
      cache = data
      inflight = null
      return data
    })
  return inflight
}

/** Synchronous accessor — returns [] until loadProfiles() has resolved once. */
export function getCached(): Profile[] {
  return cache ?? []
}

// ---- Formatting helpers (shared across the app) ----

export function fmtRs(n: number | null | undefined): string {
  if (n == null) return 'N/A'
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

export function fmtPct(n: number | null | undefined): string {
  return n == null ? 'N/A' : `${n.toFixed(1)}%`
}

export function isSendFirst(p: Profile): boolean {
  return p.quadrant.includes('SEND-FIRST')
}
