import * as Likes from './likes.js';
import * as WorkspaceState from './workspace-state.js';

export const KEY = 'marinebuy:local-accounts';
const VERSION = 1;
const ACTIVITIES = [
  ['coastal', 'Coastal sailing'], ['offshore', 'Offshore passages'], ['cruising', 'Cruising'],
  ['racing', 'Racing'], ['dinghy', 'Dinghy sailing'], ['other', 'Other']
];
const FIT_CATEGORIES = [['mens', "Men's"], ['womens', "Women's"], ['unisex', 'Unisex'], ['unsure', 'Not sure']];
const CHALLENGES = [
  ['chest', 'Chest room'], ['shoulders', 'Shoulders'], ['hips', 'Hips or hem'],
  ['length', 'Sleeve or torso length'], ['layers', 'Room for layers'],
  ['movement', 'Freedom of movement'], ['other', 'Something else'], ['none', 'No particular issue']
];
const PRIORITIES = [
  ['price', 'Lower price'], ['weight', 'Lighter weight'], ['weather', 'Wet-weather protection'],
  ['breathability', 'Breathability'], ['layers', 'Room for layers'], ['movement', 'Freedom of movement']
];
const MEASUREMENT_KEYS = ['heightCm', 'weightKg', 'chestCm', 'waistCm', 'hipsCm'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const emptyData = () => ({
  activities: [], activityOther: '',
  fit: { category: '', usualSize: '', sizeSystem: '', referenceModel: '' },
  measurements: { lengthUnit: 'in', weightUnit: 'lb', unitsChosen: false, heightCm: null, weightKg: null, chestCm: null, waistCm: null, hipsCm: null },
  challenges: [], fitNotes: '', priorities: [], preferredFit: ''
});
const freshOnboarding = () => ({ step: 0, complete: false, data: emptyData() });
let state = { v: VERSION, activeId: null, profiles: [] }, writable = true, createMode = false, deletePrompt = false, onScopeChange = () => {};

function storage() { try { return globalThis.localStorage ?? null; } catch { return null; } }
function readState() {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return { v: VERSION, activeId: null, profiles: [] };
    const value = JSON.parse(raw);
    if (value?.v !== VERSION || !Array.isArray(value.profiles)) return { v: VERSION, activeId: null, profiles: [] };
    const profiles = value.profiles.filter(p => p && typeof p.id === 'string' && /^p-[a-zA-Z0-9-]+$/.test(p.id) && typeof p.displayName === 'string')
      .map(p => {
        const d = p.onboarding?.data && typeof p.onboarding.data === 'object' ? p.onboarding.data : {};
        const fit = d.fit && typeof d.fit === 'object' ? d.fit : {};
        const m = d.measurements && typeof d.measurements === 'object' ? d.measurements : {};
        const strings = (value, allowed) => Array.isArray(value) ? [...new Set(value.filter(x => typeof x === 'string' && allowed.includes(x)))] : [];
        return {
          id: p.id, displayName: p.displayName.slice(0, 80), createdAt: typeof p.createdAt === 'string' ? p.createdAt : '',
          onboarding: {
            step: Number.isInteger(p.onboarding?.step) ? Math.min(4, Math.max(0, p.onboarding.step)) : 0,
            complete: p.onboarding?.complete === true,
            data: {
              activities: strings(d.activities, ACTIVITIES.map(x => x[0])), activityOther: typeof d.activityOther === 'string' ? d.activityOther.slice(0, 160) : '',
              fit: {
                category: FIT_CATEGORIES.some(x => x[0] === fit.category) ? fit.category : '',
                usualSize: typeof fit.usualSize === 'string' ? fit.usualSize.slice(0, 40) : '',
                sizeSystem: ['US', 'UK', 'EU', 'other'].includes(fit.sizeSystem) ? fit.sizeSystem : '',
                referenceModel: typeof fit.referenceModel === 'string' ? fit.referenceModel.slice(0, 100) : ''
              },
              measurements: (() => {
                const values = Object.fromEntries(MEASUREMENT_KEYS.map(key => [key, Number.isFinite(m[key]) ? m[key] : null]));
                // US units (in, lb) by default. Keep a stored metric choice only if the user chose it or already entered values in it.
                const keep = m.unitsChosen === true || MEASUREMENT_KEYS.some(key => values[key] != null);
                const metric = keep ? m.lengthUnit === 'cm' : false;
                return { lengthUnit: metric ? 'cm' : 'in', weightUnit: metric ? 'kg' : 'lb', unitsChosen: m.unitsChosen === true, ...values };
              })(),
              challenges: (() => {
                const values = strings(d.challenges, CHALLENGES.map(x => x[0]));
                return values.includes('none') ? ['none'] : values;
              })(),
              fitNotes: typeof d.fitNotes === 'string' ? d.fitNotes.slice(0, 500) : '',
              priorities: strings(d.priorities, PRIORITIES.map(x => x[0])).slice(0, 3),
              preferredFit: ['close', 'regular', 'relaxed', 'layered'].includes(d.preferredFit) ? d.preferredFit : ''
            }
          }
        };
      });
    return { v: VERSION, activeId: profiles.some(p => p.id === value.activeId) ? value.activeId : null, profiles };
  } catch {
    writable = false;
    return { v: VERSION, activeId: null, profiles: [] };
  }
}
state = readState();
function persist() {
  try {
    const s = storage();
    if (!s) throw new Error('Storage unavailable');
    s.setItem(KEY, JSON.stringify(state));
    writable = true;
  } catch { writable = false; }
}
const active = () => state.profiles.find(p => p.id === state.activeId) || null;
const getProfile = id => state.profiles.find(p => p.id === id) || null;
export const list = () => state.profiles.map(p => ({ id: p.id, displayName: p.displayName, complete: p.onboarding.complete }));
export const current = () => active() ? structuredClone(active()) : null;
export const storageAvailable = () => writable;
export const guestDataCount = () => {
  const likes = Likes.list().length, notes = Object.values(WorkspaceState.get().notes).filter(Boolean).length;
  return { likes, notes, total: likes + notes };
};
export function configure(options = {}) { onScopeChange = options.onScopeChange || (() => {}); }
function scopeChanged() { onScopeChange(active()?.id || null); }
function id() {
  const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `p-${token}`;
}
function setActive(profileId) {
  state.activeId = profileId;
  persist();
  scopeChanged();
}
export function signIn(profileId) {
  const profile = getProfile(profileId);
  if (!profile) return false;
  setActive(profile.id);
  return true;
}
export function signOut() { setActive(null); deletePrompt = false; signInMessage = ''; nameMatches = []; }
export function create(displayName, importGuest = false) {
  const name = String(displayName || '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80) return null;
  const guestLikes = Likes.exportState(), guestWorkspace = WorkspaceState.get();
  const profile = { id: id(), displayName: name, createdAt: new Date().toISOString(), onboarding: freshOnboarding() };
  state.profiles.push(profile);
  state.activeId = profile.id;
  persist();
  scopeChanged();
  if (importGuest) {
    Likes.importState(guestLikes);
    WorkspaceState.set(guestWorkspace);
  }
  return structuredClone(profile);
}
export function updateOnboarding(patch) {
  const profile = active();
  if (!profile) return false;
  profile.onboarding = { ...profile.onboarding, ...patch };
  persist();
  return true;
}
export function deleteCurrent() {
  const profile = active();
  if (!profile) return false;
  const profileId = profile.id;
  state.profiles = state.profiles.filter(p => p.id !== profileId);
  state.activeId = null;
  persist();
  let removed = true;
  try {
    const s = storage();
    if (s) {
      s.removeItem(`${Likes.KEY}:${profileId}`);
      s.removeItem(`${WorkspaceState.KEY}:${profileId}`);
    }
  } catch { removed = false; }
  deletePrompt = false;
  scopeChanged();
  return removed;
}

function checkedOptions(options, selected, name) {
  return `<div class="account-choices" role="group" aria-label="${esc(name)}">${options.map(([value, label]) => `<label class="account-choice"><input type="checkbox" name="${esc(name)}" value="${esc(value)}"${selected.includes(value) ? ' checked' : ''}><span>${esc(label)}</span></label>`).join('')}</div>`;
}
function options(options, selected) {
  return options.map(([value, label]) => `<option value="${esc(value)}"${selected === value ? ' selected' : ''}>${esc(label)}</option>`).join('');
}
function card(content, extra = '') {
  return `<section class="account-card ${extra}">${content}</section>`;
}
function deviceNote() {
  return `<p class="device-note" role="note">${storageAvailable() ? 'Your profile is saved on this device only. It is not a secure account and will not sync to other devices.' : 'Browser storage is unavailable. This profile will last only for this visit; it is not a secure account and will not sync to other devices.'}</p>`;
}
const PERSON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4.5 20.5c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const ARROW = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// Captain icon for the header once a profile is signed in (our own drawing, single colour, follows the text colour).
export const CAPTAIN = '<svg class="captain-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M3.6 7.7C3.6 5.1 7.4 3 12 3s8.4 2.1 8.4 4.7c0 .6-.4 1-1 1H4.6c-.6 0-1-.4-1-1zM12 4.6c-.8 0-1.5.6-1.5 1.3s.7 1.2 1.5 1.2 1.5-.5 1.5-1.2-.7-1.3-1.5-1.3z"/><path fill="currentColor" d="M6.3 9.6h11.4v1.5c0 .4-.3.7-.7.7H7c-.4 0-.7-.3-.7-.7zM7.9 12.6h8.2v.6a4.1 4.1 0 0 1-8.2 0z"/><path fill="currentColor" fill-rule="evenodd" d="M3.4 22c0-3.4 2.4-5.6 5.6-6.2l3 3.6 3-3.6c3.2.6 5.6 2.8 5.6 6.2zM15.2 19.2l1.2 1.3 1.2-1.3v-1l-1.2.9-1.2-.9z"/></svg>';
let signInMessage = '', nameMatches = [];
function profileButton(p) {
  return `<button type="button" class="profile-pick" data-account-action="sign-in" data-profile-id="${esc(p.id)}"><span class="profile-avatar" aria-hidden="true">${esc(p.displayName.trim().slice(0, 1).toUpperCase())}</span><span><strong>${esc(p.displayName)}</strong><small>${p.complete ? 'Profile ready' : 'Setup in progress'}</small></span><span aria-hidden="true">→</span></button>`;
}
function signInPage() {
  const profiles = list();
  if (active()) return profilePage();
  const picker = nameMatches.length ? profiles.filter(p => nameMatches.includes(p.id)) : profiles;
  const form = createMode
    ? `<span class="eyebrow">YOUR PERSONAL RESEARCH SPACE</span>
      <h1>Create account</h1>
      <p class="account-subtitle">Save your sailing preferences in this browser.</p>
      <form data-account-create>
        <label for="account-name">Your name</label>
        <div class="auth-input">${PERSON}<input id="account-name" name="displayName" maxlength="80" autocomplete="nickname" placeholder="Enter your name" required></div>
        ${guestDataCount().total ? `<label class="account-import"><input type="checkbox" name="importGuest"><span>Copy my current guest research (${guestDataCount().likes} Likes, ${guestDataCount().notes} notes) into this profile</span></label>` : ''}
        <button class="btn p account-submit auth-submit" type="submit">Create profile ${ARROW}</button>
      </form>
      <p class="auth-switch">Already have a profile? <button class="text-button" type="button" data-account-action="cancel-create">Sign in</button></p>`
    : `<span class="eyebrow">YOUR PERSONAL RESEARCH SPACE</span>
      <h1>Welcome back</h1>
      <p class="account-subtitle">Pick up where you left off.</p>
      <form data-account-signin novalidate>
        <label for="signin-name">Your name</label>
        <div class="auth-input">${PERSON}<input id="signin-name" name="displayName" maxlength="80" autocomplete="nickname" placeholder="Enter your name"></div>
        <p class="account-alert" role="status" aria-live="polite">${esc(signInMessage)}</p>
        <button class="btn p account-submit auth-submit" type="submit">Sign in ${ARROW}</button>
      </form>
      ${picker.length ? `<div class="profile-picker" aria-label="${nameMatches.length ? 'Profiles with that name' : 'Profiles saved on this device'}"><p class="picker-label">${nameMatches.length ? 'More than one profile has that name. Choose yours:' : 'Or choose a profile saved on this device:'}</p>${picker.map(profileButton).join('')}</div>` : ''}
      <p class="auth-switch">New to Marine Buy? <button class="text-button" type="button" data-account-action="create-mode">Create account</button></p>`;
  return `<div class="auth-page"><div class="auth-top"><a class="logo" href="#/">Marine<b>Buy</b></a><a class="auth-back" href="#/"><span aria-hidden="true">←</span> Back to exploring</a></div>
    <div class="auth-hero"><div class="auth-photo" role="img" aria-label="A catamaran under sail at sunset, mountains behind"></div>
      ${card(`${form}<hr class="auth-rule"><a class="account-guest auth-guest" href="#/">Continue exploring as a guest</a>${deviceNote()}`, 'account-panel auth-card')}
      <p class="auth-tagline">Your next adventure starts with the right gear.<br>Discover. Compare. Choose your own course.</p></div></div>`;
}
function profilePage() {
  const p = active();
  if (!p) return signInPage();
  const d = p.onboarding.data;
  const progress = p.onboarding.complete ? 'Onboarding complete' : 'Onboarding not complete';
  return `<div class="profile-page"><div class="profile-heading"><div><span class="eyebrow">LOCAL PROFILE</span><h1>My profile</h1></div><span class="saved-locally">${storageAvailable() ? 'Saved on this device' : 'Storage unavailable · changes last for this visit'}</span></div>
    ${card(`<h2>${esc(p.displayName)}</h2><p>${progress}</p>${d.activities.length ? `<p><strong>Sailing:</strong> ${esc(d.activities.map(x => ACTIVITIES.find(a => a[0] === x)?.[1] || x).join(', '))}${d.activityOther ? ` · ${esc(d.activityOther)}` : ''}</p>` : ''}
      ${d.fit.category ? `<p><strong>Fit category:</strong> ${esc(FIT_CATEGORIES.find(x => x[0] === d.fit.category)?.[1] || d.fit.category)}${d.fit.usualSize ? ` · Usual size ${esc(d.fit.usualSize)} ${esc(d.fit.sizeSystem)}` : ''}</p>` : ''}
      ${d.priorities.length ? `<p><strong>Priorities:</strong> ${esc(d.priorities.map(x => PRIORITIES.find(a => a[0] === x)?.[1] || x).join(', '))}</p>` : ''}
      ${d.preferredFit ? `<p><strong>Preferred fit:</strong> ${esc(d.preferredFit)}</p>` : ''}
      ${measurementList(d.measurements).length ? `<p><strong>Measurements:</strong> ${esc(measurementList(d.measurements).join(' · '))}</p>` : ''}
      <p class="mu">Measurements, if added, are body measurements—not garment measurements.</p>
      <div class="profile-actions">${p.onboarding.complete ? '<a class="btn p" href="#/onboarding?edit=1">Edit profile</a>' : '<a class="btn p" href="#/onboarding">Continue setup</a>'}
        <button type="button" class="btn" data-account-action="sign-out">Sign out</button>
        <button type="button" class="text-button danger-text" data-account-action="delete-prompt">Delete profile…</button></div>
      ${deletePrompt ? `<div class="delete-confirm" role="alert"><p>Delete <strong>${esc(p.displayName)}</strong> and this profile's saved Likes, notes, measurements, and preferences from this browser? This cannot be undone.</p><button type="button" class="btn danger" data-account-action="delete-confirm">Delete profile and data</button><button type="button" class="btn" data-account-action="delete-cancel">Cancel</button></div>` : ''}`)
      }${deviceNote()}</div>`;
}
/** Measurements in the profile's chosen units, e.g. "Height 5′9″ · Weight 165 lb · Chest 40 in". Shared by every profile screen. */
function measurementList(m) {
  const units = [], lu = m.lengthUnit, wu = m.weightUnit;
  if (m.heightCm != null) units.push(`Height ${formatHeight(m.heightCm, lu)}`);
  if (m.weightKg != null) units.push(`Weight ${shown(m.weightKg, wu)} ${wu}`);
  for (const area of ['chest', 'waist', 'hips']) if (m[`${area}Cm`] != null) units.push(`${area[0].toUpperCase()}${area.slice(1)} ${shown(m[`${area}Cm`], lu)} ${lu}`);
  return units;
}
function summary(data) {
  const activity = data.activities.map(x => ACTIVITIES.find(a => a[0] === x)?.[1] || x);
  const choices = data.priorities.map(x => PRIORITIES.find(a => a[0] === x)?.[1] || x);
  const units = measurementList(data.measurements);
  return `<div class="account-summary"><h2>Your profile summary</h2>
    <p><strong>Sailing activities:</strong> ${activity.length ? esc(`${activity.join(', ')}${data.activityOther ? ` · ${data.activityOther}` : ''}`) : 'Not provided'}</p>
    <p><strong>Fit:</strong> ${esc(FIT_CATEGORIES.find(x => x[0] === data.fit.category)?.[1] || 'Not provided')}${data.fit.usualSize ? ` · ${esc(data.fit.usualSize)} ${esc(data.fit.sizeSystem || '')}` : ''}${data.fit.referenceModel ? ` · Reference: ${esc(data.fit.referenceModel)}` : ''}</p>
    <p><strong>Fit challenges:</strong> ${data.challenges.length ? esc(data.challenges.map(x => CHALLENGES.find(a => a[0] === x)?.[1] || x).join(', ')) : 'Not provided'}${data.fitNotes ? ` · ${esc(data.fitNotes)}` : ''}</p>
    <p><strong>Priorities:</strong> ${choices.length ? esc(choices.join(', ')) : 'Not provided'}</p>
    <p><strong>Preferred fit:</strong> ${esc(data.preferredFit || 'Not provided')}</p>
    <p><strong>Measurements:</strong> ${units.length ? esc(units.join(' · ')) : 'Not provided'}${units.length ? ' (body measurements)' : ''}</p>
    <p class="mu">These preferences help organize research. They cannot guarantee that a jacket will fit; verified official size charts are not currently recorded.</p></div>`;
}
// Canonical storage is cm / kg; the form shows the chosen system. Ranges are the same physical limits in either unit.
const RANGES = { height: [100, 230], weight: [30, 250], chest: [50, 220], waist: [40, 220], hips: [50, 230] };
const LABELS = { height: 'Height', weight: 'Weight', chest: 'Chest', waist: 'Waist', hips: 'Hips' };
const unitFor = (name, system) => name === 'weight' ? (system === 'metric' ? 'kg' : 'lb') : (system === 'metric' ? 'cm' : 'in');
const fromCanonical = (n, unit) => unit === 'in' ? n / 2.54 : unit === 'lb' ? n * 2.2046226218 : n;
const shown = (n, unit) => n == null ? '' : String(Number(fromCanonical(n, unit).toFixed(unit === 'in' || unit === 'lb' ? 1 : 2)));
const bound = (name, unit, i) => Number(fromCanonical(RANGES[name][i], unit).toFixed(2));
function unitInput(name, value, system) {
  const unit = unitFor(name, system);
  return `<label class="measure-field" for="measure-${name}"><span class="measure-label" data-measure-label="${name}">${LABELS[name]} (${unit})</span><input id="measure-${name}" name="${name}" type="number" step="any" min="${bound(name, unit, 0)}" max="${bound(name, unit, 1)}" value="${value ?? ''}" inputmode="decimal"></label>`;
}
// Height in US units is feet + inches (1 ft = 12 in, 1 in = 2.54 cm). Canonical heightCm keeps full precision;
// only the display is rounded to whole inches, and 12 rounded inches carry into the next foot.
const HEIGHT_IN = [Math.ceil(RANGES.height[0] / 2.54), Math.floor(RANGES.height[1] / 2.54)];
export function feetInches(cm) {
  if (cm == null || !Number.isFinite(cm)) return null;
  const total = Math.round(cm / 2.54);
  return { ft: Math.floor(total / 12), in: total % 12 };
}
const ftIn = (ft, inch) => `${ft}′${inch}″`;
export function formatHeight(cm, lengthUnit) {
  if (cm == null) return '';
  if (lengthUnit === 'cm') return `${shown(cm, 'cm')} cm`;
  const h = feetInches(cm);
  return ftIn(h.ft, h.in);
}
/** Read the Feet and Inches fields. Both blank = no height (never zero). Returns { cm } or { error, field }. */
export function parseFeetInches(feetRaw, inchesRaw, bad = {}) {
  const f = String(feetRaw ?? '').trim(), i = String(inchesRaw ?? '').trim();
  if (!f && !i && !bad.feet && !bad.inches) return { cm: null };
  const whole = s => /^\d+$/.test(s);
  if (bad.feet || (f && !whole(f))) return { error: 'Feet must be a whole number, for example 5.', field: 'feet' };
  if (bad.inches || (i && !whole(i))) return { error: 'Inches must be a whole number from 0 to 11.', field: 'inches' };
  if (!f) return { error: 'Enter feet as well as inches, or leave both blank.', field: 'feet' };
  if (!i) return { error: 'Enter inches too. Use 0 for a whole number of feet, for example 6 ft 0 in.', field: 'inches' };
  if (Number(i) > 11) return { error: 'Inches must be from 0 to 11. 12 inches is 1 foot.', field: 'inches' };
  const total = Number(f) * 12 + Number(i);
  if (total < HEIGHT_IN[0] || total > HEIGHT_IN[1]) return { error: `Height must be between ${ftIn(Math.floor(HEIGHT_IN[0] / 12), HEIGHT_IN[0] % 12)} and ${ftIn(Math.floor(HEIGHT_IN[1] / 12), HEIGHT_IN[1] % 12)}. Check the feet value.`, field: 'feet' };
  return { cm: Math.round(total * 254) / 100 };
}
function heightField(cm, system) {
  if (system === 'metric') return `<div data-height-field>${unitInput('height', shown(cm, 'cm'), system)}<p class="field-error" id="height-error"></p></div>`;
  const h = feetInches(cm);
  return `<fieldset class="measure-field height-field" data-height-field><legend><span class="measure-label" data-measure-label="height">Height (ft / in)</span></legend>
    <div class="height-pair"><label for="measure-height-ft">Feet<input id="measure-height-ft" name="heightFt" type="number" inputmode="numeric" step="1" min="${Math.floor(HEIGHT_IN[0] / 12)}" max="${Math.floor(HEIGHT_IN[1] / 12)}" value="${h ? h.ft : ''}" aria-describedby="height-error"></label>
    <label for="measure-height-in">Inches<input id="measure-height-in" name="heightIn" type="number" inputmode="numeric" step="1" min="0" max="11" value="${h ? h.in : ''}" aria-describedby="height-error"></label></div>
    <p class="field-error" id="height-error"></p></fieldset>`;
}
/** Validate the height inputs as typed (nothing is rewritten). Shows the reason inline; returns { cm } or { error }. */
function checkHeight(form) {
  const ftEl = form.elements.namedItem('heightFt'), inEl = form.elements.namedItem('heightIn'), cmEl = form.elements.namedItem('height');
  const msg = form.querySelector('#height-error');
  let r;
  if (ftEl) r = parseFeetInches(ftEl.value, inEl.value, { feet: ftEl.validity.badInput, inches: inEl.validity.badInput });
  else if (cmEl) r = cmEl.validity.badInput ? { error: 'Enter height as a number of centimetres.', field: 'cm' } : { cm: (n => n == null ? null : Math.round(n * 100) / 100)(numberOrNull(cmEl.value)) };
  else return { cm: undefined };
  for (const [el, key] of [[ftEl, 'feet'], [inEl, 'inches'], [cmEl, 'cm']]) if (el) {
    const bad = !!r.error && r.field === key;
    el.setCustomValidity(bad ? r.error : '');
    bad ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid');
  }
  if (msg) msg.textContent = r.error || '';
  return r;
}
/** Block Continue/Back/Skip/unit changes while the height entry is invalid, and say why. */
function heightBlocked(form) {
  if (Number(form.dataset.step) !== 2) return false;
  const r = checkHeight(form);
  if (!r.error) return false;
  const status = form.querySelector('.account-alert');
  if (status) { delete status.dataset.tone; status.textContent = `Height: ${r.error}`; }
  form.querySelector('[aria-invalid="true"]')?.focus();
  return true;
}
function onboardingPage() {
  const p = active();
  if (!p) return signInPage();
  const edit = new URLSearchParams(location.hash.split('?')[1] || '').get('edit') === '1';
  const data = p.onboarding.data, step = Math.min(4, Math.max(0, p.onboarding.step));
  const steps = ['Sailing', 'Fit', 'Measurements', 'Challenges', 'Priorities'];
  let body = '';
  if (step === 0) body = `<h2>How do you sail?</h2><p>Select all that apply. You can skip this step.</p>${checkedOptions(ACTIVITIES, data.activities, 'activities')}<label for="activity-other">Other activity, if useful</label><input id="activity-other" name="activityOther" maxlength="160" value="${esc(data.activityOther)}">`;
  if (step === 1) body = `<h2>What fit should we keep in mind?</h2><label for="fit-category">Fit category</label><select id="fit-category" name="fitCategory"><option value="">Choose if useful</option>${options(FIT_CATEGORIES, data.fit.category)}</select>
    <div class="account-fields"><label for="usual-size">Usual jacket size <input id="usual-size" name="usualSize" maxlength="40" value="${esc(data.fit.usualSize)}" placeholder="Optional"></label>
    <label for="size-system">Size system <select id="size-system" name="sizeSystem"><option value="">Not sure / not provided</option>${options([['US','US'],['UK','UK'],['EU','EU'],['other','Other']], data.fit.sizeSystem)}</select></label></div>
    <label for="reference-model">A jacket that fits you well <input id="reference-model" name="referenceModel" maxlength="100" value="${esc(data.fit.referenceModel)}" placeholder="Brand and model (optional)"></label>`;
  if (step === 2) {
    const m = data.measurements, system = m.lengthUnit === 'cm' ? 'metric' : 'us';
    body = `<h2>Optional body measurements</h2><p>These are your body measurements, not measurements of a jacket. Leave any field blank. They stay on this device.</p>
      <div class="account-fields unit-selects"><label for="length-unit">Height and length unit <select id="length-unit" name="lengthUnit"><option value="in"${system === 'us' ? ' selected' : ''}>ft / in</option><option value="cm"${system === 'metric' ? ' selected' : ''}>cm</option></select></label>
      <label for="weight-unit">Weight unit <select id="weight-unit" name="weightUnit"><option value="lb"${system === 'us' ? ' selected' : ''}>Pounds (lb)</option><option value="kg"${system === 'metric' ? ' selected' : ''}>Kilograms (kg)</option></select></label></div>
      <p class="mu unit-hint">With ft / in, height is in feet and inches, and chest, waist and hips are in inches. Changing one unit switches both: ft / in with pounds, or centimetres with kilograms.</p>
      <div class="account-fields measurements">
      ${heightField(m.heightCm, system)}
      ${unitInput('weight', shown(m.weightKg, unitFor('weight', system)), system)}
      ${unitInput('chest', shown(m.chestCm, unitFor('chest', system)), system)}
      ${unitInput('waist', shown(m.waistCm, unitFor('waist', system)), system)}
      ${unitInput('hips', shown(m.hipsCm, unitFor('hips', system)), system)}</div>
      <p class="mu">Unusual values are not automatically adjusted. Check the units and your entry if a value falls outside the input range.</p>`;
  }
  if (step === 3) body = `<h2>Any fit challenges?</h2><p>Select all that apply. “No particular issue” excludes the other choices.</p>${checkedOptions(CHALLENGES, data.challenges, 'challenges')}<label for="fit-notes">Anything else to keep in mind (optional)</label><textarea id="fit-notes" name="fitNotes" maxlength="500" rows="3">${esc(data.fitNotes)}</textarea>`;
  if (step === 4) body = `<h2>What matters most?</h2><p>Choose up to three priorities, then your preferred fit.</p>${checkedOptions(PRIORITIES, data.priorities, 'priorities')}
    <label for="preferred-fit">Preferred fit</label><select id="preferred-fit" name="preferredFit"><option value="">No preference</option>${options([['close','Close'],['regular','Regular'],['relaxed','Relaxed'],['layered','Room for layers']], data.preferredFit)}</select>
    ${summary(data)}`;
  return `<div class="onboarding-page">${card(`<div class="profile-heading"><div><span class="eyebrow">${edit ? 'EDIT YOUR PROFILE' : 'PERSONALIZE YOUR RESEARCH'}</span><h1>${edit ? 'Edit profile' : 'Your sailing profile'}</h1></div><a href="#/profile" class="text-button">Exit setup</a></div>
      <div class="progress-label"><span>Step ${step + 1} of 5 · ${steps[step]}</span><span>${Math.round((step + 1) * 20)}%</span></div><div class="progress-track" role="progressbar" aria-label="Profile setup progress" aria-valuenow="${step + 1}" aria-valuemin="1" aria-valuemax="5"><span style="width:${(step + 1) * 20}%"></span></div>
      <form data-onboarding data-step="${step}" data-edit="${edit ? 'true' : 'false'}" data-length-unit="${data.measurements.lengthUnit}" data-weight-unit="${data.measurements.weightUnit}">${body}
        <p class="account-alert" role="status" aria-live="polite"></p>
        <div class="onboarding-actions">${step > 0 ? '<button type="button" class="btn" data-account-action="onboarding-back">Back</button>' : '<span></span>'}
          ${step < 4 ? '<button type="button" class="text-button" data-account-action="onboarding-skip">Skip this step</button><button type="submit" class="btn p">Continue</button>' : '<button type="submit" class="btn p">Finish and explore jackets</button>'}</div>
      </form>${deviceNote()}`, 'onboarding-card')}</div>`;
}
export function render(path) {
  if (path === '/onboarding') return onboardingPage();
  if (path === '/profile') return profilePage();
  return signInPage();
}
export const navText = () => active() ? 'My profile' : 'Sign in';
/** Header button: plain "Sign in", or the captain icon + "My profile" once a profile is signed in. */
export const navHtml = () => active() ? `${CAPTAIN}<span>My profile</span>` : '<span>Sign in</span>';
function updateData(patch) {
  const profile = active();
  if (!profile) return;
  updateOnboarding({ data: { ...profile.onboarding.data, ...patch } });
}
function numberOrNull(value) { if (value === '' || value == null) return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
// Only fields the person actually edited are re-read, so converting the other (rounded) displayed values never drifts the stored ones.
function readMeasurements(form) {
  const dirty = new Set((form.dataset.dirty || '').split(' ').filter(Boolean));
  const get = name => numberOrNull(form.elements.namedItem(name)?.value);
  const lengthUnit = form.dataset.lengthUnit, weightUnit = form.dataset.weightUnit, out = { ...active().onboarding.data.measurements };
  const toCm = n => n == null ? null : Number((lengthUnit === 'in' ? n * 2.54 : n).toFixed(2));
  const toKg = n => n == null ? null : Number((weightUnit === 'lb' ? n / 2.2046226218 : n).toFixed(2));
  if (dirty.has('height')) { const r = checkHeight(form); if (!r.error && r.cm !== undefined) out.heightCm = r.cm; } // an invalid entry keeps the last valid height
  if (dirty.has('weight')) out.weightKg = toKg(get('weight'));
  for (const area of ['chest', 'waist', 'hips']) if (dirty.has(area)) out[`${area}Cm`] = toCm(get(area));
  return out;
}
const saveMeasurements = form => { if (!form.dataset.dirty) return; updateData({ measurements: readMeasurements(form) }); form.dataset.dirty = ''; };
function saveForm(form) {
  const step = Number(form.dataset.step), d = active()?.onboarding.data;
  if (!d) return;
  if (step === 0) updateData({
    activities: [...form.querySelectorAll('input[name="activities"]:checked')].map(x => x.value),
    activityOther: form.elements.activityOther.value
  });
  if (step === 1) updateData({ fit: {
    category: form.elements.fitCategory.value, usualSize: form.elements.usualSize.value,
    sizeSystem: form.elements.sizeSystem.value, referenceModel: form.elements.referenceModel.value
  } });
  if (step === 2) saveMeasurements(form);
  if (step === 3) updateData({
    challenges: [...form.querySelectorAll('input[name="challenges"]:checked')].map(x => x.value),
    fitNotes: form.elements.fitNotes.value
  });
  if (step === 4) updateData({
    priorities: [...form.querySelectorAll('input[name="priorities"]:checked')].map(x => x.value).slice(0, 3),
    preferredFit: form.elements.preferredFit.value
  });
}
function workspacePriorities(data) {
  const map = { price: 'price', weight: 'weight', weather: 'weather', breathability: 'breathability', layers: 'layers', movement: 'fit' };
  const priorities = [...new Set(data.priorities.map(x => map[x]).filter(Boolean))];
  const focus = data.priorities.includes('movement') ? ['movement'] : [];
  WorkspaceState.set({ priorities, fitFocus: priorities.includes('fit') ? focus : [] });
}
function updateStep(step) {
  const profile = active();
  if (!profile) return;
  updateOnboarding({ step: Math.max(0, Math.min(4, step)) });
}
function finish(form) {
  saveForm(form);
  const profile = active();
  if (!profile) return;
  updateOnboarding({ step: 4, complete: true });
  workspacePriorities(active().onboarding.data);
  location.hash = '#/profile';
}
// Length and weight units move together: inches + pounds (US) or centimetres + kilograms (metric).
function setUnitSystem(form, system) {
  const profile = active(); if (!profile) return;
  if (heightBlocked(form)) { form.elements.lengthUnit.value = form.dataset.lengthUnit; form.elements.weightUnit.value = form.dataset.weightUnit; return; }
  saveMeasurements(form);
  const measurements = active().onboarding.data.measurements;
  const lengthUnit = system === 'metric' ? 'cm' : 'in', weightUnit = system === 'metric' ? 'kg' : 'lb';
  form.elements.lengthUnit.value = lengthUnit; form.elements.weightUnit.value = weightUnit;
  form.querySelector('[data-height-field]').outerHTML = heightField(measurements.heightCm, system);
  for (const name of Object.keys(RANGES).filter(n => n !== 'height')) {
    const input = form.elements.namedItem(name), unit = unitFor(name, system);
    const n = name === 'weight' ? measurements.weightKg : measurements[`${name}Cm`];
    input.value = shown(n, unit);
    input.min = bound(name, unit, 0); input.max = bound(name, unit, 1);
    const label = form.querySelector(`[data-measure-label="${name}"]`); if (label) label.textContent = `${LABELS[name]} (${unit})`;
  }
  form.dataset.lengthUnit = lengthUnit; form.dataset.weightUnit = weightUnit;
  updateData({ measurements: { ...measurements, lengthUnit, weightUnit, unitsChosen: true } });
  const status = form.querySelector('.account-alert');
  if (status) { status.dataset.tone = 'info'; status.textContent = system === 'metric' ? 'Units switched to centimetres and kilograms.' : 'Units switched to ft / in and pounds.'; }
}
export function handleSubmit(event) {
  const form = event.target;
  if (form.matches('[data-account-signin]')) {
    event.preventDefault();
    const name = form.elements.displayName.value.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!name) { signInMessage = 'Enter the name you used for your profile, or choose a saved profile below.'; nameMatches = []; renderCurrent(); document.querySelector('#signin-name')?.focus(); return; }
    const matches = state.profiles.filter(p => p.displayName.trim().replace(/\s+/g, ' ').toLowerCase() === name);
    if (matches.length === 1) {
      signInMessage = ''; nameMatches = [];
      signIn(matches[0].id);
      location.hash = matches[0].onboarding.complete ? '#/profile' : '#/onboarding';
      return;
    }
    nameMatches = matches.map(p => p.id);
    signInMessage = matches.length ? '' : 'No profile with that name is saved on this device. Check the spelling, or create an account.';
    renderCurrent();
    (document.querySelector('.profile-picker .profile-pick') || document.querySelector('#signin-name'))?.focus();
    return;
  }
  if (form.matches('[data-account-create]')) {
    event.preventDefault();
    const name = form.elements.displayName.value.trim();
    if (!name || name.length > 80) return;
    const created = create(name, form.elements.importGuest?.checked === true);
    if (!created) return;
    createMode = false;
    location.hash = '#/onboarding';
    return;
  }
  if (!form.matches('[data-onboarding]')) return;
  event.preventDefault();
  if (heightBlocked(form)) return;
  saveForm(form);
  if (Number(form.dataset.step) === 4) finish(form);
  else {
    updateStep(Number(form.dataset.step) + 1);
    location.hash = `#/onboarding${form.dataset.edit === 'true' ? '?edit=1' : ''}`;
    renderCurrent();
  }
}
export function handleInput(event) {
  const form = event.target.closest('[data-onboarding]');
  if (!form || !event.target.matches('input,textarea')) return;
  const field = { heightFt: 'height', heightIn: 'height', height: 'height', weight: 'weight', chest: 'chest', waist: 'waist', hips: 'hips' }[event.target.name];
  if (Number(form.dataset.step) === 2 && field) {
    form.dataset.dirty = [...new Set([...(form.dataset.dirty || '').split(' ').filter(Boolean), field])].join(' ');
    if (field === 'height') checkHeight(form);
  }
  saveForm(form);
}
export function handleChange(event) {
  const input = event.target, form = input.closest('[data-onboarding]');
  if (!form) return;
  if (input.name === 'priorities' && input.checked && form.querySelectorAll('input[name="priorities"]:checked').length > 3) {
    input.checked = false;
    const status = form.querySelector('.account-alert');
    delete status.dataset.tone;
    status.textContent = 'Choose no more than three priorities.';
    return;
  }
  if (input.name === 'challenges') {
    const none = form.querySelector('input[name="challenges"][value="none"]');
    if (input.value === 'none' && input.checked) form.querySelectorAll('input[name="challenges"]').forEach(x => { if (x !== input) x.checked = false; });
    else if (input.checked && none) none.checked = false;
  }
  if (input.name === 'lengthUnit') setUnitSystem(form, input.value === 'cm' ? 'metric' : 'us');
  else if (input.name === 'weightUnit') setUnitSystem(form, input.value === 'kg' ? 'metric' : 'us');
  else saveForm(form);
}
export function handleClick(event) {
  const button = event.target.closest('[data-account-action]');
  if (!button) return false;
  const action = button.dataset.accountAction;
  if (action === 'create-mode') { createMode = true; signInMessage = ''; nameMatches = []; renderCurrent(); document.querySelector('#account-name')?.focus(); }
  else if (action === 'cancel-create') { createMode = false; renderCurrent(); document.querySelector('#signin-name')?.focus(); }
  else if (action === 'sign-in') {
    const profileId = button.dataset.profileId;
    if (signIn(profileId)) location.hash = getProfile(profileId).onboarding.complete ? '#/profile' : '#/onboarding';
  } else if (action === 'sign-out') { signOut(); location.hash = '#/'; }
  else if (action === 'delete-prompt') { deletePrompt = true; renderCurrent(); }
  else if (action === 'delete-cancel') { deletePrompt = false; renderCurrent(); }
  else if (action === 'delete-confirm') {
    const removed = deleteCurrent();
    renderCurrent();
    const status = document.querySelector('.device-note');
    if (!removed && status) status.textContent = 'The profile was removed, but some saved browser data could not be cleared because storage is unavailable.';
  } else if (action === 'onboarding-back' || action === 'onboarding-skip') {
    const form = button.closest('[data-onboarding]');
    if (form && heightBlocked(form)) { event.preventDefault(); return true; }
    if (form) saveForm(form);
    const step = Number(form?.dataset.step || 0);
    updateStep(action === 'onboarding-back' ? step - 1 : step + 1);
    location.hash = `#/onboarding${form?.dataset.edit === 'true' ? '?edit=1' : ''}`;
    renderCurrent();
  } else return false;
  event.preventDefault();
  return true;
}
function renderCurrent() {
  const app = document.querySelector('#app');
  if (app) app.innerHTML = render(location.hash.split('?')[0].replace(/^#/, '') || '/account');
}
export function guestMigrationState() { return guestDataCount(); }
