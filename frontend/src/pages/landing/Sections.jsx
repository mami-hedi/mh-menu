import { useState } from 'react';
import {
  ArrowRight, BadgePercent, BarChart3, Check, ChevronDown, Clock, ImageIcon, LayoutDashboard, LayoutGrid,
  Printer, QrCode, RefreshCw, ShoppingBag, SlidersHorizontal, Smartphone, Sparkles, ToggleRight, UtensilsCrossed, X,
} from 'lucide-react';
import { ButtonLink } from '../../components/ui.jsx';

export function SectionTitle({ eyebrow, title, subtitle }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && <p className="text-sm font-bold uppercase tracking-wider text-accent-700">{eyebrow}</p>}
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-lg text-navy-500">{subtitle}</p>}
    </div>
  );
}

const PAIRS = [
  { icon: Printer, problem: 'Impression répétée des cartes', solution: 'Zéro impression : votre menu vit en ligne, derrière un QR Code qui ne change jamais.' },
  { icon: BadgePercent, problem: 'Modification difficile des prix', solution: 'Changez un prix ou une description en quelques secondes, visible immédiatement par vos clients.' },
  { icon: Clock, problem: 'Menus rapidement obsolètes', solution: 'Marquez un plat indisponible en un clic : plus de « désolé, on n’en a plus ».' },
  { icon: Sparkles, problem: 'Difficulté à présenter les nouveaux plats', solution: 'Ajoutez photos, descriptions et promotions pour mettre vos nouveautés en valeur.' },
];

