import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from '../../components/Logo.jsx';
import { ButtonLink } from '../../components/ui.jsx';
import { useAuth } from '../../store/AuthContext.jsx';

const LINKS = [
  { href: '#accueil', label: 'Accueil' },
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#demo', label: 'Démonstration' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#faq', label: 'FAQ' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const space = user?.role === 'super_admin' ? '/admin' : '/dashboard';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-40 transition ${scrolled || open ? 'border-b border-navy-100 bg-white/90 backdrop-blur' : 'bg-transparent'}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="Navigation principale" className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-navy-600 transition hover:bg-navy-50 hover:text-navy-900">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {isAuthenticated ? (
            <ButtonLink to={space} size="sm">Mon espace</ButtonLink>
          ) : (
            <>
              <ButtonLink to="/connexion" variant="ghost" size="sm">Connexion</ButtonLink>
              <ButtonLink to="/inscription" size="sm">Essai gratuit</ButtonLink>
            </>
          )}
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-navy-700 hover:bg-navy-50 lg:hidden"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-navy-100 bg-white px-4 pb-5 pt-3 lg:hidden">
          <nav aria-label="Navigation mobile" className="flex flex-col">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-base font-medium text-navy-700 hover:bg-navy-50">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {isAuthenticated ? (
              <Link to={space} className="col-span-2 rounded-xl bg-navy-900 px-4 py-3 text-center text-sm font-semibold text-white">Mon espace</Link>
            ) : (
              <>
                <ButtonLink to="/connexion" variant="secondary">Connexion</ButtonLink>
                <ButtonLink to="/inscription">Essai gratuit</ButtonLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
