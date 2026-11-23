// Small screen helpers: safe HTML, number formats, toast, bottom sheet.
import { icon } from './icons.js';
export { icon };

// ---------- safe HTML: every ${value} is escaped unless wrapped in raw() / html`` ----------
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Safe(String(s));
const part = (v) => (v == null || v === false ? '' : v instanceof Safe ? v.s : Array.isArray(v) ? v.map(part).join('') : esc(v));
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new Safe(out);
}
export const ic = (name, size, cls) => raw(icon(name, size, cls));

// ---------- formats ----------
const r1 = (x) => Math.round(x * 10) / 10;
export const fmt = {
  kg: (x) => (x == null || !Number.isFinite(x) ? '–' : r1(x).toFixed(1)),
  delta: (x, unit = '') => {
    if (x == null || !Number.isFinite(x)) return '–';
    const v = r1(x);
    return (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(1) + unit;
  },
  int: (x) => (x == null ? '–' : Math.round(x).toLocaleString('en-IN')),
  rs: (x) => '₹' + Math.round(x).toLocaleString('en-IN'),
  day: (iso) => new Date(iso + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
  short: (iso) => new Date(iso + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  long: (iso) => new Date(iso + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
};

// ---------- toast ----------
let toastTimer = null;
export function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- bottom sheet (uses <dialog>, so Back/Esc closes it) ----------
export function sheet(title, body, { onMount, onClose } = {}) {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet';
  dlg.innerHTML = String(html`
    <div class="sheet-head">
      <h2>${title}</h2>
      <button class="icon-btn" data-close aria-label="Close">${ic('x')}</button>
    </div>
    <div class="sheet-body">${body}</div>`);
  document.body.append(dlg);
  const close = () => dlg.close();
  dlg.addEventListener('close', () => { dlg.remove(); onClose?.(); });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) close();
  });
  dlg.showModal();
  onMount?.(dlg, close);
  return { el: dlg, close };
}

export function confirmSheet(title, text, okLabel = 'Yes', danger = false) {
  return new Promise((resolve) => {
    let answer = false;
    sheet(title, html`
      <p class="muted">${text}</p>
      <div class="row gap">
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} grow" data-ok>${okLabel}</button>
        <button class="btn grow" data-close>Cancel</button>
      </div>`, {
      onMount: (dlg, close) => dlg.querySelector('[data-ok]').addEventListener('click', () => { answer = true; close(); }),
      onClose: () => resolve(answer),
    });
  });
}

// Number input with big − / + buttons. Returns HTML; wire with bindSteppers(root).
export function stepper({ id, value, step, min = 0, max = 999, unit = '', decimals = 1, label = '' }) {
  const v = value == null || value === '' ? '' : Number(value).toFixed(decimals);
  return html`
    <div class="stepper" data-stepper="${id}" data-step="${step}" data-min="${min}" data-max="${max}" data-dec="${decimals}">
      <button class="step-btn" data-dir="-1" aria-label="Less">${ic('minus', 26)}</button>
      <label class="step-field">
        <input id="${id}" type="text" inputmode="decimal" value="${v}" aria-label="${label || id}" autocomplete="off">
        <span class="step-unit">${unit}</span>
      </label>
      <button class="step-btn" data-dir="1" aria-label="More">${ic('plus', 26)}</button>
    </div>`;
}

export function bindSteppers(root) {
  root.querySelectorAll('[data-stepper]').forEach((box) => {
    const input = box.querySelector('input');
    const step = Number(box.dataset.step), min = Number(box.dataset.min), max = Number(box.dataset.max), dec = Number(box.dataset.dec);
    box.querySelectorAll('.step-btn').forEach((b) => b.addEventListener('click', () => {
      const cur = parseNum(input.value);
      const base = Number.isFinite(cur) ? cur : Number(input.placeholder) || min;
      const next = Math.min(max, Math.max(min, base + Number(b.dataset.dir) * step));
      input.value = next.toFixed(dec);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }));
  });
}

// Accepts "73,4" as well as "73.4".
export const parseNum = (s) => Number(String(s ?? '').trim().replace(',', '.'));
