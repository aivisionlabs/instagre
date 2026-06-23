export type WordStatus = 'Unseen' | 'Mastered' | 'Tough Nut';

/**
 * The two independent learning flags for a word. They are NOT mutually
 * exclusive: a word can be both "Mastered" and a "Tough Nut" at the same
 * time. `toggleFlags` on the App carries a partial of this shape.
 */
export interface WordFlags {
  mastered: boolean;
  toughNut: boolean;
}

/**
 * A local user account. Keyed by `mobile` (normalized digits). Auth and progress
 * are stored on-device; Supabase supplies shared word content only.
 */
export interface UserProfile {
  fullName: string;
  dob: string;      // ISO date string (yyyy-mm-dd) as emitted by <input type="date">
  mobile: string;   // primary key
  createdAt: string; // ISO timestamp
}

export interface Word {
  id: string;
  word: string;
  ipa: string;
  partOfSpeech: string;
  definition: string;
  secondaryDefinition?: string;
  examples: string[];
  synonyms: string[];
  antonyms: string[];
  etymology: string;
  audioUrl?: string; // Optional audio URL
  // Independent flags — a word can be both mastered AND a tough nut.
  mastered: boolean;
  toughNut: boolean;
}

export type QuizType = 'multiple-choice' | 'flashcard-recall' | 'fill-in-blank';

export interface QuizQuestion {
  id: string;
  type: QuizType;
  word: Word;
  questionText: string;
  options?: string[]; // Used for multiple-choice
  correctAnswer: string; // The correct definition or correct word
  sentenceWithBlank?: string; // Used for fill-in-the-blank
}

export interface TestHistory {
  id: string;
  score: number;
  total: number;
  percentage: number;
  date: string;
  mode: string; // e.g., "By Letter: A", "Full Test", "Tough Nut Drill"
}
