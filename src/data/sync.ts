import { WordFlags } from '../types';

/**
 * Offline-first sync engine for per-word progress (local only).
 *
 * Mutations are written to a local progress cache and a pending-ops queue,
 * both keyed by user id (normalized mobile). Remote Supabase sync is disabled
 * while auth is local-first; the queue is kept so a future backend can drain it.
 */

export interface ProgressEntry {
  mastered: boolean;
  toughNut: boolean;
  viewed: boolean;
  updated_at: string; // ISO
}

/** Accept legacy cache rows that still use `learned` instead of `mastered`. */
function normalizeProgressEntry(raw: Partial<ProgressEntry> & { learned?: boolean }): ProgressEntry {
  return {
    mastered: raw.mastered ?? raw.learned ?? false,
    toughNut: raw.toughNut ?? false,
    viewed: raw.viewed ?? false,
    updated_at: raw.updated_at ?? new Date().toISOString(),
  };
}

function normalizeProgressMap(map: Record<string, Partial<ProgressEntry> & { learned?: boolean }>): ProgressMap {
  const out: ProgressMap = {};
  for (const [wordId, entry] of Object.entries(map)) {
    out[wordId] = normalizeProgressEntry(entry);
  }
  return out;
}
export type ProgressMap = Record<string, ProgressEntry>;

const progressKey = (userId: string) => `instagre_progress_${userId}`;
const queueKey = (userId: string) => `instagre_pending_${userId}`;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/* --------------------------------------------------------------- progress cache */

export function readProgressCache(userId: string): ProgressMap {
  return normalizeProgressMap(readJSON(progressKey(userId), {}));
}

export function writeProgressCache(userId: string, map: ProgressMap): void {
  localStorage.setItem(progressKey(userId), JSON.stringify(map));
}

/** Overlay any queued (unsynced) ops onto a progress map — they're the freshest. */
export function applyPendingToProgress(userId: string, map: ProgressMap): ProgressMap {
  const queue = normalizeProgressMap(readJSON(queueKey(userId), {}));
  for (const [wordId, entry] of Object.entries(queue)) {
    map[wordId] = entry;
  }
  return map;
}

/* --------------------------------------------------------------- mutations */

/**
 * Optimistically record a word's flags: update the progress cache + enqueue a
 * pending op (coalesced by word id).
 */
export function setProgressFlags(userId: string, wordId: string, flags: WordFlags): void {
  const cache = readProgressCache(userId);
  const existing = cache[wordId];
  const entry: ProgressEntry = {
    mastered: flags.mastered,
    toughNut: flags.toughNut,
    viewed: existing?.viewed ?? false,
    updated_at: new Date().toISOString(),
  };

  cache[wordId] = entry;
  writeProgressCache(userId, cache);

  const queue = readJSON<ProgressMap>(queueKey(userId), {});
  queue[wordId] = entry;
  localStorage.setItem(queueKey(userId), JSON.stringify(queue));
}

/** Record that the user has seen a word (browse card, search modal, etc.). */
export function markWordViewed(userId: string, wordId: string): void {
  const cache = readProgressCache(userId);
  const existing = cache[wordId];
  if (existing?.viewed) return;

  const entry: ProgressEntry = {
    mastered: existing?.mastered ?? false,
    toughNut: existing?.toughNut ?? false,
    viewed: true,
    updated_at: new Date().toISOString(),
  };

  cache[wordId] = entry;
  writeProgressCache(userId, cache);

  const queue = readJSON<ProgressMap>(queueKey(userId), {});
  queue[wordId] = entry;
  localStorage.setItem(queueKey(userId), JSON.stringify(queue));
}

/* --------------------------------------------------------------- lifecycle */

/** No-op placeholder — remote flush disabled until custom backend auth exists. */
export async function flushQueue(_userId: string): Promise<void> {}

export function initSync(_userId: string): void {}

export function teardownSync(): void {}

export function getSyncStatus(userId: string): { online: boolean; pending: number } {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  const queue = normalizeProgressMap(readJSON(queueKey(userId), {}));
  return { online, pending: Object.keys(queue).length };
}
