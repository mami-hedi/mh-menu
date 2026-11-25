import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Button, Card, Field, Input, Spinner } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';

const FIELDS = ['bankName', 'accountHolder', 'rib', 'd17', 'flouci', 'contactPhone', 'contactEmail', 'instructions'];

export default function AdminPaymentInfo() {
  usePageMeta('Coordonnées de paiement – MH Menu');
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, reset, setError: setFieldError, formState: { errors, isSubmitting, isDirty } } = useForm();

  useEffect(() => {
    api.get('/admin/payment-info').then((r) => { reset(Object.fromEntries(FIELDS.map((k) => [k, r.data[k] ?? '']))); setLoaded(true); }).catch((e) => setError(parseError(e).message));
  }, [reset]);

  const submit = async (v) => {
    setError('');
    try {
      const r = await api.put('/admin/payment-info', Object.fromEntries(FIELDS.map((k) => [k, v[k]?.trim() || null])));
      reset(Object.fromEntries(FIELDS.map((k) => [k, r.data[k] ?? '']))); toast.success('Coordonnées enregistrées.');
    } catch (e) {
      const err = parseError(e);
      Object.entries(err.fields ?? {}).forEach(([k, m]) => { if (FIELDS.includes(k)) setFieldError(k, { message: m }); });
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div><h1 className="text-2xl font-extrabold tracking-tight">Coordonnées de paiement</h1><p className="mt-1 text-navy-500">Affichées aux restaurants sur leur page Abonnement. Laissez vide ce que vous ne proposez pas.</p></div>
      {error && <Alert>{error}</Alert>}
      {!loaded && !error && <Spinner />}
      {loaded && (
        <Card className="p-5 sm:p-6">
          <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Banque" htmlFor="bankName" error={errors.bankName?.message}><Input id="bankName" maxLength={80} {...register('bankName')} /></Field>
              <Field label="Titulaire du compte" htmlFor="accountHolder" error={errors.accountHolder?.message}><Input id="accountHolder" maxLength={120} {...register('accountHolder')} /></Field>
            </div>
            <Field label="RIB / IBAN" htmlFor="rib" error={errors.rib?.message}><Input id="rib" maxLength={40} inputMode="text" autoComplete="off" {...register('rib')} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Numéro D17" htmlFor="d17" error={errors.d17?.message}><Input id="d17" type="tel" inputMode="tel" maxLength={20} {...register('d17')} /></Field>
              <Field label="Numéro Flouci" htmlFor="flouci" error={errors.flouci?.message}><Input id="flouci" type="tel" inputMode="tel" maxLength={20} {...register('flouci')} /></Field>
              <Field label="Téléphone / WhatsApp de contact" htmlFor="contactPhone" error={errors.contactPhone?.message}><Input id="contactPhone" type="tel" inputMode="tel" maxLength={20} {...register('contactPhone')} /></Field>
              <Field label="Email de contact" htmlFor="contactEmail" error={errors.contactEmail?.message}><Input id="contactEmail" type="email" maxLength={190} {...register('contactEmail')} /></Field>
            </div>
            <Field label="Instructions" htmlFor="instructions" error={errors.instructions?.message} hint="Ex. : indiquez le nom du restaurant en référence et envoyez le reçu via le support.">
              <textarea id="instructions" rows={4} maxLength={1000} className="w-full rounded-xl border border-navy-200 px-3 py-2.5 text-sm" {...register('instructions')} />
            </Field>
            <div className="flex justify-end"><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Enregistrer</Button></div>
          </form>
        </Card>
      )}
    </div>
  );
}
