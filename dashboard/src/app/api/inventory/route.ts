import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { catalogBrands, catalogBtuOptions } from '@/lib/business';

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
    const brand = String(body.brand ?? '');
    const btu = String(body.btu ?? '').toUpperCase();
    const stockQuantity = Number(body.stock_quantity);
    if (!catalogBrands.includes(brand) || !catalogBtuOptions.includes(btu) || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
      return NextResponse.json({ success: false, error: 'Produit ou quantité invalide.' }, { status: 400 });
    }
    const data = await prisma.inventory.create({ data: { brand, btu, stock_quantity: stockQuantity } });
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
    const result = await prisma.inventory.updateMany({ where: { id }, data: { stock_quantity: stockQuantity } });
    if (result.count === 0) return NextResponse.json({ success: false, error: 'Produit introuvable.' }, { status: 404 });
    const data = await prisma.inventory.findUnique({ where: { id } });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
