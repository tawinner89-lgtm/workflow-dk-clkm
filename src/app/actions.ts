'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { catalogAcTypes, catalogBtuOptions } from '@/lib/business';

function validBrand(value: string) {
  return /^[A-Za-z0-9À-ž][A-Za-z0-9À-ž .&'’-]{0,49}$/i.test(value.trim());
}

async function requireAdminAuth() {
  const session = await getSession();
  if (session?.role !== 'ADMIN') throw new Error('Non autorisé');
}

export async function confirmPendingSale(saleId: number) {
  await requireAdminAuth();
  
  const result = await prisma.salesLog.updateMany({
    where: { id: saleId, status: 'PENDING' },
    data: { status: 'CONFIRMED' },
  });
  if (result.count !== 1) throw new Error('Vente introuvable ou déjà traitée.');
  revalidatePath('/inventory');
}

export async function cancelPendingSale(saleId: number) {
  await requireAdminAuth();
  
  const cancelled = await prisma.$transaction(async (tx) => {
    const sale = await tx.salesLog.findUnique({ where: { id: saleId } });
    if (!sale || sale.status !== 'PENDING') return false;
    const result = await tx.salesLog.updateMany({
      where: { id: saleId, status: 'PENDING' },
      data: { status: 'CANCELLED' }
    });

    if (result.count === 0) return false;

    const inventory = await tx.inventory.updateMany({
      where: { brand: sale.brand, btu: sale.btu, ac_type: sale.ac_type },
      data: { stock_quantity: { increment: 1 } },
    });
    if (inventory.count !== 1) throw new Error('Produit de la vente introuvable; annulation non appliquée.');
    const item = await tx.inventory.findFirst({ where: { brand: sale.brand, btu: sale.btu, ac_type: sale.ac_type } });
    if (!item) throw new Error('Produit de la vente introuvable; annulation non appliquée.');
    await tx.stockAddition.create({ data: { inventoryId: item.id, brand: sale.brand, btu: sale.btu, ac_type: sale.ac_type, quantityAdded: 1, operation: 'RETURN', addedBy: 'Retour de vente annulée (dashboard)' } });
    return true;
  });
  if (!cancelled) throw new Error('Vente introuvable ou déjà traitée.');
  
  revalidatePath('/inventory');
}

export async function recordManualSale(formData: FormData) {
  await requireAdminAuth();
  
  const brand = formData.get('brand') as string;
  const btu = formData.get('btu') as string;
  const ac_type = String(formData.get('ac_type') || 'Split');
  const customer_name = (formData.get('customer_name') as string) || '';
  const customer_phone = (formData.get('customer_phone') as string) || '';

  if (!validBrand(brand) || !catalogBtuOptions.includes(btu) || !catalogAcTypes.includes(ac_type)) throw new Error('Produit invalide.');

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
  
  const normalizedBrand = String(brand || '').trim();
  if (validBrand(normalizedBrand) && catalogBtuOptions.includes(btu) && catalogAcTypes.includes(ac_type) && stock_quantity >= 0) {
    await prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.upsert({
        where: { brand_btu_ac_type: { brand: normalizedBrand, btu, ac_type } },
        create: { brand: normalizedBrand, btu, ac_type, stock_quantity },
        update: { stock_quantity: { increment: stock_quantity } },
      });
      await tx.stockAddition.create({
        data: { inventoryId: inventory.id, brand: normalizedBrand, btu, ac_type, quantityAdded: stock_quantity, operation: 'ADD', addedBy: 'Administrateur dashboard' },
      });
    });
    revalidatePath('/inventory');
    revalidatePath('/admin');
    return;
  }
  throw new Error('Marque, puissance ou quantité invalide.');
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
