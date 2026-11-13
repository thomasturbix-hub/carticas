/* =====================================================================
 * Carticas Mágicas — src/ui/UIButton.js
 * El ÚNICO botón del juego: Container con NineSlice (fondo) + Text. Tres variantes, ninguna más:
 *   primary   → relleno brick, borde ember, texto ink. UNO por pantalla (Nueva partida, Comenzar, Continuar, Elegir…)
 *   secondary → relleno surface, borde gold al 60 %, texto ink (Volver, Cerrar, Saltar, Ver cartas…)
 *   option    → fila ancha para elegir (Evento, Forja, Hoguera): relleno surfaceRaised, borde gold al 40 %,
 *               título en ink + efecto en muted en la misma línea («Título — efecto» o { title, detail })
 * Estados: hover ×1.03 y +8 % de luz (dur.hover) · press ×0.97 (dur.press) · focus contorno ember 2 px ·
 *          disabled 40 % de opacidad y sin hover. Sonido corto al pasar y al pulsar. Alto mínimo 48 px.
 * API (la misma que el botón antiguo): press(), isEnabled(), setEnabled(v), setLabel(s), labelText(), variant,
 *          setFocus(on), role ('back' en Volver/Cerrar: lo usa Esc).
 * En Canvas (sin WebGL) el fondo se dibuja con Graphics (NineSlice solo existe en WebGL).
 * ===================================================================== */
