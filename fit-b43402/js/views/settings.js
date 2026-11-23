// Settings: profile, phase, backup/restore, install, delete. Plus sources and licences.
import * as app from '../app.js';
import * as S from '../science.js';
import * as db from '../store.js';
import { switchPhase } from './checkin.js';
import { html, ic, fmt, toast, confirmSheet, parseNum } from '../ui.js';

export const title = 'Settings';

export async function render(root) {
  const st = app.state, p = st.profile;
  const phase = app.phaseNow();
  const photos = await db.listPhotoDates();
  const lastBackup = localStorage.getItem('fm:lastBackup');
  const canInstall = !!window.__installPrompt;
  const standalone = matchMedia('(display-mode: standalone)').matches;

  root.innerHTML = String(html`
    <form class="card stack" id="prof" novalidate>
      <h2>You</h2>
      <div class="two">
        <label class="field"><span>Sex</span><select class="input" name="sex"><option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option></select></label>
        <label class="field"><span>Age</span><input class="input" name="age" inputmode="numeric" value="${p.age}"></label>
        <label class="field"><span>Height (cm)</span><input class="input" name="cm" inputmode="decimal" value="${p.heightCm}"></label>
        <label class="field"><span>Start weight (kg)</span><input class="input" name="kg" inputmode="decimal" value="${p.startWeightKg}"></label>
      </div>
      <label class="field"><span>Start date</span><input class="input" type="date" name="start" value="${p.startDate}"></label>
      <label class="field"><span>How active are you?</span><select class="input" name="act">${S.ACTIVITY.map((a) => html`<option value="${a.id}" ${a.id === p.activity ? 'selected' : ''}>${a.label}</option>`)}</select></label>
      <label class="field"><span>Food</span><select class="input" name="diet"><option value="egg" ${p.diet === 'egg' ? 'selected' : ''}>Eggs + veg (no meat)</option><option value="nonveg" ${p.diet === 'nonveg' ? 'selected' : ''}>Chicken or fish too</option></select></label>
      <div class="two">
        <label class="field"><span>Food money / month (₹)</span><input class="input" name="food" inputmode="numeric" value="${p.foodBudget || ''}"></label>
        <label class="field"><span>Gym fee / month (₹)</span><input class="input" name="gym" inputmode="numeric" value="${p.gymFee || ''}"></label>
        <label class="field"><span>Bed time</span><input class="input" type="time" name="bed" value="${p.bedTime}"></label>
        <label class="field"><span>Wake time</span><input class="input" type="time" name="wake" value="${p.wakeTime}"></label>
      </div>
      <p class="muted small" style="margin:0">Saving does not change your calorie target. To change it, use the calculator on the Food screen, or let the weekly check-in do it.</p>
      <button class="btn btn-primary btn-block" type="submit">${ic('check')} Save</button>
    </form>

    <div class="card stack">
      <h2>Goal phase</h2>
      <p class="soft" style="margin:0">Now: <b>${S.PHASES[phase].name}</b> since ${fmt.short(app.state.profile.phases?.at(-1)?.from || p.startDate)}. The check-in tells you when to switch. You can also switch here.</p>
      <div class="row gap wrap">${S.PHASE_ORDER.filter((id) => id !== phase).map((id) => html`<button class="btn btn-small grow" data-phase="${id}">Switch to ${S.PHASES[id].name}</button>`)}</div>
    </div>

    <div class="card stack">
      <h2>Backup</h2>
      <p class="soft" style="margin:0">Your data is saved only on this phone (${Object.keys(st.days).length} days, ${photos.length} photo${photos.length === 1 ? '' : 's'}). If you clear the browser or lose the phone, it is gone. Save a backup file every week or two, and keep it in Google Drive.</p>
      ${lastBackup ? html`<p class="muted small" style="margin:0">Last backup: ${fmt.day(lastBackup)}</p>` : ''}
      <button class="btn btn-block" data-export>${ic('download')} Save a backup file</button>
      <label class="btn btn-block file-btn">${ic('upload')} Restore from a backup<input type="file" accept="application/json,.json" data-import></label>
    </div>

    <div class="card stack">
      <h2>Put it on your home screen</h2>
      ${standalone ? html`<p class="soft" style="margin:0">${ic('circle-check', 16, 'check')} Done. You are using the app from your home screen.</p>`
        : canInstall ? html`<button class="btn btn-primary btn-block" data-install>${ic('download')} Install the app</button>`
        : html`<p class="soft" style="margin:0">Android (Chrome): tap ⋮ at the top right, then "Add to Home screen" or "Install app". iPhone (Safari): tap Share, then "Add to Home Screen". It then opens like an app and works offline.</p>`}
    </div>

    <div class="card stack">
      <h2>About</h2>
      <p class="soft small" style="margin:0">Fit Minute v1. Built on research, not trends: see the book icon at the top for every rule and its source. Not medical advice; if you have a health condition, check with a doctor first.</p>
      <p class="muted small" style="margin:0">Food values: IFCT 2017, National Institute of Nutrition (ICMR-NIN), via the @ifct2017 data package (MIT licence). Exercises: free-exercise-db (public domain). Icons: Lucide (ISC licence).</p>
    </div>

    <div class="card stack">
      <h2>Delete everything</h2>
      <p class="muted small" style="margin:0">Removes all your logs, photos and plans from this phone. Save a backup first.</p>
      <button class="btn btn-danger btn-block" data-wipe>${ic('trash-2')} Delete all my data</button>
    </div>`);

  const form = root.querySelector('#prof');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = (n) => form.elements[n].value;
    const next = {
      ...p, sex: f('sex'), age: parseNum(f('age')), heightCm: parseNum(f('cm')), startWeightKg: parseNum(f('kg')),
      startDate: f('start') || p.startDate, activity: f('act'), diet: f('diet'), foodBudget: parseNum(f('food')) || 0,
      gymFee: parseNum(f('gym')) || 0, bedTime: f('bed') || p.bedTime, wakeTime: f('wake') || p.wakeTime,
    };
    if (!(next.age >= 14 && next.age <= 90 && next.heightCm >= 120 && next.heightCm <= 230 && next.startWeightKg >= 30 && next.startWeightKg <= 250)) {
      return toast('Check age, height and weight');
    }
    if (next.startDate !== p.startDate && next.phases?.length) next.phases = [{ ...next.phases[0], from: next.startDate }, ...next.phases.slice(1)];
    await app.saveProfile(next);
    toast('Saved');
    app.refresh();
  });

  root.querySelectorAll('[data-phase]').forEach((b) => b.addEventListener('click', () => switchPhase(b.dataset.phase, null)));

  root.querySelector('[data-export]').addEventListener('click', async () => {
    try {
      const data = await db.exportAll();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const name = `fitminute-backup-${app.today()}.json`;
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Fit Minute backup' }).catch(() => download(blob, name));
      } else download(blob, name);
      localStorage.setItem('fm:lastBackup', app.today());
      toast('Backup saved');
    } catch (err) { console.error(err); toast('Backup failed'); }
  });

  root.querySelector('[data-import]').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!(await confirmSheet('Restore this backup?', `From ${data.exportedAt ? fmt.day(data.exportedAt.slice(0, 10)) : 'an unknown date'}. It replaces what is on this phone now.`, 'Restore'))) return;
      await db.importAll(data);
      await app.load();
      toast('Backup restored');
      app.go('today');
    } catch (err) { console.error(err); toast(err.message?.includes('Fit Minute') ? err.message : 'That file could not be read'); }
  });

  root.querySelector('[data-install]')?.addEventListener('click', async () => {
    const ev = window.__installPrompt;
    if (!ev) return;
    ev.prompt();
    await ev.userChoice.catch(() => {});
    window.__installPrompt = null;
    app.refresh();
  });

  root.querySelector('[data-wipe]').addEventListener('click', async () => {
    if (!(await confirmSheet('Delete all data?', 'All logs, photos, plans and check-ins on this phone will be gone. This cannot be undone.', 'Delete', true))) return;
    if (!(await confirmSheet('Are you sure?', 'Last chance. Did you save a backup?', 'Yes, delete it all', true))) return;
    await db.wipeAll();
    await app.load();
    toast('Everything deleted');
    app.go('setup');
  });
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
