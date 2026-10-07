import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  return (await getSession())?.role === 'ADMIN';
}

export async function GET(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const requestedLimit = Number(params.get('limit')) || 50;
  const take = Math.min(100, Math.max(1, requestedLimit));
  const status = params.get('status');
  const where: Prisma.SalesLogWhereInput = status ? { status } : {};
  const [data, total] = await prisma.$transaction([
    prisma.salesLog.findMany({ where, orderBy: { timestamp: 'desc' }, skip: (page - 1) * take, take }),
    prisma.salesLog.count({ where }),
  ]);
  return NextResponse.json({ success: true, data, pagination: { page, limit: take, total, hasMore: page * take < total } });
}

export async function PATCH(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
  try {
    const body = await request.json();
    const id = Number(body.id);
    const action = body.action;
    if (!Number.isInteger(id) || !['confirm', 'cancel'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Vente ou action invalide.' }, { status: 400 });
    }
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.salesLog.findUnique({ where: { id } });
      if (!sale || sale.status !== 'PENDING') throw new Error('Vente introuvable ou déjà traitée.');

      const updated = await tx.salesLog.updateMany({ where: { id, status: 'PENDING' }, data: { status: action === 'confirm' ? 'CONFIRMED' : 'CANCELLED' } });
      if (updated.count !== 1) throw new Error('Vente déjà traitée.');
      if (action === 'cancel') {
        const inventory = await tx.inventory.updateMany({
          where: { brand: sale.brand, btu: sale.btu },
          data: { stock_quantity: { increment: 1 } },
        });
        if (inventory.count !== 1) throw new Error('Produit de la vente introuvable.');
      }
      return tx.salesLog.findUnique({ where: { id } });
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    const status = message.includes('introuvable') || message.includes('traitée') ? 409 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
