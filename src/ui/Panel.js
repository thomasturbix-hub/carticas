/* =====================================================================
 * Carticas Mágicas — src/ui/Panel.js
 * El ÚNICO panel de interfaz: NineSlice con fondo surface, borde gold al 50 % y radio 6.
 * Sustituye a los paneles con borde lavanda/violeta (Evento, Forja) y a las tarjetas del Santuario.
 *   Panel.create(scene, x, y, w, h, o) → objeto (origen arriba-izquierda). o: { raised, alpha, depth, glass }
 *   Panel.draw(g, x, y, w, h, o)        → lo mismo sobre un Graphics (para dibujos que ya usan Graphics)
 * En Canvas (sin WebGL) el fondo se dibuja con Graphics (NineSlice solo existe en WebGL).
 * ===================================================================== */
(function (root) {
  'use strict';
  const TH = root.CM_THEME, C = TH.color;
  const TEX = 48, SLICE = 12;
  const fillOf = (o) => (o.raised ? C.surfaceRaised : C.surface);

  function texture(scene, raised) {
    const key = raised ? 'ui_panel_raised' : 'ui_panel';
    if (scene.textures.exists(key)) return key;
    const g = scene.make.graphics({ x: 0, y: 0, add: false }), b = TH.borderWidth;
    g.fillStyle(raised ? C.surfaceRaised : C.surface, 1); g.fillRoundedRect(b / 2, b / 2, TEX - b, TEX - b, TH.radius);
    g.lineStyle(b, C.gold, TH.alpha.borderPanel); g.strokeRoundedRect(b / 2, b / 2, TEX - b, TEX - b, TH.radius);
    root.CM_HIRES.genTex(g, key, TEX, TEX); g.destroy();   // a R×, con tamaño lógico 48×48 (NineSlice nítido)
    return key;
  }
  /** Dibuja el panel sobre un Graphics existente. */
  function draw(g, x, y, w, h, o = {}) {
    if (o.glass) {   // sobre fondo ilustrado: oscuro translúcido (se ve la imagen) con borde dorado fino
      g.fillStyle(C.glass, TH.alpha.glass); g.fillRoundedRect(x, y, w, h, TH.radius);
      g.lineStyle(1, C.gold, 0.8); g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, TH.radius);
      return g;
    }
    g.fillStyle(fillOf(o), o.alpha === undefined ? 1 : o.alpha); g.fillRoundedRect(x, y, w, h, TH.radius);
    g.lineStyle(TH.borderWidth, C.gold, TH.alpha.borderPanel); g.strokeRoundedRect(x, y, w, h, TH.radius);
    return g;
  }
  /** Crea el panel (origen arriba-izquierda). */
  function create(scene, x, y, w, h, o = {}) {
    let p;
    if (!o.glass && scene.sys.game.renderer.type === Phaser.WEBGL && scene.add.nineslice) {
      p = scene.add.nineslice(x, y, texture(scene, !!o.raised), null, w, h, SLICE, SLICE, SLICE, SLICE).setOrigin(0, 0);
      if (o.alpha !== undefined) p.setAlpha(o.alpha);
    } else p = draw(scene.add.graphics(), x, y, w, h, o);
    if (o.depth !== undefined) p.setDepth(o.depth);
    p.isPanel = true;
    return p;
  }

  root.CM_Panel = Object.freeze({ create, draw });
})(typeof window !== 'undefined' ? window : globalThis);
