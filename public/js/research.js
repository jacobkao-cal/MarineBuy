// Pure research rules. Never use the site's editorial score to rank a shortlist.
export const ROWS = [
  { id: 'price', label: 'Price & retailer' },
  { id: 'use', label: 'Sailing use' },
  { id: 'weight', label: 'Weight' },
  { id: 'wp', label: 'Wet-weather protection' },
  { id: 'br', label: 'Breathability' },
  { id: 'fit', label: 'Fit, layering & movement' },
  { id: 'hood', label: 'Hood, collar & cuffs' },
  { id: 'con', label: 'Construction', detail: true },
  { id: 'shell', label: 'Shell fabric', detail: true },
];
export const PRIORITIES = [
  { id: 'price', label: 'Lower price', rows: ['price'], next: 'weather' },
  { id: 'weight', label: 'Lighter weight', rows: ['weight'], next: 'price' },
  { id: 'weather', label: 'Wet-weather protection', rows: ['wp', 'hood', 'con'], next: 'layers' },
  { id: 'breathability', label: 'Breathability', rows: ['br'], next: 'weather' },
  { id: 'layers', label: 'Room for layers', rows: ['fit'], next: 'fit' },
  { id: 'fit', label: 'Help with fit', rows: ['fit'], next: 'layers' },
];
// Optional follow-ups revealed by "Help with fit". Body-area labels only; never inferred from gender or size.
export const FIT_FOCUS = [
  { id: 'hips', label: 'More room at the hips', areas: ['hips', 'hem'] },
  { id: 'chest', label: 'More room at the chest', areas: ['chest'] },
  { id: 'shoulders', label: 'Broad shoulders', areas: ['shoulders'] },
  { id: 'length', label: 'Sleeve or torso length', areas: ['sleeves', 'torso length'] },
  { id: 'movement', label: 'Easier movement', areas: ['mobility'] },
  { id: 'unsure', label: 'Not sure where to start', areas: [] },
];
export const provided = v => typeof v === 'string' && !!v.trim() && !/^not (provided|stated)/i.test(v);
export const name = p => `${p.brand} ${p.name}`;
export const money = (n, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
export function checkedOffer(p, offers) {
  return offers.filter(o => o.p === p.id && Number.isFinite(o.price) && o.price >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(o.chk || ''))
    .sort((a, b) => a.price - b.price)[0];
}
// Measurements require explicit matching test/size context, not just matching units.
export function weight(p) {
  const w = p.spec?.weight;
  if (!w || typeof w !== 'object' || !Number.isFinite(w.value) || w.value <= 0 || !['g', 'kg'].includes(w.unit)) return null;
  return { ...w, grams: w.value * (w.unit === 'kg' ? 1000 : 1) };
}
export function rowValue(p, id, offers) {
  if (id === 'price') { const o = checkedOffer(p, offers); return o ? `${money(o.price, o.currency)} · ${o.ret} · ${o.chk}` : 'Not provided'; }
  if (id === 'use') return p.use || 'Not provided';
  if (id === 'weight') { const w = weight(p); return w ? `${w.value} ${w.unit}${w.size ? ' · size ' + w.size : ''}${w.basis ? ' · ' + w.basis : ''}` : 'Not provided'; }
  if (id === 'hood') return `Hood: ${p.spec?.hood || 'Not provided'}; Collar: ${p.spec?.collar || 'Not provided'}; Cuffs: ${p.spec?.cuffs || 'Not provided'}`;
  return p.spec?.[id] || 'Not provided';
}
export function relevantRows(priorities) {
  return [...new Set(PRIORITIES.filter(p => priorities.includes(p.id)).flatMap(p => p.rows))];
}
export function visibleRows(products, priorities, settings, offers) {
  const relevant = relevantRows(priorities);
  return ROWS.filter(r => relevant.includes(r.id) || (settings.rows.includes(r.id) && (!settings.differences || new Set(products.map(p => rowValue(p, r.id, offers))).size > 1)))
    .sort((a, b) => Number(relevant.includes(b.id)) - Number(relevant.includes(a.id)));
}
export function compareData(products, priority, offers) {
  if (priority === 'price') {
    const values = products.map(p => ({ p, o: checkedOffer(p, offers) })).filter(x => x.o);
    const currencies = new Set(values.map(x => x.o.currency || 'USD'));
    return { values: values.sort((a, b) => a.o.price - b.o.price), missing: products.length - values.length, comparable: values.length >= 2 && currencies.size === 1 };
  }
  if (priority === 'weight') {
    const values = products.map(p => ({ p, w: weight(p) })).filter(x => x.w);
    const bases = new Set(values.map(x => JSON.stringify([x.w.basis, x.w.size, x.w.variant || ''])));
    return { values: values.sort((a, b) => a.w.grams - b.w.grams), missing: products.length - values.length,
      comparable: values.length >= 2 && bases.size === 1 && values.every(x => x.w.basis && x.w.size && x.w.source) };
  }
  return { values: products.filter(p => provided(p.spec?.[({ weather: 'wp', breathability: 'br', layers: 'fit', fit: 'fit' })[priority]])) };
}
export function suggestion(products, priority, offers) {
  const rule = PRIORITIES.find(p => p.id === priority), d = compareData(products, priority, offers);
  const base = { id: priority, title: rule.label, next: rule.next, evidence: [] };
  if (products.length < 2) return { ...base, text: 'Select at least two jackets to explore this priority.', caveat: 'Your priorities will stay selected as you build your comparison.' };
  if (priority === 'price' && d.comparable) {
    const first = d.values[0], rest = d.values.slice(1), tied = rest.some(x => x.o.price === first.o.price);
    return { ...base, text: tied ? `Among your selected jackets with checked prices, the lowest listed price is tied at ${money(first.o.price, first.o.currency)}.` : `Among your selected jackets${d.missing ? ' with checked prices' : ''}, ${name(first.p)} has the lowest listed price: ${money(first.o.price, first.o.currency)}.`,
      basis: rest.map(x => `${name(x.p)} is ${money(x.o.price - first.o.price, first.o.currency)} more.`).join(' '),
      caveat: `${d.missing ? `${d.missing} selected jacket(s) have no checked price; they may cost less. ` : ''}These are dated listings, not live prices. A lower price does not establish weather protection or fit.`,
      evidence: d.values.map(x => ({ url: x.o.url, label: `${name(x.p)} · ${x.o.ret} · ${money(x.o.price, x.o.currency)} · checked ${x.o.chk} · Exact model listing` })) };
  }
  if (priority === 'weight' && d.comparable) {
    const first = d.values[0], tied = d.values[1].w.grams === first.w.grams;
    return { ...base, text: tied ? `Among your selected jackets with comparable measurements, the lowest published weight is tied at ${first.w.grams} g.` : `Among your selected jackets${d.missing ? ' with comparable measurements' : ''}, ${name(first.p)} has the lowest published weight: ${first.w.grams} g.`,
      basis: d.values.slice(1).map(x => `${name(x.p)} is ${x.w.grams - first.w.grams} g heavier.`).join(' '),
      caveat: `Compared at size ${first.w.size}, ${first.w.basis}. ${d.missing ? 'Some selected jackets have no published weight. ' : ''}Packing lighter may matter to you; weight alone establishes neither weather protection nor layering room.`,
      evidence: d.values.map(x => ({ url: x.w.source, label: `${name(x.p)} · ${x.w.value} ${x.w.unit} · size ${x.w.size} · ${x.w.basis} · Published measurement` })) };
  }
  const unavailable = {
    price: ['A price comparison needs at least two checked listings in the same currency.', 'Check the retailer links for the missing prices. Missing prices do not make a jacket less suitable.'],
    weight: [d.values.length ? 'The published weights lack matching size, garment basis, or source context, so a lighter jacket cannot be established.' : 'No garment weights are provided for your selected jackets.', 'Ask for weights for the same size and garment configuration. Price is another measurable starting point.'],
    weather: ['The recorded waterproof figures do not establish a protection winner: matching test methods are not provided.', 'Use the highlighted hood and construction details to consider coverage. Intended use and manufacturer claims are not independent proof of better protection.'],
    breathability: ['There is no comparable breathability test across your selected jackets.', 'Reported percentages and g/m² figures use different or incomplete scales. Missing figures are unknown, not evidence of worse performance.'],
    layers: ['The recorded fit descriptions do not establish which jacket has more room for your layers.', 'Relaxed fit, articulated sleeves, and “true to size” describe different things. Check garment measurements with your usual fleece.'],
    fit: ['The recorded fit details are brand labels and a few individual reports, so they do not establish which jacket will fit your body.', 'No official size charts are recorded yet. Compare each brand’s size chart with your own body measurements, and try reaching and bending in your usual layers.'],
  }[priority];
  const key = { weather: 'wp', breathability: 'br', layers: 'fit', fit: 'fit' }[priority];
  return { ...base, text: `Among your selected jackets: ${unavailable[0]}`, basis: key ? products.filter(p => provided(p.spec?.[key])).map(p => `${name(p)}: ${p.spec[key]}.`).join(' ') : '', caveat: unavailable[1],
    evidence: products.filter(p => p.specSrc).map(p => ({ url: p.specSrc, label: `${name(p)} · Exact model specification source${p.brand === 'Zhik' ? ' (YACHT article)' : ' (brand content)'}` })) };
}
