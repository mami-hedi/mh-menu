import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Clock, Globe, MapPin, Phone, Plus, Search, ShoppingBag, Star, MessageCircle, Link2, UtensilsCrossed } from 'lucide-react';
import { api, parseError } from '../../services/api.js';
import { formatDT, optimizeImage } from '../../lib/format.js';
import { useCart } from './cart.js';
import ProductSheet, { Price } from './ProductSheet.jsx';
import CartPanel from './CartPanel.jsx';

const DAYS = [['mon', 'Lundi'], ['tue', 'Mardi'], ['wed', 'Mercredi'], ['thu', 'Jeudi'], ['fri', 'Vendredi'], ['sat', 'Samedi'], ['sun', 'Dimanche']];
const TODAY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];

/** Couleur de texte lisible (blanc ou presque noir) sur la couleur de marque du restaurant. */
function brandColors(primary) {
  const hex = /^#[0-9a-f]{6}$/i.test(primary ?? '') ? primary : '#0B1F4B';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { bg: hex, fg: lum > 0.5 ? '#111827' : '#ffffff' };
}

function usePublicMeta(name, allowIndexing) {
  useEffect(() => {
    const prevTitle = document.title;
    if (name) document.title = `${name} – Menu`;
    let robots = document.querySelector('meta[name="robots"]');
    const created = !robots;
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots); }
    const prev = robots.getAttribute('content');
    robots.setAttribute('content', allowIndexing ? 'index,follow' : 'noindex,nofollow');
    return () => { document.title = prevTitle; if (created) robots.remove(); else if (prev != null) robots.setAttribute('content', prev); };
  }, [name, allowIndexing]);
}

