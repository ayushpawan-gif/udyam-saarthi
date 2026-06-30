import { useLayoutEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Layer 0 — the cinematic entry. A field of 225 opportunity points sits behind
// three pinned scenes; as you scroll, the field zooms toward you (the "digital
// world" of opportunities) and the copy hands you off into /explore.
export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // 225 deterministic dots (seeded so SSR/build is stable — no Math.random).
  const dots = useMemo(() => {
    const out: { x: number; y: number; s: number }[] = []
    let seed = 99173
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    for (let i = 0; i < 225; i++) out.push({ x: rnd() * 100, y: rnd() * 100, s: 0.5 + rnd() * 1.6 })
    return out
  }, [])

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Background field: zoom + drift as the whole page scrolls.
      gsap.to('.dotfield', {
        scale: 2.6,
        opacity: 0.9,
        ease: 'none',
        scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom bottom', scrub: true },
      })

      // Each scene pins and cross-fades its content.
      gsap.utils.toArray<HTMLElement>('.scene').forEach((scene) => {
        const inner = scene.querySelector('.scene-inner')
        gsap.fromTo(
          inner,
          { opacity: 0, y: 40, scale: 0.96 },
          {
            opacity: 1, y: 0, scale: 1, ease: 'power2.out',
            scrollTrigger: { trigger: scene, start: 'top 75%', end: 'top 30%', scrub: true },
          }
        )
        gsap.to(inner, {
          opacity: 0, y: -40, ease: 'power2.in',
          scrollTrigger: { trigger: scene, start: 'bottom 60%', end: 'bottom 20%', scrub: true },
        })
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={root} className="relative" style={{ background: 'var(--color-navy-dark)', color: '#fff' }}>
      {/* Fixed zooming dot-field */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="dotfield absolute inset-0" style={{ transformOrigin: '50% 45%' }}>
          {dots.map((d, i) => (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${d.x}%`, top: `${d.y}%`, width: `${d.s * 3}px`, height: `${d.s * 3}px`,
                background: i % 7 === 0 ? 'var(--color-saffron)' : 'rgba(255,255,255,0.55)',
                boxShadow: i % 7 === 0 ? '0 0 8px var(--color-saffron)' : 'none',
              }}
            />
          ))}
        </div>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 45%, transparent 0%, rgba(21,43,71,0.7) 70%)' }} />
      </div>

      {/* Scene 1 — the hook */}
      <section className="scene relative z-10 min-h-svh grid place-items-center px-6 text-center">
        <div className="scene-inner max-w-2xl">
          <p className="text-sm uppercase tracking-[0.3em] mb-5" style={{ color: 'var(--color-saffron-light)' }}>Udyam Saarthi</p>
          <h1 className="text-4xl sm:text-6xl font-bold leading-tight">
            You want to start a business.
            <br />
            <span style={{ color: 'var(--color-saffron)' }}>India's government already mapped 225 of them.</span>
          </h1>
          <p className="mt-8 text-white/50 text-sm animate-bounce">scroll to enter ↓</p>
        </div>
      </section>

      {/* Scene 2 — what + trust */}
      <section className="scene relative z-10 min-h-svh grid place-items-center px-6 text-center">
        <div className="scene-inner max-w-2xl">
          <h2 className="text-3xl sm:text-5xl font-bold leading-tight">Real, official, ready-to-use.</h2>
          <p className="mt-6 text-lg sm:text-xl text-white/80 leading-relaxed">
            These are the Government of India's own <strong>PMRY / DC(MSME) project profiles</strong> — the capital you need,
            the turnover, the profit, the payback. We scored every one, adjusted the figures to 2026, and made them explorable.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
            {['225 business models', '9 sectors', 'Capital → Profit → Payback', 'Scored & 2026-adjusted'].map((t) => (
              <span key={t} className="px-3 py-1.5 rounded-full border border-white/20 text-white/80">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Scene 3 — the world + CTA */}
      <section className="scene relative z-10 min-h-svh grid place-items-center px-6 text-center">
        <div className="scene-inner max-w-2xl">
          <h2 className="text-3xl sm:text-5xl font-bold leading-tight">
            Find the one that fits <span style={{ color: 'var(--color-saffron)' }}>your money</span>.
          </h2>
          <p className="mt-6 text-lg text-white/80">
            Tell us what you can invest. We'll show you exactly which government-backed businesses you can start — and you can ask anything.
          </p>
          <button
            onClick={() => navigate('/explore')}
            className="mt-10 px-8 py-4 rounded-full text-lg font-semibold transition-transform hover:scale-105"
            style={{ background: 'var(--color-saffron)', color: 'var(--color-navy-dark)' }}
          >
            Find your opportunity →
          </button>
          <div className="mt-6">
            <button onClick={() => navigate('/browse')} className="text-sm text-white/60 underline underline-offset-4 hover:text-white">
              or browse all 225 models
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
