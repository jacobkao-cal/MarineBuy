// AI research assistant panel (browser side). Talks only to our own server (POST /api/research-chat); the server calls
// Google Gemini. The conversation lives in memory for this visit. Likes and notes are never sent.
// Body measurements are optional, kept in memory unless the user explicitly chooses "Remember on this device",
// and never put in URLs. Everything shown from the model is plain text; links come from stored citations only.
import { PRIORITIES, FIT_FOCUS } from './research.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s) => document.querySelector(s);
const PROFILE_KEY = 'marinebuy:fit-profile', MAX_MESSAGE = 500, HISTORY = 6, DEBOUNCE = 700;
const PR = (id) => PRIORITIES.find((p) => p.id === id) || FIT_FOCUS.find((f) => f.id === id);

let hooks = null, config = null, turns = [], status = { kind: 'idle', text: '' }, draft = '';
let seq = 0, ctrl = null, timer = null, lastSelection = null, measure = null, remember = false;

export function init(h) {
  hooks = h;
  try { const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); if (saved && ['cm', 'in'].includes(saved.unit)) { measure = { ...saved, use: true }; remember = true; } } catch { /* storage blocked or malformed */ }
  fetch('/api/research-chat/status').then((r) => r.json()).then((c) => { config = c; render(); }).catch(() => { config = { configured: false, unreachable: true }; render(); });
}
/** Row IDs the latest answer pointed to (only while it still describes the current selection). */
export function highlighted() {
  const last = [...turns].reverse().find((t) => t.role === 'assistant');
  return last && same(last.data.productIds, hooks.state().productIds) ? last.data.highlightRowIds : [];
}
const same = (a = [], b = []) => a.length === b.length && a.every((x, i) => x === b[i]);
const names = (ids) => ids.map(hooks.name).join(', ');

