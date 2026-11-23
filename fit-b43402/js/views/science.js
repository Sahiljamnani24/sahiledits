// The science: every rule the app uses, in plain words, with what it means for you and the source.
import * as app from '../app.js';
import { NOTES } from '../notes.js';
import { html, ic } from '../ui.js';

export const title = 'The science';

let area = 'all';
const AREAS = [['all', 'All'], ['food', 'Food'], ['body', 'Body & weight'], ['gym', 'Gym'], ['life', 'Sleep & steps']];

export async function render(root, params) {
  const want = params.get('n');
  if (want) area = 'all';
  const c = { t: { ...app.formulaTargets(), ...app.state.targets }, p: app.state.profile, plan: app.planTotal() };
  const list = NOTES.filter((n) => area === 'all' || n.area === area);

  root.innerHTML = String(html`
    <p class="soft" style="margin:0">Every number in this app comes from research. Here is each rule in plain words, what it means for you, and the study behind it.</p>
    <div class="filter-row" role="group" aria-label="Topic">${AREAS.map(([id, label]) => html`<button class="${id === area ? 'on' : ''}" data-area="${id}">${label}</button>`)}</div>
    <div class="card">${list.map((n) => html`
      <article class="note" id="n-${n.id}">
        <h3>${n.title}</h3>
        <p>${n.text}</p>
        <div class="you"><b>For you:</b> ${n.you(c)}</div>
        <div class="refs">${n.refs.map((r) => html`<a href="${r.url}" target="_blank" rel="noopener noreferrer">${ic('book-open', 13)} ${r.cite}</a>`)}</div>
      </article>`)}</div>
    <p class="muted small center">All sources checked on Crossref, Nov 2026.</p>`);

  root.querySelectorAll('[data-area]').forEach((b) => b.addEventListener('click', () => {
    area = b.dataset.area;
    if (location.hash.includes('?')) history.replaceState(null, '', location.pathname + location.search + '#science');
    app.refresh();
  }));
  if (want) {
    const el = root.querySelector(`#n-${CSS.escape(want)}`);
    if (el) requestAnimationFrame(() => { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); el.style.background = 'rgba(96,165,250,0.08)'; el.style.borderRadius = '12px'; });
  }
}
