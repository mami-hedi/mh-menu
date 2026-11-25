import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Check, Copy, Download, ExternalLink, Image as ImageIcon, Plus, Printer, QrCode as QrIcon, Trash2 } from 'lucide-react';
import { Alert, Button, Card, Field, Input, Spinner } from '../../components/ui.jsx';
import { ConfirmDialog, Modal } from '../../components/Modal.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useCanWrite, WriteBlockedNotice } from '../../components/WriteGuard.jsx';
import { useAuth } from '../../store/AuthContext.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { QR_COLORS, downloadQr, printQrSheet, qrPng, qrTarget, safeName } from '../../lib/qr.js';

function QrImage({ text, color, size = 'h-40 w-40', alt }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    qrPng(text, color, 400).then((s) => live && setSrc(s)).catch(() => live && setSrc(''));
    return () => { live = false; };
  }, [text, color]);
  return src ? <img src={src} alt={alt} className={`${size} rounded-lg border border-navy-100 bg-white`} /> : <div className={`${size} animate-pulse rounded-lg bg-navy-50`} aria-hidden="true" />;
}

function DownloadButtons({ text, color, name, size = 'sm' }) {
  const toast = useToast();
  const go = (format) => downloadQr({ text, color, format, filename: name }).catch(() => toast.error('Téléchargement impossible.'));
  return (
    <div className="flex flex-wrap gap-2">
      <Button size={size} variant="secondary" onClick={() => go('png')}><ImageIcon className="h-4 w-4" aria-hidden="true" /> PNG</Button>
      <Button size={size} variant="secondary" onClick={() => go('svg')}><Download className="h-4 w-4" aria-hidden="true" /> SVG</Button>
    </div>
  );
}

