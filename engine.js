/* =====================================================================
 * Carticas Mágicas — engine.js
 * Motor del juego: lógica pura, sin Phaser ni DOM. Testeable en Node.
 *
 * Principio clave (arregla el bug de la versión Base44):
 *   - Hay UNA sola fuente de verdad: el objeto `run`.
 *   - Cada acción muta `run` y devuelve una lista de EVENTOS con los
 *     valores resultantes (hp, block…). La UI anima esos eventos y al
 *     terminar vuelve a pintar TODO desde `run`. Nunca hay copias locales
 *     de HP/energía que puedan quedarse desfasadas.
 * ===================================================================== */
(function (root) {
  'use strict';
  const D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.CM_DATA;
  const I18N = (typeof module !== 'undefined' && module.exports) ? require('./i18n.js') : root.CM_I18N;
  /** _t: texto para mostrar YA (avisos). _m: mensaje para GUARDAR (registro): se traduce al pintarlo. R: nombre por id. */
  const _t = (k, v) => I18N.t(k, v), _m = I18N.msg, R = I18N.ref;
  const RE = (e) => R('enemy', e.id);
  const RC = (card) => R('card', card.id, card.up2 ? { up: true, up2: true } : card.up ? { up: true } : null);
  const RCS = (list) => R('cards', null, { list: list.map((x) => ({ id: x.id, up: !!x.up })) });
  /** Movimiento actual del enemigo como referencia (fase e índice): su nombre se traduce al pintarlo. */
  const moveRef = (e) => { const ms = enemyMoves(e); return R('move', e.id, { ph: e.phase || 1, i: e.moveIdx % ms.length }); };
  /** Nombre de la Carga Arcana en curso (partidas antiguas guardaban el texto). */
  const chargeName = (ch) => (ch.mv ? I18N.refName(ch.mv) : ch.name || '');

  const ROWS = 8;          // filas jugables del mapa (0..7); el jefe va en la fila 8
  const LANES = 4;         // carriles horizontales
  const HAND_SIZE = 5;
  const MAX_HAND = 10;
  const CHARGE_BREAK = 15;    // Carga Arcana: daño en un turno que la interrumpe
  const REFLECT_FRAC = 0.5;   // Reflejo: fracción del daño que vuelve
  /** Interacciones del Acto III con las mecánicas de cada personaje (balance 2.4). */
  const ASC_PROPOSAL = { a4str: false };   // solo para medir; no se usa en el juego
  const ACT3_RULES = { freezeBreaksCharge: true, reflectSummons: true, reflectRunes: true };
  const BASE_ENERGY = 3;
  const OVERHEAT_AT = 5;   // Temperatura a partir de la cual te quemas al acabar el turno
  const OVERHEAT_DMG = 2;
  const INCENDIO_AT = 10;    // Incendio Controlado: Quemadura necesaria
  const HEAL_MAX = 3;
  const RUNE_SLOTS = 3;
  const GOLEM_STONES = 2;    // Gólem de Runas: runas de Piedra para conservar el Bloqueo      // Guardiana: ranuras de runa
  const FROST_MULT = 0.75;   // Escarcha: los ataques del enemigo hacen un 25% menos
  const WEAK_MULT = 0.75;    // Débil: tus ataques hacen un 25% menos
  const ICE_MELT = 3;        // Escudo de Hielo: lo que se derrite al empezar tu turno
  const JUDG_BLOCK = 2;       // Paladín: Bloqueo por cada Juicio en cada golpe de un Ataque
  const STATIC_MAX = 10;        // Electromante: Estática máxima (con 10 al final de tu turno, Sobrecarga)
  const OVERLOAD_DMG = 10;      // Sobrecarga: daño a todos los enemigos (Pararrayos: +10 la primera de cada combate)
  const OVERLOAD_SOLO = 2;      // …×2 si solo queda un enemigo (balance: con 10 a secas, 2 % de victorias en A0 frente a ~18 % de media)
  const MAGNET_DMG = 2;         // Magnetizado: +2 de daño de Rayo por cada punto
  const FREEZE_AT = 10, FREEZE_AT_BOSS = 15;   // Escarcha para Congelar (jefes)   // movimientos de curación (Brote): como mucho 3 por combate
  const FLOORS_PER_ACT = ROWS + 1;                  // 8 filas + el jefe
  const TOTAL_FLOORS = FLOORS_PER_ACT * D.LAST_ACT; // 27 con tres actos
  const actOf = (run) => run.act || 1;
  /** Encuentros del acto actual (data.js los indexa por acto). */
  const encounters = (run) => D.ENCOUNTERS[actOf(run)] || D.ENCOUNTERS[1];
  /** Jefes posibles de un acto (el primero es el de siempre). */
  const bossesOf = (act) => { const e = D.ENCOUNTERS[act] || {}; return e.bosses && e.bosses.length ? e.bosses : (e.boss ? [e.boss] : []); };
  /** Jefe que espera al final del acto: el elegido al generar su mapa (run.boss[act]); partidas antiguas → el de siempre. */
  function bossOf(run, act = actOf(run)) {
    const id = run && run.boss && run.boss[act];
    return id && D.ENEMIES[id] && bossesOf(act).includes(id) ? id : (D.ENCOUNTERS[act] || D.ENCOUNTERS[1]).boss;
  }
  /** Acto al que pertenece un jefe (0 si no es jefe de ningún acto). */
  const bossAct = (id) => { for (let a = 1; a <= D.LAST_ACT; a++) if (bossesOf(a).includes(id)) return a; return 0; };
  /** Todos los jefes del juego, por acto. */
  const allBosses = () => { const out = []; for (let a = 1; a <= D.LAST_ACT; a++) out.push(...bossesOf(a)); return out; };
  const isCurse = (card) => cardDef(card).type === 'curse';
  /** Temperatura a la que empieza el Sobrecalentamiento (Libro Prohibido la baja en 1). */
  const overheatAt = (run) => OVERHEAT_AT - (run.relics && run.relics.includes('librollama') ? 1 : 0);

  /* ------------------------------------------------------------------ *
   * RNG determinista (mulberry32). El estado vive en run.rng, así una
   * partida guardada continúa exactamente con la misma secuencia.
   * ------------------------------------------------------------------ */
  function rand(run) {
    run.rng = (run.rng + 0x6D2B79F5) >>> 0;
    let t = run.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const randInt = (run, a, b) => a + Math.floor(rand(run) * (b - a + 1));
  const pick = (run, arr) => arr[Math.floor(rand(run) * arr.length)];
  function shuffle(run, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand(run) * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function weighted(run, table) { // table: [[valor, peso], ...]
    const total = table.reduce((s, [, w]) => s + w, 0);
    let r = rand(run) * total;
    for (const [val, w] of table) { if ((r -= w) < 0) return val; }
    return table[table.length - 1][0];
  }

  /* ------------------------------------------------------------------ *
   * Cartas
   * ------------------------------------------------------------------ */
  const cardDef = (c) => D.CARDS[c.id];
  /** Claves de una carta que NO suben con la fusión «++» (umbrales y contadores, no efectos). */
  const FUSE_SKIP = new Set(['cost', 'comboN', 'at', 'frostAt', 'div', 'blockDiv', 'votivaPer', 'lowHp']);
  function cardVals(c) {
    const d = cardDef(c);
    const v = Object.assign({ cost: d.cost }, d.v, c.up && d.up ? d.up : {});
    // «++» (Forja): +50 % (redondeado) a los números que muestra su texto
    if (c.up2) for (const m of String(d.text || '').matchAll(/\{(\w+)/g)) { const k = m[1]; if (!FUSE_SKIP.has(k) && typeof v[k] === 'number' && v[k] >= 1) v[k] = Math.round(v[k] * 1.5); }
    return v;
  }
  const cardCost = (c) => cardVals(c).cost;
  /** ¿Coste X? (gasta toda la Energía; X = la gastada) */
  const isX = (c) => cardDef(c).cost === 'X';
  /**
   * Coste real en combate. Coste X → toda la energía actual. Poción de Caos / Metamorfosis → 0 el turno
   * en que llegan. Reloj de Arena → −1 a la primera carta Conservada del turno.
   */
  function costIn(c, combat) {
    if (isX(c)) return combat ? combat.player.energy : 0;
    if (combat && c.freeTurn && c.freeTurn === combat.turn) return 0;
    if (combat && c.free0) return 0;                       // Grimorio Inestable: cuesta 0 todo el combate
    if (combat && cardDef(c).freeIfNoSummons && !(combat.summons || []).length) return 0;   // Cría Rápida: gratis sin criaturas
    const lowFree = cardDef(c).lowHpFree;                  // Ira Divina: gratis con pocos PV
    if (combat && lowFree && (combat.player.hpPct === undefined ? 1 : combat.player.hpPct) < lowFree) return 0;
    if (combat && cardDef(c).type === 'attack' && combat.metronome && (combat.attacksPlayed || 0) % 4 === 3) return 0;   // Metrónomo
    const base = cardCost(c);
    let cost = base;
    if (combat && typeof cost === 'number' && c.discountTurn && c.discountTurn === combat.turn) cost = Math.max(0, cost - 1);
    const fd = cardDef(c).frostDiscount;   // Avalancha: −1 por cada N de Escarcha del enemigo
    if (combat && fd && typeof cost === 'number') cost = Math.max(0, cost - Math.floor((combat.enemy.frost || 0) / fd));
    return cost;
  }
  /** Combo n: ¿esta carta es la n-ésima (o más) del turno? `playing`: ya se ha contado como jugada. */
  const comboOn = (v, combat, playing) => !!(v.comboN && combat && combat.player && (combat.player.playedThisTurn || 0) + (playing ? 0 : 1) >= v.comboN);
  /** Daño extra de la propia carta: Templar (por copia, este combate), Llama Paciente (turnos en mano) y Combo. */
  function cardBonus(c, v, combat, playing) {
    if (!combat) return 0;
    return (c.temperBonus || 0) + (v.per && cardDef(c).retain ? v.per * (c.held || 0) : 0) + (v.comboDmg && comboOn(v, combat, playing) ? v.comboDmg : 0)
      + (v.frostBonus && (combat.enemy.frost || 0) >= v.frostAt ? v.frostBonus : 0)    // Témpano
      + (v.perRuneType && combat.runes ? v.perRuneType * new Set(combat.runes).size : 0)    // Martillo Rúnico
      + (v.perSummon && combat.summons ? v.perSummon * combat.summons.length : 0)           // Manada
      + (v.judgBonus && (combat.enemy.judg || 0) > 0 ? v.judgBonus : 0)                     // Castigo
      + (v.fervorX ? v.fervorX * ((combat.player && combat.player.fervor) || 0) : 0)          // Mártir: el Fervor cuenta otra vez
      + (v.frozenX && combat.enemy.frozen ? v.dmg : 0)                                         // Golpe Glacial: el doble si está Congelado
      + (v.fireBonus && (combat.runes || []).includes('fuego') ? v.fireBonus : 0)              // Martillazo
      + (v.perWolf ? v.perWolf * (combat.summons || []).filter((s) => s.id === 'lobezno').length : 0)   // Mordisco de la Manada
      + (v.blockDiv && combat.player ? Math.floor(combat.player.block / v.blockDiv) : 0)       // Martillo de Luz
      + (v.perCard && combat.player ? v.perCard * Math.max(0, (combat.player.playedThisTurn || 0) - (playing ? 1 : 0)) : 0);   // Ira de Zeus: cartas jugadas ANTES este turno
  }
  const cardName = (c) => cardDef(c).name + (c.up2 ? '++' : c.up ? '+' : '');
  const canUpgrade = (c) => !c.up && !!cardDef(c).up;

  /** Daño base de la primera operación ofensiva de la carta (antes de modificadores). */
  function attackBase(c, combat) {
    const d = cardDef(c), v = cardVals(c);
    for (const [op] of d.fx) {
      if (op === 'attack' || op === 'xAttack' || op === 'hitsBurn' || op === 'xHitsFrost' || op === 'totalIgnition') return v.dmg + cardBonus(c, v, combat, false);
      if (op === 'zap' || op === 'zapAll' || op === 'xZap' || op === 'zapRandom') return v.dmg + cardBonus(c, v, combat, false) + boltExtra(combat);   // Rayo: + Guante de Cobre y Magnetizado del marcado
      if (op === 'ashes') return combat ? Math.min(v.max, v.per * exhaustedCount(combat)) : null;
      if (op === 'runeSpark') return combat ? v.per * (combat.runes || []).length : null;
      if (op === 'runeAvalanche') return combat ? v.per * (combat.detonated || 0) : null;
      if (op === 'shatter' || op === 'storm') return combat ? frostDamage(combat, v.per, op === 'shatter') : null;
      if (op === 'detonateAll') return combat ? (combat.runes || []).length * v.per : null;
      if (op === 'combust' || op === 'consumeBurn') return combat ? combat.enemy.burn * v.mult : null;
      if (op === 'iceHeart') return combat ? combat.player.block + (combat.player.ice || 0) : null;
      if (op === 'flare') return v.dmg + (combat ? combat.player.temp * 2 : 0);
      if (op === 'nova') return combat ? combat.player.temp * v.mult : null;
      if (op === 'sentence' || op === 'finalJudgment') return combat ? (combat.enemy.judg || 0) * v.per : null;
      if (op === 'shieldBash') return combat ? Math.floor(combat.player.block / v.div) : null;
    }
    return null;
  }

  /** Cartas Agotadas este combate (los poderes jugados no cuentan). */
  const exhaustedCount = (combat) => (combat.exhaust || []).filter((x) => D.CARDS[x.id] && D.CARDS[x.id].type !== 'power').length;
  /** Fragmentar / Tormenta Polar: N por cada Escarcha (Brújula Polar: +50% a Fragmentar). */
  const frostDamage = (combat, per, isShatter) => Math.floor(per * (combat.enemy.frost || 0) * (isShatter && combat.mods && combat.mods.brujula ? 1.5 : 1));
  /** Daño de un golpe enemigo: + Fuerza, −25% con Escarcha (redondeo hacia abajo). */
  const hasAffix = (e, id) => !!(e && e.affixes && e.affixes.includes(id));
  const enemyHit = (e, dmg) => {
    if (e.mult) dmg = Math.max(1, Math.round(dmg * e.mult));   // grupos (Parche 3.2): los acompañantes pegan menos
    let d = Math.max(0, dmg + e.str + (e.greed || 0));   // greed: Anillo del Avaricioso (jefes)
    if (hasAffix(e, 'enorme')) d = Math.floor(d * (1 - D.AFFIXES.enorme.v.dmgDown));   // afijo «enorme»: −10% de daño
    return e.frost > 0 ? Math.floor(d * FROST_MULT) : d;
  };

  /** Daño final de un ataque del jugador: + Temperatura, −25% si Débil. */
  function playerAttackDamage(combat, base, card) {
    const guante = combat.mods && combat.mods.guante && combat.player.temp >= 5 ? 2 : 0;   // Guante de Lava
    const aura = (combat.player.powers && combat.player.powers.aura) || 0;              // Aura Arcana
    // Piedra de Afilado: +2 a los Ataques de coste 1 o más (la carta que se juega o la que se previsualiza)
    const pc = card || combat.playingCard, pv = pc && cardDef(pc).type === 'attack' ? cardVals(pc) : null;
    const afilado = pv && combat.mods && combat.mods.afilado && (pv.cost === 'X' || pv.cost >= 1) ? (D.RELICS.afilado.v || 2) : 0;
    const fervor = combat.player.fervor || 0;                                        // Paladín: Fervor
    const fusion = combat.fusion && combat.fusion.turn === combat.turn ? combat.fusion.bonus : 0;   // Punto de Fusión
    let dmg = base + combat.player.temp + guante + aura + afilado + fervor + fusion;
    if (combat.player.weak > 0) dmg = Math.floor(dmg * WEAK_MULT);
    if (combat.mods && combat.mods.brea && (combat.enemy.burn || 0) > 0) dmg = Math.floor(dmg * (1 + (D.RELICS.brea.v || 0.2)));   // Frasco de Brea Rúnica
    if (combat.furyTurn && combat.furyTurn === combat.turn) dmg *= 2;   // Furia Volcánica (poción)
    return Math.max(0, dmg);
  }

  /** Texto de la carta. Con `combat`, {dmg} muestra el daño real que hará. */
  function cardText(c, combat) {
    const d = cardDef(c), v = cardVals(c);
    const base = attackBase(c, combat);
    const shown = (combat && base !== null) ? playerAttackDamage(combat, base, c) : null;
    const pre = d.aim === 'all' ? _t('card.area') + ' ' : d.aim === 'random' ? _t('card.random') + ' ' : '';   // Parche 3.2
    return pre + I18N.plurals(d.text, v).replace(/\{(\w+)\}/g, (_, k) => {   // «{draw|carta|cartas}»: plural según el valor
      if (k === 'dmg') return String(shown !== null ? shown : v.dmg);
      if (k === 'dmgx') return shown !== null ? ` (${shown})` : '';
      return String(v[k]);
    });
  }

  function canPlay(run, uid) {
    const c = run.combat;
    if (!c || c.over || c.phase !== 'player') return { ok: false, reason: _t('e.no_es_tu_turno') };
    if (c.choice) return { ok: false, reason: _t('e.elige_una_runa_primero') };
    const card = c.hand.find((x) => x.uid === uid);
    if (!card) return { ok: false, reason: _t('e.esa_carta_no_esta_en') };
    if (cardDef(card).unplayable) return { ok: false, reason: _t('e.esta_carta_no_se_puede') };
    if (card.sealed === c.turn) return { ok: false, reason: _t('e.silenciada_no_se_puede_jugar') };
    if (cardDef(card).needsDead && !c.lastDead) return { ok: false, reason: _t('e.aun_no_ha_muerto_ninguna') };   // Renacer
    if (!isX(card) && costIn(card, c) > c.player.energy) return { ok: false, reason: _t('e.energia_insuficiente') };   // X: siempre (X puede ser 0)
    return { ok: true };
  }

  /**
   * Daño previsto (interfaz): juega la carta en una COPIA de la partida y suma los golpes al enemigo.
   * No toca la partida real ni su RNG. Devuelve null si la carta no golpea.
   * { dmg: PV que perderá, blocked: lo que absorbe su Bloqueo, hits, kills }
   */
  function previewPlay(run, uid, target) {
    const c = run.combat;
    if (!c || c.over || !c.hand.some((x) => x.uid === uid)) return null;
    const sim = JSON.parse(JSON.stringify(run));
    bindCombat(sim.combat);
    if (target !== undefined && alive(sim.combat.enemies[target])) sim.combat.target = target;
    const card = sim.combat.hand.find((x) => x.uid === uid);
    if (!isX(card)) sim.combat.player.energy = Math.max(sim.combat.player.energy, costIn(card, sim.combat));   // previsión aunque falte energía
    sim.combat.phase = 'player';
    const t0 = sim.combat.target;
    const ev = playCard(sim, uid);
    const rnd = cardDef(c.hand.find((x) => x.uid === uid)).each;   // Chispas: no se adelanta dónde caen
    const hits = ev.filter((e) => e.t === 'hitEnemy' && !e.jump && !rnd);   // los saltos de un Rayo (al azar) tampoco
    if (!hits.length) return null;
    const out = {
      dmg: hits.reduce((a, e) => a + e.amount, 0),
      blocked: hits.reduce((a, e) => a + e.blocked, 0),
      hits: hits.length,
      kills: sim.combat.over === 'win',
      per: {}   // grupos: por enemigo (ei) { dmg, blocked, hits, kills }
    };
    for (const h of hits) { const x = (out.per[h.ei] ||= { dmg: 0, blocked: 0, hits: 0, kills: false }); x.dmg += h.amount; x.blocked += h.blocked; x.hits++; }
    for (const k of Object.keys(out.per)) out.per[k].kills = !alive(sim.combat.enemies[k]);
    if (c.enemies.length > 1) out.kills = !!(out.per[t0] && out.per[t0].kills) || sim.combat.over === 'win';
    // Golpe de Suerte: no se adelanta la tirada; se enseña el rango
    const real = c.hand.find((x) => x.uid === uid);
    if (cardDef(real).fx.some(([op]) => op === 'luckyHit')) {
      const v = cardVals(real), b = cardBonus(real, v, c, false);
      out.range = [playerAttackDamage(c, v.lo + b), playerAttackDamage(c, v.hi + b)];
      out.kills = out.range[0] >= c.enemy.hp + c.enemy.block;
      out.per = { [c.target]: { dmg: out.dmg, blocked: out.blocked, hits: 1, kills: out.kills } };
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Partida
   * ------------------------------------------------------------------ */
  function addCard(run, id, up = false) {
    if (deckFull(run)) return null;   // Personalizado «Mazo pequeño»: tope de cartas (la carta no entra)
    const card = { uid: run.uidNext++, id, up };
    run.deck.push(card);
    return card;
  }

  /** ¿La partida está en Ascensión `n` o superior? (reglas acumulativas) */
  const asc = (run, n) => (run.ascension || 0) >= n;
  /** Normaliza un nivel de Ascensión a un entero 0..MAX. */
  const clampAsc = (n) => Math.max(0, Math.min(D.MAX_ASCENSION, Math.floor(Number(n) || 0)));

  /**
   * Nueva partida. opts.ascension: nivel 0..8 (por defecto 0).
   * A3 se aplica aquí: el mago empieza con −6 PV máx.
   */
  function newRun(seed, opts = {}) {
    seed = (seed === undefined ? (Date.now() ^ Math.floor(Math.random() * 1e9)) : seed) >>> 0;
    const ascension = clampAsc(opts.ascension);
    const ch = D.CHARACTERS[opts.char] ? opts.char : 'piromago', cd = D.CHARACTERS[ch];
    const run = {
      version: 1, seed, rng: seed, ascension, act: 1,
      char: ch, mage: ch,
      hp: cd.hp, maxHp: cd.hp, gold: 99,
      deck: [], relics: [], uidNext: 1,
      map: null, pos: null,
      combat: null, pending: null, over: null,
      lastEnemy: null,
      boss: {},                             // jefe de cada acto (lo elige genMap con run.rng)
      potions: [null, null, null], potionChance: POTION_CHANCE_START,   // cinturón de pociones y probabilidad de botín
      stats: { floors: 0, kills: 0, damageDealt: 0, damageTaken: 0, cardsPlayed: 0, goldEarned: 0, maxHit: 0,
               maxBurnTick: 0, maxTemp: 0, combatDamageTaken: 0, potionsUsed: 0,
               // Parche 3.6 (misiones y momentos destacados)
               burnApplied: 0, frostApplied: 0, judgApplied: 0, overloads: 0, eliteKills: 0, bossKills: 0, goldKills: 0,
               events: 0, altar: 0, groupNoDmg: 0, hpLow: 0, maxCombo: 0,
               maxHitInfo: null, minHp: null, bossOneShot: null, cardFx: {}, relicUses: {} }   // maxBurnTick/maxTemp/combatDamageTaken alimentan los logros
    };
    if (asc(run, 3)) { run.maxHp -= 6; run.hp = run.maxHp; }          // A3
    // Pactos (retos voluntarios): solo ids conocidos, sin repetir
    run.pacts = [...new Set(opts.pacts || [])].filter((id) => D.PACTS[id]);
    // Recompensas de logro desbloqueadas (meta.unlocked): solo ids conocidos, sin repetir
    run.unlocked = [...new Set(opts.unlocked || [])].filter((id) => D.REWARD_LOCK[id]);
    if (hasPact(run, 'llama')) { run.maxHp -= 10; run.hp = run.maxHp; }   // Llama tenue
    if (hasPact(run, 'pociones')) run.potions = [];                      // Sin pociones: sin cinturón
    cd.starterDeck.forEach((id) => addCard(run, id));
    // Senda (Parche 3.1): la carta ★ de la senda entra en el mazo inicial; «sin senda» da +10 % de Esencia
    const path = D.PATHS[opts.path];
    if (path && path.char === ch) { run.path = path.id; addCard(run, path.star); }
    else if (opts.noPath) run.noPath = true;
    if (hasPact(run, 'pesado')) { addCard(run, 'escalofrio'); addCard(run, 'escalofrio'); }   // Mazo pesado
    // Afinidad (Parche 3.6): reliquia inicial alternativa (solo las de ese personaje); meta.js decide si está desbloqueada
    const startRel = opts.starterRelic && (D.ALT_STARTERS[ch] || []).includes(opts.starterRelic) ? opts.starterRelic : cd.starterRelic;
    if (startRel) addRelic(run, startRel);
    if (opts.altDeck && run.path) altStarterDeck(run);              // Afinidad 6: 2 básicas → 2 de la senda
    if (opts.legacy && legacyOk(opts.legacy, ch)) {                 // Legado: la carta de la última victoria (sin mejorar)
      const card = addCard(run, opts.legacy);
      if (card) { card.legacy = true; run.legacy = opts.legacy; }
    }
    if (opts.look) run.look = cleanLook(opts.look);                 // cosméticos (solo se ven)
    if (opts.custom) applyCustomStart(run, opts.custom);   // Modo personalizado (sin efecto en las partidas normales)
    run.map = genMap(run);
    applyUpgrades(run, opts);
    run.stats.timeline = [{ floor: 0, hp: run.hp, maxHp: run.maxHp, gold: run.gold, type: 'start' }];
    run.flags = {};   // consecuencias de las cadenas de eventos (deuda, espíritu, huevo…)
    // Contratos (Parche 3.5): tras elegir personaje y senda, 3 al azar (con run.rng, después del mapa: el mapa no cambia)
    if (opts.contracts) run.pending = { kind: 'contracts', options: contractOptions(run) };
    return run;
  }

  /* ------------------------------------------------------------------ *
   * AFINIDAD (Parche 3.6): mazo inicial alternativo, Legado y cosméticos de la partida
   * ------------------------------------------------------------------ */
  /** Carta que puede ser Legado de un personaje: suya o neutral, conseguible (ni maldición, ni de evento, ni legendaria). */
  function legacyOk(id, ch) {
    const d = D.CARDS[id];
    return !!d && (d.class === ch || d.class === 'any' || !d.class) && ['common', 'uncommon', 'rare'].includes(d.rarity) && !isCurse({ id });
  }
  /** Básica que se quita: el Ataque o la Habilidad que más se repite en el mazo inicial. */
  function basicOf(ch, type) {
    const cnt = {};
    for (const id of D.CHARACTERS[ch].starterDeck) if (D.CARDS[id].type === type) cnt[id] = (cnt[id] || 0) + 1;
    return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || (a < b ? -1 : 1))[0] || null;
  }
  /** Cartas de la senda que puede dar el mazo alternativo (comunes; si no llegan a 2, también infrecuentes). */
  function altDeckPool(ch, path, run) {
    const P = D.PATHS[path];
    const ok = (id, r) => { const d = D.CARDS[id]; return d.class === ch && d.rarity === r && (d.tags || []).includes(path) && id !== P.star && !isX({ id }) && !d.needsDead && !isLocked(run, id); };
    const common = Object.keys(D.CARDS).filter((id) => ok(id, 'common'));
    return common.length >= 2 ? common : common.concat(Object.keys(D.CARDS).filter((id) => ok(id, 'uncommon')));
  }
  /** Mazo inicial alternativo: azar propio (semilla + senda), así el mapa y el resto de la partida no cambian. */
  function altStarterDeck(run) {
    const ch = run.char, tmp = { rng: fnv1a('cm-altdeck-' + run.seed + '-' + run.path) >>> 0 };
    const picks = shuffle(tmp, altDeckPool(ch, run.path, run).slice()).slice(0, 2);
    if (picks.length < 2) return;
    for (const type of ['attack', 'skill']) {
      const id = basicOf(ch, type), i = run.deck.findIndex((x) => x.id === id);
      if (i >= 0) run.deck.splice(i, 1);
    }
    picks.forEach((id) => addCard(run, id));
    run.altDeck = picks;
  }
  /** Cosméticos de la partida: solo ids conocidos. */
  function cleanLook(look) {
    const out = {};
    for (const slot of D.COSMETIC_SLOTS) if (look && D.COSMETICS[slot][look[slot]] && look[slot] !== 'none') out[slot] = look[slot];
    return out;
  }

  /* ------------------------------------------------------------------ *
   * DESAFÍO SEMANAL (Parche 3.6): de lunes a domingo, el mismo para todo el mundo
   * ------------------------------------------------------------------ */
  /** Lunes (fecha local, "YYYY-MM-DD") de la semana de `now`. */
  function weekKey(now = new Date()) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return todayStr(d);
  }
  /** Reto de la semana: personaje, senda, semilla, Ascensión (0..2) y 2-3 modificadores (Normal o Difícil). */
  function weeklyCfg(key) {
    if (!DATE_RE.test(key)) throw new Error('Semana no válida: ' + key);
    const tmp = { rng: fnv1a('cm-week-' + key) >>> 0 };
    const pool = D.CHAR_IDS.filter((id) => !D.CHARACTERS[id].dailyFrom || D.CHARACTERS[id].dailyFrom <= key);
    const ch = pool[Math.floor(rand(tmp) * pool.length)], paths = D.CHARACTERS[ch].paths;
    const path = paths[Math.floor(rand(tmp) * paths.length)].id;
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let seed = 'S'; for (let i = 0; i < 5; i++) seed += A[Math.floor(rand(tmp) * A.length)];
    const ascension = Math.floor(rand(tmp) * (D.WEEKLY.ascMax + 1));
    for (let tries = 0; tries < 50; tries++) {
      const n = 2 + (rand(tmp) < 0.5 ? 1 : 0), mods = [];
      for (const id of shuffle(tmp, D.CUSTOM_MOD_IDS.slice())) if (mods.length < n && customModAllowed(mods, id)) mods.push(id);
      const cfg = normalizeCustom({ char: ch, path, ascension, seed, mods });
      const diff = customDifficulty(cfg).id;
      if (cfg.mods.length >= 2 && (diff === 'normal' || diff === 'dificil')) return cfg;
    }
    return normalizeCustom({ char: ch, path, ascension, seed, mods: ['rico', 'sintiendas'] });
  }
  /** Partida del desafío semanal: una personalizada con la marca run.weekly (el lunes de la semana). */
  function newWeeklyRun(key) {
    const run = newCustomRun(weeklyCfg(key));
    run.weekly = key;
    return run;
  }

  /* ------------------------------------------------------------------ *
   * CONTRATOS (Parche 3.5): un objetivo opcional por partida.
   *   run.contract = { id, state: 'active' | 'done' | 'failed', act (en el que se cumplió), prog, best, byAct, bought, rewarded }
   *   Recompensa: reliquia o carta rara al terminar el acto en que se cumple (pantalla «Contrato cumplido»);
   *   Esencia si es de Esencia, si se cumple en el último acto o si la partida acaba antes de cobrarlo.
   * ------------------------------------------------------------------ */
  function contractOptions(run) {
    const ch = charOf(run);
    const gen = shuffle(run, D.CONTRACT_IDS.filter((id) => !D.CONTRACTS[id].class));
    const own = D.CONTRACT_IDS.filter((id) => D.CONTRACTS[id].class === ch);
    const out = own.length && rand(run) < 0.5 ? [own[0], gen[0], gen[1]] : gen.slice(0, 3);   // el de tu personaje, la mitad de las veces
    return shuffle(run, out);
  }
  /** Elige un contrato de la oferta (o null para ninguno). */
  function takeContract(run, id) {
    const p = run.pending;
    if (!p || p.kind !== 'contracts') return false;
    if (id !== null && id !== undefined && !p.options.includes(id)) return false;
    run.contract = id ? { id, state: 'active', prog: 0, best: 0, byAct: {}, bought: {} } : null;
    run.pending = null;
    return true;
  }
  function contractDone(run) { const k = run.contract; if (k && k.state === 'active') { k.state = 'done'; k.act = actOf(run); } }
  function contractFail(run) { const k = run.contract; if (k && k.state === 'active') k.state = 'failed'; }
  /** Avisa al contrato activo de algo que ha pasado. type: win · eliteWin · bossWin · restHeal · buy · finalBoss · power · burn · freeze · detonate · judg · overload */
  function contractTick(run, type, x = {}) {
    const k = run.contract;
    if (!k || k.state !== 'active' || !D.CONTRACTS[k.id]) return;
    const act = actOf(run), best = (n) => { k.best = Math.max(k.best || 0, n || 0); };
    switch (k.id) {
      case 'jefe6': if (type === 'bossWin' && act === 1) { k.best = x.turns; if (x.turns <= 6) contractDone(run); else contractFail(run); } break;
      case 'sinhoguera': if (type === 'restHeal' && act === 2) contractFail(run); else if (type === 'bossWin' && act === 2) contractDone(run); break;
      case 'mazo8': if (type === 'bossWin' && run.deck.length <= 8) contractDone(run); break;
      case 'intacto3': if (type === 'win' && x.dmg === 0) { k.prog = (k.prog || 0) + 1; if (k.prog >= 3) contractDone(run); } break;
      case 'oro300': if (type === 'finalBoss') { k.best = run.gold; if (run.gold >= 300) contractDone(run); else contractFail(run); } break;
      case 'poderes5': if (type === 'power') { best(x.n); if (x.n >= 5) contractDone(run); } break;
      case 'elites3': if (type === 'eliteWin') { k.byAct[act] = (k.byAct[act] || 0) + 1; if (k.byAct[act] >= D.CONTRACTS.elites3.goal) contractDone(run); } break;
      case 'ahorro': if (type === 'buy') k.bought[act] = true; else if (type === 'bossWin' && !k.bought[act]) contractDone(run); break;
      case 'grupo3t': if (type === 'win' && x.group && x.turns <= 3) contractDone(run); break;
      case 'ascuas25': if (type === 'burn') { best(x.n); if (x.n >= 25) contractDone(run); } break;
      case 'congelajefe': if (type === 'freeze' && x.boss) contractDone(run); break;
      case 'runas4': if (type === 'detonate') { best(x.n); if (x.n >= D.CONTRACTS.runas4.goal) contractDone(run); } break;
      case 'manada3': if (type === 'win' && x.summons >= 3) contractDone(run); break;
      case 'juicio15': if (type === 'judg') { best(x.n); if (x.n >= 15) contractDone(run); } break;
      case 'tormenta3': if (type === 'overload') { best(x.n); if (x.n >= D.CONTRACTS.tormenta3.goal) contractDone(run); } break;
    }
  }
  /** Estado del contrato para la interfaz: { id, def, state, cur, goal, rewarded } o null. */
  function contractStatus(run) {
    const k = run && run.contract;
    if (!k || !D.CONTRACTS[k.id]) return null;
    const d = D.CONTRACTS[k.id], act = actOf(run);
    const cur = { intacto3: k.prog || 0, elites3: (k.byAct || {})[act] || 0, mazo8: run.deck.length, oro300: run.gold,
      poderes5: k.best || 0, ascuas25: k.best || 0, runas4: k.best || 0, juicio15: k.best || 0, tormenta3: k.best || 0 }[k.id];
    return { id: k.id, def: d, state: k.state, cur: cur === undefined ? null : cur, goal: d.goal || null, rewarded: !!k.rewarded, act: k.act || null };
  }
  /** Esencia que da el contrato al acabar la partida (los de reliquia o carta que no llegaron a cobrarse, también). */
  function contractEssence(run) {
    const k = run.contract;
    if (!k || k.state !== 'done' || !D.CONTRACTS[k.id]) return 0;
    const d = D.CONTRACTS[k.id];
    return d.reward === 'essence' ? (d.ess || D.CONTRACT_ESSENCE) : k.rewarded ? 0 : D.CONTRACT_ESSENCE;
  }
  /** Reliquia de premio: como las de la tienda (también las de tu personaje). */
  function contractRelic(run) {
    const pool = Object.keys(D.RELICS).filter((r) => !hasRelic(run, r) && !D.RELICS[r].starter && itemForChar(D.RELICS[r], charOf(run)) && relicInAct(run, r) && !isLocked(run, r));
    return pool.length ? pick(run, pool) : null;
  }
  /** Al empezar el acto siguiente: si el contrato se cumplió (y no es de Esencia), pantalla «Contrato cumplido» con su premio. */
  function contractPayout(run) {
    const k = run.contract;
    if (!k || k.state !== 'done' || k.rewarded || !D.CONTRACTS[k.id]) return false;
    const d = D.CONTRACTS[k.id];
    if (d.reward === 'essence' || (k.act || 1) >= D.LAST_ACT) return false;   // se cobra en Esencia al final
    k.rewarded = true;
    const result = { contract: k.id };
    if (d.reward === 'relic') {
      const r = contractRelic(run);
      if (r) { addRelic(run, r); result.relic = r; result.text = _m('rj.contract.relic', { c: R('contract', k.id), r: R('relic', r) }); }
      else { gainGold(run, 100); result.text = _m('rj.contract.gold', { c: R('contract', k.id) }); }
    } else {
      result.text = _m('rj.contract.card', { c: R('contract', k.id) });
      result.pick = 'choose'; result.count = 1; result.options = rollCards(run, 3, [['rare', 1]]);
    }
    run.pending = { kind: 'event', id: 'contrato', result };
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Santuario: mejoras permanentes (opts.upgrades = meta.upgrades). Se aplican DESPUÉS de generar el
   * mapa, así una partida sin mejoras usa exactamente el mismo azar que antes. opts.noUpgrades: «sin
   * mejoras del Santuario» (+20% de Esencia). El desafío diario nunca las recibe (newDailyRun).
   * run.upg guarda los niveles efectivos que usa el motor durante la partida.
   * ------------------------------------------------------------------ */
  const upg = (run, id) => (run.upg && run.upg[id]) || 0;
  function applyUpgrades(run, opts) {
    run.noUpgrades = !!opts.noUpgrades;
    run.upg = {};
    if (run.noUpgrades || !opts.upgrades) return;
    for (const id of D.UPGRADE_IDS) {
      const n = Math.max(0, Math.min(D.UPGRADES[id].cost.length, Math.floor(Number(opts.upgrades[id]) || 0)));
      if (n) run.upg[id] = n;
    }
    if (upg(run, 'vitalidad')) { run.maxHp += D.UPGRADES.vitalidad.per * upg(run, 'vitalidad'); run.hp = run.maxHp; }
    if (upg(run, 'bolsa')) run.gold += 15 * upg(run, 'bolsa');
    for (let i = 0; i < upg(run, 'alquimia'); i++) { const slot = freeSlot(run); if (slot < 0) break; run.potions[slot] = randomPotion(run, 'common'); }
    for (let i = 0; i < upg(run, 'herreria'); i++) { const basic = D.CHARACTERS[charOf(run)].starterDeck, pool = run.deck.filter((c) => canUpgrade(c) && D.CARDS[c.id].type === 'attack' && basic.filter((x) => x === c.id).length >= 3); if (!pool.length) break;   // solo el Golpe básico
      pick(run, pool).up = true; }
    run.rerolls = upg(run, 'sabiduria');                 // Ojo del Sabio: por acto (advanceAct los repone)
    if (upg(run, 'reliquia')) {                          // Herencia: 1 de 3 reliquias comunes (las de todos los personajes) antes del primer paso
      const pool = shuffle(run, Object.keys(D.RELICS).filter((id) => !hasRelic(run, id) && !D.RELICS[id].starter && D.RELICS[id].class === 'any' && relicInAct(run, id) && !isLocked(run, id)));
      run.pending = { kind: 'startRelic', options: pool.slice(0, 3), taken: false };
    }
  }
  /** Herencia: toma una de las reliquias ofrecidas (o null para no tomar ninguna). */
  function takeStartRelic(run, id) {
    const p = run.pending;
    if (!p || p.kind !== 'startRelic' || p.taken) return false;
    if (id !== null && id !== undefined) { if (!p.options.includes(id)) return false; addRelic(run, id); }
    p.taken = true; run.pending = null;
    return true;
  }
  /** Ojo del Sabio: relanza las cartas de la recompensa (una vez por cada nivel, en cada acto). */
  function rerollRewardCards(run) {
    const p = run.pending;
    if (!p || p.kind !== 'reward' || p.cardTaken || !(run.rerolls > 0)) return false;
    run.rerolls--;
    p.cards = rollCards(run, p.cards.length, p.elite ? ODDS_ELITE : ODDS_NORMAL, !!p.elite);
    return true;
  }

  /**
   * Esencia Arcana que da una partida terminada (pura; los extras de logros y de primera victoria con
   * un personaje los suma meta.onRunEnd porque dependen del meta):
   *   base = pisos × 2 + élites vencidas × 5 + jefes vencidos × 15 + 30 si ganas
   *   × (1 + 0,10 × nivel de Ascensión) × 1,2 si se jugó «sin mejoras» (el diario no lleva ese bonus)
   *   × 1,1 si se jugó «sin senda» (tampoco en el diario)
   * Devuelve { floors, elites, bosses, win, base, ascMult, noUpgMult, noPathMult, total } (total redondeado).
   */
  function essenceFor(run) {
    const R = D.ESSENCE, s = run.stats || {}, trail = s.trail || [];
    const won = !!run.over && run.over.result === 'win';
    const floors = (s.floors || 0) * R.floor, elites = trail.filter((k) => k === 'E').length * R.elite;
    const bosses = trail.filter((k) => k === 'K').length * R.boss, win = won ? R.win : 0;
    const contract = contractEssence(run);   // Contratos (Parche 3.5)
    const base = floors + elites + bosses + win + contract;
    const ascMult = 1 + R.perAsc * (run.ascension || 0), noUpgMult = run.noUpgrades && !run.daily ? R.noUpgrades : 1;
    const noPathMult = run.noPath && !run.daily ? R.noPath : 1;   // «Sin senda»
    const customMult = run.custom ? customDifficulty(run.custom).mult : 1;   // Personalizado: ×0,5 · ×1 · ×1,25 · ×1,5
    return { floors, elites, bosses, win, contract, base, ascMult, noUpgMult, noPathMult, customMult, total: Math.round(base * ascMult * noUpgMult * noPathMult * customMult) };
  }

  /* ------------------------------------------------------------------ *
   * Desafío diario: misma semilla para todos los que juegan el mismo día
   * ------------------------------------------------------------------ */
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  /** Hash FNV-1a de 32 bits sobre "cm-daily-YYYY-MM-DD": estable y sin dependencias. */
  function dailySeed(dateStr) {
    const s = 'cm-daily-' + dateStr;
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  /** Fecha LOCAL del jugador como "YYYY-MM-DD" (toISOString daría la fecha UTC). */
  function todayStr(now = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  }

  /* ---------- Compartir el resultado del diario ---------- */
  const fnv1a = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
  /** Código de 4 caracteres (FNV-1a de fecha + puntuación + pisos + semilla, base36 en mayúsculas). */
  const dailyCodeOf = (date, score, floors, seed) => fnv1a(`${date}|${score}|${floors}|${seed >>> 0}`).toString(36).toUpperCase().padStart(4, '0').slice(-4);
  /** Código de una partida diaria terminada. Puro: misma partida → mismo código. */
  function dailyCode(run) { return dailyCodeOf(run.daily, dailyScore(run), (run.stats && run.stats.floors) || 0, run.seed); }

  const ACT_EMOJI = { 1: '🌲', 2: '❄️', 3: '🔮' };
  const ROMAN_ACT = { 1: 'I', 2: 'II', 3: 'III' };
  const TRAIL_EMOJI = { G: '🟩', Y: '🟨', B: '🟦', E: '🟪', K: '👑', X: '🟥', S: '🌫️' };
  const groupThousands = (n) => I18N.score(n);
  /** Texto para compartir (emojis; dos filas Acto I / Acto II si hay más de 9 pisos). */
  function dailyShareText(run) {
    const [y, m, d] = run.daily.split('-').map(Number);
    const tr = (run.stats.trail || []).map((k) => TRAIL_EMOJI[k] || '⬛');
    const rows = [];
    for (let i = 0; i < Math.max(1, tr.length); i += FLOORS_PER_ACT) rows.push(tr.slice(i, i + FLOORS_PER_ACT).join(''));
    void y;
    return [
      _t('share.head', { d, m: I18N.months()[m - 1] }),
      _t('share.line', { s: groupThousands(dailyScore(run)), f: run.stats.floors || 0, e: ACT_EMOJI[actOf(run)] || '🌲', a: ROMAN_ACT[actOf(run)] || 'I' }),
      ...rows,
      `#${dailyCode(run)}`
    ].join('\n');
  }
  /**
   * Comprueba un texto compartido: el código debe cuadrar con su fecha, puntuación y piso.
   * La semilla del diario se deriva de la fecha; el año no va en el texto: se prueba este y el anterior.
   * Devuelve { ok, date?, reason? }.
   */
  function verifyDailyShare(text, now = new Date()) {
    const t = String(text || '');
    // Vale en cualquier idioma: «Diario 23 oct · … Piso 9» o «Daily 23 Oct · … Floor 9»
    const md = t.match(/(?:Diario|Daily)\s+(\d{1,2})\s+([a-záéíóú]{3,4})/i), sc = t.match(/([\d.,]+)\s*pts/i), fl = t.match(/(?:Piso|Floor)\s+(\d+)/i), cd = t.match(/#([0-9A-Z]{4})\b/i);
    if (!md || !sc || !fl || !cd) return { ok: false, reason: _t('share.badFormat') };
    const mon = md[2].toLowerCase().slice(0, 3);
    const month = I18N.LANGS.map((l) => I18N.months(l).map((x) => x.slice(0, 3)).indexOf(mon)).find((i) => i >= 0);
    if (month === undefined) return { ok: false, reason: _t('share.badMonth') };
    const score = Number(sc[1].replace(/[.,]/g, '')), floors = Number(fl[1]), code = cd[1].toUpperCase();
    const p = (n) => String(n).padStart(2, '0');
    for (const y of [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() + 1]) {
      const date = `${y}-${p(month + 1)}-${p(Number(md[1]))}`;
      if (dailyCodeOf(date, score, floors, dailySeed(date)) === code) return { ok: true, date };
    }
    return { ok: false, reason: _t('share.badCode') };
  }

  /** Personaje del diario: sale de la fecha, entre TODOS los personajes (desbloqueados o no). */
  function dailyChar(dateStr) {
    // Solo los personajes que ya existían ese día (dailyFrom): un personaje nuevo no cambia los diarios pasados
    const pool = D.CHAR_IDS.filter((id) => !D.CHARACTERS[id].dailyFrom || D.CHARACTERS[id].dailyFrom <= dateStr);
    return pool[fnv1a('cm-char-' + dateStr) % pool.length];
  }

  /** Partida diaria: semilla derivada de la fecha y marca run.daily (se conserva al guardar). */
  function newDailyRun(dateStr) {
    if (!DATE_RE.test(dateStr)) throw new Error('Fecha de desafío no válida: ' + dateStr);
    const seed = dailySeed(dateStr), ch = dailyChar(dateStr), paths = D.CHARACTERS[ch].paths;
    const path = paths[fnv1a('cm-path-' + seed) % paths.length].id;   // la senda sale de la semilla (sin tocar run.rng)
    const run = newRun(seed, { ascension: 0, char: ch, path });   // el diario es igual para todos: siempre A0
    run.daily = dateStr;
    return run;
  }

  /**
   * Puntuación del desafío diario:
   *   pisos alcanzados × 100
   * + enemigos derrotados × 10
   * + si ganas: 1000 + PV restantes × 5
   * Ej.: derrota en el piso 6 con 5 bajas → 650. Victoria (9 pisos, 9 bajas, 30 PV) → 900 + 90 + 1000 + 150 = 2140.
   */
  function dailyScore(run) {
    const s = run.stats || {};
    const win = !!run.over && run.over.result === 'win';
    return (s.floors || 0) * 100 + (s.kills || 0) * 10 + (win ? 1000 + Math.max(0, run.hp) * 5 : 0);
  }

  const hasRelic = (run, id) => run.relics.includes(id);
  /** ¿Pacto activo? */
  const hasPact = (run, id) => !!(run.pacts && run.pacts.includes(id));
  /** Suma de los bonus de los pactos activos (0.45 → ×1,45 a la puntuación). */
  const pactBonus = (run) => Math.round((run.pacts || []).reduce((a, id) => a + (D.PACTS[id] ? D.PACTS[id].bonus : 0), 0) * 100) / 100;
  /** Puntuación de una partida normal: fórmula del diario × (1 + pactos). */
  const runScore = (run) => Math.round(dailyScore(run) * (1 + pactBonus(run)));

  /* ------------------------------------------------------------------ *
   * MODO PERSONALIZADO (Parche 3.4)
   * cfg = { char, path ('' = al azar), ascension, seed (texto A-Z0-9, máx. 12), mods: [ids de D.CUSTOM_MODS] }
   * La partida sale de la semilla de texto (fnv1a) con run.rng, igual que el diario: mismo código → misma
   * partida (mapa, enemigos, recompensas). Nunca recibe mejoras del Santuario, pactos ni recompensas de logro.
   * run.custom = { ...cfg normalizada, code } (se conserva al guardar).
   * ------------------------------------------------------------------ */
  const CUSTOM_SEED_MAX = 12, CUSTOM_DECK_MAX = 15, CUSTOM_RICH_GOLD = 300, CUSTOM_HECHIZO_HP = 0.25, CUSTOM_RELICS = 3;
  const hasCustom = (run, id) => !!(run.custom && run.custom.mods && run.custom.mods.includes(id));
  /** Mazo pequeño: ¿el mazo ya tiene el máximo de cartas? */
  const deckFull = (run) => hasCustom(run, 'mazopeq') && run.deck.length >= CUSTOM_DECK_MAX;
  /** Semilla de texto normalizada: mayúsculas, solo A-Z y 0-9, máx. 12. */
  const customSeedText = (s) => String(s || '').toUpperCase().replace(/Ø/g, '0').replace(/[^A-Z0-9]/g, '').slice(0, CUSTOM_SEED_MAX);   // Ø: como se pinta el 0
  /** Semilla aleatoria de 6 caracteres (sin 0, O, 1, I ni L, para que se lea bien al dictarla). */
  function randomCustomSeed(rnd = Math.random) {
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // sin 0, O, 1, I ni L (se confunden al leerlos o dictarlos)
    let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(rnd() * A.length)];
    return s;
  }
  /** Normaliza una configuración: ids válidos, sin repetir ni conflictos, en el orden de D.CUSTOM_MOD_IDS. */
  function normalizeCustom(cfg = {}) {
    const ch = D.CHARACTERS[cfg.char] ? cfg.char : 'piromago';
    const path = D.PATHS[cfg.path] && D.PATHS[cfg.path].char === ch ? cfg.path : '';
    let mods = D.CUSTOM_MOD_IDS.filter((id) => (cfg.mods || []).includes(id));
    for (const [a, b] of D.CUSTOM_CONFLICTS) if (mods.includes(a) && mods.includes(b)) mods = mods.filter((x) => x !== b);
    return { char: ch, path, ascension: clampAsc(cfg.ascension), seed: customSeedText(cfg.seed) || 'CARTICAS', mods };
  }
  /** ¿Se puede activar el modificador `id` con los que ya hay? (CUSTOM_CONFLICTS) */
  function customModAllowed(mods, id) {
    return !D.CUSTOM_CONFLICTS.some(([a, b]) => (a === id && mods.includes(b)) || (b === id && mods.includes(a)));
  }
  /** Dificultad: suma de los pesos de los modificadores + la mitad de la Ascensión → Fácil / Normal / Difícil / Locura. */
  function customDifficulty(cfg) {
    const score = (cfg.mods || []).reduce((a, id) => a + ((D.CUSTOM_MODS[id] || {}).weight || 0), 0) + Math.floor((cfg.ascension || 0) / 2);
    const id = D.CUSTOM_DIFF_IDS.find((k) => score <= D.CUSTOM_DIFF[k].max) || 'locura';
    return { id, score, mult: D.CUSTOM_DIFF[id].mult, name: D.CUSTOM_DIFF[id].name, color: D.CUSTOM_DIFF[id].color };
  }
  const B36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';   // códigos de la 3.4.0 (se siguen aceptando)
  /** Base 32 de Crockford: sin I, L, O ni U, así que al leer O = 0 e I/L = 1 sin ambigüedad. */
  const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const b32 = (n, len) => { let s = ''; for (let i = 0; i < len; i++) { s = B32[n & 31] + s; n >>>= 5; } return s; };
  const crock = (s) => s.replace(/O/g, '0').replace(/[IL]/g, '1');
  /** Código para compartir: CM-<PJ>-<senda 0-3>A<asc>-<semilla>-<modificadores (3)><control (1)>, los 4 últimos en
   *  base 32 de Crockford. Ej.: CM-PIRO-2A4-K7F2-03GX */
  function encodeCustom(cfg) {
    const c = normalizeCustom(cfg), cd = D.CHARACTERS[c.char];
    const p = c.path ? cd.paths.findIndex((x) => x.id === c.path) + 1 : 0;
    let bits = 0; c.mods.forEach((id) => { bits |= 1 << D.CUSTOM_MOD_IDS.indexOf(id); });
    const body = `CM-${D.CUSTOM_CHAR_CODE[c.char]}-${p}A${c.ascension}-${c.seed}-${b32(bits, 3)}`;
    return body + B32[fnv1a(body) % 32];
  }
  /** Lee un código. Tolera minúsculas, texto alrededor, espacios (o guiones largos) en lugar de guiones, Ø por 0 y, fuera de
   *  la semilla, O por 0 (e I/L por 1 en el bloque final). Devuelve la cfg normalizada o null si no es válido. */
  function decodeCustom(text) {
    const s = String(text || '').toUpperCase().replace(/Ø/g, '0').replace(/[\s\-‐-―_]+/g, '-');
    const m = s.match(/CM-([A-Z0-9]{4})-([0-3O])A([0-9O]{1,2})-([A-Z0-9]{1,12})-([0-9A-Z]{4})(?![0-9A-Z])/);
    if (!m) return null;
    const pa = m[2].replace(/O/g, '0'), as = m[3].replace(/O/g, '0'), seed = m[4];
    const pj = m[1].replace(/0/g, 'O');   // los códigos de personaje solo llevan letras (PIRO, CRIO…)
    const ch = Object.keys(D.CUSTOM_CHAR_CODE).find((k) => D.CUSTOM_CHAR_CODE[k] === pj);
    if (!ch) return null;
    let bits = -1;
    const tail = crock(m[5]), body = `CM-${pj}-${pa}A${Number(as)}-${seed}-`;
    if (/^[0-9A-Z]{4}$/.test(tail) && [...tail].every((x) => B32.includes(x)) && B32[fnv1a(body + tail.slice(0, 3)) % 32] === tail[3])
      bits = [...tail.slice(0, 3)].reduce((n, x) => n * 32 + B32.indexOf(x), 0);
    else {   // código de la 3.4.0 (base 36, sin tolerancia en ese bloque)
      const old = m[5], bodyOld = body + old.slice(0, 3);
      if (B36[fnv1a(bodyOld) % 36] === old[3]) bits = parseInt(old.slice(0, 3), 36);
    }
    const asc = Number(as);
    if (bits < 0 || asc > D.MAX_ASCENSION || bits >= 1 << D.CUSTOM_MOD_IDS.length) return null;   // control: código mal copiado
    const pi = Number(pa), paths = D.CHARACTERS[ch].paths;
    return normalizeCustom({ char: ch, path: pi ? (paths[pi - 1] || {}).id : '', ascension: asc, seed, mods: D.CUSTOM_MOD_IDS.filter((id, i) => bits & (1 << i)) });
  }
  /** Crea la partida personalizada (la senda «al azar» sale de la semilla, sin tocar run.rng). */
  function newCustomRun(cfg) {
    const c = normalizeCustom(cfg), seed = fnv1a('cm-custom-' + c.seed), paths = D.CHARACTERS[c.char].paths;
    const path = c.path || paths[fnv1a('cm-path-' + c.seed) % paths.length].id;
    const run = newRun(seed, { ascension: c.ascension, char: c.char, path, custom: c });
    run.custom = Object.assign({}, c, { code: encodeCustom(c) });
    return run;
  }
  /** Modificadores de inicio (newRun, antes de generar el mapa: así el azar queda fijado por el código). */
  function applyCustomStart(run, c) {
    run.custom = c;   // newCustomRun le añade luego el código
    const has = (id) => c.mods.includes(id);
    if (has('caos')) {   // 10 cartas al azar de tu personaje (sin iniciales, legendarias ni bloqueadas); la ★ de la senda se queda y cuenta entre las 10
      const star = run.path && D.PATHS[run.path].star;
      const pool = Object.keys(D.CARDS).filter((id) => { const d = D.CARDS[id]; return d.class === run.char && ['common', 'uncommon', 'rare'].includes(d.rarity) && !isLocked(run, id); });
      run.deck = run.deck.filter((x) => x.id === star);
      while (run.deck.length < 10) run.deck.push({ uid: run.uidNext++, id: pick(run, pool), up: false });
    }
    if (has('arsenal')) run.deck.forEach((x) => { if (canUpgrade(x)) x.up = true; });
    if (has('maldito')) for (let i = 0; i < 2; i++) run.deck.push({ uid: run.uidNext++, id: 'escalofrio', up: false });
    if (has('cristal')) { run.maxHp = Math.max(1, Math.round(run.maxHp * 0.5)); run.hp = run.maxHp; }
    if (has('rico')) run.gold = CUSTOM_RICH_GOLD;
    if (has('reliquias')) {   // 3 reliquias comunes (las de todos los personajes, como la Herencia) al azar
      const pool = shuffle(run, Object.keys(D.RELICS).filter((id) => !hasRelic(run, id) && !D.RELICS[id].starter && D.RELICS[id].class === 'any' && relicInAct(run, id) && !isLocked(run, id)));
      pool.slice(0, CUSTOM_RELICS).forEach((id) => addRelic(run, id));
    }
  }
  /** Mapa: Élite total (combate → élite) · Sin descanso (hoguera → «?») · Sin tiendas (tienda → «?», y ningún «?» esconde tienda). */
  function customMap(run, nodes) {
    if (!run.custom) return;
    for (const n of Object.values(nodes)) {
      if (hasCustom(run, 'elitetotal') && n.type === 'combat') n.type = 'elite';
      if (hasCustom(run, 'sindescanso') && n.type === 'rest') { n.type = 'event'; n.inner = 'event'; }
      if (hasCustom(run, 'sintiendas') && (n.type === 'shop' || n.type === 'peddler')) { n.type = 'event'; n.inner = 'event'; }
      if (hasCustom(run, 'sintiendas') && (n.type === 'event' || n.type === 'mystery') && n.inner === 'shop') n.inner = 'event';
    }
  }

  /* ---------- Gráfica de partida: una entrada por sala terminada ---------- */
  function roomDone(run, extra) {
    const n = run.pos && run.map && run.map.nodes[run.pos];
    const e = { floor: run.stats.floors || 0, hp: Math.max(0, run.hp), maxHp: run.maxHp, gold: run.gold, type: n ? n.type : 'start', ...(extra || {}) };
    const tl = run.stats.timeline = run.stats.timeline || [];
    if (tl.length && tl[tl.length - 1].floor === e.floor && e.floor > 0) tl[tl.length - 1] = e; else tl.push(e);
  }
  /** Daño recibido por piso (para el «piso más duro»). */
  function floorDamage(run, n) {
    if (n <= 0) return;
    const f = run.stats.dmgByFloor = run.stats.dmgByFloor || {};
    f[run.stats.floors || 0] = (f[run.stats.floors || 0] || 0) + n;
  }

  function heal(run, amt) {
    const before = run.hp;
    run.hp = Math.min(run.maxHp, run.hp + amt);
    if (run.combat) syncHp(run);
    return run.hp - before;
  }
  /** Pérdida de vida fuera de combate (eventos). Nunca mata: deja 1 PV mínimo. */
  function loseHpSafe(run, amt) {
    const lost = Math.max(0, Math.min(amt, run.hp - 1));
    run.hp -= lost;
    if (run.combat) syncHp(run);
    run.stats.damageTaken += lost;
    floorDamage(run, lost);
    return lost;
  }
  function gainGold(run, amt) {
    run.gold = Math.max(0, run.gold + amt);
    if (amt > 0) run.stats.goldEarned += amt;
  }
  function addRelic(run, id) {
    if (hasRelic(run, id)) return;
    run.relics.push(id);
    if (id === 'obsidiana') { run.maxHp += 10; run.hp += 10; }
    if (id === 'brasaguard') { run.maxHp += 15; run.hp += 15; }
    if (id === 'cinturon' && !hasPact(run, 'pociones') && !hasRelic(run, 'odre')) { run.potions = (run.potions || []).concat([null, null]); }   // 3 → 5 huecos
    if (id === 'odre' && !hasPact(run, 'pociones')) { const keep = (run.potions || []).find(Boolean) || null; run.potions = [keep]; }   // Odre Agrietado: 1 hueco
    if (id === 'bolsaabundancia') gainGold(run, D.RELICS.bolsaabundancia.v || 75);   // Bolsa de la Abundancia
  }
  /** Recompensa de logro aún bloqueada para esta partida (run.unlocked = las desbloqueadas al empezarla). */
  const isLocked = (run, id) => !!D.REWARD_LOCK[id] && !((run && run.unlocked) || []).includes(id);
  /** Reliquia disponible en el acto actual (las que no indican acts salen en todos). */
  const relicInAct = (run, id) => (D.RELICS[id].acts || [actOf(run)]).includes(actOf(run));
  function randomRelic(run) {
    const pool = Object.keys(D.RELICS).filter((id) => !hasRelic(run, id) && !D.RELICS[id].starter && D.RELICS[id].class === 'any' && relicInAct(run, id) && !isLocked(run, id));
    return pool.length ? pick(run, pool) : null;
  }
  /** Cartas de una rareza disponibles en un acto (las que no indican acts salen en todos). */
  /* ---------- Personajes ---------- */
  /** Personaje de la partida (partidas antiguas: Piromago). */
  const charOf = (run) => (run && D.CHARACTERS[run.char] ? run.char : 'piromago');
  const charDef = (run) => D.CHARACTERS[charOf(run)];
  /** ¿El personaje tiene esta mecánica? ('temp' = Temperatura y Sobrecalentamiento) */
  const hasMech = (run, m) => charDef(run).mechanics.includes(m);

  /* ---------- Paladín: Fervor, Juicio e Inmaterial ---------- */
  /** Fervor: +1 al daño de tus ataques por cada 10 % de PV que te falte (+2 con el Cilicio de Hierro). */
  const fervorOf = (run) => (hasMech(run, 'fervor')
    ? (Math.floor(10 * Math.max(0, run.maxHp - run.hp) / Math.max(1, run.maxHp)) + (hasRelic(run, 'cilicioh') ? (D.RELICS.cilicioh.v || 2) : 0) + votiveFervor(run.combat))
      * (run.combat && run.combat.player && run.combat.player.powers && run.combat.player.powers.avatar ? 2 : 1) : 0);   // Avatar de la Luz: cuenta el doble
  /** Llama Votiva: +1 de Fervor por cada N PV perdidos por tus cartas en este combate (por copia). */
  const votiveFervor = (c) => (c && c.player && c.player.powers && c.player.powers.votiva ? c.player.powers.votiva * Math.floor((c.selfLost || 0) / (c.votivaPer || 8)) : 0);
  /** Copia en el combate lo que depende de los PV (Fervor y % de PV: Ira Divina, Égida…). Avisa a la interfaz si cambia el Fervor. */
  function syncHp(run, ev) {
    const c = run.combat;
    if (!c || !c.player) return;
    c.player.hpPct = run.hp / Math.max(1, run.maxHp);
    const f = fervorOf(run);
    if (f !== (c.player.fervor || 0)) { c.player.fervor = f; if (ev) ev.push({ t: 'fervor', value: f }); }
  }
  /** Carta disponible para un personaje: la suya o neutral (nunca maldiciones). */
  const cardForChar = (id, ch) => { const k = D.CARDS[id].class; return k === ch || k === 'neutral'; };
  /** Reliquia o poción disponible para un personaje: 'any' o la suya. */
  const itemForChar = (item, ch) => !item.class || item.class === 'any' || item.class === ch;

  /** Cartas de una rareza disponibles en un acto (las que no indican acts salen en todos) y para un personaje. */
  function cardsOfRarity(r, act = 1, ch = 'piromago', neutral = false, run = null) {
    // neutral: solo las neutrales; si no, solo las del personaje (las neutrales salen aparte, 10% por hueco)
    // run: quita las recompensas de logro que esa partida aún no tiene desbloqueadas (sin run: todas bloqueadas)
    return Object.keys(D.CARDS).filter((id) => D.CARDS[id].rarity === r && (D.CARDS[id].acts || [act]).includes(act) && (neutral ? D.CARDS[id].class === 'neutral' : D.CARDS[id].class === ch) && !isLocked(run, id));
  }
  /** Legendarias desbloqueadas que puede recibir esta partida (las neutrales y las de su personaje). */
  const legendaryPool = (run) => Object.keys(D.CARDS).filter((id) => D.CARDS[id].rarity === 'legendary' && cardForChar(id, charOf(run)) && !isLocked(run, id));
  /** Élite o jefe: 2% por carta de que sea legendaria (sin legendarias desbloqueadas no se tira el dado: mismo azar que antes). */
  function rollLegendary(run) {
    const pool = legendaryPool(run);
    return pool.length && rand(run) < D.LEGENDARY_CHANCE ? pick(run, pool) : null;
  }
  const NEUTRAL_CHANCE = 0.10;
  const PATH_PER = 0.35, PATH_MAX = 2.5, PATH_FIT = 3;   // sendas: +35 % de peso por carta de esa senda (tope ×2,5); «encaja» con 3+
  function randomCard(run, rarity) { return pick(run, cardsOfRarity(rarity, actOf(run), charOf(run), false, run)); }

  /* ---------- Sendas: sesgo de recompensas ---------- */
  /** Cuántas cartas de cada senda hay en el mazo: { brasa: 3, … }. */
  function pathCounts(run) {
    const out = {};
    for (const c of run.deck || []) for (const t of (D.CARDS[c.id] && D.CARDS[c.id].tags) || []) out[t] = (out[t] || 0) + 1;
    return out;
  }
  /** Peso de una carta al generar opciones: ×(1 + 0,35·k) por la senda suya que más llevas (máx. ×2,5). */
  function pathWeight(id, counts) {
    let w = 1;
    for (const t of D.CARDS[id].tags || []) w = Math.max(w, Math.min(PATH_MAX, 1 + PATH_PER * (counts[t] || 0)));
    return w;
  }
  /** «✦ Encaja con tu mazo»: comparte senda con 3 o más cartas tuyas. */
  const fitsDeck = (run, id, counts = pathCounts(run)) => ((D.CARDS[id] && D.CARDS[id].tags) || []).some((t) => (counts[t] || 0) >= PATH_FIT);
  /** pick con pesos (una sola tirada; con todos los pesos iguales es exactamente pick). */
  function pickWeighted(run, pool, counts) {
    const ws = pool.map((id) => pathWeight(id, counts));
    if (ws.every((w) => w === 1)) return pick(run, pool);
    const total = ws.reduce((a, w) => a + w, 0);
    let r = rand(run) * total;
    for (let i = 0; i < pool.length; i++) if ((r -= ws[i]) < 0) return pool[i];
    return pool[pool.length - 1];
  }

  /**
   * Elige `n` cartas distintas según probabilidades de rareza. Sendas: las cartas de las sendas que llevas pesan
   * más (pathWeight), salvo una de cada 3 opciones (la 3.ª, 6.ª…), que sigue siendo totalmente aleatoria.
   */
  function rollCards(run, n, odds, legendary = false) {
    const out = [], counts = pathCounts(run);
    let guard = 0;
    while (out.length < n && guard++ < 200) {
      const leg = legendary ? rollLegendary(run) : null;   // élite: 2% de legendaria (si hay alguna desbloqueada)
      if (leg && !out.includes(leg)) { out.push(leg); continue; }
      const neutral = rand(run) < NEUTRAL_CHANCE;   // 10% por hueco: carta neutral (con su rareza normal)
      const r = weighted(run, odds);
      const pool = neutral ? cardsOfRarity(r, actOf(run), charOf(run), true, run) : null;
      const free = out.length % 3 === 2;            // una de cada 3: sin sesgo
      const own = !(pool && pool.length) ? cardsOfRarity(r, actOf(run), charOf(run), false, run) : null;
      const id = pool && pool.length ? pick(run, pool) : (free ? pick(run, own) : pickWeighted(run, own, counts));
      if (id && !out.includes(id)) out.push(id);   // (un personaje sin cartas de esa rareza no rompe nada)
    }
    return out;
  }
  const ODDS_NORMAL = [['common', 60], ['uncommon', 35], ['rare', 5]];
  /** Cartas por recompensa: 3, +1 Saco Sin Fondo, −1 Brasa del Guardián (se compensan). */
  const rewardCount = (run) => 3 + (hasRelic(run, 'saco') ? 1 : 0) - (hasRelic(run, 'brasaguard') ? 1 : 0);
  const ODDS_ELITE = [['common', 35], ['uncommon', 47], ['rare', 18]];
  const ODDS_SHOP = [['common', 45], ['uncommon', 40], ['rare', 15]];

  /* ------------------------------------------------------------------ *
   * Mapa: caminos que suben desde la Entrada hasta el Jefe, sin cruces.
   * ------------------------------------------------------------------ */
  function genMap(run) {
    const nodes = {};
    const key = (r, l) => `${r}_${l}`;
    const edges = new Set();
    const ensure = (r, l) => (nodes[key(r, l)] ||= { id: key(r, l), row: r, lane: l, type: null, next: [] });

    // Los dos primeros caminos no salen de su mitad del mapa (nunca se tocan): uno será la ruta arriesgada
    // (élites y, a veces, la Élite Dorada) y el otro la segura (tienda y hogueras). Los otros dos van libres.
    const routes = [[], []];
    for (let p = 0; p < 4; p++) {
      let lane = p === 0 ? randInt(run, 0, 1) : p === 1 ? randInt(run, 2, 3) : randInt(run, 0, LANES - 1);
      const lo = p === 1 ? 2 : 0, hi = p === 0 ? 1 : LANES - 1;
      ensure(0, lane);
      if (p < 2) routes[p].push(key(0, lane));
      for (let r = 0; r < ROWS - 1; r++) {
        const opts = [lane - 1, lane, lane + 1]
          .filter((l) => l >= lo && l <= hi)
          // Evita cruces: moverse de lane→l cruza la arista l→lane de la misma fila
          .filter((l) => l === lane || !edges.has(`${key(r, l)}>${key(r + 1, lane)}`));
        const nl = pick(run, opts);
        ensure(r + 1, nl);
        const from = nodes[key(r, lane)];
        if (!from.next.includes(key(r + 1, nl))) from.next.push(key(r + 1, nl));
        edges.add(`${key(r, lane)}>${key(r + 1, nl)}`);
        lane = nl;
        if (p < 2) routes[p].push(key(r + 1, nl));
      }
    }
    nodes.boss = { id: 'boss', row: ROWS, lane: (LANES - 1) / 2, type: 'boss', next: [] };
    Object.values(nodes).forEach((n) => { if (n.row === ROWS - 1) n.next = ['boss']; });

    assignTypes(run, nodes);
    const riskyLeft = rand(run) < 0.5;
    const risky = riskyLeft ? routes[0] : routes[1], safe = riskyLeft ? routes[1] : routes[0];
    routeProfiles(run, nodes, risky, safe);
    customMap(run, nodes);   // Personalizado: Élite total / Sin descanso / Sin tiendas (no gasta azar)
    // Jefe del acto: uno de los posibles, con run.rng (el diario sigue siendo determinista).
    // Las partidas guardadas antes de los jefes alternativos no tienen run.boss → siempre el de siempre.
    if (run.boss) { const list = bossesOf(actOf(run)); if (list.length) run.boss[actOf(run)] = pick(run, list); }
    // Personalizado «Doble jefe»: otro jefe distinto del mismo acto le acompaña
    if (hasCustom(run, 'doblejefe')) {
      const others = bossesOf(actOf(run)).filter((id) => id !== bossOf(run));
      if (others.length) run.boss2 = Object.assign({}, run.boss2, { [actOf(run)]: pick(run, others) });
    }
    return { nodes, rows: ROWS, lanes: LANES, risky, safe };
  }
  /**
   * Perfiles de ruta (Parche 3.5): la segura lleva tienda (fila 2), hoguera (fila 3) y hoguera o tienda (fila 5) y ninguna
   * élite; la arriesgada, élites en las filas 3 y 6 y, en el 35 % de los actos, la Élite Dorada (como mucho 1) en un carril
   * del borde de las filas 5–6, a ser posible en ella (fila 5: 3 élites seguidas para quien las busque).
   */
  function routeProfiles(run, nodes, risky, safe) {
    const at = (route, r) => nodes[route.find((id) => nodes[id].row === r)];
    const set = (n, t) => { if (n) { n.type = t; delete n.inner; } };   // (un Misterio que pasa a ser otra cosa ya no esconde nada)
    set(at(safe, 2), 'shop');
    set(at(safe, 3), 'rest');
    const s5 = at(safe, 5); if (s5) set(s5, rand(run) < 0.5 ? 'rest' : 'shop');
    safe.forEach((id) => { if (nodes[id].type === 'elite') set(nodes[id], 'combat'); });
    (actOf(run) === 1 ? [6] : [3, 6]).forEach((r) => set(at(risky, r), 'elite'));   // Acto I: el mazo inicial no aguanta una élite en el 4.º piso
    if (rand(run) < GOLD_ELITE_CHANCE) {
      const edge = (n) => (n.lane === 0 || n.lane === LANES - 1) && (n.row === 5 || n.row === 6);   // carriles del borde, filas 5–6
      let cands = risky.map((id) => nodes[id]).filter((n) => edge(n) && n.row === 5);   // en la ruta arriesgada, entre sus dos élites
      if (!cands.length) cands = risky.map((id) => nodes[id]).filter(edge);
      if (!cands.length) cands = Object.values(nodes).filter((n) => edge(n) && !safe.includes(n.id) && ['combat', 'elite', 'event', 'mystery'].includes(n.type));
      if (cands.length) set(pick(run, cands), 'goldelite');
    }
  }

  function parentsOf(nodes, id) {
    return Object.values(nodes).filter((n) => n.next.includes(id));
  }

  function assignTypes(run, nodes) {
    const byRow = (r) => Object.values(nodes).filter((n) => n.row === r).sort((a, b) => a.lane - b.lane);
    const NO_REPEAT = ['elite', 'shop', 'rest', 'event', 'mystery', 'forge', 'peddler', 'cursedaltar'];
    const CAP = { forge: 2, peddler: 1, cursedaltar: 1 }, used = {};   // como mucho, por acto
    for (let r = 0; r < ROWS; r++) {
      for (const n of byRow(r)) {
        if (r === 0) { n.type = 'combat'; continue; }
        if (r === 4) { n.type = 'chest'; continue; }
        if (r === ROWS - 1) { n.type = 'rest'; continue; }
        const table = [['combat', 44], ['event', 14], ['mystery', 12]];
        if (r >= 3) table.push(['elite', 4]);   // (la ruta arriesgada ya trae su élite)
        if (r >= 2) table.push(['shop', 7], ['forge', 6], ['peddler', 4], ['cursedaltar', 3]);
        if (r >= 3 && r !== ROWS - 2) table.push(['rest', 8]);
        const tbl = table.filter(([t]) => !CAP[t] || (used[t] || 0) < CAP[t]);
        const parents = parentsOf(nodes, n.id).map((p) => p.type);
        let t, tries = 0;
        do { t = weighted(run, tbl); } while (NO_REPEAT.includes(t) && parents.includes(t) && ++tries < 12);
        n.type = t;
        used[t] = (used[t] || 0) + 1;
      }
    }
    // Garantiza al menos una tienda en el piso
    const all = Object.values(nodes);
    if (!all.some((n) => n.type === 'shop')) {
      const cands = all.filter((n) => n.row >= 2 && n.row <= 6 && (n.type === 'event' || n.type === 'combat'));
      if (cands.length) pick(run, cands).type = 'shop';
    }
    // Misterio: se revela al entrar (el Mapa del Cartógrafo y los rumores de la Posada lo enseñan antes)
    all.filter((n) => n.type === 'mystery').forEach((n) => { n.inner = weighted(run, MYSTERY_ODDS); });
  }
  const MYSTERY_ODDS = [['event', 60], ['combat', 20], ['shop', 10], ['chest', 10]];
  const GOLD_ELITE_CHANCE = 0.35;

  function availableNodes(run) {
    const { nodes } = run.map;
    if (run.warp && run.warp.length) return run.warp.slice();   // La Grieta: salto a la fila anterior al jefe
    if (!run.pos) return Object.values(nodes).filter((n) => n.row === 0).map((n) => n.id);
    return nodes[run.pos].next.slice();
  }

  /**
   * Frasco de Viento: una vez por acto, salas de la fila siguiente vecinas de tu posición (carril ±1)
   * que NO están unidas a tu camino. Vacío si no tienes el frasco, ya lo usaste en este acto o no hay ninguna.
   */
  function windNodes(run) {
    if (!hasRelic(run, 'frascoviento') || (run.windUsed || []).includes(actOf(run)) || (run.warp && run.warp.length) || !run.pos) return [];
    const { nodes } = run.map, here = nodes[run.pos], av = availableNodes(run);
    return Object.values(nodes).filter((n) => n.id !== 'boss' && n.row === here.row + 1 && Math.abs(n.lane - here.lane) <= 1 && !av.includes(n.id)).map((n) => n.id);
  }
  /** Viaja a un nodo disponible (o, con el Frasco de Viento, a uno de windNodes). Devuelve eventos (solo si empieza un combate). */
  function enterNode(run, nodeId) {
    if (run.combat || run.pending || run.over) throw new Error('No se puede viajar ahora.');
    if (!availableNodes(run).includes(nodeId)) {
      if (!windNodes(run).includes(nodeId)) throw new Error('Nodo no disponible.');
      run.windUsed = (run.windUsed || []).concat(actOf(run));   // se gasta el Frasco de este acto
    }
    const node = run.map.nodes[nodeId];
    // La Grieta: los pisos saltados se apuntan en el rastro del diario como niebla
    if (run.warp) {
      const from = run.pos ? run.map.nodes[run.pos].row : -1;
      for (let r = from + 1; r < node.row; r++) trail(run, 'S');
      delete run.warp;
    }
    run.pos = nodeId;
    node.visited = true;
    run.stats.floors = (actOf(run) - 1) * FLOORS_PER_ACT + node.row + 1;   // acto 2 = pisos 10..18 · acto 3 = 19..27
    // Misterio: lo que había dentro (evento, combate, tienda o cofre)
    const kind = node.type === 'mystery' ? (node.inner || 'event') : node.type === 'event' && node.inner && node.inner !== 'event' ? node.inner : node.type;   // (partidas guardadas antes del 3.5: «?» con tienda o cofre)
    (run.stats.nodeSeen = run.stats.nodeSeen || {})[node.type] = (run.stats.nodeSeen[node.type] || 0) + 1;
    // Rastro del diario (una casilla por piso): las salas sin combate se apuntan al entrar
    if (!['combat', 'elite', 'boss', 'goldelite'].includes(kind)) trail(run, 'B');

    switch (kind) {
      case 'combat': return startNormal(run, node);
      case 'elite': case 'goldelite': return startElite(run, kind === 'goldelite');
      case 'boss': {
        const b2 = hasCustom(run, 'doblejefe') && run.boss2 && run.boss2[actOf(run)];
        if (actOf(run) >= D.LAST_ACT) contractTick(run, 'finalBoss');   // Contrato «Cofre Lleno»
        return startCombat(run, b2 ? [bossOf(run), b2] : bossOf(run), 'boss');
      }
      case 'event': {
        // Brújula Rota: 25 % de que una sala de evento sea un cofre
        if (node.type === 'event' && hasRelic(run, 'brujula2') && rand(run) < 0.25) return openChest(run);
        const ev = pickEvent(run);
        if (!ev) return openChest(run);   // ningún evento se repite: si no queda ninguno, un cofre
        run.seenEvents = (run.seenEvents || []).concat(ev);
        run.stats.events = (run.stats.events || 0) + 1;   // misión «Vive 6 eventos»
        run.pending = { kind: 'event', id: ev, result: null };
        return [];
      }
      case 'shop': run.pending = { kind: 'shop', stock: genShop(run) }; return [];
      case 'peddler': run.pending = { kind: 'shop', stock: genPeddler(run), peddler: true }; return [];
      case 'forge': run.pending = { kind: 'event', id: 'forjanodo', result: null }; return [];
      case 'cursedaltar': run.pending = { kind: 'event', id: 'altarmaldito', result: null }; return [];
      case 'rest': run.pending = { kind: 'rest', done: false }; return [];
      case 'chest': return openChest(run);
    }
    return [];
  }
  function openChest(run) {
    const relic = randomRelic(run);
    run.pending = { kind: 'chest', relic, gold: relic ? 0 : 60, taken: false };
    return [];
  }
  /**
   * Evento al azar del acto: nunca uno ya visto en esta partida (null si no queda ninguno). Las consecuencias
   * de una cadena (needs) salen primero; los de nodo (Forja, Altar Maldito, contrato) nunca salen aquí.
   */
  function pickEvent(run) {
    const act = actOf(run), seen = run.seenEvents || [];
    const ids = Object.keys(D.EVENTS).filter((k) => { const e = D.EVENTS[k];
      return !e.node && (e.acts || [1]).includes(act) && (!e.onlyBoss || e.onlyBoss === bossOf(run)) && (!e.needs || e.needs(run)) && !seen.includes(k); });
    if (!ids.length) return null;
    const chain = ids.filter((k) => D.EVENTS[k].needs);
    return pick(run, chain.length ? chain : ids);
  }
  /**
   * Combate normal (Parche 3.5: variedad): nunca el mismo que el anterior del acto, y cada grupo como mucho 2 veces
   * por partida. ~35 % de los combates (desde el 2.º piso del acto) son un grupo.
   */
  function startNormal(run, node) {
    const enc = encounters(run), pool = node.row <= 2 ? enc.easy : enc.hard;
    const fresh = pool.filter((x) => x !== run.lastEnemy && x !== run.lastEnc);   // nunca el mismo que el anterior del acto
    let id = pick(run, fresh.length ? fresh : pool);
    if ((enc.groups || []).length && node.row >= 1 && !run.noGroups && (run.testGroups || rand(run) < GROUP_CHANCE)) {   // run.noGroups / testGroups: solo tests
      const seen = run.groupSeen = run.groupSeen || {};
      const ok = enc.groups.filter((x) => (seen[x.join('+')] || 0) < 2 && x.join('+') !== run.lastEnc);
      if (ok.length || run.testGroups) id = pick(run, ok.length ? ok : enc.groups);
    }
    const k = Array.isArray(id) ? id.join('+') : id;
    if (Array.isArray(id)) run.groupSeen[k] = (run.groupSeen[k] || 0) + 1;
    run.lastEnc = k;
    return startCombat(run, id, 'normal', { easy: node.row <= 2 });
  }
  /** Élite (una de las del acto es un grupo), sin repetir la anterior del acto. golden: Élite Dorada (2 afijos). */
  function startElite(run, golden) {
    const enc = encounters(run);
    const pool = enc.elite.concat(run.noGroups ? [] : (enc.eliteGroups || []).map((x) => x.join('+')));
    let id;
    if (run.testGroups && (enc.eliteGroups || []).length && rand(run) < 0.5) id = enc.eliteGroups[0].join('+');
    else { const fresh = pool.filter((x) => x !== run.lastElite); id = pick(run, fresh.length ? fresh : pool); }
    run.lastElite = id;
    return startCombat(run, id.includes('+') ? id.split('+') : id, 'elite', { golden: !!golden });
  }

  /* ------------------------------------------------------------------ *
   * Combate
   * ------------------------------------------------------------------ */
  function enemyMoves(e) {
    const d = D.ENEMIES[e.id];
    if (e.phase === 3 && d.phase3) return d.phase3.moves;
    return e.phase >= 2 && d.phase2 ? d.phase2.moves : d.moves;
  }
  function currentMove(e) { const m = enemyMoves(e); return m[e.moveIdx % m.length]; }

  /** Intención visible del enemigo, con el daño ya ajustado por su Fuerza. */
  function intentOf(combat) {
    const e = combat.enemy;
    const m = currentMove(e);
    if (e.frozen) return { name: _t('e.congelado'), kind: 'frozen', frozen: true };   // pierde su siguiente turno
    if (e.stunned) return { name: _t('e.aturdido'), kind: 'frozen', frozen: true, stunned: true };   // Amuleto del Fénix
    // Carga Arcana en curso: «Cargando… n» y, al llegar a 0, el golpe
    if (e.charging) {
      const ch = e.charging, hit = enemyHit(e, ch.hit);
      if (ch.left > 0) return { name: _t('e.chargingN', { m: chargeName(ch), n: ch.left }), kind: 'charge', charge: ch.left, chargeHit: hit, charging: true };
      const out = { name: chargeName(ch), kind: 'attack', dmg: hit, hits: 1, unleash: true };
      if (combat.summons && combat.summons.length) { const s0 = combat.summons[0]; out.target = { sid: s0.sid, id: s0.id, name: D.SUMMONS[s0.id].name }; }
      return out;
    }
    const out = { name: m.name, kind: 'buff' };
    if (m.dmg) { out.kind = 'attack'; out.dmg = enemyHit(e, m.dmg); out.hits = m.hits || 1; }
    else if (m.weak) out.kind = 'debuff';
    else if (m.block && !m.str) out.kind = 'defend';
    if (m.block && e.noBlock) { if (out.kind === 'defend') out.kind = 'buff'; }   // Titán sin coraza: ya no gana Bloqueo
    else if (m.block) out.block = m.block;
    if (m.heal && (e.heals || 0) < HEAL_MAX) out.heal = m.heal;   // Brote: solo HEAL_MAX veces por combate (evita combates infinitos)
    if (m.str) out.str = m.str;
    if (m.weak) out.weak = m.weak;
    if (m.chill) out.chill = m.chill;
    if (m.curse) out.curse = m.curse;
    if (m.douse) out.douse = true;
    if (m.drain) out.drain = m.drain;
    if (m.silence) out.silence = m.silence;
    if (m.reflect) out.reflect = m.reflect;
    if (m.inkCurse) out.inkCurse = m.inkCurse;
    if (m.charge) { out.kind = 'charge'; out.charge = m.charge; out.chargeHit = enemyHit(e, m.chargeHit); out.name = _t('e.0_cargando_1', { 0: m.name, 1: m.charge }); }
    else if (!m.dmg && (m.drain || m.silence || m.inkCurse) && out.kind === 'buff') out.kind = 'debuff';
    if (hasAffix(e, 'veloz') && !e.actedOnce) out.twice = true;   // actuará dos veces
    // Invocadora: los golpes van primero a la criatura más antigua
    if (out.dmg !== undefined && combat.summons && combat.summons.length) { const s0 = combat.summons[0]; out.target = { sid: s0.sid, id: s0.id, name: D.SUMMONS[s0.id].name }; }
    return out;
  }

  /**
   * Rastro de la partida (para «Compartir» del diario), un código por piso jugado:
   * G combate ganado sin bajar del 50% de vida · Y ganado bajando del 50% · B sala sin combate
   * E élite ganada · K jefe vencido · X donde moriste.
   */
  function trail(run, code) { run.stats.trail = (run.stats.trail || []).concat(code); }

  /* ---------- Combates en grupo (Parche 3.2) ----------
   * combat.enemies: de 1 a 3 enemigos, de izquierda a derecha. combat.target: índice del MARCADO (retícula dorada).
   * combat.enemy es un ALIAS que no se guarda (getter no enumerable): durante el turno enemigo apunta al que está
   * actuando (combat._focus) y el resto del tiempo, al marcado. Así todo el motor de un solo enemigo sigue igual.
   *
   * A QUIÉN VA CADA EFECTO
   * | Efecto                                                         | Objetivo                                        |
   * |----------------------------------------------------------------|-------------------------------------------------|
   * | Carta 'one' (todas las de antes, salvo las de área)            | el elegido (pasa a ser el marcado)              |
   * | Carta 'all'                                                    | cada enemigo vivo, de izquierda a derecha       |
   * | Carta 'random'                                                 | un enemigo vivo al azar (run.rng)               |
   * | Golpes que le quedan a una carta si su objetivo muere          | el siguiente vivo (nuevo marcado)               |
   * | Coste según Escarcha/Quemadura/Juicio del enemigo (Témpano…)   | el marcado                                      |
   * | Runas: pasivos y detonaciones                                  | el marcado                                      |
   * | Criaturas: ataques al final de tu turno                        | el marcado                                      |
   * | Reliquias (Carbón, Corazón Gélido, Estandarte del Alba…)       | el marcado                                      |
   * | Pociones de un objetivo (Fuego, Hielo…)                        | el marcado                                      |
   * | Poderes automáticos (Corazón Polar, Incendio Controlado…)      | el enemigo que tiene el estado / el marcado     |
   * | Espinas, Reflejo, Escudo Reflejo, Espejo, Contraataque Gélido  | el enemigo que te está atacando                 |
   * | Quemadura, Escarcha, Juicio, Congelado, Carga, Fuerza, afijos  | por enemigo: cada uno los suyos y su propio tic  |
   * | Daño enemigo a ti y a tus criaturas                            | igual que con uno: lo hace cada enemigo         |
   * Si el marcado muere, el marcado pasa al siguiente vivo (hacia la derecha; si no hay, desde la izquierda).
   * El combate se gana cuando mueren todos; el turno enemigo va de izquierda a derecha y los muertos no actúan.
   */
  const alive = (e) => !!e && !e.dead && e.hp > 0;
  /** Cartas de área (y Frasco Explosivo): mientras combat.spread está puesto, cada golpe y cada Quemadura, Escarcha o
   *  Juicio que haría al enemigo se lo hace a todos los vivos, de izquierda a derecha (las cuentas, con los datos del marcado). */
  function spreadHit(run, fn) {
    const c = run.combat;
    if (!c || !c.spread || c._spr || c.enemies.length < 2) return fn();
    c._spr = true;
    try { eachAlive(c, fn); } finally { delete c._spr; }
  }
  /** Operaciones de carta que en área se repiten enemigo a enemigo con SUS datos (Escarcha, Juicio…) en vez de copiarse. */
  const PER_ENEMY_OPS = new Set(['storm', 'finalJudgment', 'shatter', 'combust', 'consumeBurn', 'sentence', 'zap']);
  /** Lista de eventos de un paso: cada evento lleva ei = el enemigo al que se refiere (el que actúa o el marcado),
   *  para que la interfaz sepa a qué enemigo animar. */
  function evList(run) {
    const ev = [];
    Object.defineProperty(ev, 'push', { value(...xs) {
      const c = run.combat;
      if (c && c.enemies) { const ei = c._focus !== undefined ? c._focus : c.target; for (const x of xs) if (x && typeof x === 'object' && x.ei === undefined) x.ei = ei; }
      for (const x of xs) if (x && x.t === 'relicFx' && x.id && run.stats) relicUse(run, x.id);   // «Reliquia clave» (momentos destacados)
      return Array.prototype.push.apply(this, xs);
    } });
    return ev;
  }
  /** Una activación de reliquia (para la «Reliquia clave» del final). */
  function relicUse(run, id) {
    if (!D.ALL_RELICS[id]) return;
    const u = run.stats.relicUses = run.stats.relicUses || {};
    u[id] = (u[id] || 0) + 1;
  }
  const GROUP_CHANCE = 0.35;
  /** Escala de PV y daño en grupo (las variantes menores ya vienen al ~60 % y no se tocan). */
  const GROUP_SCALE = { normal: { hp: 0.7, dmg: 0.75 }, eliteAdd: { hp: 0.75, dmg: 0.8 }, spawn: { hp: 0.4, dmg: 0.5, minors: true }, easy: { hp: 0.8, dmg: 0.85 } };
  /** Prepara un combate recién creado o cargado: migra combat.enemy → enemies[0] y pone el alias. */
  function bindCombat(c) {
    if (!c) return c;
    const own = Object.getOwnPropertyDescriptor(c, 'enemy');
    if (!Array.isArray(c.enemies)) c.enemies = own && own.value ? [own.value] : [];   // partidas guardadas antes del Parche 3.2
    if (own) delete c.enemy;
    if (typeof c.target !== 'number' || !c.enemies[c.target]) c.target = 0;
    delete c._focus;
    Object.defineProperty(c, 'enemy', {
      configurable: true, enumerable: false,
      get() { return this.enemies[this._focus !== undefined ? this._focus : this.target]; },
      set(v) { this.enemies[this._focus !== undefined ? this._focus : this.target] = v; }
    });
    return c;
  }
  /** El marcado pasa al siguiente vivo si ha muerto. */
  function retarget(c) {
    const n = c.enemies.length;
    if (alive(c.enemies[c.target])) return;
    for (let k = 1; k <= n; k++) { const j = (c.target + k) % n; if (alive(c.enemies[j])) { c.target = j; return; } }
  }
  /** Marca un enemigo (UI / mando). Devuelve false si no está vivo. */
  function setTarget(run, i) {
    const c = run.combat;
    if (!c || c.over || !alive(c.enemies[i])) return false;
    c.target = i;
    return true;
  }
  /** Ejecuta fn con combat.enemy apuntando al enemigo i (y lo deja como estaba). */
  function withEnemy(c, i, fn) {
    const was = c._focus, wasObj = was !== undefined ? c.enemies[was] : null;
    c._focus = i;
    try { return fn(c.enemies[i]); } finally {
      if (was === undefined) delete c._focus;
      else { const k = c.enemies.indexOf(wasObj); c._focus = k >= 0 ? k : was; }   // por referencia: una invocación mueve los índices
    }
  }
  /** fn con cada enemigo vivo AL EMPEZAR, de izquierda a derecha, buscando su índice en cada paso: si alguien invoca a
   *  mitad (Matriarca, Archiliche), los índices se mueven y recorrerlos por número repetiría a uno o saltaría a otro. */
  function eachAlive(c, fn) {
    let r = false;
    for (const x of c.enemies.slice()) {
      if (c.over) break;
      const i = c.enemies.indexOf(x);
      if (i >= 0 && alive(x) && withEnemy(c, i, fn)) r = true;
    }
    return r;
  }
  const intentFor = (combat, i) => withEnemy(combat, i, () => intentOf(combat));
  /** Daño que de verdad te llegará este turno enemigo, por enemigo (en su orden de actuar: el Bloqueo y el Escudo de
   *  Hielo se gastan con los primeros). null si tienes criaturas (los golpes van antes a ellas). */
  function incomingDamage(combat) {
    const p = combat.player;
    if ((combat.summons || []).length) return null;
    let pool = (p.block || 0) + (p.ice || 0), imm = p.immaterial;
    return combat.enemies.map((e, i) => {
      if (!alive(e)) return 0;
      const it = intentFor(combat, i);
      if (it.dmg === undefined || it.frozen || it.stunned || it.kind === 'charge') return 0;
      let you = 0;
      for (let k = 0; k < (it.hits || 1) * (it.twice ? 2 : 1); k++) {
        let d = it.dmg;
        if (imm === 'turn') d = 0; else if (imm && d > 0) { d = 0; imm = false; }
        const a = Math.min(pool, d); pool -= a; you += d - a;
      }
      return you;
    });
  }
  const nextIntentFor = (combat, i) => withEnemy(combat, i, () => nextIntentOf(combat));
  /** Un enemigo muere: si era el último, se gana el combate; si no, sale del combate y el marcado pasa al siguiente. */
  function enemyDown(run, e, ev) {
    const c = run.combat;
    if (hasAffix(e, 'explosivo') && !e.exploded) {   // afijo «explosivo»: te inflige daño al morir (el Bloqueo lo absorbe)
      e.exploded = true;
      ev.push({ t: 'affix', id: 'explosivo' });
      log(c, ev, _m('rj.aff.explosivo', { e: RE(e), n: D.AFFIXES.explosivo.v.dmg }));
      hitPlayer(run, D.AFFIXES.explosivo.v.dmg, ev);
      if (c.over) return;
    }
    // El jefe cae: sus invocaciones desaparecen con él (no dan recompensa propia)
    const isBoss = (x) => (D.ENEMIES[x.id] || {}).tier === 'boss';
    if (isBoss(e) && c.enemies.length > 1 && !c.enemies.some((x) => x !== e && alive(x) && isBoss(x))) {   // (Doble jefe: mientras quede otro jefe, sigue)
      c.enemies.forEach((x, i) => { if (x !== e && alive(x)) { x.dead = true; x.hp = 0; x.vanished = true; ev.push({ t: 'enemyVanish', ei: i }); } });
      return winCombat(run, ev);
    }
    if (c.enemies.every((x) => x === e || !alive(x))) return winCombat(run, ev);
    e.dead = true; e.hp = 0; e.block = 0; e.charging = null; e.frozen = false;
    c.turnKills = (c.turnKills || 0) + 1; c.maxTurnKills = Math.max(c.maxTurnKills || 0, c.turnKills);   // logro «Masacre» (la última muerte la cuenta winCombat)
    const ei = c.enemies.indexOf(e);
    c.groupKills = (c.groupKills || 0) + 1;
    ev.push({ t: 'enemyDie', ei });
    log(c, ev, _m('e.0_cae_derrotado', { 0: RE(e) }));
    retarget(c);
    ev.push({ t: 'target', target: c.target });
    if (hasRelic(run, 'hoz')) { c.player.energy += 1; ev.push({ t: 'relicFx', id: 'hoz' }); ev.push({ t: 'energy', energy: c.player.energy }); log(c, ev, _m('e.hoz')); }   // Hoz de Cosechador
  }
  /** Invocaciones de un jefe (Matriarca, Archiliche): entran a la IZQUIERDA del jefe (el turno enemigo va de izquierda a derecha). */
  function spawnEnemies(run, ids, ev) {
    const c = run.combat;
    const room = 3 - c.enemies.filter(alive).length;
    const add = ids.slice(0, Math.max(0, room)).map((id) => Object.assign(makeEnemy(run, id, 'normal', false, GROUP_SCALE.spawn), { summoned: true }));
    if (!add.length) return;
    // El marcado y el que está actuando se guardan como OBJETOS: al filtrar y meter los nuevos a la izquierda cambian
    // los índices, y con dos jefes el «primer jefe de la lista» puede ser el que ya ha muerto (Doble jefe).
    const prevT = c.enemies[c.target], prevF = c._focus !== undefined ? c.enemies[c._focus] : null;
    c.enemies = c.enemies.filter((x) => alive(x) || (D.ENEMIES[x.id] || {}).tier === 'boss');   // los muertos de antes dejan sitio
    c.enemies.unshift(...add);
    c.target = Math.max(0, c.enemies.indexOf(prevT));   // sigue marcado el mismo (normalmente, el jefe)…
    if (!alive(c.enemies[c.target])) { c.target = Math.max(0, c.enemies.findIndex((x) => alive(x) && (D.ENEMIES[x.id] || {}).tier === 'boss')); retarget(c); }   // …salvo si estaba muerto: el jefe vivo
    if (prevF) { const fi = c.enemies.indexOf(prevF); if (fi >= 0) c._focus = fi; else delete c._focus; }   // el resto del movimiento sigue en quien invoca
    ev.push({ t: 'enemySpawn', n: add.length, ids: add.map((x) => x.id), target: c.target });
    add.forEach((x) => log(c, ev, _m('e.0_aparece', { 0: RE(x) })));
  }

  /** Un enemigo nuevo (PV, afijos si es el líder de un combate de élite, movimiento inicial), con run.rng. */
  function makeEnemy(run, enemyId, kind, leader, scale, golden) {
    const d = D.ENEMIES[enemyId];
    let hp = randInt(run, d.hp[0], d.hp[1]);
    const sc = scale && (!d.minor || scale.minors) ? scale : null;   // grupos: escala (las variantes menores, solo si la escala lo dice)
    if (sc) hp = Math.max(1, Math.round(hp * sc.hp));
    // Ascensión: vida (A1 normales +10%, A2 élites +15%, A6 jefe +20). Redondeo hacia arriba.
    if (d.tier === 'normal' && asc(run, 1)) hp = Math.ceil(hp * 1.10);
    if (d.tier === 'elite' && asc(run, 2)) hp = Math.ceil(hp * 1.15);
    if (d.tier === 'boss' && asc(run, 6)) hp += 20;                    // se suma a los bossMods de la Estatua
    if (d.tier === 'elite' && hasPact(run, 'elite')) hp = Math.ceil(hp * 1.25);   // Pacto: Élite feroz
    if (hasCustom(run, 'hechizo')) hp = Math.ceil(hp * (1 + CUSTOM_HECHIZO_HP));   // Personalizado: Hechizo rápido
    // Afijos de élite (1; 2 distintos en A5+), con run.rng
    const affixes = kind === 'elite' && leader ? shuffle(run, D.AFFIX_IDS.slice()).slice(0, asc(run, 5) || golden ? 2 : 1) : [];   // grupos: solo el líder · Élite Dorada: 2
    if (affixes.includes('enorme')) hp = Math.ceil(hp * (1 + D.AFFIXES.enorme.v.hp));
    const e = { id: enemyId, name: d.name, hp, maxHp: hp, block: 0, str: 0, burn: 0, judg: 0, phase: 1,
             moveIdx: d.tier === 'normal' || !leader ? randInt(run, 0, d.moves.length - 1) : 0, affixes };
    if (sc && sc.dmg !== 1) e.mult = sc.dmg;
    return e;
  }

  /** Empieza un combate. enemyId: un id, o una lista de 1 a 3 (grupo; el primero es el líder). */
  function startCombat(run, enemyId, kind, opt = {}) {
    const ids = (Array.isArray(enemyId) ? enemyId : [enemyId]).slice(0, 3);
    enemyId = ids[0];
    const d = D.ENEMIES[enemyId];
    // Grupos: los que no son variantes menores salen con menos PV y daño (el líder de una élite, entero)
    const tune = ids.length > 1 && D.GROUP_TUNE ? D.GROUP_TUNE[ids.join('+')] : null;   // ajuste propio de cada grupo (data.js)
    let gscale = tune ? Object.assign({ minors: true }, tune) : null;
    // Grupo en los primeros pisos del acto (donde tocan los enemigos fáciles): un poco más flojo aún
    if (ids.length > 1 && kind === 'normal' && opt.easy) { const b = gscale || GROUP_SCALE.normal; gscale = { hp: b.hp * GROUP_SCALE.easy.hp, dmg: b.dmg * GROUP_SCALE.easy.dmg, minors: true }; }
    const enemies = ids.map((id, i) => makeEnemy(run, id, kind, i === 0, ids.length < 2 ? null : kind === 'elite' ? (i ? gscale || GROUP_SCALE.eliteAdd : (tune && tune.lead) || null) : gscale || GROUP_SCALE.normal, !!opt.golden));
    const affixes = enemies[0].affixes;
    run.lastEnemy = enemyId;
    const c = run.combat = {
      kind, turn: 0, phase: 'player', over: null,
      enemies, groupFight: ids.length > 1,
      target: 0,
      player: { block: 0, energy: 0, maxEnergy: BASE_ENERGY, temp: 0, weak: 0, thorns: 0, fervor: 0, powers: {} },
      draw: shuffle(run, run.deck.map((x) => ({ ...x }))),
      hand: [], discard: [], exhaust: [], peakTemp: 0,
      tempCards: 0,                         // Escalofríos de este combate (no están en run.deck)
      runes: [], runeSlots: RUNE_SLOTS + (hasRelic(run, 'cuarta') ? 1 : 0), runePower: hasRelic(run, 'cincel') ? 1 : 0,   // Guardiana
      summons: [], sumSeq: 0, bondPerm: hasRelic(run, 'tambor') ? (D.RELICS.tambor.v || 1) : 0,   // Invocadora
      mods: { guante: hasRelic(run, 'guante'), brujula: hasRelic(run, 'brujula'), afilado: hasRelic(run, 'afilado'), brea: hasRelic(run, 'brea'), totem: hasRelic(run, 'totem'), estandarte: hasRelic(run, 'estandarte'), cobre: hasRelic(run, 'guantecobre') },
      noTemp: !hasMech(run, 'temp'),        // personajes sin Temperatura: no sube ni hay Sobrecalentamiento
      amuletoUsed: false,
      golden: !!opt.golden,                 // Élite Dorada: 2 reliquias a elegir y oro doble
      metronome: hasRelic(run, 'metronomo'), attacksPlayed: 0, powersPlayed: 0,
      manaFont: run.manaFont > 0,           // Fuente de Maná: +1 Energía en el primer turno (3 combates)
      log: []
    };
    bindCombat(c);
    if (run.manaFont > 0) run.manaFont--;
    syncHp(run);   // Paladín: Fervor desde el primer turno
    // Reliquias de jefe con Energía extra cada turno
    c.player.maxEnergy += D.ENERGY_BOSS_RELICS.filter((id) => hasRelic(run, id)).length;   // Corona, Núcleo y las 6 del Parche 3.5
    const ev = evList(run);
    run.stats.combatDamageTaken = 0;   // «Intocable»: daño recibido en este combate
    // Ascensión: Fuerza inicial (A7 normales y élites +1, A8 jefe +2). Sin banner: es la dificultad elegida.
    c.enemies.forEach((en, i) => withEnemy(c, i, () => {
      const d = D.ENEMIES[en.id], enemyId = en.id, affixes = en.affixes;
      const ascStr = (d.tier !== 'boss' && asc(run, 7) ? 1 : 0) + (d.tier === 'boss' && asc(run, 8) ? 2 : 0);
      if (ascStr) { c.enemy.str += ascStr; ev.push({ t: 'status', who: 'enemy', key: 'str', value: c.enemy.str }); }
      if (kind === 'boss' && run.bossMods && enemyId === D.ENCOUNTERS[1].boss) applyBossMods(run, ev);   // la Estatua solo afecta al Guardián
      // PROPUESTA (apagada): A4 también da +1 Fuerza a los enemigos del Acto III (se mide antes de decidir)
      if (ASC_PROPOSAL.a4str && asc(run, 4) && actOf(run) >= 3) c.enemy.str += 1;
      if (kind === 'boss' && d.tier === 'boss' && hasRelic(run, 'avaricioso')) c.enemy.greed = 2;   // Anillo del Avaricioso: +2 por golpe de jefe
      if (d.startBlock) { c.enemy.block += d.startBlock; ev.push({ t: 'blockEnemy', amount: d.startBlock, block: c.enemy.block }); }
      if (affixes.includes('blindado')) { const n = D.AFFIXES.blindado.v.start; c.enemy.block += n; ev.push({ t: 'blockEnemy', amount: n, block: c.enemy.block }); }
      if (affixes.includes('espejado')) { c.enemy.reflect = (c.enemy.reflect || 0) + D.AFFIXES.espejado.v.n; ev.push({ t: 'status', who: 'enemy', key: 'reflect', value: c.enemy.reflect }); }   // afijo «espejado»
    }));
    // Bomba de Humo: en un combate en grupo, el más fuerte (más PV máximos) pierde su primer turno
    if (c.enemies.length > 1 && hasRelic(run, 'bombahumo')) {
      const bi = c.enemies.reduce((b, x, i) => (x.maxHp > c.enemies[b].maxHp ? i : b), 0);
      withEnemy(c, bi, (x) => { x.stunned = true; ev.push({ t: 'relicFx', id: 'bombahumo' }); ev.push({ t: 'status', who: 'enemy', key: 'stunned', value: 1 }); log(c, ev, _m('e.bombahumo', { e: RE(x) })); });
    }
    if (affixes.length) { log(c, ev, _m('e.eliteWith', { a: R('affixes', null, { list: affixes }) })); run.stats.affixesSeen = [...new Set((run.stats.affixesSeen || []).concat(affixes))]; }
    if (hasRelic(run, 'ascua')) setTemp(c, 2, ev);
    if (hasRelic(run, 'carbon')) applyBurnRaw(c, 3, ev);   // sin bonus de Salamandra
    if (hasRelic(run, 'corona')) addCombatCurses(run, 1, 'draw', ev);
    if (hasRelic(run, 'corazon_gelido')) applyFrost(run, D.RELICS.corazon_gelido.v || 3, ev);   // Criomante: Corazón Gélido
    if (hasRelic(run, 'piedra_inicial')) engrave(run, 'piedra', ev);                             // Guardiana: Piedra Angular
    if (hasRelic(run, 'cuerno')) summon(run, 'lobezno', ev);                                      // Invocadora: Cuerno del Bosque
    if (hasRelic(run, 'pararrayos')) gainStatic(run, D.RELICS.pararrayos.v || 3, ev);               // Electromante: Pararrayos
    altStarterRelics(run, ev);                                                                     // Afinidad: reliquias iniciales alternativas
    if (hasRelic(run, 'leyden') && run.leyden > 0) { gainStatic(run, Math.min(D.RELICS.leyden.v || 5, run.leyden), ev); log(c, ev, _m('e.leyden')); }   // Botella de Leyden
    if (hasRelic(run, 'caliz')) {                         // Cáliz Ardiente (los 3 PV nunca te dejan por debajo de 1)
      setTemp(c, c.player.temp + 3, ev);
      applyBurnRaw(c, 5, ev);
      selfDamage(run, Math.min(3, run.hp - 1), ev, _t('e.caliz_ardiente'));
    }
    log(c, ev, _m('e.0_aparece', { 0: R('enemy', enemyId) }));
    startPlayerTurn(run, ev);
    startCombatRelics(run, ev);   // las que necesitan la mano inicial o el Bloqueo del primer turno
    // La Grieta: Escalofríos (solo de este combate) directamente en la mano
    if (run.nextCurses) {
      let toDiscard = 0;
      for (let i = 0; i < run.nextCurses; i++) {
        if (c.hand.length >= MAX_HAND) { toDiscard++; continue; }   // mano llena (máx. 10): van al descarte
        const card = { uid: run.uidNext++, id: 'escalofrio', up: false, temp: true };
        c.tempCards++; c.hand.push(card);
        ev.push({ t: 'draw', uid: card.uid });
      }
      if (toDiscard) addCombatCurses(run, toDiscard, 'discard', ev);
      log(c, ev, _m('e.la_niebla_de_la_grieta', { 0: run.nextCurses }));
      run.nextCurses = 0;
    }
    return ev;
  }

  /** Reliquias iniciales alternativas (Parche 3.6) que actúan al empezar el combate. */
  function altStarterRelics(run, ev) {
    const c = run.combat, R0 = D.RELICS, fx = (id) => ev.push({ t: 'relicFx', id });
    if (hasRelic(run, 'ini_mecha')) { fx('ini_mecha'); eachAlive(c, () => applyBurn1(run, R0.ini_mecha.v, ev)); }
    if (hasRelic(run, 'ini_horno')) { fx('ini_horno'); setTemp(c, c.player.temp + R0.ini_horno.v, ev); }
    if (hasRelic(run, 'ini_fuego')) { fx('ini_fuego'); c.runeSlots += 1; engrave(run, 'fuego', ev); }       // +1 ranura (4) y Fuego
    if (hasRelic(run, 'ini_viento')) { fx('ini_viento'); c.runeSlots += 1; engrave(run, 'viento', ev); }   // +1 ranura (4) y Viento
    if (hasRelic(run, 'ini_semilla')) { fx('ini_semilla'); summon(run, 'treant', ev); }
    if (hasRelic(run, 'ini_pluma')) { fx('ini_pluma'); summon(run, 'buho', ev); }
    if (hasRelic(run, 'ini_rosario')) {   // nunca te deja por debajo de 1 PV
      fx('ini_rosario');
      selfDamage(run, Math.min(R0.ini_rosario.v, run.hp - 1), ev, I18N.refName(R('relic', 'ini_rosario')));
      eachAlive(c, () => applyJudgment1(run, 1, ev));
    }
    if (hasRelic(run, 'ini_bobina')) { fx('ini_bobina'); gainStatic(run, R0.ini_bobina.v, ev); }
    if (hasRelic(run, 'ini_iman')) { fx('ini_iman'); eachAlive(c, () => applyMagnet(run, R0.ini_iman.v, ev)); }
  }
  /** Copo Eterno: al empezar cada turno, 1 de Escarcha al enemigo vivo con más PV. */
  function copoEterno(run, ev) {
    const c = run.combat;
    if (!hasRelic(run, 'ini_copo') || c.over || c.turn < 2) return;   // desde el segundo turno
    let bi = -1;
    c.enemies.forEach((x, i) => { if (alive(x) && (bi < 0 || x.hp > c.enemies[bi].hp)) bi = i; });
    if (bi < 0) return;
    ev.push({ t: 'relicFx', id: 'ini_copo' });
    withEnemy(c, bi, () => applyFrost1(run, D.RELICS.ini_copo.v, ev));
  }

  /** Reliquias de inicio de combate que van DESPUÉS del primer robo (el Bloqueo se pierde al empezar el turno). */
  function startCombatRelics(run, ev) {
    const c = run.combat;
    if (hasRelic(run, 'escudoeter')) { const n = Math.floor(run.hp * (D.RELICS.escudoeter.v || 0.1)); if (n > 0) { gainBlock(c, n, ev); log(c, ev, _m('e.escudo_de_eter_0_de', { 0: n })); } }
    if (hasRelic(run, 'inestable') && c.hand.length < MAX_HAND) {   // Grimorio Inestable: carta al azar de tu personaje, coste 0 y Etérea
      const r = weighted(run, [['common', 60], ['uncommon', 30], ['rare', 10]]);
      const opts = cardsOfRarity(r, actOf(run), charOf(run), false, run).filter((id) => !isX({ id }) && !isCurse({ id }) && !D.CARDS[id].needsDead);
      if (opts.length) {
        const card = { uid: run.uidNext++, id: pick(run, opts), up: false, temp: true, free0: true, eth: true };
        c.tempCards++; c.hand.push(card);
        ev.push({ t: 'draw', uid: card.uid });
        log(c, ev, _m('e.grimorio_inestable_0_llega_a', { 0: RC(card) }));
      }
    }
    if (hasRelic(run, 'dado')) {   // Dado Cargado: una carta al azar de la mano cuesta 0 este turno
      const opts = c.hand.filter((x) => !isX(x) && typeof costIn(x, c) === 'number' && costIn(x, c) > 0);
      if (opts.length) { const x = pick(run, opts); x.freeTurn = c.turn; ev.push({ t: 'discount', uid: x.uid }); }
    }
    if (hasRelic(run, 'escudomartir') && fervorOf(run) > 0) gainBlock(c, 2 * fervorOf(run), ev, 'relic');   // Escudo del Mártir
    if (hasRelic(run, 'ini_coraza')) { ev.push({ t: 'relicFx', id: 'ini_coraza' }); gainBlock(c, D.RELICS.ini_coraza.v, ev, 'relic'); }   // Coraza de Escarcha
    if (hasRelic(run, 'penitente')) {   // Cadena del Penitente: 1 Escalofrío en la mano (solo de este combate)
      if (c.hand.length < MAX_HAND) { const card = { uid: run.uidNext++, id: 'escalofrio', up: false, temp: true }; c.tempCards++; c.hand.push(card); ev.push({ t: 'draw', uid: card.uid }); }
      else addCombatCurses(run, 1, 'discard', ev);
    }
    if (hasRelic(run, 'consagracion')) {   // Elixir de Consagración: la más cara cuesta 1 menos este turno
      const best = c.hand.filter((x) => !isX(x) && typeof costIn(x, c) === 'number' && costIn(x, c) > 0).sort((a, b) => costIn(b, c) - costIn(a, c))[0];
      if (best) { best.discountTurn = c.turn; ev.push({ t: 'discount', uid: best.uid }); }
    }
  }

  /** Estatua del Guardián: vida extra/reducida (mínimo 1) y Fuerza inicial, con su banner. */
  function applyBossMods(run, ev) {
    const c = run.combat, e = c.enemy, m = run.bossMods;
    if (m.hp) {
      e.hp = e.maxHp = Math.max(1, e.maxHp + m.hp);
      const text = m.hp < 0 ? _m('e.el_guardian_parece_debilitado') : _m('e.el_guardian_llega_furioso');
      log(c, ev, text);
      ev.push({ t: 'bossMod', text, good: m.hp < 0 });
    }
    if (m.str) {
      e.str += m.str;
      const text = m.str > 0 ? _m('e.el_guardian_llega_furioso') : _m('e.el_guardian_parece_debilitado');
      log(c, ev, text);
      ev.push({ t: 'bossMod', text, good: m.str < 0 });
      ev.push({ t: 'status', who: 'enemy', key: 'str', value: e.str });
    }
  }

  function log(c, ev, text) {
    c.log.push(text);
    if (c.log.length > 40) c.log.shift();
    ev.push({ t: 'log', text });
  }

  function drawCards(run, n, ev) {
    const c = run.combat;
    for (let i = 0; i < n; i++) {
      if (c.hand.length >= MAX_HAND) break;
      if (!c.draw.length) {
        if (!c.discard.length) break;
        c.draw = shuffle(run, c.discard);
        c.discard = [];
        ev.push({ t: 'shuffle', count: c.draw.length });
        if (hasRelic(run, 'clepsidra') && c.turn > 0) gainBlock(c, D.RELICS.clepsidra.v || 5, ev, 'relic');   // Clepsidra
      }
      const card = c.draw.pop();
      if (isCurse(card) && hasRelic(run, 'linterna')) {    // Linterna: la maldición se Agota y robas otra
        c.exhaust.push(card);
        ev.push({ t: 'curseBurned', uid: card.uid });
        onExhaust(run, card, ev, { noMecha: true });   // ya roba otra en su lugar
        i--;
        continue;
      }
      c.hand.push(card);
      ev.push({ t: 'draw', uid: card.uid });
      // Garabato: al robarlo pierdes Energía y se Agota (no se queda en la mano ni vuelve a barajarse).
      // Al empezar tu turno (c.turnStartDraw) la Energía nunca baja de 1, igual que con Drenar.
      const lose = cardDef(card).onDrawEnergy;
      if (lose) {
        const floor = c.turnStartDraw ? 1 : 0;
        const n = Math.max(0, Math.min(lose, c.player.energy - floor));
        if (n > 0) {
          c.player.energy -= n;
          ev.push({ t: 'inkDrain', uid: card.uid, amount: n }); ev.push({ t: 'energy', energy: c.player.energy });
          log(c, ev, _m('e.el_garabato_te_roba_0', { 0: n }));
        }
        c.hand.splice(c.hand.indexOf(card), 1);
        c.exhaust.push(card);
        ev.push({ t: 'inkExhaust', uid: card.uid });
        onExhaust(run, card, ev);
      }
    }
  }

  function startPlayerTurn(run, ev) {
    const c = run.combat;
    c.turn++;
    c.turnKills = 0;   // «Masacre»: muertes de este turno (el tuyo y el enemigo que lo sigue)
    c.phase = 'player';
    const p = c.player;
    // Escudo Rúnico (con Runa de Piedra) / Escudo Sagrado: el Bloqueo se queda este turno; Castillo de Fe: siempre;
    // Gólem de Runas: mientras tengas 2+ runas de Piedra
    const golemKeep = p.powers.golemr && (c.runes || []).filter((r) => r === 'piedra').length >= GOLEM_STONES;
    if (c.keepBlock !== c.turn && !p.powers.castillo && !golemKeep) p.block = 0;
    if (p.immaterial) { p.immaterial = false; ev.push({ t: 'status', who: 'player', key: 'immaterial', value: 0 }); }   // Inmaterial: solo dura el turno enemigo
    p.energy = p.maxEnergy + (c.turn === 1 && hasRelic(run, 'brasero') ? 1 : 0) + (c.turn === 1 && c.manaFont ? 1 : 0)   // Fuente de Maná
      + (c.turn === 1 && hasRelic(run, 'lastre') && run.deck.length >= (D.RELICS.lastre.v || 25) ? 1 : 0);   // Lastre del Coleccionista
    // Drenar Maná: empiezas con menos Energía (mínimo 1)
    if (c.drainNext) {
      const before = p.energy;
      p.energy = Math.max(1, p.energy - c.drainNext);
      c.drainNext = 0;
      if (before > p.energy) { ev.push({ t: 'drained', amount: before - p.energy }); log(c, ev, _m('e.mana_drenado_0_energia_este', { 0: before - p.energy })); }
    }
    for (const x of c.enemies) x.turnDmg = 0;               // Carga Arcana: el daño del turno empieza de cero
    p.playedThisTurn = 0;                                   // Combo: cartas jugadas este turno
    // Escudo de Hielo: no desaparece como el Bloqueo; se derrite 3 por turno (1 con Lágrima Glacial)
    if (p.ice > 0 && !p.powers.permahielo) { const melt = Math.min(p.ice, hasRelic(run, 'lagrima') ? 1 : ICE_MELT); p.ice -= melt; ev.push({ t: 'iceMelt', amount: melt, ice: p.ice }); }   // Permafrost: no se derrite
    if (c.energyNext) { p.energy += c.energyNext; c.energyNext = 0; }                   // Contrición
    if (p.powers.juramento && run.hp < run.maxHp * 0.5) p.energy += p.powers.juramento;   // Juramento
    syncHp(run, ev);
    // Corazón de Glaciar: lo ganado al congelar se cobra en este turno
    if (c.glaciarEnergy) { p.energy += c.glaciarEnergy; c.glaciarEnergy = 0; }
    if (c.plasmaEnergy) { p.energy += c.plasmaEnergy; c.plasmaEnergy = 0; }   // Núcleo de Plasma
    c.echo = false;
    // Reloj de Arena: la primera carta Conservada (de la mano del turno anterior) cuesta 1 menos este turno
    if (hasRelic(run, 'reloj')) { const kept = c.hand.find((x) => x.keptTurn === c.turn - 1); if (kept) kept.discountTurn = c.turn; }
    ev.push({ t: 'turn', who: 'player', turn: c.turn });
    // Pacto Contrarreloj: desde el turno 9, −5 PV al empezar cada turno
    if (hasPact(run, 'reloj') && c.turn > 8) {
      log(c, ev, _m('e.contrarreloj_el_tiempo_se_agota'));
      selfDamage(run, 5, ev, _t('e.contrarreloj'));
      if (c.over) return;
    }
    ev.push({ t: 'energy', energy: p.energy });
    if (hasRelic(run, 'acumulador') && !(p.static > 0) && hasMech(run, 'static')) gainStatic(run, D.RELICS.acumulador.v || 2, ev);   // Acumulador
    if (p.powers.furia) setTemp(c, p.temp + p.powers.furia, ev);
    if (p.powers.hoguera) setTemp(c, p.temp + p.powers.hoguera, ev);           // Hoguera Interior
    if (p.powers.ventisca) applyFrost(run, p.powers.ventisca, ev);             // Ventisca Perpetua
    // Madre del Bosque: con menos de 3 criaturas, llega un Lobezno (uno por copia)
    for (let k = 0; k < (p.powers.madre || 0) && !c.over && (c.summons || []).length < D.MAX_SUMMONS; k++) summon(run, 'lobezno', ev);
    let extra = (c.turn === 1 && c.kind === 'boss' && hasRelic(run, 'reloj2') ? 3 : 0) + (c.turn === 1 && hasRelic(run, 'grimorio') ? 2 : 0) + (hasRelic(run, 'librollama') ? 1 : 0) + (c.glaciarDraw || 0) + (c.runeDraw || 0) + (c.summonDraw || 0) + (c.plasmaDraw || 0);
    if (hasCustom(run, 'hechizo')) extra += 1;   // Personalizado: Hechizo rápido
    if (c.batteryNext) { extra += 1; c.batteryNext = false; }   // Batería Agotada
    if (hasRelic(run, 'grilletes')) extra -= 1;                 // Grilletes del Tiempo
    c.runeDraw = 0;   // Runa de Viento: cartas extra este turno
    c.summonDraw = 0; // Búho Arcano
    c.glaciarDraw = 0;
    c.plasmaDraw = 0;
    c.turnStartDraw = true;    // Garabatos: la Energía del inicio del turno no baja de 1
    drawCards(run, HAND_SIZE + extra, ev);
    c.turnStartDraw = false;
    // Silencio: n cartas al azar de la mano quedan selladas este turno (las maldiciones no cuentan)
    if (c.silenceNext) {
      const pool = shuffle(run, c.hand.filter((x) => !isCurse(x)));
      const sealed = pool.slice(0, c.silenceNext);
      sealed.forEach((x) => { x.sealed = c.turn; });
      c.silenceNext = 0;
      if (sealed.length) { ev.push({ t: 'silence', uids: sealed.map((x) => x.uid) }); log(c, ev, _m('e.silencio_0_carta_s_selladas', { 0: sealed.length })); }
    }
    c.lastMove = null;   // «Lo que te mató»: el movimiento del último enemigo que actuó (en tu turno, ninguno)
    copoEterno(run, ev);
    ev.push({ t: 'intent' });
  }

  function setTemp(c, value, ev) {
    if (c.noTemp) return;                   // el personaje no tiene la mecánica de Temperatura
    const before = c.player.temp;
    c.player.temp = Math.max(0, value);
    c.peakTemp = Math.max(c.peakTemp || 0, c.player.temp);
    if (c.player.temp !== before) ev.push({ t: 'temp', delta: c.player.temp - before, total: c.player.temp });
  }

  /** chill: el enemigo te quita Temperatura (Corazón de Volcán y Amuleto Polar lo impiden). */
  /* ---------- Criomante: Escarcha, Congelado y Escudo de Hielo ---------- */
  const freezeAt = (c) => (c.kind === 'boss' ? FREEZE_AT_BOSS : FREEZE_AT);
  /** Aplica Escarcha; a 10 (15 jefes) el enemigo queda Congelado y su Escarcha vuelve a 0. */
  function applyFrost(run, n, ev) { return spreadHit(run, () => applyFrost1(run, n, ev)); }
  function applyFrost1(run, n, ev) {
    const c = run.combat, e = c.enemy;
    if (!c || c.over || n <= 0) return;
    if (c.playingCard && (e.frost || 0) > 0 && hasRelic(run, 'prismahelado')) n += 1;   // Prisma Helado: +1 si ya tenía Escarcha
    e.frost = (e.frost || 0) + n;
    run.stats.frostApplied = (run.stats.frostApplied || 0) + n;
    ev.push({ t: 'frost', amount: n, frost: e.frost });
    if (!e.frozen && e.frost >= freezeAt(c)) freezeEnemy(run, ev);
  }
  function freezeEnemy(run, ev) {
    const c = run.combat, e = c.enemy, p = c.player;
    e.frozen = true; e.frost = Math.min(freezeAt(c) - 1, p.powers.perpetua || 0); c.froze = (c.froze || 0) + 1;   // c.froze: logro «Cero Absoluto» · Escarcha Perpetua: conserva algo
    e.coffinUsed = false;   // Ataúd de Hielo: una vez por congelación
    log(c, ev, _m('e.0_queda_congelado_pierde_su', { 0: RE(e) }));
    ev.push({ t: 'freeze', frost: e.frost });
    contractTick(run, 'freeze', { boss: (D.ENEMIES[e.id] || {}).tier === 'boss' });
    if (ACT3_RULES.freezeBreaksCharge && e.charging) {   // el hielo rompe la Carga Arcana
      e.charging = null;
      log(c, ev, _m('e.el_hielo_rompe_la_carga', { 0: RE(e) }));
      ev.push({ t: 'interrupt', why: 'freeze' });
    }
    ev.push({ t: 'intent' });
    if (p.powers.glaciar) { c.glaciarEnergy = (c.glaciarEnergy || 0) + 2 * p.powers.glaciar; c.glaciarDraw = (c.glaciarDraw || 0) + 2 * p.powers.glaciar; }
    if (hasRelic(run, 'copo') && !c.copoUsed) { c.copoUsed = true; gainIce(c, D.RELICS.copo.v || 10, ev); }   // Copo Eterno
    if (p.powers.polar && !c.over) {   // Corazón Polar: el hielo lo hiere (no es un Ataque)
      const was = c.attacking; c.attacking = false;
      log(c, ev, _m('e.polar', { e: RE(e), n: p.powers.polar }));
      hitEnemy(run, p.powers.polar, ev, { power: 'polar' });
      c.attacking = was;
    }
  }
  function gainIce(c, n, ev) {
    if (n <= 0) return;
    if (c.noDefTurn === c.turn) { ev.push({ t: 'noDefense' }); return; }   // Corazón de Hielo: este turno no
    c.player.ice = (c.player.ice || 0) + n;
    ev.push({ t: 'ice', amount: n, ice: c.player.ice });
  }

  /** Ganchos por personaje. onChill: qué le hace el frío (Acto II). Sin gancho, el frío no le afecta. */
  const CHAR_HOOKS = {
    piromago: { onChill: (run, n, ev) => chillTemp(run, n, ev) },
    guardiana: { onChill: (run, n, ev) => { const c = run.combat; c.runeChill = (c.runeChill || 0) + 1; log(c, ev, _m('e.el_frio_entumece_tus_runas')); ev.push({ t: 'runeChill', power: runePow(c) }); } },
    invocadora: { onChill: (run, n, ev) => {   // el frío hiere a la criatura más antigua
      const c = run.combat, s0 = c.summons && c.summons[0];
      if (!s0) return;
      log(c, ev, _m('e.el_frio_hiere_a_0', { 0: R('summon', s0.id) }));
      damageSummon(run, s0, n, ev, 'chill');
    } },
    criomante: { onChill: (run, n, ev) => { const c = run.combat; log(c, ev, _m('e.el_frio_te_fortalece')); ev.push({ t: 'chillIce', amount: n }); gainIce(c, n, ev); } },
    electromante: { onChill: (run, n, ev) => {   // el frío descarga 2 de Estática
      const lost = loseStatic(run, 2, ev);
      if (lost) { log(run.combat, ev, _m('e.chillStatic', { n: lost })); ev.push({ t: 'chillStatic', amount: lost }); }
    } },
    paladin: { onChill: (run, n, ev) => {   // el frío apaga 1 de Juicio del enemigo
      const e = run.combat.enemy;
      if (!(e.judg > 0)) return;
      e.judg--;
      log(run.combat, ev, _m('e.chillJudg', { e: RE(e) }));
      ev.push({ t: 'judgSet', judg: e.judg, chill: true });
    } }
  };
  function chillPlayer(run, n, ev) {
    const hook = CHAR_HOOKS[charOf(run)];
    if (hook && hook.onChill) hook.onChill(run, n, ev);
  }
  /** Piromago: el frío le quita Temperatura (Corazón de Volcán y Amuleto Polar lo impiden). */
  function chillTemp(run, n, ev) {
    const c = run.combat, p = c.player;
    const lose = Math.min(n, p.temp);
    if (lose <= 0) return;
    if (p.powers.volcan) { log(c, ev, _m('e.corazon_de_volcan_tu_temperatura')); ev.push({ t: 'chillBlocked', reason: _t('e.corazon_de_volcan') }); return; }
    if (hasRelic(run, 'amuleto') && !c.amuletoUsed) {
      c.amuletoUsed = true;
      log(c, ev, _m('e.el_amuleto_polar_anula_el')); ev.push({ t: 'chillBlocked', reason: _t('e.amuleto_polar') });
      return;
    }
    setTemp(c, p.temp - lose, ev);
    log(c, ev, _m('e.0_te_congela_1_temperatura', { 0: RE(c.enemy), 1: lose }));
    ev.push({ t: 'chill', amount: lose, total: p.temp });
  }

  /** Escalofríos solo para este combate (temp: true): nunca entran en run.deck. where: 'discard' | 'draw'. */
  function addCombatCurses(run, n, where, ev, id = 'escalofrio') {
    const c = run.combat;
    for (let i = 0; i < n; i++) {
      const card = { uid: run.uidNext++, id, up: false, temp: true };
      c.tempCards++;
      if (where === 'draw') c.draw.splice(Math.floor(rand(run) * (c.draw.length + 1)), 0, card);
      else c.discard.push(card);
    }
    ev.push({ t: 'curse', amount: n, where, id });
  }

  function applyBurn(run, amount, ev) { return spreadHit(run, () => applyBurn1(run, amount, ev)); }
  function applyBurn1(run, amount, ev) {
    const c = run.combat;
    if (amount <= 0 || c.over) return;
    const total = amount + (hasRelic(run, 'salamandra') ? 1 : 0);
    c.enemy.burn += total;
    run.stats.burnApplied = (run.stats.burnApplied || 0) + total;
    ev.push({ t: 'burn', amount: total, burn: c.enemy.burn });
    contractTick(run, 'burn', { n: c.enemy.burn });
  }

  function hitEnemy(run, amount, ev, extra) { return spreadHit(run, () => hitEnemy1(run, amount, ev, extra)); }
  function hitEnemy1(run, amount, ev, extra) {
    const c = run.combat, e = c.enemy;
    if (c.over || !alive(e)) return;
    const blocked = Math.min(e.block, amount);
    e.block -= blocked;
    const dmg = amount - blocked;
    e.hp = Math.max(0, e.hp - dmg);
    e.turnDmg = (e.turnDmg || 0) + dmg;        // Carga Arcana: daño recibido este turno
    if (c.reflectTally && !c.noTally) { c.reflectTally.dmg += dmg; const ei = c.enemies.indexOf(e); c.reflectTally.per[ei] = (c.reflectTally.per[ei] || 0) + dmg; }   // Reflejo: daño de la carta de Ataque en curso (por enemigo)
    run.stats.damageDealt += dmg;
    run.stats.maxHit = Math.max(run.stats.maxHit, dmg);
    trackHit(run, c, e, dmg, extra);
    ev.push(Object.assign({ t: 'hitEnemy', amount: dmg, blocked, hp: e.hp, block: e.block }, extra || {}));
    afterEnemyDamage(run, ev);
    // Juicio (Paladín): cada golpe de un Ataque te da Bloqueo por cada Juicio del enemigo
    if (c.attacking && !c.over && (e.judg || 0) > 0) { ev.push({ t: 'judgHit', judg: e.judg }); gainBlock(c, JUDG_BLOCK * e.judg, ev, 'judg'); }
    // Afijo «espinoso»: cada golpe de una carta de Ataque te devuelve 2 de daño
    if (c.attacking && hasAffix(e, 'espinoso') && !c.over) selfDamage(run, D.AFFIXES.espinoso.v.dmg, ev, _t('e.espinas'));
  }

  /** Momentos destacados: golpe más fuerte (carta + daño + enemigo), daño por carta y jefe de un golpe. */
  function trackHit(run, c, e, dmg, extra) {
    if (!(dmg > 0)) return;
    const s = run.stats, card = c.playingCard, src = card ? card.id : null;
    if (src) { const f = s.cardFx = s.cardFx || {}; const x = f[src] = f[src] || { dmg: 0, block: 0 }; x.dmg += dmg; }
    if (!s.maxHitInfo || dmg > s.maxHitInfo.dmg) s.maxHitInfo = { dmg, card: src, up: !!(card && card.up), relic: (extra && extra.relic) || null, enemy: e.id };
    if (e.hp <= 0 && (D.ENEMIES[e.id] || {}).tier === 'boss' && !D.ENEMIES[e.id].revive && dmg >= e.maxHp * 0.5 && !s.bossOneShot) s.bossOneShot = { enemy: e.id, dmg, card: src };
  }
  function afterEnemyDamage(run, ev) {
    const c = run.combat, e = c.enemy, d = D.ENEMIES[e.id];
    // Archiliche: la primera vez que cae revive con parte de su vida y pasa a su fase 2
    if (e.hp <= 0 && d.revive && !e.revived) {
      e.revived = true;
      e.hp = Math.max(1, Math.ceil(e.maxHp * d.revive));
      e.block = 0; e.charging = null; e.frozen = false; e.stunned = false;
      e.phase = 2; e.moveIdx = 0;
      const text = (d.phase2 && d.phase2.text) || '';
      log(c, ev, text);
      ev.push({ t: 'enemyRevive', hp: e.hp, block: 0 });
      ev.push({ t: 'phase', text, phase: 2 });
      if (d.phase2 && d.phase2.spawn) spawnEnemies(run, d.phase2.spawn, ev);   // Archiliche: llama a un Acólito
      ev.push({ t: 'intent' });
      return;
    }
    if (e.hp <= 0) return enemyDown(run, e, ev);
    if (hasAffix(e, 'rabioso') && !e.enraged && e.hp < e.maxHp * 0.5) {   // afijo «rabioso»
      e.enraged = true; e.str += D.AFFIXES.rabioso.v.str;
      ev.push({ t: 'affix', id: 'rabioso' }); ev.push({ t: 'status', who: 'enemy', key: 'str', value: e.str });
      log(c, ev, _m('rj.aff.rabioso', { e: RE(e), n: D.AFFIXES.rabioso.v.str }));
    }
    // Fases de jefe (un golpe enorme puede saltar de la 1 a la 3: se anuncian las dos)
    for (const [n, ph] of [[2, d.phase2], [3, d.phase3]]) {
      if (!ph || !(ph.at > 0) || e.phase >= n || e.hp > e.maxHp * ph.at) continue;   // at 0: fase que solo llega al revivir
      e.phase = n; e.moveIdx = 0; e.charging = null;   // la nueva fase corta una carga a medias
      log(c, ev, ph.text);
      ev.push({ t: 'phase', text: ph.text, phase: n });
      if (ph.noBlock) { e.noBlock = true; e.block = 0; ev.push({ t: 'shatter', block: 0 }); }   // Titán: pierde la coraza para siempre
      if (ph.str) { e.str += ph.str; ev.push({ t: 'status', who: 'enemy', key: 'str', value: e.str }); }
      if (ph.spawn) spawnEnemies(run, ph.spawn, ev);   // Matriarca: brotan Setas
      ev.push({ t: 'intent' });
    }
    // Carga Arcana: 15+ de daño en un turno la interrumpe
    if (e.charging && (e.turnDmg || 0) >= CHARGE_BREAK) {
      e.charging = null;
      log(c, ev, _m('e.interrumpes_la_carga_de_0', { 0: RE(e) }));
      ev.push({ t: 'interrupt' });
      ev.push({ t: 'intent' });
    }
  }

  function hitPlayer(run, amount, ev) {
    const c = run.combat, p = c.player;
    if (c.over) return;
    // Inmaterial (Paladín): el próximo golpe hace 0 (Ascensión Celestial: todos los de ese turno)
    if (p.immaterial && amount > 0) {
      if (p.immaterial !== 'turn') { p.immaterial = false; ev.push({ t: 'status', who: 'player', key: 'immaterial', value: 0 }); }
      ev.push({ t: 'immaterialHit', amount });
      log(c, ev, _m('e.immaterialHit', { d: amount }));
      amount = 0;
    }
    const iced = Math.min(p.ice || 0, amount);   // Escudo de Hielo: absorbe ANTES que el Bloqueo
    if (iced) p.ice -= iced;
    const blocked = Math.min(p.block, amount - iced);
    p.block -= blocked;
    const dmg = amount - iced - blocked;
    run.hp = Math.max(0, run.hp - dmg);
    c.minHp = Math.min(c.minHp === undefined ? run.hp : c.minHp, run.hp);   // para el rastro del diario
    // Afijo «vampírico»: se cura la mitad del daño que de verdad te llega (tras Hielo y Bloqueo)
    const e0 = c.enemy;
    if (dmg > 0 && hasAffix(e0, 'vampirico') && e0.hp > 0 && e0.hp < e0.maxHp) {
      const h = Math.min(Math.floor(dmg * D.AFFIXES.vampirico.v.frac), e0.maxHp - e0.hp);
      if (h > 0) { e0.hp += h; ev.push({ t: 'enemyHeal', amount: h, hp: e0.hp, why: 'vampirico' }); }
    }
    run.stats.damageTaken += dmg;
    floorDamage(run, dmg);
    run.stats.combatDamageTaken = (run.stats.combatDamageTaken || 0) + dmg;
    if (dmg > 0) c.lostTurn = c.turn;   // Oración de Combate
    ev.push({ t: 'hitPlayer', amount: dmg, blocked: blocked + iced, iced, ice: p.ice || 0, hp: run.hp, block: p.block });
    if (run.hp <= 0) loseCombat(run, ev);
    if (dmg > 0) afterHpLoss(run, ev);
    // Manto de Permafrost: el golpe toca el Escudo de Hielo → el atacante recibe 5 y 1 Escarcha
    if (iced > 0 && !c.over && hasRelic(run, 'permafrost')) {
      const was = c.attacking; c.attacking = false;
      log(c, ev, _m('e.manto_de_permafrost_el_hielo'));
      hitEnemy(run, D.RELICS.permafrost.v || 5, ev, { relic: 'permafrost' });
      c.attacking = was;
      if (!c.over) applyFrost(run, 1, ev);
    }
  }

  /** Daño directo al jugador que ignora bloqueo (sobrecalentamiento, Erupción). */
  function selfDamage(run, amount, ev, reason) {
    const c = run.combat;
    if (c.over || amount <= 0) return;
    run.hp = Math.max(0, run.hp - amount);
    c.minHp = Math.min(c.minHp === undefined ? run.hp : c.minHp, run.hp);
    run.stats.damageTaken += amount;
    floorDamage(run, amount);
    run.stats.combatDamageTaken = (run.stats.combatDamageTaken || 0) + amount;
    c.lostTurn = c.turn;   // Oración de Combate
    ev.push({ t: 'selfDamage', amount, hp: run.hp, reason });
    if (run.hp <= 0) loseCombat(run, ev);
    afterHpLoss(run, ev);
  }
  /** Autodaño de las cartas del Paladín: ignora el Bloqueo y nunca te mata (como mucho te deja a 1 PV). */
  function hurtSelf(run, n, ev) {
    const c = run.combat, amt = Math.min(n, Math.max(0, run.hp - 1));
    if (amt <= 0 || c.over) return 0;
    c.selfLost = (c.selfLost || 0) + amt;   // Llama Votiva
    selfDamage(run, amt, ev, _t('e.selfHurt'));
    if (!c.over && hasRelic(run, 'cirio') && c.cirioTurn !== c.turn) { c.cirioTurn = c.turn; gainBlock(c, D.RELICS.cirio.v || 4, ev, 'relic'); }   // Cirio Votivo
    if (!c.over && c.player.powers.sangre) applyJudgment(run, c.player.powers.sangre, ev);   // Sangre Consagrada
    return amt;
  }
  /** Tras perder PV (golpe o autodaño): Fervor y reliquias del Paladín que miran tus PV. */
  function afterHpLoss(run, ev) {
    const c = run.combat;
    if (!c || c.over || run.hp <= 0) return;
    syncHp(run, ev);
    if (hasRelic(run, 'medallon') && !c.medalUsed && run.hp < run.maxHp * 0.5) {         // Medallón del Alba
      c.medalUsed = true;
      log(c, ev, _m('e.medallon', { n: D.RELICS.medallon.v || 8 }));
      ev.push({ t: 'relicFx', id: 'medallon' });
      gainBlock(c, D.RELICS.medallon.v || 8, ev, 'relic');
    }
    if (hasRelic(run, 'relicario') && !c.relicarioUsed && run.hp < run.maxHp * 0.3) {     // Relicario de Fe
      c.relicarioUsed = true;
      const n = Math.floor(run.maxHp * (D.RELICS.relicario.v || 0.5));
      log(c, ev, _m('e.relicario', { n }));
      ev.push({ t: 'relicFx', id: 'relicario' });
      gainBlock(c, n, ev, 'relic');
    }
  }
  /* ---------- Electromante: Estática, Rayo, Encadenar, Sobrecarga y Magnetizado ----------
   * | Qué                         | Regla                                                                            |
   * |-----------------------------|----------------------------------------------------------------------------------|
   * | Rayo X                      | X al objetivo (+ Guante de Cobre, + 2 por Magnetizado); cuenta como Ataque         |
   * | Encadena N                  | luego salta a N enemigos DISTINTOS del objetivo (run.rng, sin repetir) con la mitad |
   * | Salto sin enemigo           | +1 Estática (así también sirve en 1 contra 1)                                    |
   * | Reflejo / afijo Espinoso    | solo el golpe principal (los saltos no son el Ataque de la carta)                |
   * | Estática                    | máx. 10; con 10 al final de tu turno: Sobrecarga (10 a todos; 20 si queda uno)   |
   * | Frío (Acto II)              | −2 Estática                                                                      |
   * | Magnetizado (enemigo)       | +2 de daño de cada Rayo por punto; baja 1 al final de su turno                   |
   */
  const hasCobre = (c) => !!(c && c.mods && c.mods.cobre);
  /** Lo que suma a un Rayo el enemigo actual (Magnetizado) y el Guante de Cobre. */
  const boltExtra = (c) => (c ? (hasCobre(c) ? (D.RELICS.guantecobre.v || 2) : 0) + MAGNET_DMG * ((c.enemy && c.enemy.magnet) || 0) : 0);
  function gainStatic(run, n, ev) {
    const c = run.combat;
    if (!c || c.over || !(n > 0)) return 0;
    const p = c.player, before = p.static || 0;
    p.static = Math.min(STATIC_MAX, before + n);
    if (p.static !== before) ev.push({ t: 'static', delta: p.static - before, total: p.static });
    return p.static - before;
  }
  function loseStatic(run, n, ev) {
    const c = run.combat, p = c.player, lost = Math.min(n, p.static || 0);
    if (lost <= 0) return 0;
    p.static -= lost;
    ev.push({ t: 'static', delta: -lost, total: p.static });
    return lost;
  }
  /** Un golpe de Rayo al enemigo actual (combat.enemy). jump: es un salto (no cuenta para Reflejo ni Espinoso). */
  function boltHit(run, base, ev, jump) {
    const c = run.combat;
    if (c.over || !alive(c.enemy)) return;
    ev.push({ t: 'zap', jump: !!jump, from: jump ? jump.from : -1 });
    const was = c.attacking, tally = c.noTally;
    if (jump) { c.attacking = false; c.noTally = true; }
    try { hitEnemy(run, playerAttackDamage(c, base + boltExtra(c)), ev, jump ? { jump: true } : null); }
    finally { c.attacking = was; c.noTally = tally; }
  }
  /**
   * Rayo completo sobre el enemigo actual: golpe principal y saltos. base: daño de la carta (con sus bonus).
   * chain: saltos con la mitad del daño · all: salta a TODOS los demás (hasta 2) con todo el daño (Rayo Globular).
   */
  function bolt(run, base, chain, ev, all, queue) {
    const c = run.combat, src = c.enemies.indexOf(c.enemy);
    boltHit(run, base, ev, null);
    if (queue) { queue.push({ src, base, chain, all }); return; }   // carta de área: primero todos los golpes, luego los saltos
    boltJumps(run, src, base, chain, ev, all);
  }
  function boltJumps(run, src, base, chain, ev, all) {
    const c = run.combat, n = all ? 2 : chain;
    if (c.over || !(n > 0)) return;
    const others = shuffle(run, c.enemies.map((e, i) => i).filter((i) => i !== src && alive(c.enemies[i])));
    const jumps = others.slice(0, n).map((j) => c.enemies[j]), missed = n - jumps.length, jb = all ? base : Math.floor(base / 2);
    for (const x of jumps) {   // por referencia (un salto que hace invocar mueve los índices)
      if (c.over) return;
      const j = c.enemies.indexOf(x);
      if (j < 0 || !alive(x)) continue;
      withEnemy(c, j, () => boltHit(run, jb, ev, { from: src }));
      if (!c.over && hasRelic(run, 'varitatesla')) gainStatic(run, 1, ev);   // Varita de Tesla
    }
    if (!c.over && missed > 0) { gainStatic(run, missed, ev); ev.push({ t: 'chainMiss', n: missed }); }
  }
  /** Sobrecarga: 10 a todos los enemigos (20 si solo queda uno; no es un Ataque); la Estática vuelve a 0. */
  function overload(run, ev) {
    const c = run.combat, p = c.player;
    let dmg = OVERLOAD_DMG * (c.enemies.filter(alive).length === 1 ? OVERLOAD_SOLO : 1);   // contra uno solo, toda la descarga va a él
    if (hasRelic(run, 'pararrayos') && !c.rodUsed) { c.rodUsed = true; dmg += 10; ev.push({ t: 'relicFx', id: 'pararrayos' }); }   // Pararrayos: la primera, +10
    p.static = 0;
    run.stats.overloads = (run.stats.overloads || 0) + 1;
    ev.push({ t: 'overload', dmg }); ev.push({ t: 'static', delta: -STATIC_MAX, total: 0 });
    log(c, ev, _m('e.overload', { n: dmg }));
    c.overloads = (c.overloads || 0) + 1;
    const before = c.enemies.filter(alive);
    const was = c.attacking; c.attacking = false;
    c.spread = true;
    try { hitEnemy(run, dmg, ev, { overload: true }); } finally { delete c.spread; c.attacking = was; }
    const kills = before.filter((x) => !alive(x) && !x.vanished).length;   // las invocaciones que se esfuman con su jefe no cuentan
    c.maxOverloadKills = Math.max(c.maxOverloadKills || 0, kills);         // logro «Tormenta perfecta»
    if (p.powers.nucleo) { c.plasmaEnergy = (c.plasmaEnergy || 0) + 2 * p.powers.nucleo; c.plasmaDraw = (c.plasmaDraw || 0) + 2 * p.powers.nucleo; }   // Núcleo de Plasma
    contractTick(run, 'overload', { n: c.overloads });
    if (!c.over && hasRelic(run, 'fusible')) drawCards(run, D.RELICS.fusible.v || 2, ev);   // Fusible Quemado
  }
  /** Magnetizado en el enemigo actual. */
  function applyMagnet(run, n, ev) {
    const c = run.combat;
    if (!c || c.over || n <= 0) return;
    c.enemy.magnet = (c.enemy.magnet || 0) + n;
    ev.push({ t: 'magnet', amount: n, magnet: c.enemy.magnet });
  }

  /** Juicio (Paladín) en el enemigo. */
  function applyJudgment(run, n, ev) { return spreadHit(run, () => applyJudgment1(run, n, ev)); }
  function applyJudgment1(run, n, ev) {
    const c = run.combat;
    if (!c || c.over || n <= 0) return;
    if (hasRelic(run, 'balanza')) n += 1;   // Balanza Dorada
    if (hasRelic(run, 'ini_balanza') && !c.silverScale) { c.silverScale = true; n += D.RELICS.ini_balanza.v; ev.push({ t: 'relicFx', id: 'ini_balanza' }); }   // Balanza de Plata
    c.enemy.judg = (c.enemy.judg || 0) + n;
    run.stats.judgApplied = (run.stats.judgApplied || 0) + n;
    ev.push({ t: 'judg', amount: n, judg: c.enemy.judg });
    contractTick(run, 'judg', { n: c.enemy.judg });
  }

  /**
   * Una carta acaba de Agotarse (jugada con Agotar, Etérea al final del turno, Purgar, Linterna…).
   * Corazón del Fénix: Quemadura + Bloqueo. Mecha Inagotable: roba 1 (los poderes no cuentan).
   */
  function onExhaust(run, card, ev, opts = {}) {
    const c = run.combat;
    if (!c || c.over || cardDef(card).type === 'power') return;
    const amt = c.player.powers.renacer;
    if (amt) { applyBurn(run, amt, ev); gainBlock(c, amt, ev); }
    if (!opts.noMecha && !c.over && hasRelic(run, 'mecha')) drawCards(run, 1, ev);
    if (!c.over && hasRelic(run, 'cenizas')) {   // Cenizas Vengativas: daño a todos (no es un Ataque)
      const was = c.attacking; c.attacking = false; c.spread = true;
      ev.push({ t: 'relicFx', id: 'cenizas' });
      try { hitEnemy(run, D.RELICS.cenizas.v || 3, ev, { relic: 'cenizas' }); } finally { delete c.spread; c.attacking = was; }
    }
  }

  function gainBlock(c, amount, ev, src) {
    if (c.noDefTurn === c.turn) { ev.push({ t: 'noDefense' }); return; }   // Corazón de Hielo: este turno no ganas Bloqueo
    if (amount <= 0) return;
    if (c.playingCard && !src && c.mods && c.mods.estandarte) c.bannerHits = (c.bannerHits || 0) + 1;   // Estandarte del Alba (se cobra al acabar la carta)
    if (c.playingCard) c.cardGaveBlock = true;              // Aura Arcana: la carta da Bloqueo
    c.blockGained = (c.blockGained || 0) + amount;          // logro «Muralla Viva»
    if (c.playingCard && !src) { const f = c.fxBlock = c.fxBlock || {}; f[c.playingCard.id] = (f[c.playingCard.id] || 0) + amount; }   // carta MVP (Bloqueo)
    c.player.block += amount;
    ev.push({ t: 'blockPlayer', amount, block: c.player.block });
  }

  /* ------------------------------------------------------------------ *
   * CRIATURAS (Invocadora)
   *   combat.summons: [{ sid, id, hp, maxHp }] de izquierda (más antigua) a derecha. Máximo 3.
   *   Actúan al final de tu turno (izq. → der.) y reciben los golpes enemigos: la más antigua
   *   primero; el daño sobrante NO pasa a la Invocadora. Vínculo: +ataque a todas (este combate).
   * ------------------------------------------------------------------ */
  const snapSummons = (c) => (c.summons || []).map((s) => ({ sid: s.sid, id: s.id, hp: s.hp, maxHp: s.maxHp }));
  /** Vínculo actual: Vínculo Salvaje + Rey del Bosque + Tambor Tribal + Brote (este turno). */
  const bondOf = (c) => ((c.player.powers && c.player.powers.vinculo) || 0) + ((c.player.powers && c.player.powers.rey) || 0) + (c.bondPerm || 0)
    + (c.bondTurn && c.bondTurn.turn === c.turn ? c.bondTurn.n : 0) + (c.tempBond || 0);   // tempBond: Rugido Primigenio (solo ese ataque)
  /** Ataque de una criatura con el Vínculo (las que no atacan, como el Búho, siguen en 0). */
  const summonAtk = (c, s) => { const d = D.SUMMONS[s.id]; return d.atk > 0 ? d.atk + bondOf(c) + (c.mods && c.mods.totem ? 1 : 0) + (s.atkBonus || 0) : 0; };   // Tótem de Huesos: +1 · Ciclo de la Vida: +atkBonus
  /** PV con los que entra una criatura (Collar de Colmillos +3; Rey del Bosque ×2). */
  function summonHp(run, id) {
    const c = run.combat;
    let hp = D.SUMMONS[id].hp + (hasRelic(run, 'collar') ? (D.RELICS.collar.v || 3) : 0);
    if (c.player.powers && c.player.powers.rey) hp *= 2;
    if (hasRelic(run, 'totem')) hp = Math.ceil(hp * 1.25);   // Tótem de Huesos
    return hp;
  }
  /** Invoca una criatura a la derecha; con 3, la más antigua se va (no cuenta como muerte). */
  function summon(run, id, ev, at, mod) {
    const c = run.combat;
    if (!c || c.over || !D.SUMMONS[id]) return null;
    c.summons = c.summons || [];
    while (c.summons.length >= D.MAX_SUMMONS) {
      const gone = c.summons.shift();
      log(c, ev, _m('e.0_vuelve_al_bosque', { 0: R('summon', gone.id) }));
      ev.push({ t: 'summonLeave', sid: gone.sid, id: gone.id, summons: snapSummons(c) });
    }
    const hp = Math.max(1, summonHp(run, id) + ((mod && mod.hpDelta) || 0));   // Semilla: con menos PV
    const s = { sid: ++c.sumSeq, id, hp, maxHp: hp };
    if (mod && mod.atkBonus) s.atkBonus = mod.atkBonus;                         // Ciclo de la Vida
    if (Number.isInteger(at) && at >= 0 && at <= c.summons.length) c.summons.splice(at, 0, s); else c.summons.push(s);
    run.stats.summoned = (run.stats.summoned || 0) + 1;
    log(c, ev, _m('e.invocas_0', { 0: R('summon', id) }));
    ev.push({ t: 'summon', sid: s.sid, id, summons: snapSummons(c) });
    if (hasRelic(run, 'silbato')) gainBlock(c, D.RELICS.silbato.v || 2, ev, 'relic');   // Silbato de Hueso
    return s;
  }
  /** La criatura recibe daño (golpe enemigo, Espinoso, frío). Devuelve el daño real. Si llega a 0, muere. */
  function damageSummon(run, s, amount, ev, why) {
    const c = run.combat;
    if (!c.summons.includes(s) || amount <= 0) return 0;
    const raiz = (c.player.powers && c.player.powers.raiz) || 0;   // Raíz Profunda: cada golpe hace menos
    if (raiz && why !== 'sacrifice') { amount = Math.max(0, amount - raiz); if (amount <= 0) { ev.push({ t: 'summonHit', sid: s.sid, amount: 0, hp: s.hp, why, summons: snapSummons(c) }); return 0; } }
    const dealt = Math.min(s.hp, amount);
    s.hp -= dealt;
    ev.push({ t: 'summonHit', sid: s.sid, amount: dealt, hp: s.hp, why, summons: snapSummons(c) });
    if (s.hp <= 0) summonDies(run, s, ev);
    return dealt;
  }
  function summonDies(run, s, ev, why) {
    const c = run.combat, idx = c.summons.indexOf(s);
    if (idx < 0) return;
    c.summons.splice(idx, 1);
    c.lastDead = s.id;                       // para Renacer
    log(c, ev, _m('e.0_se_deshace_en_hojas', { 0: R('summon', s.id) }));
    ev.push({ t: 'summonDie', sid: s.sid, id: s.id, summons: snapSummons(c) });
    if (hasRelic(run, 'coronamusgo') && !c.over) drawCards(run, 1, ev);   // Corona de Musgo
    const alma = c.player.powers && c.player.powers.alma;   // Alma del Bosque: robas 1 y ganas 3 de Bloqueo (por copia)
    if (alma && !c.over) { log(c, ev, _m('e.alma', { n: alma })); drawCards(run, alma, ev); gainBlock(c, ALMA_BLOCK * alma, ev, 'power'); }
    if (why !== 'sacrifice' && hasRelic(run, 'semilla') && !c.semillaUsed && !c.over) {   // Semilla Eterna: la primera renace con la mitad (no las sacrificadas)
      c.semillaUsed = true;
      const hp = Math.max(1, Math.ceil(s.maxHp / 2));
      const r = { sid: ++c.sumSeq, id: s.id, hp, maxHp: s.maxHp };
      c.summons.splice(Math.min(idx, c.summons.length), 0, r);
      log(c, ev, _m('e.la_semilla_eterna_devuelve_a', { 0: R('summon', s.id) }));
      ev.push({ t: 'summon', sid: r.sid, id: r.id, revive: true, summons: snapSummons(c) });
    }
  }
  /** Sacrificar una criatura: muere (Alma del Bosque, Renacer) pero la Semilla Eterna no la devuelve. */
  function sacrificeSummon(run, s, ev) {
    const c = run.combat;
    if (!c.summons.includes(s)) return;
    s.hp = 0;
    summonDies(run, s, ev, 'sacrifice');
  }
  /** Golpe de una criatura al enemigo (no es una carta: Espinoso hiere a la criatura, no a ti). */
  function summonStrike(run, s, ev) {
    const c = run.combat, d = D.SUMMONS[s.id], atk = summonAtk(c, s);
    if (atk <= 0) return;
    for (let i = 0; i < (d.hits || 1) && !c.over && c.summons.includes(s); i++) {
      const was = c.attacking; c.attacking = false;
      hitEnemy(run, atk, ev, { sid: s.sid });
      c.attacking = was;
      if (!c.over && hasAffix(c.enemy, 'espinoso')) damageSummon(run, s, D.AFFIXES.espinoso.v.dmg, ev, 'espinoso');
    }
  }
  /** Acción completa de una criatura. phase 'end': el Búho guarda su carta para el turno siguiente; 'now': roba ya. */
  function summonAct(run, s, ev, phase) {
    const c = run.combat, d = D.SUMMONS[s.id];
    if (c.over || !c.summons.includes(s)) return;
    ev.push({ t: 'summonAct', sid: s.sid, id: s.id });
    // Reflejo: el golpe de la criatura le vuelve a ella (sin gastar carga), salvo dentro de un Ataque que ya se refleja
    const refl = ACT3_RULES.reflectSummons && (c.enemy.reflect || 0) > 0 && !c.reflectTally && D.SUMMONS[s.id].atk;
    if (refl) c.reflectTally = { dmg: 0, per: {} };
    summonStrike(run, s, ev);
    if (refl) {
      const back = Math.floor(c.reflectTally.dmg * REFLECT_FRAC); c.reflectTally = null;
      if (!c.over) {   // a las criaturas les vuelve el daño, pero no gastan cargas (siguen esperando a tus Ataques)
        ev.push({ t: 'reflect', amount: back, charges: c.enemy.reflect, sid: s.sid });
        log(c, ev, _m('e.reflejo_0_de_dano_de', { 0: back, 1: R('summon', s.id) }));
        if (back > 0) damageSummon(run, s, back, ev, 'reflect');
      }
    }
    if (c.over || !c.summons.includes(s)) return;
    if (d.block) gainBlock(c, d.block, ev);
    if (d.draw) { if (phase === 'end') c.summonDraw = (c.summonDraw || 0) + d.draw; else drawCards(run, d.draw, ev); }
  }
  /** Todas las criaturas actúan (izq. → der.) `times` veces (tope 5). */
  function summonsAct(run, ev, times = 1, phase = 'now') {
    const c = run.combat;
    for (let k = 0; k < Math.min(5, times) && !c.over; k++) for (const s of (c.summons || []).slice()) { if (c.over) return; summonAct(run, s, ev, phase); }
  }
  /** Golpe enemigo: a la criatura más antigua si hay; si no, a la Invocadora (o a cualquier personaje). */
  function enemyStrike(run, amount, ev) {
    const c = run.combat, e = c.enemy, s0 = c.summons && c.summons[0];
    if (!s0) { hitPlayer(run, amount, ev); return; }
    const dealt = damageSummon(run, s0, amount, ev, 'enemy');
    // Vampírico: también se cura con el daño a las criaturas
    if (dealt > 0 && hasAffix(e, 'vampirico') && e.hp > 0 && e.hp < e.maxHp) {
      const h = Math.min(Math.floor(dealt * D.AFFIXES.vampirico.v.frac), e.maxHp - e.hp);
      if (h > 0) { e.hp += h; ev.push({ t: 'enemyHeal', amount: h, hp: e.hp, why: 'vampirico' }); }
    }
    // Espinas del Bosque: el enemigo recibe daño al golpear a una criatura
    const th = c.player.powers && c.player.powers.espinas;
    if (th && !c.over) { const was = c.attacking; c.attacking = false; hitEnemy(run, th, ev, { thorns: true }); c.attacking = was; }
  }
  function healSummons(run, n, ev) {
    const c = run.combat;
    for (const s of c.summons || []) {
      const h = Math.min(n, s.maxHp - s.hp);
      if (h > 0) { s.hp += h; ev.push({ t: 'summonHeal', sid: s.sid, amount: h, hp: s.hp, summons: snapSummons(c) }); }
    }
  }
  const COMMON_SUMMONS = D.SUMMON_IDS.filter((id) => !D.SUMMONS[id].rare);
  const ALMA_BLOCK = 3;   // Alma del Bosque

  /* ------------------------------------------------------------------ *
   * RUNAS (Guardiana Rúnica)
   *   combat.runes: ids de izquierda (más antigua) a derecha (más reciente)
   *   Ranuras: 3 + Cuarta Piedra + Ranura Extra. Potencia: Cincel + Potencia + Polvo − frío.
   *   Viento y Sangre: la Potencia solo suma +1 cada 2 puntos (robar/curar escalan peor).
   * ------------------------------------------------------------------ */
  const runePow = (c) => (c.runePower || 0) + ((c.player.powers && c.player.powers.potencia) || 0) - (c.runeChill || 0);
  const runeSlots = (c) => (c.runeSlots || 3) + ((c.player.powers && c.player.powers.ranura) || 0);
  /** Valor de una runa con la Potencia aplicada (nunca negativo). */
  function runeVal(c, id, base) {
    const P = runePow(c), r = D.RUNES[id];
    return Math.max(0, base + (r.half ? Math.floor(P / 2) : P));
  }
  /** Veces que se activa cada pasivo (Maestría Rúnica: dos veces; nunca más de 3). */
  const passTimes = (c) => 1 + Math.min(2, (c.player.powers && c.player.powers.maestria) || 0);
  /** Efecto de una runa (pasivo o detonación). Los pasivos no activan otros pasivos: sin bucles. */
  function runeEffect(run, id, fx, ev) {
    const c = run.combat;
    if (fx.dmg && !c.over) hitEnemy(run, runeVal(c, id, fx.dmg), ev);
    if (fx.block && !c.over) gainBlock(c, runeVal(c, id, fx.block), ev);
    if (fx.heal && !c.over) { const h = heal(run, runeVal(c, id, fx.heal)); if (h) ev.push({ t: 'heal', amount: h, hp: run.hp }); }
  }
  function runePassive(run, idx, ev) {
    const c = run.combat, id = c.runes[idx], r = D.RUNES[id];
    if (!r || c.over) return;
    ev.push({ t: 'runePulse', idx, id });
    if (r.passive.draw) { c.runeDraw = (c.runeDraw || 0) + runeVal(c, id, r.passive.draw); ev.push({ t: 'runeDraw', amount: c.runeDraw }); }
    const deep = id === 'fuego' && c.player.powers && c.player.powers.grabado;   // Grabado Profundo: el Fuego hace más
    runeEffect(run, id, deep ? Object.assign({}, r.passive, { dmg: r.passive.dmg + deep }) : r.passive, ev);
  }
  /** Activa los pasivos de las runas `idxs` (todas por defecto), `times` vueltas × Maestría. */
  function activatePassives(run, ev, idxs, times = 1) {
    const c = run.combat;
    const list = idxs || c.runes.map((_, i) => i);
    const n = Math.min(12, times * passTimes(c));   // tope de seguridad
    for (let k = 0; k < n && !c.over; k++) for (const i of list) { if (c.over) return; if (i < c.runes.length) runePassive(run, i, ev); }
  }
  /** Detona la runa `idx`: aplica su detonación y sale de su ranura. */
  function detonate(run, idx, ev, times = 1) {
    const c = run.combat;
    if (idx < 0 || idx >= c.runes.length || c.over) return;
    const id = c.runes.splice(idx, 1)[0], r = D.RUNES[id];
    ev.push({ t: 'detonate', idx, id, runes: c.runes.slice() });
    log(c, ev, _m('e.la_runa_de_0_detona', { 0: R('rune', id) }));
    run.stats.detonations = (run.stats.detonations || 0) + 1;
    c.detonated = (c.detonated || 0) + 1;   // runas detonadas este combate
    for (let k = 1; k < times && !c.over; k++) detonationFx(run, id, ev);   // Sobrecarga Rúnica: el efecto se repite
    if (!c.over) detonationFx(run, id, ev);
    if (!c.over && hasRelic(run, 'anillo')) drawCards(run, 1, ev);   // Anillo Resonante
    if (!c.over && hasRelic(run, 'polvoruna')) gainBlock(c, D.RELICS.polvoruna.v || 3, ev, 'relic');   // Polvo de Runa
    if (!c.over && hasRelic(run, 'esquirlar')) {   // Esquirla Rúnica: daño a todos (no es un Ataque)
      const was = c.attacking; c.attacking = false; c.spread = true;
      try { hitEnemy(run, D.RELICS.esquirlar.v || 2, ev, { relic: 'esquirlar' }); } finally { delete c.spread; c.attacking = was; }
    }
    contractTick(run, 'detonate', { n: c.detonated });
    if (c.over) return;
    if (c.player.powers.cicloe) (c.cicloQueue = c.cicloQueue || []).push(id);   // Ciclo Eterno: vuelve al final de tu turno
    // Cantera Viva: Graba Piedra si queda una ranura libre (sin empujar a otra: nunca hay bucle)
    for (let k = 0; k < (c.player.powers.cantera || 0) && !c.over; k++) engraveSoft(run, 'piedra', ev);
  }
  /** Graba solo si hay una ranura libre (sin contar la que está a punto de ocupar un Grabado en curso). */
  function engraveSoft(run, id, ev) {
    const c = run.combat;
    if (c.over || c.runes.length >= runeSlots(c) - (c.engraving || 0)) return false;
    c.runes.push(id);
    ev.push({ t: 'engrave', id, runes: c.runes.slice() });
    if (c.player.powers.forja) gainBlock(c, c.player.powers.forja, ev);   // Forja Eterna
    return true;
  }
  /** Efecto de la detonación de una runa (robo, daño/Bloqueo/cura y Reflejo). */
  function detonationFx(run, id, ev) {
    const c = run.combat, r = D.RUNES[id];
    if (r.det.draw) drawCards(run, runeVal(c, id, r.det.draw), ev);
    const refl = ACT3_RULES.reflectRunes && r.det.dmg && (c.enemy.reflect || 0) > 0 && !c.reflectTally;
    if (refl) c.reflectTally = { dmg: 0, per: {} };
    runeEffect(run, id, r.det, ev);
    if (refl) {   // Reflejo: la detonación te devuelve la mitad (gasta una carga)
      const back = Math.floor(c.reflectTally.dmg * REFLECT_FRAC); c.reflectTally = null;
      if (!c.over) {
        c.enemy.reflect--;
        ev.push({ t: 'reflect', amount: back, charges: c.enemy.reflect });
        log(c, ev, _m('e.reflejo_0_de_dano_de_2', { 0: back }));
        if (back > 0) selfDamage(run, back, ev, _t('e.reflejo'));
      }
    }
  }
  /** Graba una runa a la derecha; con las ranuras llenas, la más antigua detona primero. */
  function engrave(run, id, ev) {
    const c = run.combat;
    if (!D.RUNES[id] || c.over) return;
    c.engraving = (c.engraving || 0) + 1;   // la ranura que va a ocupar esta runa no está libre para Cantera Viva
    while (c.runes.length >= runeSlots(c) && !c.over) detonate(run, 0, ev);
    c.engraving--;
    if (c.over) return;
    c.runes.push(id);
    ev.push({ t: 'engrave', id, runes: c.runes.slice() });
    if (c.player.powers.forja) gainBlock(c, c.player.powers.forja, ev);   // Forja Eterna
  }
  const BASIC_RUNES = ['fuego', 'piedra', 'viento'];
  /** Inscribir+: elige la runa (la UI pregunta; el bot elige solo). */
  function chooseRune(run, id) {
    const c = run.combat;
    if (!c || !c.choice || !c.choice.options.includes(id)) return [];
    const ev = evList(run);
    if (c.choice.kind === 'exhaust') {   // Pira Funeraria: Agota la carta elegida → Quemadura
      const card = c.hand.find((x) => x.uid === id);
      c.hand = c.hand.filter((x) => x !== card);
      c.exhaust.push(card);
      ev.push({ t: 'exhaustHand', uids: [id] });
      const cost = typeof cardVals(card).cost === 'number' ? cardVals(card).cost : 0;   // X y sin coste: 0
      log(c, ev, _m('e.pyre', { c: RC(card) }));
      applyBurn(run, 2 * cost + (c.choice.plus || 0), ev);
      onExhaust(run, card, ev);
      c.choice.options = c.choice.options.filter((u) => u !== id && c.hand.some((x) => x.uid === u));
    } else if (c.choice.kind === 'discard') {   // Improvisar: descarta la carta elegida
      const card = c.hand.find((x) => x.uid === id);
      c.hand = c.hand.filter((x) => x !== card);
      c.discard.push(card);
      ev.push({ t: 'discardHand', uids: [id], kept: c.hand.map((x) => x.uid) });
      c.choice.options = c.choice.options.filter((u) => u !== id && c.hand.some((x) => x.uid === u));
    } else engrave(run, id, ev);
    c.choice.n--;
    if (c.choice.n <= 0 || !c.choice.options.length) c.choice = null;
    ev.push({ t: 'choiceDone' });
    return ev;
  }
  /** Intención del SIGUIENTE turno (Ojo de Búho). */
  function nextIntentOf(combat) {
    const e = combat.enemy, e2 = { ...e, frozen: false, actedOnce: true };
    // Lo que gane de Fuerza este turno (su movimiento y la pasiva de Fuerza creciente) ya cuenta para el siguiente
    if (!e.frozen && !e.stunned && !e.charging) { const m = currentMove(e); if (m && m.str) e2.str = (e.str || 0) + m.str; }
    if (!e.frozen && (D.ENEMIES[e.id] || {}).grow) e2.str = (e2.str || 0) + D.ENEMIES[e.id].grow;
    if (!e.frozen) e2.moveIdx = e.moveIdx + 1;
    // Carga Arcana: el turno siguiente sigue cargando o descarga
    if (!e.frozen && e.charging) { e2.moveIdx = e.moveIdx; e2.charging = e.charging.left > 0 ? { ...e.charging, left: e.charging.left - 1 } : null; }
    else if (!e.frozen) { const m = currentMove(e); if (m.charge) e2.charging = { left: m.charge - 1, hit: m.chargeHit, mv: moveRef(e) }; }
    return intentOf({ ...combat, enemy: e2 });
  }

  /** Operaciones de cartas. Cada una recibe (run, valores, evento, argumento). */
  const OPS = {
    attack(run, v, ev, arg, ctx = {}) {
      const hits = v.hits || 1, base = v.dmg + (ctx.card ? cardBonus(ctx.card, v, run.combat, true) : 0);
      for (let i = 0; i < hits && !run.combat.over; i++) hitEnemy(run, playerAttackDamage(run.combat, base), ev);
    },
    /* ---- Neutrales ---- */
    discardChoice(run, v, ev) {
      const c = run.combat;
      if (!c.hand.length) return;
      c.choice = { kind: 'discard', options: c.hand.map((x) => x.uid), n: Math.min(c.hand.length, (c.choice && c.choice.kind === 'discard' ? c.choice.n : 0) + 1) };
      ev.push({ t: 'choice', kind: 'discard' });
    },
    secondWind(run, v, ev) {
      const c = run.combat, gone = c.hand.filter((x) => cardDef(x).type !== 'attack');
      if (!gone.length) return;
      c.hand = c.hand.filter((x) => !gone.includes(x));
      c.exhaust.push(...gone);
      ev.push({ t: 'exhaustHand', uids: gone.map((x) => x.uid) });
      gainBlock(c, v.per * gone.length, ev);
      gone.forEach((x) => { if (!c.over) onExhaust(run, x, ev); });
    },
    sacrifice(run, v, ev) { selfDamage(run, v.self, ev, _t('e.sacrificio')); },
    luckyHit(run, v, ev, arg, ctx = {}) {
      const c = run.combat, roll = randInt(run, v.lo, v.hi);
      log(c, ev, _m('e.golpe_de_suerte_sale_un', { 0: roll }));
      hitEnemy(run, playerAttackDamage(c, roll + (ctx.card ? cardBonus(ctx.card, v, c, true) : 0)), ev);
    },
    retainAll(run, v, ev) { run.combat.retainAll = run.combat.turn; log(run.combat, ev, _m('e.planificas_este_turno_conservas_toda')); },
    loot(run, v, ev) { run.combat.loot = (run.combat.loot || 0) + v.gold; },
    lastStand(run, v, ev, arg, ctx = {}) {
      const c = run.combat, base = Math.floor(Math.max(0, run.maxHp - run.hp) / v.div);
      hitEnemy(run, playerAttackDamage(c, base + (ctx.card ? cardBonus(ctx.card, v, c, true) : 0)), ev);
    },
    /** Trascender: mejora PARA SIEMPRE las cartas de la mano (también su copia del mazo). */
    transcend(run, v, ev) {
      const c = run.combat, ups = c.hand.filter(canUpgrade);
      if (!ups.length) return;
      ups.forEach((x) => { x.up = true; const d = run.deck.find((y) => y.uid === x.uid); if (d) d.up = true; });
      ev.push({ t: 'upgradeHand', uids: ups.map((x) => x.uid) });
      log(c, ev, _m('e.transcend', { c: RCS(ups) }));
    },
    /* ---- Invocadora ---- */
    summon(run, v, ev, id) { summon(run, id, ev); },
    summonRandom(run, v, ev, n) { for (let i = 0; i < (n || 1) && !run.combat.over; i++) summon(run, pick(run, COMMON_SUMMONS), ev); },
    command(run, v, ev, n) { summonsAct(run, ev, n || 1, 'now'); },
    summonsAttack(run, v, ev) { const c = run.combat; for (let k = 0; k < (v.times || 1) && !c.over; k++) for (const s of c.summons.slice()) { if (c.over) break; ev.push({ t: 'summonAct', sid: s.sid, id: s.id }); summonStrike(run, s, ev); } },
    strongest(run, v, ev) {
      const c = run.combat;
      let best = null, bv = 0;
      for (const s of c.summons) { const d = D.SUMMONS[s.id], val = summonAtk(c, s) * (d.hits || 1); if (val > bv) { bv = val; best = s; } }
      if (best && !c.over) { ev.push({ t: 'summonAct', sid: best.sid, id: best.id }); summonStrike(run, best, ev); }
    },
    healSummons(run, v, ev) { healSummons(run, v.sheal, ev); },
    drawIfFull(run, v, ev) { if ((run.combat.summons || []).length >= D.MAX_SUMMONS) drawCards(run, v.draw, ev); },
    bondTurn(run, v, ev) {
      const c = run.combat;
      c.bondTurn = { turn: c.turn, n: (c.bondTurn && c.bondTurn.turn === c.turn ? c.bondTurn.n : 0) + v.bond };
      ev.push({ t: 'status', who: 'player', key: 'vinculo', value: bondOf(c) });
    },
    releaseOldest(run, v, ev) {
      const c = run.combat;
      if (!c.summons.length) return;
      const gone = c.summons.shift();
      log(c, ev, _m('e.0_se_ofrece_al_bosque', { 0: R('summon', gone.id) }));
      ev.push({ t: 'summonLeave', sid: gone.sid, id: gone.id, summons: snapSummons(c) });
      c.player.energy += v.energy; ev.push({ t: 'energy', energy: c.player.energy });
      drawCards(run, v.draw, ev);
    },
    beastWall(run, v, ev) { const c = run.combat, tot = c.summons.reduce((a, s) => a + s.hp, 0); if (tot > 0) gainBlock(c, Math.min(v.max, tot), ev); },
    revive(run, v, ev) { const c = run.combat; if (c.lastDead) summon(run, c.lastDead, ev); },
    /* ---- Paladín ---- */
    judge(run, v, ev) { applyJudgment(run, v.judg, ev); },
    hurt(run, v, ev) { hurtSelf(run, v.self, ev); },
    immaterial(run, v, ev) {
      const p = run.combat.player;
      if (p.immaterial !== 'turn') p.immaterial = true;
      ev.push({ t: 'status', who: 'player', key: 'immaterial', value: 1 }); ev.push({ t: 'immaterial' });
    },
    aegis(run, v, ev) { gainBlock(run.combat, run.hp < run.maxHp * 0.5 ? v.low : v.block, ev); },
    healSelf(run, v, ev) { const h = heal(run, v.heal); if (h) ev.push({ t: 'heal', amount: h, hp: run.hp }); syncHp(run, ev); },
    sentence(run, v, ev) { const c = run.combat; hitEnemy(run, playerAttackDamage(c, (c.enemy.judg || 0) * v.per), ev); },
    finalJudgment(run, v, ev) {
      const c = run.combat;
      hitEnemy(run, playerAttackDamage(c, (c.enemy.judg || 0) * v.per), ev);
      if (!c.over && c.enemy.judg > 0) { c.enemy.judg = 0; ev.push({ t: 'judgSet', judg: 0 }); }
    },
    shieldBash(run, v, ev) { const c = run.combat; hitEnemy(run, playerAttackDamage(c, Math.floor(c.player.block / v.div)), ev); },
    cleanse(run, v, ev) {
      const c = run.combat, p = c.player;
      if (p.weak) { p.weak = 0; ev.push({ t: 'status', who: 'player', key: 'weak', value: 0 }); }
      if (c.noDefTurn && c.noDefTurn >= c.turn) { c.noDefTurn = 0; ev.push({ t: 'status', who: 'player', key: 'expuesto', value: 0 }); }
      const sealed = c.hand.filter((x) => x.sealed === c.turn);
      sealed.forEach((x) => { delete x.sealed; });
      c.drainNext = 0; c.silenceNext = 0;
      ev.push({ t: 'cleanse', uids: sealed.map((x) => x.uid) });
      log(c, ev, _m('e.cleanse'));
    },
    contrition(run, v, ev, arg, ctx = {}) {
      const c = run.combat, x = ctx.x || 0;
      if (x <= 0) return;
      hurtSelf(run, v.per * x, ev);
      c.energyNext = (c.energyNext || 0) + v.gain * x;
      log(c, ev, _m('e.contrition', { n: v.gain * x }));
    },
    keepBlock(run, v, ev) { const c = run.combat; c.keepBlock = c.turn + 1; log(c, ev, _m('e.keepBlock')); },
    /* ---- Sendas (★) ---- */
    /** Punto de Fusión: +daño a tus Ataques este turno, sin Sobrecalentamiento; al final, la Temperatura a 0. */
    fusion(run, v, ev) {
      const c = run.combat, prev = c.fusion && c.fusion.turn === c.turn ? c.fusion.bonus : 0;
      c.fusion = { turn: c.turn, bonus: prev + v.bonus };
      ev.push({ t: 'status', who: 'player', key: 'fusion', value: c.fusion.bonus });
    },
    /** Pira Funeraria: eliges una carta de la mano; se Agota y aplica 2× su coste + N de Quemadura. */
    pyreChoice(run, v, ev) {
      const c = run.combat;
      if (!c.hand.length) return;
      const prev = c.choice && c.choice.kind === 'exhaust' ? c.choice : null;   // Eco Ardiente: una más
      c.choice = { kind: 'exhaust', options: c.hand.map((x) => x.uid), n: (prev ? prev.n : 0) + 1, plus: v.plus };
      ev.push({ t: 'choice', kind: 'exhaust' });
    },
    prismShatter(run, v, ev) { const c = run.combat; c.prismShatter = c.turn; ev.push({ t: 'status', who: 'player', key: 'prismt', value: 1 }); },
    /** Sobrecarga Rúnica: la runa más reciente detona dos veces. */
    overload(run, v, ev) { const c = run.combat; if (c.runes.length) detonate(run, c.runes.length - 1, ev, v.times || 2); },
    /** Círculo Perfecto: ranuras llenas con runas distintas → Energía y cartas. */
    perfectCircle(run, v, ev) {
      const c = run.combat, rs = c.runes || [];
      if (rs.length < runeSlots(c) || new Set(rs).size !== rs.length) { log(c, ev, _m('e.circleNo')); return; }
      c.player.energy += v.energy; ev.push({ t: 'energy', energy: c.player.energy });
      drawCards(run, v.draw, ev);
    },
    /** Llama Votiva: cuenta por copia; la mejorada baja el umbral. */
    votive(run, v, ev) {
      const c = run.combat, p = c.player;
      p.powers.votiva = (p.powers.votiva || 0) + 1;
      c.votivaPer = Math.min(c.votivaPer || 99, v.per);
      ev.push({ t: 'status', who: 'player', key: 'votiva', value: p.powers.votiva });
      syncHp(run, ev);
    },
    /* ---- Sendas: cartas nuevas ---- */
    hitsBurn(run, v, ev, arg, ctx = {}) {   // Ascuas Gemelas: cada golpe aplica Quemadura
      const c = run.combat, base = v.dmg + (ctx.card ? cardBonus(ctx.card, v, c, true) : 0);
      for (let i = 0; i < (v.hits || 1) && !c.over; i++) { hitEnemy(run, playerAttackDamage(c, base), ev); if (!c.over) applyBurn(run, v.burn, ev); }
    },
    thermostat(run, v, ev) { const c = run.combat; if (c.player.temp >= v.at) drawCards(run, v.draw, ev); else setTemp(c, c.player.temp + v.temp, ev); },
    blockBurn(run, v, ev) { const c = run.combat; gainBlock(c, v.block + Math.min(v.max, Math.floor((c.enemy.burn || 0) / 2)), ev); },
    ashes(run, v, ev) { const c = run.combat, base = Math.min(v.max, v.per * exhaustedCount(c)); if (base > 0) hitEnemy(run, playerAttackDamage(c, base), ev); },
    totalIgnition(run, v, ev, arg, ctx = {}) {   // Ignición Total: Agota la mano; por cada carta, golpe + Quemadura
      const c = run.combat, gone = c.hand.slice();
      if (!gone.length) return;
      c.hand = []; c.exhaust.push(...gone);
      ev.push({ t: 'exhaustHand', uids: gone.map((x) => x.uid) });
      gone.forEach((x) => { if (!c.over) onExhaust(run, x, ev); });
      const base = v.dmg + (ctx.card ? cardBonus(ctx.card, v, c, true) : 0);
      for (let i = 0; i < gone.length && !c.over; i++) { hitEnemy(run, playerAttackDamage(c, base), ev); if (!c.over) applyBurn(run, v.burn, ev); }
    },
    drawIfFrostAt(run, v, ev) { if ((run.combat.enemy.frost || 0) >= v.at) drawCards(run, v.draw, ev); },
    iceFromFrost(run, v, ev) { const c = run.combat, n = Math.min(v.max, v.mult * (c.enemy.frost || 0)); if (n > 0) gainIce(c, n, ev); },
    iceCounter(run, v, ev) { const c = run.combat; c.iceCounter = c.turn; ev.push({ t: 'status', who: 'player', key: 'contra', value: 1 }); },
    xHitsFrost(run, v, ev, arg, ctx = {}) {   // Lluvia de Esquirlas: X golpes, cada uno con Escarcha
      const c = run.combat, base = v.dmg + (ctx.card ? cardBonus(ctx.card, v, c, true) : 0);
      for (let i = 0; i < (ctx.x || 0) && !c.over; i++) { hitEnemy(run, playerAttackDamage(c, base), ev); if (!c.over) applyFrost(run, v.frost, ev); }
    },
    blockToFrost(run, v, ev) {   // Ventisca Interior
      const c = run.combat, b = c.player.block, n = Math.floor(b / v.div);
      if (b > 0) { c.player.block = 0; ev.push({ t: 'blockPlayer', amount: -b, block: 0 }); }
      if (n > 0) applyFrost(run, n, ev);
    },
    iceDouble(run, v, ev) { const c = run.combat; if ((c.player.ice || 0) > 0) gainIce(c, c.player.ice, ev); },
    coffin(run, v, ev) {   // Ataúd de Hielo: un turno más Congelado (una vez por congelación; también los jefes)
      const e = run.combat.enemy;
      if (!e.frozen || e.coffinUsed) { log(run.combat, ev, _m('e.coffinNo')); return; }
      e.coffin = 1; e.coffinUsed = true;
      ev.push({ t: 'status', who: 'enemy', key: 'coffin', value: 1 }); ev.push({ t: 'intent' });
    },
    runeSpark(run, v, ev) { const c = run.combat, n = (c.runes || []).length; if (n > 0) hitEnemy(run, playerAttackDamage(c, v.per * n), ev); },
    stoneBlock(run, v, ev) { const c = run.combat; gainBlock(c, v.block + v.per * c.runes.filter((r) => r === 'piedra').length, ev); },
    doubleChisel(run, v, ev) { const two = shuffle(run, BASIC_RUNES.slice()).slice(0, 2); for (const id of two) { if (run.combat.over) break; engrave(run, id, ev); } },
    detonateFire(run, v, ev) { const c = run.combat, i = c.runes.indexOf('fuego'); if (i >= 0) detonate(run, i, ev); },
    runeAvalanche(run, v, ev) { const c = run.combat, base = v.per * (c.detonated || 0); if (base > 0) hitEnemy(run, playerAttackDamage(c, base), ev); },
    stonePassives(run, v, ev) { const c = run.combat, idxs = c.runes.map((r, i) => (r === 'piedra' ? i : -1)).filter((i) => i >= 0); if (idxs.length) activatePassives(run, ev, idxs); },
    runePowerUp(run, v, ev) { const c = run.combat; c.runePower = (c.runePower || 0) + v.amt; ev.push({ t: 'runePower', power: runePow(c), amount: v.amt }); },
    summonWeak(run, v, ev, id) { summon(run, id, ev, undefined, { hpDelta: -v.less }); },
    summonsGain(run, v, ev) {
      const c = run.combat;
      for (const s of c.summons || []) { s.maxHp += v.sgain; s.hp += v.sgain; ev.push({ t: 'summonHeal', sid: s.sid, amount: v.sgain, hp: s.hp, summons: snapSummons(c) }); }
    },
    oldestGain(run, v, ev) { const c = run.combat, s = (c.summons || [])[0]; if (s) { s.maxHp += v.sgain; s.hp += v.sgain; ev.push({ t: 'summonHeal', sid: s.sid, amount: v.sgain, hp: s.hp, summons: snapSummons(c) }); } },
    summonIfNone(run, v, ev, id) { if (!(run.combat.summons || []).length) summon(run, id, ev); },
    offering(run, v, ev) {   // Ofrenda: sacrifica la de menos PV; inflige N× su ataque (no es un Ataque)
      const c = run.combat, list = c.summons || [];
      if (!list.length) return;
      const s = list.reduce((a, b) => (b.hp < a.hp ? b : a), list[0]), atk = summonAtk(c, s);
      sacrificeSummon(run, s, ev);
      if (!c.over && atk * v.mult > 0) hitEnemy(run, atk * v.mult, ev, { sacrifice: true });
    },
    bondTurnFull(run, v, ev) {
      const c = run.combat, n = (c.summons || []).length >= D.MAX_SUMMONS ? v.bondFull : v.bond;
      c.bondTurn = { turn: c.turn, n: (c.bondTurn && c.bondTurn.turn === c.turn ? c.bondTurn.n : 0) + n };
      ev.push({ t: 'status', who: 'player', key: 'vinculo', value: bondOf(c) });
    },
    rootPact(run, v, ev) {   // Pacto de Raíces: la más antigua se va y llega un Treant Joven
      const c = run.combat;
      if ((c.summons || []).length) { const gone = c.summons.shift(); log(c, ev, _m('e.0_se_ofrece_al_bosque', { 0: R('summon', gone.id) })); ev.push({ t: 'summonLeave', sid: gone.sid, id: gone.id, summons: snapSummons(c) }); }
      summon(run, 'treant', ev);
    },
    strongestN(run, v, ev) {   // Orden Feroz
      const c = run.combat;
      let best = null, bv = 0;
      for (const s of c.summons || []) { const d = D.SUMMONS[s.id], val = summonAtk(c, s) * (d.hits || 1); if (val > bv) { bv = val; best = s; } }
      for (let k = 0; k < (v.times || 1) && best && !c.over && c.summons.includes(best); k++) { ev.push({ t: 'summonAct', sid: best.sid, id: best.id }); summonStrike(run, best, ev); }
    },
    lifeCycle(run, v, ev) {   // Ciclo de la Vida: sacrifica todas y vuelven enteras con +ataque
      const c = run.combat, ids = (c.summons || []).map((s) => ({ id: s.id, bonus: s.atkBonus || 0 }));
      if (!ids.length) return;
      for (const s of c.summons.slice()) { if (c.over) return; sacrificeSummon(run, s, ev); }
      for (const x of ids) { if (c.over) return; summon(run, x.id, ev, undefined, { atkBonus: x.bonus + v.atk }); }
    },
    roar(run, v, ev) {   // Rugido Primigenio: todas atacan con Vínculo extra (solo esta vez)
      const c = run.combat;
      c.tempBond = v.bond;
      for (const s of (c.summons || []).slice()) { if (c.over) break; ev.push({ t: 'summonAct', sid: s.sid, id: s.id }); summonStrike(run, s, ev); }
      c.tempBond = 0;
    },
    judgeIfJudged(run, v, ev) { if ((run.combat.enemy.judg || 0) > 0) applyJudgment(run, v.judg, ev); },
    prayerEnergy(run, v, ev) { const c = run.combat; if (c.lostTurn === c.turn) { c.player.energy += v.energy; ev.push({ t: 'energy', energy: c.player.energy }); } },
    penitent(run, v, ev) { if (run.hp > run.maxHp * 0.5) hurtSelf(run, v.self, ev); if (!run.combat.over) drawCards(run, v.draw, ev); },
    judgMirror(run, v, ev) { const c = run.combat; c.judgMirror = { turn: c.turn, n: v.judg }; ev.push({ t: 'status', who: 'player', key: 'espejoj', value: v.judg }); },
    atone(run, v, ev) { const c = run.combat, h = heal(run, v.mult * (c.enemy.judg || 0)); if (h) ev.push({ t: 'heal', amount: h, hp: run.hp }); syncHp(run, ev); },
    ironJudgment(run, v, ev) { const c = run.combat, n = Math.floor(c.player.block / v.div); if (n > 0) applyJudgment(run, n, ev); },
    martyrdom(run, v, ev) {   // Martirio: la mitad de tus PV (nunca te mata), Energía e Inmaterial
      const c = run.combat;
      hurtSelf(run, Math.floor(run.hp / 2), ev);
      if (c.over) return;
      c.player.energy += v.energy; ev.push({ t: 'energy', energy: c.player.energy });
      OPS.immaterial(run, v, ev);
    },
    /* ---- Electromante ---- */
    zap(run, v, ev, arg, ctx = {}) {
      const c = run.combat, base = v.dmg + (ctx.card ? cardBonus(ctx.card, v, c, true) : 0);
      if (ctx.relay === undefined) { ctx.relay = c.relay && c.relay.turn === c.turn ? c.relay.n : 0; if (ctx.relay) { c.relay = null; ev.push({ t: 'status', who: 'player', key: 'relay', value: 0 }); } }   // Relé: el próximo Rayo
      const more = (hasRelic(run, 'toroide') ? 1 : 0) + ((c.player.powers && c.player.powers.ojotormenta) || 0);   // Toroide de Cobre · Ojo de la Tormenta
      bolt(run, base, (v.chain || 0) + ctx.relay + more, ev, false, ctx.chainQ);
    },
    zapAll(run, v, ev, arg, ctx = {}) { const c = run.combat; bolt(run, v.dmg + (ctx.card ? cardBonus(ctx.card, v, c, true) : 0), 0, ev, true); },
    zapRandom(run, v, ev, arg, ctx = {}) {   // Chispas: cada golpe, a un enemigo vivo al azar
      const c = run.combat, base = v.dmg + (ctx.card ? cardBonus(ctx.card, v, c, true) : 0);
      for (let k = 0; k < (v.hits || 1) && !c.over; k++) {
        const al = c.enemies.map((e, i) => i).filter((i) => alive(c.enemies[i]));
        const i = al.length > 1 ? pick(run, al) : al[0];
        if (i === undefined) return;
        withEnemy(c, i, () => boltHit(run, base, ev, null));
      }
    },
    xZap(run, v, ev, arg, ctx = {}) {   // Sobretensión: Rayo X veces y +X Estática
      const c = run.combat, x = ctx.x || 0, base = v.dmg + (ctx.card ? cardBonus(ctx.card, v, c, true) : 0);
      for (let k = 0; k < x && !c.over; k++) boltHit(run, base, ev, null);
      if (!c.over) gainStatic(run, x, ev);
    },
    static(run, v, ev) { gainStatic(run, v.st, ev); },
    /* ---- Electromante (Parche 3.5) ---- */
    ionShield(run, v, ev) { const c = run.combat; gainBlock(c, v.block, ev); if ((c.player.static || 0) >= v.at) drawCards(run, v.draw, ev); },
    comboDraw(run, v, ev) { if (comboOn(v, run.combat, true)) drawCards(run, v.draw, ev); },
    magnetAll(run, v, ev) { const c = run.combat; eachAlive(c, () => applyMagnet(run, v.mag, ev)); },
    staticPerZero(run, v, ev) { const c = run.combat, n = c.hand.filter((x) => !isX(x) && costIn(x, c) === 0).length; if (n) gainStatic(run, v.st * n, ev); },
    staticBlock(run, v, ev) { const c = run.combat; gainBlock(c, v.block + v.mult * (c.player.static || 0), ev); },
    forceOverload(run, v, ev) { overload(run, ev); },
    staticPerAlive(run, v, ev) { const c = run.combat, n = c.enemies.filter(alive).length; if (n) gainStatic(run, v.st * n, ev); },
    magnet(run, v, ev) { applyMagnet(run, v.mag, ev); },
    comboEnergy(run, v, ev) { const c = run.combat; if (comboOn(v, c, true)) { c.player.energy += v.energy; ev.push({ t: 'energy', energy: c.player.energy }); } },
    condenser(run, v, ev) { const c = run.combat; gainBlock(c, v.block + Math.floor((c.player.static || 0) / 2), ev); },
    ground(run, v, ev) { const c = run.combat; gainBlock(c, v.block, ev); const n = loseStatic(run, v.max, ev); if (n > 0) gainBlock(c, n * v.per, ev, 'ground'); },
    faraday(run, v, ev) { const c = run.combat; gainBlock(c, v.block + ((c.player.static || 0) >= v.at ? v.bonus : 0), ev); },
    relay(run, v, ev) { const c = run.combat; c.relay = { turn: c.turn, n: (c.relay && c.relay.turn === c.turn ? c.relay.n : 0) + v.extra }; ev.push({ t: 'status', who: 'player', key: 'relay', value: c.relay.n }); },
    polarity(run, v, ev) { const c = run.combat, n = c.player.static || 0; if (n <= 0) return; loseStatic(run, n, ev); applyMagnet(run, n, ev); },
    supercharge(run, v, ev) { const c = run.combat; gainStatic(run, c.player.static || 0, ev); },
    microSparks(run, v, ev) {   // Microchispas: Chispazos de este combate, coste 0 y Etéreos
      const c = run.combat;
      for (let k = 0; k < (v.n || 2) && c.hand.length < MAX_HAND; k++) {
        const card = { uid: run.uidNext++, id: 'chispazoe', up: false, temp: true, free0: true, eth: true };
        c.tempCards++; c.hand.push(card);
        ev.push({ t: 'draw', uid: card.uid });
      }
    },
    /* ---- Guardiana ---- */
    engrave(run, v, ev, id) { engrave(run, id, ev); },
    engraveIfNone(run, v, ev, id) { if (!run.combat.runes.length) engrave(run, id, ev); },
    runeHit(run, v, ev) { if (v.hit > 0) hitEnemy(run, v.hit, ev); },
    runeBlock(run, v, ev) { const n = run.combat.runes.length; if (n) gainBlock(run.combat, v.per * n, ev); },
    echoRune(run, v, ev) { const c = run.combat; if (c.runes.length) activatePassives(run, ev, [c.runes.length - 1], v.times || 1); },
    drawIfRunes(run, v, ev) { if (run.combat.runes.length >= 3) drawCards(run, v.draw, ev); },
    inscribe(run, v, ev) {
      const c = run.combat;
      if (v.choose) { c.choice = { kind: 'rune', options: BASIC_RUNES.slice(), n: (c.choice ? c.choice.n : 0) + 1 }; ev.push({ t: 'choice', kind: 'rune' }); }
      else engrave(run, pick(run, BASIC_RUNES), ev);
    },
    detonateOldest(run, v, ev) { if (run.combat.runes.length) detonate(run, 0, ev); },
    runeChain(run, v, ev) { activatePassives(run, ev); },
    resonate(run, v, ev, arg, ctx = {}) { const n = (ctx.x || 0) + (v.xPlus || 0); if (n > 0) activatePassives(run, ev, null, n); },
    keepBlockIfStone(run, v, ev) { const c = run.combat; if (c.runes.includes('piedra')) { c.keepBlock = c.turn + 1; log(c, ev, _m('e.la_runa_de_piedra_sostiene')); } },
    detonateAll(run, v, ev) {
      const c = run.combat, n = c.runes.length;
      for (let k = 0; k < n && c.runes.length && !c.over; k++) detonate(run, 0, ev);   // solo las que había (Cantera Viva graba otras al final)
      if (!c.over && n > 0) hitEnemy(run, playerAttackDamage(c, n * v.per), ev);
    },
    fillRunes(run, v, ev) { const c = run.combat; let g = 0; while (c.runes.length < runeSlots(c) && !c.over && g++ < 10) engrave(run, pick(run, ['fuego', 'piedra', 'viento', 'sangre']), ev); },
    /* ---- Criomante ---- */
    frost(run, v, ev) { applyFrost(run, v.frost, ev); },
    ice(run, v, ev) { gainIce(run.combat, v.ice, ev); },
    /** Fragmentar: N por Escarcha y la consume toda. */
    shatter(run, v, ev) {
      const c = run.combat, n = c.enemy.frost || 0;
      ev.push({ t: 'shatter', frost: n });
      if (n > 0) hitEnemy(run, playerAttackDamage(c, frostDamage(c, v.per, true)), ev);
      if (c.prismShatter === c.turn) { c.prismShatter = 0; ev.push({ t: 'status', who: 'player', key: 'prismt', value: 0 }); return; }   // Prisma de Hielo: esta vez no se consume
      if (!c.over) { c.enemy.frost = 0; ev.push({ t: 'frostSet', frost: 0 }); }
    },
    /** Tormenta Polar: N por Escarcha sin consumirla. */
    storm(run, v, ev) { const c = run.combat; if ((c.enemy.frost || 0) > 0) hitEnemy(run, playerAttackDamage(c, frostDamage(c, v.per, false)), ev); },
    drawIfFrost(run, v, ev) { if ((run.combat.enemy.frost || 0) > 0) drawCards(run, v.draw, ev); },
    frostDouble(run, v, ev) { const n = run.combat.enemy.frost || 0; if (n > 0) applyFrost(run, n, ev); },
    /** Cristalizar: todo el Bloqueo pasa a Escudo de Hielo (+extra mejorada). */
    crystal(run, v, ev) {
      const c = run.combat, b = c.player.block;
      c.player.block = 0; if (b) ev.push({ t: 'blockPlayer', amount: -b, block: 0 });
      gainIce(c, b + (v.extra || 0), ev);
    },
    mirror(run, v, ev) { run.combat.mirror = { turn: run.combat.turn, frost: v.frost }; },
    xFrost(run, v, ev, arg, ctx = {}) { const n = (ctx.x || 0) + (v.xPlus || 0); if (n > 0) applyFrost(run, 3 * n, ev); },
    freezeNow(run, v, ev) { if (!run.combat.enemy.frozen) freezeEnemy(run, ev); },
    /* ---- Palabras clave ---- */
    /** Torbellino Ígneo: X golpes. */
    xAttack(run, v, ev, arg, ctx = {}) {
      const base = v.dmg + (ctx.card ? cardBonus(ctx.card, v, run.combat, true) : 0);
      for (let i = 0; i < (ctx.x || 0) && !run.combat.over; i++) hitEnemy(run, playerAttackDamage(run.combat, base), ev);
    },
    xBurn(run, v, ev, arg, ctx = {}) { if (ctx.x > 0) applyBurn(run, ctx.x, ev); },
    /** Reserva de Calor: 2X Temperatura y 4X Bloqueo (X+1 mejorada). */
    xHeat(run, v, ev, arg, ctx = {}) {
      const n = (ctx.x || 0) + (v.xPlus || 0), c = run.combat;
      if (n <= 0) return;
      setTemp(c, c.player.temp + 2 * n, ev);
      gainBlock(c, 4 * n, ev);
    },
    /** Encadenar Llamas: Quemadura extra con Combo (el daño extra va en cardBonus). */
    comboBurn(run, v, ev) { if (comboOn(v, run.combat, true)) applyBurn(run, v.comboBurn, ev); },
    /** Cadena Infernal: con Combo, golpea comboHits veces más y gana Energía. */
    comboChain(run, v, ev, arg, ctx = {}) {
      const c = run.combat;
      if (!comboOn(v, c, true)) return;
      const base = v.dmg + (ctx.card ? cardBonus(ctx.card, v, c, true) : 0);
      for (let i = 0; i < v.comboHits && !c.over; i++) hitEnemy(run, playerAttackDamage(c, base), ev);
      if (!c.over) { c.player.energy += v.comboEnergy; ev.push({ t: 'energy', energy: c.player.energy }); }
    },
    /** Eco Ardiente: la siguiente carta (que no sea otro Eco) se juega dos veces. */
    echo(run, v, ev) { run.combat.echo = true; ev.push({ t: 'echoReady' }); },
    /** Forja Mental: mejora 1 carta al azar de la mano (o todas) solo para este combate. */
    forge(run, v, ev) {
      const c = run.combat, pool = c.hand.filter(canUpgrade);
      if (!pool.length) return;
      const chosen = v.all ? pool : [pick(run, pool)];
      chosen.forEach((x) => { x.up = true; });
      ev.push({ t: 'upgradeHand', uids: chosen.map((x) => x.uid) });
      log(c, ev, _m('e.mindForge', { c: RCS(chosen) }));
    },
    /** Metamorfosis: n cartas al azar de la mano pasan a ser cartas aleatorias (sin maldiciones ni Metamorfosis), gratis este turno. */
    transform(run, v, ev) {
      const c = run.combat, pool = shuffle(run, c.hand.slice()).slice(0, v.n);
      if (!pool.length) return;
      for (const x of pool) {
        const r = weighted(run, [['common', 60], ['uncommon', 30], ['rare', 10]]);
        const options = cardsOfRarity(r, actOf(run), charOf(run), false, run).filter((id) => id !== 'metamorfosis' && !isCurse({ id }));
        x.id = pick(run, options); x.up = false; x.freeTurn = c.turn;
        delete x.temperBonus; delete x.held; delete x.keptTurn; delete x.discountTurn;
      }
      ev.push({ t: 'transform', uids: pool.map((x) => x.uid) });
    },
    flare(run, v, ev) {
      const c = run.combat;
      hitEnemy(run, playerAttackDamage(c, v.dmg + c.player.temp * 2), ev);
    },
    combust(run, v, ev) {
      const c = run.combat;
      const base = c.enemy.burn * v.mult;
      hitEnemy(run, playerAttackDamage(c, base), ev);
      if (!c.over) {
        c.enemy.burn = Math.floor(c.enemy.burn / 2);
        ev.push({ t: 'burnSet', burn: c.enemy.burn });
      }
    },
    block(run, v, ev) { if (v.block > 0) gainBlock(run.combat, v.block, ev); },
    blockTemp(run, v, ev) { gainBlock(run.combat, v.block + run.combat.player.temp * 2, ev); },
    burn(run, v, ev) { applyBurn(run, v.burn, ev); },
    double(run, v, ev) {
      const c = run.combat;
      if (c.enemy.burn > 0) applyBurnRaw(c, c.enemy.burn, ev);
    },
    pyre(run, v, ev) {
      const c = run.combat;
      const amt = c.player.temp * v.mult;
      if (amt > 0) applyBurn(run, amt, ev);
      setTemp(c, 0, ev);
    },
    temp(run, v, ev) { setTemp(run.combat, run.combat.player.temp + v.temp, ev); },
    cool(run, v, ev) { setTemp(run.combat, run.combat.player.temp - v.cool, ev); },
    draw(run, v, ev) { drawCards(run, v.draw, ev); },
    self(run, v, ev) { selfDamage(run, v.self, ev, _t('e.erupcion')); },
    thorns(run, v, ev) {
      run.combat.player.thorns += v.thorns;
      ev.push({ t: 'status', who: 'player', key: 'thorns', value: run.combat.player.thorns });
    },
    /** Disipar Calor: convierte toda la Temperatura en Bloqueo. */
    vent(run, v, ev) {
      const c = run.combat, lost = c.player.temp;
      setTemp(c, 0, ev);
      if (lost > 0) gainBlock(c, lost * v.per, ev);
    },
    /** Fragua: energía extra este turno (el evento actualiza el orbe). */
    energy(run, v, ev) {
      const p = run.combat.player;
      p.energy += v.energy;
      ev.push({ t: 'energy', energy: p.energy });
    },
    /** Supernova: daño = mult × Temperatura (por playerAttackDamage), después la Temperatura vuelve a 0. */
    nova(run, v, ev) {
      const c = run.combat;
      hitEnemy(run, playerAttackDamage(c, c.player.temp * v.mult), ev);
      if (!c.over) setTemp(c, 0, ev);
    },
    /** Fundir: quita todo el Bloqueo del enemigo. */
    melt(run, v, ev) {
      const e = run.combat.enemy;
      if (e.block > 0) { const was = e.block; e.block = 0; ev.push({ t: 'unblock', amount: was }); }
    },
    /** Llama Persistente: roba si el enemigo tiene Quemadura. */
    drawIfBurn(run, v, ev) { if (run.combat.enemy.burn > 0) drawCards(run, v.draw, ev); },
    /** Purgar con Fuego: Agota las Maldiciones de la mano y roba 1 por cada una. */
    purge(run, v, ev) {
      const c = run.combat, curses = c.hand.filter(isCurse);
      if (!curses.length) return;
      c.hand = c.hand.filter((x) => !curses.includes(x));
      c.exhaust.push(...curses);
      ev.push({ t: 'exhaustHand', uids: curses.map((x) => x.uid) });
      curses.forEach((x) => onExhaust(run, x, ev, { noMecha: true }));   // Purgar ya roba 1 por cada una
      drawCards(run, curses.length, ev);
    },
    /** Magma: aplica Quemadura igual a tu Temperatura. */
    burnTemp(run, v, ev) { const t = run.combat.player.temp; if (t > 0) applyBurn(run, t, ev); },
    /** Combustión Espontánea: N× la Quemadura y la deja a 0. */
    consumeBurn(run, v, ev, arg, ctx = {}) {
      const c = run.combat;
      hitEnemy(run, playerAttackDamage(c, c.enemy.burn * v.mult), ev);
      if (!c.over && c.enemy.burn > 0) { c.enemy.burn = 0; ev.push({ t: 'burnSet', burn: 0 }); }
    },
    /** Sinfonía Salvaje: sacrifica todas las criaturas; por cada una, roba 1 y +1 Energía. */
    symphony(run, v, ev) {
      const c = run.combat, n = (c.summons || []).length;
      if (!n) return;
      for (const s of c.summons.slice()) sacrificeSummon(run, s, ev);   // sacrificar cuenta como morir (Alma del Bosque)
      log(c, ev, _m('e.symphony', { n }));
      c.player.energy += n; ev.push({ t: 'energy', energy: c.player.energy });
      drawCards(run, n, ev);
    },
    /** Corazón de Hielo: daño = Bloqueo + Escudo de Hielo; los pierdes y el próximo turno no puedes ganarlos. */
    iceHeart(run, v, ev) {
      const c = run.combat, p = c.player, base = p.block + (p.ice || 0);
      if (base > 0) hitEnemy(run, playerAttackDamage(c, base), ev);
      if (c.over) return;
      p.block = 0; p.ice = 0;
      ev.push({ t: 'blockPlayer', amount: 0, block: 0 }); ev.push({ t: 'ice', amount: 0, ice: 0 });
      c.noDefTurn = c.turn + 1;
      ev.push({ t: 'status', who: 'player', key: 'expuesto', value: 1 });
    },
    /** Cataclismo: el estado propio de cada personaje. */
    cataclysm(run, v, ev) {
      const c = run.combat, ch = charOf(run);
      if (ch === 'piromago') applyBurn(run, v.st, ev);
      else if (ch === 'criomante') applyFrost(run, v.st, ev);
      else if (ch === 'guardiana') engrave(run, 'fuego', ev);
      else if (ch === 'invocadora') summon(run, 'lobezno', ev);
      else if (ch === 'paladin') applyJudgment(run, v.st, ev);
      else if (ch === 'electromante') gainStatic(run, v.st, ev);
      else applyBurn(run, v.st, ev);
    },
    power(run, v, ev, id) {
      const p = run.combat.player;
      p.powers[id] = (p.powers[id] || 0) + v.amt;
      ev.push({ t: 'status', who: 'player', key: id, value: p.powers[id] });
      if (id === 'avatar') syncHp(run, ev);   // Avatar de la Luz: el Fervor cambia ya
    }
  };
  /** Avivar duplica la quemadura actual; no se beneficia de Salamandra (evita bucles raros). */
  function applyBurnRaw(c, amount, ev) {
    c.enemy.burn += amount;
    ev.push({ t: 'burn', amount, burn: c.enemy.burn });
  }

  function playCard(run, uid) {
    const check = canPlay(run, uid);
    if (!check.ok) return [{ t: 'denied', reason: check.reason, uid }];
    const c = run.combat;
    const idx = c.hand.findIndex((x) => x.uid === uid);
    const card = c.hand.splice(idx, 1)[0];
    const d = cardDef(card), v = cardVals(card);
    const ev = evList(run);

    syncHp(run, ev);                                     // por si los PV cambiaron fuera del motor
    c.bannerHits = 0;
    const x = isX(card) ? c.player.energy : 0;          // Coste X: toda la energía
    const paid = isX(card) ? x : costIn(card, c);
    c.player.energy -= paid;
    c.player.playedThisTurn = (c.player.playedThisTurn || 0) + 1;   // Combo
    run.stats.cardsPlayed++;
    const pc = run.stats.playedById = run.stats.playedById || {};   // carta más jugada (pantalla final)
    pc[card.id] = (pc[card.id] || 0) + 1;
    ev.push({ t: 'play', uid, id: card.id, name: cardName(card), type: d.type, x: isX(card) ? x : undefined, combo: c.player.playedThisTurn });
    ev.push({ t: 'energy', energy: c.player.energy });
    log(c, ev, _m('e.youPlay', { c: RC(card), x: isX(card) ? ` (X = ${x})` : '' }));
    delete card.held; delete card.keptTurn; delete card.discountTurn;   // sale de la mano

    // Eco Ardiente pendiente: esta carta se jugará dos veces (un Eco no se duplica a sí mismo)
    let echoed = !!c.echo && card.id !== 'eco';
    if (echoed) c.echo = false;
    // Diapasón de Eco: la primera carta de coste 0 de cada turno se juega 2 veces
    if (!echoed && !isX(card) && paid === 0 && hasRelic(run, 'eco') && c.ecoTurn !== c.turn) { c.ecoTurn = c.turn; echoed = true; ev.push({ t: 'relicFx', id: 'eco' }); }
    if (d.type === 'attack') { c.attacksPlayed = (c.attacksPlayed || 0) + 1; c.attackTurn = c.turn; }   // Metrónomo · Vela de Vigilia
    if (d.type === 'power') { c.powersPlayed = (c.powersPlayed || 0) + 1; contractTick(run, 'power', { n: c.powersPlayed }); }
    // Reflejo: si el enemigo tiene cargas, se apunta el daño de este Ataque (Eco incluido)
    // (grupos: cada enemigo con Reflejo devuelve solo lo que le has hecho a él)
    const reflecting = d.type === 'attack' && c.enemies.some((x) => alive(x) && (x.reflect || 0) > 0);
    if (reflecting) c.reflectTally = { dmg: 0, per: {} };
    if (c.comboTurn !== c.turn) { c.comboTurn = c.turn; c.comboN = 0; }   // combo más largo (cartas en un mismo turno)
    c.comboN++; run.stats.maxCombo = Math.max(run.stats.maxCombo || 0, c.comboN);
    c.playingCard = card; c.cardGaveBlock = false;   // Piedra de Afilado, Prisma Helado y Aura Arcana miran la carta en juego
    // Objetivo (Parche 3.2): 'one' el marcado · 'all' todos (área) · 'random' uno vivo al azar
    const tgt = d.aim || 'one', nAlive = c.enemies.filter(alive).length;
    if (tgt === 'random' && nAlive > 1 && !d.each) { const al = c.enemies.map((e, i) => i).filter((i) => alive(c.enemies[i])); c.target = pick(run, al); ev.push({ t: 'target', target: c.target }); }
    const area = tgt === 'all' && nAlive > 1;
    const resolve = () => {
      const ctx = { card, x, playing: true };
      c.attacking = d.type === 'attack';   // para el afijo «espinoso»
      for (const [op, arg] of d.fx) {
        if (c.over) break;
        if (area && PER_ENEMY_OPS.has(op)) {
          ctx.chainQ = op === 'zap' ? [] : undefined;   // Rayos de área: los saltos, después de todos los golpes
          eachAlive(c, () => OPS[op](run, v, ev, arg, ctx));
          for (const q of ctx.chainQ || []) { if (c.over) break; boltJumps(run, q.src, q.base, q.chain, ev, q.all); }
          ctx.chainQ = undefined;
          continue;
        }
        if (area) c.spread = true;
        try { OPS[op](run, v, ev, arg, ctx); } finally { delete c.spread; }
      }
      if (v.temper) card.temperBonus = (card.temperBonus || 0) + v.temper;   // Templar: por copia, este combate
    };
    resolve();
    if (echoed && !c.over) { ev.push({ t: 'echo', uid, id: card.id }); log(c, ev, _m('e.eco_ardiente_0_se_repite', { 0: RC(card) })); resolve(); }
    c.attacking = false;
    c.playingCard = null;
    // Devorador de Hechizos: cada carta a partir de la N-ésima del turno le da +1 Fuerza (el Eco no cuenta como otra carta)
    const dv = (D.ENEMIES[c.enemy.id] || {}).devour;
    if (dv && !c.over && c.player.playedThisTurn >= dv[c.enemy.phase >= 2 ? 1 : 0]) {
      c.enemy.str += 1;
      ev.push({ t: 'status', who: 'enemy', key: 'str', value: c.enemy.str }); ev.push({ t: 'passive', id: 'devour', n: 1 });
      log(c, ev, _m('e.devour', { e: RE(c.enemy) }));
    }
    // Aura Arcana: las cartas que dan Bloqueo dan +N más
    if (!c.over && c.cardGaveBlock && c.player.powers.aura) gainBlock(c, c.player.powers.aura, ev, 'aura');
    c.cardGaveBlock = false;
    // Estandarte del Alba: cada vez que la carta te ha dado Bloqueo, el enemigo recibe daño
    for (let k = 0; k < (c.bannerHits || 0) && !c.over; k++) { ev.push({ t: 'relicFx', id: 'estandarte' }); hitEnemy(run, D.RELICS.estandarte.v || 3, ev, { relic: 'estandarte' }); }
    c.bannerHits = 0;
    if (reflecting) {
      const tally = c.reflectTally;
      c.reflectTally = null;
      for (let i = 0; i < c.enemies.length && !c.over; i++) {
        const x = c.enemies[i];
        if (!alive(x) || !((x.reflect || 0) > 0) || (c.enemies.length > 1 && !(i in tally.per))) continue;   // con uno: como siempre
        const back = Math.floor((c.enemies.length > 1 ? tally.per[i] : tally.dmg) * REFLECT_FRAC);
        withEnemy(c, i, () => {
          x.reflect--;
          ev.push({ t: 'reflect', amount: back, charges: x.reflect });
          log(c, ev, _m('e.reflectBack', { d: back, n: x.reflect }));
          if (back > 0) selfDamage(run, back, ev, _t('e.reflejo'));   // (si te mata, la carta igual va al descarte)
        });
      }
    }
    // Fuelle de Herrero: las cartas de coste 0 (ya con mejora) dan +1 Temperatura
    if (!c.over && !isX(card) && v.cost === 0 && hasRelic(run, 'fuelle')) setTemp(c, c.player.temp + 1, ev);
    if (!c.over && d.type === 'attack' && c.player.powers.fenix) applyBurn(run, c.player.powers.fenix, ev);
    // Corazón Ardiente (Piromago): la primera carta de Ataque del combate aplica Quemadura
    if (!c.over && d.type === 'attack' && !c.ardienteUsed && hasRelic(run, 'corazon_ardiente')) {
      c.ardienteUsed = true;
      log(c, ev, _m('e.corazon_ardiente_el_primer_golpe'));
      applyBurn(run, D.RELICS.corazon_ardiente.v || 3, ev);
    }

    // Destino de la carta jugada
    const exh = d.exhaust && !v.noExhaust;   // Gran Grabado+: ya no Agota
    if (d.type === 'power' || exh) { c.exhaust.push(card); ev.push({ t: 'exhaust', uid }); }
    else { c.discard.push(card); ev.push({ t: 'discard', uid }); }
    // Agotar: Mecha Inagotable y Corazón del Fénix (los poderes no cuentan)
    if (!c.over && exh && d.type !== 'power') onExhaust(run, card, ev);
    // Bucle Infinito: la 4.ª carta del turno devuelve Energía · Velocidad de la Luz: las de coste 0 roban
    if (!c.over && c.player.powers.bucle && c.player.playedThisTurn === 4) { c.player.energy += c.player.powers.bucle; ev.push({ t: 'energy', energy: c.player.energy }); ev.push({ t: 'powerFx', key: 'bucle' }); }
    if (!c.over && c.player.powers.velocidad && !isX(card) && paid === 0) drawCards(run, c.player.powers.velocidad, ev);
    if (!c.over && c.player.powers.superc && !isX(card) && paid === 0) gainStatic(run, c.player.powers.superc, ev);   // Superconductor
    if (!c.over && c.player.powers.galvan && d.type === 'attack') gainStatic(run, c.player.powers.galvan, ev);        // Galvanizar
    // Abanico Ígneo: cada 3.ª carta del turno roba 1
    if (!c.over && hasRelic(run, 'abanico') && c.player.playedThisTurn % 3 === 0) drawCards(run, 1, ev);
    // Vial de Maná Efervescente: la 5.ª carta del turno da +1 Energía
    if (!c.over && hasRelic(run, 'efervescente') && c.player.playedThisTurn === 5) { c.player.energy += 1; ev.push({ t: 'energy', energy: c.player.energy }); log(c, ev, _m('e.vial_de_mana_efervescente_1')); }
    return ev;
  }

  /** Un movimiento del enemigo (su ciclo avanza 1). Devuelve true si el combate termina. */
  function enemyAct(run, ev) {
    const c = run.combat, p = c.player, e = c.enemy;
    // Carga Arcana en curso: sigue cargando o descarga el golpe
    if (e.charging) {
      const ch = e.charging;
      if (ch.left > 0) {
        ch.left--;
        ev.push({ t: 'enemyMove', name: _t('e.chargingDots', { m: chargeName(ch) }) }); ev.push({ t: 'charge', left: ch.left });
        log(c, ev, ch.left ? _m('e.stillCharging', { e: RE(e), n: ch.left }) : _m('e.chargeReady', { e: RE(e) }));
        return false;
      }
      e.charging = null;
      c.lastMove = { e: e.id, mv: ch.mv || null };
      ev.push({ t: 'enemyMove', name: chargeName(ch), unleash: true });
      log(c, ev, _m('e.unleash', { e: RE(e), m: ch.mv || chargeName(ch) }));
      enemyStrike(run, enemyHit(e, ch.hit), ev);
      if (!c.over && p.thorns > 0 && !e.stunned) applyBurn(run, p.thorns, ev);
      return !!c.over;
    }
    const m = currentMove(e), mref = moveRef(e);
    c.lastMove = { e: e.id, mv: mref };
    ev.push({ t: 'enemyMove', name: m.name });
    log(c, ev, _m('e.uses', { e: RE(e), m: mref }));
    if (m.dmg) {
      for (let i = 0; i < (m.hits || 1) && !c.over && !e.stunned && alive(e); i++) {   // aturdido (Amuleto del Fénix): el resto de golpes se pierde
        enemyStrike(run, enemyHit(e, m.dmg), ev);   // a la criatura más antigua si hay (Invocadora)
        if (!c.over && p.thorns > 0) applyBurn(run, p.thorns, ev);
      }
      if (c.over) return true;
      if (hasAffix(e, 'toxico')) { p.weak += D.AFFIXES.toxico.v.weak; ev.push({ t: 'affix', id: 'toxico' }); ev.push({ t: 'status', who: 'player', key: 'weak', value: p.weak }); }   // afijo «tóxico»
      if (c.mirror && c.mirror.turn === c.turn) applyFrost(run, c.mirror.frost, ev);   // Espejo de Hielo
      if (c.judgMirror && c.judgMirror.turn === c.turn) { applyJudgment(run, c.judgMirror.n, ev); log(c, ev, _m('e.judgMirror', { e: RE(e), n: c.judgMirror.n })); }   // Escudo Reflejo
      if (c.iceCounter === c.turn && (p.ice || 0) > 1) {   // Contraataque Gélido: la mitad del Escudo de Hielo que queda
        const n = Math.floor(p.ice / 2), was = c.attacking; c.attacking = false; c.iceCounter = 0;
        log(c, ev, _m('e.iceCounter', { e: RE(e), n }));
        hitEnemy(run, n, ev, { power: 'iceCounter' });
        c.attacking = was;
        if (c.over) return true;
      }
    }
    if (m.block && !e.noBlock) { e.block += m.block; ev.push({ t: 'blockEnemy', amount: m.block, block: e.block }); }
    // Matriarca: Brote (como mucho HEAL_MAX por combate, aunque esté a tope: así ningún combate es infinito)
    if (m.heal && (e.heals || 0) < HEAL_MAX && (e.heals = (e.heals || 0) + 1) && e.hp < e.maxHp) {
      const h = Math.min(m.heal, e.maxHp - e.hp); e.hp += h;
      ev.push({ t: 'enemyHeal', amount: h, hp: e.hp, why: 'heal' });
      log(c, ev, _m('e.0_se_regenera_1', { 0: RE(e), 1: h }));
    }
    if (m.str) { e.str += m.str; ev.push({ t: 'status', who: 'enemy', key: 'str', value: e.str }); }
    if (m.weak) { p.weak += m.weak; ev.push({ t: 'status', who: 'player', key: 'weak', value: p.weak }); }
    if (m.chill) chillPlayer(run, m.chill, ev);
    if (m.curse) { addCombatCurses(run, m.curse, 'discard', ev); log(c, ev, _m('e.0_te_maldice_1_escalofrio', { 0: RE(e), 1: m.curse })); }
    if (m.douse && e.burn > 0) {
      e.burn = Math.floor(e.burn / 2);
      ev.push({ t: 'burnSet', burn: e.burn }); ev.push({ t: 'douse', burn: e.burn });
      log(c, ev, _m('e.0_apaga_parte_de_su', { 0: RE(e) }));
    }
    // ---- Acto III ----
    if (m.drain && !prismaBlocks(run, ev, _m('e.drain'))) {
      c.drainNext = (c.drainNext || 0) + m.drain; c.mindHit = true;
      ev.push({ t: 'drain', amount: m.drain });
      log(c, ev, _m('e.0_drena_tu_mana_1', { 0: RE(e), 1: m.drain }));
    }
    if (m.silence && !prismaBlocks(run, ev, _m('e.silence'))) {
      c.silenceNext = (c.silenceNext || 0) + m.silence; c.mindHit = true;
      ev.push({ t: 'silenceNext', amount: m.silence });
      log(c, ev, _m('e.0_te_silencia_1_carta', { 0: RE(e), 1: m.silence }));
    }
    if (m.reflect) {
      e.reflect = (e.reflect || 0) + m.reflect;
      ev.push({ t: 'reflectGain', amount: m.reflect, charges: e.reflect });
      log(c, ev, _m('e.mirrors', { e: RE(e), n: e.reflect }));
    }
    if (m.inkCurse) { addCombatCurses(run, m.inkCurse, 'discard', ev, 'garabato'); log(c, ev, _m('e.0_te_mancha_de_tinta', { 0: RE(e), 1: m.inkCurse })); }
    if (m.charge) {
      e.charging = { left: m.charge - 1, hit: m.chargeHit, mv: mref };
      e.turnDmg = 0;
      ev.push({ t: 'charge', left: e.charging.left, start: true });
      log(c, ev, _m('e.startCharge', { e: RE(e), m: mref }));
    }
    e.moveIdx++;
    return false;
  }
  /** Prisma Arcano: la primera vez en cada combate que te Drenarían o Silenciarían, se anula. */
  function prismaBlocks(run, ev, what) {
    const c = run.combat;
    if (!hasRelic(run, 'prisma') || c.prismaUsed) return false;
    c.prismaUsed = true;
    log(c, ev, _m('e.el_prisma_arcano_anula_el', { 0: what }));
    ev.push({ t: 'prisma', what });
    return true;
  }

  function endTurn(run) {
    const c = run.combat;
    if (!c || c.over || c.phase !== 'player' || c.choice) return [];
    const ev = evList(run);
    const p = c.player, e = c.enemy;
    c.phase = 'enemy';

    // 1) Fin del turno del jugador
    const fusing = c.fusion && c.fusion.turn === c.turn;   // Punto de Fusión: sin Sobrecalentamiento y la Temperatura se va
    if (!c.noTemp && p.temp >= overheatAt(run) && !p.powers.sol && c.noOverheat !== c.turn && !fusing) {   // Sol Interior / Esencia Ígnea lo anulan
      const heat = (hasRelic(run, 'termometro') ? 1 : OVERHEAT_DMG) - (p.powers.volcan ? 1 : 0);   // Termómetro / Volcán
      if (heat > 0) {
        log(c, ev, _m('e.sobrecalentamiento_pierdes_0_pv', { 0: heat }));
        selfDamage(run, heat, ev, _t('e.sobrecalentamiento'));
        if (c.over) return ev;
      }
    }
    if (fusing && p.temp > 0) { setTemp(c, 0, ev); log(c, ev, _m('e.fusionEnd')); }
    // Electromante: Bobina de Tesla y, con 10 de Estática, Sobrecarga
    if (p.powers.bobina) gainStatic(run, p.powers.bobina, ev);
    if ((p.static || 0) >= STATIC_MAX) { overload(run, ev); if (c.over) return ev; }
    if (p.temp === 0 && hasRelic(run, 'piedra')) setTemp(c, 1, ev);      // Piedra de Calor
    // Escama de Dragón: bloqueo antes del ataque enemigo (dura hasta el inicio de tu próximo turno)
    if (p.temp >= 3 && hasRelic(run, 'escama')) gainBlock(c, 4, ev);
    if (hasRelic(run, 'bateria') && p.energy === 0) c.batteryNext = true;                                   // Batería Agotada
    if (hasRelic(run, 'vela') && c.attackTurn !== c.turn) gainBlock(c, D.RELICS.vela.v || 6, ev, 'relic');  // Vela de Vigilia
    if (hasRelic(run, 'glifo') && c.runes && c.runes.length >= runeSlots(c)) gainBlock(c, D.RELICS.glifo.v || 5, ev, 'relic');   // Glifo Protector
    if (p.weak > 0) { p.weak--; ev.push({ t: 'status', who: 'player', key: 'weak', value: p.weak }); }
    // Ciclo Eterno: las runas que detonaron este turno se vuelven a Grabar (las que detonen ahora, el turno que viene)
    if (c.cicloQueue && c.cicloQueue.length && p.powers.cicloe) {
      const q = c.cicloQueue.slice(0, 8); c.cicloQueue = [];
      log(c, ev, _m('e.cicloe', { n: q.length }));
      for (const id of q) { if (c.over) return ev; engrave(run, id, ev); }
      if (c.over) return ev;
    }
    // Runas: cada una activa su pasivo, de izquierda a derecha (Maestría: dos veces)
    if (c.runes && c.runes.length) { activatePassives(run, ev); if (c.over) return ev; }
    c.runeChill = 0;   // el entumecimiento del frío dura hasta estos pasivos
    // Logro «Ejército del Bosque»: turnos seguidos terminados con 3 criaturas
    c.fullTurns = (c.summons || []).length >= D.MAX_SUMMONS ? (c.fullTurns || 0) + 1 : 0;
    c.maxFullTurns = Math.max(c.maxFullTurns || 0, c.fullTurns);
    // Criaturas: cada una actúa, de izquierda a derecha
    if (c.summons && c.summons.length) { summonsAct(run, ev, 1, 'end'); if (c.over) return ev; }
    if (p.powers.saviae && (c.summons || []).length) healSummons(run, p.powers.saviae, ev);   // Savia Eterna
    // Etérea: si sigue en la mano, se Agota (cuenta como Agotar)
    for (const card of c.hand.filter((x) => cardDef(x).ethereal || x.eth)) {
      c.hand = c.hand.filter((x) => x !== card);
      c.exhaust.push(card);
      ev.push({ t: 'ethereal', uid: card.uid });
      onExhaust(run, card, ev);
      if (c.over) return ev;
    }
    // Conservar: esas cartas se quedan en la mano (y cuentan un turno más para Llama Paciente)
    const keepAll = c.retainAll === c.turn;   // Planificar (las Etéreas ya se han Agotado arriba: Etérea gana)
    const kept = c.hand.filter((x) => keepAll || cardDef(x).retain), gone = c.hand.filter((x) => !keepAll && !cardDef(x).retain);
    kept.forEach((x) => { x.held = (x.held || 0) + 1; x.keptTurn = c.turn; });
    if (gone.length) {
      ev.push({ t: 'discardHand', uids: gone.map((x) => x.uid), kept: kept.map((x) => x.uid) });
      c.discard.push(...gone);
    }
    c.hand = kept;
    c.echo = false;
    ev.push({ t: 'turn', who: 'enemy' });

    // 2-3) Cada enemigo vivo, de izquierda a derecha: su Quemadura y su acción (combat.enemy apunta al que actúa)
    let thornsOff = false;
    for (const x of c.enemies.slice()) {   // los vivos al empezar el turno (un invocado no actúa el turno en que llega)
      const i = c.enemies.indexOf(x);
      if (i < 0 || !alive(x)) continue;
      const r = withEnemy(c, i, (e) => enemyPhase(run, e, ev));
      if (c.over) return ev;
      if (r) thornsOff = true;
    }
    retarget(c);
    if (thornsOff && p.thorns) { p.thorns = 0; ev.push({ t: 'status', who: 'player', key: 'thorns', value: 0 }); }

    // 4) Nuevo turno del jugador
    startPlayerTurn(run, ev);
    return ev;
  }

  /** Turno de UN enemigo (combat.enemy === e): Incendio, tic de Quemadura, Congelado/aturdido y su acción, y sus
   *  estados de fin de turno. Devuelve true si llegó a actuar (o se descongeló): entonces se quitan las Espinas. */
  function enemyPhase(run, e, ev) {
    const c = run.combat, p = c.player;
    // Incendio Controlado: con 10+ Quemadura, el enemigo la sufre una vez más (sin que baje)
    for (let k = 0; k < Math.min(3, p.powers.incendio || 0) && e.burn >= INCENDIO_AT && !c.over; k++) {
      const dmg = e.burn;
      e.hp = Math.max(0, e.hp - dmg); e.turnDmg = (e.turnDmg || 0) + dmg;
      run.stats.damageDealt += dmg; run.stats.maxBurnTick = Math.max(run.stats.maxBurnTick || 0, dmg);
      ev.push({ t: 'burnTick', amount: dmg, hp: e.hp, burn: e.burn, extra: true });
      log(c, ev, _m('e.incendio', { e: RE(e), n: dmg }));
      afterEnemyDamage(run, ev);
      if (c.over || !alive(e)) return false;
    }
    // 2) La Quemadura del enemigo hace efecto e ignora su bloqueo
    if (e.burn > 0) {
      const dmg = e.burn;
      e.hp = Math.max(0, e.hp - dmg);
      e.turnDmg = (e.turnDmg || 0) + dmg;
      if (!p.powers.eterna) e.burn--;                       // Ascuas Eternas: la Quemadura no baja
      run.stats.damageDealt += dmg;
      run.stats.maxBurnTick = Math.max(run.stats.maxBurnTick || 0, dmg);
      ev.push({ t: 'burnTick', amount: dmg, hp: e.hp, burn: e.burn });
      log(c, ev, _m('e.0_sufre_1_de_quemadura', { 0: RE(e), 1: dmg }));
      afterEnemyDamage(run, ev);
      if (c.over || !alive(e)) return false;
    }

    // 3) El enemigo actúa (su bloqueo anterior expira primero). Congelado: pierde el turno entero
    e.block = 0;
    if (e.stunned) {   // Amuleto del Fénix: pierde su siguiente acción
      e.stunned = false;
      log(c, ev, _m('e.0_esta_aturdido_y_pierde', { 0: RE(e) }));
      ev.push({ t: 'stunEnd' });
      return false;
    }
    if (e.frozen && e.coffin) {   // Ataúd de Hielo: sigue Congelado un turno más
      e.coffin = 0;
      log(c, ev, _m('e.coffin', { e: RE(e) }));
      ev.push({ t: 'coffin' });
      return false;
    }
    if (e.frozen) {
      e.frozen = false;
      e.actedOnce = true;   // si era «veloz», su turno doble se pierde con el hielo
      log(c, ev, _m('e.0_se_libera_del_hielo', { 0: RE(e) }));
      ev.push({ t: 'thaw' });
      return true;
    }
    // Afijo «veloz»: en su primer turno actúa dos veces
    const acts = hasAffix(e, 'veloz') && !e.actedOnce ? 2 : 1;
    for (let k = 0; k < acts; k++) {
      if (k) { log(c, ev, _m('e.0_es_veloz_actua_otra', { 0: RE(e) })); ev.push({ t: 'affix', id: 'veloz' }); }
      if (enemyAct(run, ev)) return false;
      if (!alive(e)) return true;
      if (e.stunned) { e.stunned = false; log(c, ev, _m('e.0_queda_aturdido_su_accion', { 0: RE(e) })); ev.push({ t: 'stunEnd' }); break; }
    }
    e.actedOnce = true;
    // Lobo Alfa: gana Fuerza al final de cada uno de sus turnos
    const grow = (D.ENEMIES[e.id] || {}).grow;
    if (grow) { e.str += grow; ev.push({ t: 'status', who: 'enemy', key: 'str', value: e.str }); ev.push({ t: 'passive', id: 'grow', n: grow }); log(c, ev, _m('e.grow', { e: RE(e), n: grow })); }
    // Afijos al final de su turno: «blindado» gana 4 de Bloqueo; «regenerador» se cura 4
    if (hasAffix(e, 'blindado')) { const n = D.AFFIXES.blindado.v.turn; e.block += n; ev.push({ t: 'blockEnemy', amount: n, block: e.block }); }
    if (hasAffix(e, 'regenerador') && e.hp < e.maxHp) { const h = Math.min(D.AFFIXES.regenerador.v.heal, e.maxHp - e.hp); e.hp += h; ev.push({ t: 'enemyHeal', amount: h, hp: e.hp, why: 'regenerador' }); log(c, ev, _m('e.0_se_regenera_1', { 0: RE(e), 1: h })); }
    // Escarcha: baja 1 al final de su turno (Invierno Eterno: no baja)
    if (e.frost > 0 && !p.powers.invierno && !e.frozen) { e.frost--; ev.push({ t: 'frostSet', frost: e.frost }); }
    if (e.judg > 0) { e.judg--; ev.push({ t: 'judgSet', judg: e.judg }); }   // Juicio: baja 1 al final de su turno
    if (e.magnet > 0) { e.magnet--; ev.push({ t: 'magnetSet', magnet: e.magnet }); }   // Magnetizado: baja 1 al final de su turno

    return true;
  }

  function winCombat(run, ev) {
    const c = run.combat;
    if (c.over) return;
    c.over = 'win';
    c.turnKills = (c.turnKills || 0) + 1; c.maxTurnKills = Math.max(c.maxTurnKills || 0, c.turnKills);
    run.stats.maxTemp = Math.max(run.stats.maxTemp || 0, c.peakTemp || 0);
    run.stats.kills++;
    if (c.groupFight) run.stats.groupWins = (run.stats.groupWins || 0) + 1;   // desbloqueo del Electromante (meta.groupWins)
    if (hasRelic(run, 'leyden')) run.leyden = Math.min(D.RELICS.leyden.v || 5, c.player.static || 0);   // Botella de Leyden
    trail(run, c.kind === 'boss' ? 'K' : c.kind === 'elite' ? 'E' : ((c.minHp !== undefined && c.minHp < run.maxHp * 0.5) ? 'Y' : 'G'));
    ev.push({ t: 'enemyDead' });
    log(c, ev, _m('e.0_cae_derrotado', { 0: RE(c.enemy) }));
    if (hasRelic(run, 'urna')) {
      const h = heal(run, 5);
      if (h) ev.push({ t: 'heal', amount: h, hp: run.hp });
    }
    if (hasRelic(run, 'cuenco') && (c.summons || []).length) { const h = heal(run, D.RELICS.cuenco.v || 4); if (h) ev.push({ t: 'heal', amount: h, hp: run.hp }); }   // Cuenco de Ofrendas
    const noDmg = (run.stats.combatDamageTaken || 0) === 0;
    winStats(run, c, noDmg);
    if (hasRelic(run, 'diezmo') && noDmg) gainGold(run, D.RELICS.diezmo.v || 15);   // Bolsa de Diezmos
    // Contratos
    contractTick(run, 'win', { dmg: run.stats.combatDamageTaken || 0, group: !!c.groupFight, turns: c.turn, summons: (c.summons || []).length });
    if (c.kind === 'elite') contractTick(run, 'eliteWin');
    if (c.kind === 'boss') contractTick(run, 'bossWin', { turns: c.turn });
    if (c.kind === 'boss') {
      if (c.loot) { gainGold(run, c.loot); log(c, ev, _m('e.botin_0_de_oro', { 0: c.loot })); }
      // Jefe de cada acto vencido (con cualquiera de sus jefes posibles). Los nombres de los campos son los de
      // siempre por compatibilidad: guardianDown = jefe del Acto I, wyrmDown = Acto II, eyeDown = Acto III.
      const bossE = c.enemies.find((x) => (D.ENEMIES[x.id] || {}).tier === 'boss') || c.enemy;
      const ba = bossAct(bossE.id);
      if (ba === 1) run.stats.guardianDown = true;
      if (ba === 2) run.stats.wyrmDown = true;
      if (ba === 3) { run.stats.eyeDown = true; if (!c.mindHit) run.stats.eyeClean = true; }
      run.stats.bossDown = [...new Set((run.stats.bossDown || []).concat(bossE.id))];
      if (actOf(run) < D.LAST_ACT) {
        // No es el final: elección de reliquia de jefe y, después, el acto siguiente
        run.pending = { kind: 'bossRelic', options: bossRelicOptions(run), taken: false };
        const leg = rollLegendary(run);   // jefe: 2% de carta legendaria (aparte de la reliquia)
        if (leg) { run.pending.legendary = leg; run.pending.legendaryTaken = false; }
        ev.push({ t: 'win', boss: true, act: actOf(run) });
        return;
      }
      run.over = { result: 'win' };
      roomDone(run);
      ev.push({ t: 'win', boss: true, final: true });
      return;
    }
    let gold = c.kind === 'elite' ? randInt(run, 30, 40) : randInt(run, 14, 24);
    const nAff = Math.max(...c.enemies.map((x) => (x.affixes || []).length));   // grupos: el afijo lo lleva el líder
    if (nAff) gold += nAff >= 2 ? 25 : 15;   // élite con afijo(s)
    if (c.loot) gold += c.loot;               // Botín
    if (asc(run, 5)) gold = Math.floor(gold * 0.75);                   // A5
    if (upg(run, 'fortuna')) gold = Math.round(gold * (1 + 0.1 * upg(run, 'fortuna')));   // Mano de Midas
    if (c.golden) gold *= 2;                                            // Élite Dorada: oro doble
    gainGold(run, gold);
    run.pending = {
      kind: 'reward',
      gold,
      cards: rollCards(run, rewardCount(run) + (c.kind === 'elite' && hasRelic(run, 'tomo') ? 1 : 0), c.kind === 'elite' ? ODDS_ELITE : ODDS_NORMAL, c.kind === 'elite'),   // Tomo Sellado · élite: 2% legendaria
      relic: c.kind === 'elite' ? randomRelic(run) : null,
      potion: c.golden ? null : rollPotionDrop(run),
      cardTaken: false, relicTaken: false, potionTaken: false,
      elite: c.kind === 'elite'
    };
    if (c.golden) {   // Élite Dorada: una segunda reliquia; te quedas con una de las dos
      const p = run.pending, pool = Object.keys(D.RELICS).filter((id) => id !== p.relic && !hasRelic(run, id) && !D.RELICS[id].starter && D.RELICS[id].class === 'any' && relicInAct(run, id) && !isLocked(run, id));
      p.relicAlt = pool.length ? pick(run, pool) : null;
      p.golden = true;
    }
    ev.push({ t: 'win', boss: false });
  }

  /** Contadores de misiones y momentos al ganar un combate. */
  function winStats(run, c, noDmg) {
    const s = run.stats;
    s.combatsWon = (s.combatsWon || 0) + 1;   // Parche 3.7: lore («gana 10 combates») y jefes derrotados (con qué personaje)
    loreStats(run, c, true);
    if (c.kind === 'elite') s.eliteKills = (s.eliteKills || 0) + 1;
    if (c.kind === 'boss') s.bossKills = (s.bossKills || 0) + 1;
    if (c.golden) s.goldKills = (s.goldKills || 0) + 1;
    if (c.groupFight && noDmg) s.groupNoDmg = (s.groupNoDmg || 0) + 1;
    if (run.hp > 0 && run.hp <= 5) s.hpLow = (s.hpLow || 0) + 1;
    if (run.hp > 0 && (s.minHp === null || s.minHp === undefined || run.hp < s.minHp)) s.minHp = run.hp;
    flushBlockFx(run, c);
  }
  /** Lore: jefes (y el Archimago Caído) derrotados en la partida y hasta qué jefe de acto se ha llegado. */
  function loreStats(run, c, won) {
    const s = run.stats;
    for (const e of c.enemies) {
      const d = D.ENEMIES[e.id] || {};
      if (d.tier === 'boss' && c.kind === 'boss') s.bossReached = Math.max(s.bossReached || 0, bossAct(e.id) || actOf(run));
      if (won && (d.tier === 'boss' || e.id === 'archimago') && !(s.bossIds || []).includes(e.id)) s.bossIds = (s.bossIds || []).concat(e.id);
    }
  }
  /** Bloqueo por carta del combate → run.stats.cardFx (carta MVP). */
  function flushBlockFx(run, c) {
    if (!c.fxBlock) return;
    const f = run.stats.cardFx = run.stats.cardFx || {};
    for (const [id, n] of Object.entries(c.fxBlock)) { const x = f[id] = f[id] || { dmg: 0, block: 0 }; x.block += n; }
    c.fxBlock = null;
  }
  function loseCombat(run, ev) {
    const c = run.combat;
    if (c.over) return;
    // Ascensión Celestial (Paladín): una vez por combate, te quedas a 1 PV e Inmaterial el resto del turno enemigo
    if (c.player.powers.ascension && !c.ascUsed) {
      c.ascUsed = true;
      run.hp = 1; c.player.immaterial = 'turn';
      log(c, ev, _m('e.ascension'));
      ev.push({ t: 'revive', hp: run.hp, power: 'ascension' }); ev.push({ t: 'status', who: 'player', key: 'immaterial', value: 1 });
      syncHp(run, ev);
      return;
    }
    // Pluma de Fénix: un solo uso por partida; el flag vive en run para sobrevivir al guardado
    if (hasRelic(run, 'pluma') && !run.phoenixUsed) {
      run.phoenixUsed = true;
      run.hp = Math.max(1, Math.round(run.maxHp * 0.25));
      log(c, ev, _m('e.renaces_de_tus_cenizas'));
      ev.push({ t: 'revive', hp: run.hp });
      syncHp(run, ev);
      return;
    }
    // Amuleto del Fénix: una vez por partida, cura el 20% de la vida máxima y el enemigo pierde su siguiente acción
    if (hasRelic(run, 'amuletofenix') && !run.amuletoFenixUsed) {
      run.amuletoFenixUsed = true;
      run.hp = Math.max(1, Math.round(run.maxHp * (D.RELICS.amuletofenix.v || 0.2)));
      c.enemy.stunned = true;
      log(c, ev, _m('e.el_amuleto_del_fenix_te'));
      ev.push({ t: 'revive', hp: run.hp, relic: 'amuletofenix' }); ev.push({ t: 'intent' });
      syncHp(run, ev);
      return;
    }
    // Lágrima de Fénix: se bebe sola (después de la Pluma) y renaces con el 30% de tu vida máxima
    const tear = (run.potions || []).indexOf('fenixp');
    if (tear >= 0) {
      run.potions[tear] = null;
      run.stats.potionsUsed = (run.stats.potionsUsed || 0) + 1;
      run.hp = Math.max(1, Math.round(run.maxHp * D.POTIONS.fenixp.v));
      log(c, ev, _m('e.la_lagrima_de_fenix_te'));
      ev.push({ t: 'revive', hp: run.hp, potion: 'fenixp', slot: tear });
      syncHp(run, ev);
      return;
    }
    c.over = 'lose';
    trail(run, 'X');
    run.stats.maxTemp = Math.max(run.stats.maxTemp || 0, c.peakTemp || 0);
    run.over = { result: 'lose', killerId: (c.lastMove && c.lastMove.e) || c.enemy.id };   // id (nunca el nombre: el idioma puede cambiar)
    if (c.lastMove && c.lastMove.mv) run.over.killerMove = c.lastMove.mv;   // «Lo que te mató» (referencia del movimiento)
    loreStats(run, c, false);
    flushBlockFx(run, c);
    roomDone(run, { dead: true });
    ev.push({ t: 'lose' });
  }

  /** La UI llama a esto al salir de la pantalla de combate. */
  function closeCombat(run) { if (run.combat && run.combat.over) run.combat = null; }

  /* ------------------------------------------------------------------ *
   * Recompensas, tienda, hoguera, cofre, eventos
   * ------------------------------------------------------------------ */
  function takeRewardCard(run, id) {
    const p = run.pending;
    if (!p || p.kind !== 'reward' || p.cardTaken || !p.cards.includes(id)) return false;
    if (!addCard(run, id)) return false;   // Mazo pequeño: mazo lleno
    p.cardTaken = true;
    return true;
  }
  /** Reliquia del botín. alt: la segunda de la Élite Dorada (te quedas con una de las dos). */
  function takeRewardRelic(run, alt) {
    const p = run.pending;
    if (!p || p.kind !== 'reward' || p.relicTaken) return false;
    const id = alt ? p.relicAlt : p.relic;
    if (!id) return false;
    addRelic(run, id);
    p.relicTaken = true; p.relicPicked = id;
    return true;
  }
  function leaveScreen(run) { if (run.pending) roomDone(run); run.pending = null; }

  /* ------------------------------------------------------------------ *
   * Pociones
   * ------------------------------------------------------------------ */
  const POTION_CHANCE_START = 0.35, POTION_CHANCE_STEP = 0.10, POTION_CHANCE_MIN = 0.10, POTION_CHANCE_MAX = 0.90;
  /** Poción al azar (rareza 65/25/10 salvo que se fije una). Siempre con run.rng. */
  function randomPotion(run, rarity) {
    const r = rarity || weighted(run, D.POTION_ODDS);
    return pick(run, Object.keys(D.POTIONS).filter((id) => D.POTIONS[id].rarity === r && itemForChar(D.POTIONS[id], charOf(run)) && !isLocked(run, id)));
  }
  /** Botín tras un combate normal o de élite: probabilidad que sube 0.10 si no sale y baja 0.10 si sale. */
  function rollPotionDrop(run) {
    if (hasPact(run, 'pociones')) return null;   // Pacto: Sin pociones
    const chance = typeof run.potionChance === 'number' ? run.potionChance : POTION_CHANCE_START;
    const hit = rand(run) < chance;
    run.potionChance = Math.max(POTION_CHANCE_MIN, Math.min(POTION_CHANCE_MAX, chance + (hit ? -POTION_CHANCE_STEP : POTION_CHANCE_STEP)));
    return hit ? randomPotion(run) : null;
  }
  const freeSlot = (run) => (run.potions || []).indexOf(null);
  /** Mete una poción en el primer hueco libre (o en `replace`, tirando la que hubiera). false si no cabe. */
  function addPotion(run, id, replace) {
    if (!D.POTIONS[id]) return false;
    run.potions = run.potions || [null, null, null];
    let slot = freeSlot(run);
    if (slot < 0 && Number.isInteger(replace) && replace >= 0 && replace < run.potions.length) slot = replace;
    if (slot < 0) return false;
    run.potions[slot] = id;
    return true;
  }
  /** ¿Se puede usar la poción de ese hueco ahora? { ok, reason } (como canPlay). */
  function canUsePotion(run, slot) {
    const id = run.potions && run.potions[slot], d = id && D.POTIONS[id];
    if (!d) return { ok: false, reason: _t('e.ese_hueco_esta_vacio') };
    if (run.over) return { ok: false, reason: _t('e.la_partida_ha_terminado') };
    const c = run.combat;
    if (c && (c.over || c.phase !== 'player')) return { ok: false, reason: _t('e.solo_en_tu_turno') };
    if (c && c.choice) return { ok: false, reason: _t('e.elige_una_runa_primero') };
    if (d.target === 'combat' && !c) return { ok: false, reason: _t('e.solo_se_puede_usar_en') };
    if ((d.fx === 'heal' || d.fx === 'healFlat') && run.hp >= run.maxHp) return { ok: false, reason: _t('e.ya_tienes_la_vida_al') };
    return { ok: true };
  }
  /** Bebe la poción del hueco `slot`. Devuelve eventos (como playCard). */
  function usePotion(run, slot) {
    const check = canUsePotion(run, slot);
    if (!check.ok) return [{ t: 'denied', reason: check.reason }];
    const id = run.potions[slot], d = D.POTIONS[id], c = run.combat, ev = evList(run);
    run.potions[slot] = null;
    run.stats.potionsUsed = (run.stats.potionsUsed || 0) + 1;
    if (c) c.potionsUsed = (c.potionsUsed || 0) + 1;
    ev.push({ t: 'potion', id, slot });
    if (c) log(c, ev, _m('e.bebes_0', { 0: R('potion', id) }));
    if (c && hasRelic(run, 'corcho')) gainBlock(c, D.RELICS.corcho.v || 4, ev, 'relic');   // Corcho Encantado
    switch (d.fx) {
      case 'damage': hitEnemy(run, d.v, ev); break;
      case 'damageAll': c.spread = true; try { hitEnemy(run, d.v, ev); } finally { delete c.spread; } break;   // Frasco Explosivo
      case 'block': gainBlock(c, d.v, ev); break;
      case 'burn': applyBurn(run, d.v, ev); break;
      case 'energy': c.player.energy += d.v; ev.push({ t: 'energy', energy: c.player.energy }); break;
      case 'draw': drawCards(run, d.v, ev); break;
      case 'vent': OPS.vent(run, { per: d.v }, ev); break;
      case 'double': if (c.enemy.burn > 0) applyBurnRaw(c, c.enemy.burn, ev); break;
      case 'heal': { const h = heal(run, Math.round(run.maxHp * d.v)); if (h) ev.push({ t: 'heal', amount: h, hp: run.hp }); break; }
      case 'ignite': c.noOverheat = c.turn; setTemp(c, c.player.temp + d.v, ev); break;
      case 'chaos': {
        // 3 cartas al azar (nunca maldiciones) que cuestan 0 este turno; solo existen en este combate
        for (let i = 0; i < d.v && c.hand.length < MAX_HAND; i++) {
          const r = weighted(run, [['common', 60], ['uncommon', 30], ['rare', 10]]);
          const cid = randomCard(run, r);
          if (!cid || isCurse({ id: cid })) continue;
          const card = { uid: run.uidNext++, id: cid, up: false, temp: true, freeTurn: c.turn };
          c.tempCards++;
          c.hand.push(card);
          ev.push({ t: 'draw', uid: card.uid });
        }
        break;
      }
      case 'frost': applyFrost(run, d.v, ev); break;
      case 'ice': gainIce(c, d.v, ev); break;
      case 'runes': for (let i = 0; i < d.v && !c.over; i++) engrave(run, pick(run, ['fuego', 'piedra', 'viento', 'sangre']), ev); break;
      case 'runePower': c.runePower = (c.runePower || 0) + d.v; ev.push({ t: 'status', who: 'player', key: 'potencia', value: runePow(c) }); break;
      case 'summons': summon(run, 'lobezno', ev); summon(run, 'hada', ev); break;
      case 'healSummons': healSummons(run, d.v, ev); break;
      case 'freeHand': for (const x of c.hand) if (!isX(x)) x.freeTurn = c.turn; ev.push({ t: 'freeHand' }); break;   // Elixir de Maná Puro
      case 'healFlat': { const h = heal(run, d.v); if (h) ev.push({ t: 'heal', amount: h, hp: run.hp }); break; }   // Agua Bendita
      case 'judge': applyJudgment(run, d.v, ev); break;
      case 'electrolyte': gainStatic(run, d.v, ev); drawCards(run, 2, ev); break;                                   // Electrolito                                                            // Aceite de Unción
      case 'fury': c.furyTurn = c.turn; ev.push({ t: 'status', who: 'player', key: 'fury', value: 1 }); break;
    }
    if (c && !c.over && hasRelic(run, 'vapores')) setTemp(c, c.player.temp + 2, ev);   // Vapores Ardientes
    return ev;
  }
  /** Tira la poción de un hueco. */
  function discardPotion(run, slot) {
    if (!run.potions || !run.potions[slot]) return false;
    run.potions[slot] = null;
    return true;
  }
  /** Recompensa: coge la poción (en un hueco libre o sustituyendo `replace`). */
  function takeRewardPotion(run, replace) {
    const p = run.pending;
    if (!p || p.kind !== 'reward' || !p.potion || p.potionTaken) return false;
    if (!addPotion(run, p.potion, replace)) return false;
    p.potionTaken = true;
    return true;
  }
  function buyPotion(run, i) {
    if (run.pending && run.pending.stock && run.pending.stock.potions[i] && !run.pending.stock.potions[i].sold && run.gold >= run.pending.stock.potions[i].price) run.stats.shopped = true;
    const s = run.pending && run.pending.stock, item = s && s.potions && s.potions[i];
    if (!item || item.sold || run.gold < item.price || freeSlot(run) < 0) return false;
    gainGold(run, -item.price); item.sold = true; addPotion(run, item.id);
    afterBuy(run);
    return true;
  }

  /** 3 reliquias de jefe distintas (que no tengas ya), del pool BOSS_RELICS. */
  function bossRelicOptions(run) {
    const pool = Object.keys(D.BOSS_RELICS).filter((id) => !hasRelic(run, id) && itemForChar(D.BOSS_RELICS[id], charOf(run)));
    return shuffle(run, pool).slice(0, 3);
  }
  /**
   * Elige una reliquia de jefe (o null para saltar). Después: vida al máximo,
   * acto siguiente, mapa nuevo. Devuelve false si no hay elección pendiente o el id no se ofrecía.
   */
  function takeBossRelic(run, id) {
    const p = run.pending;
    if (!p || p.kind !== 'bossRelic' || p.taken) return false;
    if (id !== null && id !== undefined) {
      if (!p.options.includes(id)) return false;
      addRelic(run, id);
    }
    p.taken = true;
    roomDone(run);   // el jefe del acto (antes de curar toda la vida)
    advanceAct(run);
    contractPayout(run);   // Contrato cumplido: su pantalla, antes del mapa del acto nuevo
    return true;
  }
  /** Jefe: añade al mazo la carta legendaria ofrecida (si la hay). */
  function takeBossLegendary(run) {
    const p = run.pending;
    if (!p || p.kind !== 'bossRelic' || !p.legendary || p.legendaryTaken || p.taken || deckFull(run)) return false;
    addCard(run, p.legendary); p.legendaryTaken = true;
    return true;
  }
  function advanceAct(run) {
    run.act = actOf(run) + 1;
    run.rerolls = upg(run, 'sabiduria');   // Ojo del Sabio: relanzamientos de este acto
    // Curación (después de la reliquia: Brasa del Guardián incluida): Acto II toda; Acto III el 75% de lo que falta
    const frac = (D.ACT_HEAL && D.ACT_HEAL[run.act] !== undefined) ? D.ACT_HEAL[run.act] : 1;
    run.hp = Math.min(run.maxHp, run.hp + Math.ceil((run.maxHp - run.hp) * frac));
    run.map = genMap(run);
    run.pos = null;
    run.pending = null;
    run.lastEnemy = null; run.lastEnc = null; run.lastElite = null;   // variedad: «el anterior» es por acto
  }

  function genShop(run) {
    const price = { common: [45, 55], uncommon: [70, 82], rare: [140, 160] };
    const greed = hasRelic(run, 'avaricioso') ? 1 : 0;   // Anillo del Avaricioso: 1 carta y 1 reliquia más
    const cards = rollCards(run, 5 + greed, ODDS_SHOP).map((id) => {
      const r = D.CARDS[id].rarity;
      return { id, price: randInt(run, price[r][0], price[r][1]), sold: false };
    });
    const relics = [];
    for (let i = 0; i < 2 + greed; i++) {
      const pool = Object.keys(D.RELICS).filter((r) => !hasRelic(run, r) && !D.RELICS[r].starter && !relics.some((x) => x.id === r) && itemForChar(D.RELICS[r], charOf(run)) && relicInAct(run, r) && !isLocked(run, r));
      if (pool.length) relics.push({ id: pick(run, pool), price: randInt(run, 135, 160), sold: false });
    }
    const potPrice = { common: [50, 60], uncommon: [70, 80], rare: [95, 110] };
    const potions = [];
    for (let i = 0; i < 3; i++) {   // 3 pociones distintas (reintenta un par de veces si repite)
      let id = randomPotion(run);
      for (let k = 0; k < 4 && potions.some((x) => x.id === id); k++) id = randomPotion(run);
      const r = D.POTIONS[id].rarity;
      potions.push({ id, price: randInt(run, potPrice[r][0], potPrice[r][1]), sold: false });
    }
    if (hasRelic(run, 'usurero')) {   // Sello del Usurero: +50 % en todo (también la purga)
      const up = (x) => { x.price = Math.round(x.price * 1.5); };
      cards.forEach(up); relics.forEach(up); potions.forEach(up);
    }
    const purge = Math.round((hasRelic(run, 'moneda') ? 60 : 75) * (hasRelic(run, 'usurero') ? 1.5 : 1));
    if (hasRelic(run, 'moneda')) {   // Moneda Trucada: −20% en todo
      const cut = (x) => { x.price = Math.round(x.price * 0.8); };
      cards.forEach(cut); relics.forEach(cut); potions.forEach(cut);
      return { cards, relics, potions, removePrice: freePurge(run) ? 0 : purge, removed: false };
    }
    return { cards, relics, potions, removePrice: freePurge(run) ? 0 : purge, removed: false };
  }
  /** Mercader Ambulante: 1 carta (poco común o rara), 1 reliquia y 1 poción con un 30 % de descuento; solo se compra una. */
  function genPeddler(run) {
    const full = genShop(run);
    const card = rollCards(run, 1, [['uncommon', 70], ['rare', 30]])[0];
    const cut = (x) => Object.assign(x, { price: Math.max(1, Math.round(x.price * 0.7)) });
    const r = card ? D.CARDS[card].rarity : 'uncommon';
    const cardPrice = Math.round(({ common: 50, uncommon: 76, rare: 150 }[r] || 76) * (hasRelic(run, 'usurero') ? 1.5 : 1) * (hasRelic(run, 'moneda') ? 0.8 : 1));
    return { cards: card ? [cut({ id: card, price: cardPrice, sold: false })] : [], relics: full.relics.slice(0, 1).map(cut), potions: full.potions.slice(0, 1).map(cut),
      removePrice: null, removed: true, oneOnly: true };
  }
  /** Tras una compra: el Mercader Ambulante cierra el puesto (todo lo demás, vendido) y el contrato «Bolsa Cerrada» lo apunta. */
  function afterBuy(run) {
    const s = run.pending && run.pending.stock;
    contractTick(run, 'buy');
    if (s && s.oneOnly) [...s.cards, ...s.relics, ...s.potions].forEach((x) => { x.sold = true; });
  }
  function buyCard(run, i) {
    const s = run.pending && run.pending.stock, item = s && s.cards[i];
    if (!item || item.sold || run.gold < item.price || deckFull(run)) return false;   // Mazo pequeño: no se puede comprar con el mazo lleno
    gainGold(run, -item.price); item.sold = true; addCard(run, item.id); run.stats.shopped = true;
    afterBuy(run);
    return true;
  }
  function buyRelic(run, i) {
    const s = run.pending && run.pending.stock, item = s && s.relics[i];
    if (!item || item.sold || run.gold < item.price || hasPact(run, 'bolsillos')) return false;   // Pacto: Bolsillos rotos
    gainGold(run, -item.price); item.sold = true; addRelic(run, item.id); run.stats.shopped = true;
    afterBuy(run);
    return true;
  }
  function removeCard(run, uid) {
    const i = run.deck.findIndex((c) => c.uid === uid);
    if (i < 0) return false;
    run.deck.splice(i, 1);
    run.stats.removed = (run.stats.removed || 0) + 1;   // «Ahorro Extremo»: no quitar cartas
    return true;
  }
  function shopRemove(run, uid) {
    const s = run.pending && run.pending.stock;
    if (!s || s.removed || s.removePrice === null || run.gold < s.removePrice) return false;
    if (!removeCard(run, uid)) return false;
    gainGold(run, -s.removePrice); s.removed = true;
    contractTick(run, 'buy');
    if (s.removePrice === 0 && upg(run, 'purga')) run.purgeUsed = true;   // Purificación: solo la primera
    return true;
  }

  /** Purificación: la primera purga de la partida en una tienda es gratis. */
  const freePurge = (run) => upg(run, 'purga') > 0 && !run.purgeUsed;
  const restHealAmount = (run) => (hasRelic(run, 'nucleo') || hasRelic(run, 'insomne') || hasPact(run, 'descanso') ? 0   // Núcleo Solar / Pacto Sin descanso: no se cura
    : upg(run, 'hoguera') ? Math.round(run.maxHp * ((asc(run, 4) ? 25 : 30) + D.UPGRADES.hoguera.per * upg(run, 'hoguera')) / 100)   // Fuego del Hogar
    : Math.round(run.maxHp * (asc(run, 4) ? 0.25 : 0.3)));                                 // A4 (misma cuenta de siempre)
  function restHeal(run) {
    const p = run.pending;
    if (!p || p.kind !== 'rest' || p.done || restHealAmount(run) === 0) return 0;
    p.done = true;
    contractTick(run, 'restHeal');
    return heal(run, restHealAmount(run));
  }
  function restUpgrade(run, uid) {
    const p = run.pending;
    const card = run.deck.find((c) => c.uid === uid);
    if (!p || p.kind !== 'rest' || p.done || !card || !canUpgrade(card) || hasRelic(run, 'insomne')) return false;   // Ojo del Insomne: tampoco mejora
    card.up = true; p.done = true;
    return true;
  }

  function takeChest(run) {
    const p = run.pending;
    if (!p || p.kind !== 'chest' || p.taken) return false;
    if (p.relic) addRelic(run, p.relic); else gainGold(run, p.gold);
    p.taken = true;
    return true;
  }

  function eventApi(run) {
    return {
      heal: (n) => heal(run, n),
      loseHp: (n) => loseHpSafe(run, n),
      gold: (n) => gainGold(run, n),
      maxHp: (n) => { run.maxHp += n; run.hp += n; },
      addCard: (id) => addCard(run, id),
      randomCard: (r) => randomCard(run, r),
      cardLabel: (id) => R('card', id),                       // nombres: referencias (se traducen al pintar)
      cardRef: (id, up) => R('card', id, up ? { up: true } : null),
      upList: (ids) => R('cards', null, { list: ids.map((id) => ({ id, up: true })) }),
      addRelic: (id) => addRelic(run, id),
      randomRelic: () => randomRelic(run),
      relicLabel: (id) => R('relic', id),
      /** Una reliquia de jefe al azar (del personaje y que no tengas), o null. */
      randomBossRelic: () => { const pool = Object.keys(D.BOSS_RELICS).filter((id) => !hasRelic(run, id) && itemForChar(D.BOSS_RELICS[id], charOf(run))); return pool.length ? pick(run, pool) : null; },
      randomPotion: (rarity) => randomPotion(run, rarity),
      addPotion: (id) => addPotion(run, id),
      potionLabel: (id) => R('potion', id),
      chance: (p) => rand(run) < p,
      /** Pierde PV máximos (mínimo 1) y ajusta la vida actual. */
      loseMaxHp: (n) => { run.maxHp = Math.max(1, run.maxHp - n); run.hp = Math.min(run.hp, run.maxHp); },
      /** Elimina todas las maldiciones del mazo; devuelve cuántas. */
      removeCurses: () => { const before = run.deck.length; run.deck = run.deck.filter((c) => !isCurse(c)); return before - run.deck.length; },
      /** Mejora una carta mejorable al azar; devuelve su id o null si no queda ninguna. */
      upgradeRandom: () => {
        const pool = run.deck.filter(canUpgrade);
        if (!pool.length) return null;
        const card = pick(run, pool);
        card.up = true;
        return card.id;
      },
      /** Quita una carta al azar del mazo (nunca una maldición); devuelve su id o null. */
      removeRandomCard: () => {
        const pool = run.deck.filter((c) => !isCurse(c));
        if (!pool.length) return null;
        const card = pick(run, pool);
        run.deck.splice(run.deck.indexOf(card), 1);
        return card.id;
      },
      /** n cartas distintas de una rareza (del personaje y del acto) para elegir una. */
      offerCards: (rarity, n) => rollCards(run, n, [[rarity, 1]]),
      /** La Grieta: los siguientes nodos disponibles son los de la fila anterior al jefe. */
      warpToBossRow: () => { run.warp = Object.values(run.map.nodes).filter((n) => n.row === ROWS - 1).map((n) => n.id); },
      /** Escalofríos (solo de combate) en la mano al empezar el próximo combate. */
      nextCombatCurses: (n) => { run.nextCurses = (run.nextCurses || 0) + n; },
      /** Cadenas de eventos (Parche 3.5): consecuencias que vuelven en otro acto. */
      setFlag: (k, v) => { run.flags = run.flags || {}; run.flags[k] = v; },
      /** Una maldición al azar (Escalofrío o Garabato). */
      randomCurse: () => pick(run, Object.keys(D.CARDS).filter((id) => D.CARDS[id].type === 'curse')),
      /** Quita tu primera poción; devuelve su id o null. */
      dropPotion: () => { const i = (run.potions || []).findIndex(Boolean); if (i < 0) return null; const id = run.potions[i]; run.potions[i] = null; return id; },
      /** Pierdes una reliquia al azar (nunca la inicial ni una de jefe); devuelve su id o null. */
      loseRandomRelic: () => { const pool = run.relics.filter((id) => D.RELICS[id] && !D.RELICS[id].starter); if (!pool.length) return null; const id = pick(run, pool); run.relics.splice(run.relics.indexOf(id), 1); return id; },
      canTransform: () => run.deck.some((c) => transformable(c)),
      canFuse: () => run.deck.some((c) => fusePartner(run, c)),
      /** Modificadores del jefe (hp, str): se acumulan en run y se aplican en su combate. */
      bossMod: (key, n) => {
        run.bossMods = run.bossMods || { hp: 0, str: 0 };
        run.bossMods[key] = (run.bossMods[key] || 0) + n;
      }
    };
  }
  /** Estado de una opción de evento: show (se ve: opciones de clase, reliquia, oro o PV) y ok (se puede elegir). */
  function eventChoiceState(run, i) {
    const p = run.pending, ev = p && D.EVENTS[p.id], ch = ev && ev.choices[i];
    if (!ch) return { show: false, ok: false };
    const api = eventApi(run);
    const show = !ch.show || !!ch.show(run, api);
    return { show, ok: show && (!ch.cond || !!ch.cond(run, api)) };
  }
  function eventChoose(run, i) {
    const p = run.pending;
    if (!p || p.kind !== 'event' || p.result) return null;
    const choice = D.EVENTS[p.id].choices[i];
    if (!choice || !eventChoiceState(run, i).ok) return null;
    p.result = choice.run(run, eventApi(run));
    return p.result;
  }
  /** Forja: ¿se puede transformar esta carta? (no maldiciones, especiales ni legendarias) */
  function transformable(c) {
    const d = D.CARDS[c.id];
    return !!d && ['starter', 'common', 'uncommon', 'rare'].includes(d.rarity) && d.type !== 'curse';
  }
  /** Forja: otra copia de la misma carta para fusionarla (las dos sin «++» y la carta, mejorable). */
  function fusePartner(run, c) {
    const d = D.CARDS[c.id];
    if (!d || !d.up || c.up2 || d.type === 'curse') return null;
    return run.deck.find((x) => x !== c && x.id === c.id && !x.up2) || null;
  }
  /**
   * Elecciones de carta de los eventos (p.result.pick): 'remove' (purgar), 'duplicate' (copiar una
   * del mazo) o 'choose' (quedarte una de p.result.options). count: cuántas (por defecto 1).
   */
  function eventPickable(run) {
    const p = run.pending, r = p && p.kind === 'event' && p.result;
    if (!r || !r.pick || r.picked) return [];
    if (r.pick === 'choose') return (r.options || []).slice();
    if (r.pick === 'duplicate') return run.deck.filter((c) => !isCurse(c)).map((c) => c.uid);
    if (r.pick === 'upgrade') return run.deck.filter(canUpgrade).map((c) => c.uid);
    if (r.pick === 'transform') return run.deck.filter(transformable).map((c) => c.uid);
    if (r.pick === 'fuse') return run.deck.filter((c) => fusePartner(run, c)).map((c) => c.uid);
    return run.deck.map((c) => c.uid);
  }
  /** Aplica una elección: uid de una carta del mazo, o id de carta para 'choose'. */
  function eventPick(run, v) {
    const p = run.pending, r = p && p.kind === 'event' && p.result;
    if (!r || !r.pick || r.picked || !eventPickable(run).includes(v)) return false;
    if (r.pick === 'remove') removeCard(run, v);
    else if (r.pick === 'duplicate') { const c = run.deck.find((x) => x.uid === v); addCard(run, c.id, c.up); }
    else if (r.pick === 'choose') addCard(run, v);
    else if (r.pick === 'upgrade') { const c = run.deck.find((x) => x.uid === v); c.up = true; r.text = _m('rj.ev.herrero.done', { 0: RC(c) }); }
    else if (r.pick === 'transform') {   // Forja: otra carta de tu clase (o neutral, si lo era) de la misma rareza
      const c = run.deck.find((x) => x.uid === v), d = D.CARDS[c.id];
      const rar = d.rarity === 'starter' ? 'common' : d.rarity;
      const pool = cardsOfRarity(rar, actOf(run), charOf(run), d.class === 'neutral', run).filter((id) => id !== c.id && !D.CARDS[id].needsDead);
      const was = RC(c);
      if (pool.length) { c.id = pick(run, pool); c.up = false; delete c.up2; }
      r.text = _m('rj.forge.trDone', { 0: was, 1: RC(c) });
    } else if (r.pick === 'fuse') {      // Forja: 2 copias → 1 «++»
      const c = run.deck.find((x) => x.uid === v), other = fusePartner(run, c);
      run.deck.splice(run.deck.indexOf(other), 1);
      c.up = true; c.up2 = true;
      r.text = _m('rj.forge.fuseDone', { 0: RC(c) });
    }
    r.picks = (r.picks || 0) + 1;
    if (r.picks >= (r.count || 1)) r.picked = true;
    return true;
  }
  /** Compatibilidad: purgar una carta (Fuente Encantada). */
  function eventRemove(run, uid) {
    const p = run.pending;
    if (!p || p.kind !== 'event' || !p.result || p.result.pick !== 'remove') return false;
    return eventPick(run, uid);
  }

  /* ------------------------------------------------------------------ *
   * Persistencia y enrutado de pantallas
   * ------------------------------------------------------------------ */
  const serialize = (run) => JSON.stringify(run);
  function deserialize(str) {
    const run = JSON.parse(str);
    if (!run || run.version !== 1 || !run.map) throw new Error('Partida incompatible');
    run.ascension = clampAsc(run.ascension);   // partidas guardadas antes de la Ascensión → A0
    run.act = Math.max(1, Math.min(D.LAST_ACT, Math.floor(Number(run.act)) || 1));   // sin act → acto 1
    if (!D.CHARACTERS[run.char]) run.char = 'piromago';   // partidas anteriores a los personajes
    if (run.path && !(D.PATHS[run.path] && D.PATHS[run.path].char === run.char)) delete run.path;   // partidas anteriores a las sendas: sin senda
    // Pociones: partidas antiguas → 3 huecos vacíos (5 con el Cinturón); ids desconocidos → hueco vacío
    run.pacts = Array.isArray(run.pacts) ? run.pacts.filter((id) => D.PACTS[id]) : [];
    const rel = Array.isArray(run.relics) ? run.relics : [];
    const slots = hasPact(run, 'pociones') ? 0 : rel.includes('odre') ? 1 : 3 + (rel.includes('cinturon') ? 2 : 0);   // Odre Agrietado: 1
    const old = Array.isArray(run.potions) ? run.potions : [];
    run.potions = Array.from({ length: slots }, (_, i) => (old[i] && D.POTIONS[old[i]] ? old[i] : null));
    if (typeof run.potionChance !== 'number') run.potionChance = POTION_CHANCE_START;
    // Partidas guardadas antes de las recompensas de logro: ninguna desbloqueada (no aparecen)
    run.unlocked = Array.isArray(run.unlocked) ? [...new Set(run.unlocked)].filter((id) => D.REWARD_LOCK[id]) : [];
    if (run.stats && typeof run.stats.potionsUsed !== 'number') run.stats.potionsUsed = 0;
    if (run.combat) bindCombat(run.combat);   // combates en grupo: combat.enemy (partidas viejas) → enemies[0]
    // Parche 3.5: banderas de las cadenas y contrato (ids desconocidos fuera)
    if (!run.flags || typeof run.flags !== 'object') run.flags = {};
    if (run.contract && !D.CONTRACTS[run.contract.id]) run.contract = null;
    // Parche 3.6: semanal (lunes "YYYY-MM-DD"), cosméticos y Legado (ids conocidos)
    if (run.weekly !== undefined && !(typeof run.weekly === 'string' && DATE_RE.test(run.weekly) && run.custom)) delete run.weekly;
    if (run.look) run.look = cleanLook(run.look);
    if (run.legacy && !D.CARDS[run.legacy]) delete run.legacy;
    if (run.pending && run.pending.kind === 'contracts') run.pending.options = (run.pending.options || []).filter((id) => D.CONTRACTS[id]);
    // Personalizada: cfg normalizada (ids desconocidos fuera) y su código; sin ella, partida normal
    if (run.custom) { const code = run.custom.code; run.custom = Object.assign(normalizeCustom(run.custom), { code: typeof code === 'string' && decodeCustom(code) ? code : encodeCustom(run.custom) }); }
    return run;
  }

  /** Qué pantalla corresponde al estado actual de la partida. */
  function screenFor(run) {
    if (run.combat) return 'Combat';
    if (run.over) return 'End';
    if (run.pending) return ({ reward: 'Reward', shop: 'Shop', rest: 'Rest', chest: 'Chest', event: 'Event', bossRelic: 'BossRelic', startRelic: 'BossRelic', contracts: 'Contracts' })[run.pending.kind];
    return 'Map';
  }

  /** Números de las reglas (los textos del glosario los muestran desde aquí, nunca escritos a mano). */
  const RULES = Object.freeze({ overheatAt: OVERHEAT_AT, overheatDmg: OVERHEAT_DMG, chargeBreak: CHARGE_BREAK, reflectPct: Math.round(REFLECT_FRAC * 100),
    frostPct: Math.round((1 - FROST_MULT) * 100), weakPct: Math.round((1 - WEAK_MULT) * 100), iceMelt: ICE_MELT, freezeAt: FREEZE_AT, freezeAtBoss: FREEZE_AT_BOSS,
    maxSummons: D.MAX_SUMMONS, runeSlots: RUNE_SLOTS, energy: BASE_ENERGY, handSize: HAND_SIZE, healMax: HEAL_MAX, judgBlock: JUDG_BLOCK, incendioAt: INCENDIO_AT, golemStones: GOLEM_STONES,
    staticMax: STATIC_MAX, overloadDmg: OVERLOAD_DMG, overloadSolo: OVERLOAD_DMG * OVERLOAD_SOLO, magnetDmg: MAGNET_DMG });

  const Engine = {
    RULES,
    setTarget, intentFor, nextIntentFor, incomingDamage, bindCombat, isAlive: alive, cardTarget: (card) => (card && cardDef(card).aim) || 'one',
    essenceFor, takeStartRelic, rerollRewardCards, freePurge, upgradeLevel: upg,
    D, ROWS, LANES, HAND_SIZE, CHARGE_BREAK, REFLECT_FRAC, OVERHEAT_AT, OVERHEAT_DMG, FLOORS_PER_ACT, TOTAL_FLOORS, actOf, isCurse,
    takeBossRelic, overheatAt: (run) => overheatAt(run), bossOf, bossesOf, bossAct, allBosses,
    newRun, serialize, deserialize, screenFor,
    canUsePotion, usePotion, discardPotion, takeRewardPotion, buyPotion, addPotion, randomPotion, costIn, isX, comboOn,
    charOf, charDef, hasMech, dailyChar, freezeAt, cardForChar, itemForChar,
    dailySeed, todayStr, newDailyRun, dailyScore, dailyCode, dailyShareText, verifyDailyShare,
    newCustomRun, encodeCustom, decodeCustom, normalizeCustom, customDifficulty, customModAllowed, randomCustomSeed, customSeedText, hasCustom, deckFull,
    CUSTOM_DECK_MAX, CUSTOM_SEED_MAX,
    asc, clampAsc, hasPact, pactBonus, runScore,
    availableNodes, enterNode, windNodes, isLocked, legendaryPool, takeBossLegendary, cardsOfRarity,
    cardDef, cardVals, cardCost, cardName, cardText, canUpgrade, canPlay, attackBase, playerAttackDamage,
    playCard, endTurn, intentOf, closeCombat,
    takeRewardCard, takeRewardRelic, leaveScreen,
    buyCard, buyRelic, shopRemove,
    restHeal, restUpgrade, restHealAmount,
    takeChest, eventChoose, eventRemove, eventPick, eventPickable, eventChoiceState,
    takeContract, contractStatus, contractEssence, pickEvent, MYSTERY_ODDS, GOLD_ELITE_CHANCE,
    weekKey, weeklyCfg, newWeeklyRun, legacyOk, altDeckPool, basicOf, cleanLook,
    bondOf, summonAtk, summonHp, COMMON_SUMMONS, ACT3_RULES, ASC_PROPOSAL,
    hasRelic, hasAffix, previewPlay, chooseRune, nextIntentOf, rewardCount, runePow, runeSlots, runeVal, passTimes,
    fervorOf, syncHp, JUDG_BLOCK, STATIC_MAX, OVERLOAD_DMG, MAGNET_DMG, boltExtra,
    pathCounts, pathWeight, fitsDeck, PATH_PER, PATH_MAX, PATH_FIT,
    _rollCards: (run, n, odds) => rollCards(run, n, odds || ODDS_NORMAL),   // solo para tests
    _startCombat: startCombat // solo para tests
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.CM_ENGINE = Engine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
