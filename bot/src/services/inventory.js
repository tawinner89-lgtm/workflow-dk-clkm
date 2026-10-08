"use strict";
const { pool } = require('../config/db');

function normalizeBtu(btu) {
  const digits = String(btu || '').replace(/\D/g, '');
  return digits ? `${digits}_BTU` : '';
}

function createInventoryService(dbPool) {
  async function getProductAvailability(brand, btu) {
    const normalizedBtu = normalizeBtu(btu);
    if (!brand || !normalizedBtu) return { status: 'invalid', available: false, alternatives: [] };
    try {
      const result = await dbPool.query(
        `SELECT brand, btu, stock_quantity FROM "Inventory" WHERE UPPER(btu) = UPPER($1) ORDER BY CASE WHEN LOWER(brand) = LOWER($2) THEN 0 ELSE 1 END, brand ASC`,
        [normalizedBtu, brand]
      );
      const exact = result.rows.find(row => row.brand.toLowerCase() === String(brand).toLowerCase());
      return {
        status: 'checked',
        available: Boolean(exact && Number(exact.stock_quantity) > 0),
        can_preorder: Boolean(!exact || Number(exact.stock_quantity) <= 0),
        stock_quantity: exact ? Number(exact.stock_quantity) : 0,
        brand: exact?.brand || brand,
        btu: normalizedBtu,
        alternatives: result.rows.filter(row => row.brand.toLowerCase() !== String(brand).toLowerCase() && Number(row.stock_quantity) > 0).map(row => ({ brand: row.brand, btu: normalizedBtu, stock: row.stock_quantity }))
      };
    } catch (error) {
      console.error('[INVENTORY ERROR availability]', error.message);
      return { status: 'error', available: false, alternatives: [], error: error.message };
    }
  }

  async function createSale(brand, btu, customerName, customerPhone, price, saleStatus) {
    let client;
    const normalizedBtu = normalizeBtu(btu);
    if (!brand || !normalizedBtu) {
      return { ok: false, stockUpdated: false, reason: 'INVALID_PRODUCT' };
    }
    try {
      client = await dbPool.connect();
      await client.query('BEGIN');
      const update = await client.query(
        `WITH candidate AS (
           SELECT id FROM "Inventory" WHERE brand ILIKE $1 AND UPPER(btu) = UPPER($2)
           ORDER BY id LIMIT 1 FOR UPDATE
         )
         UPDATE "Inventory" AS inventory
         SET stock_quantity = inventory.stock_quantity - 1
         FROM candidate
         WHERE inventory.id = candidate.id AND inventory.stock_quantity > 0
         RETURNING inventory.stock_quantity`,
        [brand, normalizedBtu]
      );
      if (update.rowCount > 0) {
        await client.query(
          `INSERT INTO "SalesLog" (brand, btu, customer_name, customer_phone, status, notes) VALUES ($1, $2, $3, $4, $5, $6)`,
          [brand, normalizedBtu, customerName || null, customerPhone || null, saleStatus, price ? `Prix catalogue: ${price} DH` : null]
        );
        await client.query('COMMIT');
        return { ok: true, stockUpdated: true, status: saleStatus };
      }

      const check = await client.query(
        `SELECT stock_quantity FROM "Inventory" WHERE brand ILIKE $1 AND UPPER(btu) = UPPER($2) ORDER BY id LIMIT 1 FOR UPDATE`,
        [brand, normalizedBtu]
      );
      const reason = check.rows.length === 0 || Number(check.rows[0].stock_quantity) <= 0 ? 'PREORDER' : 'NOT_FOUND';
      await client.query(
        `INSERT INTO "SalesLog" (brand, btu, customer_name, customer_phone, status, notes) VALUES ($1, $2, $3, $4, $5, $6)`,
        [brand, normalizedBtu, customerName || null, customerPhone || null, reason, price ? `Commande spéciale 24-48h; prix catalogue: ${price} DH` : 'Commande spéciale 24-48h']
      );
      await client.query('COMMIT');
      return { ok: reason === 'PREORDER', stockUpdated: false, status: reason, reason };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error('[INVENTORY ERROR rollback]', rollbackError.message); }
      console.error('[INVENTORY ERROR recordSale]', error.stack || error.message);
      return { ok: false, stockUpdated: false, reason: 'DATABASE_ERROR', error: error.message };
    } finally {
      client?.release();
    }
  }

  // Bot-originated sale is finalized only after the customer confirms the recap.
  // Stock decrement and SalesLog insert share one transaction.
  async function confirmSaleAndUpdateStock(clientName, clientPhone, model, btu, price = null) {
    return createSale(model, btu, clientName, clientPhone, price, 'CONFIRMED');
  }

  // Keep the pending-sale API for existing callers that require dashboard approval.
  async function recordSale(brand, btu, customerName, customerPhone, price = null) {
    return createSale(brand, btu, customerName, customerPhone, price, 'PENDING');
  }

  async function cancelSale(saleId) {
    let client;
    try {
      client = await dbPool.connect();
      await client.query('BEGIN');
      const saleResult = await client.query(`SELECT brand, btu, status FROM "SalesLog" WHERE id = $1 FOR UPDATE`, [saleId]);
      if (saleResult.rows.length === 0 || saleResult.rows[0].status !== 'PENDING') {
        await client.query('ROLLBACK');
        return { ok: false, reason: 'NOT_PENDING' };
      }
      const sale = saleResult.rows[0];
      await client.query(`UPDATE "SalesLog" SET status = 'CANCELLED' WHERE id = $1`, [saleId]);
      await client.query(`UPDATE "Inventory" SET stock_quantity = stock_quantity + 1 WHERE brand ILIKE $1 AND UPPER(btu) = UPPER($2)`, [sale.brand, sale.btu]);
      await client.query('COMMIT');
      return { ok: true };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      console.error('[INVENTORY ERROR cancelSale]', error.message);
      return { ok: false, error: error.message };
    } finally { client?.release(); }
  }

  async function confirmSale(saleId) {
    try {
      const result = await dbPool.query(`UPDATE "SalesLog" SET status = 'CONFIRMED' WHERE id = $1 AND status = 'PENDING'`, [saleId]);
      return { ok: result.rowCount > 0 };
    } catch (error) {
      console.error('[INVENTORY ERROR confirmSale]', error.message);
      return { ok: false, error: error.message };
    }
  }

  async function getCurrentStock() {
    try { const result = await dbPool.query(`SELECT id, brand, btu, stock_quantity FROM "Inventory" ORDER BY brand ASC`); return result.rows; }
    catch (error) { console.error('[INVENTORY ERROR getCurrentStock]', error.message); return []; }
  }

  return { getProductAvailability, recordSale, confirmSaleAndUpdateStock, cancelSale, confirmSale, getCurrentStock };
}

module.exports = { ...createInventoryService(pool), createInventoryService, normalizeBtu };
