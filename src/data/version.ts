import { Word } from '../types';
import { initialWords } from '../wordsData';

/**
 * Bump when the shape of a cached Word changes in a way that needs a one-off
 * migration. Content edits to wordsData.ts do NOT need a bump — reconcileWords
 * always treats the bundled seed as the source of truth for word *content*.
 */
export const SCHEMA_VERSION = 1;

/** Legacy single-user key (pre-accounts). Kept for one-time migration only. */
export const LEGACY_WORDS_KEY = 'wordcrack_words_database';
export const VERSION_KEY = 'wordcrack_data_version';

/**
 * Per-user word cache key. Progress is namespaced by mobile so multiple local
 * accounts don't clobber each other and so it maps cleanly onto a future
 * server record keyed on the same number. `mobile` is already normalized by the
 * auth layer before it reaches here.
 */
export function wordsKey(mobile: string): string {
  return `wordcrack_words_${mobile}`;
}

/**
 * Reconcile a cached word array against the bundled seed.
 *
 * The bundled `initialWords` is the source of truth for word *content*
 * (definitions, examples, etymology, …). The cache is the source of truth only
 * for the user's per-word `status`. This means edits/additions to wordsData.ts
 * reach existing users on their next load (the long-standing stale-cache
 * problem), while their study progress is preserved. Words removed from the
 * seed drop out; new seed words appear as 'Unseen'.
 */
export function reconcileWords(cached: Word[]): Word[] {
  const statusById = new Map(cached.map(w => [w.id, w.status]));
  return initialWords.map(seed => ({
    ...seed,
    status: statusById.get(seed.id) ?? seed.status,
  }));
}

/**
 * Load a user's word database, reconciling cache against the bundled seed.
 *
 * Reads the per-user cache for `mobile`. If that's empty (first run for this
 * account) it falls back to the legacy single-user cache once, so a user who
 * studied before accounts existed keeps their progress on their first signup.
 */
export function loadWords(mobile: string): Word[] {
  let cached: Word[] | null = null;
  try {
    const raw =
      localStorage.getItem(wordsKey(mobile)) ?? localStorage.getItem(LEGACY_WORDS_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch (err) {
    console.warn('Stale/corrupt word cache, rebuilding from seed.', err);
    cached = null;
  }

  const words = Array.isArray(cached)
    ? reconcileWords(cached)
    : initialWords.map(w => ({ ...w }));

  persistWords(words, mobile);
  return words;
}

/** Persist a user's word database and stamp the current schema version. */
export function persistWords(words: Word[], mobile: string): void {
  localStorage.setItem(wordsKey(mobile), JSON.stringify(words));
  localStorage.setItem(VERSION_KEY, String(SCHEMA_VERSION));
}
