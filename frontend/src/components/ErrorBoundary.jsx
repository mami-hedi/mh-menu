import { Component } from 'react';

/** Filet de sécurité : une erreur d'affichage imprévue ne doit jamais laisser une page blanche. */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error, info) {
    // Pas de service de suivi d'erreurs configuré : trace en console pour le diagnostic
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-white px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-xl font-extrabold">Une erreur est survenue</h1>
          <p className="mt-2 text-neutral-500">La page n’a pas pu s’afficher correctement. Vos données ne sont pas perdues.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white">Recharger la page</button>
        </div>
      </main>
    );
  }
}
