/* AVTV-style tightening: word-edge cuts, 1-2 word captions, word fixes.
 * Works in the page (global TIGHTEN) and in Node (module.exports). No network.
 * Numbers come from the AVTV reference: pauses over ~0.3s are gone, a cut every ~2.3s,
 * captions are 1-2 words. See ~/sahiledits-planner-work/AVTV_STYLE.md */
(function (root) {
  const PAD_AFTER = 0.12, PAD_BEFORE = 0.05;      // room kept around a cut: ~0.17s of natural gap
  const ok = w => w && typeof w.word === 'string' && Number.isFinite(w.start) && Number.isFinite(w.end) && w.start >= 0 && w.end >= w.start;

  function buildCuts(sorted, thr, duration) {
    const found = [];
    // dead air before the first word: the reel starts on the first word
    if (sorted.length && sorted[0].start >= 0.4) found.push({ start: 0, end: round(sorted[0].start - 0.08) });
    let lastEnd = -1;
    for (const w of sorted) {
      if (lastEnd >= 0) {
        const gap = w.start - lastEnd;
        if (gap >= thr) {
          const a = Math.min(PAD_AFTER, gap / 2), b = Math.min(PAD_BEFORE, gap / 2);
          const start = lastEnd + a, end = w.start - b;
          if (end - start >= 0.12) found.push({ start: round(start), end: round(end) });
        }
      }
      lastEnd = Math.max(lastEnd, w.end);
    }
    // dead air after the last word
    if (Number.isFinite(duration) && sorted.length && duration - lastEnd >= 0.6) found.push({ start: round(lastEnd + 0.3), end: round(duration) });
    return found;
  }

  /* Cut windows from the audio itself: every stretch of silence >= thr, keeping ~0.17s of room. */
  function buildAudioCuts(env, thr, duration) {
    const mask = voicedMask(env); if (!mask) return null;
    const found = [];
    for (let i = 0; i < mask.length;) {
      let j = i; while (j < mask.length && mask[j] === mask[i]) j++;
      if (!mask[i]) {
        const a = i * env.hop, b = j * env.hop, len = b - a;
        if (i === 0 && len >= 0.4) found.push({ start: 0, end: round(b - 0.08) });                       // dead air before the first sound
        else if (j >= mask.length - 1 && Number.isFinite(duration) && duration - a >= 0.6) found.push({ start: round(a + 0.3), end: round(duration) });   // and after the last
        else if (len >= thr) { const s0 = a + PAD_AFTER, e0 = b - PAD_BEFORE; if (e0 - s0 >= 0.12) found.push({ start: round(s0), end: round(e0) }); }
      }
      i = j;
    }
    return found;
  }

  /* Pause windows to REMOVE. Every gap >= 0.35s goes; if that makes too many cuts for the
   * exporter (50 clips), the threshold is raised step by step so the export never fails. */
  function makeTightCuts(words, opt) {
    opt = opt || {};
    const sorted = (words || []).filter(ok).sort((a, b) => a.start - b.start);
    const maxCuts = opt.maxCuts == null ? 40 : opt.maxCuts;
    let found = [];
    for (const thr of (opt.thresholds || [0.35, 0.45, 0.6, 0.8, 1.2, 2])) {
      found = (opt.env && buildAudioCuts(opt.env, thr, opt.duration)) || buildCuts(sorted, thr, opt.duration);   // real silence when we have the audio
      if (found.length <= maxCuts) break;
    }
    return found;
  }

  /* The AI planner writes clip start/end as free seconds. Snap each one onto real word edges so
   * a cut can never land inside a word. A word belongs to a clip when its midpoint is inside. */
  function snapClips(clips, words, duration) {
    const ws = (words || []).filter(ok).sort((a, b) => a.start - b.start);
    if (!ws.length) return clips;
    const out = [];
    for (const c of clips || []) {
      const idx = [];
      ws.forEach((w, i) => { const m = (w.start + w.end) / 2; if (m >= c.start && m <= c.end) idx.push(i); });
      if (!idx.length) continue;
      const a = idx[0], z = idx[idx.length - 1];
      const lo = a > 0 ? ws[a - 1].end : 0, hi = z + 1 < ws.length ? ws[z + 1].start : (duration || ws[z].end + 1);
      const start = ws[a].start - Math.min(PAD_BEFORE, Math.max(0, (ws[a].start - lo) / 2));
      const end = ws[z].end + Math.min(PAD_AFTER, Math.max(0, (hi - ws[z].end) / 2));
      if (end - start >= 0.1) out.push({ start: round(Math.max(0, start)), end: round(duration ? Math.min(duration, end) : end) });
    }
    out.sort((x, y) => x.start - y.start);
    const merged = [];
    for (const c of out) {
      if (merged.length && c.start - merged[merged.length - 1].end < 0.08) merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, c.end);
      else merged.push(c);
    }
    return merged;
  }

  /* 1-2 word caption cues (the reference averages ~1.7). Breaks after . ! ? , ; : and at gaps. */
  function groupCaptionWords(words, opt) {
    opt = opt || {};
    const maxWords = opt.maxWords || 2, maxChars = opt.maxChars || 22, gapBreak = opt.gapBreak == null ? 0.35 : opt.gapBreak;
    const groups = []; let cur = [];
    const flush = () => { if (cur.length) { groups.push(cur); cur = []; } };
    for (const w of (words || []).filter(ok)) {
      if (cur.length) {
        const joined = cur.concat([w]).map(x => x.word.trim()).join(' ');
        if (cur.length >= maxWords || joined.length > maxChars || w.start - cur[cur.length - 1].end > gapBreak) flush();
      }
      cur.push(w);
      if (/[.!?,;:।]$/.test(w.word.trim())) flush();
    }
    flush();
    const cues = groups.map(g => {
      const start = Math.max(0, g[0].start);
      let end = Math.max(g[g.length - 1].end, start + 0.3);
      if (opt.duration) end = Math.min(opt.duration, end);
      return { start, end, text: g.map(w => w.word.trim()).join(' '), words: g };
    }).filter(c => c.end > c.start);
    for (let i = 0; i + 1 < cues.length; i++) if (cues[i].end > cues[i + 1].start) cues[i].end = Math.max(cues[i].start + 0.1, cues[i + 1].start);
    return cues;
  }

  /* Spelling fixes from the AI: [{i: wordIndex, text: "F1", n: 2}] replaces n words (default 1)
   * starting at original index i with one word that spans their timing. Indexes refer to the
   * ORIGINAL array, so several fixes can be applied at once. Timings are never invented. */
  function applyWordFixes(words, fixes) {
    const src = words || [], byIndex = new Map();
    for (const f of fixes || []) {
      const i = Number(f.i), n = f.n == null ? 1 : Number(f.n);
      if (Number.isInteger(i) && i >= 0 && i < src.length && Number.isInteger(n) && n >= 1 && n <= 4 && i + n <= src.length
          && typeof f.text === 'string' && f.text.trim() && f.text.length <= 40) byIndex.set(i, { n, text: f.text.trim() });
    }
    const out = [];
    for (let i = 0; i < src.length;) {
      const f = byIndex.get(i);
      if (f) { out.push(Object.assign({}, src[i], { word: f.text, end: src[i + f.n - 1].end })); i += f.n; }
      else { out.push(Object.assign({}, src[i])); i++; }
    }
    return out;
  }

  /* ---- real silence from the audio -------------------------------------------------------------
   * Speech-to-text (Groq / Whisper) stretches a word's end over the silence that follows it ("braking," 4.4s),
   * so gaps between words hide the real pauses. Measure loudness instead: 10 ms frames in dB. */
  function envelope(samples, rate, hop) {
    hop = hop || 0.01;
    const H = Math.max(1, Math.round(rate * hop)), W = H * 2, n = Math.max(0, Math.floor((samples.length - W) / H));
    const db = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0; const a = i * H;
      for (let k = 0; k < W; k++) { const v = samples[a + k]; sum += v * v; }
      db[i] = 10 * Math.log10(sum / W + 1e-12);
    }
    return { hop, db };
  }

  /* voiced = clearly above the room noise: threshold sits 30% of the way from noise floor (10th pct) to speech (90th pct). */
  function voicedMask(env) {
    const sorted = Array.from(env.db).sort((a, b) => a - b);
    if (sorted.length < 20) return null;
    const floor = sorted[Math.floor(sorted.length * 0.1)], speech = sorted[Math.floor(sorted.length * 0.9)];
    if (speech - floor < 8) return null;                      // no clear speech/noise separation: do not guess
    const thr = floor + Math.max(6, 0.3 * (speech - floor));
    const mask = Array.from(env.db, v => v > thr);
    const fill = Math.round(0.06 / env.hop), blip = Math.round(0.04 / env.hop);   // bridge 60 ms dips, drop 40 ms clicks
    for (let i = 0; i < mask.length;) {
      let j = i; while (j < mask.length && mask[j] === mask[i]) j++;
      if (!mask[i] && j - i <= fill && i > 0 && j < mask.length) for (let k = i; k < j; k++) mask[k] = true;
      i = j;
    }
    for (let i = 0; i < mask.length;) {
      let j = i; while (j < mask.length && mask[j] === mask[i]) j++;
      if (mask[i] && j - i <= blip) for (let k = i; k < j; k++) mask[k] = false;
      i = j;
    }
    return mask;
  }

  /* Pull each word's start/end onto the sound that is really there. Words keep their order and text. */
  function refineWords(words, env) {
    const mask = env && voicedMask(env);
    if (!mask) return words;
    const hop = env.hop, out = [];
    for (const w of words || []) {
      if (!ok(w)) { out.push(w); continue; }
      const i0 = Math.max(0, Math.floor(w.start / hop)), i1 = Math.min(mask.length, Math.ceil(w.end / hop));
      // sound runs inside the word. A short sliver glued to either edge is the NEIGHBOUR's tail or onset (20 ms analysis frames bleed), so ignore it.
      const runs = [];
      for (let i = i0; i < i1;) { if (!mask[i]) { i++; continue; } let j = i; while (j < i1 && mask[j]) j++; runs.push([i, j]); i = j; }
      const solid = runs.filter(([a, b]) => !((a === i0 || b === i1) && b - a < 5));
      const first = solid.length ? solid[0][0] : -1, last = solid.length ? solid[solid.length - 1][1] - 1 : -1;
      let start = w.start, end = w.end;
      if (first >= 0) {
        const s2 = Math.max(0, first * hop - 0.03), e2 = (last + 1) * hop + 0.05;
        if (s2 - start > 0.08) start = s2;                    // the word really starts later than reported
        if (end - e2 > 0.08) end = e2;                        // the word really ends earlier: the rest is silence
      }
      if (end < start + 0.05) { start = w.start; end = w.end; }
      out.push(Object.assign({}, w, { start: round(start), end: round(end) }));
    }
    return out;
  }

  function round(n) { return Math.round(n * 1000) / 1000; }
  const api = { makeTightCuts, snapClips, groupCaptionWords, applyWordFixes, envelope, voicedMask, refineWords, highlight: false };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TIGHTEN = api;
})(typeof window !== 'undefined' ? window : globalThis);
