import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './store/AuthContext.jsx';
import { FullPageSpinner } from './components/ui.jsx';

// Code splitting : chaque écran est chargé à la demande
const Landing = lazy(() => import('./pages/landing/Landing.jsx'));
const LegalPage = lazy(() => import('./pages/landing/LegalPage.jsx'));
const Login = lazy(() => import('./pages/auth/Login.jsx'));
const Register = lazy(() => import('./pages/auth/Register.jsx'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword.jsx'));
const DashboardLayout = lazy(() => import('./pages/dashboard/DashboardLayout.jsx'));
const DashboardHome = lazy(() => import('./pages/dashboard/DashboardHome.jsx'));
const Subscription = lazy(() => import('./pages/dashboard/Subscription.jsx'));
const Stats = lazy(() => import('./pages/dashboard/Stats.jsx'));
const Team = lazy(() => import('./pages/dashboard/Team.jsx'));
const AdminPaymentInfo = lazy(() => import('./pages/admin/AdminPaymentInfo.jsx'));
const Informations = lazy(() => import('./pages/dashboard/Informations.jsx'));
const Categories = lazy(() => import('./pages/dashboard/Categories.jsx'));
const Products = lazy(() => import('./pages/dashboard/Products.jsx'));
const Variants = lazy(() => import('./pages/dashboard/Variants.jsx'));
const Promotions = lazy(() => import('./pages/dashboard/Promotions.jsx'));
const Settings = lazy(() => import('./pages/dashboard/Settings.jsx'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'));
const AdminHome = lazy(() => import('./pages/admin/AdminHome.jsx'));
const AdminRestaurants = lazy(() => import('./pages/admin/AdminRestaurants.jsx'));
const AdminRestaurant = lazy(() => import('./pages/admin/AdminRestaurant.jsx'));
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments.jsx'));
const AdminSupport = lazy(() => import('./pages/admin/AdminSupport.jsx'));
const Support = lazy(() => import('./pages/dashboard/Support.jsx'));
const PublicMenu = lazy(() => import('./pages/public/PublicMenu.jsx'));
const MenuSettings = lazy(() => import('./pages/dashboard/MenuSettings.jsx'));
const QrCodes = lazy(() => import('./pages/dashboard/QrCodes.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => { if (!hash) window.scrollTo(0, 0); }, [pathname, hash]);
  return null;
}

/** Espace restaurant : réservé aux comptes restaurant connectés. */
function RestaurantRoute() {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  if (user.role === 'super_admin') return <Navigate to="/admin" replace />;
  return <Outlet />;
}

function AdminRoute() {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/connexion" replace />;
  if (user.role !== 'super_admin') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Pages de connexion/inscription : un utilisateur déjà connecté est renvoyé vers son espace. */
function GuestRoute() {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (isAuthenticated) return <Navigate to={user.role === 'super_admin' ? '/admin' : '/dashboard'} replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/a-propos" element={<LegalPage page="about" />} />
          <Route path="/contact" element={<LegalPage page="contact" />} />
          <Route path="/conditions-generales" element={<LegalPage page="terms" />} />
          <Route path="/politique-de-confidentialite" element={<LegalPage page="privacy" />} />
          <Route path="/mentions-legales" element={<LegalPage page="legal" />} />

          <Route element={<GuestRoute />}>
            <Route path="/connexion" element={<Login />} />
            <Route path="/inscription" element={<Register />} />
            <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
          </Route>
          <Route path="/r/:slug" element={<PublicMenu />} />
          <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />

          <Route path="/dashboard" element={<RestaurantRoute />}>
            <Route element={<DashboardLayout />}>
              <Route index element={<DashboardHome />} />
              <Route path="abonnement" element={<Subscription />} />
              <Route path="informations" element={<Informations />} />
              <Route path="categories" element={<Categories />} />
              <Route path="produits" element={<Products />} />
              <Route path="variantes" element={<Variants />} />
              <Route path="promotions" element={<Promotions />} />
              <Route path="parametres" element={<Settings />} />
              <Route path="menu" element={<MenuSettings />} />
              <Route path="qrcodes" element={<QrCodes />} />
              <Route path="support" element={<Support />} />
              <Route path="statistiques" element={<Stats />} />
              <Route path="utilisateurs" element={<Team />} />
            </Route>
          </Route>

          <Route path="/admin" element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<AdminHome />} />
              <Route path="restaurants" element={<AdminRestaurants />} />
              <Route path="restaurants/:id" element={<AdminRestaurant />} />
              <Route path="paiements" element={<AdminPayments />} />
              <Route path="support" element={<AdminSupport />} />
              <Route path="paiement" element={<AdminPaymentInfo />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}
