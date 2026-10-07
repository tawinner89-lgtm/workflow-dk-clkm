'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { catalogBrands, catalogBtuOptions } from '@/lib/business';

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
      where: { brand: sale.brand, btu: sale.btu },
      data: { stock_quantity: { increment: 1 } },
    });
    if (inventory.count !== 1) throw new Error('Produit de la vente introuvable; annulation non appliquée.');
    return true;
  });
  if (!cancelled) throw new Error('Vente introuvable ou déjà traitée.');
  
  revalidatePath('/inventory');
}

export async function recordManualSale(formData: FormData) {
  await requireAdminAuth();
  
  const brand = formData.get('brand') as string;
  const btu = formData.get('btu') as string;
  const customer_name = (formData.get('customer_name') as string) || '';
  const customer_phone = (formData.get('customer_phone') as string) || '';

  if (!brand || !btu) throw new Error("Brand and BTU are required.");
  if (!catalogBrands.includes(brand) || !catalogBtuOptions.includes(btu)) throw new Error('Produit non autorisé.');

  await prisma.$transaction(async (tx) => {
    const stock = await tx.inventory.updateMany({
      where: { brand, btu, stock_quantity: { gt: 0 } },
      data: { stock_quantity: { decrement: 1 } },
    });
    if (stock.count !== 1) throw new Error('Stock épuisé ou produit introuvable.');
    await tx.salesLog.create({
      data: {
        brand,
        btu,
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
  
  await prisma.$executeRaw`
    UPDATE "Inventory" 
    SET stock_quantity = GREATEST(stock_quantity + ${adjustment}, 0) 
    WHERE id = ${id}
  `;
  
  revalidatePath('/inventory');
}




export async function addInventoryProduct(formData: FormData) {
  await requireAdminAuth();
  const brand = formData.get('brand') as string;
  const btu = formData.get('btu') as string;
  const rawStock = Number(formData.get('stock'));
  const stock_quantity = Number.isInteger(rawStock) && rawStock >= 0 ? rawStock : -1;
  
  if (brand && btu && catalogBrands.includes(brand) && catalogBtuOptions.includes(btu) && stock_quantity >= 0) {
    await prisma.inventory.create({
      data: { brand, btu, stock_quantity },
    });
    revalidatePath('/inventory');
    return;
  }
  throw new Error('Marque, puissance ou quantité invalide.');
}