/** Called on every workspace render. A different product selection makes in-flight answers stale. */
export function syncSelection() {
  const now = hooks.state().productIds;
  if (lastSelection && !same(lastSelection, now)) {
    if (ctrl) { ctrl.abort(); ctrl = null; seq++; status = { kind: 'idle', text: '' }; }
    clearTimeout(timer);
    if (turns.length) turns.push({ role: 'notice', text: `Your comparison changed. Earlier answers were about ${names(lastSelection) || 'a different selection'}.`, offerRetry: now.length > 0 });
  }
  lastSelection = now;
}
/** A bubble changed: rows were already highlighted by the workspace; ask for guidance after a short pause. */
export function prioritiesChanged() {
  if (ctrl) { ctrl.abort(); ctrl = null; seq++; status = { kind: 'idle', text: '' }; }
  clearTimeout(timer);
  const s = hooks.state();
  if (!s.priorities.length) { render(); return; }
  timer = setTimeout(() => ask({}), DEBOUNCE);
}
function describe(s) {
  return 'Priorities: ' + s.priorities.map((id) => PR(id).label + (id === 'fit' && s.fitFocus.length ? ` (${s.fitFocus.map((f) => PR(f).label.toLowerCase()).join(', ')})` : '')).join('; ');
}
async function ask({ message = '' }) {
  clearTimeout(timer);
  const s = hooks.state();
  if (!config?.configured) { render(); return; }
  if (!s.productIds.length) { status = { kind: 'error', text: 'Select at least one jacket in My options so the assistant knows what to look at.' }; render(); return; }
  if (!message && !s.priorities.length) return;
  if (ctrl) ctrl.abort();
  const my = ++seq; ctrl = new AbortController();
  const history = turns.filter((t) => t.role === 'user' || t.role === 'assistant').slice(-HISTORY).map((t) => ({ role: t.role, text: t.role === 'user' ? t.text : t.data.answer }));
  turns.push({ role: 'user', text: message || describe(s), typed: !!message });
  status = { kind: 'loading', text: 'Looking through the research for your selected jackets…' };
  render();
  const body = { productIds: s.productIds, priorities: s.priorities, fitFocus: s.fitFocus, message, history };
  if (measure?.use) body.measurements = pickMeasure(measure);
  try {
    const r = await fetch('/api/research-chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    if (my !== seq) return; // superseded by a newer question or a selection change
    ctrl = null;
    if (!r.ok) { status = { kind: 'error', text: j.message || 'The assistant could not answer right now.', retry: j.error !== 'invalid_request' && j.error !== 'not_configured', message }; render(); return; }
    if (!same(j.productIds, hooks.state().productIds)) { status = { kind: 'idle', text: '' }; render(); return; } // answer is for an old selection
    turns.push({ role: 'assistant', data: j });
    status = { kind: 'idle', text: '' };
    hooks.onAnswer();
    render();
    hooks.live('The AI research assistant answered.');
  } catch (e) {
    if (e.name === 'AbortError' || my !== seq) return;
    ctrl = null;
    status = { kind: 'error', text: 'Could not reach the Marine Buy server. Check your connection and try again.', retry: true, message };
    render();
  }
}
const pickMeasure = (m) => Object.fromEntries(Object.entries(m).filter(([k, v]) => k === 'unit' || (['chest', 'waist', 'hips', 'height'].includes(k) && Number.isFinite(v))));

function citation(c) {
  const link = /^https:\/\//.test(c.url) ? `<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.label)}<span class="vh"> (opens in a new tab)</span></a>` : esc(c.label);
  return `<li>${link}<span class="cell-meta">${esc(c.kind)} · ${esc(/^RELATED/i.test(c.relevance) ? 'Related model: ' + c.relevance.replace(/^RELATED MODEL:\s*/i, '') : c.relevance)} · ${esc(c.review)} · checked ${esc(c.checked)}</span></li>`;
}
function answer(t, latest) {
  const d = t.data, sel = hooks.state();
  const suggestions = latest ? d.suggestedPriorities.filter((id) => PR(id) && !(sel.priorities.includes(id) || sel.fitFocus.includes(id))) : [];
  return `<article class="ai-answer" aria-label="AI research assistant answer">
    <span class="ai-badge">AI · Google Gemini</span>
    ${d.answer.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join('')}
    ${d.followUpQuestion ? `<p class="ai-question">${esc(d.followUpQuestion)}</p>` : ''}
    ${latest && d.followUpOptions.length ? `<div class="ai-options" role="group" aria-label="Quick replies">${d.followUpOptions.map((o, i) => `<button type="button" data-ai-reply="${i}">${esc(o)}</button>`).join('')}<button type="button" data-ai-skip>Skip</button></div>` : ''}
    ${suggestions.length ? `<div class="ai-options" role="group" aria-label="Suggested priorities">${suggestions.map((id) => `<button type="button" data-ai-priority="${esc(id)}">＋ ${esc(PR(id).label)}</button>`).join('')}</div>` : ''}
    ${d.missingInformation.length ? `<div class="ai-missing"><strong>Missing information</strong><ul>${d.missingInformation.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div>` : ''}
    ${d.citations.length ? `<details class="ai-sources"${latest ? ' open' : ''}><summary>Evidence used (${d.citations.length})</summary><ul>${d.citations.map(citation).join('')}</ul></details>` : '<p class="cell-meta">No stored evidence was cited for this answer.</p>'}
    ${d.droppedReferences ? `<p class="cell-meta">${d.droppedReferences} reference${d.droppedReferences === 1 ? '' : 's'} the AI gave could not be matched to stored research and ${d.droppedReferences === 1 ? 'was' : 'were'} removed.</p>` : ''}
  </article>`;
}
function measurementForm() {
  const m = measure || { unit: 'cm' }, f = (k, l) => `<label>${l}<input type="number" inputmode="decimal" step="0.5" min="0" data-measure="${k}" value="${Number.isFinite(m[k]) ? m[k] : ''}"></label>`;
  return `<details class="ai-measure" data-disclosure="ai-measure"><summary>Add body measurements <span>Optional</span></summary>
    <p class="cell-meta">Official size charts are written in body measurements, so chest, waist and hip measurements can help more than height or weight. No size charts are recorded for these jackets yet, so the assistant can only explain what to check. You can skip this.</p>
    <div class="ai-measure-grid"><label>Units<select data-measure="unit"><option value="cm"${m.unit === 'cm' ? ' selected' : ''}>cm</option><option value="in"${m.unit === 'in' ? ' selected' : ''}>inches</option></select></label>${f('chest', 'Chest')}${f('waist', 'Waist')}${f('hips', 'Hips')}${f('height', 'Height')}</div>
    <label class="ck"><input type="checkbox" id="ai-remember"${remember ? ' checked' : ''}>Remember on this device</label>
    <div class="ai-measure-actions"><button type="button" class="btn" id="ai-measure-use">${measure?.use ? 'Update measurements' : 'Use for this visit'}</button>${measure ? '<button type="button" class="text-button" id="ai-measure-forget">Forget measurements</button>' : ''}</div>
    <p class="cell-meta" id="ai-measure-status" role="status">${measure?.use ? (remember ? 'Saved on this device and shared with the assistant when you ask.' : 'Shared with the assistant for this visit only; not saved.') : 'Not shared.'}</p></details>`;
}
export function render() {
  const el = $('#assistant'); if (!el || !hooks) return;
  const latestIdx = turns.map((t) => t.role).lastIndexOf('assistant');
  const off = config && !config.configured;
  el.innerHTML = `
    ${off ? `<div class="ai-off" role="note"><strong>The AI assistant is not available.</strong> ${config.unreachable ? 'The server could not be reached.' : 'It has not been configured on this server.'} Bubbles still highlight the comparison, and the recorded-research summaries below still work.</div>` : ''}
    <div class="ai-thread" role="log" aria-live="polite" aria-label="Conversation with the AI research assistant">${turns.map((t, i) => t.role === 'user'
      ? `<p class="ai-user"><span class="vh">You: </span>${esc(t.text)}</p>`
      : t.role === 'notice' ? `<p class="ai-notice">${esc(t.text)}${t.offerRetry && i === turns.length - 1 && hooks.state().priorities.length ? ' <button type="button" class="text-button" id="ai-again">Ask again for this selection</button>' : ''}</p>`
      : answer(t, i === latestIdx)).join('')}</div>
    <p class="ai-status ${status.kind}" role="status">${status.kind === 'loading' ? '<span class="ai-spinner" aria-hidden="true"></span>' : ''}${esc(status.text)}${status.retry ? ' <button type="button" class="text-button" id="ai-retry">Try again</button>' : ''}</p>
    <form id="ai-form" class="ai-form"><label for="ai-input">Ask a question <span>(optional)</span></label><div><textarea id="ai-input" maxlength="${MAX_MESSAGE}" rows="2" placeholder="e.g. Will I have room for a fleece?"${off ? ' disabled' : ''}>${esc(draft)}</textarea><button type="submit" class="btn p"${off ? ' disabled' : ''}>Ask</button></div></form>
    ${measurementForm()}
    ${turns.length ? '<button type="button" class="text-button" id="ai-clear">Clear conversation</button>' : ''}`;
}
function readMeasure() {
  const m = { unit: $('[data-measure="unit"]').value };
  document.querySelectorAll('input[data-measure]').forEach((i) => { const v = parseFloat(i.value); if (Number.isFinite(v) && v > 0) m[i.dataset.measure] = v; });
  return m;
}
export function start() {
  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'ai-form') return;
    e.preventDefault();
    const text = $('#ai-input').value.trim().slice(0, MAX_MESSAGE);
    if (!text) { status = { kind: 'error', text: 'Type a question, or choose a priority above.' }; render(); $('#ai-input')?.focus(); return; }
    draft = ''; ask({ message: text }).then(() => {});
    $('#ai-input')?.focus();
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'ai-input') draft = e.target.value; });
  document.addEventListener('keydown', (e) => { if (e.target.id === 'ai-input' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.form.requestSubmit(); } });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#assistant button'); if (!b) return;
    const latest = [...turns].reverse().find((t) => t.role === 'assistant');
    if (b.dataset.aiReply != null && latest) { const text = latest.data.followUpOptions[+b.dataset.aiReply]; if (text) ask({ message: text }); }
    else if ('aiSkip' in b.dataset && latest) { latest.data.followUpOptions = []; latest.data.followUpQuestion = ''; render(); $('#ai-input')?.focus(); }
    else if (b.dataset.aiPriority && PR(b.dataset.aiPriority)) hooks.addPriority(b.dataset.aiPriority); // allowlisted IDs only
    else if (b.id === 'ai-clear') { if (ctrl) ctrl.abort(); ctrl = null; seq++; turns = []; status = { kind: 'idle', text: '' }; hooks.onAnswer(); render(); hooks.live('Conversation cleared.'); $('#ai-input')?.focus(); }
    else if (b.id === 'ai-retry') { const m = status.message || ''; if (turns.at(-1)?.role === 'user') turns.pop(); ask({ message: m }); }
    else if (b.id === 'ai-again') ask({});
    else if (b.id === 'ai-measure-use') {
      const m = readMeasure(), any = ['chest', 'waist', 'hips', 'height'].some((k) => k in m);
      remember = $('#ai-remember').checked;
      measure = any ? { ...m, use: true } : null;
      try { if (measure && remember) localStorage.setItem(PROFILE_KEY, JSON.stringify(pickMeasure(measure))); else localStorage.removeItem(PROFILE_KEY); } catch { remember = false; }
      render(); $('[data-disclosure="ai-measure"]').open = true; $('#ai-measure-use')?.focus();
      hooks.live(any ? 'Measurements will be shared with the assistant when you ask.' : 'No measurements entered.');
    } else if (b.id === 'ai-measure-forget') {
      measure = null; remember = false; try { localStorage.removeItem(PROFILE_KEY); } catch { /* ignore */ }
      render(); $('[data-disclosure="ai-measure"]').open = true; $('#ai-measure-use')?.focus(); hooks.live('Measurements forgotten.');
    }
  });
}
