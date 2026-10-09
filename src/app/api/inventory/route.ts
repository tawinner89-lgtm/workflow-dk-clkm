import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { catalogAcTypes, catalogBtuOptions } from '@/lib/business';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  return (await getSession())?.role === 'ADMIN';
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
  const data = await prisma.inventory.findMany({ orderBy: [{ brand: 'asc' }, { btu: 'asc' }] });
  return NextResponse.json({ success: true, data });
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
  try {
    const body = await request.json();
    const brand = String(body.brand ?? '').trim();
    const btu = String(body.btu ?? '').toUpperCase();
    const ac_type = String(body.ac_type || 'Split');
    const stockQuantity = Number(body.stock_quantity);
    if (!/^[A-Za-z0-9À-ž][A-Za-z0-9À-ž .&'’-]{0,49}$/i.test(brand) || !catalogBtuOptions.includes(btu) || !catalogAcTypes.includes(ac_type) || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
      return NextResponse.json({ success: false, error: 'Produit ou quantité invalide.' }, { status: 400 });
    }
    const data = await prisma.$transaction(async (tx) => {
      const item = await tx.inventory.upsert({
        where: { brand_btu_ac_type: { brand, btu, ac_type } },
        create: { brand, btu, ac_type, stock_quantity: stockQuantity },
        update: { stock_quantity: { increment: stockQuantity } },
      });
      await tx.stockAddition.create({ data: { inventoryId: item.id, brand, btu, ac_type, quantityAdded: stockQuantity, operation: 'ADD', addedBy: 'Administrateur dashboard' } });
      return item;
    });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ success: false, error: message }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
  try {
    const body = await request.json();
    const id = Number(body.id);
    const stockQuantity = Number(body.stock_quantity);
    if (!Number.isInteger(id) || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
      return NextResponse.json({ success: false, error: 'Identifiant ou quantité invalide.' }, { status: 400 });
    }
    const data = await prisma.$transaction(async (tx) => {
      const current = await tx.inventory.findUnique({ where: { id } });
      if (!current) throw new Error('Produit introuvable.');
      const result = await tx.inventory.updateMany({ where: { id }, data: { stock_quantity: stockQuantity } });
      if (result.count !== 1) throw new Error('Produit introuvable.');
      const change = stockQuantity - current.stock_quantity;
      if (change !== 0) {
        await tx.stockAddition.create({ data: { inventoryId: id, brand: current.brand, btu: current.btu, ac_type: current.ac_type, quantityAdded: Math.abs(change), operation: change > 0 ? 'ADD' : 'REMOVE', addedBy: 'Administrateur dashboard' } });
      }
      return tx.inventory.findUnique({ where: { id } });
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
