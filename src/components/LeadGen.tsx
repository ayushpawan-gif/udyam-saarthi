import { useState } from 'react'
import type { Profile } from '../lib/profiles'

interface Leads {
  b2b: string[]
  retail: string[]
  export: string[]
  government: string[]
  schemes: string[]
  nextStep: string
}

interface Props { profile: Profile }

const SECTIONS: { key: keyof Omit<Leads, 'nextStep'>; label: string; icon: string; color: string }[] = [
  { key: 'b2b', label: 'B2B Buyers', icon: '🏢', color: '#e8f0fe' },
  { key: 'retail', label: 'Retail Channels', icon: '🛒', color: '#f0fdf4' },
  { key: 'export', label: 'Export Markets', icon: '🌍', color: '#fffbeb' },
  { key: 'government', label: 'Government / GeM', icon: '🏛️', color: '#fdf2f8' },
  { key: 'schemes', label: 'GoI Schemes', icon: '📋', color: '#fff7ed' },
]

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function LeadGen({ profile: p }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [leads, setLeads] = useState<Leads | null>(null)
  const [error, setError] = useState('')

  async function generate() {
    setStatus('loading')
    setLeads(null)
    setError('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productName: p.product_name,
          category: p.category,
          annualTurnover: p.annual_turnover,
          netProfit: p.net_profit,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
      setLeads(data as Leads)
      setStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate leads. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'idle') {
    return (
      <div className="text-center py-8">
        <p className="text-sm mb-4" style={{ color: 'var(--color-ink-soft)' }}>
          Identify specific buyers, channels, and government programs for <strong>{p.product_name}</strong>.
        </p>
        <button
          onClick={generate}
          className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:shadow-md transition-shadow"
          style={{ background: 'var(--color-navy)' }}
        >
          ✦ Find Buyers &amp; Channels
        </button>
        <p className="text-[11px] mt-2" style={{ color: 'var(--color-ink-faint)' }}>Uses Haiku · ~3–5s · ₹0.05 cost</p>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="py-6 space-y-3">
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-ink-faint)' }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-saffron)' }} />
          Identifying buyers and channels…
        </div>
        {[80, 65, 72, 60].map((w, i) => (
          <div key={i} className="h-8 rounded-xl shimmer" style={{ width: `${w}%` }} />
        ))}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="rounded-xl border p-3 text-sm" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#dc2626' }}>
        {error || 'Could not generate buyer list. Please try again.'}
        <button onClick={() => setStatus('idle')} className="block mt-2 text-xs underline" style={{ color: '#dc2626' }}>Try again</button>
      </div>
    )
  }

  if (!leads) return null

  return (
    <div className="space-y-4">
      {/* Next step — always first */}
      <div className="rounded-2xl p-4 border" style={{ background: 'var(--color-cream)', borderColor: 'var(--color-border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-ink-faint)' }}>🎯 Most important first step</p>
        <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--color-navy)' }}>{leads.nextStep}</p>
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECTIONS.map((sec) => {
          const items = leads[sec.key]
          if (!items?.length) return null
          return (
            <div key={sec.key} className="rounded-2xl p-4 border" style={{ background: sec.color, borderColor: 'var(--color-border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-ink-faint)' }}>
                {sec.icon} {sec.label}
              </p>
              <ul className="space-y-1.5">
                {items.map((item, i) => {
                  const [label, ...rest] = item.split(':')
                  const desc = rest.join(':').trim()
                  return (
                    <li key={i} className="text-[13px]">
                      {desc ? (
                        <>
                          <span className="font-semibold" style={{ color: 'var(--color-navy)' }}>{label}</span>
                          {desc && <span style={{ color: 'var(--color-ink-soft)' }}>: {desc}</span>}
                        </>
                      ) : (
                        <span style={{ color: 'var(--color-ink-soft)' }}>{item}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      <p className="text-[11px]" style={{ color: 'var(--color-ink-faint)' }}>
        AI-generated · Verify before outreach · Based on sector knowledge as of 2026
      </p>
    </div>
  )
}
