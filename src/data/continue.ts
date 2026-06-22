import { Word } from '../types';

export interface ContinueState {
  letter: string;
  wordId: string;
}

const CONTINUE_KEY_PREFIX = 'instagre_continue_';

export function continueKey(userId: string) {
  return `${CONTINUE_KEY_PREFIX}${userId}`;
}

export function getContinueState(userId: string): ContinueState | null {
  try {
    const raw = localStorage.getItem(continueKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContinueState;
    if (typeof parsed.letter === 'string' && typeof parsed.wordId === 'string') {
      return parsed;
    }
  } catch {
    /* ignore corrupt cache */
  }
  return null;
}

export function setContinueState(userId: string, state: ContinueState) {
  localStorage.setItem(continueKey(userId), JSON.stringify(state));
}

function letterStats(words: Word[], letter: string) {
  const letterWords = words.filter((w) => w.word.toUpperCase().startsWith(letter));
  const total = letterWords.length;
  if (total === 0) return { total: 0, percentage: 100, words: letterWords };
  const mastered = letterWords.filter((w) => w.mastered).length;
  return {
    total,
    percentage: Math.round((mastered / total) * 100),
    words: letterWords.sort((a, b) => a.word.localeCompare(b.word)),
  };
}

function findNextIncompleteLetter(words: Word[], afterLetter: string): string | null {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const startIdx = alphabet.indexOf(afterLetter);
  const order =
    startIdx === -1
      ? alphabet
      : [...alphabet.slice(startIdx + 1), ...alphabet.slice(0, startIdx + 1)];

  for (const letter of order) {
    const stats = letterStats(words, letter);
    if (stats.total > 0 && stats.percentage < 100) return letter;
  }
  return null;
}

function defaultWordIdForLetter(words: Word[], letter: string): string | null {
  const { words: letterWords } = letterStats(words, letter);
  if (letterWords.length === 0) return null;
  return (letterWords.find((w) => !w.mastered) ?? letterWords[0]).id;
}

/**
 * Resolves where "Continue" should point: the saved letter + word unless that
 * letter is fully mastered, in which case we advance to the next incomplete
 * letter and pick its first unmastered word.
 */
export function resolveContinueTarget(
  words: Word[],
  state: ContinueState | null,
): ContinueState | null {
  if (!state) return null;

  const saved = letterStats(words, state.letter);
  if (saved.total === 0) {
    const letter = findNextIncompleteLetter(words, 'Z');
    if (!letter) return null;
    const wordId = defaultWordIdForLetter(words, letter);
    return wordId ? { letter, wordId } : null;
  }

  if (saved.percentage < 100) {
    const wordStillThere = saved.words.some((w) => w.id === state.wordId);
    const wordId = wordStillThere ? state.wordId : (defaultWordIdForLetter(words, state.letter) ?? state.wordId);
    return { letter: state.letter, wordId };
  }

  const nextLetter = findNextIncompleteLetter(words, state.letter);
  if (!nextLetter) return null;
  const wordId = defaultWordIdForLetter(words, nextLetter);
  return wordId ? { letter: nextLetter, wordId } : null;
}
