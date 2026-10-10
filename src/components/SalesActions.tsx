'use client';

import { type FormEvent, useMemo, useState, useTransition } from 'react';
import { Copy, Pencil, Trash2, X } from 'lucide-react';
import { deleteSale, duplicateSale, editSale } from '@/app/actions';

type Sale = {
  id: number;
  brand: string;
  btu: string;
  ac_type: string;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
};

type Product = { brand: string; btu: string; ac_type: string; stock_quantity: number };
type SaleActionResult = { ok: true } | { ok: false; error: string };

export default function SalesActions({ sale, inventory }: { sale: Sale; inventory: Product[] }) {
  const [editing, setEditing] = useState(false);
  const [productKey, setProductKey] = useState(`${sale.brand}::${sale.btu}::${sale.ac_type}`);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const canDuplicate = inventory.some((item) =>
    item.brand === sale.brand && item.btu === sale.btu && item.ac_type === sale.ac_type && item.stock_quantity > 0
  );
  const products = useMemo(() => {
    const options = new Map<string, Product>();
    for (const item of inventory) options.set(`${item.brand}::${item.btu}::${item.ac_type}`, item);
    const currentKey = `${sale.brand}::${sale.btu}::${sale.ac_type}`;
    if (!options.has(currentKey)) options.set(currentKey, { brand: sale.brand, btu: sale.btu, ac_type: sale.ac_type, stock_quantity: 0 });
    return Array.from(options.entries());
  }, [inventory, sale]);

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const [brand, btu, ac_type] = productKey.split('::');
    formData.set('brand', brand);
    formData.set('btu', btu);
    formData.set('ac_type', ac_type);
    setError('');
    startTransition(() => {
      void editSale(sale.id, formData).then((result) => {
        if (result.ok) setEditing(false);
        else setError(result.error);
      }).catch((cause: unknown) => {
        console.error('Modification de vente impossible:', cause);
        setError('La modification a échoué. Réessayez.');
      });
    });
  }

  function runAction(action: () => Promise<SaleActionResult>, confirmMessage: string) {
    if (!window.confirm(confirmMessage)) return;
    setError('');
    startTransition(() => {
      void action().then((result) => {
        if (!result.ok) setError(result.error);
      }).catch((cause: unknown) => {
        console.error('Action sur la vente impossible:', cause);
        setError('Action impossible. Réessayez.');
      });
    });
  }

  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center justify-end gap-1">
        <button type="button" onClick={() => { setProductKey(`${sale.brand}::${sale.btu}::${sale.ac_type}`); setError(''); setEditing(true); }} disabled={pending} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50 dark:hover:bg-slate-700" title="Modifier la vente" aria-label="Modifier la vente">
          <Pencil size={15} />
        </button>
        <span title={canDuplicate ? 'Dupliquer la vente' : 'Stock indisponible pour cette vente'}>
          <button type="button" onClick={() => runAction(() => duplicateSale(sale.id), 'Créer une nouvelle vente identique ? Le stock sera diminué si le produit est disponible.')} disabled={pending || !canDuplicate} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 disabled:opacity-50 dark:hover:bg-slate-700" aria-label={canDuplicate ? 'Dupliquer la vente' : 'Duplication impossible : stock indisponible'}>
            <Copy size={15} />
          </button>
        </span>
        <button type="button" onClick={() => runAction(() => deleteSale(sale.id), 'Supprimer cette vente ? Le stock sera remis si cette vente avait diminué le stock.')} disabled={pending} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/30" title="Supprimer la vente" aria-label="Supprimer la vente">
          <Trash2 size={15} />
        </button>
      </div>
      {error && <p role="alert" className="mt-1 max-w-48 text-right text-[11px] text-red-600">{error}</p>}

      {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setEditing(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby={`edit-sale-title-${sale.id}`} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-800">
          <header className="mb-4 flex items-center justify-between">
            <h2 id={`edit-sale-title-${sale.id}`} className="text-lg font-semibold">Modifier la vente #{sale.id}</h2>
            <button type="button" onClick={() => setEditing(false)} disabled={pending} aria-label="Fermer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><X size={18} /></button>
          </header>
          <form onSubmit={submitEdit} className="space-y-3">
            <label className="block text-sm font-medium">Produit
              <select value={productKey} onChange={(event) => setProductKey(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-600 dark:bg-slate-900">
                {products.map(([key, item]) => <option key={key} value={key}>{item.brand} · {item.btu.replace('_', ' ')} · {item.ac_type}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">Nom du client
              <input name="customer_name" maxLength={100} defaultValue={sale.customer_name || ''} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-600 dark:bg-slate-900" />
            </label>
            <label className="block text-sm font-medium">Téléphone
              <input name="customer_phone" maxLength={50} defaultValue={sale.customer_phone || ''} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-600 dark:bg-slate-900" />
            </label>
            <label className="block text-sm font-medium">Notes
              <textarea name="notes" maxLength={2000} defaultValue={sale.notes || ''} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-600 dark:bg-slate-900" />
            </label>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(false)} disabled={pending} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-600">Annuler</button>
              <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </form>
        </section>
      </div>}
    </div>
  );
}
