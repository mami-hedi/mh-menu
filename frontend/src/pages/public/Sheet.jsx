import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Panneau qui monte du bas de l'écran (mobile) ou s'affiche au centre (grand écran). Accessible : Échap, focus piégé. */
export default function Sheet({ title, onClose, children, footer, full = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector('[data-autofocus]')?.focus();
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const a = items[0], z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; previous?.focus?.(); };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex w-full flex-col bg-white shadow-2xl outline-none ${full ? 'h-full sm:max-w-lg sm:rounded-3xl' : 'max-h-[92dvh] rounded-t-3xl sm:max-w-lg sm:rounded-3xl'}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <h2 id={titleId} className="min-w-0 truncate text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-neutral-100 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}
