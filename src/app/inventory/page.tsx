export const dynamic = 'force-dynamic';
export const metadata = { title: 'DK CLIM - Inventaire & Ventes' };
import { prisma } from '@/lib/prisma';
import GroupedInventory from '@/components/GroupedInventory';
import NewSaleModal from '@/components/NewSaleModal';
import AddProductModal from '@/components/AddProductModal';
import { confirmPendingSale, cancelPendingSale } from '@/app/actions';
import { Check, X, PackageOpen, History, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function InventoryPage() {
  const inventory = await prisma.inventory.findMany({
    orderBy: [{ brand: 'asc' }, { btu: 'asc' }]
  });

  const sales = await prisma.salesLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 50,
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 sm:p-10 font-sans text-slate-900 dark:text-slate-100">
      
      {/* HEADER */}
      <header className="mb-10 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin" className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
            <ArrowLeft size={16} />
            Retour aux Interventions
          </Link>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Inventaire & Ventes</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Gestion des stocks et confirmation des ventes WhatsApp</p>
          </div>
          <div className="flex gap-3"><AddProductModal /><NewSaleModal /></div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
        
        {/* INVENTORY SECTION */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100/80 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-2 p-5 border-b border-slate-100/80 dark:border-slate-700 bg-white dark:bg-slate-800">
              <PackageOpen size={18} className="text-slate-400" />
              <h2 className="text-base font-semibold tracking-tight">Stock Actuel</h2>
            </div>
            
            <GroupedInventory inventory={inventory} />
          </div>
        </div>

        {/* SALES LOG SECTION */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100/80 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-2 p-5 border-b border-slate-100/80 dark:border-slate-700 bg-white dark:bg-slate-800">
              <History size={18} className="text-slate-400" />
              <h2 className="text-base font-semibold tracking-tight">Dernieres Ventes</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-slate-50/50 dark:bg-slate-700/50">
                  <tr>
                    <th className="py-3 px-5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="py-3 px-5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Produit</th>
                    <th className="py-3 px-5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Client</th>
                    <th className="py-3 px-5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Statut</th>
                    <th className="py-3 px-5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 dark:divide-slate-700">
                  {sales.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="py-4 px-5 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {sale.timestamp.toLocaleString('fr-MA', { 
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                        }).replace(',', ' ')}
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-medium text-slate-900 dark:text-white">{sale.brand || "-"}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{sale.btu?.replace('_', ' ')}</div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{sale.customer_name || '-'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{sale.customer_phone || '-'}</div>
                      </td>
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase
                          ${sale.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800' : 
                            sale.status === 'CANCELLED' ? 'bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/30 dark:border-red-800' : 
                            'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900/30 dark:border-amber-800'}`}>
                          {sale.status === 'CONFIRMED' ? 'Confirme' : sale.status === 'CANCELLED' ? 'Annule' : 'En Attente'}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex justify-end gap-1.5">
                          {sale.status === 'PENDING' ? (
                            <>
                              <form action={confirmPendingSale.bind(null, sale.id)}>
                                <button type="submit" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Confirmer">
                                  <Check size={18} strokeWidth={2.5} />
                                </button>
                              </form>
                              <form action={cancelPendingSale.bind(null, sale.id, sale.brand, sale.btu)}>
                                <button type="submit" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Annuler">
                                  <X size={18} strokeWidth={2.5} />
                                </button>
                              </form>
                            </>
                          ) : (
                            <span className="w-8"></span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                        Aucune vente enregistree.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}




