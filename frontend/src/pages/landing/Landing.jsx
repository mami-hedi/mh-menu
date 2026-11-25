import { usePageMeta } from '../../hooks/usePageMeta.js';
import Header from './Header.jsx';
import Hero from './Hero.jsx';
import Demo from './Demo.jsx';
import Footer from './Footer.jsx';
import { Faq, Features, Pricing, ProblemSolution, Trial } from './Sections.jsx';

export default function Landing() {
  usePageMeta(
    'MH Menu – Menu digital par QR Code pour restaurants en Tunisie',
    'Créez le menu digital de votre restaurant, café ou snack et partagez-le par QR Code. Modifiez vos prix en un clic. Essai gratuit 3 jours, sans carte bancaire. 29 DT/mois.'
  );
  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-pop">
        Aller au contenu
      </a>
      <Header />
      <main id="contenu">
        <Hero />
        <ProblemSolution />
        <Features />
        <Demo />
        <Pricing />
        <Trial />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
