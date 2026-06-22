import { UserProfile } from '../types';
import { supabase, synthEmail } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

/**
 * Auth + profile + streak seam, now backed by Supabase.
 *
 * Identity is still anchored on the user's **mobile number**: it's turned into a
 * synthetic auth email (`<digits>@phone.instagre.app`) with the **DOB as the
 * password**. This keeps the mobile+DOB UX while giving us a real `auth.uid()`
 * for Row Level Security. The seam is async now; the streak day-math is
 * preserved from the old localStorage implementation, with localStorage kept as
 * an offline cache.
 */

/** Strip everything but digits so `+1 (555) 000-0000` and `15550000000` match. */
export function normalizeMobile(mobile: string): string {
  return mobile.replace(/\D/g, '');
}

interface ProfileRow {
  id: string;
  full_name: string;
  dob: string; // 'yyyy-mm-dd'
  mobile: string;
  created_at: string;
}

function rowToProfile(r: ProfileRow): UserProfile {
  return {
    fullName: r.full_name,
    dob: r.dob,
    mobile: r.mobile,
    createdAt: r.created_at,
  };
}

/* ----------------------------------------------------------------- session */

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(cb: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToProfile(data as ProfileRow);
}

/* ----------------------------------------------------------------- auth */

export interface AuthResult {
  userId: string;
  profile: UserProfile;
}

export async function signUpWithMobileDob(input: UserProfile): Promise<AuthResult> {
  const mobile = normalizeMobile(input.mobile);
  const { data, error } = await supabase.auth.signUp({
    email: synthEmail(mobile),
    password: input.dob,
    options: { data: { full_name: input.fullName, mobile, dob: input.dob } },
  });
  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error('Signup did not return a user (email confirmation may be on).');

  const profile: UserProfile = {
    fullName: input.fullName,
    dob: input.dob,
    mobile,
    createdAt: user.created_at ?? new Date().toISOString(),
  };
  return { userId: user.id, profile };
}

export async function signInWithMobileDob(mobile: string, dob: string): Promise<AuthResult> {
  const norm = normalizeMobile(mobile);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: synthEmail(norm),
    password: dob,
  });
  if (error) throw error;
  const user = data.user;
  const profile =
    (await fetchProfile(user.id)) ??
    ({ fullName: '', dob, mobile: norm, createdAt: user.created_at ?? new Date().toISOString() } as UserProfile);
  return { userId: user.id, profile };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Update the editable profile fields (full name only — mobile + dob are locked). */
export async function updateProfile(userId: string, updated: UserProfile): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: updated.fullName })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return rowToProfile(data as ProfileRow);
}

/* --------------------------------------------------------------- streak */

interface StreakRecord {
  count: number;
  lastActive: string; // yyyy-mm-dd
}

const streakKey = (userId: string) => `instagre_streak_${userId}`;
const todayStr = (): string => new Date().toISOString().slice(0, 10);
const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

function readStreakCache(userId: string): StreakRecord | null {
  try {
    const raw = localStorage.getItem(streakKey(userId));
    return raw ? (JSON.parse(raw) as StreakRecord) : null;
  } catch {
    return null;
  }
}

/**
 * Record a visit for the day and return the running streak. Same day = no
 * change; consecutive day = +1; any gap = reset to 1. Reconciles against the
 * remote row when online (takes the more advanced record), and works fully
 * offline from the local cache. Best-effort upserts the result back.
 */
export async function touchStreak(userId: string): Promise<number> {
  const today = todayStr();
  let rec = readStreakCache(userId);

  // Reconcile with remote (best-effort; ignored when offline).
  try {
    const { data } = await supabase
      .from('streaks')
      .select('count, last_active')
      .eq('user_id', userId)
      .maybeSingle();
    if (data && data.last_active) {
      const remote: StreakRecord = { count: data.count, lastActive: data.last_active };
      if (!rec || remote.lastActive > rec.lastActive || remote.count > rec.count) {
        rec = remote;
      }
    }
  } catch {
    /* offline — fall back to local cache */
  }

  let next: StreakRecord;
  if (!rec) next = { count: 1, lastActive: today };
  else if (rec.lastActive === today) next = rec;
  else if (daysBetween(rec.lastActive, today) === 1) next = { count: rec.count + 1, lastActive: today };
  else next = { count: 1, lastActive: today };

  localStorage.setItem(streakKey(userId), JSON.stringify(next));
  // Best-effort remote upsert (don't block the UI on it).
  void supabase
    .from('streaks')
    .upsert({ user_id: userId, count: next.count, last_active: next.lastActive })
    .then(({ error }) => {
      if (error) console.warn('[streak] upsert failed:', error.message);
    });

  return next.count;
}
