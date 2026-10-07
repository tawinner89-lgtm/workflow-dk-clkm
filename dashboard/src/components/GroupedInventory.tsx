'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { adjustStock } from '@/app/actions';
import { getCatalogOffers } from '@/lib/business';

const handleAdjust = async (id: number, amount: number) => {
  try {
    await adjustStock(id, amount);
    } catch (err: unknown) {
    alert(err instanceof Error ? err.message : "Une erreur est survenue");
  }
};

type InventoryItem = {
  id: number;
  brand: string;
  btu: string;
  stock_quantity: number;
};

export default function GroupedInventory({ inventory }: { inventory: InventoryItem[] }) {
  // Group items by brand
  const grouped = inventory.reduce((acc, item) => {
    if (!acc[item.brand]) acc[item.brand] = [];
    acc[item.brand].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  const brands = Object.keys(grouped).sort();

  // Initialize selected BTU for each brand (default to the first available)
  const initialSelection = brands.reduce((acc, brand) => {
    acc[brand] = grouped[brand][0].btu;
    return acc;
  }, {} as Record<string, string>);

  const [selectedBtus, setSelectedBtus] = useState<Record<string, string>>(initialSelection);

  return (
    <div className="p-0">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50/50">
          <tr>
            <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Modele</th>
            <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Qte</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/80">
          {brands.map(brand => {
            const items = grouped[brand];
            const activeBtu = selectedBtus[brand] || items[0].btu;
            const activeItem = items.find(i => i.btu === activeBtu) || items[0];
            const activeOffers = getCatalogOffers(brand, activeBtu);

            return (
              <tr key={brand} className="hover:bg-slate-50/50 transition-colors group">
                <td className="py-3 px-5">
                  <div className="font-medium text-slate-900 mb-2">{brand}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map(item => {
                      const isActive = item.btu === activeBtu;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedBtus(prev => ({ ...prev, [brand]: item.btu }))}
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border transition-colors ${
                            isActive
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
                          }`}
                        >
                          {item.btu.replace('_', ' ')}
                        </button>
                      );
                    })}
                  </div>
                  {activeOffers.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {activeOffers.map(offer => (
                        <div key={`${offer.brand}-${offer.btu}-${offer.modele}`} className="text-xs text-slate-600">
                          <span>{offer.modele}: </span>
                          {offer.prix_normal ? <span className="mr-1 text-slate-400 line-through">{offer.prix_normal} DH TTC</span> : null}
                          <span className="font-semibold text-slate-900">{offer.prix_promo} DH TTC</span>
                          {offer.installation_incluse ? <span className="ml-1 text-emerald-700">• Installation incluse</span> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="py-3 px-5 text-right align-middle">
                  <div className="flex items-center justify-end gap-2">
                    <form action={() => handleAdjust(activeItem.id, -1)}>
                      <button type="submit" className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors" title="Diminuer">
                        <Minus size={14} strokeWidth={2.5} />
                      </button>
                    </form>

                    <div className="flex items-center justify-center gap-1.5 min-w-[2rem]">
                      {activeItem.stock_quantity === 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" title="Rupture de stock" />
                      )}
                      <span className={`font-semibold text-sm ${activeItem.stock_quantity === 0 ? 'text-red-600' : 'text-slate-700'}`}>
                        {activeItem.stock_quantity}
                      </span>
                    </div>

                    <form action={() => handleAdjust(activeItem.id, 1)}>
                      <button type="submit" className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors" title="Augmenter">
                        <Plus size={14} strokeWidth={2.5} />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            );
          })}
          {brands.length === 0 && (
            <tr>
              <td colSpan={2} className="py-12 text-center text-slate-400 text-sm">
                Aucun article en stock.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

