/* =====================================================================
 * Carticas Mágicas — ui.js
 * Utilidades de presentación para Phaser: paleta, tipografía, texturas
 * procedurales (placeholders), botones, cartas, barras, tooltips,
 * sonido sintetizado y guardado local.
 * ===================================================================== */
(function (root) {
  'use strict';
  const E = root.CM_ENGINE;

  /* ---------------- Paleta y tipografía ---------------- */
  /**
   * Paleta de trabajo del código antiguo (C.*): ahora SALE del sistema visual (src/ui/theme.js).
   * Interfaz → tokens del tema; juego (escarcha, llamas, arcano…) → TH.game. Ningún color nuevo aquí.
   */
  const TH = root.CM_THEME;
  const C = {
    ink: TH.color.deep, moss: TH.game.moss, panel: TH.color.surface, panel2: TH.color.surfaceRaised, line: TH.color.line,
    parch: TH.num(TH.color.ink), muted: TH.num(TH.color.muted), ember: TH.color.ember, flame: TH.game.flame, gold: TH.color.gold,
    blood: TH.color.danger, frost: TH.game.frost, arcane: TH.game.arcane, leaf: TH.color.heal, ash: TH.game.ash, bg: TH.color.bg
  };
  /**
   * Capas de dibujo: TODA profundidad del juego sale de aquí (LAYER.x + un offset pequeño dentro de su capa).
   * El test test/layers.js falla si aparece un setDepth con un número suelto.
   *   bg fondos · world ambiente · units personajes/criaturas · hand mano de cartas · fx efectos y textos flotantes
   *   hud barra superior · panel paneles fijos · tooltip tooltips/glosarios · modal ventanas · tip consejos · toast avisos
   */
  const LAYER = Object.freeze({ bg: 0, world: 100, units: 500, hand: 1000, fx: 2000, hud: 4000, panel: 4500, tooltip: 5000, modal: 7000, tip: 8000, toast: 9000 });
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const F = { display: TH.font.display, body: TH.font.ui, mono: TH.font.mono };   // del tema: gótica (h1 y logo), serif de interfaz y mono (códigos)
  /** Código o semilla para LEER: monoespaciada y el 0 como Ø, que no se confunda con la O (al copiar va el texto real). */
  const codeShow = (s) => String(s == null ? '' : s).replace(/0/g, 'Ø');
  const TYPE_COLOR = { attack: 0xd9553b, skill: 0x5f9fcf, power: C.arcane, curse: 0x6f6f6f };
  const I18N = root.CM_I18N;
  /** Traduce (clave, variables) o un mensaje guardado {k, v}. */
  const _t = (k, v) => I18N.t(k, v);
  const TYPE_LABEL = { get attack() { return _t('u.ataque'); }, get skill() { return _t('u.habilidad'); }, get power() { return _t('u.poder'); }, get curse() { return _t('u.maldicion'); } };
  const RARITY_COLOR = { starter: 0x8a8573, common: 0xbfb8a0, uncommon: C.frost, rare: C.gold, legendary: 0xffe08a, curse: 0x6f6f6f, special: 0xb98cff };   // especial: cartas de evento

  /** Texto con resolución alta para que no se vea borroso al escalar el canvas. */
  function T(scene, x, y, str, o = {}) {
    if (str && typeof str === 'object' && !Array.isArray(str)) str = _t(str);   // mensaje {k, v} o referencia guardados: se traducen al pintar
    const t = scene.add.text(x, y, str, {
      fontFamily: o.font === 'display' ? F.display : o.font === 'mono' ? F.mono : F.body,
      fontSize: (o.size || 18) + 'px',
      fontStyle: o.bold ? 'bold' : (o.style || 'normal'),
      color: hex(o.color !== undefined ? o.color : C.parch),
      align: o.align || 'left',
      wordWrap: o.wrap ? { width: o.wrap, useAdvancedWrap: true } : undefined,
      lineSpacing: o.lineSpacing || 0,
      stroke: o.stroke !== undefined ? hex(o.stroke) : undefined,
      strokeThickness: o.strokeThickness || 0,
      resolution: 2
    });
    t.setOrigin(o.ox !== undefined ? o.ox : 0.5, o.oy !== undefined ? o.oy : 0.5);
    if (o.shadow) t.setShadow(0, 2, '#000000', 6, true, true);
    InlineIcons.attach(t);   // ⚙ 🌐 ★ ✓… → imágenes dibujadas (nunca emojis del sistema)
    return t;
  }

  /* =================================================================
   * Iconos dentro del texto (sin emojis). Cada símbolo de INLINE se cambia en el texto por un hueco (espacio eme)
   * y encima se pinta su icono: imagen 'ic_*' o trazo dibujado (✓ ✗ ↔) en el color del texto.
   * Funciona con saltos de línea, ajuste de palabras, alineación, fitText/fitLine y setText posteriores.
   * ================================================================= */
  const INLINE = {
    '⚙': { ic: 'gear' }, '🌐': { ic: 'globe' }, '📖': { ic: 'book' }, '🎮': { ic: 'ui_gamepad' }, '🔥': { ic: 'flame' },
    '🔒': { ic: 'lock' }, '⚔': { ic: 'ui_swords' }, '☠': { ic: 'skull' }, '🎲': { ic: 'ui_dice' }, '★': { ic: 'star' }, '✦': { ic: 'spark' },
    '✓': { draw: 'check' }, '✔': { draw: 'check' }, '✗': { draw: 'cross' }, '✖': { draw: 'cross' }, '↔': { draw: 'swap' }
  };
  const INLINE_RE = new RegExp('(' + Object.keys(INLINE).join('|') + ')\\uFE0F?', 'gu');
  const INLINE_PH = '\u2003';   // hueco de 1 eme (el ancho del icono)
  const InlineIcons = {
    /** Engancha un Text: traduce sus símbolos ahora y en cada setText. */
    attach(t) {
      const set0 = t.setText.bind(t);
      t.setText = (v) => { InlineIcons.apply(t, v, set0); return t; };
      if (INLINE_RE.test(t.text)) { INLINE_RE.lastIndex = 0; InlineIcons.apply(t, t.text, set0); }
      INLINE_RE.lastIndex = 0;
    },
    apply(t, v, set0) {
      const str = v == null ? '' : String(v);
      const toks = [];
      const out = str.replace(INLINE_RE, (m, ch) => { toks.push(INLINE[ch]); return INLINE_PH; });
      set0(out);
      t._inl = toks.length ? toks : null;
      if (toks.length && !t._inlOn) InlineIcons.track(t);
      if (t._inlOn) t._inlSig = '';   // repintar en el siguiente fotograma
    },
    /** Sigue al texto (posición, tamaño, visibilidad…) y recoloca sus iconos cuando algo cambia. */
    track(t) {
      const sc = t.scene;
      t._inlOn = true; t._inlObjs = [];
      const sync = () => {
        if (!t.active) return;
        const parent = t.parentContainer;
        const sig = [t.text, t.style.fontSize, t.x, t.y, t.scaleX, t.scaleY, t.originX, t.originY, t.width, t.style.align, parent ? parent.list.indexOf(t) : -1].join('|');
        if (sig !== t._inlSig) { t._inlSig = sig; InlineIcons.layout(t); }
        for (const o of t._inlObjs) { o.setVisible(t.visible); o.setAlpha(t.alpha); if (!parent) o.setDepth(t.depth); o.setScrollFactor(t.scrollFactorX, t.scrollFactorY); }
      };
      sc.events.on('prerender', sync);
      t.once('destroy', () => { sc.events.off('prerender', sync); t._inlObjs.forEach((o) => o.destroy()); t._inlObjs = []; });
      sync();
    },
    layout(t) {
      t._inlObjs.forEach((o) => o.destroy()); t._inlObjs = [];
      if (!t._inl || !t._inl.length) return;
      const sc = t.scene, st = t.style, ctx = t.context, fs = parseInt(st.fontSize, 10) || 18;
      ctx.save(); ctx.font = st._font;
      const lines = st.wordWrapWidth || st.wordWrapCallback ? t.getWrappedText(t.text) : String(t.text).split(/\r?\n/);
      const stroke = st.strokeThickness || 0, lh = fs + stroke + (t.lineSpacing || 0);
      const widths = lines.map((l) => ctx.measureText(l).width + stroke);
      const textW = Math.max(0, ...widths), pad = t.padding || { left: 0, top: 0 };
      const metrics = t.getTextMetrics ? t.getTextMetrics() : { fontSize: fs };
      const lineH = (metrics.fontSize || fs) + stroke, step = lineH + (t.lineSpacing || 0);
      const col = typeof st.color === 'string' ? parseInt(st.color.replace('#', ''), 16) : C.parch;
      const parent = t.parentContainer;
      let k = 0;
      lines.forEach((line, li) => {
        let from = 0;
        for (;;) {
          const idx = line.indexOf(INLINE_PH, from);
          if (idx < 0 || k >= t._inl.length) break;
          const tok = t._inl[k++];
          let lx = pad.left + ctx.measureText(line.slice(0, idx)).width + ctx.measureText(INLINE_PH).width / 2;
          if (st.align === 'center') lx += (textW - widths[li]) / 2; else if (st.align === 'right') lx += textW - widths[li];
          const ly = pad.top + li * step + lineH / 2;
          // local (dentro del Text) → coordenadas del padre (escena o contenedor)
          const x = t.x + (lx - t.width * t.originX) * t.scaleX, y = t.y + (ly - t.height * t.originY) * t.scaleY;
          const size = fs * 0.92 * t.scaleY;
          let o;
          if (tok.ic) o = sc.add.image(x, y, 'ic_' + tok.ic).setDisplaySize(size, size);
          else {
            o = sc.add.graphics({ x, y }); const r = size / 2; o.lineStyle(Math.max(1.5, fs / 9), col, 1);
            if (tok.draw === 'check') { o.beginPath(); o.moveTo(-r * 0.7, 0); o.lineTo(-r * 0.15, r * 0.55); o.lineTo(r * 0.75, -r * 0.6); o.strokePath(); }
            else if (tok.draw === 'cross') { o.lineBetween(-r * 0.6, -r * 0.6, r * 0.6, r * 0.6); o.lineBetween(r * 0.6, -r * 0.6, -r * 0.6, r * 0.6); }
            else { o.lineBetween(-r * 0.8, 0, r * 0.8, 0); o.lineBetween(-r * 0.8, 0, -r * 0.4, -r * 0.35); o.lineBetween(-r * 0.8, 0, -r * 0.4, r * 0.35); o.lineBetween(r * 0.8, 0, r * 0.4, -r * 0.35); o.lineBetween(r * 0.8, 0, r * 0.4, r * 0.35); }
          }
          if (parent) parent.addAt(o, parent.list.indexOf(t) + 1);
          t._inlObjs.push(o);
          from = idx + 1;
        }
      });
      ctx.restore();
    }
  };

  /** Reduce el tamaño de fuente hasta que el texto quepa en maxW × maxH. */
  function fitText(t, maxW, maxH, minSize = 10) {
    let size = parseInt(t.style.fontSize, 10);
    while (size > minSize && (t.width > maxW || (maxH && t.height > maxH))) {
      size--;
      t.setFontSize(size);
      if (t.style.wordWrapWidth) t.setWordWrapWidth(maxW, true);
    }
    return t;
  }

  /** Una línea que debe caber: baja el cuerpo hasta `min` y, si aún no cabe, se estrecha (nunca se sale ni baja de min). */
  function fitLine(t, maxW, min = TH.size.micro) {
    fitText(t, maxW, 0, min);
    if (t.width > maxW) t.setScale((maxW / t.width) * (t.scaleY || 1), t.scaleY || 1);
    return t;
  }

  /* ---------------- Promesas para animar en secuencia ---------------- */
  const tw = (scene, cfg) => new Promise((res) => scene.tweens.add({ ...cfg, onComplete: () => res() }));
  const wait = (scene, ms) => new Promise((res) => scene.time.delayedCall(ms, res));

  /* ---------------- Guardado local (puede fallar: modo privado, etc.) ---------------- */
  /**
   * localStorage con try/catch. Es la caché y el respaldo sin conexión del guardado en la nube:
   * cada escritura avisa a `onWrite` (cloud.js) y la partida guardada lleva su marca de tiempo.
   * setRaw/delRaw escriben sin avisar (para aplicar datos que vienen de la nube).
   */
  const SAVE_KEY = 'cm_run_v1', RUN_AT_KEY = 'cm_run_at';
  const Store = {
    onWrite: null,
    get(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } },
    setRaw(k, v) { try { root.localStorage.setItem(k, v); } catch (e) { /* sin persistencia */ } },
    delRaw(k) { try { root.localStorage.removeItem(k); } catch (e) { /* idem */ } },
    set(k, v) { this.setRaw(k, v); this.touched(k); },
    del(k) { this.delRaw(k); this.touched(k); },
    touched(k) {
      if (k === SAVE_KEY) this.setRaw(RUN_AT_KEY, new Date().toISOString());   // savedAt de la partida a medias
      if (this.onWrite) { try { this.onWrite(k); } catch (e) { /* la nube nunca rompe el juego */ } }
    }
  };
  /** Partida personalizada: guardado propio (no pisa la partida normal ni el diario, y al revés). Solo local. */
  const CUSTOM_SAVE_KEY = 'cm_run_custom_v1';
  const saveKeyOf = (run) => (run && run.custom ? CUSTOM_SAVE_KEY : SAVE_KEY);
  function saveRun(run) { if (!run) return; if (!run.over) Store.set(saveKeyOf(run), E.serialize(run)); else Store.del(saveKeyOf(run)); }
  /** kind: 'normal' (partida normal o diario) · 'custom' (personalizada). */
  function loadRun(kind = 'normal') {
    const key = kind === 'custom' ? CUSTOM_SAVE_KEY : SAVE_KEY;
    const s = Store.get(key);
    if (!s) return null;
    try { const run = E.deserialize(s); if (!!run.custom !== (kind === 'custom')) return null; return run; } catch (e) { Store.del(key); return null; }
  }

  /* ---------------- Sonido: samples (assets/sfx) con respaldo sintetizado ---------------- */
  /** Efectos con archivo: clave = nombre del archivo en assets/sfx (se cargan en Boot con .ogg y .mp3). */
  const SFX_FILES = ['fire_cast', 'fire_burn', 'fire_tick', 'fire_small', 'fire_big', 'overheat', 'supernova',
    'fire_crackle_loop', 'ice_chill', 'ice_freeze', 'ice_shatter'];
  /** Si falta el sample, suena este sintetizado (null = silencio). */
  const SFX_FALLBACK = { fire_cast: null, fire_burn: 'burn', fire_tick: 'burn', fire_small: null, fire_big: 'hit',
    overheat: 'hurt', supernova: 'win', fire_crackle_loop: null, ice_chill: 'icy', ice_freeze: 'icy', ice_shatter: 'block' };
  /** Pistas de música (assets/music). 'bosque' es opcional: si no existe, fuera de los jefes hay silencio. */
  const MUSIC_FILES = ['jefe', 'bosque'];
  const MAX_COPIES = 2;   // como mucho 2 copias a la vez del mismo sample

  /**
   * Volúmenes del jugador (0..1 en pasos de 0.1): Música y Efectos. Todos los volúmenes del
   * juego se multiplican por ellos. Se guardan en localStorage (Store ya usa try/catch).
   * Quien tenía «Sonido: no» (cm_mute) empieza con los dos a 0.
   */
  const VOL_KEY = 'cm_vol';
  const Vol = (() => {
    const clamp = (v, d) => (typeof v === 'number' && isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 10) / 10 : d);
    let saved = null;
    try { saved = JSON.parse(Store.get(VOL_KEY) || 'null'); } catch (e) { saved = null; }
    const legacyMute = !saved && Store.get('cm_mute') === '1';
    return { music: legacyMute ? 0 : clamp(saved && saved.music, 0.6), sfx: legacyMute ? 0 : clamp(saved && saved.sfx, 0.8), voice: clamp(saved && saved.voice, 0.9), clamp };
  })();
  function saveVol() { Store.set(VOL_KEY, JSON.stringify({ music: Vol.music, sfx: Vol.sfx, voice: Vol.voice })); }   // voice: la voz de la intro (Parche 3.7)

  /**
   * Opciones de juego (localStorage 'cm_opts'): velocidad de animación del combate (×1/×2/×3)
   * y aviso al terminar el turno con energía y cartas jugables. Al cambiar, avisa a las escenas
   * activas que tengan applyOptions() (el combate reajusta su timeScale al momento).
   */
  const OPTS_KEY = 'cm_opts';
  const Opts = (() => {
    let saved = null;
    try { saved = JSON.parse(Store.get(OPTS_KEY) || 'null'); } catch (e) { saved = null; }
    const sp = saved && [1, 2, 3].includes(saved.speed) ? saved.speed : 1;
    return { speed: sp, endWarn: !(saved && saved.endWarn === false), reduceMotion: !!(saved && saved.reduceMotion),
      vibration: !(saved && saved.vibration === false),   // vibración del mando: activada por defecto
      gfx: saved && ['auto', 'high', 'perf'].includes(saved.gfx) ? saved.gfx : 'auto' };   // calidad gráfica (src/ui/hires.js la lee al arrancar)
  })();
  let optsGame = null;   // se engancha en Sfx.attach
  function setOpt(k, v) {
    Opts[k] = v;
    Store.set(OPTS_KEY, JSON.stringify({ speed: Opts.speed, endWarn: Opts.endWarn, reduceMotion: Opts.reduceMotion, vibration: Opts.vibration, gfx: Opts.gfx }));
    if (optsGame) optsGame.scene.getScenes(true).forEach((sc) => { if (sc.applyOptions) sc.applyOptions(); });
  }
  /** Siguiente velocidad (tecla V): 1 → 2 → 3 → 1. */
  const cycleSpeed = () => { setOpt('speed', Opts.speed % 3 + 1); return Opts.speed; };
  /** Atajos de teclado (escritorio), para el «?» del panel ⚙. */
  const SHORT_KEYS = [['1 … 9, 0', 'sc.select'], ['sc.enterKey', 'sc.play'], ['sc.endKey', 'sc.end'], ['D', 'sc.deck'], ['V', 'sc.speed'], ['Esc', 'sc.close']];
  /** Atajos traducidos al idioma actual: [tecla, qué hace]. */
  const shortcuts = () => SHORT_KEYS.map(([k, d]) => [I18N.has(k) ? _t(k) : k, _t(d)]);

  /** Fundido de volumen independiente de las escenas (sobrevive a los cambios de escena). */
  function fadeSound(snd, to, ms, done) {
    if (!snd) { if (done) done(); return; }
    if (snd._fade) clearInterval(snd._fade);
    const from = snd.volume, t0 = Date.now();
    if (ms <= 0) { snd.setVolume(to); if (done) done(); return; }
    snd._fade = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / ms);
      try { snd.setVolume(from + (to - from) * k); } catch (e) { /* sonido ya destruido */ }
      if (k >= 1) { clearInterval(snd._fade); snd._fade = null; if (done) done(); }
    }, 40);
  }

  const Sfx = {
    ctx: null,
    game: null,          // se engancha en Boot (Sfx.attach) para usar el gestor de audio de Phaser
    live: {},            // clave → instancias sonando (límite MAX_COPIES)
    loops: new Set(),    // bucles de efectos activos (se reajustan al mover la barra de Efectos)
    attach(game) {
      this.game = game; optsGame = game;
      try { game.sound.pauseOnBlur = false; } catch (e) { /* sin audio */ }
    },
    /** Cambia el volumen de efectos (0..1): reajusta los bucles que suenan y lo guarda. */
    setSfxVolume(v) {
      Vol.sfx = Vol.clamp(v, Vol.sfx); saveVol();
      for (const snd of this.loops) { if (!snd._fade) { try { snd.setVolume((snd._base || 0) * Vol.sfx); } catch (e) { this.loops.delete(snd); } } }
    },
    /** ¿Hay sample cargado con esa clave? */
    has(key) { try { return !!(this.game && this.game.cache.audio.exists(key)); } catch (e) { return false; } },
    /** Lista de samples que NO se cargaron (para el arnés de pruebas). */
    missing() { return SFX_FILES.concat(MUSIC_FILES.filter((k) => k !== 'bosque')).filter((k) => !this.has(k)); },
    /**
     * Reproduce un sample. opts: { volume, loop, detune }. Devuelve la instancia o null.
     * Variación natural: detune aleatorio ±80 (≈ ±5% de tono), salvo en los bucles.
     */
    sample(key, opts = {}) {
      if (!this.has(key) || (Vol.sfx <= 0 && !opts.loop)) return null;   // 0% = silencio (los bucles arrancan igual, a 0)
      try {
        const list = (this.live[key] = (this.live[key] || []).filter((x) => x.isPlaying));
        if (!opts.loop && list.length >= MAX_COPIES) return null;
        const detune = opts.loop ? 0 : (opts.detune !== undefined ? opts.detune : Math.round((Math.random() * 2 - 1) * 80));
        const base = opts.volume !== undefined ? opts.volume : 1;
        const snd = this.game.sound.add(key, { volume: base * Vol.sfx, loop: !!opts.loop, detune });
        snd._base = base;
        list.push(snd);
        if (opts.loop) { this.loops.add(snd); snd.once('destroy', () => this.loops.delete(snd)); }
        const clean = () => { this.live[key] = (this.live[key] || []).filter((x) => x !== snd); try { snd.destroy(); } catch (e) { /* ya destruido */ } };
        snd.once('complete', clean);
        snd.once('stop', () => { if (!snd.loop) clean(); });
        snd.play();
        return snd;
      } catch (e) { return null; }
    },
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try { this.ctx = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { this.ctx = null; }
    },
    tone(freq, dur, type = 'sine', vol = 0.12, slide = 0, delay = 0) {
      if (!this.ctx || this.scale <= 0) return;
      const t0 = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
      g.gain.setValueAtTime(vol * this.scale, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    },
    noise(dur, vol = 0.12, filter = 1200) {
      if (!this.ctx || this.scale <= 0) return;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter;
      const g = this.ctx.createGain(); g.gain.value = vol * this.scale;
      src.connect(f).connect(g).connect(this.ctx.destination); src.start();
    },
    scale: 1,   // volumen relativo de la reproducción en curso
    /**
     * play(nombre, opts): si `nombre` es un sample cargado, suena el archivo; si no, su respaldo
     * sintetizado (SFX_FALLBACK) o el sintetizado del mismo nombre. opts: número (volumen) o
     * { volume, loop }. Nunca lanza errores aunque falte un archivo.
     */
    play(name, opts = {}) {
      if (typeof opts === 'number') opts = { volume: opts };
      if (Vol.sfx <= 0) return null;
      if (SFX_FILES.includes(name)) {
        if (this.has(name)) return this.sample(name, opts);
        name = SFX_FALLBACK[name];
        if (!name) return null;
      }
      this.synth(name, opts.volume !== undefined ? opts.volume : 1);
      return null;
    },
    /** Sonidos sintetizados (WebAudio puro): respaldo y efectos de interfaz. */
    synth(name, volume = 1) {
      const prev = this.scale;
      this.scale = volume * Vol.sfx;   // todo pasa por la barra de Efectos
      switch (name) {
        case 'card': this.tone(520, 0.08, 'triangle', 0.06, 200); break;
        case 'hit': this.noise(0.16, 0.22, 900); this.tone(140, 0.14, 'square', 0.05, -60); break;
        case 'hurt': this.noise(0.22, 0.25, 600); this.tone(110, 0.2, 'sawtooth', 0.06, -50); break;
        case 'block': this.tone(330, 0.12, 'triangle', 0.08, -40); this.tone(660, 0.08, 'sine', 0.04); break;
        case 'burn': this.noise(0.3, 0.12, 2400); break;
        case 'coin': this.tone(880, 0.07, 'square', 0.04); this.tone(1320, 0.1, 'square', 0.04, 0, 0.07); break;
        case 'deny': this.tone(180, 0.12, 'square', 0.05, -40); break;
        case 'click': this.tone(660, 0.04, 'triangle', 0.05); break;
        case 'turn': this.tone(392, 0.12, 'triangle', 0.06); this.tone(523, 0.16, 'triangle', 0.06, 0, 0.1); break;
        case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.07, 0, i * 0.11)); break;
        case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.08, 0, i * 0.16)); break;
        case 'heal': this.tone(523, 0.2, 'sine', 0.06, 260); break;
        // Acto II
        case 'chord':   // acorde grave y largo para la transición entre actos (Do menor abierto)
          [65.4, 98, 130.8, 155.6].forEach((f, i) => this.tone(f, 2.6, i < 2 ? 'sine' : 'triangle', 0.09, 0, i * 0.05));
          this.tone(32.7, 3, 'sine', 0.08);
          break;
        case 'icy':     // tintineo helado: tres notas agudas muy cortas
          [2093, 2637, 3136].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.035, -200, i * 0.05));
          this.noise(0.12, 0.04, 6000);
          break;
        case 'curse': this.tone(220, 0.25, 'sawtooth', 0.04, -90); this.tone(233, 0.25, 'sine', 0.04, -80); break;
        case 'steam': this.noise(0.45, 0.09, 3800); break;
      }
      this.scale = prev;
    }
  };

  /**
   * Música: una sola pista a la vez, con fundido cruzado. Pedir la pista que ya suena no la
   * reinicia (p. ej. al recargar el combate del jefe). Respeta el botón de sonido (mute global).
   */
  const Music = {
    current: null, key: null, baseVol: 0.4,
    play(key, volume = 0.4, fadeMs = 1500) {
      if (!key || !Sfx.has(key)) { this.stop(fadeMs); return; }   // sin archivo → silencio
      this.baseVol = volume; volume *= Vol.music;                  // barra de Música
      if (this.key === key && this.current) { fadeSound(this.current, volume, 400); return; }
      const old = this.current;
      if (old) fadeSound(old, 0, fadeMs, () => { try { old.stop(); old.destroy(); } catch (e) { /* nada */ } });
      try {
        const snd = Sfx.game.sound.add(key, { loop: true, volume: 0 });
        this.current = snd; this.key = key;
        const start = () => { try { snd.play(); fadeSound(snd, volume, fadeMs); } catch (e) { /* nada */ } };
        if (Sfx.game.sound.locked) Sfx.game.sound.once('unlocked', start); else start();
      } catch (e) { this.current = null; this.key = null; }
    },
    stop(fadeMs = 1500) {
      const old = this.current;
      this.current = null; this.key = null;
      if (old) fadeSound(old, 0, fadeMs, () => { try { old.stop(); old.destroy(); } catch (e) { /* nada */ } });
    },
    /** Música de fondo normal (fuera de los jefes): 'bosque' si existe; si no, silencio. */
    base(fadeMs = 1500) { this.play(Sfx.has('bosque') ? 'bosque' : null, 0.4, fadeMs); },
    /** Cambia el volumen de música (0..1) al momento y lo guarda. */
    setVolume(v) {
      Vol.music = Vol.clamp(v, Vol.music); saveVol();
      if (this.current) fadeSound(this.current, this.baseVol * Vol.music, 0);
    }
  };

  /** Bucle ambiental de una escena (p. ej. el crepitar de la hoguera) con fundido de entrada y salida. */
  function ambientLoop(scene, key, volume = 0.35, fadeMs = 800) {
    const snd = Sfx.sample(key, { loop: true, volume: 0 });
    if (!snd) return null;
    snd._base = volume;   // la barra de Efectos lo reajusta mientras suena
    fadeSound(snd, volume * Vol.sfx, fadeMs);
    const stop = () => fadeSound(snd, 0, fadeMs, () => { try { snd.stop(); snd.destroy(); } catch (e) { /* nada */ } });
    scene.events.once('shutdown', stop);
    return { snd, stop };
  }

  /* =================================================================
   * Texturas procedurales (placeholders del arte)
   * ================================================================= */
  function flamePts(cx, cy, s) {
    const raw = [[0, -1], [0.3, -0.55], [0.55, -0.1], [0.55, 0.35], [0.3, 0.72], [0, 0.82], [-0.3, 0.72],
      [-0.55, 0.35], [-0.5, -0.05], [-0.28, -0.25], [-0.2, -0.6]];
    return raw.map(([x, y]) => new Phaser.Math.Vector2(cx + x * s, cy + y * s));
  }
  function flame(g, cx, cy, s, outer = C.ember, inner = C.flame) {
    g.fillStyle(outer, 1); g.fillPoints(flamePts(cx, cy, s), true);
    g.fillStyle(inner, 1); g.fillPoints(flamePts(cx, cy + s * 0.25, s * 0.55), true);
    g.fillStyle(0xfff3c4, 1); g.fillPoints(flamePts(cx, cy + s * 0.45, s * 0.25), true);
  }
  function star(g, cx, cy, r1, r2, n, color) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n;
      const r = i % 2 ? r2 : r1;
      pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
    g.fillStyle(color, 1); g.fillPoints(pts, true);
  }
  const V = (x, y) => new Phaser.Math.Vector2(x, y);
  /** Huella de pata (Invocadora). */
  function paw(g, col) {
    g.fillStyle(col, 1); g.fillEllipse(32, 42, 26, 20);
    [[16, 26], [26, 18], [38, 18], [48, 26]].forEach(([x, y]) => g.fillEllipse(x, y, 10, 13));
    g.fillStyle(0xe6ffe9, 0.7); g.fillEllipse(29, 39, 8, 5);
  }

  /** Piedra rúnica: disco de piedra con borde y el glifo de cada runa (llama, escudo, remolino, gota, sol). */
  function runeStone(g, glyph, col) {
    g.fillStyle(0x3a332b, 1); g.fillCircle(32, 32, 30);
    g.fillStyle(0x6b6255, 1); g.fillCircle(32, 32, 27);
    g.fillStyle(0x857b6b, 1); g.fillCircle(28, 27, 18);
    g.fillStyle(0x6b6255, 1); g.fillCircle(32, 32, 21);
    g.lineStyle(2, 0x2a241e, 0.7); g.strokeCircle(32, 32, 27);
    g.lineStyle(4, col, 1); g.fillStyle(col, 1);
    if (glyph === 'fuego') { flame(g, 32, 34, 17, col, 0xffc46a); }
    else if (glyph === 'piedra') { const pts = [V(32, 13), V(47, 18), V(46, 32), V(32, 49), V(18, 32), V(17, 18)]; g.strokePoints(pts, true); g.lineBetween(32, 19, 32, 42); g.lineBetween(23, 26, 41, 26); }
    else if (glyph === 'viento') { g.beginPath(); for (let i = 0; i <= 40; i++) { const a = i * 0.32, r = 3 + i * 0.42; const x = 32 + Math.cos(a) * r, y = 32 + Math.sin(a) * r; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.strokePath(); }
    else if (glyph === 'sangre') { g.fillCircle(32, 37, 10); g.fillTriangle(32, 14, 23, 33, 41, 33); g.fillStyle(0xffb3b3, 0.8); g.fillCircle(28, 36, 3); }
    else if (glyph === 'ancestral') { g.fillCircle(32, 32, 8); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.lineBetween(32 + Math.cos(a) * 12, 32 + Math.sin(a) * 12, 32 + Math.cos(a) * 19, 32 + Math.sin(a) * 19); } }
    else { g.lineBetween(24, 18, 24, 46); g.lineBetween(24, 18, 40, 28); g.lineBetween(24, 32, 40, 42); }   // runa genérica
  }
  const RUNE_COL = { fuego: 0xff7a3d, piedra: 0xe8dcc0, viento: 0x8fe0c8, sangre: 0xe0475a, ancestral: 0xffd36a };
  const ICONS = {
    rune(g) { runeStone(g, 'generic', 0xffc46a); },
    /* ---- Electromante ---- */
    ebolt(g) {   // rayo azul eléctrico (Rayo, Estática)
      g.fillStyle(0x2a5f86, 1); g.fillPoints([V(40, 0), V(10, 38), V(29, 38), V(20, 64), V(56, 24), V(36, 24), V(46, 0)], true);
      g.fillStyle(0x7fd6ff, 1); g.fillPoints([V(39, 4), V(14, 35), V(31, 35), V(25, 56), V(51, 27), V(33, 27), V(42, 4)], true);
      g.fillStyle(0xeaf8ff, 1); g.fillPoints([V(37, 9), V(22, 30), V(31, 30), V(28, 42), V(42, 28), V(33, 28)], true);
    },
    magnet(g) {   // imán de herradura (Magnetizado)
      g.lineStyle(14, 0xd23a4a, 1); g.beginPath(); g.arc(32, 30, 17, Math.PI, 0, false); g.strokePath();
      g.fillStyle(0xd23a4a, 1); g.fillRect(8, 30, 14, 14); g.fillRect(42, 30, 14, 14);
      g.fillStyle(0xd7dde2, 1); g.fillRect(8, 44, 14, 12); g.fillRect(42, 44, 14, 12);
      g.lineStyle(2, 0x7fd6ff, 0.9); g.lineBetween(15, 60, 15, 63); g.lineBetween(49, 60, 49, 63);
    },
    coil(g) {     // bobina (Carga, Bobina de Tesla)
      g.fillStyle(0x5a4630, 1); g.fillRoundedRect(18, 52, 28, 8, 3);
      g.lineStyle(5, 0xd9904a, 1); for (let y = 18; y <= 48; y += 7) g.strokeEllipse(32, y, 26, 7);
      g.fillStyle(0xcfd6dc, 1); g.fillCircle(32, 10, 8);
      g.lineStyle(2.5, 0x7fd6ff, 1); g.lineBetween(40, 8, 50, 2); g.lineBetween(50, 2, 47, 11); g.lineBetween(47, 11, 58, 6);
    },
    loop(g) {     // infinito (Circuito, Bucle Infinito)
      g.lineStyle(7, 0x9ff0d0, 1); g.strokeEllipse(20, 32, 26, 22); g.strokeEllipse(44, 32, 26, 22);
      g.fillStyle(0xeafff6, 1); g.fillCircle(32, 32, 4);
    },
    /* ---- Paladín ---- */
    scales(g) {   // balanza (Juicio)
      const gold = 0xf2d36b, dk = 0xb08a2e;
      g.fillStyle(dk, 1); g.fillRect(30, 10, 4, 42); g.fillRoundedRect(18, 52, 28, 6, 3);
      g.fillStyle(gold, 1); g.fillRect(10, 14, 44, 4); g.fillCircle(32, 10, 5);
      g.lineStyle(2, gold, 1); g.lineBetween(12, 18, 6, 36); g.lineBetween(12, 18, 18, 36); g.lineBetween(52, 18, 46, 36); g.lineBetween(52, 18, 58, 36);
      g.fillStyle(gold, 1); g.fillEllipse(12, 38, 18, 7); g.fillEllipse(52, 38, 18, 7);
    },
    sun(g) {      // sol radiante (Fervor)
      g.fillStyle(0xf2d36b, 1);
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.fillTriangle(32 + Math.cos(a - 0.14) * 16, 32 + Math.sin(a - 0.14) * 16, 32 + Math.cos(a + 0.14) * 16, 32 + Math.sin(a + 0.14) * 16, 32 + Math.cos(a) * 29, 32 + Math.sin(a) * 29); }
      g.fillStyle(0xfff3c4, 1); g.fillCircle(32, 32, 15); g.fillStyle(0xffd75a, 1); g.fillCircle(32, 32, 9);
    },
    hammer(g) {
      g.fillStyle(0x7a5a30, 1); g.fillPoints([V(30, 26), V(36, 26), V(36, 62), V(30, 62)], true);
      g.fillStyle(0xc9ced4, 1); g.fillRoundedRect(10, 6, 46, 22, 4);
      g.fillStyle(0xf2d36b, 1); g.fillRect(10, 14, 46, 5);
    },
    ghost(g) {    // silueta etérea (Inmaterial)
      g.fillStyle(0xe8f0ff, 0.9); g.fillCircle(32, 26, 18); g.fillRect(14, 26, 36, 22);
      for (let i = 0; i < 3; i++) g.fillTriangle(14 + i * 12, 48, 26 + i * 12, 48, 20 + i * 12, 60);
      g.fillStyle(0x3a4a6a, 1); g.fillCircle(25, 26, 4); g.fillCircle(39, 26, 4);
    },
    medal(g) {
      g.fillStyle(0xc0283c, 1); g.fillTriangle(18, 4, 32, 4, 30, 30); g.fillTriangle(46, 4, 32, 4, 34, 30);
      g.fillStyle(0xb08a2e, 1); g.fillCircle(32, 42, 18); g.fillStyle(0xf2d36b, 1); g.fillCircle(32, 42, 14);
      star(g, 32, 42, 9, 4, 5, 0xfff3c4);
    },
    banner(g) {
      g.fillStyle(0x7a5a30, 1); g.fillRect(12, 4, 5, 58); g.fillStyle(0xf2d36b, 1); g.fillCircle(14, 5, 4);
      g.fillStyle(0xf2f0e6, 1); g.fillPoints([V(17, 8), V(56, 8), V(56, 42), V(37, 34), V(17, 42)], true);
      g.fillStyle(0xf2d36b, 1); g.fillCircle(36, 22, 7);
    },
    rune_fuego(g) { runeStone(g, 'fuego', RUNE_COL.fuego); },
    rune_piedra(g) { runeStone(g, 'piedra', RUNE_COL.piedra); },
    rune_viento(g) { runeStone(g, 'viento', RUNE_COL.viento); },
    rune_sangre(g) { runeStone(g, 'sangre', RUNE_COL.sangre); },
    rune_ancestral(g) { runeStone(g, 'ancestral', RUNE_COL.ancestral); },
    flame(g) { flame(g, 32, 34, 28); },
    spark(g) { star(g, 32, 32, 28, 8, 4, C.flame); star(g, 32, 32, 16, 5, 4, 0xfff3c4); g.fillStyle(C.ember, 1); g.fillCircle(50, 14, 4); g.fillCircle(14, 50, 3); },
    shield(g) {
      const pts = [V(32, 4), V(56, 12), V(54, 34), V(32, 60), V(10, 34), V(8, 12)];
      g.fillStyle(0x2f5f86, 1); g.fillPoints(pts, true);
      g.fillStyle(C.frost, 1); g.fillPoints([V(32, 10), V(50, 16), V(48, 33), V(32, 52), V(16, 33), V(14, 16)], true);
      flame(g, 32, 32, 12, C.ember, C.flame);
    },
    fireball(g) {
      g.fillStyle(C.ember, 0.6); g.fillTriangle(6, 8, 40, 26, 22, 44);
      g.fillStyle(C.ember, 1); g.fillCircle(38, 38, 20);
      g.fillStyle(C.flame, 1); g.fillCircle(40, 36, 13);
      g.fillStyle(0xfff3c4, 1); g.fillCircle(42, 34, 6);
    },
    burst(g) { star(g, 32, 32, 30, 14, 9, 0xd9553b); star(g, 32, 32, 20, 9, 9, C.ember); g.fillStyle(C.flame, 1); g.fillCircle(32, 32, 8); },
    wall(g) {
      g.fillStyle(0x7a3a26, 1); g.fillRect(4, 30, 56, 30);
      g.lineStyle(2, 0x3d1c12, 1);
      for (let y = 30; y <= 60; y += 10) g.lineBetween(4, y, 60, y);
      for (let r = 0; r < 3; r++) for (let x = (r % 2 ? 4 : 13); x < 60; x += 18) g.lineBetween(x, 30 + r * 10, x, 40 + r * 10);
      flame(g, 16, 20, 13); flame(g, 34, 16, 16); flame(g, 50, 21, 12);
    },
    snow(g) {
      g.lineStyle(4, C.frost, 1);
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI / 3;
        g.lineBetween(32 - Math.cos(a) * 26, 32 - Math.sin(a) * 26, 32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26);
      }
      g.fillStyle(0xe6f4ff, 1); g.fillCircle(32, 32, 6);
    },
    book(g) {
      g.fillStyle(0x5b3a68, 1); g.fillRoundedRect(8, 10, 48, 44, 4);
      g.fillStyle(0xe8dcc0, 1); g.fillRect(14, 14, 36, 36);
      g.lineStyle(2, 0x9a8d70, 1); for (let y = 20; y < 46; y += 6) g.lineBetween(18, y, 46, y);
      g.fillStyle(0x5b3a68, 1); g.fillRect(30, 12, 4, 40);
      flame(g, 48, 14, 10);
    },
    up(g) {
      g.fillStyle(C.arcane, 1); g.fillPoints([V(32, 4), V(56, 30), V(42, 30), V(42, 60), V(22, 60), V(22, 30), V(8, 30)], true);
      g.fillStyle(0xe4d7ff, 1); g.fillPoints([V(32, 14), V(46, 28), V(36, 28), V(36, 54), V(28, 54), V(28, 28), V(18, 28)], true);
    },
    eye(g) {
      g.fillStyle(0xe8d48a, 1); g.fillEllipse(32, 32, 58, 34);
      g.fillStyle(0xd9553b, 1); g.fillCircle(32, 32, 13);
      g.fillStyle(0x140a06, 1); g.fillEllipse(32, 32, 6, 22);
    },
    heart(g) {
      g.fillStyle(C.blood, 1); g.fillCircle(21, 24, 14); g.fillCircle(43, 24, 14); g.fillTriangle(8, 30, 56, 30, 32, 58);
      g.fillStyle(0xff8f97, 1); g.fillCircle(19, 20, 5);
    },
    urn(g) {
      g.fillStyle(0x6b5f55, 1); g.fillEllipse(32, 38, 40, 36); g.fillRect(22, 10, 20, 14);
      g.fillStyle(0x8a7d70, 1); g.fillRect(18, 8, 28, 6); g.fillRect(24, 54, 16, 6);
      g.fillStyle(0x9aa0a6, 0.8); g.fillCircle(28, 6, 4); g.fillCircle(36, 3, 3);
    },
    campfire(g) {
      g.fillStyle(0x6b4026, 1); g.fillRoundedRect(8, 48, 48, 8, 3);
      g.fillStyle(0x83502f, 1); g.fillRoundedRect(14, 42, 36, 8, 3);
      flame(g, 32, 30, 22);
    },
    sword(g) {
      g.fillStyle(0xd7dde2, 1); g.fillPoints([V(46, 6), V(56, 8), V(58, 18), V(26, 50), V(14, 38)], true);
      g.fillStyle(0x8a6a3a, 1); g.fillPoints([V(8, 34), V(14, 28), V(36, 50), V(30, 56)], true);
      g.fillStyle(0x5a3f21, 1); g.fillPoints([V(16, 44), V(22, 50), V(10, 62), V(4, 56)], true);
    },
    skull(g) {
      g.fillStyle(0xd9cdb0, 1); g.fillCircle(32, 28, 22); g.fillRoundedRect(20, 38, 24, 18, 4);
      g.fillStyle(0x1a0d0b, 1); g.fillCircle(24, 28, 7); g.fillCircle(40, 28, 7); g.fillTriangle(32, 34, 28, 42, 36, 42);
      g.fillStyle(0xd9553b, 1); g.fillCircle(24, 28, 3); g.fillCircle(40, 28, 3);
      g.fillStyle(0xd9cdb0, 1); g.fillTriangle(10, 18, 16, 4, 22, 14); g.fillTriangle(54, 18, 48, 4, 42, 14);
    },
    bag(g) {
      g.fillStyle(0x7a5a30, 1); g.fillEllipse(32, 40, 46, 38); g.fillTriangle(22, 18, 42, 18, 32, 30);
      g.fillStyle(0x4d3519, 1); g.fillRect(22, 18, 20, 4);
      g.fillStyle(C.gold, 1); g.fillCircle(32, 42, 9); g.fillStyle(0xb88f35, 1); g.fillCircle(32, 42, 5);
    },
    chest(g) {
      g.fillStyle(0x6b4026, 1); g.fillRoundedRect(6, 24, 52, 34, 4);
      g.fillStyle(0x83502f, 1); g.fillRoundedRect(6, 12, 52, 16, { tl: 10, tr: 10, bl: 0, br: 0 });
      g.fillStyle(C.gold, 1); g.fillRect(6, 26, 52, 4); g.fillRect(28, 22, 8, 14);
      g.fillStyle(0x2a170c, 1); g.fillRect(31, 30, 2, 4);
    },
    crown(g) {
      g.fillStyle(C.gold, 1); g.fillPoints([V(6, 50), V(6, 18), V(20, 32), V(32, 10), V(44, 32), V(58, 18), V(58, 50)], true);
      g.fillStyle(0xb88f35, 1); g.fillRect(6, 46, 52, 8);
      g.fillStyle(C.blood, 1); g.fillCircle(32, 36, 5); g.fillStyle(C.frost, 1); g.fillCircle(16, 40, 3); g.fillCircle(48, 40, 3);
    },
    weak(g) {
      g.fillStyle(0x9a8fb8, 1); g.fillPoints([V(32, 60), V(8, 34), V(22, 34), V(22, 4), V(42, 4), V(42, 34), V(56, 34)], true);
      g.fillStyle(0x51497a, 1); g.fillPoints([V(32, 50), V(18, 36), V(28, 36), V(28, 10), V(36, 10), V(36, 36), V(46, 36)], true);
    },
    strength(g) {
      g.fillStyle(C.blood, 1); g.fillPoints([V(32, 4), V(56, 30), V(42, 30), V(42, 60), V(22, 60), V(22, 30), V(8, 30)], true);
      g.fillStyle(0xff9a9f, 1); g.fillPoints([V(32, 14), V(46, 28), V(36, 28), V(36, 54), V(28, 54), V(28, 28), V(18, 28)], true);
    },
    coin(g) { g.fillStyle(0xb88f35, 1); g.fillCircle(32, 34, 26); g.fillStyle(C.gold, 1); g.fillCircle(32, 32, 26); g.fillStyle(0xf6dd93, 1); g.fillCircle(32, 32, 18); g.fillStyle(0xb88f35, 1); g.fillRect(29, 20, 6, 24); },
    bolt(g) { g.fillStyle(C.flame, 1); g.fillPoints([V(38, 2), V(12, 36), V(30, 36), V(24, 62), V(52, 26), V(34, 26)], true); },
    question(g) {
      g.lineStyle(9, C.parch, 1); g.beginPath(); g.arc(32, 22, 13, Math.PI * 1.05, Math.PI * 2.3, false); g.strokePath();
      g.fillStyle(C.parch, 1); g.fillRect(28, 32, 9, 12); g.fillCircle(32, 54, 5);
    },
    thermo(g) {
      g.fillStyle(0xe8dcc0, 1); g.fillRoundedRect(24, 4, 16, 42, 8); g.fillCircle(32, 50, 12);
      g.fillStyle(C.ember, 1); g.fillRect(28, 20, 8, 28); g.fillCircle(32, 50, 8);
    },
    lock(g) {
      g.lineStyle(7, 0x8a8f94, 1); g.beginPath(); g.arc(32, 28, 13, Math.PI, 0, false); g.strokePath();
      g.fillStyle(0x6d7277, 1); g.fillRoundedRect(12, 28, 40, 30, 6);
      g.fillStyle(0x2a2e31, 1); g.fillCircle(32, 40, 5); g.fillRect(30, 40, 4, 10);
    },
    flask(g) {   // frasco (Cinturón de Alquimista)
      g.fillStyle(0x6b4026, 1); g.fillRoundedRect(4, 40, 56, 12, 4);
      g.fillStyle(0x9fd6ff, 0.35); g.fillCircle(32, 34, 16); g.fillRect(28, 8, 8, 14);
      g.fillStyle(0xd9553b, 1); g.fillCircle(32, 38, 11);
      g.lineStyle(2, 0xe8f4ff, 0.8); g.strokeCircle(32, 34, 16);
      g.fillStyle(0x9b6b3a, 1); g.fillRect(27, 4, 10, 7);
    },
    cloud(g) {   // nube (guardado en la cuenta)
      g.fillStyle(0xcfe3f5, 1);
      g.fillCircle(22, 36, 12); g.fillCircle(34, 28, 15); g.fillCircle(46, 36, 11); g.fillRoundedRect(12, 34, 44, 14, 7);
    },
    disk(g) {   // guardado local (este navegador)
      g.fillStyle(0x8a8f94, 1); g.fillRoundedRect(10, 10, 44, 44, 6);
      g.fillStyle(0xd7dde2, 1); g.fillRect(18, 10, 26, 16);
      g.fillStyle(0x2a2e31, 1); g.fillRect(36, 13, 5, 10); g.fillRoundedRect(18, 34, 28, 16, 3);
    },
    globe(g) {   // idioma: globo dorado con meridianos y paralelos
      g.fillStyle(0x1a201d, 1); g.fillCircle(32, 32, 25);
      g.lineStyle(3.5, C.gold, 1); g.strokeCircle(32, 32, 25);
      g.lineStyle(2.2, C.gold, 0.95);
      g.strokeEllipse(32, 32, 26, 50); g.strokeEllipse(32, 32, 8, 50);         // meridianos
      g.lineBetween(7, 32, 57, 32);                                              // ecuador
      g.lineBetween(11, 20, 53, 20); g.lineBetween(11, 44, 53, 44);              // paralelos
    },
    gear(g) {   // rueda dentada (panel de volumen)
      g.fillStyle(0xcfc6b0, 1);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, w = 0.32;
        g.fillPoints([V(32 + Math.cos(a - w) * 18, 32 + Math.sin(a - w) * 18), V(32 + Math.cos(a - w * 0.6) * 28, 32 + Math.sin(a - w * 0.6) * 28),
          V(32 + Math.cos(a + w * 0.6) * 28, 32 + Math.sin(a + w * 0.6) * 28), V(32 + Math.cos(a + w) * 18, 32 + Math.sin(a + w) * 18)], true);
      }
      g.fillCircle(32, 32, 20);
      g.fillStyle(0x1a201d, 1); g.fillCircle(32, 32, 8);
    },
    /* ---- Acto III ---- */
    manadrop(g) {   // gota azul (Drenar Maná)
      g.fillStyle(0x1f3f9a, 1); g.fillCircle(32, 40, 18); g.fillTriangle(15, 34, 49, 34, 32, 4);
      g.fillStyle(0x5f8cff, 1); g.fillCircle(32, 40, 12); g.fillTriangle(22, 34, 42, 34, 32, 14);
      g.fillStyle(0xd8e4ff, 1); g.fillCircle(27, 38, 4);
      g.lineStyle(3, 0xd8e4ff, 0.9); g.lineBetween(26, 47, 38, 47);   // «−»
    },
    vlock(g) {   // candado violeta (Silencio)
      g.lineStyle(7, 0xc9a8ff, 1); g.beginPath(); g.arc(32, 28, 13, Math.PI, 0, false); g.strokePath();
      g.fillStyle(0x8a4fe0, 1); g.fillRoundedRect(12, 28, 40, 30, 6);
      g.fillStyle(0x2a1440, 1); g.fillCircle(32, 40, 5); g.fillRect(30, 40, 4, 10);
    },
    mirror(g) {   // espejo (Reflejo)
      g.fillStyle(0x6b4fa8, 1); g.fillEllipse(32, 30, 40, 50);
      g.fillStyle(0xcfe3ff, 1); g.fillEllipse(32, 30, 30, 40);
      g.fillStyle(0xffffff, 0.9); g.fillPoints([V(22, 22), V(28, 14), V(31, 16), V(25, 25)], true); g.fillPoints([V(24, 32), V(36, 18), V(38, 21), V(26, 35)], true);
      g.fillStyle(0x6b4fa8, 1); g.fillRect(29, 54, 6, 8);
    },
    hourglass(g) {   // reloj de arena (Carga Arcana)
      g.fillStyle(0x8a6a3a, 1); g.fillRect(14, 4, 36, 6); g.fillRect(14, 54, 36, 6);
      g.fillStyle(0xd8c8ff, 0.9); g.fillTriangle(18, 10, 46, 10, 32, 32); g.fillTriangle(18, 54, 46, 54, 32, 32);
      g.fillStyle(0xb27bff, 1); g.fillTriangle(24, 14, 40, 14, 32, 26); g.fillTriangle(22, 54, 42, 54, 32, 42); g.fillRect(31, 30, 2, 14);
    },
    inkcard(g) {   // carta con mancha de tinta (Garabato)
      g.fillStyle(0xe8dcc0, 1); g.fillRoundedRect(14, 4, 36, 54, 5);
      g.lineStyle(2, 0x6b4fa8, 1); g.strokeRoundedRect(14, 4, 36, 54, 5);
      g.fillStyle(0x1a1030, 1); g.fillCircle(32, 32, 10); g.fillCircle(24, 26, 5); g.fillCircle(41, 37, 6); g.fillCircle(36, 21, 4); g.fillCircle(25, 41, 4);
      g.lineStyle(2, 0x1a1030, 1); g.lineBetween(20, 48, 44, 46); g.lineBetween(22, 13, 40, 15);
    },
    prism(g) {   // prisma (Prisma Arcano)
      g.fillStyle(0x6b4fa8, 1); g.fillTriangle(32, 6, 6, 54, 58, 54);
      g.fillStyle(0xd8c8ff, 1); g.fillTriangle(32, 14, 14, 50, 50, 50);
      g.lineStyle(3, 0xff7a7a, 0.9); g.lineBetween(36, 34, 62, 26); g.lineStyle(3, 0x7affb0, 0.9); g.lineBetween(38, 38, 62, 36); g.lineStyle(3, 0x7ab0ff, 0.9); g.lineBetween(38, 42, 62, 46);
    },
    /* ---- Acto II ---- */
    drop(g) {   // gota (douse: el enemigo apaga su Quemadura)
      g.fillStyle(0x3d7fb3, 1); g.fillCircle(32, 40, 18); g.fillTriangle(15, 34, 49, 34, 32, 4);
      g.fillStyle(0x9fd6ff, 1); g.fillCircle(32, 40, 12); g.fillTriangle(22, 34, 42, 34, 32, 14);
      g.fillStyle(0xe6f4ff, 1); g.fillCircle(26, 38, 4);
    },
    cursecard(g) {   // carta maldita (curse: Escalofrío al descarte)
      g.fillStyle(0x2c2836, 1); g.fillRoundedRect(14, 4, 36, 54, 5);
      g.lineStyle(2, 0x9a8fb8, 1); g.strokeRoundedRect(14, 4, 36, 54, 5);
      g.lineStyle(3, C.frost, 1);
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.lineBetween(32 - Math.cos(a) * 13, 31 - Math.sin(a) * 13, 32 + Math.cos(a) * 13, 31 + Math.sin(a) * 13); }
      g.fillStyle(0xe6f4ff, 1); g.fillCircle(32, 31, 3);
    },
    shard(g) {   // cristal de escarcha (partícula)
      g.fillStyle(0xcfeaff, 1); g.fillPoints([V(32, 2), V(42, 30), V(32, 62), V(22, 30)], true);
      g.fillStyle(0xffffff, 0.9); g.fillPoints([V(32, 10), V(36, 30), V(32, 50), V(28, 30)], true);
    },
    wyrm(g) {   // cabeza del Wyrm de Escarcha (icono del jefe del acto II)
      g.fillStyle(0x9fd6ff, 1); g.fillTriangle(30, 14, 22, 0, 40, 12); g.fillTriangle(42, 16, 44, 0, 52, 18);   // cuernos
      g.fillStyle(0x3d6f9a, 1);
      g.fillPoints([V(58, 22), V(50, 12), V(34, 12), V(20, 20), V(4, 30), V(4, 38), V(20, 40), V(10, 50), V(26, 48), V(40, 58), V(56, 50), V(62, 36)], true);
      g.fillStyle(0x6fa8d6, 1); g.fillPoints([V(54, 24), V(46, 16), V(34, 16), V(24, 24), V(36, 30), V(56, 34)], true);
      g.fillStyle(0xe6f4ff, 1); g.fillTriangle(10, 38, 14, 38, 12, 44); g.fillTriangle(18, 39, 22, 39, 20, 45);   // colmillos
      g.fillStyle(0xcff4ff, 1); g.fillCircle(36, 24, 4); g.fillStyle(0x0b1a2a, 1); g.fillEllipse(36, 24, 2, 6);
      g.fillStyle(0xcfeaff, 1); g.fillTriangle(60, 30, 64, 26, 62, 38); g.fillTriangle(56, 46, 62, 46, 58, 54);   // púas
    },
    /* ---- Invocadora (verde espectral) ---- */
    leaf(g) {
      g.fillStyle(0x2f7a45, 1); g.fillEllipse(32, 32, 30, 54);
      g.fillStyle(0x6fd08a, 1); g.fillEllipse(30, 30, 22, 46);
      g.lineStyle(3, 0x1d4a2a, 1); g.lineBetween(32, 8, 32, 60); g.lineBetween(32, 26, 22, 18); g.lineBetween(32, 38, 42, 30); g.lineBetween(32, 46, 22, 40);
    },
    claw(g) {   // tres zarpazos en diagonal, afilados en las puntas
      for (let i = 0; i < 3; i++) {
        const x = 26 + i * 13;
        g.fillStyle(0x6fd08a, 1); g.fillPoints([V(x + 4, 6), V(x + 9, 9), V(x - 6, 58), V(x - 12, 54)], true);
        g.fillStyle(0xe6ffe9, 0.9); g.fillPoints([V(x + 5, 10), V(x + 7, 11), V(x - 6, 50), V(x - 8, 48)], true);
      }
    },
    horn(g) {
      g.fillStyle(0xb98a52, 1); g.fillPoints([V(8, 48), V(20, 34), V(38, 22), V(56, 8), V(60, 14), V(46, 30), V(30, 46), V(16, 58)], true);
      g.fillStyle(0xe0c08a, 1); g.fillPoints([V(14, 48), V(24, 38), V(40, 26), V(54, 14), V(46, 26), V(30, 42)], true);
      g.fillStyle(0x6fd08a, 1); g.fillCircle(11, 53, 7); g.lineStyle(2, 0x2f7a45, 1); g.strokeCircle(11, 53, 7);
    },
    summon(g) {   // círculo de invocación
      g.lineStyle(4, 0x6fd08a, 1); g.strokeCircle(32, 32, 26); g.lineStyle(2, 0xbff5cc, 0.8); g.strokeCircle(32, 32, 18);
      star(g, 32, 32, 14, 5, 5, 0xbff5cc); g.fillStyle(0x6fd08a, 1); g.fillCircle(32, 32, 4);
    },
    summon_lobezno(g) { paw(g, 0x6fd08a); },
    summon_treant(g) {
      g.fillStyle(0x6b4a2a, 1); g.fillRect(28, 34, 9, 24);
      g.fillStyle(0x3f9a5c, 1); g.fillCircle(32, 24, 17); g.fillCircle(20, 32, 11); g.fillCircle(44, 32, 11);
      g.fillStyle(0x8fe0a0, 1); g.fillCircle(27, 19, 6);
      g.fillStyle(0xeaffd0, 1); g.fillCircle(27, 30, 2.5); g.fillCircle(37, 30, 2.5);
    },
    summon_buho(g) {
      g.fillStyle(0x5c7a62, 1); g.fillEllipse(32, 36, 40, 46); g.fillTriangle(14, 10, 22, 24, 28, 16); g.fillTriangle(50, 10, 42, 24, 36, 16);
      g.fillStyle(0xd8ffe0, 1); g.fillCircle(24, 30, 8); g.fillCircle(40, 30, 8);
      g.fillStyle(0x1b3a24, 1); g.fillCircle(24, 30, 4); g.fillCircle(40, 30, 4);
      g.fillStyle(0xe0b46a, 1); g.fillTriangle(29, 38, 35, 38, 32, 44);
    },
    summon_hada(g) { star(g, 32, 30, 22, 8, 4, 0xbff5cc); star(g, 32, 30, 12, 4, 4, 0xffffff); g.fillStyle(0x6fd08a, 1); g.fillCircle(50, 50, 4); g.fillCircle(14, 48, 3); g.fillCircle(48, 12, 3); },
    summon_espiritu(g) { flame(g, 32, 36, 28, 0x3f9a5c, 0xbff5cc); g.fillStyle(0x1b3a24, 1); g.fillEllipse(26, 34, 5, 8); g.fillEllipse(38, 34, 5, 8); },
    deck(g) {
      g.fillStyle(0x2a3b55, 1); g.fillRoundedRect(14, 6, 34, 46, 4);
      g.fillStyle(0x3d5378, 1); g.fillRoundedRect(8, 12, 34, 46, 4);
      g.lineStyle(2, C.gold, 1); g.strokeRoundedRect(8, 12, 34, 46, 4);
      star(g, 25, 35, 9, 3, 4, C.gold);
    },
    /* ---- Parche 3.5 ---- */
    contract(g) {   // pergamino con sello de lacre (Contratos)
      g.fillStyle(0xd9c79a, 1); g.fillRoundedRect(14, 10, 36, 44, 4);
      g.fillStyle(0xb39b62, 1); g.fillRoundedRect(11, 7, 42, 7, 3); g.fillRoundedRect(11, 50, 42, 7, 3);
      g.lineStyle(2.5, 0x7a6640, 1); [21, 28, 35].forEach((y) => g.lineBetween(20, y, 44, y)); g.lineBetween(20, 42, 33, 42);
      g.fillStyle(0x8e1c22, 1); g.fillCircle(42, 46, 9);
      g.fillStyle(0xd23a40, 1); g.fillCircle(42, 46, 6); g.fillStyle(0xf2a0a0, 0.8); g.fillCircle(40, 44, 2);
    },
    cart(g) {       // carromato del Mercader Ambulante
      g.fillStyle(0x6b4524, 1); g.fillRoundedRect(8, 26, 48, 18, 3);
      g.fillStyle(0xd9c79a, 1); g.fillPoints([V(10, 27), V(14, 12), V(50, 12), V(54, 27)], true);
      g.lineStyle(2, 0xb08a5a, 1); g.lineBetween(22, 13, 20, 27); g.lineBetween(32, 12, 32, 27); g.lineBetween(42, 13, 44, 27);
      g.fillStyle(C.gold, 1); g.fillCircle(32, 35, 4);
      g.fillStyle(0x2a1d12, 1); g.fillCircle(19, 48, 8); g.fillCircle(45, 48, 8);
      g.fillStyle(0xb08a5a, 1); g.fillCircle(19, 48, 3); g.fillCircle(45, 48, 3);
    },
    /* ---- Respaldo de los iconos de interfaz (si su PNG no carga) ---- */
    star(g) { star(g, 32, 32, 26, 11, 5, C.gold); },
    ui_dice(g) { g.fillStyle(C.parch, 1); g.fillRoundedRect(10, 10, 44, 44, 8); g.fillStyle(C.ink, 1); [[22, 22], [42, 22], [32, 32], [22, 42], [42, 42]].forEach(([x, y]) => g.fillCircle(x, y, 4)); },
    ui_gamepad(g) { g.fillStyle(C.parch, 1); g.fillRoundedRect(6, 20, 52, 26, 12); g.fillStyle(C.ink, 1); g.fillRect(14, 31, 12, 4); g.fillRect(18, 27, 4, 12); g.fillCircle(42, 30, 3); g.fillCircle(48, 36, 3); },
    ui_swords(g) { g.lineStyle(6, C.parch, 1); g.lineBetween(12, 12, 52, 52); g.lineBetween(52, 12, 12, 52); g.lineStyle(6, C.gold, 1); g.lineBetween(16, 44, 22, 50); g.lineBetween(48, 44, 42, 50); }
  };
  /**
   * Iconos reales (assets/icons/<clave>.png, 128×128, game-icons.net CC BY 3.0): se cargan en Boot.preload con la MISMA
   * clave de textura que el procedural ('ic_<clave>'); makeTextures solo dibuja el procedural si el PNG no cargó.
   */
  const ICON_FILES = Object.keys(ICONS);
  /** Lado de referencia de un icono: todas las escalas del código están pensadas para 64 px. */
  const ICON_BASE = 64;
  /** Factor que convierte una escala «de 64 px» a la textura real del icono (0,5 con PNG de 128; 1 con el procedural). */
  const icK = (o) => (o && o.texture && /^ic_/.test(o.texture.key) && o.frame ? ICON_BASE / (o.frame.realWidth || ICON_BASE) : 1);
  /** img.setIconScale(s): como setScale(s) pero ocupando lo mismo que el icono de 64 px de antes, sea PNG o procedural. */
  if (root.Phaser && Phaser.GameObjects && Phaser.GameObjects.Image) {
    Phaser.GameObjects.Image.prototype.setIconScale = function (x, y = x) { const k = icK(this); return this.setScale(x * k, y * k); };
  }

  /* ---------- Siluetas de enemigos y del mago (placeholders con carácter) ---------- */
  const ART = {
    rat: { w: 260, h: 220, draw(g) {
      g.fillStyle(0x000000, 0.25); g.fillEllipse(130, 200, 180, 22);
      g.lineStyle(10, 0x8d6b6b, 1); g.beginPath(); g.moveTo(190, 160); g.lineTo(225, 140); g.lineTo(245, 100); g.strokePath();
      g.fillStyle(0x5e4b48, 1); g.fillEllipse(140, 150, 150, 96);
      g.fillStyle(0x6e5955, 1); g.fillEllipse(140, 140, 120, 66);
      g.fillStyle(0x5e4b48, 1); g.fillCircle(72, 128, 40);
      g.fillPoints([V(40, 112), V(8, 140), V(44, 150)], true);
      g.fillStyle(0xd28b8b, 1); g.fillCircle(10, 140, 6);
      g.fillStyle(0x5e4b48, 1); g.fillCircle(58, 88, 18); g.fillCircle(92, 90, 18);
      g.fillStyle(0xc77f86, 1); g.fillCircle(58, 88, 10); g.fillCircle(92, 90, 10);
      g.fillStyle(0xff3b30, 1); g.fillCircle(58, 122, 7); g.fillStyle(0xffd0c8, 1); g.fillCircle(60, 120, 2);
      g.fillStyle(0xf2efe2, 1); g.fillTriangle(30, 148, 38, 148, 34, 160);
      g.fillStyle(0x3e302e, 1); g.fillEllipse(100, 196, 34, 14); g.fillEllipse(180, 196, 34, 14);
    } },
    shroom: { w: 240, h: 250, draw(g) {
      g.fillStyle(0x000000, 0.25); g.fillEllipse(120, 236, 150, 20);
      g.fillStyle(0xd9cfb2, 1); g.fillRoundedRect(86, 110, 68, 124, 24);
      g.fillStyle(0xbfb293, 1); g.fillRoundedRect(86, 190, 68, 44, 18);
      g.fillStyle(0x7d2b5a, 1); g.fillEllipse(120, 104, 220, 130);
      g.fillStyle(0x9c3a70, 1); g.fillEllipse(120, 92, 196, 100);
      g.fillStyle(0x4c1838, 1); g.fillRect(14, 116, 212, 30);
      g.fillStyle(0xf3e8f0, 1); [[70, 70, 14], [126, 56, 18], [178, 84, 12], [100, 100, 9], [156, 106, 8]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
      g.fillStyle(0x1a1013, 1); g.fillCircle(106, 166, 9); g.fillCircle(136, 166, 9);
      g.fillStyle(0xbaff7a, 1); g.fillCircle(108, 164, 3); g.fillCircle(138, 164, 3);
      g.lineStyle(3, 0x1a1013, 1); g.beginPath(); g.arc(121, 186, 10, 0.2, Math.PI - 0.2); g.strokePath();
      g.fillStyle(0xbaff7a, 0.5); [[30, 160], [210, 150], [196, 196], [44, 210]].forEach(([x, y]) => g.fillCircle(x, y, 4));
    } },
    wolf: { w: 300, h: 240, draw(g) {
      g.fillStyle(0x000000, 0.25); g.fillEllipse(160, 222, 220, 22);
      g.fillStyle(0x2a3140, 1);
      g.fillPoints([V(260, 140), V(298, 96), V(282, 150)], true);
      g.fillEllipse(170, 150, 180, 100);
      g.fillRect(100, 160, 22, 60); g.fillRect(140, 168, 22, 52); g.fillRect(200, 168, 22, 52); g.fillRect(236, 160, 22, 60);
      g.fillStyle(0x3a4458, 1); g.fillEllipse(176, 136, 150, 64);
      g.fillStyle(0x2a3140, 1); g.fillPoints([V(110, 90), V(60, 110), V(10, 150), V(30, 168), V(80, 160), V(124, 150)], true);
      g.fillPoints([V(84, 96), V(92, 48), V(112, 92)], true); g.fillPoints([V(110, 98), V(128, 54), V(136, 104)], true);
      g.fillStyle(0xffd35a, 1); g.fillEllipse(70, 120, 18, 9); g.fillStyle(0x1a0f00, 1); g.fillCircle(72, 120, 3);
      g.fillStyle(0xe8e8e8, 1); g.fillTriangle(24, 158, 30, 158, 27, 168); g.fillTriangle(42, 160, 48, 160, 45, 170);
      g.fillStyle(0x161a22, 1); g.fillCircle(14, 152, 6);
    } },
    bandit: { w: 230, h: 270, draw(g) {
      g.fillStyle(0x000000, 0.25); g.fillEllipse(115, 258, 160, 20);
      g.fillStyle(0x4a3424, 1); g.fillPoints([V(115, 50), V(195, 120), V(200, 256), V(30, 256), V(36, 120)], true);
      g.fillStyle(0x5d4330, 1); g.fillPoints([V(115, 70), V(175, 126), V(170, 250), V(60, 250), V(56, 126)], true);
      g.fillStyle(0x3a281b, 1); g.fillCircle(115, 82, 48);
      g.fillStyle(0x0c0806, 1); g.fillEllipse(115, 92, 62, 52);
      g.fillStyle(0xf2f2f2, 1); g.fillEllipse(100, 90, 10, 6); g.fillEllipse(130, 90, 10, 6);
      g.fillStyle(0x8a2c2c, 1); g.fillRect(70, 122, 90, 12);
      g.lineStyle(6, 0xcfd6db, 1); g.lineBetween(190, 170, 222, 120);
      g.fillStyle(0x6b4a26, 1); g.fillRect(180, 166, 18, 10);
      g.fillStyle(0x3a281b, 1); g.fillCircle(188, 176, 13);
    } },
    treant: { w: 320, h: 320, draw(g) {
      g.fillStyle(0x000000, 0.3); g.fillEllipse(160, 306, 240, 26);
      g.lineStyle(16, 0x4a3122, 1);
      g.lineBetween(120, 120, 50, 60); g.lineBetween(200, 120, 270, 50); g.lineBetween(60, 70, 30, 100); g.lineBetween(260, 60, 300, 90);
      g.fillStyle(0x2c4a2a, 1); [[60, 50, 46], [150, 34, 56], [250, 46, 48], [110, 70, 40], [200, 72, 40]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
      g.fillStyle(0x3d6236, 1); [[70, 40, 26], [150, 22, 30], [240, 34, 24]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
      g.fillStyle(0x5a3b27, 1); g.fillPoints([V(110, 90), V(210, 90), V(232, 300), V(88, 300)], true);
      g.fillStyle(0x6d4a32, 1); g.fillPoints([V(130, 100), V(190, 100), V(204, 300), V(116, 300)], true);
      g.lineStyle(3, 0x3b2617, 1); g.lineBetween(140, 200, 136, 290); g.lineBetween(184, 210, 190, 296);
      g.fillStyle(0x1a0d08, 1); g.fillEllipse(136, 160, 30, 20); g.fillEllipse(186, 160, 30, 20);
      g.fillStyle(0x9cff6a, 1); g.fillEllipse(136, 160, 14, 10); g.fillEllipse(186, 160, 14, 10);
      g.fillStyle(0x1a0d08, 1); g.fillPoints([V(130, 200), V(192, 200), V(180, 230), V(160, 222), V(144, 232)], true);
      g.lineStyle(12, 0x5a3b27, 1); g.lineBetween(100, 290, 60, 306); g.lineBetween(220, 290, 262, 306);
      g.fillStyle(0x7aa860, 1); [[118, 120], [206, 136], [150, 270]].forEach(([x, y]) => g.fillCircle(x, y, 7));
    } },
    witch: { w: 250, h: 300, draw(g) {
      g.fillStyle(0x000000, 0.25); g.fillEllipse(125, 288, 170, 20);
      g.lineStyle(7, 0x5a3f28, 1); g.lineBetween(210, 70, 196, 290);
      g.fillStyle(0x9cff6a, 0.35); g.fillCircle(212, 62, 22); g.fillStyle(0xc8ff9c, 1); g.fillCircle(212, 62, 11);
      g.fillStyle(0x2e3b2c, 1); g.fillPoints([V(125, 118), V(205, 286), V(45, 286)], true);
      g.fillStyle(0x3e5139, 1); g.fillPoints([V(125, 140), V(180, 280), V(70, 280)], true);
      g.fillStyle(0x98b07a, 1); g.fillCircle(125, 112, 34);
      g.fillStyle(0x7e9663, 1); g.fillTriangle(118, 112, 132, 112, 108, 138);
      g.fillStyle(0xffe14a, 1); g.fillCircle(112, 104, 5); g.fillCircle(140, 104, 5);
      g.fillStyle(0x1b2219, 1); g.fillEllipse(125, 84, 120, 22); g.fillPoints([V(90, 82), V(160, 82), V(150, 10), V(120, 30)], true);
      g.fillStyle(0x7d2b5a, 1); g.fillRect(96, 72, 58, 8);
      g.lineStyle(3, 0x2e3b2c, 1); g.lineBetween(92, 120, 76, 170); g.lineBetween(158, 120, 172, 168);
    } },
    guardian: { w: 380, h: 360, draw(g) {
      g.fillStyle(0x000000, 0.35); g.fillEllipse(190, 346, 300, 28);
      g.lineStyle(14, 0x4a3122, 1);
      [[150, 110, 90, 30], [90, 30, 60, 6], [90, 30, 70, 70], [230, 110, 290, 30], [290, 30, 320, 6], [290, 30, 310, 70]].forEach(([a, b, c, d]) => g.lineBetween(a, b, c, d));
      g.fillStyle(0x3e3a3a, 1); g.fillRoundedRect(90, 100, 200, 240, 50);
      g.fillStyle(0x504b4a, 1); g.fillRoundedRect(110, 112, 160, 210, 40);
      g.fillStyle(0x2c4a2a, 1); [[100, 120, 30], [280, 140, 26], [120, 320, 24], [270, 310, 28], [190, 96, 30]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
      g.fillStyle(0x0a1418, 1); g.fillEllipse(156, 180, 44, 26); g.fillEllipse(224, 180, 44, 26);
      g.fillStyle(0x6ae8ff, 1); g.fillEllipse(156, 180, 22, 12); g.fillEllipse(224, 180, 22, 12);
      g.fillStyle(0x0a1418, 1); g.fillRoundedRect(150, 232, 80, 20, 8);
      g.fillStyle(0x6ae8ff, 0.8); [[140, 280], [190, 290], [240, 276], [190, 140]].forEach(([x, y]) => g.fillRect(x - 3, y - 8, 6, 16));
      g.fillStyle(0x8fd8e8, 1); g.fillTriangle(40, 340, 60, 270, 80, 340); g.fillTriangle(300, 340, 324, 260, 344, 340);
      g.lineStyle(24, 0x3e3a3a, 1); g.lineBetween(92, 180, 40, 280); g.lineBetween(288, 180, 340, 280);
    } },
    mage: { w: 240, h: 290, draw(g) {
      g.fillStyle(0x000000, 0.3); g.fillEllipse(110, 278, 170, 22);
      g.fillStyle(C.ember, 0.12); g.fillCircle(110, 150, 120);
      g.fillStyle(0x5a1a14, 1); g.fillPoints([V(110, 40), V(186, 130), V(196, 276), V(24, 276), V(34, 130)], true);
      g.fillStyle(0x8a2a1c, 1); g.fillPoints([V(110, 70), V(162, 138), V(168, 270), V(52, 270), V(58, 138)], true);
      g.fillStyle(0xb0462a, 1); g.fillPoints([V(110, 100), V(130, 270), V(90, 270)], true);
      g.fillStyle(0x5a1a14, 1); g.fillCircle(110, 82, 46);
      g.fillStyle(0x140806, 1); g.fillEllipse(112, 92, 58, 50);
      g.fillStyle(C.flame, 1); g.fillEllipse(98, 92, 10, 6); g.fillEllipse(126, 92, 10, 6);
      g.fillStyle(C.gold, 1); g.fillRect(70, 150, 80, 8);
      g.lineStyle(14, 0x5a1a14, 1); g.lineBetween(170, 150, 206, 176);
      flame(g, 214, 150, 30);
    } }
  };

  function makeTextures(scene) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    for (const [k, fn] of Object.entries(ICONS)) {
      if (scene.textures.exists('ic_' + k)) continue;   // hay PNG real (assets/icons): el procedural queda de respaldo
      g.clear(); fn(g); root.CM_HIRES.genTex(g, 'ic_' + k, ICON_BASE, ICON_BASE);
    }
    // Arte procedural solo para las claves que no tengan imagen real cargada en Boot.preload()
    for (const [k, a] of Object.entries(ART)) {
      if (scene.textures.exists('art_' + k)) continue;
      g.clear(); a.draw(g); root.CM_HIRES.genTex(g, 'art_' + k, a.w, a.h);
    }
    // Partícula suave y reverso de carta
    g.clear(); g.fillStyle(0xffffff, 1); g.fillCircle(8, 8, 8); root.CM_HIRES.genTex(g, 'dot', 16, 16);
    g.clear();
    g.fillStyle(0x1c2b3f, 1); g.fillRoundedRect(0, 0, 72, 100, 8);
    g.lineStyle(3, C.gold, 1); g.strokeRoundedRect(3, 3, 66, 94, 6);
    star(g, 36, 50, 18, 6, 4, C.gold);
    root.CM_HIRES.genTex(g, 'cardback', 72, 100);   // a R× (nítido), con tamaño lógico 72×100
    g.destroy();
    makeSoftTextures(scene);
  }

  /** Texturas con degradado (canvas 2D): viñeta de bordes y sombra difusa bajo los pies. */
  function makeSoftTextures(scene) {
    if (!scene.textures.exists('vignette')) {
      const w = 1280, h = 720;
      const tex = scene.textures.createCanvas('vignette', w, h), ctx = tex.getContext();
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(1, h / w);                       // degradado elíptico 16:9
      const gr = ctx.createRadialGradient(0, 0, w * 0.32, 0, 0, w * 0.75);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.62)');
      ctx.fillStyle = gr;
      ctx.fillRect(-w / 2, -w / 2, w, w);
      ctx.restore();
      tex.refresh();
    }
    if (!scene.textures.exists('shadow')) {
      const w = 256, h = 64;
      const tex = scene.textures.createCanvas('shadow', w, h), ctx = tex.getContext();
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(1, h / w);                       // círculo → elipse
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.85)');
      gr.addColorStop(0.55, 'rgba(0,0,0,0.5)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(0, 0, w / 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      tex.refresh();
    }
  }

  /** Escala que hace que una textura mida `h` píxeles de alto (sirve igual para PNG y procedural). */
  /**
   * Gema de Esencia Arcana dibujada con Graphics (corona + pabellón con facetas, tonos de la Esencia).
   * fill (0..1): cuánto está «llena» desde abajo (la gema vacía se ve oscura). Devuelve g.
   */
  function essenceGem(g, x, y, r, fill = 1) {
    const P = (pts) => pts.map(([px, py]) => V(x + px * r, y + py * r));
    const outline = [[-0.55, -0.62], [0.55, -0.62], [1, -0.18], [0, 1], [-1, -0.18]];
    // Recorta un polígono por debajo de la línea y = cut (Sutherland–Hodgman en un semiplano)
    const clip = (pts, cut) => {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], ina = a.y >= cut, inb = b.y >= cut;
        if (ina) out.push(a);
        if (ina !== inb) { const t = (cut - a.y) / (b.y - a.y); out.push(V(a.x + (b.x - a.x) * t, cut)); }
      }
      return out;
    };
    const EC = TH.game.essence, sh = (f) => TH.shade(EC, f);   // facetas: tonos de la Esencia (sin violeta)
    g.fillStyle(TH.color.shade, TH.alpha.shadow); g.fillPoints(P(outline.map(([a, b]) => [a + 0.06, b + 0.1])), true);
    g.fillStyle(sh(-0.78), 1); g.fillPoints(P(outline), true);                 // vacía
    const top = y - 0.62 * r, bottom = y + r, cut = bottom - (bottom - top) * Math.max(0, Math.min(1, fill));
    if (fill > 0) {
      const facets = [
        [[[-0.55, -0.62], [0, -0.62], [-0.3, -0.18], [-1, -0.18]], sh(-0.1)],
        [[[0, -0.62], [0.55, -0.62], [1, -0.18], [0.3, -0.18]], EC],
        [[[0, -0.62], [0.3, -0.18], [-0.3, -0.18]], sh(0.55)],
        [[[-1, -0.18], [-0.3, -0.18], [0, 1]], sh(-0.45)],
        [[[-0.3, -0.18], [0.3, -0.18], [0, 1]], sh(-0.28)],
        [[[0.3, -0.18], [1, -0.18], [0, 1]], sh(-0.55)]
      ];
      for (const [pts, col] of facets) { const c = clip(P(pts), cut); if (c.length >= 3) { g.fillStyle(col, 1); g.fillPoints(c, true); } }
    }
    g.lineStyle(Math.max(1.5, r * 0.08), sh(-0.85), 1); g.strokePoints(P(outline), true, true);
    if (fill >= 1) { g.fillStyle(TH.num(TH.color.ink), 0.8); g.fillCircle(x - 0.35 * r, y - 0.4 * r, Math.max(1.5, r * 0.1)); }
    return g;
  }

  function heightScale(scene, key, h) {
    const src = scene.textures.get(key).getSourceImage();
    return h / src.height;
  }

  /** Luciérnagas flotantes (pseudoaleatorio fijo para que no cambien entre visitas). */
  function fireflies(scene, glow, w = 1280, h = 720, count = 22) {
    let seed = 11;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < count; i++) {
      const f = scene.add.image(rnd() * w, h * 0.2 + rnd() * h * 0.6, 'dot').setScale(0.18 + rnd() * 0.2).setTint(glow).setAlpha(0);
      scene.tweens.add({ targets: f, alpha: { from: 0, to: 0.8 }, y: f.y - 20 - rnd() * 30, x: f.x + (rnd() - 0.5) * 40,
        duration: 1800 + rnd() * 2600, yoyo: true, repeat: -1, delay: rnd() * 3000, ease: 'Sine.inOut' });
    }
  }

  /* =================================================================
   * Fondos
   * ================================================================= */
  /**
   * Fondo ilustrado a pantalla completa (assets/bg/bg_<clave>.webp, 1440×810): «cover», capa oscura (~40 %), viñeteado,
   * zoom muy lento (1,00 → 1,04 en 20 s) y pocas partículas acordes. Con «Reducir movimiento», quieto y sin partículas.
   * Si el PNG no cargó, vuelve al fondo procedural (fallback).
   */
  const SCENE_FX = {
    shop: { col: 0xf2c46a, n: 8, rise: false },        // polvo cálido
    forge: { col: 0xff8a3d, n: 18, rise: true },       // brasas
    rest: { col: 0xffa04a, n: 14, rise: true },        // brasas de la hoguera
    treasure: { col: 0xffd76a, n: 16, rise: false },   // polvo dorado
    altar: { col: TH.game.arcane, n: 14, rise: false } // motas moradas
  };
  function sceneBackdrop(scene, key, fallback = 'night') {
    const tk = 'bg_' + key;
    if (!scene.textures.exists(tk)) { backdrop(scene, fallback); return null; }
    const src = scene.textures.get(tk).getSourceImage(), s = Math.max(1280 / src.width, 720 / src.height);
    const img = scene.add.image(640, 360, tk).setScale(s).setDepth(LAYER.bg);
    const still = Opts.reduceMotion;
    if (!still) scene.tweens.add({ targets: img, scale: s * 1.04, duration: TH.dur.kenBurns, ease: 'Sine.inOut', yoyo: true, repeat: -1 });
    scene.add.rectangle(640, 360, 1280, 720, TH.color.shade, TH.alpha.sceneShade).setDepth(LAYER.bg);
    scene.add.image(640, 360, 'vignette').setDepth(LAYER.bg).setAlpha(0.85);
    const fx = SCENE_FX[key];
    if (fx && !still) {
      let seed = 17;
      const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
      for (let i = 0; i < fx.n; i++) {
        const p = scene.add.image(rnd() * 1280, fx.rise ? 520 + rnd() * 200 : 120 + rnd() * 520, 'dot').setScale(0.12 + rnd() * 0.18).setTint(fx.col).setAlpha(0).setDepth(LAYER.bg).setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({ targets: p, alpha: { from: 0, to: 0.75 }, y: p.y - (fx.rise ? 180 + rnd() * 220 : 20 + rnd() * 40), x: p.x + (rnd() - 0.5) * 60,
          duration: (fx.rise ? 3200 : 2600) + rnd() * 2600, yoyo: !fx.rise, repeat: -1, delay: rnd() * 3000, ease: fx.rise ? 'Quad.out' : 'Sine.inOut' });
      }
    }
    return img;
  }
  function backdrop(scene, theme = 'forest', w = 1280, h = 720) {
    const pal = {
      forest: { top: 0x0d1a16, bot: 0x1d2e22, far: 0x15241e, mid: 0x112019, near: 0x0b1511, glow: 0xbfe39a },
      boss: { top: 0x1a0d16, bot: 0x2c1a1d, far: 0x22141b, mid: 0x1a1016, near: 0x110a0e, glow: 0xff8a6a },
      night: { top: 0x0b1015, bot: 0x16201d, far: 0x111a18, mid: 0x0d1613, near: 0x090f0d, glow: 0xe6c066 },
      // Acto II · Cumbres de Escarcha: noche azul-violeta, montañas y nieve
      frost: { top: 0x0a1020, bot: 0x2e3358, far: 0x2a3a5c, mid: 0x1b2742, near: 0x0f172a, glow: 0xdff0ff, frost: true },
      frostboss: { top: 0x0c0a1e, bot: 0x3a2a5a, far: 0x30305a, mid: 0x1f1d3f, near: 0x110f24, glow: 0xb8c8ff, frost: true },
      // Acto III · Caverna Arcana: cueva oscura con cristales violetas y runas que brillan
      arcane: { top: 0x07050f, bot: 0x1d1233, far: 0x1a1030, mid: 0x120a24, near: 0x0a0614, glow: 0xb27bff, cave: true },
      arcaneboss: { top: 0x0a0410, bot: 0x2a0f3a, far: 0x241038, mid: 0x170a28, near: 0x0c0516, glow: 0xff7bd8, cave: true }
    }[theme] || { top: 0x0d1a16, bot: 0x1d2e22, far: 0x15241e, mid: 0x112019, near: 0x0b1511, glow: 0xbfe39a };
    const g = scene.add.graphics();
    const bands = 36;
    const c1 = Phaser.Display.Color.IntegerToColor(pal.top), c2 = Phaser.Display.Color.IntegerToColor(pal.bot);
    for (let i = 0; i < bands; i++) {
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, bands - 1, i);
      g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
      g.fillRect(0, Math.floor(i * h / bands), w, Math.ceil(h / bands) + 1);
    }
    // Capas de pinos: lejana, media, cercana (pseudoaleatorio fijo)
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const pines = (count, base, height, color) => {
      g.fillStyle(color, 1);
      for (let i = 0; i < count; i++) {
        const x = (i / count) * w + rnd() * (w / count);
        const ph = height * (0.7 + rnd() * 0.6), pw = ph * 0.38;
        g.fillTriangle(x - pw, base, x + pw, base, x, base - ph);
        g.fillTriangle(x - pw * 0.8, base - ph * 0.35, x + pw * 0.8, base - ph * 0.35, x, base - ph * 1.08);
      }
      g.fillRect(0, base - 2, w, h - base + 2);
    };
    if (pal.cave) { cave(scene, g, rnd, w, h, pal); return g; }   // Acto III
    if (pal.frost) {   // Acto II: cordilleras con nieve en las cumbres + nevada suave
      mountains(g, rnd, w, h, pal);
      snowfall(scene, w, h, 70);
      return g;
    }
    pines(26, h * 0.62, h * 0.32, pal.far);
    pines(16, h * 0.74, h * 0.38, pal.mid);
    pines(9, h * 0.92, h * 0.46, pal.near);
    fireflies(scene, pal.glow, w, h);
    return g;
  }

  /**
   * Cueva arcana (Acto III): estalactitas y suelo de roca, racimos de cristales violetas con halo
   * y runas flotantes que brillan suave. Sustituible por assets/bg_act3.jpg.
   */
  function cave(scene, g, rnd, w, h, pal) {
    // Paredes del fondo: bloques de roca irregulares
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w, y = h * (0.2 + rnd() * 0.4), r = 80 + rnd() * 140;
      g.fillStyle(pal.far, 0.55); g.fillEllipse(x, y, r * 2, r * 1.2);
    }
    // Estalactitas (techo) y estalagmitas (suelo)
    const spikes = (count, fromTop, len, color) => {
      g.fillStyle(color, 1);
      for (let i = 0; i <= count; i++) {
        const x = (i / count) * w + (rnd() - 0.5) * (w / count), pw = 18 + rnd() * 34, pl = len * (0.4 + rnd() * 0.8);
        if (fromTop) g.fillTriangle(x - pw, 0, x + pw, 0, x + (rnd() - 0.5) * 10, pl);
        else g.fillTriangle(x - pw, h * 0.7, x + pw, h * 0.7, x, h * 0.7 - pl);
      }
    };
    g.fillStyle(pal.mid, 1); g.fillRect(0, 0, w, 26);
    spikes(22, true, 130, pal.mid);
    spikes(14, true, 70, pal.near);
    spikes(18, false, 60, pal.mid);
    g.fillStyle(pal.near, 1); g.fillRect(0, h * 0.7, w, h * 0.3);
    // Cristales (racimos), con halo aditivo
    const crystal = (cx, base, s) => {
      const halo = scene.add.circle(cx, base - 30 * s, 70 * s, pal.glow, 0.12).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({ targets: halo, alpha: { from: 0.06, to: 0.18 }, duration: 1800 + rnd() * 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      for (let k = 0; k < 4; k++) {
        const ang = (-0.6 + k * 0.4 + (rnd() - 0.5) * 0.2), ln = (40 + rnd() * 50) * s, wd = (7 + rnd() * 5) * s;
        const tx = cx + Math.sin(ang) * ln, ty = base - Math.cos(ang) * ln;
        const nx = Math.cos(ang) * wd, ny = Math.sin(ang) * wd;
        g.fillStyle(0x5a2fa0, 1); g.fillPoints([V(cx - nx, base - ny), V(cx + nx, base + ny), V(tx + nx * 0.5, ty + ny * 0.5), V(tx, ty - 6 * s), V(tx - nx * 0.5, ty - ny * 0.5)], true);
        g.fillStyle(0xc9a8ff, 0.85); g.fillPoints([V(cx, base), V(cx + nx, base + ny), V(tx, ty - 6 * s), V(tx - nx * 0.3, ty - ny * 0.3)], true);
      }
    };
    [[90, 0.62, 1.1], [250, 0.67, 0.7], [470, 0.7, 0.55], [800, 0.7, 0.6], [1050, 0.66, 0.85], [1210, 0.63, 1.2]].forEach(([x, f, s]) => crystal(x, h * f, s));
    // Runas flotantes que brillan suave
    for (let i = 0; i < 9; i++) {
      const x = 60 + rnd() * (w - 120), y = 60 + rnd() * h * 0.45, rg = scene.add.graphics().setPosition(x, y).setBlendMode(Phaser.BlendModes.ADD);
      const sz = 8 + rnd() * 8, kind = Math.floor(rnd() * 4);
      rg.lineStyle(2, pal.glow, 1);
      if (kind === 0) { rg.lineBetween(0, -sz, 0, sz); rg.lineBetween(0, -sz, sz * 0.7, -sz * 0.3); rg.lineBetween(0, 0, sz * 0.7, -sz * 0.3 + sz * 0.6); }
      else if (kind === 1) { rg.strokeTriangle(0, -sz, -sz * 0.8, sz * 0.6, sz * 0.8, sz * 0.6); rg.lineBetween(0, -sz * 0.2, 0, sz * 0.6); }
      else if (kind === 2) { rg.strokeCircle(0, 0, sz * 0.7); rg.lineBetween(-sz, 0, sz, 0); }
      else { rg.lineBetween(-sz * 0.6, -sz, sz * 0.6, sz); rg.lineBetween(sz * 0.6, -sz, -sz * 0.6, sz); rg.lineBetween(-sz * 0.6, 0, sz * 0.6, 0); }
      rg.setAlpha(0.15);
      scene.tweens.add({ targets: rg, alpha: { from: 0.1, to: 0.55 }, y: y - 8, duration: 2200 + rnd() * 1800, delay: rnd() * 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    fireflies(scene, pal.glow, w, h, 14);
  }

  /** Tres cordilleras en silueta; las dos lejanas con casquete nevado. */
  function mountains(g, rnd, w, h, pal) {
    const range = (count, base, height, color, cap) => {
      const step = w / count;
      for (let i = -1; i <= count; i++) {
        const x = i * step + rnd() * step * 0.5, ph = height * (0.6 + rnd() * 0.6), pw = step * (0.7 + rnd() * 0.5);
        const peak = V(x, base - ph);
        g.fillStyle(color, 1); g.fillTriangle(x - pw, base, x + pw, base, peak.x, peak.y);
        if (cap) {   // casquete de nieve: triángulo superior con borde dentado
          const k = 0.28, lx = x - pw * k, rx = x + pw * k, cy = base - ph * (1 - k);
          g.fillStyle(cap, 0.9);
          g.fillPoints([peak, V(rx, cy), V(x + pw * 0.12, cy - ph * 0.05), V(x, cy + ph * 0.04), V(x - pw * 0.14, cy - ph * 0.06), V(lx, cy)], true);
        }
      }
      g.fillStyle(color, 1); g.fillRect(0, base - 1, w, h - base + 1);
    };
    // luna fría
    g.fillStyle(pal.glow, 0.08); g.fillCircle(w * 0.5, h * 0.15, 64);   // centrada: no tapa nombres ni intenciones
    g.fillStyle(pal.glow, 0.8); g.fillCircle(w * 0.5, h * 0.15, 26);
    range(7, h * 0.66, h * 0.42, pal.far, 0x8fb4d6);
    range(9, h * 0.78, h * 0.34, pal.mid, 0x6f93b6);
    range(12, h * 0.95, h * 0.30, pal.near, null);
  }

  /** Nevada suave: copos que caen en bucle a distintas velocidades (pseudoaleatorio fijo). */
  function snowfall(scene, w = 1280, h = 720, count = 60, depth = LAYER.bg) {
    let seed = 23;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const flakes = [];
    for (let i = 0; i < count; i++) {
      const s = 0.12 + rnd() * 0.22;
      const f = scene.add.image(rnd() * w, rnd() * h, 'dot').setScale(s).setTint(0xeaf6ff).setAlpha(0.35 + rnd() * 0.5).setDepth(depth);
      const fall = () => {
        const dur = (7000 + rnd() * 7000) * (0.4 / (s + 0.1));
        scene.tweens.add({ targets: f, y: h + 10, x: f.x + (rnd() - 0.5) * 120, duration: dur * (1 - f.y / (h + 10)), ease: 'Linear',
          onComplete: () => { f.y = -10; f.x = rnd() * w; fall(); } });
      };
      fall();
      flakes.push(f);
    }
    return flakes;
  }

  /* =================================================================
   * Overlay: la escena que va SIEMPRE encima de todas (ver scenes.js · Overlay).
   * Aquí se dibujan consejos, tooltips, glosarios, toasts, ⚙ y menús emergentes.
   * El ESTADO sigue en la escena dueña (_tipQ, _settingsOpen, _potionMenu…), así el teclado y
   * el mando no cambian; lo que una escena pone en el Overlay se destruye cuando esa escena se apaga.
   * ================================================================= */
  const Overlay = {
    scene: null,          // la escena Overlay (la pone su create)
    tipOpen: false,       // hay un consejo abierto (los toasts esperan)
    tipBounds: null,      // rectángulo del globo abierto (para los tests)
    modals: new Set(),    // ventanas del Overlay abiertas (⚙, menú de poción)
    toastQ: [],
    /** Escena donde dibujar: el Overlay si está activo (si no, la propia escena). */
    S(owner) { const o = Overlay.scene; return o && o.sys && o.sys.isActive() ? o : owner; },
    /** Apunta un objeto del Overlay a su escena dueña: se destruye cuando ella se apaga. */
    own(owner, obj) {
      if (!obj || !owner || obj.scene === owner) return obj;
      const set = owner._ovOwned || (owner._ovOwned = new Set());
      set.add(obj);
      obj.once('destroy', () => set.delete(obj));
      if (!owner._ovHooked) {
        owner._ovHooked = true;
        owner.events.once('shutdown', () => { owner._ovHooked = false; const list = [...set]; set.clear(); list.forEach((o) => o.destroy()); });
      }
      return obj;
    },
    owned(owner) { return owner && owner._ovOwned ? [...owner._ovOwned] : []; },
    addModal(layer) { Overlay.modals.add(layer); layer.once('destroy', () => Overlay.modals.delete(layer)); },
    /** ¿Hay una ventana abierta? (del Overlay, o de la propia escena en la capa modal) */
    modalOpen(owner) {
      if (Overlay.modals.size) return true;
      return !!owner && owner.children.list.some((o) => o.active && o.visible !== false && (o.depth || 0) >= LAYER.modal);
    },
    /** Un consejo espera si hay una ventana, el mazo (DeckView) abierto o un cambio de escena en curso. */
    busy(owner) {
      if (Overlay.tipOpen || Overlay.modalOpen(owner)) return true;
      if (owner && owner._leaving) return true;
      const g = owner && owner.sys.game;
      return !!g && owner.sys.settings.key !== 'DeckView' && g.scene.isActive('DeckView');
    },
    pumpToasts() { while (!Overlay.tipOpen && Overlay.toastQ.length) Overlay.toastQ.shift()(); }
  };

  /* =================================================================
   * Tooltip compartido por escena
   * ================================================================= */
  /** Retardo de los tooltips (ratón y mantener pulsado en táctil; con mando salen al enfocar). */
  const TIP_DELAY = 250;
  function tooltip(scene) {
    const S = Overlay.S(scene);   // se dibuja en el Overlay (siempre encima); se borra con la escena dueña
    const box = S.add.container(0, 0).setDepth(LAYER.tooltip).setVisible(false).setScrollFactor(0);
    const bg = S.add.graphics();
    const title = T(S, 12, 10, '', { size: 17, bold: true, color: C.gold, ox: 0, oy: 0 });
    const body = T(S, 12, 34, '', { size: 15, wrap: 280, ox: 0, oy: 0, color: C.parch, lineSpacing: 2 });
    const extra = S.add.container(0, 0);   // fichas del glosario de lo que menciona el texto
    box.add([bg, title, body, extra]);
    Overlay.own(scene, box);
    let timer = null, want = null;
    const render = () => {
      timer = null;
      if (!want || !box.scene) return;
      const { x, y, t, b, o } = want;
      title.setText(t || ''); body.setText(b || '');
      body.setY(t ? 34 : 10);
      let h = (t ? 34 : 10) + (b ? body.height : 0) + 12;
      // Palabras clave y estados que menciona (o los que se pidan con o.kws), sin repetir el del título
      extra.removeAll(true);
      const ids = (o.kws || glossFind(b)).filter((id, i, a) => a.indexOf(id) === i && gloss(id) && !(t && String(t).includes(glossName(id)))).slice(0, o.max || 3);
      let w = Math.max(title.width, body.width) + 24;
      if (ids.length) {
        const sep = S.add.graphics(); extra.add(sep);
        let yy = h + 2;
        for (const id of ids) {
          const kt = T(S, 12, yy, glossName(id), { size: 14, bold: true, color: C.gold, ox: 0, oy: 0 });
          const kd = T(S, 12, yy + 18, glossDesc(id), { size: 13, color: C.muted, ox: 0, oy: 0, wrap: 280, lineSpacing: 1 });
          extra.add([kt, kd]); yy += 18 + kd.height + 6;
          w = Math.max(w, kt.width + 24, kd.width + 24);
        }
        sep.lineStyle(1, C.gold, 0.35); sep.lineBetween(10, h - 4, w - 10, h - 4);
        h = yy + 6;
      }
      bg.clear(); bg.fillStyle(0x0b100e, 0.96); bg.fillRoundedRect(0, 0, w, h, 8);
      bg.lineStyle(1.5, C.gold, 0.7); bg.strokeRoundedRect(0, 0, w, h, 8);
      const px = Phaser.Math.Clamp(x, 8, 1280 - w - 8), py = Phaser.Math.Clamp(y, 8, 720 - h - 8);   // nunca fuera de pantalla
      const was = box.visible;
      box.setPosition(px, py).setVisible(true);
      if (!was) {   // entra con fundido y una pizca de escala (sin moverse con «Reducir movimiento»)
        S.tweens.killTweensOf(box);
        box.setAlpha(0).setScale(Opts.reduceMotion ? 1 : 0.94);
        S.tweens.add({ targets: box, alpha: 1, scale: 1, duration: 120, ease: 'Quad.out' });
      }
    };
    return {
      /** Muestra el tooltip tras TIP_DELAY (al momento si ya hay uno a la vista). o.kws: ids del glosario a añadir. */
      show(x, y, t, b, o = {}) {
        want = { x, y, t, b, o };
        if (box.visible || o.now) { if (timer) { timer.remove(); timer = null; } render(); return; }
        if (!timer) timer = S.time.delayedCall(TIP_DELAY, render);
      },
      hide() { want = null; if (timer) { timer.remove(); timer = null; } S.tweens.killTweensOf(box); box.setVisible(false).setAlpha(1).setScale(1); },
      get visible() { return box.visible; },
      get text() { return box.visible ? [title.text, body.text].concat(extra.list.filter((q) => q.text).map((q) => q.text)).join('\n') : ''; }
    };
  }

  /* =================================================================
   * Botón
   * ================================================================= */
  /**
   * Botón antiguo → UIButton (src/ui/UIButton.js). Solo hay 3 variantes: las de antes se reparten así
   *   'primary' / 'gold' / sin variante → primary · 'ghost' / 'danger' / 'secondary' → secondary · 'option' → option
   * compact: las escenas aún sin migrar pueden tener botones de menos de 48 px (la fase 2 los quitará).
   */
  const LEGACY_VARIANT = { primary: 'primary', gold: 'primary', ghost: 'secondary', danger: 'secondary', secondary: 'secondary', option: 'option' };
  function button(scene, x, y, label, onClick, o = {}) {
    return root.CM_UIButton.create(scene, x, y, label, onClick, { ...o, variant: LEGACY_VARIANT[o.variant || 'primary'] || 'secondary', compact: o.compact !== false });
  }

  /* =================================================================
   * Carta
   * ================================================================= */
  const CARD_W = 160, CARD_H = 224;
  /** Color del marco: por tipo; las cartas del Criomante usan tonos de hielo en vez de rojo. */
  const CRIO_COLOR = { attack: 0x6fc3ff, skill: 0x9fdcff, power: 0xb6a8ff };
  const GUARD_COLOR = { attack: 0xd98a3a, skill: 0xe0b46a, power: 0xf0cf7a };   // ámbar
  const NEUTRAL_COLOR = { attack: 0x9a948a, skill: 0xb3ada2, power: 0xc8c2b6 };  // gris piedra
  const INVO_COLOR = { attack: 0x4fbf6e, skill: 0x7fd99a, power: 0xb0eec0 };     // verde bosque
  const PALA_COLOR = { attack: 0xe0b03a, skill: 0xf2d36b, power: 0xfff0b0 };     // oro
  const ELEC_COLOR = { attack: 0x3fb8ff, skill: 0x7fd6ff, power: 0xc8f0ff };     // azul eléctrico
  function cardColor(card, d) {
    const def = root.CM_DATA.CARDS[card.id] || {};
    if (def.class === 'criomante' && CRIO_COLOR[d.type]) return CRIO_COLOR[d.type];
    if (def.class === 'guardiana' && GUARD_COLOR[d.type]) return GUARD_COLOR[d.type];
    if (def.class === 'neutral' && NEUTRAL_COLOR[d.type]) return NEUTRAL_COLOR[d.type];
    if (def.class === 'invocadora' && INVO_COLOR[d.type]) return INVO_COLOR[d.type];
    if (def.class === 'paladin' && PALA_COLOR[d.type]) return PALA_COLOR[d.type];
    if (def.class === 'electromante' && ELEC_COLOR[d.type]) return ELEC_COLOR[d.type];
    return TYPE_COLOR[d.type];
  }

  /* =================================================================
   * Carta con marco por personaje (assets/frames/frame_<clase>.webp, 480×720 con 2 huecos)
   * Capas: fondo degradado del tipo en el hueco 1 · icono · pergamino en el hueco 2 · marco encima · medallón del coste.
   * Lo fijo (fondo + pergamino + marco + tipo + gema de rareza + brillo de mejora + medallón) se pinta UNA vez por
   * combinación en una textura de lienzo cacheada ('cb_…', a 2×) que comparten todas las cartas iguales;
   * cada carta solo añade su icono y sus textos vivos (nombre, coste, efecto), que cambian en combate.
   * ================================================================= */
  /** Huecos de cada marco en proporción 0-1 (assets/frames/ventanas.json): [ilustración, texto], cada uno [x0, y0, x1, y1]. */
  const FRAME_WIN = { criomante: [[0.142, 0.113, 0.858, 0.605], [0.142, 0.641, 0.858, 0.859]], electromante: [[0.149, 0.118, 0.851, 0.589], [0.149, 0.637, 0.85, 0.86]], guardiana: [[0.144, 0.117, 0.855, 0.592], [0.146, 0.64, 0.853, 0.864]], invocadora: [[0.139, 0.115, 0.86, 0.592], [0.143, 0.637, 0.855, 0.861]], neutral: [[0.132, 0.116, 0.867, 0.583], [0.14, 0.632, 0.86, 0.852]], paladin: [[0.145, 0.115, 0.854, 0.581], [0.152, 0.632, 0.847, 0.864]], piromago: [[0.133, 0.125, 0.867, 0.613], [0.139, 0.658, 0.86, 0.878]] };
  const FRAME_IDS = Object.keys(FRAME_WIN);
  // La textura base se pinta a R×1,3 (mín. 2, máx. 3): nítida a la resolución real, también al pasar el ratón (×1,3)
  const CARD_RES = Math.min(3, Math.max(2, Math.ceil(root.CM_HIRES.R * 1.3 * 4) / 4));
  /** Marco de una carta: el de su personaje; neutrales, «cualquiera» y maldiciones, el neutral. */
  const frameOf = (def) => (FRAME_WIN[def.class] ? def.class : 'neutral');
  /** Huecos en píxeles locales de la carta (origen en el centro). */
  function cardHoles(fr) {
    const [a, t] = FRAME_WIN[fr] || FRAME_WIN.neutral, W = CARD_W, H = CARD_H;
    const r = (q) => ({ x: -W / 2 + q[0] * W, y: -H / 2 + q[1] * H, w: (q[2] - q[0]) * W, h: (q[3] - q[1]) * H });
    return { art: r(a), text: r(t) };
  }
  const roundRect = (ctx, x, y, w, h, rad) => { ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad); ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath(); };
  /** Textura base cacheada (una por marco × tipo × rareza × mejora × coste × idioma). Devuelve su clave. */
  function cardBase(scene, fr, type, rarity, up, hasCost, labelCol) {
    const key = `cb_${fr}_${type}_${rarity}_${up ? 1 : 0}_${hasCost ? 1 : 0}_${I18N.lang}_${labelCol}`;
    if (scene.textures.exists(key)) return key;
    const R = CARD_RES, CW = CARD_W * R, CH = CARD_H * R, K = TH.card;
    const tex = scene.textures.createCanvas(key, CW, CH), ctx = tex.getContext();
    const hole = (q) => ({ x: q[0] * CW, y: q[1] * CH, w: (q[2] - q[0]) * CW, h: (q[3] - q[1]) * CH });
    const [qa, qt] = FRAME_WIN[fr], A = hole(qa), P = hole(qt), pad = 3 * R;   // pad: el fondo entra un poco bajo el marco (sin rendijas)
    // (a) fondo de la ilustración: degradado vertical oscuro del color del tipo, con esquinas redondeadas
    const [top, bot] = K.typeBg[type] || K.typeBg.skill;
    ctx.save(); roundRect(ctx, A.x - pad, A.y - pad, A.w + pad * 2, A.h + pad * 2, 8 * R); ctx.clip();
    const gr = ctx.createLinearGradient(0, A.y, 0, A.y + A.h); gr.addColorStop(0, top); gr.addColorStop(1, bot);
    ctx.fillStyle = gr; ctx.fillRect(A.x - pad, A.y - pad, A.w + pad * 2, A.h + pad * 2);
    const vg = ctx.createRadialGradient(A.x + A.w / 2, A.y + A.h / 2, A.h * 0.2, A.x + A.w / 2, A.y + A.h / 2, A.h * 0.75);   // viñeta suave
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = vg; ctx.fillRect(A.x - pad, A.y - pad, A.w + pad * 2, A.h + pad * 2);
    ctx.restore();
    // (c) pergamino crema en el hueco 2 (con un poco de sombra en los bordes)
    ctx.save(); roundRect(ctx, P.x - pad, P.y - pad, P.w + pad * 2, P.h + pad * 2, 6 * R); ctx.clip();
    const pg = ctx.createLinearGradient(0, P.y, 0, P.y + P.h); pg.addColorStop(0, K.parchment); pg.addColorStop(1, K.parchmentEdge);
    ctx.fillStyle = pg; ctx.fillRect(P.x - pad, P.y - pad, P.w + pad * 2, P.h + pad * 2);
    ctx.restore();
    // Tipo (ATAQUE / HABILIDAD / PODER), pequeño, abajo del hueco 1
    const lbl = String(TYPE_LABEL[type] || '').toUpperCase().split('').join(' ');
    ctx.font = `bold ${11 * R}px ${TH.font.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3 * R; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(lbl, A.x + A.w / 2, A.y + A.h - 9 * R);
    ctx.fillStyle = TH.css(labelCol); ctx.fillText(lbl, A.x + A.w / 2, A.y + A.h - 9 * R);
    // (d) marco del personaje encima (maldición: neutral teñido de gris morado; mejorada: brillo dorado leve)
    const src = scene.textures.exists('frame_' + fr) ? scene.textures.get('frame_' + fr).getSourceImage() : null;
    if (src) {
      let img = src;
      if (type === 'curse') {
        const tmp = document.createElement('canvas'); tmp.width = CW; tmp.height = CH;
        const t2 = tmp.getContext('2d'); t2.drawImage(src, 0, 0, CW, CH);
        t2.globalCompositeOperation = 'source-atop'; t2.fillStyle = 'rgba(72, 64, 82, 0.62)'; t2.fillRect(0, 0, CW, CH);
        img = tmp;
      }
      if (up) { ctx.save(); ctx.shadowColor = K.upgradeGlow; ctx.shadowBlur = 9 * R; ctx.drawImage(img, 0, 0, CW, CH); ctx.restore(); }
      ctx.drawImage(img, 0, 0, CW, CH);
    } else {   // sin PNG del marco: un borde sencillo (respaldo)
      ctx.lineWidth = 4 * R; ctx.strokeStyle = TH.css(labelCol); roundRect(ctx, 2 * R, 2 * R, CW - 4 * R, CH - 4 * R, 10 * R); ctx.stroke();
    }
    // Rareza: gema pequeña en el centro inferior del marco (común e inicial, sin gema)
    const rc = K.rarity[rarity];
    if (rc) {
      const gx = CW / 2, gy = CH - 10 * R, s = 6 * R;
      ctx.save(); ctx.shadowColor = rc; ctx.shadowBlur = rarity === 'legendary' ? 10 * R : 5 * R;
      ctx.beginPath(); ctx.moveTo(gx, gy - s); ctx.lineTo(gx + s * 0.8, gy); ctx.lineTo(gx, gy + s); ctx.lineTo(gx - s * 0.8, gy); ctx.closePath();
      ctx.fillStyle = rc; ctx.fill(); ctx.lineWidth = 1.2 * R; ctx.strokeStyle = 'rgba(20,12,6,0.9)'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.moveTo(gx, gy - s * 0.7); ctx.lineTo(gx + s * 0.35, gy - s * 0.1); ctx.lineTo(gx, gy); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // Medallón dorado del coste (esquina superior izquierda, por encima del marco)
    if (hasCost) {
      const mx = 17 * R, my = 17 * R, mr = 16 * R, C2 = K.cost;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4 * R; ctx.shadowOffsetY = 2 * R;
      const mg = ctx.createRadialGradient(mx - mr * 0.35, my - mr * 0.35, mr * 0.1, mx, my, mr);
      mg.addColorStop(0, C2.ringHi); mg.addColorStop(0.6, C2.ring); mg.addColorStop(1, C2.ringLo);
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = C2.core; ctx.beginPath(); ctx.arc(mx, my, mr * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1 * R; ctx.strokeStyle = C2.ringLo; ctx.stroke();
    }
    tex.refresh();
    return key;
  }

  /**
   * Carta estática (compendio, listas): se pinta UNA vez en una RenderTexture y se guarda como textura ('cs_…');
   * las siguientes veces es una sola imagen (scroll fluido con cientos de cartas). Sin combate ni cosméticos.
   */
  const SNAP_RES = Math.max(1.5, root.CM_HIRES.R);   // instantánea de carta a la resolución real (mín. 1,5 como antes)
  function cardSnapshot(scene, card, scale = 0.6) {
    const key = `cs_${card.id}_${card.up ? 1 : 0}_${I18N.lang}_${scale}`;
    const w = Math.ceil((CARD_W + 10) * scale * SNAP_RES), h = Math.ceil((CARD_H + 14) * scale * SNAP_RES);
    if (!scene.textures.exists(key)) {
      const cv = cardView(scene, card, { noLook: true }).setScale(scale * SNAP_RES).setPosition(w / 2, h / 2 - 2 * scale * SNAP_RES);
      const rt = scene.make.renderTexture({ x: 0, y: 0, width: w, height: h }, false);
      rt.draw(cv);
      rt.saveTexture(key);
      cv.destroy();
    }
    const img = scene.add.image(0, 2 * scale, key).setScale(1 / SNAP_RES);
    img.cardData = card;
    return img;
  }

  /** Tamaño de letra (13 → 10) con el que el efecto cabe en el pergamino, medido sin repintar el texto (lienzo compartido). */
  let _measureCtx = null;
  function guessDescSize(str, w, h) {
    if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d');
    const ctx = _measureCtx;
    for (let fs = 13; fs > 10; fs--) {
      ctx.font = `${fs}px ${TH.font.ui}`;
      let lines = 0;
      for (const para of String(str).split('\n')) {
        let line = '';
        lines++;
        for (const word of para.split(' ')) {
          const t = line ? line + ' ' + word : word;
          if (ctx.measureText(t).width > w && line) { lines++; line = word; } else line = t;
        }
      }
      if (lines * (fs * 1.18 - 2) <= h) return fs;
    }
    return 10;
  }

  /** Crea una carta. ctx.combat → textos con daño real; ctx.preview → mostrar versión mejorada. */
  function cardView(scene, card, ctx = {}) {
    const c = scene.add.container(0, 0);
    const shown = ctx.preview ? { ...card, up: true } : card;
    const d = E.cardDef(shown);
    const def = root.CM_DATA.CARDS[card.id] || {};
    const col = cardColor(card, d);
    const W = CARD_W, H = CARD_H, x0 = -W / 2, y0 = -H / 2, K = TH.card;
    const fr = frameOf(def), { art: A, text: P } = cardHoles(fr);
    const curse = d.type === 'curse' || def.class === 'curse';
    // Sombra de la carta + base cacheada (fondo, pergamino, marco, tipo, rareza, medallón)
    const shadow = scene.add.graphics(); shadow.fillStyle(TH.color.shade, 0.35); shadow.fillRoundedRect(x0 + 3, y0 + 5, W, H, 12);
    const base = scene.add.image(0, 0, cardBase(scene, fr, curse ? 'curse' : d.type, d.rarity, !!shown.up, d.cost !== null, col)).setDisplaySize(W, H);
    c.add([shadow, base]);
    const g = base;   // compatibilidad (setPlayable)
    // Icono centrado en la ilustración (≈ 70 % de su alto) con sombra suave debajo; nombre arriba y tipo abajo lo enmarcan
    const hasKw = !!keywordLine(shown);   // con palabras clave en la ilustración, el icono sube y encoge un poco
    const ICON_PX = Math.round(A.h * (hasKw ? 0.6 : 0.66)), icx = A.x + A.w / 2, icy = A.y + A.h / 2 + (hasKw ? -1 : 3);
    const iconShadow = scene.add.image(icx + 1, icy + 3, 'ic_' + d.icon).setDisplaySize(ICON_PX + 4, ICON_PX + 4).setTintFill(TH.color.shade).setAlpha(TH.alpha.shadow);
    const icon = scene.add.image(icx, icy, 'ic_' + d.icon).setDisplaySize(ICON_PX, ICON_PX);
    c.add([iconShadow, icon]);   // el icono cabe dentro del hueco transparente del marco: va encima de la base sin taparlo
    // Legendaria: marco dorado que late (sin movimiento con «Reducir movimiento»)
    if (d.rarity === 'legendary') {
      const lg = scene.add.graphics();
      lg.lineStyle(4, 0xffd75a, 1); lg.strokeRoundedRect(x0 - 1, y0 - 1, W + 2, H + 2, 13);
      c.add(lg);
      c.legendGlow = lg;
      if (!Opts.reduceMotion) scene.tweens.add({ targets: lg, alpha: { from: 1, to: 0.25 }, duration: 950, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    // Cosmético «marco» (Afinidad / compendio): solo las cartas de la partida (no las de las pantallas de menú)
    if (Look.frame && !ctx.noLook && card && card.uid > 0) {
      const fc = lookColor('frame', Look.frame, Look.char), fg = scene.add.graphics();
      fg.lineStyle(3, fc, 1); fg.strokeRoundedRect(x0 - 2, y0 - 2, W + 4, H + 4, 13);
      c.add(fg);
      if (E.D.COSMETICS.frame[Look.frame].anim && !Opts.reduceMotion) scene.tweens.add({ targets: fg, alpha: { from: 1, to: 0.45 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    // Legado: marca dorada pequeña en la esquina del arte
    if (card && card.legacy) {
      const mk = scene.add.graphics();
      mk.fillStyle(0x0d0b0a, 0.92); mk.fillCircle(A.x + A.w - 11, A.y + 30, 9.5);
      mk.lineStyle(2, 0xf2c94c, 1); mk.strokeCircle(A.x + A.w - 11, A.y + 30, 9.5);
      star(mk, A.x + A.w - 11, A.y + 30, 6.5, 2.8, 5, 0xf2c94c);
      c.add(mk);
    }
    // Senda (Parche 3.1): icono y color de cada senda de la carta, en la esquina del arte
    (d.tags || []).forEach((t, i) => {
      const pth = E.D.PATHS && E.D.PATHS[t];
      if (!pth) return;
      const bx = A.x + 11 + i * 21, by = A.y + 30;
      const ring = scene.add.circle(bx, by, 9.5, 0x0d0b0a, 0.92).setStrokeStyle(2, pth.color, 1);
      c.add([ring, scene.add.image(bx, by, 'ic_' + pth.icon).setIconScale(0.22)]);
    });

    // Coste: número sobre el medallón (verde si es más barata; rojo si no se puede jugar)
    const vals = E.cardVals(shown);
    let playable = true;
    if (d.cost !== null) {
      const xCost = d.cost === 'X';   // Coste X: el medallón muestra «X»
      const realCost = xCost ? 'X' : (ctx.combat ? E.costIn(shown, ctx.combat) : vals.cost);   // Caos / Reloj: más barata este turno
      const cost = T(scene, x0 + 17, y0 + 17, String(realCost), { size: 20, bold: true, color: (!xCost && (realCost < vals.cost || (shown.up && d.up && d.up.cost !== undefined))) ? C.leaf : C.parch });
      c.add(cost);
      c.costText = cost;
    }
    // Nombre: arriba, dentro del hueco de la ilustración (gótica, crema con contorno oscuro)
    const NAME_Y = A.y + 12, NAME_W = A.w - 8;
    const name = T(scene, A.x + A.w / 2, NAME_Y, E.cardName(shown), { size: 16, font: 'display', color: shown.up ? C.leaf : TH.num(TH.color.ink), stroke: K.outline, strokeThickness: 4 });
    name.isCardName = true;
    fitLine(name, NAME_W, 12);
    c.add(name);
    /**
     * Mano apretada: el nombre se alinea a la izquierda y cabe entero en la franja visible
     * de la carta (visW, en píxeles locales de la carta), en hasta 2 líneas. null: normal.
     */
    c.setCompact = (visW) => {
      if (c._compact === visW) return;
      c._compact = visW;
      name.setScale(1);
      if (!visW) { name.setOrigin(0.5, 0.5).setPosition(A.x + A.w / 2, NAME_Y).setWordWrapWidth(null).setFontSize(16).setAlign('center'); fitLine(name, NAME_W, 12); return; }
      const w = Math.max(40, Math.min(NAME_W, visW - (A.x - x0) - 6));
      name.setOrigin(0, 0.5).setPosition(A.x + 4, NAME_Y + 2).setAlign('left');
      let size = 16;   // encoge sin partir palabras: primero en una línea; si no cabe, en dos (por palabras)
      name.setWordWrapWidth(null).setFontSize(size);
      while (size > 12 && name.width > w) name.setFontSize(--size);
      if (name.width > w) {
        name.setWordWrapWidth(w, false);
        while (size > 10 && (name.width > w || name.height > 34)) name.setFontSize(--size);
      }
    };
    // Palabras clave (línea propia arriba del pergamino) y texto de efecto centrado en el pergamino, en tinta oscura
    const kws = keywordLine(shown);
    // Margen interior del pergamino: el texto nunca toca el borde (si no cabe, baja la letra hasta 10 px y solo después se estrecha)
    const PAD_X = Number(root.CM_CARD_PAD_X || 8), PAD_Y = Number(root.CM_CARD_PAD_Y || 3);   // 8 px a los lados; arriba y abajo 3 px (el marco ya aporta su bisel)
    // Palabras clave: en la ilustración, justo encima del tipo (dorado con contorno), para dejar el pergamino entero al efecto
    const kwT = kws ? T(scene, A.x + A.w / 2, A.y + A.h - 22, kws, { size: 11, bold: true, color: TH.color.gold, stroke: K.outline, strokeThickness: 3 }) : null;
    if (kwT) { fitLine(kwT, A.w - 10, 9); c.add(kwT); }
    const descTop = P.y + PAD_Y, descH = P.h - PAD_Y * 2, DESC_W = P.w - PAD_X * 2;
    const desc = T(scene, P.x + P.w / 2, descTop + descH / 2, '', { size: 13, align: 'center', wrap: DESC_W, lineSpacing: -2, color: TH.num(K.ink) });
    c.add(desc);
    // Conservar: candado pequeño en la esquina del arte
    if (d.retain) c.add(scene.add.image(A.x + A.w - 11, A.y + 30 + (card && card.legacy ? 21 : 0), 'ic_lock').setIconScale(0.28));
    // Etérea: borde que parpadea suave
    if (d.ethereal) {
      const eg = scene.add.graphics(); eg.lineStyle(3, 0xcfe7ff, 1); eg.strokeRoundedRect(x0 + 1.5, y0 + 1.5, W - 3, H - 3, 11);
      scene.tweens.add({ targets: eg, alpha: { from: 0.15, to: 0.85 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      c.add(eg);
    }
    // Templar / Llama Paciente / Combo: «+N» verde junto al arte cuando el daño mostrado supera el base
    const bonusT = T(scene, A.x + A.w - 6, A.y + A.h - 22, '', { size: 15, bold: true, color: C.leaf, stroke: 0x000000, strokeThickness: 4, ox: 1 });
    c.add(bonusT);
    // Eco Ardiente pendiente: halo alrededor de la carta (se crea solo si hace falta)
    let halo = null;
    c.setEcho = (on) => {
      if (!on && !halo) return;
      if (!halo) { halo = scene.add.graphics().setVisible(false); halo.lineStyle(6, C.flame, 0.55); halo.strokeRoundedRect(x0 - 4, y0 - 4, W + 8, H + 8, 15); c.addAt(halo, 0); }
      if (on === halo.visible) return; halo.setVisible(on); scene.tweens.killTweensOf(halo); if (on) scene.tweens.add({ targets: halo, alpha: { from: 0.4, to: 1 }, duration: 600, yoyo: true, repeat: -1 });
    };

    // Vista previa de mejora: si cambia el coste, etiqueta «Coste 2 → 1» bien visible sobre el arte
    if (ctx.preview && d.up && d.up.cost !== undefined && E.cardVals({ ...card, up: false }).cost !== vals.cost) {
      const lbl = _t('u.coste_0_1', { 0: E.cardVals({ ...card, up: false }).cost, 1: vals.cost });
      const tg = T(scene, A.x + A.w / 2, A.y + 36, lbl, { size: 14, bold: true, color: 0x0d1a0d });
      const pg = scene.add.graphics(); pg.fillStyle(C.leaf, 1); pg.fillRoundedRect(A.x + A.w / 2 - tg.width / 2 - 10, A.y + 25, tg.width + 20, 22, 11);
      c.add([pg, tg]);
    }
    c.setSize(W, H);
    c.cardData = card;
    c.descText = desc; c.descBox = { w: DESC_W, h: descH }; c.nameText = name; c.nameBox = NAME_W;   // pruebas (test/cards.js)
    /** Encaja el efecto en el pergamino: de 13 px hasta 10 (el mínimo de antes); si aún no cabe, estrecha la letra (nunca se corta). */
    const fitDesc = () => {
      desc.setScale(1).setWordWrapWidth(DESC_W, true);   // volver al ancho del pergamino (un refresh anterior pudo dejarlo estrechado)
      desc.setFontSize(guessDescSize(desc.text, DESC_W, descH));   // un solo repintado en la mayoría de cartas (antes: uno por tamaño probado)
      fitText(desc, DESC_W, descH, 10);
      for (let k = 0.95; desc.height > descH && k >= 0.69; k -= 0.05) { desc.setWordWrapWidth(DESC_W / k, true); desc.setScale(k, 1); }
      if (desc.height > descH) desc.setScale(desc.scaleX, descH / desc.height);
    };
    c.refresh = (combat) => {
      desc.setText(E.cardText(shown, combat));
      fitDesc();
      const base0 = E.attackBase(shown, combat), plain = E.attackBase(shown, null);
      const extra = combat && base0 !== null && plain !== null ? base0 - plain : 0;
      bonusT.setText(extra > 0 ? `+${extra}` : '');
      if (combat && c.costText && d.cost !== 'X' && d.cost !== null) {   // coste del turno (Caos, Metamorfosis, Reloj)
        const rc = E.costIn(shown, combat);
        c.costText.setText(String(rc)).setColor(hex(!playable ? C.blood : rc < E.cardVals(shown).cost ? C.leaf : C.parch));
      }
    };
    c.setPlayable = (ok) => {
      playable = !!ok;
      icon.setAlpha(ok ? 1 : 0.5);
      if (c.costText && d.cost !== null && d.cost !== 'X' && ctx.combat !== undefined) {
        const rc = ctx.combat ? E.costIn(shown, ctx.combat) : vals.cost;
        c.costText.setColor(hex(!ok ? C.blood : rc < vals.cost ? C.leaf : C.parch));   // no se puede jugar: número en rojo
      } else if (c.costText && !ok) c.costText.setColor(hex(C.blood));
      c.playableGlow = ok;
    };
    /** Silencio (Acto III): velo y candado encima de la carta. */
    c.setSealed = (on) => {
      if (!on) { if (c.sealLayer) c.sealLayer.setVisible(false); return; }
      if (!c.sealLayer) {
        const L = scene.add.container(0, 0);
        const veil = scene.add.graphics(); veil.fillStyle(0x2a1240, 0.55); veil.fillRoundedRect(x0, y0, W, H, 12); veil.lineStyle(3, 0xb27bff, 1); veil.strokeRoundedRect(x0 + 1.5, y0 + 1.5, W - 3, H - 3, 11);
        const lock = scene.add.image(icx, icy, 'ic_vlock').setIconScale(0.9);
        L.add([veil, lock, T(scene, 0, A.y + A.h - 10, I18N.t('st.silencedTag'), { size: 14, bold: true, color: 0xe0c8ff, stroke: 0x000000, strokeThickness: 4 }).setLetterSpacing(2)]);
        c.add(L); c.sealLayer = L;
      }
      c.sealLayer.setVisible(true);
    };
    c.refresh(ctx.combat);
    return c;
  }

  /* ---------------- Mejora: qué cambia (normal → mejorada) ---------------- */
  const VAL_LABEL = { get dmg() { return _t('u.dano'); }, get block() { return _t('u.bloqueo'); }, get burn() { return _t('u.quemadura'); }, get draw() { return _t('u.cartas_robadas'); }, get temp() { return _t('u.temperatura'); }, get frost() { return _t('u.escarcha'); }, get ice() { return _t('u.escudo_de_hielo'); },
    get hits() { return _t('u.golpes'); }, get per() { return _t('u.por_cada'); }, get temper() { return _t('u.templar'); }, get comboN() { return _t('u.combo_cartas'); }, get comboDmg() { return _t('u.dano_del_combo'); }, get comboBurn() { return _t('u.quemadura_del_combo'); }, get comboHits() { return _t('u.golpes_del_combo'); },
    get comboEnergy() { return _t('u.energia_del_combo'); }, get energy() { return _t('u.energia'); }, get mult() { return _t('u.multiplicador'); }, get amt() { return _t('u.valor'); }, get xPlus() { return _t('u.x_extra'); }, get self() { return _t('u.vida_que_pierdes'); }, get heal() { return _t('u.curacion'); }, get gold() { return _t('u.oro'); },
    get lo() { return _t('u.dano_minimo'); }, get hi() { return _t('u.dano_maximo'); }, get frostBonus() { return _t('u.bonus_con_escarcha'); }, get perRuneType() { return _t('u.por_tipo_de_runa'); }, get times() { return _t('u.veces'); }, get n() { return _t('u.cartas'); }, get cool() { return _t('u.enfriamiento'); }, get thorns() { return _t('u.muro_de_llamas'); }, get hit() { return _t('u.dano_extra'); } };
  /** { cost: [antes, después] | null, lines: ['Daño 6 → 9', …], text: [antes, después] } */
  function upgradeDiff(card) {
    const a = { ...card, up: false }, b = { ...card, up: true }, va = E.cardVals(a), vb = E.cardVals(b);
    const out = { cost: va.cost !== vb.cost ? [va.cost, vb.cost] : null, lines: [], text: [E.cardText(a, null), E.cardText(b, null)] };
    for (const k of Object.keys(vb)) {
      if (k === 'cost' || va[k] === vb[k]) continue;
      if (typeof vb[k] === 'number' && VAL_LABEL[k]) out.lines.push(`${VAL_LABEL[k]} ${va[k] === undefined ? 0 : va[k]} → ${vb[k]}`);
      else if (k === 'noExhaust') out.lines.push(_t('u.ya_no_se_agota'));
      else if (k === 'choose') out.lines.push(_t('u.eliges_la_runa'));
    }
    if (!out.lines.length && out.text[0] !== out.text[1]) out.lines.push(_t('u.efecto_mejorado'));
    return out;
  }
  /**
   * Comparación de mejora: carta normal → mejorada, «Coste 2 → 1» y lo que cambia en verde.
   * Devuelve un contenedor centrado en (x, y).
   */
  function upgradeCompare(scene, card, x, y) {
    const c = scene.add.container(x, y);
    const S = 1.4, DX = 172;
    const a = cardView(scene, { ...card, up: false }).setPosition(-DX, 0).setScale(S);
    const b = cardView(scene, { ...card, up: true }).setPosition(DX, 0).setScale(S);
    // Lo que cambia (nombre, coste, números del texto) se pinta en verde en la carta mejorada
    const texts = (v) => v.list.filter((o) => o.type === 'Text');
    const ta = texts(a), tb = texts(b);
    tb.forEach((t, i) => { if (ta[i] && ta[i].text !== t.text) t.setColor(hex(C.leaf)); });
    const arrow = scene.add.graphics(); arrow.fillStyle(C.leaf, 1); arrow.fillTriangle(22, 0, -10, -20, -10, 20); arrow.fillRect(-34, -7, 26, 14);
    const glow = scene.add.graphics(); glow.lineStyle(4, C.leaf, 0.9); glow.strokeRoundedRect(DX - CARD_W * S / 2 - 7, -CARD_H * S / 2 - 7, CARD_W * S + 14, CARD_H * S + 14, 16);
    c.add([glow, a, b, arrow]);
    const df = upgradeDiff(card);
    let yy = CARD_H * S / 2 + 30;
    if (df.cost) {
      const t = T(scene, 0, yy, _t('u.coste_0_1', { 0: df.cost[0], 1: df.cost[1] }), { size: 24, bold: true, color: 0x0d1a0d });
      const pg = scene.add.graphics(); pg.fillStyle(C.leaf, 1); pg.fillRoundedRect(-t.width / 2 - 14, yy - 17, t.width + 28, 34, 17);
      c.add([pg, t]); yy += 40;
    }
    if (df.lines.length) c.add(fitText(T(scene, 0, yy, df.lines.join('   ·   '), { size: 26, bold: true, color: C.leaf, stroke: 0x000000, strokeThickness: 4 }), 900, 0, 14));
    return c;
  }

  /* =================================================================
   * GLOSARIO (data.js GLOSSARY): nombres y explicaciones de palabras clave, estados, mecánicas,
   * intenciones y afijos. Los números ({overheatAt}…) salen de E.RULES; {n}… del valor actual.
   * ================================================================= */
  const GL = () => E.D.GLOSSARY;
  const gloss = (id) => GL()[id] || null;
  const glossName = (id) => { const g = gloss(id); return g ? g.name : String(id); };
  const glFill = (str, vars) => String(str || '').replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars && vars[k] !== undefined ? vars[k] : m));
  /** Explicación: la general, o la del valor actual si se pasa vars.n y la entrada tiene «now». */
  function glossDesc(id, vars) {
    const g = gloss(id); if (!g) return '';
    const v = Object.assign({}, E.RULES, vars || {});
    return glFill(I18N.plurals(vars && vars.n !== undefined && g.now ? g.now : g.desc, v), v);
  }
  let glRe = { key: '', list: [] };
  function glossRegexes() {
    const key = I18N.lang + ':' + Object.keys(GL()).length;
    if (glRe.key === key) return glRe.list;
    const list = [];
    for (const id of Object.keys(GL())) {
      const m = GL()[id].match;
      if (!m) continue;
      try { list.push([id, new RegExp('(?<![\\p{L}])(?:' + m + ')(?![\\p{L}])', 'gu')]); } catch (e) { /* expresión mal escrita: el test la señala */ }
    }
    glRe = { key, list };
    return list;
  }
  /** Ids del glosario que menciona un texto, en el orden en que aparecen (sin solapes: «Fuerza creciente» gana a «Fuerza»). */
  function glossFind(text) {
    const t = String(text || ''), hits = [];
    if (!t) return [];
    for (const [id, re] of glossRegexes()) { re.lastIndex = 0; const m = re.exec(t); if (m) hits.push({ id, a: m.index, b: m.index + m[0].length }); }
    hits.sort((p, q) => p.a - q.a || (q.b - q.a) - (p.b - p.a));
    const out = []; let end = -1;
    for (const h of hits) { if (h.a < end) continue; out.push(h.id); end = h.b; }
    return out;
  }
  /** Ids que cuentan como «palabra clave» en cartas (compatibilidad: U.KEYWORDS). */
  const KW_IDS = ['burn', 'temp', 'block', 'exhaust', 'unplayable', 'retain', 'ethereal', 'temper', 'combo', 'xcost', 'frost', 'frozen', 'ice', 'shatter',
    'engrave', 'detonate', 'runepower', 'summon', 'bond', 'judgment', 'fervor', 'immaterial'];
  const kwTerm = (id) => glossName(id);
  const kwDesc = (id) => glossDesc(id);
  /** { término: explicación } en el idioma actual (compatibilidad: U.KEYWORDS[término]). */
  const keywordsNow = () => Object.fromEntries(KW_IDS.map((id) => [kwTerm(id), kwDesc(id)]));
  /** Línea dorada de palabras clave de una carta (vacía si no tiene). */
  function keywordLine(card) {
    const d = E.cardDef(card), v = E.cardVals(card), out = [];
    if (d.cost === 'X') out.push(kwTerm('xcost'));
    if (d.retain) out.push(kwTerm('retain'));
    if (d.ethereal || card.eth) out.push(kwTerm('ethereal'));   // card.eth: carta del Grimorio Inestable
    if (v.temper) out.push(`${kwTerm('temper')} ${v.temper}`);
    if (v.comboN) out.push(kwTerm('combo'));   // el número va en el texto: «Combo N: …»
    return out.join(' · ');
  }
  const hasKeyword = (card) => !!keywordLine(card);
  /** Ids del glosario de una carta: las de su línea de palabras clave y, después, las que menciona su texto, en orden. */
  function keywordIds(card) {
    const d = E.cardDef(card), v = E.cardVals(card);
    const ids = [];
    if (d.cost === 'X') ids.push('xcost');
    if (d.retain) ids.push('retain');
    if (d.ethereal || card.eth) ids.push('ethereal');
    if (v.temper) ids.push('temper');
    if (v.comboN) ids.push('combo');
    if (d.type === 'curse') ids.push('curse');
    if (d.unplayable) ids.push('unplayable');
    let txt = d.text;
    try { txt = E.cardText(card); } catch (e) { /* carta sin texto calculable */ }
    for (const id of glossFind(txt)) if (!ids.includes(id) && !(gloss(id).cat === 'intent')) ids.push(id);
    if (d.type === 'power' && !ids.includes('power')) ids.push('power');
    return ids;
  }
  function keywordTips(card) { return keywordIds(card).map((id) => [glossName(id), glossDesc(id)]); }
  /**
   * Glosario reutilizable: panel con las palabras clave de una carta (término en dorado + explicación).
   * show(card, rect): se coloca debajo de rect (la carta) o, si no cabe, encima; siempre dentro de 1280×720.
   */
  function glossary(scene) {
    const S = Overlay.S(scene);
    const box = S.add.container(0, 0).setDepth(LAYER.tooltip).setVisible(false).setScrollFactor(0);
    Overlay.own(scene, box);
    let timer = null;
    const api = {
      /** Fichas de TODAS las palabras clave de la carta, en el orden del texto (tras TIP_DELAY; al momento si ya se ve). */
      show(card, rect, now) {
        if (timer) { timer.remove(); timer = null; }
        if (!box.visible && !now) { timer = S.time.delayedCall(TIP_DELAY, () => { timer = null; api.show(card, rect, true); }); return; }
        box.removeAll(true);
        const tips = keywordTips(card);
        if (!tips.length) { box.setVisible(false); return; }
        const W = 300, g = S.add.graphics();
        box.add(g);
        let y = 10;
        for (const [k, v] of tips) {
          const kt = T(S, 12, y, k, { size: 15, bold: true, color: C.gold, ox: 0, oy: 0 });
          const vt = T(S, 12, y + 19, v, { size: 14, color: C.parch, ox: 0, oy: 0, wrap: W - 24, lineSpacing: 1 });
          box.add([kt, vt]); y += 19 + vt.height + 8;
        }
        const H = y + 2;
        g.fillStyle(0x0b0f0d, 0.96); g.fillRoundedRect(0, 0, W, H, 10);
        g.lineStyle(1.5, C.gold, 0.8); g.strokeRoundedRect(0, 0, W, H, 10);
        let bx = Phaser.Math.Clamp(rect.x + rect.w / 2 - W / 2, 8, 1280 - W - 8);
        let by = rect.y + rect.h + 8;
        if (by + H > 712) by = rect.y - H - 8;                 // encima si no cabe debajo
        if (by < 8) { by = Phaser.Math.Clamp(rect.y, 8, 712 - H); bx = rect.x + rect.w + 10 + W < 1272 ? rect.x + rect.w + 10 : rect.x - W - 10; }
        box.setPosition(bx, by).setVisible(true);
      },
      hide() { if (timer) { timer.remove(); timer = null; } box.setVisible(false); },
      get visible() { return box.visible; }
    };
    return api;
  }

  /* =================================================================
   * Barra de vida
   * ================================================================= */
  function hpBar(scene, x, y, w, h, color = C.blood) {
    const c = scene.add.container(x, y);
    const bg = scene.add.graphics();
    bg.fillStyle(0x0a0d0c, 1); bg.fillRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, h / 2 + 2);
    const ghost = scene.add.rectangle(-w / 2, 0, w, h, 0xffffff, 0.55).setOrigin(0, 0.5);
    const fill = scene.add.rectangle(-w / 2, 0, w, h, color, 1).setOrigin(0, 0.5);
    const blockFill = scene.add.rectangle(-w / 2, 0, w, h, C.frost, 0).setOrigin(0, 0.5);
    const txt = T(scene, 0, 0, '', { size: Math.max(13, h - 2), bold: true, stroke: 0x000000, strokeThickness: 3 });
    c.add([bg, ghost, fill, blockFill, txt]);
    let shownHp = null, counter = null;
    c.set = (hp, max, block = 0, animate = true) => {
      const r = Phaser.Math.Clamp(hp / max, 0, 1);
      // El número cuenta hasta el valor nuevo (no salta)
      if (counter) { counter.stop(); counter = null; }
      if (animate && shownHp !== null && shownHp !== hp) {
        const from = shownHp;
        counter = scene.tweens.addCounter({ from, to: hp, duration: Math.min(450, 160 + Math.abs(hp - from) * 12), ease: 'Quad.out',
          onUpdate: (tw) => txt.setText(`${Math.round(tw.getValue())} / ${max}`), onComplete: () => { txt.setText(`${hp} / ${max}`); counter = null; } });
      } else txt.setText(`${hp} / ${max}`);
      shownHp = hp;
      blockFill.setFillStyle(C.frost, block > 0 ? 0.35 : 0);
      blockFill.width = block > 0 ? w : 0;
      // «Daño reciente»: el rojo cae al instante y el tramo perdido queda en blanco; después el
      // blanco se encoge hasta alcanzar al rojo. Al curar, el blanco salta y el rojo crece.
      const nw = w * r;
      if (animate && nw < fill.width - 0.5) {
        scene.tweens.killTweensOf(ghost); scene.tweens.killTweensOf(fill);
        if (ghost.width < fill.width) ghost.width = fill.width;
        fill.width = nw;
        ghost.setFillStyle(0xffffff, 0.9);
        scene.tweens.add({ targets: ghost, width: nw, duration: 480, delay: 400, ease: 'Quad.inOut',   // el tramo perdido baja 400 ms después
          onComplete: () => ghost.setFillStyle(0xffffff, 0.55) });
      } else if (animate) {
        scene.tweens.killTweensOf(fill);
        ghost.width = Math.max(ghost.width, nw);
        scene.tweens.add({ targets: fill, width: nw, duration: 260, ease: 'Quad.out', onComplete: () => { ghost.width = nw; } });
      } else { scene.tweens.killTweensOf(fill); scene.tweens.killTweensOf(ghost); fill.width = nw; ghost.width = nw; }
    };
    return c;
  }

  /** Texto flotante (daño, curación, estados). */
  function floatText(scene, x, y, str, color, size = 34) {
    const t = Pool.text(scene, x, y, str, { size, font: 'display', color, stroke: 0x000000, strokeThickness: 5 }).setDepth(LAYER.fx + 1000);
    t.setScale(0.6);
    scene.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.out' });
    scene.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 900, delay: 300, ease: 'Quad.in', onComplete: () => t.destroy() });
    return t;
  }

  /**
   * Número de daño que salta en arco y cae. kind: 'hit' (rojo), 'crit' (20+: dorado y grande),
   * 'burn' (naranja), 'ice' (azul), 'block' (gris «Bloq. N»), 'heal' (verde). dir: hacia dónde cae (±1).
   */
  const NUM_STYLE = { hit: C.blood, crit: 0xffd27a, burn: C.ember, ice: 0x9fdcff, block: 0xa9a9a2, heal: C.leaf, self: C.ember };
  function popNumber(scene, x, y, amount, kind = 'hit', dir = 1, label) {
    if (kind === 'hit' && amount >= 20) kind = 'crit';
    const str = label || (kind === 'block' ? _t('u.bloq_0', { 0: amount }) : kind === 'heal' ? `+${amount}` : `−${amount}`);
    // Mínimo 34 px; crece con el daño. Relleno crema con borde oscuro grueso y sombra; el color del tipo va como brillo exterior,
    // para que se lea igual sobre los fondos claros y sobre los morados del Acto III.
    const size = kind === 'block' ? 24 : Math.round(Math.max(34, Math.min(80, 34 + amount * 1.4)) * (kind === 'crit' ? 1.2 : 1));
    const tint = NUM_STYLE[kind] || C.blood;
    const t = Pool.text(scene, x, y, str, { size, font: 'display', color: kind === 'crit' ? 0xfff0c8 : 0xfff8ec, stroke: 0x1a0c12, strokeThickness: 6 }).setDepth(LAYER.fx + 1000);
    t.setShadow(2, 4, 'rgba(0,0,0,0.85)', 5, true, true);
    if (t.postFX) { t.postFX.setPadding(14); t.postFX.addGlow(tint, kind === 'crit' ? 5 : 3.5, 0, false, 0.1, 12); }
    else t.setShadow(0, 0, hex(tint), 10, true, false);   // sin WebGL: el color del tipo como halo del borde
    const dx = dir * (36 + Math.random() * 44), up = 40 + Math.min(amount, 30) * 0.8;
    // «Pop»: sale grande (×1,5) y se asienta; los golpes de 30+ llevan además un destello dorado detrás
    t.setScale(1.5);
    scene.tweens.add({ targets: t, scale: kind === 'crit' ? 1.15 : 1, duration: 200, ease: 'Back.out' });
    if (amount >= 30 && kind !== 'block' && kind !== 'heal' && Live.room(1)) {
      const g = Pool.image(scene, x, y, scene.textures.exists('fx') ? 'fx' : 'dot', scene.textures.exists('fx') ? 'halo' : undefined)
        .setTint(0xffd27a).setBlendMode(Phaser.BlendModes.ADD).setDepth(LAYER.fx + 999).setScale(0.2).setAlpha(0.9);
      scene.tweens.add({ targets: g, scale: 0.75, alpha: 0, duration: 520, ease: 'Quad.out', onComplete: () => g.destroy() });
    }
    scene.tweens.add({ targets: t, x: x + dx, duration: 900, ease: 'Linear' });
    scene.tweens.add({ targets: t, y: y - up, duration: 300, ease: 'Quad.out', onComplete: () =>
      scene.tweens.add({ targets: t, y: y + 50, alpha: 0, duration: 600, ease: 'Quad.in', onComplete: () => t.destroy() }) });
    return t;
  }

  /** Estallido de partículas simple (sin config de emisor para máxima compatibilidad). */
  /** Presupuesto de partículas vivas (todas las escenas): por encima de ~150 los efectos se recortan. */
  const Live = {
    n: 0, max: 150,
    room: (want) => Math.max(0, Math.min(want, Live.max - Live.n)),
    track(obj) { Live.n++; obj.once('destroy', () => { Live.n--; }); return obj; }
  };
  /**
   * Vibración del mando (gamepad.vibrationActuator, «dual-rumble»). strength 0..1, ms. Opción «Vibración» en Ajustes.
   * Si el navegador o el mando no la soportan, no pasa nada.
   */
  function vibrate(strength = 0.5, ms = 120) {
    if (!Opts.vibration) return false;
    try {
      const nav = root.navigator;
      if (!nav || !nav.getGamepads) return false;
      let any = false;
      for (const pad of nav.getGamepads() || []) {
        const act = pad && pad.vibrationActuator;
        if (!act || !act.playEffect) continue;
        const k = Math.max(0, Math.min(1, strength));
        const r = act.playEffect('dual-rumble', { startDelay: 0, duration: Math.round(ms), weakMagnitude: k * 0.7, strongMagnitude: k });
        if (r && r.catch) r.catch(() => {});
        any = true;
      }
      return any;
    } catch (e) { return false; }
  }

  /**
   * Pools (pase de «game feel»): partículas y números se reutilizan en vez de crearse y destruirse en cada golpe.
   * Pool.image / Pool.text devuelven un objeto listo (visible, activo, sin tinte, escala 1…). Quien lo usa sigue
   * llamando a .destroy() al acabar su tween: en un objeto del pool eso lo DEVUELVE al pool (solo se destruye de
   * verdad al cerrar la escena). Cuenta en Live mientras está en uso.
   */
  const Pool = {
    MAX: 260,   // por escena y tipo: por encima, se crean sueltos (no debería pasar con el tope de Live)
    list(scene, kind) {
      const k = '_pool_' + kind;
      if (!scene[k]) { scene[k] = []; scene.events.once('shutdown', () => { scene[k] = null; }); }
      return scene[k];
    },
    adopt(scene, kind, o) {
      const arr = Pool.list(scene, kind);
      if (arr.length >= Pool.MAX) return o;
      o._pooled = true; arr.push(o);
      const orig = o.destroy;
      o.destroy = function (fromScene) {   // destroy(true) = la escena se cierra: entonces sí se destruye
        if (fromScene || !this.scene || !this._pooled) { if (this._live) { Live.n--; this._live = false; } return orig.call(this, fromScene); }
        Pool.release(this);
        return this;
      };
      return o;
    },
    take(o) {
      o.setActive(true).setVisible(true).setAlpha(1).setScale(1).setAngle(0).setOrigin(0.5).setScrollFactor(1).setBlendMode(Phaser.BlendModes.NORMAL);
      if (o.clearTint) o.clearTint();
      if (o.setFlip) o.setFlip(false, false);
      if (!o._live) { Live.n++; o._live = true; }
      return o;
    },
    release(o) {
      if (!o.scene) return;
      o.scene.tweens.killTweensOf(o);
      if (o.parentContainer) o.parentContainer.remove(o);
      o.setActive(false).setVisible(false);
      if (o._live) { Live.n--; o._live = false; }
    },
    image(scene, x, y, key, frame) {
      const arr = Pool.list(scene, 'img');
      let o = arr.find((q) => !q.active && q.scene);
      if (o) { Pool.take(o); o.setTexture(key, frame); o.setPosition(x, y); if (o.parentContainer) o.parentContainer.remove(o); if (!o.displayList) scene.add.existing(o); return o; }
      o = scene.add.image(x, y, key, frame);
      Pool.adopt(scene, 'img', o); Pool.take(o);
      return o;
    },
    text(scene, x, y, str, opt) {
      const arr = Pool.list(scene, 'txt');
      let o = arr.find((q) => !q.active && q.scene);
      if (!o) { o = T(scene, x, y, str, opt); Pool.adopt(scene, 'txt', o); Pool.take(o); return o; }
      Pool.take(o);
      if (str && typeof str === 'object' && !Array.isArray(str)) str = _t(str);
      o.setPosition(x, y).setText(str).setFontStyle(opt.bold ? 'bold' : 'normal').setFontFamily(opt.font === 'display' ? F.display : F.body).setFontSize(opt.size || 18)
        .setColor(hex(opt.color !== undefined ? opt.color : C.parch)).setStroke(hex(opt.stroke !== undefined ? opt.stroke : 0x000000), opt.strokeThickness || 0)
        .setShadow(0, 0, '#000', 0, false, false);   // el texto reciclado no hereda la sombra ni el brillo de un número anterior
      if (o.postFX) { o.postFX.clear(); o.postFX.setPadding(0); }
      return o;
    }
  };
  function burst(scene, x, y, color, n = 14, spread = 60) {
    n = Live.room(Opts.reduceMotion ? Math.ceil(n / 2) : n);   // «Reducir movimiento»: la mitad de partículas
    for (let i = 0; i < n; i++) {
      const p = Pool.image(scene, x, y, 'dot').setTint(color).setScale(0.3 + Math.random() * 0.5).setDepth(LAYER.fx + 500).setBlendMode(Phaser.BlendModes.ADD);
      const a = Math.random() * Math.PI * 2, r = spread * (0.4 + Math.random() * 0.8);
      scene.tweens.add({ targets: p, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r - 20, alpha: 0, scale: 0.05,
        duration: 450 + Math.random() * 350, ease: 'Quad.out', onComplete: () => p.destroy() });
    }
  }

  /* =================================================================
   * Fx: partículas del atlas 'fx' (Kenney Particle Pack, blancas para teñir).
   * Si el atlas no se cargó, cada efecto cae en el estallido procedural (burst).
   * ================================================================= */
  const Fx = {
    ok: (scene) => scene.textures.exists('fx'),
    /** Una partícula: frame del atlas, teñida y en modo aditivo. */
    p(scene, frame, x, y, tint, scale = 0.5, depth = LAYER.fx + 550) {
      return Pool.image(scene, x, y, 'fx', frame).setTint(tint).setScale(scale).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);   // del pool
    },
    /** Proyectil (bola de fuego) de (x,y) a (tx,ty) con estela de humo. Devuelve una promesa. */
    cast(scene, x, y, tx, ty, color = C.flame, dur = 260) {
      if (!Fx.ok(scene)) return Promise.resolve();
      const ball = Fx.p(scene, 'fireball', x, y, color, 0.55).setRotation(Math.atan2(ty - y, tx - x));
      return new Promise((res) => scene.tweens.add({ targets: ball, x: tx, y: ty, duration: dur, ease: 'Quad.in',
        onUpdate: () => { if (Math.random() < 0.6) { const sm = Fx.p(scene, Math.random() < 0.5 ? 'smoke_a' : 'smoke_b', ball.x, ball.y, color, 0.25, 2540).setAlpha(0.5); scene.tweens.add({ targets: sm, alpha: 0, scale: 0.05, duration: 300, onComplete: () => sm.destroy() }); } },
        onComplete: () => { ball.destroy(); res(); } }));
    },
    /** Impacto: destello + chispas. big: golpe fuerte. */
    hit(scene, x, y, color = C.flame, big = false) {
      if (!Fx.ok(scene)) { burst(scene, x, y, color, big ? 22 : 12, big ? 110 : 70); return; }
      const im = Fx.p(scene, 'impact', x, y, color, big ? 0.9 : 0.6);
      scene.tweens.add({ targets: im, scale: im.scale * 1.5, alpha: 0, duration: 260, ease: 'Quad.out', onComplete: () => im.destroy() });
      for (let i = 0; i < (big ? 12 : 7); i++) {
        const a = Math.random() * Math.PI * 2, r = (big ? 110 : 70) * (0.5 + Math.random() * 0.6);
        const sp = Fx.p(scene, 'spark', x, y, i % 2 ? color : 0xffffff, 0.15 + Math.random() * 0.15).setRotation(a);
        scene.tweens.add({ targets: sp, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, alpha: 0, scale: 0.02, duration: 380 + Math.random() * 220, ease: 'Quad.out', onComplete: () => sp.destroy() });
      }
    },
    /** Llamas que suben (Quemadura). */
    burn(scene, x, y, color = C.ember) {
      if (!Fx.ok(scene)) { burst(scene, x, y, color, 14, 70); return; }
      for (let i = 0; i < 8; i++) {
        const fl = Fx.p(scene, i % 2 ? 'flame_a' : 'flame_b', x + (Math.random() - 0.5) * 90, y + 30 + Math.random() * 30, i % 3 ? color : C.flame, 0.25 + Math.random() * 0.2);
        scene.tweens.add({ targets: fl, y: fl.y - 70 - Math.random() * 50, alpha: 0, scale: 0.05, delay: i * 30, duration: 520 + Math.random() * 200, ease: 'Sine.out', onComplete: () => fl.destroy() });
      }
    },
    /** Remolino protector (Bloqueo). */
    block(scene, x, y, color = C.frost) {
      if (!Fx.ok(scene)) { burst(scene, x, y, color, 10, 50); return; }
      const sw = Fx.p(scene, 'swirl', x, y, color, 0.2).setAlpha(0.9);
      scene.tweens.add({ targets: sw, scale: 0.75, angle: 180, alpha: 0, duration: 420, ease: 'Quad.out', onComplete: () => sw.destroy() });
    },
    /** Cristales y destellos (Congelado). */
    freeze(scene, x, y) {
      if (!Fx.ok(scene)) { burst(scene, x, y, 0xcfeaff, 18, 120); return; }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, cr = Fx.p(scene, 'crystal', x, y, 0xcfeaff, 0.18).setRotation(a);
        scene.tweens.add({ targets: cr, x: x + Math.cos(a) * 120, y: y + Math.sin(a) * 120, alpha: 0, scale: 0.4, duration: 520, ease: 'Quad.out', onComplete: () => cr.destroy() });
      }
      for (let i = 0; i < 6; i++) {
        const tw = Fx.p(scene, 'twinkle', x + (Math.random() - 0.5) * 160, y + (Math.random() - 0.5) * 160, 0xffffff, 0.12);
        scene.tweens.add({ targets: tw, scale: 0.35, alpha: 0, delay: i * 60, duration: 420, yoyo: false, onComplete: () => tw.destroy() });
      }
    },
    /** Rayo quebrado de (x, y) a (tx, ty): trazo en zigzag que parpadea, chispa de 'bolt' en el impacto y chispas. */
    zap(scene, x, y, tx, ty, color = 0x7fd6ff, opts = {}) {
      const g = Live.track(scene.add.graphics().setDepth(LAYER.fx + 560).setBlendMode(Phaser.BlendModes.ADD));
      const segs = Math.max(4, Math.round(Math.hypot(tx - x, ty - y) / 38)), nx = -(ty - y), ny = tx - x, len = Math.max(1, Math.hypot(nx, ny));
      const draw = () => {
        g.clear();
        const pts = [{ x, y }];
        for (let i = 1; i < segs; i++) { const k = i / segs, j = (Math.random() - 0.5) * (opts.wild || 34); pts.push({ x: x + (tx - x) * k + nx / len * j, y: y + (ty - y) * k + ny / len * j }); }
        pts.push({ x: tx, y: ty });
        g.lineStyle(opts.width || 7, color, 0.45); g.strokePoints(pts);
        g.lineStyle(Math.max(2, (opts.width || 7) / 2.6), 0xeaf8ff, 1); g.strokePoints(pts);
      };
      draw();
      const ev = scene.time.addEvent({ delay: 45, repeat: 3, callback: draw });
      scene.tweens.add({ targets: g, alpha: 0, delay: 120, duration: 200, onComplete: () => { ev.remove(); g.destroy(); } });
      if (Fx.ok(scene)) {
        const b = Fx.p(scene, 'bolt', tx, ty, color, 0.5).setRotation(Math.atan2(ty - y, tx - x) + Math.PI / 2);
        scene.tweens.add({ targets: b, alpha: 0, scale: 0.8, duration: 260, onComplete: () => b.destroy() });
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 40;
          const sp = Fx.p(scene, 'spark', tx, ty, i % 2 ? color : 0xffffff, 0.12 + Math.random() * 0.1).setRotation(a);
          scene.tweens.add({ targets: sp, x: tx + Math.cos(a) * r, y: ty + Math.sin(a) * r, alpha: 0, duration: 300 + Math.random() * 160, ease: 'Quad.out', onComplete: () => sp.destroy() });
        }
      } else burst(scene, tx, ty, color, 10, 60);
    },
    /** Ascuas que suben (muerte del enemigo). b: rectángulo del sprite. */
    death(scene, b, n = 46, col = null, col2 = null) {   // col: color dominante del enemigo (se desintegra en su color)
      n = Live.room(Opts.reduceMotion ? Math.ceil(n / 2) : n);
      const a = col || C.ember, a2 = col2 || C.flame;
      for (let i = 0; i < n; i++) {
        scene.time.delayedCall(i * 14, () => {
          const x = b.x + Math.random() * b.width, y = b.y + b.height * (0.25 + Math.random() * 0.75);
          const e = Fx.ok(scene) ? Fx.p(scene, i % 4 ? 'ember' : 'spark', x, y, i % 3 ? a : a2, 0.12 + Math.random() * 0.14, 2500)
            : Pool.image(scene, x, y, 'dot').setTint(i % 3 ? a : a2).setScale(0.5 + Math.random() * 0.7).setDepth(LAYER.fx + 500).setBlendMode(Phaser.BlendModes.ADD);
          scene.tweens.add({ targets: e, y: y - 120 - Math.random() * 140, x: x + (Math.random() - 0.5) * 60, alpha: 0, scale: e.scale * 0.2,
            duration: 700 + Math.random() * 500, ease: 'Quad.out', onComplete: () => e.destroy() });
        });
      }
    }
  };

  /** Banner central (turnos, fases). */
  function banner(scene, str, color = C.gold, dur = 700) {
    const bg = scene.add.rectangle(640, 360, 1280, 110, 0x000000, 0.55).setDepth(LAYER.fx + 1800).setAlpha(0);
    const t = T(scene, 640, 360, str, { size: 64, font: 'display', color, stroke: 0x000000, strokeThickness: 6 }).setDepth(LAYER.fx + 1801).setAlpha(0);
    scene.tweens.add({ targets: [bg, t], alpha: 1, duration: 160 });
    scene.tweens.add({ targets: t, scale: { from: 0.85, to: 1 }, duration: 240, ease: 'Back.out' });
    scene.time.delayedCall(dur, () => scene.tweens.add({ targets: [bg, t], alpha: 0, duration: 220, onComplete: () => { bg.destroy(); t.destroy(); } }));
  }

  /** Aviso breve en pantalla. */
  function toast(scene, str, color = C.parch) {
    Overlay.toastQ.push(() => {
      const S = Overlay.S(scene);
      const t = T(S, 640, 470, str, { size: 22, bold: true, color, stroke: 0x000000, strokeThickness: 4 }).setDepth(LAYER.toast);
      S.tweens.add({ targets: t, y: 440, alpha: { from: 1, to: 0 }, duration: 1300, delay: 300, onComplete: () => t.destroy() });
    });
    Overlay.pumpToasts();   // no sale mientras haya un consejo abierto
  }

  /* =================================================================
   * Parche 3.6: avisos de misión, cosméticos (marco, dorso, aura) y confeti
   * ================================================================= */
  /** Aviso de misión cumplida (arriba a la derecha, sin interrumpir): entra deslizándose y se va solo. */
  let questToastN = 0;
  function questToast(scene, title, line, color = 0x8fe0a0) {
    Overlay.toastQ.push(() => {
      const S = Overlay.S(scene), k = questToastN++;
      const W = 380, y = 108 + (k % 3) * 74;
      const c = S.add.container(1280 + W / 2 + 10, y).setDepth(LAYER.toast);
      const g = S.add.graphics();
      g.fillStyle(0x0f1a12, 0.95); g.fillRoundedRect(-W / 2, -32, W, 64, 10);
      g.lineStyle(2, color, 0.95); g.strokeRoundedRect(-W / 2, -32, W, 64, 10);
      const ic = S.add.image(-W / 2 + 30, 0, 'ic_contract').setIconScale(0.44);
      const t1 = fitText(T(S, -W / 2 + 58, -13, title, { size: 16, bold: true, color, ox: 0 }), W - 72, 0, 11);
      const t2 = fitText(T(S, -W / 2 + 58, 12, line, { size: 14, color: C.parch, ox: 0 }), W - 72, 0, 9);
      c.add([g, ic, t1, t2]);
      S.tweens.add({ targets: c, x: 1280 - W / 2 - 12, duration: 280, ease: 'Back.out' });
      S.time.delayedCall(3000, () => S.tweens.add({ targets: c, x: 1280 + W / 2 + 10, alpha: 0, duration: 260,
        onComplete: () => { c.destroy(); questToastN = Math.max(0, questToastN - 1); } }));
    });
    Overlay.pumpToasts();
  }
  /** Cosméticos de la partida en curso (los pone go() con run.look): el marco lo pinta cardView. */
  const Look = {
    frame: null, back: null, aura: null, char: null,
    set(look, ch) { const l = look || {}; Look.frame = l.frame || null; Look.back = l.back || null; Look.aura = l.aura || null; Look.char = ch || null; }
  };
  /** Color de un cosmético (los «del personaje» usan su color). */
  function lookColor(slot, id, ch) {
    const def = E.D.COSMETICS[slot] && E.D.COSMETICS[slot][id];
    if (!def) return null;
    if (id === 'hero') return (E.D.CHARACTERS[ch] || {}).color || C.gold;
    return def.color || C.gold;
  }
  /** Textura del dorso de carta según el cosmético (se genera la primera vez). */
  function cardBackKey(scene, back = Look.back, ch = Look.char) {
    if (!back || back === 'none') return 'cardback';
    const col = lookColor('back', back, ch);
    if (col === null) return 'cardback';
    const key = `cardback_${back}_${ch || 'x'}`;
    if (scene.textures.exists(key)) return key;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    const dark = Phaser.Display.Color.IntegerToColor(col).darken(62).color;
    g.fillStyle(dark, 1); g.fillRoundedRect(0, 0, 72, 100, 8);
    g.lineStyle(3, col, 1); g.strokeRoundedRect(3, 3, 66, 94, 6);
    g.lineStyle(1, col, 0.5); g.strokeRoundedRect(9, 9, 54, 82, 4);
    star(g, 36, 50, 18, 6, back === 'scroll' ? 6 : 4, col);
    root.CM_HIRES.genTex(g, key, 72, 100);
    g.destroy();
    return key;
  }
  /* =================================================================
   * HUD superior común
   * ================================================================= */
  /** Texto del tooltip de un contrato: qué pide, cómo vas y qué da. */
  function contractTipText(run, ks) {
    const st = ks.state === 'done' ? _t('ct.done') : ks.state === 'failed' ? _t('ct.failed') : _t('ct.active');
    const prog = ks.state === 'active' && ks.cur !== null && ks.goal ? '\n' + _t('ct.prog', { a: ks.cur, b: ks.goal }) : '';
    return `${ks.def.text}${prog}\n${st}\n${contractRewardText(ks.def)}`;
  }
  /** «Recompensa: …» de un contrato. */
  function contractRewardText(d) {
    return d.reward === 'relic' ? _t('ct.rw.relic') : d.reward === 'card' ? _t('ct.rw.card') : _t('ct.rw.essence', { n: d.ess || E.D.CONTRACT_ESSENCE });
  }
  function hud(scene, run, opts = {}) {
    const tip = opts.tip || tooltip(scene);
    const c = scene.add.container(0, 0).setDepth(LAYER.hud).setScrollFactor(0);
    const bg = scene.add.graphics();
    bg.fillStyle(0x080b0a, 0.88); bg.fillRect(0, 0, 1280, 50);
    bg.lineStyle(1, C.gold, 0.35); bg.lineBetween(0, 50, 1280, 50);
    c.add(bg);

    const heart = scene.add.image(26, 25, 'ic_heart').setIconScale(0.42);
    const hpT = T(scene, 46, 25, '', { size: 20, bold: true, ox: 0 });
    const coin = scene.add.image(150, 25, 'ic_coin').setIconScale(0.4);
    const goldT = T(scene, 168, 25, '', { size: 20, bold: true, ox: 0, color: C.gold });
    const floorT = T(scene, 250, 25, '', { size: 15, ox: 0, color: C.muted });
    c.add([heart, hpT, coin, goldT, floorT]);
    const relicLayer = scene.add.container(0, 0);
    const potionLayer = scene.add.container(0, 0);
    c.add([relicLayer, potionLayer]);
    const POT_X0 = 532, POT_DX = 32;   // huecos de poción entre el piso y las reliquias
    let flasks = [];                   // frascos con líquido animado (se repintan cada fotograma)
    const onUpdate = (time) => { for (const f of flasks) { f.g.clear(); drawFlask(f.g, f.d.shape, f.d.color, { t: time / 1000 + f.phase, scale: 0.8 }); } };
    scene.events.on('update', onUpdate);
    scene.events.once('shutdown', () => { scene.events.off('update', onUpdate); flasks = []; });

    const deckBtn = button(scene, 1004, 25, _t('u.mazo'), () => scene.scene.launch('DeckView', { mode: 'view', title: _t('u.tu_mazo'), from: scene.scene.key }), { w: 124, h: 36, size: 18, variant: 'ghost' });
    const gearBtn = gearButton(scene, 1150, 25, 44, 36);
    deckBtn.hudBar = gearBtn.hudBar = true;   // barra superior del HUD: 36 px (fase 2 del sistema visual)   // panel ⚙ de volumen (Música / Efectos)
    deckBtn.noMain = true;
    const menuBtn = button(scene, 1232, 25, _t('u.menu'), () => { saveRun(run); scene.scene.stop('DeckView'); scene.scene.start('Title'); }, { w: 76, h: 36, size: 17, variant: 'ghost' });
    menuBtn.noMain = true; menuBtn.hudBar = true;
    c.add([deckBtn, gearBtn, menuBtn]);

    let relicXs = [], goldCount = null, hpCount = null, shownHp = null, shownGold = null;
    /* Contrato (Parche 3.5): sello con su estado (dorado en curso, verde cumplido, gris fallido) y el progreso debajo; tooltip con el detalle. */
    const ctLayer = scene.add.container(0, 0); c.add(ctLayer);
    const CT_X = POT_X0 - 38;
    function contractBadge(ks) {
      ctLayer.removeAll(true);
      if (!ks) return;
      const col = ks.state === 'done' ? C.leaf : ks.state === 'failed' ? C.line : C.gold;
      const ring = scene.add.circle(CT_X, 22, 15, 0x1d2a24).setStrokeStyle(2, col, 0.9);
      const ic = scene.add.image(CT_X, 22, 'ic_contract').setIconScale(0.36);
      if (ks.state === 'failed') { ic.setAlpha(0.35); ic.setTint(0x888888); }
      const mark = ks.state === 'done' ? '✓' : ks.state === 'failed' ? '✗' : ks.cur !== null && ks.goal ? `${ks.cur}/${ks.goal}` : '';
      ctLayer.add([ring, ic]);
      if (mark) ctLayer.add(T(scene, CT_X, 43, mark, { size: 11, bold: true, color: col }));
      ring.setInteractive({ useHandCursor: true });
      ring.contractBadge = true;
      ring.on('pointerover', () => tip.show(CT_X - 20, 56, _t('ct.tipTitle', { n: ks.def.name }), contractTipText(run, ks)));
      ring.on('pointerout', () => tip.hide());
    }
    const api = {
      tip,
      /** Dónde está cada cosa de la barra (para que las recompensas vuelen hasta ella). */
      goldPos: { x: 150, y: 25 },
      relicPos: (i) => ({ x: relicXs[i] !== undefined ? relicXs[i] : (relicXs.length ? relicXs[relicXs.length - 1] + 36 : 600), y: 25 }),
      potionPos: (slot) => ({ x: POT_X0 + slot * POT_DX, y: 25 }),
      /** El contador de oro sube (o baja) número a número de `from` a `to`. */
      countGold(from, to, dur = 700) {
        if (goldCount) goldCount.stop();
        shownGold = to;
        goldT.setText(String(from));
        goldCount = scene.tweens.addCounter({ from, to, duration: dur, ease: 'Linear',
          onUpdate: (t) => goldT.setText(String(Math.round(t.getValue()))),
          onComplete: () => { goldT.setText(String(to)); goldCount = null; } });
        if (!Opts.reduceMotion) {   // salto del contador (cada uno desde SU escala: la moneda está a 0,4)
          scene.tweens.add({ targets: goldT, scale: { from: 1.25, to: 1 }, duration: 260, delay: dur * 0.5, ease: 'Back.out' });
          scene.tweens.add({ targets: coin, scale: { from: 0.5 * icK(coin), to: 0.4 * icK(coin) }, duration: 260, delay: dur * 0.5, ease: 'Back.out' });
        }
      },
      /** Qué hacer al pulsar «Usar» (cada escena puede sustituirlo; el combate lo hace). */
      onUsePotion: opts.onUsePotion || ((slot, x, y) => usePotionOutside(scene, run, slot, x, y, api)),
      /** Zona de la barra de pociones (para el consejo 'pocion'). */
      potionRect: () => ({ x: POT_X0 - 18, y: 4, w: (run.potions || []).length * POT_DX + 4, h: 44 }),
      refresh() {
        // PV y oro cuentan hasta el valor nuevo en vez de saltar (la primera vez, directo)
        if (hpCount) { hpCount.stop(); hpCount = null; }
        if (shownHp !== null && shownHp !== run.hp) {
          const from = shownHp, to = run.hp, mx = run.maxHp;
          hpCount = scene.tweens.addCounter({ from, to, duration: Math.min(450, 160 + Math.abs(to - from) * 12), ease: 'Quad.out',
            onUpdate: (t) => hpT.setText(`${Math.round(t.getValue())}/${mx}`), onComplete: () => { hpT.setText(`${to}/${mx}`); hpCount = null; } });
        } else hpT.setText(`${run.hp}/${run.maxHp}`);
        shownHp = run.hp;
        hpT.setColor(hex(run.hp <= run.maxHp * 0.3 ? C.blood : C.parch));
        if (!goldCount && shownGold !== null && shownGold !== run.gold) api.countGold(shownGold, run.gold, Math.min(700, 200 + Math.abs(run.gold - shownGold) * 6));
        else if (!goldCount) goldT.setText(String(run.gold));
        shownGold = run.gold;
        const node = run.pos ? run.map.nodes[run.pos] : null;
        // Piso global: el acto II continúa la numeración (10..18)
        const act = E.actOf(run), actName = E.D.ACTS[act].name;
        floorT.setText(node ? _t('u.0_piso_1_de_2', { 0: actName, 1: (act - 1) * E.FLOORS_PER_ACT + node.row + 1, 2: E.TOTAL_FLOORS }) : _t('u.0_entrada', { 0: actName }));
        const ks = E.contractStatus(run);
        fitText(floorT, POT_X0 - 270 - (ks ? 40 : 0), 0, 11);
        contractBadge(ks);
        deckBtn.setLabel(_t('u.mazo_0', { 0: run.deck.length }));
        // Pociones: un hueco por posición del cinturón (vacíos = contorno tenue)
        potionLayer.removeAll(true); flasks = [];
        const pots = run.potions || [];
        pots.forEach((id, slot) => {
          const x = POT_X0 + slot * POT_DX, d = id && E.D.POTIONS[id];
          if (!d) { potionLayer.add(scene.add.circle(x, 25, 13).setStrokeStyle(1.5, C.line, 0.45)); return; }
          if (d.rarity === 'rare') {   // brillo dorado sutil
            const glow = scene.add.circle(x, 25, 16, C.gold, 0.18);
            scene.tweens.add({ targets: glow, alpha: { from: 0.08, to: 0.3 }, scale: { from: 0.9, to: 1.12 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            potionLayer.add(glow);
          }
          const g = scene.add.graphics().setPosition(x, 27);
          flasks.push({ g, d, phase: slot * 1.7 });
          const hit = scene.add.zone(x, 25, 30, 44).setInteractive({ useHandCursor: true });
          hit.on('pointerover', () => {
            const ok = E.canUsePotion(run, slot);
            tip.show(x - 20, 56, d.name, `${E.D.POTION_RARITY_LABEL[d.rarity]}\n${d.text}${ok.ok ? '' : _t('pot.notNow', { r: ok.reason })}`);
          });
          hit.on('pointerout', () => tip.hide());
          hit.on('pointerup', () => { tip.hide(); potionMenu(scene, run, slot, x, api); });
          hit.potSlot = slot;
          potionLayer.add([g, hit]);
        });
        onUpdate(scene.time ? scene.time.now : 0);
        relicLayer.removeAll(true);
        const rx0 = POT_X0 + pots.length * POT_DX + 14, rdx = run.relics.length > 1 ? Math.min(36, (930 - rx0) / (run.relics.length - 1)) : 36;
        relicXs = run.relics.map((_, i) => rx0 + i * rdx);
        run.relics.forEach((id, i) => {
          const r = E.D.ALL_RELICS[id];   // incluye las reliquias de jefe
          const x = rx0 + i * rdx;        // se aprietan si no caben antes del botón Mazo
          const spent = id === 'pluma' && run.phoenixUsed;   // reliquia de un solo uso ya gastada
          const ring = scene.add.circle(x, 25, 16, 0x1d2a24).setStrokeStyle(2, spent ? C.line : C.gold, 0.8);
          const ic = scene.add.image(x, 25, 'ic_' + r.icon).setIconScale(0.38);
          if (spent) { ic.setAlpha(0.3); ic.setTint(0x777777); }
          ring.setInteractive({ useHandCursor: true });
          let shine = null;
          ring.on('pointerover', () => { tip.show(x - 20, 56, r.name + (spent ? _t('u.usada') : ''), r.text); if (ic.preFX && !shine && !Opts.reduceMotion && scene.sys.game.renderer.type === Phaser.WEBGL) shine = ic.preFX.addShine(1, 0.4, 4); });
          ring.on('pointerout', () => { tip.hide(); if (shine) { ic.preFX.remove(shine); shine = null; } });
          relicLayer.add([ring, ic]);
        });
      }
    };
    api.refresh();
    return api;
  }

  /* =================================================================
   * Pociones: frascos dibujados con Graphics, menú Usar/Tirar y efectos
   * ================================================================= */
  /** Perfil del cuerpo de cada frasco: mitad de anchura, borde superior/inferior por x, cuello y corcho. */
  const FLASK_SHAPES = {
    redondo:  { hw: 11, body: (x) => { const r = 11, dy = Math.sqrt(Math.max(0, r * r - x * x)); return [5 - dy, 5 + dy]; }, neck: [-3, -13, 6, 9], cork: [-4, -17, 8, 5] },
    vial:     { hw: 6, body: (x) => { const b = 14 - (6 - Math.sqrt(Math.max(0, 36 - x * x))); return [-9, b]; }, neck: [-3, -13, 6, 5], cork: [-4, -17, 8, 5] },
    cuadrado: { hw: 10, body: () => [-6, 14], neck: [-3, -12, 6, 7], cork: [-4.5, -16, 9, 5] }
  };
  /**
   * Dibuja un frasco en `g` (centrado en 0,0): cristal con brillo, líquido de su color con
   * la superficie ondulando (opts.t en segundos) y corcho. opts.scale escala todo.
   */
  function drawFlask(g, shape, color, opts = {}) {
    const S = FLASK_SHAPES[shape] || FLASK_SHAPES.redondo, k = opts.scale || 1, t = opts.t || 0;
    const P = (x, y) => V(x * k, y * k);
    const outline = [];
    for (let x = -S.hw; x <= S.hw; x += 1) outline.push(P(x, S.body(x)[1]));
    for (let x = S.hw; x >= -S.hw; x -= 1) outline.push(P(x, S.body(x)[0]));
    // Cristal (relleno muy suave)
    g.fillStyle(0xdff1ff, 0.12); g.fillPoints(outline, true);
    // Líquido: columnas desde la superficie ondulante hasta el fondo
    const [top0, bot0] = S.body(0), level = top0 + (bot0 - top0) * 0.32;
    g.fillStyle(color, 0.95);
    for (let x = -S.hw + 1; x <= S.hw - 1; x += 1) {
      const [top, bot] = S.body(x);
      const y0 = Math.max(top + 1, level + Math.sin(t * 2.2 + x * 0.45) * 1.1);
      if (bot - 1 > y0) g.fillRect((x - 0.5) * k, y0 * k, 1.05 * k, (bot - 1 - y0) * k);
    }
    // Línea de superficie más clara
    g.lineStyle(1 * k, 0xffffff, 0.35);
    g.beginPath();
    for (let x = -S.hw + 2; x <= S.hw - 2; x += 1) {
      const y = level + Math.sin(t * 2.2 + x * 0.45) * 1.1;
      if (x === -S.hw + 2) g.moveTo(x * k, y * k); else g.lineTo(x * k, y * k);
    }
    g.strokePath();
    // Contorno y brillo del cristal
    g.lineStyle(1.5 * k, 0xe8f4ff, 0.75); g.strokePoints(outline, true);
    g.lineStyle(1.6 * k, 0xffffff, 0.55); g.lineBetween(-S.hw * 0.55 * k, (top0 + 3) * k, -S.hw * 0.55 * k, (top0 + (bot0 - top0) * 0.55) * k);
    // Cuello y corcho
    const [nx, ny, nw, nh] = S.neck, [cx, cy, cw, ch] = S.cork;
    g.fillStyle(0xdff1ff, 0.22); g.fillRect(nx * k, ny * k, nw * k, nh * k);
    g.lineStyle(1.2 * k, 0xe8f4ff, 0.7); g.strokeRect(nx * k, ny * k, nw * k, nh * k);
    g.fillStyle(0x9b6b3a, 1); g.fillRoundedRect(cx * k, cy * k, cw * k, ch * k, 1.5 * k);
    g.fillStyle(0xc4935a, 1); g.fillRect(cx * k, cy * k, cw * k, 1.5 * k);
  }

  /** Mini-menú de una poción: «Usar» (o el motivo si ahora no se puede) y «Tirar» (pide confirmar). */
  function potionMenu(scene, run, slot, x, hudApi) {
    if (scene._potionMenu) scene._potionMenu.close();
    const S = Overlay.S(scene);
    const id = run.potions[slot], d = id && E.D.POTIONS[id];
    if (!d) return;
    const can = E.canUsePotion(run, slot);
    const W = 168, H = can.ok ? 112 : 134, px = Math.min(1280 - W - 8, Math.max(8, x - W / 2)), py = 50;
    const layer = S.add.container(0, 0).setDepth(LAYER.modal).setScrollFactor(0);
    const blocker = S.add.zone(0, 0, 1280, 720).setOrigin(0, 0).setInteractive();
    const g = S.add.graphics();
    g.fillStyle(0x000000, 0.4); g.fillRoundedRect(px + 3, py + 5, W, H, 10);
    g.fillStyle(C.panel, 0.98); g.fillRoundedRect(px, py, W, H, 10);
    g.lineStyle(2, d.rarity === 'rare' ? C.gold : C.line, 1); g.strokeRoundedRect(px, py, W, H, 10);
    const nm = T(S, px + W / 2, py + 16, d.name, { size: 15, bold: true, color: C.gold });
    fitText(nm, W - 16, 0, 11);
    layer.add([blocker, g, nm]);
    Overlay.own(scene, layer); Overlay.addModal(layer);
    const close = () => { if (!scene._potionMenu) return; scene._potionMenu = null; layer.destroy(); };
    const use = button(S, px + W / 2, py + 48, _t('u.usar'), () => { close(); hudApi.onUsePotion(slot, x, 25); }, { w: W - 24, h: 32, size: 17 });
    use.setEnabled(can.ok);
    layer.add(use);
    let y = py + 86;
    if (!can.ok) {
      const why = T(S, px + W / 2, py + 76, can.reason, { size: 12, color: C.muted, style: 'italic', wrap: W - 16, align: 'center' });
      fitText(why, W - 16, 22, 10); layer.add(why); y = py + 108;
    }
    let armed = false;
    const toss = button(S, px + W / 2, y, _t('u.tirar'), () => {
      if (!armed) { armed = true; toss.setLabel(_t('u.seguro_toca_otra_vez')); return; }   // segundo toque = confirmar
      close();
      if (E.discardPotion(run, slot)) { Sfx.play('ice_shatter', { volume: 0.35 }); saveRun(run); hudApi.refresh(); }
    }, { w: W - 24, h: 28, size: 14, variant: 'ghost', font: 'body' });
    layer.add(toss);
    blocker.on('pointerup', (p) => { if (p.worldX < px || p.worldX > px + W || p.worldY < py || p.worldY > py + H) close(); });
    scene._potionMenu = { close };
    scene.events.once('shutdown', () => { scene._potionMenu = null; });
  }

  /** El frasco vuela de (x0,y0) a (x1,y1), se rompe con destellos y humo de su color. Devuelve una promesa. */
  function flyPotion(scene, id, x0, y0, x1, y1) {
    const d = E.D.POTIONS[id];
    const g = scene.add.graphics().setDepth(LAYER.hud + 200).setPosition(x0, y0);
    drawFlask(g, d.shape, d.color, { scale: 1.3 });
    Sfx.play(d.fx === 'heal' ? 'heal' : 'fire_small', { volume: 0.5 });
    return new Promise((res) => {
      scene.tweens.add({ targets: g, x: x1, y: y1, angle: 300, scale: 1.4, duration: 420, ease: 'Quad.in', onComplete: () => {
        g.destroy();
        potionBreak(scene, x1, y1, d.color);
        res();
      } });
    });
  }
  /** Frasco roto: cristales (twinkle) + humo del color de la poción. */
  function potionBreak(scene, x, y, color) {
    Sfx.play('ice_shatter', { volume: 0.45 });
    burst(scene, x, y, color, 18, 70);
    for (let i = 0; i < 7; i++) {   // destellos blancos
      const s = scene.add.image(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 50, 'dot').setTint(0xffffff).setScale(0.1).setDepth(LAYER.hud + 300).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({ targets: s, scale: { from: 0.1, to: 0.55 }, alpha: { from: 1, to: 0 }, duration: 380, delay: i * 50, yoyo: false, onComplete: () => s.destroy() });
    }
    for (let i = 0; i < 9; i++) {   // humo
      const p = scene.add.image(x + (Math.random() - 0.5) * 30, y, 'dot').setTint(i % 2 ? color : 0xbfc4c8).setAlpha(0.55).setScale(0.8).setDepth(LAYER.hud + 250);
      scene.tweens.add({ targets: p, y: y - 50 - Math.random() * 40, x: p.x + (Math.random() - 0.5) * 50, scale: 2.4 + Math.random(), alpha: 0,
        duration: 800 + Math.random() * 300, delay: i * 30, ease: 'Quad.out', onComplete: () => p.destroy() });
    }
  }
  /** Usar una poción fuera de combate (mapa, hoguera, tienda…): vuela al corazón de la vida. */
  async function usePotionOutside(scene, run, slot, x, y, hudApi) {
    const check = E.canUsePotion(run, slot);
    if (!check.ok) { toast(scene, check.reason, C.blood); Sfx.play('deny'); return; }
    const id = run.potions[slot];
    run.potions[slot] = null; hudApi.refresh(); run.potions[slot] = id;   // el hueco se vacía mientras vuela
    await flyPotion(scene, id, x, y, 60, 70);
    const ev = E.usePotion(run, slot);
    if (root.CM_CODEX && ev.some((e) => e.t === 'potion')) root.CM_CODEX.add('potions', id, 'used');   // Compendio
    const h = ev.find((e) => e.t === 'heal');
    if (h) floatText(scene, 70, 90, _t('u.0_pv', { 0: h.amount }), C.leaf, 30);
    saveRun(run); hudApi.refresh();
  }

  /* =================================================================
   * Cuadro de texto HTML sobre el juego (Phaser no tiene texto seleccionable):
   * para copiar a mano el resultado del diario o pegar uno y comprobarlo.
   * ================================================================= */
  function textBox({ title, text = '', readOnly = false, placeholder = '', actionLabel = null, onAction = null, mono = false }) {
    const doc = root.document;
    if (!doc) return null;
    const wrap = doc.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);font-family:' + TH.font.ui;
    const box = doc.createElement('div');
    box.style.cssText = 'width:min(440px,calc(100vw - 32px));background:#141d19;border:2px solid #e6c066;border-radius:14px;padding:16px;color:#f0e4c8;box-shadow:0 10px 30px rgba(0,0,0,.5)';
    const h = doc.createElement('div'); h.textContent = title; h.style.cssText = 'font-size:20px;font-weight:700;color:#e6c066;margin-bottom:10px';
    const ta = doc.createElement('textarea'); ta.value = text; ta.readOnly = readOnly; ta.placeholder = placeholder; ta.rows = 6;
    ta.style.cssText = 'width:100%;box-sizing:border-box;background:#0c100e;color:#f0e4c8;border:1px solid #556;border-radius:8px;padding:8px;font-size:16px;resize:vertical'
      + (mono ? `;font-family:${F.mono};letter-spacing:.04em;font-variant-numeric:slashed-zero;font-feature-settings:"zero" 1` : '');   // códigos: 0 tachado si la letra lo tiene
    const res = doc.createElement('div'); res.style.cssText = 'min-height:22px;margin-top:8px;font-size:17px;font-weight:700';
    const row = doc.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:8px';
    const mk = (label, fn, primary) => { const b = doc.createElement('button'); b.textContent = label; b.onclick = fn;
      b.style.cssText = `padding:8px 14px;border-radius:9px;font-size:16px;cursor:pointer;border:2px solid ${primary ? '#ff7a2f' : '#556'};background:${primary ? '#3a1c12' : '#141d19'};color:#f0e4c8`; row.appendChild(b); return b; };
    const close = () => wrap.remove();
    if (actionLabel) mk(actionLabel, () => onAction && onAction(ta.value, (msg, ok) => { res.textContent = msg; res.style.color = ok ? '#8fc46a' : '#d8434c'; }), true);
    mk(_t('u.cerrar'), close, !actionLabel);
    wrap.onclick = (e) => { if (e.target === wrap) close(); };
    box.append(h, ta, res, row); wrap.appendChild(box); doc.body.appendChild(wrap);
    setTimeout(() => { ta.focus(); if (readOnly) ta.select(); }, 30);
    return { close };
  }
  /** Copia al portapapeles; si el navegador no deja, enseña el texto en un cuadro seleccionable. */
  async function copyOrShow(scene, text, msgs = {}) {
    try {
      if (!root.navigator || !root.navigator.clipboard) throw new Error('sin portapapeles');
      await root.navigator.clipboard.writeText(text);
      toast(scene, msgs.ok || _t('u.resultado_copiado_al_portapapeles'), C.gold);
    } catch (e) {
      textBox({ title: msgs.title || _t('u.copia_tu_resultado'), text, readOnly: true, mono: !!msgs.mono });
    }
  }

  /* =================================================================
   * Panel ⚙ de volumen  /* =================================================================
   * Panel ⚙ de volumen: Música y Efectos (0..100% en pasos de 10).
   * Se pinta encima de la escena actual y bloquea los clics de debajo.
   * ================================================================= */
  function gearButton(scene, x, y, w = 44, h = 36) {
    const b = button(scene, x, y, '', () => openSettings(scene), { w, h, variant: 'ghost' });
    b.add(scene.add.image(0, 0, 'ic_gear').setIconScale(Math.min(w, h) / 64 * 0.82));
    b.noMain = true;   // el foco nunca empieza en ⚙
    return b;
  }
  /** Botón 🌐 (dibujado) que abre el menú de idiomas. */
  function langButton(scene, x, y, w = 44, h = 36) {
    const b = button(scene, x, y, '', () => openLangMenu(scene, x, y + h / 2 + 8), { w, h, variant: 'ghost' });
    b.add(scene.add.image(0, 0, 'ic_globe').setIconScale(Math.min(w, h) / 64 * 0.82));
    b.noMain = true;
    return b;
  }
  /**
   * Menú «Idioma / Language»: Español / English (✓ el actual). Al elegir otro, cambia el idioma y reinicia
   * la escena actual (la partida no se pierde: todo se lee de run y de los ids guardados).
   */
  function openLangMenu(scene, x = 640, y = 300) {
    if (scene._langMenu) return scene._langMenu;
    const S = Overlay.S(scene);
    const W = 240, H = 92 + I18N.LANGS.length * 46, px = Math.max(12, Math.min(1268 - W, x - W / 2)), py = Math.max(12, Math.min(708 - H, y));
    const layer = S.add.container(0, 0).setDepth(LAYER.modal + 20).setScrollFactor(0);
    const blocker = S.add.zone(0, 0, 1280, 720).setOrigin(0, 0).setInteractive();
    const g = S.add.graphics();
    g.fillStyle(0x000000, 0.4); g.fillRoundedRect(px + 3, py + 5, W, H, 12);
    g.fillStyle(C.panel, 0.98); g.fillRoundedRect(px, py, W, H, 12);
    g.lineStyle(2, C.gold, 0.9); g.strokeRoundedRect(px, py, W, H, 12);
    layer.add([blocker, g, fitText(T(S, px + W / 2, py + 22, _t('lang.title'), { size: 17, bold: true, color: C.gold }), W - 20, 0, 12)]);
    Overlay.own(scene, layer); Overlay.addModal(layer);
    const close = () => { if (scene._langMenu !== api) return; scene._langMenu = null; layer.destroy(); };
    const btns = I18N.LANGS.map((l, i) => {
      const cur = I18N.lang === l;
      const b = button(S, px + W / 2, py + 62 + i * 46, (cur ? '✓ ' : '') + I18N.LANG_NAMES[l], () => { close(); if (!cur) changeLang(scene, l); },
        { w: W - 32, h: 38, size: 18, variant: cur ? 'gold' : 'ghost', font: 'body' });
      layer.add(b); return b;
    });
    btns.push(button(S, px + W / 2, py + H - 22, _t('u.cerrar'), close, { w: 120, h: 30, size: 15, variant: 'ghost', font: 'body' }));
    layer.add(btns[btns.length - 1]);
    // Mando / teclado: ↑/↓ entre opciones, A elige, B cierra (marco dorado solo con mando o teclado)
    let sel = Math.max(0, I18N.LANGS.indexOf(I18N.lang));
    const ring = S.add.graphics(); layer.add(ring);
    const paint = () => { ring.clear(); if (Input.device === 'mouse') return; const b = btns[sel]; ring.lineStyle(3, C.gold, 1); ring.strokeRoundedRect(b.x - W / 2 + 10, b.y - 23, W - 20, 46, 10); };
    paint();
    blocker.on('pointerup', (p) => { if (p.worldX < px || p.worldX > px + W || p.worldY < py || p.worldY > py + H) close(); });
    const api = { close, nav(a) {
      if (a === 'up' || a === 'down') { sel = (sel + (a === 'up' ? -1 : 1) + btns.length) % btns.length; paint(); }
      else if (a === 'confirm') btns[sel].press();
      else if (a === 'back') close();
    } };
    scene._langMenu = api;
    scene.events.once('shutdown', () => { scene._langMenu = null; });
    return api;
  }
  /** Cambia el idioma y repinta: cierra ventanas y reinicia las escenas activas (la partida sigue en run). */
  function changeLang(scene, l) {
    if (!I18N.setLang(l)) return;
    const game = scene.sys.game;
    if (scene._settingsClose) scene._settingsClose();
    if (game.scene.isActive('DeckView')) game.scene.stop('DeckView');
    // Combate: sin repetir los eventos con los que se abrió; el resto, con sus mismos datos (pestaña, página…)
    const data = scene.scene.key === 'Combat' ? {} : (scene.sys.settings.data || {});
    scene.scene.restart(data);
  }
  function openSettings(scene) {
    if (scene._settingsOpen) return;
    scene._settingsOpen = true;
    const S = Overlay.S(scene);   // estado en la escena dueña (teclado y mando); dibujo en el Overlay
    const PW = 560, PH = 700, px = 640 - PW / 2, py = 360 - PH / 2;
    const layer = S.add.container(0, 0).setDepth(LAYER.modal).setScrollFactor(0);
    const blocker = S.add.zone(0, 0, 1280, 720).setOrigin(0, 0).setInteractive();
    const dim = S.add.rectangle(640, 360, 1280, 720, TH.color.shade, TH.alpha.curtain);
    const g = S.add.graphics();
    g.fillStyle(TH.color.shade, TH.alpha.shadow); g.fillRoundedRect(px + 4, py + 8, PW, PH, TH.radius);
    root.CM_Panel.draw(g, px, py, PW, PH);
    const title = T(S, 640, py + 38, _t('u.ajustes'), { size: TH.size.h2, bold: true, color: C.gold });
    layer.add([blocker, dim, g, title]);
    Overlay.own(scene, layer); Overlay.addModal(layer);
    const handlers = [];

    const slider = (y, label, get, set, onStep) => {
      const x0 = px + 150, len = 250;
      const lbl = T(S, px + 40, y, label, { size: TH.size.body, ox: 0, color: C.parch });
      const pct = T(S, x0 + len + 30, y, '', { size: TH.size.body, bold: true, ox: 0, color: C.gold });
      const track = S.add.graphics();
      const thumb = S.add.circle(0, y, 13, C.gold).setStrokeStyle(TH.borderWidth, TH.color.outline);
      const hit = S.add.zone(x0 - 14, y - 18, len + 28, 36).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      let v = get(), dragging = false;
      const draw = () => {
        track.clear();
        track.fillStyle(TH.color.deep, 1); track.fillRoundedRect(x0, y - 5, len, 10, 5);
        if (v > 0) { track.fillStyle(C.ember, 1); track.fillRoundedRect(x0, y - 5, Math.max(10, len * v), 10, 5); }
        track.fillStyle(C.muted, 1);
        for (let i = 0; i <= 10; i++) track.fillRect(x0 + len * i / 10 - 1, y + 9, 2, i % 5 ? 4 : 7);   // una muesca por cada 10%
        thumb.x = x0 + len * v;
        pct.setText(I18N.pct(Math.round(v * 100)));
      };
      const fromX = (x) => Math.round(Math.min(1, Math.max(0, (x - x0) / len)) * 10) / 10;
      const update = (x) => { const nv = fromX(x); if (nv !== v) { v = nv; set(v); draw(); if (onStep) onStep(v); } };
      hit.on('pointerdown', (p) => { dragging = true; update(p.worldX); });
      const move = (p) => { if (dragging && p.isDown) update(p.worldX); };
      const up = () => { dragging = false; };
      S.input.on('pointermove', move); S.input.on('pointerup', up);
      handlers.push(['pointermove', move], ['pointerup', up]);
      draw();
      layer.add([lbl, track, thumb, pct, hit]);
      return { y, adjust: (d) => { const nv = Math.round(Math.min(1, Math.max(0, v + d * 0.1)) * 10) / 10; if (nv !== v) { v = nv; set(v); draw(); if (onStep) onStep(v); } } };
    };
    const sMusic = slider(py + 96, _t('u.musica'), () => Vol.music, (v) => Music.setVolume(v));
    // Efectos: clic de prueba al moverla (ya con el volumen nuevo; con 0% no suena)
    const sSfx = slider(py + 140, _t('u.efectos'), () => Vol.sfx, (v) => Sfx.setSfxVolume(v), () => { Sfx.unlock(); Sfx.synth('click', 1.6); });
    // Voz (Parche 3.7): la narración de la intro, si tiene audios
    const sVoice = slider(py + 184, _t('u.voz'), () => Vol.voice, (v) => { Vol.voice = Vol.clamp(v, Vol.voice); saveVol(); });

    // Velocidad de animación del combate: ×1 / ×2 / ×3 (tecla V en combate)
    const sy = py + 232;
    layer.add(fitLine(T(S, px + 40, sy, _t('u.velocidad_de_animacion'), { size: TH.size.body, ox: 0, color: C.parch }), 250));
    const speedBtns = [1, 2, 3].map((v, i) => {
      const b = button(S, px + 330 + i * 72, sy, `×${v}`, () => { setOpt('speed', v); paintSpeed(); Sfx.synth('click', 1.4); },
        { w: 62, h: TH.button.minH, size: TH.size.body, variant: 'ghost', compact: false });
      layer.add(b); return b;
    });
    const speedRing = S.add.graphics(); layer.add(speedRing);
    const paintSpeed = () => {
      speedRing.clear(); speedRing.lineStyle(TH.borderWidth, C.gold, 1);   // velocidad elegida: marco oro
      const b = speedBtns[Opts.speed - 1]; speedRing.strokeRoundedRect(b.x - 35, sy - 28, 70, 56, TH.radius + 2);
    };
    paintSpeed();
    layer.add(fitText(T(S, px + 40, sy + 22, _t('u.tweens_esperas_y_efectos_del'), { size: TH.size.micro, ox: 0, oy: 0, color: C.muted, wrap: 250, lineSpacing: -3 }), 250, 36, TH.size.micro));

    // Calidad gráfica (src/ui/hires.js): Automática (R según la pantalla) · Alta (R = 2) · Rendimiento (R = 1, como antes).
    // Cambia la resolución del lienzo: se aplica al reiniciar el juego.
    const qy = py + 304, Hi = root.CM_HIRES, GFX = ['auto', 'high', 'perf'];
    layer.add(fitLine(T(S, px + 40, qy - 6, _t('gfx.title'), { size: TH.size.body, ox: 0, color: C.parch }), 300, TH.size.small));
    const gfxHint = T(S, px + 40, qy + 16, '', { size: TH.size.micro, ox: 0, color: C.muted });
    const gfxBtn = button(S, px + PW - 120, qy, _t('gfx.' + Opts.gfx), () => cycleGfx(1), { w: 170, h: TH.button.minH, size: TH.size.small, variant: 'ghost', compact: false });
    const paintGfx = () => {
      const pending = Opts.gfx !== Hi.mode;
      gfxHint.setText(pending ? _t('gfx.restart') : _t('gfx.now', { r: I18N.mult(Hi.R) })).setColor(hex(pending ? C.ember : C.muted));
      fitLine(gfxHint, 300, TH.size.micro);
      gfxBtn.setLabel(_t('gfx.' + Opts.gfx));
    };
    const cycleGfx = (d) => {
      const v = GFX[(GFX.indexOf(Opts.gfx) + (d < 0 ? GFX.length - 1 : 1)) % GFX.length];
      setOpt('gfx', v); paintGfx(); Sfx.synth('click', 1.4);   // el aviso «se aplica al reiniciar» queda bajo la etiqueta (en ember)
    };
    layer.add([gfxHint, gfxBtn]);
    paintGfx();

    // Casillas: aviso al terminar el turno con energía y «Reducir movimiento» (sin temblores ni destellos)
    const checkbox = (wy, label, key) => {
      layer.add(fitLine(T(S, px + 40, wy, label, { size: TH.size.body, ox: 0, color: C.parch }), PW - 130, TH.size.small));
      const chk = S.add.graphics(); layer.add(chk);
      const chkHit = S.add.zone(px + PW - 70, wy - 18, 36, 36).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      const paintChk = () => {
        chk.clear(); chk.fillStyle(TH.color.deep, 1); chk.fillRoundedRect(px + PW - 70, wy - 15, 30, 30, TH.radius);
        chk.lineStyle(TH.borderWidth, C.gold, 1); chk.strokeRoundedRect(px + PW - 70, wy - 15, 30, 30, TH.radius);
        if (Opts[key]) { chk.lineStyle(4, C.gold, 1); chk.beginPath(); chk.moveTo(px + PW - 63, wy); chk.lineTo(px + PW - 57, wy + 7); chk.lineTo(px + PW - 46, wy - 8); chk.strokePath(); }
      };
      const toggle = () => { setOpt(key, !Opts[key]); paintChk(); Sfx.synth('click', 1.4); };
      if (key === 'vibration') chkHit.on('pointerup', () => { if (Opts.vibration) vibrate(0.5, 120); });   // prueba al activarla
      chkHit.on('pointerup', toggle);
      paintChk(); layer.add(chkHit);
      return { y: wy, toggle };
    };
    const cWarn = checkbox(py + 356, _t('u.avisar_si_terminas_el_turno'), 'endWarn');
    const cMotion = checkbox(py + 398, _t('u.reducir_movimiento_sin_temblores_ni'), 'reduceMotion');
    const cVib = checkbox(py + 440, _t('feel.vibration'), 'vibration');   // vibración del mando (golpes fuertes, daño, jefe)
    // Idioma / Language: botón con el idioma actual que abre el menú
    const ly = py + 484;
    layer.add(fitLine(T(S, px + 40, ly, _t('lang.title'), { size: TH.size.body, ox: 0, color: C.parch }), 300, TH.size.small));
    const langBtn = button(S, px + PW - 120, ly, I18N.LANG_NAMES[I18N.lang], () => openLangMenu(scene, px + PW - 120, ly + 26), { w: 170, h: TH.button.minH, size: TH.size.small, variant: 'ghost', compact: false });
    layer.add(langBtn);
    // Glosario de habilidades (pestaña «Habilidades» del Compendio, encima de esta pantalla)
    const gy = py + 528;
    const openGl = () => { close(); const UI = root.CM_UI; if (UI && UI.openGlossary) UI.openGlossary(scene); };
    layer.add(fitLine(T(S, px + 40, gy, _t('gl.open'), { size: TH.size.body, ox: 0, color: C.parch }), 300, TH.size.small));
    const glBtn = button(S, px + PW - 120, gy, _t('gl.openBtn'), openGl, { w: 170, h: TH.button.minH, size: TH.size.small, variant: 'ghost', compact: false });
    layer.add(glBtn);
    // Ver la intro (Parche 3.7): encima de la escena actual, que queda en pausa
    const iy = py + 572;
    const openIntro = () => { close(); const sc = scene; sc.scene.launch('Intro', { over: sc.scene.key }); sc.scene.pause(sc.scene.key); };
    layer.add(fitLine(T(S, px + 40, iy, _t('intro.watchLong'), { size: TH.size.body, ox: 0, color: C.parch }), 300, TH.size.small));
    const inBtn = button(S, px + PW - 120, iy, _t('intro.watch'), openIntro, { w: 170, h: TH.button.minH, size: TH.size.small, variant: 'ghost', compact: false });
    layer.add(inBtn);
    // Progreso: exportar / importar (copia en texto para llevarla a otro dispositivo)
    const pgy = py + 616;
    const openExp = () => openProgress(scene, 'export'), openImp = () => openProgress(scene, 'import');
    layer.add(fitLine(T(S, px + 40, pgy, _t('sv.section'), { size: TH.size.body, ox: 0, color: C.parch }), 220, TH.size.small));
    const pgBtns = [[_t('sv.export'), openExp], [_t('sv.import'), openImp]].map(([lab, fn], i) => {
      const b = button(S, px + PW - 226 + i * 128, pgy, lab, fn, { w: 120, h: TH.button.minH, size: TH.size.small, variant: 'ghost', compact: false });
      const lt = b.list && b.list.find((o) => o.type === 'Text'); if (lt) fitText(lt, 108, 0, TH.size.micro);
      layer.add(b); return b;
    });
    let pgSel = 0;

    // «?»: atajos de teclado (escritorio)
    const keysLayer = S.add.container(0, 0).setVisible(false);
    const showKeys = (on) => {
      keysLayer.setVisible(on);
      keysLayer.removeAll(true);
      if (!on) return;
      const kg = S.add.graphics();
      root.CM_Panel.draw(kg, px + 16, py + 76, PW - 32, PH - 150);
      const kb = S.add.zone(px + 16, py + 76, PW - 32, PH - 150).setOrigin(0, 0).setInteractive();   // tapa los controles de debajo
      keysLayer.add([kb, kg, T(S, 640, py + 102, _t('u.atajos_de_teclado'), { size: TH.size.h3, bold: true, color: C.gold })]);
      shortcuts().forEach(([k, d], i) => {
        const y = py + 142 + i * 38;
        const kt = T(S, px + 44, y, k, { size: TH.size.small, bold: true, ox: 0, color: C.gold });
        keysLayer.add([kt, fitLine(T(S, px + 250, y, d, { size: TH.size.small, ox: 0, color: C.parch }), PW - 290)]);
      });
    };
    const help = button(S, px + PW - 36, py + 36, '?', () => showKeys(!keysLayer.visible), { w: TH.button.minH, h: TH.button.minH, size: TH.size.h3, variant: 'ghost', compact: false });
    layer.add([keysLayer, help]);

    const close = () => {
      if (!scene._settingsOpen) return;
      scene._settingsOpen = false; scene._settingsNav = null;
      handlers.forEach(([e, f]) => S.input.off(e, f));
      if (S.input.keyboard) S.input.keyboard.off('keydown', onKey);
      layer.destroy();
    };
    const closeBtn = button(S, 640, py + PH - 34, _t('u.cerrar'), close, { w: 160, h: TH.button.minH, size: TH.size.body, variant: 'gold', compact: false, role: 'back' });
    layer.add(closeBtn);
    scene._settingsClose = close;   // el mando (B) también lo cierra
    // Mando / flechas: ↑/↓ entre opciones, ←/→ mueven las barras y la velocidad, A marca/cierra
    const setSpeed = (d) => { const v = Math.max(1, Math.min(3, Opts.speed + d)); if (v !== Opts.speed) { setOpt('speed', v); paintSpeed(); Sfx.synth('click', 1.4); } };
    const rows = [
      { y: sMusic.y, lr: sMusic.adjust }, { y: sSfx.y, lr: sSfx.adjust }, { y: sVoice.y, lr: sVoice.adjust }, { y: sy, lr: setSpeed }, { y: qy, ok: () => cycleGfx(1), lr: cycleGfx },
      { y: cWarn.y, ok: cWarn.toggle }, { y: cMotion.y, ok: cMotion.toggle }, { y: cVib.y, ok: () => { cVib.toggle(); if (Opts.vibration) vibrate(0.5, 120); } }, { y: ly, ok: () => openLangMenu(scene, px + PW - 120, ly + 26) }, { y: gy, ok: openGl }, { y: iy, ok: openIntro }, { y: pgy, ok: () => (pgSel ? openImp : openExp)(), lr: (d) => { pgSel = d > 0 ? 1 : 0; }, pair: pgBtns }, { y: py + PH - 34, ok: close, btn: true }
    ];
    let row = rows.length - 1;
    const ring = S.add.graphics(); layer.add(ring);
    const glyph = S.add.graphics(); layer.add(glyph);
    const paintRow = () => {
      ring.clear(); glyph.clear();
      if (Input.device === 'mouse') return;
      const r = rows[row];
      ring.lineStyle(TH.borderWidth, TH.color.ember, 1);   // foco: ember 2 px
      if (r.btn) ring.strokeRoundedRect(640 - 86, r.y - 28, 172, 56, TH.radius + 2); else ring.strokeRoundedRect(px + 24, r.y - 24, PW - 48, 48, TH.radius + 2);
      if (r.pair) { const pb = r.pair[pgSel]; ring.lineStyle(TH.borderWidth, C.gold, 1); ring.strokeRoundedRect(pb.x - 64, r.y - 27, 128, 54, TH.radius + 2); }   // botón elegido (←/→)
      if (Input.device === 'pad' && r.ok) padGlyph(glyph, r.btn ? 640 - 92 : px + 26, r.y - 24, 'A', 11);
    };
    paintRow();
    scene._settingsNav = (a) => {
      if (scene._langMenu) return false;   // el menú de idioma (encima) lo navega padNav
      if (keysLayer.visible) { if (a === 'back' || a === 'confirm') { showKeys(false); return true; } return true; }
      const r = rows[row];
      if (a === 'up' || a === 'down') { row = (row + (a === 'up' ? -1 : 1) + rows.length) % rows.length; Sfx.play('click', { volume: 0.4 }); }
      else if ((a === 'left' || a === 'right') && r.lr) r.lr(a === 'left' ? -1 : 1);
      else if (a === 'confirm') { if (r.ok) r.ok(); }
      else if (a === 'back') { close(); }
      if (scene._settingsOpen && layer.scene) paintRow();   // (si la acción abrió otro panel, este ya no existe)
      return true;
    };
    blocker.on('pointerup', (p) => { if (p.worldX < px || p.worldX > px + PW || p.worldY < py || p.worldY > py + PH) close(); });   // clic fuera = cerrar
    const onKey = (ev) => {
      if (ev.key === 'Escape' && keysLayer.visible) { showKeys(false); return; }
      if (ev.key === 'Escape' || ev.key === 'Enter') S.time.delayedCall(0, close);
    };
    if (S.input.keyboard) S.input.keyboard.on('keydown', onKey);
    scene.events.once('shutdown', () => { scene._settingsOpen = false; });
    return { close };
  }

  /* =================================================================
   * Progreso: exportar / importar (savecode.js · «CMSAVE1:…»)
   *   Panel encima de Ajustes; el código vive en un <textarea> HTML superpuesto al lienzo
   *   (en el móvil se puede pegar con el menú del sistema). Mando: ←/→/↑/↓ entre botones, A pulsa, B vuelve.
   * ================================================================= */
  const SAVE_ERR = { empty: 'sv.err.empty', format: 'sv.err.format', corrupt: 'sv.err.corrupt', version: 'sv.err.version', unsupported: 'sv.err.unsupported' };
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
  /** «Esencia 1.155 · 15 partidas · Afinidad Piromago 7 · partida a medias: Acto II» */
  function saveSummaryText(sm) {
    const parts = [_t('sv.sumEss', { n: I18N.score(sm.essence) }), _t('sv.sumRuns', { n: I18N.score(sm.played) })];
    if (sm.aff) parts.push(_t('sv.sumAff', { c: sm.aff.name, n: sm.aff.level }));
    if (sm.run) parts.push(_t('sv.sumRun', { a: ROMAN[sm.run] || sm.run }));
    if (sm.custom) parts.push(_t('sv.sumCustom', { a: ROMAN[sm.custom] || sm.custom }));
    if (!sm.run && !sm.custom) parts.push(_t('sv.sumNoRun'));
    return parts.join(' · ');
  }
  const fmtSaveDate = (iso) => { try { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(I18N.locale(), { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } };
  /** <textarea> HTML colocado sobre el lienzo en coordenadas del juego (1280×720); sigue al lienzo al redimensionar. */
  function overlayTextarea(S, x, y, w, h, o = {}) {
    const doc = root.document, canvas = S.sys.game.canvas;
    if (!doc || !canvas) return null;
    const ta = doc.createElement('textarea');
    ta.readOnly = !!o.readOnly; ta.placeholder = o.placeholder || ''; ta.value = o.value || '';
    ta.spellcheck = false;
    ['autocapitalize', 'autocomplete', 'autocorrect'].forEach((a) => ta.setAttribute(a, 'off'));
    ta.setAttribute('aria-label', o.label || '');
    ta.className = 'cm-save-code';
    ta.style.cssText = 'position:fixed;z-index:60;box-sizing:border-box;margin:0;padding:8px 10px;resize:none;outline:none;'
      + `border:2px solid ${hex(C.gold)};border-radius:8px;background:rgba(12,16,14,.97);color:${hex(C.parch)};`
      + `font-family:${F.mono};line-height:1.3;word-break:break-all;overflow-wrap:anywhere;white-space:pre-wrap;overflow-y:auto;-webkit-user-select:text;user-select:text`;
    // Lo que se escribe aquí no llega al juego (Phaser escucha el teclado en window: Enter/Esc/E no deben dispararse)
    const stop = (e) => e.stopPropagation();
    ['keydown', 'keyup', 'keypress'].forEach((ev) => ta.addEventListener(ev, stop));
    doc.body.appendChild(ta);
    const place = () => {
      const r = canvas.getBoundingClientRect(), k = r.width / 1280;
      Object.assign(ta.style, { left: `${r.left + x * k}px`, top: `${r.top + y * k}px`, width: `${w * k}px`, height: `${h * k}px`,
        fontSize: `${Math.max(o.readOnly ? 11 : 16, Math.round(15 * k))}px` });   // 16 px al escribir: iOS no hace zoom
    };
    place();
    const onR = () => place();
    root.addEventListener('resize', onR); S.scale.on('resize', onR);
    return {
      el: ta, place,
      show(v) { ta.style.display = v ? '' : 'none'; if (v) place(); },
      destroy() { root.removeEventListener('resize', onR); S.scale.off('resize', onR); ta.remove(); }
    };
  }
  /** Abre «Exportar progreso» (mode 'export') o «Importar progreso» ('import'). Al volver, reabre Ajustes. */
  function openProgress(scene, mode = 'export') {
    const SC = root.CM_SAVE;
    if (!SC) return null;
    if (scene._settingsOpen && scene._settingsClose) scene._settingsClose();
    scene._settingsOpen = true;
    const S = Overlay.S(scene), doc = root.document;
    const PW = 760, PH = 580, px = 640 - PW / 2, py = 360 - PH / 2, BH = 64;
    const layer = S.add.container(0, 0).setDepth(LAYER.modal).setScrollFactor(0);
    const blocker = S.add.zone(0, 0, 1280, 720).setOrigin(0, 0).setInteractive();
    const dim = S.add.rectangle(640, 360, 1280, 720, TH.color.shade, TH.alpha.curtain);
    const g = S.add.graphics();
    g.fillStyle(TH.color.shade, TH.alpha.shadow); g.fillRoundedRect(px + 4, py + 8, PW, PH, TH.radius);
    root.CM_Panel.draw(g, px, py, PW, PH);
    const ring = S.add.graphics(), glyph = S.add.graphics();
    layer.add([blocker, dim, g, ring, glyph]);
    Overlay.own(scene, layer); Overlay.addModal(layer);

    const api = { state: mode, code: '', payload: null, busy: false, status: '', statusKind: '' };
    let body = null, btns = [], sel = 0, statusT = null, closed = false;
    const tas = {};   // export / import: un cuadro por pantalla (lo pegado se conserva al cancelar)
    const taOf = (kind) => {
      if (tas[kind]) return tas[kind];
      tas[kind] = kind === 'export'
        ? overlayTextarea(S, px + 40, py + 156, PW - 80, 190, { readOnly: true, value: _t('sv.building'), label: _t('sv.exportTitle') })
        : overlayTextarea(S, px + 40, py + 122, PW - 80, 200, { placeholder: _t('sv.placeholder'), label: _t('sv.importTitle') });
      return tas[kind];
    };
    const setStatus = (msg, kind = '') => {
      api.status = msg || ''; api.statusKind = kind;
      if (statusT && statusT.active) statusT.setText(api.status).setColor(hex(kind === 'err' ? C.blood : kind === 'ok' ? C.leaf : C.muted));
    };
    const close = (back = true) => {
      if (closed) return;
      closed = true;
      Object.values(tas).forEach((t) => t && t.destroy());
      scene._settingsOpen = false; scene._settingsNav = null; scene._settingsClose = null; scene._progress = null;
      if (S.input.keyboard) S.input.keyboard.off('keydown', onKey);
      layer.destroy();
      if (!back) return;
      // Ajustes vuelve en el siguiente instante: la misma tecla/botón (Esc, B) no debe cerrarlo también
      scene._settingsOpen = true; scene._settingsNav = () => true;
      root.setTimeout(() => {
        if (scene._settingsNav && scene._settingsClose == null) { scene._settingsOpen = false; scene._settingsNav = null; }
        if (scene.sys.isActive() && !scene._settingsOpen) openSettings(scene);
      }, 30);
    };
    const press = (b) => { if (!api.busy && b && b.press) b.press(); };

    /* ----- acciones ----- */
    const copy = async () => {
      if (!api.code) return;
      let ok = false;
      try { if (root.navigator && root.navigator.clipboard) { await root.navigator.clipboard.writeText(api.code); ok = true; } } catch (e) { /* sin permiso: plan B */ }
      if (!ok) {
        try { const el = tas.export.el; el.focus(); el.select(); el.setSelectionRange(0, el.value.length); ok = !!doc.execCommand('copy'); } catch (e) { ok = false; }
      }
      setStatus(ok ? _t('sv.copied') : _t('sv.copyFail'), ok ? 'ok' : 'err');
      Sfx.synth('click', 1.4);
    };
    const download = () => {
      if (!api.code) return;
      const name = SC.fileName();
      try {
        const text = `${_t('sv.fileHeader', { d: fmtSaveDate(new Date().toISOString()) })}\n\n${api.code}\n`;
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
        const a = doc.createElement('a'); a.href = url; a.download = name; a.style.display = 'none';
        doc.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setStatus(_t('sv.downloaded', { f: name }), 'ok');
      } catch (e) { setStatus(_t('sv.downloadFail'), 'err'); }
      Sfx.synth('click', 1.4);
    };
    const check = async (text) => {
      const r = await SC.decode(text !== undefined ? text : (tas.import ? tas.import.el.value : ''));
      if (closed) return r;
      if (!r.ok) { setStatus(_t(SAVE_ERR[r.err] || 'sv.err.corrupt'), 'err'); Sfx.play('click', { volume: 0.4 }); return r; }
      api.payload = r.payload; go('confirm');
      return r;
    };
    const onFile = (inp) => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      if (f.size > 4e6) { setStatus(_t('sv.err.format'), 'err'); return; }
      const rd = new root.FileReader();
      rd.onload = () => { if (closed) return; const txt = String(rd.result || ''); if (tas.import) tas.import.el.value = txt.trim(); setStatus(_t('sv.fileRead', { f: f.name }), 'ok'); check(txt); };
      rd.onerror = () => setStatus(_t('sv.fileFail'), 'err');
      rd.readAsText(f);
      inp.value = '';   // el mismo archivo otra vez también avisa
    };
    /**
     * «Cargar archivo»: un <input type=file> invisible encima del botón. El toque/clic llega directo al navegador
     * (Safari y Chrome solo abren el selector desde un gesto real); con mando/teclado se abre con .click().
     */
    let fileEl = null, fileTap = 0;
    const fileInput = (b) => {
      if (!doc || fileEl) return fileEl;
      const inp = doc.createElement('input');
      inp.type = 'file'; inp.accept = '.txt,text/plain'; inp.className = 'cm-save-file'; inp.title = _t('sv.loadFile');
      inp.style.cssText = 'position:fixed;z-index:61;opacity:0;cursor:pointer;margin:0;padding:0;font-size:0';
      inp.addEventListener('change', () => onFile(inp));
      inp.addEventListener('pointerdown', () => { fileTap = Date.now(); });
      inp.addEventListener('click', () => Sfx.synth('click', 1.4));
      doc.body.appendChild(inp);
      const place = () => {
        const r = S.sys.game.canvas.getBoundingClientRect(), k = r.width / 1280;
        Object.assign(inp.style, { left: `${r.left + (b.x - b._w / 2) * k}px`, top: `${r.top + (b.y - BH / 2) * k}px`, width: `${b._w * k}px`, height: `${BH * k}px` });
      };
      place();
      const onR = () => place();
      root.addEventListener('resize', onR); S.scale.on('resize', onR);
      fileEl = { el: inp, show(v) { inp.style.display = v ? '' : 'none'; if (v) place(); }, destroy() { root.removeEventListener('resize', onR); S.scale.off('resize', onR); inp.remove(); } };
      tas.file = fileEl;
      return fileEl;
    };
    // (Phaser también ve ese mismo clic a través de window: si vino del <input>, el selector ya se está abriendo)
    const pickFile = () => { if (fileEl && Date.now() - fileTap > 800) { api.fileInput = fileEl.el; fileEl.el.click(); } };
    const accept = async () => {
      if (api.busy) return;
      api.busy = true; setStatus(_t('sv.applying'));
      try {
        if (api.state === 'confirmUndo') await SC.undo(); else await SC.apply(api.payload);
        api.applied = true;
      } catch (e) { api.busy = false; setStatus(_t('sv.err.corrupt'), 'err'); }
    };

    /* ----- pantallas ----- */
    const mkBtn = (x, y, w, label, fn, variant = 'ghost') => {
      const b = button(S, x, y, label, fn, { w, h: BH, size: TH.size.body, variant, compact: false });
      const lt = b.list && b.list.find((o) => o.type === 'Text'); if (lt) fitText(lt, w - 24, 0, TH.size.small);
      b._w = w; body.add(b); btns.push(b); return b;
    };
    const go = (state) => { api.state = state; render(); };
    function render() {
      if (body) body.destroy();
      body = S.add.container(0, 0); layer.add(body); layer.bringToTop(ring); layer.bringToTop(glyph);
      btns = []; sel = 0;
      const st = api.state, add = (o) => { body.add(o); return o; };
      const titleKey = { export: 'sv.exportTitle', import: 'sv.importTitle', confirm: 'sv.confirmTitle', confirmUndo: 'sv.undoTitle' }[st];
      add(fitLine(T(S, 640, py + 40, _t(titleKey), { size: TH.size.h2, bold: true, color: C.gold }), PW - 60));
      Object.keys(tas).forEach((k) => tas[k].show(k === st || (k === 'file' && st === 'import')));
      if (st === 'export') {
        add(fitText(T(S, 640, py + 86, _t('sv.exportHelp'), { size: TH.size.small, color: C.parch, wrap: PW - 80, align: 'center' }), PW - 80, 46, TH.size.micro));
        const sm = SC.summary({ data: SC.collect(), at: '' });
        add(fitText(T(S, 640, py + 132, saveSummaryText(sm), { size: TH.size.small, bold: true, color: C.gold, wrap: PW - 80, align: 'center' }), PW - 80, 40, TH.size.micro));
        const ta = taOf('export'); ta.show(true);
        statusT = add(fitLine(T(S, 640, py + 374, '', { size: TH.size.small, bold: true, color: C.muted }), PW - 60, TH.size.micro));
        mkBtn(640 - 180, py + 436, 330, _t('sv.copy'), copy, 'primary');
        mkBtn(640 + 180, py + 436, 330, _t('sv.download'), download, 'secondary');
        mkBtn(640, py + PH - 50, 220, _t('sv.back'), () => close(true), 'ghost');
        if (!api.code) {
          SC.encode(SC.collect()).then((code) => { api.code = code; if (tas.export) tas.export.el.value = code; }).catch(() => setStatus(_t('sv.err.unsupported'), 'err'));
        }
      } else if (st === 'import') {
        add(fitText(T(S, 640, py + 86, _t('sv.importHelp'), { size: TH.size.small, color: C.parch, wrap: PW - 80, align: 'center' }), PW - 80, 46, TH.size.micro));
        taOf('import').show(true);
        statusT = add(fitText(T(S, 640, py + 350, '', { size: TH.size.small, bold: true, color: C.muted, wrap: PW - 60, align: 'center' }), PW - 60, 44, TH.size.micro));
        fileInput(mkBtn(640 - 180, py + 420, 330, _t('sv.loadFile'), pickFile, 'secondary')).show(true);
        mkBtn(640 + 180, py + 420, 330, _t('sv.import'), () => check(), 'primary');
        if (SC.hasUndo()) {
          mkBtn(640 - 180, py + PH - 50, 330, _t('sv.undo'), () => go('confirmUndo'), 'ghost');
          mkBtn(640 + 180, py + PH - 50, 330, _t('sv.back'), () => close(true), 'ghost');
        } else mkBtn(640, py + PH - 50, 220, _t('sv.back'), () => close(true), 'ghost');
        sel = 1;
      } else {
        const undo = st === 'confirmUndo';
        const data = undo ? SC.undoData() : api.payload.data;
        const sm = SC.summary({ data: data || {}, at: undo ? '' : api.payload.at });
        if (sm.at && fmtSaveDate(sm.at)) add(fitLine(T(S, 640, py + 96, _t('sv.sumAt', { d: fmtSaveDate(sm.at) }), { size: TH.size.small, color: C.muted }), PW - 80));
        add(fitText(T(S, 640, py + 190, saveSummaryText(sm), { size: TH.size.h3, bold: true, color: C.parch, wrap: PW - 100, align: 'center', lineSpacing: 4 }), PW - 100, 150, TH.size.small));
        add(fitText(T(S, 640, py + 330, _t(undo ? 'sv.undoWarn' : 'sv.confirmWarn'), { size: TH.size.body, bold: true, color: C.ember, wrap: PW - 100, align: 'center' }), PW - 100, 60, TH.size.small));
        statusT = add(fitLine(T(S, 640, py + 392, '', { size: TH.size.small, bold: true, color: C.muted }), PW - 60, TH.size.micro));
        mkBtn(640 - 180, py + PH - 70, 300, _t('sv.cancel'), () => { setStatus(''); go('import'); }, 'ghost');
        mkBtn(640 + 180, py + PH - 70, 300, _t('sv.accept'), accept, 'primary');
      }
      setStatus(api.status && st !== 'confirm' && st !== 'confirmUndo' ? api.status : '', api.statusKind);
      paintRing();
    }
    function paintRing() {
      ring.clear(); glyph.clear();
      if (Input.device === 'mouse' || !btns[sel]) return;
      const b = btns[sel];
      ring.lineStyle(TH.borderWidth, TH.color.ember, 1);
      ring.strokeRoundedRect(b.x - b._w / 2 - 6, b.y - BH / 2 - 6, b._w + 12, BH + 12, TH.radius + 2);
      if (Input.device === 'pad') padGlyph(glyph, b.x - b._w / 2 - 8, b.y - BH / 2 - 8, 'A', 11);
    }
    /* ----- mando y teclado ----- */
    let last = { a: '', t: 0 };
    const nav = (a) => {
      const now = Date.now();
      if (a === last.a && now - last.t < 60) return true;   // la misma tecla llega por dos caminos: una sola vez
      last = { a, t: now };
      if (api.busy) return true;
      if (['up', 'left', 'prev', 'tabPrev'].includes(a)) { sel = (sel - 1 + btns.length) % btns.length; Sfx.play('click', { volume: 0.4 }); }
      else if (['down', 'right', 'next', 'tabNext'].includes(a)) { sel = (sel + 1) % btns.length; Sfx.play('click', { volume: 0.4 }); }
      else if (a === 'confirm') press(btns[sel]);
      else if (a === 'back') { if (api.state === 'confirm' || api.state === 'confirmUndo') go('import'); else close(true); }
      if (!closed) paintRing();
      return true;
    };
    const onKey = (ev) => { if (ev.key === 'Escape') nav('back'); else if (ev.key === 'Enter') nav('confirm'); };
    if (S.input.keyboard) S.input.keyboard.on('keydown', onKey);
    scene._settingsNav = nav;
    scene._settingsClose = () => close(false);
    blocker.on('pointerup', (p) => { if (!api.busy && (p.worldX < px || p.worldX > px + PW || p.worldY < py || p.worldY > py + PH)) close(true); });
    scene.events.once('shutdown', () => { if (!closed) { closed = true; Object.values(tas).forEach((t) => t && t.destroy()); scene._settingsOpen = false; scene._progress = null; } });
    Object.assign(api, { close, check, copy, download, pickFile, accept, nav, go, textarea: (k) => tas[k] && tas[k].el, buttons: () => btns, layer });
    scene._progress = api;
    render();
    return api;
  }

  /* =================================================================
   * MANDO Y TECLADO → ACCIONES
   *   Input.bind(scene, fn): la escena recibe acciones, no botones:
   *     up · down · left · right · confirm (A / Enter) · back (B / Esc) · endTurn (X / E) · deck (Y)
   *   Mando (Xbox, API estándar): cruceta o stick izquierdo (zona muerta 0.35, con repetición al mantener).
   *   Input.device: 'mouse' | 'keys' | 'pad' (el marco de foco solo se ve con teclado o mando).
   * ================================================================= */
  const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  const DEADZONE = 0.35, REPEAT_DELAY = 360, REPEAT_EVERY = 150;
  const KEY_ACTION = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'confirm', Escape: 'back', e: 'endTurn', E: 'endTurn', PageUp: 'tabPrev', PageDown: 'tabNext' };
  const PAD_BTN_ACTION = [['A', 'confirm'], ['B', 'back'], ['X', 'endTurn'], ['Y', 'deck'], ['LB', 'tabPrev'], ['RB', 'tabNext'], ['LT', 'prevItem'], ['RT', 'nextItem']];
  let bindSeq = 0;
  const Input = {
    device: 'mouse',
    lastAction: null,          // { action, dev, scene, t } — el panel #pad de Pruebas lo enseña
    bound: [],                 // escenas enganchadas; solo la última activa recibe las acciones
    /** Escena enganchada que está arriba del todo (la última abierta que sigue activa). */
    top() {
      let best = null;
      for (const b of Input.bound) if (b.scene.sys && b.scene.sys.isActive() && (!best || b.seq > best.seq)) best = b;
      return best;
    },
    /** Lanza una acción como si viniera del mando (pruebas sin mando físico). */
    simulate(action, dev = 'pad') { const b = Input.top(); if (b) b.fire(action, dev, true); return b ? b.scene.scene.key : null; },
    /** Engancha mando y teclado a una escena. opts.keys: false para no traducir Enter/Esc/E (la escena ya los gestiona). */
    bind(scene, onAction, opts = {}) {
      const entry = { scene, seq: ++bindSeq, fire: null };
      const fire = (action, dev, forced) => {
        if (!forced && Input.top() !== entry) return;           // otra escena encima (Mazo, Compendio…) se lleva el mando
        Input.device = dev;
        Input.lastAction = { action, dev, scene: scene.scene.key, t: Date.now() };
        if (root.__onPadAction) try { root.__onPadAction(Input.lastAction); } catch (e) { /* panel de pruebas */ }
        // Un consejo o el panel ⚙ abiertos se llevan las acciones primero
        if (scene._tipQ && scene._tipQ.open) { if ((action === 'confirm' || action === 'back') && scene._tipClose) scene._tipClose(false); return; }
        if (scene._langMenu) { scene._langMenu.nav(action); return; }   // menú de idioma abierto: se lleva el mando
        if (scene._settingsOpen) {
          if (scene._settingsNav && scene._settingsNav(action)) return;
          if (action === 'back' && scene._settingsClose) scene._settingsClose();
          return;
        }
        onAction(action, dev);
      };
      entry.fire = fire;
      Input.bound.push(entry);
      const onKey = (ev) => {
        const a = ev.key === 'Tab' ? (ev.shiftKey ? 'prev' : 'next') : KEY_ACTION[ev.key];   // Tab recorre los botones (FocusManager)
        if (ev.key === 'Tab' && ev.preventDefault) ev.preventDefault();
        // Enter / Esc (FocusManager): en las escenas con navegación automática, si la escena no los escucha ya por su cuenta
        const kb = scene.input.keyboard, own = (n) => kb && kb.listenerCount && kb.listenerCount(n) > 0;
        const soft = opts.soft && ((a === 'back' && !own('keydown-ESC')) || (a === 'confirm' && !own('keydown-ENTER')));
        if (a && (opts.keys !== false || soft || ['up', 'down', 'left', 'right', 'tabPrev', 'tabNext', 'next', 'prev'].includes(a))) fire(a, 'keys');
      };
      if (scene.input.keyboard) scene.input.keyboard.on('keydown', onKey);
      const onMouse = () => { Input.device = 'mouse'; };
      scene.input.on('pointermove', onMouse); scene.input.on('pointerdown', onMouse);
      // Mando: sondeo por fotograma con detección de flanco y repetición al mantener la dirección.
      // El primer fotograma solo apunta lo que ya estaba pulsado (el botón que abrió esta escena no la cierra).
      const held = {}, dirT = {};
      let primed = false;
      const poll = (time) => {
        const gp = scene.input.gamepad;
        if (!gp || !gp.total) { primed = true; return; }
        let pad = null;
        try { pad = gp.pad1 || gp.getPad(0) || (gp.gamepads || []).find(Boolean); } catch (e) { pad = null; }
        if (!pad || !pad.connected) { primed = true; return; }
        const btn = (i) => { const b = pad.buttons && pad.buttons[i]; return !!(b && (b.pressed || b.value > 0.5)); };
        const ax = (i) => { const a = pad.axes && pad.axes[i]; const v = a ? a.getValue() : 0; return Math.abs(v) > DEADZONE ? v : 0; };
        const edge = (k, down) => { const was = held[k]; held[k] = down; return down && !was && primed; };
        for (const [k, act] of PAD_BTN_ACTION) if (edge(k, btn(PAD[k]))) fire(act, 'pad');
        const sx = ax(0), sy = ax(1);
        const dirs = { up: btn(PAD.UP) || sy < 0, down: btn(PAD.DOWN) || sy > 0, left: btn(PAD.LEFT) || sx < 0, right: btn(PAD.RIGHT) || sx > 0 };
        for (const [d, on] of Object.entries(dirs)) {
          if (!on) { dirT[d] = 0; continue; }
          if (!primed) { dirT[d] = time + REPEAT_DELAY; continue; }
          if (!dirT[d]) { dirT[d] = time + REPEAT_DELAY; fire(d, 'pad'); }
          else if (time >= dirT[d]) { dirT[d] = time + REPEAT_EVERY; fire(d, 'pad'); }
        }
        primed = true;
      };
      scene.events.on('update', poll);
      const off = () => {
        if (scene.input.keyboard) scene.input.keyboard.off('keydown', onKey);
        scene.input.off('pointermove', onMouse); scene.input.off('pointerdown', onMouse);
        scene.events.off('update', poll);
        Input.bound = Input.bound.filter((b) => b !== entry);
      };
      scene.events.once('shutdown', off);
      return off;
    }
  };

  /* Glifos del mando (A verde, B rojo, X azul, Y amarillo, LB/RB/LT/RT gris), dibujados con Graphics. */
  const GLYPH_COL = { A: 0x3fae55, B: 0xd24a43, X: 0x3f78d8, Y: 0xe2b42e, LB: 0x5d6660, RB: 0x5d6660, LT: 0x5d6660, RT: 0x5d6660 };
  function padGlyph(g, x, y, key, r = 12) {
    const wide = key.length > 1, w = wide ? r * 2.6 : r * 2;
    g.fillStyle(0x000000, 0.45);
    if (wide) g.fillRoundedRect(x - w / 2 + 1, y - r + 2, w, r * 2, r * 0.7); else g.fillCircle(x + 1, y + 2, r);
    g.fillStyle(GLYPH_COL[key] || 0x777777, 1);
    if (wide) g.fillRoundedRect(x - w / 2, y - r, w, r * 2, r * 0.7); else g.fillCircle(x, y, r);
    g.lineStyle(2, 0x111111, 0.7);
    if (wide) g.strokeRoundedRect(x - w / 2, y - r, w, r * 2, r * 0.7); else g.strokeCircle(x, y, r);
    const s = r / 12, L = (pts) => { g.beginPath(); g.moveTo(x + pts[0] * s, y + pts[1] * s); for (let i = 2; i < pts.length; i += 2) g.lineTo(x + pts[i] * s, y + pts[i + 1] * s); g.strokePath(); };
    g.lineStyle(2.6 * s, 0xffffff, 1);
    const letter = (ch, ox) => {
      const P = (pts) => L(pts.map((v, i) => (i % 2 ? v : v + ox)));
      if (ch === 'A') { P([-5, 6, 0, -6, 5, 6]); P([-3, 2, 3, 2]); }
      if (ch === 'X') { P([-5, -6, 5, 6]); P([5, -6, -5, 6]); }
      if (ch === 'Y') { P([-5, -6, 0, 0, 5, -6]); P([0, 0, 0, 6]); }
      if (ch === 'L') { P([-4, -6, -4, 6, 4, 6]); }
      if (ch === 'R') { P([-4, 6, -4, -6, 1, -6, 4, -4, 4, -1, 1, 1, -4, 1]); P([0, 1, 4, 6]); }
      if (ch === 'T') { P([-5, -6, 5, -6]); P([0, -6, 0, 6]); }
      if (ch === 'B') { P([-4, -6, -4, 6, 1, 6, 4, 4, 4, 2, 1, 0, -4, 0]); P([-4, -6, 1, -6, 3, -4, 3, -2, 1, 0]); }
    };
    if (wide) { letter(key[0], -5); letter(key[1], 5.5); } else letter(key, 0);
  }

  /**
   * FocusManager: elementos enfocables de una escena; las flechas mueven al más cercano en esa
   * dirección y confirm activa el enfocado. Marco dorado solo con teclado/mando.
   *   item: { obj, rect?: () => {x,y,w,h}, onConfirm, onFocus?, onBlur? }
   */
  /** Rectángulo en pantalla de la zona pulsable de un objeto (su hitArea transformada), o sus límites. */
  function hitRect(o) {
    const ha = o.input && o.input.hitArea;
    if (ha && ha.width && ha.height && typeof ha.x === 'number' && o.getWorldTransformMatrix) {
      const m = o.getWorldTransformMatrix(), ox = o.displayOriginX || 0, oy = o.displayOriginY || 0;
      const xs = [], ys = [];
      for (const [lx, ly] of [[ha.x, ha.y], [ha.x + ha.width, ha.y], [ha.x, ha.y + ha.height], [ha.x + ha.width, ha.y + ha.height]]) {
        const pt = m.transformPoint(lx - ox, ly - oy); xs.push(pt.x); ys.push(pt.y);
      }
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    const b = o.getBounds(); return { x: b.x, y: b.y, w: b.width, h: b.height };
  }
  function focusManager(scene, opts = {}) {
    const fm = { items: [], cur: null };
    const S = Overlay.S(scene);
    const frame = Overlay.own(scene, S.add.graphics().setDepth(opts.depth || LAYER.modal + 900));
    frame.isFocusFrame = true;   // sobre ventanas, bajo los consejos
    const rectOf = (it) => (it.rect ? it.rect() : hitRect(it.obj));
    const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    let marked = null;   // UIButton con el contorno de foco puesto
    const unmark = () => { if (marked && marked.active && marked.setFocus) marked.setFocus(false); marked = null; };
    fm.draw = () => {
      frame.clear();
      const it = fm.cur;
      if (marked && (!it || it.obj !== marked || Input.device === 'mouse')) unmark();
      if (!it || Input.device === 'mouse' || !it.obj || !it.obj.active || (it.obj.visible === false)) return;
      if (it.obj.setFocus && marked !== it.obj && !(scene._settingsOpen || (scene._tipQ && scene._tipQ.open))) { unmark(); marked = it.obj; }
      if (scene._settingsOpen || (scene._tipQ && scene._tipQ.open)) return;   // con ⚙ o un consejo encima, el marco de debajo no se ve
      const r = rectOf(it), pad = opts.pad || 6;
      root.CM_FocusManager.mark(frame, it, r, true, TH);   // foco: contorno ember de 2 px (el del propio UIButton)
      if (Input.device === 'pad' && opts.glyph !== false) padGlyph(frame, r.x - pad + 2, r.y - pad + 2, 'A', 12);   // botón que hay que pulsar
    };
    fm.set = (items) => { fm.items = items.filter((x) => x && x.obj); if (!fm.items.includes(fm.cur)) fm.focus(fm.items[0] || null); else fm.draw(); return fm; };
    fm.focus = (it) => {
      if (fm.cur && fm.cur !== it && fm.cur.onBlur) fm.cur.onBlur();
      fm.cur = it;
      if (it && it.onFocus) it.onFocus();
      fm.draw();
    };
    fm.move = (dir) => {
      if (!fm.items.length) return false;
      if (!fm.cur) { fm.focus(fm.items[0]); return true; }
      const c0 = center(rectOf(fm.cur));
      const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      let best = null, bestScore = Infinity;
      for (const it of fm.items) {
        if (it === fm.cur) continue;
        const c1 = center(rectOf(it)), dx = c1.x - c0.x, dy = c1.y - c0.y;
        const along = dx * v[0] + dy * v[1];
        if (along <= 4) continue;                          // tiene que estar en esa dirección
        const across = Math.abs(dx * v[1]) + Math.abs(dy * v[0]);
        const score = along + across * 2;                  // lo más recto posible
        if (score < bestScore) { bestScore = score; best = it; }
      }
      if (best) { fm.focus(best); Sfx.play('click', { volume: 0.4 }); return true; }
      return false;
    };
    /** Tab / Mayús+Tab: siguiente o anterior en orden de lectura (src/ui/FocusManager.js). */
    fm.tab = (d) => { const it = root.CM_FocusManager.tabOrder(fm.items, fm.cur, d, rectOf); if (!it) return false; fm.focus(it); Sfx.play('click', { volume: 0.4 }); return true; };
    fm.confirm = () => { if (fm.cur && fm.cur.onConfirm) fm.cur.onConfirm(); };
    scene.events.on('update', fm.draw);
    scene.events.once('shutdown', () => scene.events.off('update', fm.draw));
    return fm;
  }
  /** Enfocables a partir de los botones (U.button) que haya en la escena. */
  function buttonsAsFocus(scene, list) {
    return (list || scene.children.list).filter((o) => o && typeof o.press === 'function' && o.visible !== false)
      .map((b) => ({ obj: b, onConfirm: () => b.press() }));
  }

  /**
   * padNav: mando y flechas en cualquier pantalla sin escribir la navegación a mano.
   * Recoge lo que se puede pulsar (botones, cartas, zonas con pointerup), respeta las capas modales
   * (una zona que tapa la pantalla deja fuera lo de debajo), empieza en el botón principal y nunca
   * se queda en algo oculto o destruido. A confirma, B vuelve, LB/RB pestañas.
   *   opts: main(items) → obj · back() · tab(dir) · onAction(a) → true si la gestiona
   *         scroll: { root, top, bottom, get(), set(v), step } (cuadrículas con desplazamiento)
   *         items() → items propios (sustituye a la recogida automática cuando no hay capa modal)
   *         keys: traducir Enter/Esc (por defecto no: muchas escenas ya los usan)
   */
  const BACK_RE = /^(←\s*)?(Volver|Cerrar|Cancelar|Elegir otra|Listo|Atrás|Salir|Back|Close|Cancel|Choose another|Done|Leave)/i;
  function padNav(scene, opts = {}) {
    const fm = focusManager(scene, { pad: opts.pad || 6 });
    const gl = Overlay.own(scene, Overlay.S(scene).add.graphics().setDepth(LAYER.modal + 902));
    const shown = (o) => { if (!o || !o.scene || !o.active) return false; for (let p = o; p; p = p.parentContainer) if (!p.active || p.visible === false || p.alpha < 0.02) return false; return true; };
    const rootOf = (o) => { let p = o; while (p.parentContainer) p = p.parentContainer; return p; };
    const inside = (o, rootObj) => { for (let p = o; p; p = p.parentContainer) if (p === rootObj) return true; return false; };
    const clickable = (o) => o.input && o.input.enabled && !o.noPad && (typeof o.press === 'function' || o.listenerCount('pointerup') > 0 || o.listenerCount('pointerdown') > 0);
    const rectOf = hitRect;
    const fake = (o) => {
      const r = rectOf(o), x = r.x + r.w / 2, y = r.y + r.h / 2;
      return { x, y, worldX: x, worldY: y, downX: x, downY: y, upX: x, upY: y, button: 0, isDown: false, pad: true,
        leftButtonReleased: () => true, rightButtonReleased: () => false, leftButtonDown: () => true, rightButtonDown: () => false, event: {} };
    };
    const ev = { stopPropagation() {} };
    const activate = (o) => {
      if (!shown(o)) return;
      if (typeof o.press === 'function') { o.press(); return; }
      const p = fake(o);
      o.emit('pointerdown', p, 0, 0, ev);
      if (o.scene && o.active) o.emit('pointerup', p, 0, 0, ev);
    };
    const item = (o) => ({ obj: o, rect: () => rectOf(o), onConfirm: () => activate(o),
      onFocus: () => { if (shown(o) && Input.device !== 'mouse') o.emit('pointerover', fake(o), 0, 0, ev); reveal(o); },
      onBlur: () => { if (o.scene && o.active) o.emit('pointerout', fake(o), 0, 0, ev); } });
    let modal = false;
    /** Todo lo pulsable y visible; si hay una capa modal, solo lo de esa capa. */
    const collect = () => {
      const cands = [], blockers = [];
      const big = (o) => { const r = rectOf(o); return r.w >= 1000 && r.h >= 560; };
      const walk = (list) => {
        for (const o of list) {
          if (!o || !o.active) continue;
          if (o.input && o.input.enabled && shown(o)) { if (big(o)) blockers.push(o); else if (clickable(o)) cands.push(o); }
          if (o.list && o.type === 'Container' && o.visible !== false) walk(o.list);
        }
      };
      walk(scene.children.list.concat(Overlay.owned(scene)));   // también sus ventanas del Overlay
      let topD = -Infinity;
      blockers.forEach((b) => { topD = Math.max(topD, rootOf(b).depth || 0); });
      modal = blockers.some((b) => (rootOf(b).depth || 0) > 0);
      const sr = opts.scroll && opts.scroll.root;
      return cands.filter((o) => {
        if (blockers.length && (rootOf(o).depth || 0) < topD) return false;
        if (sr && inside(o, sr)) return true;
        const r = rectOf(o);
        return r.x + r.w > 0 && r.x < 1280 && r.y + r.h > 0 && r.y < 720 && r.w > 2 && r.h > 2;
      });
    };
    const reveal = (o) => {
      const S = opts.scroll;
      if (!S || !inside(o, S.root)) return;
      const r = rectOf(o), top = S.top, bottom = S.bottom;
      if (r.y < top) S.set(S.get() + (top - r.y) + 8);
      else if (r.y + r.h > bottom) S.set(S.get() - (r.y + r.h - bottom) - 8);
    };
    const btns = (items) => items.filter((it) => typeof it.obj.press === 'function' && (!it.obj.isEnabled || it.obj.isEnabled()));
    const pickMain = (items) => {
      if (!items.length) return null;
      if (!modal && opts.main) { const o = opts.main(items); const it = o && items.find((x) => x.obj === o); if (it) return it; }
      const b = btns(items).filter((it) => !it.obj.noMain);   // nunca la barra superior (Mazo, Menú, ⚙)
      return b.find((it) => it.obj.variant === 'primary')
        || items.find((it) => it.obj.cardData) || b.find((it) => !BACK_RE.test(it.obj.labelText ? it.obj.labelText() : ''))
        || b[0] || items[0];
    };
    const backItem = (items) => root.CM_FocusManager.backOf(btns(items)) || btns(items).find((it) => BACK_RE.test(it.obj.labelText ? it.obj.labelText() : ''));
    let wasModal = false;
    const refresh = () => {
      const objs = collect();
      const raw = opts.items && !modal ? opts.items() : objs.map((o) => (fm.items.find((it) => it.obj === o) || item(o)));
      fm.items = raw.filter((it) => it && it.obj && shown(it.obj));
      const same = modal === wasModal && fm.cur && fm.items.find((it) => it.obj === fm.cur.obj);
      if (same) fm.cur = same;
      else fm.focus(pickMain(fm.items));
      wasModal = modal;
      return fm.items;
    };
    const api = {
      fm, refresh, activate, rectOf, collect, isModal: () => modal, manual: !!opts.manual,
      /** Gestiona la acción; devuelve true si la ha usado. */
      handle(a) {
        refresh();   // antes de nada: ¿hay una ventana abierta? (si se acaba de abrir, sus botones mandan, no los atajos de la pantalla)
        if (opts.onAction && !modal && opts.onAction(a, api)) return true;
        const items = refresh();
        if (['up', 'down', 'left', 'right'].includes(a)) {
          if (fm.move(a)) return true;
          const S = opts.scroll;
          if (S && !modal && (a === 'up' || a === 'down')) { S.set(S.get() + (a === 'up' ? 1 : -1) * (S.step || 120)); return true; }
          return false;
        }
        if (a === 'confirm') { if (fm.cur) fm.confirm(); else if (opts.confirm) opts.confirm(); return true; }
        if (a === 'next' || a === 'prev') return fm.tab(a === 'next' ? 1 : -1);
        if (a === 'back') {
          const b = backItem(items);
          if (modal) { if (b) b.obj.press(); else if (scene._potionMenu) scene._potionMenu.close(); else if (opts.modalBack) opts.modalBack(); return true; }
          if (opts.back) { opts.back(); return true; }
          if (b) { b.obj.press(); return true; }
          return false;
        }
        if ((a === 'tabPrev' || a === 'tabNext') && opts.tab && !modal) { opts.tab(a === 'tabPrev' ? -1 : 1); return true; }
        return false;
      },
      /** Solo si hay una capa modal abierta (menús encima de una escena con navegación propia). */
      handleModal(a) { if (!manualSync()) return false; api.handle(a); return true; }
    };
    /** Modo manual (la escena navega por su cuenta): solo actúa mientras haya una capa modal. */
    const manualSync = () => {
      collect();
      if (modal) { refresh(); return true; }
      if (fm.cur) fm.focus(null);
      fm.items = []; wasModal = false;
      return false;
    };
    // Glifos: A junto a lo enfocado y B junto al botón de volver (solo con mando)
    const drawGlyphs = () => {
      gl.clear();
      if (Input.device !== 'pad') return;
      const b = backItem(fm.items), bo = (!modal && opts.backObj && opts.backObj()) || (b && b.obj);
      if (bo && (!fm.cur || bo !== fm.cur.obj) && shown(bo)) { const r = rectOf(bo); padGlyph(gl, r.x - 2, r.y - 2, 'B', 12); }
      if (opts.tab && !modal && opts.tabRect) { const r = opts.tabRect(); if (r) { padGlyph(gl, r.x - 22, r.y + r.h / 2, 'LB', 11); padGlyph(gl, r.x + r.w + 22, r.y + r.h / 2, 'RB', 11); } }
    };
    // Validación continua: el foco nunca queda en algo destruido u oculto
    let acc = 0;
    const tick = (t, dt) => {
      acc += dt || 16;
      if (fm.cur && !shown(fm.cur.obj)) { fm.cur = null; acc = 999; }
      if (acc > 200) { acc = 0; if (!opts.manual) refresh(); else manualSync(); }
      drawGlyphs();
    };
    scene.events.on('update', tick);
    scene.events.once('shutdown', () => scene.events.off('update', tick));
    if (!opts.manual) {
      Input.bind(scene, (a) => { api.handle(a); }, { keys: !!opts.keys, soft: opts.softKeys !== false });
      scene.time.delayedCall(0, refresh);
    }
    scene._padNav = api;
    return api;
  }

  /* =================================================================
   * Lo que se ve en pantalla (todas las escenas activas): rectángulos de textos, paneles e imágenes.
   * Lo usan la colocación de los consejos y el test de solapes (test/overlap.js).
   * ================================================================= */
  // Comandos de Graphics de Phaser 3.80 → nº de argumentos (Phaser no da bounds de un Graphics: se calculan aquí)
  const GCMD_ARGS = { 0: 7, 1: 0, 2: 0, 3: 4, 4: 2, 5: 2, 6: 3, 7: 2, 8: 0, 9: 0, 10: 6, 11: 6, 14: 0, 15: 0, 16: 2, 17: 2, 18: 1, 21: 8, 22: 6 };
  /** Rectángulo local de un Graphics y si tiene relleno opaco (≥ 0.3). null si no dibuja nada. */
  function graphicsBox(g) {
    const cb = g.commandBuffer || [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, filled = false, fillA = 0, maxA = 0;
    const add = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
    for (let i = 0; i < cb.length;) {
      const op = cb[i], n = GCMD_ARGS[op];
      if (n === undefined) return null;   // comando desconocido: mejor no adivinar
      const a = cb.slice(i + 1, i + 1 + n);
      if (op === 0) { add(a[0] - a[2], a[1] - a[2]); add(a[0] + a[2], a[1] + a[2]); }
      else if (op === 3) { add(a[0], a[1]); add(a[0] + a[2], a[1] + a[3]); if (fillA >= 0.3) filled = true; maxA = Math.max(maxA, fillA); }
      else if (op === 4 || op === 5) add(a[0], a[1]);
      else if (op === 7) fillA = a[1];
      else if (op === 21) fillA = Math.max(a[0], a[1], a[2], a[3]);
      else if (op === 8 || op === 10) { if (op === 10) { add(a[0], a[1]); add(a[2], a[3]); add(a[4], a[5]); } if (fillA >= 0.3) filled = true; maxA = Math.max(maxA, fillA); }
      else if (op === 11) { add(a[0], a[1]); add(a[2], a[3]); add(a[4], a[5]); }
      i += 1 + n;
    }
    return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0, filled, alpha: maxA };
  }
  const visibleChain = (o) => { for (let p = o; p; p = p.parentContainer) if (!p.active || p.visible === false || p.alpha < 0.05) return false; return true; };
  const effAlpha = (o) => { let a = 1; for (let p = o; p; p = p.parentContainer) a *= p.alpha; return a; };
  const worldBox = (o, b) => {   // rectángulo local → coordenadas de pantalla (con la transformación de sus contenedores)
    const m = o.getWorldTransformMatrix ? o.getWorldTransformMatrix() : null;
    if (!m) return { x: o.x + b.x, y: o.y + b.y, w: b.w, h: b.h };
    const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y]) => m.transformPoint(x, y));
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };
  /**
   * Todo lo visible de las escenas activas, en orden de dibujo (de abajo arriba).
   * Cada entrada: { obj, scene, kind: 'text'|'panel'|'image', x, y, w, h, order, root }.
   * opts.skip: contenedor a ignorar (p. ej. el propio globo). Ignora fondos de pantalla completa y partículas (ADD).
   */
  function scanScreen(game, opts = {}) {
    const out = [], covers = [];
    const scenes = game.scene.getScenes(true);
    let order = 0;
    const SCREEN = { x: 0, y: 0, w: 1280, h: 720 };
    const full = (r) => r.w >= 1000 && r.h >= 560;
    const clipTo = (r, c) => {
      if (!c) return r;
      const x0 = Math.max(r.x, c.x), y0 = Math.max(r.y, c.y), x1 = Math.min(r.x + r.w, c.x + c.w), y1 = Math.min(r.y + r.h, c.y + c.h);
      return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
    };
    scenes.forEach((sc, si) => {
      const push = (o, kind, r, root, clip, alpha) => {
        if (!r) return;
        if (r.width !== undefined) r = { x: r.x, y: r.y, w: r.width, h: r.height };
        r = clipTo(r, clip);
        if (r && r.w > 1 && r.h > 1) out.push({ obj: o, scene: sc.sys.settings.key, sceneIndex: si, kind, x: r.x, y: r.y, w: r.w, h: r.h, order, depth: root.depth || 0, root, alpha, clipped: !!clip });
      };
      const walk = (list, root, clip) => {
        const sorted = list.slice().sort((p, q) => (p.depth || 0) - (q.depth || 0));   // así dibuja Phaser (estable)
        for (const o of sorted) {
          if (!o || !o.active || o.visible === false || o === opts.skip) continue;
          const rt = root || o;
          order++;
          const a = effAlpha(o);
          if (o.type === 'Container') {
            let c = clip;
            if (o.mask && o.mask.geometryMask) { const mb = graphicsBox(o.mask.geometryMask); if (mb) c = clipTo(c || SCREEN, mb) || { x: 0, y: 0, w: 0, h: 0 }; }   // lista con desplazamiento
            if (o.scrollRoot) c = clipTo(c || SCREEN, SCREEN) || { x: 0, y: 0, w: 0, h: 0 };                                               // mundo del mapa
            walk(o.list, rt, c);
            if (o.input && o.input.enabled && (o.press || o.cardData)) push(o, 'panel', hitRect(o), rt, c, a);
            continue;
          }
          if (a < 0.3 || o.blendMode === Phaser.BlendModes.ADD || o.blendMode === 1) continue;
          let r = null, kind = null, al = a;
          if (o.type === 'Text') { if (String(o.text).trim()) { r = o.getBounds(); kind = 'text'; } }
          else if (o.type === 'Graphics') { const b = graphicsBox(o); if (b && b.filled) { r = worldBox(o, b); kind = 'panel'; al = a * b.alpha; } }
          else if (o.type === 'Rectangle' || o.type === 'Arc' || o.type === 'Ellipse') { if (o.isFilled && o.fillAlpha >= 0.3) { r = o.getBounds(); kind = 'panel'; al = a * o.fillAlpha; } }
          else if (o.type === 'Image' || o.type === 'Sprite') { r = o.getBounds(); kind = 'image'; }
          if (!r) continue;
          const rr = r.width !== undefined ? { x: r.x, y: r.y, w: r.width, h: r.height } : r;
          if (full(rr)) { if (kind !== 'text' && al >= 0.5) covers.push({ obj: o, scene: sc.sys.settings.key, order, alpha: al, root: rt }); continue; }   // fondos y oscurecidos
          push(o, kind, rr, rt, clip, al);
        }
      };
      walk(sc.children.list, null, null);
    });
    if (opts.withCovers) return { items: out, covers };
    return out;
  }
  const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

  /**
   * Coloca el globo (bw×bh) junto a la zona r: prueba abajo, arriba, derecha, izquierda y las 4 esquinas
   * (con varias alineaciones) y elige la que menos tapa (textos > paneles > imágenes). Nunca tapa la zona
   * señalada y siempre queda dentro de 1280×720 con 12 px de margen.
   */
  /** ¿Es un panel de fondo que contiene entera la zona señalada? (el globo puede ir sobre su parte vacía) */
  const backdropOf = (o, r) => !!r && o.kind === 'panel' && o.x <= r.x + 8 && o.y <= r.y + 8 && o.x + o.w >= r.x + r.w - 8 && o.y + o.h >= r.y + r.h - 8 && o.w * o.h > 1.3 * r.w * r.h;
  function placeBubble(game, r, bw, bh, skip) {
    const SW = 1280, SH = 720, M = 12, gap = 18;
    const W = { text: 3, panel: 2, image: 0.15 };   // tapar arte (personajes) importa poco; textos y paneles, mucho
    const occ = scanScreen(game, { skip }).map((o) => {   // lo que se mece (intención del enemigo) ocupa todo su recorrido
      const p = o.root && o.root.bobPad; return p ? { ...o, y: o.y - p, h: o.h + p * 2 } : o;
    }).filter((o) => {
      if (!r) return true;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;   // lo que está DENTRO de la zona señalada no cuenta (no se puede tapar)
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) return false;
      return !backdropOf(o, r);   // el panel de fondo que envuelve la zona (diálogo de evento…) tampoco: el globo puede ir dentro
    });
    const cl = (x, y) => ({ x: Phaser.Math.Clamp(x, M, SW - bw - M), y: Phaser.Math.Clamp(y, M, SH - bh - M) });
    const cands = [];
    if (!r) {
      for (const [fx, fy] of [[0.5, 0.5], [0.5, 0.3], [0.5, 0.7], [0.25, 0.5], [0.75, 0.5]]) cands.push(cl(SW * fx - bw / 2, SH * fy - bh / 2));
    } else {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const xs = [cx - bw / 2, r.x, r.x + r.w - bw], ys = [cy - bh / 2, r.y, r.y + r.h - bh];
      for (let k = -6; k <= 6; k++) if (k) { xs.push(cx - bw / 2 + k * 32); ys.push(cy - bh / 2 + k * 24); }   // deslizado a lo largo del lado
      xs.forEach((x) => cands.push(cl(x, r.y + r.h + gap)));         // abajo
      xs.forEach((x) => cands.push(cl(x, r.y - gap - bh)));          // arriba
      ys.forEach((y) => cands.push(cl(r.x + r.w + gap, y)));         // derecha
      ys.forEach((y) => cands.push(cl(r.x - gap - bw, y)));          // izquierda
      cands.push(cl(r.x + r.w + gap, r.y + r.h + gap), cl(r.x - gap - bw, r.y + r.h + gap),
        cl(r.x + r.w + gap, r.y - gap - bh), cl(r.x - gap - bw, r.y - gap - bh));   // esquinas
    }
    // Rejilla de toda la pantalla: si junto a la zona no hay hueco, el más cercano que esté libre
    const adj = cands.length;
    for (let y = M; y <= SH - bh - M; y += 24) for (let x = M; x <= SW - bw - M; x += 32) cands.push({ x, y });
    let best = null;
    const tc = r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : { x: SW / 2, y: SH / 2 };
    cands.forEach((c, i) => {
      const box = { x: c.x, y: c.y, w: bw, h: bh };
      if (r && inter(box, { x: r.x - 4, y: r.y - 4, w: r.w + 8, h: r.h + 8 }) > 0) return;   // nunca encima de la zona
      let cover = 0;
      for (const o of occ) { const a = inter(box, o); if (a > 0) cover += a * W[o.kind] + (o.kind !== 'image' && a > 4 ? 3000 : 0); }   // tapar un texto o panel, aunque sea un poco, casi nunca compensa
      // Lejos de la zona penaliza un poco (y algo más fuera de las posiciones pegadas a ella)
      const d = Math.hypot(c.x + bw / 2 - tc.x, c.y + bh / 2 - tc.y), score = cover + d * 2 + (i >= adj ? 400 : 0);
      if (!best || score < best.score - 0.5) best = { ...c, score, cover, i };
    });
    if (!best) {   // no hay sitio sin tapar la zona (zona enorme): abajo del todo, centrado
      const c = cl(SW / 2 - bw / 2, SH - bh - M); best = { ...c, score: Infinity, cover: Infinity, i: -1 };
    }
    return best;
  }

  /* =================================================================
   * Consejos (TipBubble): oscurece la pantalla salvo la zona señalada y
   * muestra un globo de pergamino con flecha, «Entendido» y «Saltar consejos».
   * Bloquea los clics de debajo; Enter, Espacio o Esc lo cierran.
   * ================================================================= */
  const TIP_DEPTH = LAYER.tip;
  const INK = 0x2b1b0e;                       // tinta sobre pergamino
  /** ¿Hay un consejo abierto en esta escena? Las escenas lo usan para ignorar teclado y arrastres. */
  const tipOpen = (scene) => !!(scene && ((scene._tipQ && scene._tipQ.open) || scene._settingsOpen || scene._potionMenu));   // también con el panel ⚙ o el menú de poción abiertos

  /**
   * Muestra un globo. rect: { x, y, w, h } de la zona señalada (o null para centrarlo sin hueco).
   * onClose(skipped): skipped = true si se pulsó «Saltar consejos».
   */
  function tipBubble(scene, { rect, text, onClose }) {
    if (scene._gloss) scene._gloss.hide();   // el glosario de la carta señalada se cierra: un consejo nunca lo tapa
    const S = Overlay.S(scene);   // siempre encima de todas las escenas
    const SW = 1280, SH = 720, M = 12, pad = 8, gap = 18;
    const r = rect ? { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 } : null;
    const layer = Overlay.own(scene, S.add.container(0, 0).setDepth(TIP_DEPTH));
    Overlay.tipOpen = true; Overlay.tipLayer = layer;
    layer.once('destroy', () => { if (Overlay.tipLayer && Overlay.tipLayer !== layer) return; Overlay.tipOpen = false; Overlay.tipBounds = null; Overlay.tipLayer = null; Overlay.pumpToasts(); });   // un globo viejo que acaba de cerrarse no borra el nuevo

    // 1) Capa que captura todos los clics (topOnly: nada de debajo los recibe)
    const blocker = S.add.zone(0, 0, SW, SH).setOrigin(0, 0).setInteractive();
    // 2) Oscurecido con hueco: cuatro rectángulos alrededor de la zona
    const dark = S.add.graphics();
    dark.fillStyle(0x000000, 0.5);
    if (r) {
      const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(SW, r.x + r.w), y1 = Math.min(SH, r.y + r.h);
      dark.fillRect(0, 0, SW, y0); dark.fillRect(0, y1, SW, SH - y1);
      dark.fillRect(0, y0, x0, y1 - y0); dark.fillRect(x1, y0, SW - x1, y1 - y0);
    } else dark.fillRect(0, 0, SW, SH);
    layer.add([blocker, dark]);
    if (r) {
      const hl = S.add.graphics();
      hl.lineStyle(3, C.gold, 1); hl.strokeRoundedRect(r.x, r.y, r.w, r.h, 12);
      S.tweens.add({ targets: hl, alpha: { from: 1, to: 0.35 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      layer.add(hl);
    }

    // 3) Texto: tamaños posibles del globo (ancho 470/540/620 con 2 líneas; estrechos con 3-4 líneas)
    const t = T(S, 0, 0, text, { size: 18, wrap: 430, ox: 0, oy: 0, color: INK, lineSpacing: 2 });
    const lines = () => t.getWrappedText(text).length;
    const fit = (bw, maxLines) => {   // letra de 18 a 14 hasta que quepa en maxLines
      let size = 18; t.setFontSize(size); t.setWordWrapWidth(bw - 40, true);
      while (lines() > maxLines && size > 14) { size--; t.setFontSize(size); t.setWordWrapWidth(bw - 40, true); }
      return lines() <= maxLines ? { bw, size, bh: 22 + t.height + 16 + 34 + 16 } : null;
    };
    const variants = [[470, 2], [540, 2], [620, 2], [400, 3], [340, 4], [236, 4]].map(([w, l]) => fit(w, l)).filter(Boolean);   // el estrecho: rincones (p. ej. sobre la Esencia de la pantalla final)
    if (!variants.length) variants.push(fit(620, 9));

    // 4) Posición: la que menos tapa de todas las escenas (ver placeBubble); a igualdad, el globo más ancho
    const game = S.sys.game;
    let pick = null;
    for (const v of variants) {
      const p = placeBubble(game, r, v.bw, v.bh, layer);
      if (!pick || p.cover < pick.p.cover - 0.5 || (Math.abs(p.cover - pick.p.cover) <= 0.5 && p.score < pick.p.score - 0.5)) pick = { v, p };
      if (p.cover === 0 && p.i < 14) break;   // libre y pegado a la zona: no hace falta probar más tamaños
    }
    const BW = pick.v.bw, BH = pick.v.bh;
    t.setFontSize(pick.v.size); t.setWordWrapWidth(BW - 40, true);
    const bx = pick.p.x, by = pick.p.y;
    const cx = r ? r.x + r.w / 2 : SW / 2, cy = r ? r.y + r.h / 2 : SH / 2;
    // Lado de la flecha: el borde del globo que mira a la zona señalada
    let side = null;
    if (r) {
      const gaps = { below: by - (r.y + r.h), above: r.y - (by + BH), right: bx - (r.x + r.w), left: r.x - (bx + BW) };
      side = Object.keys(gaps).filter((k) => gaps[k] >= -2).sort((p, q) => gaps[p] - gaps[q])[0] || 'below';
    }
    Overlay.tipBounds = { x: bx, y: by, w: BW, h: BH, target: r };
    Overlay.tipLayer = layer; Overlay.tipText = t;

    const bub = S.add.container(bx, by);
    const g = S.add.graphics();
    g.fillStyle(0x000000, 0.35); g.fillRoundedRect(3, 5, BW, BH, 12);
    g.fillStyle(C.parch, 1); g.fillRoundedRect(0, 0, BW, BH, 12);
    g.lineStyle(3, C.gold, 1); g.strokeRoundedRect(0, 0, BW, BH, 12);
    g.lineStyle(1, 0xc9a86a, 0.8); g.strokeRoundedRect(5, 5, BW - 10, BH - 10, 9);
    // Flecha: sale del punto del borde del globo más cercano a la zona y apunta a su centro
    if (side) {
      const ax = Phaser.Math.Clamp(cx - bx, 26, BW - 26), ay = Phaser.Math.Clamp(cy - by, 22, BH - 22);
      const base = side === 'below' ? [ax, 0] : side === 'above' ? [ax, BH] : side === 'right' ? [0, ay] : [BW, ay];
      const dx = cx - (bx + base[0]), dy = cy - (by + base[1]), len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const along = side === 'below' || side === 'above' ? [1, 0] : [0, 1];   // la base del triángulo va pegada al borde
      const tip = [base[0] + ux * 16, base[1] + uy * 16];
      const tri = [base[0] - along[0] * 12, base[1] - along[1] * 12, base[0] + along[0] * 12, base[1] + along[1] * 12, tip[0], tip[1]];
      const out = [ux * 2, uy * 2];
      g.fillStyle(C.gold, 1); g.fillTriangle(tri[0], tri[1], tri[2], tri[3], tri[4] + out[0], tri[5] + out[1]);
      g.fillStyle(C.parch, 1); g.fillTriangle(tri[0] - out[0] * 0.5, tri[1] - out[1] * 0.5, tri[2] - out[0] * 0.5, tri[3] - out[1] * 0.5, tri[4], tri[5]);
    }
    t.setPosition(20, 20);
    let closed = false;
    const close = (skipped) => {
      if (closed) return;
      closed = true;
      if (scene._tipClose === close) scene._tipClose = null;
      S.input.keyboard && S.input.keyboard.off('keydown', onKey);
      S.tweens.add({ targets: layer, alpha: 0, duration: 140, onComplete: () => layer.destroy() });
      onClose && onClose(skipped);
    };
    const ok = button(S, BW - 20 - 66, BH - 16 - 17, _t('u.entendido'), () => close(false), { w: 132, h: 34, size: 18, variant: 'primary' });
    scene._tipClose = close;   // el mando (A/B) también lo cierra
    const skip = T(S, 20, BH - 16 - 17, _t('u.saltar_consejos'), { size: 14, ox: 0, color: 0x7a5a36, style: 'italic' });
    skip.setInteractive({ useHandCursor: true });
    skip.on('pointerover', () => skip.setColor(hex(C.ember)));
    skip.on('pointerout', () => skip.setColor('#7a5a36'));
    skip.on('pointerup', () => { Sfx.play('click'); close(true); });
    bub.add([g, t, ok, skip]);
    layer.add(bub);
    Overlay.tipBub = bub;

    // Teclado. Se cierra en el siguiente fotograma para que el resto de oyentes de esta misma
    // pulsación (p. ej. Espacio = terminar turno en combate) vean todavía el consejo abierto.
    const onKey = (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Escape') {
        if (ev.preventDefault) ev.preventDefault();
        S.time.delayedCall(0, () => close(false));
      }
    };
    if (S.input.keyboard) S.input.keyboard.on('keydown', onKey);

    layer.setAlpha(0);
    S.tweens.add({ targets: layer, alpha: 1, duration: 160 });
    S.tweens.add({ targets: bub, y: { from: by + (side === 'above' ? -8 : 8), to: by }, duration: 220, ease: 'Back.out' });
    return { close, bounds: { x: bx, y: by, w: BW, h: BH } };
  }

  /**
   * Cola de consejos de una escena: salen de uno en uno y solo cuando ready() lo permite
   * (p. ej. sin animaciones en marcha). item: { id, text, rect (objeto o función), canShow?, onClose? }.
   */
  function tips(scene) {
    if (scene._tipQ) return scene._tipQ;
    const q = scene._tipQ = {
      items: [], open: false, current: null, timer: null, ready: () => true,
      setReady(fn) { q.ready = fn; return q; },
      push(item) {
        if (item.id && ((q.current && q.current.id === item.id) || q.items.some((i) => i.id === item.id))) return q;
        q.items.push(item);
        q.pump();
        return q;
      },
      pump() {
        if (q.open || q.timer || !q.items.length) return;
        // Espera: animaciones de la escena (ready), una ventana abierta, el mazo (DeckView), un cambio de escena
        // u otro consejo en cualquier escena. Así un consejo nunca sale tapado ni encima de otra ventana.
        if (!q.ready() || Overlay.busy(scene)) { q.timer = scene.time.delayedCall(150, () => { q.timer = null; q.pump(); }); return; }
        const item = q.items.shift();
        if (item.canShow && !item.canShow()) { q.pump(); return; }
        q.open = true; q.current = item;
        const rect = typeof item.rect === 'function' ? item.rect() : item.rect;
        tipBubble(scene, { rect, text: item.text, onClose: (skipped) => {
          q.open = false; q.current = null;
          if (skipped) q.items.length = 0;
          if (item.onClose) item.onClose(skipped);
          q.timer = scene.time.delayedCall(250, () => { q.timer = null; q.pump(); });
        } });
      }
    };
    scene.events.once('shutdown', () => { scene._tipQ = null; });
    return q;
  }

  root.CM_UI = {
    C, F, TH, FRAME_IDS, sceneBackdrop, cardSnapshot, ICON_FILES, ICON_BASE, icK, InlineIcons, INLINE, hex, T, codeShow, fitText, fitLine, Pool, vibrate, upgradeDiff, upgradeCompare, tw, wait, Store, saveRun, loadRun, saveKeyOf, SAVE_KEY, CUSTOM_SAVE_KEY, RUN_AT_KEY, textBox, copyOrShow, drawFlask, flyPotion, potionBreak, openPotionMenu: potionMenu, Sfx, Music, ambientLoop, Vol, openSettings, openProgress, saveSummaryText, gearButton, langButton, openLangMenu, changeLang, SFX_FILES, MUSIC_FILES,
    makeTextures, backdrop, fireflies, snowfall, heightScale, tooltip, TIP_DELAY, gloss, glossName, glossDesc, glossFind, keywordIds, button, cardView, CARD_W, CARD_H, get KEYWORDS() { return keywordsNow(); }, kwTerm, kwDesc, keywordTips, keywordLine, hasKeyword, glossary,
    hpBar, floatText, popNumber, burst, Fx, banner, toast, questToast, Look, lookColor, cardBackKey, hud, TYPE_COLOR, TYPE_LABEL, cardColor, contractTipText, contractRewardText,
    essenceGem, Live, LAYER, Overlay, overlay: Overlay, scanScreen, placeBubble, backdropOf, graphicsBox, tipBubble, tips, tipOpen, Input, focusManager, buttonsAsFocus, padGlyph, padNav, RUNE_COL, Opts, setOpt, cycleSpeed, get SHORTCUTS() { return shortcuts(); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
