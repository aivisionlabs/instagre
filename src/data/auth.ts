import { UserProfile } from '../types';
import { logger } from '../utils/logger';

/**
 * Auth via Supabase Edge Functions. Mobile is the account key; DOB is the password.
 * Session token is a signed JWT returned by auth-signup / auth-login.
 */

/** Strip everything but digits so `+1 (555) 000-0000` and `15550000000` match. */
export function normalizeMobile(mobile: string): string {
  return mobile.replace(/\D/g, '');
}

const SESSION_KEY = 'instagre_session';

interface SessionData {
  token: string;
  userId: string;
  profile: UserProfile;
}

export interface AuthResult {
  userId: string;
  profile: UserProfile;
}

interface AuthApiResponse {
  token: string;
  userId: string;
  profile: UserProfile;
  error?: string;
}

function apiUrl(functionName: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) throw new Error('VITE_SUPABASE_URL is not configured.');
  return `${base}/functions/v1/${functionName}`;
}

function apiHeaders(token?: string): Record<string, string> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('VITE_SUPABASE_ANON_KEY is not configured.');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };
  if (token) headers['X-Instagre-Token'] = token;
  return headers;
}

async function callAuthFunction(
  functionName: string,
  body: Record<string, string>,
  token?: string,
): Promise<AuthApiResponse> {
  logger.debug('auth:api', `calling ${functionName}`, { hasToken: !!token });

  try {
    const res = await fetch(apiUrl(functionName), {
      method: 'POST',
      headers: apiHeaders(token),
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as AuthApiResponse;
    if (!res.ok) {
      logger.error('auth:api', `${functionName} failed`, { status: res.status, error: data.error });
      throw new Error(data.error ?? 'Request failed. Please try again.');
    }

    logger.info('auth:api', `${functionName} succeeded`, { userId: data.userId });
    return data;
  } catch (e) {
    logger.error('auth:api', `${functionName} error`, { error: (e as Error).message });
    throw e;
  }
}

function readSessionData(): SessionData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const session = JSON.parse(raw) as SessionData;
      logger.debug('auth:session', 'read session from storage', { userId: session.userId });
      return session;
    }
    logger.debug('auth:session', 'no session in storage');
    return null;
  } catch (e) {
    logger.warn('auth:session', 'corrupt session in storage', { error: (e as Error).message });
    return null;
  }
}

function writeSession(data: SessionData): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    logger.info('auth:session', 'wrote session to storage', { userId: data.userId });
  } catch (e) {
    logger.error('auth:session', 'failed to write session', { error: (e as Error).message });
  }
}

function clearSession(): void {
  try {
    const hadSession = localStorage.getItem(SESSION_KEY) !== null;
    localStorage.removeItem(SESSION_KEY);
    if (hadSession) {
      logger.info('auth:session', 'cleared session from storage');
    }
  } catch (e) {
    logger.error('auth:session', 'failed to clear session', { error: (e as Error).message });
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

/** Restore the signed-in user from local session storage, if any. */
export function getSession(): AuthResult | null {
  const session = readSessionData();
  if (!session) {
    logger.debug('auth:session', 'no stored session available');
    return null;
  }

  if (isTokenExpired(session.token)) {
    logger.info('auth:session', 'stored session token expired, clearing');
    clearSession();
    return null;
  }

  logger.info('auth:session', 'restored session from storage', { userId: session.userId });
  return { userId: session.userId, profile: session.profile };
}

/** Listen for sign-out in other tabs (session key cleared elsewhere). */
export function onAuthStateChange(cb: (session: AuthResult | null) => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key !== SESSION_KEY) return;
    cb(getSession());
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export async function signUpWithMobileDob(input: UserProfile): Promise<AuthResult> {
  logger.info('auth:signup', 'signup started', { fullName: input.fullName });

  const mobile = normalizeMobile(input.mobile);
  logger.debug('auth:signup', 'normalized mobile', { mobileLast4: mobile.slice(-4) });

  try {
    const data = await callAuthFunction('auth-signup', {
      fullName: input.fullName,
      dob: input.dob,
      mobile,
    });

    logger.info('auth:signup', 'auth-signup function succeeded', { userId: data.userId });

    writeSession({
      token: data.token,
      userId: data.userId,
      profile: data.profile,
    });

    logger.info('auth:signup', 'signup completed successfully', { userId: data.userId });
    return { userId: data.userId, profile: data.profile };
  } catch (e) {
    logger.error('auth:signup', 'signup failed', { error: (e as Error).message });
    throw e;
  }
}

export async function signInWithMobileDob(mobile: string, dob: string): Promise<AuthResult> {
  logger.info('auth:signin', 'signin started');

  const normalizedMobile = normalizeMobile(mobile);
  logger.debug('auth:signin', 'normalized mobile', { mobileLast4: normalizedMobile.slice(-4) });

  try {
    const data = await callAuthFunction('auth-login', {
      mobile: normalizedMobile,
      dob,
    });

    logger.info('auth:signin', 'auth-login function succeeded', { userId: data.userId });

    writeSession({
      token: data.token,
      userId: data.userId,
      profile: data.profile,
    });

    logger.info('auth:signin', 'signin completed successfully', { userId: data.userId });
    return { userId: data.userId, profile: data.profile };
  } catch (e) {
    logger.error('auth:signin', 'signin failed', { error: (e as Error).message });
    throw e;
  }
}

export function signOut(): void {
  logger.info('auth:signout', 'signout initiated');
  clearSession();
  logger.info('auth:signout', 'signout completed');
}

export async function updateProfile(userId: string, updated: UserProfile): Promise<UserProfile> {
  const session = readSessionData();
  if (!session || session.userId !== userId) {
    throw new Error('Not signed in.');
  }

  const res = await fetch(apiUrl('auth-update-profile'), {
    method: 'POST',
    headers: apiHeaders(session.token),
    body: JSON.stringify({ fullName: updated.fullName }),
  });
  const data = (await res.json()) as { profile?: UserProfile; error?: string };
  if (!res.ok || !data.profile) {
    throw new Error(data.error ?? 'Could not update your profile.');
  }

  writeSession({ ...session, profile: data.profile });
  return data.profile;
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

/** Record a visit for the day and return the running streak (local only for now). */
export function touchStreak(userId: string): number {
  const today = todayStr();
  const rec = readStreakCache(userId);

  let next: StreakRecord;
  if (!rec) next = { count: 1, lastActive: today };
  else if (rec.lastActive === today) next = rec;
  else if (daysBetween(rec.lastActive, today) === 1) next = { count: rec.count + 1, lastActive: today };
  else next = { count: 1, lastActive: today };

  localStorage.setItem(streakKey(userId), JSON.stringify(next));
  return next.count;
}
