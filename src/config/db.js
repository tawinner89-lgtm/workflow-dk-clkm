"use strict";
require('dotenv').config();
const { Pool } = require('pg');

const dbConnectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: dbConnectionString,
  ssl: dbConnectionString && (dbConnectionString.includes("sslmode=require") || process.env.NODE_ENV === "production")
    ? { rejectUnauthorized: false }
    : undefined,
});

pool.on("error", (err) => {
  console.error("[PG POOL ERROR]", err.message);
});

module.exports = { pool };
