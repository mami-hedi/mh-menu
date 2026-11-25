import { forwardRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, QrCode, RefreshCw, ShieldCheck } from 'lucide-react';
import Logo from '../../components/Logo.jsx';
import { Input } from '../../components/ui.jsx';

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <main className="flex flex-col px-4 py-8 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-navy-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <p className="mt-6 text-center text-sm text-navy-500">{footer}</p>}
        </div>
        <p className="text-center text-xs text-navy-500">
          <Link to="/" className="hover:underline">← Retour au site</Link>
        </p>
      </main>

      <aside className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col lg:justify-center" aria-hidden="true">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent-400/20 blur-3xl" />
        <div className="relative max-w-md">
          <p className="text-3xl font-extrabold leading-tight">Votre menu digital. <span className="text-accent-400">Simplement.</span></p>
          <ul className="mt-10 space-y-6 text-navy-100">
            <li className="flex gap-4"><QrCode className="mt-0.5 h-6 w-6 shrink-0 text-accent-400" /><span><strong className="block text-white">Un QR Code, un menu</strong>Vos clients scannent et consultent votre carte à jour.</span></li>
            <li className="flex gap-4"><RefreshCw className="mt-0.5 h-6 w-6 shrink-0 text-accent-400" /><span><strong className="block text-white">Modifiez en un clic</strong>Prix, plats, disponibilité : sans réimpression.</span></li>
            <li className="flex gap-4"><ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-accent-400" /><span><strong className="block text-white">3 jours gratuits</strong>Aucune carte bancaire demandée pour commencer.</span></li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

export const PasswordInput = forwardRef(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={visible ? 'text' : 'password'} className="pr-12" {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-navy-500 hover:text-navy-700"
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

/** Applique les erreurs par champ renvoyées par l'API sur le formulaire react-hook-form. */
export function applyServerErrors(parsed, setError, knownFields) {
  let applied = false;
  for (const [field, message] of Object.entries(parsed.fields || {})) {
    if (knownFields.includes(field)) {
      setError(field, { type: 'server', message });
      applied = true;
    }
  }
  return applied;
}

export const passwordRules = {
  required: 'Mot de passe requis.',
  minLength: { value: 10, message: 'Au moins 10 caractères.' },
  maxLength: { value: 72, message: '72 caractères maximum.' },
  validate: {
    letter: (v) => /[A-Za-z]/.test(v) || 'Au moins une lettre.',
    digit: (v) => /\d/.test(v) || 'Au moins un chiffre.',
  },
};
