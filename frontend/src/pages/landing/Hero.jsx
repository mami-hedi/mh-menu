import { ArrowRight, BadgeCheck, CreditCard, Smartphone as PhoneIcon, Play } from 'lucide-react';
import { ButtonLink } from '../../components/ui.jsx';

/** QR Code purement décoratif (motif déterministe, non scannable) pour l'illustration. */
function QrArt({ size = 21, className = '' }) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const finder = (x, y) => (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
  const cells = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (finder(x, y)) continue;
      if (rnd() > 0.52) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
    }
  const Finder = ({ x, y }) => (
    <g transform={`translate(${x} ${y})`}>
      <rect width="7" height="7" />
      <rect x="1" y="1" width="5" height="5" fill="#fff" />
      <rect x="2" y="2" width="3" height="3" />
    </g>
  );
  return (
    <svg viewBox={`-1 -1 ${size + 2} ${size + 2}`} className={className} fill="#0B1F4B" aria-hidden="true">
      <rect x="-1" y="-1" width={size + 2} height={size + 2} fill="#fff" />
      {cells}
      <Finder x={0} y={0} />
      <Finder x={size - 7} y={0} />
      <Finder x={0} y={size - 7} />
    </svg>
  );
}

const ITEMS = [
  { emoji: '🍕', name: 'Margherita', price: '12 DT', bg: 'from-amber-100 to-orange-100' },
  { emoji: '🍔', name: 'Burger Maison', price: '16 DT', bg: 'from-rose-100 to-orange-100' },
  { emoji: '🥗', name: 'Salade Fraîcheur', price: '9 DT', bg: 'from-emerald-100 to-lime-100' },
];

function PhoneMock() {
  return (
    <div className="relative mx-auto w-[260px] animate-float sm:w-[290px]" aria-hidden="true">
      <div className="rounded-[2.6rem] border-[7px] border-navy-900 bg-white shadow-pop">
        <div className="overflow-hidden rounded-[2rem]">
          <div className="bg-navy-900 px-4 pb-4 pt-6 text-white">
            <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-white/20" />
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-400 text-lg">🍽️</div>
              <div>
                <div className="text-sm font-bold">Chez Jasmin</div>
                <div className="text-[11px] text-navy-200">Ouvert · 11h – 23h</div>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 overflow-hidden px-3 py-2.5 text-[11px] font-semibold">
            <span className="rounded-full bg-navy-900 px-3 py-1 text-white">Pizzas</span>
            <span className="rounded-full bg-navy-50 px-3 py-1 text-navy-600">Burgers</span>
            <span className="rounded-full bg-navy-50 px-3 py-1 text-navy-600">Desserts</span>
          </div>
          <div className="space-y-2 px-3 pb-4">
            {ITEMS.map((it) => (
              <div key={it.name} className="flex items-center gap-3 rounded-2xl border border-navy-100 p-2">
                <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-2xl ${it.bg}`}>{it.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">{it.name}</div>
                  <div className="text-[11px] text-navy-500">Sauce maison</div>
                </div>
                <div className="text-[13px] font-extrabold text-accent-700">{it.price}</div>
              </div>
            ))}
            <div className="mt-1 rounded-xl bg-accent-700 py-2.5 text-center text-xs font-bold text-white">Voir mon panier · 2 articles</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section id="accueil" className="relative overflow-hidden bg-gradient-to-b from-navy-50 via-white to-white">
      <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-accent-400/15 blur-3xl" aria-hidden="true" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24 lg:pt-16">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50 px-3.5 py-1.5 text-xs font-bold text-accent-700">
            <PhoneIcon className="h-3.5 w-3.5" aria-hidden="true" /> Aucune application à installer
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-navy-900 sm:text-5xl lg:text-6xl">
            Votre menu digital, accessible en un <span className="text-accent-500">simple scan.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-navy-600">
            Modernisez votre restaurant avec MH Menu. Présentez vos plats, vos prix et vos promotions grâce à un menu digital accessible partout, depuis un simple QR Code.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink to="/inscription" size="lg" className="whitespace-nowrap">
              Créer mon menu gratuitement <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="#demo" variant="secondary" size="lg" className="whitespace-nowrap">
              <Play className="h-4 w-4" aria-hidden="true" /> Découvrir la démonstration
            </ButtonLink>
          </div>
          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-navy-600">
            <li className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-accent-500" aria-hidden="true" /> 3 jours d'essai gratuit</li>
            <li className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-accent-500" aria-hidden="true" /> Sans carte bancaire</li>
            <li className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-accent-500" aria-hidden="true" /> Prêt en quelques minutes</li>
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <PhoneMock />
          <div className="absolute -bottom-4 left-0 w-40 rotate-[-6deg] rounded-2xl border border-navy-100 bg-white p-3 shadow-pop sm:left-4 sm:w-44" aria-hidden="true">
            <QrArt className="w-full" />
            <div className="mt-2 text-center text-[11px] font-bold text-navy-700">Scannez pour voir le menu</div>
          </div>
        </div>
      </div>
    </section>
  );
}
