// Weight chart: daily weigh-ins (dots), 7-day average (line), target path (dashed).
// Follows the dataviz rules: 2px lines, 8px dots with a surface ring, hairline solid grid,
// legend for every series, value at the line end, crosshair + tooltip on touch/hover.
import { addDays, daysBetween } from './science.js';
import { esc, fmt } from './ui.js';

const C = { avg: '#65a30d', target: '#3987e5', dot: '#868c96', surface: '#15171a', grid: 'rgba(255,255,255,0.07)', axis: '#868c96' };

export function weightChartLegend() {
  return `<div class="legend" aria-hidden="true">
    <span><svg width="12" height="12"><circle cx="6" cy="6" r="4" fill="${C.dot}"/></svg>Daily weigh-in</span>
    <span><svg width="18" height="12"><path d="M1 6h16" stroke="${C.avg}" stroke-width="2" stroke-linecap="round"/></svg>7-day average</span>
    <span><svg width="18" height="12"><path d="M1 6h16" stroke="${C.target}" stroke-width="2" stroke-dasharray="4 3"/></svg>Target</span>
  </div>`;
}

// data: { points:[{date,w}], avg:[{date,avg}], target:[{date,kg}], from, to }
export function drawWeightChart(box, data) {
  const W = Math.max(280, Math.round(box.clientWidth || 340));
  const H = 230;
  const m = { l: 38, r: 40, t: 12, b: 26 };
  const { from, to } = data;
  const span = Math.max(1, daysBetween(from, to));
  const inRange = (d) => d >= from && d <= to;
  const pts = data.points.filter((p) => inRange(p.date));
  const avg = data.avg.filter((p) => inRange(p.date));
  const target = clipPath(data.target, from, to);

  const vals = [...pts.map((p) => p.w), ...avg.map((p) => p.avg), ...target.map((p) => p.kg)];
  if (!vals.length) { box.innerHTML = '<p class="muted center pad">Log your weight to see the graph.</p>'; return; }
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(0.3, (hi - lo) * 0.12);
  lo -= pad; hi += pad;
  const step = niceStep((hi - lo) / 4);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;

  const x = (iso) => m.l + (daysBetween(from, iso) / span) * (W - m.l - m.r);
  const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
  const line = (arr, key) => arr.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p[key]).toFixed(1)}`).join('');

  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Weight graph. Values are in the weekly table below.">`;
  for (let v = lo; v <= hi + 1e-9; v += step) {
    s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}" stroke-width="1"/>`;
    s += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" class="tick">${step < 1 ? v.toFixed(1) : Math.round(v)}</text>`;
  }
  const ticks = Math.min(4, Math.max(2, Math.floor((W - m.l - m.r) / 80)));
  for (let i = 0; i <= ticks; i++) {
    const d = addDays(from, Math.round((span * i) / ticks));
    s += `<text x="${x(d)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === ticks ? 'end' : 'middle'}" class="tick">${fmt.short(d)}</text>`;
  }
  if (target.length > 1) s += `<path d="${line(target, 'kg')}" fill="none" stroke="${C.target}" stroke-width="2" stroke-dasharray="4 3" stroke-linecap="round"/>`;
  for (const p of pts) s += `<circle cx="${x(p.date)}" cy="${y(p.w)}" r="4" fill="${C.dot}" stroke="${C.surface}" stroke-width="2"/>`;
  if (avg.length > 1) s += `<path d="${line(avg, 'avg')}" fill="none" stroke="${C.avg}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  if (avg.length) {
    const last = avg.at(-1);
    s += `<circle cx="${x(last.date)}" cy="${y(last.avg)}" r="4" fill="${C.avg}" stroke="${C.surface}" stroke-width="2"/>`;
    s += `<text x="${x(last.date) + 7}" y="${y(last.avg) + 4}" class="endlabel">${fmt.kg(last.avg)}</text>`;
  }
  s += `<line class="xhair" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" stroke="rgba(255,255,255,.35)" stroke-width="1" visibility="hidden"/>`;
  s += `<rect class="hit" x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent"/></svg>`;
  box.innerHTML = s + '<div class="tip" hidden></div>';

  // Crosshair: snap to the nearest day that has a weigh-in or an average.
  const dates = [...new Set([...pts.map((p) => p.date), ...avg.map((p) => p.date)])].sort();
  const svg = box.querySelector('svg');
  const hair = box.querySelector('.xhair');
  const tip = box.querySelector('.tip');
  const byDate = (arr, d) => arr.find((p) => p.date === d);
  const show = (clientX) => {
    if (!dates.length) return;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = dates[0];
    for (const d of dates) if (Math.abs(x(d) - px) < Math.abs(x(best) - px)) best = d;
    const p = byDate(pts, best), a = byDate(avg, best), t = targetAt(data.target, best);
    hair.setAttribute('x1', x(best)); hair.setAttribute('x2', x(best)); hair.setAttribute('visibility', 'visible');
    tip.innerHTML = `<div class="tip-date">${esc(fmt.day(best))}</div>`
      + (p ? `<div><b>${fmt.kg(p.w)} kg</b> <i class="k k-dot"></i>weigh-in</div>` : '')
      + (a ? `<div><b>${fmt.kg(a.avg)} kg</b> <i class="k k-avg"></i>7-day avg</div>` : '')
      + (t != null ? `<div><b>${fmt.kg(t)} kg</b> <i class="k k-target"></i>target</div>` : '');
    tip.hidden = false;
    const left = (x(best) / W) * rect.width;
    tip.style.left = `${Math.min(Math.max(left - tip.offsetWidth / 2, 0), rect.width - tip.offsetWidth)}px`;
  };
  const hide = () => { hair.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  svg.addEventListener('pointerdown', (e) => show(e.clientX));
  svg.addEventListener('pointermove', (e) => show(e.clientX));
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('pointercancel', hide);
}

function niceStep(raw) {
  for (const s of [0.2, 0.5, 1, 2, 5, 10]) if (raw <= s) return s;
  return 20;
}

function targetAt(path, iso) {
  if (!path.length || iso < path[0].date || iso > path.at(-1).date) return null;
  for (let i = 1; i < path.length; i++) {
    if (iso <= path[i].date) {
      const a = path[i - 1], b = path[i];
      return a.kg + (b.kg - a.kg) * (daysBetween(a.date, iso) / Math.max(1, daysBetween(a.date, b.date)));
    }
  }
  return path.at(-1).kg;
}

// Keep the target line inside the visible range, with exact end points.
function clipPath(path, from, to) {
  if (!path.length) return [];
  const out = [];
  const a = targetAt(path, from);
  if (a != null) out.push({ date: from, kg: a });
  for (const p of path) if (p.date > from && p.date < to) out.push(p);
  const b = targetAt(path, to);
  if (b != null) out.push({ date: to, kg: b });
  return out;
}

// Horizontal bars for "cheapest protein". Single series: no legend; value at the bar tip.
export function costBars(rows, valueKey, label) {
  const max = Math.max(...rows.map((r) => r[valueKey]));
  return `<div class="bars">${rows.map((r) => {
    const pct = Math.max(2, (r[valueKey] / max) * 100);
    return `<div class="bar-row" title="${esc(r.name)}: ${esc(label(r))}">
      <span class="bar-name">${esc(r.name)}</span>
      <span class="bar-track"><span class="bar" style="width:${pct.toFixed(1)}%"></span><span class="bar-val">${esc(label(r))}</span></span>
    </div>`;
  }).join('')}</div>`;
}
