// Food: daily targets (with the full working), calculator, meal plan + cost, cheapest protein, food rules.
import * as app from '../app.js';
import * as S from '../science.js';
import { FOODS, DEFAULT_PLANS, isBulk, itemLabel, mealTotals, planTotals, fitPlanToTarget, proteinCostRank } from '../foods.js';
import { NOTES } from '../notes.js';
import { costBars } from '../chart.js';
import { html, raw, ic, fmt, toast, sheet, confirmSheet, parseNum } from '../ui.js';

export const title = 'Food';

let draft = null; // meal plan being edited

const r1 = (x) => Math.round(x * 10) / 10;

function working(f, p, w) {
  const ph = S.PHASES[f.phase];
  const sign = f.dailyDelta < 0 ? '−' : '+';
  return html`<ol class="steps">
    <li><b>Resting burn</b> (Mifflin-St Jeor, men +5, women −161)
      <div class="formula">10 × ${r1(w)} + 6.25 × ${p.heightCm} − 5 × ${p.age} ${p.sex === 'female' ? '− 161' : '+ 5'} = ${fmt.int(f.bmr)} kcal</div></li>
    <li><b>Daily burn</b> = resting burn × activity (${f.activityLabel.toLowerCase()})
      <div class="formula">${fmt.int(f.bmr)} × ${f.factor} = ${fmt.int(f.tdee)} kcal</div></li>
    ${f.phase === 'reset' ? html`<li><b>Goal:</b> hold your weight, so no change.</li>` : html`
    <li><b>Goal:</b> ${f.phase === 'cut' ? 'lose' : 'gain'} ${Math.abs(ph.rate)}% of your weight a week = ${Math.abs(f.rateKgWk).toFixed(2)} kg. 1 kg ≈ 7,700 kcal.
      <div class="formula">${Math.abs(f.rateKgWk).toFixed(2)} × 7,700 ÷ 7 = ${fmt.int(Math.abs(f.dailyDelta))} kcal a day ${f.phase === 'cut' ? 'less' : 'more'}</div></li>`}
    <li><b>Calories</b>
      <div class="formula">${fmt.int(f.tdee)} ${sign} ${fmt.int(Math.abs(f.dailyDelta))} = ${fmt.int(f.kcalRaw)} → ${fmt.int(f.kcal)} kcal</div>
      ${f.kcal > Math.round(f.kcalRaw / 50) * 50 ? html`<small class="muted">Raised to the safe minimum (your resting burn).</small>` : ''}</li>
    <li><b>Protein</b> ${ph.proteinPerKg} g per kg${f.phase === 'cut' ? ' (higher while losing fat, to keep muscle)' : ''}
      <div class="formula">${ph.proteinPerKg} × ${r1(w)} = ${fmt.int(ph.proteinPerKg * w)} → ${f.proteinG} g</div></li>
    <li><b>Fat</b> 0.8 g per kg, <b>carbs</b> the rest
      <div class="formula">fat ${f.fatG} g · carbs (${fmt.int(f.kcal)} − ${f.proteinG}×4 − ${f.fatG}×9) ÷ 4 = ${f.carbsG} g</div></li>
  </ol>`;
}

