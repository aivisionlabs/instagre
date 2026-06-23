/**
 * One-off seed: push the bundled `initialWords` content into the Supabase
 * `words` table. Idempotent (upsert on id) — safe to re-run after editing
 * wordsData.ts to sync content changes.
 *
 * Uses the SERVICE-ROLE key (bypasses RLS). Never ship this key to the client.
 *
 * Run:
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   npm run seed
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { initialWords } from '../src/wordsData';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Missing env. Run with:\n' +
      '  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed',
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  realtime: { transport: ws as any },
});

const rows = initialWords.map((w, i) => ({
  id: w.id,
  word: w.word,
  ipa: w.ipa,
  part_of_speech: w.partOfSpeech,
  definition: w.definition,
  secondary_definition: w.secondaryDefinition ?? null,
  examples: w.examples,
  synonyms: w.synonyms,
  antonyms: w.antonyms,
  etymology: w.etymology,
  audio_url: w.audioUrl ?? null,
  sort_order: i,
}));

const BATCH = 500;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const { error } = await supabase.from('words').upsert(chunk, { onConflict: 'id' });
  if (error) {
    console.error(`Seed failed at rows ${i}–${i + chunk.length}:`, error.message);
    process.exit(1);
  }
  console.log(`  … ${Math.min(i + chunk.length, rows.length)} / ${rows.length}`);
}

console.log(`Seeded ${rows.length} words into the "words" table.`);
