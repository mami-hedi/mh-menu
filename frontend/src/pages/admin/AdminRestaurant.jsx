import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Ban, CalendarPlus, CheckCircle2, CreditCard, ExternalLink, PauseCircle, PlayCircle } from 'lucide-react';
import { Alert, Button, Card, Field, Input, Spinner } from '../../components/ui.jsx';
import { ConfirmDialog, Modal } from '../../components/Modal.jsx';
import { useToast } from '../../components/Toast.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { formatDate, formatDateTime, formatDT, parsePrice, priceRule } from '../../lib/format.js';
import { METHODS, StatusBadge } from './shared.jsx';

const PLANS = { monthly: { label: 'Mensuel', price: 29 }, yearly: { label: 'Annuel', price: 290 } };
const ROLE = { owner: 'Propriétaire', manager: 'Manager', editor: 'Éditeur' };
const today = () => new Date().toISOString().slice(0, 10);

function ActivateModal({ restaurant, current, onClose, onDone }) {
  const toast = useToast();
  const [error, setError] = useState('');
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { planCode: 'monthly', amount: '29', method: 'cash', reference: '', paidAt: today(), notes: '' },
  });
  const renewal = current === 'active';
  const submit = async (v) => {
    setError('');
    try {
      const body = { planCode: v.planCode, amountDt: parsePrice(v.amount), method: v.method, reference: v.reference.trim() || undefined, notes: v.notes.trim() || undefined };
      if (v.paidAt && v.paidAt !== today()) body.paidAt = new Date(`${v.paidAt}T12:00:00`).toISOString();
      const { data } = await api.post(`/admin/restaurants/${restaurant.id}/activate`, body);
      toast.success(renewal ? 'Abonnement renouvelé.' : 'Abonnement activé.');
      onDone(data); onClose();
    } catch (e) { setError(parseError(e).message); }
  };
  return (
    <Modal title={renewal ? 'Renouveler l’abonnement' : 'Activer un abonnement'} onClose={onClose} size="sm">
      <form onSubmit={handleSubmit(submit)} noValidate>
        <div className="space-y-4 px-5 py-5 sm:px-6">
          {error && <Alert>{error}</Alert>}
          {renewal && <Alert tone="info">La durée s’ajoute à la fin de l’abonnement en cours.</Alert>}
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">Offre</legend>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PLANS).map(([code, p]) => (
                <label key={code} className={`cursor-pointer rounded-xl border px-4 py-3 text-sm ${watch('planCode') === code ? 'border-accent-500 bg-accent-50' : 'border-navy-200'}`}>
                  <input type="radio" value={code} className="sr-only" {...register('planCode', { onChange: () => setValue('amount', String(PLANS[code].price)) })} />
                  <span className="block font-bold">{p.label}</span><span className="text-navy-500">{formatDT(p.price)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Montant reçu (DT)" htmlFor="amount" error={errors.amount?.message}><Input id="amount" inputMode="decimal" invalid={!!errors.amount} {...register('amount', priceRule())} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mode de paiement" htmlFor="method">
              <select id="method" className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm" {...register('method')}>{Object.entries(METHODS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </Field>
            <Field label="Date du paiement" htmlFor="paidAt" error={errors.paidAt?.message}><Input id="paidAt" type="date" max={today()} invalid={!!errors.paidAt} {...register('paidAt', { required: 'Date requise.' })} /></Field>
          </div>
          <Field label="Référence (facultatif)" htmlFor="reference" hint="N° de reçu, de virement…"><Input id="reference" maxLength={100} {...register('reference')} /></Field>
          <Field label="Note interne (facultatif)" htmlFor="notes"><Input id="notes" maxLength={255} {...register('notes')} /></Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-navy-100 px-5 py-4 sm:px-6">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={isSubmitting}>{renewal ? 'Renouveler' : 'Activer'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function GrantModal({ restaurant, onClose, onDone }) {
  const toast = useToast();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ defaultValues: { days: '7', notes: '' } });
  const submit = async (v) => {
    setError('');
    try {
      const { data } = await api.post(`/admin/restaurants/${restaurant.id}/grant-days`, { days: Number(v.days), notes: v.notes.trim() || undefined });
      toast.success('Jours offerts ajoutés.'); onDone(data); onClose();
    } catch (e) { setError(parseError(e).message); }
  };
  return (
    <Modal title="Offrir des jours" onClose={onClose} size="sm">
      <form onSubmit={handleSubmit(submit)} noValidate>
        <div className="space-y-4 px-5 py-5 sm:px-6">
          {error && <Alert>{error}</Alert>}
          <p className="text-sm text-navy-500">Prolonge l’abonnement en cours, ou rouvre un accès d’essai si l’abonnement est terminé. Aucun paiement n’est enregistré.</p>
          <Field label="Nombre de jours" htmlFor="days" error={errors.days?.message}>
            <Input id="days" inputMode="numeric" data-autofocus invalid={!!errors.days} {...register('days', { validate: (x) => (Number.isInteger(Number(x)) && Number(x) >= 1 && Number(x) <= 365) || 'Entre 1 et 365 jours.' })} />
          </Field>
          <Field label="Note interne (facultatif)" htmlFor="gnotes"><Input id="gnotes" maxLength={255} {...register('notes')} /></Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-navy-100 px-5 py-4 sm:px-6">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={isSubmitting}>Ajouter</Button>
        </div>
      </form>
    </Modal>
  );
}

