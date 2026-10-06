'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { recordManualSale } from '@/app/actions';

export default function NewSaleModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await recordManualSale(formData);
      setIsOpen(false);
    } catch (err: any) {
      alert(err.message || "Erreur d'autorisation");
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
                <select name="brand" required className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all">
                  <option value="">Selectionnez une marque...</option>
                  <option value="Carrier">Carrier</option>
                  <option value="CIAT">CIAT</option>
                  <option value="Daikool">Daikool</option>
                  <option value="TCL">TCL</option>
                </select>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Puissance (BTU)</label>
                <select name="btu" required className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all">
                  <option value="">Selectionnez la puissance...</option>
                  <option value="9000_BTU">9000 BTU</option>
                  <option value="12000_BTU">12000 BTU</option>
                  <option value="18000_BTU">18000 BTU</option>
                  <option value="24000_BTU">24000 BTU</option>
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
                <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 text-white rounded-xl p-3 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm">
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
