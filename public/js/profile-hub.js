// Profile Hub (#/profile/...): the signed-in profile's overview and section editors, plus My gear.
// Everything here reads and writes the browser-local profile (accounts.js) and gear list (gear.js); nothing leaves the browser.
import * as A from './accounts.js';
import * as Gear from './gear.js';
import * as Likes from './likes.js';
import * as WorkspaceState from './workspace-state.js';

const esc = A.esc;
let cat = () => ({ products: [], images: [] });
export function configure(options = {}) { if (options.catalog) cat = options.catalog; }
const P = id => cat().products.find(p => p.id === id) || null;
const pname = p => `${p.brand} ${p.name}`;
const firstImage = id => cat().images.find(i => i.p === id) || null;
const label = (list, v) => list.find(x => x[0] === v)?.[1] || '';

const svg = d => `<svg class="hub-ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  overview: svg('<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>'),
  sailing: svg('<path d="M12 3v14M12 4l7 11h-7M11 6l-6 9h6M3 18h18l-2.5 3h-13z"/>'),
  fit: svg('<path d="M3 17L17 3l4 4L7 21H3zM7 13l2 2M10 10l2 2M13 7l2 2"/>'),
  preferences: svg('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
  likes: svg('<path d="M12 20.5s-7.5-4.6-9.4-9.1C1.3 8.2 3.2 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3.1 1.6-1.9 3.1-3.1 5.2-3.1 3.6 0 5.5 3.7 4.2 6.9-1.9 4.5-9.4 9.1-9.4 9.1z"/>'),
  gear: svg('<path d="M9 3l3 2 3-2 5 3-2 5-2-1v11H8V10l-2 1-2-5zM12 5v16"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
  signout: svg('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>'),
};
const SECTIONS = [['overview', 'Overview', '#/profile'], ['sailing', 'My sailing', '#/profile/sailing'], ['fit', 'Size & fit', '#/profile/fit'],
  ['preferences', 'My preferences', '#/profile/preferences'], ['likes', 'My Likes', '#/profile/likes'], ['gear', 'My gear', '#/profile/gear'], ['settings', 'Settings', '#/profile/settings']];
const initials = name => name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
const query = () => new URLSearchParams(location.hash.split('?')[1] || '');

// One-time message shown after a save, cancel or removal (also sent to the page's live region).
let flash = null, fitDraft = null, lastPath = null;
const setFlash = (text, tone = 'ok') => { flash = { text, tone }; };
const savedMsg = (ok, what) => ok ? setFlash(`${what} saved.`) : setFlash(`${what} could not be saved: browser storage is unavailable. Your changes last only for this visit.`, 'error');

export function render(path) {
  const p = A.current();
  if (!p) return '';
  const [sec = 'overview', sub] = path.split('/').slice(2);
  const views = { overview, sailing, fit, preferences, likes, gear, settings };
  const body = views[sec] ? views[sec](p, sub) : `<header class="hub-head"><h1 id="hub-h" tabindex="-1">Page not found</h1><p>This part of your profile doesn’t exist. <a href="#/profile">Go to the overview</a></p></header>`;
  const current = SECTIONS.find(s => s[0] === sec) || SECTIONS[0];
  const f = flash; flash = null;
  return `<div class="hub"><aside class="hub-side">
    <div class="hub-user"><span class="hub-avatar" aria-hidden="true">${esc(initials(p.displayName))}</span><div><strong>${esc(p.displayName)}</strong><small>Saved on this device</small></div></div>
    <button type="button" class="hub-menu-btn" data-hub-action="menu" aria-expanded="false" aria-controls="hub-nav">${current ? ICONS[current[0]] : ''}<span>${esc(current[1])}</span><span class="vh"> – show profile sections</span><span class="hub-menu-caret" aria-hidden="true">▾</span></button>
    <nav id="hub-nav" class="hub-nav" aria-label="Profile sections"><ul>${SECTIONS.map(([id, name, href]) => `<li><a href="${href}"${id === sec ? ' aria-current="page"' : ''}>${ICONS[id]}<span>${name}</span></a></li>`).join('')}</ul>
    <button type="button" class="hub-signout" data-hub-action="sign-out">${ICONS.signout}<span>Sign out</span></button></nav></aside>
    <div class="hub-main">${f ? `<p class="hub-flash" data-tone="${f.tone}" data-flash="${esc(f.text)}">${esc(f.text)}</p>` : ''}${body}</div></div>`;
}

// ---- Overview ----
const banner = () => `<section class="hub-banner" aria-label="Explore jackets"><img src="images/site/hub-banner-helm-sunset-800.jpg" srcset="images/site/hub-banner-helm-sunset-800.jpg 800w, images/site/hub-banner-helm-sunset-2100.webp 2100w" sizes="(max-width: 860px) 100vw, 900px" alt="" width="2100" height="1103" decoding="async">
  <div class="hub-banner-txt"><p>Ready for your next sail?</p><a class="btn hub-banner-btn" href="#/">Explore jackets</a></div><span class="art-note">Lifestyle photo, not a product image</span></section>`;
function hubCard(id, title, content, actions) {
  return `<article class="hub-card" aria-labelledby="card-${id}"><div class="hub-card-h">${ICONS[id]}<h2 id="card-${id}">${title}</h2></div><div class="hub-card-b">${content}</div>
    <div class="hub-card-a">${actions.map(([text, href]) => `<a href="${href}">${text}<span class="vh"> (${title})</span> <span aria-hidden="true">›</span></a>`).join('')}</div></article>`;
}
function overview(p) {
  const d = p.onboarding.data, m = d.measurements;
  const acts = d.activities.map(x => label(A.ACTIVITIES, x)).filter(Boolean);
  const nMeasure = ['heightCm', 'weightKg', 'chestCm', 'waistCm', 'hipsCm'].filter(k => m[k] != null).length;
  const fitBits = [label(A.FIT_CATEGORIES, d.fit.category), d.fit.usualSize && `Usual size ${d.fit.usualSize}${d.fit.sizeSystem ? ` (${d.fit.sizeSystem})` : ''}`, d.preferredFit && `${label(A.PREFERRED_FIT, d.preferredFit)} fit`].filter(Boolean);
  const liked = Likes.list().map(P).filter(Boolean), gearList = Gear.list();
  const thumbs = liked.slice(0, 3).map(x => { const i = firstImage(x.id); return `<li>${i ? `<img src="${esc(encodeURI(i.file))}" alt="${esc(pname(x))}" loading="lazy" width="64" height="64">` : `<span class="hub-thumb-none">${esc(x.brand)}</span>`}</li>`; }).join('');
  return `<header class="hub-head"><h1 id="hub-h" tabindex="-1">Welcome back, ${esc(p.displayName)}</h1><p>Your sailing, your fit, your next adventure.</p></header>
    ${p.onboarding.complete ? '' : '<p class="hub-notice">Your profile setup isn’t finished. <a href="#/onboarding">Continue setup</a></p>'}
    ${banner()}<div class="hub-cards">
    ${hubCard('sailing', 'My sailing', acts.length ? `<p>${esc(acts.join(', '))}${d.activityOther ? ` · ${esc(d.activityOther)}` : ''}</p>` : '<p class="mu">Tell us how you sail so your research starts in the right place.</p>', [[acts.length ? 'Edit my sailing' : 'Add your sailing', '#/profile/sailing']])}
    ${hubCard('fit', 'Size & fit', `${fitBits.length ? `<p>${esc(fitBits.join(' · '))}</p>` : '<p class="mu">No size or fit details yet.</p>'}<p class="mu">${nMeasure ? `${nMeasure} of 5 body measurements recorded` : 'No body measurements recorded'}</p>`, [[nMeasure ? 'View measurements' : fitBits.length ? 'Edit size & fit' : 'Add size & fit', '#/profile/fit']])}
    ${hubCard('preferences', 'My priorities', d.priorities.length ? `<ul class="hub-chips">${d.priorities.map(x => `<li>${esc(label(A.PRIORITIES, x))}</li>`).join('')}</ul>` : '<p class="mu">Choose up to three things that matter most in a jacket.</p>', [[d.priorities.length ? 'Edit priorities' : 'Add priorities', '#/profile/preferences']])}
    ${hubCard('likes', 'My Likes', liked.length ? `<p><strong>${liked.length}</strong> saved jacket${liked.length === 1 ? '' : 's'}</p><ul class="hub-thumbs">${thumbs}</ul>` : '<p class="mu">No saved jackets yet. Select Like on any jacket to save it.</p>', liked.length ? [['Continue researching', '#/likes']] : [['Explore jackets', '#/']])}
    ${hubCard('gear', 'My gear', gearList.length ? `<p><strong>${gearList.length}</strong> item${gearList.length === 1 ? '' : 's'} recorded</p><ul class="hub-list">${gearList.slice(0, 2).map(g => `<li>${esc(`${g.brand} ${g.model}`)}${g.size ? ` · ${esc(g.size)}` : ''}</li>`).join('')}</ul>` : '<p class="mu">Record jackets you already own, with the size and how they fit.</p>', gearList.length ? [['View my gear', '#/profile/gear']] : [['Add gear', '#/profile/gear/new']])}
    </div>`;
}

// ---- Shared form pieces ----
const head = (title, intro) => `<header class="hub-head"><h1 id="hub-h" tabindex="-1">${title}</h1>${intro ? `<p>${intro}</p>` : ''}</header>`;
const actions = (save = 'Save') => `<p class="account-alert" role="status" aria-live="polite"></p><div class="hub-actions"><button type="submit" class="btn p">${save}</button><button type="button" class="btn" data-hub-action="cancel">Cancel</button></div>`;
const checks = (list, selected, name, legend) => `<fieldset class="hub-fieldset"><legend>${legend}</legend><div class="account-choices">${list.map(([v, l]) => `<label class="account-choice"><input type="checkbox" name="${name}" value="${esc(v)}"${selected.includes(v) ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></fieldset>`;
const opts = (list, v) => list.map(([value, text]) => `<option value="${esc(value)}"${v === value ? ' selected' : ''}>${esc(text)}</option>`).join('');
const err = id => `<p class="field-error" id="${id}"></p>`;

function sailing(p) {
  const d = p.onboarding.data;
  return head('My sailing', 'The kinds of sailing you do. This helps organise your research; it doesn’t filter anything automatically.') +
    `<form class="hub-form" data-hub-form="sailing" novalidate>${checks(A.ACTIVITIES, d.activities, 'activities', 'How do you sail?')}
    <label for="hub-activity-other">Other activity, if useful</label><input id="hub-activity-other" name="activityOther" maxlength="160" value="${esc(d.activityOther)}">${actions()}</form>`;
}
function fit(p) {
  const d = p.onboarding.data, m = d.measurements, system = m.lengthUnit === 'cm' ? 'metric' : 'us';
  fitDraft = structuredClone(m);
  return head('Size & fit', 'Your usual sizes, body measurements and fit preferences. Marine Buy does not turn these into a size recommendation.') +
    `<form class="hub-form" data-hub-form="fit" novalidate data-length-unit="${m.lengthUnit}" data-weight-unit="${m.weightUnit}">
    <section class="hub-group" aria-labelledby="fit-size-h"><h2 id="fit-size-h">Clothing size</h2>
      <div class="account-fields"><label for="hub-fit-category">Fit category<select id="hub-fit-category" name="fitCategory"><option value="">Not provided</option>${opts(A.FIT_CATEGORIES, d.fit.category)}</select></label>
      <label for="hub-usual-size">Usual jacket size<input id="hub-usual-size" name="usualSize" maxlength="40" value="${esc(d.fit.usualSize)}" placeholder="For example M"></label>
      <label for="hub-size-system">Size system<select id="hub-size-system" name="sizeSystem"><option value="">Not sure / not provided</option>${opts([['US', 'US'], ['UK', 'UK'], ['EU', 'EU'], ['other', 'Other']], d.fit.sizeSystem)}</select></label>
      <label for="hub-reference">A jacket that fits you well<input id="hub-reference" name="referenceModel" maxlength="100" value="${esc(d.fit.referenceModel)}" placeholder="Brand and model (optional)"></label></div></section>
    <section class="hub-group" id="measurements" aria-labelledby="fit-m-h"><h2 id="fit-m-h">Body measurements</h2><p class="mu">Optional. These are your body measurements, not a jacket’s. Leave any field blank.</p><p class="hub-saved-m"><strong>Saved:</strong> ${esc(A.measurementList(m).join(' · ') || 'No measurements yet')}</p>
      <div class="account-fields unit-selects"><label for="length-unit">Height and length unit <select id="length-unit" name="lengthUnit"><option value="in"${system === 'us' ? ' selected' : ''}>ft / in</option><option value="cm"${system === 'metric' ? ' selected' : ''}>cm</option></select></label>
      <label for="weight-unit">Weight unit <select id="weight-unit" name="weightUnit"><option value="lb"${system === 'us' ? ' selected' : ''}>Pounds (lb)</option><option value="kg"${system === 'metric' ? ' selected' : ''}>Kilograms (kg)</option></select></label></div>
      <p class="mu unit-hint">With ft / in, height is in feet and inches, and chest, waist and hips are in inches. Changing one unit switches both.</p>
      <div class="account-fields measurements">${A.heightField(m.heightCm, system)}
      ${['weight', 'chest', 'waist', 'hips'].map(n => `<div>${A.unitInput(n, A.shown(n === 'weight' ? m.weightKg : m[`${n}Cm`], A.unitFor(n, system)), system).replace('<input ', `<input aria-describedby="${n}-error" `)}${err(`${n}-error`)}</div>`).join('')}</div></section>
    <section class="hub-group" aria-labelledby="fit-c-h"><h2 id="fit-c-h">Fit challenges</h2>${checks(A.CHALLENGES, d.challenges, 'challenges', 'Select any that apply')}
      <label for="hub-fit-notes">Anything else to keep in mind (optional)</label><textarea id="hub-fit-notes" name="fitNotes" maxlength="500" rows="3">${esc(d.fitNotes)}</textarea></section>
    <section class="hub-group" aria-labelledby="fit-p-h"><h2 id="fit-p-h">Preferred fit</h2><label for="hub-preferred-fit">How do you like a jacket to fit?<select id="hub-preferred-fit" name="preferredFit"><option value="">Not sure</option>${opts(A.PREFERRED_FIT, d.preferredFit)}</select></label></section>
    <p class="mu">These details help organise your research. They cannot guarantee that a jacket will fit; official size charts are not recorded on Marine Buy yet.</p>${actions('Save size & fit')}</form>`;
}
let applyOffer = false;
function preferences(p) {
  const d = p.onboarding.data, offer = applyOffer; applyOffer = false;
  return head('My preferences', 'Choose up to three priorities. They are saved with your profile and start your My Likes research.') +
    `<form class="hub-form" data-hub-form="preferences" novalidate data-picks="${esc(d.priorities.join(' '))}"><fieldset class="hub-fieldset"><legend>What matters most? <span class="mu">(up to three)</span></legend>
    <div class="priority-bubbles hub-bubbles">${A.PRIORITIES.map(([v, l]) => `<button type="button" data-pick="${v}" aria-pressed="${d.priorities.includes(v)}"><span class="bubble-check" aria-hidden="true">${d.priorities.includes(v) ? '✓' : '+'}</span>${esc(l)}</button>`).join('')}</div></fieldset>
    <p class="mu">Priorities you pick while researching in My Likes are temporary for that research. Saving here doesn’t replace priorities you changed there unless you choose to.</p>
    ${offer ? '<p class="hub-offer">Your My Likes research is using different priorities right now. <button type="button" class="btn" data-hub-action="apply-priorities">Use my saved priorities in My Likes</button></p>' : ''}${actions('Save preferences')}</form>`;
}
function likes() {
  const liked = Likes.list().map(P).filter(Boolean);
  return head('My Likes', 'Jackets you saved. Compare and research them in the My Likes workspace.') +
    (liked.length ? `<p><strong>${liked.length}</strong> saved jacket${liked.length === 1 ? '' : 's'}</p><ul class="hub-like-list">${liked.map(x => { const i = firstImage(x.id); return `<li>${i ? `<img src="${esc(encodeURI(i.file))}" alt="" loading="lazy" width="56" height="56">` : ''}<a href="#/p/${esc(x.id)}">${esc(pname(x))}</a></li>`; }).join('')}</ul><p><a class="btn p" href="#/likes">Open My Likes workspace</a></p>`
      : `<div class="empty"><strong>No saved jackets yet.</strong><p>Select Like on any jacket to save it here.</p><a class="btn p" href="#/">Explore jackets</a></div>`);
}

// ---- My gear ----
const fitLabel = v => label(Gear.FIT, v);
const month = v => v ? new Date(`${v}-01T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : '';
function gear(p, sub) {
  if (sub === 'new' || sub) return gearForm(sub === 'new' ? null : Gear.get(sub));
  const list = Gear.list();
  return head('My gear', 'A private record of gear you own, entered by you. Fit notes are your own experience, not verified reviews, and are never shared.') +
    `<p><a class="btn p" href="#/profile/gear/new">Add gear</a></p>${list.length ? `<ul class="gear-list">${list.map(g => { const prod = g.productId && P(g.productId), i = prod && firstImage(prod.id);
      const meta = [g.size && `Size ${g.size}`, g.purchased && `Got it ${month(g.purchased)}`, g.retailer && `from ${g.retailer}`].filter(Boolean).join(' · ');
      return `<li class="gear-item" data-gear-id="${esc(g.id)}">${i ? `<img src="${esc(encodeURI(i.file))}" alt="" loading="lazy" width="72" height="72">` : '<span class="gear-ph" aria-hidden="true">' + ICONS.gear + '</span>'}
        <div class="gear-body"><h2>${prod ? `<a href="#/p/${esc(prod.id)}">${esc(`${g.brand} ${g.model}`)}</a>` : esc(`${g.brand} ${g.model}`)}</h2>${meta ? `<p class="mu">${esc(meta)}</p>` : ''}
        ${g.fit ? `<p><span class="gear-fit">Fit: ${esc(fitLabel(g.fit))}</span></p>` : ''}${g.fitAreas ? `<p><strong>Fit notes:</strong> ${esc(g.fitAreas)}</p>` : ''}${g.notes ? `<p><strong>Layering &amp; use:</strong> ${esc(g.notes)}</p>` : ''}
        <p class="gear-src mu">Your own record${prod ? '' : ' · not in the Marine Buy catalog'}</p></div>
        <div class="gear-actions"><a class="btn" href="#/profile/gear/${esc(g.id)}">Edit<span class="vh"> ${esc(`${g.brand} ${g.model}`)}</span></a><button type="button" class="btn" data-hub-action="gear-remove" data-id="${esc(g.id)}">Remove<span class="vh"> ${esc(`${g.brand} ${g.model}`)}</span></button></div></li>`; }).join('')}</ul>`
      : '<div class="empty"><strong>No gear recorded yet.</strong><p>Add a jacket you own to keep its size and fit notes with your profile. You can also use “I own this” on any product page.</p></div>'}`;
}
function gearForm(g) {
  const products = cat().products, pre = g ? (g.productId && P(g.productId) ? g.productId : '') : (P(query().get('p') || '') ? query().get('p') : '');
  if (g === null && location.hash.split('?')[0] !== '#/profile/gear/new') return head('Gear not found', '') + '<p>This gear record doesn’t exist on this device. <a href="#/profile/gear">Back to My gear</a></p>';
  const v = g || { brand: '', model: '', size: '', purchased: '', retailer: '', fit: '', fitAreas: '', notes: '' };
  return head(g ? 'Edit gear' : 'Add gear', 'Only the item itself is required. Everything else is optional and stays on this device.') +
    `<p><a href="#/profile/gear">← My gear</a></p><form class="hub-form" data-hub-form="gear" novalidate${g ? ` data-gear-id="${esc(g.id)}"` : ''}>
    <label for="gear-product">Item</label><select id="gear-product" name="productId">${products.map(x => `<option value="${esc(x.id)}"${pre === x.id ? ' selected' : ''}>${esc(pname(x))}</option>`).join('')}<option value=""${pre ? '' : ' selected'}>Something else (type the brand and model)</option></select>
    <div class="account-fields gear-custom"${pre ? ' hidden' : ''}><label for="gear-brand">Brand<input id="gear-brand" name="brand" maxlength="60" value="${esc(pre ? '' : v.brand)}" aria-describedby="gear-brand-error">${err('gear-brand-error')}</label>
      <label for="gear-model">Model<input id="gear-model" name="model" maxlength="120" value="${esc(pre ? '' : v.model)}" aria-describedby="gear-model-error">${err('gear-model-error')}</label></div>
    <div class="account-fields"><label for="gear-size">Size you own<input id="gear-size" name="size" maxlength="30" value="${esc(v.size)}" placeholder="For example M"></label>
      <label for="gear-purchased">When you got it (optional)<input id="gear-purchased" name="purchased" type="month" value="${esc(v.purchased)}" aria-describedby="gear-purchased-error">${err('gear-purchased-error')}</label>
      <label for="gear-retailer">Where you got it (optional)<input id="gear-retailer" name="retailer" maxlength="80" value="${esc(v.retailer)}"></label></div>
    <fieldset class="hub-fieldset"><legend>How does it fit? <span class="mu">(optional)</span></legend><div class="account-choices">${Gear.FIT.map(([k, l]) => `<label class="account-choice"><input type="radio" name="fit" value="${k}"${v.fit === k ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
    <label for="gear-fit-areas">Fit notes (optional)</label><textarea id="gear-fit-areas" name="fitAreas" maxlength="500" rows="2" placeholder="For example: roomy at the hips, sleeves a little short">${esc(v.fitAreas)}</textarea>
    <label for="gear-notes">Layering and use (optional)</label><textarea id="gear-notes" name="notes" maxlength="1000" rows="2" placeholder="For example: fits over a fleece; used for coastal day sails">${esc(v.notes)}</textarea>
    <p class="mu">This is your own record. It isn’t a review, and Marine Buy doesn’t use it to recommend sizes.</p>
    <div class="gear-dup" role="alert" hidden></div>${actions(g ? 'Save gear' : 'Add to My gear')}</form>`;
}
function gearValues(form) {
  const f = form.elements, prod = P(f.productId.value);
  return { productId: prod ? prod.id : null, brand: prod ? prod.brand : f.brand.value.trim(), model: prod ? prod.name : f.model.value.trim(),
    size: f.size.value.trim(), purchased: f.purchased.value, retailer: f.retailer.value.trim(), fit: form.querySelector('input[name=fit]:checked')?.value || '', fitAreas: f.fitAreas.value.trim(), notes: f.notes.value.trim() };
}

// ---- Settings ----
function settings(p) {
  const n = { likes: Likes.count(), gear: Gear.list().length };
  return head('Settings', '') +
    `<form class="hub-form" data-hub-form="settings" novalidate><h2>Display name</h2><label for="hub-name">Name shown on this profile</label><input id="hub-name" name="displayName" maxlength="80" value="${esc(p.displayName)}" autocomplete="nickname" aria-describedby="hub-name-error">${err('hub-name-error')}${actions('Save name')}</form>
    <section class="hub-group" aria-labelledby="set-store-h"><h2 id="set-store-h">Where your data is kept</h2><p><strong>Your profile is saved on this device.</strong></p>
      <p>It is stored in this browser’s local storage: your answers, measurements, gear records, Likes and notes. It isn’t sent to Marine Buy’s server, doesn’t sync to other devices, and isn’t password-protected, so anyone using this browser can open it. Clearing your browser data removes it.</p>
      ${A.storageAvailable() && Gear.persisted() ? '' : '<p class="warn">Browser storage is currently unavailable, so changes last only for this visit.</p>'}</section>
    <section class="hub-group" aria-labelledby="set-acct-h"><h2 id="set-acct-h">Profile</h2><p>Signing out keeps this profile on the device; you can sign in again from Sign in.</p>
      <div class="hub-actions"><button type="button" class="btn" data-hub-action="sign-out">Sign out</button><button type="button" class="btn danger" data-hub-action="delete">Delete profile…</button></div>
      <p class="mu">Deleting removes ${esc(p.displayName)}’s answers, measurements, ${n.gear} gear record${n.gear === 1 ? '' : 's'}, ${n.likes} Like${n.likes === 1 ? '' : 's'} and research notes from this browser.</p></section>`;
}

// ---- Dialogs (native <dialog>: focus stays inside, Escape cancels, focus returns to the opener) ----
function dialog({ title, html, ok, danger, onOk, opener }) {
  let d = document.querySelector('#hub-dialog');
  if (!d) { d = Object.assign(document.createElement('dialog'), { id: 'hub-dialog', className: 'hub-dialog' }); d.setAttribute('aria-labelledby', 'hub-dialog-h'); document.body.append(d); }
  d.innerHTML = `<h2 id="hub-dialog-h">${title}</h2>${html}<div class="hub-actions"><button type="button" class="btn" data-dialog="cancel">Cancel</button><button type="button" class="btn ${danger ? 'danger' : 'p'}" data-dialog="ok">${ok}</button></div>`;
  const close = () => { d.close(); if (opener && document.contains(opener)) opener.focus(); };
  d.onclick = e => { const b = e.target.closest('[data-dialog]'); if (!b) return; if (b.dataset.dialog === 'ok') { d.close(); onOk(); } else close(); };
  d.oncancel = e => { e.preventDefault(); close(); };
  d.showModal(); d.querySelector('[data-dialog=cancel]').focus();
}

// ---- Unsaved changes: forms compare against a snapshot taken when they were drawn ----
const snapshot = form => JSON.stringify([...new FormData(form)].concat([['picks', form.dataset.picks || '']]));
const dirtyForm = () => document.querySelector('[data-hub-form][data-changed="1"]');
function markChanged(form) { form.dataset.changed = snapshot(form) === form.dataset.snapshot ? '0' : '1'; }
function confirmLeave(go, opener) {
  dialog({ title: 'Leave without saving?', html: '<p>You have unsaved changes on this page. If you leave now, they will be lost.</p>', ok: 'Discard changes', danger: true, opener,
    onOk: () => { const f = dirtyForm(); if (f) f.dataset.changed = '0'; go(); } });
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#/"]');
  if (!a || a.target || !dirtyForm() || e.defaultPrevented) return;
  e.preventDefault(); e.stopImmediatePropagation();
  confirmLeave(() => { location.hash = a.getAttribute('href'); }, a);
}, true);
// Back/Forward while a form has changes: put the address back and ask first. (Registered before the app's router.)
addEventListener('hashchange', e => {
  if (!dirtyForm()) return;
  e.stopImmediatePropagation();
  const from = new URL(e.oldURL).hash, to = new URL(e.newURL).hash;
  history.replaceState(null, '', from);
  confirmLeave(() => { location.hash = to; });
});
// Escape closes the compact section menu on small screens and returns focus to its button.
document.addEventListener('keydown', e => {
  const nav = document.querySelector('#hub-nav[data-open="1"]');
  if (e.key !== 'Escape' || !nav || !nav.contains(document.activeElement)) return;
  const b = document.querySelector('.hub-menu-btn'); nav.dataset.open = '0'; b.setAttribute('aria-expanded', 'false'); b.focus();
});
addEventListener('beforeunload', e => { if (dirtyForm()) { e.preventDefault(); e.returnValue = ''; } });

/** Called by the app after it draws an account page: snapshots, focus on section changes, save messages. */
export function afterRender(path) {
  document.querySelectorAll('[data-hub-form]').forEach(f => { f.dataset.snapshot = snapshot(f); f.dataset.changed = '0'; });
  const msg = document.querySelector('.hub-flash');
  if (msg) { const live = document.querySelector('#live'); if (live) { live.textContent = ''; setTimeout(() => { live.textContent = msg.dataset.flash; }, 40); } }
  if (path.startsWith('/profile') && lastPath && lastPath !== path) document.querySelector('#hub-h')?.focus({ preventScroll: true });
  if (path === '/onboarding/done') document.querySelector('#welcome-h')?.focus({ preventScroll: true });
  lastPath = path.startsWith('/profile') ? path : null;
}
const rerender = () => { A.renderCurrent(); afterRender(location.hash.split('?')[0].slice(1)); };
const fieldError = (form, id, text) => { const el = form.querySelector(`#${id}`); if (el) el.textContent = text; const input = form.querySelector(`[aria-describedby~="${id}"]`) || el?.closest('div,label')?.querySelector('input'); if (input) text ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute('aria-invalid'); return !text; };

// ---- Events (wired by app.js) ----
export function handleClick(e) {
  const b = e.target.closest('[data-hub-action],[data-pick]');
  if (!b || !b.closest('.hub,#app')) return false;
  const form = b.closest('[data-hub-form]');
  if (b.dataset.pick) {
    const picks = new Set((form.dataset.picks || '').split(' ').filter(Boolean)), on = b.getAttribute('aria-pressed') === 'true', status = form.querySelector('.account-alert');
    if (!on && picks.size >= 3) { delete status.dataset.tone; status.textContent = 'Choose no more than three priorities. Remove one first.'; return true; }
    on ? picks.delete(b.dataset.pick) : picks.add(b.dataset.pick);
    form.dataset.picks = A.PRIORITIES.map(x => x[0]).filter(x => picks.has(x)).join(' ');
    b.setAttribute('aria-pressed', String(!on)); b.querySelector('.bubble-check').textContent = on ? '+' : '✓'; status.textContent = '';
    markChanged(form); return true;
  }
  const act = b.dataset.hubAction;
  if (act === 'menu') { const open = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(open)); document.querySelector('#hub-nav').dataset.open = open ? '1' : '0'; if (open) document.querySelector('#hub-nav a')?.focus(); }
  else if (act === 'cancel') {
    if (form.dataset.hubForm === 'gear') { form.dataset.changed = '0'; location.hash = '#/profile/gear'; }
    else { setFlash('Changes discarded.', 'info'); rerender(); }
  } else if (act === 'sign-out') {
    const go = () => { A.signOut(); location.hash = '#/'; };
    dirtyForm() ? confirmLeave(go, b) : go();
  } else if (act === 'delete') {
    const p = A.current(), n = { likes: Likes.count(), gear: Gear.list().length };
    dialog({ title: `Delete ${esc(p.displayName)}?`, ok: 'Delete profile and data', danger: true, opener: b,
      html: `<p>This removes from this browser:</p><ul><li>the profile name and sailing and fit answers</li><li>body measurements</li><li>${n.gear} My gear record${n.gear === 1 ? '' : 's'}</li><li>${n.likes} Like${n.likes === 1 ? '' : 's'}, comparison picks and research notes for this profile</li></ul><p>Guest browsing data and other profiles on this device are not affected. This can’t be undone.</p>`,
      onOk: () => { const name = p.displayName, removed = A.deleteCurrent(); A.setSignInNotice(removed ? `${name}’s profile and its data were deleted from this browser.` : `${name}’s profile was removed, but some saved data could not be cleared because browser storage is unavailable.`); location.hash = '#/account'; } });
  } else if (act === 'gear-remove') {
    const g = Gear.get(b.dataset.id); if (!g) return true;
    dialog({ title: 'Remove from My gear?', html: `<p>Remove <strong>${esc(`${g.brand} ${g.model}`)}</strong>${g.size ? ` (size ${esc(g.size)})` : ''} and its notes from My gear? Your Likes are not affected.</p>`, ok: 'Remove', danger: true, opener: b,
      onOk: () => { const r = Gear.remove(g.id); setFlash(r.saved ? `${g.brand} ${g.model} removed from My gear.` : 'Removed for this visit only: browser storage is unavailable.', r.saved ? 'ok' : 'error'); rerender(); } });
  } else if (act === 'apply-priorities') {
    WorkspaceState.set(A.researchPriorities(A.current().onboarding.data));
    setFlash(WorkspaceState.persisted() ? 'Your saved priorities are now used in My Likes research.' : 'Applied for this visit only: browser storage is unavailable.', WorkspaceState.persisted() ? 'ok' : 'error'); rerender();
  } else return false;
  e.preventDefault();
  return true;
}
const MEASURE_FIELD = { heightFt: 'height', heightIn: 'height', height: 'height', weight: 'weight', chest: 'chest', waist: 'waist', hips: 'hips' };
export function handleInput(e) {
  const form = e.target.closest('[data-hub-form]');
  if (!form) return;
  const field = MEASURE_FIELD[e.target.name];
  if (form.dataset.hubForm === 'fit' && field) {
    form.dataset.dirty = [...new Set([...(form.dataset.dirty || '').split(' ').filter(Boolean), field])].join(' ');
    if (field === 'height') A.checkHeight(form); else fieldError(form, `${field}-error`, '');
  }
  if (form.dataset.hubForm === 'gear') { form.dataset.dupOk = ''; form.querySelector('.gear-dup').hidden = true; }
  e.target.removeAttribute('aria-invalid');
  markChanged(form);
}
export function handleChange(e) {
  const input = e.target, form = input.closest('[data-hub-form]');
  if (!form) return;
  if (input.name === 'challenges') {
    const none = form.querySelector('input[name="challenges"][value="none"]');
    if (input.value === 'none' && input.checked) form.querySelectorAll('input[name="challenges"]').forEach(x => { if (x !== input) x.checked = false; });
    else if (input.checked && none) none.checked = false;
  }
  if (input.name === 'lengthUnit' || input.name === 'weightUnit') {
    const system = input.value === 'cm' || input.value === 'kg' ? 'metric' : 'us';
    if (A.heightBlocked(form)) { form.elements.lengthUnit.value = form.dataset.lengthUnit; form.elements.weightUnit.value = form.dataset.weightUnit; return; }
    fitDraft = A.readMeasurements(form, fitDraft); form.dataset.dirty = '';
    fitDraft = A.applyUnitSystem(form, system, fitDraft);
    const s = form.querySelector('.account-alert'); s.dataset.tone = 'info'; s.textContent = system === 'metric' ? 'Units switched to centimetres and kilograms. Save to keep this choice.' : 'Units switched to ft / in and pounds. Save to keep this choice.';
  }
  if (input.name === 'productId') {
    const custom = !input.value, box = form.querySelector('.gear-custom'); box.hidden = !custom; form.dataset.dupOk = ''; form.querySelector('.gear-dup').hidden = true;
    if (custom) form.elements.brand.focus();
  }
  markChanged(form);
}
const RANGE_LABEL = { weight: 'Weight', chest: 'Chest', waist: 'Waist', hips: 'Hips' };
export function handleSubmit(e) {
  const form = e.target;
  if (!form.matches('[data-hub-form]')) return false;
  e.preventDefault();
  const kind = form.dataset.hubForm, f = form.elements, status = form.querySelector('.account-alert');
  const fail = text => { delete status.dataset.tone; status.textContent = text; form.querySelector('[aria-invalid="true"]')?.focus(); };
  if (kind === 'sailing') {
    savedMsg(A.updateProfileData({ activities: [...form.querySelectorAll('input[name=activities]:checked')].map(x => x.value), activityOther: f.activityOther.value.trim() }), 'My sailing');
  } else if (kind === 'fit') {
    if (A.heightBlocked(form)) return true;
    let ok = true;
    for (const n of ['weight', 'chest', 'waist', 'hips']) {
      const el = f[n], unit = A.unitFor(n, form.dataset.lengthUnit === 'cm' ? 'metric' : 'us');
      const text = el.validity.badInput ? `Enter ${RANGE_LABEL[n].toLowerCase()} as a number.` : (el.validity.rangeUnderflow || el.validity.rangeOverflow) ? `${RANGE_LABEL[n]} should be between ${el.min} and ${el.max} ${unit}. Check the unit and your entry.` : '';
      ok = fieldError(form, `${n}-error`, text) && ok;
    }
    if (!ok) return fail('Check the highlighted measurements.'), true;
    const measurements = A.readMeasurements(form, fitDraft);
    savedMsg(A.updateProfileData({ fit: { category: f.fitCategory.value, usualSize: f.usualSize.value.trim(), sizeSystem: f.sizeSystem.value, referenceModel: f.referenceModel.value.trim() },
      measurements, challenges: [...form.querySelectorAll('input[name=challenges]:checked')].map(x => x.value), fitNotes: f.fitNotes.value.trim(), preferredFit: f.preferredFit.value }), 'Size & fit');
  } else if (kind === 'preferences') {
    const before = A.researchPriorities(A.current().onboarding.data), picks = (form.dataset.picks || '').split(' ').filter(Boolean).slice(0, 3);
    const ok = A.updateProfileData({ priorities: picks }), after = A.researchPriorities(A.current().onboarding.data), ws = WorkspaceState.get();
    const same = (a, b) => [...a].sort().join() === [...b].sort().join();
    if (!ok) savedMsg(false, 'Preferences');
    else if (same(ws.priorities, before.priorities)) { WorkspaceState.set(after); setFlash('Preferences saved. My Likes research now starts with these priorities.'); }
    else { applyOffer = !same(ws.priorities, after.priorities); setFlash('Preferences saved.'); }
  } else if (kind === 'settings') {
    if (!fieldError(form, 'hub-name-error', f.displayName.value.trim() ? '' : 'Enter a name for this profile.')) return fail('Enter a name to save.'), true;
    const r = A.rename(f.displayName.value);
    savedMsg(r.saved, 'Display name');
  } else if (kind === 'gear') {
    const item = gearValues(form), editing = form.dataset.gearId || null;
    let ok = fieldError(form, 'gear-brand-error', item.brand ? '' : 'Enter the brand, or choose a Marine Buy jacket above.');
    ok = fieldError(form, 'gear-model-error', item.model ? '' : 'Enter the model name.') && ok;
    ok = fieldError(form, 'gear-purchased-error', f.purchased.validity.badInput ? 'Enter a month and year, or leave it blank.' : '') && ok;
    if (!ok) return fail('Add the missing details to save this item.'), true;
    const dup = Gear.duplicateOf(item, editing);
    if (dup && form.dataset.dupOk !== '1') {
      const box = form.querySelector('.gear-dup'); box.hidden = false; form.dataset.dupOk = '1';
      box.innerHTML = `<p>You already have <strong>${esc(`${dup.brand} ${dup.model}`)}${dup.size ? `, size ${esc(dup.size)}` : ''}</strong> in My gear. To keep both, select “Save as another item”. To change the existing one, <a href="#/profile/gear/${esc(dup.id)}">edit it instead</a>.</p>`;
      form.querySelector('button[type=submit]').textContent = 'Save as another item'; return true;
    }
    const r = editing ? Gear.update(editing, item) : Gear.add(item);
    if (!r.ok) return fail('This item could not be saved.'), true;
    setFlash(r.saved ? `${item.brand} ${item.model} ${editing ? 'updated' : 'added to My gear'}.` : 'Saved for this visit only: browser storage is unavailable.', r.saved ? 'ok' : 'error');
    form.dataset.changed = '0'; location.hash = '#/profile/gear'; return true;
  }
  form.dataset.changed = '0'; rerender();
  return true;
}
A.setProfileRenderer(render);
