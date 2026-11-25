import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Check, Copy, ExternalLink, Eye, LayoutGrid, PackageCheck, PackageX, UtensilsCrossed } from 'lucide-react';
import { Alert, Button, Card, Spinner } from '../../components/ui.jsx';
import { api, parseError } from '../../services/api.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { formatDate, formatDateTime, formatShortDay, publicMenuUrl } from '../../lib/format.js';

const ACTIVITY_LABELS = {
  'restaurant.registered': 'Restaurant créé',
  'auth.login': 'Connexion',
  'auth.logout': 'Déconnexion',
  'auth.password_reset_requested': 'Demande de réinitialisation du mot de passe',
  'auth.password_reset_done': 'Mot de passe modifié',
  'auth.password_changed': 'Mot de passe modifié',
  'profile.updated': 'Profil mis à jour',
  'settings.updated': 'Informations du restaurant modifiées',
  'settings.logo_updated': 'Logo modifié',
  'settings.logo_removed': 'Logo supprimé',
  'settings.cover_updated': 'Image de couverture modifiée',
  'settings.cover_removed': 'Image de couverture supprimée',
  'category.created': 'Catégorie créée',
  'category.updated': 'Catégorie modifiée',
  'category.deleted': 'Catégorie supprimée',
  'category.reordered': 'Catégories réordonnées',
  'category.image_updated': 'Image de catégorie modifiée',
  'category.image_removed': 'Image de catégorie supprimée',
  'product.created': 'Produit créé',
  'product.updated': 'Produit modifié',
  'product.deleted': 'Produit supprimé',
  'product.duplicated': 'Produit dupliqué',
  'product.reordered': 'Produits réordonnés',
  'product.images_added': 'Photos de produit ajoutées',
  'product.image_removed': 'Photo de produit supprimée',
  'team.created': 'Membre ajouté à l’équipe',
  'team.updated': 'Membre de l’équipe modifié',
  'team.password_reset': 'Mot de passe d’un membre réinitialisé',
  'team.removed': 'Membre retiré de l’équipe',
  'subscription.activated': 'Abonnement activé',
  'subscription.renewed': 'Abonnement renouvelé',
  'subscription.extended': 'Jours offerts ajoutés',
  'subscription.cancelled': 'Abonnement annulé',
  'restaurant.suspended': 'Restaurant suspendu',
  'restaurant.reactivated': 'Restaurant réactivé',
  'ticket.created': 'Demande de support envoyée',
  'ticket.replied': 'Réponse du support reçue',
  'menu.updated': 'Menu digital modifié',
  'qrcode.created': 'QR Code de table créé',
  'qrcode.deleted': 'QR Code de table supprimé',
};

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = { navy: 'bg-navy-50 text-navy-700', accent: 'bg-accent-50 text-accent-700', green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700' };
  return (
    <Card className="p-5">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <div className="mt-4 text-3xl font-extrabold tracking-tight">{value}</div>
      <div className="mt-0.5 text-sm text-navy-500">{label}</div>
    </Card>
  );
}

function ViewsChart({ days }) {
  const max = Math.max(1, ...days.map((d) => d.views));
  const total = days.reduce((s, d) => s + d.views, 0);
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold">Consultations des 7 derniers jours</h2>
        <span className="text-sm text-navy-500">{total} au total</span>
      </div>
      <div className="mt-6 flex h-40 items-end gap-2 sm:gap-3" role="img" aria-label={`Consultations par jour : ${days.map((d) => `${formatShortDay(d.day)} ${d.views}`).join(', ')}`}>
        {days.map((d) => (
          <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-xs font-semibold text-navy-500">{d.views}</span>
            <div className="w-full rounded-t-lg bg-accent-500/80" style={{ height: `${Math.max(4, (d.views / max) * 100)}%`, opacity: d.views ? 1 : 0.25 }} />
            <span className="text-[11px] capitalize text-navy-500">{formatShortDay(d.day)}</span>
          </div>
        ))}
      </div>
      {total === 0 && <p className="mt-4 text-center text-sm text-navy-500">Aucune consultation pour le moment. Elles apparaîtront ici dès que vos clients scanneront votre QR Code.</p>}
    </Card>
  );
}

