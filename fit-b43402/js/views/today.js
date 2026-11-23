// Today: the 1-minute daily log. Weight, sleep, meals, workout, photo.
import * as app from '../app.js';
import * as S from '../science.js';
import * as db from '../store.js';
import { EXTRAS } from '../foods.js';
import { NOTES } from '../notes.js';
import { html, ic, fmt, toast, sheet, stepper, bindSteppers, parseNum } from '../ui.js';

let open = null;      // open tile id
let openFor = null;   // date that `open` belongs to
let photoUrl = null;  // object URL of the shown photo

const ORDER = ['weight', 'sleep', 'photo'];

export function header() {
  const st = app.state, d = st.viewDate, t = app.today();
  const wk = S.weekOf(st.profile.startDate, d);
  const short = { cut: 'Lose fat', reset: 'Reset', build: 'Build muscle' }[S.currentPhase(st.profile, d).phase];
  const where = wk >= 1 ? `Week ${wk} · ${short}` : `Plan starts ${fmt.short(st.profile.startDate)}`;
  return html`<div class="date-nav">
    <button class="icon-btn" data-day="-1" aria-label="Previous day">${ic('chevron-left')}</button>
    <div style="min-width:0"><h1>${d === t ? 'Today' : fmt.day(d)}</h1><div class="sub">${d === t ? fmt.day(d) + ' · ' : ''}${where}</div></div>
    <button class="icon-btn" data-day="1" aria-label="Next day" ${d >= t ? 'disabled' : ''}>${ic('chevron-right')}</button>
  </div>`;
}

export function bindHeader(head) {
  head.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
    const next = S.addDays(app.state.viewDate, Number(b.dataset.day));
    if (next > app.today()) return;
    app.state.viewDate = next;
    open = null;
    app.refresh();
  }));
}

function lastWeightBefore(iso) {
  const pts = app.points().filter((p) => p.date < iso);
  return pts.length ? pts.at(-1).w : app.state.profile.startWeightKg;
}

function planDay(iso) {
  return app.state.workout?.days?.[S.weekday(iso)] || { rest: true, title: 'Rest', exercises: [] };
}

function status(day, iso) {
  const meals = app.state.plan?.meals || [];
  const eaten = meals.filter((m) => day.meals?.[m.id]).length;
  const pd = planDay(iso);
  return {
    weight: day.w != null,
    sleep: day.sleep != null,
    meals: meals.length > 0 && eaten >= meals.length,
    workout: pd.rest || !!day.workout,
    photo: !!day.photo,
    eaten,
  };
}

