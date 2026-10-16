'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Boxes, Copy, Pencil, Plus, Search, Save, Trash2, X } from 'lucide-react';
import { adjustMaterialStock, createStockMaterial, deleteStockMaterial, duplicateStockMaterial, updateStockMaterial } from '@/app/actions';

type Material = { id: number; designation: string; quantity: number; price: number | null };

function StockForm({ item, onCancel, onSaved }: { item?: Material; onCancel?: () => void; onSaved?: () => void }) {
  const action = item ? updateStockMaterial.bind(null, item.id) : createStockMaterial;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError('');
    try {
      const result = await action(new FormData(form));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!item) form.reset();
      onSaved?.();
      router.refresh();
    } catch {
      setError('Enregistrement impossible. Vérifiez les champs puis réessayez.');
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_150px_180px_auto]">
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Désignation
      <input required maxLength={160} name="designation" defaultValue={item?.designation} placeholder="Ex. Flexible cuivre 1/4" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950" />
    </label>
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Quantité
      <input required min="0" step="1" type="number" name="quantity" defaultValue={item?.quantity ?? 0} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950" />
    </label>
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Prix unitaire <span className="font-normal text-slate-400">(DH, facultatif)</span>
      <input min="0" step="0.01" type="number" name="price" defaultValue={item?.price ?? ''} placeholder="À renseigner" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950" />
    </label>
    <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-1">
      <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><Save size={16}/>{pending ? 'Enregistrement…' : item ? 'Enregistrer' : 'Ajouter'}</button>
      {onCancel && <button type="button" onClick={onCancel} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"><X size={16}/>Annuler</button>}
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800 sm:col-span-2 xl:col-span-4 dark:bg-red-950/50 dark:text-red-200">{error}</p>}
  </form>;
}

function MaterialActions({ item, onEdit }: { item: Material; onEdit: () => void }) {
  const smallAction = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
  return <div className="flex flex-wrap items-center gap-1.5">
    <button type="button" onClick={onEdit} className={smallAction}><Pencil size={14}/>Modifier</button>
    <form action={duplicateStockMaterial.bind(null, item.id)}><button title="Créer une copie de cet article" className={smallAction}><Copy size={14}/>Dupliquer</button></form>
    <form action={adjustMaterialStock.bind(null, item.id, -1)}><button disabled={item.quantity <= 0} title="Retirer une unité" className={smallAction}>−1 unité</button></form>
    <form action={adjustMaterialStock.bind(null, item.id, 1)}><button title="Ajouter une unité" className={smallAction}><Plus size={14}/>+1 unité</button></form>
    <form action={deleteStockMaterial.bind(null, item.id)} onSubmit={(event) => { if (!window.confirm(`Supprimer « ${item.designation} » ? L’action restera visible dans l’historique.`)) event.preventDefault(); }}>
      <button title="Supprimer cet article" className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-950/40"><Trash2 size={14}/>Supprimer</button>
    </form>
  </div>;
}

