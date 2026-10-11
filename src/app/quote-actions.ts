'use server';

import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
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
    const extraDescriptions = formData.getAll('additionalDescription').map((value) => String(value).trim());
    const extraQuantities = formData.getAll('additionalQuantity').map((value) => Number(value));
    const extraPrices = formData.getAll('additionalUnitPrice').map((value) => Number(value));
    if (extraDescriptions.length > 15 || extraDescriptions.length !== extraQuantities.length || extraDescriptions.length !== extraPrices.length) {
      throw new QuoteError('Vérifiez les lignes supplémentaires du devis.');
    }
    const additionalItems = extraDescriptions.map((description, index) => ({
      description,
      quantity: extraQuantities[index],
      unitPrice: extraPrices[index],
    })).filter((item) => item.description || item.quantity || item.unitPrice);
    if (additionalItems.some((item) => !item.description || item.description.length > 150
      || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 100
      || !Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0 || item.unitPrice > 1_000_000)) {
      throw new QuoteError('Chaque ligne supplémentaire doit avoir une description, une quantité et un prix HT valide.');
    }
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
      installationPrice, installationIncluded, additionalItems: JSON.stringify(additionalItems),
    } });
  });
}

export async function cancelQuote(quoteId: string): Promise<QuoteResult> {
  return runQuoteAction('cancel', async () => {
    await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({ where: { id: quoteId } });
      if (!quote || !['EN_ATTENTE', 'CONVERTI'].includes(quote.status)) {
        throw new QuoteError('Devis introuvable ou déjà traité.');
      }

      if (quote.status === 'CONVERTI') await reverseConvertedQuoteSale(tx, quote);
      const updated = await tx.quote.updateMany({
        where: { id: quoteId, status: quote.status }, data: { status: 'ANNULE' },
      });
      if (updated.count !== 1) throw new QuoteError('Devis introuvable ou déjà traité.');
    });
  });
}

export async function deleteQuote(quoteId: string): Promise<QuoteResult> {
  return runQuoteAction('delete', async () => {
    await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({ where: { id: quoteId } });
      if (!quote) throw new QuoteError('Devis introuvable.');
      if (quote.status === 'CONVERTI') await reverseConvertedQuoteSale(tx, quote);
      const deleted = await tx.quote.deleteMany({ where: { id: quoteId } });
      if (deleted.count !== 1) throw new QuoteError('Devis introuvable.');
    });
  });
}

function quoteSaleNotes(quote: { reference: string; modelName: string; unitPrice: number; installationPrice: number; installationIncluded: boolean; additionalItems: string; quantity: number }, index: number) {
  return `Devis ${quote.reference} · ${quote.modelName} · ${quote.unitPrice} DH TTC${quote.installationPrice ? ` · Installation ${quote.installationPrice} DH TTC (pré-câblage existant)` : ''}${quote.installationIncluded ? ' · Installation incluse' : ''}${quote.additionalItems && quote.additionalItems !== '[]' ? ` · Extras: ${quote.additionalItems}` : ''}${quote.quantity > 1 ? ` · unité ${index + 1}/${quote.quantity}` : ''}`;
}

async function reverseConvertedQuoteSale(tx: Prisma.TransactionClient, quote: {
  id: string; reference: string; brand: string; btu: string; acType: string; quantity: number;
}) {
  const linkedSales = await tx.salesLog.findMany({
    where: { status: 'CONFIRMED', notes: { contains: quote.reference } },
    select: { id: true },
  });
  if (linkedSales.length !== quote.quantity) {
    throw new QuoteError('Les ventes liées à ce devis ne correspondent pas. Aucune modification du stock n’a été faite.');
  }

  const inventory = await tx.inventory.updateMany({
    where: { brand: quote.brand, btu: quote.btu, ac_type: quote.acType },
    data: { stock_quantity: { increment: quote.quantity } },
  });
  if (inventory.count !== 1) throw new QuoteError('Produit introuvable; annulation impossible.');
  const item = await tx.inventory.findUnique({
    where: { brand_btu_ac_type: { brand: quote.brand, btu: quote.btu, ac_type: quote.acType } },
  });
  if (!item) throw new QuoteError('Produit introuvable; annulation impossible.');

  await tx.stockAddition.create({ data: {
    inventoryId: item.id, brand: quote.brand, btu: quote.btu, ac_type: quote.acType,
    quantityAdded: quote.quantity, operation: 'RETURN', addedBy: `Annulation devis ${quote.reference}`,
  } });
  await tx.salesLog.updateMany({
    where: { id: { in: linkedSales.map((sale) => sale.id) }, status: 'CONFIRMED' },
    data: { status: 'CANCELLED' },
  });
}

