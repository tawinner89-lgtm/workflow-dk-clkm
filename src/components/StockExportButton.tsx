import { Download } from 'lucide-react';

export type StockExportTab = 'climatiseurs' | 'materiel' | 'ventes' | 'history' | 'quotes';

const labels: Record<StockExportTab, string> = {
  climatiseurs: 'Exporter les climatiseurs',
  materiel: 'Exporter le matériel',
  ventes: 'Exporter les ventes',
  history: 'Exporter l’historique',
  quotes: 'Exporter les devis',
};

export default function StockExportButton({ tab }: { tab: StockExportTab }) {
  return (
    <a
      href={`/api/inventory/export?tab=${tab}`}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
    >
      <Download size={16} />
      {labels[tab]}
    </a>
  );
}
