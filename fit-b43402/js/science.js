// All the maths. Pure functions: no screen, no storage. Tested in tests/science.test.js.
// Every number here comes from a study listed in js/notes.js.

export const KCAL_PER_KG = 7700; // rough energy in 1 kg of body weight change (Hall 2008)

// Activity factors used with Mifflin-St Jeor (the common 6-level calculator scale).
export const ACTIVITY = [
  { id: 'sedentary', f: 1.2, label: 'Desk job, no exercise' },
  { id: 'light', f: 1.375, label: 'Desk job + exercise 1–3 days a week' },
  { id: 'moderate', f: 1.465, label: 'Desk job + gym 4–5 days a week' },
  { id: 'active', f: 1.55, label: 'Gym 6–7 days, or on your feet + gym' },
  { id: 'very', f: 1.725, label: 'Physical job + hard training' },
];

// Weekly rate goals in % of body weight. min/max = the "on track" band.
//   cut:   0.5–1% a week keeps muscle (Garthe 2011, Helms 2014). We aim for 0.7%.
//   build: 0.25–0.5% a week for beginners (Iraki 2019). We aim for 0.25% to stay lean.
export const PHASES = {
  cut: { id: 'cut', name: 'Lose belly fat', rate: -0.7, min: -1.0, max: -0.5, proteinPerKg: 2.0 },
  reset: { id: 'reset', name: 'Reset (hold weight)', rate: 0, min: -0.25, max: 0.25, proteinPerKg: 1.8 },
  build: { id: 'build', name: 'Build muscle', rate: 0.25, min: 0.1, max: 0.5, proteinPerKg: 1.8 },
};
export const PHASE_ORDER = ['cut', 'reset', 'build'];
export const DEFAULT_TIMELINE = { cut: 12, reset: 2, build: 12 }; // weeks; 26 weeks ≈ 6 months
export const PROGRAM_WEEKS = 26;
export const LEAN_WAIST_RATIO = 0.45; // our lean goal. Health line is 0.5 (Ashwell 2012).
export const HEALTH_WAIST_RATIO = 0.5;

// ---------- dates (local calendar days as 'YYYY-MM-DD'; maths in UTC so no clock shifts) ----------
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
export function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const toUtc = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fromUtc = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
export const addDays = (iso, n) => fromUtc(toUtc(iso) + n * DAY);
export const daysBetween = (a, b) => Math.round((toUtc(b) - toUtc(a)) / DAY);
export const weekday = (iso) => new Date(toUtc(iso)).getUTCDay(); // 0 = Sunday
export const weekOf = (startIso, iso) => Math.floor(daysBetween(startIso, iso) / 7) + 1; // week 1 = first 7 days
export function weekRange(startIso, n) {
  const from = addDays(startIso, (n - 1) * 7);
  return { from, to: addDays(from, 6) };
}

// ---------- small helpers ----------
export const round = (x, step = 1) => Math.round(x / step) * step;
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// ---------- energy ----------
// Mifflin MD, St Jeor ST, et al. Am J Clin Nutr 1990. Resting burn in kcal/day.
export function bmrMifflin({ sex, kg, cm, age }) {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'female' ? -161 : 5);
}

// We never suggest eating below your resting burn (and never below 1,500 men / 1,200 women).
export function calorieFloor(bmr, sex) {
  return Math.max(round(bmr, 50), sex === 'female' ? 1200 : 1500);
}

export function activityOf(id) {
  return ACTIVITY.find((a) => a.id === id) || ACTIVITY[2];
}

// Daily targets from the profile. Returns every step so the app can show the working.
export function calcTargets({ sex, age, heightCm, weightKg, activity, phase }) {
  const act = activityOf(activity);
  const ph = PHASES[phase] || PHASES.cut;
  const bmr = bmrMifflin({ sex, kg: weightKg, cm: heightCm, age });
  const tdee = bmr * act.f;
  const rateKgWk = (ph.rate / 100) * weightKg;
  const dailyDelta = (rateKgWk * KCAL_PER_KG) / 7;
  const kcalRaw = tdee + dailyDelta;
  const floor = calorieFloor(bmr, sex);
  const kcal = Math.max(round(kcalRaw, 50), floor);
  return { phase: ph.id, bmr, tdee, factor: act.f, activityLabel: act.label, rateKgWk, dailyDelta, kcalRaw, kcal, floor, ...macros(kcal, weightKg, ph.id) };
}

