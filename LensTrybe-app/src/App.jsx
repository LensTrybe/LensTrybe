import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from './components/DashboardLayout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import AvailabilityPage from './pages/dashboard/AvailabilityPage'
import BookingRequestsPage from './pages/dashboard/BookingRequestsPage'
import BrandKitPage from './pages/dashboard/BrandKitPage'
import CRMPage from './pages/dashboard/CRMPage'
import ClientPortalsPage from './pages/dashboard/ClientPortalsPage'
import ContractsPage from './pages/dashboard/ContractsPage'
import DeliverPage from './pages/dashboard/DeliverPage'
import EditProfilePage from './pages/dashboard/EditProfilePage'
import InsightsPage from './pages/dashboard/InsightsPage'
import InvoicingPage from './pages/dashboard/InvoicingPage'
import MarketplacePage from './pages/dashboard/MarketplacePage'
import MessagesPage from './pages/dashboard/MessagesPage'
import MyBookingsPage from './pages/dashboard/MyBookingsPage'
import PortfolioPage from './pages/dashboard/PortfolioPage'
import PortfolioWebsitePage from './pages/dashboard/PortfolioWebsitePage'
import QuotesPage from './pages/dashboard/QuotesPage'
import ReviewsPage from './pages/dashboard/ReviewsPage'
import TeamPage from './pages/dashboard/TeamPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Navigate replace to="profile/edit-profile" />} />

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

          <Route path="portfolio-design/portfolio" element={<PortfolioPage />} />
          <Route path="portfolio-design/brand-kit" element={<BrandKitPage />} />
          <Route
            path="portfolio-design/portfolio-website"
            element={<PortfolioWebsitePage />}
          />
          <Route path="portfolio-design/deliver" element={<DeliverPage />} />

          <Route path="business/insights" element={<InsightsPage />} />
          <Route path="business/reviews" element={<ReviewsPage />} />
          <Route path="business/marketplace" element={<MarketplacePage />} />
          <Route path="business/team" element={<TeamPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate replace to="/dashboard" />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
