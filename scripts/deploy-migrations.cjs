'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadEnvConfig } = require('@next/env');
const { Prisma, PrismaClient } = require('@prisma/client');

const dashboardDir = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(dashboardDir, '..');
const baselineMigration = '20261007000000_baseline';
const applicationTables = [
  'Intervention',
  'Technician',
  'Inventory',
  'SalesLog',
  'BotMessage',
  'BotRule',
  'InterventionSync',
  'StockAddition',
];

loadEnvConfig(monorepoRoot);

const cliPath = path.join(dashboardDir, 'node_modules', 'prisma', 'build', 'index.js');

function runPrisma(...args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: dashboardDir,
    encoding: 'utf8',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? 1;
}

async function inspectMigrationState(prisma) {
  const [{ migration_table_exists: migrationTableExists }] = await prisma.$queryRaw`
    SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS migration_table_exists
  `;

  let migrationCount = 0;
  let baselineApplied = false;
  if (migrationTableExists) {
    const [row] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM "_prisma_migrations"
    `;
    migrationCount = row.count;

    const [baseline] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM "_prisma_migrations"
        WHERE migration_name = ${baselineMigration}
          AND finished_at IS NOT NULL
          AND rolled_back_at IS NULL
      ) AS applied
    `;
    baselineApplied = baseline.applied;
  }

  const [existing] = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name IN (${Prisma.join(applicationTables)})
    ) AS has_application_schema
  `;

  return {
    migrationTableExists,
    migrationCount,
    baselineApplied,
    hasApplicationSchema: existing.has_application_schema,
  };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const state = await inspectMigrationState(prisma);
    const hasUninitializedExistingSchema =
      state.hasApplicationSchema &&
      (!state.migrationTableExists || state.migrationCount === 0) &&
      !state.baselineApplied;

    if (hasUninitializedExistingSchema) {
      console.log('[DB MIGRATIONS] Existing DK Clim schema detected; recording baseline.');
      const resolveStatus = runPrisma('migrate', 'resolve', '--applied', baselineMigration);

      if (resolveStatus !== 0) {
        const afterResolve = await inspectMigrationState(prisma);
        if (!afterResolve.baselineApplied) {
          process.exitCode = resolveStatus;
          return;
        }
      }
    }

    const deployStatus = runPrisma('migrate', 'deploy');
    if (deployStatus !== 0) process.exitCode = deployStatus;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[DB MIGRATIONS] Failed to inspect or apply migrations:', error.message);
  process.exitCode = 1;
});