function CopyLink({ url }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* presse-papiers indisponible */ }
  };
  return (
    <Button variant="secondary" size="sm" onClick={copy} aria-live="polite">
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? 'Copié' : 'Copier'}
    </Button>
  );
}

export default function DashboardHome() {
  usePageMeta('Tableau de bord – MH Menu');
  const { subscription } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.get('/restaurant/dashboard').then((r) => setData(r.data)).catch((e) => setError(parseError(e).message));
  }, []);
  useEffect(load, [load]);

  if (error) return <div className="space-y-4"><Alert>{error}</Alert><Button variant="secondary" onClick={load}>Réessayer</Button></div>;
  if (!data) return <Spinner />;

  const url = publicMenuUrl(data.restaurant.slug);
  const empty = data.products.total === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Tableau de bord</h1>
        <p className="mt-1 text-navy-500">Vue d’ensemble de {data.restaurant.name}.</p>
      </div>

      {empty && (
        <Card className="border-accent-100 bg-accent-50/60 p-5 sm:p-6">
          <h2 className="font-bold">Bienvenue ! Commencez par construire votre carte</h2>
          <ol className="mt-3 space-y-1.5 text-sm text-navy-600">
            <li><Link className="font-semibold text-accent-700 underline" to="/dashboard/informations">1. Complétez les informations de votre restaurant</Link></li>
            <li><Link className="font-semibold text-accent-700 underline" to="/dashboard/categories">2. Créez vos catégories</Link></li>
            <li><Link className="font-semibold text-accent-700 underline" to="/dashboard/produits">3. Ajoutez vos premiers produits</Link></li>
            <li><Link className="font-semibold text-accent-700 underline" to="/dashboard/qrcodes">4. Téléchargez votre QR Code</Link></li>
          </ol>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={UtensilsCrossed} label="Produits" value={data.products.total} tone="navy" />
        <StatCard icon={LayoutGrid} label="Catégories" value={data.categories} tone="navy" />
        <StatCard icon={Eye} label="Consultations du menu" value={data.views.total} tone="accent" />
        <StatCard icon={PackageCheck} label="Produits disponibles" value={data.products.available} tone="green" />
        <StatCard icon={PackageX} label="Produits indisponibles" value={data.products.unavailable} tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <ViewsChart days={data.views.last7Days} />

        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="font-bold">Aperçu du menu public</h2>
            <p className="mt-1 text-sm text-navy-500">Votre adresse publique, identique pour toujours.</p>
            <div className="mt-4 break-all rounded-xl bg-navy-50 px-3 py-2.5 text-sm font-medium text-navy-700">{url}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CopyLink url={url} />
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-700 hover:underline"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Voir mon menu public</a>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-bold">Abonnement</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-navy-500">Offre</dt><dd className="font-semibold">{subscription?.planName ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-navy-500">Fin</dt><dd className="font-semibold">{formatDate(subscription?.endsAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-navy-500">Jours restants</dt><dd className="font-semibold">{subscription?.daysLeft ?? 0}</dd></div>
            </dl>
            <Link to="/dashboard/abonnement" className="mt-4 inline-block text-sm font-bold text-accent-700 hover:underline">Gérer mon abonnement →</Link>
          </Card>
        </div>
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold"><Activity className="h-4 w-4 text-navy-500" aria-hidden="true" /> Dernières activités</h2>
        {data.recentActivity.length === 0 ? (
          <p className="mt-3 text-sm text-navy-500">Aucune activité pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-navy-100">
            {data.recentActivity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span><span className="font-medium">{ACTIVITY_LABELS[a.action] ?? a.action}</span>{a.userName && <span className="text-navy-500"> · {a.userName}</span>}</span>
                <time className="text-xs text-navy-500" dateTime={a.createdAt}>{formatDateTime(a.createdAt)}</time>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
