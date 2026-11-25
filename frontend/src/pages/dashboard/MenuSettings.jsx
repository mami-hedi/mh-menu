import { useEffect, useState } from 'react';
import { Check, ExternalLink, Eye, EyeOff, ShoppingBag } from 'lucide-react';
import { Alert, Button, Card, Spinner } from '../../components/ui.jsx';
import Toggle from '../../components/Toggle.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useCanWrite, WriteBlockedNotice } from '../../components/WriteGuard.jsx';
import { useAuth } from '../../store/AuthContext.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { publicMenuUrl } from '../../lib/format.js';

const TEMPLATES = [
  { id: 'classic', name: 'Classique', text: 'Liste élégante avec une photo à droite de chaque plat. Idéal pour les cartes détaillées.' },
  { id: 'modern', name: 'Moderne', text: 'Grandes photos en cartes. Parfait pour mettre en valeur vos plats et desserts.' },
  { id: 'compact', name: 'Compact', text: 'Liste dense et rapide à parcourir. Adapté aux longues cartes (cafés, snacks).' },
];

function Mini({ id }) {
  const bar = 'rounded bg-navy-200';
  if (id === 'modern') return (
    <div className="grid grid-cols-2 gap-1.5" aria-hidden="true">{[0, 1].map((i) => <div key={i} className="rounded-lg bg-white p-1 shadow-sm"><div className="h-9 rounded bg-navy-100" /><div className={`${bar} mt-1.5 h-1.5 w-3/4`} /><div className={`${bar} mt-1 h-1.5 w-1/3`} /></div>)}</div>
  );
  if (id === 'compact') return (
    <div className="space-y-1.5" aria-hidden="true">{[0, 1, 2, 3].map((i) => <div key={i} className="flex items-center justify-between gap-2 border-b border-navy-100 pb-1"><div className={`${bar} h-1.5 w-1/2`} /><div className={`${bar} h-1.5 w-1/6`} /></div>)}</div>
  );
  return (
    <div className="space-y-1.5" aria-hidden="true">{[0, 1].map((i) => <div key={i} className="flex gap-2 rounded-lg bg-white p-1.5 shadow-sm"><div className="flex-1"><div className={`${bar} h-1.5 w-3/4`} /><div className={`${bar} mt-1.5 h-1.5 w-1/2`} /></div><div className="h-8 w-8 rounded bg-navy-100" /></div>)}</div>
  );
}

function Option({ title, text, checked, onChange, disabled, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-semibold">{Icon && <Icon className="h-4 w-4 text-navy-500" aria-hidden="true" />} {title}</p>
        <p className="mt-0.5 text-sm text-navy-500">{text}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}

export default function MenuSettings() {
  usePageMeta('Menu digital – MH Menu');
  const toast = useToast();
  const canWrite = useCanWrite();
  const { restaurant } = useAuth();
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/restaurant/menu').then((r) => { setSaved(r.data); setForm(r.data); }).catch((e) => setError(parseError(e).message));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!form) return <Spinner />;

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/restaurant/menu', form);
      setSaved(data); setForm(data);
      toast.success('Menu digital mis à jour.');
    } catch (e) { toast.error(parseError(e).message); } finally { setSaving(false); }
  };
  const url = publicMenuUrl(restaurant.slug);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Menu digital</h1>
          <p className="mt-1 text-navy-500">Choisissez l’apparence de votre menu public et ses options.</p>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-navy-50"><ExternalLink className="h-4 w-4" aria-hidden="true" /> Voir mon menu public</a>
      </div>
      <WriteBlockedNotice />

      <Card className="p-5 sm:p-6">
        <h2 className="font-bold">Modèle visuel</h2>
        <div role="radiogroup" aria-label="Modèle visuel" className="mt-4 grid gap-3 sm:grid-cols-3">
          {TEMPLATES.map((t) => {
            const on = form.template === t.id;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={on} disabled={!canWrite} onClick={() => set('template')(t.id)}
                className={`relative rounded-2xl border-2 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${on ? 'border-accent-500 bg-accent-50/50' : 'border-navy-100 hover:border-navy-200'}`}>
                <div className="rounded-xl bg-navy-50 p-2.5"><Mini id={t.id} /></div>
                <p className="mt-3 flex items-center gap-1.5 font-bold">{t.name}{on && <Check className="h-4 w-4 text-accent-700" aria-hidden="true" />}</p>
                <p className="mt-0.5 text-xs text-navy-500">{t.text}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="divide-y divide-navy-100 px-5 sm:px-6">
        <Option icon={ShoppingBag} title="Panier virtuel" text="Les clients composent leur sélection puis la présentent au serveur. Aucune commande n’est envoyée." checked={form.cartEnabled} onChange={set('cartEnabled')} disabled={!canWrite} />
        <Option title="Afficher le badge « Populaire »" text="Met en avant les produits que vous avez marqués comme populaires." checked={form.showPopular} onChange={set('showPopular')} disabled={!canWrite} />
        <Option icon={form.isPublished ? Eye : EyeOff} title="Menu public en ligne" text="Désactivez pour masquer temporairement votre menu (le QR Code reste inchangé)." checked={form.isPublished} onChange={set('isPublished')} disabled={!canWrite} />
        <Option title="Autoriser les moteurs de recherche" text="Par défaut, votre menu n’apparaît pas dans Google. Activez pour le rendre référençable." checked={form.allowIndexing} onChange={set('allowIndexing')} disabled={!canWrite} />
      </Card>

      {!form.isPublished && <Alert tone="warning">Votre menu est actuellement masqué : les clients voient un message d’indisponibilité.</Alert>}

      <div className="flex justify-end gap-3">
        {dirty && <Button variant="secondary" onClick={() => setForm(saved)} disabled={saving}>Annuler</Button>}
        <Button onClick={save} loading={saving} disabled={!dirty || !canWrite}>Enregistrer</Button>
      </div>
    </div>
  );
}
