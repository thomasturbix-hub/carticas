/* =====================================================================
 * Carticas Mágicas — savecode.js
 * Exportar / importar el progreso como texto («CMSAVE1:…»), para jugar fuera
 * de claude.ai (móvil, .exe, web) sin perderlo.
 *
 * Formato: "CMSAVE" + versión + ":" + método + base64
 *   método 'D' = JSON comprimido con deflate-raw · 'J' = JSON sin comprimir (navegadores sin CompressionStream)
 *   JSON = { v: 1, game: 'carticas', at: ISO, sum: FNV-1a(JSON de [v, game, at, data]), data: { cm_*: string } }
 * data son las claves cm_* de localStorage tal cual (meta, partidas, ajustes…), menos las de este módulo.
 * Puro en lo posible: encode/decode/collect no tocan el juego; apply/undo sí (y recargan).
 * ===================================================================== */
(function (root) {
  'use strict';
  const PREFIX = 'CMSAVE', VERSION = 1, GAME = 'carticas';
  const UNDO_KEY = 'cm_import_undo';      // copia de antes de importar (sessionStorage: dura hasta cerrar el juego)
  const WARN_KEY = 'cm_localwarn';        // aviso «tu progreso se guarda en este dispositivo» ya cerrado
  const EXCLUDE = new Set([UNDO_KEY, WARN_KEY]);
  const RUN_KEYS = ['cm_run_v1', 'cm_run_custom_v1'];
  const RUN_AT_KEY = 'cm_run_at';
  const META_KEY = 'cm_meta_v1';

  /* ---------- utilidades puras ---------- */
  /** FNV-1a de 32 bits en hex (suma de control del contenido). */
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }
  const utf8 = (s) => new TextEncoder().encode(s);
  const fromUtf8 = (b) => new TextDecoder('utf-8', { fatal: true }).decode(b);
  function toB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return root.btoa(s);
  }
  function fromB64(str) {
    const s = root.atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  const canZip = () => typeof root.CompressionStream === 'function' && typeof root.DecompressionStream === 'function';
  async function pipe(bytes, stream) {
    const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }
  const deflate = (b) => pipe(b, new root.CompressionStream('deflate-raw'));
  const inflate = (b) => pipe(b, new root.DecompressionStream('deflate-raw'));

  /* ---------- almacenamiento ---------- */
  const LS = () => { try { return root.localStorage || null; } catch (e) { return null; } };
  const SS = () => { try { return root.sessionStorage || null; } catch (e) { return null; } };
  /** Todo lo guardado del juego: { clave cm_*: valor } (sin las claves de este módulo). */
  function collect(ls = LS()) {
    const out = {};
    if (!ls) return out;
    try {
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k && k.startsWith('cm_') && !EXCLUDE.has(k)) out[k] = ls.getItem(k);
      }
    } catch (e) { /* sin acceso */ }
    const sorted = {};
    Object.keys(out).sort().forEach((k) => { sorted[k] = out[k]; });
    return sorted;
  }

  /* ---------- código ---------- */
  /** data → «CMSAVE1:D…». Asíncrono (la compresión del navegador lo es). */
  async function encode(data, at = new Date().toISOString(), opts = {}) {
    const clean = {};
    Object.keys(data || {}).sort().forEach((k) => { if (typeof data[k] === 'string' && k.startsWith('cm_') && !EXCLUDE.has(k)) clean[k] = data[k]; });
    const sum = fnv1a(JSON.stringify([VERSION, GAME, at, clean]));   // cubre TODO el contenido (también la fecha)
    const json = JSON.stringify({ v: VERSION, game: GAME, at, sum, data: clean });
    const raw = utf8(json);
    if (canZip() && !opts.plain) {
      try { return `${PREFIX}${VERSION}:D${toB64(await deflate(raw))}`; } catch (e) { /* cae a sin comprimir */ }
    }
    return `${PREFIX}${VERSION}:J${toB64(raw)}`;
  }
  /**
   * Texto (código suelto o archivo con cabecera) → { ok: true, payload } | { ok: false, err }.
   * err: 'empty' · 'format' (no es un código) · 'version' (de otra versión incompatible) · 'corrupt' (incompleto o dañado) · 'unsupported'
   */
  async function decode(text) {
    let s = String(text == null ? '' : text);
    if (!s.trim()) return { ok: false, err: 'empty' };
    const at = s.indexOf(PREFIX);
    if (at < 0) return { ok: false, err: 'format' };
    s = s.slice(at).replace(/\s+/g, '');                         // el móvil a veces mete saltos o espacios al pegar
    const m = /^CMSAVE(\d+):([A-Z])([A-Za-z0-9+/=_-]*)$/.exec(s);
    if (!m) {
      const v = /^CMSAVE(\d+):/.exec(s);
      if (v && Number(v[1]) !== VERSION) return { ok: false, err: 'version' };
      return { ok: false, err: v ? 'corrupt' : 'format' };
    }
    if (Number(m[1]) !== VERSION) return { ok: false, err: 'version' };
    if (m[2] !== 'D' && m[2] !== 'J') return { ok: false, err: 'version' };
    if (!m[3]) return { ok: false, err: 'corrupt' };
    let p;
    try {
      let bytes = fromB64(m[3]);
      if (m[2] === 'D') {
        if (!canZip()) return { ok: false, err: 'unsupported' };
        bytes = await inflate(bytes);
      }
      p = JSON.parse(fromUtf8(bytes));
    } catch (e) { return { ok: false, err: 'corrupt' }; }
    if (!p || typeof p !== 'object' || p.game !== GAME) return { ok: false, err: 'format' };
    if (p.v !== VERSION) return { ok: false, err: 'version' };
    const d = p.data;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, err: 'corrupt' };
    for (const k of Object.keys(d)) if (typeof d[k] !== 'string' || !k.startsWith('cm_')) return { ok: false, err: 'corrupt' };
    if (p.sum !== fnv1a(JSON.stringify([p.v, p.game, p.at, d]))) return { ok: false, err: 'corrupt' };
    return { ok: true, payload: { v: p.v, at: typeof p.at === 'string' ? p.at : '', data: d } };
  }

  /* ---------- lectura para el resumen y para aplicar ---------- */
  /** Meta saneada (migración de versiones antiguas) o null. */
  function metaOf(data) {
    const M = root.CM_META;
    if (!data[META_KEY]) return M ? M.sanitize(null) : null;
    try { return M ? M.sanitize(JSON.parse(data[META_KEY])) : JSON.parse(data[META_KEY]); } catch (e) { return null; }
  }
  /** Partida a medias (objeto) o null si no hay o es incompatible. */
  function runOf(data, key) {
    const E = root.CM_ENGINE;
    if (!data[key] || !E) return null;
    try { const r = E.deserialize(data[key]); return r && !r.over ? r : null; } catch (e) { return null; }
  }
  /** Datos para el resumen: { essence, played, aff: { ch, level } | null, run: act | 0, custom: act | 0, at }. */
  function summary(payload) {
    const M = root.CM_META, D = root.CM_DATA, data = payload.data || {}, meta = metaOf(data) || {};
    let aff = null;
    if (M && meta.affinity) {
      for (const ch of Object.keys(meta.affinity)) {
        const xp = (meta.affinity[ch] && meta.affinity[ch].xp) || 0;
        if (xp > 0 && (!aff || xp > aff.xp)) aff = { ch, xp, level: M.affinityLevel(xp).level, name: D && D.CHARACTERS[ch] ? D.CHARACTERS[ch].name : ch };
      }
    }
    const r = runOf(data, RUN_KEYS[0]), c = runOf(data, RUN_KEYS[1]);
    return {
      essence: M ? M.essenceBalance(meta) : 0, played: meta.played || 0, aff,
      run: r ? r.act || 1 : 0, custom: c ? c.act || 1 : 0, at: payload.at || ''
    };
  }

  /** Sustituye TODO lo guardado por data (ya validada): meta migrada, partidas comprobadas. Devuelve el data escrito. */
  function writeAll(data, ls = LS()) {
    const out = {}, now = new Date().toISOString();
    for (const k of Object.keys(data)) if (k.startsWith('cm_') && !EXCLUDE.has(k)) out[k] = data[k];
    const meta = metaOf(out);
    if (meta) { meta.savedAt = now; out[META_KEY] = JSON.stringify(meta); } else delete out[META_KEY];
    let anyRun = false;
    for (const k of RUN_KEYS) { if (out[k] && root.CM_ENGINE && !runOf(out, k)) delete out[k]; else if (out[k]) anyRun = true; }   // partida incompatible: fuera
    if (anyRun || out[RUN_AT_KEY]) out[RUN_AT_KEY] = now;     // la partida importada es la más reciente (nube)
    if (!ls) throw new Error('sin almacenamiento');
    const old = Object.keys(collect(ls));
    old.forEach((k) => { try { ls.removeItem(k); } catch (e) { /* nada */ } });
    for (const k of Object.keys(out)) ls.setItem(k, out[k]);
    return out;
  }

  /* ---------- deshacer (hasta cerrar el juego) ---------- */
  function backup() { const ss = SS(); try { if (ss) { ss.setItem(UNDO_KEY, JSON.stringify(collect())); return true; } } catch (e) { /* lleno o bloqueado */ } return false; }
  function undoData() { const ss = SS(); try { const s = ss && ss.getItem(UNDO_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  const hasUndo = () => !!undoData();
  function clearUndo() { const ss = SS(); try { if (ss) ss.removeItem(UNDO_KEY); } catch (e) { /* nada */ } }

  /** Sube a la nube lo recién escrito (si hay nube), para que sustituya y no se fusione. */
  async function pushCloud() {
    const Cloud = root.CM_CLOUD;
    if (!Cloud || !Cloud.pushNow) return false;
    try { return await Promise.race([Cloud.pushNow(), new Promise((r) => setTimeout(() => r(false), 6000))]); } catch (e) { return false; }
  }
  const reload = () => { try { root.location.reload(); } catch (e) { /* sin navegador (pruebas) */ } };

  /** Importa: copia de lo actual → escribe → nube → recarga el juego (título). */
  async function apply(payload, opts = {}) {
    backup();
    writeAll(payload.data);
    await pushCloud();
    if (opts.reload !== false) reload();
    return true;
  }
  /** Vuelve a lo que había antes de la última importación. */
  async function undo(opts = {}) {
    const d = undoData();
    if (!d) return false;
    writeAll(d);
    clearUndo();
    await pushCloud();
    if (opts.reload !== false) reload();
    return true;
  }

  /** Nombre del archivo: carticas_progreso_AAAA-MM-DD.txt (fecha local). */
  function fileName(date = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `carticas_progreso_${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.txt`;
  }

  const SaveCode = { PREFIX, VERSION, UNDO_KEY, WARN_KEY, EXCLUDE, fnv1a, encode, decode, collect, summary, metaOf, runOf, writeAll, backup, hasUndo, undoData, clearUndo, apply, undo, fileName, canZip };
  if (typeof module !== 'undefined' && module.exports) module.exports = SaveCode;
  root.CM_SAVE = SaveCode;
})(typeof globalThis !== 'undefined' ? globalThis : this);
