import { useState, useRef } from 'react'
import type { Profile } from '../lib/profiles'

interface YearRow { year: number; rev: number; profit: number; marginPct: number; cumNet: number }
interface ScenarioSummary { yr5rev: number; yr5profit: number; yr5net: number; payback: number }
interface Model { cap: number; conservative: YearRow[]; base: YearRow[]; optimistic: YearRow[] }

function getMarginPct(p: Profile): number {
  if (p.net_profit_ratio_pct != null) return p.net_profit_ratio_pct
  if (p.annual_turnover > 0) return (p.net_profit / p.annual_turnover) * 100
  return 10
}

function project(baseRev: number, baseMarginPct: number, cap: number, growthRate: number, marginDeltaPct: number): YearRow[] {
  const rows: YearRow[] = []
  let cumProfit = 0
  for (let y = 1; y <= 5; y++) {
    const rev = baseRev * Math.pow(1 + growthRate, y - 1)
    const marginPct = Math.max(1, baseMarginPct + marginDeltaPct * (y - 1))
    const profit = rev * (marginPct / 100)
    cumProfit += profit
    rows.push({ year: y, rev, profit, marginPct, cumNet: cumProfit - cap })
  }
  return rows
}

function paybackYear(rows: YearRow[]): number {
  const yr = rows.findIndex((r) => r.cumNet >= 0)
  return yr === -1 ? Infinity : yr + 1
}

function buildModel(p: Profile): Model {
  const cap = p.cap_adj
  const baseRev = p.annual_turnover
  const baseMarginPct = getMarginPct(p)
  return {
    cap,
    conservative: project(baseRev, baseMarginPct, cap, 0.05, -0.5),
    base: project(baseRev, baseMarginPct, cap, 0.10, 0),
    optimistic: project(baseRev, baseMarginPct, cap, 0.15, 0.5),
  }
}

function summarise(rows: YearRow[]): ScenarioSummary {
  const last = rows[rows.length - 1]
  return { yr5rev: last.rev, yr5profit: last.profit, yr5net: last.cumNet, payback: paybackYear(rows) }
}

const CAP_MULTIPLES = [0.75, 1.0, 1.25, 1.5, 2.0]
const GROWTH_RATES = [0.05, 0.08, 0.10, 0.15, 0.20]

function sensitivityPayback(baseRev: number, baseMarginPct: number, cap: number, g: number): number {
  const rows = project(baseRev, baseMarginPct, cap, g, 0)
  return paybackYear(rows)
}

function pbColor(yr: number) {
  if (!isFinite(yr)) return '#fee2e2'
  if (yr <= 2) return '#dcfce7'
  if (yr <= 4) return '#fef9c3'
  return '#fff7ed'
}

function fmtL(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}
function fmtPb(yr: number) { return isFinite(yr) ? `${yr}yr` : '>10yr' }

function toCSV(model: Model): string {
  const header = ['Scenario', 'Year', 'Revenue (Rs)', 'Profit (Rs)', 'Margin %', 'Cumulative vs Capital (Rs)']
  const rows: string[][] = [header]
  const scenarios = [
    { name: 'Conservative (5%/yr)', data: model.conservative },
    { name: 'Base (10%/yr)', data: model.base },
    { name: 'Optimistic (15%/yr)', data: model.optimistic },
  ]
  for (const s of scenarios) {
    rows.push([s.name, 'Year 0 (Capital)', '0', '0', '0', String(-Math.round(model.cap))])
    for (const r of s.data) {
      rows.push([s.name, `Year ${r.year}`, Math.round(r.rev).toString(), Math.round(r.profit).toString(), r.marginPct.toFixed(1), Math.round(r.cumNet).toString()])
    }
  }
  return rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
}

