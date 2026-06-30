import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { loadProfiles, SECTORS, fmtRs, type Profile } from '../lib/profiles'
import { zoomIn } from '../lib/motion'
import OpportunityMap from '../components/OpportunityMap'

type Goal = 'any' | 'fast' | 'safe' | 'high'

// Capital stops (2026-adjusted ₹) for the slider.
const CAP_STOPS = [50_000, 1_00_000, 2_00_000, 5_00_000, 10_00_000, 20_00_000, 50_00_000, 1_00_00_000, Infinity]

export default function ExplorePage() {
  const [all, setAll] = useState<Profile[]>([])
  const [capIdx, setCapIdx] = useState(4) // ₹10L default
  const [sector, setSector] = useState<string>('all')
  const [goal, setGoal] = useState<Goal>('any')

  useEffect(() => { loadProfiles().then(setAll) }, [])

  const maxCap = CAP_STOPS[capIdx]

  const filtered = useMemo(() => {
    let list = all.filter((p) => p.cap_adj <= maxCap)
    if (sector !== 'all') list = list.filter((p) => p.category === sector)
    if (goal === 'fast') list = [...list].sort((a, b) => a.payback_years - b.payback_years)
    else if (goal === 'high') list = [...list].sort((a, b) => (b.rate_of_return_pct ?? 0) - (a.rate_of_return_pct ?? 0))
    else if (goal === 'safe') list = [...list].sort((a, b) => b.ease_score - a.ease_score)
    else list = [...list].sort((a, b) => b.combined_score - a.combined_score)
    return list
  }, [all, maxCap, sector, goal])

  return (
    <motion.div variants={zoomIn} initial="initial" animate="animate" className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-navy)' }}>Your opportunity space</h1>
      <p className="text-sm mb-5" style={{ color: 'var(--color-ink-soft)' }}>
        Set what you can invest. The map updates instantly — tap any dot to go deep.
      </p>

      {/* Situation bar (Layer 1) */}
      <div className="rounded-2xl border bg-white p-4 mb-6" style={{ borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <div className="grid sm:grid-cols-3 gap-5">
          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-ink-faint)' }}>
              I can invest up to
            </label>
            <input
              type="range" min={0} max={CAP_STOPS.length - 1} value={capIdx}
              onChange={(e) => setCapIdx(Number(e.target.value))}
              className="w-full accent-[color:var(--color-saffron)]"
            />
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-navy)' }}>
              {maxCap === Infinity ? 'Any budget' : `up to ${fmtRs(maxCap)}`}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--color-ink-faint)' }}>
              2026-adjusted. PMRY/PMEGP loans can fund much of this.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-ink-faint)' }}>Sector</label>
            <select value={sector} onChange={(e) => setSector(e.target.value)} className="w-full text-sm border rounded-lg px-2 py-2" style={{ borderColor: 'var(--color-border)' }}>
              <option value="all">All sectors</option>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-ink-faint)' }}>My goal</label>
            <div className="grid grid-cols-2 gap-1.5">
              {([['any', 'Best overall'], ['fast', 'Fast payback'], ['high', 'High return'], ['safe', 'Easiest']] as [Goal, string][]).map(([g, label]) => (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${goal === g ? 'text-white' : ''}`}
                  style={goal === g ? { background: 'var(--color-navy)', borderColor: 'var(--color-navy)' } : { borderColor: 'var(--color-border)', color: 'var(--color-ink-soft)' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Opportunity map (Layer 2) */}
      <OpportunityMap profiles={filtered} />

      {/* Top matches as quick cards */}
      {filtered.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-ink-faint)' }}>Your top matches</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.slice(0, 6).map((p) => (
              <a key={p.id} href={`/business/${encodeURIComponent(p.id)}`} className="block p-3 rounded-xl border bg-white hover:shadow-md transition-all" style={{ borderColor: 'var(--color-border)' }}>
                <p className="font-semibold text-sm" style={{ color: 'var(--color-navy)' }}>{p.product_name}</p>
                <p className="text-xs" style={{ color: 'var(--color-ink-faint)' }}>{p.category} · score {p.combined_score}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-ink-soft)' }}>{fmtRs(p.cap_adj)} · {p.payback_years.toFixed(2)}y payback</p>
              </a>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
