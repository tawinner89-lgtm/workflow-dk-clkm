import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { changeSaleStatus, SaleStatusError, selectableSaleStatuses } from '@/lib/sale-status';

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
    const nextStatus = typeof body.status === 'string' ? body.status : action === 'confirm' ? 'CONFIRMED' : action === 'cancel' ? 'CANCELLED' : '';
    if (!Number.isInteger(id) || !selectableSaleStatuses.includes(nextStatus)) {
      return NextResponse.json({ success: false, error: 'Vente ou action invalide.' }, { status: 400 });
    }
    const result = await changeSaleStatus(id, nextStatus);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof SaleStatusError ? error.message : 'Erreur serveur';
    if (!(error instanceof SaleStatusError)) console.error('[SALES STATUS API]', error);
    const status = error instanceof SaleStatusError ? 409 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