export default function MaterialsInventory({ materials }: { materials: Material[] }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const lowStock = useMemo(() => materials.filter((item) => item.quantity <= 2), [materials]);
  const filtered = useMemo(() => materials.filter((item) =>
    item.designation.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr')) && (!lowOnly || item.quantity <= 2)
  ), [materials, query, lowOnly]);

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6 dark:border-slate-700">
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"><Boxes size={21}/></span><div><h2 className="text-base font-semibold text-slate-900 dark:text-white">Matériel &amp; pièces</h2><p className="mt-1 text-xs text-slate-500">Stock des consommables et accessoires</p></div></div>
      <div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">{materials.length} articles</span><button type="button" onClick={() => setAdding((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-3.5 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"><Plus size={16}/>{adding ? 'Fermer' : 'Nouveau matériel'}</button></div>
    </header>

    {lowStock.length > 0 && <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 sm:px-6 dark:border-red-900 dark:bg-red-950/40"><div className="flex items-start gap-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-100 text-sm font-black text-red-800 dark:bg-red-900 dark:text-red-200">!</span><div><p className="text-sm font-bold text-red-900 dark:text-red-200">{lowStock.length} alerte{lowStock.length > 1 ? 's' : ''} — stock bas (2 unités ou moins)</p><div className="mt-1 flex flex-wrap gap-1.5">{lowStock.map((item) => <span key={item.id} className="rounded-md border border-red-200 bg-white/80 px-2 py-1 text-xs font-medium text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">{item.designation} <strong>({item.quantity})</strong></span>)}</div></div></div></div>}

    {adding && <div className="border-b border-slate-100 bg-slate-50/70 p-4 sm:p-6 dark:border-slate-700 dark:bg-slate-900/40"><div className="mb-4"><h3 className="text-sm font-semibold">Ajouter un article au stock</h3><p className="mt-1 text-xs text-slate-500">Le prix peut être ajouté ou modifié ultérieurement.</p></div><StockForm onCancel={() => setAdding(false)} onSaved={() => setAdding(false)}/></div>}

    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-700">
      <label className="relative block w-full sm:max-w-sm"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un matériel…" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"/></label>
      <button type="button" aria-pressed={lowOnly} onClick={() => setLowOnly((value) => !value)} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition ${lowOnly ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}>{lowOnly ? 'Afficher tout le stock' : 'Afficher le stock bas'}{!lowOnly && lowStock.length > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800 dark:bg-red-900 dark:text-red-200">{lowStock.length}</span>}</button>
    </div>

    <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[900px] text-left">
      <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700/70"><tr><th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Désignation</th><th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Quantité</th><th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Prix unitaire</th><th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th></tr></thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">{filtered.map((item) => <tr key={item.id} className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/30 ${item.quantity <= 2 ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}>
        {editing === item.id ? <td colSpan={4} className="px-5 py-4"><StockForm item={item} onCancel={() => setEditing(null)} onSaved={() => setEditing(null)}/></td> : <><td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">{item.designation}</td><td className="px-4 py-4"><span className={`inline-flex min-w-10 items-center justify-center rounded-lg px-2.5 py-1 text-sm font-bold ${item.quantity <= 2 ? 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-white'}`}>{item.quantity}</span>{item.quantity <= 2 && <span className="ml-2 text-xs font-semibold text-red-700 dark:text-red-300">Stock bas</span>}</td><td className="px-4 py-4 text-sm">{item.price === null ? <span className="text-slate-400">À renseigner</span> : `${item.price.toLocaleString('fr-MA')} DH`}</td><td className="px-6 py-3"><div className="flex justify-end"><MaterialActions item={item} onEdit={() => setEditing(item.id)}/></div></td></>}
      </tr>)}{filtered.length === 0 && <tr><td colSpan={4} className="px-6 py-14 text-center text-sm text-slate-500">{query || lowOnly ? 'Aucun article ne correspond à ces filtres.' : 'Aucun article enregistré.'}</td></tr>}</tbody>
    </table></div>

    <div className="space-y-3 p-3 sm:hidden">{filtered.map((item) => <article key={item.id} className={`rounded-xl border p-4 ${item.quantity <= 2 ? 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20' : 'border-slate-200 dark:border-slate-700'}`}>
      {editing === item.id ? <StockForm item={item} onCancel={() => setEditing(null)} onSaved={() => setEditing(null)} /> : <><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold leading-5 text-slate-900 dark:text-white">{item.designation}</h3>{item.quantity <= 2 && <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-800 dark:bg-red-900 dark:text-red-200">Stock bas</span>}</div><div className="mt-3 flex items-end justify-between"><div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Quantité</p><p className={`mt-0.5 text-lg font-bold ${item.quantity <= 2 ? 'text-red-700 dark:text-red-300' : 'text-slate-900 dark:text-white'}`}>{item.quantity}</p></div><div className="text-right"><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Prix unitaire</p><p className="mt-1 text-sm font-semibold">{item.price === null ? <span className="font-normal text-slate-400">À renseigner</span> : `${item.price.toLocaleString('fr-MA')} DH`}</p></div></div><div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700"><MaterialActions item={item} onEdit={() => setEditing(item.id)}/></div></>}
    </article>)}{filtered.length === 0 && <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:bg-slate-900">Aucun article ne correspond à ces filtres.</p>}</div>
    <footer className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-6 dark:border-slate-700">Affichage de {filtered.length} sur {materials.length} articles</footer>
  </section>;
}