export async function render(root) {
  const st = app.state, p = st.profile, t = st.targets;
  const w = app.weightNow();
  const f = app.formulaTargets(w);
  const plan = draft || st.plan;
  const tot = planTotals(plan, st.prices);
  const kcalGap = tot.kcal - t.kcal;
  const proteinOk = tot.p >= t.proteinRange[0] && tot.p >= t.proteinG * 0.95;
  const monthly = tot.cost * 30;
  const budget = p.foodBudget || 0;
  const hasWhey = plan.meals.some((m) => m.items.some((i) => i.food === 'whey' && i.amount > 0));
  const rank = proteinCostRank(st.prices);
  const foodNotes = NOTES.filter((n) => n.area === 'food');

  root.innerHTML = String(html`
    <div class="card">
      <div class="card-head"><h2>Your daily target</h2><span class="badge info">${S.PHASES[t.phase || app.phaseNow()].name}</span></div>
      <div class="big-pair">
        <div class="big"><div class="label">Calories</div><div class="value">${fmt.int(t.kcal)}<small>kcal</small></div></div>
        <div class="big"><div class="label">Protein</div><div class="value">${t.proteinG}<small>g</small></div></div>
      </div>
      <div class="macro-line mt"><span>Fat ${t.fatG} g</span><span>Carbs ${t.carbsG} g</span><span>Fiber ${t.fiberG} g</span><span>Water ${t.waterL} L</span></div>
      ${t.kcal !== f.kcal ? html`<p class="small soft mt" style="margin-bottom:0">${ic('info', 14)} ${(t.history || []).some((h) => h.reason?.startsWith('Check-in'))
        ? `The formula says ${fmt.int(f.kcal)} kcal. Your check-ins moved your target to ${fmt.int(t.kcal)}, because your real weight trend is more accurate than any formula.`
        : `At your weight now, the formula says ${fmt.int(f.kcal)} kcal. Your target stays at ${fmt.int(t.kcal)}: the weekly check-in decides when to change it, using your real weight trend.`}</p>` : ''}
      <details class="more mt">
        <summary>${ic('chevron-down', 18, 'chev')} How these numbers are made</summary>
        <p class="muted small">Using your age ${p.age}, height ${p.heightCm} cm and weight ${fmt.kg(w)} kg${app.points().length ? ' (7-day average)' : ''}.</p>
        ${working(f, p, w)}
        <p class="muted small mt" style="margin-bottom:0">A formula is a first guess, usually within 10%. The weekly check-in fixes it using your real weight. <a href="#science?n=formula">Sources</a></p>
      </details>
    </div>

    <div class="card">
      <details class="more" id="calc">
        <summary>${ic('chevron-down', 18, 'chev')} Calculator: try other numbers</summary>
        <div class="stack mt">
          <div class="two">
            <label class="field"><span>Sex</span><select class="input" data-c="sex"><option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option></select></label>
            <label class="field"><span>Age</span><input class="input" data-c="age" inputmode="numeric" value="${p.age}"></label>
            <label class="field"><span>Height (cm)</span><input class="input" data-c="cm" inputmode="decimal" value="${p.heightCm}"></label>
            <label class="field"><span>Weight (kg)</span><input class="input" data-c="kg" inputmode="decimal" value="${r1(w)}"></label>
          </div>
          <label class="field"><span>Activity</span><select class="input" data-c="act">${S.ACTIVITY.map((a) => html`<option value="${a.id}" ${a.id === p.activity ? 'selected' : ''}>${a.label} (× ${a.f})</option>`)}</select></label>
          <label class="field"><span>Goal</span><select class="input" data-c="phase">${S.PHASE_ORDER.map((id) => html`<option value="${id}" ${id === app.phaseNow() ? 'selected' : ''}>${S.PHASES[id].name}</option>`)}</select></label>
          <div id="calc-out"></div>
        </div>
      </details>
    </div>

    <div class="card">
      <div class="card-head">
        <div><h2>Meal plan</h2><div class="muted small">${plan.name || ''}</div></div>
        ${draft ? '' : html`<button class="btn btn-small" data-edit>${ic('pencil', 16)} Edit</button>`}
      </div>
      ${draft ? editPlan(draft) : html`${plan.meals.map((m) => {
        const mt = mealTotals(m, st.prices);
        return html`<div class="meal">
          <div class="meal-top"><b>${m.name} <span class="muted small">· ${m.time}</span></b><span class="small num">${fmt.int(mt.kcal)} kcal · ${Math.round(mt.p)} g</span></div>
          <div class="meal-items">${m.items.filter((it) => FOODS[it.food]).map((it) => itemLabel(FOODS[it.food], it.amount)).join(' · ')}</div>
          ${m.how ? html`<div class="meal-how">${m.how}</div>` : ''}
        </div>`;
      })}`}
      <div class="hr"></div>
      <div class="stack" style="gap:8px">
        <div class="row between"><span>Plan total</span><b class="num">${fmt.int(tot.kcal)} kcal · ${Math.round(tot.p)} g protein</b></div>
        <div class="row wrap">
          ${Math.abs(kcalGap) <= 75 ? html`<span class="badge good">${ic('check', 14)} Calories match</span>` : html`<span class="badge warn">${fmt.int(Math.abs(kcalGap))} kcal ${kcalGap > 0 ? 'over' : 'under'} target</span>`}
          ${proteinOk ? html`<span class="badge good">${ic('check', 14)} Protein in range</span>` : html`<span class="badge warn">Protein low: ${Math.round(tot.p)} of ${t.proteinG} g</span>`}
        </div>
        <div class="row between"><span>Cost</span><b class="num">${fmt.rs(tot.cost)} a day · ${fmt.rs(monthly)} a month</b></div>
        ${budget ? html`<div class="row wrap">${monthly <= budget ? html`<span class="badge good">${ic('wallet', 14)} ${fmt.rs(budget - monthly)} under your ${fmt.rs(budget)} food budget</span>` : html`<span class="badge bad">${ic('wallet', 14)} ${fmt.rs(monthly - budget)} over your ${fmt.rs(budget)} food budget</span>`}</div>` : ''}
        ${hasWhey ? html`<p class="muted small" style="margin:0">Whey: 1 scoop ≈ 33 g, so a 1 kg tub lasts about 30 days. It is your most expensive protein: when it runs out, 3 eggs give the same protein for ₹22.</p>` : ''}
        ${!draft && Math.abs(kcalGap) > 75 ? html`<button class="btn btn-primary btn-block" data-fit>${ic('refresh-cw')} Fit the plan to ${fmt.int(t.kcal)} kcal</button>
          <p class="muted tiny" style="margin:0">Changes only rice, roti, oats and banana. Protein stays the same.</p>` : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Cheapest protein</h2><button class="btn btn-small" data-prices>${ic('pencil', 16)} Prices</button></div>
      <p class="muted small">Rupees for 25 g of protein (one good meal's worth). Calories in brackets.</p>
      ${raw(costBars(rank, 'rupeesPer25g', (r) => `₹${r.rupeesPer25g.toFixed(0)} (${Math.round(r.kcalPer25g)} kcal)`))}
      <p class="muted tiny mt" style="margin-bottom:0">Values: IFCT 2017 (India's official food table, NIN) or pack labels. Prices are rough Nov 2026 online prices: tap Prices to put your shop's.</p>
    </div>

    <div class="card">
      <h2>Food rules</h2>
      ${foodNotes.map((n) => html`<div class="note"><h3>${n.title}</h3><p style="margin:0">${n.text}</p></div>`)}
      <a class="btn btn-ghost btn-block mt" href="#science">${ic('book-open')} All the science and sources</a>
    </div>`);

  bindCalc(root);
  root.querySelector('[data-edit]')?.addEventListener('click', () => { draft = structuredClone(st.plan); app.refresh(); });
  root.querySelector('[data-fit]')?.addEventListener('click', async () => {
    await app.savePlan(fitPlanToTarget(st.plan, t.kcal, st.prices));
    toast('Plan fitted to your target');
    app.refresh();
  });
  root.querySelector('[data-prices]').addEventListener('click', pricesSheet);
  if (draft) bindEdit(root);
}

