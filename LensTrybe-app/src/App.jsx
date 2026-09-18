import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { hasLaunched } from './lib/launch'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabaseClient'
import HomePage from './pages/public/HomePage'
const LoginPage = lazy(() => import('./pages/public/LoginPage'))
const PricingPage = lazy(() => import('./pages/public/PricingPage'))
const UpcomingFeaturesPage = lazy(() => import('./pages/public/UpcomingFeaturesPage'))
const SignupPage = lazy(() => import('./pages/public/SignupPage'))
const OnboardingPage = lazy(() => import('./pages/public/OnboardingPage'))
const JoinHubPage = lazy(() => import('./pages/public/JoinHubPage'))
const ClientSignupPage = lazy(() => import('./pages/public/ClientSignupPage'))
const MessagesPage = lazy(() => import('./pages/dashboard/MessagesPage'))
const MeetingsPage = lazy(() => import('./pages/dashboard/MeetingsPage'))
const InvoicingPage = lazy(() => import('./pages/dashboard/InvoicingPage'))
const QuotesPage = lazy(() => import('./pages/dashboard/QuotesPage'))
const ContractsPage = lazy(() => import('./pages/dashboard/ContractsPage'))
const FinanceOverviewPage = lazy(() => import('./pages/dashboard/FinanceOverviewPage'))
const ExpensesPage = lazy(() => import('./pages/dashboard/ExpensesPage'))
const TaxHubPage = lazy(() => import('./pages/dashboard/TaxHubPage'))
const BrandKitPage = lazy(() => import('./pages/dashboard/BrandKitPage'))
const DeliverPage = lazy(() => import('./pages/dashboard/DeliverPage'))
const CRMPage = lazy(() => import('./pages/dashboard/CRMPage'))
const ContactsPage = lazy(() => import('./pages/dashboard/ContactsPage'))
const DashboardHome = lazy(() => import('./pages/dashboard/DashboardHome'))
const ProjectsPage = lazy(() => import('./pages/dashboard/ProjectsPage'))
const ProjectDetailPage = lazy(() => import('./pages/dashboard/ProjectDetailPage'))
const InventoryPage = lazy(() => import('./pages/dashboard/InventoryPage'))
const NotesPage = lazy(() => import('./pages/dashboard/NotesPage'))
const ContentCalendarPage = lazy(() => import('./pages/dashboard/ContentCalendarPage'))
const ContentIdeasPage = lazy(() => import('./pages/dashboard/ContentIdeasPage'))
const ReviewsPage = lazy(() => import('./pages/dashboard/ReviewsPage'))
const MarketplacePage = lazy(() => import('./pages/dashboard/MarketplacePage'))
const TeamPage = lazy(() => import('./pages/dashboard/TeamPage'))
const CollaboratePage = lazy(() => import('./pages/dashboard/CollaboratePage'))
const EditProfilePage = lazy(() => import('./pages/dashboard/EditProfilePage'))
const ViewProfilePage = lazy(() => import('./pages/dashboard/ViewProfilePage'))
const SettingsPage = lazy(() => import('./pages/dashboard/SettingsPage'))
const ReferralsPage = lazy(() => import('./pages/dashboard/ReferralsPage'))
const SubscriptionPage = lazy(() => import('./pages/dashboard/SubscriptionPage'))
const MyBookingsPage = lazy(() => import('./pages/dashboard/MyBookingsPage'))
const LumiPage = lazy(() => import('./pages/dashboard/LumiPage'))
const AdminPage = lazy(() => import('./pages/dashboard/AdminPage'))
const SupportPage = lazy(() => import('./pages/dashboard/SupportPage'))
const PublicSupportPage = lazy(() => import('./pages/public/SupportPage'))
const FoundingHubPage = lazy(() => import('./pages/dashboard/FoundingHubPage'))
const PublicLayout = lazy(() => import('./components/layout/PublicLayout'))
const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'))
import TierGate from './components/dashboard/TierGate'
const SignContract = lazy(() => import('./pages/SignContract'))
const MeetingRespondPage = lazy(() => import('./pages/MeetingRespondPage'))
const PublicPortfolioPage = lazy(() => import('./pages/PortfolioPage'))
const PublicPortalPage = lazy(() => import('./pages/public/PublicPortalPage'))
const DeliverDownloadPage = lazy(() => import('./pages/DeliverDownloadPage'))
const DocumentViewPage = lazy(() => import('./pages/DocumentViewPage'))
const BookingUnavailablePage = lazy(() => import('./pages/BookingUnavailablePage'))
const TeamAcceptPage = lazy(() => import('./pages/TeamAcceptPage'))
const AvailabilityPage = lazy(() => import('./pages/dashboard/AvailabilityPage'))
const JobBoardPage = lazy(() => import('./pages/dashboard/JobBoardPage'))
const WebsiteBuilderPage = lazy(() => import('./pages/dashboard/WebsiteBuilderPage'))
const PublicSitePage = lazy(() => import('./pages/public/PublicSitePage'))
const ClientDashboardPage = lazy(() => import('./pages/ClientDashboardPage'))
const ExplorePage = lazy(() => import('./pages/public/ExplorePage'))
const PublicProfilePage = lazy(() => import('./pages/public/PublicProfilePage'))
const PasswordResetPage = lazy(() => import('./pages/PasswordResetPage'))
const TermsPage = lazy(() => import('./pages/legal/TermsPage'))
const PrivacyPage = lazy(() => import('./pages/legal/PrivacyPage'))
const CookiesPage = lazy(() => import('./pages/legal/CookiesPage'))
const RefundPolicyPage = lazy(() => import('./pages/legal/RefundPolicyPage'))
const FoundingAgreementPage = lazy(() => import('./pages/legal/FoundingAgreementPage'))
const FoundingOfferPage = lazy(() => import('./pages/public/FoundingOfferPage'))
const UnsubscribePage = lazy(() => import('./pages/public/UnsubscribePage'))
const TrybeEditPage = lazy(() => import('./pages/public/TrybeEditPage'))
const TrybeEditIssue01 = lazy(() => import('./pages/TrybeEditIssue01'))
const ComingSoon = lazy(() => import('./pages/ComingSoon'))
const CinematicIntro = lazy(() => import('./components/CinematicIntro'))
const AccountPendingDeletionPage = lazy(() => import('./pages/AccountPendingDeletionPage'))
import PublicPageShell from './components/layout/PublicPageShell'
const DirectoryClosedPage = lazy(() => import('./pages/public/DirectoryClosedPage'))
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

  // One boundary for the whole route table.
  //
  // The fallback is deliberately almost nothing. A chunk for a route already visited
  // resolves from cache in a frame or two, and a spinner that flashes for thirty
  // milliseconds reads as jank rather than progress. It holds the viewport height so the
  // page does not collapse and jump while a chunk arrives.
  const routes = (
    <Suspense fallback={<div aria-busy="true" style={{ minHeight: '100dvh' }} />}>
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
    </Suspense>
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
