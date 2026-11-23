// Food data + meal plan math. Pure functions, no DOM.
//
// Nutrition values:
//   IFCT 2017 = Indian Food Composition Tables, National Institute of Nutrition (ICMR-NIN), Hyderabad.
//   label     = the pack label of a common Indian brand (food is not in IFCT).
// Amounts: foods with unit 'g' or 'ml' list nutrients per 100 g/ml and price per kg/L.
//          Count foods (egg, roti, scoop, tsp, banana) list nutrients and price per piece.
// Prices are rough Nov 2026 online-grocery prices. The app lets the user edit them.

export const FOODS = {
  oats:    { name: 'Rolled oats (dry)',          unit: 'g',      kcal: 385, p: 12.5, c: 66,   f: 7.5,  fib: 10,   price: 195, src: 'label (Saffola / Quaker)' },
  whey:    { name: 'Whey protein',               unit: 'scoop',  kcal: 130, p: 24,   c: 3,    f: 2,    fib: 0,    price: 82,  src: 'label, 1 scoop ≈ 33 g (₹2,500/kg)' },
  milk:    { name: 'Toned milk',                 unit: 'ml',     kcal: 58,  p: 3.1,  c: 4.7,  f: 3.0,  fib: 0,    price: 58,  src: 'label (Amul Taaza)' },
  curd:    { name: 'Curd / dahi',                unit: 'g',      kcal: 60,  p: 3.1,  c: 4.7,  f: 3.0,  fib: 0,    price: 75,  src: 'label (toned-milk dahi)' },
  paneer:  { name: 'Paneer',                     unit: 'g',      kcal: 258, p: 18.9, c: 12.4, f: 14.8, fib: 0,    price: 450, src: 'IFCT 2017 L003' },
  egg:     { name: 'Egg',                        unit: 'egg',    kcal: 67,  p: 6.6,  c: 0,    f: 4.6,  fib: 0,    price: 7.5, src: 'IFCT 2017 M001, 50 g egg' },
  soya:    { name: 'Soya chunks (dry)',          unit: 'g',      kcal: 345, p: 52,   c: 33,   f: 0.5,  fib: 13,   price: 180, src: 'label (Nutrela)' },
  moong:   { name: 'Moong dal (dry)',            unit: 'g',      kcal: 326, p: 23.9, c: 52.6, f: 1.4,  fib: 9.4,  price: 150, src: 'IFCT 2017 B010' },
  masoor:  { name: 'Masoor dal (dry)',           unit: 'g',      kcal: 322, p: 24.4, c: 52.5, f: 0.8,  fib: 10.4, price: 125, src: 'IFCT 2017 B013' },
  chana:   { name: 'Kala chana (dry)',           unit: 'g',      kcal: 287, p: 18.8, c: 39.6, f: 5.1,  fib: 25.2, price: 105, src: 'IFCT 2017 B002' },
  rajma:   { name: 'Rajma (dry)',                unit: 'g',      kcal: 299, p: 19.9, c: 48.6, f: 1.8,  fib: 16.6, price: 175, src: 'IFCT 2017 B020' },
  rice:    { name: 'Rice (raw)',                 unit: 'g',      kcal: 356, p: 7.9,  c: 78.2, f: 0.5,  fib: 2.8,  price: 60,  src: 'IFCT 2017 A015' },
  roti:    { name: 'Roti (30 g atta)',           unit: 'roti',   kcal: 96,  p: 3.2,  c: 19.3, f: 0.5,  fib: 3.4,  price: 1.45, src: 'IFCT 2017 A019 × 30 g (atta ₹48/kg)' },
  chicken: { name: 'Chicken breast (raw)',       unit: 'g',      kcal: 168, p: 21.8, c: 0,    f: 9.0,  fib: 0,    price: 360, src: 'IFCT 2017 N003' },
  fish:    { name: 'Fish, mackerel (cleaned)',   unit: 'g',      kcal: 101, p: 21.5, c: 0,    f: 1.5,  fib: 0,    price: 350, src: 'IFCT 2017 P034' },
  banana:  { name: 'Banana',                     unit: 'banana', kcal: 105, p: 1.2,  c: 23.6, f: 0.3,  fib: 1.9,  price: 6,   src: 'IFCT 2017 E012, ~100 g' },
  peanuts: { name: 'Peanuts (raw)',              unit: 'g',      kcal: 520, p: 23.7, c: 17.3, f: 39.6, fib: 10.4, price: 200, src: 'IFCT 2017 H012' },
  pb:      { name: 'Peanut butter',              unit: 'g',      kcal: 590, p: 25,   c: 20,   f: 50,   fib: 6,    price: 380, src: 'label (Pintola)' },
  veg:     { name: 'Mixed vegetables',           unit: 'g',      kcal: 35,  p: 1.5,  c: 6,    f: 0.3,  fib: 2.5,  price: 40,  src: 'IFCT 2017, average of onion, tomato, cabbage, beans' },
  oil:     { name: 'Cooking oil',                unit: 'tsp',    kcal: 45,  p: 0,    c: 0,    f: 5,    fib: 0,    price: 0.9, src: '5 ml; ₹180/L' },
};

