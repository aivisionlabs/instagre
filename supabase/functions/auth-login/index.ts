import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { signSessionToken, verifyPassword } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/db.ts';
import {
  isValidDob,
  isValidMobile,
  normalizeMobile,
  rowToProfile,
} from '../_shared/validate.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const body = await req.json();
    const dob = typeof body.dob === 'string' ? body.dob.trim() : '';
    const mobile = normalizeMobile(typeof body.mobile === 'string' ? body.mobile : '');

    if (!isValidDob(dob)) return jsonResponse({ error: 'Invalid mobile number or date of birth.' }, 401);
    if (!isValidMobile(mobile)) return jsonResponse({ error: 'Invalid mobile number or date of birth.' }, 401);

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('app_users')
      .select('id, mobile, password_hash, full_name, dob, created_at')
      .eq('mobile', mobile)
      .maybeSingle();

    if (error) {
      console.error('[auth-login]', error);
      return jsonResponse({ error: 'Could not sign you in. Please try again.' }, 500);
    }

    if (!data || !(await verifyPassword(dob, data.password_hash))) {
      return jsonResponse({ error: 'Invalid mobile number or date of birth.' }, 401);
    }

    const token = await signSessionToken(data.id, data.mobile);
    return jsonResponse({
      token,
      userId: data.id,
      profile: rowToProfile(data),
    });
  } catch (e) {
    console.error('[auth-login]', e);
    return jsonResponse({ error: 'Could not sign you in. Please try again.' }, 500);
  }
});
