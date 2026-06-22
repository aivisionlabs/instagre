/**
 * Write `.env` for local Supabase from `supabase status`.
 * Run after `npm run supabase:start`.
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let status;
try {
  status = JSON.parse(execSync('npx supabase status -o json', { cwd: root, encoding: 'utf8' }));
} catch {
  console.error('Local Supabase is not running. Start it with: npm run supabase:start');
  process.exit(1);
}

const url = status.API_URL;
const key = status.PUBLISHABLE_KEY ?? status.ANON_KEY;

if (!url || !key) {
  console.error('Could not read API URL or publishable key from supabase status.');
  process.exit(1);
}

const env = `# Local Supabase (Docker). Run \`npm run supabase:start\` first.
# Studio: ${status.STUDIO_URL ?? 'http://127.0.0.1:54323'}
VITE_SUPABASE_URL=${url}
VITE_SUPABASE_ANON_KEY=${key}
`;

writeFileSync(join(root, '.env'), env);
console.log(`Wrote .env for local Supabase (${url})`);
