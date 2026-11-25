import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, BadgePercent, BarChart3, CreditCard, LayoutDashboard, LayoutGrid, LogOut, Menu, QrCode, Settings,
  LifeBuoy, SlidersHorizontal, Smartphone, Store, UtensilsCrossed, Users, X,
} from 'lucide-react';
import Logo from '../../components/Logo.jsx';
import { useAuth } from '../../store/AuthContext.jsx';

const NAV = [
  { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/dashboard/informations', label: 'Informations du restaurant', icon: Store, managerOnly: true },
  { to: '/dashboard/categories', label: 'Catégories', icon: LayoutGrid },
  { to: '/dashboard/produits', label: 'Produits', icon: UtensilsCrossed },
  { to: '/dashboard/variantes', label: 'Variantes et suppléments', icon: SlidersHorizontal },
  { to: '/dashboard/promotions', label: 'Promotions', icon: BadgePercent },
  { to: '/dashboard/menu', label: 'Menu digital', icon: Smartphone, managerOnly: true },
  { to: '/dashboard/qrcodes', label: 'QR Codes', icon: QrCode },
  { to: '/dashboard/statistiques', label: 'Statistiques', icon: BarChart3, managerOnly: true },
  { to: '/dashboard/utilisateurs', label: 'Utilisateurs', icon: Users, ownerOnly: true },
  { to: '/dashboard/abonnement', label: 'Abonnement', icon: CreditCard, ownerOnly: true },
  { to: '/dashboard/support', label: 'Support', icon: LifeBuoy },
  { to: '/dashboard/parametres', label: 'Paramètres', icon: Settings },
];

function SubscriptionBanner({ subscription }) {
  if (!subscription) return null;
  if (subscription.status === 'trial') {
    const d = subscription.daysLeft;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 bg-accent-50 px-4 py-2.5 text-sm text-accent-700 sm:px-8">
        <span><strong>Essai gratuit</strong> : {d} jour{d > 1 ? 's' : ''} restant{d > 1 ? 's' : ''}.</span>
        <Link to="/dashboard/abonnement" className="font-bold underline">Voir les offres</Link>
      </div>
    );
  }
  if (subscription.status === 'expired' || subscription.status === 'cancelled') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 sm:px-8" role="alert">
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {subscription.status === 'expired' ? 'Votre essai ou abonnement est terminé' : 'Votre abonnement est annulé'} : les modifications sont bloquées et votre menu public est indisponible.
        </span>
        <Link to="/dashboard/abonnement" className="font-bold underline">Souscrire à une offre</Link>
      </div>
    );
  }
  return null;
}

export default function DashboardLayout() {
  const { user, restaurant, subscription, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setOpen(false), [location.pathname]);

  const items = NAV.filter((i) => (!i.ownerOnly || user.role === 'owner') && (!i.managerOnly || user.role !== 'editor'));
  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-navy-950 text-navy-200">
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Logo to="/dashboard" light />
        <button type="button" className="rounded-lg p-2 text-navy-300 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Fermer le menu"><X className="h-5 w-5" /></button>
      </div>
      <nav aria-label="Navigation du tableau de bord" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'}`
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="shrink-0 border-t border-white/10 p-3">
        <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-white/5 hover:text-white">
          <LogOut className="h-[18px] w-[18px]" aria-hidden="true" /> Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-navy-50/60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-navy-950/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-pop">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-navy-100 bg-white/90 px-4 backdrop-blur sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" className="rounded-lg p-2 text-navy-700 hover:bg-navy-50 lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu"><Menu className="h-6 w-6" /></button>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{restaurant?.name}</div>
              <div className="truncate text-xs text-navy-500">{user.name}</div>
            </div>
          </div>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-bold text-white" aria-hidden="true">
            {user.name.trim().charAt(0).toUpperCase()}
          </div>
        </header>
        <SubscriptionBanner subscription={subscription} />
        <main className="px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
