import { useMemo, useState } from 'react';
import { Minus, Plus, Search, ShoppingBag, X } from 'lucide-react';
import { SectionTitle } from './Sections.jsx';
import { formatDT } from '../../lib/format.js';

// Restaurant fictif de démonstration : les données restent dans le navigateur, rien n'est envoyé.
const CATEGORIES = [
  { id: 'pizzas', name: 'Pizzas' },
  { id: 'burgers', name: 'Burgers' },
  { id: 'desserts', name: 'Desserts' },
  { id: 'boissons', name: 'Boissons' },
];

const SIZES = [
  { name: 'Moyenne', delta: 0 },
  { name: 'Grande', delta: 4 },
];

const PRODUCTS = [
  { id: 1, cat: 'pizzas', name: 'Margherita', desc: 'Tomate, mozzarella, basilic frais.', price: 12, emoji: '🍕', bg: 'from-amber-100 to-orange-100', popular: true, variants: SIZES, extras: [{ name: 'Fromage supplémentaire', price: 2 }, { name: 'Olives', price: 1 }] },
  { id: 2, cat: 'pizzas', name: 'Reine', desc: 'Jambon, champignons, mozzarella.', price: 15, promo: 13, emoji: '🍕', bg: 'from-rose-100 to-amber-100', variants: SIZES, extras: [{ name: 'Fromage supplémentaire', price: 2 }, { name: 'Œuf', price: 1.5 }] },
  { id: 3, cat: 'pizzas', name: 'Quatre fromages', desc: 'Mozzarella, gorgonzola, chèvre, parmesan.', price: 17, emoji: '🧀', bg: 'from-yellow-100 to-amber-100', unavailable: true, variants: SIZES, extras: [] },
  { id: 4, cat: 'burgers', name: 'Burger Maison', desc: 'Bœuf, cheddar, oignons caramélisés.', price: 16, emoji: '🍔', bg: 'from-orange-100 to-red-100', popular: true, variants: [{ name: 'Simple', delta: 0 }, { name: 'Double', delta: 5 }], extras: [{ name: 'Bacon', price: 2.5 }, { name: 'Frites', price: 3 }] },
  { id: 5, cat: 'burgers', name: 'Chicken Crispy', desc: 'Poulet croustillant, salade, sauce ranch.', price: 14, emoji: '🍗', bg: 'from-amber-100 to-yellow-100', variants: [{ name: 'Simple', delta: 0 }, { name: 'Double', delta: 4 }], extras: [{ name: 'Frites', price: 3 }] },
  { id: 6, cat: 'desserts', name: 'Tiramisu', desc: 'Mascarpone, café, cacao.', price: 7, emoji: '🍰', bg: 'from-stone-100 to-amber-100', variants: [], extras: [] },
  { id: 7, cat: 'desserts', name: 'Crêpe Nutella', desc: 'Pâte à tartiner, banane en option.', price: 6, emoji: '🥞', bg: 'from-amber-100 to-orange-100', variants: [], extras: [{ name: 'Banane', price: 1 }] },
  { id: 8, cat: 'boissons', name: 'Limonade maison', desc: 'Citron frais et menthe.', price: 4, emoji: '🍋', bg: 'from-lime-100 to-yellow-100', variants: [{ name: '33 cl', delta: 0 }, { name: '50 cl', delta: 1.5 }], extras: [] },
  { id: 9, cat: 'boissons', name: 'Café', desc: 'Expresso ou allongé.', price: 2.5, emoji: '☕', bg: 'from-stone-200 to-amber-100', variants: [], extras: [] },
];

const unitPrice = (line) =>
  (line.product.promo ?? line.product.price) + (line.variant?.delta ?? 0) + line.extras.reduce((s, e) => s + e.price, 0);

