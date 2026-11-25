import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Copy, ImageIcon, Pencil, Plus, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import { Alert, Button, Card, Spinner } from '../../components/ui.jsx';
import { ConfirmDialog } from '../../components/Modal.jsx';
import Toggle from '../../components/Toggle.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useCanWrite, WriteBlockedNotice } from '../../components/WriteGuard.jsx';
import { useAuth } from '../../store/AuthContext.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { formatDT, optimizeImage } from '../../lib/format.js';
import ProductEditor from './ProductEditor.jsx';

const STATUSES = [['all', 'Tous les statuts'], ['available', 'Disponibles'], ['unavailable', 'Indisponibles'], ['inactive', 'Inactifs'], ['promo', 'En promotion']];
const selectCls = 'rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm focus:border-accent-500 focus:outline-none focus:ring-4 focus:ring-accent-500/15';

export function Badge({ tone = 'navy', children }) {
  const tones = { navy: 'bg-navy-100 text-navy-600', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', accent: 'bg-accent-100 text-accent-700' };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function Price({ product }) {
  return product.isPromo && product.promoPrice != null ? (
    <span><span className="font-extrabold text-accent-700">{formatDT(product.promoPrice)}</span> <span className="text-xs text-navy-500 line-through">{formatDT(product.price)}</span></span>
  ) : <span className="font-extrabold">{formatDT(product.price)}</span>;
}

/** Charge catégories + produits (filtrés côté serveur). Partagé par les pages Produits, Variantes et Promotions. */
export function useCatalog({ status = 'all' } = {}) {
  const [categories, setCategories] = useState(null);
  const [products, setProducts] = useState(null);
  const [filters, setFilters] = useState({ categoryId: '', status, q: '' });
  const [error, setError] = useState('');

  const loadCategories = useCallback(() => api.get('/restaurant/categories').then((r) => setCategories(r.data)).catch((e) => setError(parseError(e).message)), []);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  const loadProducts = useCallback(() => {
    const params = { status: filters.status };
    if (filters.categoryId) params.categoryId = filters.categoryId;
    if (filters.q.trim()) params.q = filters.q.trim();
    return api.get('/restaurant/products', { params }).then((r) => { setProducts(r.data); setError(''); }).catch((e) => setError(parseError(e).message));
  }, [filters]);

  // Recherche : on attend la fin de la frappe avant d'interroger le serveur
  useEffect(() => {
    const t = setTimeout(loadProducts, filters.q ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadProducts, filters.q]);

  return { categories, products, setProducts, filters, setFilters, error, reload: loadProducts };
}

export function FilterBar({ categories, filters, setFilters, showStatus = true }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="relative min-w-[12rem] flex-1">
        <span className="sr-only">Rechercher un produit</span>
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" aria-hidden="true" />
        <input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Rechercher un produit…" maxLength={100}
          className="w-full rounded-xl border border-navy-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-navy-300 focus:border-accent-500 focus:outline-none focus:ring-4 focus:ring-accent-500/15" />
      </label>
      <select aria-label="Filtrer par catégorie" className={selectCls} value={filters.categoryId} onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}>
        <option value="">Toutes les catégories</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {showStatus && (
        <select aria-label="Filtrer par statut" className={selectCls} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )}
    </div>
  );
}

