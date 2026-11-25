import { Link } from 'react-router-dom';
import Logo from '../../components/Logo.jsx';

const LINKS = [
  ['À propos', '/a-propos'],
  ['Contact', '/contact'],
  ['Conditions générales', '/conditions-generales'],
  ['Politique de confidentialité', '/politique-de-confidentialite'],
  ['Mentions légales', '/mentions-legales'],
];

export default function Footer() {
  return (
    <footer className="bg-navy-950 text-navy-200">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <Logo light />
            <p className="mt-3 text-sm italic text-navy-300">Votre menu digital. Simplement.</p>
          </div>
          <nav aria-label="Liens du pied de page">
            <ul className="grid grid-cols-2 gap-x-10 gap-y-2.5 text-sm sm:grid-cols-3">
              {LINKS.map(([label, to]) => (
                <li key={to}><Link to={to} className="transition hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-10 border-t border-white/10 pt-6 text-sm text-navy-300">
          MH Menu – Développé par{' '}
          <a href="https://www.mh-digital-solution.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-white hover:underline">
            MH Digital Solution
          </a>
          . © {new Date().getFullYear()} Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
