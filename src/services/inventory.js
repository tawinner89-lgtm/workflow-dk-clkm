"use strict";
const { pool } = require('../config/db');

async function recordSale(brand, btu, customerName, customerPhone) {
  const client = await pool.connect();
  let result = { ok: false, stockUpdated: false };
  try {
    await client.query('BEGIN');
    let normBtu = String(btu).toUpperCase();
    if (!normBtu.endsWith('_BTU')) normBtu = normBtu.replace(/\D/g, '') + '_BTU';
    const updateRes = await client.query(
      `UPDATE "Inventory" SET stock_quantity = GREATEST(stock_quantity - 1, 0) WHERE brand ILIKE $1 AND UPPER(btu) = UPPER($2) AND stock_quantity > 0 RETURNING stock_quantity`,
      [brand, normBtu]
    );
    let stockUpdated = false;
    if (updateRes.rowCount > 0) {
        stockUpdated = true;
        if (updateRes.rows[0].stock_quantity === 0) console.warn(`[INVENTORY WARNING] Stock for ${brand} ${normBtu} reached 0.`);
    } else {
        const check = await client.query(`SELECT stock_quantity FROM "Inventory" WHERE brand ILIKE $1 AND UPPER(btu) = UPPER($2)`, [brand, normBtu]);
        if (check.rows.length > 0 && check.rows[0].stock_quantity === 0) {
            console.warn(`[INVENTORY BLOCKED] Brand ${brand} ${normBtu} out of stock.`);
        } else {
            console.warn(`[INVENTORY WARNING] Brand ${brand} ${normBtu} not found.`);
        }
    }
    await client.query(`INSERT INTO "SalesLog" (brand, btu, customer_name, customer_phone, status) VALUES ($1, $2, $3, $4, 'PENDING')`, [brand, normBtu, customerName, customerPhone]);
    await client.query('COMMIT');
    console.log(`[INVENTORY] Logged sale for ${brand} ${normBtu}. Stock updated: ${stockUpdated}`);
    result = { ok: true, stockUpdated };
  } catch (e) {
    await client.query('ROLLBACK');
    console.error("[INVENTORY ERROR recordSale]", e.stack || e.message);
    result = { ok: false, error: e.message };
  } finally { client.release(); }
  return result;
}
async function cancelSale(saleId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const saleRes = await client.query(`SELECT brand, btu, status FROM "SalesLog" WHERE id = $1 FOR UPDATE`, [saleId]);
    if (saleRes.rows.length === 0) { await client.query('ROLLBACK'); return; }
    const sale = saleRes.rows[0];
    if (sale.status === 'CANCELLED') { await client.query('ROLLBACK'); return; }
    await client.query(`UPDATE "SalesLog" SET status = 'CANCELLED' WHERE id = $1`, [saleId]);
    await client.query(`UPDATE "Inventory" SET stock_quantity = stock_quantity + 1 WHERE brand ILIKE $1 AND UPPER(btu) = UPPER($2)`, [sale.brand, sale.btu]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); console.error("[INVENTORY ERROR cancelSale]", e.message); } finally { client.release(); }
}
async function confirmSale(saleId) {
  try { await pool.query(`UPDATE "SalesLog" SET status = 'CONFIRMED' WHERE id = $1`, [saleId]); } catch (e) { console.error("[INVENTORY ERROR confirmSale]", e.message); }
}
async function getCurrentStock() {
  try { const res = await pool.query(`SELECT id, brand, btu, stock_quantity FROM "Inventory" ORDER BY brand ASC`); return res.rows; } catch (e) { return []; }
}
module.exports = { recordSale, cancelSale, confirmSale, getCurrentStock };
