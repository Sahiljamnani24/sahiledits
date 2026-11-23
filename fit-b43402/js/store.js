// store.js: the ONLY file that knows where data is kept.
//
// Today: in this phone's browser. Small data in localStorage (JSON), photos in IndexedDB.
// Later (login + more users): replace the bodies of these functions with calls to a server
// (for example Supabase: auth + Postgres tables + a photo bucket). Every function is already
// async and every key is scoped to a user id, so the rest of the app will not change.

const APP = 'fm';
const VERSION = 1;
let userId = 'me'; // later: the signed-in user's id

export function setUser(id) { userId = id; }
export function getUser() { return userId; }

const k = (name) => `${APP}:${userId}:${name}`;

function read(name, fallback) {
  try {
    const raw = localStorage.getItem(k(name));
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(name, value) {
  localStorage.setItem(k(name), JSON.stringify(value)); // throws if storage is full: callers show a message
}

// ---------- small data ----------
export const getProfile = async () => read('profile', null);
export const saveProfile = async (p) => write('profile', { ...p, updatedAt: Date.now() });

export const getTargets = async () => read('targets', null);
export const saveTargets = async (t) => write('targets', t);

export const getDays = async () => read('days', {});
export async function saveDay(iso, patch) {
  const all = read('days', {});
  const next = { ...(all[iso] || {}), ...patch, updatedAt: Date.now() };
  for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
  all[iso] = next;
  write('days', all);
  return next;
}

export const getMealPlan = async () => read('mealplan', null);
export const saveMealPlan = async (p) => write('mealplan', p);

export const getWorkout = async () => read('workout', null);
export const saveWorkout = async (w) => write('workout', w);

export const getCheckins = async () => read('checkins', []);
export const saveCheckins = async (list) => write('checkins', list);

export const getPrices = async () => read('prices', {});
export const savePrices = async (p) => write('prices', p);

// ---------- photos (IndexedDB) ----------
const DB_NAME = 'fitminute';
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('photos', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('photos', mode);
    const result = fn(t.objectStore('photos'));
    t.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const photoId = (iso) => `${userId}:${iso}`;

export async function savePhoto(iso, blob) {
  await tx('readwrite', (s) => s.put({ id: photoId(iso), user: userId, date: iso, blob, savedAt: Date.now() }));
  askToKeepData();
}

export async function getPhoto(iso) {
  const row = await tx('readonly', (s) => s.get(photoId(iso)));
  return row?.blob || null;
}

export async function deletePhoto(iso) {
  await tx('readwrite', (s) => s.delete(photoId(iso)));
}

export async function listPhotoDates() {
  const rows = await tx('readonly', (s) => s.getAll());
  return (rows || []).filter((r) => r.user === userId).map((r) => r.date).sort();
}

// Ask the browser not to clear our data when the phone is low on space.
let askedPersist = false;
export function askToKeepData() {
  if (askedPersist) return;
  askedPersist = true;
  try { navigator.storage?.persist?.(); } catch { /* not supported */ }
}

// ---------- backup ----------
const NAMES = ['profile', 'targets', 'days', 'mealplan', 'workout', 'checkins', 'prices'];

const blobToDataUrl = (blob) => new Promise((resolve) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.readAsDataURL(blob);
});

export async function exportAll() {
  const data = {};
  for (const n of NAMES) data[n] = read(n, null);
  const photos = {};
  for (const d of await listPhotoDates()) photos[d] = await blobToDataUrl(await getPhoto(d));
  return { app: 'fitminute', version: VERSION, exportedAt: new Date().toISOString(), data, photos };
}

export async function importAll(backup) {
  if (!backup || backup.app !== 'fitminute' || !backup.data) throw new Error('This is not a Fit Minute backup file.');
  for (const n of NAMES) if (backup.data[n] != null) write(n, backup.data[n]);
  for (const [date, dataUrl] of Object.entries(backup.photos || {})) {
    const blob = await (await fetch(dataUrl)).blob();
    await savePhoto(date, blob);
  }
}

export async function wipeAll() {
  for (const n of NAMES) localStorage.removeItem(k(n));
  for (const d of await listPhotoDates()) await deletePhoto(d);
}
