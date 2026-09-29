import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { StoreProvider } from './lib/store'
import { AuthProvider } from './backend/AuthContext'
import { SubscriptionProvider } from './backend/SubscriptionContext'
import ModeBadge from './components/ModeBadge'
import PreviewBar from './components/PreviewBar'
import RefractFilter from './components/RefractFilter'
import PublicLayout from './pages/public/PublicLayout'
import Home from './pages/public/Home'
import HowItWorks from './pages/public/HowItWorks'
import { EditConfirm, EditHome, EditIssue } from './pages/public/Edit'
import Directory from './pages/public/Directory'
import Creative from './pages/public/Creative'
import Pricing from './pages/public/Pricing'
import SiteLive from './pages/public/SiteLive'
import TeamAccept from './pages/portal/TeamAccept'
import Founding from './pages/public/Founding'
import Join from './pages/public/Join'
import Login from './pages/public/Login'
import Reset from './pages/public/Reset'
import CheckEmail from './pages/public/CheckEmail'
import BookingGone from './pages/public/BookingGone'
import AuthConfirm from './pages/public/AuthConfirm'
import Waitlist from './pages/public/Waitlist'
import Unsubscribe from './pages/public/Unsubscribe'
import Upcoming from './pages/public/Upcoming'
import Legal from './pages/public/Legal'
import { OldDashboard, OldClientDashboard, DocView } from './pages/public/OldLinks'
import Support from './pages/public/Support'
import Onboard from './pages/onboarding/Onboard'
import ClientThread from './pages/portal/ClientThread'
import ClientHome from './pages/portal/ClientHome'
import { RequireCreative, RequireClient } from './components/Guard'
import JobsBoard from './pages/public/JobsBoard'
import BrandPage from './pages/public/BrandPage'
import LeaveReview from './pages/public/LeaveReview'
import Shell from './pages/app/Shell'
import SignLive from './pages/portal/SignLive'
import MeetingLive from './pages/portal/MeetingLive'
import DeliverLive from './pages/portal/DeliverLive'

// Every route in the next LensTrybe. Public site, onboarding, the client portal
// and the creative workspace. Two modes (src/lib/mode.js): demo runs on the sample store with
// nobody signed in; live puts the real Supabase session, profile and plan behind useAuth() and
// useSubscription(), the same contract the live app's pages are written against.
export default function App() {
  return (
    <AuthProvider><SubscriptionProvider><StoreProvider><ToastProvider>
      <RefractFilter />
      <PreviewBar />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/edit" element={<EditHome />} />
          <Route path="/edit/confirm" element={<EditConfirm />} />
          <Route path="/edit/:slug" element={<EditIssue />} />
          <Route path="/the-trybe-edit" element={<Navigate to="/edit" replace />} />
          <Route path="/the-trybe-edit/*" element={<Navigate to="/edit" replace />} />
          <Route path="/trybe-edit" element={<Navigate to="/edit" replace />} />
          <Route path="/jobs" element={<JobsBoard />} />
          <Route path="/jobs/:id" element={<JobsBoard />} />
          <Route path="/creatives" element={<Directory />} />
          <Route path="/creatives/:id" element={<Creative />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/founding" element={<Founding />} />
          <Route path="/join" element={<Join />} />
          <Route path="/join/creative" element={<Join />} />
          <Route path="/join/client" element={<Join />} />
          <Route path="/signup" element={<Navigate to="/join" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<Reset />} />
          <Route path="/reset-password" element={<Reset />} />
          <Route path="/check-email" element={<CheckEmail />} />
          <Route path="/booking-unavailable" element={<BookingGone />} />
          <Route path="/auth/confirm" element={<AuthConfirm />} />
          <Route path="/waitlist" element={<Waitlist />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/unsubscribe/:token" element={<Unsubscribe />} />
          <Route path="/upcoming" element={<Upcoming />} />
          <Route path="/support" element={<Support />} />
          <Route path="/legal/:doc" element={<Legal />} />
          {/* Old site addresses (emails, Revolut, Google) keep working */}
          <Route path="/terms" element={<Navigate to="/legal/terms" replace />} />
          <Route path="/privacy" element={<Navigate to="/legal/privacy" replace />} />
          <Route path="/cookies" element={<Navigate to="/legal/cookies" replace />} />
          <Route path="/refunds" element={<Navigate to="/legal/refunds" replace />} />
          <Route path="/refund-policy" element={<Navigate to="/legal/refunds" replace />} />
          <Route path="/founding-agreement" element={<Navigate to="/legal/founding" replace />} />
        </Route>
        <Route path="/onboarding" element={<Onboard />} />
        <Route path="/portal" element={<RequireClient><ClientHome /></RequireClient>} />
        <Route path="/portal/:slug" element={<ClientThread />} />
        <Route path="/brand/:slug" element={<BrandPage />} />
        <Route path="/review/:slug" element={<LeaveReview />} />
        <Route path="/site/:slug" element={<SiteLive />} />
        <Route path="/team/accept/:token" element={<TeamAccept />} />
        <Route path="/sign/:token" element={<SignLive />} />
        <Route path="/meeting/:token" element={<MeetingLive />} />
        <Route path="/deliver/:token" element={<DeliverLive />} />
        <Route path="/app/*" element={<RequireCreative><Shell /></RequireCreative>} />
        {/* old-site addresses already in people's inboxes */}
        <Route path="/dashboard" element={<OldDashboard />} />
        <Route path="/dashboard/*" element={<OldDashboard />} />
        <Route path="/client-dashboard" element={<OldClientDashboard />} />
        <Route path="/doc/:type/:token" element={<DocView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ModeBadge />
    </ToastProvider></StoreProvider></SubscriptionProvider></AuthProvider>
  )
}
