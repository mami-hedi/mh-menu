import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Globe, Link2, MessageCircle, Store } from 'lucide-react';
import { Alert, Button, Card, Field, Input, Spinner } from '../../components/ui.jsx';
import ImageUploader from '../../components/ImageUploader.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useCanWrite, WriteBlockedNotice } from '../../components/WriteGuard.jsx';
import { useAuth } from '../../store/AuthContext.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { optimizeImage, publicMenuUrl } from '../../lib/format.js';

const DAYS = [['mon', 'Lundi'], ['tue', 'Mardi'], ['wed', 'Mercredi'], ['thu', 'Jeudi'], ['fri', 'Vendredi'], ['sat', 'Samedi'], ['sun', 'Dimanche']];
const defaultHours = () => Object.fromEntries(DAYS.map(([d]) => [d, { closed: false, open: '09:00', close: '23:00' }]));
const HEX = /^#[0-9a-fA-F]{6}$/;
const URL_RULE = { validate: (v) => !v || /^https?:\/\/\S+$/i.test(v.trim()) || 'Lien invalide (https://…).' };

const toForm = (s) => ({
  name: s.name, description: s.description ?? '', address: s.address ?? '', phone: s.phone ?? '',
  primaryColor: s.primaryColor, secondaryColor: s.secondaryColor,
  openingHours: s.openingHours ?? defaultHours(),
  socialLinks: { facebook: '', instagram: '', tiktok: '', website: '', whatsapp: '', ...(s.socialLinks ?? {}) },
});