// Protein: 1.6–2.2 g/kg covers almost all of the muscle benefit (Morton 2018).
// We use 2.0 g/kg while losing fat (higher protects muscle, Helms 2014) and 1.8 g/kg otherwise.
// Fat: 0.8 g/kg (never under 0.6). Carbs: the rest. Fiber: 14 g per 1,000 kcal.
export function macros(kcal, weightKg, phase = 'cut') {
  const ph = PHASES[phase] || PHASES.cut;
  const proteinG = round(ph.proteinPerKg * weightKg, 5);
  const fatG = round(0.8 * weightKg, 1);
  const carbsG = Math.max(0, round((kcal - proteinG * 4 - fatG * 9) / 4, 5));
  return {
    proteinG,
    proteinRange: [round(1.6 * weightKg, 5), round(2.2 * weightKg, 5)],
    fatG,
    carbsG,
    fiberG: round((kcal / 1000) * 14, 1),
    waterL: round((weightKg * 35 + 500) / 1000, 0.5),
  };
}

// ---------- weight series ----------
// days: { 'YYYY-MM-DD': { w: 73.1, ... } } -> sorted [{ date, w }]
export function weighIns(days) {
  return Object.entries(days || {})
    .filter(([, d]) => typeof d?.w === 'number' && d.w > 0)
    .map(([date, d]) => ({ date, w: d.w }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// 7-day average for every weigh-in date (uses whatever weigh-ins exist in the last 7 days).
export function rollingAvg(points, window = 7) {
  return points.map((p, i) => {
    const inWin = [];
    for (let j = i; j >= 0 && daysBetween(points[j].date, p.date) < window; j--) inWin.push(points[j].w);
    return { date: p.date, avg: mean(inWin), n: inWin.length };
  });
}

// Averages per program week (week 1 = start day + 6). The current week is marked partial.
export function weeklyAverages(points, startIso, todayIso) {
  const byWeek = new Map();
  for (const p of points) {
    const wk = weekOf(startIso, p.date);
    if (wk < 1) continue;
    if (!byWeek.has(wk)) byWeek.set(wk, []);
    byWeek.get(wk).push(p.w);
  }
  const current = weekOf(startIso, todayIso);
  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, ws]) => ({ week, ...weekRange(startIso, week), avg: mean(ws), n: ws.length, partial: week >= current }));
}

// Latest 7-day average weight (falls back to the profile weight).
export function currentWeight(points, fallback) {
  if (!points.length) return fallback;
  return rollingAvg(points).at(-1).avg;
}

// ---------- phases ----------
// profile.phases = [{ phase: 'cut', from: '2026-11-19' }, ...] (what really happened)
export function currentPhase(profile, todayIso) {
  const list = (profile.phases || []).filter((p) => p.from <= todayIso);
  return list.length ? list.at(-1) : { phase: 'cut', from: profile.startDate };
}

export function weeksInPhase(profile, todayIso) {
  const cur = currentPhase(profile, todayIso);
  return Math.floor(daysBetween(cur.from, todayIso) / 7) + 1;
}

// Plan of phases from start to the end of the program: real history, then the default timeline.
export function phaseSegments(profile) {
  const start = profile.startDate;
  const end = addDays(start, PROGRAM_WEEKS * 7);
  const timeline = { ...DEFAULT_TIMELINE, ...(profile.timeline || {}) };
  const hist = (profile.phases && profile.phases.length) ? profile.phases : [{ phase: 'cut', from: start }];
  const segs = hist.map((h, i) => ({ phase: h.phase, from: h.from, to: hist[i + 1]?.from || null }));
  // Plan the rest after the last real phase.
  const last = segs.at(-1);
  let at = addDays(last.from, timeline[last.phase] * 7);
  last.to = at < end ? at : end;
  for (let i = PHASE_ORDER.indexOf(last.phase) + 1; i < PHASE_ORDER.length && at < end; i++) {
    const ph = PHASE_ORDER[i];
    const to = i === PHASE_ORDER.length - 1 ? end : addDays(at, timeline[ph] * 7);
    segs.push({ phase: ph, from: at, to: to < end ? to : end, planned: true });
    at = to;
  }
  return segs;
}

