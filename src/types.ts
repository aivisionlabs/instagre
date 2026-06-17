export type WordStatus = 'Unseen' | 'Learned It' | 'Tough Nut';

/**
 * A local user account. Keyed by `mobile` so that, once a backend exists, the
 * local-first profile + progress can be merged into the server record for the
 * same phone number without an identity remap. All fields are user-supplied at
 * signup; nothing here is a secret (no password — local-only for now).
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
  status: WordStatus;
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
