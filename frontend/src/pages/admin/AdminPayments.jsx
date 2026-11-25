import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Card, Spinner } from '../../components/ui.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { formatDate, formatDT } from '../../lib/format.js';
import { METHODS, Pagination } from './shared.jsx';

export default function AdminPayments() {
  usePageMeta('Paiements – Super Admin');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/admin/payments', { params: { page } }).then((r) => setData(r.data)).catch((e) => setError(parseError(e).message)); }, [page]);

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-extrabold tracking-tight">Paiements</h1><p className="mt-1 text-navy-500">Paiements enregistrés manuellement lors des activations d’abonnement.</p></div>
      {error && <Alert>{error}</Alert>}
      {!data && !error && <Spinner />}
      {data && (
        <>
          <Card className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tableau (défilement horizontal)">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-navy-100 text-xs uppercase tracking-wide text-navy-500"><tr><th className="px-5 py-3 font-semibold">Date</th><th className="px-5 py-3 font-semibold">Restaurant</th><th className="px-5 py-3 font-semibold">Offre</th><th className="px-5 py-3 font-semibold">Mode</th><th className="px-5 py-3 font-semibold">Référence</th><th className="px-5 py-3 text-right font-semibold">Montant</th></tr></thead>
              <tbody className="divide-y divide-navy-100">
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3 whitespace-nowrap">{formatDate(p.paidAt)}</td>
                    <td className="px-5 py-3"><Link to={`/admin/restaurants/${p.restaurantId}`} className="font-semibold hover:underline">{p.restaurantName}</Link></td>
                    <td className="px-5 py-3">{p.planName}</td>
                    <td className="px-5 py-3">{METHODS[p.method] ?? p.method}</td>
                    <td className="px-5 py-3 text-navy-500">{p.reference ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-bold">{formatDT(p.amountDt)}</td>
                  </tr>
                ))}
                {data.items.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-navy-500">Aucun paiement enregistré.</td></tr>}
              </tbody>
            </table>
          </Card>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
