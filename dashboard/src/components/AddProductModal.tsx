'use client';
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { addInventoryProduct } from '../app/actions';
import { catalogBrands, catalogBtuOptions } from '@/lib/business';

export default function AddProductModal() {
  const [isOpen, setIsOpen] = useState(false);

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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Ajouter un produit ou marque</h2>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form action={async (formData) => {
                await addInventoryProduct(formData);
                setIsOpen(false);
            }} className="p-6 space-y-5">
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 block">Marque</label>
                <select
                  name="brand" 
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                >
                  <option value="">Choisir une marque</option>
                  {catalogBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 block">Puissance (BTU)</label>
                <select
                  name="btu" 
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                >
                  <option value="">Choisir une puissance</option>
                  {catalogBtuOptions.map((btu) => <option key={btu} value={btu}>{btu.replace('_', ' ')}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 block">Quantité Initiale</label>
                <input 
                  name="stock" 
                  type="number" 
                  min="0"
                  defaultValue="0"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                />
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-emerald-500/30">
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
