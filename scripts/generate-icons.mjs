// Rasterises public/icon-master.svg into the PNG icon set referenced by the
// web manifest and index.html. Run with: npm run icons
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(resolve(root, 'public/icon-master.svg'));

const targets = [
  { out: 'public/icons/icon-192.png', size: 192 },
  { out: 'public/icons/icon-512.png', size: 512 },
  { out: 'public/icons/icon-maskable-192.png', size: 192 },
  { out: 'public/icons/icon-maskable-512.png', size: 512 },
  { out: 'public/icons/apple-touch-icon.png', size: 180 },
];

await Promise.all(
  targets.map(({ out, size }) =>
    sharp(svg, { density: 384 })
      .resize(size, size)
      .png()
      .toFile(resolve(root, out))
      .then(() => console.log('wrote', out)),
  ),
);
