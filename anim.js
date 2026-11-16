/*
 * Carticas Mágicas — anim.js
 * Pase de animaciones: SOLO presentación (nunca toca el motor ni el estado de la partida).
 *
 * Reglas comunes:
 *  - «Velocidad de animación»: las escenas escalan tweens y temporizadores (timeScale); aquí las
 *    duraciones son las de ×1 y lo que usa tiempo real (cámara) se divide por la velocidad.
 *  - «Reducir movimiento»: sin temblores, destellos (bloom), zoom/movimiento de cámara ni parallax.
 *  - Efectos WebGL (postFX/preFX de Phaser 3.80): si el objeto no los tiene (Canvas), se omiten.
 *  - Partículas: todas pasan por U.Live (tope ≈150 vivas en total).
 */
(function (root) {
  'use strict';
  const U = root.CM_UI, C = U.C, Live = U.Live, LY = U.LAYER;
  const rm = () => U.Opts.reduceMotion;
  /** ¿Hay WebGL? (en Canvas los objetos también tienen postFX/preFX, pero sus métodos fallan). */
  const gl = (scene) => !!scene && scene.sys.game.renderer.type === Phaser.WEBGL;
  const sp = () => U.Opts.speed || 1;

  /* ------------------------------------------------------------------ *
   * Transiciones entre escenas: fundido de ~250 ms (120 de salida + 130 de entrada)
   * Se envuelve ScenePlugin.start (no restart ni launch: superposiciones y reinicios siguen al instante).
   * La escena nueva recibe además la velocidad de animación en sus tweens y temporizadores.
   * ------------------------------------------------------------------ */
  const OVERLAYS = new Set(['DeckView', 'Overlay', 'News']);
  const FADE_OUT = 120, FADE_IN = 130;
  function onEnter(scene) {
    const key = scene.sys.settings.key;
    if (key !== 'Combat' && key !== 'Boot') {   // el combate ya aplica la velocidad él mismo
      scene.tweens.timeScale = sp(); scene.time.timeScale = sp();
      scene.events.once('shutdown', () => { scene.tweens.timeScale = 1; scene.time.timeScale = 1; });
    }
    if (scene.cameras && scene.cameras.main) scene.cameras.main.fadeIn(FADE_IN / sp(), 0, 0, 0);
  }
  (function installTransitions() {
    const SP = Phaser.Scenes.ScenePlugin.prototype, origStart = SP.start;
    SP.start = function (key, data) {
      const from = this.scene;
      const target = key || this.key;
      const go = () => {
        if (from) from._leaving = false;
        origStart.call(this, key, data);
        const t = this.manager.getScene(target);
        if (t) t.sys.events.once('create', () => onEnter(t));
      };
      const fromKey = from && from.sys.settings.key;
      if (!from || !from.cameras || !from.sys.isActive() || OVERLAYS.has(fromKey) || fromKey === 'Boot') { go(); return this; }
      if (from._leaving) return this;   // un segundo clic durante el fundido no hace nada
      from._leaving = true;
      if (from.input) from.input.enabled = false;
      // La cámara pinta el fundido, pero el cambio de escena va por reloj real: con pocos FPS (o pestaña en
      // segundo plano) el fundido de cámara se alargaría y retrasaría el juego.
      from.cameras.main.fadeOut(FADE_OUT / sp(), 0, 0, 0);
      setTimeout(() => { if (from.input) from.input.enabled = true; go(); }, FADE_OUT / sp());
      return this;
    };
  })();

  /* ------------------------------------------------------------------ *
   * Vida en los personajes
   * ------------------------------------------------------------------ */
  /** Voladores: flotan subiendo y bajando en vez de respirar con los pies en el suelo. */
  const FLYERS = new Set(['fatuo', 'espejo', 'ojo', 'grimorio', 'murcielago', 'espiritu', 'hada', 'buho']);
  /**
   * Reposo de un sprite con origen abajo. kind: 'boss' (lenta y profunda), 'flyer' (flota), 'normal'.
   * Devuelve { pause(), resume() } para que los ataques puedan deformarlo sin pelearse con la respiración.
   */
  function idle(scene, sprite, base, kind = 'normal', opt = {}) {
    const y0 = sprite.y;
    const cfg = kind === 'boss' ? { amp: 0.03, dur: 2300 } : kind === 'flyer' ? { amp: 0.012, dur: 1500 } : { amp: 0.015, dur: 1300 };
    // Desfase: cada uno con su ritmo (±15 %) y empezando en un punto distinto del ciclo, para que nunca respiren a la vez
    const dur = cfg.dur * (0.85 + Math.random() * 0.3), amp = cfg.amp * (0.85 + Math.random() * 0.3);
    const tws = [scene.tweens.add({ targets: sprite, scaleY: base * (1 + amp), duration: dur, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: Math.random() * dur })];
    if (kind === 'flyer') tws.push(scene.tweens.add({ targets: sprite, y: y0 - 10, duration: 1700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: Math.random() * 900 }));
    const alive = (t) => t && !(t.isDestroyed && t.isDestroyed());   // otro código puede haber matado los tweens del sprite
    // Microgestos cada 3-6 s (giro pequeño, balanceo o parpadeo de brillo); nada con «Reducir movimiento»
    let gest = null, paused = false;
    const gesture = () => {
      gest = null;
      if (!sprite.scene || !sprite.active) return;
      if (!paused && !rm() && sprite.alpha > 0.5 && !sprite._noGesture) {
        const busy = scene.tweens.getTweensOf(sprite).filter((t) => !tws.includes(t)).length > 0;   // atacando, golpeado…: no
        if (!busy) {
          const k = Math.floor(Math.random() * 3), side = Math.random() < 0.5 ? -1 : 1;
          if (k === 0) scene.tweens.add({ targets: sprite, angle: side * (1.5 + Math.random() * 1.5), duration: 260, yoyo: true, ease: 'Sine.inOut' });   // giro
          else if (k === 1) scene.tweens.add({ targets: sprite, angle: { from: 0, to: side * 2.2 }, duration: 420, yoyo: true, repeat: 1, ease: 'Sine.inOut' });   // balanceo
          else scene.tweens.add({ targets: sprite, alpha: { from: 1, to: 0.82 }, duration: 110, yoyo: true, ease: 'Sine.inOut' });   // parpadeo de brillo
        }
      }
      if (!opt.noGestures) gest = scene.time.delayedCall(3000 + Math.random() * 3000, gesture);
    };
    if (!opt.noGestures) gest = scene.time.delayedCall(1500 + Math.random() * 4500, gesture);
    return {
      tweens: tws,
      pause() { paused = true; tws.forEach((t) => alive(t) && t.pause()); sprite.setScale(base); },
      resume() { paused = false; tws.forEach((t) => alive(t) && t.resume()); },
      stop() { paused = true; if (gest) gest.remove(false); gest = null; tws.forEach((t) => alive(t) && t.stop()); }
    };
  }
  const kindOf = (artId, tier) => (FLYERS.has(artId) ? 'flyer' : tier === 'boss' ? 'boss' : 'normal');

  /**
   * Ataque con anticipación: se encoge y retrocede, embiste con squash & stretch hacia el objetivo
   * y vuelve con Back.out. dir: −1 hacia la izquierda (enemigo), +1 hacia la derecha (jugador).
   * restX: posición de reposo. Promesa que se resuelve en el impacto (la vuelta sigue sola).
   */
  function lunge(scene, sprite, base, restX, dir, dist = 90, breath = null) {
    if (breath) breath.pause();
    // (no se usa killTweensOf: en 3.80 mata TODOS los tweens del sprite, también la respiración)
    const back = rm() ? 0 : 18;
    return new Promise((res) => {
      scene.tweens.chain({ targets: sprite, tweens: [
        { x: restX - dir * back, scaleX: base * 0.95, scaleY: base * 0.92, duration: 150, ease: 'Quad.out' },   // anticipación: atrás y agachado
        { x: restX + dir * dist, scaleX: base * 1.12, scaleY: base * 0.92, duration: 110, ease: 'Quad.in', onComplete: res },
        { x: restX, scaleX: base, scaleY: base, duration: 300, ease: 'Back.out', onComplete: () => breath && breath.resume() }
      ] });
    });
  }

  /** Daño recibido: se inclina hacia atrás y tiembla en proporción (la vuelta y el destello los pone la escena). */
  function recoil(scene, sprite, dmg, away) {
    if (dmg <= 0) return;
    const ang = away * Math.min(12, 3 + dmg * 0.35);
    scene.tweens.add({ targets: sprite, angle: { from: ang, to: 0 }, duration: 340, ease: 'Back.out' });
    if (rm()) return;
    const n = Math.min(4, 1 + Math.floor(dmg / 8)), amp = Math.min(6, 1.5 + dmg * 0.15);
    scene.tweens.add({ targets: sprite, y: sprite.y + amp, duration: 40, yoyo: true, repeat: n, ease: 'Sine.inOut' });
  }

  /** Brillo en la mano/bastón al lanzar una habilidad (halo del atlas fx con el color de la carta). */
  function castGlow(scene, x, y, color) {
    if (!scene.textures.exists('fx') || !Live.room(2)) return;
    const h = Live.track(scene.add.image(x, y, 'fx', 'halo').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(LY.units + 3).setScale(0.15).setAlpha(0.9));
    const t = Live.track(scene.add.image(x, y, 'fx', 'twinkle').setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth(LY.units + 3).setScale(0.1));
    scene.tweens.add({ targets: h, scale: 0.55, alpha: 0, duration: 520, ease: 'Quad.out', onComplete: () => h.destroy() });
    scene.tweens.add({ targets: t, scale: 0.35, angle: 90, alpha: 0, duration: 420, ease: 'Quad.out', onComplete: () => t.destroy() });
  }

  /* ------------------------------------------------------------------ *
   * Efectos WebGL
   * ------------------------------------------------------------------ */
  /** Glow suave: devuelve el controlador (o null sin WebGL). */
  function glow(obj, color, strength = 3) {
    if (!obj || !obj.postFX || !gl(obj.scene)) return null;
    return obj.postFX.addGlow(color, strength, 0, false, 0.1, 10);
  }
  function unglow(obj, fx) { if (obj && obj.postFX && fx && gl(obj.scene)) obj.postFX.remove(fx); }
  /** Brillo que cruza (reliquias, iconos importantes). */
  function shine(obj) {
    if (!obj || !obj.preFX || rm() || !gl(obj.scene)) return null;
    return obj.preFX.addShine(0.8, 0.35, 4);
  }
  /** Bloom breve sobre la cámara (golpes de 20+, cambios de fase). Nada con «Reducir movimiento». */
  function bloom(scene, strength = 1.6, dur = 420) {
    const cam = scene.cameras.main;
    if (rm() || !cam.postFX || !gl(scene)) return;
    if (scene._bloom) { cam.postFX.remove(scene._bloom); scene._bloom = null; }
    const b = scene._bloom = cam.postFX.addBloom(0xffffff, 1, 1, 0.6, strength, 4);   // poco desenfoque: realza los brillos sin lavar la escena
    scene.tweens.addCounter({ from: strength, to: 0, duration: dur, ease: 'Quad.out',
      onUpdate: (t) => { b.strength = t.getValue(); },
      onComplete: () => { if (scene._bloom === b) { cam.postFX.remove(b); scene._bloom = null; } } });
  }
  /** Textura de ruido para la distorsión de calor (se genera una vez). */
  function heatTexture(scene) {
    if (scene.textures.exists('heatnoise')) return 'heatnoise';
    const N = 64, cv = scene.textures.createCanvas('heatnoise', N, N), ctx = cv.getContext(), img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = 128 + 60 * Math.sin(x * 0.35 + y * 0.11) * Math.cos(y * 0.27 - x * 0.07), i = (y * N + x) * 4;
      img.data[i] = v; img.data[i + 1] = 255 - v; img.data[i + 2] = 128; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); cv.refresh();
    return 'heatnoise';
  }
  /** Distorsión de calor sobre un sprite (Sobrecalentamiento). on=false la quita. */
  function heat(scene, sprite, on) {
    if (!sprite || !sprite.preFX || !gl(scene)) return;
    if (on && !sprite._heat) {
      const fx = sprite._heat = sprite.preFX.addDisplacement(heatTexture(scene), 0.004, 0.004);
      const upd = (time) => { fx.x = 0.004 + 0.003 * Math.sin(time / 180); fx.y = 0.006 + 0.004 * Math.cos(time / 230); };
      sprite._heatUpd = upd;
      scene.events.on('update', upd);
    } else if (!on && sprite._heat) {
      sprite.preFX.remove(sprite._heat); sprite._heat = null;
      scene.events.off('update', sprite._heatUpd);
    }
  }

  /* ------------------------------------------------------------------ *
   * Ambiente por acto (detrás de los personajes) y parallax del fondo
   * ------------------------------------------------------------------ */
  /** Runas y motas violetas del Acto III. */
  function arcaneMotes(scene, depth = LY.world) {
    const glyphs = ['ᚠ', 'ᚱ', 'ᛟ', 'ᚦ', 'ᛉ', 'ᛗ'];
    const n = Live.room(10);
    for (let i = 0; i < n; i++) {
      const t = Live.track(scene.add.text(80 + Math.random() * 1120, 120 + Math.random() * 330, glyphs[i % glyphs.length],
        { fontFamily: 'serif', fontSize: `${18 + Math.random() * 14}px`, color: '#c9a8ff' }).setOrigin(0.5).setAlpha(0).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD));
      scene.tweens.add({ targets: t, alpha: { from: 0, to: 0.55 }, y: t.y - 30 - Math.random() * 30, angle: (Math.random() - 0.5) * 30,
        duration: 2600 + Math.random() * 2200, yoyo: true, repeat: -1, delay: Math.random() * 3000, ease: 'Sine.inOut' });
    }
    const m = Live.room(28);
    for (let i = 0; i < m; i++) {
      const d = Live.track(scene.add.image(Math.random() * 1280, 100 + Math.random() * 400, 'dot').setTint(i % 3 ? 0xb27bff : 0x7fb8ff)
        .setScale(0.1 + Math.random() * 0.16).setAlpha(0).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD));
      scene.tweens.add({ targets: d, alpha: { from: 0, to: 0.8 }, y: d.y - 40 - Math.random() * 60, x: d.x + (Math.random() - 0.5) * 50,
        duration: 2200 + Math.random() * 2600, yoyo: true, repeat: -1, delay: Math.random() * 2500, ease: 'Sine.inOut' });
    }
  }
  /** Capa de partículas del acto: I luciérnagas, II nieve, III runas y motas. */
  function ambient(scene, act) {
    if (act >= 3) arcaneMotes(scene, LY.world);
    else if (act === 2) U.snowfall(scene, 1280, 720, Live.room(55), LY.world).forEach((f) => Live.track(f));
    else {
      const before = scene.children.list.length;
      U.fireflies(scene, 0xffd27a, 1280, 720, Live.room(22));
      scene.children.list.slice(before).forEach((f) => { f.setDepth(LY.world); Live.track(f); });
    }
  }
  /** Parallax muy sutil del fondo (±3 px) siguiendo el ratón; nada con «Reducir movimiento». */
  function parallax(scene, layers, amp = 3) {
    if (rm() || !layers.length) return;
    const base = layers.map((l) => ({ x: l.x, y: l.y }));
    layers.forEach((l) => { if (l.setDisplaySize && l.displayWidth) l.setDisplaySize(l.displayWidth + amp * 4, l.displayHeight + amp * 4); });
    let tx = 0, ty = 0, cx = 0, cy = 0;
    const move = (p) => { tx = -((p.worldX - 640) / 640) * amp; ty = -((p.worldY - 360) / 360) * amp * 0.6; };
    const upd = () => {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      layers.forEach((l, i) => { l.x = base[i].x + cx; l.y = base[i].y + cy; });
    };
    scene.input.on('pointermove', move);
    scene.events.on('update', upd);
    scene.events.once('shutdown', () => { scene.events.off('update', upd); });
  }

  /* ------------------------------------------------------------------ *
   * Cambio de fase del jefe: cámara lenta, zoom ligero, el jefe se sacude y el texto entra con fuerza
   * ------------------------------------------------------------------ */
  async function bossPhase(scene, sprite, text, color = C.blood) {
    const tws = scene.tweens, base = tws.timeScale;
    const cam = scene.cameras.main;
    if (!rm()) {
      tws.timeScale = base * 0.35;   // cámara lenta (los tweens del resto de la escena)
      // zoom ×1,06 sobre la base R y un pelín hacia el jefe (con zoom 1,06 nunca se ve fuera del lienzo)
      root.CM_HIRES.camTo(cam, { f: 1.06, x: 640 + (sprite.x - 640) * 0.08, y: 350, duration: 260 / sp(), ease: 'Quad.easeOut' });
      bloom(scene, 1.1, 900);
      scene.shake && scene.shake(500, 0.008);
    }
    // El jefe se sacude (tiempo real: va en paralelo a la cámara lenta)
    const x0 = sprite.x;
    if (!rm()) for (let i = 0; i < 6; i++) setTimeout(() => { if (sprite.scene) sprite.x = x0 + (i % 2 ? -8 : 8) * (1 - i / 6); }, (i * 55) / sp());
    setTimeout(() => { if (sprite.scene) sprite.x = x0; }, 360 / sp());
    // Texto de fase: entra grande y se asienta
    const bg = scene.add.rectangle(640, 360, 1280, 130, 0x000000, 0.6).setDepth(LY.fx + 1800).setAlpha(0);
    const t = U.T(scene, 640, 360, text, { size: 66, font: 'display', color, stroke: 0x000000, strokeThickness: 7 }).setDepth(LY.fx + 1801).setAlpha(0);
    U.fitText(t, 1180, 0, 30);
    const s1 = t.scale; t.setScale(rm() ? s1 : s1 * 1.8);   // entra grande y se asienta
    await new Promise((res) => setTimeout(res, 160 / sp()));
    tws.timeScale = base;
    await new Promise((res) => {
      tws.add({ targets: bg, alpha: 1, duration: 140 });
      tws.add({ targets: t, alpha: 1, scale: s1, duration: 320, ease: 'Back.out', onComplete: res });
    });
    await new Promise((res) => scene.time.delayedCall(800, res));
    if (!rm()) root.CM_HIRES.camReset(cam, 300 / sp(), 'Quad.easeInOut');   // vuelve a zoom R, centro 640×360
    tws.add({ targets: [bg, t], alpha: 0, duration: 220, onComplete: () => { bg.destroy(); t.destroy(); } });
  }

  /* ------------------------------------------------------------------ *
   * Recompensas
   * ------------------------------------------------------------------ */
  /** Monedas que vuelan al contador de oro; el contador sube número a número. */
  function coins(scene, hud, x, y, from, to) {
    if (!hud || to === from) return;
    const n = Live.room(Math.min(12, 3 + Math.floor(Math.abs(to - from) / 8)));
    const gp = hud.goldPos, flight = 520;
    hud.countGold(from, to, flight + n * 45);
    for (let i = 0; i < n; i++) {
      const c = Live.track(scene.add.image(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 20, 'ic_coin').setIconScale(0.32).setDepth(LY.hud + 200));
      const mx = (x + gp.x) / 2 + (Math.random() - 0.5) * 140, my = Math.min(y, gp.y) - 40 - Math.random() * 60;
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(c.x, c.y), new Phaser.Math.Vector2(mx, my), new Phaser.Math.Vector2(gp.x, gp.y));
      const o = { t: 0 };
      scene.tweens.add({ targets: o, t: 1, delay: i * 45, duration: flight, ease: 'Quad.in',
        onUpdate: () => { const p = curve.getPoint(o.t); c.setPosition(p.x, p.y).setScale(0.32 - 0.12 * o.t); },
        onComplete: () => { c.destroy(); if (i % 3 === 0) U.Sfx.play('coin', { volume: 0.25 }); } });
    }
  }
  /** Un icono (reliquia) que vuela de (x,y) a la barra superior. */
  function flyIcon(scene, key, x, y, to, scale = 0.6, frame) {
    const ic = scene.add.image(x, y, key, frame).setIconScale(scale).setDepth(LY.hud + 200), k = U.icK(ic);   // k: icono PNG de 128 px
    const halo = scene.add.circle(x, y, 26, C.gold, 0.25).setDepth(LY.hud + 199).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: ic, scale: { from: scale * k, to: 0.38 * k }, duration: 520, ease: 'Cubic.inOut' });
    return new Promise((res) => scene.tweens.add({ targets: halo, x: to.x, y: to.y, scale: { from: scale, to: 0.38 }, duration: 520, ease: 'Cubic.inOut',
      onUpdate: () => { ic.x = halo.x; ic.y = halo.y; },
      onComplete: () => { ic.destroy(); halo.destroy(); U.burst(scene, to.x, to.y, C.gold, 8, 26); res(); } }));
  }
  /** Una poción dibujada que vuela a su hueco del cinturón. */
  function flyFlask(scene, potionId, x, y, to) {
    const d = root.CM_DATA.POTIONS[potionId];
    const g = scene.add.graphics().setDepth(LY.hud + 200).setPosition(x, y);
    U.drawFlask(g, d.shape, d.color, { scale: 1.3 });
    return new Promise((res) => scene.tweens.add({ targets: g, x: to.x, y: to.y + 2, scale: { from: 1, to: 0.62 }, angle: { from: 0, to: 360 }, duration: 520, ease: 'Cubic.inOut',
      onComplete: () => { g.destroy(); U.burst(scene, to.x, to.y, d.color, 8, 24); res(); } }));
  }
  /** Cofre: se sacude, se abre (salto y destello) y sale un haz de luz antes del objeto. */
  async function chestOpen(scene, chest) {
    const x = chest.x, y = chest.y, s = chest.scale;
    await new Promise((res) => scene.tweens.add({ targets: chest, angle: { from: -7, to: 7 }, duration: 60, yoyo: true, repeat: 4, onComplete: res }));
    chest.setAngle(0);
    await new Promise((res) => scene.tweens.add({ targets: chest, scaleX: s * 1.18, scaleY: s * 0.82, duration: 110, yoyo: true, ease: 'Quad.out', onComplete: res }));
    // Haz de luz: columna aditiva que crece hacia arriba + destellos
    const beam = scene.add.image(x, y + 10, scene.textures.exists('sumglow') ? 'sumglow' : 'dot').setOrigin(0.5, 1).setTint(0xffe7a0)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(LY.units + 5).setDisplaySize(90, 10).setAlpha(0.95);
    const ring = scene.add.circle(x, y - 10, 40, 0xfff2c2, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(LY.units + 5);
    scene.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 520, ease: 'Quad.out', onComplete: () => ring.destroy() });
    bloom(scene, 0.7, 500);
    await new Promise((res) => scene.tweens.add({ targets: beam, displayHeight: 420, displayWidth: 130, duration: 360, ease: 'Cubic.out', onComplete: res }));
    U.burst(scene, x, y - 40, C.gold, 26, 150);
    scene.tweens.add({ targets: beam, alpha: 0, displayWidth: 40, duration: 900, delay: 300, onComplete: () => beam.destroy() });
  }
  /** Objeto que sale del cofre: aparece pequeño en el haz y sube a su sitio. */
  function popOut(scene, objs, fromY) {
    objs.forEach((o, i) => {
      const y1 = o.y; o.setAlpha(0); if (o.setScale) o.setScale((o.scale || 1) * 0.4);
      const sc = (o.scale || 0.4) / 0.4;
      o.y = fromY;
      scene.tweens.add({ targets: o, y: y1, alpha: 1, scale: sc, duration: 420, delay: i * 40, ease: 'Back.out' });
    });
  }
  /** Esencia: gemitas que vuelan de (x,y) a la gema grande (gx,gy). */
  function essenceFly(scene, x, y, gx, gy, n = 3) {
    n = Live.room(n);
    for (let i = 0; i < n; i++) {
      const g = Live.track(scene.add.graphics().setDepth(LY.hud + 300).setPosition(x - 10 + Math.random() * 20, y));
      U.essenceGem(g, 0, 0, 6, 1);
      scene.tweens.add({ targets: g, x: gx, y: gy, scale: { from: 1, to: 0.5 }, delay: i * 60, duration: 380, ease: 'Cubic.in', onComplete: () => g.destroy() });
    }
  }

  /* ------------------------------------------------------------------ *
   * Mapa: la ficha del personaje viaja por el camino (saltitos y polvo) hasta el nodo
   * ------------------------------------------------------------------ */
  function travelToken(scene, token, to, onStep) {
    const x0 = token.x, y0 = token.y, dist = Phaser.Math.Distance.Between(x0, y0, to.x, to.y);
    const hops = Math.max(2, Math.min(5, Math.round(dist / 60)));
    const dur = 260 + hops * 150, o = { t: 0 };
    return new Promise((res) => scene.tweens.add({ targets: o, t: 1, duration: dur, ease: 'Sine.inOut',
      onUpdate: () => {
        const t = o.t, hop = rm() ? 0 : Math.abs(Math.sin(t * Math.PI * hops)) * 14;
        token.setPosition(x0 + (to.x - x0) * t, y0 + (to.y - y0) * t - hop);
        if (token.shadow) token.shadow.setPosition(token.x, y0 + (to.y - y0) * t + 30).setScale(1 - hop / 40);
        const k = Math.floor(t * hops * 2);
        if (k !== o.k) { o.k = k; if (k % 2 === 0 && Live.room(3)) dust(scene, token.x, y0 + (to.y - y0) * t + 30, token.parentContainer); }
        if (onStep) onStep(token.x, token.y);
      },
      onComplete: () => { token.setPosition(to.x, to.y); res(); } }));
  }
  function dust(scene, x, y, layer) {
    for (let i = 0; i < 3; i++) {
      const d = Live.track(scene.add.image(x + (Math.random() - 0.5) * 16, y, 'dot').setTint(0xd8c9a0).setScale(0.25).setAlpha(0.6));
      if (layer) layer.add(d);
      scene.tweens.add({ targets: d, x: d.x + (Math.random() - 0.5) * 30, y: y - 8 - Math.random() * 8, scale: 0.05, alpha: 0, duration: 380, onComplete: () => d.destroy() });
    }
  }

  root.CM_ANIM = { gl, onEnter, idle, kindOf, lunge, recoil, castGlow, glow, unglow, shine, bloom, heat, ambient, parallax, bossPhase,
    coins, flyIcon, flyFlask, chestOpen, popOut, essenceFly, travelToken, FLYERS };
})(typeof window !== 'undefined' ? window : globalThis);
