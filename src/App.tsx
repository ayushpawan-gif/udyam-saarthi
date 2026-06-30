import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import BrowsePage from './pages/BrowsePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/browse" element={<BrowsePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
