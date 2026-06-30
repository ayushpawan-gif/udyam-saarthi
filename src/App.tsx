import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import ExplorePage from './pages/ExplorePage'
import BusinessPage from './pages/BusinessPage'
import BrowsePage from './pages/BrowsePage'
import AskPage from './pages/AskPage'

// GSAP-heavy cinematic landing — lazy so it never bloats the rest of the app.
const LandingPage = lazy(() => import('./pages/LandingPage'))

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Full-bleed cinematic landing — no shell */}
        <Route
          path="/"
          element={
            <Suspense fallback={<div className="min-h-svh" style={{ background: 'var(--color-navy-dark)' }} />}>
              <LandingPage />
            </Suspense>
          }
        />
        {/* Experience layers — slim shell */}
        <Route element={<AppShell />}>
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/business/:id" element={<BusinessPage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/ask" element={<AskPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
