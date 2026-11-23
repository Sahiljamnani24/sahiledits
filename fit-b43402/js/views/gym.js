// Gym: the weekly split, today's exercises with working weights, live weekly-set count, and an editor.
import * as app from '../app.js';
import * as S from '../science.js';
import { WEEK, MUSCLES, REST_OPTIONS, GYM_RULES, DEFAULT_WORKOUT, toMuscles } from '../workouts.js';
import { html, ic, fmt, toast, sheet, confirmSheet, parseNum } from '../ui.js';

export const title = 'Gym';

let sel = null;        // selected weekday (0-6)
let editing = null;    // draft copy of the plan while editing
let library = null;    // data/exercises.json, loaded when needed
let beforeSwitch = null; // saves typed edits before changing day

async function loadLibrary() {
  if (!library) library = await (await fetch('data/exercises.json')).json();
  return library;
}

export async function render(root) {
  const st = app.state;
  const todayWd = S.weekday(app.today());
  if (sel == null) sel = todayWd;
  const plan = editing || st.workout;
  const day = plan.days[sel] || { title: 'Rest', rest: true, exercises: [] };
  const isToday = sel === todayWd;
  const logged = st.days[app.today()]?.workout;
  const sets = S.weeklySets(plan);
  const order = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'];
  const big = ['chest', 'back', 'shoulders', 'quads', 'hamstrings'];

  root.innerHTML = String(html`
    <div class="days" role="tablist">${WEEK.map((w) => {
      const d = plan.days[w.id];
      return html`<button role="tab" aria-selected="${w.id === sel}" class="${w.id === sel ? 'on' : ''} ${d?.rest ? 'rest' : ''} ${w.id === todayWd ? 'today' : ''}" data-wd="${w.id}">
        <small>${w.id === todayWd ? 'Today' : w.short}</small><b>${d?.rest ? 'Rest' : d?.title || '–'}</b></button>`;
    })}</div>

    ${editing ? editView(day) : html`
    <div class="card">
      <div class="card-head">
        <div><div class="kicker">${WEEK.find((w) => w.id === sel).long}</div><h2 style="margin-top:2px">${day.rest ? 'Rest day' : day.title}</h2></div>
        <button class="btn btn-small" data-edit>${ic('pencil', 16)} Edit plan</button>
      </div>
      ${day.rest ? html`<p class="soft" style="margin:0">Recover. Walk 8,000–10,000 steps, eat your protein, sleep 7–9 hours. Muscles grow on rest days.</p>`
        : html`<div>${day.exercises.map((e, i) => html`
          <div class="ex">
            <div class="ex-top">
              <span class="ex-n">${i + 1}</span>
              <div class="ex-name"><b>${e.name}</b><small>${e.sets} × ${e.reps} · rest ${e.rest} · ${e.muscles.map((m) => MUSCLES[m]).join(', ')}</small></div>
              <button class="btn btn-small btn-ghost" data-how="${i}" aria-label="How to do ${e.name}">${ic('info', 18)}</button>
            </div>
            ${e.step > 0 ? html`<div class="ex-kg">
              <button class="step-btn" data-kg="${i}" data-dir="-1" aria-label="Less weight">${ic('minus', 20)}</button>
              <label class="row" style="gap:6px;justify-content:center"><input class="input" data-kg-in="${i}" inputmode="decimal" value="${e.kg ?? ''}" placeholder="kg" aria-label="Weight for ${e.name} in kg"><span class="muted small">kg</span></label>
              <button class="step-btn" data-kg="${i}" data-dir="1" aria-label="Add ${e.step} kg">${ic('plus', 20)}</button>
            </div>` : ''}
          </div>`)}</div>
          ${isToday ? html`<button class="btn btn-block mt ${logged === 'done' ? '' : 'btn-primary'}" data-done>${ic('check')} ${logged === 'done' ? 'Workout logged for today' : 'Mark workout done'}</button>` : ''}`}
    </div>`}

    <div class="card">
      <div class="card-head"><h2>Hard sets per week</h2><a class="link-btn" href="#science?n=volume">Why?</a></div>
      <div class="musc">${order.map((m) => {
        const n = sets[m] || 0;
        const low = big.includes(m) ? n < 9 : n < 4;
        return html`<span class="${low ? 'low' : ''}">${MUSCLES[m]} ${n}</span>`;
      })}</div>
      <p class="muted small" style="margin:10px 0 0">About 10–20 hard sets per muscle a week builds muscle well. Arms, calves and abs also get work from the big lifts.</p>
    </div>

    <div class="card">
      <h2>How to train</h2>
      <ol class="steps">${GYM_RULES.map((r) => html`<li>${r}</li>`)}</ol>
    </div>`);

  root.querySelectorAll('[data-wd]').forEach((b) => b.addEventListener('click', () => {
    if (editing) beforeSwitch?.();
    sel = Number(b.dataset.wd);
    app.refresh();
  }));
  if (editing) return bindEdit(root, day);

  root.querySelector('[data-edit]')?.addEventListener('click', () => { editing = structuredClone(st.workout); app.refresh(); });
  root.querySelector('[data-done]')?.addEventListener('click', async () => {
    const cur = st.days[app.today()]?.workout;
    await app.saveDay(app.today(), { workout: cur === 'done' ? undefined : 'done' });
    toast(cur === 'done' ? 'Unmarked' : 'Workout logged 💪');
    app.refresh();
  });
  root.querySelectorAll('[data-how]').forEach((b) => b.addEventListener('click', () => howTo(day.exercises[Number(b.dataset.how)])));

  const saveKg = async (i, kg) => {
    const w = structuredClone(st.workout);
    w.days[sel].exercises[i].kg = kg;
    await app.saveWorkout(w);
  };
  root.querySelectorAll('[data-kg]').forEach((b) => b.addEventListener('click', async () => {
    const i = Number(b.dataset.kg);
    const e = day.exercises[i];
    const input = root.querySelector(`[data-kg-in="${i}"]`);
    const cur = parseNum(input.value);
    const next = Math.max(0, Math.round(((Number.isFinite(cur) && input.value !== '' ? cur : 0) + Number(b.dataset.dir) * e.step) * 100) / 100);
    input.value = String(next);
    await saveKg(i, next);
  }));
  root.querySelectorAll('[data-kg-in]').forEach((input) => input.addEventListener('change', async () => {
    const v = parseNum(input.value);
    await saveKg(Number(input.dataset.kgIn), input.value === '' || !Number.isFinite(v) ? null : Math.max(0, v));
  }));
}

