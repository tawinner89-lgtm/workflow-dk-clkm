require('dotenv').config();
const { Pool } = require('pg');

const dbConnectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: dbConnectionString,
  ssl:
    dbConnectionString &&
    (dbConnectionString.includes("sslmode=require") || process.env.NODE_ENV === "production")
      ? { rejectUnauthorized: false }
      : undefined,
});

pool.on("error", (err) => {
  console.error("[PG INVENTORY POOL ERROR]", err.message);
});

async function recordSale(brand, btu, customerName, customerPhone) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE "Inventory" SET stock_quantity = GREATEST(stock_quantity - 1, 0) WHERE brand ILIKE $1 AND btu = $2`,
      [brand, btu]
    );
    await client.query(
      `INSERT INTO "SalesLog" (brand, btu, customer_name, customer_phone, status) VALUES ($1, $2, $3, $4, 'PENDING')`,
      [brand, btu, customerName, customerPhone]
    );
    await client.query('COMMIT');
    console.log(`[INVENTORY] Reserved stock for ${brand} ${btu}. SalesLog created as PENDING.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error("[INVENTORY ERROR recordSale]", e.stack || e.message);
  } finally {
    client.release();
  }
}

async function cancelSale(saleId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const saleRes = await client.query(`SELECT brand, btu, status FROM "SalesLog" WHERE id = $1 FOR UPDATE`, [saleId]);
    if (saleRes.rows.length === 0) {
      console.log(`[INVENTORY] Sale ID ${saleId} not found for cancellation.`);
      await client.query('ROLLBACK');
      return;
    }
    const sale = saleRes.rows[0];
    if (sale.status === 'CANCELLED') {
      console.log(`[INVENTORY] Sale ID ${saleId} is already cancelled.`);
      await client.query('ROLLBACK');
      return;
    }

    await client.query(`UPDATE "SalesLog" SET status = 'CANCELLED' WHERE id = $1`, [saleId]);
    await client.query(
      `UPDATE "Inventory" SET stock_quantity = stock_quantity + 1 WHERE brand ILIKE $1 AND btu = $2`,
      [sale.brand, sale.btu]
    );
    await client.query('COMMIT');
    console.log(`[INVENTORY] Cancelled sale ${saleId}. Restored stock for ${sale.brand} ${sale.btu}.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error("[INVENTORY ERROR cancelSale]", e.message);
  } finally {
    client.release();
  }
}

async function confirmSale(saleId) {
  try {
    await pool.query(`UPDATE "SalesLog" SET status = 'CONFIRMED' WHERE id = $1`, [saleId]);
    console.log(`[INVENTORY] Confirmed sale ${saleId}.`);
  } catch (e) {
    console.error("[INVENTORY ERROR confirmSale]", e.message);
  }
}

async function recordManualSale(brand, btu, customerName, customerPhone) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE "Inventory" SET stock_quantity = GREATEST(stock_quantity - 1, 0) WHERE brand ILIKE $1 AND btu = $2`,
      [brand, btu]
    );
    await client.query(
      `INSERT INTO "SalesLog" (brand, btu, customer_name, customer_phone, status) VALUES ($1, $2, $3, $4, 'CONFIRMED')`,
      [brand, btu, customerName, customerPhone]
    );
    await client.query('COMMIT');
    console.log(`[INVENTORY] Manual sale recorded for ${brand} ${btu}. SalesLog created as CONFIRMED.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error("[INVENTORY ERROR recordManualSale]", e.message);
  } finally {
    client.release();
  }
}

async function getCurrentStock() {
  try {
    const res = await pool.query(`SELECT id, brand, btu, stock_quantity FROM "Inventory" ORDER BY brand ASC, btu ASC`);
    return res.rows;
  } catch (e) {
    console.error("[INVENTORY ERROR getCurrentStock]", e.message);
    return [];
  }
}

async function updateExistingStock(brand, btu, amountToAdd) {
  try {
    const res = await pool.query(
      `UPDATE "Inventory" SET stock_quantity = GREATEST(stock_quantity + $1, 0) WHERE brand = $2 AND btu = $3 RETURNING *`,
      [amountToAdd, brand, btu]
    );
    return res.rows[0];
  } catch (e) {
    console.error("[INVENTORY ERROR updateExistingStock]", e.message);
    return null;
  }
}

module.exports = { recordSale, cancelSale, confirmSale, recordManualSale, getCurrentStock, updateExistingStock };


