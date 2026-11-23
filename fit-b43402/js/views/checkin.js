// Weekly check-in: compare weekly averages with the goal, read the waist, adjust calories in small steps.
import * as app from '../app.js';
import * as S from '../science.js';
import { fitPlanToTarget } from '../foods.js';
import { html, ic, fmt, toast, confirmSheet, parseNum } from '../ui.js';

export const title = 'Check-in';

let result = null;   // decision shown on screen (not saved yet)
let waistTyped = null;

const pctTxt = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(2)}%`;

function explain(r, ctx) {
  const ph = S.PHASES[r.phase];
  const span = r.fromWeek ? r.week - r.fromWeek : 1;
  const moved = r.rateKg != null ? `${r.rateKg < 0 ? 'lost' : 'gained'} ${Math.abs(r.rateKg).toFixed(2)} kg a week${span > 1 ? ` over the last ${span} weeks` : ''} (${pctTxt(r.ratePct)})` : '';
  const goal = r.phase === 'cut' ? 'losing 0.5–1% a week' : r.phase === 'build' ? 'gaining 0.1–0.5% a week' : 'staying within 0.25% a week';
  const rotis = Math.max(1, Math.round((Math.abs(r.change) / 96) * 2) / 2);
  const lines = [];
  for (const code of r.reasons) {
    if (code === 'need-data') lines.push('Weigh in at least 4 mornings a week, so the average means something. No change this week.');
    if (code === 'baseline') lines.push(`Week ${r.week} average saved: ${fmt.kg(r.avg)} kg. From next week I compare weeks and adjust calories if needed.`);
    if (code === 'on-track') lines.push(`You ${moved}. The goal is ${goal}. Keep eating ${fmt.int(r.kcalBefore)} kcal.`);
    if (code === 'eat-less') lines.push(`You ${moved}. The goal is ${goal}. Eat ${fmt.int(-r.change)} kcal less a day (about ${String(rotis).replace('.5', '½')} roti${rotis > 1 ? 's' : ''}).`);
    if (code === 'eat-more') lines.push(`You ${moved}. ${r.phase === 'cut' ? 'Faster than 1% a week can cost muscle.' : `The goal is ${goal}.`} Eat ${fmt.int(r.change)} kcal more a day.`);
    if (code === 'over-plan') lines.push(`You ${moved}, slower than the goal. But your meal log shows about ${fmt.int(r.overKcal)} kcal a day over your target. Stick to the plan this week first. Calories stay the same.`);
    if (code === 'waist-down') lines.push(`Your weight barely moved, but your waist is ${r.waistDrop.toFixed(1)} cm smaller. Fat is going and muscle is coming. Keep calories the same.`);
    if (code === 'early-water') lines.push(`You ${moved}. Fast loss in the first weeks is mostly water and stored carbs, and slows down by itself. No change yet.`);
    if (code === 'hit-floor') lines.push(`That reaches your safe minimum (${fmt.int(ctx.floor)} kcal, your resting burn), so it stops there. Also add 2,000 steps a day.`);
    if (code === 'at-floor') lines.push('You are already at the safe minimum. Do not cut food more: add 2,000 steps a day and check the meal log is honest.');
  }
  if (ph && r.reasons.includes('on-track') && r.phase === 'build') lines.push('Gaining slowly keeps most of the new weight as muscle.');
  return lines;
}

export async function render(root) {
  const st = app.state, p = st.profile, today = app.today();
  const pts = app.points();
  const weeks = S.weeklyAverages(pts, p.startDate, today);
  const status = S.checkinStatus(p.startDate, today, st.checkins);
  const phaseNow = app.phaseNow();
  const wip = S.weeksInPhase(p, today);
  const segs = S.phaseSegments(p);
  const end = S.addDays(p.startDate, S.PROGRAM_WEEKS * 7);
  const total = S.daysBetween(p.startDate, end);
  const herePct = Math.min(100, Math.max(0, (S.daysBetween(p.startDate, today) / total) * 100));
  const waist = app.latestWaist();
  const waistGoal = Math.round(p.heightCm * S.LEAN_WAIST_RATIO);
  const est = S.estimateTdee(st.days, pts, today, app.planMealKcal());
  const curWeek = weeks.find((w) => w.week === S.weekOf(p.startDate, today));
  const thisPhaseLen = (p.timeline || S.DEFAULT_TIMELINE)[phaseNow];

  root.innerHTML = String(html`
    <div class="card">
      <div class="card-head"><h2>Your 6-month plan</h2><span class="muted small">Week ${Math.max(1, S.weekOf(p.startDate, today))} of ${S.PROGRAM_WEEKS}</span></div>
      <div class="timeline-wrap">
        <span class="you-are-here" style="left:${herePct.toFixed(1)}%">You</span>
        <div class="timeline">${segs.map((s) => html`<i class="${s.phase}" style="width:${((S.daysBetween(s.from, s.to) / total) * 100).toFixed(2)}%" title="${S.PHASES[s.phase].name}"></i>`)}</div>
      </div>
      <div class="phase-keys">${segs.map((s) => html`<span><i class="${s.phase}" style="background:${s.phase === 'cut' ? '#65a30d' : s.phase === 'build' ? '#3987e5' : '#868c96'}"></i>${S.PHASES[s.phase].name}: ${fmt.short(s.from)} – ${fmt.short(s.to)}</span>`)}</div>
      <div class="hr"></div>
      <p class="soft small" style="margin:0">Now: <b>${S.PHASES[phaseNow].name}</b>, week ${wip}${phaseNow === 'build' ? '' : ` of about ${thisPhaseLen}`}.
        ${phaseNow === 'cut' ? html` Belly-fat goal: waist ${waistGoal} cm or less (45% of your height)${waist ? html`. Last: <b>${fmt.kg(waist.cm)} cm</b>` : ''}.` : ''}</p>
    </div>

    <div class="card" id="ci"></div>

    ${est ? html`<div class="card">
      <h2>Your real daily burn</h2>
      <p class="soft" style="margin:6px 0 0">About <b>${fmt.int(est.tdee)} kcal</b> a day, worked out from the last 3 weeks: you ate about ${fmt.int(est.avgIntake)} kcal (meal log) and your weight moved ${fmt.delta(est.kgPerWeek)} kg a week. The formula guessed ${fmt.int(app.formulaTargets().tdee)}.</p>
    </div>` : ''}

    <div class="card">
      <h2>Past check-ins</h2>
      ${st.checkins.length ? html`<table class="table">
        <thead><tr><th>Week</th><th class="r">Average</th><th class="r">Per week</th><th>Result</th><th class="r">Calories</th></tr></thead>
        <tbody>${st.checkins.slice().reverse().map((c) => html`<tr>
          <td>${c.week}<div class="muted tiny">${fmt.short(c.date)}</div></td>
          <td class="r">${c.avg != null ? fmt.kg(c.avg) : '–'}</td>
          <td class="r">${c.rateKg != null ? fmt.delta(c.rateKg) : '–'}</td>
          <td>${c.verdict}</td>
          <td class="r">${fmt.int(c.kcalAfter)}${c.kcalAfter !== c.kcalBefore ? html`<div class="tiny ${c.kcalAfter < c.kcalBefore ? 'warn' : 'good'}">${c.kcalAfter > c.kcalBefore ? '+' : '−'}${Math.abs(c.kcalAfter - c.kcalBefore)}</div>` : ''}</td>
        </tr>`)}</tbody></table>` : html`<p class="muted" style="margin:0">Your first check-in opens on ${fmt.long(S.weekRange(p.startDate, 2).from)}, after your first full week.</p>`}
    </div>`);

  const box = root.querySelector('#ci');

  if (!status.due) {
    const days = S.daysBetween(today, status.nextDate);
    box.innerHTML = String(html`
      <div class="card-head"><h2>Weekly check-in</h2><span class="badge">${ic('clock', 14)} in ${days} day${days === 1 ? '' : 's'}</span></div>
      <p class="soft" style="margin:0">Next check-in: <b>${fmt.long(status.nextDate)}</b>. It compares this week's average weight with last week's, reads your waist, and changes calories only if you are off track.</p>
      ${curWeek ? html`<p class="muted small mt" style="margin-bottom:0">This week so far: ${fmt.kg(curWeek.avg)} kg average from ${curWeek.n} weigh-in${curWeek.n === 1 ? '' : 's'}. Aim for at least 4.</p>` : ''}`);
    return;
  }

  const rw = S.weekRange(p.startDate, status.reviewWeek);
  const reviewed = weeks.find((w) => w.week === status.reviewWeek);

  const decide = () => {
    const f = app.formulaTargets();
    return S.decideCheckin({
      weeks, reviewWeek: status.reviewWeek, phase: phaseNow, kcal: st.targets.kcal, weightKg: app.weightNow(),
      bmr: f.bmr, sex: p.sex, heightCm: p.heightCm, weeksInPhase: wip, timeline: p.timeline || S.DEFAULT_TIMELINE,
      adherence: S.adherence(st.days, rw.from, rw.to, app.planMealKcal(), st.targets.kcal),
      waistNow: waistTyped, waistPrev: app.latestWaist(S.addDays(today, -1))?.cm ?? null,
    });
  };

  // Show the same two weeks the maths compares (it uses 2 weeks back when it can, to smooth noise).
  const first = decide();
  const prev = weeks.find((w) => w.week === first.fromWeek) || weeks.filter((w) => w.week < status.reviewWeek).at(-1);
  box.innerHTML = String(html`
    <div class="card-head"><h2>Weekly check-in</h2><span class="badge good">Ready</span></div>
    <div class="compare">
      <div class="box"><small>Week ${prev ? prev.week : '–'}</small><b>${prev ? fmt.kg(prev.avg) : '–'}</b><small>kg average</small></div>
      <span class="muted">${ic('chevron-right')}</span>
      <div class="box"><small>Week ${status.reviewWeek}</small><b>${reviewed ? fmt.kg(reviewed.avg) : '–'}</b><small>${reviewed ? `${reviewed.n} weigh-ins` : 'no weigh-ins'}</small></div>
    </div>
    <label class="field mt"><span>Waist at the belly button today (cm), optional</span>
      <input class="input" id="waist" inputmode="decimal" placeholder="${waist ? `last: ${fmt.kg(waist.cm)}` : 'e.g. 86'}" value="${waistTyped ?? ''}">
      <small>Morning, standing relaxed, breathe out, tape level. Same way every week.</small>
    </label>
    <div id="res" class="mt"></div>`);

  const res = box.querySelector('#res');
  const waistIn = box.querySelector('#waist');

  const show = () => {
    const r = decide();
    result = r;
    const floor = S.calorieFloor(app.formulaTargets().bmr, p.sex);
    const tone = r.reasons.some((c) => ['on-track', 'baseline', 'waist-down'].includes(c)) ? 'good' : r.change !== 0 ? 'warn' : 'info';
    const sug = r.suggestPhase;
    res.innerHTML = String(html`
      <div class="verdict ${tone}">
        <span class="${tone === 'good' ? 'good' : tone === 'warn' ? 'warn' : ''}">${ic(tone === 'good' ? 'circle-check' : tone === 'warn' ? 'triangle-alert' : 'info', 24)}</span>
        <div>
          <h3>${r.verdict}</h3>
          ${explain(r, { floor }).map((l) => html`<p>${l}</p>`)}
          ${r.change !== 0 ? html`<p><b>New target: ${fmt.int(r.kcalAfter)} kcal</b> (was ${fmt.int(r.kcalBefore)}). Your meal plan's rice, roti and oats will be adjusted to match.</p>` : ''}
        </div>
      </div>
      ${sug ? html`<div class="verdict info mt">
        <span>${ic('sparkles', 24)}</span>
        <div><h3>Time to switch to "${S.PHASES[sug.to].name}"?</h3>
          <p>${sug.why === 'waist-goal' ? 'Your waist has reached the belly-fat goal.' : sug.why === 'cut-done' ? `You have been losing fat for ${wip - 1} weeks. A 2-week reset at steady weight comes next, then building muscle.${waist && waist.cm > waistGoal ? ` Your waist (${fmt.kg(waist.cm)} cm) is still above the ${waistGoal} cm goal, so you could also keep going a few more weeks.` : ''}` : 'The 2-week reset is done. Time to build muscle with a small surplus.'}</p>
          <div class="row gap"><button class="btn btn-small btn-primary" data-switch="${sug.to}">Switch now</button><span class="muted small">or keep going and decide next week</span></div>
        </div></div>` : ''}
      <button class="btn btn-primary btn-block mt" data-apply>${ic('check')} ${r.change !== 0 ? `Save and use ${fmt.int(r.kcalAfter)} kcal` : 'Save this check-in'}</button>`);

    res.querySelector('[data-apply]').addEventListener('click', () => save(r));
    res.querySelector('[data-switch]')?.addEventListener('click', () => switchPhase(sug.to, r));
  };

  waistIn.addEventListener('change', () => {
    const v = parseNum(waistIn.value);
    waistTyped = Number.isFinite(v) && v >= 40 && v <= 200 ? Math.round(v * 10) / 10 : null;
    if (waistIn.value && waistTyped == null) toast('Waist in cm, like 84.5');
    show();
  });
  show();
}

async function recordCheckin(r, kcalAfter) {
  const st = app.state, today = app.today();
  if (waistTyped) await app.saveDay(today, { waist: waistTyped });
  await app.saveCheckins([...st.checkins, {
    week: r.week, date: today, avg: r.avg, rateKg: r.rateKg ?? null, ratePct: r.ratePct ?? null, waist: waistTyped,
    verdict: r.verdict, reasons: r.reasons, kcalBefore: r.kcalBefore, kcalAfter, phase: r.phase,
  }]);
  result = null; waistTyped = null;
}

async function save(r) {
  const st = app.state;
  await recordCheckin(r, r.kcalAfter);
  if (r.change !== 0) {
    await app.setTargets(r.kcalAfter, `Check-in week ${r.week}: ${r.verdict.toLowerCase()}`);
    await app.savePlan(fitPlanToTarget(st.plan, r.kcalAfter, st.prices));
    toast(`New target ${fmt.int(r.kcalAfter)} kcal. Meal plan updated.`);
  } else {
    toast('Check-in saved');
  }
  app.refresh();
}

async function switchPhase(to, r) {
  const st = app.state, p = st.profile, today = app.today();
  const w = app.weightNow();
  const f = app.formulaTargets(w, to);
  const est = S.estimateTdee(st.days, app.points(), today, app.planMealKcal());
  const kcal = S.phaseSwitchKcal({ to, weightKg: w, tdeeFromLogs: est?.tdee ?? null, kcalNow: st.targets.kcal, rateKgWk: r?.rateKg, formulaTdee: f.tdee, bmr: f.bmr, sex: p.sex });
  const ok = await confirmSheet(`Switch to "${S.PHASES[to].name}"?`,
    `New target: ${fmt.int(kcal)} kcal a day and ${S.macros(kcal, w, to).proteinG} g protein. Based on ${est ? 'your real burn from your logs' : r?.rateKg != null ? 'your current calories and weight trend' : 'the formula'}. Your meal plan is adjusted to match.`, 'Switch');
  if (!ok) return;
  if (r) await recordCheckin(r, kcal);
  await app.saveProfile({ ...p, phases: [...(p.phases || []), { phase: to, from: today }] });
  await app.setTargets(kcal, `Switched to ${S.PHASES[to].name}`, to, w);
  await app.savePlan(fitPlanToTarget(st.plan, kcal, st.prices));
  toast(`Now: ${S.PHASES[to].name}`);
  app.refresh();
}

export { switchPhase };
