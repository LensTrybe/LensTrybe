import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { StoreProvider } from './lib/store'
import RefractFilter from './components/RefractFilter'
import PublicLayout from './pages/public/PublicLayout'
import Home from './pages/public/Home'
import HowItWorks from './pages/public/HowItWorks'
import { EditHome, EditIssue } from './pages/public/Edit'
import Directory from './pages/public/Directory'
import Creative from './pages/public/Creative'
import Pricing from './pages/public/Pricing'
import Founding from './pages/public/Founding'
import Join from './pages/public/Join'
import Login from './pages/public/Login'
import Upcoming from './pages/public/Upcoming'
import Legal from './pages/public/Legal'
import Support from './pages/public/Support'
import Onboard from './pages/onboarding/Onboard'
import ClientThread from './pages/portal/ClientThread'
import JobsBoard from './pages/public/JobsBoard'
import BrandPage from './pages/public/BrandPage'
import LeaveReview from './pages/public/LeaveReview'
import Shell from './pages/app/Shell'

// Every route in the next LensTrybe. Public site, onboarding, the client portal
// and the creative workspace. Demo mode: no backend, sample data throughout.
export default function App() {
  return (
    <StoreProvider><ToastProvider>
      <RefractFilter />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/edit" element={<EditHome />} />
          <Route path="/edit/:slug" element={<EditIssue />} />
          <Route path="/jobs" element={<JobsBoard />} />
          <Route path="/jobs/:id" element={<JobsBoard />} />
          <Route path="/creatives" element={<Directory />} />
          <Route path="/creatives/:id" element={<Creative />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/founding" element={<Founding />} />
          <Route path="/join" element={<Join />} />
          <Route path="/login" element={<Login />} />
          <Route path="/upcoming" element={<Upcoming />} />
          <Route path="/support" element={<Support />} />
          <Route path="/legal/:doc" element={<Legal />} />
        </Route>
        <Route path="/onboarding" element={<Onboard />} />
        <Route path="/portal/:slug" element={<ClientThread />} />
        <Route path="/brand/:slug" element={<BrandPage />} />
        <Route path="/review/:slug" element={<LeaveReview />} />
        <Route path="/app/*" element={<Shell />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider></StoreProvider>
  )
}
