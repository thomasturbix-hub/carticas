/*
 * Carticas Mágicas — feel.js
 * Pase de «game feel» (Parche 3.5): efectos de presentación que comparten varias escenas.
 * SOLO presentación: nunca toca el motor ni el estado de la partida.
 *
 *  - Confeti, rayos de luz, onda expansiva, color dominante de un sprite, bocadillos de los jefes,
 *    viñeta de PV bajos y flecha de apuntado.
 *  - «Reducir movimiento»: sin giros ni latidos; menos partículas. Los destellos y los números se mantienen.
 *  - Las partículas salen del pool de ui.js (U.Pool) y cuentan en U.Live (tope de vivas).
 */
(function (root) {
  'use strict';
  const U = root.CM_UI, C = U.C, LY = U.LAYER, Live = U.Live, Pool = U.Pool;
  const rm = () => U.Opts.reduceMotion;
  const gl = (scene) => !!scene && scene.sys.game.renderer.type === Phaser.WEBGL;

  /* ------------------------------------------------------------------ *
   * Confeti con los colores del juego (ganar, subir de Ascensión, desbloquear)
   * ------------------------------------------------------------------ */
  const CONFETTI = [C.gold, C.flame, C.ember, C.arcane, C.frost, C.leaf, 0xfff1b8];
  function confetti(scene, x = 640, y = 120, n = 70, spread = 520, depth = LY.fx + 1700) {
    n = Live.room(rm() ? Math.ceil(n / 3) : n);
    for (let i = 0; i < n; i++) {
      const p = Pool.image(scene, x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 30, 'dot')
        .setTint(CONFETTI[i % CONFETTI.length]).setDepth(depth);
      p.setScale(0.28 + Math.random() * 0.2, 0.12 + Math.random() * 0.08);
      const dx = (Math.random() - 0.5) * spread, peak = y - 60 - Math.random() * 160, land = y + 380 + Math.random() * 260;
      const dur = 1300 + Math.random() * 900;
      scene.tweens.add({ targets: p, x: x + dx, duration: dur, ease: 'Quad.out' });
      scene.tweens.add({ targets: p, y: peak, duration: dur * 0.3, ease: 'Quad.out',
        onComplete: () => scene.tweens.add({ targets: p, y: land, alpha: 0, duration: dur * 0.7, ease: 'Quad.in', onComplete: () => p.destroy() }) });
      if (!rm()) scene.tweens.add({ targets: p, angle: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540), duration: dur, ease: 'Linear' });
    }
  }

  /* ------------------------------------------------------------------ *
   * Rayos de luz detrás de algo raro (recompensas): abanico que gira despacio
   * ------------------------------------------------------------------ */
  function rays(scene, x, y, color = C.gold, r = 200, n = 12) {
    const g = scene.add.graphics().setPosition(x, y).setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, w = Math.PI / n * 0.55;
      g.fillStyle(color, i % 2 ? 0.16 : 0.26);
      g.fillTriangle(0, 0, Math.cos(a - w) * r, Math.sin(a - w) * r, Math.cos(a + w) * r, Math.sin(a + w) * r);
    }
    g.setAlpha(0).setScale(0.6);
    scene.tweens.add({ targets: g, alpha: 1, scale: 1, duration: 420, ease: 'Back.out' });
    if (!rm()) scene.tweens.add({ targets: g, angle: 360, duration: 16000, repeat: -1, ease: 'Linear' });
    return g;
  }

  /* ------------------------------------------------------------------ *
   * Onda expansiva (rugido del jefe, explosiones)
   * ------------------------------------------------------------------ */
  function shockwave(scene, x, y, color = C.blood, rings = 2, size = 1) {
    for (let k = 0; k < rings; k++) {
      const c = scene.add.circle(x, y, 30 * size, color, 0).setStrokeStyle(10 - k * 3, color, 0.85).setDepth(LY.fx + 900).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({ targets: c, scale: 9 - k * 2, alpha: 0, duration: 620 + k * 160, delay: k * 110, ease: 'Cubic.out', onComplete: () => c.destroy() });
    }
  }

  /* ------------------------------------------------------------------ *
   * Color dominante de una textura (para que el enemigo se desintegre en SU color). Se cachea por textura.
   * Media de los píxeles opacos pesada por saturación (el gris y el negro cuentan poco).
   * ------------------------------------------------------------------ */
  const domCache = {};
  function dominantColor(scene, key, fallback = C.ember) {
    if (!key || !scene.textures.exists(key)) return fallback;
    if (domCache[key] !== undefined) return domCache[key];
    let col = fallback;
    try {
      const src = scene.textures.get(key).getSourceImage();
      const N = 28, cv = document.createElement('canvas'); cv.width = N; cv.height = N;
      const ctx = cv.getContext('2d'); ctx.drawImage(src, 0, 0, N, N);
      const d = ctx.getImageData(0, 0, N, N).data;
      let r = 0, g = 0, b = 0, w = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;
        const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
        const k = 0.05 + (mx - mn) / 255 * (mx / 255);   // saturado y luminoso pesa más
        r += d[i] * k; g += d[i + 1] * k; b += d[i + 2] * k; w += k;
      }
      if (w > 0) {
        // Se aviva un poco (las medias tiran a apagado) para que las partículas brillen
        let R = r / w, G = g / w, B = b / w; const mx = Math.max(R, G, B, 1), f = Math.min(1.6, 235 / mx);
        R *= f; G *= f; B *= f;
        col = (Math.round(R) << 16) | (Math.round(G) << 8) | Math.round(B);
      }
    } catch (e) { col = fallback; }
    domCache[key] = col;
    return col;
  }
  /** Un tono más claro del mismo color (segunda capa de partículas). */
  function lighter(col, k = 0.45) {
    const r = (col >> 16) & 255, g = (col >> 8) & 255, b = col & 255;
    return (Math.round(r + (255 - r) * k) << 16) | (Math.round(g + (255 - g) * k) << 8) | Math.round(b + (255 - b) * k);
  }

  /* ------------------------------------------------------------------ *
   * Bocadillo de diálogo (frases de los jefes): 2 s sobre el personaje, sin bloquear nada
   * ------------------------------------------------------------------ */
  function quip(scene, x, y, text, color = C.blood, ms = 2000, side = 'above') {
    // side 'left': el bocadillo va a la izquierda del punto (x, y) y la cola apunta a la derecha (no tapa nombre ni barra)
    const t = U.T(scene, 0, 0, text, { size: 19, style: 'italic', color: 0x2a1a10, wrap: 280, align: 'center' });
    const w = Math.min(310, t.width + 34), h = t.height + 24;
    let bx, by;
    if (side === 'left') { bx = Phaser.Math.Clamp(x - 18 - w / 2, w / 2 + 12, 1280 - w / 2 - 12); by = Phaser.Math.Clamp(y, h / 2 + 70, 470 - h / 2); }
    else { bx = Phaser.Math.Clamp(x, w / 2 + 12, 1280 - w / 2 - 12); by = Math.max(h / 2 + 64, y); }
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.3); g.fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, 14);
    g.fillStyle(C.parch, 0.97); g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.lineStyle(2.5, color, 1); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.fillStyle(C.parch, 0.97); g.lineStyle(2.5, color, 1);
    if (side === 'left') {   // cola en el borde derecho, hacia el que habla
      const ty = Phaser.Math.Clamp(y - by, -h / 2 + 16, h / 2 - 16), ex = w / 2 + 16;
      g.fillTriangle(w / 2 - 1, ty - 9, w / 2 - 1, ty + 9, ex, ty); g.lineBetween(w / 2, ty - 9, ex, ty); g.lineBetween(w / 2, ty + 9, ex, ty);
    } else {
      const tx = Phaser.Math.Clamp(x - bx, -w / 2 + 22, w / 2 - 22);
      g.fillTriangle(tx - 10, h / 2 - 1, tx + 10, h / 2 - 1, tx, h / 2 + 14); g.lineBetween(tx - 10, h / 2, tx, h / 2 + 14); g.lineBetween(tx + 10, h / 2, tx, h / 2 + 14);
    }
    const box = scene.add.container(bx, by, [g, t]).setDepth(LY.fx + 1500).setAlpha(0).setScale(rm() ? 1 : 0.7);
    box.isQuip = true;
    scene.tweens.add({ targets: box, alpha: 1, scale: 1, duration: 200, ease: 'Back.out' });
    scene.time.delayedCall(ms, () => { if (box.scene) scene.tweens.add({ targets: box, alpha: 0, y: by - 10, duration: 220, onComplete: () => box.destroy() }); });
    return box;
  }

  /* ------------------------------------------------------------------ *
   * Viñeta roja de PV bajos (< 30 %): latido lento en los bordes. update(ratio) en cada cambio de PV.
   * Con «Reducir movimiento», fija y tenue (sin latir).
   * ------------------------------------------------------------------ */
  function lowHpVignette(scene) {
    const key = vignetteTexture(scene);
    const v = scene.add.image(640, 360, key).setDisplaySize(1280, 720).setDepth(LY.fx + 1300).setAlpha(0).setScrollFactor(0);
    v.isVignette = true;   // (auditoría de solapes: es un velo de pantalla completa)
    let on = false, beat = null;
    const api = {
      img: v,
      update(ratio) {
        const want = ratio > 0 && ratio < 0.3;
        if (want === on) return;
        on = want;
        if (beat) { beat.stop(); beat = null; }
        scene.tweens.killTweensOf(v);
        if (!on) { scene.tweens.add({ targets: v, alpha: 0, duration: 400 }); return; }
        if (rm()) { scene.tweens.add({ targets: v, alpha: 0.45, duration: 400 }); return; }
        v.setAlpha(0.25);
        // Latido: dos golpes cortos y una pausa (≈ 1,2 s), como un corazón cansado
        beat = scene.tweens.chain({ targets: v, loop: -1, tweens: [
          { alpha: 0.7, duration: 140, ease: 'Quad.out' }, { alpha: 0.35, duration: 180, ease: 'Quad.in' },
          { alpha: 0.6, duration: 130, ease: 'Quad.out' }, { alpha: 0.25, duration: 700, ease: 'Sine.inOut' }
        ] });
      },
      destroy() { if (beat) beat.stop(); v.destroy(); }
    };
    return api;
  }
  function vignetteTexture(scene) {
    if (scene.textures.exists('lowhp_vig')) return 'lowhp_vig';
    const W = 320, H = 180, cv = scene.textures.createCanvas('lowhp_vig', W, H), ctx = cv.getContext();
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, W * 0.62);
    g.addColorStop(0, 'rgba(160,0,10,0)'); g.addColorStop(0.6, 'rgba(160,0,10,0.25)'); g.addColorStop(1, 'rgba(120,0,6,0.85)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); cv.refresh();
    return 'lowhp_vig';
  }

  /* ------------------------------------------------------------------ *
   * Flecha de apuntado (bezier) de la carta al enemigo, con puntas que avanzan
   * ------------------------------------------------------------------ */
  function aimArrow(scene) {
    const g = scene.add.graphics().setDepth(LY.hand + 260);
    let t0 = 0;
    return {
      g,
      draw(x0, y0, x1, y1, color = C.flame) {
        g.clear().setVisible(true);
        const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 140 - Math.abs(x1 - x0) * 0.12;   // arco hacia arriba
        const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x0, y0), new Phaser.Math.Vector2(mx, my), new Phaser.Math.Vector2(x1, y1));
        const pts = curve.getPoints(28);
        g.lineStyle(9, 0x000000, 0.35); g.strokePoints(pts);
        g.lineStyle(5, color, 0.95); g.strokePoints(pts);
        g.lineStyle(2, 0xfff1b8, 0.8); g.strokePoints(pts);
        // Puntas («>») que avanzan por la curva
        t0 = rm() ? 0 : (t0 + 0.012) % 0.2;
        for (let t = t0; t < 0.93; t += 0.2) {
          const p = curve.getPoint(t), q = curve.getTangent(t), a = Math.atan2(q.y, q.x);
          const s = 9;
          g.fillStyle(0xfff1b8, 0.95);
          g.fillTriangle(p.x + Math.cos(a) * s, p.y + Math.sin(a) * s, p.x + Math.cos(a + 2.5) * s, p.y + Math.sin(a + 2.5) * s, p.x + Math.cos(a - 2.5) * s, p.y + Math.sin(a - 2.5) * s);
        }
        // Cabeza grande en el objetivo
        const q = curve.getTangent(1), a = Math.atan2(q.y, q.x), s = 22;
        g.fillStyle(color, 1); g.lineStyle(3, 0x000000, 0.5);
        const tri = [x1 + Math.cos(a) * s * 0.5, y1 + Math.sin(a) * s * 0.5, x1 + Math.cos(a + 2.6) * s, y1 + Math.sin(a + 2.6) * s, x1 + Math.cos(a - 2.6) * s, y1 + Math.sin(a - 2.6) * s];
        g.fillTriangle(...tri); g.strokeTriangle(...tri);
      },
      hide() { g.clear().setVisible(false); }
    };
  }

  /* ------------------------------------------------------------------ *
   * Partículas del color del tipo de carta al jugarla (ataque rojo, habilidad azul, poder dorado)
   * ------------------------------------------------------------------ */
  const TYPE_FX = { attack: 0xe0503a, skill: 0x5aa8e8, power: 0xf2c94c, curse: 0x8a7fa0 };
  function cardDissolve(scene, x, y, type, n = 22) {
    const col = TYPE_FX[type] || C.gold;
    U.burst(scene, x, y, col, n, 90);
    U.burst(scene, x, y, lighter(col, 0.6), Math.ceil(n / 3), 50);
  }

  /* ------------------------------------------------------------------ *
   * Número que cuenta hasta su valor (puntuación, Esencia…): fmt(v) da el texto
   * ------------------------------------------------------------------ */
  function countUp(scene, txt, from, to, fmt = String, dur = 900, delay = 0) {
    txt.setText(fmt(from));
    return scene.tweens.addCounter({ from, to, duration: dur, delay, ease: 'Cubic.out',
      onUpdate: (t) => txt.setText(fmt(Math.round(t.getValue()))), onComplete: () => txt.setText(fmt(to)) });
  }

  root.CM_FEEL = { countUp, confetti, rays, shockwave, dominantColor, lighter, quip, lowHpVignette, aimArrow, cardDissolve, TYPE_FX, gl };
})(typeof window !== 'undefined' ? window : globalThis);
