// The default gym plan + names. Pure data.
//
// Why this split (Upper / Lower / rest / Push / Pull / Legs / rest):
//   - Weekly hard sets drive muscle growth; ~10–20 per muscle works well (Schoenfeld 2016, J Sports Sci).
//   - Training a muscle twice a week makes that volume easy to fit with good quality (Schoenfeld 2016/2018).
//   - Big lifts first, 2–3 min rest (Schoenfeld 2016, JSCR); end sets 1–3 reps before failure (Refalo 2022, Robinson 2024).
// exId = id in data/exercises.json (free-exercise-db, public domain) for the "How to do it" steps.

export const WEEK = [
  { id: 1, short: 'Mon', long: 'Monday' },
  { id: 2, short: 'Tue', long: 'Tuesday' },
  { id: 3, short: 'Wed', long: 'Wednesday' },
  { id: 4, short: 'Thu', long: 'Thursday' },
  { id: 5, short: 'Fri', long: 'Friday' },
  { id: 6, short: 'Sat', long: 'Saturday' },
  { id: 0, short: 'Sun', long: 'Sunday' },
];

export const MUSCLES = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', abs: 'Abs', other: 'Other',
};

export const REST_OPTIONS = ['1 min', '1–2 min', '2 min', '2–3 min', '3 min'];

const ex = (id, name, exId, sets, reps, rest, muscles, step = 2.5) => ({ id, name, exId, sets, reps, rest, muscles, step, kg: null });

export const DEFAULT_WORKOUT = {
  days: {
    1: { title: 'Upper', exercises: [
      ex('u1', 'Bench press', 'Barbell_Bench_Press_-_Medium_Grip', 3, '6–8', '2–3 min', ['chest']),
      ex('u2', 'Lat pulldown', 'Wide-Grip_Lat_Pulldown', 3, '8–10', '2 min', ['back']),
      ex('u3', 'Seated dumbbell press', 'Seated_Dumbbell_Press', 3, '8–10', '2 min', ['shoulders']),
      ex('u4', 'Seated cable row', 'Seated_Cable_Rows', 3, '8–10', '2 min', ['back']),
      ex('u5', 'Dumbbell curl', 'Dumbbell_Bicep_Curl', 2, '10–12', '1–2 min', ['biceps']),
      ex('u6', 'Rope pushdown', 'Triceps_Pushdown_-_Rope_Attachment', 2, '10–12', '1–2 min', ['triceps']),
    ] },
    2: { title: 'Lower', exercises: [
      ex('l1', 'Back squat', 'Barbell_Squat', 3, '6–8', '3 min', ['quads', 'glutes']),
      ex('l2', 'Romanian deadlift', 'Romanian_Deadlift', 3, '8–10', '2–3 min', ['hamstrings', 'glutes']),
      ex('l3', 'Leg press', 'Leg_Press', 3, '10–12', '2 min', ['quads'], 5),
      ex('l4', 'Lying leg curl', 'Lying_Leg_Curls', 3, '10–12', '1–2 min', ['hamstrings']),
      ex('l5', 'Standing calf raise', 'Standing_Calf_Raises', 3, '10–15', '1 min', ['calves']),
      ex('l6', 'Plank', 'Plank', 3, '30–45 s', '1 min', ['abs'], 0),
    ] },
    3: { title: 'Rest', rest: true, exercises: [] },
    4: { title: 'Push', exercises: [
      ex('p1', 'Incline dumbbell press', 'Incline_Dumbbell_Press', 3, '8–10', '2–3 min', ['chest']),
      ex('p2', 'Machine chest press', 'Machine_Bench_Press', 3, '10–12', '2 min', ['chest']),
      ex('p3', 'Lateral raise', 'Side_Lateral_Raise', 3, '12–15', '1–2 min', ['shoulders'], 1),
      ex('p4', 'Overhead rope extension', 'Cable_Rope_Overhead_Triceps_Extension', 3, '10–12', '1–2 min', ['triceps']),
      ex('p5', 'Pec deck', 'Butterfly', 2, '12–15', '1–2 min', ['chest']),
    ] },
    5: { title: 'Pull', exercises: [
      ex('q1', 'Pull-ups (assisted is fine)', 'Pullups', 3, '6–10', '2–3 min', ['back']),
      ex('q2', 'One-arm dumbbell row', 'One-Arm_Dumbbell_Row', 3, '8–10', '2 min', ['back']),
      ex('q3', 'Face pull', 'Face_Pull', 3, '12–15', '1–2 min', ['shoulders']),
      ex('q4', 'Lateral raise', 'Side_Lateral_Raise', 3, '12–15', '1–2 min', ['shoulders'], 1),
      ex('q5', 'Incline dumbbell curl', 'Incline_Dumbbell_Curl', 3, '10–12', '1–2 min', ['biceps'], 1),
      ex('q6', 'Hanging knee raise', 'Hanging_Leg_Raise', 3, '10–15', '1 min', ['abs'], 0),
    ] },
    6: { title: 'Legs', exercises: [
      ex('g1', 'Hack squat', 'Hack_Squat', 3, '8–10', '2–3 min', ['quads'], 5),
      ex('g2', 'Bulgarian split squat (each leg)', 'Split_Squats', 3, '8–10', '2 min', ['quads', 'glutes']),
      ex('g3', 'Hip thrust', 'Barbell_Hip_Thrust', 3, '8–12', '2 min', ['glutes'], 5),
      ex('g4', 'Leg extension', 'Leg_Extensions', 3, '12–15', '1–2 min', ['quads']),
      ex('g5', 'Seated leg curl', 'Seated_Leg_Curl', 3, '10–12', '1–2 min', ['hamstrings']),
      ex('g6', 'Seated calf raise', 'Seated_Calf_Raise', 3, '12–15', '1 min', ['calves']),
    ] },
    0: { title: 'Rest', rest: true, exercises: [] },
  },
};

// Simple rules shown on the Gym screen.
export const GYM_RULES = [
  'Warm up: 5 min easy cardio, then 1–2 light sets of the first exercise.',
  'Pick a weight where the last rep is hard: you could do only 1–3 more.',
  'Double progression: when you hit the top of the reps on every set, add the smallest step next time.',
  'Rest 2–3 min on big lifts so the next set stays strong. 1–2 min on small ones.',
  'Bad sleep or sore joints? Do the same weights, not more. Pain (not effort) = stop.',
  'Every 6–8 weeks, or when weights stall 2 weeks in a row: one easy week with half the sets.',
];

// exercise data file 'm' field -> our muscle ids (same names).
export const toMuscles = (m) => (MUSCLES[m] ? [m] : ['other']);
