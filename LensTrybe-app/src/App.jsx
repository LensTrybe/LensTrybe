import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { hasLaunched } from './lib/launch'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabaseClient'
import HomePage from './pages/public/HomePage'
import LoginPage from './pages/public/LoginPage'
import PricingPage from './pages/public/PricingPage'
import UpcomingFeaturesPage from './pages/public/UpcomingFeaturesPage'
import SignupPage from './pages/public/SignupPage'
import OnboardingPage from './pages/public/OnboardingPage'
import JoinHubPage from './pages/public/JoinHubPage'
import ClientSignupPage from './pages/public/ClientSignupPage'
import MessagesPage from './pages/dashboard/MessagesPage'
import MeetingsPage from './pages/dashboard/MeetingsPage'
import InvoicingPage from './pages/dashboard/InvoicingPage'
import QuotesPage from './pages/dashboard/QuotesPage'
import ContractsPage from './pages/dashboard/ContractsPage'
import FinanceOverviewPage from './pages/dashboard/FinanceOverviewPage'
import ExpensesPage from './pages/dashboard/ExpensesPage'
import TaxHubPage from './pages/dashboard/TaxHubPage'
import BrandKitPage from './pages/dashboard/BrandKitPage'
import DeliverPage from './pages/dashboard/DeliverPage'
import CRMPage from './pages/dashboard/CRMPage'
import ContactsPage from './pages/dashboard/ContactsPage'
import DashboardHome from './pages/dashboard/DashboardHome'
import ProjectsPage from './pages/dashboard/ProjectsPage'
import ProjectDetailPage from './pages/dashboard/ProjectDetailPage'
import InventoryPage from './pages/dashboard/InventoryPage'
import NotesPage from './pages/dashboard/NotesPage'
import ContentCalendarPage from './pages/dashboard/ContentCalendarPage'
import ContentIdeasPage from './pages/dashboard/ContentIdeasPage'
import ReviewsPage from './pages/dashboard/ReviewsPage'
import MarketplacePage from './pages/dashboard/MarketplacePage'
import TeamPage from './pages/dashboard/TeamPage'
import CollaboratePage from './pages/dashboard/CollaboratePage'
import EditProfilePage from './pages/dashboard/EditProfilePage'
import ViewProfilePage from './pages/dashboard/ViewProfilePage'
import SettingsPage from './pages/dashboard/SettingsPage'
import ReferralsPage from './pages/dashboard/ReferralsPage'
import SubscriptionPage from './pages/dashboard/SubscriptionPage'
import MyBookingsPage from './pages/dashboard/MyBookingsPage'
import LumiPage from './pages/dashboard/LumiPage'
import AdminPage from './pages/dashboard/AdminPage'
import SupportPage from './pages/dashboard/SupportPage'
import PublicSupportPage from './pages/public/SupportPage'
import FoundingHubPage from './pages/dashboard/FoundingHubPage'
import PublicLayout from './components/layout/PublicLayout'
import DashboardLayout from './components/layout/DashboardLayout'
import TierGate from './components/dashboard/TierGate'
import SignContract from './pages/SignContract'
import MeetingRespondPage from './pages/MeetingRespondPage'
import PublicPortfolioPage from './pages/PortfolioPage'
import PublicPortalPage from './pages/public/PublicPortalPage'
import DeliverDownloadPage from './pages/DeliverDownloadPage'
import DocumentViewPage from './pages/DocumentViewPage'
import BookingUnavailablePage from './pages/BookingUnavailablePage'
import TeamAcceptPage from './pages/TeamAcceptPage'
import AvailabilityPage from './pages/dashboard/AvailabilityPage'
import JobBoardPage from './pages/dashboard/JobBoardPage'
import WebsiteBuilderPage from './pages/dashboard/WebsiteBuilderPage'
import PublicSitePage from './pages/public/PublicSitePage'
import ClientDashboardPage from './pages/ClientDashboardPage'
import ExplorePage from './pages/public/ExplorePage'
import PublicProfilePage from './pages/public/PublicProfilePage'
import PasswordResetPage from './pages/PasswordResetPage'
import TermsPage from './pages/legal/TermsPage'
import PrivacyPage from './pages/legal/PrivacyPage'
import CookiesPage from './pages/legal/CookiesPage'
import RefundPolicyPage from './pages/legal/RefundPolicyPage'
import FoundingAgreementPage from './pages/legal/FoundingAgreementPage'
import FoundingOfferPage from './pages/public/FoundingOfferPage'
import UnsubscribePage from './pages/public/UnsubscribePage'
import TrybeEditPage from './pages/public/TrybeEditPage'
import TrybeEditIssue01 from './pages/TrybeEditIssue01'
import ComingSoon from './pages/ComingSoon'
import CinematicIntro from './components/CinematicIntro'
import AccountPendingDeletionPage from './pages/AccountPendingDeletionPage'
import PublicPageShell from './components/layout/PublicPageShell'
import DirectoryClosedPage from './pages/public/DirectoryClosedPage'
import { LiquidPill } from './components/ui/liquidGlass'
import { LIQUID_GLASS } from './lib/glassTokensLight'

