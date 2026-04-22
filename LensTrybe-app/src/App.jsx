import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabaseClient'
import HomePage from './pages/public/HomePage'
import LoginPage from './pages/public/LoginPage'
import PricingPage from './pages/public/PricingPage'
import SignupPage from './pages/public/SignupPage'
import ClientSignupPage from './pages/public/ClientSignupPage'
import MessagesPage from './pages/dashboard/MessagesPage'
import InvoicingPage from './pages/dashboard/InvoicingPage'
import QuotesPage from './pages/dashboard/QuotesPage'
import ContractsPage from './pages/dashboard/ContractsPage'
import BrandKitPage from './pages/dashboard/BrandKitPage'
import DeliverPage from './pages/dashboard/DeliverPage'
import CRMPage from './pages/dashboard/CRMPage'
import DashboardHome from './pages/dashboard/DashboardHome'
import ReviewsPage from './pages/dashboard/ReviewsPage'
import MarketplacePage from './pages/dashboard/MarketplacePage'
import TeamPage from './pages/dashboard/TeamPage'
import EditProfilePage from './pages/dashboard/EditProfilePage'
import ViewProfilePage from './pages/dashboard/ViewProfilePage'
import SettingsPage from './pages/dashboard/SettingsPage'
import SubscriptionPage from './pages/dashboard/SubscriptionPage'
import MyBookingsPage from './pages/dashboard/MyBookingsPage'
import PublicLayout from './components/layout/PublicLayout'
import DashboardLayout from './components/layout/DashboardLayout'
import SignContract from './pages/SignContract'
import PublicPortfolioPage from './pages/PortfolioPage'
import PublicPortalPage from './pages/public/PublicPortalPage'
import DeliverDownloadPage from './pages/DeliverDownloadPage'
import TeamAcceptPage from './pages/TeamAcceptPage'
import AvailabilityPage from './pages/dashboard/AvailabilityPage'
import JobBoardPage from './pages/dashboard/JobBoardPage'
import PortfolioWebsitePage from './pages/dashboard/PortfolioWebsitePage'
import PublicPortfolioWebsitePage from './pages/public/PortfolioWebsitePage'
import ClientDashboardPage from './pages/ClientDashboardPage'
import ExplorePage from './pages/public/ExplorePage'
import PublicProfilePage from './pages/public/PublicProfilePage'
import PasswordResetPage from './pages/PasswordResetPage'
import TermsPage from './pages/legal/TermsPage'
import PrivacyPage from './pages/legal/PrivacyPage'
import CookiesPage from './pages/legal/CookiesPage'
import TrybeEditPage from './pages/public/TrybeEditPage'
import TrybeEditIssue01 from './pages/TrybeEditIssue01'
import ComingSoon from './pages/ComingSoon'

const isComingSoon = import.meta.env.VITE_COMING_SOON === "true"

function PlaceholderPage({ page }) {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '12px',
      color: 'var(--text-secondary)',
      fontFamily: 'var(--font-ui)'
    }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Building</div>
      <div style={{ fontSize: '24px', color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-display)' }}>{page}</div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const navigate = useNavigate()

  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.includes('type=recovery')) {
      window.location.replace('/reset-password' + hash)
    }
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        window._passwordRecoverySession = session
        navigate('/reset-password')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const routes = (
    <Routes>
      <Route path="/reset-password" element={<PasswordResetPage />} />
      <Route path="/forgot-password" element={<PasswordResetPage />} />

      {/* Public routes with navbar */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/creatives" element={<ExplorePage />} />
        <Route path="/creatives/:id" element={<PublicProfilePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/join" element={<SignupPage />} />
        <Route path="/join/client" element={<ClientSignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/jobs" element={<JobBoardPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/cookies" element={<CookiesPage />} />
        <Route path="/the-trybe-edit" element={<TrybeEditPage />} />
        <Route path="/the-trybe-edit/issue-01" element={<TrybeEditIssue01 />} />
        <Route path="/trybe-edit" element={<Navigate to="/the-trybe-edit" replace />} />
      </Route>

      {/* Protected dashboard routes with sidebar */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<DashboardHome />} />
        <Route path="clients/messages" element={<MessagesPage />} />
        <Route path="clients/crm" element={<CRMPage />} />
        <Route path="finance/invoicing" element={<InvoicingPage />} />
        <Route path="finance/quotes" element={<QuotesPage />} />
        <Route path="finance/contracts" element={<ContractsPage />} />
        <Route path="portfolio-design/brand-kit" element={<BrandKitPage />} />
        <Route path="portfolio-design/deliver" element={<DeliverPage />} />
        <Route path="portfolio-design/portfolio-website" element={<PortfolioWebsitePage />} />
        <Route path="business/insights" element={<Navigate to="/dashboard" replace />} />
        <Route path="business/reviews" element={<ReviewsPage />} />
        <Route path="business/marketplace" element={<MarketplacePage />} />
        <Route path="business/team" element={<TeamPage />} />
        <Route path="my-work/my-bookings" element={<MyBookingsPage />} />
        <Route path="my-work/availability" element={<AvailabilityPage />} />
        <Route path="my-work/jobs" element={<JobBoardPage />} />
        <Route path="profile/edit-profile" element={<EditProfilePage />} />
        <Route path="profile/view-profile" element={<ViewProfilePage />} />
        <Route path="settings/subscription" element={<SubscriptionPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Client dashboard */}
      <Route path="/client-dashboard" element={
        <ProtectedRoute>
          <ClientDashboardPage />
        </ProtectedRoute>
      } />


      {/* Token-based public pages — no auth; must stay outside ProtectedRoute */}
      <Route path="/sign/:token" element={<SignContract />} />
      <Route path="/portfolio/:id" element={<PublicPortfolioPage />} />
      <Route path="/portal/:token" element={<PublicPortalPage />} />
      <Route path="/deliver/:token" element={<DeliverDownloadPage />} />
      <Route path="/team/accept/:token" element={<TeamAcceptPage />} />

      {/* Public creative portfolio website (subdomain equivalent: /site/{custom_domain slug}) */}
      <Route path="/site/:slug" element={<PublicPortfolioWebsitePage />} />

      {/* Fallback */}
      <Route path="*" element={<PlaceholderPage page="404 — Page Not Found" />} />
    </Routes>
  )

  if (new URLSearchParams(window.location.search).get('preview') === 'letmein') {
    sessionStorage.setItem('preview', 'letmein')
  }
  const isPreview = sessionStorage.getItem('preview') === 'letmein';

  return (isComingSoon && !isPreview) ? <ComingSoon /> : routes
}
