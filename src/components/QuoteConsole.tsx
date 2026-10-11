'use client';

import { type FormEvent, useMemo, useState, useTransition } from 'react';
import { Check, FileDown, FilePlus2, X } from 'lucide-react';
import { cancelQuote, convertQuoteToSale, createQuote } from '@/app/quote-actions';
import { getCatalogOffers, servicePrices } from '@/lib/business';

type Product = { id: number; brand: string; btu: string; ac_type: string; stock_quantity: number };
type Quote = {
  id: string; reference: string; createdAt: string; customerName: string; customerPhone: string;
  customerAddress: string | null; brand: string; btu: string; acType: string; modelName: string;
  quantity: number; unitPrice: number; installationPrice: number; installationIncluded: boolean; status: string;
};
type Result = { ok: true } | { ok: false; error: string };
const dh = (amount: number) => `${amount.toLocaleString('fr-MA')} DH TTC`;

async function downloadQuote(quote: Quote) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const total = quote.quantity * quote.unitPrice + quote.quantity * quote.installationPrice;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('DK CLIM', 18, 24);
  pdf.setFontSize(14);
  pdf.text(`DEVIS ${quote.reference}`, 18, 39);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`Date : ${new Date(quote.createdAt).toLocaleDateString('fr-MA', { timeZone: 'Africa/Casablanca' })}`, 18, 48);
  pdf.text(`Client : ${quote.customerName}`, 18, 63);
  pdf.text(`Telephone : ${quote.customerPhone}`, 18, 70);
  if (quote.customerAddress) pdf.text(pdf.splitTextToSize(`Adresse : ${quote.customerAddress}`, pageWidth - 36), 18, 77);
  pdf.setDrawColor(205, 215, 225);
  pdf.line(18, 95, pageWidth - 18, 95);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Designation', 18, 104);
  pdf.text('Qte', 135, 104);
  pdf.text('Prix TTC', 154, 104);
  pdf.setFont('helvetica', 'normal');
  const label = `${quote.brand} ${quote.btu.replace('_', ' ')} ${quote.acType} - ${quote.modelName}`;
  pdf.text(pdf.splitTextToSize(label, 112), 18, 115);
  pdf.text(String(quote.quantity), 135, 115);
  pdf.text(`${quote.unitPrice.toLocaleString('en-US')} DH TTC`, 154, 115);
  if (quote.installationPrice) {
    pdf.text('Installation sur pre-cablage existant', 18, 137);
    pdf.text(String(quote.quantity), 135, 137);
    pdf.text(`${quote.installationPrice.toLocaleString('en-US')} DH TTC`, 154, 137);
  } else if (quote.installationIncluded) {
    pdf.text('Installation incluse', 18, 137);
  }
  pdf.line(18, 151, pageWidth - 18, 151);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`TOTAL TTC : ${total.toLocaleString('en-US')} DH`, pageWidth - 18, 163, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  if (quote.installationPrice) pdf.text('Tarif installation valable si les tubes en cuivre sont deja pre-installes (n7as dayz).', 18, 178);
  pdf.text('Devis sous reserve de disponibilite lors de la confirmation de la vente.', 18, 188);
  pdf.save(`${quote.reference}.pdf`);
}

