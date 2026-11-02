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
  measurements: { lengthUnit: 'cm', weightUnit: 'kg', heightCm: null, weightKg: null, chestCm: null, waistCm: null, hipsCm: null },
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
              measurements: {
                lengthUnit: m.lengthUnit === 'in' ? 'in' : 'cm', weightUnit: m.weightUnit === 'lb' ? 'lb' : 'kg',
                ...Object.fromEntries(MEASUREMENT_KEYS.map(key => [key, Number.isFinite(m[key]) ? m[key] : null]))
              },
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
export function signOut() { setActive(null); deletePrompt = false; }
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
function signInPage() {
  const profiles = list();
  if (active()) return profilePage();
  return `<div class="account-shell"><div class="account-scene" aria-hidden="true"><span>MAKE ROOM FOR THE JOURNEY</span></div>
    ${card(`<span class="eyebrow">YOUR PERSONAL RESEARCH SPACE</span>
      <h1>${createMode ? 'Create a local profile' : 'Welcome back'}</h1>
      <p class="account-subtitle">${createMode ? 'Save your sailing preferences in this browser.' : 'Choose a profile saved on this device.'}</p>
      ${createMode ? `<form data-account-create>
        <label for="account-name">Display name</label><input id="account-name" name="displayName" maxlength="80" autocomplete="nickname" required>
        ${guestDataCount().total ? `<label class="account-import"><input type="checkbox" name="importGuest"><span>Copy my current guest research (${guestDataCount().likes} Likes, ${guestDataCount().notes} notes) into this profile</span></label>` : ''}
        <button class="btn p account-submit" type="submit">Create profile</button>
        <button class="text-button" type="button" data-account-action="cancel-create">Back to sign in</button>
      </form>` : `${profiles.length ? `<div class="profile-picker" aria-label="Saved profiles">${profiles.map(p => `<button type="button" class="profile-pick" data-account-action="sign-in" data-profile-id="${esc(p.id)}"><span class="profile-avatar" aria-hidden="true">${esc(p.displayName.trim().slice(0, 1).toUpperCase())}</span><span><strong>${esc(p.displayName)}</strong><small>${p.complete ? 'Profile ready' : 'Setup in progress'}</small></span><span aria-hidden="true">→</span></button>`).join('')}</div>` : `<div class="empty account-empty">No profiles are saved on this device yet.</div>`}
        <button type="button" class="btn p account-submit" data-account-action="create-mode">Create account</button>`}
      ${deviceNote()}
      <a class="account-guest" href="#/">Continue browsing as a guest</a>`, 'account-panel')}
    </div>`;
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
      <p class="mu">Measurements, if added, are body measurements—not garment measurements.</p>
      <div class="profile-actions">${p.onboarding.complete ? '<a class="btn p" href="#/onboarding?edit=1">Edit profile</a>' : '<a class="btn p" href="#/onboarding">Continue setup</a>'}
        <button type="button" class="btn" data-account-action="sign-out">Sign out</button>
        <button type="button" class="text-button danger-text" data-account-action="delete-prompt">Delete profile…</button></div>
      ${deletePrompt ? `<div class="delete-confirm" role="alert"><p>Delete <strong>${esc(p.displayName)}</strong> and this profile's saved Likes, notes, measurements, and preferences from this browser? This cannot be undone.</p><button type="button" class="btn danger" data-account-action="delete-confirm">Delete profile and data</button><button type="button" class="btn" data-account-action="delete-cancel">Cancel</button></div>` : ''}`)
      }${deviceNote()}</div>`;
}
function summary(data) {
  const activity = data.activities.map(x => ACTIVITIES.find(a => a[0] === x)?.[1] || x);
  const choices = data.priorities.map(x => PRIORITIES.find(a => a[0] === x)?.[1] || x);
  const measurements = data.measurements, units = [];
  if (measurements.heightCm != null) units.push(`Height ${measurements.heightCm} cm`);
  if (measurements.weightKg != null) units.push(`Weight ${measurements.weightKg} kg`);
  for (const area of ['chest', 'waist', 'hips']) if (measurements[`${area}Cm`] != null) units.push(`${area[0].toUpperCase()}${area.slice(1)} ${measurements[`${area}Cm`]} cm`);
  return `<div class="account-summary"><h2>Your profile summary</h2>
    <p><strong>Sailing activities:</strong> ${activity.length ? esc(`${activity.join(', ')}${data.activityOther ? ` · ${data.activityOther}` : ''}`) : 'Not provided'}</p>
    <p><strong>Fit:</strong> ${esc(FIT_CATEGORIES.find(x => x[0] === data.fit.category)?.[1] || 'Not provided')}${data.fit.usualSize ? ` · ${esc(data.fit.usualSize)} ${esc(data.fit.sizeSystem || '')}` : ''}${data.fit.referenceModel ? ` · Reference: ${esc(data.fit.referenceModel)}` : ''}</p>
    <p><strong>Fit challenges:</strong> ${data.challenges.length ? esc(data.challenges.map(x => CHALLENGES.find(a => a[0] === x)?.[1] || x).join(', ')) : 'Not provided'}${data.fitNotes ? ` · ${esc(data.fitNotes)}` : ''}</p>
    <p><strong>Priorities:</strong> ${choices.length ? esc(choices.join(', ')) : 'Not provided'}</p>
    <p><strong>Preferred fit:</strong> ${esc(data.preferredFit || 'Not provided')}</p>
    <p><strong>Measurements:</strong> ${units.length ? esc(units.join(' · ')) : 'Not provided'}${units.length ? ' (body measurements)' : ''}</p>
    <p class="mu">These preferences help organize research. They cannot guarantee that a jacket will fit; verified official size charts are not currently recorded.</p></div>`;
}
function unitInput(id, label, value, unit, min, max) {
  return `<label class="measure-field" for="measure-${id}">${label} (${unit})<input id="measure-${id}" name="${id}" type="number" step="any" min="${min}" max="${max}" value="${value ?? ''}" inputmode="decimal"></label>`;
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
    const m = data.measurements, lu = m.lengthUnit || 'cm', wu = m.weightUnit || 'kg';
    const display = (n, to) => n == null ? '' : String(Number((to === 'in' ? n / 2.54 : to === 'lb' ? n * 2.2046226218 : n).toFixed(2)));
    body = `<h2>Optional body measurements</h2><p>These are your body measurements, not measurements of a jacket. Leave any field blank. They stay on this device.</p>
      <div class="account-fields unit-selects"><label for="length-unit">Length unit <select id="length-unit" name="lengthUnit"><option value="cm"${lu === 'cm' ? ' selected' : ''}>Centimetres (cm)</option><option value="in"${lu === 'in' ? ' selected' : ''}>Inches (in)</option></select></label>
      <label for="weight-unit">Weight unit <select id="weight-unit" name="weightUnit"><option value="kg"${wu === 'kg' ? ' selected' : ''}>Kilograms (kg)</option><option value="lb"${wu === 'lb' ? ' selected' : ''}>Pounds (lb)</option></select></label></div>
      <div class="account-fields measurements">
      ${unitInput('height', 'Height', display(m.heightCm, lu), lu, lu === 'cm' ? 100 : 39.37, lu === 'cm' ? 230 : 90.55)}
      ${unitInput('weight', 'Weight', display(m.weightKg, wu), wu, wu === 'kg' ? 30 : 66.14, wu === 'kg' ? 250 : 551.16)}
      ${unitInput('chest', 'Chest', display(m.chestCm, lu), lu, lu === 'cm' ? 50 : 19.69, lu === 'cm' ? 220 : 86.61)}
      ${unitInput('waist', 'Waist', display(m.waistCm, lu), lu, lu === 'cm' ? 40 : 15.75, lu === 'cm' ? 220 : 86.61)}
      ${unitInput('hips', 'Hips', display(m.hipsCm, lu), lu, lu === 'cm' ? 50 : 19.69, lu === 'cm' ? 230 : 90.55)}</div>
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
function updateData(patch) {
  const profile = active();
  if (!profile) return;
  updateOnboarding({ data: { ...profile.onboarding.data, ...patch } });
}
function numberOrNull(value) { if (value === '' || value == null) return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
function readMeasurements(form) {
  const get = name => numberOrNull(form.elements.namedItem(name)?.value);
  const lengthUnit = form.elements.lengthUnit.value, weightUnit = form.elements.weightUnit.value;
  const toCm = n => n == null ? null : Number((lengthUnit === 'in' ? n * 2.54 : n).toFixed(2));
  const toKg = n => n == null ? null : Number((weightUnit === 'lb' ? n / 2.2046226218 : n).toFixed(2));
  return { ...active().onboarding.data.measurements, lengthUnit, weightUnit,
    heightCm: toCm(get('height')), weightKg: toKg(get('weight')), chestCm: toCm(get('chest')),
    waistCm: toCm(get('waist')), hipsCm: toCm(get('hips')) };
}
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
  if (step === 2 && form.dataset.measurementsDirty === 'true') {
    updateData({ measurements: readMeasurements(form) });
    form.dataset.measurementsDirty = 'false';
  }
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
function convertUnit(form, kind, value) {
  const key = kind === 'length' ? 'lengthUnit' : 'weightUnit', dataKey = kind === 'length' ? 'lengthUnit' : 'weightUnit';
  const old = form.dataset[key] || active()?.onboarding.data.measurements[dataKey] || (kind === 'length' ? 'cm' : 'kg');
  const next = value;
  if (old === next) return;
  const measurements = active().onboarding.data.measurements;
  const names = kind === 'length' ? ['height', 'chest', 'waist', 'hips'] : ['weight'];
  for (const name of names) {
    const input = form.elements.namedItem(name);
    const n = kind === 'length' ? measurements[`${name}Cm`] : measurements.weightKg;
    if (n != null) input.value = String(Number((kind === 'length' ? next === 'in' ? n / 2.54 : n : next === 'lb' ? n * 2.2046226218 : n).toFixed(2)));
    input.min = kind === 'length' ? (next === 'cm' ? (name === 'height' ? 100 : name === 'waist' ? 40 : 50) : (name === 'height' ? 39.37 : name === 'waist' ? 15.75 : 19.69)) : next === 'kg' ? 30 : 66.14;
    input.max = kind === 'length' ? (next === 'cm' ? (name === 'height' ? 230 : name === 'hips' ? 230 : 220) : (name === 'height' ? 90.55 : name === 'hips' ? 90.55 : 86.61)) : next === 'kg' ? 250 : 551.16;
    input.setAttribute('aria-label', `${name[0].toUpperCase()}${name.slice(1)} (${next})`);
  }
  form.dataset[key] = next;
  updateData({ measurements: { ...measurements, [dataKey]: next } });
}
export function handleSubmit(event) {
  const form = event.target;
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
  if (Number(form.dataset.step) === 2 && ['height', 'weight', 'chest', 'waist', 'hips'].includes(event.target.name)) {
    form.dataset.measurementsDirty = 'true';
  }
  saveForm(form);
}
export function handleChange(event) {
  const input = event.target, form = input.closest('[data-onboarding]');
  if (!form) return;
  if (input.name === 'priorities' && input.checked && form.querySelectorAll('input[name="priorities"]:checked').length > 3) {
    input.checked = false;
    const status = form.querySelector('.account-alert');
    status.textContent = 'Choose no more than three priorities.';
    return;
  }
  if (input.name === 'challenges') {
    const none = form.querySelector('input[name="challenges"][value="none"]');
    if (input.value === 'none' && input.checked) form.querySelectorAll('input[name="challenges"]').forEach(x => { if (x !== input) x.checked = false; });
    else if (input.checked && none) none.checked = false;
  }
  if (input.name === 'lengthUnit') convertUnit(form, 'length', input.value);
  else if (input.name === 'weightUnit') convertUnit(form, 'weight', input.value);
  else saveForm(form);
}
export function handleClick(event) {
  const button = event.target.closest('[data-account-action]');
  if (!button) return false;
  const action = button.dataset.accountAction;
  if (action === 'create-mode') { createMode = true; renderCurrent(); }
  else if (action === 'cancel-create') { createMode = false; renderCurrent(); }
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
