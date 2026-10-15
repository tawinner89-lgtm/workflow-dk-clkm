'use client';

import { useState } from 'react';
import { Copy, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { adjustMaterialStock, createStockMaterial, deleteStockMaterial, duplicateStockMaterial, updateStockMaterial } from '@/app/actions';

type Material = { id: number; designation: string; quantity: number; price: number | null };

function StockForm({ item, onCancel }: { item?: Material; onCancel?: () => void }) {
  const action = item ? updateStockMaterial.bind(null, item.id) : createStockMaterial;
  return <form action={action} className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_110px_130px_auto]">
    <input required maxLength={160} name="designation" defaultValue={item?.designation} placeholder="Désignation" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
    <input required min="0" step="1" type="number" name="quantity" defaultValue={item?.quantity ?? 0} placeholder="Quantité" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
    <input min="0" step="0.01" type="number" name="price" defaultValue={item?.price ?? ''} placeholder="Prix (DH)" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
    <div className="flex gap-2"><button className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Save size={15}/>{item ? 'Enregistrer' : 'Ajouter'}</button>{onCancel && <button type="button" onClick={onCancel} className="rounded-lg border px-3 text-slate-500 dark:border-slate-600"><X size={16}/></button>}</div>
  </form>;
}

export default function MaterialsInventory({ materials }: { materials: Material[] }) {
  const [editing, setEditing] = useState<number | null>(null);
  const lowStock = materials.filter((item) => item.quantity <= 2);
  return <section className="overflow-hidden rounded-2xl border border-slate-100/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-700">
      <div><h2 className="text-base font-semibold">Matériel &amp; pièces</h2><p className="mt-1 text-xs text-slate-500">Désignation, quantité en stock et prix unitaire</p></div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{materials.length} articles</span>
    </header>
    {lowStock.length > 0 && <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><strong>Alerte stock bas :</strong> {lowStock.map((item) => `${item.designation} (${item.quantity})`).join(' · ')}</div>}
    <div className="border-b border-slate-100 p-4 dark:border-slate-700"><StockForm /></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left">
      <thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">Désignation</th><th className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">Quantité</th><th className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">Prix unitaire</th><th className="px-5 py-3 text-right text-xs uppercase tracking-wide text-slate-500">Actions</th></tr></thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">{materials.map((item) => <tr key={item.id} className={item.quantity <= 2 ? 'bg-red-50/70 dark:bg-red-950/30' : ''}>
        <td colSpan={editing === item.id ? 4 : undefined} className="px-5 py-3">{editing === item.id ? <StockForm item={item} onCancel={() => setEditing(null)} /> : <span className="text-sm font-medium">{item.designation}</span>}</td>
        {editing !== item.id && <><td className={`px-5 py-3 text-sm font-bold ${item.quantity <= 2 ? 'text-red-700 dark:text-red-300' : ''}`}>{item.quantity}{item.quantity <= 2 && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800 dark:bg-red-900 dark:text-red-200">Stock bas</span>}</td>
        <td className="px-5 py-3 text-sm">{item.price === null ? <span className="text-slate-400">À renseigner</span> : `${item.price.toLocaleString('fr-MA')} DH`}</td>
        <td className="px-5 py-3"><div className="flex justify-end gap-1">
          <button type="button" onClick={() => setEditing(item.id)} title="Modifier" className="rounded p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><Pencil size={16}/></button>
          <form action={duplicateStockMaterial.bind(null, item.id)}><button title="Dupliquer" className="rounded p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><Copy size={16}/></button></form>
          <form action={adjustMaterialStock.bind(null, item.id, -1)}><button disabled={item.quantity <= 0} title="Retirer une unité" className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700">−</button></form>
          <form action={adjustMaterialStock.bind(null, item.id, 1)}><button title="Ajouter une unité" className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"><Plus size={15}/></button></form>
          <form action={deleteStockMaterial.bind(null, item.id)} onSubmit={(event) => { if (!window.confirm(`Supprimer « ${item.designation} » ? L’action sera conservée dans l’historique.`)) event.preventDefault(); }}><button title="Supprimer" className="rounded p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><Trash2 size={16}/></button></form>
        </div></td></>}
      </tr>)}{materials.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">Aucun article enregistré.</td></tr>}</tbody>
    </table></div>
  </section>;
}