export async function render(root) {
  const st = app.state;
  const iso = st.viewDate;
  const day = st.days[iso] || {};
  const done = status(day, iso);
  if (openFor !== iso) { openFor = iso; open = ORDER.find((k) => !done[k] && k !== 'photo') || null; }

  const t = st.targets;
  const mealKcal = app.planMealKcal();
  const intake = S.dayIntake(day, mealKcal);
  const nDone = ['weight', 'sleep', 'meals', 'workout', 'photo'].filter((k) => done[k]).length;
  const streak = S.streak(st.days, app.today());
  const pd = planDay(iso);
  const defaultSleep = S.sleepHours(st.profile.bedTime, st.profile.wakeTime);
  const tipIdx = ((S.daysBetween(st.profile.startDate, iso) % NOTES.length) + NOTES.length) % NOTES.length;
  const tip = NOTES[tipIdx];

  const meter = (label, value, target, unit) => {
    const pct = target ? Math.min(100, (value / target) * 100) : 0;
    return html`<div class="meter">
      <span class="label">${label}</span><span class="value"><b>${fmt.int(value)}</b> <span class="muted">/ ${fmt.int(target)} ${unit}</span></span>
      <div class="track"><div class="fill ${value > target * 1.05 ? 'over' : ''}" style="width:${pct.toFixed(1)}%"></div></div>
    </div>`;
  };

  const tile = (id, icon, title, sub, value, isDone, body, alwaysOpen = false) => {
    const isOpen = alwaysOpen || open === id;
    const inner = html`
        <span class="tile-icon">${ic(icon)}</span>
        <span class="tile-title"><b>${title}</b><small>${sub}</small></span>
        <span class="tile-value ${value ? '' : 'muted'}">${value || ''}</span>
        ${isDone ? ic('circle-check', 22, 'check') : alwaysOpen ? '' : ic('chevron-down', 20, 'muted chev')}`;
    return html`<section class="tile ${isDone ? 'done' : ''}" data-tile="${id}">
      ${alwaysOpen ? html`<div class="tile-head">${inner}</div>`
        : html`<button class="tile-head" data-toggle="${id}" aria-expanded="${isOpen}">${inner}</button>`}
      ${isOpen ? html`<div class="tile-body">${body}</div>` : ''}
    </section>`;
  };

  const meals = st.plan?.meals || [];
  const extras = day.extras || [];

  root.innerHTML = String(html`
    <div class="card summary">
      <div class="row between">
        <div class="row"><b>${nDone} of 5 done</b><div class="dots">${[0, 1, 2, 3, 4].map((i) => html`<i class="${i < nDone ? 'on' : ''}"></i>`)}</div></div>
        ${streak > 1 ? html`<span class="badge good">${ic('flame', 14)} ${streak}-day streak</span>` : ''}
      </div>
      ${meter('Calories eaten', intake.kcal, t.kcal, 'kcal')}
      ${meter('Protein', intake.p, t.proteinG, 'g')}
    </div>

    ${tile('weight', 'weight', 'Weight', 'Morning, after the toilet, before food', day.w != null ? `${fmt.kg(day.w)} kg` : 'Add', done.weight, html`
      ${stepper({ id: 'w-in', value: day.w ?? lastWeightBefore(iso), step: 0.1, min: 30, max: 250, unit: 'kg', label: 'Weight in kg' })}
      <div class="row gap">
        <button class="btn btn-primary grow" data-save="weight">${ic('check')} Save weight</button>
        ${day.w != null ? html`<button class="btn" data-clear="w" aria-label="Remove weight">${ic('trash-2')}</button>` : ''}
      </div>
      <p class="muted small" style="margin:0">One day means little. The 7-day average on Progress shows the real trend.</p>`)}

    ${tile('sleep', 'moon', 'Sleep', 'Last night, in hours', day.sleep != null ? `${day.sleep} h` : 'Add', done.sleep, html`
      ${stepper({ id: 's-in', value: day.sleep ?? defaultSleep, step: 0.5, min: 0, max: 14, unit: 'h', label: 'Sleep in hours' })}
      <div class="row gap">
        <button class="btn btn-primary grow" data-save="sleep">${ic('check')} Save sleep</button>
        ${day.sleep != null ? html`<button class="btn" data-clear="sleep" aria-label="Remove sleep">${ic('trash-2')}</button>` : ''}
      </div>
      <p class="muted small" style="margin:0">Aim for 7–9 h. Short sleep makes a diet burn muscle instead of fat.</p>`)}

    ${tile('meals', 'utensils', 'Meals', `${done.eaten} of ${meals.length} planned · ${fmt.int(intake.kcal)} kcal`, '', done.meals, html`
      <div class="chips">${meals.map((m) => {
        const k = mealKcal[m.id];
        return html`<button class="chip ${day.meals?.[m.id] ? 'on' : ''}" data-meal="${m.id}" aria-pressed="${!!day.meals?.[m.id]}">
          <b>${m.name}</b><small>${fmt.int(k.kcal)} kcal · ${Math.round(k.p)} g protein</small></button>`;
      })}</div>
      ${extras.length ? html`<div class="extras">${extras.map((x, i) => html`
        <div class="extra"><span>${x.name}</span><span class="muted num">${fmt.int(x.kcal)} kcal</span>
        <button class="icon-btn" data-del-extra="${i}" aria-label="Remove ${x.name}">${ic('x', 18)}</button></div>`)}</div>` : ''}
      <button class="btn btn-block" data-add-extra>${ic('plus')} Ate something else</button>`, true)}

    ${tile('workout', 'dumbbell', 'Workout', pd.rest ? 'Rest day · walk 8–10k steps' : `${pd.title} · ${pd.exercises.length} exercises`,
      day.workout === 'done' ? 'Done' : day.workout === 'skipped' ? 'Skipped' : pd.rest ? 'Rest' : '', done.workout, pd.rest ? html`
      <button class="btn btn-block ${day.workout === 'done' ? 'btn-primary' : ''}" data-workout="done">${ic('dumbbell')} ${day.workout === 'done' ? 'Trained today' : 'I trained anyway'}</button>` : html`
      <div class="row gap">
        <button class="btn grow ${day.workout === 'done' ? 'btn-primary' : ''}" data-workout="done">${ic('check')} Done</button>
        <button class="btn grow ${day.workout === 'skipped' ? 'btn-danger' : ''}" data-workout="skipped">Skipped</button>
      </div>
      <a class="btn btn-ghost btn-block" href="#gym">See today's exercises ${ic('chevron-right', 18)}</a>`, true)}

    ${tile('photo', 'camera', 'Progress photo', 'Same spot, same light, same pose', day.photo ? 'Saved' : 'Add', done.photo, html`
      ${day.photo ? html`<div class="photo-box"><img id="today-photo" alt="Progress photo for ${fmt.day(iso)}"></div>` : ''}
      <div class="row gap">
        <label class="btn ${day.photo ? '' : 'btn-primary'} grow file-btn">${ic('camera')} ${day.photo ? 'Retake' : "Add today's photo"}
          <input type="file" accept="image/*" data-photo aria-label="Choose a photo"></label>
        ${day.photo ? html`<button class="btn" data-del-photo aria-label="Delete photo">${ic('trash-2')}</button>` : ''}
      </div>
      <p class="muted small" style="margin:0">Morning, before food, relaxed. Front and side if you like; one a day is enough.</p>`)}

    <a class="card tip-card" href="#science?n=${tip.id}" style="text-decoration:none;color:inherit">
      <div class="kicker">Science tip</div>
      <h3 style="margin:6px 0 4px">${tip.title}</h3>
      <p class="soft small" style="margin:0">${tip.text}</p>
    </a>`);

  bindSteppers(root);
  if (day.photo) showPhoto(root, iso);

  root.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
    open = open === b.dataset.toggle ? null : b.dataset.toggle;
    app.refresh();
  }));

  const after = async (patch, msg) => {
    try {
      await app.saveDay(iso, patch);
      const now = status(app.state.days[iso], iso);
      open = ORDER.find((k) => !now[k]) || null;
      if (msg) toast(msg);
      app.refresh();
    } catch (err) { console.error(err); toast('Could not save. Phone storage may be full.'); }
  };

  root.querySelector('[data-save="weight"]')?.addEventListener('click', () => {
    const w = parseNum(root.querySelector('#w-in').value);
    if (!(w >= 30 && w <= 250)) return toast('Type your weight in kg, like 73.4');
    after({ w: Math.round(w * 10) / 10 }, 'Weight saved');
  });
  root.querySelector('[data-save="sleep"]')?.addEventListener('click', () => {
    const h = parseNum(root.querySelector('#s-in').value);
    if (!(h >= 0 && h <= 16)) return toast('Type hours of sleep, like 7.5');
    after({ sleep: Math.round(h * 2) / 2 }, 'Sleep saved');
  });
  root.querySelectorAll('[data-clear]').forEach((b) => b.addEventListener('click', () => after({ [b.dataset.clear]: undefined })));

  root.querySelectorAll('[data-meal]').forEach((b) => b.addEventListener('click', () => {
    const meals = { ...(day.meals || {}) };
    meals[b.dataset.meal] = !meals[b.dataset.meal];
    after({ meals });
  }));
  root.querySelectorAll('[data-del-extra]').forEach((b) => b.addEventListener('click', () => {
    const list = [...extras];
    list.splice(Number(b.dataset.delExtra), 1);
    after({ extras: list });
  }));
  root.querySelector('[data-add-extra]')?.addEventListener('click', () => extraSheet(iso, extras));

  root.querySelectorAll('[data-workout]').forEach((b) => b.addEventListener('click', () => {
    const v = b.dataset.workout;
    after({ workout: day.workout === v ? undefined : v }, v === 'done' && day.workout !== 'done' ? 'Nice work 💪' : '');
  }));

  root.querySelector('[data-photo]')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast('Saving photo…');
      const blob = await shrinkPhoto(file);
      await db.savePhoto(iso, blob);
      after({ photo: true }, 'Photo saved');
    } catch (err) { console.error(err); toast('Could not read that photo. Try again.'); }
  });
  root.querySelector('[data-del-photo]')?.addEventListener('click', async () => {
    await db.deletePhoto(iso);
    after({ photo: undefined }, 'Photo deleted');
  });
}

async function showPhoto(root, iso) {
  const blob = await db.getPhoto(iso);
  const img = root.querySelector('#today-photo');
  if (!blob || !img) return;
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = URL.createObjectURL(blob);
  img.src = photoUrl;
}

// Photos are shrunk to 1080 px (long side) JPEG: about 150–300 KB each, ~50 MB for 6 months.
export async function shrinkPhoto(file, max = 1080) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.82));
}

function extraSheet(iso, extras) {
  sheet('Ate something else', html`
    <p class="muted small" style="margin:0">Rough numbers are fine. The check-in uses them to see if the plan or the target needs fixing.</p>
    <div class="preset-grid">${EXTRAS.map((x, i) => html`<button class="btn" data-preset="${i}">${x.name}<small>${x.kcal} kcal</small></button>`)}</div>
    <div class="hr"></div>
    <div class="kicker">Something else</div>
    <label class="field"><span>What was it?</span><input class="input" id="x-name" placeholder="e.g. 2 parathas"></label>
    <div class="two">
      <label class="field"><span>Calories</span><input class="input" id="x-kcal" inputmode="numeric" placeholder="300"></label>
      <label class="field"><span>Protein (g)</span><input class="input" id="x-p" inputmode="numeric" placeholder="optional"></label>
    </div>
    <button class="btn btn-primary btn-block" data-custom>${ic('plus')} Add</button>`, {
    onMount: (dlg, close) => {
      const add = async (item) => {
        await app.saveDay(iso, { extras: [...extras, item] });
        close();
        toast(`Added ${item.name}`);
        app.refresh();
      };
      dlg.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => add({ ...EXTRAS[Number(b.dataset.preset)] })));
      dlg.querySelector('[data-custom]').addEventListener('click', () => {
        const name = dlg.querySelector('#x-name').value.trim() || 'Extra food';
        const kcal = parseNum(dlg.querySelector('#x-kcal').value);
        const p = parseNum(dlg.querySelector('#x-p').value) || 0;
        if (!(kcal > 0 && kcal < 5000)) return toast('Type the calories, like 300');
        add({ name: name.slice(0, 60), kcal: Math.round(kcal), p: Math.round(p) });
      });
    },
  });
}
