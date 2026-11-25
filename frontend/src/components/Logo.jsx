import { Link } from 'react-router-dom';

export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0B1F4B" />
      <path d="M16 46V20l16 16 16-16v26" fill="none" stroke="#22D3EE" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo({ to = '/', light = false, className = '' }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 font-extrabold tracking-tight ${className}`} aria-label="MH Menu – accueil">
      <LogoMark />
      <span className={`text-xl ${light ? 'text-white' : 'text-navy-900'}`}>
        MH <span className={light ? "text-accent-400" : "text-accent-700"}>Menu</span>
      </span>
    </Link>
  );
}