// Accounts opened on 17 September so invited creatives could set up before the public
// launch, but the directory should not open with a hundred half built profiles in it.
// It stays shut until 1 October and says so, rather than redirecting: HomePage's search
// navigates straight to /creatives/:id and PublicLayout links to /creatives, so a bounce
// back to home would turn both into dead ends with no explanation.
function previewUnlocked() {
  if (typeof window === 'undefined') return false
  try {
    if (new URLSearchParams(window.location.search).get('preview') === 'letmein') {
      sessionStorage.setItem('lt_preview', 'true')
    }
    return sessionStorage.getItem('lt_preview') === 'true'
  } catch {
    // Private browsing can refuse sessionStorage. A locked directory is the safe answer.
    return false
  }
}

// A short, centred public page: eyebrow, heading, a line of explanation, and up to two
// actions. Both the directory gate and the 404 are this shape, and both used to be
// hand-rolled with serif headings and a flat green pill, which is not the public house
// style. Anything else of this shape should use it rather than growing a third copy.
function PublicNoticePage({ eyebrow, title, body, primary, secondary }) {
  const navigate = useNavigate()
  return (
    <PublicPageShell maxWidth={700} centre>
      {({ isMobile }) => (
        <div style={{ ...LIQUID_GLASS, width: '100%', textAlign: 'center', padding: isMobile ? '32px 22px' : '48px 40px' }}>
          {eyebrow && (
            <p style={{ margin: '0 0 14px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c11f5a' }}>
              {eyebrow}
            </p>
          )}
          <h1 style={{ margin: 0, fontSize: isMobile ? '32px' : '44px', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-primary)' }}>
            {title}
          </h1>
          {body && (
            <p style={{ margin: '16px auto 0', maxWidth: '48ch', fontSize: '16px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              {body}
            </p>
          )}
          {(primary || secondary) && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '26px' }}>
              {primary && (
                <LiquidPill primary style={{ flex: '0 0 auto', display: 'inline-flex', padding: '14px 26px' }} onClick={() => navigate(primary.to)}>
                  {primary.label}
                </LiquidPill>
              )}
              {secondary && (
                <LiquidPill style={{ flex: '0 0 auto', display: 'inline-flex', padding: '14px 26px' }} onClick={() => navigate(secondary.to)}>
                  {secondary.label}
                </LiquidPill>
              )}
            </div>
          )}
        </div>
      )}
    </PublicPageShell>
  )
}

function DirectoryGate({ children }) {
  if (hasLaunched() || previewUnlocked()) return children
  return <DirectoryClosedPage />
}

function NotFoundPage() {
  return (
    <PublicNoticePage
      eyebrow="404"
      title="We can't find that page"
      body="The link may be out of date, or the page may have moved. Everything else is still where you left it."
      primary={{ to: '/', label: 'Back to home' }}
      secondary={{ to: '/support', label: 'Get help' }}
    />
  )
}

