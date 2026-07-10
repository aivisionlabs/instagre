import { isSoundEffectsEnabled } from './speech';

const SOUND_URLS = {
  cardSwipe: "/sound/card-swipe.mp3",
  mastered: "/sound/mastered.mp3",
  toughNut: "/sound/tough-nut.mp3",
  cardFlip: "/sound/card-flip.mp3",
} as const;

export type SoundName = keyof typeof SOUND_URLS;

const cache = new Map<SoundName, HTMLAudioElement>();

function getAudio(name: SoundName): HTMLAudioElement {
  let audio = cache.get(name);
  if (!audio) {
    audio = new Audio(SOUND_URLS[name]);
    audio.preload = "auto";
    cache.set(name, audio);
  }
  return audio;
}

/**
 * Eagerly decode every sound effect so the first `playSound()` call doesn't
 * pay a fetch/decode latency penalty — that first-play lag is what makes a
 * sound feel out of sync with whatever animation it's meant to land on.
 * Call once, early (e.g. on app mount).
 */
export function preloadSounds() {
  (Object.keys(SOUND_URLS) as SoundName[]).forEach((name) => getAudio(name).load());
}

/** Play a short UI sound effect from `public/sound/`. */
export function playSound(name: SoundName) {
  if (!isSoundEffectsEnabled()) return;

  try {
    const audio = getAudio(name);
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  } catch {
    // Audio unsupported or blocked — fail silently.
  }
}
