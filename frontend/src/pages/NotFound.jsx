import { ButtonLink } from '../components/ui.jsx';
import Logo from '../components/Logo.jsx';
import { usePageMeta } from '../hooks/usePageMeta.js';

export default function NotFound() {
  usePageMeta('Page introuvable – MH Menu');
  return (
    <main className="grid min-h-screen place-items-center bg-navy-50 px-4 text-center">
      <div>
        <Logo className="mb-8" />
        <p className="text-6xl font-extrabold text-accent-700">404</p>
        <h1 className="mt-3 text-2xl font-extrabold">Cette page n’existe pas</h1>
        <p className="mt-2 text-navy-500">Le lien est peut-être incorrect ou la page a été déplacée.</p>
        <ButtonLink to="/" className="mt-6">Retour à l’accueil</ButtonLink>
      </div>
    </main>
  );
}
