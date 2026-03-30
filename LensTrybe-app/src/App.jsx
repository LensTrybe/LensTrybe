import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from './components/DashboardLayout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import Availability from './pages/Availability'
import BookingRequests from './pages/BookingRequests'
import BrandKitPage from './pages/dashboard/BrandKitPage'
import CRMPage from './pages/dashboard/CRMPage'
import ClientPortalsPage from './pages/dashboard/ClientPortalsPage'
import Contracts from './pages/Contracts'
import DeliverPage from './pages/dashboard/DeliverPage'
import EditProfile from './pages/EditProfile'
import InsightsPage from './pages/dashboard/InsightsPage'
import Invoicing from './pages/Invoicing'
import MarketplacePage from './pages/dashboard/MarketplacePage'
import MessagesPage from './pages/dashboard/MessagesPage'
import MyBookingsPage from './pages/dashboard/MyBookingsPage'
import Portfolio from './pages/Portfolio'
import PortfolioWebsitePage from './pages/dashboard/PortfolioWebsitePage'
import Quotes from './pages/Quotes'
import ReviewsPage from './pages/dashboard/ReviewsPage'
import TeamPage from './pages/dashboard/TeamPage'
import SignContract from './pages/SignContract'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/sign/:token" element={<SignContract />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Navigate replace to="profile/edit-profile" />} />

          <Route path="profile/edit-profile" element={<EditProfile />} />

          <Route path="my-work/my-bookings" element={<MyBookingsPage />} />
          <Route path="my-work/booking-requests" element={<BookingRequests />} />
          <Route path="my-work/availability" element={<Availability />} />

          <Route path="clients/messages" element={<MessagesPage />} />
          <Route path="clients/crm" element={<CRMPage />} />
          <Route path="clients/client-portals" element={<ClientPortalsPage />} />

          <Route path="finance/invoicing" element={<Invoicing />} />
          <Route path="finance/quotes" element={<Quotes />} />
          <Route path="finance/contracts" element={<Contracts />} />

          <Route path="portfolio-design/portfolio" element={<Portfolio />} />
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
