/**
 * Tracks the last unit the user started on the learning path, per user.
 *
 * Units are no longer gated by mastery — any unit is startable — so we remember
 * where the user last began so the path can highlight it as the "resume here"
 * node. Stored per user in localStorage under `instagre_last_unit_<userId>`.
 */

export interface LastUnitState {
  letter: string;
  unitNumber: number;
}

const LAST_UNIT_KEY_PREFIX = 'instagre_last_unit_';

export function lastUnitKey(userId: string) {
  return `${LAST_UNIT_KEY_PREFIX}${userId}`;
}

export function getLastUnitState(userId: string): LastUnitState | null {
  try {
    const raw = localStorage.getItem(lastUnitKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastUnitState;
    if (
      typeof parsed.letter === 'string' &&
      typeof parsed.unitNumber === 'number'
    ) {
      return parsed;
    }
  } catch {
    /* ignore corrupt cache */
  }
  return null;
}

export function setLastUnitState(userId: string, state: LastUnitState) {
  localStorage.setItem(lastUnitKey(userId), JSON.stringify(state));
}
