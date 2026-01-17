import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { TenantProvider, useTenant } from "./context/TenantContext";

// Pages
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import HoursLocationPage from "./pages/HoursLocationPage";
import NotFound from "./pages/NotFound";
import GuestBookingPage from "./pages/GuestBookingPage";
import TenantError from "./pages/TenantError";
import PrivacyPolicyPage from "./pages/legal/PrivacyPolicyPage";
import CookiePolicyPage from "./pages/legal/CookiePolicyPage";
import LegalNoticePage from "./pages/legal/LegalNoticePage";

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

// Platform Admin Pages
import PlatformLayout from "./components/layout/PlatformLayout";
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import PlatformBrands from "./pages/platform/PlatformBrands";

// Protected Route
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// Redirect based on auth status
const AuthRedirect: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuth();
  
  if (isLoading) return null;
  
  if (isAuthenticated && user) {
    if (user.isPlatformAdmin) {
      return <Navigate to="/platform" replace />;
    }
    const hasAdminAccess = user.isSuperAdmin || user.isLocalAdmin;
    return <Navigate to={hasAdminAccess ? '/admin' : '/app'} replace />;
  }
  
  return <Navigate to="/auth" replace />;
};

const TenantGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isReady, tenantError } = useTenant();

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tenantError) {
    return <TenantError error={tenantError} />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { tenant } = useTenant();
  const isPlatform = Boolean(tenant?.isPlatform);

  if (isPlatform) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/platform" element={<ProtectedRoute requirePlatformAdmin><PlatformLayout /></ProtectedRoute>}>
          <Route index element={<PlatformDashboard />} />
          <Route path="brands" element={<PlatformBrands />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/book" element={<GuestBookingPage />} />
      <Route path="/hours-location" element={<HoursLocationPage />} />
      <Route path="/legal/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/legal/cookies" element={<CookiePolicyPage />} />
      <Route path="/legal/notice" element={<LegalNoticePage />} />

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

      {/* Platform Admin Routes */}
      <Route path="/platform" element={<ProtectedRoute requirePlatformAdmin><PlatformLayout /></ProtectedRoute>}>
        <Route index element={<PlatformDashboard />} />
        <Route path="brands" element={<PlatformBrands />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const RouterShell: React.FC = () => {
  const { currentLocationId } = useTenant();
  return (
    <BrowserRouter>
      <AppRoutes key={currentLocationId || 'default'} />
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TenantProvider>
      <TenantGate>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <RouterShell />
          </TooltipProvider>
        </AuthProvider>
      </TenantGate>
    </TenantProvider>
  </QueryClientProvider>
);

export default App;
