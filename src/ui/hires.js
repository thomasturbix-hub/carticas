/* =====================================================================
 * Carticas Mágicas — src/ui/hires.js
 * Render en alta resolución sin tocar coordenadas: el juego sigue maquetado en 1280×720 LÓGICOS,
 * pero el lienzo es 1280·R × 720·R píxeles reales y cada cámara hace zoom R.
 *
 *   R = clamp(round2(min(innerWidth·dpr / 1280, innerHeight·dpr / 720)), 1, 2.25)   (calidad «Automática»)
 *   «Alta» fuerza R = 2 · «Rendimiento» R = 1 (como antes). Se lee de cm_opts.gfx al arrancar.
 *   Prueba / comparación: ?res=1.5 en la URL (o window.CM_FORCE_R) fija R.
 *
 * Lo que hace este archivo (UNA vez, antes de crear el juego):
 *   · Cámaras: toda cámara nueva usa origen (0,0) y zoom R → el mundo visible es exactamente 0..1280 × 0..720.
 *   · Textos: todo add.text / make.text nace con resolution R (se rasteriza a la resolución real: nítido).
 *   · Temblor de cámara: la intensidad se corrige (Phaser la multiplica por el zoom dos veces).
 *   · Hi.camTo(): zoom/encuadre puntual (muerte de jefe, cambio de fase) que SUMA sobre R y vuelve a R.
 *   · Hi.genTex(): texturas generadas con Graphics a R× pero de tamaño lógico (NineSlice, reverso de carta…).
 * Las coordenadas de entrada en el juego son pointer.worldX / worldY (pointer.x/y son píxeles del lienzo).
 * ===================================================================== */
