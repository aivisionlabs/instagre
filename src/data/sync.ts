import { WordFlags } from '../types';
import { supabase } from '../lib/supabase';

/**
 * Offline-first sync engine for per-word progress.
 *
 * - Mutations are written to a local **progress cache** (instant, optimistic)
 *   and a **pending-ops queue**, both in localStorage and keyed by user id.
 * - The queue is flushed to Supabase whenever we're online (on mutation, on
 *   reconnect, on tab focus, on an interval, and on boot).
 * - Conflict resolution is last-write-wins by `updated_at`; pending ops are by
 *   definition the freshest and always win until acknowledged.
 *
 * This module owns the progress cache + queue; version.ts owns word *content*
 * and reads the progress cache from here when assembling full Word objects.
 */

export interface ProgressEntry {
  mastered: boolean;
  toughNut: boolean;
  updated_at: string; // ISO
}

/** Accept legacy cache rows that still use `learned` instead of `mastered`. */
function normalizeProgressEntry(raw: Partial<ProgressEntry> & { learned?: boolean }): ProgressEntry {
  return {
    mastered: raw.mastered ?? raw.learned ?? false,
    toughNut: raw.toughNut ?? false,
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
 * pending op (coalesced by word id), then fire-and-forget a flush.
 */
export function setProgressFlags(userId: string, wordId: string, flags: WordFlags): void {
  const entry: ProgressEntry = {
    mastered: flags.mastered,
    toughNut: flags.toughNut,
    updated_at: new Date().toISOString(),
  };

  const cache = readProgressCache(userId);
  cache[wordId] = entry;
  writeProgressCache(userId, cache);

  const queue = readJSON<ProgressMap>(queueKey(userId), {});
  queue[wordId] = entry; // coalesce: latest op per word wins
  localStorage.setItem(queueKey(userId), JSON.stringify(queue));

  void flushQueue(userId);
}

/* --------------------------------------------------------------- flush */

// Postgres error codes that mean "this op will never succeed" — drop it.
const TERMINAL_CODES = new Set(['23503', '23514', '42501']); // FK, check, RLS

let flushing = false;

/** Push all queued ops to Supabase. Safe to call concurrently (guarded). */
export async function flushQueue(userId: string): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const queue = normalizeProgressMap(readJSON(queueKey(userId), {}));
  const wordIds = Object.keys(queue);
  if (wordIds.length === 0) return;

  flushing = true;
  try {
    for (const wordId of wordIds) {
      const entry = queue[wordId];
      const { error } = await supabase.from('word_progress').upsert(
        {
          user_id: userId,
          word_id: wordId,
          mastered: entry.mastered,
          tough_nut: entry.toughNut,
          updated_at: entry.updated_at,
        },
        { onConflict: 'user_id,word_id' },
      );

      if (!error) {
        delete queue[wordId];
      } else if (error.code && TERMINAL_CODES.has(error.code)) {
        console.warn(`[sync] dropping un-syncable op for ${wordId}: ${error.message}`);
        delete queue[wordId];
      } else {
        // Likely offline / transient — stop and retry the rest later.
        break;
      }
    }
  } finally {
    localStorage.setItem(queueKey(userId), JSON.stringify(queue));
    flushing = false;
  }
}

/* --------------------------------------------------------------- lifecycle */

let currentUserId: string | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

const onOnline = () => {
  if (currentUserId) void flushQueue(currentUserId);
};
const onVisible = () => {
  if (currentUserId && document.visibilityState === 'visible') void flushQueue(currentUserId);
};

/** Start background flushing for a user. Call after login / session restore. */
export function initSync(userId: string): void {
  teardownSync();
  currentUserId = userId;
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  intervalId = setInterval(() => {
    if (currentUserId) void flushQueue(currentUserId);
  }, 30_000);
  void flushQueue(userId); // drain anything left from a previous session
}

/** Stop background flushing. Call on logout / unmount. */
export function teardownSync(): void {
  window.removeEventListener('online', onOnline);
  document.removeEventListener('visibilitychange', onVisible);
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  currentUserId = null;
}

export function getSyncStatus(userId: string): { online: boolean; pending: number } {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  const queue = normalizeProgressMap(readJSON(queueKey(userId), {}));
  return { online, pending: Object.keys(queue).length };
}