function Badges({ product }) {
  return (
    <>
      {product.promoPrice != null && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">Promo</span>}
      {product.isPopular && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800"><Star className="h-3 w-3" aria-hidden="true" /> Populaire</span>}
      {!product.isAvailable && <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-bold text-neutral-700">Indisponible</span>}
    </>
  );
}

function AddButton({ product, brand, onQuick, onOpen }) {
  const simple = product.variants.length === 0 && product.extras.length === 0;
  return (
    <button
      type="button"
      aria-label={`Ajouter ${product.name}`}
      onClick={(e) => { e.stopPropagation(); simple ? onQuick(product) : onOpen(product); }}
      style={{ background: brand.bg, color: brand.fg }}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full shadow-sm active:opacity-90"
    >
      <Plus className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

function ProductCard({ product, template, cartEnabled, brand, onOpen, onQuick }) {
  const img = product.images[0];
  const dim = product.isAvailable ? '' : 'opacity-60';
  const canAdd = cartEnabled && product.isAvailable;
  const open = () => onOpen(product);
  const wrap = 'w-full text-left';

  if (template === 'modern') {
    return (
      <li className={dim}>
        <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <button type="button" onClick={open} className={`${wrap} block`}>
            {img ? <img src={optimizeImage(img, 700)} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" /> : <div className="grid aspect-[16/10] w-full place-items-center bg-neutral-100 text-neutral-300"><UtensilsCrossed className="h-10 w-10" aria-hidden="true" /></div>}
            <div className="p-4 pr-16">
              <div className="flex flex-wrap items-center gap-1.5"><h3 className="font-extrabold leading-snug">{product.name}</h3><Badges product={product} /></div>
              {product.description && <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{product.description}</p>}
              <Price product={product} className="mt-2 block text-base" />
            </div>
          </button>
          {canAdd && <div className="absolute bottom-4 right-4"><AddButton product={product} brand={brand} onQuick={onQuick} onOpen={onOpen} /></div>}
        </div>
      </li>
    );
  }

  if (template === 'compact') {
    return (
      <li className={`flex items-center gap-3 py-3 ${dim}`}>
        <button type="button" onClick={open} className={`${wrap} flex min-w-0 flex-1 items-center gap-3`}>
          {img && <img src={optimizeImage(img, 120)} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5"><span className="font-bold leading-snug">{product.name}</span><Badges product={product} /></span>
            {product.description && <span className="block truncate text-xs text-neutral-500">{product.description}</span>}
          </span>
          <Price product={product} className="shrink-0 text-sm" />
        </button>
        {canAdd && <AddButton product={product} brand={brand} onQuick={onQuick} onOpen={onOpen} />}
      </li>
    );
  }

  // classic
  return (
    <li className={`flex items-stretch gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm ${dim}`}>
      <button type="button" onClick={open} className={`${wrap} min-w-0 flex-1`}>
        <span className="flex flex-wrap items-center gap-1.5"><span className="font-extrabold leading-snug">{product.name}</span><Badges product={product} /></span>
        {product.description && <span className="mt-1 line-clamp-2 block text-sm text-neutral-500">{product.description}</span>}
        <Price product={product} className="mt-2 block" />
      </button>
      <div className="relative shrink-0">
        {img ? <img src={optimizeImage(img, 240)} alt="" loading="lazy" className="h-24 w-24 rounded-xl object-cover" /> : <div className="grid h-24 w-24 place-items-center rounded-xl bg-neutral-100 text-neutral-300"><UtensilsCrossed className="h-7 w-7" aria-hidden="true" /></div>}
        {canAdd && <div className="absolute -bottom-2 -right-2"><AddButton product={product} brand={brand} onQuick={onQuick} onOpen={onOpen} /></div>}
      </div>
    </li>
  );
}

function Hours({ hours }) {
  const [open, setOpen] = useState(false);
  if (!hours) return null;
  const today = hours[TODAY];
  const fmt = (h) => (!h ? '—' : h.closed ? 'Fermé' : `${h.open} – ${h.close}`);
  return (
    <div className="text-sm">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex items-center gap-2 font-medium text-neutral-700">
        <Clock className="h-4 w-4 text-neutral-500" aria-hidden="true" /> Aujourd’hui : {fmt(today)} <span className="text-xs text-neutral-500 underline">{open ? 'Masquer' : 'Horaires'}</span>
      </button>
      {open && (
        <dl className="mt-2 grid max-w-xs grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-neutral-50 p-3">
          {DAYS.map(([d, label]) => (
            <div key={d} className={`contents ${d === TODAY ? 'font-bold' : 'text-neutral-600'}`}><dt>{label}</dt><dd className="text-right">{fmt(hours[d])}</dd></div>
          ))}
        </dl>
      )}
    </div>
  );
}

function Social({ links }) {
  const items = [
    links.website && { href: links.website, label: 'Site web', icon: Globe },
    links.facebook && { href: links.facebook, label: 'Facebook', icon: Link2 },
    links.instagram && { href: links.instagram, label: 'Instagram', icon: Link2 },
    links.tiktok && { href: links.tiktok, label: 'TikTok', icon: Link2 },
    links.whatsapp && { href: `https://wa.me/${links.whatsapp.replace(/\D/g, '')}`, label: 'WhatsApp', icon: MessageCircle },
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ href, label, icon: Icon }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
        </a>
      ))}
    </div>
  );
}

function Message({ title, text }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-neutral-50 px-6 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-neutral-500 shadow-sm"><UtensilsCrossed className="h-7 w-7" aria-hidden="true" /></span>
        <h1 className="mt-5 text-xl font-extrabold">{title}</h1>
        <p className="mt-2 text-neutral-500">{text}</p>
        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-neutral-600 underline">MH Menu</Link>
      </div>
    </main>
  );
}

export default function PublicMenu() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const tableParam = params.get('table')?.slice(0, 40) || '';
  const [state, setState] = useState({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef();

  const load = useCallback(() => {
    api.get(`/public/menu/${encodeURIComponent(slug)}`, { params: tableParam ? { table: tableParam } : {} })
      .then((r) => setState({ status: 'ok', data: r.data }))
      .catch((e) => {
        const err = parseError(e);
        setState({ status: e.response?.status === 404 ? 'notfound' : e.response?.data?.error?.code === 'MENU_UNAVAILABLE' ? 'unavailable' : 'error', message: err.message });
      });
  }, [slug, tableParam]);
  useEffect(load, [load]);

  const data = state.status === 'ok' ? state.data : null;
  usePublicMeta(data?.restaurant.name, data?.menu.allowIndexing);

  // Une consultation par session de navigation (le serveur applique en plus sa propre déduplication)
  useEffect(() => {
    if (!data) return;
    const key = `mhmenu-viewed-${slug}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* ignoré */ }
    api.post(`/public/menu/${encodeURIComponent(slug)}/view`, null, { params: tableParam ? { table: tableParam } : {} }).catch(() => {});
  }, [data, slug, tableParam]);

  const cart = useCart(slug, data);
  const brand = useMemo(() => brandColors(data?.restaurant.primaryColor), [data]);

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1800);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const quickAdd = (p) => { cart.add(p.id, null, [], 1); flash(`${p.name} ajouté`); };
  const sheetAdd = (id, variantId, extraIds, qty) => { cart.add(id, variantId, extraIds, qty); setSelected(null); flash('Ajouté au panier'); };

  const categories = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.categories;
    return data.categories
      .map((c) => ({ ...c, products: c.products.filter((p) => `${p.name} ${p.description ?? ''}`.toLowerCase().includes(q)) }))
      .filter((c) => c.products.length);
  }, [data, query]);

  // Catégorie active dans la barre de navigation selon le défilement
  useEffect(() => {
    if (!categories.length || typeof IntersectionObserver === 'undefined') return undefined;
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(Number(vis.target.dataset.cat));
    }, { rootMargin: '-120px 0px -65% 0px' });
    document.querySelectorAll('[data-cat]').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [categories]);

  // Première catégorie active à l'ouverture
  useEffect(() => { if (categories.length && active == null) setActive(categories[0].id); }, [categories, active]);

  // La barre de catégories suit la catégorie active (défilement horizontal uniquement, sans bouger la page)
  const navRef = useRef(null);
  useEffect(() => {
    const nav = navRef.current;
    const chip = nav?.querySelector('[aria-current="true"]');
    if (!nav || !chip) return;
    const left = chip.offsetLeft - (nav.clientWidth - chip.offsetWidth) / 2;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    nav.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' });
  }, [active]);

  if (state.status === 'loading') return <div className="grid min-h-dvh place-items-center text-neutral-500" role="status">Chargement du menu…</div>;
  if (state.status === 'notfound') return <Message title="Menu introuvable" text="Ce lien ne correspond à aucun restaurant. Vérifiez l’adresse ou scannez de nouveau le QR Code." />;
  if (state.status === 'unavailable') return <Message title="Menu momentanément indisponible" text="Ce menu n’est pas consultable pour le moment. Merci de demander la carte à l’équipe du restaurant." />;
  if (state.status === 'error') return (
    <Message title="Impossible de charger le menu" text={`${state.message} Vérifiez votre connexion puis réessayez.`} />
  );

  const { restaurant: r, menu } = data;
  const table = data.table;
  const cartEnabled = menu.cartEnabled;
  const goTo = (id) => { setActive(id); document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const listCls = menu.template === 'modern' ? 'grid gap-4 sm:grid-cols-2' : menu.template === 'compact' ? 'divide-y divide-neutral-100' : 'space-y-3';

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900" style={{ '--brand': brand.bg }}>
      <header className="bg-white">
        <div className="relative h-36 w-full sm:h-48" style={{ background: `linear-gradient(135deg, ${brand.bg}, ${r.secondaryColor || brand.bg})` }}>
          {r.coverUrl && <img src={optimizeImage(r.coverUrl, 1200)} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-5">
          <div className="relative z-10 -mt-10 flex items-end gap-4">
            {r.logoUrl ? (
              <img src={optimizeImage(r.logoUrl, 200)} alt={`Logo ${r.name}`} className="h-20 w-20 rounded-2xl border-4 border-white bg-white object-cover shadow" />
            ) : (
              <span style={{ background: brand.bg, color: brand.fg }} className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-white text-3xl font-extrabold shadow" aria-hidden="true">{r.name.charAt(0).toUpperCase()}</span>
            )}
            {table && <span style={{ background: brand.bg, color: brand.fg }} className="mb-1 rounded-full px-3 py-1 text-sm font-bold">Table {table}</span>}
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{r.name}</h1>
          {r.description && <p className="mt-1 whitespace-pre-line text-sm text-neutral-600">{r.description}</p>}
          <div className="mt-3 space-y-2 text-sm text-neutral-700">
            {r.address && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" /> {r.address}</p>}
            {r.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-neutral-500" aria-hidden="true" /> <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`} className="font-medium underline">{r.phone}</a></p>}
            <Hours hours={r.openingHours} />
          </div>
          <div className="mt-3"><Social links={r.socialLinks ?? {}} /></div>
        </div>
      </header>

      <div className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 pt-3">
          <label className="relative block">
            <span className="sr-only">Rechercher un plat</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un plat…" className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-neutral-400" />
          </label>
          <nav ref={navRef} aria-label="Catégories" className="relative -mx-4 flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((c) => (
              <button key={c.id} type="button" onClick={() => goTo(c.id)} aria-current={active === c.id ? 'true' : undefined}
                style={active === c.id ? { background: brand.bg, color: brand.fg, borderColor: brand.bg } : undefined}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold ${active === c.id ? '' : 'border-neutral-200 bg-white text-neutral-700'}`}>
                {c.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className={`mx-auto max-w-3xl space-y-9 px-4 py-6 ${cartEnabled && cart.count > 0 ? 'pb-28' : 'pb-16'}`}>
        {data.categories.length === 0 && <p className="py-16 text-center text-neutral-500">La carte de ce restaurant est en cours de préparation.</p>}
        {data.categories.length > 0 && categories.length === 0 && <p className="py-16 text-center text-neutral-500" role="status">Aucun plat ne correspond à « {query} ».</p>}
        {categories.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} data-cat={c.id} className="scroll-mt-36" aria-labelledby={`cat-title-${c.id}`}>
            <h2 id={`cat-title-${c.id}`} className="text-xl font-extrabold tracking-tight">{c.name}</h2>
            {c.description && <p className="mt-0.5 text-sm text-neutral-500">{c.description}</p>}
            <ul className={`mt-4 ${listCls}`}>
              {c.products.map((p) => (
                <ProductCard key={p.id} product={p} template={menu.template} cartEnabled={cartEnabled} brand={brand} onOpen={setSelected} onQuick={quickAdd} />
              ))}
            </ul>
          </section>
        ))}
        <footer className="pt-4 text-center text-xs text-neutral-500">
          Prix en dinars tunisiens (DT). <Link to="/" className="font-semibold underline">Menu créé avec MH Menu</Link>
        </footer>
      </main>

      {cartEnabled && cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => setCartOpen(true)} style={{ background: brand.bg, color: brand.fg }} className="mx-auto flex w-full max-w-3xl items-center justify-between rounded-full px-5 py-3.5 font-bold shadow-xl active:opacity-90">
            <span className="flex items-center gap-2"><ShoppingBag className="h-5 w-5" aria-hidden="true" /> Voir mon panier <span className="rounded-full bg-white/25 px-2 text-sm" aria-label={`${cart.count} article${cart.count > 1 ? 's' : ''}`}>{cart.count}</span></span>
            <span>{formatDT(cart.total)}</span>
          </button>
        </div>
      )}

      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-16 z-[60] flex justify-center px-4">
        {toast && <span className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">{toast}</span>}
      </div>

      {selected && <ProductSheet product={selected} cartEnabled={cartEnabled} brand={brand} onClose={() => setSelected(null)} onAdd={sheetAdd} />}
      {cartOpen && <CartPanel cart={cart} table={table} restaurantName={r.name} brand={brand} onClose={() => setCartOpen(false)} />}
    </div>
  );
}