(function (root) {
  'use strict';
  const MAX_R = 2.25;
  const MODES = ['auto', 'high', 'perf'];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const round2 = (v) => Math.round(v * 100) / 100;

  /** Calidad elegida en Ajustes (cm_opts.gfx). Se lee sin depender de ui.js (este archivo carga antes). */
  function readMode() {
    try {
      const o = JSON.parse(root.localStorage.getItem('cm_opts') || 'null');
      return o && MODES.includes(o.gfx) ? o.gfx : 'auto';
    } catch (e) { return 'auto'; }
  }
  /** R automática: la que llena la pantalla real (CSS × devicePixelRatio) sin pasarse de 2,25. */
  function autoR() {
    const dpr = root.devicePixelRatio || 1;
    const w = root.innerWidth || 1280, h = root.innerHeight || 720;
    return clamp(round2(Math.min((w * dpr) / 1280, (h * dpr) / 720)), 1, MAX_R);
  }
  function forcedR() {
    let v = typeof root.CM_FORCE_R === 'number' ? root.CM_FORCE_R : NaN;
    try { const q = new URLSearchParams(root.location.search).get('res'); if (q) v = parseFloat(q); } catch (e) { /* sin URL */ }
    return Number.isFinite(v) ? clamp(round2(v), 1, 3) : null;
  }
  const mode = readMode();
  const R0 = forcedR() || (mode === 'perf' ? 1 : mode === 'high' ? 2 : autoR());
  // Lienzo en píxeles enteros; el zoom exacto de cada eje sale de ahí (1280·R puede no ser entero)
  const W = Math.round(1280 * R0), H = Math.round(720 * R0);
  const ZX = W / 1280, ZY = H / 720, R = ZX;

  const Hi = { R, W, H, ZX, ZY, mode, MODES, MAX_R, autoR, patched: false };

  /* ---------- Parches de Phaser (una vez) ---------- */
  function patch() {
    const P = root.Phaser;
    if (!P || Hi.patched) return;
    Hi.patched = true;

    // Cámaras: origen arriba-izquierda + zoom R. Con origen 0 y scroll 0 el mapeo es pantalla = mundo × R,
    // también para objetos con scrollFactor 0 (Overlay, capas fijas).
    const CM = P.Cameras.Scene2D.CameraManager.prototype, add0 = CM.add;
    CM.add = function () {
      const cam = add0.apply(this, arguments);
      cam.setOrigin(0, 0).setZoom(ZX, ZY);
      cam._hr = { f: 1, cx: 640, cy: 360 };
      return cam;
    };

    // Textos a resolución R (o la que pida el estilo, si es mayor)
    const withRes = (style) => {
      const s = Object.assign({}, style || {});
      if (!(s.resolution > R)) s.resolution = R;
      return s;
    };
    if (R !== 1) {
      const F = P.GameObjects.GameObjectFactory.prototype, t0 = F.text;
      F.text = function (x, y, text, style) { return t0.call(this, x, y, text, withRes(style)); };
      const Cr = P.GameObjects.GameObjectCreator.prototype, c0 = Cr.text;
      Cr.text = function (config, addToScene) { const cfg = Object.assign({}, config || {}); cfg.style = withRes(cfg.style); return c0.call(this, cfg, addToScene); };
      // Temblor: Phaser desplaza intensidad × ancho(=1280·R) × zoom en el espacio ya escalado (×R otra vez) → R³.
      // Queremos intensidad × 1280 × R (lo de antes, a la nueva escala): se divide entre R².
      const Sh = P.Cameras.Scene2D.Effects.Shake.prototype, s0 = Sh.start;
      Sh.start = function (duration, intensity, force, cb, ctx) {
        const k = 1 / (ZX * ZY);
        if (typeof intensity === 'number') intensity *= k;
        else if (intensity && typeof intensity === 'object') intensity = { x: intensity.x * k, y: intensity.y * k };
        return s0.call(this, duration, intensity, force, cb, ctx);
      };
    }
  }

  /**
   * Zoom / encuadre puntual de la cámara, relativo a R: f = 1 es el encuadre normal (todo 1280×720 visible),
   * f = 1,08 acerca un 8 %. (x, y) = punto lógico que queda en el centro. Tiempo real (no le afecta la cámara lenta).
   *   Hi.camTo(cam, { f, x, y, duration, ease })
   */
  function camTo(cam, o = {}) {
    if (!cam || !cam.scene) return;
    const st = cam._hr || (cam._hr = { f: 1, cx: 640, cy: 360 });
    const from = { f: st.f, cx: st.cx, cy: st.cy };
    const to = { f: o.f !== undefined ? o.f : from.f, cx: o.x !== undefined ? o.x : from.cx, cy: o.y !== undefined ? o.y : from.cy };
    const scene = cam.scene, dur = Math.max(1, o.duration || 0);
    const ease = root.Phaser.Tweens.Builders.GetEaseFunction(o.ease || 'Linear');
    const apply = (s) => {
      st.f = s.f; st.cx = s.cx; st.cy = s.cy;
      cam.setZoom(ZX * s.f, ZY * s.f);
      cam.setScroll(s.cx - 640 / s.f, s.cy - 360 / s.f);   // (x − scroll)·zoom: el punto (cx, cy) cae en el centro del lienzo
    };
    if (cam._hrUpd) { scene.events.off('update', cam._hrUpd); cam._hrUpd = null; }
    if (!o.duration) { apply(to); return; }
    let t = 0;
    const upd = (time, delta) => {
      if (!cam.scene) { scene.events.off('update', upd); return; }
      t += delta;
      const k = ease(Math.min(1, t / dur));
      apply({ f: from.f + (to.f - from.f) * k, cx: from.cx + (to.cx - from.cx) * k, cy: from.cy + (to.cy - from.cy) * k });
      if (t >= dur) { scene.events.off('update', upd); if (cam._hrUpd === upd) cam._hrUpd = null; }
    };
    cam._hrUpd = upd;
    scene.events.on('update', upd);
    scene.events.once('shutdown', () => scene.events.off('update', upd));
  }
  /** Vuelve al encuadre normal (zoom R, centro 640×360). */
  const camReset = (cam, duration = 0, ease) => camTo(cam, { f: 1, x: 640, y: 360, duration, ease });

  /**
   * Genera una textura desde un Graphics a R× su tamaño, pero con marco de tamaño LÓGICO (w×h):
   * las imágenes y los NineSlice que la usan miden lo mismo que antes y se ven nítidos. Solo WebGL.
   */
  function genTex(g, key, w, h) {
    const scene = g.scene, gl = scene.sys.game.renderer.type === root.Phaser.WEBGL;
    if (!gl || R === 1) { g.generateTexture(key, w, h); return key; }
    const sx = g.scaleX, sy = g.scaleY, PW = Math.ceil(w * R), PH = Math.ceil(h * R);
    g.setScale(R);
    g.generateTexture(key, PW, PH);
    g.setScale(sx, sy);
    logical(scene.textures.get(key), w, h, PW, PH);
    return key;
  }
  /** Marco base de una textura de PW×PH píxeles mostrado como w×h lógicos (UV sobre toda la parte dibujada). */
  function logical(tex, w, h, PW, PH) {
    const f = tex.get();
    f.setSize(w, h, 0, 0);
    f.u0 = 0; f.v0 = 0; f.u1 = (w * R) / PW; f.v1 = (h * R) / PH;
    tex.hiRes = R;
    return f;
  }

  Object.assign(Hi, { patch, camTo, camReset, genTex, logical });
  root.CM_HIRES = Hi;
  patch();
})(typeof window !== 'undefined' ? window : globalThis);