function AddTables({ onClose, onDone }) {
  const toast = useToast();
  const [mode, setMode] = useState('one');
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm({ defaultValues: { tableLabel: '', from: '1', to: '10', prefix: '' } });

  const submit = async (v) => {
    setServerError('');
    try {
      if (mode === 'one') {
        const { data } = await api.post('/restaurant/qrcodes', { tableLabel: v.tableLabel.trim() });
        onDone(data.tables); toast.success('Table ajoutée.');
      } else {
        const { data } = await api.post('/restaurant/qrcodes/bulk', { from: Number(v.from), to: Number(v.to), prefix: v.prefix.trim() || undefined });
        onDone(data.tables); toast.success(data.created ? `${data.created} table(s) créée(s).` : 'Ces tables existent déjà.');
      }
      onClose();
    } catch (e) { setServerError(parseError(e).message); }
  };
  const range = { required: 'Requis.', validate: (x) => (Number.isInteger(Number(x)) && Number(x) >= 1 && Number(x) <= 999) || 'Entre 1 et 999.' };

  return (
    <Modal title="Ajouter des tables" onClose={onClose} size="sm">
      <form onSubmit={handleSubmit(submit)} noValidate>
        <div className="space-y-4 px-5 py-5 sm:px-6">
          {serverError && <Alert>{serverError}</Alert>}
          <div role="tablist" aria-label="Mode de création" className="grid grid-cols-2 gap-1 rounded-xl bg-navy-50 p-1 text-sm font-semibold">
            {[['one', 'Une table'], ['bulk', 'Plusieurs tables']].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={`rounded-lg px-3 py-2 ${mode === id ? 'bg-white shadow-sm' : 'text-navy-500'}`}>{label}</button>
            ))}
          </div>
          {mode === 'one' ? (
            <Field label="Nom de la table" htmlFor="tableLabel" error={errors.tableLabel?.message} hint="Ex. 12, Terrasse 3, VIP">
              <Input id="tableLabel" data-autofocus maxLength={40} invalid={!!errors.tableLabel} {...register('tableLabel', { validate: (x) => x.trim().length > 0 || 'Nom requis.' })} />
            </Field>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="De la table n°" htmlFor="from" error={errors.from?.message}><Input id="from" inputMode="numeric" data-autofocus invalid={!!errors.from} {...register('from', range)} /></Field>
                <Field label="À la table n°" htmlFor="to" error={errors.to?.message}>
                  <Input id="to" inputMode="numeric" invalid={!!errors.to} {...register('to', { ...range, validate: (x) => { const r = range.validate(x); if (r !== true) return r; const n = Number(x) - Number(getValues('from')); return (n >= 0 && n < 100) || '100 tables maximum à la fois.'; } })} />
                </Field>
              </div>
              <Field label="Préfixe (facultatif)" htmlFor="prefix" hint="Ex. « Terrasse » donne Terrasse 1, Terrasse 2…"><Input id="prefix" maxLength={20} {...register('prefix')} /></Field>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-navy-100 px-5 py-4 sm:px-6">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={isSubmitting}>Ajouter</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function QrCodes() {
  usePageMeta('QR Codes – MH Menu');
  const toast = useToast();
  const canWrite = useCanWrite();
  const { restaurant, user } = useAuth();
  const canManage = canWrite && user.role !== 'editor';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [color, setColor] = useState(QR_COLORS[0].id);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => api.get('/restaurant/qrcodes').then((r) => setData(r.data)).catch((e) => setError(parseError(e).message)), []);
  useEffect(() => { load(); }, [load]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const mainUrl = qrTarget(data.slug);
  const copy = async () => {
    try { await navigator.clipboard.writeText(mainUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { toast.error('Copie impossible.'); }
  };
  const print = async (items) => {
    const ok = await printQrSheet({ restaurantName: restaurant.name, color, items }).catch(() => false);
    if (!ok) toast.error('Impossible d’ouvrir la fenêtre d’impression (pop-up bloquée ?).');
  };
  const remove = async () => {
    setBusy(true);
    try { await api.delete(`/restaurant/qrcodes/${toDelete.id}`); await load(); toast.success('QR Code supprimé.'); setToDelete(null); }
    catch (e) { toast.error(parseError(e).message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">QR Codes</h1>
        <p className="mt-1 text-navy-500">Imprimez-les et posez-les sur vos tables. Le QR Code ne change jamais, même si vous modifiez votre carte ou vos prix.</p>
      </div>
      <WriteBlockedNotice />

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="shrink-0"><QrImage text={mainUrl} color={color} size="h-48 w-48" alt={`QR Code du menu de ${restaurant.name}`} /></div>
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <h2 className="flex items-center gap-2 font-bold"><QrIcon className="h-4 w-4 text-navy-500" aria-hidden="true" /> QR Code principal</h2>
              <p className="mt-1 text-sm text-navy-500">Mène à votre menu complet.</p>
              <p className="mt-3 break-all rounded-xl bg-navy-50 px-3 py-2.5 text-sm font-medium text-navy-700">{mainUrl}</p>
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold">Couleur</legend>
              <div className="flex gap-2">
                {QR_COLORS.map((c) => (
                  <label key={c.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${color === c.id ? 'border-accent-500 bg-accent-50' : 'border-navy-200'}`}>
                    <input type="radio" name="qr-color" className="sr-only" checked={color === c.id} onChange={() => setColor(c.id)} />
                    <span className="h-4 w-4 rounded-full border border-white shadow ring-1 ring-navy-200" style={{ background: c.id }} aria-hidden="true" /> {c.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap items-center gap-2">
              <DownloadButtons text={mainUrl} color={color} name={`qr-${safeName(data.slug)}`} />
              <Button size="sm" variant="secondary" onClick={() => print([{ text: mainUrl }])}><Printer className="h-4 w-4" aria-hidden="true" /> Imprimer</Button>
              <Button size="sm" variant="ghost" onClick={copy} aria-live="polite">{copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? 'Copié' : 'Copier le lien'}</Button>
              <a href={mainUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2 text-sm font-semibold text-accent-700 hover:underline"><ExternalLink className="h-4 w-4" aria-hidden="true" /> Ouvrir</a>
            </div>
          </div>
        </div>
      </Card>

      <section aria-labelledby="tables-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="tables-title" className="text-lg font-extrabold">QR Codes par table</h2>
            <p className="text-sm text-navy-500">Chaque table a son QR Code : vous savez de quelle table vient chaque consultation et le numéro s’affiche sur le menu.</p>
          </div>
          <div className="flex gap-2">
            {data.tables.length > 0 && <Button variant="secondary" onClick={() => print(data.tables.map((t) => ({ text: qrTarget(data.slug, t.tableLabel), label: t.tableLabel })))}><Printer className="h-4 w-4" aria-hidden="true" /> Tout imprimer</Button>}
            <Button onClick={() => setAdding(true)} disabled={!canManage}><Plus className="h-4 w-4" aria-hidden="true" /> Ajouter des tables</Button>
          </div>
        </div>

        {data.tables.length === 0 ? (
          <Card className="mt-4 p-8 text-center text-navy-500">Aucune table pour le moment. Ajoutez vos tables pour générer un QR Code par table.</Card>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.tables.map((t) => {
              const text = qrTarget(data.slug, t.tableLabel);
              return (
                <li key={t.id}>
                  <Card className="flex flex-col items-center p-4 text-center">
                    <p className="text-lg font-extrabold">Table {t.tableLabel}</p>
                    <div className="mt-2"><QrImage text={text} color={color} size="h-36 w-36" alt={`QR Code de la table ${t.tableLabel}`} /></div>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      <DownloadButtons text={text} color={color} name={`qr-${safeName(data.slug)}-table-${safeName(t.tableLabel)}`} />
                      <button type="button" aria-label={`Supprimer la table ${t.tableLabel}`} disabled={!canManage} onClick={() => setToDelete(t)} className="grid h-9 w-9 place-items-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {adding && <AddTables onClose={() => setAdding(false)} onDone={(tables) => setData((d) => ({ ...d, tables }))} />}
      {toDelete && <ConfirmDialog title="Supprimer ce QR Code ?" message={`Le QR Code de la table « ${toDelete.tableLabel} » sera supprimé. S’il est déjà imprimé, il ouvrira toujours le menu, mais la table ne sera plus identifiée.`} onConfirm={remove} onClose={() => setToDelete(null)} loading={busy} />}
    </div>
  );
}
