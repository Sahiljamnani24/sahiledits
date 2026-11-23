// The science behind the app, in plain words. Every source was checked on Crossref (Nov 2026).
// `you(c)` says what the app does with it; c = { t: targets, p: profile, plan: plan totals }.

const doi = (d) => `https://doi.org/${d}`;

export const NOTES = [
  {
    id: 'calories', area: 'food', title: 'Fat loss = eat a bit less than you burn',
    text: 'Your body burns energy all day. Eat a little less than that and it uses stored fat for the rest. No single food makes you fat; the daily total decides.',
    you: (c) => `Your target is about ${Math.round(-c.t.dailyDelta)} kcal below your daily burn. That is about ${Math.abs(c.t.rateKgWk).toFixed(1)} kg a week.`,
    refs: [{ cite: 'Hall et al. 2012, Am J Clin Nutr', url: doi('10.3945/ajcn.112.036350') }],
  },
  {
    id: 'formula', area: 'food', title: 'The formula is a good first guess',
    text: 'Mifflin-St Jeor is the most accurate simple formula for resting burn in people who are not obese. It is usually within 10% of a lab test.',
    you: () => 'We start with it. Your weekly check-in then corrects it using your real weight.',
    refs: [
      { cite: 'Mifflin et al. 1990, Am J Clin Nutr', url: doi('10.1093/ajcn/51.2.241') },
      { cite: 'Frankenfield et al. 2005, J Am Diet Assoc', url: doi('10.1016/j.jada.2005.02.005') },
    ],
  },
  {
    id: 'slow', area: 'food', title: 'Lose slowly to keep your muscle',
    text: 'Losing 0.5–1% of your body weight a week keeps more muscle than crash dieting. The leaner you are, the slower you should go.',
    you: () => 'Your goal is 0.7% a week, about 0.5 kg.',
    refs: [
      { cite: 'Garthe et al. 2011, Int J Sport Nutr Exerc Metab', url: doi('10.1123/ijsnem.21.2.97') },
      { cite: 'Helms et al. 2014, J Int Soc Sports Nutr', url: doi('10.1186/1550-2783-11-20') },
    ],
  },
  {
    id: 'protein', area: 'food', title: 'Protein protects muscle',
    text: '1.6–2.2 g of protein per kg of body weight gives almost all of the muscle benefit. While dieting, stay near the top of that range.',
    you: (c) => `Your target is ${c.t.proteinG} g a day. Anything from ${c.t.proteinRange[0]} to ${c.t.proteinRange[1]} g is fine.`,
    refs: [
      { cite: 'Morton et al. 2018, Br J Sports Med', url: doi('10.1136/bjsports-2017-097608') },
      { cite: 'Jäger et al. 2017, ISSN position stand', url: doi('10.1186/s12970-017-0177-8') },
      { cite: 'Helms et al. 2014, Int J Sport Nutr Exerc Metab', url: doi('10.1123/ijsnem.2013-0054') },
    ],
  },
  {
    id: 'meals', area: 'food', title: 'Spread protein over the day',
    text: 'Your daily total matters most. Splitting it into 3–4 meals of 25–45 g is an easy way to reach it.',
    you: () => 'Every meal in your plan has protein in it.',
    refs: [
      { cite: 'Schoenfeld & Aragon 2018, J Int Soc Sports Nutr', url: doi('10.1186/s12970-018-0215-1') },
      { cite: 'Trommelen et al. 2023, Cell Rep Med', url: doi('10.1016/j.xcrm.2023.101324') },
    ],
  },
  {
    id: 'belly', area: 'body', title: 'Ab exercises don\'t burn belly fat',
    text: 'Fat comes off the whole body at once, and the belly is often last. Ab exercises make the muscle stronger, but don\'t burn the fat on top of it.',
    you: () => 'So we track your waist, not only your weight. Abs are trained twice a week for strength.',
    refs: [{ cite: 'Vispute et al. 2011, J Strength Cond Res', url: doi('10.1519/JSC.0b013e3181fb4a46') }],
  },
  {
    id: 'waist', area: 'body', title: 'Waist size is the best simple belly-fat check',
    text: 'Keep your waist under half your height. That line is linked to a lower risk of heart disease and diabetes, in every country studied.',
    you: (c) => `Health line: ${Math.round(c.p.heightCm * 0.5)} cm. Our lean goal: ${Math.round(c.p.heightCm * 0.45)} cm (45% of your height).`,
    refs: [{ cite: 'Ashwell et al. 2012, Obes Rev', url: doi('10.1111/j.1467-789X.2011.00952.x') }],
  },
  {
    id: 'weigh', area: 'body', title: 'Weigh every morning, trust the weekly average',
    text: 'Weight jumps 0.5–2 kg a day from water, salt and food in your gut. One day means nothing. People who weigh daily lose more weight.',
    you: () => 'The line on your graph is your 7-day average. Check-ins compare weekly averages.',
    refs: [
      { cite: 'Steinberg et al. 2015, J Acad Nutr Diet', url: doi('10.1016/j.jand.2014.12.011') },
      { cite: 'Burke et al. 2011, J Am Diet Assoc', url: doi('10.1016/j.jada.2010.10.008') },
    ],
  },
  {
    id: 'adapt', area: 'body', title: 'Your burn drops as you diet',
    text: 'As you get lighter you burn a little less, and you move less without noticing. A fixed calorie number slowly stops working. "1 kg = 7,700 kcal" is only a rough rule.',
    you: () => 'The weekly check-in reads your real trend and changes calories in small steps (50–200 kcal).',
    refs: [
      { cite: 'Trexler et al. 2014, J Int Soc Sports Nutr', url: doi('10.1186/1550-2783-11-7') },
      { cite: 'Hall 2008, Int J Obes', url: doi('10.1038/sj.ijo.0803720') },
    ],
  },
  {
    id: 'recomp', area: 'body', title: 'Beginners can lose fat and gain muscle together',
    text: 'If you are new to lifting (or coming back), you can build muscle even while eating a bit less, as long as protein is high and you train hard.',
    you: () => 'If your weight is flat but your waist is shrinking, the check-in keeps your calories the same.',
    refs: [{ cite: 'Barakat et al. 2020, Strength Cond J', url: doi('10.1519/SSC.0000000000000584') }],
  },
  {
    id: 'volume', area: 'gym', title: '10–20 hard sets per muscle per week',
    text: 'More hard sets build more muscle, up to a point. Training each muscle twice a week makes that easy to fit with good quality sets.',
    you: () => 'Your 5-day plan hits every muscle about twice a week, 9–15 sets each. The Gym screen counts it live.',
    refs: [
      { cite: 'Schoenfeld et al. 2017, J Sports Sci', url: doi('10.1080/02640414.2016.1210197') },
      { cite: 'Schoenfeld et al. 2016, Sports Med', url: doi('10.1007/s40279-016-0543-8') },
      { cite: 'Schoenfeld et al. 2019, J Sports Sci', url: doi('10.1080/02640414.2018.1555906') },
    ],
  },
  {
    id: 'failure', area: 'gym', title: 'End each set 1–3 reps before failure',
    text: 'Sets build the most muscle when they end close to failure: you could only do 1–3 more good reps. Going all the way to failure adds tiredness, not much muscle.',
    you: () => 'Choose weights so the last rep of each set is hard.',
    refs: [
      { cite: 'Refalo et al. 2023, Sports Med', url: doi('10.1007/s40279-022-01784-y') },
      { cite: 'Robinson et al. 2024, Sports Med', url: doi('10.1007/s40279-024-02069-2') },
    ],
  },
  {
    id: 'overload', area: 'gym', title: 'Make it a little harder over time',
    text: 'Muscles grow when the work slowly goes up. When you hit the top of the rep range on every set, add the smallest weight step next time.',
    you: () => 'Each exercise on the Gym screen keeps your weight and has a quick + button.',
    refs: [{ cite: 'ACSM position stand 2009, Med Sci Sports Exerc', url: doi('10.1249/MSS.0b013e3181915670') }],
  },
  {
    id: 'rest', area: 'gym', title: 'Rest 2–3 minutes on big lifts',
    text: 'Short rests make the next set weaker. Longer rests on big lifts (squat, bench, rows) gave more strength and more muscle.',
    you: () => 'Each exercise shows its rest time.',
    refs: [{ cite: 'Schoenfeld et al. 2016, J Strength Cond Res', url: doi('10.1519/JSC.0000000000001272') }],
  },
  {
    id: 'sleep', area: 'life', title: 'Sleep 7–9 hours',
    text: 'In one study, dieters who slept 5.5 hours lost 55% less fat and more muscle than when they slept 8.5 hours on the same food.',
    you: (c) => `Your schedule (${c.p.bedTime} to ${c.p.wakeTime}) gives you a full night. Protect it, even on weekends.`,
    refs: [
      { cite: 'Nedeltcheva et al. 2010, Ann Intern Med', url: doi('10.7326/0003-4819-153-7-201010050-00006') },
      { cite: 'Watson et al. 2015, Sleep', url: doi('10.5665/sleep.4716') },
    ],
  },
  {
    id: 'steps', area: 'life', title: 'Walk 8,000–10,000 steps a day',
    text: 'Walking burns calories without making you tired for the gym. Health benefits level off around 8,000–10,000 steps a day for adults under 60.',
    you: () => 'Rest days: walk. If the scale is stuck, add 2,000 steps before cutting food.',
    refs: [{ cite: 'Paluch et al. 2022, Lancet Public Health', url: doi('10.1016/S2468-2667(21)00302-9') }],
  },
  {
    id: 'fiber', area: 'food', title: 'Half the plate vegetables',
    text: 'Vegetables, dal and whole grains bring fiber. Fiber keeps you full on fewer calories and is good for the heart. Aim for about 30 g a day.',
    you: (c) => `Your plan has about ${Math.round(c.plan.fib)} g fiber.`,
    refs: [{ cite: 'Reynolds et al. 2019, Lancet', url: doi('10.1016/S0140-6736(18)31809-9') }],
  },
  {
    id: 'sugar', area: 'food', title: 'Watch drinks with sugar',
    text: 'Sugar in chai, cold drinks and juice adds calories without filling you up. Keep added sugar under 25 g a day (about 5 teaspoons).',
    you: () => 'Log sweet drinks as extras so the check-in can see them.',
    refs: [{ cite: 'WHO guideline: sugars intake, 2015', url: 'https://www.who.int/publications/i/item/9789241549028' }],
  },
  {
    id: 'salt', area: 'body', title: 'A salty meal makes the scale jump',
    text: 'Salty food can add 0.5–1 kg of water overnight. It is not fat and goes away in 2–3 days. Keep salt under 5 g a day.',
    you: () => 'Don\'t panic over one high day. Look at the weekly average.',
    refs: [{ cite: 'WHO guideline: sodium intake, 2012', url: 'https://www.who.int/publications/i/item/9789241504836' }],
  },
  {
    id: 'whey', area: 'food', title: 'Whey is just milk protein',
    text: 'Whey is safe for healthy people and works like food protein. High-protein diets did not harm the kidneys of healthy adults. India\'s NIN (2024) still says food first, powder second.',
    you: () => 'Whey is the most expensive protein in your plan (see the price list). When your 1 kg runs out, swap the scoop for 3 eggs and save about ₹1,800 a month.',
    refs: [
      { cite: 'Jäger et al. 2017, ISSN position stand', url: doi('10.1186/s12970-017-0177-8') },
      { cite: 'Devries et al. 2018, J Nutr', url: doi('10.1093/jn/nxy197') },
    ],
  },
  {
    id: 'soy', area: 'food', title: 'Soya is safe for men',
    text: 'Soya does not lower testosterone or raise estrogen in men. A large review of clinical studies found no effect on male hormones.',
    you: () => 'Soya chunks are your cheapest protein. The plan keeps them to 60 g dry a day.',
    refs: [{ cite: 'Reed et al. 2021, Reprod Toxicol', url: doi('10.1016/j.reprotox.2020.12.019') }],
  },
  {
    id: 'creatine', area: 'gym', title: 'Creatine: the one extra with strong proof',
    text: '3–5 g of creatine monohydrate a day helps strength and muscle, and is safe for healthy people. Optional, about ₹6–10 a day.',
    you: () => 'Not in your plan or budget. Add it later if you want.',
    refs: [{ cite: 'Kreider et al. 2017, ISSN position stand', url: doi('10.1186/s12970-017-0173-z') }],
  },
  {
    id: 'lean-gain', area: 'body', title: 'Build muscle slowly to stay lean',
    text: 'For beginners, gaining about 0.25–0.5% of body weight a week builds muscle without much fat.',
    you: () => 'In the "Build muscle" phase we aim for 0.25% a week, a small surplus of about 200 kcal.',
    refs: [{ cite: 'Iraki et al. 2019, Sports', url: doi('10.3390/sports7070154') }],
  },
];

export const noteById = (id) => NOTES.find((n) => n.id === id);
