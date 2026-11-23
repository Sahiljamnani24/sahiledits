// Shared app state + helpers the screens use. Loads everything once from store.js.
import * as db from './store.js';
import * as S from './science.js';
import { DEFAULT_PLANS, mealTotals, planTotals, fitPlanToTarget } from './foods.js';
import { DEFAULT_WORKOUT } from './workouts.js';

export const state = {
  profile: null, targets: null, days: {}, plan: null, workout: null, checkins: [], prices: {},
  viewDate: null, // the day shown on Today (lets you fill in a missed day)
};

export async function load() {
  [state.profile, state.targets, state.days, state.plan, state.workout, state.checkins, state.prices] = await Promise.all([
    db.getProfile(), db.getTargets(), db.getDays(), db.getMealPlan(), db.getWorkout(), db.getCheckins(), db.getPrices(),
  ]);
  if (state.profile && !state.workout) state.workout = structuredClone(DEFAULT_WORKOUT);
  if (state.profile && !state.plan) state.plan = structuredClone(DEFAULT_PLANS[state.profile.diet || 'egg']);
  state.viewDate = today();
}

// "Today". On localhost you can test other days with ?today=2026-12-03.
export function today() {
  const q = new URLSearchParams(location.search).get('today');
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q) && ['localhost', '127.0.0.1'].includes(location.hostname)) return q;
  return S.isoDate();
}

export const points = () => S.weighIns(state.days);
export const phaseNow = () => S.currentPhase(state.profile, today()).phase;
export const phaseInfo = () => S.PHASES[phaseNow()];
export const weekNow = () => Math.max(1, S.weekOf(state.profile.startDate, today()));
export const weightNow = () => S.currentWeight(points(), state.profile.startWeightKg);

// kcal + protein of each planned meal: { b: {kcal, p}, ... }
export function planMealKcal() {
  const out = {};
  for (const m of state.plan?.meals || []) out[m.id] = mealTotals(m, state.prices);
  return out;
}
export const planTotal = () => planTotals(state.plan, state.prices);

export function latestWaist(beforeIso = '9999-12-31') {
  const list = Object.entries(state.days).filter(([d, v]) => v.waist && d <= beforeIso).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return list.length ? { date: list.at(-1)[0], cm: list.at(-1)[1].waist } : null;
}

// Formula numbers for the current profile and phase (the starting guess, before check-ins).
export function formulaTargets(weightKg = weightNow(), phase = phaseNow()) {
  const p = state.profile;
  return S.calcTargets({ sex: p.sex, age: p.age, heightCm: p.heightCm, weightKg, activity: p.activity, phase });
}

// ---------- saving ----------
export async function saveDay(iso, patch) {
  state.days[iso] = await db.saveDay(iso, patch);
}

export async function setTargets(kcal, reason, phase = phaseNow(), weightKg = weightNow()) {
  const m = S.macros(kcal, weightKg, phase);
  const history = [...(state.targets?.history || []), { date: today(), kcal, proteinG: m.proteinG, reason }];
  state.targets = { kcal, ...m, phase, setOn: today(), reason, history };
  await db.saveTargets(state.targets);
}

export async function saveProfile(p) { state.profile = p; await db.saveProfile(p); }
export async function savePlan(plan) { state.plan = plan; await db.saveMealPlan(plan); }
export async function saveWorkout(w) { state.workout = w; await db.saveWorkout(w); }
export async function saveCheckins(list) { state.checkins = list; await db.saveCheckins(list); }
export async function savePrices(p) { state.prices = p; await db.savePrices(p); }

// First run: build everything from the setup form.
export async function createProfile(input) {
  const profile = {
    name: input.name || '', sex: input.sex, age: input.age, heightCm: input.heightCm, startWeightKg: input.weightKg,
    startDate: input.startDate, activity: input.activity, diet: input.diet,
    foodBudget: input.foodBudget || 0, gymFee: input.gymFee || 0, bedTime: input.bedTime || '23:00', wakeTime: input.wakeTime || '07:30',
    phases: [{ phase: input.phase || 'cut', from: input.startDate }], timeline: { ...S.DEFAULT_TIMELINE }, createdAt: Date.now(),
  };
  await saveProfile(profile);
  const t = S.calcTargets({ ...profile, weightKg: profile.startWeightKg, phase: profile.phases[0].phase });
  await setTargets(t.kcal, 'Start: Mifflin-St Jeor formula', profile.phases[0].phase, profile.startWeightKg);
  await savePlan(fitPlanToTarget(structuredClone(DEFAULT_PLANS[profile.diet] || DEFAULT_PLANS.egg), t.kcal, state.prices));
  await saveWorkout(structuredClone(DEFAULT_WORKOUT));
  // The setup weight is the start-day weigh-in (if the start is not in the future).
  if (input.weightKg && input.startDate <= today()) await saveDay(input.startDate, { w: input.weightKg });
  if (input.waistCm) await saveDay(input.startDate <= today() ? input.startDate : today(), { waist: input.waistCm });
}

export function go(route) {
  if (location.hash === '#' + route) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = route;
}

// Re-draw the current screen (set by main.js).
export let refresh = () => {};
export function setRefresh(fn) { refresh = fn; }
