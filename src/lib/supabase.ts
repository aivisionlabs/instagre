import { createClient } from '@supabase/supabase-js';

/**
 * The single Supabase client for the app. No other module should import
 * `@supabase/supabase-js` directly — everything goes through here so the seam
 * (auth.ts / version.ts / sync.ts) stays the only place that talks to the
 * backend.
 *
 * The anon key is safe to ship to the browser: every table is protected by Row
 * Level Security, so the key only grants what the signed-in user is allowed.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Don't throw — the app still boots (offline cache works); auth/sync just fail
  // until the env vars are set. Make the cause obvious in the console.
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'Auth and sync will not work until these are configured.',
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/** Build the synthetic auth email from a normalized (digits-only) mobile. */
export function synthEmail(normalizedMobile: string): string {
  return `${normalizedMobile}@phone.instagre.app`;
}
