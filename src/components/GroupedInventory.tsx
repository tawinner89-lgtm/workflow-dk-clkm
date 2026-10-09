'use client';

import { Minus, Plus } from 'lucide-react';
import { adjustStock } from '@/app/actions';
import { getCatalogOffers } from '@/lib/business';

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

export default function GroupedInventory({ inventory }: { inventory: InventoryItem[] }) {
  return (
    <div className="p-0">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50/50">
          <tr>
            <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produit</th>
            <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Qté</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/80">
          {inventory.map((item) => {
            const offers = getCatalogOffers(item.brand, item.btu);
            return (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="py-3 px-5">
                  <div className="font-medium text-slate-900">{item.brand}</div>
                  <div className="text-xs text-slate-500 mt-1">{item.btu.replace('_', ' ')} · {item.ac_type}</div>
                  {offers.map((offer) => <div key={`${offer.modele}-${offer.prix_promo}`} className="mt-1 text-xs text-slate-600">
                    <span>{offer.modele}: </span>
                    {offer.prix_normal ? <span className="mr-1 text-slate-400 line-through">{offer.prix_normal} DH TTC</span> : null}
                    <span className="font-semibold text-slate-900">{offer.prix_promo} DH TTC</span>
                    {offer.installation_incluse ? <span className="ml-1 text-emerald-700">· Installation incluse</span> : null}
                  </div>)}
                </td>
                <td className="py-3 px-5 text-right align-middle">
                  <div className="flex items-center justify-end gap-2">
                    <form action={() => handleAdjust(item.id, -1)}>
                      <button type="submit" disabled={item.stock_quantity <= 0} className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors disabled:opacity-30" title="Diminuer">
                        <Minus size={14} strokeWidth={2.5} />
                      </button>
                    </form>
                    <span className={`font-semibold text-sm min-w-5 text-center ${item.stock_quantity === 0 ? 'text-red-600' : 'text-slate-700'}`}>{item.stock_quantity}</span>
                    <form action={() => handleAdjust(item.id, 1)}>
                      <button type="submit" className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors" title="Augmenter">
                        <Plus size={14} strokeWidth={2.5} />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            );
          })}
          {inventory.length === 0 && <tr><td colSpan={2} className="py-12 text-center text-slate-400 text-sm">Aucun produit enregistré.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
