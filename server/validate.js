// Data checks. Run: npm run validate. Exits non-zero if the dataset breaks the project's honesty rules.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const L = (n) => JSON.parse(readFileSync(path.join(root, 'data', `${n}.json`), 'utf8'));
const [products, offers, sources, images, videos, scoring, fit, charts] = ['products', 'offers', 'sources', 'images', 'videos', 'scoring', 'fit-evidence', 'size-charts'].map(L);
const errs = [], warns = [], ids = new Set(products.map((p) => p.id)), date = /^\d{4}-\d{2}-\d{2}$/;
const dupes = (a) => a.filter((x, i) => a.indexOf(x) !== i);
dupes(products.map((p) => p.id)).forEach((d) => errs.push(`Duplicate product id: ${d}`));
dupes(sources.map((s) => s.id)).forEach((d) => errs.push(`Duplicate source id: ${d}`));
offers.forEach((o) => {
  if (!ids.has(o.p)) errs.push(`Offer for unknown product: ${o.p}`);
  if (!/^https:\/\//.test(o.url)) errs.push(`Offer URL not https: ${o.p} ${o.url}`);
  if (o.price != null && !date.test(o.chk || '')) errs.push(`Offer with a price but no valid "chk" date: ${o.p} (never invent or auto-set dates)`);
  if (o.price == null && o.chk) warns.push(`Offer without price has a date: ${o.p}`);
});
products.forEach((p) => { if (!offers.some((o) => o.p === p.id)) errs.push(`Product has no retailer offer: ${p.id}`); });
sources.forEach((s) => {
  if (!ids.has(s.p)) errs.push(`Source for unknown product: ${s.id}`);
  if (!/^https?:\/\//.test(s.url)) errs.push(`Source URL invalid: ${s.id}`);
  if (!date.test(s.chk || '')) errs.push(`Source missing checked date: ${s.id}`);
  if (s.pub && !date.test(s.pub)) errs.push(`Source bad publication date: ${s.id}`);
  if (!s.rel) errs.push(`Source missing relevance label: ${s.id}`);
});
Object.entries(scoring.TONE).forEach(([id, t]) => {
  if (!sources.some((s) => s.id === id)) errs.push(`Scoring TONE references unknown source: ${id}`);
  if (!(t[0] >= 1 && t[0] <= 5)) errs.push(`TONE reading out of 1-5: ${id}`);
});
// images.json: one record per photo; array order is gallery order (first = main photo for that product).
if (!Array.isArray(images)) errs.push('images.json must be an array of photo records');
else {
  dupes(images.map((i) => i.id)).forEach((d) => errs.push(`Duplicate image id: ${d}`));
  dupes(images.map((i) => `${i.p}|${i.file}`)).forEach((d) => errs.push(`Same photo listed twice for one product: ${d}`));
  images.forEach((im) => {
    const k = im.id || im.file;
    if (!ids.has(im.p)) errs.push(`Image for unknown product: ${k}`);
    if (!im.file || !existsSync(path.join(root, 'public', im.file))) errs.push(`Image file missing: public/${im.file}`);
    if (!im.alt) errs.push(`Image missing alt text: ${k}`);
    if (!['front', 'back', 'side', 'detail', 'lifestyle'].includes(im.view)) errs.push(`Image view must be front/back/side/detail/lifestyle: ${k}`);
    if (!['unconfirmed', 'confirmed'].includes(im.rights)) errs.push(`Image rights must be "unconfirmed" or "confirmed": ${k}`);
  });
  const un = images.filter((i) => i.rights === 'unconfirmed');
  if (un.length) warns.push(`Image rights unconfirmed for ${un.length} of ${images.length} photos (${[...new Set(un.map((i) => i.p))].join(', ')}). Demo only.`);
}
videos.forEach((v) => { if (!ids.has(v.p) || !v.url || !v.checked) errs.push(`Video entry incomplete: ${v.id ?? v.url}`); });
// fit-evidence.json: one faithful fit observation per record, tied to a stored source or the brand's spec page.
const FIT_TYPES = ['official size chart', 'manufacturer claim', 'retailer review', 'independent review', 'community report'];
const FIT_AREAS = ['hips', 'hem', 'chest', 'shoulders', 'sleeves', 'torso length', 'mobility', 'layering', 'overall'];
dupes([...fit.map((f) => f.id), ...sources.map((s) => s.id)]).forEach((d) => errs.push(`Evidence id used twice (fit-evidence/sources): ${d}`));
fit.forEach((f) => {
  const k = f.id || '(no id)', s = f.sourceId ? sources.find((x) => x.id === f.sourceId) : null;
  if (!/^FIT-[A-Z0-9-]+$/.test(f.id || '')) errs.push(`Fit evidence id must look like FIT-...: ${k}`);
  if (!ids.has(f.p)) errs.push(`Fit evidence for unknown product: ${k}`);
  if (f.sourceId && !s) errs.push(`Fit evidence cites unknown source: ${k} -> ${f.sourceId}`);
  if (s && (s.p !== f.p || s.url !== f.url)) errs.push(`Fit evidence product/URL must match its source record: ${k}`);
  if (s && s.rel !== f.relevance) errs.push(`Fit evidence must keep its source's relevance label: ${k}`);
  if (!/^https:\/\//.test(f.url || '')) errs.push(`Fit evidence URL not https: ${k}`);
  if (!FIT_TYPES.includes(f.sourceType)) errs.push(`Fit evidence sourceType must be one of ${FIT_TYPES.join(', ')}: ${k}`);
  if (!Array.isArray(f.areas) || !f.areas.length || f.areas.some((a) => !FIT_AREAS.includes(a))) errs.push(`Fit evidence areas must come from ${FIT_AREAS.join(', ')}: ${k}`);
  if (!f.summary || !f.limitations || !f.relevance) errs.push(`Fit evidence needs summary, limitations and relevance: ${k}`);
  if (!date.test(f.checked || '')) errs.push(`Fit evidence missing checked date: ${k}`);
  if (![true, false, null].includes(f.fullyReviewed)) errs.push(`Fit evidence fullyReviewed must be true, false or null: ${k}`);
});
// size-charts.json: official charts only. Body and garment measurements must never be mixed in one chart.
charts.forEach((c) => {
  const k = c.id || '(no id)';
  if (!ids.has(c.p)) errs.push(`Size chart for unknown product: ${k}`);
  if (!/^https:\/\//.test(c.url || '') || !date.test(c.checked || '')) errs.push(`Size chart needs an https URL and checked date: ${k}`);
  if (!['body', 'garment'].includes(c.measurementType)) errs.push(`Size chart measurementType must be "body" or "garment": ${k}`);
  if (!['cm', 'in'].includes(c.unit)) errs.push(`Size chart unit must be cm or in: ${k}`);
  if (!Array.isArray(c.sizes) || !c.sizes.length) errs.push(`Size chart has no sizes: ${k}`);
});
const noChart = products.filter((p) => !charts.some((c) => c.p === p.id)).map((p) => p.id);
if (noChart.length) warns.push(`No official size chart recorded for: ${noChart.join(', ')} (the assistant will say fit cannot be checked against a chart)`);
console.log(`${products.length} products, ${offers.length} offers, ${sources.length} sources, ${images.length} images, ${videos.length} videos, ${fit.length} fit evidence, ${charts.length} size charts`);
warns.forEach((w) => console.log('WARN ', w));
errs.forEach((e) => console.log('ERROR', e));
console.log(errs.length ? `FAILED with ${errs.length} error(s)` : 'OK: no errors');
process.exit(errs.length ? 1 : 0);
