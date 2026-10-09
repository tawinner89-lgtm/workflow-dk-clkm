'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadEnvConfig } = require('@next/env');

const dashboardDir = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(dashboardDir, '..');
loadEnvConfig(monorepoRoot);

const cliPath = path.join(dashboardDir, 'node_modules', 'prisma', 'build', 'index.js');
const result = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
