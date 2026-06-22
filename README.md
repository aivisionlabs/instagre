# InstaGRE

Master every GRE word. One swipe at a time.

A client-only React 19 + Vite SPA, shipped as an installable **PWA** and published to the Google Play Store as a **Trusted Web Activity (TWA)**. There is no backend — all data lives in the bundle and in `localStorage`.

## Run locally

**Prerequisites:** Node.js

```bash
npm install
npm run dev     # Vite dev server on http://localhost:3000
```

Other scripts:

- `npm run build` — production build to `dist/` (also generates the service worker + web manifest)
- `npm run preview` — serve the production build
- `npm run lint` — type-check (`tsc --noEmit`)
- `npm run icons` — regenerate PNG icons from `public/icon-master.svg`

## PWA architecture

- **Installability** is provided by `vite-plugin-pwa` (Workbox). On `build` it generates `dist/sw.js`, `dist/manifest.webmanifest`, and injects registration into `index.html`.
- **Offline:** the full app shell is precached. Because all word data is bundled, the app works fully offline after first load. Google Fonts are runtime-cached.
- **Icons:** `public/icon-master.svg` is the single source; `npm run icons` rasterises the standard + maskable PNG set into `public/icons/`.
- **Updates:** `registerType: 'autoUpdate'` — a new deploy activates on next load. `sw.js` and `manifest.webmanifest` are served with `must-revalidate` (see `vercel.json`) so updates are never stuck behind a cache.
- **Data versioning:** `src/data/version.ts` reconciles the cached `Word[]` against the bundled seed (`wordsData.ts`) on every load — content edits reach existing users while their per-word `status` is preserved.

## Deploy (Vercel)

```bash
vercel           # preview
vercel --prod    # production
```

`vercel.json` configures the SPA rewrite, immutable hashing for `/assets`, and no-cache headers for the service worker and manifest.

## Publish to Play Store (TWA)

The Android app is a thin wrapper around the hosted PWA, verified against the domain via Digital Asset Links.

1. Deploy the PWA to production and note the URL (e.g. `https://instagre.example.com`).
2. Scaffold the TWA with Bubblewrap:
   ```bash
   npx @bubblewrap/cli init --manifest https://instagre.example.com/manifest.webmanifest
   npx @bubblewrap/cli build
   ```
   This produces a signing keystore and a signed `.aab`.
3. Get the SHA-256 fingerprint of the signing key and the Android package name, then fill them into `public/.well-known/assetlinks.json` (currently placeholders) and redeploy the PWA:
   ```bash
   keytool -list -v -keystore <your-keystore>.keystore -alias <alias> | grep SHA256
   ```
   > When you enroll in **Play App Signing**, also add the SHA-256 that Google shows in the Play Console — Google re-signs the app, so its fingerprint must be in `assetlinks.json` too, or the URL bar won't be hidden.
4. Upload the `.aab` to the Play Console.

Verify the link with: `https://developers.google.com/digital-asset-links/tools/generator`