// Units measured by weight/volume: nutrients per 100, price per 1000.
export const isBulk = (unit) => unit === 'g' || unit === 'ml';

export function unitLabel(food, amount) {
  if (isBulk(food.unit)) return `${fmtNum(amount)} ${food.unit}`;
  const one = { egg: 'egg', roti: 'roti', scoop: 'scoop', tsp: 'tsp', banana: 'banana' }[food.unit] || food.unit;
  const many = { egg: 'eggs', roti: 'rotis', scoop: 'scoops', tsp: 'tsp', banana: 'bananas' }[food.unit] || food.unit;
  return `${fmtNum(amount)} ${amount === 1 ? one : many}`;
}

// Short label for a meal list: "Rolled oats 50 g", "2 eggs", "1 scoop whey", "2 tsp oil".
export function itemLabel(food, amount) {
  if (isBulk(food.unit)) return `${food.name.replace(/ \((dry|raw|cleaned|raw, skinless)\)$/, '')} ${unitLabel(food, amount)}`;
  if (food.unit === 'scoop') return `${unitLabel(food, amount)} whey`;
  if (food.unit === 'tsp') return `${unitLabel(food, amount)} oil`;
  return unitLabel(food, amount);
}

function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

// prices: optional { foodId: price } overrides from the user.
export function itemValues(item, prices = {}) {
  const food = FOODS[item.food];
  if (!food) return { kcal: 0, p: 0, c: 0, f: 0, fib: 0, cost: 0 };
  const k = isBulk(food.unit) ? item.amount / 100 : item.amount;
  const price = prices[item.food] ?? food.price;
  const cost = isBulk(food.unit) ? (item.amount / 1000) * price : item.amount * price;
  return { kcal: food.kcal * k, p: food.p * k, c: food.c * k, f: food.f * k, fib: food.fib * k, cost };
}

export function sumValues(list) {
  return list.reduce((a, v) => ({
    kcal: a.kcal + v.kcal, p: a.p + v.p, c: a.c + v.c, f: a.f + v.f, fib: a.fib + v.fib, cost: a.cost + v.cost,
  }), { kcal: 0, p: 0, c: 0, f: 0, fib: 0, cost: 0 });
}

export function mealTotals(meal, prices) {
  return sumValues(meal.items.map((it) => itemValues(it, prices)));
}

export function planTotals(plan, prices) {
  return sumValues(plan.meals.map((m) => mealTotals(m, prices)));
}

// Foods that are mainly eaten for protein (rice and oats have some, but come with lots of carbs).
export const PROTEIN_FOODS = ['soya', 'masoor', 'moong', 'chana', 'rajma', 'egg', 'chicken', 'fish', 'peanuts', 'milk', 'curd', 'paneer', 'pb', 'whey'];

// Cheapest protein: rupees for 25 g of protein (about one good meal's worth).
export function proteinCostRank(prices = {}) {
  return PROTEIN_FOODS
    .map((id) => [id, FOODS[id]])
    .map(([id, f]) => {
      const one = isBulk(f.unit) ? { food: id, amount: 100 } : { food: id, amount: 1 };
      const v = itemValues(one, prices);
      return { id, name: f.name, rupeesPer25g: (v.cost / v.p) * 25, kcalPer25g: (v.kcal / v.p) * 25 };
    })
    .filter((r) => Number.isFinite(r.rupeesPer25g))
    .sort((a, b) => a.rupeesPer25g - b.rupeesPer25g);
}

// Carb foods are the ones we scale to hit a new calorie target; protein stays put.
const SCALABLE = { oats: 5, rice: 5, roti: 1, banana: 1 }; // step size
const MIN = { oats: 20, rice: 20, roti: 1, banana: 0 };
const MAX = { oats: 150, rice: 200, roti: 6, banana: 3 };

// Scale all carb portions together so the plan lands near targetKcal. Returns a NEW plan.
export function fitPlanToTarget(plan, targetKcal, prices) {
  const next = structuredClone(plan);
  const items = [];
  next.meals.forEach((m) => m.items.forEach((it) => { if (SCALABLE[it.food] && it.amount > 0) items.push(it); }));
  if (!items.length) return next;
  const gap0 = targetKcal - planTotals(next, prices).kcal;
  if (Math.abs(gap0) < 40) return next;
  const carbKcal = items.reduce((sum, it) => sum + itemValues(it, prices).kcal, 0);
  const factor = Math.max(0.2, (carbKcal + gap0) / carbKcal);
  const snap = (it, amt) => Math.min(MAX[it.food], Math.max(MIN[it.food], Math.round(amt / SCALABLE[it.food]) * SCALABLE[it.food]));
  for (const it of items) it.amount = snap(it, it.amount * factor);
  // Fine-tune with the smallest steps until within ~30 kcal.
  for (let guard = 0; guard < 80; guard++) {
    const gap = targetKcal - planTotals(next, prices).kcal;
    if (Math.abs(gap) < 30) break;
    const dir = Math.sign(gap);
    const pick = items
      .map((it) => ({ it, d: itemValues({ food: it.food, amount: SCALABLE[it.food] }, prices).kcal }))
      .filter(({ it, d }) => d <= Math.abs(gap) * 1.3 && snap(it, it.amount + dir * SCALABLE[it.food]) !== it.amount)
      .sort((x, y) => x.d - y.d)[0];
    if (!pick) break;
    pick.it.amount = snap(pick.it, pick.it.amount + dir * SCALABLE[pick.it.food]);
  }
  return next;
}

