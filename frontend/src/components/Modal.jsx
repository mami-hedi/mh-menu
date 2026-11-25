import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui.jsx';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Modale accessible : Échap pour fermer, focus piégé et restauré, défilement de la page bloqué. */
export function Modal({ title, onClose, children, size = 'md', dismissible = true }) {
  const ref = useRef(null);
  const titleId = useId();
  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' };

  useEffect(() => {
    const previous = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = ref.current?.querySelector('[data-autofocus]') ?? ref.current?.querySelector(FOCUSABLE);
    first?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) { e.stopPropagation(); onClose(); }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const a = items[0];
      const z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [onClose, dismissible]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-navy-950/60" onClick={dismissible ? onClose : undefined} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-pop sm:rounded-3xl ${widths[size]}`}>
        <div className="flex items-center justify-between gap-4 border-b border-navy-100 px-5 py-4 sm:px-6">
          <h2 id={titleId} className="text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-navy-500 hover:bg-navy-50 hover:text-navy-700" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Supprimer', onConfirm, onClose, loading }) {
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <div className="px-5 py-5 sm:px-6"><p className="text-navy-600">{message}</p></div>
      <div className="flex justify-end gap-2 border-t border-navy-100 px-5 py-4 sm:px-6">
        <Button variant="secondary" onClick={onClose} data-autofocus>Annuler</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
