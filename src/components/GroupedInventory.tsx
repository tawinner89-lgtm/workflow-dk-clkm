'use client';

import { useMemo, useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { adjustStock, deleteInventoryBrand } from '@/app/actions';
import { catalogAcTypes, getCatalogOffers } from '@/lib/business';

type InventoryItem = {
  id: number;
  brand: string;
  btu: string;
  ac_type: string;
  stock_quantity: number;
};

async function handleAdjust(id: number, amount: number) {
  try {
    await adjustStock(id, amount);
  } catch (error: unknown) {
    alert(error instanceof Error ? error.message : 'Une erreur est survenue');
  }
}

async function handleDeleteBrand(brand: string) {
  const confirmed = window.confirm(
    `Supprimer la marque ${brand} et toutes ses lignes de stock ? L'historique des mouvements et des ventes sera conservé.`
  );
  if (!confirmed) return;

  try {
    await deleteInventoryBrand(brand);
  } catch (error: unknown) {
    alert(error instanceof Error ? error.message : 'Impossible de supprimer cette marque.');
  }
}

export default function GroupedInventory({ inventory }: { inventory: InventoryItem[] }) {
  const types = useMemo(
    () => Array.from(new Set([...catalogAcTypes, ...inventory.map((item) => item.ac_type)])).filter(Boolean),
    [inventory]
  );
  const [activeType, setActiveType] = useState(types[0] || 'Split');
  const visibleInventory = inventory.filter((item) => item.ac_type === activeType);
  const brands = new Map<string, { label: string; products: InventoryItem[] }>();

  for (const item of visibleInventory) {
    const key = item.brand.trim().toLocaleLowerCase('fr');
    const group = brands.get(key) || { label: item.brand, products: [] };
    group.products.push(item);
    brands.set(key, group);
  }

  const brandGroups = Array.from(brands.values()).sort((a, b) => a.label.localeCompare(b.label, 'fr'));

  return (
    <div className="p-0">
      <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        {types.map((type) => {
          const count = inventory.filter((item) => item.ac_type === type).length;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setActiveType(type)}
              aria-pressed={activeType === type}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${activeType === type ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}`}
            >
              {type} <span className="ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <table className="w-full border-collapse text-left">
        <thead className="bg-slate-50/50 dark:bg-slate-700/30">
          <tr>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Marque</th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Puissances · Stock</th>
            <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/80 dark:divide-slate-700">
          {brandGroups.map(({ label, products }) => (
            <tr key={`${activeType}-${label}`} className="align-top transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
              <td className="px-5 py-4">
                <div className="font-semibold text-slate-900 dark:text-white">{label}</div>
                <div className="mt-1 text-xs text-slate-500">{activeType}</div>
              </td>
              <td className="px-5 py-3">
                <div className="flex flex-wrap gap-2">
                  {products
                    .slice()
                    .sort((a, b) => Number(a.btu.replace(/\D/g, '')) - Number(b.btu.replace(/\D/g, '')))
                    .map((item) => {
                      const offers = item.ac_type === 'Split' ? getCatalogOffers(item.brand, item.btu) : [];
                      return (
                        <div key={item.id} className="min-w-[142px] rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                              {item.btu.replace('_', ' ')}
                            </span>
                            <span className={`min-w-5 text-center text-sm font-bold ${item.stock_quantity === 0 ? 'text-red-600' : 'text-slate-800 dark:text-white'}`}>
                              {item.stock_quantity}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <button type="button" onClick={() => handleAdjust(item.id, -1)} disabled={item.stock_quantity <= 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-700" title="Diminuer">
                              <Minus size={14} />
                            </button>
                            <span className="text-[11px] text-slate-500">Stock</span>
                            <button type="button" onClick={() => handleAdjust(item.id, 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700" title="Ajouter au stock">
                              <Plus size={14} />
                            </button>
                          </div>
                          {offers.map((offer) => (
                            <div key={`${offer.modele}-${offer.prix_promo}`} className="mt-2 border-t border-slate-100 pt-2 text-[10px] leading-4 text-slate-500 dark:border-slate-700">
                              {offer.prix_normal ? <span className="mr-1 line-through">{offer.prix_normal} DH</span> : null}
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{offer.prix_promo} DH TTC</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                </div>
              </td>
              <td className="px-3 py-4 text-right">
                <button type="button" onClick={() => handleDeleteBrand(label)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30" title={`Supprimer ${label}`} aria-label={`Supprimer la marque ${label}`}>
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
          {brandGroups.length === 0 && (
            <tr><td colSpan={3} className="px-5 py-12 text-center text-sm text-slate-400">Aucun produit {activeType} enregistré.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
