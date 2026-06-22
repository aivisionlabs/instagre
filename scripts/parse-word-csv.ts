/**
 * Parse GRE word-list CSVs into the app's Word shape and regenerate
 * `src/wordsData.ts`. Accepts one or more CSV files (or a directory of CSVs).
 *
 * CSV columns (header row required):
 *   Word, Pronunciation, Part of Speech, Meaning, Usage in Sentence,
 *   Synonym, Antonym, Etymology
 *
 * Usage:
 *   npm run parse:words -- path/to/list-a.csv path/to/list-b.csv
 *   npm run parse:words -- data/word-lists/
 *   npm run parse:words -- data/word-lists/*.csv --seed
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Word } from '../src/types';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const POS_MAP: Record<string, string> = {
  'v.': 'verb',
  'n.': 'noun',
  'adj.': 'adjective',
  'adv.': 'adverb',
  'prep.': 'preposition',
  'conj.': 'conjunction',
  'interj.': 'interjection',
  'pron.': 'pronoun',
};

const EXPECTED_HEADERS = [
  'word',
  'pronunciation',
  'part of speech',
  'meaning',
  'usage in sentence',
  'synonym',
  'antonym',
  'etymology',
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
      if (ch === '\r') i++;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }

  return rows;
}

function normalizePos(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  return trimmed
    .split('/')
    .map((part) => {
      const key = part.trim().toLowerCase();
      return POS_MAP[key] ?? part.trim();
    })
    .join(' & ');
}

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '-');
}

function titleCaseWord(word: string): string {
  return word.trim().charAt(0).toUpperCase() + word.trim().slice(1).toLowerCase();
}

function formatEtymology(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^from\b/i.test(trimmed)) return trimmed;
  return `From ${trimmed}`;
}

function splitDefinition(meaning: string): { definition: string; secondaryDefinition?: string } {
  const parts = meaning
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return { definition: meaning.trim() };
  }

  return {
    definition: parts[0],
    secondaryDefinition: parts.slice(1).join('; '),
  };
}

function assignIds(words: Omit<Word, 'id'>[]): Word[] {
  const counters = new Map<string, number>();

  return words.map((word) => {
    const letter = word.word.charAt(0).toLowerCase();
    const next = (counters.get(letter) ?? 0) + 1;
    counters.set(letter, next);
    return { ...word, id: `${letter}${next}` };
  });
}

function rowToWord(cells: string[]): Omit<Word, 'id'> | null {
  const [word, pronunciation, pos, meaning, example, synonyms, antonyms, etymology] = cells;

  if (!word?.trim() || !meaning?.trim()) return null;

  const { definition, secondaryDefinition } = splitDefinition(meaning);

  return {
    word: titleCaseWord(word),
    ipa: pronunciation?.trim() ?? '',
    partOfSpeech: normalizePos(pos ?? ''),
    definition,
    secondaryDefinition,
    examples: example?.trim() ? [example.trim()] : [],
    synonyms: splitList(synonyms ?? ''),
    antonyms: splitList(antonyms ?? ''),
    etymology: formatEtymology(etymology ?? ''),
    mastered: false,
    toughNut: false,
  };
}

function parseCsvFile(filePath: string): Omit<Word, 'id'>[] {
  const text = readFileSync(filePath, 'utf8');
  const rows = parseCsv(text);
  if (!rows.length) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const headerOk =
    header.length >= EXPECTED_HEADERS.length &&
    EXPECTED_HEADERS.every((col, i) => header[i] === col);

  if (!headerOk) {
    throw new Error(
      `${basename(filePath)}: unexpected header.\n` +
        `Expected: ${EXPECTED_HEADERS.join(', ')}\n` +
        `Got:      ${header.join(', ')}`,
    );
  }

  const words: Omit<Word, 'id'>[] = [];
  for (const row of rows.slice(1)) {
    if (!row.some((cell) => cell.trim())) continue;
    const padded = [...row];
    while (padded.length < 8) padded.push('');
    const word = rowToWord(padded.slice(0, 8));
    if (word) words.push(word);
  }

  return words;
}

function collectCsvPaths(inputs: string[]): string[] {
  const paths: string[] = [];

  for (const input of inputs) {
    const abs = resolve(input);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      const files = readdirSync(abs)
        .filter((name) => extname(name).toLowerCase() === '.csv')
        .sort((a, b) => a.localeCompare(b))
        .map((name) => join(abs, name));
      paths.push(...files);
    } else {
      paths.push(abs);
    }
  }

  return paths;
}

function mergeWords(all: Omit<Word, 'id'>[]): Omit<Word, 'id'>[] {
  const byKey = new Map<string, Omit<Word, 'id'>>();
  const duplicates: string[] = [];

  for (const word of all) {
    const key = word.word.toLowerCase();
    if (byKey.has(key)) duplicates.push(word.word);
    else byKey.set(key, word);
  }

  if (duplicates.length) {
    const sample = [...new Set(duplicates)].slice(0, 5).join(', ');
    console.warn(
      `Skipped ${duplicates.length} duplicate(s) (kept first occurrence): ${sample}${
        duplicates.length > 5 ? ', …' : ''
      }`,
    );
  }

  return [...byKey.values()].sort((a, b) =>
    a.word.localeCompare(b.word, undefined, { sensitivity: 'base' }),
  );
}

function tsString(value: string): string {
  return JSON.stringify(value);
}

function formatWord(word: Word, indent: string): string {
  const lines: string[] = [
    `${indent}{`,
    `${indent}  id: ${tsString(word.id)},`,
    `${indent}  word: ${tsString(word.word)},`,
    `${indent}  ipa: ${tsString(word.ipa)},`,
    `${indent}  partOfSpeech: ${tsString(word.partOfSpeech)},`,
    `${indent}  definition: ${tsString(word.definition)},`,
  ];

  if (word.secondaryDefinition) {
    lines.push(`${indent}  secondaryDefinition: ${tsString(word.secondaryDefinition)},`);
  }

  lines.push(
    `${indent}  examples: [`,
    ...word.examples.map((ex) => `${indent}    ${tsString(ex)},`),
    `${indent}  ],`,
    `${indent}  synonyms: [${word.synonyms.map((s) => tsString(s)).join(', ')}],`,
    `${indent}  antonyms: [${word.antonyms.map((s) => tsString(s)).join(', ')}],`,
    `${indent}  etymology: ${tsString(word.etymology)},`,
    `${indent}  mastered: false,`,
    `${indent}  toughNut: false`,
    `${indent}}`,
  );

  return lines.join('\n');
}

function writeWordsData(words: Word[], outPath: string): void {
  const sections = new Map<string, Word[]>();
  for (const word of words) {
    const letter = word.word.charAt(0).toUpperCase();
    if (!sections.has(letter)) sections.set(letter, []);
    sections.get(letter)!.push(word);
  }

  const letters = [...sections.keys()].sort();
  const body: string[] = [];

  for (let s = 0; s < letters.length; s++) {
    const letter = letters[s];
    body.push(`  // LETTER ${letter}`);
    const group = sections.get(letter)!;
    for (let i = 0; i < group.length; i++) {
      const isLastInFile = s === letters.length - 1 && i === group.length - 1;
      body.push(formatWord(group[i], '  ') + (isLastInFile ? '' : ','));
    }
    if (s < letters.length - 1) body.push('');
  }

  const source = `import { Word } from './types';

export const initialWords: Word[] = [
${body.join('\n').trimEnd()}
];
`;

  writeFileSync(outPath, source, 'utf8');
}

function runSeed(): void {
  const result = spawnSync('npm', ['run', 'seed'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

function printUsage(): never {
  console.error(
    'Usage: npm run parse:words -- <csv-file|directory> [...] [--out src/wordsData.ts] [--seed]',
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const seed = args.includes('--seed');
const outIdx = args.indexOf('--out');
const outPath = outIdx >= 0 ? resolve(args[outIdx + 1] ?? '') : join(root, 'src/wordsData.ts');
const inputs = args.filter((arg, i) => {
  if (arg === '--seed') return false;
  if (arg === '--out') return false;
  if (outIdx >= 0 && i === outIdx + 1) return false;
  return true;
});

if (!inputs.length) printUsage();

const csvPaths = collectCsvPaths(inputs);
if (!csvPaths.length) {
  console.error('No CSV files found.');
  process.exit(1);
}

const parsed: Omit<Word, 'id'>[] = [];
for (const filePath of csvPaths) {
  const words = parseCsvFile(filePath);
  console.log(`${basename(filePath)}: ${words.length} words`);
  parsed.push(...words);
}

const merged = mergeWords(parsed);
const withIds = assignIds(merged);

writeWordsData(withIds, outPath);
console.log(`Wrote ${withIds.length} words to ${outPath}`);

if (seed) {
  console.log('Seeding Supabase…');
  runSeed();
}
