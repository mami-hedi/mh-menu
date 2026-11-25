import { Link } from 'react-router-dom';
import { Alert } from './ui.jsx';
import { useAuth } from '../store/AuthContext.jsx';

/** Faux si l'essai ou l'abonnement est terminé : le serveur refuse alors toute écriture, l'interface le reflète. */
export function useCanWrite() {
  const { subscription } = useAuth();
  return subscription ? subscription.canWrite : true;
}

export function WriteBlockedNotice() {
  const canWrite = useCanWrite();
  if (canWrite) return null;
  return (
    <Alert tone="warning">
      Votre essai ou abonnement est terminé : vous pouvez consulter vos données mais pas les modifier.{' '}
      <Link to="/dashboard/abonnement" className="font-bold underline">Souscrire à une offre</Link>
    </Alert>
  );
}
