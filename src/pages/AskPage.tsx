import { useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { zoomIn } from '../lib/motion'
import AskPanel from '../components/AskPanel'

const SUGGESTIONS = [
  'Cheapest business to start',
  'Fastest payback period',
  'Best food sector business',
  'Businesses under ₹5 lakh',
  'Highest return in electrical',
  'Which has the best viability score?',
]

export default function AskPage() {
  const [params] = useSearchParams()
  const autoAsk = params.get('q') ?? undefined

  return (
    <motion.div variants={zoomIn} initial="initial" animate="animate" className="max-w-2xl mx-auto px-4 py-6 h-[calc(100svh-7rem)] flex flex-col">
      <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-navy)' }}>Ask anything</h1>
      <p className="text-sm mb-3" style={{ color: 'var(--color-ink-soft)' }}>
        Structured questions answer instantly from government data. Open questions stream a grounded, cited answer.
      </p>
      <div className="flex-1 min-h-0">
        <AskPanel autoAsk={autoAsk} suggestions={SUGGESTIONS} placeholder="e.g. cheapest food business under ₹3 lakh" />
      </div>
    </motion.div>
  )
}
