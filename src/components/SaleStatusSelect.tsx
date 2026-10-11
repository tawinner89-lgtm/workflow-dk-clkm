'use client';

import { useEffect, useState, useTransition } from 'react';
import { updateSaleStatus } from '@/app/actions';

const choices = [
  { value: 'NEW', label: 'Nouveau' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'CONFIRMED', label: 'Confirmée' },
  { value: 'DELIVERED', label: 'Livrée' },
  { value: 'CANCELLED', label: 'Annulée' },
] as const;

const legacyLabels: Record<string, string> = {
  PREORDER: 'Commande à importer',
  OUT_OF_STOCK: 'Rupture de stock',
};

export default function SaleStatusSelect({ saleId, status }: { saleId: number; status: string | null }) {
  const [selected, setSelected] = useState(status || 'UNKNOWN');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const isLegacy = !choices.some((choice) => choice.value === selected);

  useEffect(() => { setSelected(status || 'UNKNOWN'); }, [status]);

  function select(nextStatus: string) {
    if (nextStatus === selected) return;
    const previous = selected;
    if (nextStatus === 'CANCELLED' && !window.confirm('Annuler cette commande ? Si son stock avait été décompté, il sera remis en stock.')) return;
    if (nextStatus === 'NEW' && ['PENDING', 'CONFIRMED', 'DELIVERED'].includes(previous) && !window.confirm('Remettre cette commande au statut Nouveau ? Son unité sera remise en stock.')) return;
    setSelected(nextStatus);
    setError('');
    startTransition(() => {
      void updateSaleStatus(saleId, nextStatus).then((result) => {
        if (!result.ok) { setSelected(previous); setError(result.error); }
      }).catch(() => { setSelected(previous); setError('Changement impossible. Réessayez.'); });
    });
  }

  return <div className="min-w-[132px]">
    <label className="sr-only" htmlFor={`sale-status-${saleId}`}>Statut de la commande</label>
    <select
      id={`sale-status-${saleId}`}
      value={selected}
      onChange={(event) => select(event.target.value)}
      disabled={pending}
      className={`w-full rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 dark:bg-slate-800 ${selected === 'CONFIRMED' || selected === 'DELIVERED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : selected === 'CANCELLED' || selected === 'OUT_OF_STOCK' ? 'border-red-200 bg-red-50 text-red-700' : selected === 'NEW' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}
    >
      {isLegacy && <option value={selected} disabled>{legacyLabels[selected] || 'Statut inconnu'}</option>}
      {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
    </select>
    {error && <p role="alert" className="mt-1 max-w-44 text-[11px] text-red-600">{error}</p>}
  </div>;
}