export async function duplicateQuote(quoteId: string): Promise<QuoteResult> {
  return runQuoteAction('duplicate', async () => {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote) throw new QuoteError('Devis introuvable.');
    const dateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const datePart = (type: string) => dateParts.find((part) => part.type === type)?.value || '';
    const reference = `DEV-${datePart('year')}${datePart('month')}${datePart('day')}-${randomUUID().slice(0, 8).toUpperCase()}`;
    await prisma.quote.create({ data: {
      reference, customerName: quote.customerName, customerPhone: quote.customerPhone, customerAddress: quote.customerAddress,
      brand: quote.brand, btu: quote.btu, acType: quote.acType, modelName: quote.modelName,
      quantity: quote.quantity, unitPrice: quote.unitPrice, installationPrice: quote.installationPrice,
      installationIncluded: quote.installationIncluded, additionalItems: quote.additionalItems, status: 'EN_ATTENTE',
    } });
  });
}

export async function updateQuote(quoteId: string, formData: FormData): Promise<QuoteResult> {
  return runQuoteAction('update', async () => {
    const customerName = String(formData.get('customerName') || '').trim();
    const customerPhone = String(formData.get('customerPhone') || '').trim();
    const customerAddress = String(formData.get('customerAddress') || '').trim();
    const productId = Number(formData.get('productId'));
    const modelName = String(formData.get('modelName') || '').trim();
    const quantity = Number(formData.get('quantity'));
    const unitPrice = Number(formData.get('unitPrice'));
    const installationPrice = Number(formData.get('installationPrice'));
    const installationIncluded = formData.get('installationIncluded') === 'on';
    const descriptions = formData.getAll('additionalDescription').map((value) => String(value).trim());
    const quantities = formData.getAll('additionalQuantity').map((value) => Number(value));
    const prices = formData.getAll('additionalUnitPrice').map((value) => Number(value));
    if (descriptions.length > 15 || descriptions.length !== quantities.length || descriptions.length !== prices.length) throw new QuoteError('Vérifiez les lignes supplémentaires.');
    const additionalItems = descriptions.map((description, index) => ({ description, quantity: quantities[index], unitPrice: prices[index] }))
      .filter((item) => item.description || item.quantity || item.unitPrice);
    if (additionalItems.some((item) => !item.description || item.description.length > 150 || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 100 || !Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0 || item.unitPrice > 1_000_000)) throw new QuoteError('Lignes supplémentaires invalides.');
    if (!customerName || customerName.length > 100 || !customerPhone || customerPhone.length > 50 || customerAddress.length > 250 || !modelName || modelName.length > 100) throw new QuoteError('Vérifiez les informations du devis.');
    if (!Number.isSafeInteger(productId) || productId < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100 || !Number.isSafeInteger(unitPrice) || unitPrice < 1 || unitPrice > 1_000_000 || !Number.isSafeInteger(installationPrice) || installationPrice < 0 || installationPrice > 1_000_000) throw new QuoteError('Vérifiez les quantités et les prix.');
    await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({ where: { id: quoteId } });
      if (!quote || !['EN_ATTENTE', 'CONVERTI'].includes(quote.status)) {
        throw new QuoteError('Seuls les devis en attente ou confirmés peuvent être modifiés.');
      }
      const product = await tx.inventory.findUnique({ where: { id: productId } });
      if (!product) throw new QuoteError('Produit introuvable dans le stock.');

      if (quote.status === 'CONVERTI') {
        const linkedSales = await tx.salesLog.findMany({
          where: { status: 'CONFIRMED', notes: { contains: quote.reference } },
          orderBy: { id: 'asc' },
          select: { id: true },
        });
        if (linkedSales.length !== quote.quantity) {
          throw new QuoteError('Les ventes liées à ce devis ne correspondent pas. Modification annulée.');
        }

        const sameProduct = quote.brand === product.brand && quote.btu === product.btu && quote.acType === product.ac_type;
        if (sameProduct) {
          const stockDelta = quote.quantity - quantity;
          if (stockDelta !== 0) {
            const stockChange = await tx.inventory.updateMany({
              where: { brand: product.brand, btu: product.btu, ac_type: product.ac_type, ...(stockDelta < 0 ? { stock_quantity: { gte: -stockDelta } } : {}) },
              data: { stock_quantity: { increment: stockDelta } },
            });
            if (stockChange.count !== 1) throw new QuoteError('Stock insuffisant pour augmenter la quantité.');
            await tx.stockAddition.create({ data: {
              inventoryId: product.id, brand: product.brand, btu: product.btu, ac_type: product.ac_type,
              quantityAdded: Math.abs(stockDelta), operation: stockDelta > 0 ? 'RETURN' : 'SALE',
              addedBy: `Modification devis ${quote.reference}`,
            } });
          }
        } else {
          const oldProduct = await tx.inventory.findUnique({
            where: { brand_btu_ac_type: { brand: quote.brand, btu: quote.btu, ac_type: quote.acType } },
          });
          if (!oldProduct) throw new QuoteError('Ancien produit introuvable; modification annulée.');
          await tx.inventory.update({ where: { id: oldProduct.id }, data: { stock_quantity: { increment: quote.quantity } } });
          await tx.stockAddition.create({ data: {
            inventoryId: oldProduct.id, brand: oldProduct.brand, btu: oldProduct.btu, ac_type: oldProduct.ac_type,
            quantityAdded: quote.quantity, operation: 'RETURN', addedBy: `Modification devis ${quote.reference}`,
          } });
          const newStock = await tx.inventory.updateMany({
            where: { id: product.id, stock_quantity: { gte: quantity } },
            data: { stock_quantity: { decrement: quantity } },
          });
          if (newStock.count !== 1) throw new QuoteError('Stock insuffisant pour le nouveau produit.');
          await tx.stockAddition.create({ data: {
            inventoryId: product.id, brand: product.brand, btu: product.btu, ac_type: product.ac_type,
            quantityAdded: quantity, operation: 'SALE', addedBy: `Modification devis ${quote.reference}`,
          } });
        }

        const updatedQuote = {
          ...quote, customerName, customerPhone, customerAddress: customerAddress || null,
          brand: product.brand, btu: product.btu, acType: product.ac_type, modelName,
          quantity, unitPrice, installationPrice, installationIncluded,
          additionalItems: JSON.stringify(additionalItems),
        };
        const retainedSalesCount = Math.min(linkedSales.length, quantity);
        for (let index = 0; index < retainedSalesCount; index += 1) {
          const sale = linkedSales[index];
          await tx.salesLog.update({ where: { id: sale.id }, data: {
            brand: product.brand, btu: product.btu, ac_type: product.ac_type,
            customer_name: customerName, customer_phone: customerPhone, customer_address: customerAddress || null,
            notes: quoteSaleNotes(updatedQuote, index),
          } });
        }
        if (linkedSales.length > quantity) {
          await tx.salesLog.updateMany({
            where: { id: { in: linkedSales.slice(quantity).map((sale) => sale.id) }, status: 'CONFIRMED' },
            data: { status: 'CANCELLED', notes: `Devis ${quote.reference} · Unité retirée après modification du devis` },
          });
        } else if (quantity > linkedSales.length) {
          await tx.salesLog.createMany({ data: Array.from({ length: quantity - linkedSales.length }, (_, offset) => ({
            brand: product.brand, btu: product.btu, ac_type: product.ac_type,
            customer_name: customerName, customer_phone: customerPhone, customer_address: customerAddress || null,
            status: 'CONFIRMED', notes: quoteSaleNotes(updatedQuote, linkedSales.length + offset),
          })) });
        }
      }

      const updated = await tx.quote.updateMany({
        where: { id: quoteId, status: quote.status },
        data: { customerName, customerPhone, customerAddress: customerAddress || null, brand: product.brand, btu: product.btu, acType: product.ac_type, modelName, quantity, unitPrice, installationPrice, installationIncluded, additionalItems: JSON.stringify(additionalItems) },
      });
      if (updated.count !== 1) throw new QuoteError('Le devis a déjà été modifié. Rechargez la page.');
    }, { isolationLevel: 'Serializable' });
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
        customer_name: quote.customerName, customer_phone: quote.customerPhone, customer_address: quote.customerAddress,
        status: 'CONFIRMED',
        notes: quoteSaleNotes(quote, index),
      })) });
    }, { isolationLevel: 'Serializable' });
  });
}