function ProtectedRoute({ children }) {
  const { user, loading, profile, clientAccount } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  // Accounts in their 30-day deletion window only see the reactivate / download screen.
  if (profile?.pending_deletion || (!profile && clientAccount?.pending_deletion)) return <AccountPendingDeletionPage />
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
      <Route path="/onboarding" element={<OnboardingPage />} />

      {/* Public routes with navbar */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/creatives" element={<DirectoryGate><ExplorePage /></DirectoryGate>} />
        <Route path="/creatives/:id" element={<DirectoryGate><PublicProfilePage /></DirectoryGate>} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/support" element={<PublicSupportPage />} />
        <Route path="/upcoming-features" element={<UpcomingFeaturesPage />} />
        <Route path="/creator-partners" element={<Navigate to="/" replace />} />
        <Route path="/join" element={<JoinHubPage />} />
        <Route path="/join/creative" element={<SignupPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/join/client" element={<ClientSignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/jobs" element={<JobBoardPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/cookies" element={<CookiesPage />} />
        <Route path="/refunds" element={<RefundPolicyPage />} />
        <Route path="/refund-policy" element={<Navigate to="/refunds" replace />} />
        <Route path="/founding" element={<FoundingOfferPage />} />
        <Route path="/founding-agreement" element={<FoundingAgreementPage />} />
        <Route path="/unsubscribe" element={<UnsubscribePage />} />
        <Route path="/unsubscribe/:token" element={<UnsubscribePage />} />
        <Route path="/the-trybe-edit" element={<TrybeEditPage />} />
        <Route path="/the-trybe-edit/issue-01" element={<TrybeEditIssue01 />} />
        <Route path="/trybe-edit" element={<Navigate to="/the-trybe-edit" replace />} />
        {/* Kept on its own URL now that it is no longer the gate, so the waitlist still
            works for anyone who lands on an older link. */}
        <Route path="/waitlist" element={<ComingSoon />} />
      </Route>

      {/* Protected dashboard routes with sidebar */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<DashboardHome />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="content/calendar" element={<ContentCalendarPage />} />
        <Route path="content/ideas" element={<ContentIdeasPage />} />
        <Route path="clients/messages" element={<MessagesPage />} />
        <Route path="clients/meetings" element={<MeetingsPage />} />
        <Route path="clients/contacts" element={<ContactsPage />} />
        <Route path="clients/crm" element={<TierGate feature="crmRecords"><CRMPage /></TierGate>} />
        <Route path="finance/overview" element={<FinanceOverviewPage />} />
        <Route path="finance/invoicing" element={<TierGate feature="invoicing"><InvoicingPage /></TierGate>} />
        <Route path="finance/quotes" element={<TierGate feature="quotes"><QuotesPage /></TierGate>} />
        <Route path="finance/contracts" element={<TierGate feature="contracts"><ContractsPage /></TierGate>} />
        <Route path="finance/expenses" element={<ExpensesPage />} />
        <Route path="finance/tax" element={<TaxHubPage />} />
        <Route path="portfolio-design/brand-kit" element={<TierGate feature="brandKit"><BrandKitPage /></TierGate>} />
        <Route path="portfolio-design/deliver" element={<TierGate feature="deliverGb"><DeliverPage /></TierGate>} />
        <Route path="portfolio-design/portfolio-website" element={<TierGate feature="website"><WebsiteBuilderPage /></TierGate>} />
        <Route path="business/insights" element={<Navigate to="/dashboard" replace />} />
        <Route path="business/reviews" element={<ReviewsPage />} />
        <Route path="business/marketplace" element={<MarketplacePage />} />
        <Route path="collaborate" element={<CollaboratePage />} />
        <Route path="founding" element={<FoundingHubPage />} />
        <Route path="business/team" element={<TierGate feature="teamSeats"><TeamPage /></TierGate>} />
        <Route path="my-work/my-bookings" element={<MyBookingsPage />} />
        <Route path="my-work/availability" element={<AvailabilityPage />} />
        <Route path="my-work/jobs" element={<JobBoardPage />} />
        <Route path="profile/edit-profile" element={<EditProfilePage />} />
        <Route path="profile/view-profile" element={<ViewProfilePage />} />
        <Route path="settings/subscription" element={<SubscriptionPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="referrals" element={<ReferralsPage />} />
        <Route path="lumi" element={<TierGate feature="lumiPerMonth"><LumiPage /></TierGate>} />
        <Route path="admin" element={<AdminPage />} />
      </Route>

      {/* Client dashboard */}
      <Route path="/client-dashboard" element={
        <ProtectedRoute>
          <ClientDashboardPage />
        </ProtectedRoute>
      } />


      {/* Token-based public pages (no auth); must stay outside ProtectedRoute */}
      <Route path="/sign/:token" element={<SignContract />} />
      <Route path="/meeting/:token" element={<MeetingRespondPage />} />
      <Route path="/portfolio/:id" element={<PublicPortfolioPage />} />
      <Route path="/portal/:token" element={<PublicPortalPage />} />
      <Route path="/deliver/:token" element={<DeliverDownloadPage />} />
      {/* Public link to one invoice or quote, sent in place of a PDF attachment. */}
      <Route path="/doc/:type/:token" element={<DocumentViewPage />} />
      <Route path="/booking-unavailable" element={<BookingUnavailablePage />} />
      <Route path="/team/accept/:token" element={<TeamAcceptPage />} />

      {/* Public creative portfolio website (subdomain equivalent: /site/{custom_domain slug}) */}
      <Route path="/site/:slug" element={<PublicSitePage />} />

      {/* Fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )

  // The pre-launch gate used to stand here, showing ComingSoon to everyone who was not
  // signed in. It was removed on 17 September 2026 because it silently broke the founding
  // programme: an invited creative has no account yet, so they were never signed in, and
  // every invite link landed on the countdown instead of the signup form. All 100 codes
  // expired between 7 and 15 hours before the gate would have lifted, so not one of them
  // could ever have been redeemed.
  //
  // Accounts are open from now. 1 October stays the public launch date, it is just a
  // marketing moment rather than a switch in the code. The waitlist page is still served
  // at /waitlist, and the homepage carries its own waitlist capture.

  return (
    <>
      {routes}
      <CinematicIntro />
    </>
  )
}
