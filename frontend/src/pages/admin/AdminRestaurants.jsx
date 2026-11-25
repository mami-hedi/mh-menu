import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Alert, Card, Spinner } from '../../components/ui.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { formatDate } from '../../lib/format.js';
import { Pagination, StatusBadge } from './shared.jsx';

const FILTERS = [['', 'Tous'], ['trial', 'Essai'], ['active', 'Actifs'], ['expiring', 'Fin proche'], ['expired', 'Expirés'], ['cancelled', 'Annulés'], ['suspended', 'Suspendus']];

export default function AdminRestaurants() {
  usePageMeta('Restaurants – Super Admin');
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') ?? '';
  const page = Number(params.get('page')) || 1;
  const [q, setQ] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(q);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    let live = true;
    setError('');
    api.get('/admin/restaurants', { params: { filter: filter || undefined, q: debounced || undefined, page } })
      .then((r) => live && setData(r.data)).catch((e) => live && setError(parseError(e).message));
    return () => { live = false; };
  }, [filter, debounced, page]);

  const set = (patch) => setParams((p) => { const n = new URLSearchParams(p); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); return n; }, { replace: true });
  useEffect(() => { if (page !== 1) set({ page: '' }); /* nouvelle recherche : retour page 1 */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Restaurants</h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Rechercher un restaurant</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-500" aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, adresse du menu, e-mail du propriétaire…" className="w-full rounded-xl border border-navy-200 bg-white py-2.5 pl-10 pr-4 text-sm" />
        </label>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => set({ filter: id, page: '' })} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${filter === id ? 'border-navy-900 bg-navy-900 text-white' : 'border-navy-200 bg-white text-navy-700 hover:bg-navy-50'}`}>{label}</button>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}
      {!data && !error && <Spinner />}
      {data && (
        <>
          <Card className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tableau (défilement horizontal)">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-navy-100 text-xs uppercase tracking-wide text-navy-500">
                <tr><th className="px-5 py-3 font-semibold">Restaurant</th><th className="px-5 py-3 font-semibold">Propriétaire</th><th className="px-5 py-3 font-semibold">Abonnement</th><th className="px-5 py-3 font-semibold">Fin</th><th className="px-5 py-3 text-right font-semibold">Produits</th></tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {data.items.map((r) => (
                  <tr key={r.id} className="hover:bg-navy-50/50">
                    <td className="px-5 py-3">
                      <Link to={`/admin/restaurants/${r.id}`} className="font-bold text-navy-900 hover:underline">{r.name}</Link>
                      <div className="text-xs text-navy-500">/r/{r.slug} · inscrit le {formatDate(r.createdAt)}</div>
                      {r.suspended && <span className="mt-1 inline-block rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">Suspendu</span>}
                    </td>
                    <td className="px-5 py-3">{r.owner.name}<div className="text-xs text-navy-500">{r.owner.email}</div></td>
                    <td className="px-5 py-3"><StatusBadge status={r.subscriptionStatus} /><div className="mt-1 text-xs text-navy-500">{r.planName}</div></td>
                    <td className="px-5 py-3 whitespace-nowrap">{formatDate(r.endsAt)}</td>
                    <td className="px-5 py-3 text-right">{r.products}</td>
                  </tr>
                ))}
                {data.items.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-navy-500">Aucun restaurant ne correspond.</td></tr>}
              </tbody>
            </table>
          </Card>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: p > 1 ? String(p) : '' })} />
        </>
      )}
    </div>
  );
}
