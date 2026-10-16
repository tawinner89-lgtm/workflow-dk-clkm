import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import type { StockExportTab } from '@/components/StockExportButton';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const exportTabs = new Set<StockExportTab>(['climatiseurs', 'materiel', 'ventes', 'history', 'quotes']);
const exportMeta: Record<StockExportTab, { sheet: string; filename: string }> = {
  climatiseurs: { sheet: 'Climatiseurs', filename: 'DK-Clim-Climatiseurs.xlsx' },
  materiel: { sheet: 'Matériel', filename: 'DK-Clim-Materiel.xlsx' },
  ventes: { sheet: 'Ventes', filename: 'DK-Clim-Ventes.xlsx' },
  history: { sheet: 'Historique', filename: 'DK-Clim-Historique.xlsx' },
  quotes: { sheet: 'Devis', filename: 'DK-Clim-Devis.xlsx' },
};

function quoteExtraTotal(additionalItems: string) {
  try {
    const parsed: unknown = JSON.parse(additionalItems || '[]');
    if (!Array.isArray(parsed)) return 0;
    return parsed.reduce((sum: number, item) => {
      if (!item || !Number.isFinite(item.quantity) || !Number.isFinite(item.unitPrice)) return sum;
      return sum + Number(item.quantity) * Number(item.unitPrice);
    }, 0);
  } catch {
    return 0;
  }
}

export async function GET(request: Request) {
  if ((await getSession())?.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
  }

  const tab = new URL(request.url).searchParams.get('tab') as StockExportTab | null;
  if (!tab || !exportTabs.has(tab)) {
    return NextResponse.json({ success: false, error: 'Onglet d’export invalide.' }, { status: 400 });
  }

  let rows: Record<string, string | number>[];
  switch (tab) {
    case 'climatiseurs': {
      const inventory = await prisma.inventory.findMany({ orderBy: [{ brand: 'asc' }, { btu: 'asc' }, { ac_type: 'asc' }] });
      rows = inventory.map((item) => ({
        Marque: item.brand,
        Type: item.ac_type,
        'Puissance BTU': item.btu.replace('_', ' '),
        'Quantité en stock': item.stock_quantity,
        'Prix TTC (DH)': item.price_ttc ?? '',
      }));
      break;
    }
    case 'materiel': {
      const materials = await prisma.stockMaterial.findMany({ orderBy: { designation: 'asc' } });
      rows = materials.map((item) => ({
        Désignation: item.designation,
        Quantité: item.quantity,
        'Prix unitaire (DH)': item.price === null ? '' : Number(item.price),
      }));
      break;
    }
    case 'ventes': {
      const sales = await prisma.salesLog.findMany({ orderBy: { timestamp: 'desc' } });
      rows = sales.map((sale) => ({
        Date: sale.timestamp.toISOString(),
        Produit: `${sale.brand} · ${sale.btu.replace('_', ' ')} · ${sale.ac_type}`,
        Client: sale.customer_name || '',
        Téléphone: sale.customer_phone || '',
        Adresse: sale.customer_address || '',
        Statut: sale.status || '',
        Notes: sale.notes || '',
      }));
      break;
    }
    case 'history': {
      const [stockMovements, materialMovements] = await Promise.all([
        prisma.stockAddition.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.materialMovement.findMany({ orderBy: { createdAt: 'desc' } }),
      ]);
      const historyRows = [
        ...stockMovements.map((movement) => ({
          sortAt: movement.createdAt.getTime(),
          row: {
            'Date et heure': movement.createdAt.toISOString(),
            Produit: `${movement.brand} · ${movement.btu.replace('_', ' ')} · ${movement.ac_type}`,
            Mouvement: movement.operation,
            Quantité: movement.quantityAdded,
            Utilisateur: movement.addedBy,
            Détails: '',
          },
        })),
        ...materialMovements.map((movement) => ({
          sortAt: movement.createdAt.getTime(),
          row: {
            'Date et heure': movement.createdAt.toISOString(),
            Produit: movement.designation,
            Mouvement: movement.action,
            Quantité: `${movement.quantityBefore ?? '—'} → ${movement.quantityAfter ?? 'supprimé'}`,
            Utilisateur: movement.performedBy,
            Détails: `Prix : ${movement.priceBefore === null ? '—' : Number(movement.priceBefore)} → ${movement.priceAfter === null ? '—' : Number(movement.priceAfter)} DH`,
          },
        })),
      ];
      rows = historyRows.sort((left, right) => right.sortAt - left.sortAt).map(({ row }) => row);
      break;
    }
    case 'quotes': {
      const quotes = await prisma.quote.findMany({ orderBy: { createdAt: 'desc' } });
      rows = quotes.map((quote) => ({
        Créé: quote.createdAt.toISOString(),
        Référence: quote.reference,
        Statut: quote.status,
        Client: quote.customerName,
        Téléphone: quote.customerPhone,
        Adresse: quote.customerAddress || '',
        Produit: `${quote.brand} · ${quote.btu.replace('_', ' ')} · ${quote.acType} · ${quote.modelName}`,
        Quantité: quote.quantity,
        'Prix unitaire TTC (DH)': quote.unitPrice,
        'Installation TTC (DH)': quote.installationPrice,
        'Installation incluse': quote.installationIncluded ? 'Oui' : 'Non',
        'Articles supplémentaires': quote.additionalItems,
        'Total TTC estimé (DH)': quote.quantity * (quote.unitPrice + quote.installationPrice) + Math.round(quoteExtraTotal(quote.additionalItems) * 1.2),
      }));
      break;
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), exportMeta[tab].sheet);
  const file = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return new NextResponse(file, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${exportMeta[tab].filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
