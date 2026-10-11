'use server';

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getCatalogOffers, servicePrices } from '@/lib/business';
import { revalidatePath } from 'next/cache';

type QuoteResult = { ok: true } | { ok: false; error: string };
class QuoteError extends Error {}

async function runQuoteAction(name: string, action: () => Promise<void>): Promise<QuoteResult> {
  try {
    if ((await getSession())?.role !== 'ADMIN') return { ok: false, error: 'Session expirée. Reconnectez-vous.' };
    await action();
    revalidatePath('/inventory');
    return { ok: true };
  } catch (error) {
    if (error instanceof QuoteError) return { ok: false, error: error.message };
    console.error(`[QUOTE ${name}]`, error);
    return { ok: false, error: 'Action impossible pour le moment. Réessayez.' };
  }
}

export async function createQuote(formData: FormData): Promise<QuoteResult> {
  return runQuoteAction('create', async () => {
    const customerName = String(formData.get('customerName') || '').trim();
    const customerPhone = String(formData.get('customerPhone') || '').trim();
    const customerAddress = String(formData.get('customerAddress') || '').trim();
    const productId = Number(formData.get('productId'));
    const modelName = String(formData.get('modelName') || '').trim();
    const quantity = Number(formData.get('quantity'));
    const installationRequested = formData.get('installationRequested') === 'on';
    if (!customerName || customerName.length > 100 || !customerPhone || customerPhone.length > 50 || customerAddress.length > 250) {
      throw new QuoteError('Renseignez un nom et un téléphone valides.');
    }
    if (!Number.isSafeInteger(productId) || productId < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new QuoteError('Produit ou quantité invalide.');
    }

    const product = await prisma.inventory.findUnique({ where: { id: productId } });
    if (!product) throw new QuoteError('Produit introuvable dans le stock.');
    const offers = product.ac_type === 'Split' ? getCatalogOffers(product.brand, product.btu) : [];
    const stockPriceSelected = modelName === '__STOCK_PRICE__';
    if (stockPriceSelected && product.price_ttc === null) throw new QuoteError('Prix du stock indisponible.');
    const offer = stockPriceSelected
      ? offers.find((candidate) => candidate.prix_promo === product.price_ttc)
      : offers.find((candidate) => candidate.modele === modelName);
    let unitPrice: number;
    if (stockPriceSelected) {
      unitPrice = product.price_ttc!;
    } else if (offers.length > 0) {
      if (!offer) throw new QuoteError('Sélectionnez un modèle et un prix du catalogue.');
      unitPrice = offer.prix_promo;
    } else {
      unitPrice = Number(formData.get('manualPrice'));
      if (!modelName || modelName.length > 100) throw new QuoteError('Indiquez le modèle du produit.');
      if (!Number.isSafeInteger(unitPrice) || unitPrice < 1 || unitPrice > 1_000_000) throw new QuoteError('Indiquez un prix TTC valide pour ce produit hors catalogue.');
    }

    const installationIncluded = Boolean(offer?.installation_incluse);
    const installationPrice = installationRequested && !installationIncluded ? Number(servicePrices.installation) : 0;
    if (!Number.isSafeInteger(installationPrice) || installationPrice < 0) throw new QuoteError('Tarif installation invalide.');
    const dateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const datePart = (type: string) => dateParts.find((part) => part.type === type)?.value || '';
    const day = `${datePart('year')}${datePart('month')}${datePart('day')}`;
    const reference = `DEV-${day}-${randomUUID().slice(0, 8).toUpperCase()}`;

    await prisma.quote.create({ data: {
      reference, customerName, customerPhone, customerAddress: customerAddress || null,
      brand: product.brand, btu: product.btu, acType: product.ac_type,
      modelName: offer?.modele || (stockPriceSelected ? 'Prix du stock' : modelName), quantity, unitPrice,
      installationPrice, installationIncluded,
    } });
  });
}

export async function cancelQuote(quoteId: string): Promise<QuoteResult> {
  return runQuoteAction('cancel', async () => {
    const updated = await prisma.quote.updateMany({
      where: { id: quoteId, status: 'EN_ATTENTE' }, data: { status: 'ANNULE' },
    });
    if (updated.count !== 1) throw new QuoteError('Devis introuvable ou déjà traité.');
  });
}

export async function convertQuoteToSale(quoteId: string): Promise<QuoteResult> {
  return runQuoteAction('convert', async () => {
    await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({ where: { id: quoteId } });
      if (!quote || quote.status !== 'EN_ATTENTE') throw new QuoteError('Devis introuvable ou déjà traité.');

      const claimed = await tx.quote.updateMany({
        where: { id: quoteId, status: 'EN_ATTENTE' },
        data: { status: 'CONVERTI', convertedAt: new Date() },
      });
      if (claimed.count !== 1) throw new QuoteError('Ce devis a déjà été traité.');

      const stock = await tx.inventory.updateMany({
        where: { brand: quote.brand, btu: quote.btu, ac_type: quote.acType, stock_quantity: { gte: quote.quantity } },
        data: { stock_quantity: { decrement: quote.quantity } },
      });
      if (stock.count !== 1) throw new QuoteError('Stock insuffisant. Le devis reste en attente; aucune vente créée.');
      const product = await tx.inventory.findUnique({
        where: { brand_btu_ac_type: { brand: quote.brand, btu: quote.btu, ac_type: quote.acType } },
      });
      if (!product) throw new QuoteError('Produit introuvable; conversion annulée.');

      await tx.stockAddition.create({ data: {
        inventoryId: product.id, brand: quote.brand, btu: quote.btu, ac_type: quote.acType,
        quantityAdded: quote.quantity, operation: 'SALE', addedBy: `Conversion devis ${quote.reference}`,
      } });
      await tx.salesLog.createMany({ data: Array.from({ length: quote.quantity }, (_, index) => ({
        brand: quote.brand, btu: quote.btu, ac_type: quote.acType,
        customer_name: quote.customerName, customer_phone: quote.customerPhone,
        status: 'CONFIRMED',
        notes: `Devis ${quote.reference} · ${quote.modelName} · ${quote.unitPrice} DH TTC${quote.installationPrice ? ` · Installation ${quote.installationPrice} DH TTC (pré-câblage existant)` : ''}${quote.installationIncluded ? ' · Installation incluse' : ''}${quote.quantity > 1 ? ` · unité ${index + 1}/${quote.quantity}` : ''}`,
      })) });
    }, { isolationLevel: 'Serializable' });
  });
}
