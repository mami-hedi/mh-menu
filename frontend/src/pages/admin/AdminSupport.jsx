import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Spinner } from '../../components/ui.jsx';
import { Modal } from '../../components/Modal.jsx';
import { useToast } from '../../components/Toast.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { formatDateTime } from '../../lib/format.js';
import { Pagination, StatusBadge, TICKET_STATUS } from './shared.jsx';

function TicketModal({ id, onClose, onChanged }) {
  const toast = useToast();
  const [t, setT] = useState(null);
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState('resolved');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api.get(`/admin/tickets/${id}`).then((r) => { setT(r.data); setReply(r.data.adminReply ?? ''); setStatus(r.data.status === 'open' ? 'resolved' : r.data.status); }).catch((e) => setError(parseError(e).message)); }, [id]);

  const save = async (body) => {
    setBusy(true); setError('');
    try { const { data } = await api.patch(`/admin/tickets/${id}`, body); setT(data); toast.success('Demande mise à jour.'); onChanged(); }
    catch (e) { setError(parseError(e).message); } finally { setBusy(false); }
  };

  return (
    <Modal title={t?.subject ?? 'Demande'} onClose={onClose}>
      <div className="space-y-4 px-5 py-5 sm:px-6">
        {error && <Alert>{error}</Alert>}
        {!t && !error && <Spinner />}
        {t && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm text-navy-500">
              <StatusBadge status={t.status} map={TICKET_STATUS} />
              <Link to={`/admin/restaurants/${t.restaurantId}`} className="font-semibold text-navy-800 hover:underline">{t.restaurantName}</Link>
              <span>· {t.userName} ({t.userEmail}) · {formatDateTime(t.createdAt)}</span>
            </div>
            <p className="whitespace-pre-line rounded-xl bg-navy-50 p-4 text-sm leading-relaxed">{t.message}</p>
            <div>
              <label htmlFor="reply" className="mb-1.5 block text-sm font-semibold">Réponse (envoyée par e-mail au propriétaire)</label>
              <textarea id="reply" rows={4} maxLength={3000} value={reply} onChange={(e) => setReply(e.target.value)} className="w-full rounded-xl border border-navy-200 px-3 py-2.5 text-sm" />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="tstatus" className="mb-1.5 block text-sm font-semibold">Statut</label>
                <select id="tstatus" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm">{Object.entries(TICKET_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
              </div>
              <Button loading={busy} disabled={!reply.trim() && status === t.status} onClick={() => save({ status, ...(reply.trim() && reply.trim() !== (t.adminReply ?? '') ? { adminReply: reply.trim() } : {}) })}>Enregistrer</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function AdminSupport() {
  usePageMeta('Support – Super Admin');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const load = useCallback(() => api.get('/admin/tickets', { params: { status: status || undefined, page } }).then((r) => setData(r.data)).catch((e) => setError(parseError(e).message)), [status, page]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Support</h1>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
        {[['', 'Toutes'], ...Object.entries(TICKET_STATUS).map(([k, v]) => [k, v.label])].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={status === id} onClick={() => { setStatus(id); setPage(1); }} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${status === id ? 'border-navy-900 bg-navy-900 text-white' : 'border-navy-200 bg-white text-navy-700 hover:bg-navy-50'}`}>{label}</button>
        ))}
      </div>
      {error && <Alert>{error}</Alert>}
      {!data && !error && <Spinner />}
      {data && (
        <>
          <Card className="divide-y divide-navy-100">
            {data.items.map((t) => (
              <button key={t.id} type="button" onClick={() => setOpen(t.id)} className="flex w-full flex-wrap items-center justify-between gap-2 px-5 py-4 text-left hover:bg-navy-50/50">
                <span className="min-w-0"><span className="block truncate font-bold">{t.subject}</span><span className="text-sm text-navy-500">{t.restaurantName} · {formatDateTime(t.createdAt)}</span></span>
                <span className="flex items-center gap-2">{t.replied && <span className="text-xs text-navy-500">Répondu</span>}<StatusBadge status={t.status} map={TICKET_STATUS} /></span>
              </button>
            ))}
            {data.items.length === 0 && <p className="px-5 py-10 text-center text-navy-500">Aucune demande.</p>}
          </Card>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
      {open && <TicketModal id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}
