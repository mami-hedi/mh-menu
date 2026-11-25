import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CreditCard, LifeBuoy, Store, TrendingUp } from 'lucide-react';
import { Alert, Card, Spinner } from '../../components/ui.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { formatDT } from '../../lib/format.js';

function Stat({ label, value, to, tone = 'navy' }) {
  const tones = { navy: 'text-navy-900', green: 'text-emerald-700', amber: 'text-amber-700', red: 'text-red-700', accent: 'text-accent-700' };
  const inner = (<><div className={`text-3xl font-extrabold tracking-tight ${tones[tone]}`}>{value}</div><div className="mt-0.5 text-sm text-navy-500">{label}</div></>);
  return <Card className={`p-5 ${to ? 'transition hover:border-accent-300' : ''}`}>{to ? <Link to={to} className="block">{inner}</Link> : inner}</Card>;
}

const monthLabel = (ym) => new Date(`${ym}-01T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' });

export default function AdminHome() {
  usePageMeta('Super Admin – MH Menu');
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/admin/stats').then((r) => setS(r.data)).catch((e) => setError(parseError(e).message)); }, []);
  if (error) return <Alert>{error}</Alert>;
  if (!s) return <Spinner />;
  const max = Math.max(1, ...s.revenue.months.map((m) => m.total));

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-extrabold tracking-tight">Tableau de bord</h1><p className="mt-1 text-navy-500">Vue d’ensemble de la plateforme MH Menu.</p></div>

      {(s.subscriptions.expiringSoon > 0 || s.openTickets > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {s.subscriptions.expiringSoon > 0 && <Link to="/admin/restaurants?filter=expiring" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"><AlertTriangle className="h-5 w-5" aria-hidden="true" /> {s.subscriptions.expiringSoon} abonnement(s) se terminent dans 3 jours</Link>}
          {s.openTickets > 0 && <Link to="/admin/support" className="flex items-center gap-3 rounded-2xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm font-semibold text-accent-800"><LifeBuoy className="h-5 w-5" aria-hidden="true" /> {s.openTickets} demande(s) de support à traiter</Link>}
        </div>
      )}

      <section aria-label="Restaurants" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Restaurants inscrits" value={s.restaurants.total} to="/admin/restaurants" />
        <Stat label="Abonnements actifs" value={s.subscriptions.active} tone="green" to="/admin/restaurants?filter=active" />
        <Stat label="En essai gratuit" value={s.subscriptions.trial} tone="accent" to="/admin/restaurants?filter=trial" />
        <Stat label="Expirés" value={s.subscriptions.expired} tone="amber" to="/admin/restaurants?filter=expired" />
        <Stat label="Annulés" value={s.subscriptions.cancelled} tone="red" to="/admin/restaurants?filter=cancelled" />
        <Stat label="Suspendus" value={s.restaurants.suspended} to="/admin/restaurants?filter=suspended" />
        <Stat label="Nouveaux (7 jours)" value={s.restaurants.new7Days} />
        <Stat label="Nouveaux (30 jours)" value={s.restaurants.new30Days} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card className="p-5 sm:p-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CreditCard className="h-5 w-5" aria-hidden="true" /></span>
          <div className="mt-4 text-3xl font-extrabold">{formatDT(s.revenue.thisMonthDt)}</div>
          <div className="text-sm text-navy-500">encaissés ce mois-ci</div>
          <div className="mt-4 border-t border-navy-100 pt-4 text-sm"><span className="text-navy-500">Total depuis le début : </span><strong>{formatDT(s.revenue.totalDt)}</strong></div>
          <Link to="/admin/paiements" className="mt-3 inline-block text-sm font-bold text-accent-700 hover:underline">Voir les paiements →</Link>
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-bold"><TrendingUp className="h-4 w-4 text-navy-500" aria-hidden="true" /> Encaissements des 6 derniers mois</h2>
          <div className="mt-6 flex h-40 items-end gap-3" role="img" aria-label={`Encaissements par mois : ${s.revenue.months.map((m) => `${monthLabel(m.month)} ${m.total} DT`).join(', ')}`}>
            {s.revenue.months.map((m) => (
              <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-xs font-semibold text-navy-500">{m.total ? Math.round(m.total) : 0}</span>
                <div className="w-full rounded-t-lg bg-accent-500/80" style={{ height: `${Math.max(4, (m.total / max) * 100)}%`, opacity: m.total ? 1 : 0.25 }} />
                <span className="text-[11px] capitalize text-navy-500">{monthLabel(m.month)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
