# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server on port 3000, bound to 0.0.0.0
- `npm run build` — production build to `dist/` (also generates the service worker + web manifest via `vite-plugin-pwa`)
- `npm run preview` — serve the production build
- `npm run lint` — type-check with `tsc --noEmit` (no separate type-check or test script exists; there are no tests)
- `npm run icons` — regenerate the PNG icon set from `public/icon-master.svg` (uses `sharp`)
- `npm run clean` — remove `dist/`

## Architecture

InstaGRE is a **client-only** React 19 + Vite SPA for studying GRE vocabulary, shipped as an installable **PWA** and published to the Play Store as a **Trusted Web Activity (TWA)** wrapper. There is no backend, no API calls, and no server at runtime — all data lives in the bundle and in `localStorage`.

- **PWA:** `vite-plugin-pwa` (config in `vite.config.ts`) generates the service worker (`sw.js`), web manifest, and registration on `build`. The full app shell is precached (`registerType: 'autoUpdate'`), so the app works fully offline after first load; Google Fonts are runtime-cached. Icons derive from `public/icon-master.svg` via `npm run icons` → `public/icons/`. `vercel.json` serves `sw.js`/`manifest.webmanifest` with `must-revalidate` so updates never get stuck behind a cache. TWA domain verification is `public/.well-known/assetlinks.json` (placeholders — fill with the real package name + signing SHA-256). See `README.md` for the Bubblewrap/Play Store flow.

- **Entry:** `src/main.tsx` → `src/App.tsx`. `App.tsx` is the single source of truth: it owns the entire `words` array, the active tab, search state, and the word-detail modal, passing state and callbacks down to each view. There is no router or global state library — navigation is a `activeTab` string switch rendering one of the view components.
- **Data model:** `src/types.ts` defines `Word` (with `status: 'Unseen' | 'Learned It' | 'Tough Nut'`), `QuizQuestion`/`QuizType`, and `TestHistory`. The seed dictionary is the hardcoded `initialWords` array in `src/wordsData.ts`.
- **Views:** `src/components/` holds the five tabs — `DashboardView` (home/stats), `BrowseView` (by-letter dictionary), `LearnedView`, `ToughNutView`, and `TestsView` (quiz engine with multiple-choice / flashcard-recall / fill-in-blank, generated client-side). `SplashView` is the one-time intro gate.

### State & persistence

All persistence is `localStorage`, written immediately on every mutation. Keys:
- `instagre_words_content` — cached global word content (definition, examples, …). On load, `App` calls `loadWordsCached()` from `src/data/version.ts`, which reads from cache or the bundled seed; `pullWords()` refreshes from Supabase in the background.
- `instagre_progress_<userId>` — per-user mastered/toughNut flags, managed in `src/data/sync.ts`.
- `instagre_has_started` — splash bypass flag.
- `instagre_test_history` — `TestHistory[]`, managed inside `TestsView`.

Word status changes flow through `App.handleUpdateStatus` → `triggerWordsSync` → `persistWords`, which both `setWords` and rewrites the cache. Always route mutations through this path so the cache stays consistent.

### Styling

Tailwind CSS v4 via `@tailwindcss/vite`, configured entirely in `src/index.css` (no `tailwind.config.js`). Custom theme tokens are declared in the `@theme` block — use the semantic color names (`primary`, `success-soft`/`success-vibrant`, `warning-*`, `danger-*`, `surface`) and fonts (`font-serif` = DM Serif Display, `font-sans` = DM Sans) rather than raw hex where a token exists. The `btn-3d*` utility classes (in `@layer utilities`) provide the pressable 3D button effect. The layout is mobile-first, capped at `max-w-[600px]`. Icons come from `lucide-react`. Audio pronunciation uses the browser `SpeechSynthesis` API via `src/utils/speech.ts`.

## Gotchas

- **No backend / no Gemini.** The app makes zero network/API calls. The old AI Studio scaffolding (`@google/genai`, `express`, `dotenv`, `GEMINI_API_KEY`/`APP_URL`, `.env.example`) has been removed. Don't reintroduce a server — it's a static PWA.
- The `@/*` path alias resolves to the project root (see `vite.config.ts` and `tsconfig.json`), though current code imports with relative paths.
- HMR/file-watching is gated by the `DISABLE_HMR` env var (used by AI Studio); leave that logic in `vite.config.ts` alone.
