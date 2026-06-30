import { useNavigate } from 'react-router-dom'
import type { InstantAnswer } from '../lib/answerRouter'
import { fmtRs, fmtPct, type Profile } from '../lib/profiles'

// Renders an instant (no-LLM) structured answer: a titled, ranked list of
// business models the user can click straight through to their detail layer.
export default function AnswerCard({ answer }: { answer: InstantAnswer }) {
  const navigate = useNavigate()

  return (
    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--color-green-light)', color: 'var(--color-green)' }}>
          Instant · from govt data
        </span>
      </div>
      <p className="font-semibold text-sm mb-3" style={{ color: 'var(--color-navy)' }}>{answer.title}</p>

      {answer.profiles.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-ink-soft)' }}>{answer.note}</p>
      ) : (
        <ol className="space-y-2">
          {answer.profiles.map((p, i) => (
            <Row key={p.id} p={p} rank={i + 1} onClick={() => navigate(`/business/${encodeURIComponent(p.id)}`)} />
          ))}
        </ol>
      )}

      {answer.profiles.length > 0 && (
        <p className="text-xs mt-3" style={{ color: 'var(--color-ink-faint)' }}>
          {answer.note} · Source: Government of India, DC(MSME) PMRY Project Profiles
        </p>
      )}
    </div>
  )
}

function Row({ p, rank, onClick }: { p: Profile; rank: number; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl border transition-all hover:shadow-sm"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-cream)' }}
      >
        <span className="shrink-0 w-6 h-6 rounded-full grid place-items-center text-xs font-bold text-white" style={{ background: 'var(--color-navy)' }}>
          {rank}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-medium text-sm truncate" style={{ color: 'var(--color-navy)' }}>{p.product_name}</span>
          <span className="block text-xs" style={{ color: 'var(--color-ink-faint)' }}>{p.category} · {p.id}</span>
        </span>
        <span className="hidden sm:flex flex-col items-end text-xs shrink-0" style={{ color: 'var(--color-ink-soft)' }}>
          <span className="font-semibold" style={{ color: 'var(--color-green)' }}>{fmtPct(p.rate_of_return_pct)} RoR</span>
          <span>{fmtRs(p.cap_adj)} · {p.payback_years.toFixed(2)}y</span>
        </span>
      </button>
    </li>
  )
}
