'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { recordManualSale } from '@/app/actions';
type InventoryOption = { id: number; brand: string; btu: string; ac_type: string; stock_quantity: number };

function unique(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

export default function NewSaleModal({ inventory = [] }: { inventory?: InventoryOption[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const availableProducts = inventory.filter((item) => item.stock_quantity > 0);
  const brands = unique(availableProducts.map((item) => item.brand)).sort();
  const [brand, setBrand] = useState('');
  const [btu, setBtu] = useState('');
  const [acType, setAcType] = useState('');
  const productsForBrand = availableProducts.filter((item) => item.brand === brand);
  const btus = unique(productsForBrand.map((item) => item.btu));
  const typesForBtu = unique(productsForBrand.filter((item) => item.btu === btu).map((item) => item.ac_type));

  async function handleSubmit(formData: FormData) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await recordManualSale(formData);
      setIsOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur d'autorisation");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
      >
        <Plus size={16} />
        Nouvelle Vente
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center p-6 border-b border-slate-100/80">
              <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Ajouter une vente</h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form action={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Marque</label>
                <select name="brand" required value={brand} onChange={(event) => {
                  const nextBrand = event.target.value;
                  const first = availableProducts.find((item) => item.brand === nextBrand);
                  setBrand(nextBrand); setBtu(first?.btu || ''); setAcType(first?.ac_type || '');
                }} className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all">
                  <option value="">{brands.length ? 'Selectionnez une marque...' : 'Aucun produit en stock'}</option>
                  {brands.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Puissance (BTU)</label>
                <select name="btu" required value={btu} onChange={(event) => {
                  const nextBtu = event.target.value;
                  const first = productsForBrand.find((item) => item.btu === nextBtu);
                  setBtu(nextBtu); setAcType(first?.ac_type || '');
                }} className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all">
                  <option value="">Selectionnez la puissance...</option>
                  {btus.map((option) => <option key={option} value={option}>{option.replace('_', ' ')}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Type</label>
                <select name="ac_type" required value={acType} onChange={(event) => setAcType(event.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all">
                  <option value="">Selectionnez un type...</option>
                  {typesForBtu.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Nom du Client</label>
                <input type="text" name="customer_name" placeholder="Ex: Othman Tazi" className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Telephone</label>
                <input type="text" name="customer_phone" placeholder="Ex: 0612345678" className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all" />
              </div>

              <div className="pt-4">
                <button type="submit" disabled={isSubmitting || availableProducts.length === 0} className="w-full bg-slate-900 text-white rounded-xl p-3 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm">
                  {isSubmitting ? "Enregistrement..." : "Enregistrer la vente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