export const MEAL_SLOTS = [
  { id: 'b', name: 'Breakfast', time: '8:00 am' },
  { id: 'l', name: 'Lunch', time: '1:30 pm' },
  { id: 's', name: 'Snack', time: '5:45 pm', note: 'before the gym' },
  { id: 'd', name: 'Dinner', time: '8:30 pm', note: 'after the gym' },
];

// Default plans for the fat-loss phase: about 2,000 kcal and 138-144 g protein,
// under ₹230 a day (food budget ₹7,000/month). Built from the cheapest protein per
// rupee (soya, dal, eggs) plus 1 scoop of whey while the whey lasts.
// Limits we chose: at most 4 eggs and 60 g dry soya a day. Tuned with tools/tune_plan.mjs.
export const DEFAULT_PLANS = {
  egg: {
    name: 'Eggs + veg (no meat)',
    meals: [
      { id: 'b', name: 'Breakfast', time: '8:00 am', how: 'Cook the oats in the milk. Stir in the whey once it cools a little.',
        items: [{ food: 'oats', amount: 50 }, { food: 'milk', amount: 300 }, { food: 'whey', amount: 1 }] },
      { id: 'l', name: 'Lunch', time: '1:30 pm', how: 'Soya chunk pulao, or soya curry with rice. Cook it the night before.',
        items: [{ food: 'soya', amount: 60 }, { food: 'rice', amount: 40 }, { food: 'veg', amount: 150 }, { food: 'oil', amount: 2 }] },
      { id: 's', name: 'Snack', time: '5:45 pm', how: 'Boiled eggs (boil at night) and a glass of milk, before the gym.',
        items: [{ food: 'egg', amount: 2 }, { food: 'milk', amount: 200 }] },
      { id: 'd', name: 'Dinner', time: '8:30 pm', how: 'Dal, 2-egg bhurji, rotis, sabzi and curd. After the gym.',
        items: [{ food: 'masoor', amount: 60 }, { food: 'egg', amount: 2 }, { food: 'roti', amount: 2 }, { food: 'veg', amount: 150 }, { food: 'curd', amount: 200 }, { food: 'oil', amount: 2 }] },
    ],
  },
  nonveg: {
    name: 'With chicken or fish',
    meals: [
      { id: 'b', name: 'Breakfast', time: '8:00 am', how: 'Cook the oats in the milk. Stir in the whey once it cools a little.',
        items: [{ food: 'oats', amount: 50 }, { food: 'milk', amount: 300 }, { food: 'whey', amount: 1 }] },
      { id: 'l', name: 'Lunch', time: '1:30 pm', how: 'Soya chunk pulao, or soya curry with rice. Cook it the night before.',
        items: [{ food: 'soya', amount: 60 }, { food: 'rice', amount: 50 }, { food: 'veg', amount: 150 }, { food: 'oil', amount: 2 }] },
      { id: 's', name: 'Snack', time: '5:45 pm', how: 'Boiled eggs (boil at night) and a glass of milk, before the gym.',
        items: [{ food: 'egg', amount: 2 }, { food: 'milk', amount: 200 }] },
      { id: 'd', name: 'Dinner', time: '8:30 pm', how: 'Chicken or fish curry (swap 1:1), rotis, sabzi, curd. After the gym.',
        items: [{ food: 'chicken', amount: 150 }, { food: 'roti', amount: 3 }, { food: 'veg', amount: 150 }, { food: 'curd', amount: 100 }, { food: 'oil', amount: 2 }] },
    ],
  },
};

// Quick-add for food eaten outside the plan. Rough averages; protein in grams.
export const EXTRAS = [
  { name: 'Chai with sugar', kcal: 90, p: 2 },
  { name: 'Biscuits (2)', kcal: 90, p: 1 },
  { name: 'Samosa', kcal: 260, p: 4 },
  { name: 'Vada pav', kcal: 290, p: 6 },
  { name: 'Cold drink (can)', kcal: 140, p: 0 },
  { name: 'Chips (small pack)', kcal: 160, p: 2 },
  { name: 'Sweet / mithai (1 pc)', kcal: 150, p: 2 },
  { name: 'Beer (330 ml)', kcal: 145, p: 1 },
  { name: 'Pizza (1 slice)', kcal: 280, p: 11 },
  { name: 'Burger', kcal: 450, p: 18 },
  { name: 'Maggi (1 pack)', kcal: 350, p: 8 },
  { name: 'Restaurant thali', kcal: 800, p: 22 },
  { name: 'Biryani (1 plate)', kcal: 650, p: 25 },
  { name: 'Fish thali', kcal: 700, p: 35 },
];
