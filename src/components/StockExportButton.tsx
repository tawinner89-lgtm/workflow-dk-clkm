import { Download } from 'lucide-react';

export default function StockExportButton() {
  return (
    <a
      href="/api/inventory/export"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
    >
      <Download size={16} />
      Exporter Excel
    </a>
  );
}
