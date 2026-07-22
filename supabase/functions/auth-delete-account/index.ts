import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { readUserToken, verifySessionToken } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/db.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const token = readUserToken(req);
    if (!token) return jsonResponse({ error: 'Not signed in.' }, 401);

    const session = await verifySessionToken(token);
    if (!session) return jsonResponse({ error: 'Session expired. Please sign in again.' }, 401);

    const supabase = createServiceClient();
    // word_progress / streaks / test_history all cascade on delete (see
    // migration 0003_app_users.sql), so this one delete removes everything
    // tied to the account.
    const { error } = await supabase
      .from('app_users')
      .delete()
      .eq('id', session.userId);

    if (error) {
      console.error('[auth-delete-account]', error);
      return jsonResponse({ error: 'Could not delete your account.' }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error('[auth-delete-account]', e);
    return jsonResponse({ error: 'Could not delete your account.' }, 500);
  }
});