function ProductModal({ product, onClose, onAdd }) {
  const [variant, setVariant] = useState(product.variants[0] ?? null);
  const [extras, setExtras] = useState([]);
  const [qty, setQty] = useState(1);
  const line = { product, variant, extras };
  const total = unitPrice(line) * qty;
  const toggle = (e) => setExtras((cur) => (cur.some((x) => x.name === e.name) ? cur.filter((x) => x.name !== e.name) : [...cur, e]));

  return (
    <div className="absolute inset-0 z-20 flex items-end bg-navy-950/50" role="dialog" aria-modal="true" aria-label={product.name}>
      <div className="max-h-full w-full overflow-y-auto rounded-t-3xl bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-lg font-extrabold">{product.name}</h4>
            <p className="mt-1 text-sm text-navy-500">{product.desc}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-navy-500 hover:bg-navy-50" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>

        {product.variants.length > 0 && (
          <fieldset className="mt-4">
            <legend className="text-sm font-bold">Taille <span className="font-medium text-navy-500">· obligatoire</span></legend>
            <div className="mt-2 space-y-2">
              {product.variants.map((v) => (
                <label key={v.name} className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-2.5 text-sm ${variant?.name === v.name ? 'border-accent-500 bg-accent-50' : 'border-navy-100'}`}>
                  <span className="flex items-center gap-2.5">
                    <input type="radio" name="variant" className="accent-accent-600" checked={variant?.name === v.name} onChange={() => setVariant(v)} />
                    {v.name}
                  </span>
                  <span className="text-navy-500">{v.delta ? `+${formatDT(v.delta)}` : 'Inclus'}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {product.extras.length > 0 && (
          <fieldset className="mt-4">
            <legend className="text-sm font-bold">Suppléments <span className="font-medium text-navy-500">· facultatif</span></legend>
            <div className="mt-2 space-y-2">
              {product.extras.map((e) => (
                <label key={e.name} className="flex cursor-pointer items-center justify-between rounded-xl border border-navy-100 px-4 py-2.5 text-sm">
                  <span className="flex items-center gap-2.5">
                    <input type="checkbox" className="accent-accent-600" checked={extras.some((x) => x.name === e.name)} onChange={() => toggle(e)} />
                    {e.name}
                  </span>
                  <span className="text-navy-500">+{formatDT(e.price)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="mt-5 flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-navy-100">
            <button type="button" className="p-2.5 text-navy-600 hover:bg-navy-50" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuer la quantité"><Minus className="h-4 w-4" /></button>
            <span className="w-8 text-center text-sm font-bold" aria-live="polite">{qty}</span>
            <button type="button" className="p-2.5 text-navy-600 hover:bg-navy-50" onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Augmenter la quantité"><Plus className="h-4 w-4" /></button>
          </div>
          <button type="button" onClick={() => onAdd({ ...line, qty })} className="flex-1 rounded-xl bg-navy-900 px-4 py-3 text-sm font-bold text-white hover:bg-navy-800">
            Ajouter · {formatDT(total)}
          </button>
        </div>
      </div>
    </div>
  );
}

function CartPanel({ lines, setLines, onClose }) {
  const [presenting, setPresenting] = useState(false);
  const total = lines.reduce((s, l) => s + unitPrice(l) * l.qty, 0);
  const setQty = (key, delta) => setLines((cur) => cur.flatMap((l) => (l.key !== key ? [l] : l.qty + delta <= 0 ? [] : [{ ...l, qty: l.qty + delta }])));
  const setNote = (key, note) => setLines((cur) => cur.map((l) => (l.key === key ? { ...l, note } : l)));
  const detail = (l) => [l.variant?.name, ...l.extras.map((e) => `+ ${e.name}`)].filter(Boolean).join(' · ');

  if (presenting) {
    return (
      <div className="absolute inset-0 z-30 overflow-y-auto bg-white p-5" role="dialog" aria-modal="true" aria-label="Récapitulatif à présenter au serveur">
        <p className="text-center text-xs font-bold uppercase tracking-wider text-accent-700">Montrez cet écran au serveur</p>
        <h4 className="mt-1 text-center text-xl font-extrabold">Récapitulatif de ma sélection</h4>
        <p className="mt-1 text-center text-xs text-navy-500">Chez Jasmin · Table 5</p>
        <ul className="mt-5 divide-y divide-navy-100">
          {lines.map((l) => (
            <li key={l.key} className="flex items-start justify-between gap-3 py-3 text-sm">
              <div>
                <span className="font-bold">{l.qty} × {l.product.name}</span>
                {detail(l) && <div className="text-xs text-navy-500">{detail(l)}</div>}
                {l.note && <div className="mt-0.5 text-xs italic text-navy-600">« {l.note} »</div>}
              </div>
              <span className="font-semibold">{formatDT(unitPrice(l) * l.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between border-t-2 border-navy-900 pt-3 text-base font-extrabold"><span>Total</span><span>{formatDT(total)}</span></div>
        <p className="mt-4 rounded-xl bg-navy-50 p-3 text-center text-xs text-navy-500">Ceci n’est pas une commande : c’est le serveur qui la prendra avec vous.</p>
        <button type="button" onClick={() => setPresenting(false)} className="mt-4 w-full rounded-xl border border-navy-200 py-3 text-sm font-semibold hover:bg-navy-50">Retour au panier</button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 flex items-end bg-navy-950/50" role="dialog" aria-modal="true" aria-label="Mon panier">
      <div className="flex max-h-full w-full flex-col rounded-t-3xl bg-white">
        <div className="flex items-center justify-between p-5 pb-3">
          <h4 className="text-lg font-extrabold">Mon panier</h4>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-navy-500 hover:bg-navy-50" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5">
          {lines.length === 0 ? (
            <p className="py-10 text-center text-sm text-navy-500">Votre panier est vide.</p>
          ) : (
            <ul className="divide-y divide-navy-100">
              {lines.map((l) => (
                <li key={l.key} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      <div className="font-bold">{l.product.name}</div>
                      {detail(l) && <div className="text-xs text-navy-500">{detail(l)}</div>}
                    </div>
                    <div className="text-sm font-semibold">{formatDT(unitPrice(l) * l.qty)}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-navy-100">
                      <button type="button" className="p-1.5 hover:bg-navy-50" onClick={() => setQty(l.key, -1)} aria-label={`Retirer un ${l.product.name}`}><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-7 text-center text-xs font-bold">{l.qty}</span>
                      <button type="button" className="p-1.5 hover:bg-navy-50" onClick={() => setQty(l.key, 1)} aria-label={`Ajouter un ${l.product.name}`}><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <input
                      value={l.note}
                      maxLength={80}
                      onChange={(e) => setNote(l.key, e.target.value)}
                      placeholder="Remarque (ex. sans oignon)"
                      aria-label={`Remarque pour ${l.product.name}`}
                      className="min-w-0 flex-1 rounded-lg border border-navy-100 px-3 py-1.5 text-xs placeholder:text-navy-300 focus:border-accent-500 focus:outline-none"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-navy-100 p-5">
          <div className="mb-3 flex items-center justify-between font-extrabold"><span>Total</span><span>{formatDT(total)}</span></div>
          <button type="button" disabled={lines.length === 0} onClick={() => setPresenting(true)} className="w-full rounded-xl bg-accent-700 py-3 text-sm font-bold text-white hover:bg-accent-800 disabled:opacity-50">
            Présenter au serveur
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Demo() {
  const [category, setCategory] = useState('pizzas');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [lines, setLines] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () => PRODUCTS.filter((p) => (q ? `${p.name} ${p.desc}`.toLowerCase().includes(q) : p.cat === category)),
    [category, q]
  );
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + unitPrice(l) * l.qty, 0);

  const addLine = (line) => {
    setLines((cur) => {
      const key = [line.product.id, line.variant?.name, ...line.extras.map((e) => e.name).sort()].join('|');
      const found = cur.find((l) => l.key === key);
      if (found) return cur.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + line.qty) } : l));
      return [...cur, { ...line, key, note: '' }];
    });
    setSelected(null);
  };

  return (
    <section id="demo" className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionTitle eyebrow="Démonstration" title="Essayez le menu comme un client" subtitle="Voici le menu d’un restaurant fictif. Parcourez les catégories, choisissez une taille, ajoutez des suppléments et remplissez le panier." />
        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr]">
          <ul className="hidden space-y-4 text-navy-600 lg:block">
            <li className="rounded-2xl bg-navy-50 p-4"><strong className="text-navy-900">Navigation rapide</strong><br />Catégories et recherche instantanée.</li>
            <li className="rounded-2xl bg-navy-50 p-4"><strong className="text-navy-900">Variantes et suppléments</strong><br />Tailles obligatoires, options facultatives.</li>
          </ul>

          <div className="relative mx-auto h-[640px] w-full max-w-[340px] overflow-hidden rounded-[2.5rem] border-[8px] border-navy-900 bg-white shadow-pop">
            <div className="flex h-full flex-col">
              <div className="bg-navy-900 px-4 pb-4 pt-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-400 text-xl" aria-hidden="true">🍽️</div>
                  <div>
                    <div className="font-bold">Chez Jasmin</div>
                    <div className="text-xs text-navy-200">Restaurant fictif · Démo</div>
                  </div>
                </div>
                <label className="relative mt-3 block">
                  <span className="sr-only">Rechercher un produit</span>
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" aria-hidden="true" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un plat…" className="w-full rounded-xl bg-white/10 py-2 pl-9 pr-3 text-sm text-white placeholder:text-navy-300 focus:bg-white/20 focus:outline-none" />
                </label>
              </div>

              <div className="flex gap-2 overflow-x-auto px-3 py-3" role="tablist" aria-label="Catégories">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={!q && category === c.id}
                    onClick={() => { setCategory(c.id); setSearch(''); }}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${!q && category === c.id ? 'bg-navy-900 text-white' : 'bg-navy-50 text-navy-600 hover:bg-navy-100'}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto px-3 pb-24">
                {visible.length === 0 && <p className="py-10 text-center text-sm text-navy-500">Aucun produit trouvé.</p>}
                {visible.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={p.unavailable}
                    onClick={() => setSelected(p)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-navy-100 p-2.5 text-left transition hover:border-accent-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-3xl ${p.bg}`} aria-hidden="true">{p.emoji}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold">{p.name}</span>
                        {p.popular && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Populaire</span>}
                      </div>
                      <div className="line-clamp-2 text-xs text-navy-500">{p.desc}</div>
                      {p.unavailable && <div className="mt-0.5 text-xs font-bold text-red-600">Indisponible</div>}
                    </div>
                    <div className="text-right text-sm font-extrabold">
                      {p.promo ? (<><div className="text-accent-700">{formatDT(p.promo)}</div><div className="text-[11px] font-medium text-navy-500 line-through">{formatDT(p.price)}</div></>) : formatDT(p.price)}
                    </div>
                  </button>
                ))}
              </div>

              {count > 0 && (
                <button type="button" onClick={() => setCartOpen(true)} className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-between rounded-2xl bg-accent-700 px-4 py-3 text-sm font-bold text-white shadow-pop hover:bg-accent-800">
                  <span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" aria-hidden="true" /> Voir mon panier · {count} article{count > 1 ? 's' : ''}</span>
                  <span>{formatDT(total)}</span>
                </button>
              )}
            </div>

            {selected && <ProductModal key={selected.id} product={selected} onClose={() => setSelected(null)} onAdd={addLine} />}
            {cartOpen && <CartPanel lines={lines} setLines={setLines} onClose={() => setCartOpen(false)} />}
          </div>

          <ul className="hidden space-y-4 text-navy-600 lg:block">
            <li className="rounded-2xl bg-navy-50 p-4"><strong className="text-navy-900">Panier virtuel</strong><br />Quantités, remarques, total calculé.</li>
            <li className="rounded-2xl bg-navy-50 p-4"><strong className="text-navy-900">Présenter au serveur</strong><br />Aucune commande automatique : le serveur reste maître de la prise de commande.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
