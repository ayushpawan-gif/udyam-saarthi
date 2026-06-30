import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

interface Message {
  role: 'user' | 'assistant'
  text: string
  citations: string[]
  done: boolean
  feedback?: 'up' | 'down' | null
}

function CitationChip({ title }: { title: string }) {
  return (
    <span
      className="inline-block text-xs px-2 py-0.5 rounded border mr-1 mb-1"
      style={{
        background: '#e8f0fe',
        borderColor: '#c5d4f7',
        color: 'var(--color-navy)',
      }}
    >
      {title}
    </span>
  )
}

export default function ChatPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-ask if ?q= is present in URL
  useEffect(() => {
    const q = params.get('q')
    if (q) {
      navigate('/chat', { replace: true })
      sendQuestion(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendQuestion(question: string) {
    if (!question.trim() || streaming) return
    setStreaming(true)

    const userMsg: Message = { role: 'user', text: question.trim(), citations: [], done: true, feedback: null }
    const assistantMsg: Message = { role: 'assistant', text: '', citations: [], done: false, feedback: null }
    setMessages((prev) => [...prev, userMsg, assistantMsg])

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') {
            setMessages((prev) =>
              prev.map((m, i) => (i === prev.length - 1 ? { ...m, done: true } : m))
            )
            break
          }
          const chunk = JSON.parse(payload)
          if (chunk.text) {
            setMessages((prev) =>
              prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, text: m.text + chunk.text } : m
              )
            )
          }
          if (chunk.citation?.profile) {
            setMessages((prev) =>
              prev.map((m, i) =>
                i === prev.length - 1
                  ? { ...m, citations: [...new Set([...m.citations, chunk.citation.profile])] }
                  : m
              )
            )
          }
        }
      }
    } catch (e) {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, text: m.text + '\n[Error connecting to server. Please try again.]', done: true }
            : m
        )
      )
    } finally {
      setStreaming(false)
    }
  }

  function handleFeedback(idx: number, vote: 'up' | 'down') {
    setMessages((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, feedback: vote } : m))
    )
    // Store thumbs-down for later eval expansion
    if (vote === 'down') {
      const q = messages[idx - 1]?.text ?? ''
      const stored = JSON.parse(localStorage.getItem('udyam_feedback') ?? '[]')
      stored.push({ q, ts: Date.now() })
      localStorage.setItem('udyam_feedback', JSON.stringify(stored.slice(-50)))
    }
  }

  return (
    <div className="flex flex-col h-[calc(100svh-7rem)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 max-w-2xl mx-auto w-full">
        {messages.length === 0 && (
          <div className="text-center pt-16" style={{ color: 'var(--color-ink-faint)' }}>
            <p className="text-lg font-medium mb-2" style={{ color: 'var(--color-navy)' }}>
              Ask about any of the 225 business models
            </p>
            <p className="text-sm">Try: "Which Mechanical sector business has the best return?"</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[85%] rounded-2xl px-4 py-3 text-sm"
              style={
                msg.role === 'user'
                  ? { background: 'var(--color-navy)', color: '#fff' }
                  : { background: '#fff', color: 'var(--color-ink)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }
              }
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              {!msg.done && (
                <span className="inline-block w-1.5 h-4 ml-0.5 rounded-sm animate-pulse" style={{ background: 'var(--color-saffron)' }} />
              )}
              {msg.role === 'assistant' && msg.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-ink-faint)' }}>Sources</p>
                  {msg.citations.map((c) => <CitationChip key={c} title={c} />)}
                </div>
              )}
              {msg.role === 'assistant' && msg.done && (
                <div className="flex gap-2 mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <button
                    onClick={() => handleFeedback(i, 'up')}
                    className={`text-xs px-2 py-0.5 rounded transition-colors ${msg.feedback === 'up' ? 'text-green-700 bg-green-50' : 'hover:bg-gray-50'}`}
                    style={{ color: msg.feedback === 'up' ? undefined : 'var(--color-ink-faint)' }}
                  >
                    👍
                  </button>
                  <button
                    onClick={() => handleFeedback(i, 'down')}
                    className={`text-xs px-2 py-0.5 rounded transition-colors ${msg.feedback === 'down' ? 'text-red-700 bg-red-50' : 'hover:bg-gray-50'}`}
                    style={{ color: msg.feedback === 'down' ? undefined : 'var(--color-ink-faint)' }}
                  >
                    👎
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t px-4 py-3" style={{ borderColor: 'var(--color-border)', background: '#fff' }}>
        <form
          onSubmit={(e) => { e.preventDefault(); sendQuestion(input); setInput('') }}
          className="flex gap-2 max-w-2xl mx-auto"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming}
            placeholder={streaming ? 'Thinking…' : 'Ask a question about MSME business models…'}
            className="flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 disabled:opacity-60"
            style={{ borderColor: 'var(--color-border)', background: streaming ? '#f9f9f9' : '#fff' }}
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--color-navy)' }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
