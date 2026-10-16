'use client';

import { ReactNode, useState, useTransition } from 'react';
import { AirVent, Boxes, ReceiptText } from 'lucide-react';
import StockExportButton from '@/components/StockExportButton';

type SectionKey = 'climatiseurs' | 'materiel' | 'ventes';

export default function InventoryWorkspace({
  inventoryCount,
  materialCount,
  salesCount,
  lowAcCount,
  lowMaterialCount,
  climate,
  materials,
  sales,
}: {
  inventoryCount: number;
  materialCount: number;
  salesCount: number;
  lowAcCount: number;
  lowMaterialCount: number;
  climate: ReactNode;
  materials: ReactNode;
  sales: ReactNode;
}) {
  const [active, setActive] = useState<SectionKey>('climatiseurs');
  const [isPending, startTransition] = useTransition();
  const sections: { id: SectionKey; title: string; hint: string; count?: number; low: number; icon: typeof AirVent }[] = [
    { id: 'climatiseurs', title: 'Climatiseurs', hint: 'Références et niveaux de stock', count: inventoryCount, low: lowAcCount, icon: AirVent },
    { id: 'materiel', title: 'Matériel & pièces', hint: 'Consommables et accessoires', count: materialCount, low: lowMaterialCount, icon: Boxes },
    { id: 'ventes', title: 'Ventes', hint: 'Suivi des commandes clients', count: salesCount, low: 0, icon: ReceiptText },
  ];

  const content = active === 'climatiseurs' ? climate : active === 'materiel' ? materials : sales;
  return <div className="mx-auto max-w-7xl space-y-5">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="group" aria-label="Catégories du stock">
      {sections.map(({ id, title, hint, count, low, icon: Icon }) => {
        const selected = active === id;
        return <button key={id} type="button" aria-pressed={selected} onClick={() => startTransition(() => setActive(id))}
          className={`group flex min-h-[94px] items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${selected ? 'border-blue-600 bg-white shadow-sm ring-1 ring-blue-600 dark:border-blue-400 dark:bg-slate-800 dark:ring-blue-400' : 'border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800'}`}>
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${selected ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}><Icon size={21}/></span>
          <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">{title}{count !== undefined && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200">{count}</span>}</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{hint}</span></span>
          {low > 0 && <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-[11px] font-bold text-red-800 dark:bg-red-950/60 dark:text-red-200">{low} alerte{low > 1 ? 's' : ''}</span>}
        </button>;
      })}
    </div>
    <section aria-label={sections.find((section) => section.id === active)?.title} className={`min-w-0 transition-opacity duration-150 ${isPending ? 'opacity-60' : 'opacity-100'}`}>
      <div className="mb-3 flex justify-end"><StockExportButton tab={active} /></div>
      {content}
    </section>
  </div>;
}
