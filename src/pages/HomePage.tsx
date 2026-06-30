import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const CHIPS = [
  'Cheapest business to start',
  'Fastest payback period',
  'Best food sector business',
  'Under Rs. 5 lakh investment',
  'Electrical sector options',
  'Compare hair brushes vs pressure cooker',
]

interface Profile {
  id: string
  product_name: string
  category: string
  combined_score: number
  cap_adj: number
  rate_of_return_pct: number
  payback_years: number
  quadrant: string
}

function fmtLakh(n: number) {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`
  return `${Math.round(n).toLocaleString('en-IN')}`
}

function QuadrantPill({ q }: { q: string }) {
  const isSend = q.includes('SEND-FIRST')
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{
        background: isSend ? 'var(--color-green-light)' : '#fff3e0',
        color: isSend ? 'var(--color-green)' : '#e65100',
      }}
    >
      {isSend ? 'SEND-FIRST' : q.replace('(easy+high return)', '').trim()}
    </span>
  )
}

export default function HomePage() {
  const [q, setQ] = useState('')
  const [topProfiles, setTopProfiles] = useState<Profile[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/browse?quadrant=SEND-FIRST&sort=combined_score&limit=5')
      .then((r) => r.json())
      .then((d) => setTopProfiles(d.results ?? []))
      .catch(() => {})
  }, [])

  function handleSubmit(question: string) {
    if (!question.trim()) return
    navigate(`/chat?q=${encodeURIComponent(question.trim())}`)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: 'var(--color-navy)' }}>
          225 government business models.
          <br />
          <span style={{ color: 'var(--color-saffron)' }}>One question away.</span>
        </h1>
        <p className="text-base" style={{ color: 'var(--color-ink-soft)' }}>
          Ask anything about starting a business in India — backed by official PMRY/DC(MSME) data.
        </p>
      </div>

      {/* Search box */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSubmit(q) }}
        className="flex gap-2 mb-4"
      >
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. What food business can I start for under Rs. 3 lakh?"
          className="flex-1 px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2"
          style={{
            borderColor: 'var(--color-border)',
            background: '#fff',
            boxShadow: 'var(--shadow-card)',
          }}
        />
        <button
          type="submit"
          className="px-5 py-3 rounded-xl text-white text-sm font-semibold"
          style={{ background: 'var(--color-navy)' }}
        >
          Ask
        </button>
      </form>

      {/* Question chips */}
      <div className="flex flex-wrap gap-2 mb-10">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => handleSubmit(chip)}
            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors hover:bg-navy hover:text-white"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-ink-soft)',
              background: '#fff',
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Top SEND-FIRST profiles */}
      {topProfiles.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-ink-faint)' }}>
            Top recommended profiles
          </h2>
          <div className="flex flex-col gap-3">
            {topProfiles.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSubmit(`Tell me about ${p.product_name} — capital, returns, and viability`)}
                className="text-left p-4 rounded-xl border transition-all hover:shadow-md"
                style={{
                  background: '#fff',
                  borderColor: 'var(--color-border)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-navy)' }}>
                      {p.product_name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>
                      {p.category} &nbsp;·&nbsp; Score {p.combined_score}/100
                    </p>
                  </div>
                  <QuadrantPill q={p.quadrant} />
                </div>
                <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                  <span>Capital: Rs.{fmtLakh(p.cap_adj)} (2026)</span>
                  <span>RoR: {p.rate_of_return_pct?.toFixed(1)}%</span>
                  <span>Payback: {p.payback_years?.toFixed(2)}y</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
