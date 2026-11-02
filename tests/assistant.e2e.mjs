// Browser test for the AI research assistant panel in real headless Chrome.
// /api/research-chat is mocked inside Chrome (DevTools Fetch interception), so no API key or Gemini call is used,
// and the test can inspect exactly what the page sends. Run: npm start (in one terminal), then: npm run test:assistant-e2e
// Env: CHROME=/path/to/chrome, BASE=http://localhost:3000, SHOTS=dir (save screenshots)
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://localhost:3000', SHOTS = process.env.SHOTS, PORT = 9343;
const profile = mkdtempSync(path.join(tmpdir(), 'mb-ai-e2e-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--window-size=1400,1000', 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
async function js(expr) {
  const r = await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`${r.exceptionDetails.exception?.description || r.exceptionDetails.text}\n in: ${expr}`);
  return r.result.value;
}
const click = (sel) => js(`const e=document.querySelector(${JSON.stringify(sel)});if(!e)throw new Error('missing '+${JSON.stringify(sel)});e.click();`).then(() => wait(120));
const until = async (expr, ms = 3000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(`return !!(${expr})`)) return true; await wait(60); } return false; };
const shot = async (name) => { if (!SHOTS) return; mkdirSync(SHOTS, { recursive: true }); const r = await send('Page.captureScreenshot', { captureBeyondViewport: true }); writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64')); };
let pass = 0, fail = 0;
function check(name, ok, detail = '') { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : '  -> ' + JSON.stringify(detail)}`); }

// ---- Mocked server responses ----
const posts = []; let configured = true, hold = null, nextReply = null;
const reply = (body, o = {}) => ({
  answer: 'Gill describes the OS2 as Relaxed on its own scale, so it may offer more room for a fleece according to Gill. That is a brand label, not a measurement, and no size chart is recorded.',
  referencedProductIds: body.productIds, evidenceIds: ['FIT-GILL-SPEC-RELAXED'], highlightRowIds: ['fit'], suggestedPriorities: ['layers'],
  followUpQuestion: 'Do you usually wear a fleece underneath?', followUpOptions: ['Yes, a fleece', 'Just a base layer'], missingInformation: ['Official size charts for the selected jackets'],
  droppedReferences: 0, productIds: body.productIds, priorities: body.priorities, fitFocus: body.fitFocus, provider: 'Google Gemini', model: 'gemini-3.8-flash',
  citations: [{ id: 'FIT-GILL-SPEC-RELAXED', productId: 'gill-os2', label: 'Gill OS2: Gill labels the fit as Relaxed on its own fit scale.', url: 'https://www.gillmarine.com/products/offshore-sailing-jacket-red', kind: 'manufacturer claim', relevance: 'Exact model (brand product page)', review: 'not recorded', checked: '2026-10-15' }],
  ...o,
});
async function onPaused(p) {
  const { requestId, request } = p;
  const fulfill = (status, obj) => send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: Buffer.from(JSON.stringify(obj)).toString('base64') }).catch(() => { /* page already gave up on it */ });
  if (request.url.endsWith('/api/research-chat/status')) return fulfill(200, { configured, provider: 'Google Gemini', model: 'gemini-3.8-flash' });
  const body = JSON.parse(request.postData || '{}'); posts.push(body);
  if (hold) { hold.push(() => fulfill(200, reply(body))); return; }
  if (nextReply) { const [status, obj] = nextReply(body); nextReply = null; return fulfill(status, obj); }
  return fulfill(200, reply(body));
}

try {
  for (let i = 0; i < 50 && !ws; i++) { try { const t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === 'page'); if (t) ws = new WebSocket(t.webSocketDebuggerUrl); } catch { /* starting */ } if (!ws) await wait(200); }
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } else if (d.method === 'Fetch.requestPaused') onPaused(d.params); });
  await send('Page.enable'); await send('Runtime.enable');

  // 1. Real server without a key: honest unavailable state, comparison still works.
  await send('Page.navigate', { url: BASE + '/#/' }); await wait(900);
  await js(`localStorage.clear();localStorage.setItem('marinebuy:likes',JSON.stringify({v:1,ids:['gill-os2','musto-br2','hh-pier4'],sel:['gill-os2','musto-br2'],selectionInitialized:true}));localStorage.setItem('marinebuy:workspace',JSON.stringify({v:1,notes:{'gill-os2':'my private note'}}))`);
  await js(`location.hash='#/likes'`); await send('Page.reload'); await wait(1200);
  check('panel is labelled as an AI research assistant with a privacy note', await js(`const t=document.querySelector('.thinking-panel').textContent;return t.includes('AI RESEARCH ASSISTANT')&&t.includes('An AI (Google Gemini), not a person')&&t.includes('Likes and notes are not sent')`));
  check('unconfigured server: clear message, input disabled', await until(`document.querySelector('.ai-off')&&document.querySelector('#ai-input').disabled`));
  await click('[data-priority="price"]');
  check('without AI, bubbles still highlight rows and rules-based summary still works', await js(`return !!document.querySelector('[data-row="price"].priority-row')&&document.querySelector('#recommendations').textContent.includes('$35.00')&&document.querySelector('.rules-caption').textContent.includes('not AI')`));
  await click('[data-priority="price"]');

  // 2. Mocked, configured assistant.
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/research-chat*', requestStage: 'Request' }] });
  await send('Page.reload'); await wait(1200);
  check('configured: input enabled, no request until the user acts', await js(`return !document.querySelector('#ai-input').disabled&&!document.querySelector('.ai-off')`) && posts.length === 0);
  await click('[data-priority="fit"]');
  check('"Help with fit" reveals the six optional follow-ups immediately', await js(`return [...document.querySelectorAll('[data-fit]')].map(b=>b.textContent.slice(1)).join('|')==='More room at the hips|More room at the chest|Broad shoulders|Sleeve or torso length|Easier movement|Not sure where to start'`));
  check('fit row highlighted immediately, before any AI answer', await js(`return !!document.querySelector('[data-row="fit"].priority-row')`) && posts.length === 0);
  await click('[data-fit="hips"]'); await click('[data-priority="layers"]');
  check('bubble-only guidance: one debounced request for several quick choices', await until(`document.querySelector('.ai-answer')`) && posts.length === 1, posts.length);
  const p0 = posts[0];
  check('request carries only product IDs, priorities, fit focus and an empty message', JSON.stringify(Object.keys(p0).sort()) === JSON.stringify(['fitFocus', 'history', 'message', 'priorities', 'productIds']) && p0.message === '' && JSON.stringify(p0.productIds) === '["gill-os2","musto-br2"]' && JSON.stringify(p0.fitFocus) === '["hips"]' && p0.priorities.includes('layers'), p0);
  check('Likes and private notes are never sent', !JSON.stringify(posts).includes('my private note') && !JSON.stringify(posts).includes('hh-pier4'));
  check('answer is labelled AI, shows follow-up question, options and missing info', await js(`const a=document.querySelector('.ai-answer');return a.textContent.includes('AI · Google Gemini')&&a.textContent.includes('Do you usually wear a fleece underneath?')&&document.querySelectorAll('[data-ai-reply]').length===2&&a.textContent.includes('Official size charts')`));
  check('citation links come from the stored record', await js(`const l=document.querySelector('.ai-sources a');return l.href==='https://www.gillmarine.com/products/offshore-sailing-jacket-red'&&l.rel.includes('noopener')&&document.querySelector('.ai-sources').textContent.includes('manufacturer claim')`));
  check('assistant-mentioned row is marked in the comparison', await js(`return !!document.querySelector('[data-row="fit"].ai-row .ai-match')`));
  await shot('ai-answer');

  // 3. Follow-up option, typed question, suggested priority.
  await click('[data-ai-reply="0"]');
  await until(`document.querySelectorAll('.ai-answer').length===2`);
  check('follow-up option is sent as the user\'s reply, with bounded history', posts.at(-1).message === 'Yes, a fleece' && posts.at(-1).history.length === 2 && posts.at(-1).history[1].role === 'assistant');
  await js(`const t=document.querySelector('#ai-input');t.focus();t.value='Will a fleece fit under the Musto?';t.dispatchEvent(new Event('input',{bubbles:true}))`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  check('typed question sent with Enter', await until(`document.querySelectorAll('.ai-answer').length===3`) && posts.at(-1).message === 'Will a fleece fit under the Musto?');
  check('history stays bounded (≤6 turns)', posts.at(-1).history.length <= 6);
  await click('[data-priority="layers"]'); // deselect so the AI suggestion is offered again
  await until(`document.querySelectorAll('.ai-answer').length===4`);
  check('allowlisted suggested priority is offered as a button', await js(`return !!document.querySelector('[data-ai-priority="layers"]')`));
  const before = posts.length;
  await click('[data-ai-priority="layers"]');
  check('choosing it updates priorities and asks again', await js(`return document.querySelector('[data-priority="layers"]').getAttribute('aria-pressed')==='true'`) && await until(`document.querySelectorAll('.ai-answer').length===5`) && posts.length === before + 1);

  // 4. Hostile model text cannot become markup or links.
  nextReply = (b) => [200, reply(b, { answer: '<img src=x onerror="window.pwned=1">Plain text only', followUpOptions: ['<b>bold</b>'], citations: [{ id: 'X', label: 'bad link', url: 'javascript:alert(1)', kind: 'k', relevance: 'r', review: 'v', checked: 'c' }] })];
  await js(`const t=document.querySelector('#ai-input');t.value='test';t.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#ai-form').requestSubmit()`);
  await until(`document.querySelectorAll('.ai-answer').length===6`); await wait(200);
  check('model text renders as plain text (no HTML, no script, no javascript: link)', await js(`const a=[...document.querySelectorAll('.ai-answer')].at(-1);return !a.querySelector('img,b')&&!window.pwned&&a.textContent.includes('<img src=x')&&!a.querySelector('.ai-sources a')`));

  // 5. Stale responses: change products while a request is in flight.
  hold = [];
  await js(`const t=document.querySelector('#ai-input');t.value='Which has more room?';t.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#ai-form').requestSubmit()`);
  await until(`document.querySelector('.ai-status.loading')`);
  const answersBefore = await js(`return document.querySelectorAll('.ai-answer').length`);
  await click('[data-sel="hh-pier4"]'); await wait(300);
  check('changing products cancels the in-flight question and says why', await js(`return !document.querySelector('.ai-status.loading')&&[...document.querySelectorAll('.ai-notice')].at(-1).textContent.includes('Your comparison changed. Earlier answers were about Gill OS2')`));
  const held = hold; hold = null; held.forEach((f) => f()); await wait(400);
  check('a late answer for the old selection is ignored', (await js(`return document.querySelectorAll('.ai-answer').length`)) === answersBefore);
  check('earlier AI row markers are removed for the new selection', await js(`return !document.querySelector('.ai-row')`));
  await click('#ai-again');
  check('"Ask again" uses the new selection', await until(`document.querySelectorAll('.ai-answer').length===${answersBefore + 1}`) && JSON.stringify(posts.at(-1).productIds) === '["gill-os2","musto-br2","hh-pier4"]');
  // Changing priorities mid-flight also supersedes the old request.
  hold = [];
  await click('[data-fit="chest"]'); await wait(900);
  await click('[data-fit="chest"]'); await wait(900);
  const h2 = hold; hold = null; h2.forEach((f) => f()); await wait(400);
  check('priority changes mid-request: only the latest request can answer', (await js(`return document.querySelectorAll('.ai-answer').length`)) <= answersBefore + 2 && JSON.stringify(posts.at(-1).fitFocus) === '["hips"]');

  // 6. Errors keep the page usable.
  nextReply = () => [429, { error: 'quota', message: 'The AI service has reached its usage limit for now. Please try again later; the comparison still works.' }];
  await js(`const t=document.querySelector('#ai-input');t.value='Anything else?';t.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#ai-form').requestSubmit()`);
  check('quota error is shown with a retry, comparison still usable', await until(`document.querySelector('.ai-status.error #ai-retry')`) && await js(`return document.querySelector('.ai-status').textContent.includes('usage limit')&&document.querySelectorAll('.product-heading').length===3`));
  await click('#ai-retry');
  check('retry succeeds', await until(`!document.querySelector('.ai-status.error')&&!document.querySelector('.ai-status.loading')`));

  // 7. Optional measurements: session-only by default, explicit save, never in the URL.
  await js(`document.querySelector('[data-disclosure="ai-measure"]').open=true;document.querySelector('[data-measure="chest"]').value='104';document.querySelector('[data-measure="hips"]').value='112'`);
  await click('#ai-measure-use');
  check('measurements used for this visit only by default', await js(`return !localStorage.getItem('marinebuy:fit-profile')&&document.querySelector('#ai-measure-status').textContent.includes('this visit only')`));
  await js(`const t=document.querySelector('#ai-input');t.value='Sizes?';t.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#ai-form').requestSubmit()`);
  await until(`!document.querySelector('.ai-status.loading')`); await wait(200);
  check('measurements sent in the request body, never in the URL', JSON.stringify(posts.at(-1).measurements) === '{"unit":"cm","chest":104,"hips":112}' && !(await js(`return location.href`)).includes('104'));
  await js(`document.querySelector('[data-disclosure="ai-measure"]').open=true;document.querySelector('#ai-remember').checked=true`);
  await click('#ai-measure-use');
  check('"Remember on this device" saves only after explicit choice', await js(`return JSON.parse(localStorage.getItem('marinebuy:fit-profile')).chest===104`));
  await js(`document.querySelector('[data-disclosure="ai-measure"]').open=true`); await click('#ai-measure-forget');
  check('"Forget measurements" removes them', await js(`return !localStorage.getItem('marinebuy:fit-profile')`));

  // 8. Clear conversation, persistence of Likes/notes/priorities, no key in the page.
  await click('#ai-clear');
  check('Clear conversation empties the thread', await js(`return !document.querySelector('.ai-answer')&&!document.querySelector('.ai-user')`));
  await send('Page.reload'); await wait(1200);
  check('after refresh: Likes, selection, notes and priorities intact; conversation not stored', await js(`const w=JSON.parse(localStorage.getItem('marinebuy:workspace'));return document.querySelector('#likes-n').textContent==='3'&&document.querySelectorAll('.product-heading').length===3&&w.notes['gill-os2']==='my private note'&&w.priorities.includes('fit')&&!document.querySelector('.ai-answer')&&!JSON.stringify(localStorage).includes('Relaxed on its own scale')`));
  check('no API key or Gemini endpoint in the page', await js(`return !/GEMINI_API_KEY|AIza[0-9A-Za-z_-]{20}|generativelanguage/.test(document.documentElement.outerHTML)`));

  // 9. Keyboard and mobile.
  await js(`document.querySelector('[data-priority="weight"]').focus()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await wait(200);
  check('keyboard toggles a bubble and keeps focus on it', await js(`const b=document.querySelector('[data-priority="weight"]');return b.getAttribute('aria-pressed')==='true'&&document.activeElement===b`));
  await until(`document.querySelector('.ai-answer')`);
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 2, mobile: true }); await wait(400);
  check('375px: assistant panel fits without page overflow', await js(`return document.documentElement.scrollWidth<=375&&document.querySelector('.thinking-panel').getBoundingClientRect().width<=375`), await js(`return document.documentElement.scrollWidth`));
  await shot('ai-mobile');
} catch (e) { fail++; console.log('FAIL  (exception)', e.message); }
finally { ws?.close(); chrome.kill(); await wait(300); rmSync(profile, { recursive: true, force: true }); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
