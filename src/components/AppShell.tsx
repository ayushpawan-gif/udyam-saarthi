import { Outlet, NavLink } from 'react-router-dom'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
  }`

export default function AppShell() {
  return (
    <div className="min-h-svh flex flex-col" style={{ background: 'var(--color-cream)' }}>
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b"
        style={{ background: 'var(--color-navy)', borderColor: 'var(--color-navy-dark)' }}
      >
        <NavLink to="/" className="flex items-center gap-2">
          <span className="text-white font-semibold text-lg tracking-tight">Udyam Saarthi</span>
          <span className="hidden sm:block text-xs px-2 py-0.5 rounded-full text-white/70 border border-white/20">
            225 govt business models
          </span>
        </NavLink>
        <nav className="flex items-center gap-1">
          <NavLink to="/explore" className={linkClass}>Explore</NavLink>
          <NavLink to="/browse" className={linkClass}>Browse</NavLink>
          <NavLink to="/ask" className={linkClass}>Ask</NavLink>
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="py-3 text-center text-xs" style={{ color: 'var(--color-ink-faint)' }}>
        Source: Government of India, DC(MSME) PMRY Project Profiles · Powered by Claude
      </footer>
    </div>
  )
}
