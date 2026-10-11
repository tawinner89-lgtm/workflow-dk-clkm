'use client';
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { addInventoryProduct } from '../app/actions';
import { catalogAcTypes, catalogBrands, catalogBtuOptions } from '@/lib/business';

type InventoryOption = { brand: string; btu: string; ac_type: string; stock_quantity: number };

export default function AddProductModal({ inventory = [] }: { inventory?: InventoryOption[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const brandOptions = Array.from(new Set([...catalogBrands, ...inventory.map((item) => item.brand)])).sort();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all font-medium text-sm"
      >
        <Plus size={18} />
        Nouveau Produit
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="sticky top-0 z-10 flex justify-between items-center p-4 border-b border-slate-100 bg-white">
              <h2 className="text-lg font-bold text-slate-800">Ajouter un produit ou marque</h2>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Fermer" className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <form action={async (formData) => {
                await addInventoryProduct(formData);
                setIsOpen(false);
            }} className="p-4 space-y-3">

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 block">Marque</label>
                <input
                  name="brand"
                  list="inventory-brand-options"
                  required
                  maxLength={50}
                  placeholder="Ex. Airwell"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                />
                <datalist id="inventory-brand-options">
                  {brandOptions.map((brand) => <option key={brand} value={brand} />)}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 block">Type de climatiseur</label>
                  <select name="ac_type" required defaultValue="Split" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none">
                    {catalogAcTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 block">Puissance (BTU)</label>
                  <select
                    name="btu"
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                  >
                    <option value="">Choisir une puissance</option>
                    {catalogBtuOptions.map((btu) => <option key={btu} value={btu}>{btu.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 block">Quantité initiale</label>
                  <input
                    name="stock"
                    type="number"
                    min="0"
                    defaultValue="0"
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="product-price" className="text-sm font-semibold text-slate-700 block">Prix de vente TTC (DH)</label>
                  <input
                    id="product-price"
                    name="price_ttc"
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    placeholder="Ex. 3800"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                  />
                </div>
              </div>
              <p className="-mt-2 text-xs text-slate-500">Prix facultatif. Un prix saisi met à jour celui du produit existant.</p>

              <div className="pt-1">
                <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-4 rounded-xl transition-colors shadow-lg shadow-emerald-500/30">
                  Ajouter à l&apos;inventaire
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
