export const dynamic = 'force-dynamic';
export const metadata = { title: 'DK CLIM - Inventaire & Ventes' };
import { prisma } from '@/lib/prisma';
import GroupedInventory from '@/components/GroupedInventory';
import NewSaleModal from '@/components/NewSaleModal';
import AddProductModal from '@/components/AddProductModal';
import StockExportButton from '@/components/StockExportButton';
import SalesActions from '@/components/SalesActions';
import SaleStatusSelect from '@/components/SaleStatusSelect';
import DeliverySettingsButton from '@/components/DeliverySettingsButton';
import QuoteConsole from '@/components/QuoteConsole';
import MaterialsInventory from '@/components/MaterialsInventory';
import { PackageOpen, History, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function InventoryPage({ searchParams }: { searchParams?: { tab?: string; page?: string } }) {
  const session = await getSession();
  if (session?.role !== 'ADMIN') redirect('/admin?next=%2Finventory');
  const activeTab = searchParams?.tab === 'history' ? 'history' : searchParams?.tab === 'quotes' ? 'quotes' : 'inventory';

  const inventory = await prisma.inventory.findMany({
    orderBy: [{ brand: 'asc' }, { btu: 'asc' }]
  });

  const requestedHistoryPage = Math.max(1, Number.parseInt(searchParams?.page || '1', 10) || 1);
  const [sales, stockHistoryCount, materialHistoryCount, quotes, deliverySettings, materials] = await Promise.all([
    activeTab === 'inventory' ? prisma.salesLog.findMany({ orderBy: { timestamp: 'desc' }, take: 50 }) : Promise.resolve([]),
    activeTab === 'history' ? prisma.stockAddition.count() : Promise.resolve(0),
    activeTab === 'history' ? prisma.materialMovement.count() : Promise.resolve(0),
    activeTab === 'quotes' ? prisma.quote.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }) : Promise.resolve([]),
    prisma.deliverySettings.findUnique({ where: { id: 1 } }),
    prisma.stockMaterial.findMany({ orderBy: { designation: 'asc' } }),
  ]);
  const historyCount = stockHistoryCount + materialHistoryCount;
  const salesForUi = sales.map((sale) => ({
    id: Number(sale.id),
    timestamp: sale.timestamp.toISOString(),
    brand: sale.brand,
    btu: sale.btu,
    ac_type: sale.ac_type,
    customer_name: sale.customer_name,
    customer_phone: sale.customer_phone,
    customer_address: sale.customer_address,
    status: sale.status,
    notes: sale.notes,
    deliveryNotifiedAt: sale.deliveryNotifiedAt?.toISOString() || null,
  }));
  const inventoryForActions = inventory.map(({ brand, btu, ac_type, stock_quantity }) => ({
    brand, btu, ac_type, stock_quantity,
  }));
  const historyPageSize = 100;
  const historyPageCount = Math.max(1, Math.ceil(historyCount / historyPageSize));
  const historyPage = Math.min(requestedHistoryPage, historyPageCount);
  const historyRows = activeTab === 'history' ? await prisma.$queryRaw<Array<{ createdAt: Date; product: string; action: string; quantity: string; user: string }>>`
    SELECT "createdAt", "brand" || ' · ' || replace("btu", '_', ' ') || ' · ' || "ac_type" AS product,
      "operation" AS action,
      (CASE WHEN "operation" IN ('REMOVE','SALE','DELETE_BRAND') THEN '−' ELSE '+' END || "quantityAdded"::text) AS quantity,
      "addedBy" AS user
    FROM "StockAddition"
    UNION ALL
    SELECT "createdAt", "designation" AS product, "action",
      (COALESCE("quantityBefore"::text, '—') || ' → ' || COALESCE("quantityAfter"::text, 'supprimé') || ' · Prix: ' || COALESCE("priceBefore"::text, '—') || ' → ' || COALESCE("priceAfter"::text, '—') || ' DH') AS quantity,
      "performedBy" AS user
    FROM "MaterialMovement"
    ORDER BY "createdAt" DESC
    LIMIT ${historyPageSize} OFFSET ${(historyPage - 1) * historyPageSize}
  ` : [];
  const materialsForUi = materials.map((item) => ({ id: item.id, designation: item.designation, quantity: item.quantity, price: item.price === null ? null : Number(item.price) }));

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
          <div className="flex flex-wrap gap-3"><DeliverySettingsButton phone={deliverySettings?.phone || null} /><StockExportButton />{activeTab === 'inventory' && <><AddProductModal inventory={inventory} /><NewSaleModal inventory={inventory} /></>}</div>
        </div>
        <nav className="mt-6 flex w-fit gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" aria-label="Sections de l'inventaire">
          <Link href="/inventory" aria-current={activeTab === 'inventory' ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'inventory' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
            Inventaire &amp; Ventes
          </Link>
          <Link href="/inventory?tab=history" aria-current={activeTab === 'history' ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
            Historique
          </Link>
          <Link href="/inventory?tab=quotes" aria-current={activeTab === 'quotes' ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'quotes' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
            Devis
          </Link>
        </nav>
      </header>

      {activeTab === 'inventory' ? <div className="max-w-7xl mx-auto space-y-8">
      <MaterialsInventory materials={materialsForUi} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* INVENTORY SECTION */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100/80 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-2 p-5 border-b border-slate-100/80 dark:border-slate-700 bg-white dark:bg-slate-800">
              <PackageOpen size={18} className="text-slate-400" />
              <h2 className="text-base font-semibold tracking-tight">Stock Actuel</h2>
            </div>
            
            <GroupedInventory inventory={inventory} />
          </div>
        </div>

        {/* SALES LOG SECTION */}
        <div className="lg:col-span-7 flex flex-col gap-4">
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
                  {salesForUi.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="py-4 px-5 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(sale.timestamp).toLocaleString('fr-MA', { 
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                        }).replace(',', ' ')}
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-medium text-slate-900 dark:text-white">{sale.brand || "-"}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{sale.btu?.replace('_', ' ')} · {sale.ac_type}</div>
                        {sale.notes && <div className="text-[11px] text-blue-600 dark:text-blue-300">{sale.notes}</div>}
                      </td>
                      <td className="py-4 px-5">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{sale.customer_name || '-'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{sale.customer_phone || '-'}</div>
                        {sale.customer_address && <div className="max-w-44 truncate text-xs text-slate-500 dark:text-slate-400" title={sale.customer_address}>{sale.customer_address}</div>}
                      </td>
                      <td className="py-4 px-5">
                        <SaleStatusSelect saleId={sale.id} status={sale.status} />
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex justify-end gap-1.5">
                          <SalesActions sale={sale} inventory={inventoryForActions} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {salesForUi.length === 0 && (
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

      </div></div> : activeTab === 'quotes' ? <QuoteConsole inventory={inventory.map(({ id, brand, btu, ac_type, stock_quantity, price_ttc }) => ({ id, brand, btu, ac_type, stock_quantity, price_ttc }))} quotes={quotes.map((quote) => ({
        id: quote.id, reference: quote.reference, createdAt: quote.createdAt.toISOString(),
        customerName: quote.customerName, customerPhone: quote.customerPhone, customerAddress: quote.customerAddress,
        brand: quote.brand, btu: quote.btu, acType: quote.acType, modelName: quote.modelName,
        quantity: quote.quantity, unitPrice: quote.unitPrice, installationPrice: quote.installationPrice,
        installationIncluded: quote.installationIncluded, additionalItems: quote.additionalItems, status: quote.status,
      }))} /> : <section className="max-w-7xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100/80 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center gap-2 p-5 border-b border-slate-100/80 dark:border-slate-700">
          <History size={18} className="text-slate-400" />
          <h2 className="text-base font-semibold tracking-tight">Historique des mouvements de stock</h2>
          <span className="ml-auto text-xs text-slate-500">{historyCount} mouvements au total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-slate-50/50 dark:bg-slate-700/50"><tr>
              <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase">Date et heure</th>
              <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase">Produit</th>
              <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase">Mouvement</th>
              <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase">Quantité</th>
              <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase">Utilisateur</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {historyRows.map((row, index) => <tr key={`${row.createdAt.toISOString()}-${index}`}>
                <td className="py-3 px-5 text-sm text-slate-500">{row.createdAt.toLocaleString('fr-MA', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Africa/Casablanca' })}</td>
                <td className="py-3 px-5 text-sm font-medium">{row.product}</td>
                <td className="py-3 px-5 text-sm">{({ ADD: 'Ajout', REMOVE: 'Retrait', SALE: 'Vente', RETURN: 'Retour', DELETE_BRAND: 'Suppression marque', CREATE: 'Création', UPDATE: 'Modification', DELETE: 'Suppression', DUPLICATE: 'Duplication', STOCK_ADD: 'Entrée de stock', STOCK_REMOVE: 'Sortie de stock', INITIAL_STOCK: 'Stock initial' } as Record<string, string>)[row.action] || row.action}</td>
                <td className="py-3 px-5 text-sm">{row.quantity}</td>
                <td className="py-3 px-5 text-sm text-slate-500">{row.user}</td>
              </tr>)}
              {historyRows.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-sm text-slate-400">Aucun mouvement enregistré.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm dark:border-slate-700">
          <span className="text-slate-500">Page {historyPage} sur {historyPageCount}</span>
          <div className="flex gap-2">
            {historyPage > 1 ? <Link href={`/inventory?tab=history&page=${historyPage - 1}`} className="rounded-lg border border-slate-200 px-3 py-2 font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700">Précédent</Link> : <span className="rounded-lg border border-slate-100 px-3 py-2 text-slate-300 dark:border-slate-700">Précédent</span>}
            {historyPage < historyPageCount ? <Link href={`/inventory?tab=history&page=${historyPage + 1}`} className="rounded-lg border border-slate-200 px-3 py-2 font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700">Suivant</Link> : <span className="rounded-lg border border-slate-100 px-3 py-2 text-slate-300 dark:border-slate-700">Suivant</span>}
          </div>
        </div>
      </section>}
    </div>
  );
}




