/** @type {import('next').NextConfig} */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';

const dashboardDir = path.dirname(fileURLToPath(import.meta.url));
nextEnv.loadEnvConfig(path.resolve(dashboardDir, '..'));

const nextConfig = {
  experimental: {
    externalDir: true,
    outputFileTracingRoot: path.resolve(dashboardDir, '..'),
  },
};

export default nextConfig;
