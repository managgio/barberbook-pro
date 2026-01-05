import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Pages
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import HoursLocationPage from "./pages/HoursLocationPage";
import NotFound from "./pages/NotFound";
import GuestBookingPage from "./pages/GuestBookingPage";

// Client Pages
import ClientLayout from "./components/layout/ClientLayout";
import ClientDashboard from "./pages/client/ClientDashboard";
import BookingWizard from "./pages/client/BookingWizard";
import AppointmentsPage from "./pages/client/AppointmentsPage";
import ProfilePage from "./pages/client/ProfilePage";

// Admin Pages
import AdminLayout from "./components/layout/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCalendar from "./pages/admin/AdminCalendar";
import AdminSearch from "./pages/admin/AdminSearch";
import AdminClients from "./pages/admin/AdminClients";
import AdminServices from "./pages/admin/AdminServices";
import AdminBarbers from "./pages/admin/AdminBarbers";
import AdminAlerts from "./pages/admin/AdminAlerts";
import AdminHolidays from "./pages/admin/AdminHolidays";
import AdminRoles from "./pages/admin/AdminRoles";
import AdminSettings from "./pages/admin/AdminSettings";

// Protected Route
import ProtectedRoute from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

// Redirect based on auth status
const AuthRedirect: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuth();
  
  if (isLoading) return null;
  
  if (isAuthenticated && user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/app'} replace />;
  }
  
  return <Navigate to="/auth" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/book" element={<GuestBookingPage />} />
            <Route path="/hours-location" element={<HoursLocationPage />} />

            {/* Client Routes */}
            <Route path="/app" element={<ProtectedRoute><ClientLayout /></ProtectedRoute>}>
              <Route index element={<ClientDashboard />} />
              <Route path="book" element={<BookingWizard />} />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="calendar" element={<AdminCalendar />} />
              <Route path="search" element={<AdminSearch />} />
              <Route path="clients" element={<AdminClients />} />
              <Route path="services" element={<AdminServices />} />
              <Route path="barbers" element={<AdminBarbers />} />
              <Route path="alerts" element={<AdminAlerts />} />
              <Route path="holidays" element={<AdminHolidays />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="roles" element={<AdminRoles />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