function bindCalc(root) {
  const out = root.querySelector('#calc-out');
  const get = (k) => root.querySelector(`[data-c="${k}"]`).value;
  let last = null;
  const draw = () => {
    const x = { sex: get('sex'), age: parseNum(get('age')), heightCm: parseNum(get('cm')), weightKg: parseNum(get('kg')), activity: get('act'), phase: get('phase') };
    if (!(x.age >= 14 && x.age <= 90 && x.heightCm >= 120 && x.heightCm <= 230 && x.weightKg >= 30 && x.weightKg <= 250)) {
      out.innerHTML = '<p class="muted small">Type an age, height and weight.</p>';
      return;
    }
    const f = S.calcTargets(x);
    last = f;
    out.innerHTML = String(html`
      <div class="big-pair">
        <div class="big"><div class="label">Calories</div><div class="value">${fmt.int(f.kcal)}<small>kcal</small></div></div>
        <div class="big"><div class="label">Protein</div><div class="value">${f.proteinG}<small>g</small></div></div>
      </div>
      ${working(f, x, x.weightKg)}
      <button class="btn btn-block mt" data-use>${ic('check')} Use ${fmt.int(f.kcal)} kcal as my target</button>`);
    out.querySelector('[data-use]').addEventListener('click', async () => {
      if (!(await confirmSheet('Change your target?', `New target: ${fmt.int(last.kcal)} kcal and ${last.proteinG} g protein. Weekly check-ins will adjust from here.`, 'Use it'))) return;
      await app.setTargets(last.kcal, 'Set from the calculator', x.phase, x.weightKg);
      toast('Target updated');
      app.refresh();
    });
  };
  root.querySelectorAll('[data-c]').forEach((el) => el.addEventListener('input', draw));
  draw();
}

// ---------- meal plan editor ----------
const foodOptions = (sel) => Object.entries(FOODS).map(([id, f]) => html`<option value="${id}" ${id === sel ? 'selected' : ''}>${f.name}</option>`);

