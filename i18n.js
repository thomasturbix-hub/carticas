/* =====================================================================
 * Carticas Mágicas — i18n.js
 * Idiomas. Se carga ANTES que data.js.
 *
 *   I18N.t(key, vars)    → texto en el idioma actual. key también puede ser un mensaje {k, v}.
 *   I18N.msg(key, vars)  → mensaje {k, v} para GUARDAR (registro de combate, eventos…): se traduce al pintarlo.
 *   I18N.ref(type, id)   → nombre que se resuelve al pintar (cambiar de idioma no deja nombres viejos guardados).
 *
 * Diccionarios:
 *   STR[key] = { es, en }               textos de la interfaz (strings.js de cada idioma, abajo)
 *   DATA_TEXT.en['CARDS.llama.name']    textos de data.js por ruta (el español vive en data.js)
 * Plurales: el valor puede ser { one, other } y se elige con vars.n.
 * Interpolación: {nombre} o {0}, {1}… (posicionales).
 *
 * Añadir un idioma = añadir sus textos (LANGS, STR[k].xx y DATA_TEXT.xx). Nada más.
 * Lógica pura (sin Phaser). En Node: require('./i18n.js') → siempre español.
 * ===================================================================== */
(function (root) {
  'use strict';

  const LANGS = ['es', 'en'];
  const LANG_NAMES = { es: 'Español', en: 'English' };
  const LOCALES = { es: 'es-ES', en: 'en-GB' };
  const KEY = 'cm_lang';

  const STR = {};            // key → { es, en }
  const DATA_TEXT = {};      // lang → { 'RUTA.de.dato': texto }
  const listeners = [];

  /** Idioma inicial: el guardado; si no, el del navegador ("es…" → es; cualquier otro → en). Node: es. */
  function detect() {
    try {
      const s = root.localStorage && root.localStorage.getItem(KEY);
      if (LANGS.includes(s)) return s;
    } catch (e) { /* sin almacenamiento */ }
    if (typeof module !== 'undefined' && module.exports && typeof root.document === 'undefined') return 'es';   // Node (tests): español
    const nav = root.navigator && (root.navigator.language || (root.navigator.languages || [])[0]);
    if (!nav) return 'es';
    return /^es/i.test(nav) ? 'es' : 'en';
  }

  const I18N = {
    LANGS, LANG_NAMES, KEY, STR, DATA_TEXT,
    lang: detect(),
    /** Añade textos de interfaz: { key: { es, en } } (se mezcla con lo que haya). */
    add(dict) { for (const [k, v] of Object.entries(dict)) STR[k] = Object.assign(STR[k] || {}, v); return I18N; },
    /** Añade textos de datos de un idioma: { 'CARDS.llama.name': '…' }. */
    addData(lang, map) { DATA_TEXT[lang] = Object.assign(DATA_TEXT[lang] || {}, map); return I18N; },
    has: (k) => !!STR[k],
    locale: () => LOCALES[I18N.lang] || 'es-ES',

    /** Mensaje para guardar: se traduce al pintarlo. */
    msg: (k, v) => (v ? { k, v } : { k }),
    /** Nombre por id (se resuelve con el idioma actual al pintar). */
    ref: (type, id, extra) => Object.assign({ ref: type, id }, extra || {}),

    /** Traduce. key: clave del diccionario, mensaje {k, v}, o texto suelto (se devuelve igual). */
    t(key, vars) {
      if (key && typeof key === 'object') {
        if (key.ref) return refName(key);
        return I18N.t(key.k, key.v);
      }
      if (typeof key !== 'string') return key == null ? '' : String(key);
      const e = STR[key];
      if (!e) return interp(fixOld(key), vars);   // texto sin clave (p. ej. guardados antiguos): tal cual, con la ortografía al día
      let s = e[I18N.lang];
      if (s === undefined) s = e.es;
      if (s && typeof s === 'object') {   // plural { one, other }
        const n = vars && (vars.n !== undefined ? vars.n : vars[0]);
        s = (I18N.plural(n) === 'one' ? s.one : s.other) || s.other || s.one || '';
      }
      return interp(s, vars);
    },
    plural(n) {
      try { return new Intl.PluralRules(I18N.locale()).select(Number(n)) === 'one' ? 'one' : 'other'; } catch (e) { return Number(n) === 1 ? 'one' : 'other'; }
    },

    /* ---------- Números y fechas (Intl) ---------- */
    num(n, opts) { try { return new Intl.NumberFormat(I18N.locale(), opts).format(n); } catch (e) { return String(n); } },
    /** Puntuaciones: siempre con separador de miles (1.840 · 1,840). */
    score(n) { return I18N.num(Math.round(Number(n) || 0), { useGrouping: 'always' }); },
    /** Multiplicador con dos decimales máx.: ×1,15 · ×1.15 */
    mult(x) { return '×' + I18N.num(x, { minimumFractionDigits: 1, maximumFractionDigits: 2 }); },
    date(d, opts) { try { return new Intl.DateTimeFormat(I18N.locale(), opts).format(d); } catch (e) { return d.toISOString().slice(0, 10); } },
    /** Nombres de mes cortos de un idioma (para el texto de compartir del diario). */
    months(lang = I18N.lang) {
      return Array.from({ length: 12 }, (_, i) => {
        try { return new Intl.DateTimeFormat(LOCALES[lang], { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, i, 15))).replace('.', '').toLowerCase(); } catch (e) { return String(i + 1); }
      });
    },

    /* ---------- Cambio de idioma ---------- */
    setLang(l) {
      if (!LANGS.includes(l)) return false;
      I18N.lang = l;
      try { root.localStorage && root.localStorage.setItem(KEY, l); } catch (e) { /* sin almacenamiento */ }
      applyAllData();
      listeners.slice().forEach((f) => { try { f(l); } catch (e) { /* un oyente roto no rompe el resto */ } });
      return true;
    },
    onChange(f) { listeners.push(f); return () => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }; },

    /* ---------- Datos: data.js trae el español; aquí se cambia por el idioma actual ---------- */
    /**
     * Registra una colección de datos (p. ej. ('CARDS', D.CARDS)). Guarda una copia de sus textos en
     * español (hojas string, sin las claves técnicas) y aplica el idioma actual.
     */
    registerData(name, obj, opts = {}) {
      const snap = {};
      collect(obj, name, snap, opts.skip || SKIP);
      REG.push({ name, obj, snap, after: opts.after || null });
      applyData(REG[REG.length - 1]);
      return obj;
    },
    /** Texto en español de una ruta de datos (para migrar guardados antiguos que guardaban nombres). */
    es(path) { for (const r of REG) if (path in r.snap) return r.snap[path]; return undefined; },
    /** Todas las rutas registradas con su texto en español (tests: textos sin traducir). */
    dataPaths() { const out = {}; for (const r of REG) Object.assign(out, r.snap); return out; }
  };

  /* Claves técnicas que nunca se traducen */
  const SKIP = new Set(['id', 'art', 'icon', 'tier', 'class', 'rarity', 'type', 'shape', 'target', 'fx', 'starterRelic', 'starterDeck',
    'mechanics', 'acts', 'version', 'date', 'color', 'unlock', 'op', 'key', 'rune', 'summon', 'sid', 'level', 'when', 'stat']);
  const REG = [];
  function collect(o, path, snap, skip) {
    if (o == null) return;
    if (typeof o === 'string') { snap[path] = o; return; }
    if (typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (skip.has(k)) continue;
      const v = o[k];
      if (typeof v === 'function') continue;
      collect(v, `${path}.${k}`, snap, skip);
    }
  }
  function setPath(root0, name, path, value) {
    const parts = path.slice(name.length + 1).split('.');
    let o = root0;
    for (let i = 0; i < parts.length - 1; i++) { o = o[parts[i]]; if (o == null) return; }
    o[parts[parts.length - 1]] = value;
  }
  function applyData(r) {
    const tr = I18N.lang === 'es' ? null : DATA_TEXT[I18N.lang] || {};
    for (const [p, es] of Object.entries(r.snap)) setPath(r.obj, r.name, p, tr && tr[p] !== undefined ? tr[p] : es);
    if (r.after) r.after(r.obj);
  }
  function applyAllData() { REG.forEach(applyData); }

  /* ---------- Nombres por id (refs) ---------- */
  function refName(r) {
    const D = root.CM_DATA;
    if (!D) return String(r.id);
    switch (r.ref) {
      case 'enemy': return (D.ENEMIES[r.id] || {}).name || r.id;
      case 'card': { const c = D.CARDS[r.id]; return c ? c.name + (r.up2 ? '++' : r.up ? '+' : '') : r.id; }
      case 'contract': return ((D.CONTRACTS || {})[r.id] || {}).name || r.id;
      case 'cards': {   // «A, B y C» / «A, B and C»
        const ns = (r.list || []).map((x) => refName(Object.assign({ ref: 'card' }, x)));
        return ns.length > 1 ? ns.slice(0, -1).join(', ') + I18N.t('ui.and') + ns[ns.length - 1] : ns.join('');
      }
      case 'relic': return (D.ALL_RELICS[r.id] || {}).name || r.id;
      case 'potion': return (D.POTIONS[r.id] || {}).name || r.id;
      case 'summon': return (D.SUMMONS[r.id] || {}).name || r.id;
      case 'rune': return (D.RUNES[r.id] || {}).name || r.id;
      case 'affix': return (D.AFFIXES[r.id] || {}).name || r.id;
      case 'affixes': { const ns = (r.list || []).map((id) => (D.AFFIXES[id] || {}).name || id); return ns.length > 1 ? ns.slice(0, -1).join(', ') + I18N.t('ui.and') + ns[ns.length - 1] : ns.join(''); }
      case 'char': return (D.CHARACTERS[r.id] || {}).name || r.id;
      case 'move': {   // movimiento de un enemigo: { id, ph (fase), i (índice) }
        const e = D.ENEMIES[r.id];
        if (!e) return r.name || '';
        const list = r.ph >= 3 && e.phase3 ? e.phase3.moves : r.ph >= 2 && e.phase2 ? e.phase2.moves : e.moves;
        return (list && list[r.i] && list[r.i].name) || r.name || '';
      }
      case 'key': return I18N.t(r.id, r.v);
      default: return String(r.id);
    }
  }
  I18N.refName = refName;

  /** Textos guardados por versiones antiguas: el nombre del personaje se escribía con tilde; ahora es «Piromago». */
  const fixOld = (s) => (s.indexOf('mago') < 0 ? s : s.replace(/P(i)r[\u00f3\u00d3]mago/gi, (m) => (m === m.toUpperCase() ? 'PIROMAGO' : m[0] + 'iromago')));
  I18N.fixOld = fixOld;

  /* ---------- Interpolación ---------- */
  /**
   * Plural dentro del texto: «{n|carta|cartas}» elige la forma según el número de vars.n (o la variable que se nombre).
   * Es LA función de plural: toda cadena con número la usa (o un valor { one, other }). Sirve también para data.js.
   */
  function plurals(s, vars) {
    if (typeof s !== 'string' || s.indexOf('|') < 0) return s;
    return s.replace(/\{(\w+)\|([^{}|]*)\|([^{}]*)\}/g, (m, k, one, other) => {
      if (!vars || !(k in vars)) return m;
      return I18N.plural(vars[k]) === 'one' ? one : other;
    });
  }
  I18N.plurals = plurals;
  /** Porcentaje según el idioma: «25 %» (es, con espacio fino que no se parte) · «25%» (en). */
  I18N.pct = (n) => (I18N.lang === 'es' ? n + '\u00a0%' : n + '%');
  function interp(s, vars) {
    if (!vars || typeof s !== 'string' || s.indexOf('{') < 0) return s;
    s = plurals(s, vars);
    return s.replace(/\{(\w+)\}/g, (m, k) => {
      if (!(k in vars)) return m;
      const v = vars[k];
      if (v && typeof v === 'object') return v.ref ? refName(v) : I18N.t(v);
      return v == null ? '' : String(v);
    });
  }

  root.CM_I18N = I18N;
  if (typeof module !== 'undefined' && module.exports) {   // Node: carga también los textos (en el navegador van en sus <script>)
    module.exports = I18N;
    require('./i18n_strings.js');
    require('./i18n_data_en.js');
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