function ColorField({ label, name, register, watch, setValue, error, disabled }) {
  const value = watch(name);
  return (
    <Field label={label} htmlFor={name} error={error}>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} (sélecteur)`} value={HEX.test(value) ? value : '#000000'} disabled={disabled}
          onChange={(e) => setValue(name, e.target.value.toUpperCase(), { shouldDirty: true, shouldValidate: true })} className="h-11 w-14 cursor-pointer rounded-lg border border-navy-200 bg-white p-1 disabled:opacity-50" />
        <Input id={name} maxLength={7} invalid={!!error} disabled={disabled} className="font-mono uppercase" {...register(name, { pattern: { value: HEX, message: 'Format #RRGGBB.' } })} />
      </div>
    </Field>
  );
}

export default function Informations() {
  usePageMeta('Informations du restaurant – MH Menu');
  const toast = useToast();
  const { user, refresh } = useAuth();
  const canWrite = useCanWrite();
  const [settings, setSettings] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, reset, watch, setValue, setError, formState: { errors, isSubmitting, isDirty } } = useForm();

  useEffect(() => {
    if (user.role === 'editor') return;
    api.get('/restaurant/settings').then(({ data }) => { setSettings(data); reset(toForm(data)); }).catch((e) => setLoadError(parseError(e).message));
  }, [user.role, reset]);

  if (user.role === 'editor') return <Alert tone="warning">Cette page est réservée au propriétaire et aux managers.</Alert>;
  if (loadError) return <Alert>{loadError}</Alert>;
  if (!settings) return <Spinner />;

  const onSubmit = async (v) => {
    setServerError('');
    try {
      const { data } = await api.put('/restaurant/settings', {
        name: v.name.trim(), description: v.description.trim(), address: v.address.trim(), phone: v.phone.trim(),
        primaryColor: v.primaryColor, secondaryColor: v.secondaryColor,
        openingHours: v.openingHours,
        socialLinks: Object.fromEntries(Object.entries(v.socialLinks).map(([k, val]) => [k, val.trim()])),
      });
      setSettings(data); reset(toForm(data));
      toast.success('Informations enregistrées.');
      refresh().catch(() => {}); // met à jour le nom affiché dans l'en-tête
    } catch (err) {
      const p = parseError(err);
      for (const [k, msg] of Object.entries(p.fields ?? {})) setError(k, { message: msg });
      setServerError(p.message);
    }
  };

  const upload = (kind) => async (file) => {
    const f = new FormData();
    f.append('image', file);
    try { const { data } = await api.put(`/restaurant/settings/images/${kind}`, f); setSettings(data); } catch (e) { throw new Error(parseError(e).message); }
  };
  const removeImage = (kind) => async () => {
    try { const { data } = await api.delete(`/restaurant/settings/images/${kind}`); setSettings(data); } catch (e) { throw new Error(parseError(e).message); }
  };

  const copyMonday = () => {
    const mon = watch('openingHours.mon');
    DAYS.slice(1).forEach(([d]) => setValue(`openingHours.${d}`, { ...mon }, { shouldDirty: true }));
  };

  const name = watch('name');
  const primary = HEX.test(watch('primaryColor')) ? watch('primaryColor') : '#0B1F4B';
  const secondary = HEX.test(watch('secondaryColor')) ? watch('secondaryColor') : '#00B8D9';
  const onSecondary = (() => { const h = secondary.replace('#', ''); const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h; const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#0B1F4B' : '#ffffff'; })();
  const f = (n) => ({ id: n, invalid: !!errors[n], disabled: !canWrite });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Informations du restaurant</h1>
          <p className="mt-1 text-navy-500">Ces informations apparaissent sur votre menu public.</p>
        </div>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty || !canWrite}>Enregistrer</Button>
      </div>
      <WriteBlockedNotice />
      {serverError && <Alert>{serverError}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card className="space-y-4 p-5 sm:p-6">
            <h2 className="font-bold">Général</h2>
            <Field label="Nom commercial" htmlFor="name" error={errors.name?.message}>
              <Input {...f('name')} {...register('name', { required: 'Nom requis.', minLength: { value: 2, message: 'Au moins 2 caractères.' }, maxLength: { value: 120, message: '120 caractères maximum.' } })} />
            </Field>
            <Field label="Description" htmlFor="description" error={errors.description?.message}>
              <textarea id="description" rows={3} disabled={!canWrite} className="w-full rounded-xl border border-navy-200 px-4 py-3 text-sm focus:border-accent-500 focus:outline-none focus:ring-4 focus:ring-accent-500/15 disabled:bg-navy-50"
                placeholder="Cuisine maison, ambiance conviviale…" {...register('description', { maxLength: { value: 1000, message: '1000 caractères maximum.' } })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Téléphone" htmlFor="phone" error={errors.phone?.message}>
                <Input {...f('phone')} type="tel" {...register('phone', { pattern: { value: /^\+?[0-9 .-]{8,20}$/, message: 'Numéro invalide.' } })} />
              </Field>
              <Field label="Adresse" htmlFor="address" error={errors.address?.message}>
                <Input {...f('address')} {...register('address', { maxLength: { value: 255, message: '255 caractères maximum.' } })} />
              </Field>
            </div>
            <div>
              <div className="text-sm font-semibold text-navy-800">Devise</div>
              <div className="mt-1.5 rounded-xl bg-navy-50 px-4 py-3 text-sm text-navy-600">Dinar tunisien (DT)</div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">Horaires d'ouverture</h2>
              <button type="button" onClick={copyMonday} disabled={!canWrite} className="text-sm font-semibold text-accent-700 hover:underline disabled:opacity-50">Copier le lundi sur tous les jours</button>
            </div>
            <ul className="mt-4 space-y-2">
              {DAYS.map(([d, label]) => {
                const closed = watch(`openingHours.${d}.closed`);
                return (
                  <li key={d} className="grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[7rem_auto_1fr]">
                    <span className="text-sm font-medium">{label}</span>
                    <label className="flex items-center gap-2 text-sm text-navy-600 sm:order-last"><input type="checkbox" className="accent-accent-600" disabled={!canWrite} {...register(`openingHours.${d}.closed`)} /> Fermé</label>
                    <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                      <input type="time" aria-label={`${label} : ouverture`} disabled={closed || !canWrite} className="rounded-lg border border-navy-200 px-2.5 py-2 text-sm disabled:bg-navy-50 disabled:text-navy-300" {...register(`openingHours.${d}.open`, { required: !closed })} />
                      <span className="text-navy-500">à</span>
                      <input type="time" aria-label={`${label} : fermeture`} disabled={closed || !canWrite} className="rounded-lg border border-navy-200 px-2.5 py-2 text-sm disabled:bg-navy-50 disabled:text-navy-300" {...register(`openingHours.${d}.close`, { required: !closed })} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <h2 className="font-bold">Réseaux sociaux</h2>
            {[
              ['facebook', 'Facebook', Link2, 'https://facebook.com/…'], ['instagram', 'Instagram', Link2, 'https://instagram.com/…'],
              ['tiktok', 'TikTok', Link2, 'https://tiktok.com/@…'], ['website', 'Site web', Globe, 'https://…'],
            ].map(([k, label, Icon, ph]) => (
              <Field key={k} label={label} htmlFor={`social-${k}`} error={errors.socialLinks?.[k]?.message}>
                <div className="relative"><Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" aria-hidden="true" />
                  <Input id={`social-${k}`} className="pl-10" placeholder={ph} inputMode="url" disabled={!canWrite} invalid={!!errors.socialLinks?.[k]} {...register(`socialLinks.${k}`, URL_RULE)} /></div>
              </Field>
            ))}
            <Field label="WhatsApp (numéro)" htmlFor="social-whatsapp" error={errors.socialLinks?.whatsapp?.message}>
              <div className="relative"><MessageCircle className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" aria-hidden="true" />
                <Input id="social-whatsapp" className="pl-10" placeholder="+216 …" inputMode="tel" disabled={!canWrite} invalid={!!errors.socialLinks?.whatsapp} {...register('socialLinks.whatsapp', { pattern: { value: /^\+?[0-9 .-]{8,20}$/, message: 'Numéro invalide.' } })} /></div>
            </Field>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-5 p-5 sm:p-6">
            <h2 className="font-bold">Image de marque</h2>
            <ImageUploader label="Logo" url={settings.logoUrl} onUpload={upload('logo')} onRemove={removeImage('logo')} aspect="aspect-square w-32" disabled={!canWrite} hint="Carré, 5 Mo max." />
            <ImageUploader label="Image de couverture" url={settings.coverUrl} onUpload={upload('cover')} onRemove={removeImage('cover')} aspect="aspect-[16/7]" disabled={!canWrite} hint="Format large recommandé." />
            <ColorField label="Couleur principale" name="primaryColor" register={register} watch={watch} setValue={setValue} error={errors.primaryColor?.message} disabled={!canWrite} />
            <ColorField label="Couleur secondaire" name="secondaryColor" register={register} watch={watch} setValue={setValue} error={errors.secondaryColor?.message} disabled={!canWrite} />
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 pt-4 text-xs font-bold uppercase tracking-wider text-navy-500">Aperçu de l'en-tête du menu</div>
            <div className="m-4 overflow-hidden rounded-2xl border border-navy-100">
              <div className="relative h-24" style={{ background: settings.coverUrl ? undefined : `linear-gradient(135deg, ${primary}, ${secondary})` }}>
                {settings.coverUrl && <img src={optimizeImage(settings.coverUrl, 600)} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="relative px-4 pb-4">
                <div className="-mt-7 grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border-4 border-white text-white shadow" style={{ background: primary }}>
                  {settings.logoUrl ? <img src={optimizeImage(settings.logoUrl, 120)} alt="" className="h-full w-full object-cover" /> : <Store className="h-6 w-6" aria-hidden="true" />}
                </div>
                <div className="mt-2 truncate font-extrabold" style={{ color: primary }}>{name || 'Nom du restaurant'}</div>
                <span className="mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold" style={{ background: secondary, color: onSecondary }}>Catégorie</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-bold">Adresse de votre menu</h2>
            <p className="mt-2 break-all rounded-xl bg-navy-50 px-3 py-2.5 text-sm font-medium text-navy-700">{publicMenuUrl(settings.slug)}</p>
            <p className="mt-2 text-xs text-navy-500">Cette adresse ne change jamais, même si vous modifiez le nom du restaurant : votre QR Code reste valide.</p>
          </Card>
        </div>
      </div>
    </form>
  );
}