function Section({ title, children }) {
  return <section><h2 className="mb-3 text-lg font-bold">{title}</h2>{children}</section>;
}

export default function AdminRestaurant() {
  const { id } = useParams();
  const toast = useToast();
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  usePageMeta(r ? `${r.name} – Super Admin` : 'Restaurant – Super Admin');

  const load = useCallback(() => api.get(`/admin/restaurants/${id}`).then((x) => setR(x.data)).catch((e) => setError(parseError(e).message)), [id]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="space-y-4"><Alert>{error}</Alert><Link to="/admin/restaurants" className="text-sm font-semibold underline">Retour à la liste</Link></div>;
  if (!r) return <Spinner />;

  const current = r.subscriptions[0]?.status;
  const act = async (path, msg) => {
    setBusy(true);
    try { const { data } = await api.post(`/admin/restaurants/${r.id}/${path}`, path === 'cancel' ? {} : undefined); setR(data); toast.success(msg); setModal(null); }
    catch (e) { toast.error(parseError(e).message); } finally { setBusy(false); }
  };
  const live = current === 'trial' || current === 'active';
  const owner = r.users.find((u) => u.role === 'owner');

  return (
    <div className="space-y-6">
      <Link to="/admin/restaurants" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-500 hover:text-navy-800"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Restaurants</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-extrabold tracking-tight">{r.name} {current && <StatusBadge status={current} />}{r.suspended && <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">Suspendu</span>}</h1>
          <p className="mt-1 text-sm text-navy-500">Inscrit le {formatDate(r.createdAt)} · <a href={`/r/${r.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent-700 hover:underline">/r/{r.slug} <ExternalLink className="h-3 w-3" aria-hidden="true" /></a></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setModal('activate')}><CreditCard className="h-4 w-4" aria-hidden="true" /> {current === 'active' ? 'Renouveler' : 'Activer un abonnement'}</Button>
          <Button variant="secondary" onClick={() => setModal('grant')}><CalendarPlus className="h-4 w-4" aria-hidden="true" /> Offrir des jours</Button>
          {live && <Button variant="secondary" onClick={() => setModal('cancel')}><Ban className="h-4 w-4" aria-hidden="true" /> Annuler l’abonnement</Button>}
          {r.suspended
            ? <Button variant="secondary" onClick={() => act('reactivate', 'Restaurant réactivé.')} loading={busy}><PlayCircle className="h-4 w-4" aria-hidden="true" /> Réactiver</Button>
            : <Button variant="danger" onClick={() => setModal('suspend')}><PauseCircle className="h-4 w-4" aria-hidden="true" /> Suspendre</Button>}
        </div>
      </div>

      <section aria-label="Chiffres" className="grid grid-cols-3 gap-2 sm:gap-4">
        {[['Produits', r.counts.products], ['Catégories', r.counts.categories], ['Consultations', r.counts.views]].map(([l, v]) => <Card key={l} className="min-w-0 p-2 text-center sm:p-4"><div className="text-2xl font-extrabold">{v}</div><div className="truncate text-xs text-navy-500 sm:text-sm">{l}</div></Card>)}
      </section>

      <Section title="Utilisateurs">
        <Card className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tableau (défilement horizontal)">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-navy-100 text-xs uppercase tracking-wide text-navy-500"><tr><th className="px-5 py-3 font-semibold">Nom</th><th className="px-5 py-3 font-semibold">E-mail</th><th className="px-5 py-3 font-semibold">Téléphone</th><th className="px-5 py-3 font-semibold">Rôle</th><th className="px-5 py-3 font-semibold">Dernière connexion</th></tr></thead>
            <tbody className="divide-y divide-navy-100">
              {r.users.map((u) => <tr key={u.id}><td className="px-5 py-3 font-medium">{u.name}</td><td className="px-5 py-3">{u.email}</td><td className="px-5 py-3">{u.phone ?? '—'}</td><td className="px-5 py-3">{ROLE[u.role] ?? u.role}{!u.isActive && ' (désactivé)'}</td><td className="px-5 py-3">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</td></tr>)}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="Abonnements">
        <Card className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tableau (défilement horizontal)">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-navy-100 text-xs uppercase tracking-wide text-navy-500"><tr><th className="px-5 py-3 font-semibold">Offre</th><th className="px-5 py-3 font-semibold">Début</th><th className="px-5 py-3 font-semibold">Fin</th><th className="px-5 py-3 font-semibold">Statut</th><th className="px-5 py-3 font-semibold">Note</th></tr></thead>
            <tbody className="divide-y divide-navy-100">
              {r.subscriptions.map((s) => <tr key={s.id}><td className="px-5 py-3 font-medium">{s.planName}</td><td className="px-5 py-3">{formatDate(s.startsAt)}</td><td className="px-5 py-3">{formatDate(s.endsAt)}</td><td className="px-5 py-3"><StatusBadge status={s.status} /></td><td className="px-5 py-3 text-navy-500">{s.notes ?? '—'}</td></tr>)}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="Paiements">
        <Card className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tableau (défilement horizontal)">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-navy-100 text-xs uppercase tracking-wide text-navy-500"><tr><th className="px-5 py-3 font-semibold">Date</th><th className="px-5 py-3 font-semibold">Mode</th><th className="px-5 py-3 font-semibold">Référence</th><th className="px-5 py-3 text-right font-semibold">Montant</th></tr></thead>
            <tbody className="divide-y divide-navy-100">
              {r.payments.map((p) => <tr key={p.id}><td className="px-5 py-3">{formatDate(p.paidAt)}</td><td className="px-5 py-3">{METHODS[p.method] ?? p.method}</td><td className="px-5 py-3 text-navy-500">{p.reference ?? '—'}</td><td className="px-5 py-3 text-right font-bold">{formatDT(p.amountDt)}</td></tr>)}
              {r.payments.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-navy-500">Aucun paiement.</td></tr>}
            </tbody>
          </table>
        </Card>
      </Section>

      {owner && <p className="flex items-center gap-2 text-xs text-navy-500"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Propriétaire : {owner.name} ({owner.email})</p>}

      {modal === 'activate' && <ActivateModal restaurant={r} current={current} onClose={() => setModal(null)} onDone={setR} />}
      {modal === 'grant' && <GrantModal restaurant={r} onClose={() => setModal(null)} onDone={setR} />}
      {modal === 'cancel' && <ConfirmDialog title="Annuler l’abonnement ?" message="Le restaurant ne pourra plus modifier son menu et son menu public deviendra indisponible. Vous pourrez le réactiver en activant un abonnement ou en offrant des jours." confirmLabel="Annuler l’abonnement" onConfirm={() => act('cancel', 'Abonnement annulé.')} onClose={() => setModal(null)} loading={busy} />}
      {modal === 'suspend' && <ConfirmDialog title="Suspendre ce restaurant ?" message="Plus aucun utilisateur du restaurant ne pourra se connecter et son menu public sera indisponible. Les données sont conservées." confirmLabel="Suspendre" onConfirm={() => act('suspend', 'Restaurant suspendu.')} onClose={() => setModal(null)} loading={busy} />}
    </div>
  );
}