export default function QuoteConsole({ inventory, quotes }: { inventory: Product[]; quotes: Quote[] }) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [modelName, setModelName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [installationRequested, setInstallationRequested] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const product = inventory.find((item) => String(item.id) === productId);
  const offers = useMemo(() => product?.ac_type === 'Split' ? getCatalogOffers(product.brand, product.btu) : [], [product]);
  const offer = offers.find((item) => item.modele === modelName);
  const installationPrice = installationRequested && !offer?.installation_incluse ? Number(servicePrices.installation) : 0;
  const matchingStock = (quote: Quote) => inventory.find((item) => item.brand === quote.brand && item.btu === quote.btu && item.ac_type === quote.acType)?.stock_quantity || 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError('');
    startTransition(() => {
      void createQuote(data).then((result) => {
        if (result.ok) { setOpen(false); setProductId(''); setModelName(''); setQuantity(1); setInstallationRequested(false); }
        else setError(result.error);
      }).catch(() => setError('Impossible de créer le devis. Réessayez.'));
    });
  }

  function perform(action: () => Promise<Result>, message: string) {
    if (!window.confirm(message)) return;
    setError('');
    startTransition(() => {
      void action().then((result) => { if (!result.ok) setError(result.error); })
        .catch(() => setError('Action impossible. Réessayez.'));
    });
  }

  return <div className="max-w-7xl mx-auto space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div><h2 className="text-lg font-semibold">Devis clients</h2><p className="text-sm text-slate-500">Un devis ne réserve ni ne diminue le stock. La vente est enregistrée lors de sa conversion.</p></div>
      <button type="button" onClick={() => { setError(''); setOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"><FilePlus2 size={17} /> Nouveau devis</button>
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
            <td className="p-4 font-semibold">{dh(quote.quantity * (quote.unitPrice + quote.installationPrice))}</td>
            <td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${quote.status === 'CONVERTI' ? 'bg-emerald-50 text-emerald-700' : quote.status === 'ANNULE' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{quote.status === 'CONVERTI' ? 'Vente confirmée' : quote.status === 'ANNULE' ? 'Annulé' : 'En attente'}</span></td>
            <td className="p-4"><div className="flex justify-end gap-1">
              <button type="button" onClick={() => { void downloadQuote(quote).catch(() => setError('Téléchargement PDF impossible.')); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Télécharger le devis PDF" aria-label={`Télécharger ${quote.reference}`}><FileDown size={17} /></button>
              {quote.status === 'EN_ATTENTE' && <><button type="button" disabled={pending || matchingStock(quote) < quote.quantity} onClick={() => perform(() => convertQuoteToSale(quote.id), `Confirmer ${quote.reference} et retirer ${quote.quantity} unité(s) du stock ?`)} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-30" title={matchingStock(quote) < quote.quantity ? 'Stock insuffisant' : 'Convertir en vente'} aria-label={`Convertir ${quote.reference} en vente`}><Check size={17} /></button><button type="button" disabled={pending} onClick={() => perform(() => cancelQuote(quote.id), `Annuler ${quote.reference} ?`)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-30" title="Annuler le devis" aria-label={`Annuler ${quote.reference}`}><X size={17} /></button></>}
            </div></td>
          </tr>)}
          {quotes.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-slate-500">Aucun devis pour le moment.</td></tr>}
        </tbody>
      </table>
    </div>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="new-quote-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between"><h3 id="new-quote-title" className="text-lg font-semibold">Nouveau devis</h3><button type="button" onClick={() => setOpen(false)} disabled={pending} aria-label="Fermer"><X size={20} /></button></div>
        <form onSubmit={submit} className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2"><label className="font-medium">Nom du client<input name="customerName" required maxLength={100} className="mt-1 w-full rounded-lg border p-2.5 text-slate-900" /></label><label className="font-medium">Téléphone<input name="customerPhone" required maxLength={50} className="mt-1 w-full rounded-lg border p-2.5 text-slate-900" /></label></div>
          <label className="block font-medium">Adresse / ville<input name="customerAddress" maxLength={250} className="mt-1 w-full rounded-lg border p-2.5 text-slate-900" /></label>
          <label className="block font-medium">Produit<select name="productId" required value={productId} onChange={(event) => { setProductId(event.target.value); setModelName(''); }} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-slate-900"><option value="">Choisir un produit...</option>{inventory.map((item) => <option key={item.id} value={item.id}>{item.brand} · {item.btu.replace('_', ' ')} · {item.ac_type}</option>)}</select></label>
          {product && <><p className="text-xs text-slate-500">Stock actuel : {product.stock_quantity} · prix du devis sans réservation</p>
            {offers.length ? <label className="block font-medium">Modèle / tarif catalogue<select name="modelName" required value={modelName} onChange={(event) => setModelName(event.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-slate-900"><option value="">Choisir le modèle...</option>{offers.map((item) => <option key={item.modele} value={item.modele}>{item.modele} · {dh(item.prix_promo)}{item.installation_incluse ? ' · installation incluse' : ''}</option>)}</select></label> : <><label className="block font-medium">Modèle<input name="modelName" required maxLength={100} value={modelName} onChange={(event) => setModelName(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-slate-900" /></label><label className="block font-medium">Prix unitaire TTC validé par l’administrateur (DH)<input name="manualPrice" type="number" required min={1} max={1000000} step={1} className="mt-1 w-full rounded-lg border p-2.5 text-slate-900" /></label></>}
            <label className="block font-medium">Quantité<input name="quantity" type="number" required min={1} max={100} step={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-1 w-full rounded-lg border p-2.5 text-slate-900" /></label>
            <label className="flex items-center gap-2"><input name="installationRequested" type="checkbox" checked={installationRequested} onChange={(event) => setInstallationRequested(event.target.checked)} /> Ajouter l’installation{offer?.installation_incluse ? ' (déjà incluse)' : ` · ${dh(Number(servicePrices.installation))} par unité si n7as dayz`}</label>
            {installationRequested && !offer?.installation_incluse && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Prix valable uniquement si les tubes en cuivre sont déjà pré-installés. Sinon, une visite et un devis complémentaire sont nécessaires.</p>}
            {(offer || !offers.length) && <p className="font-semibold">{offer ? `Total : ${dh(quantity * (offer.prix_promo + installationPrice))}` : 'Le total sera calculé avec le prix saisi.'}</p>}
          </>}
          {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-red-700">{error}</p>}
          <button type="submit" disabled={pending || !product} className="w-full rounded-lg bg-slate-900 p-3 font-semibold text-white disabled:opacity-50">{pending ? 'Enregistrement...' : 'Créer le devis'}</button>
        </form>
      </section>
    </div>}
  </div>;
}
