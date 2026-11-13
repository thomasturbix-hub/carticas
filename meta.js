/* =====================================================================
 * Carticas Mágicas — meta.js
 * Progreso entre partidas: récords, historial y logros.
 * Lógica pura (sin DOM ni Phaser). El almacenamiento llega inyectado
 * (`store` con get/set, p. ej. CM_UI.Store), así se puede testear en Node.
 * ===================================================================== */
(function (root) {
  'use strict';

  const E = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.CM_ENGINE;
  const I18N = (typeof module !== 'undefined' && module.exports) ? require('./i18n.js') : root.CM_I18N;
  const _t = (k, v) => I18N.t(k, v);

  const KEY = 'cm_meta_v1';
  const HISTORY_MAX = 10;
  const DAILY_MAX = 30;                       // fechas de desafío diario que se conservan
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  /** Día anterior a "YYYY-MM-DD" (aritmética en UTC: sin sustos con el cambio de hora). */
  function prevDay(dateStr) {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const t = new Date(Date.UTC(y, mo - 1, d - 1));
    const p = (n) => String(n).padStart(2, '0');
    return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
  }
  /** ¿Es una fecha real? (descarta 2026-13-45 y similares) */
  function isDate(s) {
    if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
    const [y, mo, d] = s.split('-').map(Number);
    const t = new Date(Date.UTC(y, mo - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
  }

  /* ------------------------------------------------------------------ *
   * Logros. `when` indica cuándo se comprueba: al terminar un combate
   * ('combat') o al terminar la partida ('end'). `check(ctx)` recibe
   * { run, meta, combat } y devuelve true si se cumple la condición.
   * ------------------------------------------------------------------ */
  const st = (run, k) => (run.stats && run.stats[k]) || 0;
  const won = (run) => !!run.over && run.over.result === 'win';
  /** Jefes vencidos alguna vez, contando los de esta partida (ids en el orden de los actos). */
  const bossesBeatenWith = (meta, run) => E.allBosses().filter((id) => ((meta && meta.bossesBeaten) || []).includes(id) || ((run && run.stats && run.stats.bossDown) || []).includes(id));

  const ACHIEVEMENTS = [
    { id: 'primera', name: 'Primera llama', desc: 'Gana una partida.', when: 'end',
      check: ({ run }) => won(run) },
    { id: 'veterano', name: 'Piromago veterano', desc: 'Juega 10 partidas.', when: 'end',
      check: ({ meta }) => meta.played >= 10 },
    { id: 'incendio', name: 'Incendio forestal', desc: 'Inflige 30 o más de daño con un solo tic de Quemadura.', when: 'combat',
      check: ({ run }) => st(run, 'maxBurnTick') >= 30 },
    { id: 'gracia', name: 'Golpe de gracia', desc: 'Inflige 50 o más de daño de un solo golpe.', when: 'combat',
      check: ({ run }) => st(run, 'maxHit') >= 50 },
    { id: 'rojo', name: '¿Quién encendió la estufa?', desc: 'Llega a 10 de Temperatura.', when: 'combat', reward: { type: 'card', id: 'combustionesp' },
      check: ({ run, combat }) => Math.max(st(run, 'maxTemp'), (combat && combat.peakTemp) || 0) >= 10 },
    { id: 'intocable', name: 'Intocable', desc: 'Gana un combate de élite o de jefe sin recibir daño.', when: 'combat',
      check: ({ run, combat }) => !!combat && combat.over === 'win' && (combat.kind === 'elite' || combat.kind === 'boss') && st(run, 'combatDamageTaken') === 0 },
    { id: 'cenizas', name: 'De mis cenizas', desc: 'Activa la Pluma de Fénix.', when: 'combat',
      check: ({ run }) => !!run.phoenixUsed },
    { id: 'coleccionista', name: 'Coleccionista', desc: 'Termina una partida con 6 o más reliquias.', when: 'end',
      check: ({ run }) => (run.relics || []).length >= 6 },
    { id: 'afilado', name: 'Mazo afilado', desc: 'Gana una partida con 14 cartas o menos en el mazo.', when: 'end',
      check: ({ run }) => won(run) && (run.deck || []).length <= 14 },
    // Con dos actos, «derrotar al Guardián» ya no es ganar la partida: se mira stats.guardianDown
    { id: 'ofrenda', name: 'Ofrenda aceptada', desc: 'Derrota al Guardián después de dejarle una ofrenda en su estatua.', when: 'end',
      check: ({ run }) => !!(run.stats && (run.stats.bossDown || ['guardian']).includes('guardian') && run.stats.guardianDown) && !!run.bossMods && run.bossMods.hp < 0 },
    { id: 'profanador', name: 'Profanador', desc: 'Derrota al Guardián después de saquear su estatua.', when: 'end',
      check: ({ run }) => !!(run.stats && (run.stats.bossDown || ['guardian']).includes('guardian') && run.stats.guardianDown) && !!run.bossMods && run.bossMods.str > 0 },
    { id: 'racha', name: 'Racha ardiente', desc: 'Gana 3 partidas seguidas.', when: 'end',
      check: ({ meta }) => meta.streak >= 3 },
    { id: 'destino', name: 'Cita con el destino', desc: 'Completa un desafío diario.', when: 'end',
      check: ({ run }) => !!run.daily && !!run.over },
    { id: 'cumbre', name: 'Cumbre ardiente', desc: 'Gana una partida en Ascensión 8.', when: 'end',
      check: ({ run }) => (run.ascension || 0) >= 8 && !!run.over && run.over.result === 'win' },
    // Acto II
    { id: 'cima', name: 'Cima helada', desc: 'Derrota al jefe del Acto II.', when: 'end',
      check: ({ run }) => !!(run.stats && run.stats.wyrmDown) },
    { id: 'termico', name: 'Choque térmico', desc: 'Gana un combate del Acto II con 10 o más de Temperatura.', when: 'combat',
      check: ({ run, combat }) => !!combat && combat.over === 'win' && (run.act || 1) >= 2 && combat.player.temp >= 10 },
    { id: 'purista', name: 'Llama pura', desc: 'Gana una partida sin ninguna Maldición en el mazo.', when: 'end',
      check: ({ run }) => won(run) && !(run.deck || []).some((c) => c.id === 'escalofrio') },
    // Pociones ('combat' se comprueba tras cada combate y también al final de la partida)
    { id: 'alquimista', name: 'Alquimista', desc: 'Usa 10 pociones en una partida.', when: 'combat',
      check: ({ run }) => ((run.stats && run.stats.potionsUsed) || 0) >= 10 },
    { id: 'erudito', name: 'Erudito de las llamas', desc: 'Descubre todas las entradas del Compendio.', when: 'end',
      check: ({ meta }) => { const p = codexProgress(meta); return p.total > 0 && p.seen === p.total; } },
    { id: 'sobrio', name: 'Mano firme', desc: 'Gana una partida sin usar ninguna poción.', when: 'end',
      check: ({ run }) => won(run) && !((run.stats && run.stats.potionsUsed) || 0) },
    // Afijos de élite
    { id: 'domador', name: 'Domador', desc: 'Derrota a una élite con 2 afijos sin usar pociones.', when: 'combat',
      check: ({ combat }) => !!combat && combat.over === 'win' && combat.kind === 'elite' && ((combat.enemy && combat.enemy.affixes) || []).length >= 2 && !combat.potionsUsed },
    // Acto III
    { id: 'ojo', name: 'Cerrar el Ojo', desc: 'Derrota al jefe del Acto III.', when: 'end',
      check: ({ run }) => !!(run.stats && run.stats.eyeDown) },
    { id: 'mente', name: 'Ilesa la mente', desc: 'Derrota al jefe del Acto III sin que te Drenen ni te Silencien en ese combate.', when: 'end',
      check: ({ run }) => !!(run.stats && run.stats.eyeClean) },
    // Pactos
    { id: 'pactista', name: 'Pactista', desc: 'Gana una partida con 4 o más pactos activos.', when: 'end',
      check: ({ run }) => won(run) && (run.pacts || []).length >= 4 },
    // Parche 2.7: logros con recompensa (la recompensa no sale en ninguna partida hasta conseguirlos; ver D.REWARD_LOCK)
    { id: 'ceroabsoluto', name: 'Cero absoluto', desc: 'Congela a una élite o a un jefe con el Criomante.', when: 'combat', reward: { type: 'relic', id: 'prismahelado' },
      check: ({ run, combat }) => run.char === 'criomante' && !!combat && (combat.kind === 'elite' || combat.kind === 'boss') && (combat.froze || 0) > 0 },
    { id: 'ejercito', name: 'Ejército del bosque', desc: 'Con la Invocadora, termina 3 turnos seguidos con 3 criaturas a la vez.', when: 'combat', reward: { type: 'card', id: 'sinfonia' },
      check: ({ run, combat }) => run.char === 'invocadora' && !!combat && (combat.maxFullTurns || 0) >= 3 },
    { id: 'muralla', name: 'Muralla viva', desc: 'Con la Guardiana, gana 50 de Bloqueo en total en un solo combate.', when: 'combat', reward: { type: 'relic', id: 'escudoeter' },
      check: ({ run, combat }) => run.char === 'guardiana' && !!combat && (combat.blockGained || 0) >= 50 },
    { id: 'calcinada', name: 'Tierra calcinada', desc: 'Derrota al jefe del Acto I.', when: 'combat', reward: { type: 'potion', id: 'manapuro' },
      check: ({ run }) => !!(run.stats && run.stats.guardianDown) },
    { id: 'creyente', name: 'El último creyente', desc: 'Gana un combate de élite con menos del 10 % de tus PV máximos.', when: 'combat', reward: { type: 'relic', id: 'amuletofenix' },
      check: ({ run, combat }) => !!combat && combat.over === 'win' && combat.kind === 'elite' && run.hp > 0 && run.hp < run.maxHp * 0.1 },
    { id: 'ahorro', name: 'Ahorro extremo', desc: 'Gana una partida sin comprar nada en la tienda ni quitar cartas del mazo.', when: 'end', reward: { type: 'relic', id: 'bolsaabundancia' },
      check: ({ run }) => won(run) && !(run.stats && (run.stats.shopped || run.stats.removed)) },
    { id: 'dominio', name: 'Dominio elemental', desc: 'Gana una partida con cada personaje.', when: 'end', reward: { type: 'card', id: 'auraarcana' },
      check: ({ meta }) => CHARS.length > 0 && CHARS.every((ch) => ((meta.charStats && meta.charStats[ch] && meta.charStats[ch].wins) || 0) > 0) },
    { id: 'devastador', name: 'Golpe devastador', desc: 'Inflige 100 o más de daño de un solo golpe.', when: 'combat', reward: { type: 'card', id: 'cataclismo' },
      check: ({ run }) => st(run, 'maxHit') >= 100 },
    // Parche 2.9: jefes alternativos
    { id: 'cazador', name: 'Cazador de jefes', desc: 'Derrota a los 9 jefes (en una o varias partidas).', when: 'end',
      check: ({ meta, run }) => bossesBeatenWith(meta, run).length >= E.allBosses().length },
    // Parche 3.2: combates en grupo
    { id: 'masacre', name: 'Masacre', desc: 'Mata a 3 enemigos en el mismo turno.', when: 'combat',
      check: ({ combat }) => !!combat && (combat.maxTurnKills || 0) >= 3 },
    // Parche 3.0: Paladín
    { id: 'fe', name: 'Fe inquebrantable', desc: 'Con el Paladín, derrota a un jefe con menos del 10 % de tus PV máximos.', when: 'combat',
      check: ({ run, combat }) => run.char === 'paladin' && !!combat && combat.over === 'win' && combat.kind === 'boss' && run.hp > 0 && run.hp < run.maxHp * 0.1 },
    // Parche 3.3: Electromante
    { id: 'tormentaperf', name: 'Tormenta perfecta', desc: 'Mata a 3 enemigos con una sola Sobrecarga.', when: 'combat',
      check: ({ combat }) => !!combat && (combat.maxOverloadKills || 0) >= 3 }
  ];
  const BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
  // Nombres y descripciones de los logros: el español vive aquí; los demás idiomas, en i18n_data_<lang>.js (ACH.<id>.name/desc)
  I18N.registerData('ACH', BY_ID);
  /** Id de un enemigo a partir de su nombre en cualquier idioma (historiales antiguos guardaban el nombre). */
  function enemyIdByName(name) {
    if (!name || !E || !E.D) return null;
    for (const id of Object.keys(E.D.ENEMIES)) {
      if (I18N.es(`ENEMIES.${id}.name`) === name || E.D.ENEMIES[id].name === name) return id;
      for (const l of I18N.LANGS) if ((I18N.DATA_TEXT[l] || {})[`ENEMIES.${id}.name`] === name) return id;
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Recompensas de logro: meta.unlocked = ids desbloqueados para siempre (cartas, reliquias, pociones).
   * Se deducen también de los logros conseguidos (metas antiguas que ya tenían «Al rojo vivo»).
   * ------------------------------------------------------------------ */
  const REWARD_OF = Object.fromEntries(ACHIEVEMENTS.filter((a) => a.reward).map((a) => [a.reward.id, a]));
  /** Logro que desbloquea un id (o null si no está bloqueado). */
  const lockedBy = (id) => REWARD_OF[id] || null;
  /** Ids desbloqueados de un meta (los guardados + los de sus logros), en orden fijo. */
  function unlockedIds(meta) {
    const have = new Set((meta && Array.isArray(meta.unlocked) ? meta.unlocked : []).filter((id) => REWARD_OF[id]));
    for (const a of ACHIEVEMENTS) if (a.reward && meta && meta.achievements && meta.achievements[a.id]) have.add(a.reward.id);
    return Object.keys(REWARD_OF).filter((id) => have.has(id));
  }
  const isUnlocked = (meta, id) => !REWARD_OF[id] || unlockedIds(meta).includes(id);
  /** Nombre visible de una recompensa. */
  function rewardName(r) {
    const D0 = E && E.D;
    if (!r || !D0) return '';
    const it = r.type === 'card' ? D0.CARDS[r.id] : r.type === 'relic' ? D0.ALL_RELICS[r.id] : D0.POTIONS[r.id];
    return it ? it.name : r.id;
  }

  /* ------------------------------------------------------------------ *
   * Esencia Arcana y Santuario (mejoras permanentes; datos en data.js → UPGRADES)
   * ------------------------------------------------------------------ */
  const UPG = (E && E.D && E.D.UPGRADES) || {};
  /** Saldo de Esencia (nunca negativo). */
  const essenceBalance = (meta) => Math.max(0, ((meta && meta.essence && meta.essence.earned) || 0) - ((meta && meta.essence && meta.essence.spent) || 0));
  const upgradeLevel = (meta, id) => (meta && meta.upgrades && meta.upgrades[id]) || 0;
  /** Precio del siguiente nivel (null si ya está al máximo o no existe). */
  const nextUpgradeCost = (meta, id) => (UPG[id] && upgradeLevel(meta, id) < UPG[id].cost.length ? UPG[id].cost[upgradeLevel(meta, id)] : null);
  /** Lo que cuestan unos niveles dados, en total. */
  const upgradesCost = (levels) => Object.entries(levels || {}).reduce((a, [id, n]) => a + (UPG[id] ? UPG[id].cost.slice(0, n).reduce((x, y) => x + y, 0) : 0), 0);
  /** Precio de comprarlo todo desde cero. */
  const allUpgradesCost = () => upgradesCost(Object.fromEntries(Object.entries(UPG).map(([id, u]) => [id, u.cost.length])));
  /** ¿Te llega para alguna mejora? (punto dorado del título) */
  const canAffordAny = (meta) => Object.keys(UPG).some((id) => { const c = nextUpgradeCost(meta, id); return c !== null && c <= essenceBalance(meta); });
  /** Compra el siguiente nivel de una mejora. Devuelve { ok, cost?, level?, reason? }. */
  function buyUpgrade(meta, id) {
    const cost = nextUpgradeCost(meta, id);
    if (cost === null) return { ok: false, reason: UPG[id] ? _t('upg.maxed') : _t('upg.unknown') };
    if (essenceBalance(meta) < cost) return { ok: false, reason: _t('upg.noEssence') };
    meta.essence = meta.essence || { earned: 0, spent: 0 };
    meta.upgrades = meta.upgrades || {};
    meta.essence.spent += cost;
    meta.upgrades[id] = upgradeLevel(meta, id) + 1;
    return { ok: true, cost, level: meta.upgrades[id] };
  }

  /* ------------------------------------------------------------------ *
   * Carga y guardado (tolerante a datos ausentes, corruptos o raros)
   * ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------ *
   * Compendio: qué has descubierto y estadísticas por entrada.
   * Campos por tipo (todos opcionales salvo seen); `at` = fecha en que se descubrió.
   * ------------------------------------------------------------------ */
  const D = E && E.D;
  const CODEX_FIELDS = {
    cards: ['picked', 'played', 'runs', 'wins'],
    relics: ['got', 'runs', 'wins'],
    potions: ['got', 'used'],
    enemies: ['kills', 'deaths'],
    events: ['visits']   // Parche 3.6: los eventos vistos cuentan para los hitos del compendio
  };
  /** Ids que cuentan para el Compendio (sin maldiciones ni cartas imposibles de conseguir). */
  function codexIds(type) {
    if (!D) return [];
    if (type === 'cards') return Object.keys(D.CARDS).filter((id) => ['common', 'uncommon', 'rare', 'legendary'].includes(D.CARDS[id].rarity) || D.STARTER_DECK.includes(id));
    if (type === 'relics') return Object.keys(D.ALL_RELICS);
    if (type === 'potions') return Object.keys(D.POTIONS || {});
    if (type === 'enemies') return Object.keys(D.ENEMIES);
    if (type === 'events') return Object.keys(D.EVENTS || {});
    return [];
  }
  /** Ids válidos para guardar estadísticas (las maldiciones también: se ven, pero no cuentan para el total). */
  const codexKnown = (type, id) => !!D && !!(type === 'cards' ? D.CARDS[id] : type === 'relics' ? D.ALL_RELICS[id]
    : type === 'potions' ? (D.POTIONS || {})[id] : type === 'enemies' ? D.ENEMIES[id] : type === 'events' ? (D.EVENTS || {})[id] : null);
  const emptyCodex = () => ({ cards: {}, relics: {}, potions: {}, enemies: {}, events: {} });
  function codexEntry(meta, type, id) {
    if (!codexKnown(type, id)) return null;
    meta.codex = meta.codex || emptyCodex();
    const box = meta.codex[type] = meta.codex[type] || {};
    if (!box[id]) { box[id] = { seen: false }; for (const f of CODEX_FIELDS[type]) box[id][f] = 0; }
    return box[id];
  }
  /** Marca una entrada como vista (y guarda cuándo se descubrió). */
  function codexSee(meta, type, id, now = new Date().toISOString()) {
    const e = codexEntry(meta, type, id);
    if (e && !e.seen) { e.seen = true; e.at = now; }
    return meta;
  }
  /** Suma n a un contador (y la marca como vista: lo que coges o juegas, lo has visto). */
  function codexAdd(meta, type, id, field, n = 1, now) {
    const e = codexEntry(meta, type, id);
    if (!e || !CODEX_FIELDS[type].includes(field)) return meta;
    codexSee(meta, type, id, now);
    e[field] = (e[field] || 0) + n;
    return meta;
  }
  /** Fin de partida: runs/wins de cada carta DISTINTA del mazo final y de cada reliquia. */
  function codexRunEnd(meta, run) {
    const w = won(run) ? 1 : 0;
    for (const id of new Set((run.deck || []).map((c) => c.id))) { codexAdd(meta, 'cards', id, 'runs'); if (w) codexAdd(meta, 'cards', id, 'wins'); }
    for (const id of new Set(run.relics || [])) { codexAdd(meta, 'relics', id, 'runs'); if (w) codexAdd(meta, 'relics', id, 'wins'); }
    return meta;
  }
  /** Descubiertas / total, en conjunto y por tipo. */
  function codexProgress(meta) {
    const out = { seen: 0, total: 0, byType: {} };
    for (const type of Object.keys(CODEX_FIELDS)) {
      const ids = codexIds(type).filter((id) => isUnlocked(meta, id)), box = (meta.codex && meta.codex[type]) || {};   // lo bloqueado no cuenta todavía
      const seen = ids.filter((id) => box[id] && box[id].seen).length;
      out.byType[type] = { seen, total: ids.length };
      out.seen += seen; out.total += ids.length;
    }
    return out;
  }
  /** Sanea el compendio: solo ids existentes, contadores con num(), seen booleano. */
  function sanitizeCodex(raw) {
    const cx = emptyCodex();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return cx;
    for (const type of Object.keys(CODEX_FIELDS)) {
      const box = raw[type];
      if (!box || typeof box !== 'object' || Array.isArray(box)) continue;
      for (const [id, e] of Object.entries(box)) {
        if (!codexKnown(type, id) || !e || typeof e !== 'object') continue;
        const out = { seen: e.seen === true };
        for (const f of CODEX_FIELDS[type]) out[f] = num(e[f]);
        if (out.seen && typeof e.at === 'string') out.at = e.at;
        cx[type][id] = out;
      }
    }
    return cx;
  }

  /* ---------- Personajes ---------- */
  const CHARS = (D && D.CHAR_IDS) || ['piromago'];
  const isChar = (id) => CHARS.includes(id);
  /** Nivel de Ascensión desbloqueado de un personaje. */
  const maxAsc = (meta, ch = 'piromago') => ((meta && meta.maxAscension && meta.maxAscension[ch]) || 0);
  /** Victorias por nivel de un personaje ({ nivel: n }). */
  const ascWinsOf = (meta, ch = 'piromago') => ((meta && meta.ascWins && meta.ascWins[ch]) || {});
  /**
   * Personajes que esta partida desbloquea (pura). Cada personaje con `unlock` en data.js define
   * su condición en UNLOCKS; de momento no hay ninguno que desbloquear.
   */
  /** Electromante: combates en grupo ganados (los guardados + los de esta partida si aún no se han sumado). */
  const GROUP_WINS_UNLOCK = 10;
  const groupWinsWith = (meta, run) => ((meta && meta.groupWins) || 0) + (run && !run.metaResult && run.stats ? run.stats.groupWins || 0 : 0);
  const UNLOCKS = {     // id → ({ meta, run }) => boolean
    criomante: ({ run }) => !!(run && run.stats && run.stats.guardianDown),  // derrotar al jefe del Acto I una vez
    guardiana: ({ run }) => !!(run && run.over && run.over.result === 'win'),  // ganar una partida (cualquier personaje)
    invocadora: ({ run }) => !!(run && ((run.act || 1) >= 2 || (run.stats && run.stats.guardianDown))),   // llegar al Acto II
    paladin: ({ run }) => !!(run && run.stats && run.stats.wyrmDown),   // derrotar a cualquier jefe del Acto II
    electromante: ({ meta, run }) => groupWinsWith(meta, run) >= GROUP_WINS_UNLOCK   // ganar 10 combates en grupo (en total, con cualquiera)
  };
  function checkUnlocks(meta, run) {
    return CHARS.filter((id) => !(meta.unlockedChars || []).includes(id) && UNLOCKS[id] && UNLOCKS[id]({ meta, run }));
  }

  /** Compara versiones «2.0», «2.10», «10.1» (numérica por partes). */
  function cmpVersion(a = '', b = '') {
    const pa = String(a || '0').split('.').map(Number), pb = String(b || '0').split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
    return 0;
  }
  /** ¿Hay notas de una versión más nueva que la última leída? */
  const hasUnreadNews = (meta) => cmpVersion(E.D.LATEST_VERSION, (meta && meta.lastSeenVersion) || '') > 0;

  function empty() {
    return { version: 1, played: 0, wins: 0, streak: 0, bestStreak: 0, bestFloor: 0, bestHit: 0, history: [], achievements: {},
             bestAct: 0, wyrms: 0, eyes: 0,      // acto más alto alcanzado, Wyrms y Ojos del Abismo derrotados
             groupWins: 0,                        // combates en grupo ganados (desbloquea al Electromante)
             daily: {}, dailyStreak: 0, bestDailyStreak: 0,
             maxAscension: {}, ascWins: {},       // Ascensión POR PERSONAJE: { piromago: n } y { piromago: { nivel: victorias } }
             unlockedChars: ['piromago'], lastChar: 'piromago',
             charStats: {},                       // { piromago: { played, wins, bestFloor } }
             pathStats: {},                       // Sendas: { brasa: { played, wins } } (las partidas sin senda no cuentan)
             tips: {}, tipsOff: false,            // Consejos ya vistos (id → true) y «Saltar consejos»
             savedAt: '',                         // ISO de la última vez que se guardó (fusión con la nube)
             codex: emptyCodex(), codexLastOpen: '',
             affixesSeen: [],                     // Afijos de élite vistos (Bestiario)
             bossesBeaten: [],                    // Jefes vencidos alguna vez (ids; logro «Cazador de jefes»)
             lastSeenVersion: '',                 // Última versión de «Novedades» leída
             essence: { earned: 0, spent: 0 },    // Esencia Arcana: saldo = earned − spent (nunca negativo)
             upgrades: {},                         // Santuario: { id: nivel }
             unlocked: [],                        // Recompensas de logro desbloqueadas (ids)
             // Parche 3.6: Afinidad, Personalizar, Legado, misiones, semanal e hitos del compendio
             affinity: {}, loadout: {}, legacy: {}, quests: { active: [], daily: null, rerolled: '', recent: [], done: 0 }, weekly: {}, milestones: [],
             // Parche 3.7: lore e intro
             introSeen: false, lore: [], bossKillsBy: {}, combatsWon: 0, contractsDone: 0, bossReach: 0 };                      // Recompensas de logro desbloqueadas (ids)                      // Santuario: { id: nivel }               // Última versión de «Novedades» leída                    // Afijos de élite vistos (Bestiario)   // Compendio y última vez que se abrió («¡Nuevo!»)
  }

  /* ------------------------------------------------------------------ *
   * Consejos contextuales: cada uno sale una sola vez en la vida del jugador.
   * Los textos y dónde se muestran viven en scenes.js; aquí solo los ids.
   * ------------------------------------------------------------------ */
  const TIP_IDS = ['mapa', 'energia', 'intencion', 'temp', 'quemadura', 'fin', 'recompensa',
                   'hoguera', 'tienda', 'evento', 'cofre', 'ascension',
                   'frio', 'maldicion', 'reliquiaJefe',     // Acto II
                   'pocion',                                // Pociones
                   'palabrasClave',                         // Palabras clave de carta
                   'escarcha', 'congelado',                 // Criomante
                   'runas',                                 // Guardiana
                   'invocar',                               // Invocadora
                   'juicio', 'fervor',                      // Paladín
                   'estatica', 'rayo',                      // Electromante
                   'senda',                                 // Sendas (elegir senda)
                   'arcano',                                // Acto III
                   'esencia'];                              // Esencia Arcana y Santuario                              // Invocadora                                // Guardiana
  /** ¿Hay que enseñar este consejo? No si ya se vio, si es desconocido o si se desactivaron. */
  const shouldShowTip = (meta, id) => !!meta && !meta.tipsOff && TIP_IDS.includes(id) && !(meta.tips && meta.tips[id]);
  /** Marca un consejo como visto (no hace nada con ids desconocidos). */
  function markTip(meta, id) {
    if (!TIP_IDS.includes(id)) return meta;
    meta.tips = meta.tips || {};
    meta.tips[id] = true;
    return meta;
  }
  /** «Volver a ver los consejos»: olvida los vistos y los reactiva. */
  function resetTips(meta) {
    meta.tips = {};
    meta.tipsOff = false;
    return meta;
  }

  const MAX_ASC = (E && E.D && E.D.MAX_ASCENSION) || 8;
  /** Nivel de Ascensión válido (entero 0..8) o null. */
  const ascLevel = (v) => (Number.isInteger(v) && v >= 0 && v <= MAX_ASC ? v : null);

  const num = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

  /** Normaliza cualquier cosa a un meta válido: lo que no encaje se descarta. */
  /** Etiqueta de partida personalizada del historial: código, modificadores válidos y dificultad (o null). */
  function cleanCustomEntry(c) {
    if (!c || typeof c !== 'object' || typeof c.code !== 'string' || !E.decodeCustom(c.code)) return null;
    const mods = Array.isArray(c.mods) ? E.D.CUSTOM_MOD_IDS.filter((id) => c.mods.includes(id)) : [];
    return { code: c.code, mods, diff: E.D.CUSTOM_DIFF[c.diff] ? c.diff : 'normal' };
  }
  function sanitize(raw) {
    const m = empty();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return m;
    for (const k of ['played', 'wins', 'streak', 'bestStreak', 'bestFloor', 'bestHit', 'dailyStreak', 'bestDailyStreak', 'wyrms', 'eyes', 'groupWins']) m[k] = num(raw[k]);
    // Acto más alto: guardados antiguos lo deducen del mejor piso (pisos 10+ = acto 2, 19+ = acto 3)
    const fpa = E.FLOORS_PER_ACT || 9;
    m.bestAct = Math.min(E.D.LAST_ACT, Math.max(num(raw.bestAct), m.bestFloor > 2 * fpa ? 3 : m.bestFloor > fpa ? 2 : m.played > 0 ? 1 : 0));
    if (Array.isArray(raw.history)) {
      m.history = raw.history
        .filter((h) => h && typeof h === 'object' && (h.result === 'win' || h.result === 'lose'))
        .slice(0, HISTORY_MAX)
        .map((h) => ({
          date: typeof h.date === 'string' ? h.date : '',
          result: h.result,
          floor: num(h.floor),
          // quién te derrotó: por id (los antiguos guardaban el nombre en español; se migra)
          killerId: h.result === 'lose' ? ((typeof h.killerId === 'string' && E.D.ENEMIES[h.killerId]) ? h.killerId : enemyIdByName(h.killer)) : null,
          cards: num(h.cards),
          relics: num(h.relics),
          ...(h.daily === true ? { daily: true } : {}),
          ...(ascLevel(h.asc) ? { asc: h.asc } : {}),     // A0 no se guarda (historial antiguo = A0)
          act: [2, 3].includes(h.act) ? h.act : 1,         // acto alcanzado (historial antiguo = acto 1)
          char: isChar(h.char) ? h.char : 'piromago',      // personaje (historial antiguo = Piromago)
          ...(E.D.PATHS[h.path] ? { path: h.path } : {}),  // senda (historial antiguo: ninguna)
          ...(cleanCustomEntry(h.custom) ? { custom: cleanCustomEntry(h.custom), score: num(h.score) } : {})   // partida personalizada
        }));
    }
    // Ascensión: nivel desbloqueado y victorias por nivel ("0".."8" → número)
    // Ascensión por personaje. Meta antiguo: número (→ Piromago) y ascWins { nivel: n } (→ Piromago)
    const mx = raw.maxAscension;
    if (typeof mx === 'number' || mx === null || mx === undefined) { if (num(mx) > 0) m.maxAscension.piromago = Math.min(MAX_ASC, num(mx)); }
    else if (typeof mx === 'object' && !Array.isArray(mx)) for (const [ch, v] of Object.entries(mx)) if (isChar(ch) && num(v) > 0) m.maxAscension[ch] = Math.min(MAX_ASC, num(v));
    const cleanWins = (obj) => { const out = {}; for (const [k, v] of Object.entries(obj)) if (/^\d$/.test(k) && ascLevel(Number(k)) !== null && num(v) > 0) out[k] = num(v); return out; };
    if (raw.ascWins && typeof raw.ascWins === 'object' && !Array.isArray(raw.ascWins)) {
      const keys = Object.keys(raw.ascWins);
      if (keys.some((k) => /^\d$/.test(k))) { const w = cleanWins(raw.ascWins); if (Object.keys(w).length) m.ascWins.piromago = w; }   // formato antiguo
      else for (const [ch, obj] of Object.entries(raw.ascWins)) if (isChar(ch) && obj && typeof obj === 'object' && !Array.isArray(obj)) { const w = cleanWins(obj); if (Object.keys(w).length) m.ascWins[ch] = w; }
    }
    // Personajes desbloqueados (el Piromago siempre) y último elegido. Las partidas personalizadas nunca desbloquean nada.
    const realHist = m.history.filter((h) => !h.custom);
    m.unlockedChars = ['piromago'].concat((Array.isArray(raw.unlockedChars) ? raw.unlockedChars : []).filter((x) => isChar(x) && x !== 'piromago'));
    // Criomante para metas anteriores: si ya ganaste alguna vez o pasaste del Guardián (piso 10+), ya lo tienes
    if (isChar('criomante') && !m.unlockedChars.includes('criomante') && (m.wins > 0 || m.bestFloor >= 10 || realHist.some((h) => h.result === 'win' || h.floor >= 10))) m.unlockedChars.push('criomante');
    // Guardiana Rúnica: metas con alguna victoria ya la tienen
    if (isChar('guardiana') && !m.unlockedChars.includes('guardiana') && (m.wins > 0 || realHist.some((h) => h.result === 'win'))) m.unlockedChars.push('guardiana');
    // Invocadora: metas que ya llegaron al Acto II (piso 10+ o alguna victoria) la tienen
    if (isChar('invocadora') && !m.unlockedChars.includes('invocadora') && (m.wins > 0 || m.bestFloor >= 10 || realHist.some((h) => h.result === 'win' || h.floor >= 10))) m.unlockedChars.push('invocadora');
    // Paladín: metas que ya derrotaron a un jefe del Acto II lo tienen
    if (isChar('paladin') && !m.unlockedChars.includes('paladin') && (m.wyrms > 0 || m.bestAct >= 3 || realHist.some((h) => h.floor >= 19))) m.unlockedChars.push('paladin');
    m.lastChar = isChar(raw.lastChar) && m.unlockedChars.includes(raw.lastChar) ? raw.lastChar : 'piromago';
    // Estadísticas por personaje; un meta antiguo las hereda del total (todo era del Piromago)
    if (raw.charStats && typeof raw.charStats === 'object' && !Array.isArray(raw.charStats)) {
      for (const [ch, st] of Object.entries(raw.charStats)) if (isChar(ch) && st && typeof st === 'object') m.charStats[ch] = { played: num(st.played), wins: num(st.wins), bestFloor: num(st.bestFloor), bestScore: num(st.bestScore) };
    } else if (m.played > 0) m.charStats.piromago = { played: m.played, wins: m.wins, bestFloor: m.bestFloor, bestScore: 0 };
    // Sendas: partidas y victorias por senda (ids conocidos)
    if (raw.pathStats && typeof raw.pathStats === 'object' && !Array.isArray(raw.pathStats)) {
      for (const [id, st] of Object.entries(raw.pathStats)) if (E.D.PATHS[id] && st && typeof st === 'object') m.pathStats[id] = { played: num(st.played), wins: Math.min(num(st.wins), num(st.played)) };
    }
    // Desafío diario: solo fechas reales con datos coherentes; las 30 más recientes
    if (raw.daily && typeof raw.daily === 'object' && !Array.isArray(raw.daily)) {
      Object.keys(raw.daily).filter(isDate).sort().reverse().slice(0, DAILY_MAX).forEach((d) => {
        const x = raw.daily[d];
        if (!x || typeof x !== 'object' || (x.result !== 'win' && x.result !== 'lose')) return;
        m.daily[d] = { best: num(x.best), result: x.result, floor: num(x.floor), attempts: Math.max(1, num(x.attempts)),
                       firstDone: typeof x.firstDone === 'string' ? x.firstDone : '' };
      });
    }
    // Consejos: solo ids conocidos con valor true; tipsOff solo si es exactamente true
    if (raw.tips && typeof raw.tips === 'object' && !Array.isArray(raw.tips)) {
      for (const [id, v] of Object.entries(raw.tips)) if (TIP_IDS.includes(id) && v === true) m.tips[id] = true;
    }
    m.tipsOff = raw.tipsOff === true;
    m.savedAt = typeof raw.savedAt === 'string' ? raw.savedAt : '';
    m.codex = sanitizeCodex(raw.codex);
    m.codexLastOpen = typeof raw.codexLastOpen === 'string' ? raw.codexLastOpen : '';
    m.lastSeenVersion = typeof raw.lastSeenVersion === 'string' ? raw.lastSeenVersion.slice(0, 12) : '';
    m.affixesSeen = Array.isArray(raw.affixesSeen) ? [...new Set(raw.affixesSeen.filter((id) => E.D.AFFIXES[id]))] : [];
    m.bossesBeaten = Array.isArray(raw.bossesBeaten) ? E.allBosses().filter((id) => raw.bossesBeaten.includes(id)) : [];
    // Metas anteriores al Compendio: se marcan como vistos el mazo inicial y los enemigos que aparecen en el historial
    // (sin fecha de descubrimiento ni estadísticas inventadas)
    if (!('codex' in raw) && D) {
      for (const id of new Set(D.STARTER_DECK)) m.codex.cards[id] = { seen: true, picked: 0, played: 0, runs: 0, wins: 0 };
      for (const h of m.history) {
        const id = h.killerId && D.ENEMIES[h.killerId] ? h.killerId : null;
        if (id) m.codex.enemies[id] = { seen: true, kills: 0, deaths: 0 };
      }
    }
    for (const type of Object.keys(m.codex)) m.codex[type] = Object.fromEntries(Object.keys(m.codex[type]).sort().map((k) => [k, m.codex[type][k]]));   // orden estable
    if (raw.achievements && typeof raw.achievements === 'object') {
      for (const [id, date] of Object.entries(raw.achievements)) {
        if (BY_ID[id] && typeof date === 'string') m.achievements[id] = date;
      }
    }
    // Esencia Arcana y Santuario (metas antiguos: 0 y sin mejoras)
    const ess = raw.essence && typeof raw.essence === 'object' && !Array.isArray(raw.essence) ? raw.essence : {};
    m.essence = { earned: num(ess.earned), spent: num(ess.spent) };
    if (raw.upgrades && typeof raw.upgrades === 'object' && !Array.isArray(raw.upgrades)) {
      for (const [id, v] of Object.entries(raw.upgrades)) if (UPG[id] && num(v) > 0) m.upgrades[id] = Math.min(UPG[id].cost.length, num(v));
    }
    m.essence.spent = Math.min(m.essence.spent, m.essence.earned);   // el saldo nunca es negativo
    // Recompensas de logro: las guardadas (ids conocidos) + las de los logros que ya tienes (metas antiguas)
    m.unlocked = unlockedIds({ unlocked: Array.isArray(raw.unlocked) ? raw.unlocked : [], achievements: m.achievements });
    sanitize36(raw, m);
    sanitize37(raw, m);
    m.essence.spent = Math.min(m.essence.spent, m.essence.earned);
    return m;
  }

  function load(store) {
    try {
      const s = store && store.get(KEY);
      return s ? sanitize(JSON.parse(s)) : empty();
    } catch (e) {
      return empty();   // JSON roto o store inaccesible: se empieza de cero
    }
  }

  function save(store, meta, now = new Date().toISOString()) {
    if (meta) meta.savedAt = now;   // marca de tiempo para fusionar con la nube
    try { store && store.set(KEY, JSON.stringify(meta)); } catch (e) { /* sin persistencia */ }
  }

  /* ------------------------------------------------------------------ *
   * Guardado en la nube: fusión de dos metas sin perder progreso.
   * Pura y testeable: no toca el almacenamiento ni la red.
   * ------------------------------------------------------------------ */
  /** «a» y «b» son metas (con su savedAt). Devuelve una meta saneada nueva. */
  function mergeMeta(rawA, rawB) {
    const a = sanitize(rawA), b = sanitize(rawB);
    const newer = (a.savedAt || '') >= (b.savedAt || '') ? a : b;   // el guardado más reciente
    const m = empty();
    // Contadores y mejores marcas: el máximo (nunca se pierde progreso)
    for (const k of ['played', 'wins', 'bestFloor', 'bestHit', 'bestStreak', 'bestDailyStreak', 'bestAct', 'wyrms', 'eyes', 'groupWins']) m[k] = Math.max(a[k] || 0, b[k] || 0);
    // Personajes: unión de desbloqueados; Ascensión y estadísticas, máximo por personaje
    m.unlockedChars = ['piromago'].concat(CHARS.filter((ch) => ch !== 'piromago' && (a.unlockedChars.includes(ch) || b.unlockedChars.includes(ch))));
    m.lastChar = newer.lastChar;
    for (const ch of CHARS) {
      const mx = Math.max(maxAsc(a, ch), maxAsc(b, ch)); if (mx > 0) m.maxAscension[ch] = mx;
      const wa = ascWinsOf(a, ch), wb = ascWinsOf(b, ch), w = {};
      for (const lv of new Set(Object.keys(wa).concat(Object.keys(wb)))) w[lv] = Math.max(wa[lv] || 0, wb[lv] || 0);
      if (Object.keys(w).length) m.ascWins[ch] = w;
      const sa = a.charStats[ch], sb = b.charStats[ch];
      if (sa || sb) m.charStats[ch] = { played: Math.max(sa ? sa.played : 0, sb ? sb.played : 0), wins: Math.max(sa ? sa.wins : 0, sb ? sb.wins : 0), bestFloor: Math.max(sa ? sa.bestFloor : 0, sb ? sb.bestFloor : 0),
        bestScore: Math.max(sa ? sa.bestScore || 0 : 0, sb ? sb.bestScore || 0 : 0) };
    }
    // Sendas: máximo por senda
    for (const id of E.D.PATH_IDS) {
      const sa = (a.pathStats || {})[id], sb = (b.pathStats || {})[id];
      if (sa || sb) m.pathStats[id] = { played: Math.max(sa ? sa.played : 0, sb ? sb.played : 0), wins: Math.max(sa ? sa.wins : 0, sb ? sb.wins : 0) };
    }
    // Rachas en curso: las del lado guardado más recientemente
    m.streak = newer.streak; m.dailyStreak = newer.dailyStreak;
    // Logros: unión, con la fecha más antigua
    for (const src of [a, b]) for (const [id, date] of Object.entries(src.achievements)) {
      if (!m.achievements[id] || date < m.achievements[id]) m.achievements[id] = date;
    }
    // Victorias por nivel de Ascensión: máximo por nivel
    // Diario: unión por fecha; mejor puntuación (con su resultado y piso), intentos máximos, primera vez más antigua
    for (const src of [a, b]) for (const [d, x] of Object.entries(src.daily)) {
      const y = m.daily[d];
      if (!y) { m.daily[d] = { ...x }; continue; }
      const best = x.best > y.best ? x : y;
      m.daily[d] = { best: best.best, result: best.result, floor: best.floor, attempts: Math.max(x.attempts, y.attempts),
                     firstDone: [x.firstDone, y.firstDone].filter(Boolean).sort()[0] || '' };
    }
    // Historial: unión sin duplicados (por fecha), de más reciente a más antigua, máx. HISTORY_MAX
    const seen = new Set();
    m.history = a.history.concat(b.history)
      .filter((h) => { const k = h.date || JSON.stringify(h); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0))
      .slice(0, HISTORY_MAX);
    // Consejos: unión; «Saltar consejos», el más reciente
    m.tips = { ...a.tips, ...b.tips };
    m.tipsOff = newer.tipsOff;
    m.savedAt = newer.savedAt;
    // Compendio: seen → OR; contadores → máximo (sincronizar dos veces no duplica); at → el más antiguo
    for (const type of Object.keys(CODEX_FIELDS)) {
      const ids = [...new Set(Object.keys(a.codex[type]).concat(Object.keys(b.codex[type])))].sort();
      for (const id of ids) {
        const x = a.codex[type][id] || {}, y = b.codex[type][id] || {};
        const e = { seen: !!(x.seen || y.seen) };
        for (const f of CODEX_FIELDS[type]) e[f] = Math.max(x[f] || 0, y[f] || 0);
        const at = [x.at, y.at].filter(Boolean).sort()[0];
        if (e.seen && at) e.at = at;
        m.codex[type][id] = e;
      }
    }
    m.codexLastOpen = [a.codexLastOpen, b.codexLastOpen].sort().pop() || '';
    m.affixesSeen = E.D.AFFIX_IDS.filter((id) => (a.affixesSeen || []).includes(id) || (b.affixesSeen || []).includes(id));
    m.bossesBeaten = E.allBosses().filter((id) => (a.bossesBeaten || []).includes(id) || (b.bossesBeaten || []).includes(id));
    m.lastSeenVersion = cmpVersion(a.lastSeenVersion, b.lastSeenVersion) >= 0 ? (a.lastSeenVersion || '') : (b.lastSeenVersion || '');
    // Claves en orden fijo: el resultado no depende de qué lado sea «a» o «b»
    const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
    m.achievements = sorted(m.achievements); m.tips = sorted(m.tips);
    // Santuario: niveles al máximo; Esencia ganada y gastada al máximo (gastado ≥ lo que cuestan los niveles; ganado ≥ gastado)
    for (const id of Object.keys(UPG)) { const lv = Math.max(a.upgrades[id] || 0, b.upgrades[id] || 0); if (lv) m.upgrades[id] = lv; }
    const spent = Math.max(a.essence.spent, b.essence.spent, upgradesCost(m.upgrades));
    m.essence = { earned: Math.max(a.essence.earned, b.essence.earned, spent), spent };
    m.unlocked = [...new Set(a.unlocked.concat(b.unlocked))];   // recompensas de logro: unión (sanitize las ordena)
    merge36(a, b, newer, m);
    merge37(a, b, m);
    return sanitize(m);
  }
  /** ¿Tiene esta meta algo que merezca subirse? (una meta vacía no pisa nada) */
  const hasProgress = (raw) => {
    const m = sanitize(raw);
    return m.played > 0 || Object.keys(m.achievements).length > 0 || Object.keys(m.daily).length > 0 || Object.keys(m.tips).length > 0 || m.tipsOff;
  };
  /** Partida a medias: gana la guardada más recientemente. Docs { run: string|null, savedAt }. */
  function mergeRun(a, b) {
    const sa = (a && a.savedAt) || '', sb = (b && b.savedAt) || '';
    if (!sa && !sb) return a || b || { run: null, savedAt: '' };
    return sa >= sb ? a : b;
  }

  /* ------------------------------------------------------------------ *
   * Comprobaciones
   * ------------------------------------------------------------------ */
  /** Desbloquea los logros de `when` que se cumplan y aún no estén; devuelve los nuevos. */
  function unlock(meta, run, combat, whens, now) {
    const fresh = [];
    if (run && run.custom) return fresh;   // Modo personalizado: no cuenta para logros
    const ctx = { run, meta, combat };
    for (const a of ACHIEVEMENTS) {
      if (!whens.includes(a.when) || meta.achievements[a.id]) continue;
      let ok = false;
      try { ok = !!a.check(ctx); } catch (e) { ok = false; }
      if (ok) {
        meta.achievements[a.id] = now;
        fresh.push(a);
        const list = run.achievementsThisRun || [];
        if (!list.includes(a.id)) run.achievementsThisRun = list.concat(a.id);
        if (a.reward) {   // la recompensa entra en el pool para siempre… y ya en esta misma partida (salvo en el diario)
          meta.unlocked = unlockedIds(meta);
          if (!run.daily) run.unlocked = [...new Set((run.unlocked || []).concat(a.reward.id))];
        }
      }
    }
    return fresh;
  }

  /** Llamar al terminar cada combate (ganado o perdido), antes de cerrarlo. */
  function onCombatEnd(meta, run, combat, now = new Date().toISOString()) {
    // Bestiario: afijos vistos (en el orden de AFFIX_IDS)
    const seen = (combat && combat.enemy && combat.enemy.affixes) || [];
    if (seen.length) meta.affixesSeen = E.D.AFFIX_IDS.filter((id) => (meta.affixesSeen || []).includes(id) || seen.includes(id));
    return unlock(meta, run, combat, ['combat'], now);
  }

  /**
   * Llamar una sola vez al terminar la partida. Actualiza contadores, rachas,
   * récords e historial, y comprueba todos los logros.
   * Devuelve { achievements: [...nuevos], records: [...textos] }.
   */
  function onRunEnd(meta, run, now = new Date().toISOString()) {
    if (run.metaResult) return run.metaResult;   // idempotente si la escena se repinta
    if (run.custom) return onCustomRunEnd(meta, run, now);
    const win = won(run);
    const prev = { bestHit: meta.bestHit, bestFloor: meta.bestFloor, bestStreak: meta.bestStreak };

    meta.played++;
    if (win) { meta.wins++; meta.streak++; } else meta.streak = 0;
    meta.bestStreak = Math.max(meta.bestStreak, meta.streak);
    meta.bestFloor = Math.max(meta.bestFloor, st(run, 'floors'));
    meta.bestHit = Math.max(meta.bestHit, st(run, 'maxHit'));
    meta.bestAct = Math.max(meta.bestAct || 0, Math.min(E.D.LAST_ACT, run.act || 1));
    if (run.stats && run.stats.wyrmDown) meta.wyrms = (meta.wyrms || 0) + 1;
    if (run.stats && run.stats.eyeDown) meta.eyes = (meta.eyes || 0) + 1;   // la victoria final: el jefe del Acto III
    meta.bossesBeaten = bossesBeatenWith(meta, run);

    meta.history.unshift({
      date: now,
      result: win ? 'win' : 'lose',
      floor: st(run, 'floors'),
      killerId: win ? null : ((run.over && (run.over.killerId || enemyIdByName(run.over.killer))) || null),
      cards: (run.deck || []).length,
      relics: (run.relics || []).length,
      ...(run.daily ? { daily: true } : {}),
      ...((run.ascension || 0) > 0 ? { asc: run.ascension } : {}),
      act: Math.min(E.D.LAST_ACT, Math.max(1, run.act || 1)),
      char: isChar(run.char) ? run.char : 'piromago',
      ...(E.D.PATHS[run.path] ? { path: run.path } : {})
    });
    meta.history = meta.history.slice(0, HISTORY_MAX);
    const daily = run.daily ? recordDaily(meta, run, now) : null;
    const ascUnlocked = recordAscension(meta, run);

    // Récords batidos (la primera partida solo fija la referencia, no cuenta como récord)
    const records = [];
    if (prev.bestHit > 0 && meta.bestHit > prev.bestHit) records.push(I18N.msg('rec.newHit', { n: meta.bestHit }));
    if (prev.bestFloor > 0 && meta.bestFloor > prev.bestFloor) records.push(I18N.msg('rec.newFloor', { n: meta.bestFloor }));
    if (prev.bestStreak > 0 && meta.bestStreak > prev.bestStreak) records.push(I18N.msg('rec.newStreak', { n: meta.bestStreak }));

    codexRunEnd(meta, run);   // Compendio: partidas y victorias con cada carta y reliquia
    // Estadísticas por personaje y personajes desbloqueados
    const ch = isChar(run.char) ? run.char : 'piromago';
    meta.charStats = meta.charStats || {};
    const cs = meta.charStats[ch] = meta.charStats[ch] || { played: 0, wins: 0, bestFloor: 0, bestScore: 0 };
    cs.played++; if (win) cs.wins++; cs.bestFloor = Math.max(cs.bestFloor, st(run, 'floors'));
    if (E.D.PATHS[run.path]) {   // Sendas: victorias por senda (Récords)
      meta.pathStats = meta.pathStats || {};
      const ps = meta.pathStats[run.path] = meta.pathStats[run.path] || { played: 0, wins: 0 };
      ps.played++; if (win) ps.wins++;
    }
    // Puntuación (partidas normales; el diario lleva su propio récord): fórmula del diario × pactos
    let score = null, newBestScore = false;
    if (!run.daily) {
      score = E.runScore(run);
      newBestScore = score > (cs.bestScore || 0);
      if ((cs.bestScore || 0) > 0 && score > cs.bestScore) records.push(I18N.msg('rec.newScore', { c: I18N.ref('char', ch), n: score }));
      cs.bestScore = Math.max(cs.bestScore || 0, score);
    }
    const charUnlocked = checkUnlocks(meta, run).filter((id) => !(meta.unlockedChars || []).includes(id));
    meta.groupWins = (meta.groupWins || 0) + st(run, 'groupWins');   // después de checkUnlocks (que ya cuenta los de esta partida)
    meta.unlockedChars = (meta.unlockedChars || ['piromago']).concat(charUnlocked);
    const achievements = unlock(meta, run, null, ['combat', 'end'], now);
    // Esencia Arcana: la base pura del motor + 25 por logro nuevo + 50 la primera victoria con este personaje
    const R = E.D.ESSENCE, base = E.essenceFor(run);
    const essence = { ...base, achievements: achievements.length * R.achievement, firstWin: win && cs.wins === 1 ? R.firstWinChar : 0 };
    essence.gained = base.total + essence.achievements + essence.firstWin;
    meta.essence = meta.essence || { earned: 0, spent: 0 };
    meta.essence.earned += essence.gained;
    const extra = runEnd36(meta, run);
    addBonusEss(essence, extra.bonusEss);
    essence.balance = essenceBalance(meta);
    run.metaResult = { essence, achievements, records, charUnlocked, ...(score !== null ? { score, bestScore: cs.bestScore, newBestScore } : {}), ...(daily ? { daily } : {}), ...(ascUnlocked ? { ascUnlocked } : {}), ...extra };
    return run.metaResult;
  }

  /**
   * Partida personalizada terminada: SOLO historial (con su etiqueta y modificadores) y Esencia × dificultad.
   * No cuenta para logros, Ascensión, rachas, récords, estadísticas por personaje ni desbloqueos.
   */
  function onCustomRunEnd(meta, run, now) {
    const win = won(run);
    meta.history.unshift({
      date: now, result: win ? 'win' : 'lose', floor: st(run, 'floors'),
      killerId: win ? null : ((run.over && (run.over.killerId || enemyIdByName(run.over.killer))) || null),
      cards: (run.deck || []).length, relics: (run.relics || []).length,
      ...((run.ascension || 0) > 0 ? { asc: run.ascension } : {}),
      act: Math.min(E.D.LAST_ACT, Math.max(1, run.act || 1)),
      char: isChar(run.char) ? run.char : 'piromago',
      ...(E.D.PATHS[run.path] ? { path: run.path } : {}),
      custom: { code: run.custom.code, mods: run.custom.mods.slice(), diff: E.customDifficulty(run.custom).id },
      score: E.dailyScore(run)
    });
    meta.history = meta.history.slice(0, HISTORY_MAX);
    const R = E.D.ESSENCE, base = E.essenceFor(run);
    const essence = { ...base, achievements: 0, firstWin: 0, gained: base.total };
    meta.essence = meta.essence || { earned: 0, spent: 0 };
    meta.essence.earned += essence.gained;
    const weekly = run.weekly ? recordWeekly(meta, run) : null;
    const extra = runEnd36(meta, run);
    addBonusEss(essence, { weekly: weekly ? weekly.essence : 0, ...extra.bonusEss });
    essence.balance = essenceBalance(meta);
    run.metaResult = { essence, achievements: [], records: [], charUnlocked: [], score: E.dailyScore(run), custom: true, ...(weekly ? { weekly } : {}), ...extra };
    return run.metaResult;
  }

  /**
   * Registra un intento del desafío diario de run.daily.
   * - Suma el intento y actualiza el mejor (con su resultado y piso) solo si mejora.
   * - Racha: en el PRIMER intento terminado del día, sube si el día anterior tiene entrada;
   *   si no, vuelve a 1. Los reintentos del mismo día no la tocan.
   */
  function recordDaily(meta, run, now) {
    const d = run.daily;
    meta.daily = meta.daily || {};
    const entry = meta.daily[d] || { best: 0, result: 'lose', floor: 0, attempts: 0, firstDone: '' };
    const first = entry.attempts === 0;
    const score = E.dailyScore(run);
    const isNewBest = first || score > entry.best;
    entry.attempts++;
    if (isNewBest) {
      entry.best = score;
      entry.result = run.over && run.over.result === 'win' ? 'win' : 'lose';
      entry.floor = st(run, 'floors');
    }
    if (first) {
      entry.firstDone = now;
      meta.dailyStreak = meta.daily[prevDay(d)] ? (meta.dailyStreak || 0) + 1 : 1;
      meta.bestDailyStreak = Math.max(meta.bestDailyStreak || 0, meta.dailyStreak);
    }
    meta.daily[d] = entry;
    // Conserva solo las 30 fechas más recientes
    Object.keys(meta.daily).sort().reverse().slice(DAILY_MAX).forEach((k) => { delete meta.daily[k]; });
    return { date: d, score, best: entry.best, isNewBest, attempts: entry.attempts, streak: meta.dailyStreak };
  }

  /**
   * Ascensión: suma la victoria al nivel jugado y, si se ganó una partida NO diaria
   * justo en el nivel más alto desbloqueado (y no es el 8), desbloquea el siguiente.
   * Devuelve el nivel desbloqueado o null.
   */
  function recordAscension(meta, run) {
    if (!won(run)) return null;
    const n = run.ascension || 0, ch = isChar(run.char) ? run.char : 'piromago';
    meta.ascWins = meta.ascWins || {};
    const w = meta.ascWins[ch] = meta.ascWins[ch] || {};
    w[n] = (w[n] || 0) + 1;
    if (!run.daily && n === maxAsc(meta, ch) && n < MAX_ASC) {
      meta.maxAscension = meta.maxAscension || {};
      meta.maxAscension[ch] = n + 1;
      return n + 1;
    }
    return null;
  }

  /** Racha diaria vigente: si no jugaste ni hoy ni ayer, ya se ha roto (se muestra 0). */
  function currentDailyStreak(meta, today) {
    const daily = meta.daily || {};
    return daily[today] || daily[prevDay(today)] ? (meta.dailyStreak || 0) : 0;
  }

  /** Las últimas `n` fechas jugadas, de la más reciente a la más antigua. */
  function lastDailies(meta, n = 7) {
    return Object.keys(meta.daily || {}).sort().reverse().slice(0, n).map((date) => ({ date, ...meta.daily[date] }));
  }

  /* =====================================================================
   * Parche 3.6 — Rejugabilidad (parte 2)
   *   meta.affinity[ch] = { xp, claimed }       Afinidad (claimed = último nivel cuya recompensa ya se dio)
   *   meta.loadout[ch]  = { relic, deck, frame, back, aura, title }   lo elegido en «Personalizar»
   *   meta.legacy[ch]   = id de carta           Legado (se consume al empezar la siguiente partida normal)
   *   meta.quests       = { active: [3], daily, rerolled, recent, done }
   *   meta.weekly[lunes] = { best, result, floor, attempts, rewarded }
   *   meta.milestones   = [25, 50…]             hitos del compendio cobrados
   * ===================================================================== */
  const AFF_MAX = (D && D.AFFINITY_MAX) || 15;
  const affNeed = (L) => (D ? D.affinityNeed(L) : 100);
  /** Nivel de Afinidad de una XP: { level, into (XP dentro del nivel), need (para el siguiente; 0 al máximo) }. */
  function affinityLevel(xp) {
    let L = 1, left = num(xp);
    while (L < AFF_MAX && left >= affNeed(L)) { left -= affNeed(L); L++; }
    return { level: L, into: L >= AFF_MAX ? 0 : left, need: L >= AFF_MAX ? 0 : affNeed(L), max: L >= AFF_MAX };
  }
  /** XP total para llegar a un nivel. */
  const xpToLevel = (L) => { let t = 0; for (let i = 1; i < Math.min(L, AFF_MAX); i++) t += affNeed(i); return t; };
  const affOf = (meta, ch) => ((meta && meta.affinity && meta.affinity[ch]) || { xp: 0, claimed: 1 });
  const affLevelOf = (meta, ch) => affinityLevel(affOf(meta, ch).xp).level;
  /** XP de Afinidad de una partida (desglose). Personalizadas y semanal: × dificultad. */
  function xpForRun(run) {
    const X = D.AFFINITY_XP, s = run.stats || {};
    const parts = {
      floors: st(run, 'floors') * X.floor,
      elites: (s.eliteKills || 0) * X.elite,
      bosses: (s.bossKills || 0) * X.boss,
      contract: run.contract && run.contract.state === 'done' ? X.contract : 0,
      win: won(run) ? X.win : 0
    };
    const base = Object.values(parts).reduce((a, b) => a + b, 0);
    let mult = 1 + X.ascStep * (run.ascension || 0);
    if (run.custom) mult *= E.customDifficulty(run.custom).mult;
    return { ...parts, base, mult: Math.round(mult * 100) / 100, total: Math.max(0, Math.round(base * mult)) };
  }
  /** Suma XP a un personaje y cobra las recompensas de los niveles nuevos. Devuelve { before, after, levels: [{ level, reward }], essence }. */
  function grantAffinity(meta, ch, xp) {
    if (!isChar(ch)) return { before: 0, after: 0, levels: [], essence: 0 };
    meta.affinity = meta.affinity || {};
    const a = meta.affinity[ch] = meta.affinity[ch] || { xp: 0, claimed: 1 };
    const before = a.xp;
    a.xp = num(a.xp + Math.max(0, Math.round(Number(xp) || 0)));
    return { before, after: a.xp, ...claimAffinity(meta, ch) };
  }
  /** Da las recompensas de Afinidad que falten (Esencia; lo demás se deduce del nivel). */
  function claimAffinity(meta, ch) {
    const a = meta.affinity[ch], L = affinityLevel(a.xp).level, levels = [];
    let essence = 0;
    for (let lv = Math.max(2, (a.claimed || 1) + 1); lv <= L; lv++) {
      const r = D.AFFINITY_REWARDS[lv] || {};
      levels.push({ level: lv, reward: r });
      if (r.essence) essence += r.essence;
    }
    a.claimed = Math.max(a.claimed || 1, L);
    if (essence) { meta.essence = meta.essence || { earned: 0, spent: 0 }; meta.essence.earned += essence; }
    return { levels, essence };
  }
  /** Lo que la Afinidad de un personaje tiene desbloqueado. */
  function affinityUnlocks(meta, ch) {
    const L = affLevelOf(meta, ch), out = { relics: [], deck: false, frame: [], back: [], aura: [], title: [] };
    for (let lv = 2; lv <= L; lv++) {
      const r = D.AFFINITY_REWARDS[lv] || {};
      if (r.relic !== undefined) out.relics.push(D.ALT_STARTERS[ch][r.relic]);
      if (r.deck) out.deck = true;
      for (const slot of D.COSMETIC_SLOTS) if (r[slot]) out[slot].push(r[slot]);
    }
    return out;
  }
  /** Próxima recompensa de Afinidad: { level, reward } o null al máximo. */
  function nextAffinityReward(meta, ch) {
    const L = affLevelOf(meta, ch);
    return L >= AFF_MAX ? null : { level: L + 1, reward: D.AFFINITY_REWARDS[L + 1] || {} };
  }
  /** ¿Tienes este cosmético con este personaje? (los de los hitos del compendio valen para todos) */
  function ownsCosmetic(meta, ch, slot, id) {
    if (!D.COSMETICS[slot] || !D.COSMETICS[slot][id]) return false;
    if (id === 'none') return true;
    if (affinityUnlocks(meta, ch)[slot].includes(id)) return true;
    return D.CODEX_MILESTONES.some((m) => m.cosmetic[0] === slot && m.cosmetic[1] === id && (meta.milestones || []).includes(m.pct));
  }
  /** Lo elegido en «Personalizar» para un personaje, solo con lo que de verdad tienes. */
  function loadoutOf(meta, ch) {
    const raw = (meta && meta.loadout && meta.loadout[ch]) || {}, un = affinityUnlocks(meta, ch);
    const out = { relic: un.relics.includes(raw.relic) ? raw.relic : '', deck: !!raw.deck && un.deck };
    for (const slot of D.COSMETIC_SLOTS) out[slot] = ownsCosmetic(meta, ch, slot, raw[slot]) ? raw[slot] : 'none';
    return out;
  }
  function setLoadout(meta, ch, patch) {
    if (!isChar(ch)) return meta;
    meta.loadout = meta.loadout || {};
    meta.loadout[ch] = Object.assign({}, loadoutOf(meta, ch), patch);
    meta.loadout[ch] = loadoutOf(meta, ch);
    return meta;
  }
  /** Opciones de newRun para una partida normal (mode 'normal'); en el resto, solo los cosméticos. */
  function runOptsFor(meta, ch, mode = 'normal') {
    const lo = loadoutOf(meta, ch), look = {};
    for (const slot of D.COSMETIC_SLOTS) if (lo[slot] !== 'none') look[slot] = lo[slot];
    if (mode !== 'normal') return { look };
    return { look, ...(lo.relic ? { starterRelic: lo.relic } : {}), ...(lo.deck ? { altDeck: true } : {}), ...(legacyOf(meta, ch) ? { legacy: legacyOf(meta, ch) } : {}) };
  }
  /** Título de Afinidad (o del compendio) elegido, como texto. */
  function titleText(meta, ch) {
    const t = loadoutOf(meta, ch).title;
    if (t === 'hero') return D.AFFINITY_TITLES[ch] || '';   // los datos registrados ya están en el idioma actual
    if (t === 'sage') return D.COSMETICS.title.sage.name;
    return '';
  }

  /* ---------- Legado ---------- */
  const legacyOf = (meta, ch) => { const id = meta && meta.legacy && meta.legacy[ch]; return id && E.legacyOk(id, ch) ? id : null; };
  /** ¿Puede esta partida dejar Legado? Solo victorias del modo normal (ni diario, ni semanal, ni personalizada). */
  const legacyEligible = (run) => won(run) && !run.daily && !run.custom && !run.weekly;
  /** Cartas del mazo final que pueden ser Legado (sin repetir, en el orden del mazo). */
  const legacyChoices = (run) => (legacyEligible(run) ? [...new Set((run.deck || []).map((c) => c.id))].filter((id) => E.legacyOk(id, run.char)) : []);
  /** Elige (id) o rechaza (null) el Legado de una victoria. Una sola vez por partida. */
  function setLegacy(meta, run, id) {
    if (!legacyEligible(run) || run.legacySet) return false;
    if (id && !legacyChoices(run).includes(id)) return false;
    run.legacySet = true;
    meta.legacy = meta.legacy || {};
    if (id) meta.legacy[run.char] = id;
    return true;
  }
  /** Al empezar una partida: se gasta el Legado que haya usado (solo partidas normales). */
  function prepareRun(meta, run) {
    if (!run.qrid) run.qrid = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    if (!run.affStart) run.affStart = { xp: affOf(meta, run.char).xp };
    if (!run.look) run.look = E.cleanLook(runOptsFor(meta, run.char, 'other').look);   // diario, semanal y personalizada: solo cosméticos
    if (run.legacy && meta.legacy && meta.legacy[run.char] === run.legacy) delete meta.legacy[run.char];
    return meta;
  }

  /* ---------- Misiones ---------- */
  const QDEF = (id) => D.QUESTS[id];
  const END_ONLY = ['win', 'ascWin', 'customHard', 'deckSmall', 'bossRelics', 'daily'];
  /** Valor de una estadística de misión en una partida (0 si aún no se puede saber). */
  function questStat(stat, run) {
    const s = run.stats || {}, over = !!run.over;
    if (END_ONLY.includes(stat) && !over) return 0;
    switch (stat) {
      case 'burn': return s.burnApplied || 0;
      case 'frost': return s.frostApplied || 0;
      case 'judg': return s.judgApplied || 0;
      case 'kills': return s.kills || 0;
      case 'floors': return s.floors || 0;
      case 'mystery': return (s.nodeSeen && s.nodeSeen.mystery) || 0;
      case 'cards': return s.cardsPlayed || 0;
      case 'gold': return s.goldEarned || 0;
      case 'potions': return s.potionsUsed || 0;
      case 'events': return s.events || 0;
      case 'forge': return (s.nodeSeen && s.nodeSeen.forge) || 0;
      case 'peddler': return (s.nodeSeen && s.nodeSeen.peddler) || 0;
      case 'altar': return s.altar || 0;
      case 'elites': return s.eliteKills || 0;
      case 'bosses': return s.bossKills || 0;
      case 'goldKills': return s.goldKills || 0;
      case 'summons': return s.summoned || 0;
      case 'overloads': return s.overloads || 0;
      case 'runes': return s.detonations || 0;
      case 'groupNoDmg': return s.groupNoDmg || 0;
      case 'hpLow': return s.hpLow || 0;
      case 'combo': return s.maxCombo || 0;
      case 'maxHit': return s.maxHit || 0;
      case 'contracts': return run.contract && run.contract.state === 'done' ? 1 : 0;
      case 'act3': return (run.act || 1) >= 3 ? 1 : 0;
      case 'daily': return run.daily ? 1 : 0;
      case 'win': return won(run) ? 1 : 0;
      case 'ascWin': return won(run) && (run.ascension || 0) >= 1 ? 1 : 0;
      case 'customHard': return won(run) && run.custom && ['dificil', 'locura'].includes(E.customDifficulty(run.custom).id) ? 1 : 0;
      case 'deckSmall': return won(run) && (run.deck || []).length <= 15 ? 1 : 0;
      case 'bossRelics': return (run.relics || []).filter((id) => D.BOSS_RELICS[id]).length;
      default: return 0;
    }
  }
  /** ¿Cuenta esta partida para la misión? (personaje y partidas personalizadas) */
  const questCounts = (q, run) => !!q && (!q.char || q.char === run.char) && !(q.custom === false && run.custom);
  /** Lo que la partida aporta a la misión desde que se asignó (las que se dan a mitad de partida empiezan de 0). */
  function questRunPart(e, run) {
    const q = QDEF(e.id);
    if (!questCounts(q, run)) return 0;
    const v = questStat(q.stat, run), from = e.rid && e.rid === run.qrid ? e.from || 0 : 0;
    return q.mode === 'max' ? (v > from ? v : 0) : Math.max(0, v - from);
  }
  /** Progreso de una misión (con la partida en curso si se pasa). */
  function questProgress(e, run) {
    const q = QDEF(e.id);
    if (!q) return 0;
    const part = run ? questRunPart(e, run) : 0;
    return Math.min(q.goal, q.mode === 'max' ? Math.max(e.prog || 0, part) : (e.prog || 0) + part);
  }
  /** Misiones que se pueden asignar: personaje desbloqueado y modo abierto. */
  function questEligible(meta, id) {
    const q = QDEF(id);
    if (!q) return false;
    if (q.char && !(meta.unlockedChars || []).includes(q.char)) return false;
    if (q.stat === 'customHard' && !(meta.played > 0)) return false;               // el Modo Personalizado se abre tras 1 partida
    if (q.stat === 'ascWin' && !CHARS.some((ch) => maxAsc(meta, ch) > 0)) return false;   // hace falta la Ascensión 1
    return true;
  }
  /** Una misión nueva de la dificultad `tier` (si no hay, de cualquiera). */
  function newQuest(meta, tier, run, rnd = Math.random) {
    const Q = meta.quests, taken = new Set(Q.active.map((e) => e.id).concat(Q.daily ? [Q.daily.id] : []));
    const ok = (id) => questEligible(meta, id) && !taken.has(id);
    let pool = D.QUEST_IDS.filter((id) => ok(id) && QDEF(id).tier === tier && !(Q.recent || []).includes(id));
    if (!pool.length) pool = D.QUEST_IDS.filter((id) => ok(id) && QDEF(id).tier === tier);
    if (!pool.length) pool = D.QUEST_IDS.filter(ok);
    // a mitad de partida, nunca una que ya estaría cumplida (las de «en una partida»)
    if (run) pool = pool.filter((id) => questProgress({ id, prog: 0, rid: run.qrid, from: questStat(QDEF(id).stat, run) }, run) < QDEF(id).goal);
    if (!pool.length) return null;
    const id = pool[Math.floor(rnd() * pool.length) % pool.length];
    return { id, prog: 0, ...(run && run.qrid ? { rid: run.qrid, from: questStat(QDEF(id).stat, run) } : {}) };
  }
  /** Misión diaria especial: sale de la fecha (dificultad 2 o 3). */
  function dailyQuestId(meta, date) {
    const pool = D.QUEST_IDS.filter((id) => questEligible(meta, id) && QDEF(id).tier >= 2 && !(meta.quests.active || []).some((e) => e.id === id));
    if (!pool.length) return null;
    let h = 0x811c9dc5; const s = 'cm-quest-' + date;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return pool[h % pool.length];
  }
  const emptyQuests = () => ({ active: [], daily: null, rerolled: '', recent: [], done: 0 });
  /** Rellena las 3 misiones (una de cada dificultad) y renueva la diaria si cambió el día. Devuelve meta. */
  function ensureQuests(meta, today = E.todayStr(), rnd = Math.random) {
    meta.quests = meta.quests || emptyQuests();
    const Q = meta.quests;
    Q.active = (Q.active || []).filter((e) => QDEF(e.id) && questEligible(meta, e.id));
    for (let tier = 1; tier <= 3; tier++) {
      if (Q.active.some((e) => QDEF(e.id).tier === tier)) continue;
      const e = newQuest(meta, tier, null, rnd);
      if (e) Q.active.push(e);
    }
    Q.active = Q.active.sort((a, b) => QDEF(a.id).tier - QDEF(b.id).tier).slice(0, 3);
    if (!Q.daily || Q.daily.date !== today || !QDEF(Q.daily.id)) {
      const id = dailyQuestId(meta, today);
      Q.daily = id ? { id, prog: 0, date: today, done: false } : null;
    }
    return meta;
  }
  /** Recompensa de una misión ({ essence, xp }). */
  const questReward = (id, daily) => { const r = D.QUEST_REWARD[QDEF(id).tier], k = daily ? D.QUEST_DAILY_MULT : 1; return { essence: r.essence * k, xp: r.xp * k }; };
  /** Cobra una misión cumplida: Esencia + XP de Afinidad al personaje con el que juegas. */
  function payQuest(meta, run, id, daily) {
    const r = questReward(id, daily);
    meta.essence = meta.essence || { earned: 0, spent: 0 };
    meta.essence.earned += r.essence;
    const aff = grantAffinity(meta, run.char, r.xp);
    meta.quests.done = (meta.quests.done || 0) + 1;
    meta.quests.recent = [id].concat((meta.quests.recent || []).filter((x) => x !== id)).slice(0, 6);
    run.questsDone = (run.questsDone || []).concat({ id, daily: !!daily, ...r });
    return { id, daily: !!daily, ...r, levels: aff.levels };
  }
  /**
   * Durante la partida (tras cada combate y al cambiar de pantalla): cobra las misiones cumplidas y pone otras.
   * Devuelve las cumplidas ahora ([{ id, daily, essence, xp, levels }]) para el aviso.
   */
  function questTick(meta, run, rnd = Math.random) {
    if (!run || !isChar(run.char)) return [];
    prepareRun(meta, run);
    meta.quests = meta.quests || emptyQuests();
    const Q = meta.quests, out = [];
    for (let i = 0; i < Q.active.length; i++) {
      const e = Q.active[i], q = QDEF(e.id);
      if (!q || questProgress(e, run) < q.goal) continue;
      out.push(payQuest(meta, run, e.id, false));
      const n = newQuest(meta, q.tier, run, rnd);
      if (n) Q.active[i] = n; else { Q.active.splice(i, 1); i--; }
    }
    if (Q.daily && !Q.daily.done && QDEF(Q.daily.id) && questProgress(Q.daily, run) >= QDEF(Q.daily.id).goal) {
      Q.daily.done = true;
      out.push(payQuest(meta, run, Q.daily.id, true));
    }
    return out;
  }
  /** Al terminar la partida: cobra las de final de partida y guarda el progreso acumulado. */
  function questFinalize(meta, run) {
    const done = questTick(meta, run);
    const Q = meta.quests;
    for (const e of Q.active.concat(Q.daily && !Q.daily.done ? [Q.daily] : [])) {
      if (e.rid && e.rid !== run.qrid) { delete e.rid; delete e.from; continue; }   // asignada en otra partida que no terminó
      e.prog = questProgress(e, run);
      delete e.rid; delete e.from;
    }
    return done;
  }
  /** Cambiar 1 misión al día (no la diaria). */
  function rerollQuest(meta, index, today = E.todayStr(), rnd = Math.random) {
    ensureQuests(meta, today, rnd);
    const Q = meta.quests, e = Q.active[index];
    if (!e || Q.rerolled === today) return false;
    const q = QDEF(e.id);
    Q.recent = [e.id].concat(Q.recent || []).slice(0, 6);
    const n = newQuest(meta, q.tier, null, rnd);
    if (!n || n.id === e.id) return false;
    Q.active[index] = n;
    Q.rerolled = today;
    return true;
  }
  const canReroll = (meta, today = E.todayStr()) => !meta.quests || meta.quests.rerolled !== today;
  function sanitizeQuests(raw) {
    const Q = emptyQuests();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return Q;
    const cleanE = (e) => (e && typeof e === 'object' && QDEF(e.id) ? { id: e.id, prog: Math.min(QDEF(e.id).goal, num(e.prog)),
      ...(typeof e.rid === 'string' && e.rid ? { rid: e.rid.slice(0, 24), from: num(e.from) } : {}) } : null);
    const seen = new Set();
    Q.active = (Array.isArray(raw.active) ? raw.active : []).map(cleanE).filter((e) => e && !seen.has(e.id) && seen.add(e.id)).slice(0, 3);
    if (raw.daily && isDate(raw.daily.date)) { const d = cleanE(raw.daily); if (d) Q.daily = { ...d, date: raw.daily.date, done: raw.daily.done === true }; }
    Q.rerolled = isDate(raw.rerolled) ? raw.rerolled : '';
    Q.recent = Array.isArray(raw.recent) ? raw.recent.filter((id) => QDEF(id)).slice(0, 6) : [];
    Q.done = num(raw.done);
    return Q;
  }

  /* ---------- Desafío semanal ---------- */
  const WEEK_KEEP = (D && D.WEEKLY && D.WEEKLY.keep) || 12;
  /** Registra un intento del semanal (mejor puntuación; la recompensa, solo la primera vez que se gana esa semana). */
  function recordWeekly(meta, run) {
    const k = run.weekly;
    if (!isDate(k)) return null;
    meta.weekly = meta.weekly || {};
    const x = meta.weekly[k] || { best: 0, result: 'lose', floor: 0, attempts: 0, rewarded: false };
    const score = E.dailyScore(run), first = x.attempts === 0, isNewBest = first || score > x.best;
    x.attempts++;
    if (isNewBest) { x.best = score; x.result = won(run) ? 'win' : 'lose'; x.floor = st(run, 'floors'); }
    let essence = 0;
    if (won(run) && !x.rewarded) {
      x.rewarded = true; essence = D.WEEKLY.essence;
      meta.essence = meta.essence || { earned: 0, spent: 0 }; meta.essence.earned += essence;
    }
    meta.weekly[k] = x;
    meta.weekly = Object.fromEntries(Object.keys(meta.weekly).sort().reverse().slice(0, WEEK_KEEP).map((d) => [d, meta.weekly[d]]));   // las 12 más recientes, en orden
    return { week: k, score, best: x.best, isNewBest, attempts: x.attempts, essence, badge: essence > 0 };
  }
  function sanitizeWeekly(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(raw).filter(isDate).sort().reverse().slice(0, WEEK_KEEP).forEach((k) => {
      const x = raw[k];
      if (!x || typeof x !== 'object' || (x.result !== 'win' && x.result !== 'lose')) return;
      out[k] = { best: num(x.best), result: x.result, floor: num(x.floor), attempts: Math.max(1, num(x.attempts)), rewarded: x.rewarded === true };
    });
    return out;
  }
  /** Semanas con insignia (ganadas), de la más reciente a la más antigua. */
  const weeklyBadges = (meta) => Object.keys(meta.weekly || {}).filter((k) => meta.weekly[k].rewarded).sort().reverse();

  /* ---------- Hitos del compendio ---------- */
  /** Cobra los hitos alcanzados (Esencia; el cosmético se deduce de meta.milestones). Devuelve los nuevos. */
  function claimMilestones(meta) {
    const pr = codexProgress(meta), pct = pr.total ? (100 * pr.seen) / pr.total : 0, fresh = [];
    meta.milestones = meta.milestones || [];
    for (const m of D.CODEX_MILESTONES) {
      if (pct + 1e-9 < m.pct || meta.milestones.includes(m.pct)) continue;
      meta.milestones.push(m.pct);
      meta.essence = meta.essence || { earned: 0, spent: 0 };
      meta.essence.earned += m.essence;
      fresh.push(m);
    }
    meta.milestones.sort((a, b) => a - b);
    return fresh;
  }

  /** Saneado de lo del Parche 3.6 (y migración de metas antiguas: Afinidad desde las partidas jugadas). */
  function sanitize36(raw, m) {
    m.affinity = {};
    if (raw.affinity && typeof raw.affinity === 'object' && !Array.isArray(raw.affinity)) {
      for (const [ch, a] of Object.entries(raw.affinity)) if (isChar(ch) && a && typeof a === 'object') {
        const xp = num(a.xp);
        m.affinity[ch] = { xp, claimed: Math.max(1, Math.min(affinityLevel(xp).level, num(a.claimed) || 1)) };
      }
    } else if (!('affinity' in raw)) {
      // Meta anterior a la 3.6: Afinidad retroactiva (40 por partida y 200 por victoria), con sus niveles ya cobrados
      // (la Esencia de esos niveles se da una vez: claimed se queda en el nivel y la fusión con la nube usa el máximo)
      for (const ch of CHARS) {
        const cs = m.charStats[ch]; if (!cs || !cs.played) continue;
        const xp = cs.played * 40 + cs.wins * 200, L = affinityLevel(xp).level;
        let ess = 0; for (let lv = 2; lv <= L; lv++) ess += ((D.AFFINITY_REWARDS[lv] || {}).essence || 0);
        m.affinity[ch] = { xp, claimed: L };
        m.essence.earned += ess;
      }
    }
    m.loadout = {};
    if (raw.loadout && typeof raw.loadout === 'object' && !Array.isArray(raw.loadout)) for (const [ch, lo] of Object.entries(raw.loadout)) {
      if (!isChar(ch) || !lo || typeof lo !== 'object') continue;
      const x = { relic: (D.ALT_STARTERS[ch] || []).includes(lo.relic) ? lo.relic : '', deck: lo.deck === true };
      for (const slot of D.COSMETIC_SLOTS) x[slot] = D.COSMETICS[slot][lo[slot]] ? lo[slot] : 'none';
      m.loadout[ch] = x;
    }
    m.legacy = {};
    if (raw.legacy && typeof raw.legacy === 'object' && !Array.isArray(raw.legacy)) for (const [ch, id] of Object.entries(raw.legacy)) if (isChar(ch) && typeof id === 'string' && E.legacyOk(id, ch)) m.legacy[ch] = id;
    m.quests = sanitizeQuests(raw.quests);
    m.weekly = sanitizeWeekly(raw.weekly);
    m.milestones = Array.isArray(raw.milestones) ? D.CODEX_MILESTONES.map((x) => x.pct).filter((p) => raw.milestones.includes(p)) : [];
    return m;
  }
  /** Fusión de lo del Parche 3.6 (sin duplicar: máximos, uniones y, para lo que se gasta, el lado más reciente). */
  function merge36(a, b, newer, m) {
    m.affinity = {};
    for (const ch of CHARS) {
      const x = a.affinity[ch], y = b.affinity[ch];
      if (x || y) m.affinity[ch] = { xp: Math.max(x ? x.xp : 0, y ? y.xp : 0), claimed: Math.max(x ? x.claimed : 1, y ? y.claimed : 1) };
    }
    m.loadout = JSON.parse(JSON.stringify(newer.loadout || {}));
    m.legacy = { ...(newer.legacy || {}) };
    m.quests = JSON.parse(JSON.stringify(newer.quests || emptyQuests()));
    m.quests.done = Math.max(a.quests.done || 0, b.quests.done || 0);
    m.weekly = {};
    for (const src of [a, b]) for (const [k, x] of Object.entries(src.weekly || {})) {
      const y = m.weekly[k];
      if (!y) { m.weekly[k] = { ...x }; continue; }
      const best = x.best > y.best ? x : y;
      m.weekly[k] = { best: best.best, result: best.result, floor: best.floor, attempts: Math.max(x.attempts, y.attempts), rewarded: x.rewarded || y.rewarded };
    }
    m.milestones = [...new Set((a.milestones || []).concat(b.milestones || []))];
    return m;
  }

  /* ---------- Momentos destacados (pantalla final) ---------- */
  /** 3-4 tarjetas: golpe más fuerte, carta MVP, reliquia clave, momento épico y lo que te mató. Ids, nunca textos. */
  function highlights(run) {
    const s = run.stats || {}, out = [];
    if (s.maxHitInfo && s.maxHitInfo.dmg > 0) out.push({ kind: 'hit', ...s.maxHitInfo });
    const fx = Object.entries(s.cardFx || {}).filter(([id]) => D.CARDS[id]).map(([id, v]) => ({ id, dmg: v.dmg || 0, block: v.block || 0, total: (v.dmg || 0) + (v.block || 0) }))
      .sort((x, y) => y.total - x.total || (x.id < y.id ? -1 : 1));
    if (fx.length && fx[0].total > 0) out.push({ kind: 'mvp', card: fx[0].id, dmg: fx[0].dmg, block: fx[0].block });
    const ru = Object.entries(s.relicUses || {}).filter(([id]) => D.ALL_RELICS[id] && (run.relics || []).includes(id)).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
    if (ru.length) out.push({ kind: 'relic', relic: ru[0][0], n: ru[0][1] });
    const epic = s.bossOneShot ? { kind: 'epic', epic: 'oneshot', enemy: s.bossOneShot.enemy, dmg: s.bossOneShot.dmg, card: s.bossOneShot.card }
      : (s.hpLow || 0) > 0 && s.minHp ? { kind: 'epic', epic: 'lowhp', hp: s.minHp }
      : (s.maxCombo || 0) >= 7 ? { kind: 'epic', epic: 'combo', n: s.maxCombo } : null;
    if (epic) out.push(epic);
    if (run.over && run.over.result === 'lose' && run.over.killerId && D.ENEMIES[run.over.killerId]) out.push({ kind: 'killer', enemy: run.over.killerId, move: run.over.killerMove || null });
    // como mucho 4: si sobra, se quita la reliquia (lo que te mató siempre sale)
    while (out.length > 4) { const i = out.findIndex((h) => h.kind === 'relic'); out.splice(i >= 0 ? i : out.length - 2, 1); }
    return out;
  }

  /** Suma al desglose de Esencia lo de misiones, niveles, hitos y semanal. */
  function addBonusEss(essence, b) {
    for (const [k, v] of Object.entries(b || {})) if (v > 0) { essence[k] = v; essence.gained += v; }
  }
  /** Fin de partida (todos los modos): misiones, Afinidad, hitos y la oferta de Legado. */
  function runEnd36(meta, run) {
    const quests = questFinalize(meta, run);
    const ch = isChar(run.char) ? run.char : 'piromago';
    const xp = xpForRun(run), aff = grantAffinity(meta, ch, xp.total);
    const start = run.affStart ? run.affStart.xp : aff.before;
    const levels = [];   // niveles subidos en toda la partida (también con la XP de las misiones)
    for (let lv = affinityLevel(start).level + 1; lv <= affinityLevel(aff.after).level; lv++) levels.push({ level: lv, reward: D.AFFINITY_REWARDS[lv] || {} });
    const milestones = claimMilestones(meta);
    const lore = loreRunEnd(meta, run);   // Parche 3.7: fragmentos de lore
    // Esencia que también entra con esta partida (para el desglose de la pantalla final; ya está sumada en meta)
    const qs = run.questsDone || quests;
    const bonusEss = { quests: qs.reduce((a, q) => a + (q.essence || 0), 0), levels: levels.reduce((a, l) => a + ((l.reward && l.reward.essence) || 0), 0),
                       milestones: milestones.reduce((a, m) => a + m.essence, 0) };
    return { bonusEss, affinity: { char: ch, xp, from: start, to: aff.after, levels, questXp: Math.max(0, aff.before - start) }, quests: run.questsDone || quests, milestones,
             legacyOffer: legacyEligible(run) && legacyChoices(run).length > 0, highlights: highlights(run), lore };
  }

  /* =====================================================================
   * Parche 3.7 — Lore: 24 fragmentos (meta.lore), intro vista (meta.introSeen) y lo que cuentan sus condiciones:
   *   meta.bossKillsBy[pj] = [jefes derrotados con él] · meta.combatsWon · meta.contractsDone · meta.bossReach (último acto con jefe visto)
   * ===================================================================== */
  const codexKills = (meta, id) => ((((meta.codex || {}).enemies || {})[id] || {}).kills || 0);
  /** ¿Se cumple la condición de un fragmento? `run` (opcional) suma lo de la partida en curso sin tocar la meta. */
  function loreCond(meta, cond, run) {
    const [k, a, b] = String(cond).split(':'), rs = (run && run.stats) || {};
    const by = (ch) => ((meta.bossKillsBy || {})[ch] || []).concat(run && run.char === ch ? rs.bossIds || [] : []);
    switch (k) {
      case 'runs': return (meta.played || 0) >= 1;
      case 'act1boss': return Math.max(meta.bossReach || 0, rs.bossReached || 0) >= 1;
      case 'combats': return (meta.combatsWon || 0) + (rs.combatsWon || 0) >= Number(a);
      case 'death': return (meta.played || 0) > (meta.wins || 0) || CHARS.some((ch) => ((meta.charStats || {})[ch] || {}).played > ((meta.charStats || {})[ch] || {}).wins);
      case 'kill': return codexKills(meta, a) > 0 || CHARS.some((ch) => by(ch).includes(a));
      case 'killas': return by(b).includes(a);
      case 'aff5': return affLevelOf(meta, a) >= 5;
      case 'contracts': return (meta.contractsDone || 0) + (run && run.contract && run.contract.state === 'done' && !run.over ? 1 : 0) >= Number(a);
      case 'ascwin': return CHARS.some((ch) => Object.keys(ascWinsOf(meta, ch)).some((lv) => Number(lv) >= Number(a) && ascWinsOf(meta, ch)[lv] > 0));
      case 'allsix': return CHARS.every((ch) => ((meta.charStats || {})[ch] || {}).wins > 0);
      case 'all': return D.LORE_IDS.filter((id) => D.LORE[id].cond !== 'all').every((id) => (meta.lore || []).includes(id));
      default: return false;
    }
  }
  /** Desbloquea los fragmentos que tocan (también con la partida en curso). Devuelve los nuevos (ids, en orden). */
  function loreSync(meta, run) {
    meta.lore = meta.lore || [];
    const fresh = [];
    for (let pass = 0; pass < 2; pass++) {   // la 2.ª vuelta, por si el último fragmento («los otros 23») se acaba de completar
      for (const id of D.LORE_IDS) if (!meta.lore.includes(id) && loreCond(meta, D.LORE[id].cond, run)) { meta.lore.push(id); fresh.push(id); }
    }
    meta.lore = D.LORE_IDS.filter((id) => meta.lore.includes(id));
    return fresh;
  }
  /** Al terminar la partida (todos los modos): suma lo que cuentan los fragmentos y los desbloquea. */
  function loreRunEnd(meta, run) {
    const s = run.stats || {};
    meta.combatsWon = (meta.combatsWon || 0) + (s.combatsWon || 0);
    if (run.contract && run.contract.state === 'done') meta.contractsDone = (meta.contractsDone || 0) + 1;
    meta.bossReach = Math.max(meta.bossReach || 0, s.bossReached || 0);
    if (isChar(run.char) && (s.bossIds || []).length) {
      meta.bossKillsBy = meta.bossKillsBy || {};
      meta.bossKillsBy[run.char] = [...new Set((meta.bossKillsBy[run.char] || []).concat(s.bossIds.filter((id) => D.ENEMIES[id])))];
    }
    return loreSync(meta);
  }
  /** Saneado (y migración: metas viejas estiman los combates ganados y el jefe del Acto I con el compendio). */
  function sanitize37(raw, m) {
    m.introSeen = raw.introSeen === true;
    m.lore = Array.isArray(raw.lore) ? D.LORE_IDS.filter((id) => raw.lore.includes(id)) : [];
    m.bossKillsBy = {};
    if (raw.bossKillsBy && typeof raw.bossKillsBy === 'object' && !Array.isArray(raw.bossKillsBy)) {
      for (const [ch, ids] of Object.entries(raw.bossKillsBy)) if (isChar(ch) && Array.isArray(ids)) { const ok = [...new Set(ids.filter((id) => D.ENEMIES[id]))]; if (ok.length) m.bossKillsBy[ch] = ok; }
    }
    const kills = Object.values((m.codex || {}).enemies || {}).reduce((t, e) => t + (e.kills || 0), 0);
    m.combatsWon = 'combatsWon' in raw ? num(raw.combatsWon) : Math.floor(kills * 0.6);
    m.contractsDone = num(raw.contractsDone);
    const sawBoss1 = Object.keys((m.codex || {}).enemies || {}).some((id) => (D.ENEMIES[id] || {}).tier === 'boss' && E.bossAct(id) === 1 && m.codex.enemies[id].seen);
    m.bossReach = 'bossReach' in raw ? Math.min(3, num(raw.bossReach)) : sawBoss1 ? 1 : 0;
    return m;
  }
  function merge37(a, b, m) {
    m.introSeen = !!(a.introSeen || b.introSeen);
    m.lore = [...new Set((a.lore || []).concat(b.lore || []))];
    m.bossKillsBy = {};
    for (const src of [a, b]) for (const [ch, ids] of Object.entries(src.bossKillsBy || {})) m.bossKillsBy[ch] = [...new Set((m.bossKillsBy[ch] || []).concat(ids))];
    m.combatsWon = Math.max(a.combatsWon || 0, b.combatsWon || 0);
    m.contractsDone = Math.max(a.contractsDone || 0, b.contractsDone || 0);
    m.bossReach = Math.max(a.bossReach || 0, b.bossReach || 0);
    return m;
  }
  const winRate = (meta) => (meta.played ? Math.round((100 * meta.wins) / meta.played) : 0);

  const Meta = { GROUP_WINS_UNLOCK, groupWinsWith, enemyIdByName, unlockedIds, isUnlocked, lockedBy, rewardName, REWARD_OF, cmpVersion, hasUnreadNews, KEY, ACHIEVEMENTS, BY_ID, DAILY_MAX, MAX_ASC, TIP_IDS, shouldShowTip, markTip, resetTips,
                 empty, sanitize, load, save, onCombatEnd, onRunEnd, winRate, mergeMeta, mergeRun, hasProgress,
                 maxAsc, ascWinsOf, checkUnlocks, UNLOCKS,
                 CODEX_FIELDS, codexIds, codexSee, codexAdd, codexRunEnd, codexProgress,
                 prevDay, currentDailyStreak, lastDailies,
                 essenceBalance, upgradeLevel, nextUpgradeCost, upgradesCost, allUpgradesCost, canAffordAny, buyUpgrade,
                 // Parche 3.6
                 affinityLevel, xpToLevel, xpForRun, grantAffinity, affinityUnlocks, nextAffinityReward, affLevelOf, ownsCosmetic, loadoutOf, setLoadout, runOptsFor, titleText,
                 legacyOf, legacyEligible, legacyChoices, setLegacy, prepareRun,
                 questStat, questProgress, questEligible, ensureQuests, questTick, questFinalize, rerollQuest, canReroll, questReward, dailyQuestId, END_ONLY,
                 recordWeekly, weeklyBadges, claimMilestones, highlights,
                 // Parche 3.7
                 loreCond, loreSync, loreRunEnd };

  if (typeof module !== 'undefined' && module.exports) module.exports = Meta;
  else root.CM_META = Meta;
})(typeof globalThis !== 'undefined' ? globalThis : this);
