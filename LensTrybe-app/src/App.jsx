import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from './components/DashboardLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AvailabilityPage from './pages/dashboard/AvailabilityPage.jsx'
import BookingRequestsPage from './pages/dashboard/BookingRequestsPage.jsx'
import BrandKitPage from './pages/dashboard/BrandKitPage.jsx'
import CRMPage from './pages/dashboard/CRMPage.jsx'
import ClientPortalsPage from './pages/dashboard/ClientPortalsPage.jsx'
import ContractsPage from './pages/dashboard/ContractsPage.jsx'
import DeliverPage from './pages/dashboard/DeliverPage.jsx'
import DeliverDownloadPage from './pages/DeliverDownloadPage';
import EditProfilePage from './pages/dashboard/EditProfilePage.jsx'
import InvoicingPage from './pages/dashboard/InvoicingPage.jsx'
import MarketplacePage from './pages/dashboard/MarketplacePage'
import MessagesPage from './pages/dashboard/MessagesPage.jsx'
import MyBookingsPage from './pages/dashboard/MyBookingsPage.jsx'
import PortfolioPage from './pages/PortfolioPage.jsx'
import DashboardPortfolioPage from './pages/dashboard/PortfolioPage.jsx'
import PortfolioWebsitePage from './pages/dashboard/PortfolioWebsitePage.jsx'
import QuotesPage from './pages/dashboard/QuotesPage.jsx'
import ReviewsPage from './pages/dashboard/ReviewsPage.jsx'
import TeamPage from './pages/dashboard/TeamPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import SignContract from './pages/SignContract';
import ClientPortalPage from './pages/ClientPortalPage.jsx';
import TeamAcceptPage from './pages/TeamAcceptPage.jsx'
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />

          <Route path="profile/edit-profile" element={<EditProfilePage />} />

          <Route path="my-work/my-bookings" element={<MyBookingsPage />} />
          <Route path="my-work/booking-requests" element={<BookingRequestsPage />} />
          <Route path="my-work/availability" element={<AvailabilityPage />} />

          <Route path="clients/messages" element={<MessagesPage />} />
          <Route path="clients/crm" element={<CRMPage />} />
          <Route path="clients/client-portals" element={<ClientPortalsPage />} />

          <Route path="finance/invoicing" element={<InvoicingPage />} />
          <Route path="finance/quotes" element={<QuotesPage />} />
          <Route path="finance/contracts" element={<ContractsPage />} />

          <Route path="portfolio-design/portfolio" element={<DashboardPortfolioPage />} />
          <Route path="portfolio-design/brand-kit" element={<BrandKitPage />} />
          <Route
            path="portfolio-design/portfolio-website"
            element={<PortfolioWebsitePage />}
          />
          <Route path="portfolio-design/deliver" element={<DeliverPage />} />

          <Route path="business/reviews" element={<ReviewsPage />} />
          <Route path="business/marketplace" element={<MarketplacePage />} />
          <Route path="business/team" element={<TeamPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate replace to="/dashboard" />} />
      <Route path="*" element={<NotFoundPage />} />
      <Route path="/sign/:token" element={<SignContract />} />
      <Route path="/portfolio/:id" element={<PortfolioPage />} />
      <Route path="/portal/:token" element={<ClientPortalPage />} />
      <Route path="/deliver/:token" element={<DeliverDownloadPage />} />
      <Route path="/team/accept/:token" element={<TeamAcceptPage />} />
    </Routes>
  )
}