import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { StoreProvider } from './lib/store'
import { AuthProvider } from './backend/AuthContext'
import { SubscriptionProvider } from './backend/SubscriptionContext'
import PreviewBar from './components/PreviewBar'
import { RouteSeo } from './lib/seo'
import RefractFilter from './components/RefractFilter'
import PublicLayout from './pages/public/PublicLayout'
import Home from './pages/public/Home'
import HowItWorks from './pages/public/HowItWorks'
import { EditConfirm, EditHome, EditIssue } from './pages/public/Edit'
import { BlogHub, BlogPost } from './pages/public/Blog'
import Local from './pages/public/Local'
import Directory from './pages/public/Directory'
import Creative from './pages/public/Creative'
import Pricing from './pages/public/Pricing'
import Profile from './pages/public/Profile'
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
import { withUtm } from './lib/analytics'

// An old or short address: on to the new one, keeping any campaign (utm_) tags it arrived with
const Go = ({ to }) => <Navigate to={withUtm(to)} replace />

// Every route in the next LensTrybe. Public site, onboarding, the client portal
// and the creative workspace. Two modes (src/lib/mode.js): demo runs on the sample store with
// nobody signed in; live puts the real Supabase session, profile and plan behind useAuth() and
// useSubscription(), the same contract the live app's pages are written against.
export default function App() {
  return (
    <AuthProvider><SubscriptionProvider><StoreProvider><ToastProvider>
      <RefractFilter />
      <PreviewBar />
      <RouteSeo />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/blog" element={<BlogHub which="all" />} />
          <Route path="/blog/clients" element={<BlogHub which="clients" />} />
          <Route path="/blog/creatives" element={<BlogHub which="creatives" />} />
          <Route path="/blog/edit" element={<EditHome />} />
          <Route path="/edit" element={<Go to="/blog/edit" />} />
          <Route path="/edit/confirm" element={<EditConfirm />} />
          <Route path="/edit/:slug" element={<EditIssue />} />
          <Route path="/the-trybe-edit" element={<Go to="/blog/edit" />} />
          <Route path="/the-trybe-edit/*" element={<Go to="/blog/edit" />} />
          <Route path="/trybe-edit" element={<Go to="/blog/edit" />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/jobs" element={<JobsBoard />} />
          <Route path="/jobs/:id" element={<JobsBoard />} />
          <Route path="/creatives" element={<Directory />} />
          <Route path="/creatives/:id" element={<Creative />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/founding" element={<Founding />} />
          <Route path="/join" element={<Join />} />
          <Route path="/join/creative" element={<Join />} />
          <Route path="/join/client" element={<Join />} />
          <Route path="/signup" element={<Go to="/join" />} />
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
          <Route path="/terms" element={<Go to="/legal/terms" />} />
          <Route path="/privacy" element={<Go to="/legal/privacy" />} />
          <Route path="/cookies" element={<Go to="/legal/cookies" />} />
          <Route path="/refunds" element={<Go to="/legal/refunds" />} />
          <Route path="/refund-policy" element={<Go to="/legal/refunds" />} />
          <Route path="/founding-agreement" element={<Go to="/legal/founding" />} />
          <Route path="/:kind/:place" element={<Local />} />
        </Route>
        <Route path="/onboarding" element={<Onboard />} />
        <Route path="/portal" element={<RequireClient><ClientHome /></RequireClient>} />
        <Route path="/portal/:slug" element={<ClientThread />} />
        <Route path="/brand/:slug" element={<BrandPage />} />
        <Route path="/review/:slug" element={<LeaveReview />} />
        <Route path="/site/:slug" element={<Profile />} />
        <Route path="/p/:slug" element={<Profile />} />
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
        <Route path="*" element={<Go to="/" />} />
      </Routes>
    </ToastProvider></StoreProvider></SubscriptionProvider></AuthProvider>
  )
}
