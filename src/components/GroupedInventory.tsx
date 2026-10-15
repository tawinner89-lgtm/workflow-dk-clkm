'use client';

import { useMemo, useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { adjustStock, deleteInventoryBrand } from '@/app/actions';
import { catalogAcTypes, getCatalogOffers } from '@/lib/business';

type InventoryItem = {
  id: number;
  brand: string;
  btu: string;
  ac_type: string;
  stock_quantity: number;
  price_ttc: number | null;
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
  const [isSwitching, startTransition] = useTransition();
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of inventory) counts.set(item.ac_type, (counts.get(item.ac_type) || 0) + 1);
    return counts;
  }, [inventory]);
  const brandGroups = useMemo(() => {
    const brands = new Map<string, { label: string; products: InventoryItem[] }>();
    for (const item of inventory) {
      if (item.ac_type !== activeType) continue;
      const key = item.brand.trim().toLocaleLowerCase('fr');
      const group = brands.get(key) || { label: item.brand, products: [] };
      group.products.push(item);
      brands.set(key, group);
    }
    return Array.from(brands.values())
      .map((group) => ({ ...group, products: group.products.slice().sort((a, b) => Number(a.btu.replace(/\D/g, '')) - Number(b.btu.replace(/\D/g, ''))) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [inventory, activeType]);
  const lowStock = useMemo(() => inventory.filter((item) => item.stock_quantity <= 2), [inventory]);

  return (
    <div className="p-0">
      {lowStock.length > 0 && <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/40"><p className="text-sm font-bold text-red-900 dark:text-red-200">{lowStock.length} alerte{lowStock.length > 1 ? 's' : ''} — stock bas (2 unités ou moins)</p><div className="mt-2 flex flex-wrap gap-1.5">{lowStock.slice(0, 6).map((item) => <span key={item.id} className="rounded-md border border-red-200 bg-white/80 px-2 py-1 text-xs font-medium text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">{item.brand} {item.btu.replace('_', ' ')} · {item.stock_quantity}</span>)}{lowStock.length > 6 && <span className="px-1 py-1 text-xs font-semibold text-red-800 dark:text-red-200">+{lowStock.length - 6} autres</span>}</div></div>}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        {types.map((type) => {
          const count = typeCounts.get(type) || 0;
          return (
            <button
              key={type}
              type="button"
              onClick={() => startTransition(() => setActiveType(type))}
              aria-pressed={activeType === type}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${activeType === type ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}`}
            >
              {type} <span className="ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className={`grid grid-cols-1 gap-2 p-3 transition-opacity duration-150 sm:grid-cols-2 ${isSwitching ? 'opacity-60' : 'opacity-100'}`}>
        {brandGroups.map(({ label, products }) => (
          <section key={`${activeType}-${label}`} className="min-w-0 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
            <header className="mb-2 flex items-center justify-between gap-2">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{label}</div>
              <button type="button" onClick={() => handleDeleteBrand(label)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-red-900 dark:hover:bg-red-950/30" title={`Supprimer ${label}`} aria-label={`Supprimer la marque ${label}`}>
                <Trash2 size={13} /> Supprimer
              </button>
            </header>
            <div className="grid grid-cols-2 gap-1.5">
              {products.map((item) => {
                  const offers = item.ac_type === 'Split' ? getCatalogOffers(item.brand, item.btu) : [];
                  return (
                    <div key={item.id} className="min-w-0 rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-700/60">
                      <div className="flex items-center justify-between gap-1">
                        <span className="whitespace-nowrap text-[10px] font-semibold text-slate-700 dark:text-slate-100" title={item.btu.replace('_', ' ')}>{item.btu.replace(/\D/g, '')}</span>
                        <span className={`text-xs font-bold ${item.stock_quantity <= 2 ? 'text-red-700 dark:text-red-300' : 'text-slate-800 dark:text-white'}`} title={item.stock_quantity <= 2 ? 'Alerte : stock bas (2 ou moins)' : undefined}>{item.stock_quantity}{item.stock_quantity <= 2 && <span className="ml-1 text-[9px]">⚠</span>}</span>
                        <button type="button" onClick={() => handleAdjust(item.id, -1)} disabled={item.stock_quantity <= 0} className="rounded px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 dark:hover:bg-slate-600" title="Retirer une unité" aria-label={`Retirer une unité de ${item.brand} ${item.btu}`}>
                          −1
                        </button>
                        <button type="button" onClick={() => handleAdjust(item.id, 1)} className="rounded px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:bg-white hover:text-slate-800 dark:hover:bg-slate-600" title="Ajouter une unité" aria-label={`Ajouter une unité à ${item.brand} ${item.btu}`}>
                          +1
                        </button>
                      </div>
                      {(item.price_ttc !== null || offers.length > 0) && <div className="mt-1 space-y-0.5" title={item.price_ttc !== null ? `Prix stock : ${item.price_ttc} DH TTC` : offers.map((offer) => `${offer.modele}: ${offer.prix_promo} DH TTC`).join(' · ')}>
                        {item.price_ttc !== null ? <div className="text-[10px] font-semibold text-slate-800 dark:text-slate-100">{item.price_ttc.toLocaleString('fr-MA')} DH TTC</div> : offers.map((offer) => <div key={`${offer.modele}-${offer.prix_promo}`} className="flex min-w-0 items-baseline justify-between gap-1 text-[9px] leading-3">
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
