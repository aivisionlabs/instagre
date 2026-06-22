/**
 * Seed the local `words` table using keys from `supabase status`.
 */
import { execSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
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
const secret = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;

if (!url || !secret) {
  console.error('Could not read API URL or secret key from supabase status.');
  process.exit(1);
}

const result = spawnSync('npm', ['run', 'seed'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: secret,
  },
});

process.exit(result.status ?? 1);
