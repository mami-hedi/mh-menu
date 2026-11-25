import { useEffect, useState } from 'react';
import { Check, Landmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, ButtonLink, Card, Spinner } from '../../components/ui.jsx';
import { api, parseError } from '../../services/api.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { formatDate, formatDT } from '../../lib/format.js';

const STATUS = {
  trial: { label: 'Essai gratuit', cls: 'bg-accent-50 text-accent-700' },
  active: { label: 'Actif', cls: 'bg-emerald-50 text-emerald-700' },
  expired: { label: 'Expiré', cls: 'bg-amber-50 text-amber-800' },
  cancelled: { label: 'Annulé', cls: 'bg-red-50 text-red-700' },
};

function StatusBadge({ status }) {
  const s = STATUS[status] ?? STATUS.expired;
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${s.cls}`}>{s.label}</span>;
}


function PaymentInfo({ info }) {
  const rows = [
    ['Banque', info.bankName], ['Titulaire', info.accountHolder], ['RIB / IBAN', info.rib],
    ['D17', info.d17], ['Flouci', info.flouci], ['Téléphone / WhatsApp', info.contactPhone], ['Email', info.contactEmail],
  ].filter(([, v]) => v);
  if (!rows.length && !info.instructions) return null;
  return (
    <Card className="p-5 sm:p-6">
      <h3 className="flex items-center gap-2 font-bold"><Landmark className="h-4 w-4 text-navy-500" aria-hidden="true" /> Comment payer</h3>
      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-sm text-navy-500">{k}</dt><dd className="mt-0.5 break-all font-semibold">{v}</dd></div>)}
      </dl>
      {info.instructions && <p className="mt-4 whitespace-pre-line rounded-xl bg-navy-50 p-4 text-sm text-navy-700">{info.instructions}</p>}
    </Card>
  );
}

export default function Subscription() {
  usePageMeta('Abonnement – MH Menu');
  const { subscription } = useAuth();
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [pay, setPay] = useState(null);

  useEffect(() => {
    api.get('/restaurant/subscription/history').then((r) => setHistory(r.data)).catch((e) => setError(parseError(e).message));
  }, []);
  useEffect(() => { api.get('/restaurant/payment-info').then((r) => setPay(r.data)).catch(() => setPay(null)); }, []);

  if (!subscription) return <Spinner />;
  const needsPlan = subscription.status === 'expired' || subscription.status === 'cancelled' || subscription.status === 'trial';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Abonnement</h1>
        <p className="mt-1 text-navy-500">Votre offre actuelle et l’historique de vos abonnements.</p>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{subscription.planName ?? 'Aucune offre'}</h2>
          <StatusBadge status={subscription.status} />
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div><dt className="text-sm text-navy-500">Date de début</dt><dd className="mt-0.5 font-semibold">{formatDate(subscription.startsAt)}</dd></div>
          <div><dt className="text-sm text-navy-500">Date de fin</dt><dd className="mt-0.5 font-semibold">{formatDate(subscription.endsAt)}</dd></div>
          <div><dt className="text-sm text-navy-500">Jours restants</dt><dd className="mt-0.5 font-semibold">{subscription.daysLeft}</dd></div>
        </dl>
      </Card>

      {needsPlan && (
        <section aria-labelledby="offers-title">
          <h2 id="offers-title" className="text-lg font-bold">Souscrire à une offre</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Card className="p-5"><div className="font-bold">Mensuelle</div><div className="mt-2 text-3xl font-extrabold">{formatDT(29)}<span className="text-base font-medium text-navy-500"> / mois</span></div></Card>
            <Card className="border-2 border-accent-500 p-5">
              <div className="flex items-center justify-between"><span className="font-bold">Annuelle</span><span className="rounded-full bg-accent-700 px-2.5 py-0.5 text-xs font-bold text-white">−58 DT</span></div>
              <div className="mt-2 text-3xl font-extrabold">{formatDT(290)}<span className="text-base font-medium text-navy-500"> / an</span></div>
            </Card>
          </div>
          <div className="mt-4 space-y-3">
            <Alert tone="info">
              <p className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Les deux offres donnent accès aux mêmes fonctionnalités.</p>
              <p className="mt-1.5">Le paiement est vérifié par MH Digital Solution, qui active ensuite votre abonnement manuellement : réglez votre offre auprès de nous (espèces, virement, D17 ou Flouci), puis signalez-le via le support.</p>
            </Alert>
            {pay && <PaymentInfo info={pay} />}
            <div className="flex flex-wrap gap-3">
              <ButtonLink to="/dashboard/support" variant="primary">Demander l’activation (support)</ButtonLink>
              <ButtonLink href="https://www.mh-digital-solution.com" target="_blank" rel="noopener noreferrer" variant="secondary">Contacter MH Digital Solution</ButtonLink>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="history-title">
        <h2 id="history-title" className="text-lg font-bold">Historique</h2>
        {error && <div className="mt-3"><Alert>{error}</Alert></div>}
        {!history && !error && <Spinner />}
        {history && (
          <Card className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Tableau (défilement horizontal)">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-navy-100 text-xs uppercase tracking-wide text-navy-500">
                <tr><th className="px-5 py-3 font-semibold">Offre</th><th className="px-5 py-3 font-semibold">Début</th><th className="px-5 py-3 font-semibold">Fin</th><th className="px-5 py-3 font-semibold">Statut</th><th className="px-5 py-3 text-right font-semibold">Réglé</th></tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-5 py-3 font-medium">{h.planName}</td>
                    <td className="px-5 py-3">{formatDate(h.startsAt)}</td>
                    <td className="px-5 py-3">{formatDate(h.endsAt)}</td>
                    <td className="px-5 py-3"><StatusBadge status={h.status} /></td>
                    <td className="px-5 py-3 text-right">{h.paidDt > 0 ? formatDT(h.paidDt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
