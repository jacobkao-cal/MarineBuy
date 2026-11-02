// Backend: serves the site and a small JSON API. Data files are re-read on every request,
// so editing anything in /data shows up on browser refresh with no restart.
import express from 'express';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeScore } from '../public/js/score.js';
import { createResearchChat } from './assistant.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Local secrets (GEMINI_API_KEY, GEMINI_MODEL) come from .env if present; real environment variables take precedence.
try { process.loadEnvFile(path.join(root, '.env')); } catch { /* no .env file: use the environment as-is */ }
const load = (n) => JSON.parse(readFileSync(path.join(root, 'data', `${n}.json`), 'utf8'));

export function catalog() {
  const c = Object.fromEntries(['products', 'offers', 'sources', 'images', 'videos', 'scoring', 'meta', 'fit-evidence', 'size-charts'].map((n) => [n.replace(/-(\w)/g, (_, ch) => ch.toUpperCase()), load(n)]));
  c.scores = Object.fromEntries(c.products.map((p) => [p.id, computeScore(p.id, { SOURCES: c.sources, WP: c.scoring.WP, TONE: c.scoring.TONE })]));
  return c;
}

const app = express();
app.get('/api/health', (_q, r) => r.json({ ok: true }));
app.get('/api/catalog', (_q, r) => { r.set('Cache-Control', 'no-store'); r.json(catalog()); });
app.get('/api/products', (_q, r) => { const c = catalog(); r.json(c.products.map((p) => ({ ...p, score: c.scores[p.id] }))); });
app.get('/api/products/:id', (q, r) => {
  const c = catalog(), p = c.products.find((x) => x.id === q.params.id);
  if (!p) return r.status(404).json({ error: 'Product not found' });
  r.json({ ...p, score: c.scores[p.id], offers: c.offers.filter((o) => o.p === p.id), sources: c.sources.filter((s) => s.p === p.id), images: c.images.filter((i) => i.p === p.id) });
});
app.use(createResearchChat({ catalog }));
app.use(express.static(path.join(root, 'public'), { etag: false, maxAge: 0 }));

const port = process.env.PORT || 3000;
if (process.argv[1] === fileURLToPath(import.meta.url)) app.listen(port, () => console.log(`Marine Buy running at http://localhost:${port}`));
export default app;
