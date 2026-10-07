"use strict";
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { Pool } = require('pg');

const dbConnectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  connectionString: dbConnectionString,
  ssl: dbConnectionString && (dbConnectionString.includes("sslmode=require") || process.env.NODE_ENV === "production")
    ? { rejectUnauthorized: false }
    : undefined,
});

pool.on("error", (err) => {
  console.error("[PG POOL ERROR]", err.message);
});

module.exports = { pool };
