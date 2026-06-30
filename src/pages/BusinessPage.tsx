import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { loadProfiles, fmtRs, fmtPct, isSendFirst, type Profile } from '../lib/profiles'
import { zoomIn } from '../lib/motion'
import AskPanel from '../components/AskPanel'

export default function BusinessPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [p, setP] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfiles().then((all) => {
      setP(all.find((x) => x.id === decodeURIComponent(id ?? '')) ?? null)
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-10 text-sm" style={{ color: 'var(--color-ink-faint)' }}>Loading…</div>
  if (!p) return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <p className="text-sm mb-3" style={{ color: 'var(--color-ink-soft)' }}>Business model not found.</p>
      <button onClick={() => navigate('/explore')} className="text-sm underline" style={{ color: 'var(--color-navy)' }}>← Back to explore</button>
    </div>
  )

  const suggestions = [
    `How do I start ${p.product_name}?`,
    `What are the main risks of ${p.product_name}?`,
    `What raw materials and machinery does it need?`,
    `Who buys ${p.product_name} and how do I reach them?`,
  ]
  const context = `The user is looking at this specific PMRY business model. Focus your answer on it:\n` +
    `${p.id} — ${p.product_name} (${p.category}). Capital 2003 ${fmtRs(p.total_capital_investment)}, 2026 ${fmtRs(p.cap_adj)}; ` +
    `turnover ${fmtRs(p.annual_turnover)}; net profit ${fmtRs(p.net_profit)}; RoR ${fmtPct(p.rate_of_return_pct)}; ` +
    `payback ${p.payback_years.toFixed(2)}y; break-even ${fmtPct(p.break_even_pct)}; viability score ${p.combined_score}/100.`

  return (
    <motion.div variants={zoomIn} initial="initial" animate="animate" className="max-w-4xl mx-auto px-4 py-6">
      <button onClick={() => navigate(-1)} className="text-sm mb-4 inline-flex items-center gap-1" style={{ color: 'var(--color-ink-faint)' }}>← Back</button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--color-navy)' }}>{p.product_name}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-ink-faint)' }}>{p.id} · {p.category} · viability {p.combined_score}/100</p>
        </div>
        <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: isSendFirst(p) ? 'var(--color-green-light)' : '#fff3e0', color: isSendFirst(p) ? 'var(--color-green)' : '#e65100' }}>
          {isSendFirst(p) ? '★ SEND-FIRST (easy + high return)' : p.quadrant}
        </span>
      </div>

      {/* Financial snapshot (Layer 3) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Metric label="Capital — 2003" value={fmtRs(p.total_capital_investment)} />
        <Metric label="Capital — 2026 (×4)" value={fmtRs(p.cap_adj)} accent />
        <Metric label="Rate of return" value={fmtPct(p.rate_of_return_pct)} good />
        <Metric label="Payback" value={`${p.payback_years.toFixed(2)} yrs`} />
        <Metric label="Annual turnover" value={fmtRs(p.annual_turnover)} />
        <Metric label="Net profit / yr" value={fmtRs(p.net_profit)} good />
        <Metric label="Net profit ratio" value={fmtPct(p.net_profit_ratio_pct)} />
        <Metric label="Break-even" value={fmtPct(p.break_even_pct)} />
        <Metric label="Ease score" value={`${p.ease_score}/100`} />
      </div>

      {p.notes && (
        <div className="rounded-2xl border bg-white p-4 mb-6 text-sm leading-relaxed" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-soft)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-ink-faint)' }}>Government profile notes</p>
          <p className="whitespace-pre-wrap">{p.notes}</p>
        </div>
      )}

      {/* Scoped ask (Layer 4) */}
      <div className="rounded-2xl border bg-white p-4" style={{ borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-navy)' }}>Ask about {p.product_name}</h2>
        <p className="text-xs mb-3" style={{ color: 'var(--color-ink-faint)' }}>Grounded in the government profile data above.</p>
        <div className="h-[28rem]">
          <AskPanel contextPrefix={context} suggestions={suggestions} placeholder={`Ask about ${p.product_name}…`} />
        </div>
      </div>
    </motion.div>
  )
}

function Metric({ label, value, accent, good }: { label: string; value: string; accent?: boolean; good?: boolean }) {
  return (
    <div className="p-3 rounded-xl border bg-white" style={{ borderColor: 'var(--color-border)' }}>
      <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--color-ink-faint)' }}>{label}</p>
      <p className="font-bold text-base" style={{ color: good ? 'var(--color-green)' : accent ? 'var(--color-saffron-deep, #b45e14)' : 'var(--color-navy)' }}>{value}</p>
    </div>
  )
}
