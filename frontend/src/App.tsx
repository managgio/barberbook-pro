import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { TenantProvider, useTenant } from "./context/TenantContext";
import { Loader2 } from "lucide-react";
import { queryClient } from "./lib/queryClient";
import NetworkStatusMonitor from "./components/common/NetworkStatusMonitor";
import AppErrorBoundary from "./components/common/AppErrorBoundary";
import AuthSessionMonitor from "./components/common/AuthSessionMonitor";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const HoursLocationPage = lazy(() => import("./pages/HoursLocationPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const GuestBookingPage = lazy(() => import("./pages/GuestBookingPage"));
const TenantError = lazy(() => import("./pages/TenantError"));
const PrivacyPolicyPage = lazy(() => import("./pages/legal/PrivacyPolicyPage"));
const CookiePolicyPage = lazy(() => import("./pages/legal/CookiePolicyPage"));
const LegalNoticePage = lazy(() => import("./pages/legal/LegalNoticePage"));
const ClientLayout = lazy(() => import("./components/layout/ClientLayout"));
const ClientDashboard = lazy(() => import("./pages/client/ClientDashboard"));
const BookingWizard = lazy(() => import("./pages/client/BookingWizard"));
const AppointmentsPage = lazy(() => import("./pages/client/AppointmentsPage"));
const ProfilePage = lazy(() => import("./pages/client/ProfilePage"));
const ReferralsPage = lazy(() => import("./pages/client/ReferralsPage"));
const ReferralLandingPage = lazy(() => import("./pages/ReferralLandingPage"));
const StripePaymentResultPage = lazy(() => import("./pages/StripePaymentResultPage"));
const AdminLayout = lazy(() => import("./components/layout/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminCalendar = lazy(() => import("./pages/admin/AdminCalendar"));
const AdminSearch = lazy(() => import("./pages/admin/AdminSearch"));
const AdminCashRegister = lazy(() => import("./pages/admin/AdminCashRegister"));
const AdminClients = lazy(() => import("./pages/admin/AdminClients"));
const AdminServices = lazy(() => import("./pages/admin/AdminServices"));
const AdminOffers = lazy(() => import("./pages/admin/AdminOffers"));
const AdminStock = lazy(() => import("./pages/admin/AdminStock"));
const AdminBarbers = lazy(() => import("./pages/admin/AdminBarbers"));
const AdminAlerts = lazy(() => import("./pages/admin/AdminAlerts"));
const AdminHolidays = lazy(() => import("./pages/admin/AdminHolidays"));
const AdminRoles = lazy(() => import("./pages/admin/AdminRoles"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminLoyalty = lazy(() => import("./pages/admin/AdminLoyalty"));
const AdminReferrals = lazy(() => import("./pages/admin/AdminReferrals"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));
const PlatformLayout = lazy(() => import("./components/layout/PlatformLayout"));
const PlatformDashboard = lazy(() => import("./pages/platform/PlatformDashboard"));
const PlatformBrands = lazy(() => import("./pages/platform/PlatformBrands"));
const PlatformObservability = lazy(() => import("./pages/platform/PlatformObservability"));
const ProtectedRoute = lazy(() => import("./components/auth/ProtectedRoute"));

const RouteLoader = () => (
  <div className="min-h-[40vh] flex items-center justify-center bg-background">
    <Loader2 className="w-7 h-7 animate-spin text-primary" />
  </div>
);

const withSuspense = (element: React.ReactNode) => (
  <Suspense fallback={<RouteLoader />}>{element}</Suspense>
);

const TenantGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isReady, tenantError } = useTenant();

  if (!isReady) {
    return <RouteLoader />;
  }

  if (tenantError) {
    return withSuspense(<TenantError error={tenantError} />);
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { tenant } = useTenant();
  const isPlatform = Boolean(tenant?.isPlatform);

  const HomeRoute: React.FC = () => {
    const { isAuthenticated, isLoading, user } = useAuth();
    const location = useLocation();

    if (isLoading) {
      return <RouteLoader />;
    }

    if (!isAuthenticated || !user) {
      return <LandingPage />;
    }

    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("view") === "landing") {
      return <LandingPage />;
    }

    const hasAdminAccess = Boolean(
      user.isSuperAdmin || user.isLocalAdmin || user.role === "admin" || user.isPlatformAdmin,
    );
    return <Navigate to={hasAdminAccess ? "/admin" : "/app/book"} replace />;
  };

  if (isPlatform) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={withSuspense(<AuthPage />)} />
        <Route
          path="/platform"
          element={withSuspense(
            <ProtectedRoute requirePlatformAdmin>
              <PlatformLayout />
            </ProtectedRoute>,
          )}
        >
          <Route index element={withSuspense(<PlatformDashboard />)} />
          <Route path="brands" element={withSuspense(<PlatformBrands />)} />
          <Route path="observability" element={withSuspense(<PlatformObservability />)} />
        </Route>
        <Route path="*" element={withSuspense(<NotFound />)} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={withSuspense(<HomeRoute />)} />
      <Route path="/auth" element={withSuspense(<AuthPage />)} />
      <Route path="/book" element={withSuspense(<GuestBookingPage />)} />
      <Route path="/ref/:code" element={withSuspense(<ReferralLandingPage />)} />
      <Route path="/payment/stripe/:status" element={withSuspense(<StripePaymentResultPage />)} />
      <Route path="/account/referrals" element={<Navigate to="/app/referrals" replace />} />
      <Route path="/hours-location" element={withSuspense(<HoursLocationPage />)} />
      <Route path="/legal/privacy" element={withSuspense(<PrivacyPolicyPage />)} />
      <Route path="/legal/cookies" element={withSuspense(<CookiePolicyPage />)} />
      <Route path="/legal/notice" element={withSuspense(<LegalNoticePage />)} />

      {/* Client Routes */}
      <Route
        path="/app"
        element={withSuspense(
          <ProtectedRoute>
            <ClientLayout />
          </ProtectedRoute>,
        )}
      >
        <Route index element={withSuspense(<ClientDashboard />)} />
        <Route path="book" element={withSuspense(<BookingWizard />)} />
        <Route path="appointments" element={withSuspense(<AppointmentsPage />)} />
        <Route path="referrals" element={withSuspense(<ReferralsPage />)} />
        <Route path="profile" element={withSuspense(<ProfilePage />)} />
      </Route>

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={withSuspense(
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>,
        )}
      >
        <Route index element={withSuspense(<AdminDashboard />)} />
        <Route path="calendar" element={withSuspense(<AdminCalendar />)} />
        <Route path="search" element={withSuspense(<AdminSearch />)} />
        <Route path="offers" element={withSuspense(<AdminOffers />)} />
        <Route path="cash-register" element={withSuspense(<AdminCashRegister />)} />
        <Route path="stock" element={withSuspense(<AdminStock />)} />
        <Route path="clients" element={withSuspense(<AdminClients />)} />
        <Route path="services" element={withSuspense(<AdminServices />)} />
        <Route path="barbers" element={withSuspense(<AdminBarbers />)} />
        <Route path="loyalty" element={withSuspense(<AdminLoyalty />)} />
        <Route path="referrals" element={withSuspense(<AdminReferrals />)} />
        <Route path="reviews" element={withSuspense(<AdminReviews />)} />
        <Route path="alerts" element={withSuspense(<AdminAlerts />)} />
        <Route path="holidays" element={withSuspense(<AdminHolidays />)} />
        <Route path="settings" element={withSuspense(<AdminSettings />)} />
        <Route path="roles" element={withSuspense(<AdminRoles />)} />
      </Route>

      {/* Platform Admin Routes */}
      <Route
        path="/platform"
        element={withSuspense(
          <ProtectedRoute requirePlatformAdmin>
            <PlatformLayout />
          </ProtectedRoute>,
        )}
      >
        <Route index element={withSuspense(<PlatformDashboard />)} />
        <Route path="brands" element={withSuspense(<PlatformBrands />)} />
        <Route path="observability" element={withSuspense(<PlatformObservability />)} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={withSuspense(<NotFound />)} />
    </Routes>
  );
};

const RouterShell: React.FC = () => {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthSessionMonitor />
      <AppRoutes />
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppErrorBoundary>
      <TenantProvider>
        <TenantGate>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <NetworkStatusMonitor />
              <RouterShell />
            </TooltipProvider>
          </AuthProvider>
        </TenantGate>
      </TenantProvider>
    </AppErrorBoundary>
  </QueryClientProvider>
);

export default App;
