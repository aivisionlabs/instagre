import { Word } from '../types';

/**
 * Section / unit model for the learning path.
 *
 * Every letter's words are split into fixed-size **units** (UNIT_SIZE words
 * each, in alphabetical order). Consecutive units are grouped into **sections**
 * (UNITS_PER_SECTION units each), titled like "A1", "A2". A unit's progress is
 * the share of its words flagged `mastered`.
 *
 * Units are NOT locked — any unit is startable at any time. Exactly one unit is
 * `active` (highlighted as "resume here"): the caller's `lastStartedUnit` when
 * it exists and isn't already fully mastered, otherwise the first incomplete
 * unit. Everything else that isn't fully mastered is `available`.
 *
 * Mastery stats are derived from the `words` array + their `mastered` flag; the
 * only external input is which unit was last started (persisted separately).
 */

/** Words per unit (placeholder — tunable). */
export const UNIT_SIZE = 8;
/** Units grouped into one section (placeholder — tunable). */
export const UNITS_PER_SECTION = 5;

export type UnitStatus = 'available' | 'active' | 'completed';

export interface Unit {
  /** Stable id, e.g. "A-3". */
  id: string;
  letter: string;
  /** 1-based position within the letter. */
  unitNumber: number;
  /** 1-based section this unit belongs to. */
  sectionNumber: number;
  words: Word[];
  masteredCount: number;
  total: number;
  /** mastered / total, rounded. 100 only when every word is mastered. */
  percentage: number;
  status: UnitStatus;
}

export interface Section {
  /** Stable id / display title, e.g. "A1". */
  id: string;
  letter: string;
  sectionNumber: number;
  title: string;
  units: Unit[];
}

/** All words for a letter, alphabetised the same way BrowseView orders them. */
function wordsForLetter(words: Word[], letter: string): Word[] {
  return words
    .filter((w) => w.word.toUpperCase().startsWith(letter))
    .sort((a, b) => a.word.localeCompare(b.word));
}

/**
 * The 1-based unit a word falls into within its letter, or null if the word
 * isn't found. Used to treat "studying this word" as "started this unit".
 */
export function unitNumberForWord(
  words: Word[],
  letter: string,
  wordId: string,
): number | null {
  const letterWords = wordsForLetter(words, letter);
  const idx = letterWords.findIndex((w) => w.id === wordId);
  if (idx === -1) return null;
  return Math.floor(idx / UNIT_SIZE) + 1;
}

/** Slice indices [start, end) for a 1-based unit number. */
export function unitWordRange(unitNumber: number): [number, number] {
  const start = (unitNumber - 1) * UNIT_SIZE;
  return [start, start + UNIT_SIZE];
}

/** Number of units a letter's words split into (0 when the letter is empty). */
export function unitCountForLetter(words: Word[], letter: string): number {
  return Math.ceil(wordsForLetter(words, letter).length / UNIT_SIZE);
}

/**
 * The unit to advance to after finishing (letter, unitNumber): the next unit in
 * the same letter, or the first unit of the next letter (A→Z) that has words.
 * Returns null when there is nothing after it.
 */
export function resolveNextUnit(
  words: Word[],
  letter: string,
  unitNumber: number,
): { letter: string; unitNumber: number } | null {
  const unitsInLetter = unitCountForLetter(words, letter);
  if (unitNumber < unitsInLetter) {
    return { letter, unitNumber: unitNumber + 1 };
  }

  const startCode = letter.toUpperCase().charCodeAt(0);
  for (let code = startCode + 1; code <= "Z".charCodeAt(0); code++) {
    const nextLetter = String.fromCharCode(code);
    if (unitCountForLetter(words, nextLetter) > 0) {
      return { letter: nextLetter, unitNumber: 1 };
    }
  }
  return null;
}

/**
 * Build the ordered units for a letter, with mastery stats and status. No unit
 * is ever locked. Exactly one unit is `active` (the highlighted "resume here"
 * node): `lastStartedUnit` when it exists and isn't fully mastered, otherwise
 * the first incomplete unit. Fully-mastered units are `completed`; everything
 * else is `available` (still startable, just not highlighted).
 */
export function buildUnitsForLetter(
  words: Word[],
  letter: string,
  lastStartedUnit?: number | null,
): Unit[] {
  const letterWords = wordsForLetter(words, letter);
  const unitCount = Math.ceil(letterWords.length / UNIT_SIZE);

  // First pass: compute mastery stats + completion for every unit.
  const raw = Array.from({ length: unitCount }, (_, i) => {
    const unitNumber = i + 1;
    const [start, end] = unitWordRange(unitNumber);
    const unitWords = letterWords.slice(start, end);
    const total = unitWords.length;
    const masteredCount = unitWords.filter((w) => w.mastered).length;
    const percentage = total > 0 ? Math.round((masteredCount / total) * 100) : 0;
    const completed = total > 0 && masteredCount === total;
    return { unitNumber, unitWords, total, masteredCount, percentage, completed };
  });

  // Pick the single highlighted (active) unit: the last-started one if it's
  // present and not yet complete, else the first incomplete unit.
  let activeUnitNumber: number | null = null;
  if (lastStartedUnit != null) {
    const started = raw.find((u) => u.unitNumber === lastStartedUnit);
    if (started && !started.completed) activeUnitNumber = started.unitNumber;
  }
  if (activeUnitNumber === null) {
    activeUnitNumber = raw.find((u) => !u.completed)?.unitNumber ?? null;
  }

  return raw.map((u, i) => ({
    id: `${letter}-${u.unitNumber}`,
    letter,
    unitNumber: u.unitNumber,
    sectionNumber: Math.floor(i / UNITS_PER_SECTION) + 1,
    words: u.unitWords,
    masteredCount: u.masteredCount,
    total: u.total,
    percentage: u.percentage,
    status: u.completed
      ? 'completed'
      : u.unitNumber === activeUnitNumber
        ? 'active'
        : 'available',
  }));
}

/** Group a letter's units into sections of UNITS_PER_SECTION. */
export function buildSectionsForLetter(
  words: Word[],
  letter: string,
  lastStartedUnit?: number | null,
): Section[] {
  const units = buildUnitsForLetter(words, letter, lastStartedUnit);
  const sections: Section[] = [];

  for (const unit of units) {
    let section = sections[unit.sectionNumber - 1];
    if (!section) {
      section = {
        id: `${letter}${unit.sectionNumber}`,
        letter,
        sectionNumber: unit.sectionNumber,
        title: `Section ${letter}${unit.sectionNumber}`,
        units: [],
      };
      sections[unit.sectionNumber - 1] = section;
    }
    section.units.push(unit);
  }

  return sections.filter(Boolean);
}

/**
 * The unit the user should land on for a letter: the highlighted (active) unit
 * — the last-started one, or the first incomplete unit — or the last unit when
 * everything is mastered. Returns 1 when the letter has no words.
 */
export function findActiveUnitNumber(
  words: Word[],
  letter: string,
  lastStartedUnit?: number | null,
): number {
  const units = buildUnitsForLetter(words, letter, lastStartedUnit);
  if (units.length === 0) return 1;
  const active = units.find((u) => u.status === 'active');
  return active?.unitNumber ?? units[units.length - 1].unitNumber;
}
