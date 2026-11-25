import { useState } from 'react';
import { Minus, Plus, Trash2, ConciergeBell } from 'lucide-react';
import Sheet from './Sheet.jsx';
import { formatDT } from '../../lib/format.js';

const describe = (l) => [l.variant?.name, ...l.extras.map((e) => `+ ${e.name}`)].filter(Boolean).join(' · ');

/** Récapitulatif plein écran à montrer au serveur. Aucune commande n'est envoyée. */
function Recap({ cart, table, restaurantName, onBack, onClose }) {
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return (
    <Sheet
      full
      title="À présenter au serveur"
      onClose={onClose}
      footer={<button type="button" onClick={onBack} className="w-full rounded-full border border-neutral-300 px-5 py-3 text-sm font-bold hover:bg-neutral-50">Retour au panier</button>}
    >
      <div className="px-5 py-5">
        <div className="flex items-center justify-between gap-3 text-sm text-neutral-500">
          <span className="font-semibold text-neutral-800">{restaurantName}</span>
          <span>{table ? <strong className="rounded-full bg-neutral-900 px-3 py-1 text-white">Table {table}</strong> : null} <span className="ml-1">{time}</span></span>
        </div>
        <ul className="mt-4 divide-y divide-neutral-200" aria-label="Produits choisis">
          {cart.lines.map((l) => (
            <li key={l.key} className="flex items-start justify-between gap-4 py-3.5">
              <div className="min-w-0">
                <p className="text-xl font-extrabold leading-snug"><span className="mr-2">{l.qty} ×</span>{l.product.name}</p>
                {describe(l) && <p className="mt-0.5 text-base text-neutral-600">{describe(l)}</p>}
              </div>
              <span className="shrink-0 pt-0.5 text-lg font-bold">{formatDT(l.total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between border-t-2 border-neutral-900 pt-4 text-2xl font-extrabold">
          <span>Total</span><span>{formatDT(cart.total)}</span>
        </div>
        <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ce récapitulatif n’est <strong>pas une commande</strong> : il n’a été envoyé à personne. Montrez cet écran à votre serveur pour passer commande.
        </p>
      </div>
    </Sheet>
  );
}

export default function CartPanel({ cart, table, restaurantName, brand, onClose }) {
  const [recap, setRecap] = useState(false);
  if (recap && cart.lines.length) return <Recap cart={cart} table={table} restaurantName={restaurantName} onBack={() => setRecap(false)} onClose={onClose} />;

  return (
    <Sheet
      title="Mon panier"
      onClose={onClose}
      footer={cart.lines.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-lg font-extrabold"><span>Total</span><span>{formatDT(cart.total)}</span></div>
          <button type="button" onClick={() => setRecap(true)} style={{ background: brand.bg, color: brand.fg }} className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-bold shadow-sm active:opacity-90">
            <ConciergeBell className="h-4 w-4" aria-hidden="true" /> Présenter au serveur
          </button>
          <button type="button" onClick={cart.clear} className="w-full text-center text-sm font-semibold text-neutral-500 hover:text-red-600">Vider le panier</button>
        </div>
      )}
    >
      {cart.lines.length === 0 ? (
        <p className="px-5 py-12 text-center text-neutral-500">Votre panier est vide.</p>
      ) : (
        <>
          <ul className="divide-y divide-neutral-100 px-5">
            {cart.lines.map((l) => (
              <li key={l.key} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{l.product.name}</p>
                    {describe(l) && <p className="text-sm text-neutral-500">{describe(l)}</p>}
                  </div>
                  <span className="shrink-0 font-bold">{formatDT(l.total)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1 rounded-full border border-neutral-200 p-0.5">
                    <button type="button" aria-label={`Retirer un ${l.product.name}`} onClick={() => cart.setQty(l.key, l.qty - 1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-neutral-100"><Minus className="h-4 w-4" aria-hidden="true" /></button>
                    <span className="w-6 text-center text-sm font-bold" aria-label={`Quantité ${l.qty}`}>{l.qty}</span>
                    <button type="button" aria-label={`Ajouter un ${l.product.name}`} onClick={() => cart.setQty(l.key, l.qty + 1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-neutral-100"><Plus className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                  <button type="button" aria-label={`Supprimer ${l.product.name} du panier`} onClick={() => cart.setQty(l.key, 0)} className="grid h-8 w-8 place-items-center rounded-full text-neutral-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                </div>
              </li>
            ))}
          </ul>
          <p className="px-5 pb-4 text-xs text-neutral-500">Le panier reste sur votre téléphone. Aucune commande n’est envoyée au restaurant.</p>
        </>
      )}
    </Sheet>
  );
}
