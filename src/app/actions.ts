'use server';

import type { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { catalogAcTypes, catalogBtuOptions } from '@/lib/business';
import { changeSaleStatus, SaleStatusError, stockTrackedSaleStatuses } from '@/lib/sale-status';

function validBrand(value: string) {
  return /^[A-Za-z0-9À-ž][A-Za-z0-9À-ž .&'’-]{0,49}$/i.test(value.trim());
}

async function requireAdminAuth() {
  const session = await getSession();
  if (session?.role !== 'ADMIN') throw new Error('Non autorisé');
}

export async function confirmPendingSale(saleId: number) {
  await requireAdminAuth();
  await changeSaleStatus(saleId, 'CONFIRMED');
  revalidatePath('/inventory');
}

export async function cancelPendingSale(saleId: number) {
  await requireAdminAuth();
  await changeSaleStatus(saleId, 'CANCELLED');
  revalidatePath('/inventory');
}

export async function updateSaleStatus(saleId: number, status: string): Promise<SaleActionResult> {
  return runSaleAction('status', async () => {
    await requireAdminAuth();
    await changeSaleStatus(saleId, status);
    revalidatePath('/inventory');
  });
}

type SaleActionResult = { ok: true } | { ok: false; error: string };
class SaleActionError extends Error {}

async function runSaleAction(name: string, action: () => Promise<void>): Promise<SaleActionResult> {
  try {
    await action();
    return { ok: true };
  } catch (error) {
    if (error instanceof SaleActionError) return { ok: false, error: error.message };
    if (error instanceof SaleStatusError) return { ok: false, error: error.message };
    if (error instanceof Error && error.message === 'Non autorisé') {
      return { ok: false, error: 'Session expirée. Reconnectez-vous.' };
    }
    console.error(`[SALE ACTION ${name}]`, error);
    return { ok: false, error: 'Action impossible pour le moment. Réessayez.' };
  }
}

export async function editSale(saleId: number, formData: FormData) {
  return runSaleAction('edit', async () => {
  await requireAdminAuth();
  if (!Number.isInteger(saleId) || saleId <= 0) throw new SaleActionError('Vente invalide.');

  const brand = String(formData.get('brand') || '').trim();
  const btu = String(formData.get('btu') || '').toUpperCase();
  const ac_type = String(formData.get('ac_type') || 'Split');
  const customer_name = String(formData.get('customer_name') || '').trim();
  const customer_phone = String(formData.get('customer_phone') || '').trim();
  const customer_address = String(formData.get('customer_address') || '').trim();
  const notes = String(formData.get('notes') || '').trim();
  if (!validBrand(brand) || !catalogBtuOptions.includes(btu) || !catalogAcTypes.includes(ac_type)) throw new SaleActionError('Produit invalide.');
  if (customer_name.length > 100 || customer_phone.length > 50 || customer_address.length > 250 || notes.length > 2000) throw new SaleActionError('Les informations de la vente sont trop longues.');

  await prisma.$transaction(async (tx) => {
    const sale = await tx.salesLog.findUnique({ where: { id: saleId } });
    if (!sale) throw new SaleActionError('Vente introuvable.');

    const productChanged = sale.brand !== brand || sale.btu !== btu || sale.ac_type !== ac_type;
    if (productChanged && stockTrackedSaleStatuses.has(sale.status || '')) {
      const oldItem = await tx.inventory.findUnique({ where: { brand_btu_ac_type: { brand: sale.brand, btu: sale.btu, ac_type: sale.ac_type } } });
      if (!oldItem) throw new SaleActionError('Ancien produit introuvable; modification annulée.');
      await tx.inventory.update({ where: { id: oldItem.id }, data: { stock_quantity: { increment: 1 } } });
      await tx.stockAddition.create({ data: { inventoryId: oldItem.id, brand: oldItem.brand, btu: oldItem.btu, ac_type: oldItem.ac_type, quantityAdded: 1, operation: 'RETURN', addedBy: 'Modification de vente (dashboard)' } });

      const newStock = await tx.inventory.updateMany({
        where: { brand, btu, ac_type, stock_quantity: { gt: 0 } },
        data: { stock_quantity: { decrement: 1 } },
      });
      if (newStock.count !== 1) throw new SaleActionError('Le nouveau produit est introuvable ou son stock est épuisé.');
      const newItem = await tx.inventory.findUnique({ where: { brand_btu_ac_type: { brand, btu, ac_type } } });
      if (!newItem) throw new SaleActionError('Nouveau produit introuvable.');
      await tx.stockAddition.create({ data: { inventoryId: newItem.id, brand, btu, ac_type, quantityAdded: 1, operation: 'SALE', addedBy: 'Modification de vente (dashboard)' } });
    }

    await tx.salesLog.update({ where: { id: saleId }, data: { brand, btu, ac_type, customer_name: customer_name || null, customer_phone: customer_phone || null, customer_address: customer_address || null, notes: notes || null } });
  }, { isolationLevel: 'Serializable' });

  revalidatePath('/inventory');
  });
}

export async function deleteSale(saleId: number) {
  return runSaleAction('delete', async () => {
  await requireAdminAuth();
  if (!Number.isInteger(saleId) || saleId <= 0) throw new SaleActionError('Vente invalide.');

  await prisma.$transaction(async (tx) => {
    const sale = await tx.salesLog.findUnique({ where: { id: saleId } });
    if (!sale) throw new SaleActionError('Vente introuvable.');
    if (stockTrackedSaleStatuses.has(sale.status || '')) {
      const item = await tx.inventory.findUnique({ where: { brand_btu_ac_type: { brand: sale.brand, btu: sale.btu, ac_type: sale.ac_type } } });
      if (!item) throw new SaleActionError('Produit de la vente introuvable; suppression annulée.');
      await tx.inventory.update({ where: { id: item.id }, data: { stock_quantity: { increment: 1 } } });
      await tx.stockAddition.create({ data: { inventoryId: item.id, brand: item.brand, btu: item.btu, ac_type: item.ac_type, quantityAdded: 1, operation: 'RETURN', addedBy: 'Suppression de vente (dashboard)' } });
    }
    await tx.salesLog.delete({ where: { id: saleId } });
  }, { isolationLevel: 'Serializable' });

  revalidatePath('/inventory');
  });
}

export async function duplicateSale(saleId: number) {
  return runSaleAction('duplicate', async () => {
  await requireAdminAuth();
  if (!Number.isInteger(saleId) || saleId <= 0) throw new SaleActionError('Vente invalide.');

  await prisma.$transaction(async (tx) => {
    const sale = await tx.salesLog.findUnique({ where: { id: saleId } });
    if (!sale) throw new SaleActionError('Vente introuvable.');
    const stock = await tx.inventory.updateMany({
      where: { brand: sale.brand, btu: sale.btu, ac_type: sale.ac_type, stock_quantity: { gt: 0 } },
      data: { stock_quantity: { decrement: 1 } },
    });
    if (stock.count !== 1) throw new SaleActionError('Stock épuisé ou produit introuvable; la vente n’a pas été dupliquée.');
    const item = await tx.inventory.findUnique({ where: { brand_btu_ac_type: { brand: sale.brand, btu: sale.btu, ac_type: sale.ac_type } } });
    if (!item) throw new SaleActionError('Produit introuvable; la vente n’a pas été dupliquée.');
    await tx.stockAddition.create({ data: { inventoryId: item.id, brand: item.brand, btu: item.btu, ac_type: item.ac_type, quantityAdded: 1, operation: 'SALE', addedBy: 'Duplication de vente (dashboard)' } });
    await tx.salesLog.create({ data: { brand: sale.brand, btu: sale.btu, ac_type: sale.ac_type, customer_name: sale.customer_name, customer_phone: sale.customer_phone, customer_address: sale.customer_address, notes: sale.notes, status: 'CONFIRMED' } });
  }, { isolationLevel: 'Serializable' });

  revalidatePath('/inventory');
  });
}

export async function notifyDeliveryService(saleId: number): Promise<SaleActionResult> {
  return runSaleAction('delivery-notification', async () => {
    await requireAdminAuth();
    if (!Number.isSafeInteger(saleId) || saleId <= 0) throw new SaleActionError('Vente invalide.');
    const sale = await prisma.salesLog.findUnique({ where: { id: saleId } });
    if (!sale) throw new SaleActionError('Vente introuvable.');
    if (!['CONFIRMED', 'DELIVERED'].includes(sale.status || '')) throw new SaleActionError('Confirmez la vente avant de notifier la livraison.');
    if (!sale.customer_name || !sale.customer_phone) throw new SaleActionError('Ajoutez le nom et le téléphone du client avant la notification.');
    if (sale.deliveryNotifiedAt) throw new SaleActionError('Service livraison déjà notifié pour cette vente.');

    const botUrl = process.env.BOT_URL?.trim() || 'https://bot-whatsap-dk-clim.onrender.com';
    const endpoint = new URL(`${botUrl.replace(/\/$/, '')}/notify-delivery`);
    if (process.env.NODE_ENV === 'production' && endpoint.protocol !== 'https:') throw new SaleActionError('BOT_URL doit utiliser HTTPS.');

    const deliveryToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(deliveryToken).digest('hex');
    await prisma.deliveryRequest.upsert({
      where: { saleId },
      create: { saleId, tokenHash },
      update: { tokenHash, createdAt: new Date() },
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryToken, saleId }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
    if (!response.ok || !result?.success) {
      throw new SaleActionError(result?.error || 'Le bot WhatsApp n’a pas confirmé l’envoi. Réessayez.');
    }
    revalidatePath('/inventory');
  });
}

export async function recordManualSale(formData: FormData) {
  await requireAdminAuth();
  
  const brand = formData.get('brand') as string;
  const btu = formData.get('btu') as string;
  const ac_type = String(formData.get('ac_type') || 'Split');
  const customer_name = (formData.get('customer_name') as string) || '';
  const customer_phone = (formData.get('customer_phone') as string) || '';
  const customer_address = String(formData.get('customer_address') || '').trim();

  if (!validBrand(brand) || !catalogBtuOptions.includes(btu) || !catalogAcTypes.includes(ac_type) || customer_address.length > 250) throw new Error('Produit ou adresse invalide.');

  await prisma.$transaction(async (tx) => {
    const stock = await tx.inventory.updateMany({
      where: { brand, btu, ac_type, stock_quantity: { gt: 0 } },
      data: { stock_quantity: { decrement: 1 } },
    });
    if (stock.count !== 1) throw new Error('Stock épuisé ou produit introuvable.');
    const item = await tx.inventory.findFirst({ where: { brand, btu, ac_type } });
    if (!item) throw new Error('Produit introuvable.');
    await tx.stockAddition.create({ data: { inventoryId: item.id, brand, btu, ac_type, quantityAdded: 1, operation: 'SALE', addedBy: 'Vente manuelle dashboard' } });
    await tx.salesLog.create({
      data: {
        brand,
        btu,
        ac_type,
        customer_name,
        customer_phone,
        customer_address: customer_address || null,
        status: 'CONFIRMED',
      }
    });
  });
  
  revalidatePath('/inventory');
}

export async function adjustStock(id: number, adjustment: number) {
  await requireAdminAuth();
  if (!Number.isInteger(adjustment) || adjustment === 0) throw new Error('Ajustement invalide.');
  if (!Number.isInteger(id) || id <= 0) throw new Error('Produit invalide.');
  await prisma.$transaction(async (tx) => {
    const current = await tx.inventory.findUnique({ where: { id } });
    if (!current) throw new Error('Produit introuvable.');
    const result = await tx.inventory.updateMany({
      where: { id, ...(adjustment < 0 ? { stock_quantity: { gte: -adjustment } } : {}) },
      data: { stock_quantity: { increment: adjustment } },
    });
    if (result.count !== 1) throw new Error('Stock insuffisant pour cet ajustement.');
    await tx.stockAddition.create({
      data: { inventoryId: id, brand: current.brand, btu: current.btu, ac_type: current.ac_type, quantityAdded: Math.abs(adjustment), operation: adjustment > 0 ? 'ADD' : 'REMOVE', addedBy: 'Administrateur dashboard' },
    });
  });

  revalidatePath('/inventory');
  revalidatePath('/admin');
}




export async function addInventoryProduct(formData: FormData) {
  await requireAdminAuth();
  const brand = formData.get('brand') as string;
  const btu = String(formData.get('btu') || '').toUpperCase();
  const ac_type = String(formData.get('ac_type') || 'Split');
  const rawStock = Number(formData.get('stock'));
  const stock_quantity = Number.isInteger(rawStock) && rawStock >= 0 ? rawStock : -1;
  const rawPrice = String(formData.get('price_ttc') || '').trim();
  const price_ttc = rawPrice === '' ? null : Number(rawPrice);
  
  const normalizedBrand = String(brand || '').trim();
  if (validBrand(normalizedBrand) && catalogBtuOptions.includes(btu) && catalogAcTypes.includes(ac_type) && stock_quantity >= 0 && (price_ttc === null || (Number.isSafeInteger(price_ttc) && price_ttc > 0 && price_ttc <= 1_000_000))) {
    await prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.upsert({
        where: { brand_btu_ac_type: { brand: normalizedBrand, btu, ac_type } },
        create: { brand: normalizedBrand, btu, ac_type, stock_quantity, price_ttc },
        update: { stock_quantity: { increment: stock_quantity }, ...(price_ttc === null ? {} : { price_ttc }) },
      });
      await tx.stockAddition.create({
        data: { inventoryId: inventory.id, brand: normalizedBrand, btu, ac_type, quantityAdded: stock_quantity, operation: 'ADD', addedBy: 'Administrateur dashboard' },
      });
    });
    revalidatePath('/inventory');
    revalidatePath('/admin');
    return;
  }
  throw new Error('Marque, puissance, quantité ou prix invalide.');
}

export async function deleteInventoryBrand(brand: string) {
  await requireAdminAuth();
  const normalizedBrand = String(brand || '').trim();
  if (!validBrand(normalizedBrand)) throw new Error('Marque invalide.');

  await prisma.$transaction(async (tx) => {
    const items = await tx.inventory.findMany({
      where: { brand: { equals: normalizedBrand, mode: 'insensitive' } },
    });
    if (items.length === 0) throw new Error('Marque introuvable.');

    await tx.stockAddition.createMany({
      data: items.map((item) => ({
        inventoryId: item.id,
        brand: item.brand,
        btu: item.btu,
        ac_type: item.ac_type,
        quantityAdded: item.stock_quantity,
        operation: 'DELETE_BRAND',
        addedBy: 'Administrateur dashboard',
      })),
    });

    const result = await tx.inventory.deleteMany({ where: { id: { in: items.map((item) => item.id) } } });
    if (result.count !== items.length) throw new Error('La suppression de la marque est incomplète.');
  });

  revalidatePath('/inventory');
  revalidatePath('/admin');
}

function parseMaterialForm(formData: FormData) {
  const designation = String(formData.get('designation') || '').trim();
  const rawQuantity = Number(formData.get('quantity'));
  const rawPrice = String(formData.get('price') ?? '').trim();
  const quantity = Number.isInteger(rawQuantity) && rawQuantity >= 0 ? rawQuantity : -1;
  const price = rawPrice === '' ? null : Number(rawPrice);
  if (!designation || designation.length > 160 || quantity < 0 || (price !== null && (!Number.isFinite(price) || price < 0))) {
    throw new Error('Désignation, quantité ou prix invalide.');
  }
  return { designation, quantity, price };
}

async function logMaterialMovement(tx: Prisma.TransactionClient, data: {
  materialId?: number | null; designation: string; action: string; quantityBefore?: number | null;
  quantityAfter?: number | null; priceBefore?: number | null; priceAfter?: number | null;
}) {
  await tx.materialMovement.create({ data: { ...data, performedBy: 'Administrateur dashboard' } });
}

export async function createStockMaterial(formData: FormData) {
  await requireAdminAuth();
  const item = parseMaterialForm(formData);
  await prisma.$transaction(async (tx) => {
    const created = await tx.stockMaterial.create({ data: item });
    await logMaterialMovement(tx, { materialId: created.id, designation: created.designation, action: 'CREATE', quantityAfter: created.quantity, priceAfter: created.price == null ? null : Number(created.price) });
  });
  revalidatePath('/inventory');
}

export async function updateStockMaterial(id: number, formData: FormData) {
  await requireAdminAuth();
  if (!Number.isInteger(id) || id <= 0) throw new Error('Article invalide.');
  const next = parseMaterialForm(formData);
  await prisma.$transaction(async (tx) => {
    const before = await tx.stockMaterial.findUnique({ where: { id } });
    if (!before) throw new Error('Article introuvable.');
    const updated = await tx.stockMaterial.update({ where: { id }, data: next });
    await logMaterialMovement(tx, { materialId: id, designation: updated.designation, action: 'UPDATE', quantityBefore: before.quantity, quantityAfter: updated.quantity, priceBefore: before.price == null ? null : Number(before.price), priceAfter: updated.price == null ? null : Number(updated.price) });
  });
  revalidatePath('/inventory');
}

export async function deleteStockMaterial(id: number) {
  await requireAdminAuth();
  if (!Number.isInteger(id) || id <= 0) throw new Error('Article invalide.');
  await prisma.$transaction(async (tx) => {
    const item = await tx.stockMaterial.findUnique({ where: { id } });
    if (!item) throw new Error('Article introuvable.');
    await logMaterialMovement(tx, { materialId: null, designation: item.designation, action: 'DELETE', quantityBefore: item.quantity, priceBefore: item.price == null ? null : Number(item.price) });
    await tx.stockMaterial.delete({ where: { id } });
  });
  revalidatePath('/inventory');
}

export async function duplicateStockMaterial(id: number) {
  await requireAdminAuth();
  if (!Number.isInteger(id) || id <= 0) throw new Error('Article invalide.');
  await prisma.$transaction(async (tx) => {
    const original = await tx.stockMaterial.findUnique({ where: { id } });
    if (!original) throw new Error('Article introuvable.');
    let designation = `${original.designation} (copie)`;
    let suffix = 2;
    while (await tx.stockMaterial.findUnique({ where: { designation } })) designation = `${original.designation} (copie ${suffix++})`;
    const copy = await tx.stockMaterial.create({ data: { designation, quantity: original.quantity, price: original.price } });
    await logMaterialMovement(tx, { materialId: copy.id, designation: copy.designation, action: 'DUPLICATE', quantityAfter: copy.quantity, priceAfter: copy.price == null ? null : Number(copy.price) });
  });
  revalidatePath('/inventory');
}

export async function adjustMaterialStock(id: number, adjustment: number) {
  await requireAdminAuth();
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(adjustment) || adjustment === 0) throw new Error('Ajustement invalide.');
  await prisma.$transaction(async (tx) => {
    const before = await tx.stockMaterial.findUnique({ where: { id } });
    if (!before) throw new Error('Article introuvable.');
    const result = await tx.stockMaterial.updateMany({ where: { id, ...(adjustment < 0 ? { quantity: { gte: -adjustment } } : {}) }, data: { quantity: { increment: adjustment } } });
    if (result.count !== 1) throw new Error('Stock insuffisant.');
    await logMaterialMovement(tx, { materialId: id, designation: before.designation, action: adjustment > 0 ? 'STOCK_ADD' : 'STOCK_REMOVE', quantityBefore: before.quantity, quantityAfter: before.quantity + adjustment, priceBefore: before.price == null ? null : Number(before.price), priceAfter: before.price == null ? null : Number(before.price) });
  });
  revalidatePath('/inventory');
}
