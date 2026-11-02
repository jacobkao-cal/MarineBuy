import * as Likes from './likes.js';
import * as State from './workspace-state.js';
import * as Assistant from './assistant.js';
import { ROWS, PRIORITIES, FIT_FOCUS, name, checkedOffer, money, rowValue, visibleRows, relevantRows, suggestion } from './research.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const external = (url, label) => /^https?:\/\//.test(url || '') ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}<span class="vh"> (opens in a new tab)</span> ↗</a>` : esc(label);
let ctx, initialized = false;
const $ = s => document.querySelector(s);
const selected = () => Likes.selected().map(id => ctx.products.find(p => p.id === id)).filter(Boolean);
const detail = p => ctx.url(ctx.route, '/p/' + p.id);
const browse = () => ctx.url(ctx.route, '/');
function badgePrice(p) { const o = checkedOffer(p, ctx.offers); return o ? money(o.price, o.currency).replace('.00', '') : 'Check price at retailer'; }
function option(p) {
  const on = Likes.isSelected(p.id), full = Likes.selected().length >= 4, o = ctx.offers.find(o => o.p === p.id);
  return `<li class="lk option" data-on="${+on}"><div class="option-image">${ctx.photo(p)}</div><div class="option-info"><span class="eyebrow">${esc(p.brand)}</span><h3 class="lk-t"><a href="${detail(p)}">${esc(p.name)}</a></h3><span class="option-price">${badgePrice(p)}</span><div class="option-controls"><label class="ck"><input type="checkbox" data-sel="${p.id}"${on ? ' checked' : ''}${!on && full ? ' disabled' : ''}><span>${on ? 'Comparing' : 'Compare'}<span class="vh"> ${esc(name(p))}</span></span></label><button class="icon-button" type="button" data-unlike="${p.id}" aria-label="Remove ${esc(name(p))} from My Likes">×</button></div>${o ? `<span class="option-shop">${external(o.url, 'Retailer')}</span>` : ''}</div></li>`;
}
function productHead(p) {
  return `<th scope="col" class="product-heading"><div class="product-photo">${ctx.gallery(p)}</div><div class="product-title"><span class="eyebrow">${esc(p.brand)}</span><h3><a href="${detail(p)}">${esc(p.name)}</a></h3></div><div class="product-actions">${ctx.likeBtn(p.id)}<button class="text-button" type="button" data-ws-remove="${p.id}">Remove from comparison<span class="vh">: ${esc(name(p))}</span></button></div></th>`;
}
function cell(p, id) {
  if (id === 'price') {
    const o = checkedOffer(p, ctx.offers), offers = ctx.offers.filter(o => o.p === p.id);
    return `${o ? `<strong class="compare-price">${esc(money(o.price, o.currency))}</strong><span class="cell-meta">${esc(o.ret)} · checked ${esc(ctx.fmtD(o.chk))}</span>` : '<strong>Not provided</strong><span class="cell-meta">Check price at retailer</span>'}${offers.map(o => `<span class="cell-meta">${external(o.url, 'View at ' + o.ret)}${o.link ? `<span class="link-context">${esc(o.link)}</span>` : ''}</span>`).join('')}`;
  }
  if (id === 'hood') return `<span>${esc(p.spec?.hood || 'Not provided')}</span><span class="cell-meta">Collar: ${esc(p.spec?.collar || 'Not provided')}<br>Cuffs: ${esc(p.spec?.cuffs || 'Not provided')}</span>`;
  return esc(rowValue(p, id, ctx.offers));
}
function rowsHTML(L) {
  const settings = State.get(), relevant = relevantRows(settings.priorities), rows = visibleRows(L, settings.priorities, settings, ctx.offers), ai = Assistant.highlighted();
  return rows.length ? rows.map(r => `<tr data-row="${r.id}" class="${relevant.includes(r.id) ? 'priority-row' : ''}${ai.includes(r.id) ? ' ai-row' : ''}"><th scope="row">${r.label}${relevant.includes(r.id) ? '<span class="row-match">Your priority</span>' : ''}${ai.includes(r.id) ? '<span class="row-match ai-match">Mentioned by the assistant</span>' : ''}</th>${L.map(p => `<td>${cell(p, r.id)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${L.length + 1}" class="table-empty">No visible differences in these rows. Choose more rows or turn off “Show differences only”.</td></tr>`;
}
function noteCard(p) {
  return `<div class="note-card"><label for="note-${p.id}"><strong>${esc(name(p))}</strong><span>Why I’m considering this</span></label><textarea id="note-${p.id}" data-note="${p.id}" maxlength="2000" rows="3" placeholder="The details that matter to me…">${esc(State.get().notes[p.id] || '')}</textarea></div>`;
}
function research(L) {
  return L.map(p => `<details class="research-product" data-disclosure="research-${p.id}"><summary>${esc(name(p))} · Specs &amp; sources</summary><table><tbody>${ROWS.filter(r => !['price', 'use'].includes(r.id)).map(r => `<tr><th scope="row">${r.label}</th><td>${cell(p, r.id)}</td></tr>`).join('')}</tbody></table><p class="mu">Specification source: ${p.specSrc ? external(p.specSrc, 'Exact model specifications') : 'Not provided'}. Brand claims are not independent proof.</p>${ctx.sourceBlock(p.id)}<p><a href="${detail(p)}">Open full product research →</a></p></details>`).join('');
}
function videos(L) {
  return L.map(p => { const v = ctx.videos.filter(v => v.p === p.id); return `<section class="video-research"><h3>${esc(name(p))}</h3>${v.length ? v.map(v => `<p>${external(v.url, v.title)}<span class="cell-meta">${esc(v.channel)} · ${esc(v.rel)} · checked ${esc(v.checked)}</span></p>`).join('') : '<p class="mu">No verified YouTube review for this exact model yet.</p>'}<a href="${detail(p)}">View product research →</a></section>`; }).join('');
}
function compareBody() {
  const L = selected(), s = State.get();
  const hint = !L.length ? 'Select 2–4 jackets from My options to begin.' : L.length === 1 ? 'Select 1 more jacket to compare. Your selected jacket stays here.' : `${L.length} selected · ${L.length === 4 ? 'Unselect one to choose another.' : 'Compare up to 4 jackets.'}`;
  $('#lk-hint').textContent = hint;
  $('#selected-count').textContent = `${L.length} selected`;
  const tabs = [['overview', 'Overview'], ['research', 'Specs & sources'], ['videos', 'Videos'], ['notes', 'My notes']];
  $('#workspace-tabs').innerHTML = tabs.map(([id, label]) => `<button type="button" id="tab-${id}" data-ws-tab="${id}" aria-pressed="${s.tab === id}">${label}</button>`).join('');
  $('#compare-content').innerHTML = !L.length ? '<div class="empty research-empty">Your comparison starts here. Choose jackets using the Compare checkboxes in My options.</div>' : `
    <div class="comparison-scroll" role="region" aria-label="Selected jackets and comparison; scroll horizontally for more products" tabindex="0"><table class="research-table" style="--products:${L.length};min-width:${110 + L.length * 220}px"><colgroup><col class="row-label">${L.map(() => '<col>').join('')}</colgroup><thead><tr><td class="photo-label"><span class="eyebrow">YOUR<br>SHORTLIST</span></td>${L.map(productHead).join('')}</tr></thead><tbody id="comparison-rows">${s.tab === 'overview' ? rowsHTML(L) : ''}</tbody></table></div>
    <div id="tab-content">${s.tab === 'research' ? research(L) : s.tab === 'videos' ? videos(L) : s.tab === 'notes' ? `<div class="notes-grid">${L.map(noteCard).join('')}</div><p class="mu">Private to this browser. Notes are never included in shared links.</p>` : `<p class="comparison-caption">Read the differences in context. “Not provided” means unknown, not worse.</p><details data-disclosure="notes"><summary>Add your thoughts <span>Private notes for each jacket</span></summary><div class="notes-grid">${L.map(noteCard).join('')}</div></details><details data-disclosure="sources"><summary>Dig a little deeper <span>Detailed specifications, reviews &amp; sources</span></summary>${research(L)}</details>`}</div>`;
  $('#comparison-tools').hidden = s.tab !== 'overview';
  $('#workspace-share').innerHTML = `<button type="button" class="btn" id="cmp-go"${L.length < 2 ? ' disabled aria-describedby="lk-hint"' : ''}>Compare selected (${L.length})</button><button type="button" class="text-button" id="workspace-copy"${L.length < 2 ? ' disabled' : ''}>Copy shareable link</button><span class="mu" id="workspace-copy-status" role="status"></span>`;
}
function recommendations() {
  const s = State.get(), L = selected();
  $('#priority-bubbles').innerHTML = PRIORITIES.map(p => `<button type="button" data-priority="${p.id}" aria-pressed="${s.priorities.includes(p.id)}"><span class="bubble-check" aria-hidden="true">${s.priorities.includes(p.id) ? '✓' : '+'}</span>${p.label}</button>`).join('');
  $('#fit-focus').hidden = !s.priorities.includes('fit');
  $('#fit-focus').innerHTML = s.priorities.includes('fit') ? `<p class="fit-focus-q" id="fit-focus-q">Where would better fit help? <span>Optional · choose any</span></p><div class="priority-bubbles" role="group" aria-labelledby="fit-focus-q">${FIT_FOCUS.map(f => `<button type="button" data-fit="${f.id}" aria-pressed="${s.fitFocus.includes(f.id)}"><span class="bubble-check" aria-hidden="true">${s.fitFocus.includes(f.id) ? '✓' : '+'}</span>${f.label}</button>`).join('')}</div>` : '';
  $('#recommendations').innerHTML = s.priorities.length ? `${s.priorities.length > 1 ? '<p class="tradeoff-note">Consider these priorities together. Each suggestion uses its own evidence; there is no combined ranking.</p>' : ''}${s.priorities.map(id => {
    const r = suggestion(L, id, ctx.offers), next = PRIORITIES.find(p => p.id === r.next);
    return `<article class="suggestion"><span class="suggestion-priority">${esc(r.title)}</span><p>${esc(r.text)}</p>${r.basis ? `<p class="suggestion-basis">${esc(r.basis)}</p>` : ''}<p class="mu">${esc(r.caveat)}</p><details data-disclosure="why-${id}"><summary>Why this suggestion?</summary><p class="mu">Based only on the selected models and the stored research. No live research or overall score is used.</p>${r.evidence.length ? `<ul>${r.evidence.map(e => `<li>${external(e.url, e.label)}</li>`).join('')}</ul>` : '<p class="mu">No comparable published evidence is available for this priority.</p>'}</details>${next && !s.priorities.includes(next.id) ? `<button type="button" class="followup" data-followup="${next.id}">Consider ${next.label.toLowerCase()} <span aria-hidden="true">→</span></button>` : ''}</article>`;
  }).join('')}` : `<div class="thought-starter"><span class="thought-icon" aria-hidden="true">✧</span><p>You don’t need the “best” jacket.<br>Start with what your sailing days actually look like.</p><span class="mu">Choose a priority above to see what the research can tell you.</span></div>`;
}
// Keep keyboard focus, disclosures, and horizontal/vertical reading positions during selection changes.
function preserve(fn, target) {
  const a = document.activeElement, attrs = ['data-priority', 'data-fit', 'data-ai-priority', 'data-followup', 'data-row-toggle', 'data-ws-tab', 'data-ws-remove', 'data-sel', 'data-unlike', 'data-like'];
  const attr = attrs.find(k => a?.hasAttribute(k));
  const selector = target || (attr ? `[${attr}="${CSS.escape(a.getAttribute(attr))}"]` : a?.id ? '#' + CSS.escape(a.id) : null);
  const top = scrollY, left = $('.comparison-scroll')?.scrollLeft || 0;
  const disclosures = new Map([...document.querySelectorAll('[data-disclosure]')].map(d => [d.dataset.disclosure, d.open]));
  fn();
  document.querySelectorAll('[data-disclosure]').forEach(d => { if (disclosures.has(d.dataset.disclosure)) d.open = disclosures.get(d.dataset.disclosure); });
  if ($('.comparison-scroll')) $('.comparison-scroll').scrollLeft = left;
  if (selector) { const f = $(selector); (f && !f.disabled ? f : $('#lk-h'))?.focus({ preventScroll: true }); }
  scrollTo(0, top);
}
function refreshPriorities(target) {
  preserve(() => { if (State.get().tab !== 'overview') { State.set({ tab: 'overview' }); compareBody(); } if ($('#comparison-rows') && State.get().tab === 'overview') $('#comparison-rows').innerHTML = rowsHTML(selected()); recommendations(); }, target);
  ctx.live(State.get().priorities.length ? 'Priorities updated. Relevant comparison rows are highlighted and suggestions updated.' : 'Priorities cleared. All selected specification rows restored.');
}
// Model-suggested priority: only IDs from PRIORITIES / FIT_FOCUS are accepted (checked again here).
function addPriority(id) {
  const s = State.get();
  if (PRIORITIES.some(p => p.id === id) && !s.priorities.includes(id)) State.set({ priorities: [...s.priorities, id] });
  else if (FIT_FOCUS.some(f => f.id === id)) State.set({ priorities: s.priorities.includes('fit') ? s.priorities : [...s.priorities, 'fit'], fitFocus: s.fitFocus.includes(id) ? s.fitFocus : [...s.fitFocus, id] });
  else return;
  refreshPriorities(`[data-${PRIORITIES.some(p => p.id === id) ? 'priority' : 'fit'}="${id}"]`); Assistant.prioritiesChanged();
}
export function refresh(target) {
  if (!ctx || !$('#research-workspace')) return;
  preserve(() => mount(ctx), target);
}
export function mount(context) {
  ctx = context;
  if (!initialized) {
    State.load(id => ctx.products.some(p => p.id === id)); initialized = true;
    Assistant.init({
      state: () => ({ productIds: selected().map(p => p.id), priorities: State.get().priorities, fitFocus: State.get().fitFocus }),
      name: id => { const p = ctx.products.find(x => x.id === id); return p ? name(p) : id; },
      onAnswer: () => { if ($('#comparison-rows') && State.get().tab === 'overview') preserve(() => { $('#comparison-rows').innerHTML = rowsHTML(selected()); }); },
      addPriority: id => addPriority(id),
      live: m => ctx.live(m),
    });
  }
  const L = Likes.list().map(id => ctx.products.find(p => p.id === id)).filter(Boolean), s = State.get();
  const clear = ctx.confirmClear() ? `<p role="alert">Remove all ${L.length} jackets from My Likes? This clears your Likes and selection.</p><button class="btn danger" id="rs-yes">Yes, clear My Likes</button><button class="btn" id="rs-no">Cancel</button>` : '<button type="button" class="text-button" id="rs">Clear all Likes…</button>';
  $('#app').innerHTML = `<div id="research-workspace"><div class="workspace-intro"><div><a class="back-link" href="${browse()}">← All jackets</a><h1 id="lk-h" tabindex="-1">Your next jacket, clearer.</h1><p class="lk-sub">Your shortlist. Your research. Your decision.</p></div><span class="saved-locally">✓ ${Likes.available() && State.persisted() ? 'Research saved on this device' : 'Storage unavailable · changes last for this visit'}</span></div>
    <div class="research-layout"><aside class="options-panel"><details id="saved-options"${s.optionsOpen ? ' open' : ''}><summary><span>My options <span class="count-pill">${L.length}</span></span></summary><p class="mu options-hint">Choose 2–4 to research.</p>${L.length ? `<ul class="lk-list">${L.map(option).join('')}</ul>` : '<div class="empty lk-empty"><strong>You haven’t liked any jackets yet.</strong><p>Select Like on a jacket to save it here.</p><a href="' + browse() + '">Browse sailing jackets →</a></div>'}<a class="btn explore-jackets" href="${browse()}">＋ Explore more jackets</a>${L.length ? `<div class="options-footer"><button type="button" class="text-button" id="sel-clr">Clear selection</button>${clear}</div>` : ''}</details><p class="private-caption">${ctx.heart} Private to this browser</p></aside>
    <section class="compare-panel" aria-labelledby="compare-title"><div class="panel-heading"><div><span class="eyebrow">A CLOSER LOOK</span><h2 id="compare-title">Your research</h2></div><span class="count-pill" id="selected-count"></span></div><p class="mu" id="lk-hint" role="status"></p><div class="workspace-tabs" id="workspace-tabs" role="group" aria-label="Research view"></div><div id="comparison-tools" class="comparison-tools"><label class="ck"><input type="checkbox" id="differences-only"${s.differences ? ' checked' : ''}>Show differences only</label><details data-disclosure="row-chooser" class="row-chooser"><summary>Choose rows</summary><div>${ROWS.map(r => `<label class="ck"><input type="checkbox" data-row-toggle="${r.id}"${s.rows.includes(r.id) ? ' checked' : ''}>${r.label}</label>`).join('')}<p class="mu">Priority rows stay visible while selected.</p></div></details></div><div id="compare-content"></div><div id="workspace-share" class="workspace-share"></div></section>
    <aside class="thinking-panel" aria-labelledby="thinking-title"><span class="eyebrow">AI RESEARCH ASSISTANT</span><h2 id="thinking-title">Think it through</h2><p class="thinking-sub">What matters most to you?</p><div id="priority-bubbles" class="priority-bubbles" role="group" aria-label="Your priorities"></div><div id="fit-focus" class="fit-focus" hidden></div><button type="button" class="text-button" id="clear-priorities">Clear priorities</button>
    <p class="ai-privacy">An AI (Google Gemini), not a person or an owner of these jackets. Your questions, priorities, any measurements you add, and the stored research for your selected jackets are sent to Google to answer. Likes and notes are not sent.</p>
    <div id="assistant" class="assistant"></div>
    <section class="rules-fallback" aria-labelledby="rules-title"><h3 id="rules-title">From the recorded research</h3><p class="rules-caption">Rules-based summaries, not AI. They use only the stored research and stay available if the assistant is offline.</p><div id="recommendations" aria-label="Rules-based suggestions for your priorities"></div></section></aside></div></div>`;
  $('#app').classList.add('workspace-main');
  compareBody(); recommendations(); Assistant.syncSelection(); Assistant.render();
  $('#saved-options').addEventListener('toggle', e => { if (e.target.open !== State.get().optionsOpen) State.set({ optionsOpen: e.target.open }); }); // details fires toggle on every render; save only real changes
}
export function start() {
  Assistant.start();
  document.addEventListener('click', async e => {
    if (!e.target.closest('#research-workspace')) return;
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.priority || d.followup) {
      const id = d.priority || d.followup, values = State.get().priorities, on = !values.includes(id);
      State.set({ priorities: on ? [...values, id] : values.filter(x => x !== id), ...(id === 'fit' && !on ? { fitFocus: [] } : {}) });
      refreshPriorities(d.followup ? `[data-priority="${id}"]` : undefined);
      Assistant.prioritiesChanged();
    } else if (d.fit) {
      const values = State.get().fitFocus;
      State.set({ fitFocus: values.includes(d.fit) ? values.filter(x => x !== d.fit) : [...values, d.fit] });
      refreshPriorities(); Assistant.prioritiesChanged();
    } else if (b.id === 'clear-priorities') { State.set({ priorities: [], fitFocus: [] }); refreshPriorities(); Assistant.prioritiesChanged(); }
    else if (d.wsRemove) { ctx.setFocus(`[data-sel="${d.wsRemove}"]`); Likes.setSelected(d.wsRemove, false); ctx.live('Removed from comparison. This jacket is still in My Likes.'); }
    else if (d.wsTab) { State.set({ tab: d.wsTab }); preserve(compareBody); }
    else if (b.id === 'workspace-copy') {
      const shared = new URL(ctx.url({ ...ctx.route, cmp: Likes.selected() }, '/compare'), location.href).href;
      try { await navigator.clipboard.writeText(shared); $('#workspace-copy-status').textContent = 'Link copied. Notes stay private.'; }
      catch { const link = Object.assign(document.createElement('a'), { href: shared, textContent: 'Open shareable comparison to copy its address' }); $('#workspace-copy-status').replaceChildren(link); }
    }
  });
  document.addEventListener('change', e => {
    if (!e.target.closest('#research-workspace')) return;
    const c = e.target;
    if (c.id === 'differences-only') { State.set({ differences: c.checked }); refreshPriorities(); }
    if (c.dataset.rowToggle) { const rows = State.get().rows; State.set({ rows: c.checked ? [...rows, c.dataset.rowToggle] : rows.filter(x => x !== c.dataset.rowToggle) }); refreshPriorities(); }
  });
  document.addEventListener('input', e => { if (e.target.dataset.note) { State.note(e.target.dataset.note, e.target.value); $('.saved-locally').textContent = Likes.available() && State.persisted() ? '✓ Research saved on this device' : 'Storage unavailable · changes last for this visit'; } });
  addEventListener('storage', e => {
    if (e.key !== State.KEY && e.key !== null) return;
    State.load();
    if ($('#research-workspace')) refresh();
  });
}