// ---------- editor ----------
function editView(day) {
  return html`<div class="card stack">
    <div class="card-head" style="margin:0">
      <h2>Edit ${WEEK.find((w) => w.id === sel).long}</h2>
      <button class="btn btn-small" data-rest>${day.rest ? 'Make it a gym day' : 'Make it a rest day'}</button>
    </div>
    ${day.rest ? html`<p class="muted" style="margin:0">Rest day. Pick another day above, or make this a gym day.</p>` : html`
      <label class="field"><span>Day name</span><input class="input" data-title value="${day.title}"></label>
      ${day.exercises.map((e, i) => html`<div class="edit-ex" data-i="${i}">
        <div class="row"><input class="input grow" data-f="name" value="${e.name}" aria-label="Exercise name">
          <button class="icon-btn" data-move="-1" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${ic('arrow-up', 18)}</button>
          <button class="icon-btn" data-move="1" aria-label="Move down" ${i === day.exercises.length - 1 ? 'disabled' : ''}>${ic('arrow-down', 18)}</button>
          <button class="icon-btn" data-del aria-label="Delete">${ic('trash-2', 18)}</button></div>
        <div class="edit-row">
          <label class="field"><span class="tiny">Sets</span><input class="input input-sm" data-f="sets" inputmode="numeric" value="${e.sets}"></label>
          <label class="field"><span class="tiny">Reps</span><input class="input input-sm" data-f="reps" value="${e.reps}"></label>
          <label class="field"><span class="tiny">Rest</span><select class="input input-sm" data-f="rest">${REST_OPTIONS.map((r) => html`<option ${r === e.rest ? 'selected' : ''}>${r}</option>`)}</select></label>
        </div>
        <div class="two">
          <label class="field"><span class="tiny">Muscle</span><select class="input input-sm" data-f="muscle">${Object.entries(MUSCLES).map(([id, name]) => html`<option value="${id}" ${e.muscles[0] === id ? 'selected' : ''}>${name}</option>`)}</select></label>
          <label class="field"><span class="tiny">Weight step</span><select class="input input-sm" data-f="step">${[[0, 'No weight'], [1, '1 kg'], [2.5, '2.5 kg'], [5, '5 kg']].map(([v, l]) => html`<option value="${v}" ${e.step === v ? 'selected' : ''}>${l}</option>`)}</select></label>
        </div>
      </div>`)}
      <div class="two">
        <button class="btn" data-pick>${ic('plus')} From list</button>
        <button class="btn" data-custom>${ic('pencil')} Custom</button>
      </div>`}
    <div class="hr" style="margin:4px 0"></div>
    <div class="row gap"><button class="btn btn-primary grow" data-save>${ic('check')} Save plan</button><button class="btn grow" data-cancel>Cancel</button></div>
    <button class="btn btn-ghost btn-small" data-reset>Reset the whole plan to the default</button>
  </div>`;
}

