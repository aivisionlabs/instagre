import { Word } from '../types';
import { initialWords } from '../wordsData';
import { supabase } from '../lib/supabase';
import {
  ProgressMap,
  readProgressCache,
  applyPendingToProgress,
} from './sync';

/**
 * Words are split into two halves:
 *  - CONTENT (definition, examples, …) lives in the global `words` table and is
 *    cached locally under one key (same for every user).
 *  - PROGRESS (mastered / toughNut) is per-user and lives in localStorage only.
 *
 * Offline-first: `loadWordsCached` returns instantly from cache (or bundled seed),
 * and `pullWords` refreshes word content from Supabase in the background.
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
  const progress = applyPendingToProgress(userId, readProgressCache(userId));
  return merge(content, progress);
}

/**
 * Refresh word content from Supabase, re-cache, and merge with local progress.
 * Throws on network errors so the caller can keep showing cached data.
 */
export async function pullWords(userId: string): Promise<Word[]> {
  const { data, error } = await supabase.from('words').select('*').order('sort_order');
  if (error) throw error;

  const content =
    data && data.length
      ? (data as WordRow[]).map(rowToContent)
      : readContentCache() ?? seedContent();
  if (data && data.length) writeContentCache(content);

  const progress = applyPendingToProgress(userId, readProgressCache(userId));
  return merge(content, progress);
}
