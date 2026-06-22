import { Word } from '../types';
import { initialWords } from '../wordsData';
import { supabase } from '../lib/supabase';
import {
  ProgressMap,
  readProgressCache,
  writeProgressCache,
  applyPendingToProgress,
} from './sync';

/**
 * Words are split into two halves, matching the DB:
 *  - CONTENT (definition, examples, …) lives in the global `words` table and is
 *    cached locally under one key (it's the same for every user).
 *  - PROGRESS (mastered / toughNut) is per-user and lives in sync.ts's cache.
 *
 * The app is offline-first: `loadWordsCached` returns instantly from cache (or
 * the bundled seed on first run), and `pullWords` refreshes from Supabase in
 * the background, merging remote + local progress by last-write-wins.
 */

export const CONTENT_KEY = 'instagre_words_content';

/** Word content only — the per-user flags are intentionally omitted here. */
type WordContent = Omit<Word, 'mastered' | 'toughNut'>;

interface WordRow {
  id: string;
  word: string;
  ipa: string;
  part_of_speech: string;
  definition: string;
  secondary_definition: string | null;
  examples: string[] | null;
  synonyms: string[] | null;
  antonyms: string[] | null;
  etymology: string;
  audio_url: string | null;
  sort_order: number;
}

function rowToContent(r: WordRow): WordContent {
  return {
    id: r.id,
    word: r.word,
    ipa: r.ipa,
    partOfSpeech: r.part_of_speech,
    definition: r.definition,
    secondaryDefinition: r.secondary_definition ?? undefined,
    examples: r.examples ?? [],
    synonyms: r.synonyms ?? [],
    antonyms: r.antonyms ?? [],
    etymology: r.etymology,
    audioUrl: r.audio_url ?? undefined,
  };
}

/** Strip the flags off the bundled seed to use it as fallback content. */
function seedContent(): WordContent[] {
  return initialWords.map(({ mastered: _m, toughNut: _t, ...content }) => content);
}

function readContentCache(): WordContent[] | null {
  try {
    const raw = localStorage.getItem(CONTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? (parsed as WordContent[]) : null;
  } catch {
    return null;
  }
}

function writeContentCache(content: WordContent[]): void {
  localStorage.setItem(CONTENT_KEY, JSON.stringify(content));
}

/** Combine content + progress into full Word objects (flags default to false). */
function merge(content: WordContent[], progress: ProgressMap): Word[] {
  return content.map((c) => {
    const p = progress[c.id];
    return { ...c, mastered: p?.mastered ?? false, toughNut: p?.toughNut ?? false };
  });
}

/**
 * Instant, synchronous read for first paint: cached content (or bundled seed)
 * merged with the cached progress for this user.
 */
export function loadWordsCached(userId: string): Word[] {
  const content = readContentCache() ?? seedContent();
  return merge(content, readProgressCache(userId));
}

/**
 * Refresh from Supabase: pull global content + this user's progress, reconcile
 * against the local cache (LWW by updated_at) and any still-pending ops, then
 * re-cache and return the merged Word list. Throws on network/auth errors so
 * the caller can keep showing cached data.
 */
export async function pullWords(userId: string): Promise<Word[]> {
  const [wordsRes, progressRes] = await Promise.all([
    supabase.from('words').select('*').order('sort_order'),
    supabase.from('word_progress').select('*').eq('user_id', userId),
  ]);
  if (wordsRes.error) throw wordsRes.error;
  if (progressRes.error) throw progressRes.error;

  const content =
    wordsRes.data && wordsRes.data.length
      ? (wordsRes.data as WordRow[]).map(rowToContent)
      : readContentCache() ?? seedContent();
  if (wordsRes.data && wordsRes.data.length) writeContentCache(content);

  // remote progress -> map
  const remote: ProgressMap = {};
  for (const r of progressRes.data ?? []) {
    remote[r.word_id] = {
      mastered: r.mastered ?? r.learned ?? false,
      toughNut: r.tough_nut,
      updated_at: r.updated_at,
    };
  }

  // overlay local entries that are newer than remote (un-acknowledged edits)
  const merged: ProgressMap = { ...remote };
  const local = readProgressCache(userId);
  for (const [wordId, lp] of Object.entries(local)) {
    const rp = remote[wordId];
    if (!rp || lp.updated_at > rp.updated_at) merged[wordId] = lp;
  }

  // pending queue ops are the freshest — always win
  applyPendingToProgress(userId, merged);

  writeProgressCache(userId, merged);
  return merge(content, merged);
}