function downloadCSV(p: Profile, model: Model) {
  const csv = toCSV(model)
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${p.product_name.replace(/\s+/g, '-')}-5yr-model.csv`
  a.click()
  URL.revokeObjectURL(url)
}

interface Props { profile: Profile }

export default function FinancialModel({ profile: p }: Props) {
  const model = buildModel(p)
  const baseMarginPct = getMarginPct(p)
  const summaries = {
    conservative: summarise(model.conservative),
    base: summarise(model.base),
    optimistic: summarise(model.optimistic),
  }

  const [narrating, setNarrating] = useState(false)
  const [narrative, setNarrative] = useState('')
  const narrativeDone = useRef(false)

  async function narrate() {
    if (narrativeDone.current) return
    setNarrating(true)
    setNarrative('')
    const payload = {
      productName: p.product_name,
      category: p.category,
      capAdj: p.cap_adj,
      baseRevenue: p.annual_turnover,
      baseProfit: p.net_profit,
      baseMarginPct,
      scenarios: summaries,
    }
    try {
      const res = await fetch('/api/model', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n\n'); buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') { narrativeDone.current = true; continue }
          const chunk = JSON.parse(data)
          if (chunk.text) setNarrative((t) => t + chunk.text)
        }
      }
    } catch { /* ignore */ }
    finally { setNarrating(false) }
  }

  const SCENARIOS = [
    { key: 'conservative' as const, label: 'Conservative', subLabel: '+5%/yr', color: '#64748b' },
    { key: 'base' as const, label: 'Base', subLabel: '+10%/yr', color: 'var(--color-navy)' },
    { key: 'optimistic' as const, label: 'Optimistic', subLabel: '+15%/yr', color: 'var(--color-green)' },
  ]

  return (
    <div className="space-y-6">
      {/* 5-year P&L table */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-ink-faint)' }}>
          5-Year Revenue &amp; Profit Projection
        </p>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs border-separate" style={{ borderSpacing: 0 }}>
            <thead>
              <tr>
                <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--color-ink-faint)', borderBottom: '1px solid var(--color-border)' }}>Scenario</th>
                {[1, 2, 3, 4, 5].map((y) => (
                  <th key={y} className="text-right px-3 py-2 font-medium" style={{ color: 'var(--color-ink-faint)', borderBottom: '1px solid var(--color-border)' }}>Year {y}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCENARIOS.map((sc) => {
                const rows = model[sc.key]
                return (
                  <>
                    <tr key={sc.key + '-rev'}>
                      <td rowSpan={2} className="px-3 py-2 font-semibold align-top" style={{ color: sc.color, borderBottom: '1px solid var(--color-border)' }}>
                        {sc.label}<br />
                        <span className="font-normal text-[10px]" style={{ color: 'var(--color-ink-faint)' }}>{sc.subLabel}</span>
                      </td>
                      {rows.map((r) => (
                        <td key={r.year + '-rev'} className="text-right px-3 py-1 text-[11px]" style={{ color: 'var(--color-ink-soft)' }}>
                          <span className="block" style={{ color: sc.color }}>{fmtL(r.rev)}</span>
                          <span className="text-[10px]" style={{ color: 'var(--color-ink-faint)' }}>rev</span>
                        </td>
                      ))}
                    </tr>
                    <tr key={sc.key + '-profit'}>
                      {rows.map((r) => (
                        <td key={r.year + '-profit'} className="text-right px-3 py-1 text-[11px]" style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <span className="block font-semibold" style={{ color: r.profit > 0 ? 'var(--color-green)' : '#ef4444' }}>{fmtL(r.profit)}</span>
                          <span className="text-[10px]" style={{ color: r.cumNet >= 0 ? 'var(--color-green)' : 'var(--color-ink-faint)' }}>
                            {r.cumNet >= 0 ? `+${fmtL(r.cumNet)} net` : `${fmtL(r.cumNet)} net`}
                          </span>
                        </td>
                      ))}
                    </tr>
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-ink-faint)' }}>
          Base: 2026-adjusted capital {fmtL(model.cap)} · Year 1 from govt profile · Revenue compounds at scenario rate
        </p>
      </div>

      {/* Payback summary */}
      <div className="grid grid-cols-3 gap-2">
        {SCENARIOS.map((sc) => {
          const pb = paybackYear(model[sc.key])
          return (
            <div key={sc.key} className="p-3 rounded-xl text-center border" style={{ borderColor: 'var(--color-border)', background: pbColor(pb) }}>
              <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--color-ink-faint)' }}>{sc.label}</p>
              <p className="text-lg font-bold" style={{ color: sc.color }}>{fmtPb(pb)}</p>
              <p className="text-[10px]" style={{ color: 'var(--color-ink-faint)' }}>payback</p>
            </div>
          )
        })}
      </div>

      {/* Sensitivity table */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-ink-faint)' }}>
          Payback Sensitivity — Capital Scale × Growth Rate
        </p>
        <div className="overflow-x-auto -mx-1">
          <table className="text-xs border-separate" style={{ borderSpacing: 0 }}>
            <thead>
              <tr>
                <th className="text-left px-3 py-1.5 font-medium" style={{ color: 'var(--color-ink-faint)', borderBottom: '1px solid var(--color-border)' }}>Capital ↓ / Growth →</th>
                {GROWTH_RATES.map((g) => (
                  <th key={g} className="text-center px-2 py-1.5 font-medium" style={{ color: 'var(--color-ink-faint)', borderBottom: '1px solid var(--color-border)' }}>{(g * 100).toFixed(0)}%</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAP_MULTIPLES.map((mult) => {
                const cap = model.cap * mult
                return (
                  <tr key={mult}>
                    <td className="px-3 py-1.5 font-medium text-[11px]" style={{ color: mult === 1 ? 'var(--color-navy)' : 'var(--color-ink-soft)', borderBottom: '1px solid var(--color-border)' }}>
                      {mult === 1 ? '→ ' : ''}{fmtL(cap)} ({mult}×)
                    </td>
                    {GROWTH_RATES.map((g) => {
                      const pb = sensitivityPayback(p.annual_turnover, baseMarginPct, cap, g)
                      return (
                        <td key={g} className="text-center px-2 py-1.5 font-semibold text-[11px] rounded" style={{ background: pbColor(pb), borderBottom: '1px solid var(--color-border)' }}>
                          {fmtPb(pb)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3 mt-2 text-[10px]" style={{ color: 'var(--color-ink-faint)' }}>
          <span style={{ color: '#166534' }}>■ ≤2yr (excellent)</span>
          <span style={{ color: '#854d0e' }}>■ 3–4yr (good)</span>
          <span style={{ color: '#c2410c' }}>■ 5yr+ (review)</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => downloadCSV(p, model)}
          className="px-4 py-2 rounded-xl text-sm font-medium border hover:shadow-sm transition-shadow"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-navy)', background: '#fff' }}
        >
          ↓ Export CSV
        </button>
        <button
          onClick={narrate}
          disabled={narrating || narrativeDone.current}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
          style={{ background: 'var(--color-navy)' }}
        >
          {narrating ? 'Narrating…' : narrativeDone.current ? 'Narration done' : '✦ Narrate this model'}
        </button>
      </div>

      {/* Narrative */}
      {(narrating || narrative) && (
        <div className="rounded-2xl border p-4 text-sm leading-relaxed" style={{ borderColor: 'var(--color-border)', background: '#f8fafc', color: 'var(--color-ink)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-ink-faint)' }}>AI Analysis</p>
          <p className="whitespace-pre-wrap">{narrative}</p>
          {narrating && <span className="inline-block w-1.5 h-4 ml-0.5 rounded-sm animate-pulse align-middle" style={{ background: 'var(--color-saffron)' }} />}
        </div>
      )}
    </div>
  )
}
