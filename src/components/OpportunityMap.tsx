import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { fmtRs, fmtPct, type Profile } from '../lib/profiles'

const SECTOR_COLOR: Record<string, string> = {
  Chemical: '#e11d48', Electrical: '#f6921e', Food: '#2d7a4f', 'IT & Electronics': '#2563eb',
  'Leather & Sports': '#7c3aed', Mechanical: '#0891b2', Others: '#64748b', Paper: '#ca8a04', Polymer: '#db2777',
}

// Layer 2 — the opportunity space. Each business is a dot positioned by capital
// (x, log) and rate-of-return (y). Top-left = cheap + high return = the sweet spot.
export default function OpportunityMap({ profiles }: { profiles: Profile[] }) {
  const navigate = useNavigate()
  const [hover, setHover] = useState<Profile | null>(null)

  const { points, maxCap, minCap } = useMemo(() => {
    const caps = profiles.map((p) => p.cap_adj).filter((c) => c > 0)
    const minCap = Math.min(...caps, 1)
    const maxCap = Math.max(...caps, 1)
    const maxRor = Math.max(...profiles.map((p) => p.rate_of_return_pct ?? 0), 1)
    const lMin = Math.log(minCap), lMax = Math.log(maxCap)
    const points = profiles.map((p) => {
      const x = lMax > lMin ? (Math.log(Math.max(p.cap_adj, 1)) - lMin) / (lMax - lMin) : 0.5
      const y = (p.rate_of_return_pct ?? 0) / maxRor
      return { p, x: 6 + x * 88, y: 92 - y * 84 } // % positions with padding
    })
    return { points, maxCap, minCap }
  }, [profiles])

  if (profiles.length === 0) {
    return (
      <div className="grid place-items-center h-80 rounded-2xl border" style={{ borderColor: 'var(--color-border)', background: '#fff' }}>
        <p className="text-sm" style={{ color: 'var(--color-ink-faint)' }}>No business models match your situation. Widen your budget or sector.</p>
      </div>
    )
  }

  return (
    <div>
      <div
        className="relative w-full rounded-2xl border overflow-hidden"
        style={{ aspectRatio: '16 / 10', background: 'linear-gradient(135deg,#f8fafc, #eef2f7)', borderColor: 'var(--color-border)' }}
      >
        {/* sweet-spot highlight (low capital, high return) */}
        <div className="absolute" style={{ left: '4%', top: '4%', width: '40%', height: '40%', background: 'rgba(45,122,79,0.07)', borderRadius: 16 }} />
        <div className="absolute text-[10px] font-semibold" style={{ left: '5%', top: '5%', color: 'var(--color-green)' }}>★ sweet spot — cheap + high return</div>

        {/* axis labels */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px]" style={{ color: 'var(--color-ink-faint)' }}>
          capital needed → ({fmtRs(minCap)} … {fmtRs(maxCap)})
        </div>
        <div className="absolute top-1/2 left-1 -translate-y-1/2 -rotate-90 origin-left text-[10px] whitespace-nowrap" style={{ color: 'var(--color-ink-faint)' }}>
          rate of return →
        </div>

        {points.map(({ p, x, y }, i) => {
          const size = 7 + (p.combined_score / 100) * 16
          return (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 0.85, scale: 1 }}
              transition={{ delay: Math.min(i * 0.004, 0.6), duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.6, opacity: 1, zIndex: 20 }}
              onHoverStart={() => setHover(p)}
              onHoverEnd={() => setHover((h) => (h?.id === p.id ? null : h))}
              onClick={() => navigate(`/business/${encodeURIComponent(p.id)}`)}
              className="absolute rounded-full cursor-pointer"
              style={{
                left: `${x}%`, top: `${y}%`, width: size, height: size, transform: 'translate(-50%,-50%)',
                background: SECTOR_COLOR[p.category] ?? '#64748b',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              }}
              aria-label={p.product_name}
            />
          )
        })}

        {hover && (
          <div className="absolute top-2 right-2 max-w-[55%] rounded-xl border bg-white/95 backdrop-blur px-3 py-2 text-left pointer-events-none" style={{ borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
            <p className="font-semibold text-xs" style={{ color: 'var(--color-navy)' }}>{hover.product_name}</p>
            <p className="text-[11px]" style={{ color: 'var(--color-ink-faint)' }}>{hover.category} · {hover.id}</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-ink-soft)' }}>
              {fmtRs(hover.cap_adj)} · {fmtPct(hover.rate_of_return_pct)} RoR · {hover.payback_years.toFixed(2)}y · score {hover.combined_score}
            </p>
          </div>
        )}
      </div>

      {/* sector legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px]">
        {Object.entries(SECTOR_COLOR).map(([s, c]) => (
          <span key={s} className="inline-flex items-center gap-1.5" style={{ color: 'var(--color-ink-soft)' }}>
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: c }} />{s}
          </span>
        ))}
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--color-ink-faint)' }}>
        {profiles.length} business{profiles.length === 1 ? '' : 'es'} match · dot size = viability score · tap any dot to open it
      </p>
    </div>
  )
}
