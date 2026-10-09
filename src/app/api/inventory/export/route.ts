import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  if ((await getSession())?.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
  }

  const [inventory, sales, additions] = await Promise.all([
    prisma.inventory.findMany({ orderBy: [{ brand: 'asc' }, { btu: 'asc' }, { ac_type: 'asc' }] }),
    prisma.salesLog.findMany({ orderBy: { timestamp: 'desc' } }),
    prisma.stockAddition.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);

  const workbook = XLSX.utils.book_new();
  const stockSheet = XLSX.utils.json_to_sheet(inventory.map((item) => ({
    Marque: item.brand,
    Type: item.ac_type,
    'Puissance BTU': item.btu.replace('_', ' '),
    'Quantité actuelle': item.stock_quantity,
  })));
  const salesSheet = XLSX.utils.json_to_sheet(sales.map((sale) => ({
    Date: sale.timestamp.toISOString(),
    Produit: `${sale.brand} · ${sale.btu.replace('_', ' ')} · ${sale.ac_type}`,
    Client: sale.customer_name || '',
    Téléphone: sale.customer_phone || '',
    Statut: sale.status || '',
  })));
  const additionsSheet = XLSX.utils.json_to_sheet(additions.map((addition) => ({
    'Date et heure': addition.createdAt.toISOString(),
    Produit: `${addition.brand} · ${addition.btu.replace('_', ' ')} · ${addition.ac_type}`,
    Mouvement: addition.operation,
    'Quantité modifiée': addition.quantityAdded,
    Utilisateur: addition.addedBy,
  })));

  XLSX.utils.book_append_sheet(workbook, stockSheet, 'Statut Stock');
  XLSX.utils.book_append_sheet(workbook, salesSheet, 'Historique Ventes');
  XLSX.utils.book_append_sheet(workbook, additionsSheet, 'Historique Ajouts');

  const file = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return new NextResponse(file, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="DK-Clim-Stock-Ventes-Historique.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
