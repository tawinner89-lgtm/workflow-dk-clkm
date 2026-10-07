require('dotenv').config();
const { Pool } = require('pg');

const dbConnectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: dbConnectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const res = await pool.query(`DELETE FROM "SalesLog" WHERE brand IS NULL OR btu IS NULL`);
    console.log(`Deleted ${res.rowCount} rogue SalesLog rows.`);
  } catch (err) {
    console.error("❌ DB Connection Error:", err);
  } finally {
    pool.end();
  }
}

main();
