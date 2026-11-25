import { useCallback, useEffect, useMemo, useState } from 'react';

const MAX_LINES = 50;
const MAX_QTY = 99;
const round3 = (n) => Math.round(n * 1000) / 1000;

/** Prix d'une unité : prix affiché (promo comprise) + supplément de variante + suppléments choisis. */
export const unitPrice = (product, variant, extras) =>
  round3(Number(product.finalPrice) + Number(variant?.priceDelta ?? 0) + extras.reduce((s, e) => s + Number(e.price), 0));

const lineKey = (productId, variantId, extraIds) => `${productId}:${variantId ?? 0}:${[...extraIds].sort((a, b) => a - b).join(',')}`;

/** Associe les lignes enregistrées au menu actuel : tout ce qui a disparu ou est devenu indisponible est écarté. */
export function resolveLines(menu, lines) {
  const products = new Map();
  for (const c of menu?.categories ?? []) for (const p of c.products) products.set(p.id, p);
  const out = [];
  for (const line of lines) {
    const product = products.get(line.productId);
    if (!product || !product.isAvailable) continue;
    let variant = null;
    if (product.variants.length) {
      variant = product.variants.find((v) => v.id === line.variantId);
      if (!variant) continue;
    }
    const extras = product.extras.filter((e) => e.isRequired || line.extraIds.includes(e.id));
    const unit = unitPrice(product, variant, extras);
    out.push({ key: line.key, qty: line.qty, product, variant, extras, unit, total: round3(unit * line.qty) });
  }
  return out;
}

const storageKey = (slug) => `mhmenu-cart-${slug}`;
function load(slug) {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(slug)) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((l) => l && Number.isInteger(l.productId) && Number.isInteger(l.qty) && l.qty > 0 && Array.isArray(l.extraIds))
      .slice(0, MAX_LINES)
      .map((l) => ({ ...l, qty: Math.min(l.qty, MAX_QTY), key: lineKey(l.productId, l.variantId ?? null, l.extraIds) }));
  } catch { return []; }
}

/** Panier virtuel : conservé sur l'appareil du client uniquement. Ce n'est PAS une commande. */
export function useCart(slug, menu) {
  const [lines, setLines] = useState(() => load(slug));
  useEffect(() => { try { localStorage.setItem(storageKey(slug), JSON.stringify(lines)); } catch { /* stockage indisponible */ } }, [slug, lines]);

  const resolved = useMemo(() => resolveLines(menu, lines), [menu, lines]);
  // Nettoie définitivement les lignes devenues invalides après un rechargement du menu
  useEffect(() => {
    if (menu && resolved.length !== lines.length) setLines((ls) => ls.filter((l) => resolved.some((r) => r.key === l.key)));
  }, [menu, resolved, lines.length]);

  const add = useCallback((productId, variantId, extraIds, qty = 1) => {
    const key = lineKey(productId, variantId, extraIds);
    setLines((ls) => {
      const found = ls.find((l) => l.key === key);
      if (found) return ls.map((l) => (l.key === key ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l));
      if (ls.length >= MAX_LINES) return ls;
      return [...ls, { key, productId, variantId, extraIds: [...extraIds], qty: Math.min(MAX_QTY, qty) }];
    });
  }, []);
  const setQty = useCallback((key, qty) => setLines((ls) => (qty <= 0 ? ls.filter((l) => l.key !== key) : ls.map((l) => (l.key === key ? { ...l, qty: Math.min(MAX_QTY, qty) } : l)))), []);
  const clear = useCallback(() => setLines([]), []);

  const count = resolved.reduce((s, l) => s + l.qty, 0);
  const total = round3(resolved.reduce((s, l) => s + l.total, 0));
  return { lines: resolved, count, total, add, setQty, clear };
}
