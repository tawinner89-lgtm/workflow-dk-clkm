'use client';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100/80 max-w-md text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Erreur d&apos;action</h2>
        <p className="text-slate-500 text-sm mb-6">{error.message || "Une erreur inattendue est survenue."}</p>
        <button onClick={() => reset()} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
          Retour au tableau de bord
        </button>
      </div>
    </div>
  );
}
