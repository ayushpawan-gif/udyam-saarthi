import { useState, useEffect, useRef } from 'react'

interface Props { productName: string; category: string }

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function MarketResearch({ productName, category }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [text, setText] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [text])

  function startTimer() {
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed((e) => e + 0.1), 100)
  }
  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
  }

  async function research() {
    if (startedRef.current) return
    startedRef.current = true
    setStatus('loading')
    setText('')
    startTimer()
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productName, category }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
          if (data === '[DONE]') { setStatus('done'); continue }
          const chunk = JSON.parse(data)
          if (chunk.text) setText((t) => t + chunk.text)
          if (chunk.error) { setStatus('error'); setText(chunk.error); startedRef.current = false }
        }
      }
    } catch (e) {
      setStatus('error')
      setText(e instanceof Error ? e.message : 'Research failed. Please try again.')
      startedRef.current = false
    } finally {
      stopTimer()
    }
  }

  if (status === 'idle') {
    return (
      <div className="text-center py-8">
        <p className="text-sm mb-4" style={{ color: 'var(--color-ink-soft)' }}>
          Live market intelligence for <strong>{productName}</strong> in 2026 — prices, buyers, competition, export potential.
        </p>
        <button
          onClick={research}
          className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:shadow-md transition-shadow"
          style={{ background: 'var(--color-navy)' }}
        >
          ✦ Run Market Research
        </button>
        <p className="text-[11px] mt-2" style={{ color: 'var(--color-ink-faint)' }}>Uses Anthropic web search · ~10–20s · ~₹4–8 cost</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {status === 'loading' && (
        <div className="rounded-xl border p-3" style={{ borderColor: 'var(--color-border)', background: '#f8fafc' }}>
          <div className="flex items-center gap-2 text-xs mb-2" style={{ color: 'var(--color-ink-faint)' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-saffron)' }} />
            Searching the web for {productName} market data… {elapsed.toFixed(1)}s
          </div>
          <div className="space-y-2">
            <div className="h-2.5 rounded shimmer" style={{ width: '88%' }} />
            <div className="h-2.5 rounded shimmer" style={{ width: '72%' }} />
            <div className="h-2.5 rounded shimmer" style={{ width: '80%' }} />
          </div>
        </div>
      )}

      {text && (
        <div className="rounded-2xl border p-4 text-sm leading-relaxed" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink)' }}>
          {/* Simple markdown-ish rendering: ## headings */}
          {text.split('\n').map((line, i) => {
            if (line.startsWith('## ')) {
              return <p key={i} className="font-semibold text-base mt-4 mb-1 first:mt-0" style={{ color: 'var(--color-navy)' }}>{line.slice(3)}</p>
            }
            if (line.startsWith('**') && line.endsWith('**')) {
              return <p key={i} className="font-semibold mt-2" style={{ color: 'var(--color-ink)' }}>{line.slice(2, -2)}</p>
            }
            if (line.startsWith('- ') || line.startsWith('* ')) {
              return <p key={i} className="ml-3 before:content-['·'] before:mr-2" style={{ color: 'var(--color-ink-soft)' }}>{line.slice(2)}</p>
            }
            if (!line.trim()) return <div key={i} className="h-2" />
            return <p key={i} style={{ color: 'var(--color-ink-soft)' }}>{line}</p>
          })}
          {status === 'loading' && <span className="inline-block w-1.5 h-4 ml-0.5 rounded-sm animate-pulse align-middle" style={{ background: 'var(--color-saffron)' }} />}
        </div>
      )}

      {status === 'error' && !text && (
        <div className="rounded-xl border p-3 text-sm" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#dc2626' }}>
          Research unavailable. The web search feature requires the Anthropic beta. Try again or check your API key.
        </div>
      )}

      {status === 'done' && (
        <p className="text-[11px]" style={{ color: 'var(--color-ink-faint)' }}>
          Research complete · Powered by Anthropic web search · Data may vary; verify before committing capital
        </p>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
