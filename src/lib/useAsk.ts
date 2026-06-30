// useAsk — shared ask/answer engine for every chat surface in the app.
// Routes structured questions to an INSTANT data answer (no network, no LLM);
// open-ended questions stream from /api/ask with a skeleton until first token.
import { useCallback, useRef, useState } from 'react'
import { loadProfiles, type Profile } from './profiles'
import { route, type InstantAnswer } from './answerRouter'

export type AskMessage =
  | { role: 'user'; text: string }
  | { role: 'instant'; answer: InstantAnswer }
  | {
      role: 'assistant'
      text: string
      citations: string[]
      done: boolean
      firstTokenMs?: number
      totalMs?: number
      error?: boolean
    }

export interface AskOptions {
  /** Extra system context appended to the question (e.g. "Focus on the business: Hair Brushes"). */
  contextPrefix?: string
  /** If set, the instant router is bypassed and everything goes to the LLM. */
  forceLlm?: boolean
}

export function useAsk() {
  const [messages, setMessages] = useState<AskMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(false) // true between submit and first token (skeleton)
  const profilesRef = useRef<Profile[] | null>(null)

  const ask = useCallback(async (question: string, opts: AskOptions = {}) => {
    const q = question.trim()
    if (!q || busy) return
    setBusy(true)

    setMessages((prev) => [...prev, { role: 'user', text: q }])

    // Ensure profiles are loaded (cached after first call).
    if (!profilesRef.current) profilesRef.current = await loadProfiles()
    const profiles = profilesRef.current

    // 1) Try the instant router.
    if (!opts.forceLlm) {
      const r = route(q, profiles)
      if (r.kind === 'instant') {
        setMessages((prev) => [...prev, { role: 'instant', answer: r }])
        setBusy(false)
        return
      }
    }

    // 2) Open-ended → stream from the LLM, with a skeleton until first token.
    setWaiting(true)
    const start = performance.now()
    let firstTokenMs: number | undefined
    setMessages((prev) => [...prev, { role: 'assistant', text: '', citations: [], done: false }])

    const payload = opts.contextPrefix ? `${opts.contextPrefix}\n\nQuestion: ${q}` : q

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: payload }),
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') {
            setMessages((prev) => patchLast(prev, (m) => ({ ...m, done: true, totalMs: performance.now() - start })))
            continue
          }
          const chunk = JSON.parse(data)
          if (chunk.text) {
            if (firstTokenMs === undefined) {
              firstTokenMs = performance.now() - start
              setWaiting(false)
            }
            const ft = firstTokenMs
            setMessages((prev) => patchLast(prev, (m) => ({ ...m, text: m.text + chunk.text, firstTokenMs: ft })))
          }
          if (chunk.citation?.profile) {
            setMessages((prev) =>
              patchLast(prev, (m) => ({ ...m, citations: [...new Set([...m.citations, chunk.citation.profile])] }))
            )
          }
        }
      }
    } catch {
      setMessages((prev) =>
        patchLast(prev, (m) => ({ ...m, text: m.text + '\n[Connection error. Please try again.]', done: true, error: true }))
      )
    } finally {
      setWaiting(false)
      setBusy(false)
    }
  }, [busy])

  const reset = useCallback(() => setMessages([]), [])

  return { messages, busy, waiting, ask, reset }
}

// Patch the last assistant message immutably.
function patchLast(
  prev: AskMessage[],
  fn: (m: Extract<AskMessage, { role: 'assistant' }>) => Extract<AskMessage, { role: 'assistant' }>
): AskMessage[] {
  const out = prev.slice()
  for (let i = out.length - 1; i >= 0; i--) {
    const m = out[i]
    if (m.role === 'assistant') {
      out[i] = fn(m)
      break
    }
  }
  return out
}
