import { useEffect, useRef, useState } from 'react'
import { useAsk, type AskMessage } from '../lib/useAsk'
import AnswerCard from './AnswerCard'

interface AskPanelProps {
  /** Optional context that scopes the LLM to a specific business (Layer 4). */
  contextPrefix?: string
  /** Pre-seeded quick questions shown when the panel is empty. */
  suggestions?: string[]
  /** Auto-ask this question once on mount (e.g. from a ?q= param). */
  autoAsk?: string
  placeholder?: string
}

export default function AskPanel({ contextPrefix, suggestions = [], autoAsk, placeholder }: AskPanelProps) {
  const { messages, busy, waiting, ask } = useAsk()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const askedRef = useRef(false)

  useEffect(() => {
    if (autoAsk && !askedRef.current) {
      askedRef.current = true
      ask(autoAsk, { contextPrefix })
    }
  }, [autoAsk, contextPrefix, ask])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, waiting])

  function submit(text: string) {
    if (!text.trim()) return
    ask(text, { contextPrefix })
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-1 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="pt-6">
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border bg-white hover:bg-navy hover:text-white transition-colors"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-soft)' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => <Bubble key={i} m={m} />)}

        {waiting && <Skeleton />}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(input) }} className="flex gap-2 pt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder={busy ? 'Thinking…' : (placeholder ?? 'Ask a question…')}
          className="flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 disabled:opacity-60"
          style={{ borderColor: 'var(--color-border)', background: busy ? '#f9f9f9' : '#fff' }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--color-navy)' }}
        >
          Ask
        </button>
      </form>
    </div>
  )
}

function Bubble({ m }: { m: AskMessage }) {
  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm text-white" style={{ background: 'var(--color-navy)' }}>
          {m.text}
        </div>
      </div>
    )
  }
  if (m.role === 'instant') {
    return <div className="max-w-[92%]"><AnswerCard answer={m.answer} /></div>
  }
  // assistant (LLM)
  return (
    <div className="flex justify-start">
      <div
        className="max-w-[88%] rounded-2xl px-4 py-3 text-sm bg-white border"
        style={{ borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)', color: 'var(--color-ink)' }}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
        {!m.done && <span className="inline-block w-1.5 h-4 ml-0.5 rounded-sm animate-pulse align-middle" style={{ background: 'var(--color-saffron)' }} />}
        {m.citations.length > 0 && (
          <div className="mt-2 pt-2 border-t flex flex-wrap gap-1" style={{ borderColor: 'var(--color-border)' }}>
            {m.citations.map((c) => (
              <span key={c} className="text-xs px-2 py-0.5 rounded border" style={{ background: '#e8f0fe', borderColor: '#c5d4f7', color: 'var(--color-navy)' }}>
                {c}
              </span>
            ))}
          </div>
        )}
        {m.done && m.firstTokenMs != null && (
          <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-ink-faint)' }}>
            first token {(m.firstTokenMs / 1000).toFixed(1)}s · total {((m.totalMs ?? 0) / 1000).toFixed(1)}s
          </p>
        )}
      </div>
    </div>
  )
}

// Skeleton shown between submit and first token so a cold start never feels frozen.
function Skeleton() {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 0.1), 100)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] rounded-2xl px-4 py-3 bg-white border w-72" style={{ borderColor: 'var(--color-border)' }}>
        <p className="text-xs mb-2" style={{ color: 'var(--color-ink-faint)' }}>
          Searching 225 government profiles… {elapsed.toFixed(1)}s
        </p>
        <div className="space-y-2">
          <div className="h-2.5 rounded shimmer" style={{ width: '90%' }} />
          <div className="h-2.5 rounded shimmer" style={{ width: '75%' }} />
          <div className="h-2.5 rounded shimmer" style={{ width: '82%' }} />
        </div>
      </div>
    </div>
  )
}
