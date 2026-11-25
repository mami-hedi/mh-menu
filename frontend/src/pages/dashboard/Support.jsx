import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { LifeBuoy, MessageSquare } from 'lucide-react';
import { Alert, Button, Card, Field, Input, Spinner } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { formatDateTime } from '../../lib/format.js';
import { StatusBadge, TICKET_STATUS } from '../admin/shared.jsx';

export default function Support() {
  usePageMeta('Support – MH Menu');
  const toast = useToast();
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState('');
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ defaultValues: { subject: '', message: '' } });
  const load = useCallback(() => api.get('/restaurant/support').then((r) => setTickets(r.data)).catch((e) => setError(parseError(e).message)), []);
  useEffect(() => { load(); }, [load]);

  const submit = async (v) => {
    setServerError('');
    try { await api.post('/restaurant/support', { subject: v.subject.trim(), message: v.message.trim() }); reset(); toast.success('Demande envoyée. Nous vous répondons rapidement.'); load(); }
    catch (e) { setServerError(parseError(e).message); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div><h1 className="text-2xl font-extrabold tracking-tight">Support</h1><p className="mt-1 text-navy-500">Une question, un paiement à signaler, un problème ? Écrivez-nous : la réponse est envoyée par e-mail et affichée ici.</p></div>

      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold"><LifeBuoy className="h-4 w-4 text-navy-500" aria-hidden="true" /> Nouvelle demande</h2>
        <form onSubmit={handleSubmit(submit)} noValidate className="mt-4 space-y-4">
          {serverError && <Alert>{serverError}</Alert>}
          <Field label="Objet" htmlFor="subject" error={errors.subject?.message}><Input id="subject" maxLength={150} invalid={!!errors.subject} {...register('subject', { validate: (v) => v.trim().length >= 3 || 'Objet trop court.' })} /></Field>
          <Field label="Message" htmlFor="message" error={errors.message?.message}>
            <textarea id="message" rows={5} maxLength={3000} aria-invalid={!!errors.message} className="w-full rounded-xl border border-navy-200 px-3 py-2.5 text-sm" {...register('message', { validate: (v) => v.trim().length >= 10 || 'Message trop court (10 caractères minimum).' })} />
          </Field>
          <div className="flex justify-end"><Button type="submit" loading={isSubmitting}>Envoyer</Button></div>
        </form>
      </Card>

      <section aria-labelledby="mine-title">
        <h2 id="mine-title" className="mb-3 text-lg font-bold">Mes demandes</h2>
        {error && <Alert>{error}</Alert>}
        {!tickets && !error && <Spinner />}
        {tickets && tickets.length === 0 && <Card className="p-8 text-center text-navy-500">Aucune demande pour le moment.</Card>}
        <ul className="space-y-3">
          {tickets?.map((t) => (
            <li key={t.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{t.subject}</h3><StatusBadge status={t.status} map={TICKET_STATUS} /></div>
                <p className="mt-0.5 text-xs text-navy-500">{formatDateTime(t.createdAt)}</p>
                <p className="mt-3 whitespace-pre-line text-sm text-navy-700">{t.message}</p>
                {t.adminReply && (
                  <div className="mt-4 rounded-xl bg-accent-50 p-4 text-sm">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-accent-700"><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> Réponse de MH Digital Solution</p>
                    <p className="whitespace-pre-line text-navy-800">{t.adminReply}</p>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
