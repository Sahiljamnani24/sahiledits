// First run: a short form. A private link can pre-fill it: #setup?p=<base64url JSON>.
import * as app from '../app.js';
import * as S from '../science.js';
import { html, ic, fmt, parseNum, toast } from '../ui.js';

export const title = 'Fit Minute';

function readPrefill(params) {
  try {
    const p = params.get('p');
    if (!p) return {};
    return JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return {}; }
}

export async function render(root, params) {
  const pre = readPrefill(params);
  const v = {
    sex: pre.sex || 'male', age: pre.age ?? '', cm: pre.cm ?? '', kg: pre.kg ?? '', waist: pre.waist ?? '',
    start: pre.start || app.today(), act: pre.act || 'moderate', phase: pre.phase || 'cut', diet: pre.diet || '',
    food: pre.food ?? '', gym: pre.gym ?? '', bed: pre.bed || '23:00', wake: pre.wake || '07:30',
  };

  const choice = (name, options, current) => html`<div class="choice" data-choice="${name}">${options.map(([val, label, sub]) => html`
    <button type="button" class="${val === current ? 'on' : ''}" data-val="${val}">${label}${sub ? html`<small>${sub}</small>` : ''}</button>`)}</div>`;

  root.innerHTML = String(html`
    <div class="hero">
      <h1>Set up in 30 seconds</h1>
      <p>Your numbers stay on this phone. The app uses them for your calorie and protein targets.</p>
    </div>
    <form class="form" id="setup" novalidate>
      <div class="card stack">
        <div class="field"><span>Sex (the formula needs it)</span>${choice('sex', [['male', 'Male'], ['female', 'Female']], v.sex)}</div>
        <div class="two">
          <label class="field"><span>Age</span><input class="input" name="age" inputmode="numeric" value="${v.age}" placeholder="22"></label>
          <label class="field"><span>Weight (kg)</span><input class="input" name="kg" inputmode="decimal" value="${v.kg}" placeholder="73"></label>
        </div>
        <div class="field">
          <span>Height</span>
          <div class="two">
            <label class="row"><input class="input" name="cm" inputmode="decimal" value="${v.cm}" placeholder="178"><span class="muted">cm</span></label>
            <div class="row"><input class="input input-sm" name="ft" inputmode="numeric" placeholder="ft" aria-label="feet"><input class="input input-sm" name="in" inputmode="numeric" placeholder="in" aria-label="inches"></div>
          </div>
          <small>Type cm, or feet and inches.</small>
        </div>
        <label class="field"><span>Waist at the belly button (cm), optional</span>
          <input class="input" name="waist" inputmode="decimal" value="${v.waist}" placeholder="e.g. 86">
          <small>Tape around the belly button, standing relaxed, breathe out. The best simple belly-fat check.</small>
        </label>
      </div>

      <div class="card stack">
        <label class="field"><span>How active are you?</span>
          <select class="input" name="act">${S.ACTIVITY.map((a) => html`<option value="${a.id}" ${a.id === v.act ? 'selected' : ''}>${a.label}</option>`)}</select>
        </label>
        <div class="field"><span>Goal to start with</span>${choice('phase', [['cut', 'Lose belly fat', 'then build muscle'], ['build', 'Build muscle', 'already lean']], v.phase)}</div>
        <label class="field"><span>Start date</span><input class="input" type="date" name="start" value="${v.start}"></label>
      </div>

      <div class="card stack">
        <div class="field"><span>Do you eat chicken or fish?</span>${choice('diet', [['nonveg', 'Yes', 'chicken, fish, eggs'], ['egg', 'No', 'eggs + veg only']], v.diet)}</div>
        <div class="two">
          <label class="field"><span>Food money / month (₹)</span><input class="input" name="food" inputmode="numeric" value="${v.food}" placeholder="7000"></label>
          <label class="field"><span>Gym fee / month (₹)</span><input class="input" name="gym" inputmode="numeric" value="${v.gym}" placeholder="3000"></label>
        </div>
        <div class="two">
          <label class="field"><span>Bed time</span><input class="input" type="time" name="bed" value="${v.bed}"></label>
          <label class="field"><span>Wake time</span><input class="input" type="time" name="wake" value="${v.wake}"></label>
        </div>
      </div>

      <div class="card" id="preview"></div>
      <button class="btn btn-primary btn-block" type="submit">${ic('check')} Start</button>
      <p class="muted small center">Not medical advice. If you have a health condition, check with a doctor first.</p>
    </form>`);

  const form = root.querySelector('#setup');
  const chosen = { sex: v.sex, phase: v.phase, diet: v.diet };
  form.querySelectorAll('[data-choice]').forEach((box) => box.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-val]');
    if (!b) return;
    chosen[box.dataset.choice] = b.dataset.val;
    box.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    preview();
  }));
  const f = (name) => form.elements[name];
  const feetToCm = () => {
    const ft = parseNum(f('ft').value), inch = parseNum(f('in').value) || 0;
    if (ft > 0) { f('cm').value = (Math.round((ft * 30.48 + inch * 2.54) * 10) / 10).toString(); preview(); }
  };
  f('ft').addEventListener('input', feetToCm);
  f('in').addEventListener('input', feetToCm);
  form.addEventListener('input', preview);

  function values() {
    return {
      sex: chosen.sex, age: parseNum(f('age').value), heightCm: parseNum(f('cm').value), weightKg: parseNum(f('kg').value),
      waistCm: parseNum(f('waist').value) || null, activity: f('act').value, phase: chosen.phase, diet: chosen.diet,
      startDate: f('start').value || app.today(), foodBudget: parseNum(f('food').value) || 0, gymFee: parseNum(f('gym').value) || 0,
      bedTime: f('bed').value || '23:00', wakeTime: f('wake').value || '07:30',
    };
  }
  function problems(x) {
    const out = [];
    if (!(x.age >= 14 && x.age <= 90)) out.push('age');
    if (!(x.heightCm >= 120 && x.heightCm <= 230)) out.push('height');
    if (!(x.weightKg >= 30 && x.weightKg <= 250)) out.push('weight');
    if (x.waistCm && !(x.waistCm >= 40 && x.waistCm <= 200)) out.push('waist');
    if (!x.diet) out.push('chicken/fish question');
    return out;
  }
  function preview() {
    const x = values();
    const box = root.querySelector('#preview');
    if (problems(x).filter((p) => p !== 'chicken/fish question').length) {
      box.innerHTML = String(html`<p class="muted small" style="margin:0">Fill in age, height and weight to see your targets.</p>`);
      return;
    }
    const t = S.calcTargets({ ...x, weightKg: x.weightKg });
    box.innerHTML = String(html`
      <div class="kicker">Your start</div>
      <div class="big-pair mt">
        <div class="big"><div class="label">Calories</div><div class="value">${fmt.int(t.kcal)}<small>kcal</small></div></div>
        <div class="big"><div class="label">Protein</div><div class="value">${t.proteinG}<small>g</small></div></div>
      </div>
      <p class="muted small mt" style="margin-bottom:0">Resting burn ${fmt.int(t.bmr)} × ${t.factor} = ${fmt.int(t.tdee)} kcal a day. ${x.phase === 'cut' ? `Minus ${fmt.int(-t.dailyDelta)} to lose about ${Math.abs(t.rateKgWk).toFixed(1)} kg a week.` : `Plus ${fmt.int(t.dailyDelta)} to gain slowly.`}</p>`);
  }
  preview();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const x = values();
    const bad = problems(x);
    if (bad.length) { toast(`Please check: ${bad.join(', ')}`); return; }
    try {
      await app.createProfile(x);
      history.replaceState(null, '', location.pathname + location.search + '#today');
      toast('All set. Log your first day!');
      app.go('today');
    } catch (err) {
      console.error(err);
      toast('Could not save. Is the phone storage full?');
    }
  });
}
