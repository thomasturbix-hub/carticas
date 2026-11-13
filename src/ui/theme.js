/* =====================================================================
 * Carticas Mágicas — src/ui/theme.js
 * Sistema visual: los ÚNICOS colores, fuentes, tamaños, espacios y duraciones de la interfaz.
 * Las escenas y los componentes (UIButton, Panel, FocusManager) leen de aquí; nada de valores sueltos.
 *
 *   color  → tokens de interfaz (fondos, superficies, texto, acentos, estados)
 *   font   → display (gótica: SOLO títulos de pantalla h1 y el logo) · ui (serif legible: todo lo demás)
 *   size   → escala tipográfica a 1280×720 (mínimo 16; «micro» 14 solo dentro de cartas, insignias y HUD)
 *   space  → escala de espaciado · radius / borderWidth → esquinas y bordes de paneles y botones
 *   dur    → duraciones de las microinteracciones (ms)
 *   game   → colores del JUEGO, no de interfaz (mecánicas y efectos: escarcha, llamas…); fase 2 traerá el resto aquí
 * ===================================================================== */
(function (root) {
  'use strict';

  /** Colores de interfaz. Los de texto van como cadena CSS (Phaser.Text los pide así). */
  const color = Object.freeze({
    bg: 0x131a17,             // fondo base de las pantallas
    surface: 0x191e1a,        // paneles
    surfaceRaised: 0x222a25,  // filas y elementos sobre un panel
    ink: '#f2e6d0',           // texto principal
    muted: '#b8a88c',         // texto secundario (nunca más oscuro que esto)
    gold: 0xdaba65,           // bordes destacados y títulos
    ember: 0xd9822b,          // acento único: la acción principal (y el foco)
    brick: 0x3a1c12,          // relleno del botón principal
    danger: 0xc0392b,         // daño, peligro, errores
    heal: 0x6fbf73,           // curación, éxito
    // Derivados del mismo sistema (no son acentos nuevos)
    deep: 0x0d1210,           // lo más oscuro (huecos de barras, fondo del lienzo)
    line: 0x3b4c42,           // líneas finas y separadores
    shade: 0x000000,          // cortinas y sombras (siempre con alfa)
    outline: 0x0a0604,        // contorno de texto sobre ilustraciones
    glass: 0x120d0a,          // paneles sobre fondos ilustrados (con alpha.glass: se ve el fondo detrás)
    track: 0x050706           // fondo de barras de progreso
  });

  /** Alfas con nombre (bordes del sistema). */
  const alpha = Object.freeze({ borderPanel: 0.5, borderSecondary: 0.6, borderOption: 0.4, disabled: 0.4, curtain: 0.6, shadow: 0.4, glass: 0.8, sceneShade: 0.4 });

  /** Cartas con marco por personaje (assets/frames): pergamino, tinta y fondo de la ilustración por tipo (arriba → abajo). */
  const card = Object.freeze({
    parchment: '#ecdebe', parchmentEdge: '#d6c39a', ink: '#2a1c12', keyword: '#7a2e0e', outline: '#1a0f08',
    typeBg: Object.freeze({ attack: ['#5c1c14', '#1c0806'], skill: ['#173554', '#07111d'], power: ['#6b4b15', '#221706'], curse: ['#40364a', '#141118'] }),
    rarity: Object.freeze({ uncommon: '#6fb6ff', rare: '#f2c94c', legendary: '#ffe08a', special: '#d9822b' }),   // común e inicial: sin gema
    upgradeGlow: 'rgba(255, 210, 90, 0.85)', cost: Object.freeze({ ringHi: '#f7dc8a', ring: '#c09034', ringLo: '#6b4a12', core: '#1a1210' })
  });

  const font = Object.freeze({
    display: '"Grenze Gotisch", "Palatino Linotype", Georgia, serif',   // SOLO h1 y logo
    ui: '"Alegreya", "Lora", Georgia, "Times New Roman", serif',          // botones, cartas, paneles, cuerpo
    mono: '"Roboto Mono", "DejaVu Sans Mono", Consolas, "Courier New", monospace'   // códigos y semillas
  });

  const size = Object.freeze({ logo: 104, h1: 64, h2: 36, h3: 26, body: 20, small: 16, micro: 14 });   // logo: solo el rótulo del título
  const MIN_SIZE = 16;          // mínimo absoluto en menús, paneles y botones
  const space = Object.freeze([4, 8, 12, 16, 24, 32, 48, 64]);
  const radius = 6, borderWidth = 2;
  const dur = Object.freeze({ hover: 100, press: 80, screen: 300, stagger: 50,
    pulse: 700, ambient: 1800, spin: 1600, kenBurns: 20000 });   // kenBurns: zoom lento de los fondos ilustrados (1,00 → 1,04)   // pulse: avisos que laten · ambient: flotar/respirar en bucle · spin: iconos que giran
  const button = Object.freeze({ minH: 48, hoverScale: 1.03, pressScale: 0.97, hoverLighten: 0.08 });

  /** Colores del juego (mecánicas y efectos; no son de interfaz). */
  const game = Object.freeze({
    flame: 0xffc24a, frost: 0x7fb8dc, arcane: 0xa98be0, leaf: 0x8fc46a, ash: 0x6d6a63, moss: 0x18261f,
    essence: 0x8fd0c4,        // Esencia Arcana (antes violeta: ya no hay violeta en la interfaz)
    tier: Object.freeze([0x6fbf73, 0x7fb8dc, 0xdaba65]),  // dificultad de misión 1·2·3
    /** Color de cada mecánica de personaje (fichas de «Elige personaje»). */
    mech: Object.freeze({ bolt: 0x7fd6ff, static: 0xc8f0ff, overload: 0xffe066, judgment: 0xf2d36b, fervor: 0xffe9a8, immaterial: 0xe8f0ff,
      summon: 0x6fd08a, bond: 0xa8e6b8, engrave: 0xe0b46a, detonate: 0xff9a52, runePower: 0xf0cf7a, frost: 0x7fb8dc, iceShield: 0xcfeaff })
  });

  /* ---------- utilidades de color ---------- */
  /** '#rrggbb' o número → número 0xrrggbb. */
  const num = (c) => (typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16));
  /** número o '#rrggbb' → '#rrggbb'. */
  const css = (c) => (typeof c === 'string' ? c : '#' + c.toString(16).padStart(6, '0'));
  /** Aclara (f > 0) u oscurece (f < 0) un color, f en 0..1. */
  function shade(c, f) {
    const n = num(c), ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)));
    return (ch[0] << 16) | (ch[1] << 8) | ch[2];
  }

  root.CM_THEME = Object.freeze({ color, alpha, card, font, size, MIN_SIZE, space, radius, borderWidth, dur, button, game, num, css, shade });
})(typeof window !== 'undefined' ? window : globalThis);
