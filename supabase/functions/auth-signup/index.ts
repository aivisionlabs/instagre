import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { hashPassword, signSessionToken } from '../_shared/auth.ts';
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
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const dob = typeof body.dob === 'string' ? body.dob.trim() : '';
    const mobile = normalizeMobile(typeof body.mobile === 'string' ? body.mobile : '');

    if (!fullName) return jsonResponse({ error: 'Please enter your full name.' }, 400);
    if (!isValidDob(dob)) return jsonResponse({ error: 'Please enter a valid date of birth.' }, 400);
    if (!isValidMobile(mobile)) return jsonResponse({ error: 'Please enter a valid mobile number.' }, 400);

    const supabase = createServiceClient();
    const passwordHash = await hashPassword(dob);

    const { data, error } = await supabase
      .from('app_users')
      .insert({
        mobile,
        password_hash: passwordHash,
        full_name: fullName,
        dob,
      })
      .select('id, mobile, full_name, dob, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return jsonResponse(
          { error: 'An account with this mobile number already exists. Please sign in.' },
          409,
        );
      }
      console.error('[auth-signup]', error);
      return jsonResponse({ error: 'Could not create your account. Please try again.' }, 500);
    }

    const token = await signSessionToken(data.id, data.mobile);
    return jsonResponse({
      token,
      userId: data.id,
      profile: rowToProfile(data),
    });
  } catch (e) {
    console.error('[auth-signup]', e);
    return jsonResponse({ error: 'Could not create your account. Please try again.' }, 500);
  }
});
