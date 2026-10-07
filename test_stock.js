require('dotenv').config();
const { Pool } = require('pg');

const dbConnectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: dbConnectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const inventory = await pool.query(`SELECT brand, btu, stock_quantity FROM "Inventory" ORDER BY brand ASC, btu ASC`);
    console.table(inventory.rows);
  } catch (err) {
    console.error("❌ DB Connection Error:", err);
  } finally {
    pool.end();
  }
}

main();
