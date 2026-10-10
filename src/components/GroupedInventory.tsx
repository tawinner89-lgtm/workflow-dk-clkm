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

      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
        {brandGroups.map(({ label, products }) => (
          <section key={`${activeType}-${label}`} className="min-w-0 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
            <header className="mb-2 flex items-center justify-between gap-2">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{label}</div>
              <button type="button" onClick={() => handleDeleteBrand(label)} className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30" title={`Supprimer ${label}`} aria-label={`Supprimer la marque ${label}`}>
                <Trash2 size={14} />
              </button>
            </header>
            <div className="grid grid-cols-2 gap-1.5">
              {products
                .slice()
                .sort((a, b) => Number(a.btu.replace(/\D/g, '')) - Number(b.btu.replace(/\D/g, '')))
                .map((item) => {
                  const offers = item.ac_type === 'Split' ? getCatalogOffers(item.brand, item.btu) : [];
                  return (
                    <div key={item.id} className="min-w-0 rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-700/60">
                      <div className="flex items-center justify-between gap-1">
                        <span className="whitespace-nowrap text-[10px] font-semibold text-slate-700 dark:text-slate-100" title={item.btu.replace('_', ' ')}>{item.btu.replace(/\D/g, '')}</span>
                        <span className={`text-xs font-bold ${item.stock_quantity === 0 ? 'text-red-600' : 'text-slate-800 dark:text-white'}`}>{item.stock_quantity}</span>
                        <button type="button" onClick={() => handleAdjust(item.id, -1)} disabled={item.stock_quantity <= 0} className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-600" title="Diminuer">
                          <Minus size={11} />
                        </button>
                        <button type="button" onClick={() => handleAdjust(item.id, 1)} className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-600" title="Ajouter au stock">
                          <Plus size={11} />
                        </button>
                      </div>
                      {offers.length > 0 && <div className="mt-1 space-y-0.5" title={offers.map((offer) => `${offer.modele}: ${offer.prix_promo} DH TTC`).join(' · ')}>
                        {offers.map((offer) => <div key={`${offer.modele}-${offer.prix_promo}`} className="flex min-w-0 items-baseline justify-between gap-1 text-[9px] leading-3">
                          {offers.length > 1 && <span className="truncate text-slate-500">{offer.modele}</span>}
                          <span className="shrink-0 font-semibold text-slate-800 dark:text-slate-100">{offer.prix_promo.toLocaleString('fr-MA')} DH TTC</span>
                        </div>)}
                      </div>}
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
        {brandGroups.length === 0 && (
          <div className="col-span-full px-5 py-10 text-center text-sm text-slate-400">Aucun produit {activeType} enregistré.</div>
        )}
      </div>
    </div>
  );
}
