import { UserProfile } from '../types';

/**
 * Local-first auth + profile store.
 *
 * Everything is namespaced by the user's **mobile number** so that this layer
 * can later be swapped for REST/DB calls keyed on the same phone number with no
 * change to callers. Profiles live in one map; per-user data (word progress,
 * streak) lives under `<key>_<mobile>` keys. There is no password — sign-in is
 * a local lookup of an existing profile. Treat this file as the single seam
 * between the UI and storage; keep all key strings here.
 */

const CURRENT_KEY = 'wordcrack_current_user';   // mobile of the signed-in user
const PROFILES_KEY = 'wordcrack_profiles';      // Record<mobile, UserProfile>
const STREAK_PREFIX = 'wordcrack_streak_';       // + mobile -> StreakRecord

interface StreakRecord {
  count: number;
  lastActive: string; // yyyy-mm-dd
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Strip everything but digits so `+1 (555) 000-0000` and `15550000000` match. */
export function normalizeMobile(mobile: string): string {
  return mobile.replace(/\D/g, '');
}

/* ----------------------------------------------------------------- profiles */

export function getProfiles(): Record<string, UserProfile> {
  return readJSON<Record<string, UserProfile>>(PROFILES_KEY, {});
}

export function getProfile(mobile: string): UserProfile | null {
  return getProfiles()[normalizeMobile(mobile)] ?? null;
}

export function profileExists(mobile: string): boolean {
  return getProfile(mobile) !== null;
}

/** Upsert a profile (keyed by normalized mobile). */
export function saveProfile(profile: UserProfile): UserProfile {
  const stored: UserProfile = { ...profile, mobile: normalizeMobile(profile.mobile) };
  const profiles = getProfiles();
  profiles[stored.mobile] = stored;
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  return stored;
}

/* -------------------------------------------------------------- session */

export function getCurrentMobile(): string | null {
  return localStorage.getItem(CURRENT_KEY);
}

export function getCurrentProfile(): UserProfile | null {
  const mobile = getCurrentMobile();
  return mobile ? getProfile(mobile) : null;
}

export function setCurrentMobile(mobile: string): void {
  localStorage.setItem(CURRENT_KEY, normalizeMobile(mobile));
}

export function logout(): void {
  localStorage.removeItem(CURRENT_KEY);
}

/* --------------------------------------------------------------- streak */

const todayStr = (): string => new Date().toISOString().slice(0, 10);

const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

/**
 * Record a visit for the day and return the running streak. Same day = no
 * change; consecutive day = +1; any gap = reset to 1. Call once on app entry.
 */
export function touchStreak(mobile: string): number {
  const key = STREAK_PREFIX + normalizeMobile(mobile);
  const today = todayStr();
  const rec = readJSON<StreakRecord | null>(key, null);

  let next: StreakRecord;
  if (!rec) {
    next = { count: 1, lastActive: today };
  } else if (rec.lastActive === today) {
    next = rec;
  } else if (daysBetween(rec.lastActive, today) === 1) {
    next = { count: rec.count + 1, lastActive: today };
  } else {
    next = { count: 1, lastActive: today };
  }

  localStorage.setItem(key, JSON.stringify(next));
  return next.count;
}

export function getStreak(mobile: string): number {
  return readJSON<StreakRecord | null>(STREAK_PREFIX + normalizeMobile(mobile), null)?.count ?? 0;
}
