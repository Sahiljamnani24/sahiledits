// Boot + router + top bar + bottom bar.
import * as app from './app.js';
import { html, ic } from './ui.js';
import * as today from './views/today.js';
import * as progress from './views/progress.js';
import * as gym from './views/gym.js';
import * as food from './views/food.js';
import * as checkin from './views/checkin.js';
import * as settings from './views/settings.js';
import * as science from './views/science.js';
import * as setup from './views/setup.js';

const ROUTES = { today, progress, gym, food, checkin, settings, science, setup };
const NAV = [
  ['today', 'Today', 'calendar-check'],
  ['progress', 'Progress', 'chart-line'],
  ['gym', 'Gym', 'dumbbell'],
  ['food', 'Food', 'utensils'],
  ['checkin', 'Check-in', 'clipboard-check'],
];

function parseHash() {
  const [name, q] = location.hash.slice(1).split('?');
  return { name: name || 'today', params: new URLSearchParams(q || '') };
}

let lastRoute = null;

async function route() {
  let { name, params } = parseHash();
  if (!app.state.profile) name = 'setup';
  else if (name === 'setup') name = 'today';
  const view = ROUTES[name] || today;
  const root = document.getElementById('view');
  const changed = name !== lastRoute;
  lastRoute = name;
  document.body.dataset.route = name;

  document.getElementById('nav').innerHTML = name === 'setup' ? '' : String(html`${NAV.map(([id, label, icon]) => html`
    <a href="#${id}" class="${id === name ? 'on' : ''}" ${id === name ? 'aria-current="page"' : ''}>${ic(icon, 24)}<span>${label}</span></a>`)}`);

  const head = document.getElementById('header');
  const left = view.header ? view.header(params) : html`<h1>${view.title}</h1>`;
  head.innerHTML = String(html`
    <div class="head-left">${left}</div>
    ${name === 'setup' ? '' : html`<div class="head-right">
      <a class="icon-btn ${name === 'science' ? 'on' : ''}" href="#science" aria-label="The science">${ic('book-open')}</a>
      <a class="icon-btn ${name === 'settings' ? 'on' : ''}" href="#settings" aria-label="Settings">${ic('settings')}</a>
    </div>`}`);
  view.bindHeader?.(head);

  try {
    await view.render(root, params);
  } catch (err) {
    console.error(err);
    root.innerHTML = String(html`<div class="card"><h2>Something went wrong</h2><p class="muted">${err.message}</p></div>`);
  }
  if (changed) { window.scrollTo(0, 0); root.focus({ preventScroll: true }); }
}

app.setRefresh(() => route());
window.addEventListener('hashchange', route);
// Keep Chrome's install prompt so Settings can show an "Install the app" button.
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e; });

(async function boot() {
  await app.load();
  await route();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (['localhost', '127.0.0.1'].includes(location.hostname)) {
    const dev = await import('./dev.js');
    window.__fm = { app, ...dev };
  }
})();
