/* Client for the smart-editor service (Cloud Run: sahiledits-agent).
 * One request, one streaming answer (NDJSON lines): progress lines while it works, then {type:"result",plan} or {type:"error"}.
 * Works in the page (global AGENTCLIENT) and in Node (module.exports) so the parsing and the failure paths are testable offline. */
(function (root) {
  const DEFAULT_URL = 'https://sahiledits-agent-1013977539156.asia-southeast1.run.app';
  const APIKEY = 'sb_publishable_E3uLCBXf8LWHwUHC4wpsdQ_J_OfjtVI';   // the same public key every other call on this page sends
  const MAX_VIDEO = 24 * 1024 * 1024;       // like the cloud export: bigger videos go without frames (words + sound only)
  const QUIET_MS = 45000;                   // the service sends a ping every 8 s: no line for this long = it is gone
  const TOTAL_MS = 540000;                  // hard stop for one job (the service stops itself at ~7 min)

  /* The service address can be overridden ONLY on a local dev host. On the real site a link like /studio?agent=https://other.site
   * would send the visitor's video and words to someone else's server. */
  function isLocalHost() {
    try { return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(String(root.location && root.location.hostname)); } catch (_) { return false; }
  }
  function baseUrl() {
    if (!isLocalHost()) return DEFAULT_URL;
    try { if (root.SAHIL_AGENT_URL) return String(root.SAHIL_AGENT_URL).replace(/\/$/, ''); } catch (_) { /* ignore */ }
    try { const q = new URLSearchParams(root.location && root.location.search).get('agent'); if (q) return q.replace(/\/$/, ''); } catch (_) { /* ignore */ }
    return DEFAULT_URL;
  }
  function disabled() {
    try { if (new URLSearchParams(root.location && root.location.search).get('noagent') === '1') return true; } catch (_) { /* ignore */ }
    try { return !!(root.localStorage && root.localStorage.getItem('sahil_noagent') === '1'); } catch (_) { return false; }
  }

  /* Incremental NDJSON: feed the whole responseText so far and the offset already consumed; returns the new events and the new offset. */
  function parseNdjson(text, offset) {
    const events = []; let pos = offset || 0;
    for (;;) {
      const nl = text.indexOf('\n', pos);
      if (nl < 0) break;
      const line = text.slice(pos, nl).trim(); pos = nl + 1;
      if (!line) continue;
      try { events.push(JSON.parse(line)); } catch (_) { /* a damaged line is skipped, the stream goes on */ }
    }
    return { events, offset: pos };
  }

  const fin = Number.isFinite;
  function validWords(words, duration) {
    return Array.isArray(words) && words.length > 0 && words.length <= 1500 &&
      words.every(w => w && typeof w.word === 'string' && fin(w.start) && fin(w.end) && w.start >= 0 && w.end >= w.start && w.end <= duration + 0.6);
  }
  function validPlan(plan, duration) {
    return !!plan && Array.isArray(plan.clips) && plan.clips.length > 0 && plan.clips.length <= 50 &&
      plan.clips.every(c => c && fin(c.start) && fin(c.end) && c.start >= 0 && c.end > c.start && c.end <= duration + 0.05) &&
      (plan.zooms === undefined || (Array.isArray(plan.zooms) && plan.zooms.every(z => z && fin(z.start) && fin(z.end) && z.start >= 0 && z.end > z.start && z.end <= duration + 0.05 && z.end - z.start <= 5)));
  }
  function envelopePayload(env) {
    if (!env || !env.db || !env.db.length || env.db.length > 30000) return undefined;
    return { hop: env.hop, db: Array.from(env.db, v => Math.round(v * 10) / 10) };
  }
  /* What the plan needs to come back for a revision (the service is stateless). */
  function planForRevision(plan) {
    const keep = ['hook', 'clips', 'captionFixes', 'cards', 'zooms', 'musicMood', 'notes'];     // the words travel separately (meta.words)
    const out = {}; for (const k of keep) if (plan[k] !== undefined) out[k] = plan[k];
    out.meta = { page_numbers: (plan.meta && plan.meta.page_numbers) || [] };
    return out;
  }

  /* kind: 'edit' | 'revise'. opts: {meta, video (File|null), onProgress(text), XHR, FormData, fetchUrl}. Resolves with the plan, rejects with Error(plain message). */
  function call(kind, opts) {
    const XHR = opts.XHR || root.XMLHttpRequest, FD = opts.FormData || root.FormData;
    return new Promise((resolve, reject) => {
      const xhr = new XHR(); let offset = 0, settled = false, lastLine = Date.now(), plan = null, serverError = null, sawProgress = false;
      const started = Date.now();
      const done = (fn, v) => { if (settled) return; settled = true; clearInterval(watch); fn(v); };
      const watch = setInterval(() => {
        if (settled) return;
        const why = Date.now() - lastLine > QUIET_MS ? 'The smart editor stopped answering.' : Date.now() - started > TOTAL_MS ? 'The smart editor took too long.' : '';
        if (why) { done(reject, Error(why)); try { xhr.abort(); } catch (_) { /* ignore */ } }      // reject first: abort() fires onabort at once
      }, opts.watchMs || 5000);
      let body, headers = { apikey: APIKEY };
      if (opts.video) { body = new FD(); body.append('meta', JSON.stringify(opts.meta)); body.append('video', opts.video); }
      else { body = JSON.stringify(opts.meta); headers['Content-Type'] = 'application/json'; }
      xhr.open('POST', (opts.url || baseUrl()) + '/agent/' + kind);
      for (const k of Object.keys(headers)) xhr.setRequestHeader(k, headers[k]);
      xhr.timeout = 0;
      if (xhr.upload) xhr.upload.onprogress = e => { lastLine = Date.now(); if (e.lengthComputable && opts.onProgress && !sawProgress) opts.onProgress('Uploading video: ' + Math.round(e.loaded / e.total * 100) + '%'); };
      const eat = () => {
        const r = parseNdjson(xhr.responseText || '', offset); offset = r.offset;
        for (const ev of r.events) {
          lastLine = Date.now();
          if (ev.type === 'progress') { sawProgress = true; if (opts.onProgress) opts.onProgress(String(ev.text || '')); }
          else if (ev.type === 'result') plan = ev.plan;
          else if (ev.type === 'error') serverError = String(ev.message || 'The smart editor failed.');
        }
      };
      xhr.onprogress = eat;
      xhr.onerror = () => done(reject, Error('Could not reach the smart editor.'));
      xhr.ontimeout = () => done(reject, Error('The smart editor timed out.'));
      xhr.onabort = () => done(reject, Error('The smart editor request was cancelled.'));
      xhr.onload = () => {
        if (xhr.status !== 200) {
          let msg = 'The smart editor answered with status ' + xhr.status + '.';
          try { msg = JSON.parse(xhr.responseText).error || msg; } catch (_) { /* keep default */ }
          return done(reject, Error(msg));
        }
        eat();
        if (serverError) return done(reject, Error(serverError));
        if (!plan) return done(reject, Error('The smart editor ended without a plan.'));
        done(resolve, plan);
      };
      xhr.send(body);
    });
  }

  const api = {
    MAX_VIDEO, QUIET_MS, baseUrl, disabled, parseNdjson, validWords, validPlan, envelopePayload, planForRevision,
    edit: opts => call('edit', opts), revise: opts => call('revise', opts),
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AGENTCLIENT = api;
})(typeof window !== 'undefined' ? window : globalThis);