(function (root) {
  'use strict';
  const TH = root.CM_THEME;
  const C = TH.color;
  const VARIANTS = Object.freeze({
    primary: { fill: C.brick, line: C.ember, la: 1 },
    secondary: { fill: C.surface, line: C.gold, la: TH.alpha.borderSecondary },
    option: { fill: C.surfaceRaised, line: C.gold, la: TH.alpha.borderOption }
  });
  const TEX = 48, SLICE = 12;   // textura base 48×48 con esquinas de 12 px
  const BACK_RE = /^(←\s*)?(Volver|Cerrar|Cancelar|Atrás|Salir|Listo|Back|Close|Cancel|Leave|Done)\b/i;

  /** Textura del fondo (variante × estado), generada una vez por juego. */
  function texture(scene, variant, hover) {
    const key = `uib_${variant}_${hover ? 'h' : 'n'}`;
    if (scene.textures.exists(key)) return key;
    const v = VARIANTS[variant], g = scene.make.graphics({ x: 0, y: 0, add: false }), b = TH.borderWidth;
    g.fillStyle(hover ? TH.shade(v.fill, TH.button.hoverLighten) : v.fill, 1);
    g.fillRoundedRect(b / 2, b / 2, TEX - b, TEX - b, TH.radius);
    g.lineStyle(b, v.line, v.la);
    g.strokeRoundedRect(b / 2, b / 2, TEX - b, TEX - b, TH.radius);
    g.generateTexture(key, TEX, TEX);
    g.destroy();
    return key;
  }
  /** Fondo escalable: NineSlice en WebGL; Graphics en Canvas. */
  function background(scene, variant, hover, w, h) {
    if (scene.sys.game.renderer.type === Phaser.WEBGL && scene.add.nineslice) {
      return scene.add.nineslice(0, 0, texture(scene, variant, hover), null, w, h, SLICE, SLICE, SLICE, SLICE);
    }
    const v = VARIANTS[variant], g = scene.add.graphics();
    g.fillStyle(hover ? TH.shade(v.fill, TH.button.hoverLighten) : v.fill, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, TH.radius);
    g.lineStyle(TH.borderWidth, v.line, v.la); g.strokeRoundedRect(-w / 2, -h / 2, w, h, TH.radius);
    return g;
  }

  /**
   * Crea un botón. o: { variant: 'primary'|'secondary'|'option', w, h, size, role, detail, compact }
   *   compact: true solo para el botón antiguo (escenas aún sin migrar): permite menos de 48 px de alto.
   */
  function create(scene, x, y, label, onClick, o = {}) {
    const U = root.CM_UI, T = U.T, fitText = U.fitText, Sfx = U.Sfx, Opts = U.Opts;
    const variant = VARIANTS[o.variant] ? o.variant : 'secondary';
    const w = o.w || 240, h = o.compact ? (o.h || 52) : Math.max(TH.button.minH, o.h || 52);
    const c = scene.add.container(x, y);
    const bg = background(scene, variant, false, w, h), bgH = background(scene, variant, true, w, h).setVisible(false);
    const ring = scene.add.graphics();   // contorno de foco (ember 2 px)
    c.add([bg, bgH, ring]);
    // Texto: centrado (primary/secondary) o título + efecto en la misma línea (option)
    let title = typeof label === 'object' && label ? label.title : String(label == null ? '' : label);
    let detail = typeof label === 'object' && label ? label.detail : o.detail;
    if (variant === 'option' && detail === undefined && title.includes(' — ')) { const i = title.indexOf(' — '); detail = title.slice(i + 3); title = title.slice(0, i); }
    const fs = o.size || TH.size.body;
    const pad = Math.min(TH.space[3], Math.round(w * 0.12));   // margen interior (menor en botones de icono)
    const txt = T(scene, variant === 'option' ? -w / 2 + TH.space[3] : 0, 0, title, { size: fs, bold: true, color: TH.num(C.ink), ox: variant === 'option' ? 0 : 0.5 });
    let det = null;
    c.add(txt);
    const layout = () => {
      if (variant !== 'option') { fitText(txt, w - pad * 2, h - 6, o.compact ? TH.size.micro : TH.MIN_SIZE); return; }
      txt.setFontSize(fs);
      if (det) { det.setFontSize(Math.max(TH.MIN_SIZE, fs - 2)); }
      const room = w - TH.space[3] * 2;
      fitText(txt, Math.max(80, room * (det ? 0.45 : 1)), h - 6, TH.MIN_SIZE);
      if (det) {
        det.setX(txt.x + txt.displayWidth + TH.space[2]);
        fitText(det, room - txt.displayWidth - TH.space[2], h - 6, TH.MIN_SIZE - 2);
      }
    };
    if (variant === 'option' && detail) { det = T(scene, 0, 0, `— ${detail}`, { size: Math.max(TH.MIN_SIZE, fs - 2), color: TH.num(C.muted), ox: 0 }); c.add(det); }
    layout();

    let enabled = true, hovered = false, pressed = false, focused = false;
    const S = TH.button, D = TH.dur;
    const scaleTo = (s, d) => { scene.tweens.killTweensOf(c); if (Opts.reduceMotion) { c.setScale(1); return; } scene.tweens.add({ targets: c, scale: s, duration: d, ease: 'Quad.out' }); };
    const paint = () => {
      const hov = enabled && hovered;
      bg.setVisible(!hov); bgH.setVisible(hov);
      c.setAlpha(enabled ? 1 : TH.alpha.disabled);
      ring.clear();
      if (focused) { ring.lineStyle(TH.borderWidth, C.ember, 1); ring.strokeRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, TH.radius + 2); }
    };
    paint();
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => {
      hovered = true; paint();
      if (!enabled) return;
      scaleTo(S.hoverScale, D.hover);
      Sfx.synth('click', 2.6);   // sonido corto al pasar
      if (o.tip && o.tipObj) o.tipObj.show(x + w / 2 + 10, y - h / 2, o.tip[0], o.tip[1]);
    });
    c.on('pointerout', () => { hovered = false; pressed = false; paint(); scaleTo(1, D.hover); if (o.tipObj) o.tipObj.hide(); });
    c.on('pointerdown', () => { if (!enabled) return; pressed = true; scaleTo(S.pressScale, D.press); });
    const fire = () => { Sfx.unlock(); Sfx.play('click'); scaleTo(hovered ? S.hoverScale : 1, D.press); onClick && onClick(); };
    c.on('pointerup', (p, lx, ly, ev) => {
      pressed = false;
      if (!enabled) { Sfx.play('deny'); return; }
      if (ev && ev.stopPropagation) ev.stopPropagation();
      fire();
    });
    // API común (la usan el mando, FocusManager y las escenas)
    c.press = () => { if (!enabled) { Sfx.play('deny'); return; } fire(); };
    c.isEnabled = () => enabled;
    c.variant = variant;
    c.isUIButton = true;
    c.role = o.role || (BACK_RE.test(title) ? 'back' : null);
    c.labelText = () => txt.text;
    c.setEnabled = (v) => { enabled = !!v; if (!enabled) scaleTo(1, D.hover); paint(); return c; };
    c.setFocus = (on) => { focused = !!on; paint(); return c; };
    c.setLabel = (s) => { title = String(s); txt.setText(title); txt.setFontSize(fs); c.role = o.role || (BACK_RE.test(title) ? 'back' : null); layout(); return c; };
    c.btnW = w; c.btnH = h;
    return c;
  }

  root.CM_UIButton = Object.freeze({ create, VARIANTS: Object.keys(VARIANTS), BACK_RE });
})(typeof window !== 'undefined' ? window : globalThis);
