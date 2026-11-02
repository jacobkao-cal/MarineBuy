// End-to-end check of Likes, My Likes and comparison in real headless Chrome. No npm dependencies:
// it drives Chrome over the DevTools protocol using Node's built-in fetch/WebSocket (Node 22+).
// Run: npm run dev (in one terminal), then: npm run test:e2e
// Env: CHROME=/path/to/chrome (default: macOS Google Chrome), BASE=http://localhost:3000, SHOTS=dir (save screenshots)
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://localhost:3000', SHOTS = process.env.SHOTS, PORT = 9333;
const profile = mkdtempSync(path.join(tmpdir(), 'mb-e2e-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
async function connect() {
  for (let i = 0; i < 50; i++) {
    try { const t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === 'page'); if (t) return t.webSocketDebuggerUrl; } catch { /* not up yet */ }
    await wait(200);
  }
  throw new Error('Chrome did not start. Set CHROME=/path/to/chrome');
}
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
async function js(expr) {
  const r = await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`${r.exceptionDetails.exception?.description || r.exceptionDetails.text}\n in: ${expr}`);
  return r.result.value;
}
async function open(hash, reload = true) { await js(`location.hash=${JSON.stringify(hash)};`); if (reload) { await send('Page.reload'); await wait(700); } else await wait(250); }
const click = (sel) => js(`const e=document.querySelector(${JSON.stringify(sel)});if(!e)throw new Error('missing '+${JSON.stringify(sel)});e.click();`).then(() => wait(150));
const state = () => js(`return JSON.parse(localStorage.getItem('marinebuy:likes')||'null')`);
const count = () => js(`return document.querySelector('#likes-n').textContent`);
const shot = async (name) => { if (!SHOTS) return; mkdirSync(SHOTS, { recursive: true }); const r = await send('Page.captureScreenshot', { captureBeyondViewport: true }); writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64')); };
let pass = 0, fail = 0;
function check(name, ok, detail = '') { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : '  -> ' + JSON.stringify(detail)}`); }
const btn = (id) => `[data-like="${id}"]`;
const btnState = (id) => js(`const b=document.querySelector('${btn(id)}');return b&&[b.getAttribute('aria-pressed'),b.querySelector('.lb').textContent]`);

try {
  ws = new WebSocket(await connect());
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } });
  ws.addEventListener('message', m => { const d=JSON.parse(m.data); if(d.method==='Runtime.exceptionThrown')console.log('BROWSER ERROR',d.params.exceptionDetails.exception?.description||d.params.exceptionDetails.text); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: BASE + '/#/' }); await wait(900);
  await js(`localStorage.clear()`); await send('Page.reload'); await wait(800);
  for(let i=0;i<40;i++){if(await js(`return !!document.querySelector('[data-like]')`))break;await wait(250);}
  if(!(await js(`return !!document.querySelector('[data-like]')`))) console.log('Initial page:',await js(`return document.body.innerText`));

  // 1. Like / unlike from listing, synced to nav count, tray and storage
  const ids = await js(`return [...document.querySelectorAll('[data-like]')].map(b=>b.dataset.like)`);
  check('listing shows a Like button per product', ids.length === 5, ids);
  check('unliked state: outlined heart + "Like", aria-pressed=false', JSON.stringify(await btnState(ids[0])) === '["false","Like"]');
  check('heart is an aria-hidden SVG', await js(`return document.querySelector('${btn(ids[0])} svg').getAttribute('aria-hidden')==='true'`));
  check('nav shows My Likes (0)', (await js(`return document.querySelector('#nav-likes').textContent.trim()`)) === 'My Likes (0)');
  await click(btn(ids[0]));
  check('click -> "Liked", aria-pressed=true', JSON.stringify(await btnState(ids[0])) === '["true","Liked"]');
  check('nav count -> 1', (await count()) === '1');
  check('tray shows 1 liked', /1 liked/.test(await js(`return document.querySelector('#tray').textContent`)));
  check('stored in localStorage', JSON.stringify((await state()).ids) === JSON.stringify([ids[0]]));
  check('filled heart when liked', (await js(`return getComputedStyle(document.querySelector('${btn(ids[0])} .hrt path')).fill`)) !== 'none');
  await click(btn(ids[0]));
  check('click again -> unliked, count 0', JSON.stringify(await btnState(ids[0])) === '["false","Like"]' && (await count()) === '0');
  check('tray hidden at 0 likes', (await js(`return document.querySelector('#tray').innerHTML`)) === '');

  // 2. Detail page sync
  await open(`#/p/${ids[0]}`, false);
  await click(btn(ids[0]));
  check('like from detail page', JSON.stringify(await btnState(ids[0])) === '["true","Liked"]' && (await count()) === '1');
  await open('#/', false);
  check('listing reflects like made on detail page', JSON.stringify(await btnState(ids[0])) === '["true","Liked"]');

  // 3. Keyboard: Enter and Space toggle a focused Like button
  await js(`document.querySelector('${btn(ids[1])}').focus()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await wait(150);
  check('Enter likes the focused button', JSON.stringify(await btnState(ids[1])) === '["true","Liked"]');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 }); await wait(150);
  check('Space unlikes it; focus stays on button', JSON.stringify(await btnState(ids[1])) === '["false","Like"]' && await js(`return document.activeElement.dataset.like===${JSON.stringify(ids[1])}`));
  check('live region announces the change', /removed from My Likes/.test(await js(`return document.querySelector('#live').textContent`)));

  // 4. Like all five (more than four), persistence after refresh
  for (const id of ids) if ((await btnState(id))[0] === 'false') await click(btn(id));
  check('can like more than 4 (5 liked)', (await count()) === '5' && (await state()).ids.length === 5);
  await send('Page.reload'); await wait(800);
  check('count persists after refresh', (await count()) === '5');
  check('buttons stay "Liked" after refresh', (await js(`return [...document.querySelectorAll('[data-like]')].every(b=>b.getAttribute('aria-pressed')==='true')`)));
  await click(btn(ids[0])); await click(btn(ids[0]));
  check('no duplicates after unlike/relike', new Set((await state()).ids).size === (await state()).ids.length && (await state()).ids.length === 5);

  // 5. My Likes page and 2-4 selection
  await open('#/likes', false);
  check('research workspace title + subtitle', (await js(`return document.querySelector('h1').textContent+'|'+document.querySelector('.lk-sub').textContent`)) === 'Your next jacket, clearer.|Your shortlist. Your research. Your decision.');
  check('nav marks My Likes as current page', (await js(`return document.querySelector('#nav-likes').getAttribute('aria-current')`)) === 'page');
  check('lists all 5 saved jackets', (await js(`return document.querySelectorAll('.lk').length`)) === 5);
  check('each item has photo/fallback, brand, model link, price text, retailer link, remove', await js(`return [...document.querySelectorAll('.lk')].every(l=>l.querySelector('.ph')&&l.querySelector('.lk-t a')&&/\\$\\d+|Check price at retailer/.test(l.textContent)&&l.querySelector('a[target=_blank]')&&l.querySelector('[data-unlike]'))`));
  check('defaults to two selected', (await state()).sel.length === 2);
  await click('#sel-clr');
  check('Compare disabled with 0 selected', await js(`return document.querySelector('#cmp-go').disabled&&document.querySelector('#cmp-go').textContent==='Compare selected (0)'`));
  const sel = (id) => js(`const c=document.querySelector('[data-sel="${id}"]');c.focus();c.click();`).then(() => wait(120));
  await sel(ids[0]);
  check('1 selected: still disabled, hint asks for 1 more', await js(`return document.querySelector('#cmp-go').disabled&&/1 more/.test(document.querySelector('#lk-hint').textContent)`));
  check('focus stays on checkbox after re-render', await js(`return document.activeElement.dataset.sel===${JSON.stringify(ids[0])}`));
  for (const id of ids.slice(1, 4)) await sel(id);
  check('4 selected: "Compare selected (4)" enabled', await js(`return !document.querySelector('#cmp-go').disabled&&document.querySelector('#cmp-go').textContent==='Compare selected (4)'`));
  check('5th checkbox disabled at the limit', await js(`return document.querySelector('[data-sel="${ids[4]}"]').disabled`));
  check('selection stored (4) as a subset of likes', (await state()).sel.length === 4);
  await send('Page.reload'); await wait(800);
  check('selection persists after refresh', (await js(`return document.querySelectorAll('[data-sel]:checked').length`)) === 4);
  await shot('likes-desktop');

  // 6. Compare selected -> side-by-side with shareable URL
  await click('#cmp-go'); await wait(200);
  const h = await js(`return location.hash`);
  check('compare URL carries the 4 product IDs', h === `#/compare?cmp=${ids.slice(0, 4).join('%2C')}`, h);
  check('4 product columns', (await js(`return document.querySelectorAll('[data-uncmp]').length`)) === 4);
  check('compare URL contains no likes/notes data', !/likes|note/i.test(h));
  await shot('compare-desktop');
  await click(`[data-uncmp="${ids[1]}"]`); await wait(200);
  check('remove from comparison -> 3 columns', (await js(`return document.querySelectorAll('[data-uncmp]').length`)) === 3);
  check('...and URL updated', (await js(`return location.hash`)) === `#/compare?cmp=${[ids[0], ids[2], ids[3]].join('%2C')}`);
  check('...but jacket is still in Likes (count 5)', (await count()) === '5' && (await state()).ids.includes(ids[1]));
  check('...and focus moved to a remaining control', await js(`return !!document.activeElement.dataset.uncmp`));
  await send('Page.reload'); await wait(800);
  check('shared compare URL renders after refresh', (await js(`return document.querySelectorAll('[data-uncmp]').length`)) === 3);
  await click(`[data-uncmp="${ids[2]}"]`); await click(`[data-uncmp="${ids[3]}"]`); await wait(200);
  check('single-product state is explained', /Only .* is in this comparison/.test(await js(`return document.querySelector('#app').textContent`)));

  // 7. Compare 2 from the larger list
  await open('#/likes', false);
  check('removed-from-comparison jackets unselected in My Likes', (await js(`return document.querySelectorAll('[data-sel]:checked').length`)) === 1);
  await sel(ids[4]); await click('#cmp-go'); await wait(200);
  check('compare 2 of 5 liked', (await js(`return document.querySelectorAll('[data-uncmp]').length`)) === 2);

  // 8. Remove from Likes on My Likes; focus management
  await open('#/likes', false);
  await click(`[data-unlike="${ids[2]}"]`);
  check('remove from Likes -> 4 items, count 4', (await js(`return document.querySelectorAll('.lk').length`)) === 4 && (await count()) === '4');
  check('focus moved to next Remove button', await js(`return document.activeElement.dataset.unlike===${JSON.stringify(ids[3])}`));
  await open('#/', false);
  check('listing shows removed jacket as "Like"', JSON.stringify(await btnState(ids[2])) === '["false","Like"]');

  // Research workspace: genuine user interactions, persistence, evidence, and keyboard focus.
  await open('#/likes', false);
  await click('#sel-clr');
  await sel('gill-os2'); await sel('musto-br2');
  check('workspace shows selected product columns immediately', (await js(`return document.querySelectorAll('.product-heading').length`)) === 2);
  await click('[data-priority="price"]');
  check('priority has an accessible pressed state', await js(`return document.querySelector('[data-priority="price"]').getAttribute('aria-pressed')==='true'`));
  check('price row is first and marked with text', await js(`const r=document.querySelector('#comparison-rows tr');return r.dataset.row==='price'&&r.classList.contains('priority-row')&&r.textContent.includes('Your priority')`));
  check('recommendation uses actual checked prices and difference', await js(`const t=document.querySelector('#recommendations').textContent;return t.includes('$395.00')&&t.includes('$35.00')&&t.includes('lowest listed price')&&!t.includes('best overall')`));
  await click('[data-priority="weight"]');
  check('multiple priorities remain selected', (await js(`return document.querySelectorAll('[data-priority][aria-pressed=true]').length`)) === 2);
  check('missing weights explained without a fabricated measurement', await js(`const t=document.querySelector('#recommendations').textContent;return t.includes('No garment weights')&&!/\\b[0-9]+ g\\b/.test(t)`));
  check('missing priority row stays visible even with differences only', await js(`document.querySelector('#differences-only').click();return !!document.querySelector('[data-row="weight"].priority-row')`));
  await click('[data-priority="weather"]');
  check('waterproof claim differences are not ranked', await js(`const t=document.querySelector('#recommendations').textContent;return t.includes('matching test methods are not provided')&&t.includes('Gill scale: 20,000+mm')&&t.includes('30,000mm (Musto claim)')`));
  for(const id of ['breathability','layers','fit']) await click(`[data-priority="${id}"]`);
  check('all six priorities toggle and show honest evidence limits', await js(`const t=document.querySelector('#recommendations').textContent;return document.querySelectorAll('[data-priority][aria-pressed=true]').length===6&&t.includes('no comparable breathability')&&t.includes('do not establish which jacket')&&t.includes('do not establish which jacket will fit your body')`));
  for(const id of ['breathability','layers','fit']) await click(`[data-priority="${id}"]`);
  await js(`document.querySelector('[data-disclosure="row-chooser"]').open=true`);
  await click('[data-row-toggle="shell"]');
  check('row chooser adds a specification row', await js(`return !!document.querySelector('[data-row="shell"]')`));
  await click('[data-ws-tab="notes"]');
  await js(`const n=document.querySelector('[data-note="gill-os2"]');n.value='My private fleece & fit note <script>';n.dispatchEvent(new Event('input',{bubbles:true}))`);
  await send('Page.reload'); await wait(700);
  check('note content, tab, priorities and differences survive refresh', await js(`return document.querySelector('[data-note="gill-os2"]').value==='My private fleece & fit note <script>'&&document.querySelectorAll('[data-priority][aria-pressed=true]').length===3&&document.querySelector('#differences-only').checked`));
  check('notes rendered safely, not as HTML', await js(`return !document.querySelector('#research-workspace script')`));
  check('visible-row setting survives refresh', await js(`return document.querySelector('[data-row-toggle="shell"]').checked`));
  await js(`globalThis.originalClipboardWrite=navigator.clipboard.writeText.bind(navigator.clipboard);navigator.clipboard.writeText=async text=>{globalThis.copiedComparison=text}`);
  await click('#workspace-copy');
  check('workspace share contains only comparison context, never private notes', await js(`const u=new URL(globalThis.copiedComparison);return u.hash.includes('/compare?cmp=gill-os2%2Cmusto-br2')&&!/private|fleece|script|priorities|notes/.test(u.href)`));
  await js(`navigator.clipboard.writeText=globalThis.originalClipboardWrite`);
  await click('[data-ws-tab="overview"]');
  await js(`document.querySelector('[data-priority="price"]').focus();window.scrollTo(0,120)`);
  const beforePriorityY = await js(`return scrollY`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 }); await wait(150);
  check('keyboard deselects priority without moving focus or scroll', await js(`return document.activeElement.dataset.priority==='price'&&document.activeElement.getAttribute('aria-pressed')==='false'&&scrollY===${beforePriorityY}`));
  await click('#clear-priorities');
  check('clear priorities restores neutral comparison', await js(`return !document.querySelector('[data-priority][aria-pressed=true]')&&!document.querySelector('.priority-row')&&!!document.querySelector('.thought-starter')`));
  await click('[data-priority="price"]');
  await click('[data-ws-remove="gill-os2"]');
  check('workspace removal preserves like, updates count and recommendation', await js(`return document.querySelector('#likes-n').textContent==='4'&&document.querySelectorAll('.product-heading').length===1&&document.querySelector('#recommendations').textContent.includes('Select at least two')&&document.querySelector('[data-sel="gill-os2"]').checked===false`));
  await sel('hh-pier4');
  check('recommendations update for changed selected products', await js(`return document.querySelector('#recommendations').textContent.includes('$295.00')&&document.querySelector('#recommendations').textContent.includes('$135.00')`));
  await click('[data-like="hh-pier4"]');
  check('unliking an actively compared product updates options, count, and recommendations', await js(`return document.querySelectorAll('.lk').length===3&&document.querySelector('#likes-n').textContent==='3'&&document.querySelectorAll('.product-heading').length===1&&document.querySelector('#recommendations').textContent.includes('Select at least two')`));
  await open('#/',false);await click('[data-like="hh-pier4"]');await open('#/likes',false);await sel('hh-pier4');
  await click('[data-ws-tab="research"]');
  check('full specs and original research accessible in workspace', await js(`return document.querySelector('.research-product')?.textContent.includes('Manufacturer')||document.querySelector('.research-product')?.textContent.includes('Exact model specifications')`));
  await click('[data-ws-tab="videos"]');
  check('video empty states stay honest', await js(`return document.querySelector('#tab-content').textContent.includes('No verified YouTube review')`));
  await click('[data-ws-tab="overview"]');
  await shot('workspace-desktop');
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 1, mobile: true });
  await js(`return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  check('375px workspace has no horizontal page overflow', await js(`return document.documentElement.scrollWidth<=375`),await js(`return [...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>375&&!e.closest('.comparison-scroll')&&!e.closest('details:not([open])')).slice(0,15).map(e=>[e.tagName,e.className,e.getBoundingClientRect().right,e.clientWidth,e.scrollWidth])`));
  check('375px all compared products accessible by internal horizontal scroll', await js(`const c=document.querySelector('.comparison-scroll');c.scrollLeft=c.scrollWidth;return c.scrollWidth>c.clientWidth&&c.scrollLeft>0&&document.querySelectorAll('.product-heading').length===2`));
  check('375px priorities reflow below comparison', await js(`return document.querySelector('.thinking-panel').getBoundingClientRect().top>document.querySelector('.compare-panel').getBoundingClientRect().top`));
  await js(`document.querySelector('#saved-options').open=false;document.querySelector('.compare-panel').scrollIntoView()`);
  await wait(250);
  await shot('workspace-mobile');
  await send('Emulation.clearDeviceMetricsOverride');

  // 9. Clear all, with confirmation
  await open('#/likes', false);
  if(!(await js(`return document.querySelector('#saved-options').open`))) await click('#saved-options > summary');
  await click('#rs');
  check('clear asks for confirmation; focus on Cancel', await js(`return !!document.querySelector('#rs-yes')&&document.activeElement.id==='rs-no'`));
  await click('#rs-no');
  check('cancel keeps Likes', (await count()) === '4');
  await click('#rs'); await click('#rs-yes');
  check('confirm clears Likes; empty state with browse link', (await count()) === '0' && await js(`return /haven’t liked/.test(document.querySelector('#app').textContent)&&!!document.querySelector('.lk-empty a[href^="#/"]')`));
  await shot('likes-empty');

  // 10. Invalid / duplicate / corrupt storage
  await js(`localStorage.setItem('marinebuy:likes',JSON.stringify({v:1,ids:['gill-os2','gill-os2','removed-jacket',5,null],sel:['removed-jacket','gill-os2','zhik-ofs600']}))`);
  await open('#/', true);
  const st = await state();
  check('invalid + duplicate IDs dropped (1 left)', (await count()) === '1' && JSON.stringify(st.ids) === '["gill-os2"]', st);
  check('selection limited to liked IDs', JSON.stringify(st.sel) === '["gill-os2"]', st);
  check('notice explains removed product', /no longer in the catalog/.test(await js(`return document.querySelector('#notice').textContent`)));
  await js(`localStorage.setItem('marinebuy:likes','{{not json')`);
  await open('#/', true);
  check('corrupt storage -> 0 likes, page still works', (await count()) === '0' && (await js(`return document.querySelectorAll('.card').length`)) === 5);

  // 11. One-time migration of an old comparison URL
  await js(`localStorage.clear()`);
  await open('#/?brand=&cmp=gill-os2,musto-br2,not-real', true);
  const m = await state();
  check('old ?cmp= selection migrated into Likes + selection', (await count()) === '2' && m.sel.length === 2, m);
  check('migration notice with Undo', !!(await js(`return document.querySelector('#nt-undo')`)));
  check('cmp stripped from non-compare URL', !/cmp/.test(await js(`return location.hash`)));
  await click('#nt-undo');
  check('Undo removes migrated likes', (await count()) === '0');
  await open('#/compare?cmp=zhik-ofs600,hh-pier4', true);
  check('later shared links do not auto-like', (await count()) === '0' && (await js(`return document.querySelectorAll('[data-uncmp]').length`)) === 2);
  await click(btn('zhik-ofs600'));
  check('can Like from compare page', (await count()) === '1');

  // 12. Existing search + combined filters still work
  await open('#/?brand=Gill', false);
  check('brand filter', (await js(`return document.querySelectorAll('.card').length`)) === 1);
  await open('#/?q=offshore&tier=Offshore', false);
  check('search + tier filter combined', (await js(`return document.querySelectorAll('.card').length`)) >= 1 && (await js(`return [...document.querySelectorAll('.card .tag')].every(t=>t.textContent==='Offshore')`)));

  // 13. Language + reduced motion
  for (const p of ['#/', '#/likes', `#/p/${ids[0]}`, '#/compare?cmp=gill-os2,musto-br2']) { await open(p, false); const t = await js(`return document.body.innerText`); check(`no cart/checkout/purchase/popularity text on ${p}`, !/\b(cart|checkout|purchase now|\d+ (people|users) liked)\b/i.test(t)); }
  await open('#/', false);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await click(btn(ids[3]));
  check('reduced motion: no heart animation', (await js(`return getComputedStyle(document.querySelector('${btn(ids[3])} .hrt')).animationName`)) === 'none');
  await send('Emulation.setEmulatedMedia', { features: [] });

  // 14. Photo galleries
  await open('#/', false);
  const gals = await js(`return [...document.querySelectorAll('.card')].map(c=>c.querySelectorAll('.gal-slide').length)`);
  check('every home card has a multi-photo carousel', gals.length === 5 && gals.every((n) => n >= 3), gals);
  const g0 = `.card:nth-child(1) .gal`, n0 = gals[0];
  const counter = (g) => js(`return document.querySelector('${g} .gal-n').textContent`);
  await click(`${g0} .next`); await wait(700);
  check('card Next arrow -> photo 2', (await counter(g0)) === `2 / ${n0}`, await counter(g0));
  await click(`${g0} .prev`); await click(`${g0} .prev`); await wait(900);
  check('Prev from photo 1 wraps to last photo', (await counter(g0)) === `${n0} / ${n0}`, await counter(g0));
  await js(`document.querySelector('${g0} .gal-track').focus()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }); await wait(900);
  check('Right arrow key on carousel -> wraps to photo 1', (await counter(g0)) === `1 / ${n0}`, await counter(g0));
  await js(`const t=document.querySelector('${g0} .gal-track');t.scrollTo({left:t.clientWidth*2,behavior:'auto'})`); await wait(300);
  check('swipe/scroll position updates the counter', (await counter(g0)) === `3 / ${n0}`, await counter(g0));
  for (const id of ids) {
    await open(`#/p/${id}`, false);
    await js(`await Promise.all([...document.querySelectorAll('.gal img, .ph img')].map(i=>{i.loading='eager';return i.complete?0:new Promise(r=>{i.onload=i.onerror=r})}))`);
    const bad = await js(`return [...document.querySelectorAll('.gal img')].filter(i=>!i.naturalWidth).map(i=>i.getAttribute('src'))`);
    check(`all photos load on ${id}`, bad.length === 0, bad);
  }
  await open('#/p/hh-pier4', false);
  await click('[data-gal-go="3"]'); await wait(900);
  check('thumbnail click -> that photo, marked current, caption updated', (await counter('.gal.big')) === '4 / 7' && await js(`return document.querySelector('[data-gal-go="3"]').getAttribute('aria-current')==='true'&&/Photo 4 of 7 · Detail/.test(document.querySelector('.gal-cap').textContent)`));
  check('caption keeps rights status visible', /Rights unconfirmed/.test(await js(`return document.querySelector('.gal-cap').textContent`)));
  await js(`document.querySelector('.gal-slide img').src='/images/does-not-exist.webp'`); await wait(400);
  check('broken photo shows a fallback message', /Photo failed to load/.test(await js(`return document.querySelector('.gal-slide').textContent`)));

  // 15. Click-to-enlarge viewer
  const key = async (k, code, vk) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }); await wait(700); };
  const lbOpen = () => js(`return !!document.querySelector('#lb')?.open`);
  await open('#/?tier=Coastal', false);
  await js(`window.scrollTo(0,250)`); await wait(100);
  const y0 = await js(`return scrollY`);
  const cg = `.card:nth-child(2) .gal`;
  await js(`const t=document.querySelector('${cg} .gal-track');t.scrollTo({left:t.clientWidth*2,behavior:'auto'})`); await wait(300);
  await js(`document.querySelector('${cg} .gal-slide:nth-child(3) img').click()`); await wait(400);
  check('clicking a card photo opens the viewer at that photo', await lbOpen() && /^3 \//.test(await js(`return document.querySelector('#lb .gal-n').textContent`)));
  check('viewer is a modal dialog titled with the product; focus on Close', await js(`const d=document.querySelector('#lb');return d.matches(':modal')&&d.querySelector('#lb-t').textContent.length>5&&document.activeElement.classList.contains('lb-x')`));
  check('viewer image is large', (await js(`const i=document.querySelectorAll('#lb .lb-slide img')[2];return i.getBoundingClientRect().height`)) > 500);
  await key('ArrowRight', 'ArrowRight', 39);
  check('Right arrow in viewer -> next photo + caption', /^4 \//.test(await js(`return document.querySelector('#lb .gal-n').textContent`)) && /Photo 4 of/.test(await js(`return document.querySelector('#lb .gal-cap').textContent`)));
  await click('#lb .gal-btn.prev'); await wait(700);
  check('Prev button in viewer', /^3 \//.test(await js(`return document.querySelector('#lb .gal-n').textContent`)));
  await key('ArrowRight', 'ArrowRight', 39);
  await key('Escape', 'Escape', 27);
  check('Escape closes the viewer', !(await lbOpen()));
  check('focus returns to the card carousel', await js(`return document.activeElement===document.querySelector('${cg} .gal-track')`));
  check('card carousel follows the photo viewed (4)', /^4 \//.test(await counter(cg)));
  check('page scroll, filters and URL preserved', (await js(`return scrollY`)) === y0 && (await js(`return location.hash`)) === '#/?tier=Coastal' && (await js(`return document.querySelectorAll('.card').length`)) === 2);
  await key('Enter', 'Enter', 13);
  check('Enter on a focused carousel opens the viewer', await lbOpen());
  await js(`const d=document.querySelector('#lb');d.dispatchEvent(new MouseEvent('click',{bubbles:true}))`); await wait(200);
  check('clicking outside the photo closes it', !(await lbOpen()));
  await open('#/p/gill-os2', false);
  await click('.gal.big .gal-zoom'); await wait(300);
  check('product page Enlarge button opens the viewer', await lbOpen() && /^1 \/ 5/.test(await js(`return document.querySelector('#lb .gal-n').textContent`)));
  await shot('lightbox-desktop');
  await click('[data-lb-close]'); await wait(200);
  check('Close button closes and refocuses Enlarge', !(await lbOpen()) && await js(`return document.activeElement.classList.contains('gal-zoom')`));
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 2, mobile: true });
  await click('.gal.big .gal-zoom'); await wait(400);
  check('375px: viewer fits the screen, no page overflow', await lbOpen() && await js(`return document.documentElement.scrollWidth<=375&&document.querySelector('#lb .lb-slide img').getBoundingClientRect().width<=375`));
  await shot('lightbox-mobile');
  await key('Escape', 'Escape', 27);
  await send('Emulation.clearDeviceMetricsOverride');

  // 16. Mobile width 375px: no horizontal page scroll
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 2, mobile: true });
  await open('#/', false);
  for (const id of ids.slice(0, 3)) if ((await btnState(id))[0] === 'false') await click(btn(id));
  for (const p of ['#/', '#/likes', `#/p/${ids[0]}`, '#/compare?cmp=gill-os2,musto-br2']) {
    await open(p, false);
    check(`375px: no horizontal overflow on ${p}`, await js(`return document.documentElement.scrollWidth<=375`), await js(`return document.documentElement.scrollWidth`));
    await shot('m-' + p.replace(/\W+/g, '_'));
  }
  // 17. Local profile creation, onboarding, measurement conversion, and guest/profile isolation
  await open('#/likes', false); await click('#sel-clr');
  await js(`document.querySelector('[data-sel="gill-os2"]').click()`);
  await click('[data-ws-tab="notes"]');
  await js(`const n=document.querySelector('[data-note="gill-os2"]');if(!n)throw new Error('guest note field unavailable');n.value='Guest-only profile test note';n.dispatchEvent(new Event('input',{bubbles:true}))`);
  const guestIds = await js(`return JSON.parse(localStorage.getItem('marinebuy:likes')||'{"ids":[]}').ids`);
  const guestNote = await js(`return JSON.parse(localStorage.getItem('marinebuy:workspace')||'{"notes":{}}').notes?.['gill-os2']||''`);
  await open('#/account', false);
  check('375px local sign-in page has no horizontal overflow', await js(`return document.documentElement.scrollWidth<=375`));
  await click('[data-account-action="create-mode"]');
  await js(`document.querySelector('#account-name').value='Alex';document.querySelector('#account-name').dispatchEvent(new Event('input',{bubbles:true}))`);
  await click('[data-account-create] button[type="submit"]');
  await wait(300);
  check('new local profile begins five-step onboarding', await js(`return document.querySelector('[data-onboarding]')?.dataset.step==='0'&&document.querySelector('.progress-track')?.getAttribute('aria-valuemax')==='5'`));
  check('375px onboarding page has no horizontal overflow', await js(`return document.documentElement.scrollWidth<=375`));
  await js(`document.querySelector('input[name="activities"][value="coastal"]').click()`);
  await click('.onboarding-actions button[type="submit"]');
  await js(`document.querySelector('#fit-category').value='unisex';document.querySelector('#fit-category').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#usual-size').value='M';document.querySelector('#usual-size').dispatchEvent(new Event('input',{bubbles:true}))`);
  await click('.onboarding-actions button[type="submit"]');
  await js(`for(const [n,v] of Object.entries({height:'180',weight:'80',chest:'100'})){const e=document.querySelector('[name="'+n+'"]');e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))}`);
  await js(`const e=document.querySelector('#length-unit');e.value='in';e.dispatchEvent(new Event('change',{bubbles:true}))`);
  check('changing length unit converts body measures without changing their canonical value', await js(`const a=document.querySelector('[name=height]').value;const d=JSON.parse(localStorage.getItem('marinebuy:local-accounts'));return Math.abs(Number(a)-70.87)<.02&&Math.abs(d.profiles[0].onboarding.data.measurements.heightCm-180)<.01`));
  await js(`const e=document.querySelector('#length-unit');e.value='cm';e.dispatchEvent(new Event('change',{bubbles:true}))`);
  await click('.onboarding-actions button[type="submit"]');
  await js(`document.querySelector('input[name="challenges"][value="chest"]').click()`);
  await click('.onboarding-actions button[type="submit"]');
  await js(`for(const x of ['price','weight','movement'])document.querySelector('input[name="priorities"][value="'+x+'"]').click();document.querySelector('input[name="priorities"][value="weather"]').click();document.querySelector('#preferred-fit').value='relaxed';document.querySelector('#preferred-fit').dispatchEvent(new Event('change',{bubbles:true}))`);
  check('priorities are capped at three and summary is evidence-cautious', await js(`return document.querySelectorAll('input[name=priorities]:checked').length===3&&document.querySelector('.account-alert').textContent.includes('three')&&document.querySelector('.account-summary').textContent.includes('cannot guarantee')`));
  const measurementsSummary = await js(`return document.querySelector('.account-summary').textContent`);
  check('onboarding measurements are explicitly body measurements', measurementsSummary.includes('Height 180 cm')&&measurementsSummary.includes('body measurements'), measurementsSummary);
  await click('.onboarding-actions button[type="submit"]'); await wait(300);
  const profileId = await js(`return JSON.parse(localStorage.getItem('marinebuy:local-accounts')).activeId`);
  check('profile completion opens My profile and does not copy guest Likes by default', await js(`return location.hash==='#/profile'&&document.querySelector('#nav-account').textContent==='My profile'&&document.querySelector('#likes-n').textContent==='0'`));
  await open('#/likes', false);
  check('profile workspace does not expose guest Likes or notes', await js(`return document.querySelectorAll('.lk').length===0&&document.querySelector('#likes-n').textContent==='0'`));
  await open('#/profile', false); await click('[data-account-action="sign-out"]');
  await open('#/likes', false);
  const guestRestored = await js(`return {count:document.querySelector('#likes-n').textContent,notes:JSON.parse(localStorage.getItem('marinebuy:workspace')||'{"notes":{}}').notes}`);
  check('sign out restores guest Likes and notes', Number(guestRestored.count)===guestIds.length&&guestRestored.notes?.['gill-os2']===guestNote, guestRestored);
  await open('#/account', false); await click(`[data-account-action="sign-in"][data-profile-id="${profileId}"]`);
  check('returning sign-in selects the saved profile on this device', await js(`return location.hash==='#/profile'&&document.querySelector('#app').textContent.includes('Alex')`));
  await send('Page.reload'); await wait(700);
  check('active local profile and completed onboarding survive a page refresh', await js(`return document.querySelector('#nav-account').textContent==='My profile'&&document.querySelector('#app').textContent.includes('Onboarding complete')`));
  await click('#nav-account'); await click('[data-account-action="delete-prompt"]');
  check('profile deletion requires explicit confirmation', await js(`return !!document.querySelector('[role=alert]')&&!!document.querySelector('[data-account-action=delete-confirm]')`));
  await click('[data-account-action="delete-cancel"]');
  check('cancel keeps the profile', await js(`return document.querySelector('#app').textContent.includes('Alex')`));
  await click('[data-account-action="sign-out"]'); await open('#/account', false);
  await click('[data-account-action="create-mode"]');
  await js(`document.querySelector('#account-name').value='Casey';document.querySelector('#account-name').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[name=importGuest]').checked=true`);
  await click('[data-account-create] button[type="submit"]'); await wait(250);
  const copiedId = await js(`return JSON.parse(localStorage.getItem('marinebuy:local-accounts')).activeId`);
  const copiedResearch = await js(`return {count:document.querySelector('#likes-n').textContent,notes:JSON.parse(localStorage.getItem('marinebuy:workspace:'+${JSON.stringify(copiedId)})||'{"notes":{}}').notes}`);
  check('guest research is copied only after the explicit import choice', Number(copiedResearch.count)===guestIds.length&&copiedResearch.notes?.['gill-os2']===guestNote, copiedResearch);
  await open('#/profile', false); await click('[data-account-action="delete-prompt"]'); await click('[data-account-action="delete-confirm"]');
  check('confirmed deletion clears only that profile and restores guest data', await js(`return localStorage.getItem('marinebuy:likes:'+${JSON.stringify(copiedId)})===null&&Number(document.querySelector('#likes-n').textContent)===${guestIds.length}`));
  await open('#/account', false);
  check('deleting one profile preserves other saved profiles', await js(`return document.querySelectorAll('[data-account-action=sign-in]').length===1&&document.querySelector('#app').textContent.includes('Alex')`));

  // Broken persisted view settings and denied localStorage must not prevent research.
  await js(`localStorage.setItem('marinebuy:workspace','{malformed')`);
  await open('#/likes',true);
  check('malformed workspace storage resets view safely', await js(`return !!document.querySelector('#research-workspace')&&!document.querySelector('[data-priority][aria-pressed=true]')`));
  await send('Emulation.clearDeviceMetricsOverride');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
  await shot('workspace-light');
  const denied = await send('Page.addScriptToEvaluateOnNewDocument',{source:`Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new Error('Storage blocked for test')}})`});
  await open('#/',true);
  check('blocked localStorage keeps catalog available', (await js(`return document.querySelectorAll('.card').length`))===5);
  await click(btn('gill-os2'));await click(btn('musto-br2'));
  await open('#/likes',false);
  check('blocked storage still supports in-memory likes and default selection', await js(`return document.querySelectorAll('.product-heading').length===2&&document.querySelector('#likes-n').textContent==='2'`));
  await click('[data-priority="price"]');
  check('blocked storage still supports recommendations and truthful persistence status', await js(`return document.querySelector('#recommendations').textContent.includes('$35.00')&&document.querySelector('.saved-locally').textContent.includes('Storage unavailable')`));
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:denied.identifier});
} catch (e) { fail++; console.log('FAIL  (exception)', e.message); }
finally { ws?.close(); chrome.kill(); await wait(300); rmSync(profile, { recursive: true, force: true }); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
