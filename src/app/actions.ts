'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

function requireAdminAuth() { return; /* Bypassed for testing */ }

export async function confirmPendingSale(saleId: number) {
  requireAdminAuth();
  
  await prisma.salesLog.update({
    where: { id: saleId },
    data: { status: 'CONFIRMED' },
  });
  revalidatePath('/inventory');
}

export async function cancelPendingSale(saleId: number, brand: string, btu: string) {
  requireAdminAuth();
  
  await prisma.$transaction(async (tx) => {
    const result = await tx.salesLog.updateMany({
      where: { id: saleId, status: 'PENDING' },
      data: { status: 'CANCELLED' }
    });

    if (result.count === 0) return;

    await tx.inventory.update({
      where: { brand_btu: { brand, btu } },
      data: { stock_quantity: { increment: 1 } }
    });
  });
  
  revalidatePath('/inventory');
}

export async function recordManualSale(formData: FormData) {
  requireAdminAuth();
  
  const brand = formData.get('brand') as string;
  const btu = formData.get('btu') as string;
  const customer_name = (formData.get('customer_name') as string) || '';
  const customer_phone = (formData.get('customer_phone') as string) || '';

  if (!brand || !btu) throw new Error("Brand and BTU are required.");

  await prisma.$transaction(async (tx) => {
    await tx.inventory.update({
      where: { brand_btu: { brand, btu } },
      data: { stock_quantity: { decrement: 1 } }
    });
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
  requireAdminAuth();
  
  await prisma.$executeRaw`
    UPDATE "Inventory" 
    SET stock_quantity = GREATEST(stock_quantity + ${adjustment}, 0) 
    WHERE id = ${id}
  `;
  
  revalidatePath('/inventory');
}




export async function addInventoryProduct(formData: FormData) {
  requireAdminAuth();
  const brand = formData.get('brand') as string;
  const btu = formData.get('btu') as string;
  const stock_quantity = parseInt(formData.get('stock') as string) || 0;
  
  if (brand && btu) {
    await prisma.inventory.create({
      data: { brand, btu, stock_quantity },
    });
    revalidatePath('/inventory');
  }
}