export default function Products() {
  usePageMeta('Produits – MH Menu');
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = useCanWrite();
  const canDelete = user.role === 'owner' || user.role === 'manager';
  const { categories, products, setProducts, filters, setFilters, error, reload } = useCatalog();
  const [editor, setEditor] = useState(null); // { id } | { id: null }
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const canReorder = !!filters.categoryId && filters.status === 'all' && !filters.q.trim();

  const patchLocal = (p) => setProducts((cur) => cur?.map((x) => (x.id === p.id ? { ...x, ...p } : x)));

  const toggleAvailable = async (p, isAvailable) => {
    const prev = products;
    patchLocal({ id: p.id, isAvailable });
    try { await api.patch(`/restaurant/products/${p.id}`, { isAvailable }); }
    catch (e) { setProducts(prev); toast.error(parseError(e).message); }
  };

  const move = async (index, delta) => {
    const next = [...products];
    const j = index + delta;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    const prev = products;
    setProducts(next);
    try { await api.put('/restaurant/products/reorder', { ids: next.map((p) => p.id) }); }
    catch (e) { setProducts(prev); toast.error(parseError(e).message); }
  };

  const duplicate = async (p) => {
    try {
      await api.post(`/restaurant/products/${p.id}/duplicate`);
      toast.success('Produit dupliqué.');
      reload();
    } catch (e) { toast.error(parseError(e).message); }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/restaurant/products/${deleting.id}`);
      setProducts((cur) => cur.filter((p) => p.id !== deleting.id));
      toast.success('Produit supprimé.');
    } catch (e) { toast.error(parseError(e).message); }
    finally { setBusy(false); setDeleting(null); }
  };

  if (error && !categories) return <Alert>{error}</Alert>;
  if (!categories) return <Spinner />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Produits</h1>
          <p className="mt-1 text-navy-500">Gérez vos plats, leurs prix, photos et disponibilité.</p>
        </div>
        <Button onClick={() => setEditor({ id: null })} disabled={!canWrite || categories.length === 0}><Plus className="h-4 w-4" aria-hidden="true" /> Ajouter un produit</Button>
      </div>

      <WriteBlockedNotice />

      {categories.length === 0 ? (
        <Card className="p-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-navy-50 text-navy-500"><UtensilsCrossed className="h-7 w-7" aria-hidden="true" /></span>
          <h2 className="mt-4 text-lg font-bold">Créez d'abord une catégorie</h2>
          <p className="mx-auto mt-1 max-w-sm text-navy-500">Chaque produit appartient à une catégorie (Pizzas, Boissons…).</p>
          <Link to="/dashboard/categories" className="mt-5 inline-block rounded-xl bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-800">Créer une catégorie</Link>
        </Card>
      ) : (
        <>
          <FilterBar categories={categories} filters={filters} setFilters={setFilters} />
          {error && <Alert>{error}</Alert>}
          {!products && !error && <Spinner />}
          {products && products.length === 0 && (
            <Card className="p-10 text-center text-navy-500">
              {filters.q || filters.categoryId || filters.status !== 'all' ? 'Aucun produit ne correspond à ces filtres.' : 'Aucun produit pour le moment. Ajoutez votre premier plat.'}
            </Card>
          )}
          {products && products.length > 0 && (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {products.map((p, i) => (
                <li key={p.id} className="min-w-0">
                  <Card className={`flex gap-3 p-3 ${p.isActive ? '' : 'opacity-70'}`}>
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-navy-50">
                      {p.coverUrl ? <img src={optimizeImage(p.coverUrl, 240)} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full w-full place-items-center text-navy-300"><ImageIcon className="h-6 w-6" aria-hidden="true" /></div>}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-bold">{p.name}</div>
                          <div className="truncate text-xs text-navy-500">{p.categoryName}</div>
                        </div>
                        <Price product={p} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {p.isPopular && <Badge tone="amber">Populaire</Badge>}
                        {p.isPromo && <Badge tone="accent">Promo</Badge>}
                        {!p.isAvailable && <Badge tone="red">Indisponible</Badge>}
                        {!p.isActive && <Badge>Inactif</Badge>}
                        {p.variantsCount > 0 && <Badge>{p.variantsCount} variante{p.variantsCount > 1 ? 's' : ''}</Badge>}
                        {p.extrasCount > 0 && <Badge>{p.extrasCount} supplément{p.extrasCount > 1 ? 's' : ''}</Badge>}
                      </div>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 pt-2">
                        <label className="flex items-center gap-2 text-xs font-medium text-navy-500">
                          <Toggle size="sm" checked={p.isAvailable} onChange={(v) => toggleAvailable(p, v)} label={`${p.name} disponible`} disabled={!canWrite} /> Disponible
                        </label>
                        <div className="flex items-center">
                          {canReorder && (
                            <>
                              <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || !canWrite} className="rounded-lg p-1.5 text-navy-500 hover:bg-navy-50 disabled:opacity-30" aria-label={`Monter ${p.name}`}><ArrowUp className="h-4 w-4" /></button>
                              <button type="button" onClick={() => move(i, 1)} disabled={i === products.length - 1 || !canWrite} className="rounded-lg p-1.5 text-navy-500 hover:bg-navy-50 disabled:opacity-30" aria-label={`Descendre ${p.name}`}><ArrowDown className="h-4 w-4" /></button>
                            </>
                          )}
                          <button type="button" onClick={() => setEditor({ id: p.id })} className="rounded-lg p-1.5 text-navy-500 hover:bg-navy-50" aria-label={`Modifier ${p.name}`}><Pencil className="h-4 w-4" /></button>
                          <button type="button" onClick={() => duplicate(p)} disabled={!canWrite} className="rounded-lg p-1.5 text-navy-500 hover:bg-navy-50 disabled:opacity-40" aria-label={`Dupliquer ${p.name}`}><Copy className="h-4 w-4" /></button>
                          {canDelete && <button type="button" onClick={() => setDeleting(p)} disabled={!canWrite} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-40" aria-label={`Supprimer ${p.name}`}><Trash2 className="h-4 w-4" /></button>}
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
          {canReorder === false && products && products.length > 1 && <p className="text-xs text-navy-500">Astuce : choisissez une catégorie (sans autre filtre) pour réordonner ses produits.</p>}
        </>
      )}

      {editor && (
        <ProductEditor
          productId={editor.id}
          categories={categories}
          onClose={() => setEditor(null)}
          onSaved={() => reload()}
        />
      )}
      {deleting && (
        <ConfirmDialog title="Supprimer le produit ?" message={`« ${deleting.name} » et ses photos seront supprimés définitivement.`} onConfirm={confirmDelete} onClose={() => setDeleting(null)} loading={busy} />
      )}
    </div>
  );
}