// Target path: weekly points. Each phase starts from the real 7-day average if we have it.
export function targetPath(profile, points) {
  const out = [];
  const avg = rollingAvg(points);
  const realAt = (iso) => {
    const before = avg.filter((a) => a.date <= iso);
    const near = before.at(-1);
    return near && daysBetween(near.date, iso) <= 7 ? near.avg : null;
  };
  let kg = profile.startWeightKg;
  for (const seg of phaseSegments(profile)) {
    const ph = PHASES[seg.phase];
    if (seg.from !== profile.startDate) kg = realAt(seg.from) ?? kg;
    const weeks = Math.max(0, daysBetween(seg.from, seg.to) / 7);
    for (let w = 0; w <= weeks + 1e-9; w++) {
      out.push({ date: addDays(seg.from, w * 7), kg: kg * Math.pow(1 + ph.rate / 100, w) });
    }
    kg = kg * Math.pow(1 + ph.rate / 100, weeks);
  }
  // Remove duplicate dates (segment joins), keep the later one.
  const map = new Map(out.map((p) => [p.date, p]));
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function targetOn(path, iso) {
  if (!path.length) return null;
  if (iso <= path[0].date) return path[0].kg;
  for (let i = 1; i < path.length; i++) {
    if (iso <= path[i].date) {
      const a = path[i - 1], b = path[i];
      const t = daysBetween(a.date, iso) / Math.max(1, daysBetween(a.date, b.date));
      return a.kg + (b.kg - a.kg) * t;
    }
  }
  return path.at(-1).kg;
}

// ---------- food intake ----------
// planMealKcal: { b: {kcal, p}, l: ..., ... } ; day.meals: { b: true, ... } ; day.extras: [{kcal, p}]
export function dayIntake(day, planMealKcal) {
  if (!day) return { kcal: 0, p: 0, logged: false };
  let kcal = 0, p = 0, logged = false;
  for (const [id, eaten] of Object.entries(day.meals || {})) {
    if (eaten && planMealKcal[id]) { kcal += planMealKcal[id].kcal; p += planMealKcal[id].p; logged = true; }
  }
  for (const x of day.extras || []) { kcal += Number(x.kcal) || 0; p += Number(x.p) || 0; logged = true; }
  return { kcal, p, logged };
}

// How well the week followed the plan.
export function adherence(days, fromIso, toIso, planMealKcal, targetKcal) {
  const logged = [];
  for (let d = fromIso; d <= toIso; d = addDays(d, 1)) {
    const it = dayIntake(days[d], planMealKcal);
    if (it.logged) logged.push(it.kcal);
  }
  if (!logged.length) return { daysLogged: 0, avgIntake: null, overKcal: null };
  const avgIntake = mean(logged);
  return { daysLogged: logged.length, avgIntake, overKcal: avgIntake - targetKcal };
}

// Real daily burn from your own logs (needs 3 weeks of data). Intake minus what the
// weight trend says you stored or lost. Null when there is not enough data.
export function estimateTdee(days, points, endIso, planMealKcal, span = 21) {
  const from = addDays(endIso, -(span - 1));
  const intake = [];
  for (let d = from; d <= endIso; d = addDays(d, 1)) {
    const it = dayIntake(days[d], planMealKcal);
    if (it.logged) intake.push(it.kcal);
  }
  const first = points.filter((p) => p.date >= from && p.date <= addDays(from, 6)).map((p) => p.w);
  const last = points.filter((p) => p.date >= addDays(endIso, -6) && p.date <= endIso).map((p) => p.w);
  if (intake.length < 14 || first.length < 3 || last.length < 3) return null;
  const kgPerDay = (mean(last) - mean(first)) / (span - 7);
  return { tdee: mean(intake) - kgPerDay * KCAL_PER_KG, avgIntake: mean(intake), kgPerWeek: kgPerDay * 7, days: intake.length };
}

// ---------- weekly check-in ----------
// Check-ins open at the start of each program week and review the week that just ended.
export function checkinStatus(startIso, todayIso, checkins = []) {
  const wk = weekOf(startIso, todayIso);
  const reviewWeek = wk - 1;
  const lastReviewed = checkins.length ? checkins.at(-1).week : 0;
  if (reviewWeek < 1 || lastReviewed >= reviewWeek) {
    const next = Math.max(wk + 1, 2);
    return { due: false, reviewWeek, nextDate: weekRange(startIso, next).from };
  }
  return { due: true, reviewWeek };
}

const VERDICTS = {
  cut: { in: 'On track', above: 'Too slow', below: 'Too fast' },
  reset: { in: 'Holding steady', above: 'Gaining', below: 'Losing' },
  build: { in: 'On track', above: 'Gaining too fast', below: 'Too slow' },
};

// The decision. Small, damped steps: half the gap, rounded to 50 kcal, max ±200 a week.
// Returns { verdict, change, kcalAfter, reasons[], ... }. reasons are codes; the screen turns them into words.
export function decideCheckin(input) {
  const {
    weeks, reviewWeek, phase, kcal, weightKg, bmr, sex = 'male',
    adherence: adh = null, waistNow = null, waistPrev = null, heightCm = null, weeksInPhase: wip = 1, timeline = DEFAULT_TIMELINE,
  } = input;
  const ph = PHASES[phase] || PHASES.cut;
  const out = { phase: ph.id, week: reviewWeek, kcalBefore: kcal, kcalAfter: kcal, change: 0, reasons: [], zone: null, verdict: '', suggestPhase: null };
  const done = weeks.filter((w) => w.week <= reviewWeek && w.n >= 3);
  const last = done.find((w) => w.week === reviewWeek);
  out.avg = last?.avg ?? null;

  // Phase suggestions do not need weight data.
  const waistGoal = heightCm ? LEAN_WAIST_RATIO * heightCm : null;
  if (ph.id === 'cut') {
    if (waistNow && waistGoal && waistNow <= waistGoal) out.suggestPhase = { to: 'reset', why: 'waist-goal' };
    else if (wip > (timeline.cut ?? 12)) out.suggestPhase = { to: 'reset', why: 'cut-done' };
  } else if (ph.id === 'reset' && wip > (timeline.reset ?? 2)) {
    out.suggestPhase = { to: 'build', why: 'reset-done' };
  }

  if (!last) { out.verdict = 'Need more weigh-ins'; out.reasons.push('need-data'); return out; }
  const earlier = done.filter((w) => w.week < reviewWeek);
  if (!earlier.length) { out.verdict = 'First week saved'; out.reasons.push('baseline'); return out; }

  // Average weekly change over up to the last 2 weeks (smoother than 1 week).
  const ref = earlier.length >= 2 && earlier.at(-2).week >= reviewWeek - 2 ? earlier.at(-2) : earlier.at(-1);
  const rateKg = (last.avg - ref.avg) / (last.week - ref.week);
  const ratePct = (rateKg / ref.avg) * 100;
  Object.assign(out, { rateKg, ratePct, fromWeek: ref.week, targetRatePct: ph.rate, targetKg: (ph.rate / 100) * ref.avg });

  out.zone = ratePct < ph.min ? 'below' : ratePct > ph.max ? 'above' : 'in';
  out.verdict = VERDICTS[ph.id][out.zone];
  if (out.zone === 'in') { out.reasons.push('on-track'); return out; }

  const gapPct = ph.rate - ratePct; // + means eat more, - means eat less
  let change = round((((gapPct / 100) * weightKg * KCAL_PER_KG) / 7) * 0.5, 50);
  change = clamp(change, -200, 200);
  if (Math.abs(change) < 100) change = 100 * Math.sign(gapPct);

  if (change < 0 && adh && adh.daysLogged >= 4 && adh.overKcal >= 150) {
    out.reasons.push('over-plan'); out.overKcal = adh.overKcal; return out;
  }
  if (change < 0 && ph.id !== 'build' && waistNow && waistPrev && waistNow <= waistPrev - 0.5) {
    out.reasons.push('waist-down'); out.waistDrop = waistPrev - waistNow; return out;
  }
  if (change > 0 && ph.id === 'cut' && wip <= 3 && ratePct > -1.5) {
    out.reasons.push('early-water'); return out;
  }
  const floor = calorieFloor(bmr, sex);
  let after = kcal + change;
  if (after < floor) {
    after = Math.max(floor, Math.min(kcal, floor));
    out.reasons.push(after === kcal ? 'at-floor' : 'hit-floor');
  }
  out.kcalAfter = after;
  out.change = after - kcal;
  out.reasons.push(out.change < 0 ? 'eat-less' : out.change > 0 ? 'eat-more' : 'no-change');
  return out;
}

// Calories to use when switching phase. Best guess of maintenance, in this order:
// 1) real burn from logs, 2) current target adjusted by the real weight trend, 3) the formula.
export function phaseSwitchKcal({ to, weightKg, tdeeFromLogs, kcalNow, rateKgWk, formulaTdee, bmr, sex = 'male' }) {
  let maint = tdeeFromLogs ?? (Number.isFinite(rateKgWk) && kcalNow ? kcalNow - (rateKgWk * KCAL_PER_KG) / 7 : formulaTdee);
  const ph = PHASES[to];
  const kcal = round(maint + ((ph.rate / 100) * weightKg * KCAL_PER_KG) / 7, 50);
  return Math.max(kcal, calorieFloor(bmr, sex));
}

// ---------- training ----------
// Hard sets per muscle per week (primary muscle only). 10–20 is the useful range (Schoenfeld 2017).
export function weeklySets(workoutPlan) {
  const sets = {};
  for (const day of Object.values(workoutPlan.days || {})) {
    if (!day || day.rest) continue;
    for (const ex of day.exercises || []) {
      for (const m of ex.muscles || []) sets[m] = (sets[m] || 0) + (Number(ex.sets) || 0);
    }
  }
  return sets;
}

// ---------- daily habits ----------
export function sleepHours(bed = '23:00', wake = '07:30') {
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let mins = wh * 60 + wm - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60;
  return round(mins / 60, 0.5);
}

// Days in a row (ending today, or yesterday if today is empty) with anything logged.
export function streak(days, todayIso) {
  const has = (iso) => { const d = days[iso]; return !!d && (d.w || d.sleep || d.workout || d.photo || Object.values(d.meals || {}).some(Boolean) || (d.extras || []).length); };
  let d = has(todayIso) ? todayIso : addDays(todayIso, -1);
  let n = 0;
  while (has(d)) { n++; d = addDays(d, -1); }
  return n;
}
