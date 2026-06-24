import { Word } from '../types';

/** A word is "unseen" until the user has viewed it and it has no learning flags. */
export function isWordUnseen(word: Word): boolean {
  return !word.mastered && !word.toughNut && !word.viewed;
}
