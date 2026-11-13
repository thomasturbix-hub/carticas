/* =====================================================================
 * Carticas Mágicas — src/ui/FocusManager.js
 * Navegación con teclado y mando entre los UIButton de una escena:
 *   flechas → el botón más cercano en esa dirección · Tab / Mayús+Tab → siguiente / anterior en orden de lectura
 *   Enter → activa el enfocado · Esc → el botón Volver/Cerrar de la escena (role 'back')
 * El foco se marca con el contorno ember de 2 px del propio UIButton (setFocus).
 * ui.js (focusManager / padNav) usa estas funciones; las escenas no tienen que escribir su navegación.
 * ===================================================================== */
(function (root) {
  'use strict';
  const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

  /** El más cercano en una dirección ('up'|'down'|'left'|'right'), lo más recto posible. */
  function spatial(items, cur, dir, rectOf) {
    if (!items.length) return null;
    if (!cur) return items[0];
    const c0 = center(rectOf(cur)), v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    let best = null, bestScore = Infinity;
    for (const it of items) {
      if (it === cur) continue;
      const c1 = center(rectOf(it)), dx = c1.x - c0.x, dy = c1.y - c0.y, along = dx * v[0] + dy * v[1];
      if (along <= 4) continue;
      const score = along + (Math.abs(dx * v[1]) + Math.abs(dy * v[0])) * 2;
      if (score < bestScore) { bestScore = score; best = it; }
    }
    return best;
  }
  /** Siguiente (dir 1) o anterior (dir -1) en orden de lectura: de arriba abajo y de izquierda a derecha (filas de 24 px). */
  function tabOrder(items, cur, dir, rectOf) {
    if (!items.length) return null;
    const key = (it) => { const r = rectOf(it); return Math.round((r.y + r.h / 2) / 24) * 10000 + (r.x + r.w / 2); };
    const sorted = items.slice().sort((a, b) => key(a) - key(b));
    const i = sorted.indexOf(cur);
    if (i < 0) return dir > 0 ? sorted[0] : sorted[sorted.length - 1];
    return sorted[(i + dir + sorted.length) % sorted.length];
  }
  /** El botón de volver/cerrar entre los enfocables (role 'back' de UIButton). */
  function backOf(items) {
    const it = items.find((x) => x.obj && x.obj.role === 'back' && (!x.obj.isEnabled || x.obj.isEnabled()));
    return it || null;
  }
  /** Marca el foco: en un UIButton, su contorno ember; en lo demás (cartas, zonas), un contorno ember dibujado. */
  function mark(g, it, rect, on, theme) {
    if (it && it.obj && it.obj.setFocus) { it.obj.setFocus(on); return true; }
    if (on && g && rect) { g.lineStyle(theme.borderWidth, theme.color.ember, 1); g.strokeRoundedRect(rect.x - 6, rect.y - 6, rect.w + 12, rect.h + 12, theme.radius + 2); }
    return false;
  }

  root.CM_FocusManager = Object.freeze({ spatial, tabOrder, backOf, mark });
})(typeof window !== 'undefined' ? window : globalThis);
