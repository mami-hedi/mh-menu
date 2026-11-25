import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LifeBuoy, LogOut, ReceiptText, Store, Landmark } from 'lucide-react';
import Logo from '../../components/Logo.jsx';
import { useAuth } from '../../store/AuthContext.jsx';

const NAV = [
  { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/admin/restaurants', label: 'Restaurants', icon: Store },
  { to: '/admin/paiements', label: 'Paiements', icon: ReceiptText },
  { to: '/admin/support', label: 'Support', icon: LifeBuoy },
  { to: '/admin/paiement', label: 'Coordonnées', icon: Landmark },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-navy-50/60">
      <header className="border-b border-navy-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3"><Logo to="/admin" /><span className="rounded-full bg-navy-900 px-2.5 py-0.5 text-xs font-bold text-accent-400">Super Admin</span></div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-navy-500 sm:inline">{user.name}</span>
            <button type="button" onClick={async () => { await logout(); navigate('/', { replace: true }); }} aria-label="Déconnexion" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-navy-700 hover:bg-navy-50"><LogOut className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Déconnexion</span></button>
          </div>
        </div>
        <nav aria-label="Navigation Super Admin" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold ${isActive ? 'border-accent-500 text-navy-900' : 'border-transparent text-navy-500 hover:text-navy-800'}`}>
              <Icon className="h-4 w-4" aria-hidden="true" /> {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6"><Outlet /></main>
    </div>
  );
}
