import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export default async function RecentStockAdditions() {
  if ((await getSession())?.role !== 'ADMIN') return null;
  const entries = await prisma.stockAddition.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });

  return (
    <section className="mx-auto mb-6 max-w-7xl rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-3 text-base font-semibold">Derniers mouvements de stock</h2>
      {entries.length === 0 ? <p className="text-sm text-slate-500">Aucun mouvement de stock enregistré.</p> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
          {entries.map((entry) => <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
            <span className="font-medium">{entry.brand} · {entry.btu.replace('_', ' ')} · {entry.ac_type}</span>
            <span className={entry.operation === 'REMOVE' || entry.operation === 'SALE' || entry.operation === 'DELETE_BRAND' ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}>
              {entry.operation === 'REMOVE' || entry.operation === 'SALE' || entry.operation === 'DELETE_BRAND' ? '−' : '+'}{entry.quantityAdded}
              <span className="ml-1 text-xs">{({ ADD: 'Ajout', REMOVE: 'Retrait', SALE: 'Vente', RETURN: 'Retour', DELETE_BRAND: 'Suppression' } as Record<string, string>)[entry.operation] || entry.operation}</span>
            </span>
            <span className="text-slate-500">{entry.addedBy}</span>
            <time className="ml-auto text-slate-500" dateTime={entry.createdAt.toISOString()}>
              {entry.createdAt.toLocaleString('fr-MA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Casablanca' })}
            </time>
          </li>)}
        </ul>
      )}
    </section>
  );
}
