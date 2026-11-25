import { ChevronLeft, ChevronRight } from 'lucide-react';

export const STATUS = {
  trial: { label: 'Essai gratuit', cls: 'bg-accent-50 text-accent-700' },
  active: { label: 'Actif', cls: 'bg-emerald-50 text-emerald-700' },
  expired: { label: 'Expiré', cls: 'bg-amber-50 text-amber-800' },
  cancelled: { label: 'Annulé', cls: 'bg-red-50 text-red-700' },
};
export const METHODS = { cash: 'Espèces', bank_transfer: 'Virement', d17: 'D17', flouci: 'Flouci', other: 'Autre' };
export const TICKET_STATUS = {
  open: { label: 'Ouverte', cls: 'bg-amber-50 text-amber-800' },
  in_progress: { label: 'En cours', cls: 'bg-accent-50 text-accent-700' },
  resolved: { label: 'Résolue', cls: 'bg-emerald-50 text-emerald-700' },
  closed: { label: 'Fermée', cls: 'bg-navy-100 text-navy-600' },
};

export function StatusBadge({ status, map = STATUS }) {
  const s = map[status] ?? map.expired ?? { label: status, cls: 'bg-navy-100 text-navy-600' };
  return <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${s.cls}`}>{s.label}</span>;
}

export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      <span className="text-navy-500">Page {page} sur {pages} · {total} résultats</span>
      <div className="flex gap-2">
        <button type="button" aria-label="Page précédente" disabled={page <= 1} onClick={() => onPage(page - 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-navy-200 bg-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
        <button type="button" aria-label="Page suivante" disabled={page >= pages} onClick={() => onPage(page + 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-navy-200 bg-white disabled:opacity-40"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
      </div>
    </nav>
  );
}