function editPlan(plan) {
  return html`<div class="stack">
    <div class="field"><span>Start from a ready plan</span>
      <div class="two">${Object.entries(DEFAULT_PLANS).map(([id, d]) => html`<button class="btn btn-small" data-template="${id}">${d.name}</button>`)}</div>
    </div>
    ${plan.meals.map((m, mi) => html`<div class="edit-ex" data-meal="${mi}">
      <div class="row between"><b>${m.name}</b><span class="muted small num">${fmt.int(mealTotals(m, app.state.prices).kcal)} kcal</span></div>
      ${m.items.map((it, ii) => html`<div class="item-edit" data-item="${ii}">
        <select class="input input-sm" data-f="food" aria-label="Food">${foodOptions(it.food)}</select>
        <label class="row" style="gap:4px"><input class="input input-sm" data-f="amount" inputmode="decimal" value="${it.amount}" aria-label="Amount"><span class="muted tiny">${isBulk(FOODS[it.food].unit) ? FOODS[it.food].unit : '×'}</span></label>
        <button class="icon-btn" data-del aria-label="Remove">${ic('x', 18)}</button>
      </div>`)}
      <button class="btn btn-small" data-add>${ic('plus', 16)} Add food</button>
    </div>`)}
    <div class="row gap"><button class="btn btn-primary grow" data-save>${ic('check')} Save plan</button><button class="btn grow" data-cancel>Cancel</button></div>
  </div>`;
}

function syncDraft(root) {
  root.querySelectorAll('[data-meal]').forEach((box) => {
    const meal = draft.meals[Number(box.dataset.meal)];
    box.querySelectorAll('[data-item]').forEach((row) => {
      const it = meal.items[Number(row.dataset.item)];
      it.food = row.querySelector('[data-f="food"]').value;
      const a = parseNum(row.querySelector('[data-f="amount"]').value);
      it.amount = Number.isFinite(a) && a >= 0 ? Math.min(a, 5000) : 0;
    });
  });
}

function bindEdit(root) {
  root.querySelectorAll('[data-meal]').forEach((box) => {
    const meal = draft.meals[Number(box.dataset.meal)];
    box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      syncDraft(root);
      meal.items.splice(Number(b.closest('[data-item]').dataset.item), 1);
      app.refresh();
    }));
    box.querySelector('[data-add]').addEventListener('click', () => {
      syncDraft(root);
      meal.items.push({ food: 'veg', amount: 100 });
      app.refresh();
    });
    box.querySelectorAll('select, input').forEach((el) => el.addEventListener('change', () => { syncDraft(root); app.refresh(); }));
  });
  root.querySelectorAll('[data-template]').forEach((b) => b.addEventListener('click', async () => {
    const d = DEFAULT_PLANS[b.dataset.template];
    if (!(await confirmSheet(`Use "${d.name}"?`, 'This replaces the meals above. It is fitted to your calorie target.', 'Use it'))) return;
    draft = fitPlanToTarget(structuredClone(d), app.state.targets.kcal, app.state.prices);
    app.refresh();
  }));
  root.querySelector('[data-save]').addEventListener('click', async () => {
    syncDraft(root);
    draft.meals.forEach((m) => { m.items = m.items.filter((i) => i.amount > 0); });
    await app.savePlan(draft);
    draft = null;
    toast('Meal plan saved');
    app.refresh();
  });
  root.querySelector('[data-cancel]').addEventListener('click', () => { draft = null; app.refresh(); });
}

function pricesSheet() {
  const st = app.state;
  sheet('Your prices', html`
    <p class="muted small" style="margin:0">Put what you pay at your shop. Used for the cost and the cheapest-protein list.</p>
    ${Object.entries(FOODS).map(([id, f]) => html`<label class="item-edit" style="grid-template-columns:1fr 110px">
      <span class="small">${f.name}<br><span class="muted tiny">₹ per ${isBulk(f.unit) ? (f.unit === 'ml' ? 'litre' : 'kg') : f.unit}</span></span>
      <input class="input input-sm" data-price="${id}" inputmode="decimal" value="${st.prices[id] ?? f.price}">
    </label>`)}
    <button class="btn btn-primary btn-block" data-save>${ic('check')} Save prices</button>
    <button class="btn btn-ghost btn-block" data-reset>Back to the default prices</button>`, {
    onMount: (dlg, close) => {
      dlg.querySelector('[data-save]').addEventListener('click', async () => {
        const out = {};
        dlg.querySelectorAll('[data-price]').forEach((el) => {
          const v = parseNum(el.value);
          if (Number.isFinite(v) && v >= 0 && v !== FOODS[el.dataset.price].price) out[el.dataset.price] = v;
        });
        await app.savePrices(out);
        close();
        toast('Prices saved');
        app.refresh();
      });
      dlg.querySelector('[data-reset]').addEventListener('click', async () => {
        await app.savePrices({});
        close();
        toast('Default prices back');
        app.refresh();
      });
    },
  });
}

