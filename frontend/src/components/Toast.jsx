import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setItems((cur) => cur.filter((t) => t.id !== id)), []);
  const push = useCallback((tone, message) => {
    const id = nextId.current++;
    setItems((cur) => [...cur.slice(-3), { id, tone, message }]);
    setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 3500);
  }, [dismiss]);

  const api = useMemo(() => ({ success: (m) => push('success', m), error: (m) => push('error', m) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 overflow-hidden px-4" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex max-w-full sm:max-w-md items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-pop ${t.tone === 'error' ? 'bg-red-600 text-white' : 'bg-navy-900 text-white'}`}>
            {t.tone === 'error' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" aria-hidden="true" />}
            <span className="min-w-0 break-words">{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} className="ml-1 shrink-0 opacity-70 hover:opacity-100" aria-label="Fermer la notification"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>.');
  return ctx;
}
