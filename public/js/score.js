// Marine Buy Score. Shared by the browser (public/js/app.js) and the API (server/index.js).
// Method is documented in docs/rating-system.md. Change weights/thresholds here, then re-run `npm run validate`.
export function computeScore(id, { SOURCES, WP, TONE }) {
  const wp = WP[id];
  const sp = wp == null ? null : wp >= 30000 ? 5 : wp >= 20000 ? 4.5 : wp >= 15000 ? 3.5 : wp >= 10000 ? 3 : 2;
  const groups = {};
  SOURCES.filter((x) => x.p === id && TONE[x.id]).forEach((x) => {
    const [t, k, base] = TONE[x.id];
    const w = base * (x.rel.startsWith('RELATED') ? 0.5 : 1);
    (groups[k] = groups[k] || { t: [], w: 0 }).t.push(t);
    groups[k].w = Math.max(groups[k].w, w);
  });
  const G = Object.values(groups).map((o) => ({ t: o.t.reduce((a, b) => a + b) / o.t.length, w: o.w }));
  const W = G.reduce((a, o) => a + o.w, 0);
  const fb = W ? G.reduce((a, o) => a + o.t * o.w, 0) / W : null;
  const parts = [sp, fb].filter((v) => v != null);
  return {
    sp, fb, W,
    total: W >= 1 && parts.length ? parts.reduce((a, b) => a + b) / parts.length : null,
    conf: W >= 4 ? 'High' : W >= 2 ? 'Moderate' : 'Low',
  };
}
