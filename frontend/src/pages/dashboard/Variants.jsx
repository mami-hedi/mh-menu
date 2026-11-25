import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Alert, Button, Card, Spinner } from '../../components/ui.jsx';
import { WriteBlockedNotice } from '../../components/WriteGuard.jsx';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { Badge, FilterBar, useCatalog } from './Products.jsx';
import ProductEditor from './ProductEditor.jsx';

/** Vue d'ensemble des variantes et suppléments de tous les produits ; l'édition se fait dans l'éditeur de produit. */
export default function Variants() {
  usePageMeta('Variantes et suppléments – MH Menu');
  const { categories, products, filters, setFilters, error, reload } = useCatalog();
  const [editor, setEditor] = useState(null);

  if (error && !categories) return <Alert>{error}</Alert>;
  if (!categories) return <Spinner />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Variantes et suppléments</h1>
        <p className="mt-1 text-navy-500">Tailles, formules, options obligatoires ou facultatives et suppléments payants, produit par produit.</p>
      </div>
      <WriteBlockedNotice />
      <FilterBar categories={categories} filters={filters} setFilters={setFilters} showStatus={false} />
      {error && <Alert>{error}</Alert>}
      {!products && !error && <Spinner />}
      {products && products.length === 0 && <Card className="p-10 text-center text-navy-500">Aucun produit. Créez d'abord vos produits dans la page « Produits ».</Card>}
      {products && products.length > 0 && (
        <Card>
          <ul className="divide-y divide-navy-100">
            {products.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate font-bold">{p.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-navy-500">
                    <span>{p.categoryName}</span>
                    {p.variantsCount > 0 ? <Badge tone="accent">{p.variantsCount} variante{p.variantsCount > 1 ? 's' : ''}</Badge> : <Badge>Aucune variante</Badge>}
                    {p.extrasCount > 0 ? <Badge tone="accent">{p.extrasCount} supplément{p.extrasCount > 1 ? 's' : ''}</Badge> : <Badge>Aucun supplément</Badge>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditor({ id: p.id, tab: 'variants' })}><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Variantes</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditor({ id: p.id, tab: 'extras' })}>Suppléments</Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {editor && <ProductEditor productId={editor.id} initialTab={editor.tab} categories={categories} onClose={() => setEditor(null)} onSaved={() => reload()} />}
    </div>
  );
}