function bindEdit(root, day) {
  const sync = () => {
    const t = root.querySelector('[data-title]');
    if (t) day.title = t.value.trim().slice(0, 30) || 'Workout';
    root.querySelectorAll('.edit-ex').forEach((box) => {
      const e = day.exercises[Number(box.dataset.i)];
      const f = (n) => box.querySelector(`[data-f="${n}"]`).value;
      e.name = f('name').trim().slice(0, 60) || 'Exercise';
      e.sets = Math.min(10, Math.max(1, Math.round(parseNum(f('sets')) || 3)));
      e.reps = f('reps').trim().slice(0, 12) || '8–12';
      e.rest = f('rest');
      e.muscles = [f('muscle')];
      e.step = Number(f('step'));
    });
  };
  const redraw = () => app.refresh();
  beforeSwitch = sync;
  root.querySelector('[data-rest]')?.addEventListener('click', () => {
    sync();
    day.rest = !day.rest;
    if (!day.rest && (!day.title || day.title === 'Rest')) day.title = 'Workout';
    redraw();
  });
  root.querySelectorAll('.edit-ex').forEach((box) => {
    const i = Number(box.dataset.i);
    box.querySelector('[data-del]').addEventListener('click', () => { sync(); day.exercises.splice(i, 1); redraw(); });
    box.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => {
      sync();
      const j = i + Number(b.dataset.move);
      [day.exercises[i], day.exercises[j]] = [day.exercises[j], day.exercises[i]];
      redraw();
    }));
  });
  root.querySelector('[data-custom]')?.addEventListener('click', () => {
    sync();
    day.exercises.push({ id: 'c' + Date.now(), name: 'New exercise', exId: null, sets: 3, reps: '8–12', rest: '2 min', muscles: ['other'], step: 2.5, kg: null });
    redraw();
  });
  root.querySelector('[data-pick]')?.addEventListener('click', () => { sync(); pickExercise(day); });
  root.querySelector('[data-save]').addEventListener('click', async () => {
    sync();
    await app.saveWorkout(editing);
    editing = null;
    toast('Plan saved');
    redraw();
  });
  root.querySelector('[data-cancel]').addEventListener('click', () => { editing = null; redraw(); });
  root.querySelector('[data-reset]').addEventListener('click', async () => {
    if (!(await confirmSheet('Reset the plan?', 'This puts back the default 5-day plan and clears your saved weights.', 'Reset', true))) return;
    editing = null;
    await app.saveWorkout(structuredClone(DEFAULT_WORKOUT));
    toast('Default plan back');
    redraw();
  });
}

async function pickExercise(day) {
  const lib = await loadLibrary();
  let muscle = 'all', q = '';
  sheet('Add an exercise', html`
    <input class="input" id="q" placeholder="Search, e.g. row, curl, squat" autocomplete="off">
    <div class="filter-row" id="mf">${['all', ...Object.keys(MUSCLES).filter((m) => m !== 'other')].map((m) => html`<button data-m="${m}" class="${m === 'all' ? 'on' : ''}">${m === 'all' ? 'All' : MUSCLES[m]}</button>`)}</div>
    <div class="ex-pick" id="list"></div>`, {
    onMount: (dlg, close) => {
      const list = dlg.querySelector('#list');
      const draw = () => {
        const words = q.toLowerCase().split(/\s+/).filter(Boolean);
        const rows = lib.filter((e) => (muscle === 'all' || e.m === muscle) && words.every((w) => e.n.toLowerCase().includes(w))).slice(0, 60);
        list.innerHTML = rows.length ? String(html`${rows.map((e) => html`<button data-id="${e.id}">${e.n}<small>${MUSCLES[e.m] || 'Other'} · ${e.e} · ${e.l}</small></button>`)}`)
          : '<p class="muted center">Nothing found.</p>';
      };
      dlg.querySelector('#q').addEventListener('input', (e) => { q = e.target.value; draw(); });
      dlg.querySelector('#mf').addEventListener('click', (e) => {
        const b = e.target.closest('[data-m]');
        if (!b) return;
        muscle = b.dataset.m;
        dlg.querySelectorAll('#mf button').forEach((x) => x.classList.toggle('on', x === b));
        draw();
      });
      list.addEventListener('click', (e) => {
        const b = e.target.closest('[data-id]');
        if (!b) return;
        const ex = lib.find((x) => x.id === b.dataset.id);
        const bodyOnly = ex.e === 'body only';
        day.exercises.push({ id: 'c' + Date.now(), name: ex.n, exId: ex.id, sets: 3, reps: bodyOnly ? '8–15' : '8–12', rest: '2 min', muscles: toMuscles(ex.m), step: bodyOnly ? 0 : 2.5, kg: null });
        close();
        app.refresh();
      });
      draw();
    },
  });
}

async function howTo(e) {
  let steps = [];
  try {
    const lib = await loadLibrary();
    steps = lib.find((x) => x.id === e.exId)?.s || [];
  } catch { /* offline and not cached */ }
  sheet(e.name, html`
    <p class="soft" style="margin:0">${e.sets} sets × ${e.reps} reps · rest ${e.rest}. Stop each set when you could do only 1–3 more good reps.</p>
    ${steps.length ? html`<ol class="howto">${steps.map((s) => html`<li>${s}</li>`)}</ol>` : html`<p class="muted">No steps saved for this one. Ask a trainer to check your form the first time.</p>`}
    ${e.kg != null ? html`<p class="muted small" style="margin:0">Your weight: ${fmt.kg(e.kg)} kg. When you hit ${String(e.reps).split('–').pop()} reps on every set, add ${e.step} kg.</p>` : ''}
    <p class="muted tiny" style="margin:0">Steps from free-exercise-db (public domain).</p>`);
}
