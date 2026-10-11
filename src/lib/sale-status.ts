import { prisma } from '@/lib/prisma';

export const selectableSaleStatuses = ['NEW', 'PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED'] as const;
export type SelectableSaleStatus = (typeof selectableSaleStatuses)[number];
export const stockTrackedSaleStatuses = new Set(['PENDING', 'CONFIRMED', 'DELIVERED']);

export class SaleStatusError extends Error {}

export async function changeSaleStatus(saleId: number, nextStatus: string) {
  if (!Number.isSafeInteger(saleId) || saleId <= 0 || !selectableSaleStatuses.includes(nextStatus as SelectableSaleStatus)) {
    throw new SaleStatusError('Commande ou statut invalide.');
  }

  return prisma.$transaction(async (tx) => {
    const sale = await tx.salesLog.findUnique({ where: { id: saleId } });
    if (!sale) throw new SaleStatusError('Commande introuvable.');
    if (sale.status === nextStatus) return sale;

    const wasTracked = stockTrackedSaleStatuses.has(sale.status || '');
    const nowTracked = stockTrackedSaleStatuses.has(nextStatus);
    const changed = await tx.salesLog.updateMany({
      where: { id: saleId, status: sale.status },
      data: { status: nextStatus },
    });
    if (changed.count !== 1) throw new SaleStatusError('Cette commande a déjà été modifiée. Actualisez la page.');

    if (wasTracked !== nowTracked) {
      const inventory = await tx.inventory.findUnique({
        where: { brand_btu_ac_type: { brand: sale.brand, btu: sale.btu, ac_type: sale.ac_type } },
      });
      if (!inventory) throw new SaleStatusError('Produit introuvable dans le stock; statut inchangé.');

      const updated = await tx.inventory.updateMany({
        where: { id: inventory.id, ...(nowTracked ? { stock_quantity: { gt: 0 } } : {}) },
        data: { stock_quantity: { increment: nowTracked ? -1 : 1 } },
      });
      if (updated.count !== 1) throw new SaleStatusError('Stock insuffisant; statut inchangé.');
      await tx.stockAddition.create({ data: {
        inventoryId: inventory.id, brand: sale.brand, btu: sale.btu, ac_type: sale.ac_type,
        quantityAdded: 1, operation: nowTracked ? 'SALE' : 'RETURN',
        addedBy: `Changement statut ${sale.status || 'INCONNU'} → ${nextStatus} (dashboard)`,
      } });
    }

    return tx.salesLog.findUnique({ where: { id: saleId } });
  }, { isolationLevel: 'Serializable' });
}