export function ProblemSolution() {
  return (
    <section className="bg-white py-20" aria-labelledby="ps-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionTitle eyebrow="Pourquoi MH Menu" title="Fini les cartes papier à réimprimer" subtitle="Les menus traditionnels coûtent du temps et de l’argent. MH Menu simplifie tout." />
        <h3 id="ps-title" className="sr-only">Problèmes et solutions</h3>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {PAIRS.map(({ icon: Icon, problem, solution }) => (
            <div key={problem} className="rounded-2xl border border-navy-100 bg-navy-50/50 p-6">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-red-100 text-red-600"><X className="h-3.5 w-3.5" aria-hidden="true" /></span>
                <p className="font-semibold text-navy-500 line-through decoration-red-300">{problem}</p>
              </div>
              <div className="mt-3 flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-100 text-accent-700"><Check className="h-3.5 w-3.5" aria-hidden="true" /></span>
                <p className="font-medium text-navy-800">{solution}</p>
              </div>
              <Icon className="mt-4 h-5 w-5 text-navy-300" aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: Smartphone, title: 'Menu digital responsive', text: 'Optimisé smartphone, rapide et élégant, sur tablette comme sur ordinateur.' },
  { icon: QrCode, title: 'QR Code personnalisé', text: 'PNG, SVG, impression, logo et QR Codes par table. Il ne change jamais.' },
  { icon: LayoutGrid, title: 'Gestion des catégories', text: 'Créez, ordonnez et activez vos catégories : entrées, pizzas, boissons…' },
  { icon: UtensilsCrossed, title: 'Gestion des produits', text: 'Ajoutez, modifiez, dupliquez et ordonnez vos plats en toute simplicité.' },
  { icon: ImageIcon, title: 'Photos et descriptions', text: 'Donnez envie avec de belles photos et des descriptions appétissantes.' },
  { icon: SlidersHorizontal, title: 'Tailles et suppléments', text: 'Variantes, options obligatoires ou facultatives et suppléments payants.' },
  { icon: ShoppingBag, title: 'Panier virtuel', text: 'Vos clients préparent leur sélection et la présentent au serveur.' },
  { icon: BadgePercent, title: 'Promotions', text: 'Mettez en avant vos offres avec un prix promotionnel visible.' },
  { icon: ToggleRight, title: 'Disponible / indisponible', text: 'Signalez en un clic les produits épuisés, sans réimprimer.' },
  { icon: LayoutDashboard, title: 'Tableau de bord', text: 'Gérez tout depuis un espace clair, depuis votre téléphone ou votre ordinateur.' },
  { icon: BarChart3, title: 'Statistiques', text: 'Suivez le nombre de consultations de votre menu jour après jour.' },
  { icon: RefreshCw, title: 'Mises à jour instantanées', text: 'Une modification et c’est en ligne. Le QR Code reste identique.' },
];

export function Features() {
  return (
    <section id="fonctionnalites" className="bg-navy-950 py-20 text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-accent-400">Fonctionnalités</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Tout ce qu’il faut pour gérer votre carte</h2>
          <p className="mt-4 text-lg text-navy-200">Toutes les fonctionnalités sont incluses dans chaque abonnement.</p>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-400/15 text-accent-400"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-navy-200">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const INCLUDED = [
  'Accès à toutes les fonctionnalités',
  'Menu digital personnalisé',
  'QR Code',
  'Gestion illimitée des catégories',
  'Gestion des produits',
  'Panier virtuel',
  'Assistance technique',
];

function PlanCard({ name, price, unit, highlight, badge, note }) {
  return (
    <div className={`relative flex flex-col rounded-3xl p-8 ${highlight ? 'border-2 border-accent-500 bg-white shadow-pop' : 'border border-navy-100 bg-white shadow-card'}`}>
      {badge && <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-700 px-4 py-1 text-xs font-bold text-white">{badge}</span>}
      <h3 className="text-lg font-bold text-navy-900">{name}</h3>
      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="text-5xl font-extrabold tracking-tight text-navy-900">{price}</span>
        <span className="text-lg font-bold text-navy-900">DT</span>
        <span className="text-navy-500">/ {unit}</span>
      </p>
      <p className="mt-2 min-h-5 text-sm font-semibold text-accent-700">{note}</p>
      <ul className="mt-6 flex-1 space-y-3">
        {INCLUDED.map((i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-navy-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" aria-hidden="true" /> {i}
          </li>
        ))}
      </ul>
      <ButtonLink to="/inscription" variant={highlight ? 'accent' : 'primary'} size="lg" className="mt-8">
        Commencer l’essai gratuit
      </ButtonLink>
    </div>
  );
}

export function Pricing() {
  return (
    <section id="tarifs" className="bg-navy-50 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionTitle eyebrow="Tarifs" title="Deux offres, mêmes fonctionnalités" subtitle="Choisissez la durée qui vous convient. Sans engagement caché." />
        <div className="mx-auto mt-14 grid max-w-3xl gap-8 md:grid-cols-2">
          <PlanCard name="Offre mensuelle" price="29" unit="mois" note="Flexible, mois par mois" />
          <PlanCard name="Offre annuelle" price="290" unit="an" highlight badge="Économisez 58 DT" note="Au lieu de 348 DT en 12 mensualités" />
        </div>
      </div>
    </section>
  );
}

export function Trial() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 p-8 text-white sm:p-12">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">3 jours d’essai gratuit, sans carte bancaire</h2>
          <p className="mt-4 max-w-2xl text-lg text-navy-100">Créez votre compte, ajoutez vos plats et testez MH Menu en conditions réelles. Aucun moyen de paiement demandé pour commencer.</p>
          <ul className="mt-6 space-y-2.5 text-sm text-navy-100">
            <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" aria-hidden="true" /> À la fin de l’essai, sans abonnement, votre menu public devient temporairement indisponible.</li>
            <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" aria-hidden="true" /> Vous gardez l’accès à votre espace pour souscrire à une offre.</li>
            <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" aria-hidden="true" /> Vos données sont conservées jusqu’à votre souscription.</li>
          </ul>
          <ButtonLink to="/inscription" variant="accent" size="lg" className="mt-8">
            Créer mon menu gratuitement <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  ['Comment fonctionne MH Menu ?', 'Vous créez votre compte, ajoutez vos catégories et vos produits depuis votre tableau de bord, puis imprimez votre QR Code. Vos clients le scannent avec leur smartphone et consultent votre menu à jour.'],
  ['Dois-je installer une application ?', 'Non. Tout fonctionne directement dans le navigateur, côté restaurateur comme côté client. Rien à télécharger.'],
  ['Comment créer mon QR Code ?', 'Votre QR Code est généré automatiquement pour votre restaurant. Vous pourrez le télécharger en PNG ou SVG, l’imprimer et même créer des QR Codes distincts par table.'],
  ['Puis-je modifier les prix ?', 'Oui, à tout moment. Modifiez un prix, une description ou la disponibilité d’un plat : la mise à jour est visible immédiatement, sans réimpression. Votre QR Code reste le même.'],
  ['Puis-je ajouter des photos ?', 'Oui. Vous pouvez illustrer vos catégories et vos produits avec des photos, et même ajouter plusieurs photos par produit.'],
  ['Comment fonctionne le panier ?', 'Le panier est facultatif. Vos clients y ajoutent des produits, choisissent tailles et suppléments, puis touchent « Présenter au serveur » pour afficher un récapitulatif. Aucune commande n’est envoyée automatiquement : c’est le serveur qui prend la commande. Vous pouvez désactiver le panier.'],
  ['Puis-je utiliser MH Menu sur tablette ?', 'Oui. Le tableau de bord et le menu public s’adaptent aux smartphones, tablettes et ordinateurs.'],
  ['Combien coûte l’abonnement ?', '29 DT par mois ou 290 DT par an (soit 58 DT d’économie par rapport à douze mensualités). Les deux offres donnent accès aux mêmes fonctionnalités.'],
  ['Comment fonctionne l’essai gratuit ?', 'Chaque nouveau restaurant bénéficie de 3 jours d’essai gratuit, sans carte bancaire. À la fin, sans abonnement, le menu public est temporairement indisponible mais vous gardez l’accès à votre espace pour souscrire.'],
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <section id="faq" className="bg-white py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionTitle eyebrow="FAQ" title="Questions fréquentes" />
        <div className="mt-12 divide-y divide-navy-100 rounded-2xl border border-navy-100">
          {FAQ.map(([q, a], i) => {
            const open = openIndex === i;
            return (
              <div key={q}>
                <h3>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-navy-900 hover:bg-navy-50"
                    aria-expanded={open}
                    aria-controls={`faq-${i}`}
                    onClick={() => setOpenIndex(open ? -1 : i)}
                  >
                    {q}
                    <ChevronDown className={`h-5 w-5 shrink-0 text-navy-500 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                </h3>
                {open && <p id={`faq-${i}`} className="px-5 pb-5 leading-relaxed text-navy-600">{a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
