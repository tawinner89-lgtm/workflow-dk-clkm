'use client';

import { useState } from 'react';
import { AirVent, Bell, Boxes, Check, X } from 'lucide-react';

type LowStockProduct = { id: number; name: string; detail: string; quantity: number };

export default function StockNotifications({ acItems, materialItems }: { acItems: LowStockProduct[]; materialItems: LowStockProduct[] }) {
  const [open, setOpen] = useState(false);
  const total = acItems.length + materialItems.length;

  return <div className="relative">
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="stock-notifications-panel"
      aria-label={`Alertes de stock${total ? ` : ${total} article${total > 1 ? 's' : ''} à deux unités ou moins` : ' : aucun stock bas'}`}
      onClick={() => setOpen(value => !value)}
      className={`relative inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${total ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/70' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}
    >
      <Bell size={17} aria-hidden="true" />
      <span>Alertes de stock</span>
      <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-bold ${total ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>{total}</span>
    </button>

    {open && <div id="stock-notifications-panel" role="dialog" aria-label="Articles en stock bas" className="absolute right-0 z-50 mt-2 w-[min(92vw,26rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <div><h2 className="text-sm font-bold text-slate-900 dark:text-white">Stock bas</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Tous les articles à 2 unités ou moins</p></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fermer les alertes" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-700"><X size={17}/></button>
      </header>
      <div className="max-h-[min(65vh,32rem)] space-y-4 overflow-y-auto p-4">
        {total === 0 ? <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"><Check size={18}/>Aucun article en stock bas.</div> : <>
          {acItems.length > 0 && <section aria-labelledby="stock-alert-ac-heading">
            <h3 id="stock-alert-ac-heading" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"><AirVent size={15}/>Climatiseurs <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-800 dark:bg-red-900/60 dark:text-red-200">{acItems.length}</span></h3>
            <ul className="space-y-2">{acItems.map(item => <li key={`ac-${item.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/70 px-3 py-2.5 dark:border-red-900/60 dark:bg-red-950/20"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.name}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.detail}</p></div><span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800 dark:bg-red-900/70 dark:text-red-200">{item.quantity} unité{item.quantity > 1 ? 's' : ''}</span></li>)}</ul>
          </section>}
          {materialItems.length > 0 && <section aria-labelledby="stock-alert-material-heading">
            <h3 id="stock-alert-material-heading" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"><Boxes size={15}/>Matériel &amp; pièces <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-800 dark:bg-red-900/60 dark:text-red-200">{materialItems.length}</span></h3>
            <ul className="space-y-2">{materialItems.map(item => <li key={`material-${item.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/70 px-3 py-2.5 dark:border-red-900/60 dark:bg-red-950/20"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.name}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.detail}</p></div><span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800 dark:bg-red-900/70 dark:text-red-200">{item.quantity} unité{item.quantity > 1 ? 's' : ''}</span></li>)}</ul>
          </section>}
        </>}
      </div>
    </div>}
  </div>;
}
