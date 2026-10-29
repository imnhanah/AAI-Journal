#!/usr/bin/env node
// Runs the catalog-only SQL verifier. It never applies migrations or mutates data.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptPath = fileURLToPath(import.meta.url);
const sqlPath = path.resolve(path.dirname(scriptPath), '../supabase/verify_installation.sql');
const args = process.argv.slice(2);
const urlIndex = args.indexOf('--db-url');
const dbUrl = urlIndex >= 0 ? args[urlIndex + 1] : process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (args.includes('--help') || !dbUrl) {
  console.log('Usage: npm run verify:supabase -- --db-url "$SUPABASE_DB_URL"');
  console.log('The URL is used only by psql for a BEGIN READ ONLY catalog check and is never printed.');
  process.exit(args.includes('--help') ? 0 : 2);
}
if (!existsSync(sqlPath)) throw new Error(`Verifier SQL not found: ${sqlPath}`);
const result = spawnSync('psql', ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--file', sqlPath, dbUrl], {
  stdio: 'inherit', env: { ...process.env, PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT || '10' },
});
if (result.error?.code === 'ENOENT') {
  console.error('psql is required for the CLI verifier. Run supabase/verify_installation.sql in the Supabase SQL Editor instead.');
  process.exit(2);
}
process.exit(result.status ?? 1);
