'use client';

import { type FormEvent, useMemo, useState, useTransition } from 'react';
import { Ban, Check, Copy, FileDown, FilePlus2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { cancelQuote, convertQuoteToSale, createQuote, deleteQuote, duplicateQuote, updateQuote } from '@/app/quote-actions';
import { getCatalogOffers, servicePrices } from '@/lib/business';

type Product = { id: number; brand: string; btu: string; ac_type: string; stock_quantity: number; price_ttc: number | null };
type Quote = {
  id: string; reference: string; createdAt: string; customerName: string; customerPhone: string;
  customerAddress: string | null; brand: string; btu: string; acType: string; modelName: string;
  quantity: number; unitPrice: number; installationPrice: number; installationIncluded: boolean; additionalItems: string; status: string;
};
type Result = { ok: true } | { ok: false; error: string };
const dh = (amount: number) => `${amount.toLocaleString('fr-MA')} DH TTC`;
type QuoteLine = { quantity: number; description: string; unitPriceHt: number };
const money = (amount: number) => `${amount.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH`;

async function downloadQuote(quote: Quote) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const vatRate = 0.20;
  let additionalItems: Array<{ description: string; quantity: number; unitPrice: number }> = [];
  try {
    const parsed: unknown = JSON.parse(quote.additionalItems || '[]');
    if (Array.isArray(parsed)) additionalItems = parsed.filter((item): item is { description: string; quantity: number; unitPrice: number } =>
      item && typeof item.description === 'string' && Number.isFinite(item.quantity) && Number.isFinite(item.unitPrice));
  } catch { /* Old quotes have no supplementary lines. */ }

  // Catalogue and service prices are stored TTC. Additional quote lines are
  // entered HT, matching the sample invoice layout and its 20% VAT summary.
  const lines: QuoteLine[] = [{
    quantity: quote.quantity,
    description: `${quote.brand} ${quote.btu.replace('_', ' ')} ${quote.acType} ${quote.modelName}`,
    unitPriceHt: quote.unitPrice / (1 + vatRate),
  }];
  if (quote.installationPrice) lines.push({
    quantity: quote.quantity,
    description: 'Main d’œuvre d’installation (pré-câblage cuivre existant)',
    unitPriceHt: quote.installationPrice / (1 + vatRate),
  });
  else if (quote.installationIncluded) lines.push({ quantity: 1, description: 'Installation incluse', unitPriceHt: 0 });
  for (const item of additionalItems) lines.push({
    quantity: item.quantity, description: item.description, unitPriceHt: item.unitPrice,
  });

  const subtotalHt = lines.reduce((sum, line) => sum + line.quantity * line.unitPriceHt, 0);
  const tax = Math.round(subtotalHt * vatRate * 100) / 100;
  const totalTtc = Math.round((subtotalHt + tax) * 100) / 100;
  const advance = Math.round(totalTtc * 0.30 * 100) / 100;
  const balance = Math.round((totalTtc - advance) * 100) / 100;
  const teal: [number, number, number] = [30, 178, 190];
  const margin = 18;

  const drawSnowflake = (x: number, y: number) => {
    pdf.setDrawColor(...teal); pdf.setLineWidth(1.2);
    for (let index = 0; index < 3; index++) {
      const angle = (Math.PI / 3) * index;
      const dx = Math.cos(angle) * 10; const dy = Math.sin(angle) * 10;
      pdf.line(x - dx, y - dy, x + dx, y + dy);
    }
  };
  const drawHeader = (continuation = false) => {
    pdf.setFillColor(...teal); pdf.rect(0, 0, pageWidth, 2.5, 'F');
    drawSnowflake(31, 31);
    pdf.setTextColor(35, 60, 68); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13);
    pdf.text('DK-CLIM', 48, 25);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
    pdf.text(pdf.splitTextToSize('151 BD DE LA RESISTANCE, 5ÈME ÉTAGE, APPART. 14', 83), 48, 32);
    pdf.text(pdf.splitTextToSize('ESPACE ATLANTIQUE · CASABLANCA · MAROC', 83), 48, 40);
    pdf.text('Tél. : 06 12 54 00 85', 48, 48);
    pdf.setTextColor(...teal); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(23);
    pdf.text(continuation ? 'Devis (suite)' : 'Devis', pageWidth - margin, 27, { align: 'right' });
    pdf.setTextColor(50, 60, 68); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
    pdf.text(`Date : ${new Date(quote.createdAt).toLocaleDateString('fr-MA', { timeZone: 'Africa/Casablanca' })}`, pageWidth - margin, 37, { align: 'right' });
    pdf.text(`N° de devis : ${quote.reference}`, pageWidth - margin, 43, { align: 'right' });
  };
  const drawTableHead = (y: number) => {
    pdf.setFillColor(...teal); pdf.rect(margin, y - 6, pageWidth - margin * 2, 10, 'F');
    pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
    pdf.text('Qté', margin + 7, y, { align: 'center' });
    pdf.text('Description', margin + 20, y);
    pdf.text('Prix unitaire HT', pageWidth - 53, y, { align: 'center' });
    pdf.text('Total HT', pageWidth - margin - 3, y, { align: 'right' });
    pdf.setTextColor(35, 45, 55); pdf.setFont('helvetica', 'normal');
  };

  drawHeader();
  pdf.setTextColor(...teal); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
  pdf.text('Facturer à', margin, 67);
  pdf.setTextColor(45, 52, 60); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
  pdf.text('Client', margin, 73);
  pdf.text(pdf.splitTextToSize(`${quote.customerName}${quote.customerAddress ? ` · ${quote.customerAddress}` : ''}`, 110), margin, 78);

  let y = 99;
  drawTableHead(y);
  y += 10;
  lines.forEach((line, index) => {
    const descriptionLines = pdf.splitTextToSize(line.description, 92);
    const rowHeight = Math.max(9, descriptionLines.length * 4.2 + 4);
    if (y + rowHeight > 214) {
      pdf.setDrawColor(220, 226, 230); pdf.line(margin, y + 2, pageWidth - margin, y + 2);
      pdf.addPage(); drawHeader(true); y = 70; drawTableHead(y); y += 10;
    }
    if (index % 2 === 1) { pdf.setFillColor(247, 249, 250); pdf.rect(margin, y - 5, pageWidth - margin * 2, rowHeight, 'F'); }
    const lineTotal = line.quantity * line.unitPriceHt;
    pdf.setFontSize(8.5); pdf.text(String(line.quantity), margin + 7, y, { align: 'center' });
    pdf.text(descriptionLines, margin + 20, y);
    pdf.text(money(line.unitPriceHt), pageWidth - 53, y, { align: 'center' });
    pdf.text(money(lineTotal), pageWidth - margin - 3, y, { align: 'right' });
    y += rowHeight;
    pdf.setDrawColor(220, 226, 230); pdf.line(margin, y, pageWidth - margin, y);
    y += 1;
  });

  if (y > 221) { pdf.addPage(); drawHeader(true); y = 78; }
  const summaryY = Math.max(y + 15, 229);
  const labelX = pageWidth - 69;
  pdf.setDrawColor(195, 205, 210); pdf.line(labelX, summaryY - 7, pageWidth - margin, summaryY - 7);
  pdf.setFontSize(9); pdf.setTextColor(70, 75, 80); pdf.setFont('helvetica', 'normal');
  pdf.text('Sous-total HT', labelX, summaryY);
  pdf.text(money(subtotalHt), pageWidth - margin, summaryY, { align: 'right' });
  pdf.text('TVA (20 %)', labelX, summaryY + 7);
  pdf.text(money(tax), pageWidth - margin, summaryY + 7, { align: 'right' });
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(45, 55, 62);
  pdf.text('Total TTC', labelX, summaryY + 16);
  pdf.text(money(totalTtc), pageWidth - margin, summaryY + 16, { align: 'right' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(75, 80, 85);
  const termsY = Math.min(summaryY + 33, 270);
  pdf.text(`Avance 30 % : ${money(advance)}`, margin, termsY);
  pdf.text(`Le reste à la livraison : ${money(balance)}`, margin, termsY + 5);
  pdf.text('Devis valable 15 jours.', margin, termsY + 10);
  if (quote.installationPrice) pdf.text('Tarif installation applicable si le pré-câblage cuivre est déjà en place.', margin, termsY + 15);
  pdf.setFont('helvetica', 'italic'); pdf.text('Merci de votre confiance.', margin, Math.min(termsY + 23, 284));
  pdf.setFillColor(...teal); pdf.rect(0, 290, pageWidth, 2.5, 'F');
  pdf.save(`${quote.reference}.pdf`);
}

export default function QuoteConsole({ inventory, quotes }: { inventory: Product[]; quotes: Quote[] }) {
  const [open, setOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [productId, setProductId] = useState('');
  const [modelName, setModelName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [installationRequested, setInstallationRequested] = useState(false);
  const [additionalLineIds, setAdditionalLineIds] = useState<number[]>([]);
  const [nextAdditionalLineId, setNextAdditionalLineId] = useState(0);
  const [editUnitPrice, setEditUnitPrice] = useState(0);
  const [editInstallationPrice, setEditInstallationPrice] = useState(0);
  const [editInstallationIncluded, setEditInstallationIncluded] = useState(false);
  const [editExtras, setEditExtras] = useState<Array<{ id: number; description: string; quantity: number; unitPrice: number }>>([]);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const product = inventory.find((item) => String(item.id) === productId);
  const offers = useMemo(() => product?.ac_type === 'Split' ? getCatalogOffers(product.brand, product.btu) : [], [product]);
  const stockPriceSelected = modelName === '__STOCK_PRICE__';
  const offer = stockPriceSelected ? offers.find((item) => item.prix_promo === product?.price_ttc) : offers.find((item) => item.modele === modelName);
  const selectedPrice = stockPriceSelected ? product?.price_ttc : offer?.prix_promo;
  const hasPriceChoices = product?.price_ttc !== null && product?.price_ttc !== undefined || offers.length > 0;
  const installationPrice = installationRequested && !offer?.installation_incluse ? Number(servicePrices.installation) : 0;
  const matchingStock = (quote: Quote) => inventory.find((item) => item.brand === quote.brand && item.btu === quote.btu && item.ac_type === quote.acType)?.stock_quantity || 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError('');
    startTransition(() => {
      const action = editingQuote ? updateQuote(editingQuote.id, data) : createQuote(data);
      void action.then((result) => {
        if (result.ok) { setOpen(false); setEditingQuote(null); setProductId(''); setModelName(''); setQuantity(1); setInstallationRequested(false); setAdditionalLineIds([]); setNextAdditionalLineId(0); setEditExtras([]); }
        else setError(result.error);
      }).catch(() => setError('Impossible de créer le devis. Réessayez.'));
    });
  }

  function beginEdit(quote: Quote) {
    let extras: Array<{ description: string; quantity: number; unitPrice: number }> = [];
    try { const parsed: unknown = JSON.parse(quote.additionalItems || '[]'); if (Array.isArray(parsed)) extras = parsed; } catch { /* Keep an empty list for old records. */ }
    setEditingQuote(quote); setProductId(String(inventory.find((item) => item.brand === quote.brand && item.btu === quote.btu && item.ac_type === quote.acType)?.id || ''));
    setModelName(quote.modelName); setQuantity(quote.quantity); setEditUnitPrice(quote.unitPrice); setEditInstallationPrice(quote.installationPrice);
    setEditInstallationIncluded(quote.installationIncluded); setEditExtras(extras.map((item, id) => ({ ...item, id }))); setNextAdditionalLineId(extras.length);
    setAdditionalLineIds([]); setError(''); setOpen(true);
  }

  function perform(action: () => Promise<Result>, message: string) {
    if (!window.confirm(message)) return;
    setError('');
    startTransition(() => {
      void action().then((result) => { if (!result.ok) setError(result.error); })
        .catch(() => setError('Action impossible. Réessayez.'));
    });
  }

  function quoteTotal(quote: Quote) {
    let extraTotalHt = 0;
    try {
      const items: unknown = JSON.parse(quote.additionalItems || '[]');
      if (Array.isArray(items)) extraTotalHt = items.reduce((sum: number, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
    } catch { /* Existing quotes do not have extra lines. */ }
    return quote.quantity * (quote.unitPrice + quote.installationPrice) + Math.round(extraTotalHt * 1.2);
  }

  return <div className="max-w-7xl mx-auto space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div><h2 className="text-lg font-semibold">Devis clients</h2><p className="text-sm text-slate-500">Un devis ne réserve ni ne diminue le stock. La vente est enregistrée lors de sa conversion.</p></div>
      <button type="button" onClick={() => { setEditingQuote(null); setError(''); setOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"><FilePlus2 size={17} /> Nouveau devis</button>
    </div>
    {error && !open && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-700"><tr><th className="p-4">Référence</th><th className="p-4">Client</th><th className="p-4">Produit</th><th className="p-4">Total TTC</th><th className="p-4">Statut</th><th className="p-4 text-right">Actions</th></tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {quotes.map((quote) => <tr key={quote.id}>
            <td className="p-4"><strong>{quote.reference}</strong><div className="text-xs text-slate-500">{new Date(quote.createdAt).toLocaleDateString('fr-MA', { timeZone: 'Africa/Casablanca' })}</div></td>
            <td className="p-4">{quote.customerName}<div className="text-xs text-slate-500">{quote.customerPhone}</div></td>
            <td className="p-4">{quote.quantity} × {quote.brand} {quote.btu.replace('_', ' ')} · {quote.acType}<div className="text-xs text-slate-500">{quote.modelName}{quote.installationPrice ? ' · Installation sous condition de pré-câblage' : quote.installationIncluded ? ' · Installation incluse' : ''}</div></td>
            <td className="p-4 font-semibold">{dh(quoteTotal(quote))}</td>
            <td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${quote.status === 'CONVERTI' ? 'bg-emerald-50 text-emerald-700' : quote.status === 'ANNULE' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{quote.status === 'CONVERTI' ? 'Vente confirmée' : quote.status === 'ANNULE' ? 'Annulé' : 'En attente'}</span></td>
            <td className="p-4"><div className="flex justify-end gap-1">
              <button type="button" onClick={() => { void downloadQuote(quote).catch(() => setError('Téléchargement PDF impossible.')); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Télécharger le devis PDF" aria-label={`Télécharger ${quote.reference}`}><FileDown size={17} /></button>
              <button type="button" disabled={pending} onClick={() => perform(() => duplicateQuote(quote.id), `Dupliquer ${quote.reference} en nouveau devis ?`)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40" title="Dupliquer le devis" aria-label={`Dupliquer ${quote.reference}`}><Copy size={16} /></button>
              {quote.status !== 'ANNULE' && <button type="button" disabled={pending} onClick={() => beginEdit(quote)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-40" title="Modifier le devis" aria-label={`Modifier ${quote.reference}`}><Pencil size={16} /></button>}
              {quote.status === 'EN_ATTENTE' && <button type="button" disabled={pending || matchingStock(quote) < quote.quantity} onClick={() => perform(() => convertQuoteToSale(quote.id), `Confirmer ${quote.reference} et retirer ${quote.quantity} unité(s) du stock ?`)} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-30" title={matchingStock(quote) < quote.quantity ? 'Stock insuffisant' : 'Convertir en vente'} aria-label={`Convertir ${quote.reference} en vente`}><Check size={17} /></button>}
              {(quote.status === 'EN_ATTENTE' || quote.status === 'CONVERTI') && <button type="button" disabled={pending} onClick={() => perform(() => cancelQuote(quote.id), quote.status === 'CONVERTI' ? `Annuler ${quote.reference} ? La vente sera annulée et le stock remis en inventaire.` : `Annuler ${quote.reference} ?`)} className="rounded-lg p-2 text-amber-600 hover:bg-amber-50 disabled:opacity-40" title="Annuler le devis" aria-label={`Annuler ${quote.reference}`}><Ban size={16} /></button>}
              <button type="button" disabled={pending} onClick={() => perform(() => deleteQuote(quote.id), quote.status === 'CONVERTI' ? `Supprimer ${quote.reference} ? La vente sera annulée et le stock remis en inventaire.` : `Supprimer définitivement ${quote.reference} ?`)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-40" title="Supprimer le devis" aria-label={`Supprimer ${quote.reference}`}><Trash2 size={16} /></button>
            </div></td>
          </tr>)}
          {quotes.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-slate-500">Aucun devis pour le moment.</td></tr>}
        </tbody>
      </table>
    </div>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="new-quote-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between"><h3 id="new-quote-title" className="text-lg font-semibold">{editingQuote ? `Modifier ${editingQuote.reference}` : 'Nouveau devis'}</h3><button type="button" onClick={() => { setOpen(false); setEditingQuote(null); }} disabled={pending} aria-label="Fermer"><X size={20} /></button></div>
        <form onSubmit={submit} className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2"><label className="font-medium">Nom du client<input name="customerName" required maxLength={100} defaultValue={editingQuote?.customerName || ''} className="mt-1 w-full rounded-lg border p-2.5 text-slate-900" /></label><label className="font-medium">Téléphone<input name="customerPhone" required maxLength={50} defaultValue={editingQuote?.customerPhone || ''} className="mt-1 w-full rounded-lg border p-2.5 text-slate-900" /></label></div>
          <label className="block font-medium">Adresse / ville<input name="customerAddress" maxLength={250} defaultValue={editingQuote?.customerAddress || ''} className="mt-1 w-full rounded-lg border p-2.5 text-slate-900" /></label>
          <label className="block font-medium">Produit<select name="productId" required value={productId} onChange={(event) => { setProductId(event.target.value); setModelName(''); }} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-slate-900"><option value="">Choisir un produit...</option>{inventory.map((item) => <option key={item.id} value={item.id}>{item.brand} · {item.btu.replace('_', ' ')} · {item.ac_type}</option>)}</select></label>
          {product && editingQuote && <>
            <label className="block font-medium">Modèle<input name="modelName" required maxLength={100} value={modelName} onChange={(event) => setModelName(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-slate-900" /></label>
            <div className="grid gap-3 sm:grid-cols-3"><label className="font-medium">Quantité<input name="quantity" type="number" required min={1} max={100} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-1 w-full rounded-lg border p-2.5 text-slate-900" /></label><label className="font-medium">Prix TTC / unité<input name="unitPrice" type="number" required min={1} max={1000000} value={editUnitPrice} onChange={(event) => setEditUnitPrice(Number(event.target.value))} className="mt-1 w-full rounded-lg border p-2.5 text-slate-900" /></label><label className="font-medium">Installation TTC<input name="installationPrice" type="number" min={0} max={1000000} value={editInstallationPrice} onChange={(event) => setEditInstallationPrice(Number(event.target.value))} className="mt-1 w-full rounded-lg border p-2.5 text-slate-900" /></label></div>
            <label className="flex items-center gap-2"><input name="installationIncluded" type="checkbox" checked={editInstallationIncluded} onChange={(event) => setEditInstallationIncluded(event.target.checked)} /> Installation incluse</label>
          </>}
          {product && !editingQuote && <><p className="text-xs text-slate-500">Stock actuel : {product.stock_quantity} · prix du devis sans réservation</p>
            {hasPriceChoices ? <label className="block font-medium">Modèle / prix TTC<select name="modelName" required value={modelName} onChange={(event) => setModelName(event.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-slate-900"><option value="">Choisir le prix...</option>{product.price_ttc !== null && <option value="__STOCK_PRICE__">Prix du stock · {dh(product.price_ttc)}</option>}{offers.map((item) => <option key={item.modele} value={item.modele}>{item.modele} · {dh(item.prix_promo)}{item.installation_incluse ? ' · installation incluse' : ''}</option>)}</select></label> : <><label className="block font-medium">Modèle<input name="modelName" required maxLength={100} value={modelName} onChange={(event) => setModelName(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-slate-900" /></label><label className="block font-medium">Prix unitaire TTC validé par l’administrateur (DH)<input name="manualPrice" type="number" required min={1} max={1000000} step={1} className="mt-1 w-full rounded-lg border p-2.5 text-slate-900" /></label></>}
            <label className="block font-medium">Quantité<input name="quantity" type="number" required min={1} max={100} step={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-1 w-full rounded-lg border p-2.5 text-slate-900" /></label>
            <label className="flex items-center gap-2"><input name="installationRequested" type="checkbox" checked={installationRequested} onChange={(event) => setInstallationRequested(event.target.checked)} /> Ajouter l’installation{offer?.installation_incluse ? ' (déjà incluse)' : ` · ${dh(Number(servicePrices.installation))} par unité si n7as dayz`}</label>
            {installationRequested && !offer?.installation_incluse && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Prix valable uniquement si les tubes en cuivre sont déjà pré-installés. Sinon, une visite et un devis complémentaire sont nécessaires.</p>}
            {(selectedPrice || !hasPriceChoices) && <p className="font-semibold">{selectedPrice ? `Total : ${dh(quantity * (selectedPrice + installationPrice))}` : 'Le total sera calculé avec le prix saisi.'}</p>}
          </>}
          {product && <section className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2"><div><p className="font-semibold">Lignes supplémentaires</p><p className="text-xs text-slate-500">Matériel ou main-d’œuvre, saisis hors taxes (HT).</p></div>
              <button type="button" disabled={editingQuote ? editExtras.length >= 15 : additionalLineIds.length >= 15} onClick={() => { if (editingQuote) setEditExtras((items) => [...items, { id: nextAdditionalLineId, description: '', quantity: 1, unitPrice: 0 }]); else setAdditionalLineIds((ids) => [...ids, nextAdditionalLineId]); setNextAdditionalLineId((id) => id + 1); }} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"><Plus size={14} /> Ajouter</button>
            </div>
            {editingQuote ? editExtras.map((item, index) => <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_64px_96px_28px] items-end gap-2">
              <label className="min-w-0 text-xs font-medium">Description<input name="additionalDescription" value={item.description} onChange={(event) => setEditExtras((items) => items.map((row) => row.id === item.id ? { ...row, description: event.target.value } : row))} maxLength={150} className="mt-1 w-full rounded-lg border p-2 text-sm text-slate-900" /></label>
              <label className="text-xs font-medium">Qté<input name="additionalQuantity" type="number" min={1} max={100} value={item.quantity} onChange={(event) => setEditExtras((items) => items.map((row) => row.id === item.id ? { ...row, quantity: Number(event.target.value) } : row))} className="mt-1 w-full rounded-lg border p-2 text-sm text-slate-900" /></label>
              <label className="text-xs font-medium">Prix HT<input name="additionalUnitPrice" type="number" min={0} max={1000000} value={item.unitPrice} onChange={(event) => setEditExtras((items) => items.map((row) => row.id === item.id ? { ...row, unitPrice: Number(event.target.value) } : row))} className="mt-1 w-full rounded-lg border p-2 text-sm text-slate-900" /></label>
              <button type="button" onClick={() => setEditExtras((items) => items.filter((row) => row.id !== item.id))} className="mb-1 rounded p-1 text-red-600 hover:bg-red-50" aria-label={`Supprimer la ligne ${index + 1}`}><Trash2 size={15} /></button>
            </div>) : additionalLineIds.map((id, index) => <div key={id} className="grid grid-cols-[minmax(0,1fr)_64px_96px_28px] items-end gap-2">
              <label className="min-w-0 text-xs font-medium">Description<input name="additionalDescription" maxLength={150} placeholder="Ex. câble, goulotte..." className="mt-1 w-full rounded-lg border p-2 text-sm text-slate-900" /></label>
              <label className="text-xs font-medium">Qté<input name="additionalQuantity" type="number" min={1} max={100} defaultValue={1} className="mt-1 w-full rounded-lg border p-2 text-sm text-slate-900" /></label>
              <label className="text-xs font-medium">Prix HT<input name="additionalUnitPrice" type="number" min={0} max={1000000} step={1} defaultValue={0} className="mt-1 w-full rounded-lg border p-2 text-sm text-slate-900" /></label>
              <button type="button" onClick={() => setAdditionalLineIds((ids) => ids.filter((candidate) => candidate !== id))} className="mb-1 rounded p-1 text-red-600 hover:bg-red-50" aria-label={`Supprimer la ligne ${index + 1}`}><Trash2 size={15} /></button>
            </div>)}
          </section>}
          {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-red-700">{error}</p>}
          <button type="submit" disabled={pending || !product} className="w-full rounded-lg bg-slate-900 p-3 font-semibold text-white disabled:opacity-50">{pending ? 'Enregistrement...' : editingQuote ? 'Enregistrer les modifications' : 'Créer le devis'}</button>
        </form>
      </section>
    </div>}
  </div>;
}
