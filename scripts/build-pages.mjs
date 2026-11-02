import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeScore } from '../public/js/score.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const outputDir = path.join(root, 'dist');
const dataFiles = ['products', 'offers', 'sources', 'images', 'videos', 'scoring', 'meta', 'fit-evidence', 'size-charts'];
const catalog = Object.fromEntries(await Promise.all(dataFiles.map(async (name) => {
  const contents = await readFile(path.join(root, 'data', `${name}.json`), 'utf8');
  const key = name.replace(/-(\w)/g, (_match, letter) => letter.toUpperCase());
  return [key, JSON.parse(contents)];
})));

catalog.scores = Object.fromEntries(catalog.products.map((product) => [
  product.id,
  computeScore(product.id, { SOURCES: catalog.sources, WP: catalog.scoring.WP, TONE: catalog.scoring.TONE }),
]));

await rm(outputDir, { recursive: true, force: true });
await cp(publicDir, outputDir, {
  recursive: true,
  filter: (source) => !source.endsWith(`${path.sep}.DS_Store`),
});
await mkdir(path.join(outputDir, 'data'), { recursive: true });
await writeFile(path.join(outputDir, 'data', 'catalog.json'), `${JSON.stringify(catalog)}\n`);
await writeFile(path.join(outputDir, '.nojekyll'), '');
console.log(`Built static GitHub Pages site in ${path.relative(root, outputDir)} (${catalog.products.length} products).`);
