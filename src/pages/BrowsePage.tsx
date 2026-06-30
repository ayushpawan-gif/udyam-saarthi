import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

interface Profile {
  id: string
  product_name: string
  category: string
  quadrant: string
  combined_score: number
  cap_adj: number
  rate_of_return_pct: number
  payback_years: number
  break_even_pct: number
  annual_turnover: number
  net_profit: number
  net_profit_ratio_pct: number
  total_capital_investment: number
  ease_score: number
  return_score: number
}

const SECTORS = ['Chemical', 'Electrical', 'Food', 'IT & Electronics', 'Leather & Sports', 'Mechanical', 'Others', 'Paper', 'Polymer']
const SORTS = [
  { value: 'combined_score', label: 'Best score' },
  { value: 'payback', label: 'Fastest payback' },
  { value: 'ror', label: 'Highest RoR' },
  { value: 'capital', label: 'Lowest capital' },
]

function fmtLakh(n: number) {
  if (!n) return 'N/A'
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`
  return `${Math.round(n).toLocaleString('en-IN')}`
}

function QuadrantPill({ q }: { q: string }) {
  const isSend = q.includes('SEND-FIRST')
  const isLow = q.includes('Lower')
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-medium"
      style={{
        background: isSend ? 'var(--color-green-light)' : isLow ? '#f3f4f6' : '#fff3e0',
        color: isSend ? 'var(--color-green)' : isLow ? '#6b7280' : '#e65100',
      }}
    >
      {isSend ? 'SEND-FIRST' : isLow ? 'Lower priority' : 'Review'}
    </span>
  )
}

function ProfileModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[80svh] overflow-y-auto"
        style={{ boxShadow: 'var(--shadow-card-hover)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-navy)' }}>{profile.product_name}</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>{profile.id} &nbsp;·&nbsp; {profile.category}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="mb-3"><QuadrantPill q={profile.quadrant} /></div>

        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div className="p-3 rounded-xl" style={{ background: 'var(--color-cream)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-ink-faint)' }}>Capital (2003)</p>
            <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>Rs.{fmtLakh(profile.total_capital_investment)}</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'var(--color-cream)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-ink-faint)' }}>Capital (2026 ×4)</p>
            <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>Rs.{fmtLakh(profile.cap_adj)}</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'var(--color-cream)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-ink-faint)' }}>Rate of Return</p>
            <p className="font-semibold" style={{ color: 'var(--color-green)' }}>{profile.rate_of_return_pct?.toFixed(1)}%</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'var(--color-cream)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-ink-faint)' }}>Payback Period</p>
            <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>{profile.payback_years?.toFixed(2)} years</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'var(--color-cream)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-ink-faint)' }}>Annual Turnover</p>
            <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>Rs.{fmtLakh(profile.annual_turnover)}</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'var(--color-cream)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-ink-faint)' }}>Break-Even</p>
            <p className="font-semibold" style={{ color: 'var(--color-navy)' }}>{profile.break_even_pct?.toFixed(1)}%</p>
          </div>
        </div>

        <div className="flex gap-2 text-xs mb-4" style={{ color: 'var(--color-ink-faint)' }}>
          <span>Score: {profile.combined_score}/100</span>
          <span>·</span>
          <span>Ease: {profile.ease_score}/100</span>
          <span>·</span>
          <span>Return: {profile.return_score}/100</span>
        </div>

        <button
          onClick={() => navigate(`/chat?q=${encodeURIComponent(`Tell me about ${profile.product_name} — capital, returns, and market context`)}`)}
          className="w-full py-2.5 rounded-xl text-white text-sm font-semibold"
          style={{ background: 'var(--color-navy)' }}
        >
          Ask about this business →
        </button>
      </div>
    </div>
  )
}

export default function BrowsePage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Profile | null>(null)

  const [sectors, setSectors] = useState<string[]>([])
  const [sort, setSort] = useState('combined_score')
  const [maxCap, setMaxCap] = useState<number | null>(null)
  const [q, setQ] = useState('')

  const fetch_profiles = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ sort, limit: '225' })
    if (sectors.length === 1) params.set('sector', sectors[0])
    if (maxCap) params.set('maxCap', String(maxCap))
    if (q.trim()) params.set('q', q.trim())
    try {
      const res = await fetch(`/api/browse?${params}`)
      const data = await res.json()
      setProfiles(data.results ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [sectors, sort, maxCap, q])

  useEffect(() => { fetch_profiles() }, [fetch_profiles])

  function toggleSector(s: string) {
    setSectors((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
      {/* Sidebar */}
      <aside className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-20 space-y-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-ink-faint)' }}>Sector</h3>
            <div className="space-y-1">
              {SECTORS.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={sectors.includes(s)} onChange={() => toggleSector(s)} className="rounded" />
                  <span style={{ color: 'var(--color-ink-soft)' }}>{s}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-ink-faint)' }}>Max Capital (2026)</h3>
            <select
              value={maxCap ?? ''}
              onChange={(e) => setMaxCap(e.target.value ? Number(e.target.value) : null)}
              className="w-full text-sm border rounded-lg px-2 py-1.5"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-soft)' }}
            >
              <option value="">Any</option>
              <option value="500000">Up to Rs. 5L</option>
              <option value="1000000">Up to Rs. 10L</option>
              <option value="2000000">Up to Rs. 20L</option>
              <option value="5000000">Up to Rs. 50L</option>
            </select>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-ink-faint)' }}>Sort by</h3>
            {SORTS.map((s) => (
              <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer mb-1">
                <input type="radio" name="sort" value={s.value} checked={sort === s.value} onChange={() => setSort(s.value)} />
                <span style={{ color: 'var(--color-ink-soft)' }}>{s.label}</span>
              </label>
            ))}
          </div>
        </div>
      </aside>

      {/* Main grid */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            className="flex-1 px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2"
            style={{ borderColor: 'var(--color-border)' }}
          />
          <span className="text-sm whitespace-nowrap" style={{ color: 'var(--color-ink-faint)' }}>
            {loading ? 'Loading…' : `${total} profiles`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="text-left p-4 rounded-xl border transition-all hover:shadow-md"
              style={{ background: '#fff', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--color-navy)' }}>
                  {p.product_name}
                </p>
                <QuadrantPill q={p.quadrant} />
              </div>
              <p className="text-xs mb-2" style={{ color: 'var(--color-ink-faint)' }}>{p.category}</p>
              <div className="flex gap-3 text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                <span className="font-medium" style={{ color: 'var(--color-green)' }}>{p.rate_of_return_pct?.toFixed(0)}% RoR</span>
                <span>{p.payback_years?.toFixed(2)}y payback</span>
                <span>Rs.{fmtLakh(p.cap_adj)}</span>
              </div>
              <div className="mt-2 h-1 rounded-full bg-gray-100">
                <div
                  className="h-1 rounded-full"
                  style={{ width: `${p.combined_score}%`, background: 'var(--color-saffron)' }}
                />
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--color-ink-faint)' }}>Score {p.combined_score}/100</p>
            </button>
          ))}
        </div>
      </div>

      {selected && <ProfileModal profile={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
