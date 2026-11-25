import { Link } from 'react-router-dom';
import Logo from '../../components/Logo.jsx';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import Footer from './Footer.jsx';

// Textes de base à faire valider par un conseil juridique avant la mise en production
// (raison sociale, matricule fiscal, adresse et coordonnées à renseigner).
const PAGES = {
  about: {
    title: 'À propos',
    sections: [
      ['MH Menu', 'MH Menu est une plateforme de menus digitaux accessibles par QR Code, conçue pour les restaurants, cafés, pizzerias, snacks et fast-foods.'],
      ['Qui sommes-nous ?', 'MH Menu est développé par MH Digital Solution, agence de développement web basée à Hammamet / Nabeul, en Tunisie.'],
      ['Notre mission', 'Simplifier la vie des restaurateurs : une carte toujours à jour, sans impression, et une expérience agréable pour leurs clients.'],
    ],
  },
  contact: {
    title: 'Contact',
    sections: [
      ['Nous contacter', 'Pour toute question commerciale, technique ou demande d’assistance, contactez MH Digital Solution via son site officiel.'],
      ['Site officiel', 'https://www.mh-digital-solution.com'],
    ],
  },
  terms: {
    title: 'Conditions générales d’utilisation',
    sections: [
      ['Objet', 'Les présentes conditions encadrent l’utilisation du service MH Menu, édité par MH Digital Solution, permettant de créer et publier un menu digital accessible par QR Code.'],
      ['Compte et accès', 'Le restaurateur est responsable de l’exactitude des informations saisies et de la confidentialité de son mot de passe.'],
      ['Essai gratuit et abonnement', 'Chaque nouveau restaurant bénéficie d’un essai gratuit de 3 jours, sans carte bancaire. Au-delà, l’accès aux fonctionnalités nécessite un abonnement mensuel (29 DT) ou annuel (290 DT). À défaut, le menu public devient temporairement indisponible ; l’accès à l’espace de gestion est conservé pour souscrire.'],
      ['Contenus', 'Le restaurateur reste propriétaire des contenus qu’il publie (textes, prix, photos) et garantit détenir les droits nécessaires.'],
      ['Panier virtuel', 'Le panier est un outil d’aide à la présentation. Il ne constitue pas une commande : aucune commande n’est transmise automatiquement à l’établissement.'],
      ['Résiliation', 'Le restaurateur peut cesser d’utiliser le service à tout moment. MH Digital Solution peut suspendre un compte en cas d’usage contraire aux présentes conditions.'],
    ],
  },
  privacy: {
    title: 'Politique de confidentialité',
    sections: [
      ['Données collectées', 'Nom du restaurant et du propriétaire, email, téléphone, mot de passe (stocké sous forme chiffrée irréversible) et contenus du menu. Les consultations du menu public sont comptabilisées sans collecte de données personnelles des visiteurs.'],
      ['Finalités', 'Fournir le service, gérer les abonnements, assurer l’assistance et la sécurité de la plateforme.'],
      ['Conservation', 'Les données du restaurant sont conservées tant que le compte existe, puis selon la politique de conservation définie par MH Digital Solution.'],
      ['Vos droits', 'Vous pouvez demander l’accès, la rectification ou la suppression de vos données en contactant MH Digital Solution.'],
      ['Sous-traitants', 'Hébergement et services techniques : Vercel, Render, TiDB Cloud, Cloudinary (images) et Resend (emails).'],
    ],
  },
  legal: {
    title: 'Mentions légales',
    sections: [
      ['Éditeur', 'MH Digital Solution – Hammamet / Nabeul, Tunisie. https://www.mh-digital-solution.com'],
      ['Hébergement', 'Frontend : Vercel. API : Render. Base de données : TiDB Cloud.'],
      ['Propriété intellectuelle', 'La marque MH Menu, le logo et l’interface sont la propriété de MH Digital Solution.'],
    ],
  },
};

const isUrl = (s) => /^https?:\/\/\S+$/.test(s);

export default function LegalPage({ page }) {
  const content = PAGES[page];
  usePageMeta(`${content.title} – MH Menu`);
  return (
    <>
      <header className="border-b border-navy-100">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Link to="/" className="text-sm font-semibold text-navy-600 hover:text-navy-900">← Retour à l’accueil</Link>
        </div>
      </header>
      <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight">{content.title}</h1>
        <div className="mt-8 space-y-7">
          {content.sections.map(([h, p]) => (
            <section key={h}>
              <h2 className="text-lg font-bold">{h}</h2>
              {isUrl(p) ? (
                <a href={p} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-accent-700 underline">{p}</a>
              ) : (
                <p className="mt-2 leading-relaxed text-navy-600">{p}</p>
              )}
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
