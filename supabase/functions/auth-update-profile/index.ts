import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { readUserToken, verifySessionToken } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/db.ts';
import { rowToProfile } from '../_shared/validate.ts';

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

    const body = await req.json();
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    if (!fullName) return jsonResponse({ error: 'Please enter your full name.' }, 400);

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('app_users')
      .update({ full_name: fullName })
      .eq('id', session.userId)
      .select('id, mobile, full_name, dob, created_at')
      .single();

    if (error || !data) {
      console.error('[auth-update-profile]', error);
      return jsonResponse({ error: 'Could not update your profile.' }, 500);
    }

    return jsonResponse({ profile: rowToProfile(data) });
  } catch (e) {
    console.error('[auth-update-profile]', e);
    return jsonResponse({ error: 'Could not update your profile.' }, 500);
  }
});
