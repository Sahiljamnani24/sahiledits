// Progress: stats, weight graph (daily dots + 7-day line + target), weekly table, photos side by side.
import * as app from '../app.js';
import * as S from '../science.js';
import * as db from '../store.js';
import { drawWeightChart, weightChartLegend } from '../chart.js';
import { html, ic, fmt } from '../ui.js';

export const title = 'Progress';

let range = '4w';
let left = null, right = null;
const urls = [];

export async function render(root) {
  const st = app.state, p = st.profile, today = app.today();
  const pts = app.points();
  const avg = S.rollingAvg(pts);
  const path = S.targetPath(p, pts);
  const weeks = S.weeklyAverages(pts, p.startDate, today);
  const cur = avg.at(-1)?.avg ?? null;
  const thisWk = weeks.find((w) => w.week === S.weekOf(p.startDate, today));
  const lastWk = weeks.find((w) => w.week === S.weekOf(p.startDate, today) - 1);
  const waist = app.latestWaist();
  const firstWaist = Object.entries(st.days).filter(([, d]) => d.waist).sort()[0];
  const targetNow = S.targetOn(path, today);
  const photos = await db.listPhotoDates();
  if (!photos.includes(left)) left = photos[0] ?? null;
  if (!photos.includes(right)) right = photos.at(-1) ?? null;

  // Last 7 days
  const last7 = Array.from({ length: 7 }, (_, i) => S.addDays(today, -i));
  const trainDays = last7.filter((d) => !st.workout.days[S.weekday(d)]?.rest);
  const trained = last7.filter((d) => st.days[d]?.workout === 'done').length;
  const sleeps = last7.map((d) => st.days[d]?.sleep).filter((v) => v != null);
  const mealsPlanned = (st.plan?.meals?.length || 0) * 7;
  const mealsTicked = last7.reduce((n, d) => n + Object.values(st.days[d]?.meals || {}).filter(Boolean).length, 0);

  const stat = (label, value, unit, delta) => html`<div class="stat"><div class="label">${label}</div>
    <div class="value">${value}${unit && value !== '–' ? html`<small>${unit}</small>` : ''}</div>${delta ? html`<div class="delta">${delta}</div>` : ''}</div>`;

  root.innerHTML = String(html`
    <div class="stats">
      ${stat('7-day average', fmt.kg(cur), 'kg', targetNow != null ? `Target today ${fmt.kg(targetNow)} kg` : '')}
      ${stat('Since start', cur != null ? fmt.delta(cur - p.startWeightKg) : '–', 'kg', `Started at ${fmt.kg(p.startWeightKg)} kg`)}
      ${stat('This week vs last', thisWk && lastWk ? fmt.delta(thisWk.avg - lastWk.avg) : '–', 'kg', thisWk ? `${thisWk.n} weigh-in${thisWk.n === 1 ? '' : 's'} this week` : 'No weigh-ins yet')}
      ${stat('Waist', waist ? fmt.kg(waist.cm) : '–', 'cm', waist && firstWaist && firstWaist[0] !== waist.date ? `${fmt.delta(waist.cm - firstWaist[1].waist)} cm since ${fmt.short(firstWaist[0])}` : 'Measure at the check-in')}
    </div>

    <div class="card">
      <h2>Weight</h2>
      <div class="seg" role="group" aria-label="Range" style="margin-bottom:12px">
        ${[['4w', '4 weeks'], ['3m', '3 months'], ['plan', 'Whole plan']].map(([id, label]) => html`<button class="${range === id ? 'on' : ''}" data-range="${id}">${label}</button>`)}
      </div>
      <div id="legend"></div>
      <div class="chart-box" id="chart"></div>
      <p class="muted small" style="margin:8px 0 0">Dots jump with water and salt. Trust the green line. Touch the graph to read a day.</p>
    </div>

    <div class="card">
      <h2>Weekly averages</h2>
      ${weeks.length ? html`<table class="table">
        <thead><tr><th>Week</th><th>Dates</th><th class="r">Average</th><th class="r">Change</th><th class="r">Target</th></tr></thead>
        <tbody>${weeks.slice().reverse().map((w, i, arr) => {
          const prev = arr[i + 1];
          const tgt = S.targetOn(path, w.to);
          return html`<tr>
            <td>${w.week}${w.partial ? html` <span class="muted tiny">so far</span>` : ''}</td>
            <td class="muted">${fmt.short(w.from)}</td>
            <td class="r"><b>${fmt.kg(w.avg)}</b></td>
            <td class="r ${prev ? (w.avg - prev.avg < 0 ? 'good' : '') : ''}">${prev ? fmt.delta(w.avg - prev.avg) : '–'}</td>
            <td class="r muted">${fmt.kg(tgt)}</td></tr>`;
        })}</tbody></table>` : html`<p class="muted">Weigh in for a few mornings to see your weekly averages.</p>`}
    </div>

    <div class="card">
      <h2>Photos side by side</h2>
      ${photos.length >= 1 ? html`
        <div class="photo-pair">
          ${['left', 'right'].map((side) => {
            const sel = side === 'left' ? left : right;
            return html`<figure>
              <div class="ph" id="ph-${side}">${sel ? '' : 'No photo'}</div>
              <select class="input input-sm" data-side="${side}" aria-label="${side === 'left' ? 'Before' : 'After'} photo date">
                ${photos.map((d) => html`<option value="${d}" ${d === sel ? 'selected' : ''}>${fmt.day(d)}</option>`)}
              </select>
            </figure>`;
          })}
        </div>
        ${photos.length < 2 ? html`<p class="muted small mt" style="margin-bottom:0">Add photos on more days to compare.</p>` : ''}`
      : html`<p class="muted" style="margin:0">Add a photo on the Today screen. After a few weeks, fat loss shows here before it shows on the scale.</p>`}
    </div>

    <div class="card">
      <h2>Last 7 days</h2>
      <div class="stack">
        <div class="row between"><span class="soft">${ic('dumbbell', 18)}</span><span class="grow">Workouts</span><b class="num">${trained} of ${trainDays.length}</b></div>
        <div class="row between"><span class="soft">${ic('moon', 18)}</span><span class="grow">Average sleep</span><b class="num">${sleeps.length ? (sleeps.reduce((a, b) => a + b, 0) / sleeps.length).toFixed(1) + ' h' : '–'}</b></div>
        <div class="row between"><span class="soft">${ic('utensils', 18)}</span><span class="grow">Planned meals ticked</span><b class="num">${mealsTicked} of ${mealsPlanned}</b></div>
      </div>
    </div>`);

  // Chart
  const end = S.addDays(p.startDate, S.PROGRAM_WEEKS * 7);
  let from, to;
  if (range === 'plan') { from = p.startDate; to = end; }
  else {
    const back = range === '4w' ? 28 : 91;
    to = S.addDays(today, range === '4w' ? 7 : 14);
    from = S.addDays(to, -back - 7);
    if (from < p.startDate) from = p.startDate;
  }
  root.querySelector('#legend').innerHTML = weightChartLegend();
  const box = root.querySelector('#chart');
  const draw = () => drawWeightChart(box, { points: pts, avg, target: path, from, to });
  draw();
  const ro = new ResizeObserver(() => { if (box.isConnected) draw(); else ro.disconnect(); });
  ro.observe(box);

  root.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => { range = b.dataset.range; app.refresh(); }));
  root.querySelectorAll('[data-side]').forEach((s) => s.addEventListener('change', () => {
    if (s.dataset.side === 'left') left = s.value; else right = s.value;
    showPhotos(root);
  }));
  showPhotos(root);
}

async function showPhotos(root) {
  while (urls.length) URL.revokeObjectURL(urls.pop());
  for (const [side, date] of [['left', left], ['right', right]]) {
    const box = root.querySelector(`#ph-${side}`);
    if (!box || !date) continue;
    const blob = await db.getPhoto(date);
    if (!blob) { box.textContent = 'Photo missing'; continue; }
    const url = URL.createObjectURL(blob);
    urls.push(url);
    box.innerHTML = String(html`<img src="${url}" alt="Progress photo ${fmt.day(date)}">`);
  }
}
