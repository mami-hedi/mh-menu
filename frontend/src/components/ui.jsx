import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60';
const variants = {
  primary: 'bg-navy-900 text-white shadow-sm hover:bg-navy-800 active:bg-navy-950',
  accent: 'bg-accent-700 text-white shadow-sm hover:bg-accent-800',
  secondary: 'border border-navy-200 bg-white text-navy-900 hover:bg-navy-50',
  ghost: 'text-navy-700 hover:bg-navy-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};
const sizes = { sm: 'px-3.5 py-2 text-sm', md: 'px-5 py-2.5 text-sm', lg: 'px-6 py-3.5 text-base' };

export function Button({ variant = 'primary', size = 'md', loading = false, children, className = '', disabled, ...props }) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function ButtonLink({ to, href, variant = 'primary', size = 'md', children, className = '', ...props }) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;
  if (href) return <a href={href} className={cls} {...props}>{children}</a>;
  return <Link to={to} className={cls} {...props}>{children}</Link>;
}

export const Input = forwardRef(function Input({ className = '', invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-navy-900 placeholder:text-navy-300 transition focus:border-accent-500 focus:outline-none focus:ring-4 focus:ring-accent-500/15 ${
        invalid ? 'border-red-400' : 'border-navy-200'
      } ${className}`}
      {...props}
    />
  );
});

export function Field({ label, htmlFor, error, hint, children }) {
  return (
    <div>
      {label && <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-navy-800">{label}</label>}
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-navy-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Alert({ tone = 'error', children }) {
  const tones = {
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-accent-100 bg-accent-50 text-accent-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
  };
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Card({ className = "", children, ...rest }) {
  return <div className={`rounded-2xl border border-navy-100 bg-white shadow-card ${className}`} {...rest}>{children}</div>;
}

export function Spinner({ label = 'Chargement…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-navy-500" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function FullPageSpinner() {
  return <div className="grid min-h-screen place-items-center"><Spinner /></div>;
}
