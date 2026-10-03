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
  try {
    await pool.query(
      `UPDATE "Inventory" SET stock_quantity = GREATEST(stock_quantity - 1, 0) WHERE brand = $1 AND btu = $2`,
      [brand, btu]
    );
    await pool.query(
      `INSERT INTO "SalesLog" (brand, btu, customer_name, customer_phone, status) VALUES ($1, $2, $3, $4, 'PENDING')`,
      [brand, btu, customerName, customerPhone]
    );
    console.log(`[INVENTORY] Reserved stock for ${brand} ${btu}. SalesLog created as PENDING.`);
  } catch (e) {
    console.error("[INVENTORY ERROR recordSale]", e.message);
  }
}

async function cancelSale(saleId) {
  try {
    const saleRes = await pool.query(`SELECT brand, btu, status FROM "SalesLog" WHERE id = $1`, [saleId]);
    if (saleRes.rows.length === 0) {
      console.log(`[INVENTORY] Sale ID ${saleId} not found for cancellation.`);
      return;
    }
    const sale = saleRes.rows[0];
    if (sale.status === 'CANCELLED') {
      console.log(`[INVENTORY] Sale ID ${saleId} is already cancelled.`);
      return;
    }

    await pool.query(`UPDATE "SalesLog" SET status = 'CANCELLED' WHERE id = $1`, [saleId]);
    await pool.query(
      `UPDATE "Inventory" SET stock_quantity = stock_quantity + 1 WHERE brand = $1 AND btu = $2`,
      [sale.brand, sale.btu]
    );
    console.log(`[INVENTORY] Cancelled sale ${saleId}. Restored stock for ${sale.brand} ${sale.btu}.`);
  } catch (e) {
    console.error("[INVENTORY ERROR cancelSale]", e.message);
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
  try {
    await pool.query(
      `UPDATE "Inventory" SET stock_quantity = GREATEST(stock_quantity - 1, 0) WHERE brand = $1 AND btu = $2`,
      [brand, btu]
    );
    await pool.query(
      `INSERT INTO "SalesLog" (brand, btu, customer_name, customer_phone, status) VALUES ($1, $2, $3, $4, 'CONFIRMED')`,
      [brand, btu, customerName, customerPhone]
    );
    console.log(`[INVENTORY] Manual sale recorded for ${brand} ${btu}. SalesLog created as CONFIRMED.`);
  } catch (e) {
    console.error("[INVENTORY ERROR recordManualSale]", e.message);
  }
}

module.exports = { recordSale, cancelSale, confirmSale, recordManualSale };
