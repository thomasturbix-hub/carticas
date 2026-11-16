/* =====================================================================
 * Carticas Mágicas — scenes.js
 * Escenas Phaser. Cada escena LEE el estado de `run` (registry) y llama
 * al motor para cambiarlo; ninguna guarda copias propias del estado.
 * ===================================================================== */
(function (root) {
  'use strict';
  const E = root.CM_ENGINE, D = E.D;
  const U = root.CM_UI;
  const { C, T, tw, wait, button, cardView, hud, tooltip, backdrop, floatText, popNumber, burst, banner, toast, Sfx, Music } = U;
  const A = root.CM_ANIM;   // pase de animaciones (solo presentación)
  const FL = root.CM_FEEL;  // pase de «game feel» (confeti, rayos, flecha de apuntado, viñeta de PV bajos…)
  const LY = U.LAYER;       // capas de dibujo (nunca profundidades sueltas)
  const FX_DONE = new WeakSet();   // botines cuyo oro ya voló al contador
  /** Cartas con sonido propio al jugarlas (en vez de fire_cast). */
  const BIG_FIRE_CARDS = ['llamarada', 'combustion'];
  const NOVA_CARDS = ['supernova', 'pira'];

  const M = root.CM_META;
  const I18N = root.CM_I18N;
  /** Traduce (clave, variables) o un mensaje guardado {k, v}. */
  const _t = (k, v) => I18N.t(k, v);

  /** Récords y logros: se cargan del almacenamiento cada vez (son pocos datos). */
  const loadMeta = () => M.load(U.Store);
  const saveMeta = (meta) => M.save(U.Store, meta);
  /** Muestra avisos de logros en la capa superior (sobrevive a los cambios de escena). */
  function notifyAchievements(scene, list) {
    if (!list || !list.length) return;
    const t = scene.scene.get('Overlay');
    if (t && t.push) t.push(list);
  }
  /* ---------- Fechas y números: Intl con el idioma actual ---------- */
  const fmtDate = (iso, withYear = true) => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return I18N.date(d, withYear ? { day: '2-digit', month: '2-digit', year: 'numeric' } : { day: '2-digit', month: '2-digit' });
  };
  /** Fecha corta «27/10/26» (tarjetas de logro). */
  const fmtDateShort = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : I18N.date(d, { day: '2-digit', month: '2-digit', year: '2-digit' }); };
  /** "2026-10-23" → "Viernes 23 oct" / "Friday 23 Oct" (o sin día de la semana). Fecha local, sin UTC. */
  function fmtDay(dateStr, weekday = true) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const t = new Date(y, m - 1, d);
    const s = I18N.date(t, weekday ? { weekday: 'long', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' }).replace(',', '').replace('.', '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  /** 1840 → "1.840" / "1,840" (siempre agrupado). */
  const fmtScore = (n) => I18N.score(n);

  const QUEST_OPEN_KEY = 'cm_quests_open';
  const SAVE_WARN_KEY = 'cm_localwarn';      // aviso «tu progreso se guarda en este dispositivo» ya cerrado (savecode.js no lo exporta)   // panel de misiones del título abierto (1) o plegado (0)
  const ESS_C = U.TH.game.essence;            // Esencia Arcana (texto); sin violeta en la interfaz
  /* ---------- Sistema visual (src/ui/theme.js): tokens y componentes; nada de valores sueltos ---------- */
  const TH = U.TH, SZ = TH.size, DUR = TH.dur, TC = TH.color, SP = TH.space, Panel = root.CM_Panel;
  /** Cortina oscura a pantalla completa que bloquea lo de debajo (ventanas). */
  const curtain = (scene, a = TH.alpha.curtain) => scene.add.rectangle(640, 360, 1280, 720, TC.shade, a).setInteractive();
  /* ---------- Ascensión: nivel elegido en el título (recordado en este navegador) ---------- */
  const ASC_KEY = 'cm_asc_sel';
  /** Nivel elegido, limitado al máximo desbloqueado (Store ya protege con try/catch). */
  function selectedAsc(meta = loadMeta(), ch = meta.lastChar || 'piromago') {
    return Math.min(M.maxAsc(meta, ch), E.clampAsc(U.Store.get(ASC_KEY + ':' + ch) ?? U.Store.get(ASC_KEY)));
  }
  /** Arte del personaje de la partida (clave de textura). */
  const charArt = (run) => 'art_' + E.charDef(run).art;
  const ascRule = (n) => (n > 0 ? `A${n}: ${D.ASCENSION[n - 1].text}` : _t('asc.none'));
  /** Reglas activas de un nivel (acumulativas), una por línea. */
  const ascRules = (n) => D.ASCENSION.filter((r) => r.level <= n).map((r) => `A${r.level} · ${r.text}`).join('\n');

  /**
   * Etiquetas discretas de la partida, arriba a la derecha bajo el HUD: «Diario · 23 oct» y/o «A3».
   * La de Ascensión muestra la lista de reglas activas al pasar el ratón o al pulsarla.
   */
  function runTags(scene, run) {
    if (!run) return;
    let right = 1252;
    const pill = (label, color) => {
      const t = T(scene, right - 12, 70, label, { size: 14, bold: true, color, ox: 1 }).setDepth(LY.panel + 51);
      const x0 = right - t.width - 24, w = t.width + 24;
      const g = scene.add.graphics().setDepth(LY.panel + 50);
      g.fillStyle(0x080b0a, 0.75); g.fillRoundedRect(x0, 58, w, 24, 12);
      g.lineStyle(1, color, 0.6); g.strokeRoundedRect(x0, 58, w, 24, 12);
      right = x0 - 8;
      return { x0, w };
    };
    if (run.daily) pill(_t('s.diario_0', { 0: fmtDay(run.daily, false) }), C.gold);
    if (run.custom) {   // Personalizada: dificultad; al pasar el ratón, el código y los modificadores
      const d = E.customDifficulty(run.custom);
      const { x0, w } = pill(`${_t('cust.tag')} · ${d.name}`, d.color);
      const tip = scene.tip || tooltip(scene);
      const hit = scene.add.zone(x0 + w / 2, 70, w, 24).setDepth(LY.panel + 52).setInteractive({ useHandCursor: true });
      const show = () => tip.show(Math.max(10, x0 + w - 360), 88, U.codeShow(run.custom.code),
        run.custom.mods.map((id) => `${D.CUSTOM_MODS[id].name}: ${D.CUSTOM_MODS[id].text}`).join('\n') || _t('cust.noMods'));
      hit.on('pointerover', show); hit.on('pointerout', () => tip.hide()); hit.on('pointerup', show);
    }
    const n = run.ascension || 0;
    if (n > 0) {
      const { x0, w } = pill(`A${n}`, C.ember);
      const tip = scene.tip || tooltip(scene);
      const hit = scene.add.zone(x0 + w / 2, 70, w, 24).setDepth(LY.panel + 52).setInteractive({ useHandCursor: true });
      let open = false;
      const show = () => tip.show(x0 + w - 330, 88, _t('s.ascension_0', { 0: n }), ascRules(n));
      hit.on('pointerover', show);
      hit.on('pointerout', () => { if (!open) tip.hide(); });
      hit.on('pointerup', () => { open = !open; if (open) show(); else tip.hide(); });   // táctil
    }
    if (E.actOf(run) >= 2) pill(_t('s.acto_0', { 0: ROMAN[E.actOf(run)] }), E.actOf(run) >= 3 ? 0xc9a8ff : C.frost);
    if ((run.pacts || []).length) {
      const { x0, w } = pill(_t('s.pactos_0', { 0: fmtMult(E.pactBonus(run)) }), C.arcane);
      const tip = scene.tip || tooltip(scene);
      const hit = scene.add.zone(x0 + w / 2, 70, w, 24).setDepth(LY.panel + 52).setInteractive({ useHandCursor: true });
      const show = () => tip.show(Math.max(10, x0 + w - 360), 88, _t('s.pactos_activos_0_a_la', { 0: fmtMult(E.pactBonus(run)) }), run.pacts.map((id) => `${D.PACTS[id].name}: ${D.PACTS[id].text}`).join('\n'));
      hit.on('pointerover', show); hit.on('pointerout', () => tip.hide()); hit.on('pointerup', show);
    }
  }
  /** Nombre del enemigo que te derrotó: guardado por id (killerId); historiales antiguos guardaban el nombre. */
  const killerName = (o) => { if (!o) return '…'; const id = o.killerId || M.enemyIdByName(o.killer); return id && D.ENEMIES[id] ? D.ENEMIES[id].name : (o.killer || '…'); };
  /** «×1,45» */
  const fmtMult = (b) => I18N.mult(1 + b);
  const PACTS_KEY = 'cm_pacts';
  const NOUPG_KEY = 'cm_noupg';   // interruptor «Jugar sin mejoras del Santuario»
  /** Pactos guardados para la próxima partida (solo ids válidos). */
  function savedPacts() {
    try { const a = JSON.parse(U.Store.get(PACTS_KEY) || '[]'); return Array.isArray(a) ? a.filter((id) => D.PACTS[id]) : []; } catch (e) { return []; }
  }
  const ROMAN = { 1: 'I', 2: 'II', 3: 'III' };

  /** Empieza (o reintenta) el desafío de una fecha y arranca como una partida normal. */
  function startDaily(scene, dateStr = E.todayStr()) {
    scene.registry.set('run', E.newDailyRun(dateStr));
    go(scene);
  }
  /** Desafío semanal (Parche 3.6): una personalizada fija de la semana (guardado de las personalizadas). */
  function startWeekly(scene, key = E.weekKey()) {
    scene.registry.set('run', E.newWeeklyRun(key));
    go(scene);
  }
  /** «9 nov – 15 nov»: la semana de un lunes. */
  function fmtWeek(key) {
    const [y, m, d] = key.split('-').map(Number), t = new Date(y, m - 1, d + 6);
    const p = (n) => String(n).padStart(2, '0');
    return `${fmtDay(key, false)} – ${fmtDay(`${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`, false)}`;
  }
  /** Texto de una recompensa de Afinidad («+30 de Esencia», «Reliquia inicial: …», «Marco de carta: Plata»…). */
  function affRewardText(r, ch) {
    if (!r) return '';
    if (r.essence) return _t('aff.rw.essence', { n: r.essence });
    if (r.relic !== undefined) { const id = D.ALT_STARTERS[ch][r.relic]; return _t('aff.rw.relic', { r: D.ALL_RELICS[id].name }); }
    if (r.deck) return _t('aff.rw.deck');
    if (r.title) return _t('aff.rw.title', { t: D.AFFINITY_TITLES[ch] });
    for (const slot of ['frame', 'back', 'aura']) if (r[slot]) return _t('aff.rw.' + slot, { n: D.COSMETICS[slot][r[slot]].name });
    return '';
  }
  /** Lista entera de recompensas de Afinidad de un personaje (tooltip de la barra). */
  function affRewardList(meta, ch) {
    const L = M.affLevelOf(meta, ch), out = [];
    for (let lv = 2; lv <= D.AFFINITY_MAX; lv++) out.push(`${lv <= L ? '✓' : '·'} ${_t('aff.lvShort', { n: lv })}: ${affRewardText(D.AFFINITY_REWARDS[lv], ch)}`);
    return out.join('\n');
  }
  /** Aviso de lore: uno solo aunque sean varios («3 fragmentos de lore desbloqueados»). */
  function loreToast(scene, ids) {
    if (!ids || !ids.length) return;
    if (ids.length === 1) U.questToast(scene, _t('lore.new'), D.LORE[ids[0]].title, 0xc9a8ff);
    else U.questToast(scene, _t('lore.newN', { n: ids.length }), ids.map((id) => D.LORE[id].title).join(' · '), 0xc9a8ff);
  }
  /** Misiones: cobra las cumplidas en la partida y avisa sin interrumpir (toast arriba a la derecha). */
  function questHook(scene, run) {
    if (!run || run.over || !D.CHARACTERS[run.char]) return;
    const m = loadMeta(), fresh = !run.qrid;
    M.ensureQuests(m);
    const done = M.questTick(m, run);
    const lf = M.loreSync(m, run);   // Parche 3.7: lore que se gana durante la partida (jefes, combates, Afinidad…)
    if (fresh || done.length || lf.length) saveMeta(m);
    loreToast(scene, lf);
    done.forEach((q) => U.questToast(scene, q.daily ? _t('q.dailyDone') : _t('q.done'), `${D.QUESTS[q.id].text} · ${_t('q.reward', { e: q.essence, x: q.xp })}`));
  }

  /* ---------- Depuración y tests: consejos pedidos en cada pantalla y forzarlos ---------- */
  const TIP_LOG = [];
  root.CM_DEBUG = {
    TIP_LOG,
    /** Consejos pedidos por las escenas que siguen activas (id, escena) sin repetir. */
    tipsHere() {
      const seen = new Set();
      return TIP_LOG.filter((t) => t.scene.sys && t.scene.sys.isActive() && !seen.has(t.key + t.id) && seen.add(t.key + t.id)).map((t) => ({ key: t.key, id: t.id }));
    },
    /** Muestra YA el consejo `id` tal y como lo pidió su escena (aunque esté visto); no lo marca como visto. */
    forceTip(key, id) {
      const t = TIP_LOG.slice().reverse().find((x) => x.key === key && x.id === id && x.scene.sys && x.scene.sys.isActive());
      if (!t) return false;
      U.tips(t.scene).push({ id: '__force_' + id, text: TIPS[id], rect: t.rect });
      return true;
    },
    TIPS: () => TIPS,
    /** Cierra el consejo abierto y vacía las colas (para auditar la pantalla sin consejos). */
    closeTips() {
      const m = loadMeta(); m.tipsOff = true; saveMeta(m);   // los normales ya no salen; los forzados (forceTip) sí
      for (const sc of this.game().scene.getScenes(true)) { if (sc._tipQ) sc._tipQ.items.length = 0; if (sc._tipClose) sc._tipClose(false); }
    },
    game: () => root.CM_GAME
  };

  /* ---------- Consejos contextuales: textos (presentación) ---------- */
  const TIPS = {
    get mapa() { return _t('s.elige_tu_camino_cada_icono'); },
    get energia() { return _t('s.cada_carta_cuesta_energia_la'); },
    get intencion() { return _t('s.esto_es_lo_que_hara'); },
    get temp() { return _t('s.tus_hechizos_suben_la_temperatura'); },
    get quemadura() { return _t('s.la_quemadura_hace_dano_al'); },
    get fin() { return _t('s.cuando_no_puedas_o_no'); },
    get recompensa() { return _t('s.elige_una_carta_para_tu'); },
    get hoguera() { return _t('s.descansa_para_recuperar_vida_o'); },
    get tienda() { return _t('s.gasta_tu_oro_en_cartas'); },
    get evento() { return _t('s.cada_evento_te_pide_una'); },
    get cofre() { return _t('s.abrelo_y_llevate_una_reliquia'); },
    get ascension() { return _t('s.has_desbloqueado_la_ascension_cada'); },
    // Acto II
    get frio() { return _t('s.el_frio_de_las_cumbres'); },
    get maldicion() { return _t('s.las_maldiciones_no_se_pueden'); },
    get reliquiaJefe() { return _t('s.las_reliquias_de_jefe_son'); },
    get pocion() { return _t('s.las_pociones_se_usan_cuando'); },
    get palabrasClave() { return _t('s.las_palabras_en_dorado_son'); },
    // Criomante
    get runas() { return _t('s.tus_runas_actuan_solas_al'); },
    get escarcha() { return _t('s.la_escarcha_debilita_los_ataques'); },
    get congelado() { return _t('s.congelado_el_enemigo_pierde_su'); },
    // Invocadora
    get arcano() { return _t('s.en_la_caverna_arcana_los'); },
    get esencia() { return _t('s.cada_partida_te_da_esencia'); },
    get invocar() { return _t('s.tus_criaturas_atacan_solas_al'); },
    // Paladín
    get juicio() { return _t('tip.juicio'); },
    get fervor() { return _t('tip.fervor'); },
    // Electromante
    get estatica() { return _t('tip.estatica'); },
    get rayo() { return _t('tip.rayo'); },
    get senda() { return _t('tip.senda'); }
  };
  /** Consejo 'pocion': la primera vez que tienes una (señala la barra de pociones del HUD). */
  const potionTip = (scene) => { const run = scene.registry.get('run'); if (run && (run.potions || []).some(Boolean) && scene.hud) showTip(scene, 'pocion', scene.hud.potionRect()); };
  /** Glosario de palabras clave de una carta (debajo, o encima si no cabe). */
  const showGloss = (scene, card, obj, dy = 0) => {
    scene._gloss = scene._gloss || U.glossary(scene);
    const w = U.CARD_W * obj.scale, h = U.CARD_H * obj.scale;
    scene._gloss.show(card, { x: obj.x - w / 2, y: obj.y - h / 2 + dy, w, h });
  };
  const hideGloss = (scene) => { if (scene._gloss) scene._gloss.hide(); };
  /** Zona de un objeto del juego en coordenadas de pantalla. */
  const boundsOf = (o, grow = 0) => { const b = o.getBounds(); return { x: b.x - grow, y: b.y - grow, w: b.width + grow * 2, h: b.height + grow * 2 }; };
  /**
   * Pide un consejo: solo se encola si el jugador no lo ha visto ni los ha desactivado.
   * rect puede ser una función: se evalúa justo al mostrarlo (posiciones ya colocadas).
   */
  function showTip(scene, id, rect) {
    // Registro de qué consejos PUEDEN salir en cada pantalla (aunque ya se hayan visto): lo usa test/overlap.js
    TIP_LOG.push({ scene, key: scene.sys.settings.key, id, rect });
    if (TIP_LOG.length > 60) TIP_LOG.shift();
    if (!M.shouldShowTip(loadMeta(), id)) return;
    U.tips(scene).push({
      id, text: TIPS[id], rect,
      canShow: () => M.shouldShowTip(loadMeta(), id),
      onClose: (skipped) => {
        const m = loadMeta();
        M.markTip(m, id);
        if (skipped) m.tipsOff = true;   // «Saltar consejos»
        saveMeta(m);
      }
    });
  }

  /** Va a la pantalla que corresponde al estado actual (y guarda). */
  /* ---------- Compendio: registro en memoria; se guarda al cambiar de pantalla y al acabar cada combate ---------- */
  const Codex = {
    ops: [], seenKeys: new Set(), snap: null,
    see(type, id) { const k = type + ':' + id; if (!id || this.seenKeys.has(k)) return; this.seenKeys.add(k); this.ops.push(['see', type, id]); },
    add(type, id, field, n = 1) { if (id) this.ops.push(['add', type, id, field, n]); },
    /**
     * Compara lo que tiene el jugador con la última foto: cartas nuevas del mazo → picked,
     * reliquias nuevas → got, pociones nuevas → got. Al empezar (o recargar) solo hace la foto.
     */
    track(run) {
      if (!run) return;
      const key = run.seed + '|' + (run.daily || '') + '|' + (run.ascension || 0);
      const count = (arr) => arr.reduce((m, id) => { if (id) m[id] = (m[id] || 0) + 1; return m; }, {});
      const now = { key, uids: new Set(run.deck.map((c) => c.uid)), relics: new Set(run.relics), pots: count(run.potions || []) };
      if (this.snap && this.snap.key === key) {
        for (const c of run.deck) if (!this.snap.uids.has(c.uid)) this.add('cards', c.id, 'picked');
        for (const r of run.relics) if (!this.snap.relics.has(r)) this.add('relics', r, 'got');
        for (const [id, n] of Object.entries(now.pots)) if (n > (this.snap.pots[id] || 0)) this.add('potions', id, 'got', n - (this.snap.pots[id] || 0));
      }
      run.deck.forEach((c) => this.see('cards', c.id));
      run.relics.forEach((r) => this.see('relics', r));
      Object.keys(now.pots).forEach((id) => this.see('potions', id));
      this.snap = now;
    },
    /** Vuelca lo acumulado en la meta (una sola escritura: local + nube con su debounce). */
    flush() {
      if (!this.ops.length) return;
      const m = loadMeta(), at = new Date().toISOString();
      for (const [kind, type, id, field, n] of this.ops) {
        if (kind === 'see') M.codexSee(m, type, id, at); else M.codexAdd(m, type, id, field, n, at);
      }
      this.ops = [];
      saveMeta(m);
    }
  };
  root.CM_CODEX = Codex;

  function go(scene, data) {
    const run = scene.registry.get('run');
    Codex.track(run);
    questHook(scene, run);                              // Parche 3.6: misiones (y Legado gastado al empezar)
    if (run) U.Look.set(run.look, run.char);            // cosméticos de la partida (marco, dorso y aura)
    if (E.screenFor(run) !== 'Combat') Codex.flush();
    U.saveRun(run);
    scene.scene.stop('DeckView');
    scene.scene.start(E.screenFor(run), data || {});
  }

  /** Título de pantalla con subtítulo opcional. */
  function heading(scene, y, title, sub, color = C.gold) {
    U.fitLine(T(scene, 640, y, title, { size: SZ.h1, font: 'display', color, stroke: TC.shade, strokeThickness: 5 }), 1000, SZ.h2);   // título de pantalla (h1)
    if (sub) U.fitLine(T(scene, 640, y + 48, sub, { size: SZ.body, color: C.muted, style: 'italic' }), 1000, SZ.small);
  }

  /* =================================================================
   * Boot: genera texturas procedurales
   * ================================================================= */
  /** Arte provisional del Acto II: textura de un enemigo parecido + tinte azul hielo.
   *  Para poner el arte real basta con añadir assets/<id>.png (mismo id que en data.js). */
  const ENEMY_FALLBACK = {
    murcielago: 'rat', espiritu: 'witch', huargo: 'wolf', yeti: 'wolf',
    cazador: 'bandit', golem: 'treant', hechicera: 'witch', wyrm: 'guardian'
  };
  /** Dibujos que miran a la derecha (data.js: flip) → se voltean para mirar a la izquierda, hacia el personaje.
   *  Va por arte: un sustituto (ENEMY_FALLBACK) hereda el volteo del dibujo que usa. */
  const ART_FLIP = {};
  Object.values(D.ENEMIES).forEach((e) => { if (e.flip) ART_FLIP[e.art] = true; });
  const flipOf = (key) => !!ART_FLIP[String(key).replace(/^art_/, '')];
  const ICE_TINT = 0x9fd6ff;
  /** Acto III: arte provisional = enemigo parecido teñido de violeta arcano (assets/<id>.png lo sustituye). */
  const ARCANE_TINT = 0xb27bff;
  const ARCANE_FALLBACK = { duende: 'rat', fatuo: 'shroom', grimorio: 'bandit', centinela: 'golem', acolito: 'hechicera',
    espejo: 'yeti', archimago: 'witch', ojo: 'wyrm' };
  Object.assign(ENEMY_FALLBACK, ARCANE_FALLBACK);
  /** Jefes alternativos (Parche 2.9): arte provisional = enemigo parecido con su propio tinte (assets/<id>.png lo sustituye). */
  const BOSS_FALLBACK = { matriarca: 'shroom', alfa: 'wolf', titan: 'golem', espectro: 'espiritu', lich: 'archimago', devorador: 'grimorio' };
  const BOSS_TINT = { matriarca: 0xc6f08a, alfa: 0xff9a7a, titan: 0xbfe6ff, espectro: 0x9fc8ff, lich: 0xd2a8ff, devorador: 0xff8ad8 };
  Object.assign(ENEMY_FALLBACK, BOSS_FALLBACK);
  const fallbackTint = (id) => (BOSS_TINT[id] || (ARCANE_FALLBACK[id] ? ARCANE_TINT : ICE_TINT));
  /** Criaturas: arte de enemigo de respaldo si falta el PNG propio; REAL_SUMMON = las que tienen arte real. */
  const SUMMON_FALLBACK = { lobezno: 'wolf', treant: 'treant', hada: 'shroom', espiritu: 'guardian' };
  const REAL_SUMMON = new Set();
  /** Tema de fondo según acto y tipo de sala. */
  const themeFor = (run, boss) => (E.actOf(run) >= 3 ? (boss ? 'arcaneboss' : 'arcane') : E.actOf(run) >= 2 ? (boss ? 'frostboss' : 'frost') : (boss ? 'boss' : 'forest'));

  /** Copia una textura multiplicando su color (conserva la transparencia). */
  function tintedCopy(scene, src, key, tint) {
    const img = scene.textures.get(src).getSourceImage();
    const cv = scene.textures.createCanvas(key, img.width, img.height);
    const ctx = cv.getContext();
    ctx.drawImage(img, 0, 0);
    // 'color': conserva la luz y sombra del dibujo y le pone el tono del personaje (el rojo pasa a hielo)
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = '#' + tint.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, img.width, img.height);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(200,235,255,0.35)';
    ctx.fillRect(0, 0, img.width, img.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    cv.refresh();
  }

  class Boot extends Phaser.Scene {
    constructor() { super('Boot'); }
    /** Arte real. Usa las mismas claves que el procedural: si un archivo falla, se genera el placeholder. */
    preload() {
      this.load.image('art_mage', 'assets/piromago.png');
      this.load.image('art_criomante', 'assets/criomante.png');   // si no existe: Piromago tintado (tintedCopy)
      D.SUMMON_IDS.forEach((id) => this.load.image(D.SUMMONS[id].art, `assets/summons/${id}.png`));   // arte real de las criaturas ('sum_<id>')
      this.load.image('art_guardiana', 'assets/guardiana.png');   // ídem, en piedra/ámbar
      this.load.image('art_invocadora', 'assets/invocadora.png'); // ídem, en verde bosque
      this.load.image('art_paladin', 'assets/paladin.png');       // ídem, en dorado
      this.load.image('art_electromante', 'assets/electromante.png');   // ídem, en azul eléctrico
      this.load.image('art_shroom', 'assets/seta.png');
      this.load.image('art_rat', 'assets/rata.png');
      this.load.image('art_wolf', 'assets/lobo.png');
      // Acto I (lote 3): si existen, sustituyen al arte procedural (makeTextures no sobrescribe)
      ['bandit', 'treant', 'witch', 'guardian'].forEach((k) => this.load.image('art_' + k, `assets/${k}.png`));
      U.ICON_FILES.forEach((k) => this.load.image('ic_' + k, `assets/icons/${k}.png`));   // iconos reales (si falta uno: procedural)
      U.FRAME_IDS.forEach((k) => this.load.image('frame_' + k, `assets/frames/frame_${k}.webp`));   // marcos de carta por personaje
      ['shop', 'forge', 'rest', 'treasure', 'altar'].forEach((k) => this.load.image('bg_' + k, `assets/bg/bg_${k}.webp`));   // fondos ilustrados
      this.load.image('bg_title', 'assets/bg_title.jpg');
      this.load.atlas('fx', 'assets/fx/fx.png', 'assets/fx/fx.json');   // partículas blancas para teñir (Fx)
      this.load.image('bg_forest', 'assets/bosque_combate.jpg');
      // Acto II: si existe assets/<id>.png se usa; si no, buildEnemy pone un sustituto tintado (ENEMY_FALLBACK)
      Object.keys(ENEMY_FALLBACK).forEach((id) => this.load.image('art_' + id, 'assets/' + id + '.png'));
      // Fondo pintado del acto II: si existe assets/bg_act2.jpg sustituye al procedural (sin tocar código)
      this.load.image('bg_act2', 'assets/bg_act2.jpg');
      this.load.image('bg_act3', 'assets/bg_act3.jpg');   // Acto III: si no existe, cueva procedural
      this.load.image('bg_sanctuary', 'assets/bg_sanctuary.jpg');   // Santuario (si no existe: fondo del menú)
      this.load.image('bg_map', 'assets/bg_map.jpg');               // Mapa en pergamino (si no existe: fondo del acto)
      // Audio: cada clave con .ogg y .mp3 (Phaser elige el que soporte el navegador). Si falla, Sfx usa el sintetizado.
      U.SFX_FILES.forEach((k) => this.load.audio(k, [`assets/sfx/${k}.ogg`, `assets/sfx/${k}.mp3`]));
      U.MUSIC_FILES.forEach((k) => this.load.audio(k, [`assets/music/${k}.ogg`, `assets/music/${k}.mp3`]));
      this.load.on('loaderror', (file) => console.warn('[Carticas] No se pudo cargar', file.src,
        file.type === 'audio' ? '→ se usa el sonido sintetizado' : '→ se usa el arte procedural'));
    }
    create() {
      U.makeTextures(this);
      // Personajes sin PNG propio: copia del arte del Piromago teñida de su color (clave 'art_<art>')
      D.CHAR_IDS.forEach((id) => {
        const key = 'art_' + D.CHARACTERS[id].art;
        if (!this.textures.exists(key)) tintedCopy(this, 'art_mage', key, id === 'criomante' ? 0x5fb4f0 : D.CHARACTERS[id].color);
      });
      // Criaturas de la Invocadora: arte real (assets/summons/<id>.png). Si un PNG falla, arte de un
      // enemigo parecido teñido de verde espectral (o su icono dibujado, el Búho).
      D.SUMMON_IDS.forEach((id) => {
        const key = D.SUMMONS[id].art;
        if (this.textures.exists(key)) { REAL_SUMMON.add(id); return; }
        const fb = SUMMON_FALLBACK[id];
        let src = fb && 'art_' + fb;
        if (src && !this.textures.exists(src) && ENEMY_FALLBACK[fb]) src = 'art_' + ENEMY_FALLBACK[fb];
        if (!src || !this.textures.exists(src)) src = 'ic_summon_' + id;
        tintedCopy(this, src, key, 0x4fd07a);
      });
      { const cv = this.textures.createCanvas('sumglow', 128, 128), ctx = cv.getContext();   // halo radial (criaturas)
        const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128); cv.refresh(); }
      { const g = this.make.graphics({ add: false });   // hoja (muerte de una criatura)
        g.fillStyle(0xffffff, 1); g.fillEllipse(9, 6, 18, 10); g.lineStyle(1.5, 0x000000, 0.25); g.lineBetween(1, 6, 17, 6);
        root.CM_HIRES.genTex(g, 'leafp', 18, 12); g.destroy(); }
      Sfx.attach(this.game);
      const miss = Sfx.missing();
      if (miss.length) console.warn('[Carticas] Audio sin cargar (se usa el sintetizado):', miss.join(', '));
      this.input.on('pointerdown', () => Sfx.unlock());
      this.scene.launch('Overlay');   // capa permanente: consejos, tooltips, ventanas y avisos (siempre encima)
      // Las dos fuentes del tema (gótica de títulos y Alegreya) deben estar listas antes del menú (máx. 2,5 s)
      const go = () => { if (!this._went) { this._went = true; this.scene.start('Title'); } };
      if (root.document && document.fonts && document.fonts.ready) { Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).then(go, go); } else go();
    }
  }

  /* =================================================================
   * Título
   * ================================================================= */
  /** Fondo pintado de menú (bg_title cubriendo 1280×720 + viñeta). dim: oscurecido extra (0..1). */
  function menuBackdrop(scene, dim = 0) {
    if (!scene.textures.exists('bg_title')) { backdrop(scene, 'night'); return; }
    const src = scene.textures.get('bg_title').getSourceImage();
    scene.add.image(640, 360, 'bg_title').setScale(Math.max(1280 / src.width, 720 / src.height));
    // Viñeta suave (más oscura en los bordes y arriba, donde va el título)
    const g = scene.add.graphics();
    for (let k = 0; k < 10; k++) { g.lineStyle(60, 0x000000, 0.07); g.strokeRect(-30 + k * 22, -30 + k * 14, 1340 - k * 44, 780 - k * 28); }
    g.fillStyle(0x000000, 0.25); g.fillRect(0, 0, 1280, 720);
    if (dim > 0) scene.add.rectangle(640, 360, 1280, 720, 0x000000, dim);
  }

  /** Créditos de los iconos (game-icons.net, CC BY 3.0) con enlace a la lista completa (assets/CREDITOS_ICONOS.txt). */
  const ICON_CREDITS_URL = 'assets/CREDITOS_ICONOS.txt';
  function iconCredits(scene, y) {
    const a = T(scene, 0, y, _t('help.iconCredits') + ' · ', { size: SZ.small, color: C.muted, ox: 0 });
    const l = T(scene, 0, y, _t('help.iconCreditsLink'), { size: SZ.small, color: C.gold, ox: 0 });
    U.fitLine(a, 740 - l.width);
    const x0 = 640 - (a.displayWidth + l.width) / 2;
    a.setX(x0); l.setX(x0 + a.displayWidth);
    const ul = scene.add.rectangle(l.x, y + SZ.small / 2 + 1, l.width, 1, C.gold).setOrigin(0, 0.5);   // subrayado: es un enlace
    l.setInteractive({ useHandCursor: true }).on('pointerup', () => { try { root.open(ICON_CREDITS_URL, '_blank', 'noopener'); } catch (e) { /* sin ventanas emergentes */ } });
    return [a, l, ul];
  }
  /** Rótulo bajo un botón del título (hasta 2 líneas a 16 px; nunca invade al vecino). */
  function subLabel(scene, x, y, str, color, w) {
    return U.fitText(T(scene, x, y + 28, str, { size: SZ.small, color, stroke: TC.outline, strokeThickness: 4, wrap: w + SP[1], align: 'center', oy: 0, lineSpacing: -4 }), w + SP[1], 40, SZ.micro);
  }
  class Title extends Phaser.Scene {
    constructor() { super('Title'); }
    /** Abajo a la izquierda: dónde se guarda el progreso. El icono gira mientras sincroniza. */
    cloudStatus(Cloud) {
      const ic = this.add.image(30, 700, 'ic_disk').setIconScale(0.3).setAlpha(0.85);
      const t = T(this, 50, 700, '', { size: SZ.small, color: C.muted, ox: 0 });
      let spin = null;
      const paint = () => {
        const on = !!Cloud && Cloud.state === 'cloud';
        ic.setTexture(on ? 'ic_cloud' : 'ic_disk');
        t.setText(on ? _t('s.progreso_guardado_en_tu_cuenta') : _t('s.progreso_guardado_en_este_navegador'));
        const busy = !!Cloud && (Cloud.syncing || Cloud.state === 'connecting');
        if (busy && !spin) spin = this.tweens.add({ targets: ic, angle: 360, duration: DUR.ambient, repeat: -1 });
        if (!busy && spin) { spin.stop(); spin = null; this.tweens.add({ targets: ic, angle: 0, duration: DUR.screen }); }
      };
      paint();
      if (!Cloud) return;
      const off = Cloud.onChange(() => {
        if (!this.sys.isActive()) return;
        if (Cloud.pendingRun) { this.scene.restart(); return; }   // llegó una partida más reciente: repinta el título con ella
        paint();
      });
      this.events.once('shutdown', off);
    }
    /**
     * Fuera de claude.ai (móvil, .exe, web) no hay nube: la primera vez, un aviso pequeño arriba para hacer una copia.
     * Se cierra con ✕ (o con el mando) y no vuelve a salir.
     */
    localWarn(Cloud) {
      this.localWarnObjs = null;
      const inClaude = !!(root.claude && typeof root.claude.use === 'function');
      if (inClaude || (Cloud && Cloud.state !== 'local') || U.Store.get(SAVE_WARN_KEY)) return;
      const W = 660, H = 58, x0 = 640 - W / 2, y0 = 8;
      const g = this.add.graphics().setDepth(LY.units + 6);
      Panel.draw(g, x0, y0, W, H, { alpha: 0.95 });
      const ic = this.add.image(x0 + 26, y0 + H / 2, 'ic_disk').setIconScale(0.3).setDepth(LY.units + 7);
      const t = U.fitText(T(this, x0 + 48, y0 + H / 2, _t('sv.localWarn'), { size: SZ.small, ox: 0, color: C.parch, wrap: W - 120, lineSpacing: -2 }), W - 120, H - 8, SZ.micro).setDepth(LY.units + 7);
      const x = button(this, x0 + W - 30, y0 + H / 2, '✕', () => {
        U.Store.set(SAVE_WARN_KEY, '1');
        Sfx.play('click');
        this.scene.restart();   // repinta el título sin el aviso (y sin su botón en el foco del mando)
      }, { w: 44, h: 44, size: SZ.body, variant: 'ghost' });
      x.setDepth(LY.units + 7); x.noMain = true;
      this.localWarnObjs = { g, t, x };
    }
    create() {
      // Nube: si otro dispositivo dejó una partida más reciente, se aplica aquí (nunca en mitad de una partida)
      const Cloud = root.CM_CLOUD;
      if (Cloud) Cloud.applyPendingRun();
      // Parche 3.7: la primera vez que se abre el juego, la intro (se marca como vista al empezar)
      if (!loadMeta().introSeen && !root.CM_NO_INTRO) { const mi = loadMeta(); mi.introSeen = true; saveMeta(mi); this.scene.start('Intro', { next: 'Title' }); return; }
      menuBackdrop(this);
      this.tip = tooltip(this);
      U.Look.set(null);
      Music.base();
      // Parche 3.6: misiones al día (y la diaria de hoy) y hitos del compendio que aún no se habían cobrado
      {
        const qm = loadMeta(), q0 = JSON.stringify(qm.quests), ms = M.claimMilestones(qm), lf = M.loreSync(qm);
        M.ensureQuests(qm);
        if (ms.length || lf.length || JSON.stringify(qm.quests) !== q0) saveMeta(qm);
        loreToast(this, lf);   // fragmentos que ya le tocaban (progreso de antes): un solo aviso
        ms.forEach((x) => U.questToast(this, _t('cx.milestone', { p: x.pct }), _t('cx.milestoneRw', { e: x.essence, c: this.cosmeticName(x.cosmetic) }), C.gold));
      }
      this.input.on('pointerdown', () => Sfx.unlock());
      this.cloudStatus(Cloud);
      this.localWarn(Cloud);
      // Abanico decorativo con cartas reales del mazo inicial
      const hasSave = !!(U.loadRun() || U.loadRun('custom'));   // con «Continuar», el abanico sube un poco para no quedar tapado
      ['llama', 'piel', 'bola', 'chispa', 'combustion'].forEach((id, i) => {
        const cv = cardView(this, { uid: -1 - i, id, up: false });
        const k = i - 2;
        cv.setPosition(640 + k * (hasSave ? 112 : 120), (hasSave ? 308 : 336) + Math.abs(k) * (hasSave ? 12 : 16)).setRotation(k * 0.12).setScale(hasSave ? 0.68 : 0.78).setAlpha(0.9);
        this.tweens.add({ targets: cv, y: cv.y - 8, duration: DUR.ambient + i * 200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      });
      T(this, 640, 128, _t('s.carticas_magicas'), { size: SZ.logo, font: 'display', color: C.gold, stroke: TC.outline, strokeThickness: 8, shadow: true });
      T(this, 640, 200, _t('s.un_roguelike_de_cartas_fuego'), { size: SZ.body, color: C.parch, style: 'italic' });

      const saved = U.loadRun(), savedC = U.loadRun('custom');   // partida normal/diario y personalizada: guardados separados
      const step = 58, bo = { w: 300, h: TH.button.minH };
      let y = saved || savedC ? 452 : 480;
      if (saved || savedC) {   // con las dos, una al lado de la otra; el texto dice cuál es cuál
        const cont = [];
        if (saved) cont.push([saved.daily ? _t('s.continuar_desafio_diario') : _t('s.continuar_partida'), saved]);
        if (savedC) cont.push([_t('cust.continue'), savedC]);
        cont.forEach(([label, r], i) => {
          const x = cont.length === 1 ? 640 : 640 + (i ? 155 : -155);
          const b = button(this, x, y, label, () => { this.registry.set('run', r); go(this); }, { ...bo, variant: i ? 'secondary' : 'primary' });   // un solo primario
          U.fitText(b.list.find((o) => o.type === 'Text') || b, bo.w - SP[4], 0, SZ.small);
        });
        y += step;
      }
      let armed = false;
      const newBtn = button(this, 640, y, _t('s.nueva_partida'), () => {
        if (saved && !armed) { armed = true; newBtn.setLabel(_t('s.seguro_se_pierde_la_actual')); return; }
        this.scene.start('Prep');
      }, { ...bo, variant: saved || savedC ? 'secondary' : 'primary' });
      y += step;
      // Desafío diario: misma semilla para todos hoy; pide confirmación si hay una partida a medias
      const today = E.todayStr();
      const best = (loadMeta().daily || {})[today];
      const b3 = { w: 210, h: bo.h };   // Parche 3.6: Diario · Semanal · Personalizado
      U.fitText(button(this, 640 - 222, y, _t('s.desafio_diario'), () => (saved ? this.confirmDaily(saved) : startDaily(this)), { ...b3, variant: 'secondary' }).list.find((o) => o.type === 'Text'), b3.w - SP[3], 0, SZ.small);
      subLabel(this, 640 - 222, y, `${fmtDay(today, false)} · ${best ? _t('title.bestToday', { s: fmtScore(best.best) }) : _t('title.notPlayed')}`, best ? C.gold : C.parch, b3.w);
      this.weeklyBtn(640, y, b3);
      // Modo personalizado: se desbloquea al terminar una partida (con candado y aviso hasta entonces)
      this.customBtn(640 + 222, y, b3);
      y += step + SP[5];
      // Santuario (Esencia Arcana) · Récords · Compendio
      const tm = loadMeta();
      const sb = button(this, 640 - 154, y, _t('s.santuario'), () => this.scene.start('Sanctuary'), { w: 146, h: bo.h, variant: 'secondary' });
      if (M.canAffordAny(tm)) {   // punto dorado: te llega para alguna mejora
        const dot = this.add.circle(sb.x + 62, y - 18, 8, C.gold).setStrokeStyle(TH.borderWidth, TC.outline).setDepth(LY.units + 5);
        this.tweens.add({ targets: dot, scale: { from: 1, to: 1.3 }, duration: DUR.pulse, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      button(this, 640, y, _t('s.records'), () => this.scene.start('Records'), { w: 146, h: bo.h, variant: 'secondary' });
      button(this, 640 + 154, y, _t('s.compendio'), () => this.scene.start('Compendium'), { w: 146, h: bo.h, variant: 'secondary' });
      y += step;
      button(this, 640 - 77, y, _t('s.como_jugar'), () => this.showHelp(), { w: 146, h: bo.h, variant: 'secondary' });
      button(this, 640 + 77, y, _t('s.novedades'), () => this.scene.start('News'), { w: 146, h: bo.h, variant: 'secondary' });
      if (M.hasUnreadNews(loadMeta())) {   // punto dorado: hay notas de una versión sin leer
        const dot = this.add.circle(640 + 77 + 62, y - 18, 8, C.gold).setStrokeStyle(TH.borderWidth, TC.outline).setDepth(LY.units + 5);
        this.tweens.add({ targets: dot, scale: { from: 1, to: 1.3 }, duration: DUR.pulse, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      T(this, 1266, 708, _t('s.carticas_magicas_v_0', { 0: D.LATEST_VERSION }), { size: SZ.small, color: C.muted, ox: 1, oy: 1 });
      this.questPanel();   // Parche 3.6: misiones (panel plegable a la izquierda)
      U.gearButton(this, 1236, 40, 52, TH.button.minH);   // panel ⚙ de volumen (Música / Efectos)
      U.langButton(this, 1176, 40, 52, TH.button.minH);   // idioma (menú Español / English)
      // Saldo de Esencia Arcana arriba a la izquierda (gema dibujada)
      if (tm.essence && tm.essence.earned > 0) essenceBadge(this, 36, 40, M.essenceBalance(tm), { r: 16, size: SZ.body });
      // Mando / teclado: flechas entre los botones, A (Enter) pulsa
      const fm = this.fm = U.focusManager(this);
      const mainBtns = U.buttonsAsFocus(this).sort((p, q) => (p.obj.y - q.obj.y) || (p.obj.x - q.obj.x));
      fm.set(mainBtns);
      fm.focus(mainBtns.find((it) => it.obj.y > 120 && it.obj.x > 340) || mainBtns[0]);   // empieza en el primer botón del menú (no en ⚙ ni en las misiones)
      U.Input.bind(this, (a) => {
        // Con una ventana encima (aviso del diario, «Cómo jugar»), solo sus botones
        const over = this.children.list.filter((o) => o.active && o.depth >= LY.modal && o.list);
        const want = over.length ? U.buttonsAsFocus(this, over.flatMap((o) => o.list)) : mainBtns;
        if (want.length && (fm.items.length !== want.length || fm.items[0].obj !== want[0].obj)) fm.set(want);
        if (['up', 'down', 'left', 'right'].includes(a)) fm.move(a);
        else if (a === 'confirm') fm.confirm();
        else if (a === 'back' && this.wkLayer) { this.wkLayer.destroy(); this.wkLayer = null; }   // B cierra la ventana del Semanal
      });
    }
    /** Nombre de un cosmético ([slot, id]) con su tipo: «Dorso de carta: Pergamino». */
    cosmeticName(c) { return _t('aff.rw.' + c[0], { n: D.COSMETICS[c[0]][c[1]].name }); }
    /** Panel de misiones (Parche 3.6): 3 activas (una por dificultad) y la diaria especial; plegable. */
    questPanel() {
      const meta = loadMeta(), Q = meta.quests || { active: [] }, open = U.Store.get(QUEST_OPEN_KEY) !== '0';
      const X = 20, W = 290, y0 = 232;
      const head = button(this, X + W / 2, y0 + 18, `${_t('q.title')} ${open ? '▾' : '▸'}`, () => { U.Store.set(QUEST_OPEN_KEY, open ? '0' : '1'); Sfx.play('click'); this.scene.restart(); },
        { w: W, h: TH.button.minH, size: SZ.small, variant: 'secondary' });
      head.on('pointerover', () => this.tip.show(X + W + 10, y0, U.glossName('quest'), U.glossDesc('quest')));
      head.on('pointerout', () => this.tip.hide());
      if (!open) return;
      const rows = Q.active.map((e, i) => ({ e, i, daily: false })).concat(Q.daily ? [{ e: Q.daily, i: -1, daily: true }] : []);
      const RH = 72, top = y0 + 50, h = rows.length * RH + 46;
      const g = this.add.graphics();
      Panel.draw(g, X, top, W, h, { alpha: 0.94 });
      const canRe = M.canReroll(meta), TIER = { 1: TH.game.tier[0], 2: TH.game.tier[1], 3: TH.game.tier[2] };
      rows.forEach(({ e, i, daily }, k) => {
        const q = D.QUESTS[e.id], y = top + 10 + k * RH, rw = M.questReward(e.id, daily), done = daily && e.done;
        const prog = done ? q.goal : M.questProgress(e);
        if (daily) { g.fillStyle(TC.surfaceRaised, 1); g.fillRoundedRect(X + SP[1], y - 2, W - SP[3], RH - 4, TH.radius); g.lineStyle(TH.borderWidth, TC.ember, 1); g.strokeRoundedRect(X + SP[1], y - 2, W - SP[3], RH - 4, TH.radius); }
        for (let t = 0; t < 3; t++) { g.fillStyle(t < q.tier ? TIER[q.tier] : TC.line, 1); g.fillCircle(X + 18, y + 10 + t * 9, 3.2); }
        const label = (daily ? _t('q.daily') + ' · ' : '') + q.text;
        U.fitText(T(this, X + 30, y + 16, label, { size: SZ.small, bold: daily, ox: 0, color: done ? C.muted : daily ? C.gold : C.parch, wrap: W - (daily ? 46 : 78), lineSpacing: -2 }), W - (daily ? 46 : 78), 36, SZ.micro);
        const bx = X + 30, bw = W - 196, by = y + 50;
        g.fillStyle(TC.track, 1); g.fillRoundedRect(bx, by - 4, bw, 8, 4);
        g.fillStyle(TIER[q.tier], 1); if (prog > 0) g.fillRoundedRect(bx, by - 4, Math.max(8, bw * prog / q.goal), 8, 4);
        U.fitText(T(this, bx + bw + 6, by, done ? '✓' : `${prog}/${q.goal}`, { size: SZ.micro, bold: true, ox: 0, color: done ? C.leaf : C.muted }), 56, 0, SZ.micro);
        U.fitText(T(this, X + W - 10, by, _t('q.rewardShort', { e: rw.essence, x: rw.xp }), { size: SZ.micro, ox: 1, color: ESS_C }), 72, 0, SZ.micro);
        if (!daily && canRe) {
          const rb = button(this, X + W - 28, y + 14, '⟳', () => { const m2 = loadMeta(); if (M.rerollQuest(m2, i)) { saveMeta(m2); Sfx.play('click'); this.scene.restart(); } }, { w: 40, h: TH.button.minH, size: SZ.body, variant: 'secondary' });
          rb.on('pointerover', () => this.tip.show(X + W + 10, y, _t('q.reroll'), _t('q.rerollDesc')));
          rb.on('pointerout', () => this.tip.hide());
        }
      });
      U.fitText(T(this, X + W / 2, top + h - 22, canRe ? _t('q.rerollHint') : _t('q.rerollUsed'), { size: SZ.micro, color: C.muted, style: 'italic', wrap: W - SP[3], align: 'center', lineSpacing: -3 }), W - SP[3], 34, SZ.micro);
    }
    /** Botón «Semanal» (Parche 3.6): abre la ventana del reto de esta semana. */
    weeklyBtn(x, y, bo) {
      const key = E.weekKey(), wk = (loadMeta().weekly || {})[key];
      U.fitText(button(this, x, y, _t('wk.title'), () => this.openWeekly(), { ...bo, variant: 'secondary' }).list.find((o) => o.type === 'Text'), bo.w - SP[3], 0, SZ.small);
      const sub = wk ? (wk.rewarded ? _t('wk.doneShort', { s: fmtScore(wk.best) }) : _t('wk.bestShort', { s: fmtScore(wk.best) })) : _t('title.notPlayed');
      subLabel(this, x, y, sub, wk ? C.gold : C.parch, bo.w);
    }
    /** Ventana del Desafío semanal: el reto, tu mejor puntuación, semanas anteriores, Jugar y Copiar código. */
    openWeekly() {
      if (this.wkLayer) return;
      const meta = loadMeta(), key = E.weekKey(), cfg = E.weeklyCfg(key), diff = E.customDifficulty(cfg), code = E.encodeCustom(cfg);
      const cd = D.CHARACTERS[cfg.char], pth = D.PATHS[cfg.path], wk = (meta.weekly || {})[key];
      const L = this.wkLayer = this.add.container(0, 0).setDepth(LY.modal);
      const W = 660, H = 470, x0 = 640 - W / 2, y0 = 360 - H / 2;
      const shade = curtain(this);
      const g = Panel.draw(this.add.graphics(), x0, y0, W, H);
      L.add([shade, g, T(this, 640, y0 + 40, _t('wk.title'), { size: SZ.h2, bold: true, color: C.gold }),
        T(this, 640, y0 + 78, _t('wk.range', { r: fmtWeek(key) }), { size: SZ.small, color: C.muted })]);
      const art = 'art_' + cd.art, src = this.textures.get(art).getSourceImage();
      L.add(this.add.image(x0 + 70, y0 + 182, art).setOrigin(0.5, 1).setScale(Math.min(80 / src.height, 80 / src.width)));
      L.add(U.fitText(T(this, x0 + 130, y0 + 120, `${cd.name} · ${pth ? pth.name : _t('path.noneShort')}${cfg.ascension ? ' · A' + cfg.ascension : ''}`, { size: SZ.body, bold: true, ox: 0, color: cd.color }), W - 160, 0, 13));
      L.add(T(this, x0 + 130, y0 + 148, `${_t('cust.diff')}: ${diff.name}`, { size: SZ.small, bold: true, ox: 0, color: diff.color }));
      const mods = cfg.mods.map((id) => `• ${D.CUSTOM_MODS[id].name}: ${D.CUSTOM_MODS[id].text || D.CUSTOM_MODS[id].short || ''}`).join('\n');
      L.add(U.fitText(T(this, x0 + 130, y0 + 172, mods, { size: SZ.small, ox: 0, oy: 0, wrap: W - 160, color: C.parch, lineSpacing: 2 }), W - 160, 104, SZ.micro));
      L.add(T(this, 640, y0 + 296, wk ? _t('wk.best', { s: fmtScore(wk.best), n: wk.attempts }) : _t('wk.notPlayed'), { size: SZ.body, bold: !!wk, color: wk ? C.gold : C.muted }));
      L.add(U.fitText(T(this, 640, y0 + 334, wk && wk.rewarded ? _t('wk.badgeGot') : _t('wk.reward', { e: D.WEEKLY.essence }), { size: SZ.small, color: wk && wk.rewarded ? C.leaf : ESS_C, wrap: W - 60, align: 'center' }), W - 60, 40, SZ.small));
      const past = Object.keys(meta.weekly || {}).filter((k) => k !== key).sort().reverse().slice(0, 4)
        .map((k) => `${fmtDay(k, false)} ${fmtScore(meta.weekly[k].best)}${meta.weekly[k].rewarded ? ' ★' : ''}`);
      L.add(U.fitText(T(this, 640, y0 + 370, past.length ? _t('wk.history', { l: past.join(' · ') }) : _t('wk.noHistory'), { size: SZ.small, color: C.muted, style: past.length ? 'normal' : 'italic' }), W - 50, 0, SZ.micro));
      const savedC = U.loadRun('custom');
      let armed = false;
      const play = button(this, x0 + 130, y0 + H - 44, _t('wk.play'), () => {
        if (savedC && !armed) { armed = true; play.setLabel(_t('s.seguro_se_pierde_la_actual')); return; }
        startWeekly(this, key);
      }, { w: 210, h: TH.button.minH, size: SZ.body, variant: 'primary' });
      const copy = button(this, 640 + 10, y0 + H - 44, _t('wk.copy'), () => U.copyOrShow(this, `${_t('wk.shareHead', { r: fmtWeek(key) })}: ${code}`, { ok: _t('cust.copied'), title: _t('wk.copy'), mono: true }), { w: 190, h: TH.button.minH, size: SZ.body, variant: 'secondary' });
      const close = () => { L.destroy(); this.wkLayer = null; };
      const shut = button(this, x0 + W - 100, y0 + H - 44, _t('s.cerrar'), close, { w: 150, h: TH.button.minH, size: SZ.body, variant: 'secondary', role: 'back' });
      L.add([play, copy, shut]);
      this.input.keyboard.once('keydown-ESC', close);
    }
    /** Botón «Personalizado» del título: abierto tras terminar 1 partida; si no, candado y aviso al pasar/pulsar. */
    customBtn(x, y, bo) {
      const open = loadMeta().played > 0;
      const b = button(this, x, y, _t('cust.title'), () => {
        if (open) { this.scene.start('CustomSetup'); return; }
        Sfx.play('deny'); this.tip.show(x - 150, y + 30, _t('cust.title'), _t('cust.locked'));
      }, { ...bo, variant: 'secondary' });
      U.fitText(b.list.find((o) => o.type === 'Text'), bo.w - SP[3] - (open ? 0 : 28), 0, SZ.small);
      if (!open) {
        const lab = b.list.find((o) => o.type === 'Text');
        if (lab) lab.setAlpha(TH.alpha.disabled + 0.15);
        b.add(this.add.image(-bo.w / 2 + 20, 0, 'ic_lock').setIconScale(0.34));
        b.on('pointerover', () => this.tip.show(x - 150, y + 30, _t('cust.title'), _t('cust.locked')));
        b.on('pointerout', () => this.tip.hide());
      }
      subLabel(this, x, y, open ? _t('cust.sub') : _t('cust.lockedShort'), C.parch, bo.w);
      return b;
    }
    /** Aviso sencillo antes de sustituir una partida guardada por el desafío diario. */
    confirmDaily(saved) {
      const layer = this.add.container(0, 0).setDepth(LY.modal);
      const shade = curtain(this);
      const g = Panel.draw(this.add.graphics(), 370, 250, 540, 220);
      const title = T(this, 640, 292, _t('s.empezar_el_desafio_diario'), { size: SZ.h3, bold: true, color: C.gold });
      const body = T(this, 640, 346, saved.daily
        ? _t('s.tienes_un_desafio_diario_a')
        : _t('s.tienes_una_partida_a_medias'),
        { size: SZ.body, wrap: 480, align: 'center', color: C.parch });
      const yes = button(this, 540, 420, _t('s.empezar_el_diario'), () => startDaily(this), { w: 200, h: TH.button.minH, size: SZ.body, variant: 'primary' });
      const no = button(this, 750, 420, _t('s.cancelar'), () => layer.destroy(), { w: 160, h: TH.button.minH, size: SZ.body, variant: 'secondary', role: 'back' });
      layer.add([shade, g, title, body, yes, no]);
    }
    iconCredits(y) { return iconCredits(this, y); }
    showHelp() {
      const layer = this.add.container(0, 0).setDepth(LY.modal);
      const shade = curtain(this);
      const g = Panel.draw(this.add.graphics(), 240, 80, 800, 560);
      const title = T(this, 640, 124, _t('s.como_jugar'), { size: SZ.h2, bold: true, color: C.gold });
      const rules = [
        _t('s.sube_por_el_mapa_del'),
        _t('s.en_combate_tienes_3_de'),
        _t('s.el_icono_sobre_el_enemigo'),
        _t('s.quemadura_el_enemigo_pierde_pv', {  }),
        _t('s.temperatura_1_de_dano_por', { 0: E.OVERHEAT_AT, 1: E.OVERHEAT_DMG }),
        _t('s.la_partida_se_guarda_sola')
      ];
      const body = U.fitText(T(this, 290, 166, rules.map((r) => '• ' + r).join('\n\n'), { size: SZ.body, wrap: 700, ox: 0, oy: 0, lineSpacing: 1 }), 700, 384, SZ.small);   // cabe sobre «Entendido»
      const close = button(this, 640, 584, _t('s.entendido'), () => layer.destroy(), { w: 200, variant: 'primary', role: 'back' });
      layer.add([shade, g, title, body, close, ...this.iconCredits(624)]);
    }
  }

  /* =================================================================
   * Preparación: el mago y su mazo inicial (leído de los datos reales)
   * ================================================================= */
  class Prep extends Phaser.Scene {
    constructor() { super('Prep'); }
    create(data) {
      menuBackdrop(this, 0.5);
      const meta = loadMeta();
      U.Look.set(null);
      const tip = this.tip = tooltip(this);
      const sel = this.sel = (data && data.char) || (meta.unlockedChars.includes(meta.lastChar) ? meta.lastChar : 'piromago');
      const cd = D.CHARACTERS[sel];
      const lo = M.loadoutOf(meta, sel), legacy = M.legacyOf(meta, sel);   // Parche 3.6: Personalizar y Legado
      const backBtn = button(this, 80, 40, _t('s.volver'), () => this.scene.start('Title'), { w: 130, h: TH.button.minH, size: SZ.body, variant: 'secondary' });
      T(this, 170, 44, _t('s.elige_personaje'), { size: SZ.h1, font: 'display', color: C.gold, stroke: TC.shade, strokeThickness: 4, ox: 0 });

      // Tarjetas de personaje (y un hueco «Próximamente…» mientras haya pocos)
      const slots = D.CHAR_IDS.slice();
      while (slots.length < 2) slots.push(null);
      // 2 tarjetas anchas o 3 estrechas (todas dentro de la columna izquierda, x < 600)
      const six = slots.length >= 6, five = slots.length >= 5, four = slots.length >= 4, narrow = slots.length > 2;
      const cw = six ? 90 : five ? 108 : four ? 138 : narrow ? 182 : 240, step = six ? 95 : five ? 114 : four ? 146 : narrow ? 192 : 260, x0 = six ? 58 : five ? 66 : four ? 82 : narrow ? 108 : 170;
      let selHit = null;
      slots.forEach((id, i) => { const h = this.charCard(x0 + i * step, 270, id, meta, id === sel, cw); if (id === sel) selHit = h; });

      // Ascensión del personaje elegido, debajo de las tarjetas
      const asc = ascSelector(this, 50, 462, sel);
      // Pactos: retos voluntarios (se desbloquean con la primera victoria)
      const pactsOpen = meta.wins > 0;
      this.pacts = pactsOpen ? savedPacts() : [];
      if (pactsOpen) {
        this.pactBtn = button(this, 160, 594, '', () => this.openPacts(), { w: 260, h: TH.button.minH, size: SZ.body, variant: 'secondary' });
        this.paintPactBtn();
      } else U.fitText(T(this, 50, 594, _t('s.pactos_gana_una_partida_para'), { size: SZ.small, color: C.muted, style: 'italic', ox: 0, wrap: 250 }), 250, 40, SZ.micro);
      // Parche 3.6: Afinidad (barra con nivel, XP y próxima recompensa) y «Personalizar»
      this.affinityBar(meta, sel);
      this.lookBtn = button(this, 420, 594, _t('look.btn'), () => this.openLook(), { w: 200, h: TH.button.minH, size: SZ.body, variant: 'secondary' });
      U.fitText(this.lookBtn.list.find((o) => o.type === 'Text'), 184, 0, SZ.micro);
      // Santuario: interruptor «sin mejoras» (+20 % de Esencia). Sin mejoras compradas no hace falta.
      const owned = D.UPGRADE_IDS.some((id) => M.upgradeLevel(meta, id) > 0);
      this.noUpg = owned && U.Store.get(NOUPG_KEY) === '1';
      if (owned) {
        const tg = this.add.container(50, 640);
        const box = this.add.graphics();
        const lab = T(this, 40, -8, _t('s.jugar_sin_mejoras_del_santuario'), { size: SZ.small, bold: true, ox: 0, color: C.parch });
        const sub = T(this, 40, 13, _t('s.0_de_esencia_al_terminar', { 0: Math.round((D.ESSENCE.noUpgrades - 1) * 100) }), { size: SZ.small, ox: 0, color: TH.game.essence });
        const paint = () => {
          box.clear();
          box.fillStyle(TC.deep, 1); box.fillRoundedRect(0, -13, 26, 26, TH.radius);
          box.lineStyle(TH.borderWidth, this.noUpg ? TC.ember : C.line, 1); box.strokeRoundedRect(0, -13, 26, 26, TH.radius);
          if (this.noUpg) { box.lineStyle(4, TC.ember, 1); box.beginPath(); box.moveTo(6, 0); box.lineTo(11, 6); box.lineTo(21, -7); box.strokePath(); }
          lab.setColor(U.hex(this.noUpg ? TH.game.essence : C.parch));
        };
        paint();
        tg.add([box, lab, sub]).setSize(320, 40);
        tg.setInteractive(new Phaser.Geom.Rectangle(154, 0, 330, 40), Phaser.Geom.Rectangle.Contains);   // el área va en coordenadas con origen (setSize centra)
        tg.press = () => { this.noUpg = !this.noUpg; U.Store.set(NOUPG_KEY, this.noUpg ? '1' : '0'); Sfx.play('click'); paint(); };
        tg.on('pointerup', () => tg.press());
        this.noUpgToggle = tg;
      }

      // Detalle del personaje elegido
      const X = 620;
      const nameT = T(this, X, 96, cd.name, { size: SZ.h2, bold: true, color: cd.color, ox: 0, stroke: TC.shade, strokeThickness: 4 });
      const ttl = M.titleText(meta, sel);   // título elegido (Afinidad 15 o hito del compendio)
      if (ttl) U.fitText(T(this, X + nameT.width + 18, 104, `«${ttl}»`, { size: SZ.body, style: 'italic', bold: true, color: C.gold, ox: 0 }), 1250 - (X + nameT.width + 18), 0, SZ.micro);
      U.fitLine(T(this, X + 4, 142, _t('s.0_1_pv_3_energia', { 0: cd.title, 1: cd.hp }), { size: SZ.small, color: C.muted, ox: 0 }), 250);
      const loreT = T(this, X + 4, 173, cd.lore, { size: SZ.small, wrap: 610, ox: 0, oy: 0, lineSpacing: 3 });
      if (cd.quote) {   // Parche 3.7: su frase, en cursiva debajo de la descripción (si no cabe antes de «Mecánicas», la descripción encoge)
        for (let fs = SZ.small; fs >= SZ.micro && 173 + loreT.height + 24 > 282; fs--) loreT.setFontSize(fs);
        if (173 + loreT.height + 24 > 282) loreT.setLineSpacing(0);
        U.fitText(T(this, X + 4, 173 + loreT.height + 12, `«${cd.quote}»`, { size: SZ.small, style: 'italic', color: cd.color, ox: 0 }), 610, 0, SZ.micro);
      }
      // Mecánicas propias
      T(this, X + 4, 290, _t('s.mecanicas'), { size: SZ.small, bold: true, color: C.gold, ox: 0 }).setLetterSpacing(2);
      const MC = TH.game.mech;
      const chips = cd.mechanics.includes('static') ? [[U.glossName('bolt'), MC.bolt], [U.glossName('static'), MC.static], [U.glossName('overload'), MC.overload]]
        : cd.mechanics.includes('judgment') ? [[U.glossName('judgment'), MC.judgment], [U.glossName('fervor'), MC.fervor], [U.glossName('immaterial'), MC.immaterial]]
        : cd.mechanics.includes('summon') ? [[_t('s.invoca'), MC.summon], [_t('s.vinculo'), MC.bond]]
        : cd.mechanics.includes('runes') ? [[_t('s.graba'), MC.engrave], [_t('s.detona'), MC.detonate], [_t('s.potencia_de_runa'), MC.runePower]]
        : cd.mechanics.includes('frost') ? [[_t('s.escarcha'), MC.frost], [_t('s.escudo_de_hielo'), MC.iceShield]]
        : cd.mechanics.includes('temp') ? [[_t('s.quemadura'), C.ember], [_t('s.temperatura'), C.flame]] : [[_t('s.quemadura'), C.ember]];
      chips.forEach(([k, col], i) => {
        const x = X + 4 + i * 170;
        const chip = this.add.container(x, 322);
        const bg = this.add.graphics(); bg.fillStyle(TC.brick, 1); bg.fillRoundedRect(0, -18, 156, 36, TH.radius); bg.lineStyle(TH.borderWidth, col, 1); bg.strokeRoundedRect(0, -18, 156, 36, TH.radius);
        chip.add([bg, T(this, 78, 0, k, { size: SZ.body, bold: true, color: col })]).setSize(156, 36);
        chip.setInteractive(new Phaser.Geom.Rectangle(0, -18, 156, 36), Phaser.Geom.Rectangle.Contains);
        chip.on('pointerover', () => tip.show(x, 348, k, U.KEYWORDS[k]));
        chip.on('pointerout', () => tip.hide());
      });
      // Mazo inicial agrupado (misma fuente que reparte el motor)
      T(this, X + 4, 374, _t('s.mazo_inicial'), { size: SZ.small, bold: true, color: C.gold, ox: 0 }).setLetterSpacing(2);
      const counts = {};
      cd.starterDeck.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
      let px = X + 4, py = 406;
      Object.entries(counts).forEach(([id, n]) => {
        const t = T(this, 0, 0, `${D.CARDS[id].name} ×${n}`, { size: SZ.small, ox: 0 });
        const w = t.width + 22;
        if (px + w > 1240) { px = X + 4; py += 40; }
        const g = this.add.graphics(); g.fillStyle(C.panel2, 1); g.fillRoundedRect(px, py - 15, w, 30, TH.radius);
        g.lineStyle(TH.borderWidth, U.cardColor({ id }, D.CARDS[id]), 0.9); g.strokeRoundedRect(px, py - 15, w, 30, TH.radius);
        t.setPosition(px + 11, py).setDepth(LY.units);
        px += w + 10;
      });
      if (lo.deck) {   // Afinidad 6: mazo inicial de senda
        const a = D.CARDS[E.basicOf(sel, 'attack')], b = D.CARDS[E.basicOf(sel, 'skill')];
        U.fitText(T(this, X + 4, 476, _t('look.deckNote', { a: a.name, b: b.name }), { size: SZ.small, color: TC.heal, ox: 0 }), 620, 0, SZ.micro);
      }
      // Reliquia inicial (o la alternativa elegida en «Personalizar»)
      const rel = D.ALL_RELICS[lo.relic || cd.starterRelic];
      T(this, X + 4, 506, _t('s.reliquia_inicial'), { size: SZ.small, bold: true, color: C.gold, ox: 0 }).setLetterSpacing(2);
      if (rel) {
        this.add.circle(X + 22, 540, 16, C.panel2).setStrokeStyle(2, C.gold); this.add.image(X + 22, 540, 'ic_' + rel.icon).setIconScale(0.4);
        T(this, X + 46, 540, `${rel.name}: ${rel.text}`, { size: SZ.small, ox: 0, wrap: 560 });
      } else T(this, X + 4, 540, _t('s.ninguna_empieza_solo_con_su'), { size: SZ.small, color: C.muted, style: 'italic', ox: 0 });
      if (legacy) {   // Legado de la última victoria con este personaje
        const lt = U.fitText(T(this, X + 4, 578, _t('leg.prep', { c: D.CARDS[legacy].name }), { size: SZ.small, bold: true, color: C.gold, ox: 0 }), 610, 0, SZ.micro);
        lt.setInteractive();
        lt.on('pointerover', () => tip.show(X + 4, 600, U.glossName('legacy'), U.glossDesc('legacy')));
        lt.on('pointerout', () => tip.hide());
      }

      const deck = cd.starterDeck.map((id, i) => ({ uid: 1000 + i, id, up: false }));
      const seeBtn = button(this, X + 120, 620, _t('s.ver_cartas'), () => this.scene.launch('DeckView', { mode: 'view', title: _t('s.mazo_inicial'), cards: deck }), { w: 230, variant: 'secondary' });
      const startBtn = button(this, X + 400, 620, _t('s.comenzar_aventura'), () => {
        const m = loadMeta(); m.lastChar = sel; saveMeta(m);   // recuerda el último elegido
        // Sendas: antes de empezar, eliges una (la partida se crea en esa pantalla)
        this.scene.start('PathSelect', { opts: { ascension: asc.get(), char: sel, pacts: this.pacts, upgrades: m.upgrades, noUpgrades: !!this.noUpg, unlocked: M.unlockedIds(m), ...M.runOptsFor(m, sel, 'normal') } });
      }, { w: 300 });
      // Mando: ←/→ personajes (o nivel de Ascensión en su fila); ↑/↓ personaje · Ascensión · Pactos · Ver cartas · Comenzar
      const btnItem = (key, b) => ({ key, obj: b, onConfirm: () => b.press() });
      const rows = [];
      if (selHit) rows.push({ key: 'char', obj: selHit, onConfirm: () => nav.fm.focus(rows.find((r) => r.key === 'start')) });
      if (asc.next) rows.push({ key: 'asc', obj: asc.next, rect: () => ({ x: 44, y: 474, w: 476, h: 44 }), onConfirm: () => asc.next.press() });
      if (this.pactBtn) rows.push(btnItem('pacts', this.pactBtn));
      rows.push(btnItem('look', this.lookBtn));
      if (this.noUpgToggle) rows.push({ key: 'noupg', obj: this.noUpgToggle, rect: () => ({ x: 44, y: 620, w: 340, h: 40 }), onConfirm: () => this.noUpgToggle.press() });
      if (this.affHit) rows.splice(rows.findIndex((r) => r.key === 'look'), 0, { key: 'aff', obj: this.affHit, rect: () => ({ x: 44, y: 518, w: 482, h: 42 }), onConfirm: () => {} });
      rows.push(btnItem('see', seeBtn), btnItem('start', startBtn));
      const unlocked = D.CHAR_IDS.filter((id) => meta.unlockedChars.includes(id));
      const nav = this.nav = U.padNav(this, {
        items: () => rows,
        main: () => (rows.find((r) => r.key === (data && data.padRow)) || rows[rows.length - 1]).obj,
        back: () => this.scene.start('Title'), backObj: () => backBtn,
        modalBack: () => { if (this.lookLayer && this.closeLook) this.closeLook(); else if (this.pactLayer) { this.pactLayer.destroy(); this.pactLayer = null; } },   // B cierra la ventana abierta
        onAction: (a, api) => {
          const cur = api.fm.cur;
          if (a === 'left' || a === 'right') {
            const d = a === 'left' ? -1 : 1;
            if (cur && cur.key === 'asc') { (d < 0 ? asc.prev : asc.next).press(); return true; }
            const i = unlocked.indexOf(sel), nx = unlocked[(i + d + unlocked.length) % unlocked.length];
            if (nx && nx !== sel) { Sfx.play('click'); this.scene.restart({ char: nx, padRow: cur ? cur.key : 'start' }); }
            return true;
          }
          if (a === 'up' || a === 'down') {
            const i = Math.max(0, rows.indexOf(cur));
            api.fm.focus(rows[(i + (a === 'up' ? -1 : 1) + rows.length) % rows.length]); Sfx.play('click', { volume: 0.4 });
            return true;
          }
          return false;
        }
      });
    }
    /** Barra de Afinidad del personaje elegido (Parche 3.6): nivel, XP y próxima recompensa; tooltip con la lista entera. */
    affinityBar(meta, ch) {
      const xp = ((meta.affinity || {})[ch] || { xp: 0 }).xp, lv = M.affinityLevel(xp), nx = M.nextAffinityReward(meta, ch);
      T(this, 50, 532, U.glossName('affinity').toUpperCase(), { size: SZ.small, bold: true, color: C.gold, ox: 0 }).setLetterSpacing(2);
      T(this, 160, 532, _t('aff.lv', { n: lv.level }), { size: SZ.small, bold: true, color: C.parch, ox: 0 });
      const g = this.add.graphics(), bx = 250, bw = 270;
      g.fillStyle(TC.track, 1); g.fillRoundedRect(bx, 526, bw, 12, TH.radius);
      g.lineStyle(1, C.line, 1); g.strokeRoundedRect(bx, 526, bw, 12, TH.radius);
      const f = lv.max ? 1 : lv.into / lv.need;
      if (f > 0) { g.fillStyle(C.gold, 1); g.fillRoundedRect(bx, 526, Math.max(10, bw * f), 12, TH.radius); }
      U.fitText(T(this, 50, 551, nx ? _t('aff.next', { n: nx.level, r: affRewardText(nx.reward, ch) }) : _t('aff.maxed'), { size: SZ.small, color: C.muted, ox: 0 }), 360, 0, SZ.micro);
      T(this, 520, 551, lv.max ? _t('aff.max') : `${lv.into}/${lv.need} XP`, { size: SZ.small, bold: true, color: C.parch, ox: 1 });
      const hit = this.affHit = this.add.zone(284, 539, 482, 42).setInteractive();
      hit.on('pointerover', () => this.tip.show(540, 380, `${U.glossName('affinity')} · ${D.CHARACTERS[ch].name} · ${_t('aff.lv', { n: lv.level })}`, affRewardList(meta, ch)));
      hit.on('pointerout', () => this.tip.hide());
    }
    /** «Personalizar» (Parche 3.6): reliquia inicial, mazo inicial y cosméticos; lo bloqueado dice cómo conseguirlo. */
    openLook() {
      if (this.lookLayer) return;
      const ch = this.sel, cd = D.CHARACTERS[ch];
      const L = this.lookLayer = this.add.container(0, 0).setDepth(LY.modal);
      const W = 720, H = 560, x0 = 640 - W / 2, y0 = 360 - H / 2;
      const blocker = this.add.zone(0, 0, 1280, 720).setOrigin(0, 0).setInteractive();
      const g = this.add.graphics();
      g.fillStyle(TC.shade, TH.alpha.curtain); g.fillRect(0, 0, 1280, 720);
      Panel.draw(g, x0, y0, W, H);
      L.add([blocker, g, T(this, 640, y0 + 38, _t('look.title'), { size: SZ.h2, bold: true, color: C.gold }),
        U.fitText(T(this, 640, y0 + 72, _t('look.sub', { c: cd.name }), { size: SZ.small, color: C.muted }), W - 60, 0, SZ.micro)]);
      // Nivel de Afinidad (o hito) en que se consigue cada opción
      const needLv = (slot, id) => { for (let lv = 2; lv <= D.AFFINITY_MAX; lv++) { const r = D.AFFINITY_REWARDS[lv] || {}; if (slot === 'relic' ? (r.relic !== undefined && D.ALT_STARTERS[ch][r.relic] === id) : slot === 'deck' ? r.deck : r[slot] === id) return lv; } return null; };
      const needPct = (slot, id) => (D.CODEX_MILESTONES.find((m) => m.cosmetic[0] === slot && m.cosmetic[1] === id) || {}).pct;
      const slots = [
        ['relic', _t('look.relic'), [''].concat(D.ALT_STARTERS[ch]), (id) => D.ALL_RELICS[id || cd.starterRelic].name],
        ['deck', _t('look.deck'), [false, true], (v) => (v ? _t('look.deckPath') : _t('look.deckNormal'))],
        ['frame', _t('look.frame'), Object.keys(D.COSMETICS.frame), (id) => D.COSMETICS.frame[id].name],
        ['back', _t('look.back'), Object.keys(D.COSMETICS.back), (id) => D.COSMETICS.back[id].name],
        ['aura', _t('look.aura'), Object.keys(D.COSMETICS.aura), (id) => D.COSMETICS.aura[id].name],
        ['title', _t('look.titleRow'), Object.keys(D.COSMETICS.title), (id) => (id === 'hero' ? D.AFFINITY_TITLES[ch] : D.COSMETICS.title[id].name)]
      ];
      const cur = {};
      slots.forEach(([slot, label, opts, nameOf], k) => {
        const y = y0 + 122 + k * 66 + (k > 0 ? 14 : 0);
        L.add(T(this, x0 + 34, y, label, { size: SZ.body, bold: true, color: C.parch, ox: 0 }));
        const val = T(this, x0 + 440, y - 2, '', { size: SZ.body, bold: true });
        const sw = this.add.graphics();
        const req = T(this, x0 + 440, y + 23, '', { size: SZ.small, color: C.muted, wrap: 420, align: 'center', oy: 0, lineSpacing: -3 });   // bajo las flechas ◀ ▶
        const meta0 = loadMeta(), lo0 = M.loadoutOf(meta0, ch);
        cur[slot] = Math.max(0, opts.indexOf(lo0[slot]));
        const owned = (v) => (slot === 'relic' ? !v || M.affinityUnlocks(loadMeta(), ch).relics.includes(v) : slot === 'deck' ? !v || M.affinityUnlocks(loadMeta(), ch).deck : M.ownsCosmetic(loadMeta(), ch, slot, v));
        const paint = () => {
          const v = opts[cur[slot]], ok = owned(v);
          val.setText((ok ? '' : '🔒 ') + nameOf(v)).setColor(U.hex(ok ? C.gold : C.muted));
          U.fitText(val, 250, 0, SZ.micro);
          sw.clear();
          const col = ['frame', 'back', 'aura'].includes(slot) && v !== 'none' ? U.lookColor(slot, v, ch) : null;
          if (col !== null) { sw.fillStyle(col, ok ? 1 : 0.35); sw.fillCircle(x0 + 440 - val.width / 2 - 16, y - 2, 7); }
          let r = '';
          if (!ok) { const lv = needLv(slot, v), pc = needPct(slot, v); r = lv ? _t('look.needLv', { n: lv }) : pc ? _t('look.needPct', { p: pc }) : ''; }
          else if (slot === 'relic') r = D.ALL_RELICS[v || cd.starterRelic].text;
          else if (slot === 'deck' && v) r = _t('look.deckDesc');
          req.setText(r).setColor(U.hex(ok ? C.parch : C.muted));
          req.setWordWrapWidth(420, true); U.fitText(req, 420, slot === 'relic' ? 44 : slot === 'deck' ? 34 : 20, SZ.micro);
        };
        const step = (d) => {
          cur[slot] = (cur[slot] + d + opts.length) % opts.length;
          const v = opts[cur[slot]];
          if (owned(v)) { const m = loadMeta(); M.setLoadout(m, ch, { [slot]: v }); saveMeta(m); }
          Sfx.play('click'); paint();
        };
        const lb = button(this, x0 + 270, y - 2, '◀', () => step(-1), { w: 40, h: TH.button.minH, size: SZ.small, variant: 'secondary' });
        const rb = button(this, x0 + 610, y - 2, '▶', () => step(1), { w: 40, h: TH.button.minH, size: SZ.small, variant: 'secondary' });
        L.add([val, sw, req, lb, rb]);
        paint();
      });
      const close = this.closeLook = () => { if (!this.lookLayer) return; L.destroy(); this.lookLayer = null; this.scene.restart({ char: ch, padRow: 'look' }); };
      L.add(button(this, 640, y0 + H - 38, _t('s.listo'), close, { w: 200, h: TH.button.minH, size: SZ.body, variant: 'primary' }));
      this.input.keyboard.once('keydown-ESC', close);
    }
    paintPactBtn() {
      const n = this.pacts.length, b = E.pactBonus({ pacts: this.pacts });
      this.pactBtn.setLabel(n ? _t('pacts.btn', { n, m: fmtMult(b) }) : _t('s.pactos'));
    }
    /** Panel de pactos: casillas con su reto y su bonus, y el multiplicador total. */
    openPacts() {
      if (this.pactLayer) return;
      const L = this.pactLayer = this.add.container(0, 0).setDepth(LY.modal);
      const W = 720, H = 560, x0 = 640 - W / 2, y0 = 360 - H / 2;
      const blocker = this.add.zone(0, 0, 1280, 720).setOrigin(0, 0).setInteractive();
      const g = this.add.graphics();
      g.fillStyle(TC.shade, TH.alpha.curtain); g.fillRect(0, 0, 1280, 720);
      Panel.draw(g, x0, y0, W, H);
      L.add([blocker, g, T(this, 640, y0 + 40, _t('s.pactos'), { size: SZ.h2, bold: true, color: C.gold }),
        T(this, 640, y0 + 76, _t('s.retos_voluntarios_cada_pacto_activo'), { size: SZ.small, color: C.muted, wrap: W - 60, align: 'center' })]);
      const total = T(this, 640, y0 + H - 92, '', { size: SZ.body, bold: true, color: C.gold });
      L.add(total);
      const rows = D.PACT_IDS.map((id, i) => {
        const y = y0 + 122 + i * 50, pc = D.PACTS[id];
        const box = this.add.graphics();
        const hit = this.add.zone(x0 + 24, y - 22, W - 48, 44).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        const name = T(this, x0 + 84, y - 9, pc.name, { size: SZ.body, bold: true, ox: 0, color: C.parch });
        const txt = T(this, x0 + 84, y + 12, pc.text, { size: SZ.small, ox: 0, color: C.muted });
        const bonus = T(this, x0 + W - 40, y, '+' + I18N.pct(Math.round(pc.bonus * 100)), { size: SZ.body, bold: true, ox: 1, color: C.gold });
        const paint = () => {
          const on = this.pacts.includes(id);
          box.clear();
          if (on) { box.fillStyle(TC.surfaceRaised, 1); box.fillRoundedRect(x0 + 24, y - 22, W - 48, 44, TH.radius); }
          box.fillStyle(TC.deep, 1); box.fillRoundedRect(x0 + 40, y - 13, 26, 26, TH.radius);
          box.lineStyle(TH.borderWidth, on ? C.gold : C.line, 1); box.strokeRoundedRect(x0 + 40, y - 13, 26, 26, TH.radius);
          if (on) { box.lineStyle(4, C.gold, 1); box.beginPath(); box.moveTo(x0 + 46, y); box.lineTo(x0 + 51, y + 6); box.lineTo(x0 + 61, y - 7); box.strokePath(); }
          name.setColor(U.hex(on ? C.gold : C.parch));
        };
        hit.on('pointerup', () => {
          this.pacts = this.pacts.includes(id) ? this.pacts.filter((x) => x !== id) : this.pacts.concat(id);
          U.Store.set(PACTS_KEY, JSON.stringify(this.pacts));
          Sfx.play('click'); rows.forEach((f) => f()); upd();
        });
        L.add([box, hit, name, txt, bonus]);
        return paint;
      });
      const upd = () => {
        const n = this.pacts.length, b = E.pactBonus({ pacts: this.pacts });
        total.setText(n ? _t('pacts.total', { n, m: fmtMult(b) }) + (n >= 4 ? _t('pacts.ach', { a: M.BY_ID.pactista.name }) : '') : _t('pacts.none'));
        this.paintPactBtn();
      };
      rows.forEach((f) => f()); upd();
      const close = () => { L.destroy(); this.pactLayer = null; };
      L.add(button(this, 640 - 110, y0 + H - 44, _t('s.quitar_todos'), () => { this.pacts = []; U.Store.set(PACTS_KEY, '[]'); rows.forEach((f) => f()); upd(); }, { w: 190, h: TH.button.minH, size: SZ.body, variant: 'secondary' }));
      L.add(button(this, 640 + 110, y0 + H - 44, _t('s.listo'), close, { w: 190, h: TH.button.minH, size: SZ.body, variant: 'primary' }));
      this.input.keyboard.once('keydown-ESC', close);
    }
    /** Tarjeta de un personaje (o del hueco «Próximamente…» si id es null). */
    charCard(x, y, id, meta, selected, W = 240) {
      const H = 330, cd = id && D.CHARACTERS[id], open = !!cd && meta.unlockedChars.includes(id);
      const g = this.add.graphics();
      g.fillStyle(TC.shade, TH.alpha.shadow); g.fillRoundedRect(x - W / 2 + 4, y - H / 2 + 6, W, H, TH.radius);
      g.fillStyle(open ? C.panel : TC.deep, 0.97); g.fillRoundedRect(x - W / 2, y - H / 2, W, H, TH.radius);
      g.lineStyle(TH.borderWidth, selected ? C.gold : open ? (cd.color || C.line) : TC.line, 1); g.strokeRoundedRect(x - W / 2, y - H / 2, W, H, TH.radius);
      if (selected) { const glow = this.add.circle(x, y - 70, 90, cd.color || C.ember, 0.12); this.tweens.add({ targets: glow, alpha: 0.24, scale: 1.08, duration: DUR.ambient, yoyo: true, repeat: -1 }); }
      const key = 'art_' + (cd ? cd.art : 'mage');
      const img = this.add.image(x, y + 10, key).setOrigin(0.5, 1);
      img.setScale(Math.min(170 / this.textures.get(key).getSourceImage().height, (W - 40) / this.textures.get(key).getSourceImage().width));
      if (!open) { img.setTint(TC.shade).setAlpha(0.8); this.add.image(x, y - 70, 'ic_lock').setIconScale(0.7); }
      const compact = W < 100;   // 6+ personajes: tarjeta estrecha con nombre, título y PV (el resto va en el detalle de la derecha)
      if (open && compact) {
        U.fitLine(T(this, x, y + 32, cd.name, { size: SZ.body, bold: true, color: cd.color }), W - 10);
        U.fitText(T(this, x, y + 70, cd.title, { size: SZ.small, wrap: W - 14, align: 'center', color: C.muted }), W - 14, 40, SZ.micro);
        T(this, x, y + 112, _t('prep.hp', { n: cd.hp }), { size: SZ.small, bold: true, color: C.parch });
        const hit = this.add.rectangle(x, y, W, H, 0, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => { if (!selected) { Sfx.play('click'); this.scene.restart({ char: id }); } });
        return hit;
      }
      if (open) {
        U.fitLine(T(this, x, y + 32, cd.name, { size: SZ.h3, bold: true, color: cd.color }), W - 16, SZ.small);
        U.fitText(T(this, x, y + 58, _t('s.0_1_pv', { 0: cd.title, 1: cd.hp }), { size: SZ.small, color: C.muted }), W - 12, 0, SZ.micro);
        U.fitText(T(this, x, y + 90, cd.mechanicText || '', { size: SZ.small, wrap: W - 24, align: 'center', color: C.parch }), W - 24, 36, SZ.micro);
        const rel = D.ALL_RELICS[M.loadoutOf(meta, id).relic || cd.starterRelic];
        U.fitText(T(this, x, y + 134, rel ? _t('s.reliquia_0', { 0: rel.name }) : _t('s.sin_reliquia_inicial'), { size: SZ.small, color: rel ? C.gold : C.muted, style: rel ? 'normal' : 'italic' }), W - 12, 0, SZ.micro);
        const hit = this.add.rectangle(x, y, W, H, 0, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => { if (!selected) { Sfx.play('click'); this.scene.restart({ char: id }); } });
        return hit;
      } else {
        U.fitLine(T(this, x, y + 40, cd ? cd.name : _t('s.proximamente'), { size: SZ.body, bold: true, color: C.muted }), W - 10);
        const prog = id === 'electromante' ? _t('unlock.groupProg', { n: Math.min(M.GROUP_WINS_UNLOCK, meta.groupWins || 0), m: M.GROUP_WINS_UNLOCK }) : '';   // Electromante: combates en grupo ganados
        U.fitText(T(this, x, y + 64, cd ? (cd.unlock || _t('s.bloqueado')) + prog : _t('s.nuevos_personajes_en_camino'), { size: SZ.small, color: C.muted, wrap: W - 14, align: 'center', style: 'italic', oy: 0 }), W - 14, 92, SZ.micro);
      }
    }
  }


  /* =================================================================
   * Elige tu senda (Parche 3.1): las 3 sendas del personaje, con su carta inicial (★) y dos ejemplos.
   * Al elegir se crea la partida con esa senda; «Sin senda» da +10 % de Esencia al terminar.
   * ================================================================= */
  /** Cartas de ejemplo de una senda: la ★ y las dos más representativas (solo de esa senda; raras antes). */
  function pathExamples(path) {
    const rank = { rare: 0, uncommon: 1, common: 2 };
    const own = Object.keys(D.CARDS).filter((id) => id !== path.star && (D.CARDS[id].tags || [])[0] === path.id && !E.isLocked(null, id))
      .sort((a, b) => ((D.CARDS[a].tags.length - D.CARDS[b].tags.length) || (rank[D.CARDS[a].rarity] - rank[D.CARDS[b].rarity]) || (a < b ? -1 : 1)));
    return [path.star, ...own.slice(0, 2)];
  }
  class PathSelect extends Phaser.Scene {
    constructor() { super('PathSelect'); }
    create(data) {
      const opts = (data && data.opts) || { char: 'piromago' };
      const cd = D.CHARACTERS[opts.char] || D.CHARACTERS.piromago;
      menuBackdrop(this, 0.5);
      this.tip = tooltip(this);
      const back = () => this.scene.start('Prep', { char: cd.id });
      const backBtn = button(this, 80, 40, _t('s.volver'), back, { w: 130, h: 40, size: 18, variant: 'ghost' });
      T(this, 640, 46, _t('path.title'), { size: 42, font: 'display', color: C.gold, stroke: 0x000000, strokeThickness: 4 });
      T(this, 640, 86, _t('path.sub', { c: cd.name }), { size: 16, color: C.muted });
      const start = (pathId) => {
        Sfx.play('click');
        const run = E.newRun(undefined, Object.assign({ contracts: true }, opts, pathId ? { path: pathId } : { noPath: true }));   // Parche 3.5: oferta de contratos
        this.registry.set('run', run);
        go(this);
      };
      const items = [];
      cd.paths.forEach((pth, i) => {
        const cx = 216 + i * 424, W = 396, H = 440, y0 = 110;
        const g = this.add.graphics();
        const paint = (on) => {
          g.clear();
          g.fillStyle(0x000000, 0.4); g.fillRoundedRect(cx - W / 2 + 4, y0 + 6, W, H, 16);
          g.fillStyle(C.panel, 0.96); g.fillRoundedRect(cx - W / 2, y0, W, H, 16);
          g.lineStyle(on ? 3 : 1.5, on ? C.gold : pth.color, 1); g.strokeRoundedRect(cx - W / 2, y0, W, H, 16);
          g.fillStyle(pth.color, 0.10); g.fillRoundedRect(cx - W / 2 + 6, y0 + 6, W - 12, 112, 12);
        };
        paint(false);
        this.add.circle(cx, y0 + 40, 26, 0x0d0b0a, 1).setStrokeStyle(2.5, pth.color, 1);
        this.add.image(cx, y0 + 40, 'ic_' + pth.icon).setIconScale(0.58);
        U.fitText(T(this, cx, y0 + 90, pth.name, { size: 32, font: 'display', color: pth.color, stroke: 0x000000, strokeThickness: 4 }), W - 30, 0, 18);
        U.fitText(T(this, cx, y0 + 140, pth.desc, { size: 15, color: C.parch, wrap: W - 44, align: 'center' }), W - 44, 44, 11);
        const ex = pathExamples(pth);
        T(this, cx - 124, y0 + 178, _t('path.star'), { size: 13, bold: true, color: C.gold });
        U.fitText(T(this, cx + 62, y0 + 178, _t('path.examples'), { size: 13, bold: true, color: C.muted }), 220, 0, 10);
        ex.forEach((id, k) => {
          const card = { uid: -300 - i * 10 - k, id, up: false };
          const x = cx - 124 + k * 124, y = y0 + 268;
          const cv = cardView(this, card).setPosition(x, y).setScale(0.7);
          if (k === 0) { const ring = this.add.graphics(); ring.lineStyle(4, C.gold, 1); ring.strokeRoundedRect(-U.CARD_W / 2 - 5, -U.CARD_H / 2 - 5, U.CARD_W + 10, U.CARD_H + 10, 14); cv.addAt(ring, 0); }
          cv.setInteractive();
          cv.on('pointerover', () => showGloss(this, card, { x, y, scale: 0.7 }));
          cv.on('pointerout', () => { this.tip.hide(); hideGloss(this); });
        });
        const n = Object.keys(D.CARDS).filter((id) => (D.CARDS[id].tags || []).includes(pth.id)).length;
        T(this, cx, y0 + 364, _t('path.count', { n }), { size: 14, color: C.muted });
        const btn = button(this, cx, y0 + 404, _t('path.choose'), () => start(pth.id), { w: 240, h: 44, size: 20 });
        const hit = this.add.zone(cx - W / 2, y0, W, 170).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => paint(true)); hit.on('pointerout', () => paint(false));
        hit.on('pointerup', () => start(pth.id));
        items.push({ key: 'p' + i, obj: btn, onConfirm: () => btn.press() });
      });
      const noBtn = button(this, 1088, 44, _t('path.none', { p: Math.round((D.ESSENCE.noPath - 1) * 100) }), () => start(null), { w: 320, h: 42, size: 16, variant: 'ghost' });   // arriba a la derecha: abajo queda sitio para el consejo
      items.push({ key: 'none', obj: noBtn, onConfirm: () => noBtn.press() });
      // Mando: ←/→ entre sendas, ↑ «Sin senda» (arriba a la derecha), B vuelve
      U.padNav(this, {
        items: () => items,
        main: () => items[0].obj,
        back, backObj: () => backBtn,
        onAction: (a, api) => {
          const i = Math.max(0, items.indexOf(api.fm.cur));
          if (a === 'left' || a === 'right') { if (i < 3) api.fm.focus(items[(i + (a === 'left' ? 2 : 1)) % 3]); Sfx.play('click', { volume: 0.4 }); return true; }
          if (a === 'up') { api.fm.focus(items[3]); return true; }
          if (a === 'down') { if (i === 3) api.fm.focus(items[2]); return true; }
          return false;
        }
      });
      showTip(this, 'senda', { x: 18, y: 106, w: 1244, h: 448 });
    }
  }

  /* =================================================================
   * Contratos (Parche 3.5): tras elegir personaje y senda, 3 objetivos opcionales; eliges 1 o ninguno.
   * ================================================================= */
  class Contracts extends Phaser.Scene {
    constructor() { super('Contracts'); }
    create() {
      const run = this.run = this.registry.get('run'), p = run.pending;
      menuBackdrop(this, 0.55);
      this.tip = tooltip(this);
      T(this, 640, 52, _t('ct.title'), { size: 44, font: 'display', color: C.gold, stroke: 0x000000, strokeThickness: 4 });
      U.fitText(T(this, 640, 98, _t('ct.sub'), { size: 17, color: C.muted, wrap: 1000, align: 'center' }), 1100, 46, 12);
      const take = (id) => { if (!E.takeContract(run, id)) return; Sfx.play(id ? 'coin' : 'click'); go(this); };
      const items = [];
      p.options.forEach((id, i) => {
        const d = D.CONTRACTS[id], cx = 236 + i * 404, W = 372, H = 404, y0 = 140;
        const own = d.class && D.CHARACTERS[d.class];
        const col = own ? (D.CHARACTERS[d.class].color || C.gold) : C.gold;
        const g = this.add.graphics();
        const paint = (on) => {
          g.clear();
          g.fillStyle(0x000000, 0.4); g.fillRoundedRect(cx - W / 2 + 4, y0 + 6, W, H, 16);
          g.fillStyle(C.panel, 0.96); g.fillRoundedRect(cx - W / 2, y0, W, H, 16);
          g.lineStyle(on ? 3 : 1.5, on ? C.gold : col, 1); g.strokeRoundedRect(cx - W / 2, y0, W, H, 16);
          g.fillStyle(col, 0.10); g.fillRoundedRect(cx - W / 2 + 6, y0 + 6, W - 12, 118, 12);
        };
        paint(false);
        this.add.circle(cx, y0 + 48, 32, 0x0d0b0a, 1).setStrokeStyle(2.5, col, 1);
        this.add.image(cx, y0 + 48, 'ic_' + d.icon).setIconScale(0.62);
        U.fitText(T(this, cx, y0 + 104, d.name, { size: 30, font: 'display', color: col, stroke: 0x000000, strokeThickness: 4 }), W - 30, 0, 18);
        if (own) U.fitText(T(this, cx, y0 + 142, _t('ct.ofChar', { c: D.CHARACTERS[d.class].name.toUpperCase() }), { size: 14, bold: true, color: col }).setLetterSpacing(1), W - 40, 0, 10);
        U.fitText(T(this, cx, y0 + 200, d.text, { size: 19, color: C.parch, wrap: W - 48, align: 'center', lineSpacing: 2 }), W - 48, 96, 12);
        const rw = this.add.graphics(); rw.fillStyle(0x000000, 0.3); rw.fillRoundedRect(cx - W / 2 + 18, y0 + 262, W - 36, 56, 10);
        U.fitText(T(this, cx, y0 + 290, U.contractRewardText(d), { size: 16, bold: true, color: C.gold, wrap: W - 60, align: 'center' }), W - 60, 48, 11);
        const btn = button(this, cx, y0 + 360, _t('ct.take'), () => take(id), { w: 240, h: 44, size: 20 });
        const hit = this.add.zone(cx - W / 2, y0, W, 320).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => paint(true)); hit.on('pointerout', () => paint(false));
        hit.on('pointerup', () => take(id));
        items.push({ key: 'c' + i, obj: btn, onConfirm: () => btn.press() });
      });
      const noBtn = button(this, 640, 620, _t('ct.none'), () => take(null), { w: 300, h: 44, size: 18, variant: 'ghost' });
      items.push({ key: 'none', obj: noBtn, onConfirm: () => noBtn.press() });
      T(this, 640, 668, _t('ct.foot'), { size: 14, color: C.muted, style: 'italic' });
      // Mando: ←/→ entre contratos, ↓ «Sin contrato»
      U.padNav(this, {
        items: () => items,
        main: () => items[0].obj,
        onAction: (a, api) => {
          const i = Math.max(0, items.indexOf(api.fm.cur)), n = items.length - 1;
          if (a === 'left' || a === 'right') { if (i < n) api.fm.focus(items[(i + (a === 'left' ? n - 1 : 1)) % n]); Sfx.play('click', { volume: 0.4 }); return true; }
          if (a === 'down') { api.fm.focus(items[n]); return true; }
          if (a === 'up') { if (i === n) api.fm.focus(items[1] || items[0]); return true; }
          return false;
        }
      });
    }
  }

  /**
   * Selector ◀ A3 ▶ de Ascensión de UN personaje (cada uno tiene su propio nivel desbloqueado).
   * Devuelve { get() } con el nivel elegido; lo recuerda por personaje.
   */
  function ascSelector(scene, x0, y, ch) {
    const max = M.maxAsc(loadMeta(), ch);
    let n = selectedAsc(loadMeta(), ch);
    if (max <= 0) { T(scene, x0, y, _t('s.ascension_gana_una_partida_para'), { size: SZ.small, color: C.muted, style: 'italic', ox: 0 }); return { get: () => 0 }; }
    T(scene, x0, y, _t('s.ascension'), { size: SZ.small, bold: true, color: C.gold, ox: 0 }).setLetterSpacing(2);
    const yy = y + 34;
    const label = T(scene, x0 + 74, yy, '', { size: SZ.h3, bold: true, color: C.parch });
    const rule = T(scene, x0 + 160, yy, '', { size: SZ.small, color: C.flame, ox: 0, wrap: 300 });
    const arrow = (x, dir, fn) => {   // flechas dibujadas (las fuentes no traen ◀ ▶)
      const b = button(scene, x, yy, '', fn, { w: 44, h: TH.button.minH, variant: 'secondary' });
      const g = scene.add.graphics(); g.fillStyle(C.parch, 1); g.fillTriangle(dir * 7, 0, -dir * 6, -8, -dir * 6, 8); b.add(g);
      const base = b.setEnabled; b.setEnabled = (v) => { g.setAlpha(v ? 1 : 0.3); return base(v); };
      return b;
    };
    const prev = arrow(x0 + 22, -1, () => set(n - 1));
    const next = arrow(x0 + 126, 1, () => set(n + 1));
    const set = (v) => {
      n = Math.max(0, Math.min(max, v));
      U.Store.set(ASC_KEY + ':' + ch, String(n));
      label.setText(`A${n}`).setColor(U.hex(n > 0 ? C.ember : C.muted));
      rule.setText(ascRule(n)); U.fitText(rule, 300, 40, SZ.micro);
      prev.setEnabled(n > 0); next.setEnabled(n < max);
    };
    set(n);
    showTip(scene, 'ascension', () => ({ x: x0 - 4, y: yy - 24, w: 470, h: 48 }));
    return { get: () => n, prev, next };
  }

  /* =================================================================
   * Mapa
   * ================================================================= */
  const NODE_ICON = { combat: 'sword', elite: 'skull', event: 'book', shop: 'bag', rest: 'campfire', chest: 'chest', boss: 'crown',
    mystery: 'question', forge: 'hammer', cursedaltar: 'cursecard', goldelite: 'skull', peddler: 'cart' };   // Parche 3.5: el «?» es el Misterio; el evento, un libro
  /** Tipos de sala en el orden de la leyenda. */
  const NODE_KEYS = ['combat', 'elite', 'goldelite', 'event', 'mystery', 'shop', 'peddler', 'rest', 'forge', 'cursedaltar', 'chest', 'boss'];
  const GOLD = 0xffd27a;
  const NODE_COLOR = { combat: 0xc9b8a0, elite: C.blood, event: C.arcane, shop: C.gold, rest: C.ember, chest: C.gold, boss: C.blood,
    mystery: 0xb98cff, forge: 0xd9904a, cursedaltar: 0x8a5ad8, goldelite: 0xffd27a, peddler: C.gold };
  /** ¿Se ve ya qué hay en este Misterio? (Mapa del Cartógrafo o los rumores de la Posada del Cruce en este acto) */
  const mysteryShown = (run, n) => n.type === 'mystery' && !n.visited && n.inner && (E.hasRelic(run, 'mapa') || ((run.flags || {}).rumores === E.actOf(run)));
  /** Paleta del mapa por acto: el acto II usa tonos fríos en caminos, nodos y panel. */
  const MAP_STYLE = {
    1: { path: C.line, done: C.gold, panel: 0x080b0a, node: C.panel, visited: 0x2b2416, border: C.gold, bossIcon: 'crown', title: C.gold },
    2: { path: 0x4f6f8f, done: 0xbfe3ff, panel: 0x0a1222, node: 0x14213a, visited: 0x1c2c44, border: 0x9fd6ff, bossIcon: 'wyrm', title: 0xcfeaff },
    3: { path: 0x6a4f9a, done: 0xd8b8ff, panel: 0x0e0818, node: 0x1e1236, visited: 0x2a1a44, border: 0xb27bff, bossIcon: 'eye', title: 0xe0c8ff, label: 0xc9a8ff }
  };
  const mapStyle = (run) => MAP_STYLE[E.actOf(run)] || MAP_STYLE[1];

  class MapScene extends Phaser.Scene {
    constructor() { super('Map'); }
    create() {
      // Phaser reutiliza la instancia de la escena: reiniciar el estado de cada visita
      this.travelling = false; this.dragMoved = false; this.dragY = undefined;
      const run = this.run = this.registry.get('run');
      if (this.textures.exists('bg_map')) {   // pergamino del mundo (ya oscurecido en el JPG) + velo del color del acto
        this.add.image(640, 360, 'bg_map').setDisplaySize(1280, 720);
        this.add.rectangle(640, 360, 1280, 720, ({ 1: 0x05080a, 2: 0x050a14, 3: 0x0a0514 })[Math.min(3, E.actOf(run))], 0.3);
      } else {
        backdrop(this, E.actOf(run) >= 3 ? 'arcane' : E.actOf(run) >= 2 ? 'frost' : 'night');
        this.add.rectangle(640, 360, 1280, 720, 0x05080a, 0.45);
      }
      Music.base();
      this.tip = tooltip(this);
      this.hud = hud(this, run, { tip: this.tip });
      runTags(this, run);

      const H = this.worldH = 170 + E.ROWS * 118 + 140;
      const world = this.world = this.add.container(0, 0);
      world.scrollRoot = true;   // se desplaza: lo que queda fuera de la vista no cuenta como «salirse» (test/overlap.js)
      const pos = (n) => {
        const h = [...n.id].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7);
        const jx = n.id === 'boss' ? 0 : ((h % 37) - 18), jy = n.id === 'boss' ? 0 : (((h >> 5) % 21) - 10);
        return { x: 640 + (n.lane - 1.5) * 175 + jx, y: H - 170 - n.row * 118 + jy };
      };
      const nodes = Object.values(run.map.nodes);
      const P = {}; nodes.forEach((n) => { P[n.id] = pos(n); });
      const start = { x: 640, y: H - 60 };

      // Caminos: punteados; el recorrido hecho, en oro
      const g = this.add.graphics();
      world.add(g);
      const dotted = (a, b, color, alpha, done) => {
        const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), steps = Math.floor(dist / 12);
        for (let i = 1; i < steps; i++) {
          const t = i / steps, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
          if (done) { g.fillStyle(color, 0.16); g.fillCircle(x, y, 8); g.fillStyle(color, 0.28); g.fillCircle(x, y, 5); }   // el camino recorrido brilla
          g.fillStyle(color, alpha); g.fillCircle(x, y, done ? 3 : 2.2);
        }
      };
      const ms = mapStyle(run);
      nodes.filter((n) => n.row === 0).forEach((n) => dotted(start, P[n.id], n.visited ? ms.done : ms.path, n.visited ? 1 : 0.9, n.visited));
      nodes.forEach((n) => n.next.forEach((id) => {
        const m = run.map.nodes[id];
        const done = n.visited && m.visited;
        dotted(P[n.id], P[id], done ? ms.done : ms.path, done ? 1 : 0.9, done);
      }));

      // Camino resaltado al pasar por un nodo (de tu posición al nodo y del nodo al jefe)
      const hl = this.add.graphics();
      world.add(hl);
      const avSet = new Set(E.availableNodes(run));
      const fwd = (id, out = new Set()) => { if (out.has(id)) return out; out.add(id); run.map.nodes[id].next.forEach((x) => fwd(x, out)); return out; };
      const reach = new Set(); avSet.forEach((id) => fwd(id, reach));
      const fwdOf = {}; reach.forEach((id) => { fwdOf[id] = fwd(id); });
      this.highlightPath = (id) => {
        hl.clear();
        if (!id || !reach.has(id)) return;
        const on = new Set(fwdOf[id]);
        reach.forEach((m) => { if (fwdOf[m].has(id)) on.add(m); });
        const seg = (a, b) => {
          const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), steps = Math.floor(dist / 12);
          for (let i = 1; i < steps; i++) {
            const t = i / steps, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
            hl.fillStyle(C.ember, 0.25); hl.fillCircle(x, y, 7);
            hl.fillStyle(C.flame, 1); hl.fillCircle(x, y, 3.4);
          }
        };
        const from = run.pos ? P[run.pos] : start;
        avSet.forEach((a) => { if (on.has(a)) seg(from, P[a]); });
        on.forEach((a) => run.map.nodes[a].next.forEach((b) => { if (on.has(b)) seg(P[a], P[b]); }));
      };

      // La Grieta: atajo de niebla desde tu posición hasta la fila anterior al jefe
      if (run.warp && run.pos) run.warp.forEach((id) => dotted(P[run.pos], P[id], C.arcane, 0.9, true));

      // Entrada
      const sc = this.add.circle(start.x, start.y, 14, C.panel2).setStrokeStyle(2, ms.border, 0.8);
      world.add([sc, T(this, start.x, start.y + 28, _t('s.entrada'), { size: 14, color: C.muted })]);

      // Nodos
      const av = new Set(E.availableNodes(run));
      const wind = new Set(E.windNodes(run));   // Frasco de Viento: salas vecinas no unidas (una vez por acto)
      this.markerTarget = run.pos ? P[run.pos] : start;
      nodes.forEach((n) => {
        const p = P[n.id], r = n.type === 'boss' ? 46 : 27;
        const isWind = wind.has(n.id), isAv = av.has(n.id) || isWind, isCur = run.pos === n.id;
        const hot = isWind ? C.frost : C.ember;
        const node = this.add.container(p.x, p.y);
        if ((n.type === 'elite' || n.type === 'boss' || n.type === 'goldelite') && !n.visited) {   // aura de élite, Élite Dorada y jefe
          const col = n.type === 'boss' ? C.blood : n.type === 'goldelite' ? GOLD : (NODE_COLOR.elite || C.ember);
          const aura = this.add.circle(0, 0, r + (n.type === 'boss' ? 22 : n.type === 'goldelite' ? 18 : 14), col, n.type === 'goldelite' ? 0.26 : 0.18).setBlendMode(Phaser.BlendModes.ADD);
          if (!U.Opts.reduceMotion) this.tweens.add({ targets: aura, scale: { from: 0.9, to: 1.15 }, alpha: { from: 0.22, to: 0.06 }, duration: 1300 + (n.type === 'boss' ? 400 : 0), yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: Math.random() * 800 });
          node.add(aura);
        }
        if (isAv) {
          const halo = this.add.circle(0, 0, r + 12, hot, 0.22);
          this.tweens.add({ targets: halo, scale: 1.25, alpha: 0.05, duration: 900, yoyo: true, repeat: -1 });
          node.add(halo);
        }
        const ring = this.add.circle(0, 0, r, n.visited ? ms.visited : ms.node)
          .setStrokeStyle(isAv ? 3 : 2, isAv ? hot : (n.visited ? ms.done : (n.type === 'boss' ? ms.border : NODE_COLOR[n.type])), isAv || n.visited ? 1 : 0.75);
        const ic = this.add.image(0, 0, 'ic_' + (n.type === 'boss' ? ms.bossIcon : NODE_ICON[n.type])).setIconScale(r / 40);
        if (n.type === 'goldelite') ic.setTint(GOLD);
        // Mapa del Cartógrafo / rumores: en los Misterios se ve qué hay (evento, combate, tienda o cofre)
        const peek = mysteryShown(run, n);
        if (peek) ic.setTexture('ic_' + NODE_ICON[n.inner]).setIconScale(r / 46);
        const shown = peek ? n.inner : n.type;
        const lbl = T(this, 0, r + 14, D.NODE_TYPES[shown].name + (shown !== n.type ? ' (?)' : ''), { size: 13, color: n.type === 'goldelite' ? GOLD : isAv ? C.parch : C.muted, bold: isAv });
        node.add([ring, ic, lbl]);
        if (!isAv && !n.visited) node.setAlpha(0.6);
        if (isCur) node.add(this.add.circle(0, 0, r + 6).setStrokeStyle(2, ms.done, 1));
        if (isAv) {
          this.tweens.add({ targets: ring, scale: { from: 1, to: 1.08 }, duration: 700, yoyo: true, repeat: -1 });
          this.tweens.add({ targets: ic, scale: { from: ic.scale, to: ic.scale * 1.08 }, duration: 700, yoyo: true, repeat: -1 });   // relativo: el icono PNG es de 128 px
          node.setSize(r * 2 + 20, r * 2 + 20).setInteractive({ useHandCursor: true });
          node.on('pointerup', () => { if (!this.dragMoved) this.travel(n.id, p); });
          this.padNodes = (this.padNodes || []).concat({ obj: node, onConfirm: () => this.travel(n.id, p),
            onFocus: () => { this.highlightPath(n.id); if (U.Input.device !== 'mouse') this.setScroll(-(p.y - 420), true); } });
        }
        if (!n.visited) {   // todos los nodos futuros: tooltip + camino resaltado hasta el jefe
          if (!isAv) node.setSize(r * 2 + 10, r * 2 + 10).setInteractive();
          node.on('pointerover', () => {
            if (n.type === 'boss') { const bd = D.ENEMIES[E.bossOf(run)]; this.tip.show(220, 600, bd.name, bd.desc || D.NODE_TYPES.boss.desc); this.highlightPath(n.id); return; }   // el jefe que te espera
            const nm = n.type === 'elite' ? _t('s.elite_afijo_desconocido') : n.type === 'goldelite' ? _t('map.goldTip') : D.NODE_TYPES[n.type].name;
            const ds = D.NODE_TYPES[n.type].desc + (mysteryShown(run, n) ? '\n' + _t('map.mysteryIs', { t: D.NODE_TYPES[n.inner].name }) : '');
            this.tip.show(220, 600, nm + (isWind ? _t('s.frasco_de_viento') : ''), ds + (isWind ? _t('s.saltas_aqui_con_el_frasco') : '')); this.highlightPath(n.id);
          });
          node.on('pointerout', () => { this.tip.hide(); this.highlightPath(null); });
        }
        world.add(node);
      });

      // Ficha del personaje: disco con su retrato y sombra (viaja por el camino al elegir nodo)
      const tk = this.marker = this.add.container(this.markerTarget.x - 48, this.markerTarget.y - 6);
      const disc = this.add.circle(0, 14, 22, ms.panel, 0.95).setStrokeStyle(2.5, ms.done, 1);
      const port = this.add.image(0, 30, charArt(run)).setOrigin(0.5, 1).setScale(U.heightScale(this, charArt(run), 58));
      tk.add([disc, port]);
      tk.shadow = this.add.ellipse(tk.x, tk.y + 30, 44, 12, 0x000000, 0.35);
      world.add([tk.shadow, tk]);
      this.tweens.add({ targets: port, y: 27, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      // Mando / teclado: flechas entre los nodos disponibles; A viaja; Y ver mazo
      const fm = U.focusManager(this);
      fm.set(this.padNodes || []); this.padNodes = null;
      U.Input.bind(this, (a) => {
        if (this.travelling || this.scene.isActive('DeckView')) return;
        if (['up', 'down', 'left', 'right'].includes(a)) fm.move(a);
        else if (a === 'confirm') fm.confirm();
        else if (a === 'deck') this.scene.launch('DeckView', { mode: 'view', title: _t('s.tu_mazo') });
      });

      // Desplazamiento: rueda y arrastre (el contenedor se mueve; el HUD queda fijo)
      const avRows = [...av].map((id) => P[id].y);
      const focusY = avRows.length ? avRows.reduce((a, b) => a + b, 0) / avRows.length : H - 200;
      this.minY = -(H - 720); this.maxY = 0;
      this.setScroll(-(focusY - 470), false);
      this.input.on('wheel', (p, objs, dx, dy) => { if (!U.tipOpen(this)) this.setScroll(world.y - dy * 0.7, false); });
      this.input.on('pointerdown', (p) => { this.dragY = U.tipOpen(this) ? undefined : p.worldY; this.dragMoved = false; });
      this.input.on('pointermove', (p) => {
        if (!p.isDown || this.dragY === undefined || U.tipOpen(this)) return;
        const dy = p.worldY - this.dragY;
        if (Math.abs(dy) > 4) this.dragMoved = true;
        if (this.dragMoved) { this.setScroll(world.y + dy, false); this.dragY = p.worldY; }
      });
      this.input.on('pointerup', () => { this.dragY = undefined; });

      // Jefe que te espera (arriba a la derecha, como en Slay the Spire): retrato, nombre y tooltip con su descripción
      this.bossBadge(run, ms);

      // Paneles fijos: título y leyenda
      const head = this.add.graphics().setDepth(LY.panel);
      head.fillStyle(ms.panel, 0.8); head.fillRoundedRect(16, 64, 250, 384, 12);
      if (E.actOf(run) >= 2) { head.lineStyle(1.5, ms.border, 0.5); head.strokeRoundedRect(16, 64, 250, 384, 12); }
      // «Acto II» en versalitas sobre el nombre del acto
      T(this, 32, 84, _t('s.acto_0_2', { 0: ROMAN[E.actOf(run)] }), { size: 13, bold: true, color: ms.label || (E.actOf(run) >= 2 ? C.frost : C.muted), ox: 0 }).setLetterSpacing(3).setDepth(LY.panel + 1);
      U.fitText(T(this, 32, 108, D.ACTS[E.actOf(run)].name, { size: 28, font: 'display', color: ms.title, ox: 0 }).setDepth(LY.panel + 1), 196, 0, 16);
      T(this, 32, 134, _t('s.elige_tu_proximo_paso'), { size: 15, color: C.muted, ox: 0 }).setDepth(LY.panel + 1);
      NODE_KEYS.forEach((k, i) => {   // dos columnas de 6
        const x = 40 + (i >= 6 ? 116 : 0), y = 166 + (i % 6) * 40;
        const im = this.add.image(x, y, 'ic_' + (k === 'boss' ? ms.bossIcon : NODE_ICON[k])).setIconScale(0.32).setDepth(LY.panel + 1);
        if (k === 'goldelite') im.setTint(GOLD);
        U.fitText(T(this, x + 18, y, D.NODE_TYPES[k].name, { size: 14, ox: 0, wrap: 92, lineSpacing: -3, color: k === 'goldelite' ? GOLD : C.parch }).setDepth(LY.panel + 1), 92, 36, 10);
      });
      T(this, 32, 432, _t('s.rueda_o_arrastra_para_desplazarte'), { size: 12, color: C.muted, ox: 0, style: 'italic' }).setDepth(LY.panel + 1);
      // Frasco de Viento: aviso bajo la leyenda mientras se puede usar
      if (wind.size) {
        const wg = this.add.graphics().setDepth(LY.panel);
        wg.fillStyle(ms.panel, 0.88); wg.fillRoundedRect(16, 458, 250, 64, 12);
        wg.lineStyle(1.5, C.frost, 0.9); wg.strokeRoundedRect(16, 458, 250, 64, 12);
        this.add.image(42, 490, 'ic_cloud').setIconScale(0.4).setDepth(LY.panel + 1);
        T(this, 64, 476, _t('s.frasco_de_viento_2'), { size: 16, bold: true, color: C.frost, ox: 0 }).setDepth(LY.panel + 1);
        U.fitText(T(this, 64, 500, _t('s.puedes_saltar_a_una_sala'), { size: 13, color: C.parch, ox: 0 }).setDepth(LY.panel + 1), 192, 0, 10);
      }
      // «?»: leyenda completa de iconos (con qué hay en cada sala)
      button(this, 238, 88, '?', () => this.toggleLegend(), { w: 36, h: 36, size: 20, variant: 'ghost' }).setDepth(LY.panel + 2);
      this.legend = null;

      // Consejo: rodea los nodos disponibles (posición en pantalla según el desplazamiento actual)
      U.tips(this).setReady(() => !this.travelling);
      potionTip(this);
      if (av.size) showTip(this, 'mapa', () => {
        const pts = [...av].map((id) => ({ x: P[id].x, y: P[id].y + this.world.y }));
        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
        const x0 = Math.min(...xs) - 42, x1 = Math.max(...xs) + 42, y0 = Math.min(...ys) - 42, y1 = Math.max(...ys) + 50;
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      });
    }
    /** Ficha fija del jefe del acto (x 1012…1264, y 92…172, bajo las etiquetas de la partida). */
    bossBadge(run, ms) {
      const id = E.bossOf(run), d = D.ENEMIES[id];
      if (!d) return;
      const x0 = 1012, y0 = 92, W = 252, H = 80;
      const g = this.add.graphics().setDepth(LY.panel);
      g.fillStyle(ms.panel, 0.88); g.fillRoundedRect(x0, y0, W, H, 12);
      g.lineStyle(1.5, C.blood, 0.85); g.strokeRoundedRect(x0, y0, W, H, 12);
      g.fillStyle(0x000000, 0.35); g.fillCircle(x0 + 40, y0 + H / 2, 30);
      g.lineStyle(1.5, ms.border, 0.8); g.strokeCircle(x0 + 40, y0 + H / 2, 30);
      const art = enemyArt(this, d);
      const im = this.add.image(x0 + 40, y0 + H / 2 + 26, art.key).setOrigin(0.5, 1).setFlipX(flipOf(art.key)).setDepth(LY.panel + 1);
      im.setScale(Math.min(52 / im.height, 56 / im.width));
      if (art.tint) im.setTint(art.tint);
      const mask = this.make.graphics({ add: false }); mask.fillStyle(0xffffff); mask.fillCircle(x0 + 40, y0 + H / 2, 29);
      im.setMask(mask.createGeometryMask());
      T(this, x0 + 80, y0 + 22, _t('map.boss'), { size: 13, bold: true, color: C.ember, ox: 0 }).setLetterSpacing(2).setDepth(LY.panel + 1);
      U.fitText(T(this, x0 + 80, y0 + 48, d.name, { size: 22, font: 'display', color: ms.title, ox: 0 }).setDepth(LY.panel + 1), W - 92, 0, 13);
      const hit = this.add.zone(x0, y0, W, H).setOrigin(0, 0).setDepth(LY.panel + 2).setInteractive();
      hit.on('pointerover', () => this.tip.show(x0 - 40, y0 + H + 10, d.name, d.desc || ''));
      hit.on('pointerout', () => this.tip.hide());
      this.bossBadgeRect = { x: x0, y: y0, w: W, h: H };
    }
    /** Leyenda del mapa: icono, nombre y descripción de cada tipo de sala. */
    toggleLegend() {
      if (this.legend) { this.legend.destroy(); this.legend = null; return; }
      const ms = mapStyle(this.run), keys = NODE_KEYS;
      const L = this.legend = this.add.container(0, 0).setDepth(LY.panel + 50);
      const W = 900, Hh = 92 + Math.ceil(keys.length / 2) * 70, x0 = 282, y0 = 64;
      const g = this.add.graphics();
      g.fillStyle(ms.panel, 0.96); g.fillRoundedRect(x0, y0, W, Hh, 12);
      g.lineStyle(1.5, ms.border, 0.8); g.strokeRoundedRect(x0, y0, W, Hh, 12);
      const blocker = this.add.zone(x0, y0, W, Hh).setOrigin(0, 0).setInteractive();
      blocker.on('pointerup', () => this.toggleLegend());
      L.add([blocker, g, T(this, x0 + 24, y0 + 30, _t('s.leyenda_del_mapa'), { size: 24, font: 'display', color: ms.title, ox: 0 })]);
      keys.forEach((k, i) => {
        const cx = x0 + (i % 2) * 440, y = y0 + 86 + Math.floor(i / 2) * 70;
        L.add(this.add.circle(cx + 44, y, 20, ms.node).setStrokeStyle(2, k === 'boss' ? ms.border : NODE_COLOR[k], 0.9));
        const im = this.add.image(cx + 44, y, 'ic_' + (k === 'boss' ? ms.bossIcon : NODE_ICON[k])).setIconScale(0.36);
        if (k === 'goldelite') im.setTint(GOLD);
        L.add(im);
        L.add(T(this, cx + 78, y - 14, D.NODE_TYPES[k].name, { size: 18, bold: true, ox: 0, color: k === 'goldelite' ? GOLD : C.parch }));
        L.add(U.fitText(T(this, cx + 78, y + 4, D.NODE_TYPES[k].desc, { size: 14, ox: 0, oy: 0, color: C.muted, wrap: 340, lineSpacing: -2 }), 340, 36, 10));
      });
      L.add(T(this, x0 + W - 16, y0 + Hh - 18, _t('s.pasa_sobre_un_nodo_para'), { size: 12, ox: 1, color: C.muted, style: 'italic' }));
    }
    setScroll(y, animate) {
      const v = Phaser.Math.Clamp(y, this.minY, this.maxY);
      if (animate) this.tweens.add({ targets: this.world, y: v, duration: 400, ease: 'Quad.out' });
      else this.world.y = v;
    }
    travel(id, p) {
      if (this.travelling) return;
      this.travelling = true;
      this.tip.hide();
      Sfx.play('click');
      // La ficha viaja a saltitos por el camino; el mapa la sigue si se sale de la vista
      A.travelToken(this, this.marker, { x: p.x - 48, y: p.y - 6 }, (x, y) => {
        const want = Phaser.Math.Clamp(-(y - 420), this.minY, this.maxY);
        this.world.y += (want - this.world.y) * 0.12;
      }).then(() => {
        A.castGlow(this, this.marker.x + this.world.x, this.marker.y + this.world.y, C.gold);
        this.time.delayedCall(120, () => { const events = E.enterNode(this.run, id); go(this, { events }); });
      });
    }
  }

  /* =================================================================
   * Combate
   * ================================================================= */
  // Composición del combate: línea del camino del fondo y alturas de personaje
  const GROUND = 480;
  const MAGE_H = 340;
  /** Runas de la Guardiana: columna a RUNE_SIDE_DX a la izquierda del personaje, desde top + RUNE_COL_Y0, cada RUNE_STEP px. */
  const RUNE_SIDE_DX = 190, RUNE_COL_Y0 = 82, RUNE_STEP = 52;
  const ENEMY_H = { normal: 240, elite: 280, boss: 310 };
  const ENEMY_MAX_W = 380;
  // Arte apaisado o flotante: tope de ancho propio y altura sobre el suelo (el Ojo levita y es más grande que las élites)
  const ENEMY_MAX_W_BY = { ojo: 360 };
  const ENEMY_LIFT = { ojo: 12 };   // levita (su barra e intención no pasan de y≈170, bajo el HUD)
  // Criaturas de la Invocadora: fila delante de ella (≈110 px de alto), verde espectral
  const SUM_CX = 598, SUM_GAP = 118, SUM_H = 110, SUM_MAXW = 116, SUM_H_BIG = 140, SUM_MAXW_BIG = 132, SUM_COL = 0x6fd08a;   // tope de ancho: las criaturas a cuatro patas no invaden el centro
  // Mano: en reposo a escala 0.9, toda la carta dentro del lienzo (≥ 8 px hasta y=720) y por debajo
  // de los pies (y≈480 + sombra). Al pasar el ratón sube y se agranda para leerla entera.
  // Mano: hasta ~870 px (x 190…1060: sin tapar las pilas ni «Terminar turno»); escala 0.9 hasta 6 cartas y
  // baja lineal hasta 0.76 con 10. La carta elevada aparta a sus vecinas (±40 / ±20 px).
  const HAND = { y: 592, arc: 8, tilt: 0.05, scale: 0.9, left: 190, right: 1060, hoverY: 560, hoverScale: 1.15, spread: [40, 20] };
  /** Móvil (pantalla de menos de 900 px de ancho): las cartas de la mano un 12 % más grandes para leerlas con el dedo. */
  const MOBILE_HAND_K = 1.12;
  const handK = () => ((root.innerWidth || 1280) < 900 ? MOBILE_HAND_K : 1);
  const handScale = (n) => (n <= 6 ? 0.9 : Math.max(0.76, 0.9 - (n - 6) * 0.035)) * handK();

  /**
   * Iconos de estado del combate. Nombre y explicación salen del glosario (data.js GLOSSARY, por id);
   * aquí solo queda cómo se pintan (icono, tinte, aro, sin número) y las variables del valor actual.
   */
  const stInfo = (id, look = {}, vars = null) => ({
    gid: id, icon: look.icon || (U.gloss(id) || {}).icon || 'question', tint: look.tint, ring: look.ring, noNum: look.noNum,
    get name() { return U.glossName(id); },
    desc: (v, run) => U.glossDesc(id, Object.assign({ n: v }, vars ? vars(v, run, run && run.combat) : {}))
  });
  const STATUS_INFO = {
    temp: stInfo('temp', {}, (v, run) => ({ at: run ? E.overheatAt(run) : E.OVERHEAT_AT })),
    weak: stInfo('weak'),
    thorns: stInfo('thorns'),
    furia: stInfo('furia'), fenix: stInfo('fenix'), eterna: stInfo('eterna'), sol: stInfo('sol'), hoguera: stInfo('hoguera'),
    fury: stInfo('fury'), ignea: stInfo('ignea'), volcan: stInfo('volcan'),
    burn: stInfo('burn', {}, (v) => ({ m: Math.max(0, v - 1) })),
    str: stInfo('str'),
    // Criomante
    frost: stInfo('frost', { tint: 0x9fdcff }, (v, run, c) => ({ f: c ? E.freezeAt(c) : E.RULES.freezeAt })),
    frozen: stInfo('frozen', { tint: 0xffffff, ring: 0x1d4a6e, noNum: true }),
    ventisca: stInfo('ventisca', { tint: 0x9fdcff }),
    invierno: stInfo('invierno', { tint: 0xb6a8ff }),
    glaciar: stInfo('glaciar', { tint: 0x9fdcff }, (v) => ({ e: 2 * v })),
    expuesto: stInfo('expuesto', { tint: 0x9fdcff, ring: 0x3a1010, noNum: true }),
    // Guardiana
    maestria: stInfo('maestria', { tint: 0xf0cf7a }), forja: stInfo('forja', { tint: 0xf0cf7a }), ranura: stInfo('ranura'),
    // Invocadora
    vinculo: stInfo('bond', { tint: 0x9ff0b4 }), espinas: stInfo('espinas', { tint: 0x6fd08a }), rey: stInfo('rey', { tint: 0x9ff0b4, noNum: true }),
    // Acto III
    reflect: stInfo('reflect'),
    charging: stInfo('charging', { ring: 0x2a1440 }, (v, run, c) => { const e = c && c.enemy; return { hit: e && e.charging ? e.charging.hit + (e.str || 0) : '?', d: (e && e.turnDmg) || 0 }; }),
    aura: stInfo('aura', { tint: 0xffd75a }),
    stunned: stInfo('stunned', { tint: 0xffb36b, ring: 0x3a2410, noNum: true }),
    // Pasivas de jefe (Parche 2.9)
    grow: stInfo('grow', { tint: 0xff9a7a, ring: 0x3a1410 }),
    devour: stInfo('devour', { tint: 0xff8ad8, ring: 0x2a1036 }, (v, run, c) => ({ k: (c && c.player.playedThisTurn) || 0 })),
    revive: stInfo('revive', { tint: 0xd2a8ff, ring: 0x2a1440, noNum: true }, (v, run, c) => { const d = c && D.ENEMIES[c.enemy.id]; return { p: Math.round(((d && d.revive) || 0.3) * 100) }; }),
    noblock: stInfo('noblock', { tint: 0x9fd6ff, ring: 0x3a1010, noNum: true }),
    // Paladín
    judg: stInfo('judgment', { tint: 0xf2d36b }, (v) => ({ b: E.JUDG_BLOCK * v })),
    fervor: stInfo('fervor', { tint: 0xf2d36b, ring: 0x2a2208 }, (v, run) => ({ p: run ? Math.round(100 * Math.max(0, run.maxHp - run.hp) / Math.max(1, run.maxHp)) : 0 })),
    immaterial: stInfo('immaterial', { tint: 0xe8f0ff, ring: 0x1a2236, noNum: true }),
    sangre: stInfo('sangre', { tint: 0xf2d36b }), juramento: stInfo('juramento', { tint: 0xf2d36b }),
    ascension: stInfo('ascension', { tint: 0xe8f0ff, noNum: true }),
    // Sendas (Parche 3.1)
    fusion: stInfo('fusion', { ring: 0x3a2208 }), incendio: stInfo('incendio'), permahielo: stInfo('permahielo', { noNum: true }),
    prismt: stInfo('prismt', { noNum: true }), polar: stInfo('polar'), golemr: stInfo('golemr', { noNum: true }),
    alma: stInfo('alma', {}, (v) => ({ b: 3 * v })), saviae: stInfo('saviae'), madre: stInfo('madre', { noNum: true }),
    votiva: stInfo('votiva', {}, (v, run, c) => ({ per: (c && c.votivaPer) || 8, l: (c && c.selfLost) || 0 })), castillo: stInfo('castillo', { noNum: true }),
    perpetua: stInfo('perpetua'), contra: stInfo('contra', { noNum: true }), coffin: stInfo('coffin', { tint: 0xbfe3ff, ring: 0x1d4a6e, noNum: true }),
    cantera: stInfo('cantera', { noNum: true }), cicloe: stInfo('cicloe', { noNum: true }), grabado: stInfo('grabado'),
    raiz: stInfo('raiz'), avatar: stInfo('avatar', { noNum: true }), espejoj: stInfo('espejoj'),
    // Electromante
    static: stInfo('static', { tint: 0x7fd6ff, ring: 0x0c2236 }, () => ({ staticMax: E.STATIC_MAX })),
    magnet: stInfo('magnet', { ring: 0x3a1418 }, (v) => ({ b: E.MAGNET_DMG * v })),
    bobina: stInfo('bobina'), bucle: stInfo('bucle'), nucleo: stInfo('nucleo', {}, (v) => ({ e: 2 * v })), velocidad: stInfo('velocidad'), relay: stInfo('relay'),
    galvan: stInfo('galvan'), ojotormenta: stInfo('ojotormenta'), superc: stInfo('superc')
  };
  /** Pasivas visibles del jefe: [clave, valor] para la fila de estados (sobre la barra de vida). */
  /** Fichas del glosario de una intención enemiga (en el orden en que se explican). */
  function intentKws(it) {
    if (!it) return [];
    if (it.stunned) return ['stunned'];
    if (it.frozen) return ['frozen'];
    const out = [];
    if (it.kind === 'charge' || it.unleash) out.push('i_charge', 'charging');
    if (it.dmg !== undefined && !it.unleash) out.push('i_attack');
    if (it.block) out.push('i_block');
    if (it.str) out.push('i_buff');
    if (it.weak) out.push('weak');
    if (it.chill) out.push('i_chill');
    if (it.curse) out.push('i_curse');
    if (it.inkCurse) out.push('i_ink');
    if (it.drain) out.push('i_drain');
    if (it.silence) out.push('i_silence');
    if (it.reflect) out.push('i_reflect');
    if (it.douse) out.push('i_douse');
    if (it.heal) out.push('i_heal');
    return out;
  }
  function bossPassives(e) {
    const d = D.ENEMIES[e.id] || {};
    const out = [];
    if (d.grow) out.push(['grow', d.grow]);
    if (d.devour) out.push(['devour', d.devour[e.phase >= 2 ? 1 : 0]]);
    if (d.revive && !e.revived) out.push(['revive', 1]);
    if (e.noBlock) out.push(['noblock', 1]);
    return out;
  }

  class Combat extends Phaser.Scene {
    constructor() { super('Combat'); }

    create(data) {
      // Phaser reutiliza la instancia de la escena: los objetos que solo se crean para ciertos personajes o
      // enemigos (runas, Estática, Escudo de Hielo, Juicio, Imán…) seguirían apuntando a la visita anterior
      // (ya destruidos) y los «if (this.X)» los usarían → excepción y pantalla en negro. Se borran todos aquí.
      STALE_COMBAT_KEYS.forEach((k) => { this[k] = null; });
      this.run = this.registry.get('run');
      const c = this.run.combat;
      this.busy = false;
      this.dragging = null; this.wasDrag = false; this.lastIntentKind = null;
      this.cards = new Map();   // uid → objeto carta en mano
      this.playing = null;      // carta en vuelo
      this.selected = null;     // selección táctil
      this.logLines = c.log.slice(-10);
      if (c.kind === 'boss' && !c.over) Music.play('jefe', 0.4, 1500); else if (c.kind !== 'boss') Music.base();
      c.enemies.forEach((x) => Codex.see('enemies', x.id));
      this.foes = []; this.foeIdx = 0; this.animFoe = -1;   // grupos (Parche 3.2): una vista por enemigo
      Codex.track(this.run);
      this.smallFireDone = false;   // fire_small: como mucho una vez por carta jugada

      // Fondo pintado del acto (o el procedural) + viñeta; encima, la capa de ambiente del acto y un parallax sutil
      const act = E.actOf(this.run);
      const bgKey = act >= 3 ? 'bg_act3' : act === 2 ? 'bg_act2' : (c.kind !== 'boss' ? 'bg_forest' : null);
      let bgImg = null;
      if (bgKey && this.textures.exists(bgKey)) {
        bgImg = this.add.image(640, 360, bgKey).setDisplaySize(1280, 720);
        this.add.image(640, 360, 'vignette');
      } else {
        backdrop(this, themeFor(this.run, c.kind === 'boss'));
      }
      A.ambient(this, act);                       // I luciérnagas · II nieve · III runas y motas
      if (bgImg) A.parallax(this, [bgImg], 3);
      const hand = this.add.graphics();
      for (let i = 0; i < 12; i++) { hand.fillStyle(0x000000, 0.05 * i); hand.fillRect(0, 488 + i * 20, 1280, Math.min(20, 720 - (488 + i * 20))); }
      this.redFlash = this.add.rectangle(640, 360, 1280, 720, C.blood, 0).setDepth(LY.fx + 1500);
      this.lowHp = FL.lowHpVignette(this);   // PV < 30 %: latido rojo en los bordes
      this.aim = FL.aimArrow(this); this.aimFoe = -1; this.aimFx = null;   // flecha de apuntado (Ataques de un objetivo)
      this.turbo = false; this.enemyPhase = false; this.hitStreak = 0;

      this.tip = tooltip(this);
      this.hud = hud(this, this.run, { tip: this.tip, onUsePotion: (slot, x, y) => this.usePotion(slot, x, y) });
      runTags(this, this.run);
      this.buildPlayer();
      this.foeLayout().forEach((L, i) => { this.foeIdx = i; this.buildEnemy(L); });
      this.foeIdx = c.target;
      this.buildReticle();
      this.buildSummons();
      this.buildControls();
      if (E.hasMech(this.run, 'static')) this.buildStatic();   // Electromante: medidor de Estática
      this.buildInput();
      // Consejos: nunca durante animaciones, arrastres o con el combate terminado
      this.cardPlayed = false;
      U.tips(this).setReady(() => !this.busy && !this.dragging && !!this.run.combat && !this.run.combat.over);
      this.endArmed = 0;   // aviso de fin de turno: momento hasta el que vale el segundo clic
      this.time.paused = false;   // por si un hit-stop quedó a medias en la visita anterior
      this.applyOptions();
      this.events.once('shutdown', () => { this.tweens.timeScale = 1; this.time.timeScale = 1; });

      this.refreshBars(false);
      this.refreshStatuses();
      this.refreshIntent();
      this.setEnergy(c.player.energy);
      this.updateHeat();

      if (c.over) { this.sync(); this.finish(c.over); }           // reanudado justo tras ganar/perder
      else if (data && data.events && data.events.length) this.runEvents(data.events);
      else this.sync();
    }

    /** Velocidad de animación (panel ⚙ / tecla V): escala tweens y esperas de esta escena. */
    /** Velocidad real de la animación: la de Ajustes ×3 mientras se acelera el turno enemigo (clic o A). */
    spd() { return U.Opts.speed * (this.turbo ? 3 : 1); }
    /** Clic / A durante el turno enemigo: el resto del turno va ×3 (vuelve a la normalidad en tu turno). */
    setTurbo(on) {
      if (!!on === !!this.turbo) return;
      this.turbo = !!on;
      this.applyOptions();
      if (on) floatText(this, 640, 250, _t('feel.fast'), C.gold, 22);
    }
    applyOptions() {
      const sp = U.Opts.speed * (this.turbo ? 3 : 1);
      this.tweens.timeScale = sp;
      this.time.timeScale = sp;
    }

    /* ---------------- «Juice»: temblor, destellos, hit-stop ---------------- */
    /** Temblor de cámara (con tope); nada con «Reducir movimiento». La cámara no usa timeScale: se divide a mano. */
    shake(dur, k) {
      if (U.Opts.reduceMotion) return;
      this.cameras.main.shake(Math.min(250, dur) / this.spd(), Math.min(k, 0.014));   // nunca más de 250 ms
    }
    /** Temblor proporcional al daño: casi nada en golpes pequeños, fuerte con 20 o más (y con tope de 250 ms). */
    shakeFor(dmg) {
      if (!(dmg > 0)) return;
      const k = dmg < 5 ? 0.0012 : dmg < 20 ? 0.0018 + dmg * 0.00022 : 0.0075 + Math.min(dmg - 20, 20) * 0.00012;
      this.shake(Math.min(250, 50 + dmg * 7), k);
    }
    /** Destello de pantalla completa (nada con «Reducir movimiento»). */
    flash(color, alpha = 0.5, dur = 600) {
      if (U.Opts.reduceMotion) return;
      const f = this.add.rectangle(640, 360, 1280, 720, color, alpha).setDepth(LY.fx + 1600).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: f, alpha: 0, duration: dur, ease: 'Quad.out', onComplete: () => f.destroy() });
    }
    /**
     * Hit-stop: congela la escena 40 ms (90 ms con golpes de 20+), dividido por la velocidad.
     * El objetivo se pone blanco un fotograma (no con «Reducir movimiento»).
     */
    async hitStop(sprite, dmg) {
      // 40 ms con golpes pequeños → 90 ms con 30+; en una ráfaga (golpes seguidos), cada vez algo más corto
      const ms = (40 + 50 * Math.min(dmg, 30) / 30) * Math.max(0.45, 1 - 0.14 * (this.hitStreak || 0)) / this.spd();
      if (U.Opts.reduceMotion) return;   // «Reducir movimiento»: sin congelar (el destello lo pone hurt())
      this.hitFlash(sprite, sprite === this.mage ? 0xff4a3a : 0xffffff, sprite === this.mage ? 90 : 50);   // destello (70 %) durante el congelado
      sprite._hsFlash = performance.now();   // hurt() no lo repite justo después
      this.tweens.pauseAll(); this.time.paused = true;
      await new Promise((r) => setTimeout(r, ms));
      if (!this.sys || !this.sys.isActive()) return;
      this.tweens.resumeAll(); this.time.paused = false;
    }
    /** Presentación del jefe al empezar el combate: «Jefe del Acto N», su nombre y un subtítulo breve. */
    async bossIntro() {
      const c0 = this.run.combat, e = c0.enemies.find((x) => (D.ENEMIES[x.id] || {}).tier === 'boss') || c0.enemies[0], d = D.ENEMIES[e.id] || {}, act = E.bossAct(e.id) || E.actOf(this.run);
      const rm = U.Opts.reduceMotion, fast = this.spd() >= 3;
      const box = this.add.container(640, 340).setDepth(LY.fx + 1800).setAlpha(0);
      const band = this.add.rectangle(0, 0, 1280, 176, 0x000000, 0.66);
      const lines = this.add.graphics();
      lines.fillStyle(C.blood, 0.95); lines.fillRect(-640, -89, 1280, 3); lines.fillRect(-640, 86, 1280, 3);
      const tag = T(this, 0, -54, _t('boss.intro', { a: ROMAN[act] || act }), { size: 16, bold: true, color: C.ember }).setLetterSpacing(4);
      const name = U.fitText(T(this, 0, 0, d.name, { size: 62, font: 'display', color: C.parch, stroke: 0x000000, strokeThickness: 7 }), 1160, 0, 30);
      const sub = U.fitText(T(this, 0, 52, d.subtitle || '', { size: 21, color: C.muted, style: 'italic' }), 1100, 0, 12);
      box.add([band, lines, tag, name, sub]);
      if (!rm) { name.setScale(name.scale * 1.25); }
      await tw(this, { targets: box, alpha: 1, duration: fast ? 120 : 280 });
      if (!rm) this.tweens.add({ targets: name, scale: name.scale / 1.25, duration: 420, ease: 'Back.out' });
      await wait(this, fast ? 500 : 1300);
      await tw(this, { targets: box, alpha: 0, duration: fast ? 120 : 380 });
      box.destroy();
    }
    /** Banner de turno que barre la pantalla (a ×3 se salta; con «Reducir movimiento», aparece sin moverse). */
    /** Banner breve («Tu turno» / «Turno enemigo»): ≈ 600 ms y NO bloquea (las animaciones siguen debajo). */
    turnBanner(text, color) {
      if (this.spd() >= 3) return;
      if (this.turnBox) { this.tweens.killTweensOf(this.turnBox); this.turnBox.destroy(); this.turnBox = null; }
      if (U.Opts.reduceMotion) { banner(this, text, color, 420); return; }
      const box = this.turnBox = this.add.container(-1280, 360).setDepth(LY.fx + 1800);
      const band = this.add.rectangle(640, 0, 1280, 92, 0x000000, 0.62);
      const lines = this.add.graphics();
      lines.fillStyle(color, 0.9); lines.fillRect(0, -47, 1280, 3); lines.fillRect(0, 44, 1280, 3);
      const t = T(this, 640, 0, text, { size: 58, font: 'display', color, stroke: 0x000000, strokeThickness: 6 });
      box.add([band, lines, t]);
      this.tweens.chain({ targets: box, tweens: [
        { x: 0, duration: 160, ease: 'Cubic.out' }, { x: 0, duration: 280 },
        { x: 1280, duration: 160, ease: 'Cubic.in', onComplete: () => { box.destroy(); if (this.turnBox === box) this.turnBox = null; } }
      ] });
    }

    /** Distorsión de calor (WebGL) sobre el mago mientras está Sobrecalentado. */
    updateHeat(temp = this.run.combat ? this.run.combat.player.temp : 0) {
      const hot = E.hasMech(this.run, 'temp') && temp >= E.overheatAt(this.run);
      A.heat(this, this.mage, hot);
    }

    /** Aura cosmética alrededor del mago: brillo aditivo que late y chispitas que suben (solo se ve). */
    lookAura(x) {
      const col = U.lookColor('aura', U.Look.aura, this.run.char) || C.gold;
      const glow = this.add.image(x, this.pY, 'sumglow').setTint(col).setAlpha(0.18).setScale(2).setDepth(LY.units - 3).setBlendMode(Phaser.BlendModes.ADD);
      if (U.Opts.reduceMotion) return;
      this.tweens.add({ targets: glow, alpha: { from: 0.12, to: 0.26 }, scale: { from: 1.9, to: 2.15 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.time.addEvent({ delay: 420, loop: true, callback: () => {
        if (!U.Live.room(1)) return;
        const p = U.Pool.image(this, x + (Math.random() - 0.5) * 120, GROUND - 10, 'dot').setTint(col).setScale(0.25 + Math.random() * 0.25).setAlpha(0.8).setDepth(LY.units - 2).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: p, y: GROUND - MAGE_H - Math.random() * 40, alpha: 0, duration: 1600 + Math.random() * 600, ease: 'Sine.out', onComplete: () => p.destroy() });
      } });
    }

    /* ---------------- Construcción ---------------- */
    buildPlayer() {
      // Pies sobre el camino (GROUND); pY = centro del cuerpo, referencia de efectos
      const H = MAGE_H, x = this.pX = 330, top = GROUND - H;
      this.pY = GROUND - H / 2;
      this.aura = this.add.circle(x, this.pY, 120, C.ember, 0.06);
      this.mage = this.add.image(x, GROUND, charArt(this.run)).setOrigin(0.5, 1);
      this.mage.setScale(U.heightScale(this, charArt(this.run), H));
      this.mageBaseScale = this.mage.scale;
      this.add.image(x, GROUND, 'shadow').setDisplaySize(this.mage.displayWidth * 0.95, 40);
      this.mage.setDepth(LY.units);
      // Respiración con los pies anclados (origen abajo → solo se estira hacia arriba)
      this.mageIdle = A.idle(this, this.mage, this.mageBaseScale, 'normal', { noGestures: true });
      if (U.Look.aura) this.lookAura(x);   // Parche 3.6: aura cosmética (Afinidad 10 o hito del compendio)
      // Nombre, vida y estados encima de la cabeza (debajo de los pies está la mano de cartas)
      T(this, x, top - 46, E.charDef(this.run).name, { size: 26, font: 'display', color: E.charDef(this.run).color, stroke: 0x000000, strokeThickness: 4 });
      this.pBar = U.hpBar(this, x, top - 20, 230, 20);
      { const set0 = this.pBar.set; this.pBar.set = (hp, max, ...rest) => { set0(hp, max, ...rest); if (this.lowHp) this.lowHp.update(hp / max); }; }   // viñeta de PV bajos
      this.pBlock = this.blockBadge(x - 140, top - 20);
      this.pStatus = this.add.container(x + 146, top - 20);
      this.buildIce(x, top);
      if (E.hasMech(this.run, 'runes')) this.buildRunes(x, top);
      if (E.hasMech(this.run, 'fervor')) {
        // Fervor: aura dorada que crece; Inmaterial: silueta translúcida desplazada
        this.aura.setAlpha(0);
        this.palAura = this.add.image(x, this.pY, 'sumglow').setTint(0xf2d36b).setAlpha(0.15).setScale(2.2).setDepth(LY.units - 2).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: this.palAura, angle: 360, duration: 24000, repeat: -1 });
        this.ghost = this.add.image(x, GROUND, this.mage.texture.key).setOrigin(0.5, 1).setScale(this.mageBaseScale).setTintFill(0xe8f0ff).setAlpha(0).setDepth(LY.units - 1).setBlendMode(Phaser.BlendModes.ADD);
      }
    }
    /** Paladín: aura del Fervor, silueta Inmaterial y balanza sobre el enemigo con Juicio. */
    updatePaladinFx(judgOver) {
      const c = this.run.combat;
      if (!c) return;
      if (this.ghost) {
        const f = c.player.fervor || 0;
        if (this.lastFervor !== f) {
          this.lastFervor = f;
          this.tweens.add({ targets: this.palAura, alpha: Math.min(0.85, 0.15 + f * 0.07), scale: 2.2 + Math.min(f, 12) * 0.22, duration: 420, ease: 'Sine.out' });
        }
        const imm = !!c.player.immaterial;
        if (this.lastImm !== imm) {
          this.lastImm = imm;
          this.tweens.killTweensOf(this.ghost);
          if (imm) { this.mage.setAlpha(0.55); this.ghost.setAlpha(0.5).setX(this.pX + 16); this.tweens.add({ targets: this.ghost, alpha: { from: 0.5, to: 0.2 }, x: this.pX + 22, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' }); }
          else { this.mage.setAlpha(1); this.ghost.setAlpha(0); }
        }
      }
      this.eachFoe((i) => this.updateJudgMark(i === this.animFoe && judgOver !== undefined ? judgOver : (this.fe.judg || 0)));
    }
    updateJudgMark(j) {
      if (this.fe && this.fe.dead) j = 0;
      if (j > 0 && !this.judgMark && this.enemy) {
        this.judgMark = this.add.image(this.eX, this.eY - this.enemy.displayHeight * 0.12, 'ic_scales').setIconScale(0.9).setAlpha(0).setDepth(LY.units + 3).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: this.judgMark, alpha: 0.55, duration: 260 });
      } else if (j <= 0 && this.judgMark) {
        const m = this.judgMark; this.judgMark = null;
        this.tweens.add({ targets: m, alpha: 0, duration: 260, onComplete: () => m.destroy() });
      }
    }

    /* ---------------- Electromante ---------------- */
    /** Imán que flota sobre el enemigo Magnetizado (se mece y se apaga al llegar a 0). */
    updateMagnetMark(m) {
      if (this.fe && this.fe.dead) m = 0;
      if (m > 0 && !this.magnetMark && this.enemy) {
        const y = this.eY - this.enemy.displayHeight * 0.32;
        this.magnetMark = this.add.image(this.eX + this.enemy.displayWidth * 0.28, y, 'ic_magnet').setIconScale(0.55).setAlpha(0).setDepth(LY.units + 3);
        this.tweens.add({ targets: this.magnetMark, alpha: 0.95, duration: 220 });
        this.tweens.add({ targets: this.magnetMark, angle: { from: -10, to: 10 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      } else if (m <= 0 && this.magnetMark) {
        const o = this.magnetMark; this.magnetMark = null;
        this.tweens.killTweensOf(o); this.tweens.add({ targets: o, alpha: 0, duration: 220, onComplete: () => o.destroy() });
      }
    }
    /** Medidor de Estática: 10 segmentos junto a la Energía; lleno, chisporrotea. */
    buildStatic() {
      const x = 166, y0 = 650, h = 9, gap = 2;
      const box = this.staticBox = this.add.container(0, 0).setDepth(LY.units + 2);
      const bg = this.add.graphics();
      bg.fillStyle(0x07121c, 0.92); bg.fillRoundedRect(x - 13, y0 - E.STATIC_MAX * (h + gap) - 6, 26, E.STATIC_MAX * (h + gap) + 12, 6);
      bg.lineStyle(2, 0x3a6f96, 1); bg.strokeRoundedRect(x - 13, y0 - E.STATIC_MAX * (h + gap) - 6, 26, E.STATIC_MAX * (h + gap) + 12, 6);
      this.staticSegs = this.add.graphics();
      this.staticT = T(this, x, y0 + 16, '0', { size: 16, bold: true, color: 0xc8f0ff, stroke: 0x000000, strokeThickness: 4 });
      const icon = this.add.image(x, y0 - E.STATIC_MAX * (h + gap) - 18, 'ic_ebolt').setIconScale(0.32);
      box.add([bg, this.staticSegs, this.staticT, icon]);
      this.staticGeom = { x, y0, h, gap };
      const hit = this.add.zone(x - 16, y0 - E.STATIC_MAX * (h + gap) - 30, 32, E.STATIC_MAX * (h + gap) + 56).setOrigin(0, 0).setInteractive();
      this.staticHit = hit;
      hit.on('pointerover', () => { const n = (this.run.combat && this.run.combat.player.static) || 0; this.tip.show(x + 24, y0 - 150, `${U.glossName('static')} ${n}/${E.STATIC_MAX}`, U.glossDesc('static', { n, staticMax: E.STATIC_MAX }), { kws: ['overload'] }); });
      hit.on('pointerout', () => this.tip.hide());
      this.staticShown = -1;
    }
    setStatic(n) {
      if (!this.staticSegs) return;
      const { x, y0, h, gap } = this.staticGeom, full = n >= E.STATIC_MAX, g = this.staticSegs;
      if (n === this.staticShown) return;
      const up = n > this.staticShown && this.staticShown >= 0;
      this.staticShown = n;
      g.clear();
      for (let i = 0; i < E.STATIC_MAX; i++) {
        const yy = y0 - (i + 1) * (h + gap) + gap;
        g.fillStyle(i < n ? (full ? 0xeaf8ff : i >= 7 ? 0xffe066 : 0x7fd6ff) : 0x13283a, 1); g.fillRoundedRect(x - 8, yy, 16, h, 2);
      }
      this.staticT.setText(String(n)).setColor(U.hex(full ? 0xffe066 : 0xc8f0ff));
      if (up) this.tweens.add({ targets: this.staticT, scale: { from: 1.4, to: 1 }, duration: 200 });
      // Lleno: chispas alrededor del medidor hasta la Sobrecarga
      if (full && !this.staticCrackle) {
        this.staticCrackle = this.time.addEvent({ delay: 170, loop: true, callback: () => {
          if (U.Opts.reduceMotion) return;
          const yy = y0 - Math.random() * E.STATIC_MAX * (h + gap);
          U.Fx.zap(this, x + (Math.random() < 0.5 ? -14 : 14), yy, x + (Math.random() - 0.5) * 50, yy - 14 - Math.random() * 20, 0x7fd6ff, { width: 3, wild: 10 });
        } });
      } else if (!full && this.staticCrackle) { this.staticCrackle.remove(); this.staticCrackle = null; }
    }
    /** Punto de salida de los Rayos (la mano del Electromante) y centro de un enemigo. */
    boltFrom() { return { x: this.pX + 70, y: this.pY - 70 }; }
    foePos(i) { const f = this.foes[i]; return f ? { x: f.eRestX, y: f.eY - 10 } : { x: 940, y: 300 }; }

    /* ---------------- Runas (Guardiana) ---------------- */
    /** Ranuras en columna a la izquierda de la Guardiana (sin taparle la cara) + indicador de Potencia encima. */
    buildRunes(x, top) {
      this.runeCx = x - RUNE_SIDE_DX; this.runeCy = top + RUNE_COL_Y0;
      this.runeLayer = this.add.container(0, 0).setDepth(LY.units + 6);
      const pb = this.runePow = this.add.container(x - RUNE_SIDE_DX, top + 2).setDepth(LY.units + 6);
      const g = this.add.graphics();
      g.fillStyle(0x2a241e, 0.92); g.fillCircle(0, 0, 21); g.lineStyle(2, 0xc9a46a, 1); g.strokeCircle(0, 0, 21);
      pb.txt = T(this, 0, 1, '0', { size: 17, bold: true, color: 0xffe2a6, stroke: 0x000000, strokeThickness: 4 });
      pb.lbl = T(this, 0, 32, _t('s.potencia'), { size: 12, bold: true, color: 0xc9a46a, stroke: 0x000000, strokeThickness: 3 });
      pb.add([g, pb.txt, pb.lbl]).setSize(44, 44).setInteractive();
      pb.on('pointerover', () => {
        const c = this.run.combat, P = E.runePow(c);
        const lines = D.RUNE_IDS.map((id) => { const r = D.RUNES[id]; return _t('s.0_1_detona_2', { 0: r.name, 1: this.runeDesc(id, 'passive'), 2: this.runeDesc(id, 'det') }); });
        this.tip.show(x - RUNE_SIDE_DX + 30, top + 20, _t('s.potencia_de_runa_0_1', { 0: P >= 0 ? '+' : '', 1: P }), _t('s.0_ranuras_1_2', { 0: U.kwDesc('runepower'), 1: E.runeSlots(c), 2: lines.join('\n') }));
      });
      pb.on('pointerout', () => this.tip.hide());
      this.drawRunes();
    }
    /** Texto de un efecto de runa con la Potencia actual. */
    runeDesc(id, kind) {
      const c = this.run.combat, fx = D.RUNES[id][kind], v = (n) => E.runeVal(c, id, n), out = [];
      if (fx.dmg) out.push(_t('s.0_de_dano', { 0: v(fx.dmg) }));
      if (fx.block) out.push(_t('s.0_de_bloqueo', { 0: v(fx.block) }));
      if (fx.draw) out.push(kind === 'det' ? _t('s.roba_0', { 0: v(fx.draw) }) : _t('s.0_carta_el_proximo_turno', { 0: v(fx.draw) }));
      if (fx.heal) out.push(_t('s.cura_0', { 0: v(fx.heal) }));
      return out.join(_t('ui.and'));
    }
    /** Ranura i (0 = la más antigua, la que Detona primero) de arriba abajo; con 5 ranuras sigue por encima de los pies. */
    runePos(i, n) {
      return { x: this.runeCx, y: this.runeCy + i * RUNE_STEP };
    }
    /** Repinta las ranuras (vacías: hueco de piedra; llenas: la runa). runes: estado a mostrar. */
    drawRunes(runes) {
      if (!this.runeLayer) return;
      const c = this.run.combat, list = runes || c.runes, n = E.runeSlots(c);
      this.runeLayer.removeAll(true);
      this.runeObjs = [];
      for (let i = 0; i < n; i++) {
        const p = this.runePos(i, n);
        const hole = this.add.circle(p.x, p.y, 21, 0x1a1612, 0.75).setStrokeStyle(2, 0x6b6255, 0.9);
        this.runeLayer.add(hole);
        const id = list[i];
        if (!id) { this.runeObjs.push(null); continue; }
        const img = this.add.image(p.x, p.y, 'ic_rune_' + id).setIconScale(0.66);
        img.setInteractive();
        img.on('pointerover', () => this.tip.show(p.x + 30, p.y - 10, _t('rune.title', { r: D.RUNES[id].name }) + (i === 0 && list.length >= n ? _t('rune.nextBoom') : ''),
          _t('s.pasivo_al_final_de_tu', { 0: this.runeDesc(id, 'passive'), 1: this.runeDesc(id, 'det') })));
        img.on('pointerout', () => this.tip.hide());
        this.runeLayer.add(img);
        this.runeObjs.push(img);
      }
      const P = E.runePow(c);
      this.runePow.txt.setText(`${P > 0 ? '+' : ''}${P}`).setColor(U.hex(P < 0 ? 0x9fdcff : 0xffe2a6));
    }
    /** Fx de un pasivo: la runa brilla y lanza una chispa hacia su objetivo. */
    runePulseFx(idx, id) {
      const o = this.runeObjs && this.runeObjs[idx];
      if (!o) return;
      const col = U.RUNE_COL[id] || 0xffc46a;
      this.tweens.add({ targets: o, scale: { from: 0.95 * U.icK(o), to: 0.66 * U.icK(o) }, duration: 260, ease: 'Back.out' });
      const glow = this.add.circle(o.x, o.y, 24, col, 0.7).setDepth(LY.units + 7).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, scale: 1.8, alpha: 0, duration: 320, onComplete: () => glow.destroy() });
      const toEnemy = id === 'fuego' || id === 'ancestral';
      const tx = toEnemy ? this.eRestX : id === 'viento' ? 640 : this.pX, ty = toEnemy ? this.eY : id === 'viento' ? 600 : this.pY;
      const spark = this.add.image(o.x, o.y, 'dot').setTint(col).setScale(1.3).setDepth(LY.fx + 500).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: spark, x: tx, y: ty, scale: 0.6, duration: 240, ease: 'Quad.in', onComplete: () => { burst(this, tx, ty, col, 6, 30); spark.destroy(); } });
    }
    /** Fx de detonación: la runa estalla (anillo + impacto de su color). */
    runeBlastFx(idx, id) {
      const n = E.runeSlots(this.run.combat), p = this.runePos(Math.min(idx, n - 1), n), col = U.RUNE_COL[id] || 0xffc46a;
      const ring = this.add.circle(p.x, p.y, 16).setStrokeStyle(6, col, 1).setDepth(LY.fx + 600).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 420, ease: 'Quad.out', onComplete: () => ring.destroy() });
      burst(this, p.x, p.y, col, 22, 90);
      burst(this, p.x, p.y, 0xffffff, 8, 40);
      this.shake(140, 0.005);
    }
    /** Improvisar: elige la carta de la mano que descartas. */
    openDiscardChoice() {
      const c = this.run.combat;
      const L = this.runeChoice = this.add.container(0, 0).setDepth(LY.modal);
      const g = this.add.graphics(); g.fillStyle(0x000000, 0.6); g.fillRect(0, 0, 1280, 720);
      const title = c.choice.kind === 'exhaust' ? _t('s.pyreChoose') : _t('s.elige_la_carta_que_descartas');   // Pira Funeraria · Improvisar
      L.add([this.add.zone(0, 0, 1280, 720).setOrigin(0, 0).setInteractive(), g, T(this, 640, 150, title, { size: 34, font: 'display', color: C.gold, stroke: 0x000000, strokeThickness: 5 })]);
      const opts = c.hand.filter((x) => c.choice.options.includes(x.uid)), n = opts.length;
      const step = Math.min(150, 1100 / Math.max(1, n));
      opts.forEach((card, i) => {
        const x = 640 + (i - (n - 1) / 2) * step, y = 340;
        const cv = cardView(this, card, { combat: c }).setPosition(x, y).setScale(0.85);
        cv.setInteractive({ useHandCursor: true });
        cv.on('pointerover', () => this.tweens.add({ targets: cv, y: y - 16, scale: 0.92, duration: 100 }));
        cv.on('pointerout', () => this.tweens.add({ targets: cv, y, scale: 0.85, duration: 100 }));
        const pick = () => { L.destroy(); this.runeChoice = null; this.runEvents(E.chooseRune(this.run, card.uid)); };
        cv.on('pointerup', pick);
        L.padItems = (L.padItems || []).concat({ obj: cv, onConfirm: pick });
        L.add(cv);
      });
    }
    /** Inscribir+: elige la runa (Fuego, Piedra o Viento). */
    openRuneChoice() {
      const c = this.run.combat;
      if (!c || !c.choice || this.runeChoice) return;
      if (c.choice.kind === 'discard' || c.choice.kind === 'exhaust') { this.openDiscardChoice(); return; }
      const L = this.runeChoice = this.add.container(0, 0).setDepth(LY.modal);
      const g = this.add.graphics(); g.fillStyle(0x000000, 0.55); g.fillRect(0, 0, 1280, 720);
      g.fillStyle(C.panel, 0.98); g.fillRoundedRect(400, 230, 480, 220, 16); g.lineStyle(2, 0xc9a46a, 1); g.strokeRoundedRect(400, 230, 480, 220, 16);
      L.add([this.add.zone(0, 0, 1280, 720).setOrigin(0, 0).setInteractive(), g, T(this, 640, 262, _t('s.elige_la_runa_que_grabas'), { size: 26, font: 'display', color: C.gold })]);
      c.choice.options.forEach((id, i) => {
        const x = 500 + i * 140, y = 350;
        const img = this.add.image(x, y, 'ic_rune_' + id).setIconScale(1.1).setInteractive({ useHandCursor: true });
        const t = T(this, x, y + 54, D.RUNES[id].name, { size: 18, bold: true, color: C.parch });
        img.on('pointerover', () => { img.setIconScale(1.25); this.tip.show(x - 150, y - 150, _t('s.runa_de_0', { 0: D.RUNES[id].name }), _t('s.pasivo_0_detonacion_1', { 0: this.runeDesc(id, 'passive'), 1: this.runeDesc(id, 'det') })); });
        img.on('pointerout', () => { img.setIconScale(1.1); this.tip.hide(); });
        const pick = () => { this.tip.hide(); L.destroy(); this.runeChoice = null; this.runEvents(E.chooseRune(this.run, id)); };
        img.on('pointerup', pick);
        L.padItems = (L.padItems || []).concat({ obj: img, onConfirm: pick });
        L.add([img, t]);
      });
    }

    /** Escudo de Hielo: barra azul fina sobre la vida + insignia (número y cuánto se derretirá). */
    buildIce(x, top) {
      this.iceBar = this.add.graphics().setDepth(LY.units + 5);
      this.iceBarX = x - 115; this.iceBarY = top - 36;
      const b = this.pIce = this.add.container(x - 186, top - 20).setVisible(false).setDepth(LY.units + 5);
      const g = this.add.graphics();
      g.fillStyle(0x0e2a40, 0.95); g.fillRoundedRect(-22, -20, 44, 40, 10);
      g.lineStyle(2, 0x9fdcff, 1); g.strokeRoundedRect(-22, -20, 44, 40, 10);
      const ic = this.add.image(0, -5, 'ic_snow').setIconScale(0.36).setTint(0xcfeaff);
      const t = T(this, 0, 8, '0', { size: 17, bold: true, color: 0xe6f6ff, stroke: 0x000000, strokeThickness: 4 });
      const m = T(this, 0, 30, '', { size: 12, bold: true, color: 0x9fdcff, stroke: 0x000000, strokeThickness: 3 });
      b.add([g, ic, t, m]); b.txt = t; b.melt = m;
      b.setSize(44, 40).setInteractive();
      b.on('pointerover', () => { const v = this.run.combat.player.ice || 0; this.tip.show(x - 206, top + 6, `${U.glossName('ice')} ${v}`, U.glossDesc('ice', { n: v, m: Math.min(v, this.iceMeltRate()) })); });
      b.on('pointerout', () => this.tip.hide());
    }
    iceMeltRate() { return E.hasRelic(this.run, 'lagrima') ? 1 : E.RULES.iceMelt; }
    setIce(v) {
      if (!this.pIce) return;
      v = v || 0;
      this.pIce.setVisible(v > 0);
      this.pIce.txt.setText(String(v));
      this.pIce.melt.setText(v > 0 ? _t('ice.melt', { n: Math.min(v, this.iceMeltRate()) }) : '');
      const g = this.iceBar; g.clear();
      if (v > 0) {
        const w = 230 * Math.min(1, v / this.run.maxHp);
        g.fillStyle(0x0e2a40, 0.9); g.fillRoundedRect(this.iceBarX - 1, this.iceBarY - 1, 232, 7, 3);
        g.fillStyle(0x8fd4ff, 1); g.fillRoundedRect(this.iceBarX, this.iceBarY, Math.max(4, w), 5, 2);
        g.fillStyle(0xffffff, 0.5); g.fillRect(this.iceBarX + 2, this.iceBarY + 1, Math.max(0, w - 4), 1);
      }
    }
    /** Cristales alrededor del enemigo mientras está Congelado. */
    updateFreezeFx() { this.eachFoe(() => this.updateFreezeFx1()); }
    updateFreezeFx1() {
      const c = this.run.combat, on = !!(c && this.fe.frozen && !this.fe.dead && !c.over);
      if (on && !this.freezeFx) {
        const fx = this.freezeFx = this.add.container(this.eX, this.eY).setDepth(LY.units + 3);
        const w = this.enemy.displayWidth * 0.5 + 30, h = this.enemy.displayHeight * 0.5 + 20;
        const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        glow.fillStyle(0x9fd6ff, 0.14); glow.fillEllipse(0, 0, w * 2, h * 2);
        fx.add(glow);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + 0.3;
          const s = this.add.image(Math.cos(a) * w, Math.sin(a) * h, 'ic_shard').setIconScale(0.3 + (i % 3) * 0.08).setRotation(a + Math.PI / 2).setTint(0xdff3ff);
          fx.add(s);
          this.tweens.add({ targets: s, alpha: { from: 1, to: 0.45 }, duration: 700 + i * 60, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        }
        fx.setScale(0.6); this.tweens.add({ targets: fx, scale: 1, duration: 260, ease: 'Back.out' });
      } else if (!on && this.freezeFx) {
        const fx = this.freezeFx; this.freezeFx = null;
        this.tweens.add({ targets: fx, alpha: 0, scale: 1.3, duration: 240, onComplete: () => fx.destroy() });
      }
      this.applyEnemyTint();
    }

    /* ---------------- Criaturas (Invocadora) ---------------- */
    /** Fila de criaturas entre la Invocadora y el enemigo (la más antigua a la izquierda). */
    buildSummons() {
      this.sumViews = new Map();
      this.sumLayer = this.add.container(0, 0).setDepth(LY.units + 2);
      this.sumTarget = this.add.graphics().setDepth(LY.units + 2);
      this.renderSummons(this.run.combat.summons || []);
    }
    /** x de la criatura i de n (centradas en el hueco entre los dos). */
    summonX(i, n) { return SUM_CX + (i - (n - 1) / 2) * SUM_GAP; }
    summonRect() { const n = Math.max(1, (this.run.combat.summons || []).length); const x0 = this.summonX(0, n) - 70; return { x: x0, y: GROUND - SUM_H - 50, w: (n - 1) * SUM_GAP + 140, h: SUM_H + 66 }; }
    /** Crea/coloca las vistas según la instantánea del motor. Devuelve la vista de `newSid` si se acaba de crear. */
    renderSummons(list, newSid) {
      if (!this.sumViews) return null;
      const alive = new Set(list.map((s) => s.sid));
      for (const [sid, v] of this.sumViews) if (!alive.has(sid)) { v.destroy(); this.sumViews.delete(sid); }
      let fresh = null;
      list.forEach((s, i) => {
        let v = this.sumViews.get(s.sid);
        const x = this.summonX(i, list.length);
        if (!v) { v = this.makeSummonView(s, x); this.sumViews.set(s.sid, v); if (s.sid === newSid) fresh = v; }
        else if (Math.abs(v.x - x) > 1) this.tweens.add({ targets: v, x, duration: 260, ease: 'Quad.out' });
        v.slot = i;
        v.bar.set(s.hp, s.maxHp, 0, !v.fresh);
        v.fresh = false;
      });
      this.refreshSummonStats();
      this.refreshSummonTarget();
      return fresh;
    }
    makeSummonView(s, x) {
      const d = D.SUMMONS[s.id], key = d.art, real = REAL_SUMMON.has(s.id);
      const v = this.add.container(x, GROUND);
      const src = this.textures.get(key).getSourceImage();
      const H = d.rare ? SUM_H_BIG : SUM_H, MW = d.rare ? SUM_MAXW_BIG : SUM_MAXW;
      const sc = Math.min(H / src.height, MW / src.width), h = src.height * sc;
      v.h = h; v.sid = s.sid; v.sumId = s.id; v.fresh = true;
      const shadow = this.add.image(0, 0, 'shadow').setDisplaySize(src.width * sc * 0.9, 22).setAlpha(0.7);
      const body = v.body = this.add.container(0, 0);
      // Arte real: ya mira a la derecha y va sin tinte, con un halo verde suave detrás (ADD).
      // Respaldo (arte de enemigo teñido): se voltea y el halo es la silueta.
      const glow = real
        ? this.add.image(0, -h * 0.45, 'sumglow').setDisplaySize(src.width * sc * 1.5, h * 1.25).setTint(SUM_COL).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD)
        : this.add.image(0, 2, key).setOrigin(0.5, 1).setScale(sc * 1.1).setFlipX(true).setTintFill(0x9fffbf).setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD);
      const img = v.img = this.add.image(0, 0, key).setOrigin(0.5, 1).setScale(sc).setFlipX(!real);   // miran al enemigo
      body.add([glow, img]);
      this.tweens.add({ targets: glow, alpha: real ? 0.1 : 0.12, duration: 900 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.tweens.add({ targets: img, scaleY: sc * 1.03, duration: 1100 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      if (A.FLYERS.has(s.id)) { img.y = -6; this.tweens.add({ targets: [img, glow], y: '-=8', duration: 1400 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' }); }   // hada y búho flotan
      // Barra de vida y ataque encima
      const bar = v.bar = U.hpBar(this, 8, -h - 16, 70, 12, 0x3fae5c);
      const atk = this.add.container(-42, -h - 16);
      const ag = this.add.graphics(); ag.fillStyle(0x0a140d, 0.95); ag.fillCircle(0, 0, 14); ag.lineStyle(2, SUM_COL, 1); ag.strokeCircle(0, 0, 14);
      const icon = this.add.image(0, -1, 'ic_' + (d.atk > 0 ? 'sword' : 'deck')).setIconScale(0.3).setAlpha(0.45);
      v.atkT = T(this, 0, 1, '', { size: 16, bold: true, color: 0xdfffe6, stroke: 0x000000, strokeThickness: 4 });
      atk.add([ag, icon, v.atkT]);
      // Zona de tooltip (ratón y mando)
      const hit = v.hit = this.add.zone(0, -h / 2 - 10, Math.max(70, src.width * sc), h + 40).setInteractive();
      hit.sumSid = s.sid;
      hit.on('pointerover', () => this.showSummonTip(v));
      hit.on('pointerout', () => this.tip.hide());
      v.add([shadow, body, bar, atk, hit]);
      this.sumLayer.add(v);
      return v;
    }
    /** «Ataca 3 (+1 Vínculo)», bloqueo, robo… según las reglas del motor. */
    summonInfo(sid) {
      const c = this.run.combat, s = (c.summons || []).find((x) => x.sid === sid);
      if (!s) return null;
      const d = D.SUMMONS[s.id], atk = E.summonAtk(c, s), bond = E.bondOf(c), parts = [];
      if (atk > 0) parts.push(_t(d.hits > 1 ? 'sum.atkN' : 'sum.atk', { a: atk, n: d.hits }) + (bond ? _t('sum.bond', { b: bond }) : '') + '.');
      if (d.block) parts.push(_t('s.te_da_0_de_bloqueo', { 0: d.block }));
      if (d.draw) parts.push(_t('s.robas_0_carta_mas_al', { 0: d.draw }));
      return { s, d, atk, text: parts.join(' ') };
    }
    showSummonTip(v) {
      const inf = this.summonInfo(v.sid);
      if (!inf) return;
      const first = (this.run.combat.summons || [])[0];
      const extra = first && first.sid === v.sid ? _t('s.es_la_mas_antigua_recibe') : '';
      this.tip.show(v.x - 120, GROUND - v.h - 150, _t('s.0_1_2_pv', { 0: inf.d.name, 1: inf.s.hp, 2: inf.s.maxHp }), _t('s.al_final_de_tu_turno', { 0: inf.text, 1: extra }));
    }
    refreshSummonStats() {
      if (!this.sumViews) return;
      const c = this.run.combat;
      for (const v of this.sumViews.values()) {
        const inf = this.summonInfo(v.sid);
        if (!inf) continue;
        v.atkT.setText(inf.atk > 0 ? (inf.d.hits > 1 ? `${inf.atk}×${inf.d.hits}` : String(inf.atk)) : `+${inf.d.draw || 0}`);
        v.atkT.setFontSize(inf.d.hits > 1 ? 13 : 16);
        v.atkT.setColor(U.hex(E.bondOf(c) > 0 && inf.atk > 0 ? 0x9fffb8 : 0xdfffe6));
      }
    }
    /** Diana roja bajo la criatura que recibirá el próximo golpe enemigo. */
    refreshSummonTarget() {
      if (!this.sumTarget) return;
      const g = this.sumTarget; g.clear();
      if (this.targetTween) { this.targetTween.stop(); this.targetTween = null; g.setAlpha(1); }
      const c = this.run.combat;
      if (!c || c.over || E.hasRelic(this.run, 'velo')) return;   // Velo de la Ceguera: tampoco se sabe a quién golpeará
      const it = E.intentOf(c);
      if (!it.target) return;
      const v = this.sumViews.get(it.target.sid);
      if (!v) return;
      const x = this.summonX(v.slot || 0, (c.summons || []).length), y = GROUND - 2;
      g.lineStyle(4, C.blood, 1); g.strokeEllipse(x, y, 100, 28);
      g.lineStyle(2, 0xff8a7a, 0.8); g.strokeEllipse(x, y, 72, 18);
      g.fillStyle(C.blood, 0.9); g.fillTriangle(x + 52, y - 8, x + 64, y - 16, x + 64, y);   // flecha desde el enemigo
      this.targetTween = this.tweens.add({ targets: g, alpha: 0.35, duration: 520, yoyo: true, repeat: -1 });
    }
    /** Aparición: círculo de invocación + destello verde. */
    summonAppear(v, revive) {
      v.setAlpha(0); v.body.setScale(0.3);
      this.tweens.add({ targets: v, alpha: 1, duration: 220 });
      this.tweens.add({ targets: v.body, scale: 1, duration: 320, ease: 'Back.out' });
      const ring = this.add.image(v.x, GROUND - 6, 'ic_summon').setDepth(LY.units).setIconScale(0.4, 0.14).setAlpha(0.9).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: ring, scaleX: 2.2 * U.icK(ring), scaleY: 0.6 * U.icK(ring), alpha: 0, duration: 620, ease: 'Quad.out', onComplete: () => ring.destroy() });
      U.Fx.hit(this, v.x, GROUND - v.h / 2, revive ? 0xffe9a6 : SUM_COL, false);
    }
    /** Muerte: se deshace en hojas. */
    summonLeaves(v) {
      const x = v.x, y = GROUND - v.h / 2;
      this.tweens.add({ targets: v, alpha: 0, duration: 380, onComplete: () => v.destroy() });
      this.tweens.add({ targets: v.body, scaleY: 0.4, scaleX: 1.2, duration: 380, ease: 'Quad.in' });
      const n = U.Opts.reduceMotion ? 6 : 16;
      for (let i = 0; i < n; i++) {
        const lf = this.add.image(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * v.h * 0.8, 'leafp').setDepth(LY.fx + 600)
          .setTint([0x6fd08a, 0x3f9a5c, 0xa8e6b8, 0x8a6a3a][i % 4]).setScale(1.1 + Math.random() * 1.1).setRotation(Math.random() * 6);
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, r = 60 + Math.random() * 90;
        this.tweens.add({ targets: lf, x: lf.x + Math.cos(a) * r, y: lf.y + Math.sin(a) * r + 30, rotation: lf.rotation + (Math.random() - 0.5) * 8,
          alpha: 0, duration: 700 + Math.random() * 400, ease: 'Sine.out', onComplete: () => lf.destroy() });
      }
      Sfx.play('block', { volume: 0.4 });
    }

    /** Disposición (Parche 3.2): 1 enemigo como siempre; 2 o 3 repartidos a la derecha y más pequeños (0,85 / 0,75).
     *  Un jefe sigue grande, a la derecha, con sus invocaciones pequeñas delante. */
    foeLayout() {
      const es = this.run.combat.enemies, n = es.length;
      if (n === 1) return [{ x: 940, s: 1 }];
      if (es.filter((e) => (D.ENEMIES[e.id] || {}).tier === 'boss').length > 1) return this.duoLayout(es);   // Doble jefe
      const boss = es.findIndex((e) => (D.ENEMIES[e.id] || {}).tier === 'boss');
      if (boss >= 0) {   // el jefe se queda donde estaba; sus invocaciones, pequeñas, a su izquierda
        const others = es.map((e, i) => i).filter((i) => i !== boss), out = [];
        out[boss] = { x: 940, s: 1, boss: true };
        others.forEach((i, k) => { out[i] = { x: others.length === 1 ? 680 : 560 + k * 145, s: 0.6 }; });
        return out;
      }
      return n === 2 ? [{ x: 815, s: 0.85 }, { x: 1085, s: 0.85 }] : [{ x: 745, s: 0.75 }, { x: 945, s: 0.75 }, { x: 1145, s: 0.75 }];
    }
    /** Ancho en pantalla de un enemigo con la escala S (la misma cuenta que buildEnemy). big: sin el recorte de grupo. */
    foeWidth(id, S, big) {
      const d = D.ENEMIES[id] || {};
      let key = 'art_' + d.art;
      if (!this.textures.exists(key) && ENEMY_FALLBACK[d.art]) key = 'art_' + ENEMY_FALLBACK[d.art];
      if (!this.textures.exists(key)) return 200 * S;
      const real = key === 'art_' + d.art, lift = real ? ENEMY_LIFT[d.art] || 0 : 0, src = this.textures.get(key).getSourceImage();
      const targetH = Math.min((ENEMY_H[d.tier] || ENEMY_H.normal) * S * (d.minor ? 0.8 : 1), GROUND - lift - 170);
      const sc = Math.min(targetH / src.height, ((real && ENEMY_MAX_W_BY[d.art]) || ENEMY_MAX_W) * S * (big ? 1 : 0.82) / src.width);
      return src.width * sc;
    }
    /** Doble jefe (Personalizado): el jefe del acto, grande y en su sitio (x 940); el segundo, con tamaño de jefe
     *  (hasta el 85 %), entre el personaje y el primero, sin pisar su barra, su nombre ni su intención; las invocaciones,
     *  pequeñas, en el hueco que quede (si un jefe ha muerto, en el suyo). Los sitios de los jefes no cambian al invocar. */
    duoLayout(es) {
      const isBoss = (e) => (D.ENEMIES[e.id] || {}).tier === 'boss';
      const bi = es.map((e, i) => i).filter((i) => isBoss(es[i]));
      const mainId = E.bossOf(this.run);
      const main = bi.find((i) => es[i].id === mainId) !== undefined ? bi.find((i) => es[i].id === mainId) : bi[0];
      const second = bi.find((i) => i !== main);
      const minions = es.map((e, i) => i).filter((i) => !isBoss(es[i]));
      const LEFT = 470, GAP = 16, MX = 940, out = [];
      const w1 = this.foeWidth(es[main].id, 1, true);
      const mainL = Math.min(MX - w1 / 2, MX - 125) - GAP;   // ni el sprite ni la barra (250 px) del principal
      out[main] = { x: MX, s: 1, boss: true };
      const alive2 = E.isAlive(es[second]), aliveMain = E.isAlive(es[main]);
      // Hueco para invocaciones a la izquierda del segundo jefe solo si los dos jefes están vivos
      const mS = 0.5, mW = minions.map((i) => this.foeWidth(es[i].id, mS, false));
      const leftMin = alive2 && aliveMain && minions.length ? LEFT + mW.reduce((a, b) => a + b + 8, 0) + 4 : LEFT;
      const room = Math.max(120, mainL - leftMin);
      // Lo que ocupa a lo ancho: el sprite, su barra (185 px) o su nombre, lo que sea mayor
      const nm = this.add.text(0, 0, es[second].name, { fontFamily: U.F.display, fontSize: '20px', stroke: '#000', strokeThickness: 4 });
      const nameW = nm.width; nm.destroy();
      const span = (sc) => Math.max(this.foeWidth(es[second].id, sc, true), 185, nameW);
      const wFull = this.foeWidth(es[second].id, 0.85, true);
      const s2 = Math.max(0.55, Math.min(0.85, 0.85 * (room - Math.max(0, Math.max(185, nameW) - wFull)) / wFull));
      const W2 = span(s2);
      const x2 = Math.round(Math.max(leftMin + W2 / 2, mainL - W2 / 2));
      out[second] = { x: x2, s: s2, big: true, maxR: mainL };   // maxR: su intención no pasa de ahí (refreshIntent1)
      if (minions.length) {
        if (alive2 && aliveMain) {   // en fila, a la izquierda del segundo jefe
          let x = LEFT; minions.forEach((i, k) => { out[i] = { x: Math.round(x + mW[k] / 2), s: mS }; x += mW[k] + 8; });
        } else if (!aliveMain) {   // en el sitio del principal (muerto: no se ve)
          const xs = minions.length === 1 ? [MX] : [MX - 85, MX + 85];
          minions.forEach((i, k) => { out[i] = { x: xs[k], s: 0.6 }; });
        } else {   // el segundo ha muerto: en su hueco, como las invocaciones de un jefe solo
          const xs = minions.length === 1 ? [Math.min(680, mainL - 60)] : [Math.min(560, mainL - 205), Math.min(705, mainL - 60)];
          minions.forEach((i, k) => { out[i] = { x: xs[k], s: 0.6 }; });
        }
      }
      return out;
    }
    /** Recorre las vistas: fn(i) con this.foeIdx = i (this.enemy, this.eBar… son las de ese enemigo). */
    eachFoe(fn) {
      const was = this.foeIdx;
      try { for (let i = 0; i < this.foes.length; i++) { this.foeIdx = i; fn(i); } } finally { this.foeIdx = was; }
    }
    /** Retícula dorada bajo el enemigo marcado (solo si hay más de un enemigo vivo). */
    buildReticle() {
      const g = this.reticle = this.add.graphics().setDepth(LY.world + 1);
      this.reticleTw = this.tweens.add({ targets: g, alpha: { from: 1, to: 0.55 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.moveReticle(false);
    }
    moveReticle(animate = true) {
      const c = this.run.combat, g = this.reticle;
      if (!g || !c) return;
      const alive = c.enemies.filter((e) => E.isAlive(e)).length;
      const f = this.foes[c.target];
      g.clear();
      if (c.over || alive < 2 || !f || !f.enemy) { g.setVisible(false); return; }
      const w = Math.max(110, f.enemy.displayWidth * 0.8);
      g.lineStyle(4, C.gold, 1); g.strokeEllipse(0, 0, w, 30);
      g.lineStyle(2, 0xfff0b0, 0.7); g.strokeEllipse(0, 0, w * 0.74, 20);
      g.fillStyle(C.gold, 1);
      for (const sx of [-1, 1]) g.fillTriangle(sx * (w / 2 + 6), 0, sx * (w / 2 + 20), -9, sx * (w / 2 + 20), 9);
      g.setVisible(true);
      g.y = GROUND - 2;
      if (animate && !U.Opts.reduceMotion && g.x) this.tweens.add({ targets: g, x: f.eX, duration: 180, ease: 'Sine.out' }); else g.x = f.eX;
    }
    /** Rehace todas las vistas de enemigos (tras una invocación: cambian los índices). */
    rebuildFoes() {
      this.setAimFoe(-1);
      for (const f of this.foes) {
        for (const k of ['enemy', 'enemyShadow', 'eName', 'eBar', 'eBlock', 'eStatus', 'intent', 'nextIntent', 'iceShield', 'freezeFx', 'judgMark', 'magnetMark', 'dmgPreview']) { const o = f[k]; if (o && o.destroy) { this.tweens.killTweensOf(o); o.destroy(); } }
        (f.affixAura || []).forEach((g) => { this.tweens.killTweensOf(g); g.destroy(); });
        if (f.enemyIdle && f.enemyIdle.stop) f.enemyIdle.stop();
      }
      // etiquetas de afijo (zonas y textos sueltos) se quedan con el líder: solo hay afijos en élites, que no invocan
      this.foes = [];
      const was = this.foeIdx;
      this.foeLayout().forEach((L, i) => { this.foeIdx = i; this.buildEnemy(L); });
      this.foeIdx = Math.min(was, this.foes.length - 1);
      this.moveReticle(false);
      this.refreshBars(false); this.refreshStatuses(); this.refreshIntent();
    }
    /** Marca un enemigo (clic, mando o arrastre). */
    markFoe(i, quiet) {
      const c = this.run.combat;
      if (c.target === i) return true;
      if (!E.setTarget(this.run, i)) return false;
      this.moveReticle();
      if (!quiet) Sfx.play('card');
      if (this.selected) this.showPreview(this.selected);
      return true;
    }
    /** Enemigo vivo bajo el puntero (para soltar una carta encima), o -1. */
    foeAt(px, py) {
      const c = this.run.combat;
      for (let i = 0; i < this.foes.length; i++) {
        const f = this.foes[i]; if (!f.enemy || !E.isAlive(c.enemies[i])) continue;
        const b = f.enemy.getBounds();
        if (px >= b.x - 20 && px <= b.right + 20 && py >= b.y - 60 && py <= GROUND + 20) return i;
      }
      return -1;
    }

    buildEnemy(L = { x: 940, s: 1 }) {
      const e = this.fe, d = D.ENEMIES[e.id], fi = this.foeIdx, S = L.s, group = this.run.combat.enemies.length > 1 && !L.boss;
      this.foes[fi] = this.foes[fi] || {};
      this.foes[fi].intentMaxR = L.maxR;   // Doble jefe: borde derecho que no puede pasar la intención del 2.º jefe
      let targetH = (ENEMY_H[d.tier] || ENEMY_H.normal) * S * (d.minor ? 0.8 : 1);
      const x = this.eX = L.x;
      // Sin PNG propio → textura del enemigo más parecido, tintada de azul hielo
      let key = 'art_' + d.art;
      this.enemyTint = null;
      if (!this.textures.exists(key) && ENEMY_FALLBACK[d.art]) {
        key = 'art_' + ENEMY_FALLBACK[d.art]; this.enemyTint = fallbackTint(e.id);
        if (!this.textures.exists(key) && ENEMY_FALLBACK[ENEMY_FALLBACK[d.art]]) key = 'art_' + ENEMY_FALLBACK[ENEMY_FALLBACK[d.art]];   // sustituto de un sustituto
      }
      const real = key === 'art_' + d.art, lift = real ? ENEMY_LIFT[d.art] || 0 : 0;
      targetH = Math.min(targetH, GROUND - lift - 170);   // el que levita no sube su barra/intención por encima de y≈170
      this.enemy = this.add.image(x, GROUND - lift, key).setOrigin(0.5, 1).setFlipX(flipOf(key));   // todos miran al personaje (la silueta del golpe copia el volteo)
      this.applyEnemyTint();
      // Escala por altura, salvo que el ancho supere el tope: entonces manda el ancho
      const src = this.textures.get(key).getSourceImage();
      this.enemy.setScale(Math.min(targetH / src.height, ((real && ENEMY_MAX_W_BY[d.art]) || ENEMY_MAX_W) * S * (group && !L.big ? 0.82 : 1) / src.width));   // big: 2.º jefe
      this.enemyBaseScale = this.enemy.scale;
      const top = GROUND - lift - this.enemy.displayHeight;   // altura real tras el tope
      this.eY = GROUND - lift - this.enemy.displayHeight / 2;
      this.enemyShadow = this.add.image(x, GROUND, 'shadow').setDisplaySize(this.enemy.displayWidth * 0.9, 40);
      this.enemy.setDepth(LY.units);
      this.eRestX = x; this.eLean = 0;   // posición de reposo (se adelanta al anunciar un ataque)
      this.enemyIdle = A.idle(this, this.enemy, this.enemyBaseScale, A.kindOf(d.art, d.tier));   // el jefe respira lento y hondo; los voladores flotan
      if (e.hp <= 0 || e.dead) { this.enemy.setAlpha(0); this.enemyShadow.setAlpha(0); }
      this.enemy.setInteractive();
      // Clic: con una carta seleccionada, la juega contra él; sin carta, lo marca
      this.enemy.on('pointerup', () => {
        if (this.wasDrag) return;
        if (this.run.combat.enemies.length > 1) this.markFoe(fi, !!this.selected);
        if (this.selected) this.playSelected();
      });
      this.enemy.on('pointerover', () => { if (E.hasRelic(this.run, 'velo')) { this.tip.show(Math.min(x + 150, 1000), 120, e.name, D.BOSS_RELICS.velo.bad); return; } const it = E.intentFor(this.run.combat, fi); this.tip.show(Math.min(x + 150, 1000), 120, `${e.name}: ${it.name}`, this.intentDesc(it, fi), { kws: intentKws(it), max: 4 }); });
      this.enemy.on('pointerout', () => this.tip.hide());

      const bw = !group ? Math.round(250 * S) : L.big ? 185 : this.run.combat.enemies.length >= 3 || this.run.combat.enemies.some((x) => (D.ENEMIES[x.id] || {}).tier === 'boss') ? 140 : 185;
      this.eName = T(this, x, top - 46, e.name, { size: group ? 20 : 26, font: 'display', color: d.tier === 'normal' ? C.parch : C.blood, stroke: 0x000000, strokeThickness: 4 });
      this.eBar = U.hpBar(this, x, top - 20, bw, 20);
      this.eBlock = this.blockBadge(x - bw / 2 - 25, top - 20);
      // Estados: a la derecha de la barra con un enemigo; con varios, debajo (sin invadir al vecino)
      this.eStatus = group ? this.add.container(x - bw / 2 + 18, top + 16) : this.add.container(x + 156, top - 20);
      this.eStatus.isFoe = true; this.eStatus.perRow = group ? Math.max(1, Math.floor(bw / 46)) : 0;
      if (e.dead) [this.eName, this.eBar, this.eBlock, this.eStatus].forEach((o) => o.setVisible(false));
      // startBlock: el enemigo entra con un escudo de hielo ya puesto (dura mientras le quede Bloqueo)
      if (d.startBlock) {
        const w = this.enemy.displayWidth * 0.62 + 40, h = this.enemy.displayHeight * 0.58 + 40;
        const sh = this.iceShield = this.add.graphics().setDepth(LY.units + 2).setBlendMode(Phaser.BlendModes.ADD);
        sh.fillStyle(0x9fd6ff, 0.13); sh.fillEllipse(0, 0, w, h);
        sh.lineStyle(3, 0xcfeaff, 0.7); sh.strokeEllipse(0, 0, w, h);
        sh.lineStyle(1.5, 0xffffff, 0.45); sh.strokeEllipse(-w * 0.08, -h * 0.1, w * 0.62, h * 0.5);
        sh.setPosition(x, this.eY);
        this.tweens.add({ targets: sh, alpha: { from: 1, to: 0.6 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      this.buildAffixes(x, top);
      this.intent = this.add.container(x, top - (group ? 84 : 92));
      if (group) this.intent.setScale(0.86);
      this.intent.bobPad = 6;   // se mece 6 px: los globos de consejo dejan ese margen
      this.tweens.add({ targets: this.intent, y: this.intent.y - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    /** Afijos de élite: aura del color de cada afijo y etiquetas (con tooltip) bajo la vida. */
    buildAffixes(x, top) {
      const af = (this.fe.affixes || []);
      if (!af.length) return;
      const w = this.enemy.displayWidth * 0.62 + 50, h = this.enemy.displayHeight * 0.62 + 40;
      this.affixAura = af.map((id, i) => {
        const col = D.AFFIXES[id].color;
        const g = this.add.graphics().setDepth(LY.world).setBlendMode(Phaser.BlendModes.ADD);
        for (let k = 5; k >= 1; k--) { g.fillStyle(col, 0.09); g.fillEllipse(0, 0, w * (0.7 + k * 0.08), h * (0.7 + k * 0.08)); }
        g.setPosition(x, this.eY);
        this.tweens.add({ targets: g, alpha: { from: 1, to: 0.45 }, scale: { from: 1, to: 1.05 }, duration: 1200 + i * 380, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        return g;
      });
      let px = x - (af.length - 1) * 64;
      af.forEach((id) => {
        const a = D.AFFIXES[id];
        const t = T(this, px, top + 8, a.name, { size: 14, bold: true, color: a.color, stroke: 0x000000, strokeThickness: 3 });
        const bw = t.width + 22;
        const g = this.add.graphics(); g.fillStyle(0x080b0a, 0.85); g.fillRoundedRect(px - bw / 2, top - 3, bw, 22, 11); g.lineStyle(1.5, a.color, 0.9); g.strokeRoundedRect(px - bw / 2, top - 3, bw, 22, 11);
        t.setDepth(LY.units + 3); g.setDepth(LY.units + 2);
        const hit = this.add.zone(px, top + 8, bw, 22).setInteractive().setDepth(LY.units + 3);
        hit.on('pointerover', () => this.tip.show(px - 120, top + 26, _t('s.afijo_0', { 0: a.name }), a.text));
        hit.on('pointerout', () => this.tip.hide());
        px += 128;
      });
    }

    blockBadge(x, y) {
      const c = this.add.container(x, y).setVisible(false);
      const ic = this.add.image(0, 0, 'ic_shield').setIconScale(0.62);
      const t = T(this, 0, 2, '0', { size: 18, bold: true, stroke: 0x000000, strokeThickness: 4 });
      c.add([ic, t]); c.txt = t;
      c.setSize(40, 40).setInteractive();
      c.on('pointerover', () => { const b0 = this.run.combat.player.block || 0; this.tip.show(x - 20, y + 26, `${U.glossName('block')} ${b0}`, U.glossDesc('block', { n: b0 })); });
      c.on('pointerout', () => this.tip.hide());
      c.set = (v) => { c.setVisible(v > 0); t.setText(String(v)); };
      return c;
    }

    buildControls() {
      // Orbe de energía
      const ex = 96, ey = 600;
      this.orbXY = { x: ex, y: ey };
      const orb = this.add.graphics();
      orb.fillStyle(0x2a1206, 1); orb.fillCircle(ex, ey, 46);
      orb.fillStyle(C.ember, 1); orb.fillCircle(ex, ey, 40);
      orb.fillStyle(C.flame, 0.6); orb.fillCircle(ex - 8, ey - 10, 20);
      orb.lineStyle(3, C.gold, 1); orb.strokeCircle(ex, ey, 46);
      this.energyT = T(this, ex, ey, '', { size: 34, font: 'display', stroke: 0x2a1206, strokeThickness: 5 });
      this.energyOrb = this.add.container(0, 0, [orb, this.energyT]);
      const hit = this.add.circle(ex, ey, 46).setInteractive();
      this.energyHit = hit;
      hit.on('pointerover', () => { const p0 = this.run.combat.player; this.tip.show(ex + 50, ey - 90, `${U.glossName('energy')} ${p0.energy}/${p0.maxEnergy}`, U.glossDesc('energy', { n: p0.energy, m: p0.maxEnergy })); });
      // Contador de Combo (2+ cartas jugadas este turno)
      // Gemas de energía en arco sobre el orbe (se vacían una a una / se rellenan con destello)
      this.gemBox = this.add.container(ex, ey).setDepth(LY.units + 2); this.gems = []; this.gemShown = null;
      this.comboT = T(this, ex, ey - 96, '', { size: 20, font: 'display', color: C.flame, stroke: 0x2a1206, strokeThickness: 5 }).setVisible(false);
      this.comboShown = 0;
      hit.on('pointerout', () => this.tip.hide());

      // Pilas
      const pile = (x, label, getter, title) => {
        const back = this.add.image(x, 676, U.cardBackKey(this)).setScale(0.62);
        const t = T(this, x + 24, 694, '0', { size: 18, bold: true, stroke: 0x000000, strokeThickness: 4 });
        back.setInteractive({ useHandCursor: true });
        back.on('pointerover', () => this.tip.show(x - 60, 560, `${label} · ${getter().length}`, _t('s.clic_para_ver_las_cartas')));
        back.on('pointerout', () => this.tip.hide());
        back.on('pointerup', () => this.scene.launch('DeckView', { mode: 'view', title, cards: getter(), sort: x === 44 ? 'cost' : undefined }));
        return t;
      };
      const c = () => this.run.combat;
      // Robo: ordenado por coste (no en su orden real, para no dar pistas)
      this.drawT = pile(44, _t('s.mazo_de_robo'), () => c().draw, _t('pile.drawSorted'));
      this.discardT = pile(1236, _t('s.descarte'), () => c().discard, _t('s.descarte'));
      this.exhaustT = T(this, 1236, 626, '', { size: 13, color: C.muted });
      this.exhaustT.setInteractive({ useHandCursor: true });
      this.exhaustT.on('pointerup', () => { if (c().exhaust.length) this.scene.launch('DeckView', { mode: 'view', title: _t('s.cartas_agotadas'), cards: c().exhaust }); });
      this.exhaustT.on('pointerover', () => this.tip.show(1236 - 240, 560, `${_t('s.agotadas')} · ${c().exhaust.length}`, _t('s.clic_para_ver_las_cartas_2'), { kws: ['exhaust'] }));
      this.exhaustT.on('pointerout', () => this.tip.hide());

      this.endBtn = button(this, 1150, 596, _t('s.terminar_turno'), () => this.onEndTurn(), { w: 196, h: 54 });
      T(this, 1150, 632, _t('s.tecla_e'), { size: 12, color: C.muted });
      this.endWarnT = T(this, 1150, 654, '', { size: 16, bold: true, color: C.flame, stroke: 0x000000, strokeThickness: 4 }).setVisible(false).setDepth(LY.units + 9);

      // Registro de combate
      this.logPanel = this.add.container(16, 64).setVisible(false).setDepth(LY.panel + 50);
      const lg = this.add.graphics(); lg.fillStyle(0x080b0a, 0.9); lg.fillRoundedRect(0, 0, 360, 230, 10);
      this.logText = T(this, 14, 12, '', { size: 14, ox: 0, oy: 0, wrap: 332, color: C.parch, lineSpacing: 2 });
      this.logPanel.add([lg, this.logText]);
      button(this, 1150, 532, _t('s.registro'), () => { this.logPanel.setVisible(!this.logPanel.visible); this.renderLog(); }, { w: 130, h: 34, size: 16, variant: 'ghost' });
      // «?»: glosario de habilidades encima del combate (se vuelve tal cual)
      this.glossBtn = button(this, 1240, 532, '?', () => openGlossary(this), { w: 36, h: 34, size: 20, variant: 'ghost', tip: [_t('gl.help'), ''], tipObj: this.tip });
    }

    buildInput() {
      this.input.dragDistanceThreshold = Math.round(10 * root.CM_HIRES.R);   // (en píxeles del lienzo: 10 lógicos)
      this.input.on('dragstart', (p, obj) => {
        if (this.busy || !obj.cardData) return;
        this.dragging = obj; this.wasDrag = true;
        this.tip.hide();
        this.showPreview(obj.cardData.uid);
        obj.setDepth(LY.hand + 300);
        this.tweens.killTweensOf(obj);
        obj.setRotation(0).setScale(1.05);
        obj._tx = obj.x; obj._ty = obj.y;
      });
      this.input.on('drag', (p, obj, dx, dy) => {
        if (this.dragging !== obj) return;
        obj._tx = dx; obj._ty = dy;   // la carta lo sigue con inercia (update → dragFollow)
        if (U.Opts.reduceMotion) obj.setPosition(dx, dy);
        this.dropHint.setVisible(true).setAlpha(dy < 440 ? 0.9 : 0.35);
        // Grupos: arrastrar la carta sobre un enemigo lo marca como objetivo
        if (this.run.combat && this.run.combat.enemies.length > 1) { const fi = this.foeAt(p.worldX, p.worldY); if (fi >= 0 && this.markFoe(fi, true)) this.showPreview(obj.cardData.uid); }
      });
      this.input.on('dragend', (p, obj) => {
        if (this.dragging !== obj) return;
        this.dragging = null;
        this.dropHint.setVisible(false);
        this.hidePreview();
        this.time.delayedCall(40, () => { this.wasDrag = false; });
        const ty = obj._ty !== undefined ? obj._ty : obj.y;
        if (ty < 440) this.tryPlay(obj.cardData.uid);
        else {   // soltada fuera: vuelve a su sitio con rebote
          obj.hovered = false; this.unhover(obj); this.layoutHand();
          const sd = obj.slotData;
          if (sd && obj.scene) { this.tweens.killTweensOf(obj); this.tweens.add({ targets: obj, x: sd.x + this.spreadOff(obj.slotIndex), y: sd.y, rotation: sd.r, scale: sd.scale, duration: 340, ease: 'Back.out' }); }
        }
      });
      // Cada fotograma: inercia del arrastre y flecha de apuntado
      const feelUpd = () => { this.dragFollow(); this.updateAim(); };
      this.events.on('update', feelUpd); this.events.once('shutdown', () => this.events.off('update', feelUpd));
      // Clic o A durante el turno enemigo: acelera el resto del turno ×3
      this.input.on('pointerdown', () => { if (this.busy && this.enemyPhase) this.setTurbo(true); });
      this.dropHint = T(this, 640, 330, _t('s.suelta_para_jugar'), { size: 28, font: 'display', color: C.flame, stroke: 0x000000, strokeThickness: 5 }).setVisible(false).setDepth(LY.hand + 250);

      // Atajos (escritorio): 1-9/0 seleccionan, Enter juega, E/Espacio terminan, D mazo, V velocidad, Esc cierra
      this.input.keyboard.on('keydown', (ev) => {
        if (this.scene.isActive('DeckView') || U.tipOpen(this)) return;
        const k = ev.key.toLowerCase(), c = this.run.combat;
        if (k === 'e' || k === ' ') { this.onEndTurn(); return; }
        if (k === 'v') { const sp = U.cycleSpeed(); toast(this, _t('s.velocidad_de_animacion_0', { 0: sp }), C.gold); return; }
        if (k === 'd') { this.deselect(); this.scene.launch('DeckView', { mode: 'view', title: _t('s.tu_mazo') }); return; }
        if (k === 'escape') {
          if (this.logPanel.visible) this.logPanel.setVisible(false);
          this.deselect(); return;
        }
        if (k === 'enter') { if (this.selected) this.playSelected(); return; }
        const n = '1234567890'.indexOf(k);
        if (n >= 0 && c && !this.busy) {
          const card = c.hand[n];
          if (!card) return;
          if (this.selected === card.uid) { this.playSelected(); return; }   // pulsarla otra vez también la juega
          this.select(card.uid);
        }
      });
      // Mando (y flechas): ←/→ por la mano · A coge la carta y A otra vez la juega · B la suelta · X termina · Y mazo
      this.padFm = U.focusManager(this, { pad: 4 });
      U.Input.bind(this, (a, dev) => this.onPadAction(a, dev), { keys: false });
      this.modalNav = U.padNav(this, { manual: true });   // menús encima (poción, ⚙…): navegación genérica
      this.padZone = 'hand';
      // Glifos X (terminar turno) e Y (mazo) con mando
      const padG = this.add.graphics().setDepth(LY.fx + 600);
      this.events.on('update', () => {
        padG.clear();
        if (U.Input.device !== 'pad' || !this.endBtn || !this.endBtn.visible) return;
        U.padGlyph(padG, this.endBtn.x - 98, this.endBtn.y - 27, 'X', 12);
        U.padGlyph(padG, 22, 640, 'Y', 12);
        const grp = this.run.combat && this.run.combat.enemies.filter((e) => E.isAlive(e)).length > 1;
        if (this.padZone === 'hand' && (this.run.potions || []).some(Boolean)) U.padGlyph(padG, 1176, 30, grp ? 'LT' : 'RT', 10);
        if (grp && this.padZone === 'hand' && !this.selected && this.reticle && this.reticle.visible) U.padGlyph(padG, this.reticle.x - 14, GROUND + 14, 'RT', 10);
      });
      // Tocar fuera deselecciona (táctil)
      this.input.on('pointerdown', (p, objs) => { if (this.selected && !objs.length) this.deselect(); });
    }

    /** Acción de mando / flechas en combate. */
    onPadAction(a, dev) {
      if (this.scene.isActive('DeckView')) return;
      if (a === 'confirm' && this.busy && this.enemyPhase) { this.setTurbo(true); return; }   // A: acelera el turno enemigo ×3
      // Ventanas de elección (Inscribir+, Improvisar): ←/→ entre opciones, A elige
      if (this.runeChoice) {
        const fm = this.padFm, items = (this.runeChoice.padItems || []);
        if (fm.items !== items) fm.set(items);
        if (['left', 'right', 'up', 'down'].includes(a)) fm.move(a); else if (a === 'confirm') fm.confirm();
        return;
      }
      if (this.modalNav && this.modalNav.handleModal(a)) return;   // menú de poción u otra capa encima
      const c = this.run.combat;
      if (!c || c.over) return;
      if (this.padInfo(a, dev)) return;
      if (this.padSummons(a, dev)) return;
      // Grupos: sin carta, el gatillo derecho marca el siguiente enemigo (las pociones siguen en el izquierdo y en ↑)
      if (a === 'nextItem' && dev === 'pad' && this.padZone === 'hand' && !this.selected && c.enemies.filter((e) => E.isAlive(e)).length > 1) { this.cycleTarget(1); return; }
      if (this.padPotions(a, dev)) return;
      if (a === 'up' && dev === 'pad' && !this.selected && this.enterInfo()) return;   // sin criaturas ni pociones: directo a los estados
      if (a === 'endTurn' && dev === 'pad') { this.onEndTurn(); return; }
      if (a === 'deck' && dev === 'pad') { this.deselect(); this.scene.launch('DeckView', { mode: 'view', title: _t('s.tu_mazo') }); return; }
      if (this.busy) return;
      const hand = c.hand.map((x) => this.cards.get(x.uid)).filter(Boolean);
      const items = hand.map((obj) => ({ obj, uid: obj.cardData.uid,
        rect: () => { const b = obj.getBounds(); return { x: b.x, y: b.y, w: b.width, h: b.height }; },
        onFocus: () => { if (!this.selected) this.hover(obj); },
        onBlur: () => { if (this.selected !== obj.cardData.uid) this.unhover(obj); } }));
      const fm = this.padFm;
      const curUid = fm.cur && fm.cur.uid;
      fm.items = items; fm.cur = items.find((x) => x.uid === curUid) || null;
      const aliveN = c.enemies.filter((e) => E.isAlive(e)).length;
      // Grupos: con una carta cogida, ←/→ cambian de objetivo (A la juega)
      if ((a === 'left' || a === 'right') && this.selected && aliveN > 1) { this.cycleTarget(a === 'left' ? -1 : 1); return; }
      if (a === 'left' || a === 'right') {
        if (this.selected) this.deselect();
        if (!fm.cur) { fm.focus(items[a === 'left' ? items.length - 1 : 0] || null); return; }
        const i = items.indexOf(fm.cur), j = Math.max(0, Math.min(items.length - 1, i + (a === 'left' ? -1 : 1)));
        if (j !== i) { fm.focus(items[j]); Sfx.play('click', { volume: 0.4 }); }
        return;
      }
      if (a === 'confirm' && dev === 'pad') {
        if (!fm.cur) { fm.focus(items[0] || null); return; }
        if (this.selected === fm.cur.uid) { fm.cur = null; this.playSelected(); }
        else this.select(fm.cur.uid);
        return;
      }
      if (a === 'back' && dev === 'pad') this.deselect();
    }

    /** Estados, intención y energía con mando (zona «info»): ←/→ entre ellos (su tooltip sale al enfocar), ↓/B vuelven a la mano. */
    infoItems() {
      const objs = [];
      [this.pStatus, this.eStatus].forEach((cont) => { if (cont) cont.list.forEach((o) => { if (o.statusKey && o.active) objs.push(o); }); });
      if (this.intent && this.intent.visible && this.intent.input) objs.push(this.intent);
      if (this.energyHit) objs.push(this.energyHit);
      const fake = (o) => { const b = o.getBounds(); return { x: b.centerX, y: b.centerY }; };
      return objs.map((o) => ({ obj: o, rect: () => { const b = o.getBounds(); return { x: b.x, y: b.y, w: b.width, h: b.height }; },
        onFocus: () => o.emit('pointerover', fake(o)), onBlur: () => { o.emit('pointerout', fake(o)); this.tip.hide(); } }))
        .sort((p, q) => { const a = p.rect(), b = q.rect(); return (a.x + a.w / 2) - (b.x + b.w / 2); });
    }
    enterInfo() {
      const items = this.infoItems();
      if (!items.length) return false;
      if (this.selected) this.deselect();
      const fm = this.padFm;
      if (fm.cur && fm.cur.obj && fm.cur.obj.cardData) { const o = fm.cur.obj; fm.cur = null; this.unhover(o); }
      this.hidePreview();
      this.padZone = 'info'; fm.items = items; fm.focus(items[items.length - 1]); Sfx.play('click', { volume: 0.4 });
      return true;
    }
    padInfo(a) {
      if (this.padZone !== 'info') return false;
      const fm = this.padFm, items = this.infoItems();
      if (!items.length) { this.padZone = 'hand'; fm.focus(null); return false; }
      fm.items = items;
      const i = Math.max(0, items.findIndex((it) => fm.cur && it.obj === fm.cur.obj));
      if (a === 'left' || a === 'right') { fm.focus(items[Math.max(0, Math.min(items.length - 1, i + (a === 'left' ? -1 : 1)))]); Sfx.play('click', { volume: 0.4 }); return true; }
      if (a === 'down' || a === 'back') { this.padZone = 'hand'; fm.focus(null); this.tip.hide(); Sfx.play('click', { volume: 0.4 }); return true; }
      if (a === 'confirm' || a === 'up') { fm.focus(items[i]); return true; }
      return false;
    }
    /** Criaturas con mando: ↑ desde la mano las enfoca (tooltip), ←/→ entre ellas, ↑ otra vez → pociones, ↓/B vuelven. */
    padSummons(a, dev) {
      const fm = this.padFm;
      const views = this.sumViews ? [...this.sumViews.values()].filter((v) => v.active && v.hit).sort((p, q) => p.slot - q.slot) : [];
      const items = views.map((v) => ({ obj: v.hit, sid: v.sid, rect: () => { const b = v.hit.getBounds(); return { x: b.x, y: b.y, w: b.width, h: b.height }; },
        onFocus: () => this.showSummonTip(v), onBlur: () => this.tip.hide() }));
      if (this.padZone === 'summons' && !items.length) { this.padZone = 'hand'; fm.focus(null); }
      if (this.padZone === 'summons') {
        const i = Math.max(0, items.findIndex((it) => fm.cur && it.sid === fm.cur.sid));
        fm.items = items;
        if (a === 'left' || a === 'right') { const j = Math.max(0, Math.min(items.length - 1, i + (a === 'left' ? -1 : 1))); fm.focus(items[j]); Sfx.play('click', { volume: 0.4 }); return true; }
        if (a === 'up') { this.tip.hide(); this.padZone = 'hand'; if (!this.padPotions('up', dev)) { this.padZone = 'summons'; fm.focus(items[i]); } return true; }
        if (a === 'down' || a === 'back') { this.padZone = 'hand'; fm.focus(null); this.tip.hide(); Sfx.play('click', { volume: 0.4 }); return true; }
        if (a === 'confirm') { fm.focus(items[i]); return true; }   // vuelve a enseñar su tooltip
        return false;   // X / Y siguen funcionando
      }
      if (a === 'up' && dev === 'pad' && this.padZone === 'hand' && !this.selected && items.length) {
        if (fm.cur && fm.cur.obj && fm.cur.obj.cardData) { const o = fm.cur.obj; fm.cur = null; this.unhover(o); }
        this.hidePreview();
        this.padZone = 'summons'; fm.items = items; fm.focus(items[0]); Sfx.play('click', { volume: 0.4 });
        return true;
      }
      return false;
    }

    /** Pociones con mando: ↑ desde la mano entra en el cinturón, ←/→ o LT/RT cambian, A abre Usar/Tirar, B o ↓ vuelven. */
    padPotions(a, dev) {
      const hits = [];
      const walk = (list) => list.forEach((o) => { if (o && o.active && o.potSlot !== undefined) hits.push(o); if (o && o.list && o.type === 'Container') walk(o.list); });
      walk(this.children.list);
      hits.sort((p, q) => p.potSlot - q.potSlot);
      const fm = this.padFm;
      const items = hits.map((h) => ({ obj: h, slot: h.potSlot, rect: () => ({ x: h.x - 17, y: h.y - 22, w: 34, h: 44 }),
        onConfirm: () => h.emit('pointerup', { x: h.x, y: h.y }) }));
      const enter = (i) => {
        if (!items.length) return false;
        if (this.selected) this.deselect();
        if (this.padZone === 'hand' && fm.cur && fm.cur.obj && fm.cur.obj.cardData) { const o = fm.cur.obj; fm.cur = null; this.unhover(o); }
        this.hidePreview();
        this.padZone = 'potions';
        fm.items = items; fm.focus(items[(i + items.length) % items.length]); Sfx.play('click', { volume: 0.4 });
        return true;
      };
      const idx = () => Math.max(0, items.findIndex((it) => fm.cur && it.obj === fm.cur.obj));
      if (this.padZone === 'potions' && !items.length) { this.padZone = 'hand'; fm.focus(null); }
      if (this.padZone === 'potions') {
        if (a === 'left' || a === 'prevItem') return enter(idx() - 1);
        if (a === 'right' || a === 'nextItem') return enter(idx() + 1);
        if (a === 'confirm') { const it = items[idx()]; if (it) it.onConfirm(); return true; }
        if (a === 'back' || a === 'down') { this.padZone = 'hand'; fm.focus(null); Sfx.play('click', { volume: 0.4 }); return true; }
        if (a === 'up') { this.enterInfo(); return true; }
        return false;
      }
      if (a === 'prevItem' || a === 'nextItem') return enter(a === 'prevItem' ? -1 : 0);
      if (a === 'up' && dev === 'pad' && !this.selected) return enter(0);
      return false;
    }

    /** Marca el siguiente (+1) o el anterior (−1) enemigo vivo. */
    cycleTarget(dir) {
      const c = this.run.combat, n = c.enemies.length;
      for (let k = 1; k < n; k++) { const j = (c.target + dir * k + n * 3) % n; if (E.isAlive(c.enemies[j])) { this.markFoe(j); return true; } }
      return false;
    }
    /** Selecciona una carta (teclado o toque): se levanta y muestra su daño previsto. */
    select(uid) {
      this.selected = uid;
      // (b) cualquier carta elevada que no sea la elegida vuelve a su sitio
      for (const o of this.cards.values()) if (o.cardData.uid !== uid && o.hovered) { o.hovered = false; }
      this.layoutHand();
      const obj = this.cards.get(uid);
      if (obj) this.hover(obj);
      Sfx.play('click');
    }
    deselect() {
      if (!this.selected) return;
      const obj = this.cards.get(this.selected);
      this.selected = null;
      if (obj) this.unhover(obj);
      this.hidePreview();
      this.layoutHand();
    }
    playSelected() {
      const uid = this.selected;
      if (!uid || this.busy) return;
      this.selected = null;
      this.hidePreview();
      this.tryPlay(uid);
    }

    /** Daño previsto sobre el enemigo (Fuerza, Débil, Templar, Bloqueo…) y calavera si lo mataría. */
    buildPreview() {
      const p = this.dmgPreview = this.add.container(this.eX, this.eY - 40).setDepth(LY.fx + 400).setVisible(false);
      p.bg = this.add.graphics();
      p.skull = this.add.image(0, 0, 'ic_skull').setIconScale(0.42);
      p.txt = T(this, 0, 0, '', { size: 40, font: 'display', color: C.blood, stroke: 0x000000, strokeThickness: 6 });
      p.sub = T(this, 0, 34, '', { size: 15, bold: true, color: C.frost, stroke: 0x000000, strokeThickness: 4 });
      p.add([p.bg, p.skull, p.txt, p.sub]);
    }
    showPreview(uid) {
      const c = this.run.combat;
      const r = E.previewPlay(this.run, uid), all = E.cardTarget && E.cardTarget(c.hand.find((x) => x.uid === uid)) === 'all';
      this.eachFoe((i) => {
        if (!this.dmgPreview) this.buildPreview();
        const p = this.dmgPreview;
        // Un enemigo: el total; varios: lo que recibe cada uno (las de área, sobre todos)
        const x = !r ? null : c.enemies.length === 1 ? r : r.per && r.per[i] ? Object.assign({}, r.per[i], i === c.target && r.range ? { range: r.range } : {}) : null;
        this.foeGlow(all && E.isAlive(c.enemies[i]));
        if (!x) { p.setVisible(false); return; }
        p.txt.setText(x.range ? `−${x.range[0]}–${x.range[1]}` : `−${x.dmg}`).setColor(x.kills ? '#ffd27a' : U.hex(C.blood));
        p.sub.setText([x.hits > 1 ? _t('s.0_golpes', { 0: x.hits }) : '', x.blocked ? _t('s.0_bloqueado', { 0: x.blocked }) : ''].filter(Boolean).join(' · '));
        p.skull.setVisible(!!x.kills);
        const w = p.txt.width + (x.kills ? 44 : 0) + 34;
        p.txt.setX(x.kills ? 20 : 0); p.skull.setX(-w / 2 + 30);
        p.bg.clear(); p.bg.fillStyle(0x080b0a, 0.78); p.bg.fillRoundedRect(-w / 2, -30, w, 60, 18);
        p.bg.lineStyle(2, x.kills ? C.gold : C.blood, 0.9); p.bg.strokeRoundedRect(-w / 2, -30, w, 60, 18);
        p.setScale(c.enemies.length > 1 ? 0.8 : 1);
        p.setVisible(true).setAlpha(1);
        p.previewUid = uid;
      });
    }
    /** Cartas de área: todos los enemigos vivos se iluminan mientras la tienes cogida. */
    foeGlow(on) {
      if (on && !this.areaGlow && this.enemy) { this.foes[this.foeIdx].areaGlow = A.glow(this.enemy, C.gold, 3); }
      else if (!on && this.foes[this.foeIdx] && this.foes[this.foeIdx].areaGlow) { A.unglow(this.enemy, this.foes[this.foeIdx].areaGlow); this.foes[this.foeIdx].areaGlow = null; }
    }
    get areaGlow() { return this.foes && this.foes[this.foeIdx] && this.foes[this.foeIdx].areaGlow; }
    hidePreview() { this.eachFoe(() => { if (this.dmgPreview) this.dmgPreview.setVisible(false); this.foeGlow(false); }); }

    /* ---------------- Cartas en mano ---------------- */
    makeCard(card, x, y) {
      const obj = cardView(this, card, { combat: this.run.combat });
      obj.setPosition(x, y).setScale(0.3).setAlpha(0.2);
      obj.setInteractive({ useHandCursor: true, draggable: true });
      obj.on('pointerover', (p) => { if (!p.wasTouch) this.hover(obj); });
      // Elevada: inclinación «3D» sutil hacia el cursor (giro de hasta ~6° y escala X/Y que simula el tilt)
      obj.on('pointermove', (p) => {
        if (!obj.hovered || this.dragging || p.wasTouch || U.Opts.reduceMotion) return;
        const kx = Phaser.Math.Clamp((p.worldX - obj.x) / (U.CARD_W * 0.6), -1, 1), ky = Phaser.Math.Clamp((p.worldY - obj.y) / (U.CARD_H * 0.6), -1, 1);
        if (this.tweens.isTweening(obj)) return;   // mientras sube, manda su tween
        obj.rotation = kx * 0.1;
        obj.setScale(HAND.hoverScale * handK() * (1 - Math.abs(kx) * 0.05), HAND.hoverScale * handK() * (1 - Math.abs(ky) * 0.04));
      });
      obj.on('pointerout', () => { if (this.selected !== obj.cardData.uid) { this.unhover(obj); if (this.selected) this.showPreview(this.selected); else this.hidePreview(); } });
      obj.on('pointerup', (p) => {
        if (this.wasDrag) { this.wasDrag = false; return; }
        if (this.busy) return;
        if (p.wasTouch && this.selected !== obj.cardData.uid) { this.select(obj.cardData.uid); return; }
        this.selected = null;
        this.hidePreview();
        this.tryPlay(obj.cardData.uid);
      });
      this.cards.set(card.uid, obj);
      return obj;
    }

    /** Posición de la carta i de n. La curva y el giro se normalizan (t ∈ [-1, 1]) para que
     *  el abanico no se hunda más al tener más cartas: con 10 cartas cabe igual que con 5. */
    slot(i, n) {
      const mid = (n - 1) / 2, k = i - mid, t = mid > 0 ? k / mid : 0;
      const sc = handScale(n), cw = 160 * sc, avail = HAND.right - HAND.left, cx = (HAND.left + HAND.right) / 2;
      const spacing = n > 1 ? Math.min(138, (avail - cw) / (n - 1)) : 0;
      return { x: cx + k * spacing, y: HAND.y + t * t * HAND.arc, r: t * HAND.tilt, scale: sc, spacing };
    }
    /** Desplazamiento lateral de la carta i cuando la j está elevada (las vecinas se apartan). */
    spreadOff(i) {
      const j = this.spreadIdx;
      if (j === null || j === undefined || i === j) return 0;
      const d = Math.abs(i - j), off = HAND.spread[d - 1] || 0;
      return Math.sign(i - j) * off;
    }

    layoutHand(dur = 200) {
      const hand = this.run.combat.hand;
      const ids = hand.map((x) => x.uid).filter((uid) => this.cards.has(uid));
      const n = ids.length;
      ids.forEach((uid, i) => {
        const obj = this.cards.get(uid);
        if (obj === this.dragging) return;
        const s = this.slot(i, n);
        obj.slotData = s; obj.slotIndex = i;
        // Mano apretada (7+): nombre a la izquierda, entero en la franja visible
        if (obj.setCompact) obj.setCompact(n >= 7 && !obj.hovered && this.selected !== uid ? s.spacing / s.scale : null);
        if (this.selected === uid || obj.hovered) return;
        obj.setDepth(LY.hand + i);
        this.tweens.add({ targets: obj, x: s.x + this.spreadOff(i), y: s.y, rotation: s.r, scale: s.scale, alpha: 1, duration: dur, ease: 'Quad.out' });
      });
    }

    hover(obj) {
      if (this.busy || this.dragging || !obj.slotData) return;
      // Nunca más de una carta elevada
      for (const o of this.cards.values()) if (o !== obj && o.hovered && this.selected !== o.cardData.uid) { o.hovered = false; hideGloss(this); }
      obj.hovered = true;
      obj.setDepth(LY.hand + 200);
      if (!obj._glow) obj._glow = A.glow(obj, 0xffe08a, 2.5);
      if (obj.setCompact) obj.setCompact(null);
      this.spreadIdx = obj.slotIndex;
      this.layoutHand(120);
      this.showPreview(obj.cardData.uid);
      this.tweens.add({ targets: obj, y: HAND.hoverY, x: obj.slotData.x, scale: HAND.hoverScale * handK(), rotation: 0, duration: 120, ease: 'Quad.out' });
      // Glosario de palabras clave (encima de la carta: debajo está el borde de la pantalla)
      showGloss(this, obj.cardData, { x: obj.slotData.x, y: HAND.hoverY, scale: HAND.hoverScale * handK() });
    }
    unhover(obj) {
      obj.hovered = false;
      if (obj._glow) { A.unglow(obj, obj._glow); obj._glow = null; }
      this.tip.hide(); hideGloss(this);
      if (!obj.slotData || obj === this.dragging) return;
      const still = [...this.cards.values()].find((o) => o.hovered || this.selected === o.cardData.uid);
      this.spreadIdx = still ? still.slotIndex : null;
      obj.setDepth(LY.hand + (obj.slotIndex || 0));
      this.layoutHand(140);
    }
    /** Quita el hover a las cartas elevadas que ya no tienen el puntero encima (ni el foco del mando). */
    clearStaleHover() {
      const p = this.input.activePointer, padObj = U.Input.device !== 'mouse' && this.padFm && this.padFm.cur && this.padFm.cur.obj;
      let changed = false;
      for (const o of this.cards.values()) {
        if (!o.hovered || this.selected === o.cardData.uid || o === padObj || o === this.dragging) continue;
        const b = o.getBounds();
        if (!(U.Input.device === 'mouse' && b.contains(p.worldX, p.worldY))) { o.hovered = false; changed = true; }
      }
      if (changed) {
        hideGloss(this);
        const still = [...this.cards.values()].find((o) => o.hovered || this.selected === o.cardData.uid);
        this.spreadIdx = still ? still.slotIndex : null;
        this.layoutHand(140);
      }
    }

    /* ---------------- Acciones del jugador ---------------- */
    tryPlay(uid) {
      if (this.busy) return;
      this.hidePreview();
      hideGloss(this); this.tip.hide();
      const check = E.canPlay(this.run, uid);
      if (!check.ok) {
        const obj = this.cards.get(uid);
        if (obj) {   // «no»: sacudida lateral corta con giro
          this.tweens.add({ targets: obj, x: obj.x + 12, duration: 50, yoyo: true, repeat: 2, ease: 'Sine.inOut' });
          this.tweens.add({ targets: obj, rotation: { from: -0.07, to: 0.07 }, duration: 50, yoyo: true, repeat: 2, ease: 'Sine.inOut' });
        }
        if (check.reason === _t('e.energia_insuficiente')) this.orbDeny();
        toast(this, check.reason, C.blood);
        Sfx.play('deny');
        this.time.delayedCall(260, () => this.layoutHand());
        return;
      }
      this.runEvents(E.playCard(this.run, uid));
    }

    /** Arrastre: la carta sigue al cursor con inercia (lerp) y se inclina según su velocidad. */
    dragFollow() {
      const o = this.dragging;
      if (!o || o._tx === undefined || U.Opts.reduceMotion) return;
      const vx = (o._tx - o.x) * 0.35, vy = (o._ty - o.y) * 0.35;
      o.x += vx; o.y += vy;
      o.rotation += (Phaser.Math.Clamp(vx * 0.012, -0.32, 0.32) - o.rotation) * 0.3;
    }
    /** Flecha curva de la carta al enemigo (Ataques de un objetivo, arrastrados o elegidos) e ilumina al apuntado. */
    updateAim() {
      const c = this.run && this.run.combat;
      let obj = this.dragging || (this.selected && this.cards.get(this.selected));
      let fi = -1;
      if (obj && c && !c.over && !this.busy && obj.cardData) {
        const card = c.hand.find((x) => x.uid === obj.cardData.uid), d = card && E.cardDef(card);
        if (d && d.type === 'attack' && E.cardTarget(card) === 'one') fi = E.isAlive(c.enemies[c.target]) ? c.target : -1;
      }
      if (fi < 0 || !this.foes[fi] || !this.foes[fi].enemy) {
        if (this.aim) this.aim.hide();
        this.setAimFoe(-1);
        return;
      }
      const f = this.foes[fi];
      const top = obj.y - (U.CARD_H * obj.scaleY) / 2 + 8;
      this.aim.draw(obj.x, top, f.eRestX, f.eY - 10, C.flame);
      this.setAimFoe(fi);
    }
    setAimFoe(fi) {
      if (fi === this.aimFoe) return;
      const old = this.foes[this.aimFoe];
      if (old && old.enemy && this.aimFx) A.unglow(old.enemy, this.aimFx);
      this.aimFx = null; this.aimFoe = fi;
      const f = this.foes[fi];
      if (f && f.enemy) this.aimFx = A.glow(f.enemy, C.flame, 3.5);   // el apuntado se ilumina
    }

    /** Sin Energía: el orbe parpadea en rojo (3 veces) y tiembla un poco. */
    orbDeny() {
      const { x, y } = this.orbXY || { x: 96, y: 600 };
      if (this.orbRed) { this.tweens.killTweensOf(this.orbRed); this.orbRed.destroy(); }
      const r = this.orbRed = this.add.circle(x, y, 48, C.blood, 0).setDepth(LY.units + 4).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: r, fillAlpha: { from: 0, to: 0.75 }, duration: 90, yoyo: true, repeat: 2, onComplete: () => { r.destroy(); if (this.orbRed === r) this.orbRed = null; } });
      this.energyT.setColor(U.hex(C.blood));
      this.time.delayedCall(560, () => { if (this.energyT && this.energyT.scene) this.energyT.setColor(U.hex(C.parch)); });
      if (!U.Opts.reduceMotion) this.tweens.add({ targets: [this.energyOrb, this.energyT, this.gemBox], x: '+=5', duration: 45, yoyo: true, repeat: 2, ease: 'Sine.inOut' });
    }

    /** Poción en combate: el frasco vuela al mago, se rompe y el motor aplica el efecto (con sus animaciones). */
    async usePotion(slot, x, y) {
      if (this.busy) { toast(this, _t('s.espera_a_que_termine_la'), C.blood); Sfx.play('deny'); return; }
      const check = E.canUsePotion(this.run, slot);
      if (!check.ok) { toast(this, check.reason, C.blood); Sfx.play('deny'); return; }
      const id = this.run.potions[slot];
      this.busy = true; this.endBtn.setEnabled(false); this.tip.hide();
      this.run.potions[slot] = null; this.hud.refresh(); this.run.potions[slot] = id;   // el hueco se vacía mientras vuela
      await U.flyPotion(this, id, x, y, this.pX, this.pY - 40);
      this.busy = false;
      this.runEvents(E.usePotion(this.run, slot));
    }

    onEndTurn() {
      const c = this.run.combat;
      if (this.busy || !c || c.over || c.phase !== 'player') return;
      // Aviso: con energía y alguna carta jugable, pide un segundo clic (opción en ⚙)
      const now = Date.now();
      if (U.Opts.endWarn && c.player.energy > 0 && now > this.endArmed && c.hand.some((x) => E.canPlay(this.run, x.uid).ok)) {
        this.endArmed = now + 2500;
        this.endBtn.setLabel(_t('s.seguro'));
        this.endWarnT.setText(_t('s.te_queda_energia')).setVisible(true);
        this.tweens.add({ targets: this.endBtn, x: { from: this.endBtn.x - 8, to: this.endBtn.x }, duration: 60, repeat: 4, yoyo: false, ease: 'Sine.inOut',
          onComplete: () => this.endBtn.setX(1150) });
        Sfx.play('deny');
        clearTimeout(this.endWarnTimer);
        this.endWarnTimer = setTimeout(() => { if (this.endBtn && this.endBtn.scene) { this.endBtn.setLabel(_t('s.terminar_turno')); this.endWarnT.setVisible(false); } }, 2500);
        return;
      }
      this.endArmed = 0;
      clearTimeout(this.endWarnTimer);
      this.endBtn.setLabel(_t('s.terminar_turno')); this.endWarnT.setVisible(false);
      this.deselect();
      this.selected = null;
      this.runEvents(E.endTurn(this.run));
    }

    /* ---------------- Cola de animaciones ---------------- */
    async runEvents(events) {
      if (events.some((e) => e.t === 'play')) this.cardPlayed = true;   // para el consejo «fin»
      for (const e of events) {   // Compendio (en memoria; se guarda al acabar el combate)
        if (e.t === 'play') Codex.add('cards', e.id, 'played');
        else if (e.t === 'potion' || (e.t === 'revive' && e.potion)) Codex.add('potions', e.id || e.potion, 'used');
        else if (e.t === 'draw') { const cd = this.run.combat && this.run.combat.hand.find((x) => x.uid === e.uid); if (cd) Codex.see('cards', cd.id); }
      }
      this.busy = true;
      this.endBtn.setEnabled(false);
      this.tip.hide();
      this.smallFireDone = false;
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        // Grupos: golpes seguidos a enemigos distintos (cartas de área) se animan a la vez
        // (un Rayo de área llega como zap + golpe por enemigo: se agrupan igual)
        if (ev.t === 'zap' && !ev.jump && this.foes.length > 1 && events[i + 1] && events[i + 1].t === 'hitEnemy' && events.slice(i + 2).some((x) => x.t === 'zap' && !x.jump && x.ei !== ev.ei)) {
          const wave = [], zaps = []; let j = i;
          while (events[j] && (events[j].t === 'log' || (events[j].t === 'zap' && !events[j].jump && !zaps.some((z) => z.ei === events[j].ei)) || (events[j].t === 'hitEnemy' && !events[j].jump && events[j].sid === undefined && !wave.some((w) => w.ei === events[j].ei)))) {
            if (events[j].t === 'zap') zaps.push(events[j]); else if (events[j].t === 'hitEnemy') wave.push(events[j]); j++;
          }
          if (wave.length > 1) {
            for (let k = i; k < j; k++) if (events[k].t === 'log') await this.animate(events[k]);
            const o = this.boltFrom(); zaps.forEach((z) => { const t = this.foePos(z.ei); U.Fx.zap(this, o.x, o.y, t.x, t.y); });
            Sfx.play('ice_chill', { volume: 0.35 });
            try { await this.hitWave(wave); } catch (err) { console.error('[Carticas] wave', err); }
            i = j - 1; continue;
          }
        }
        if (ev.t === 'hitEnemy' && ev.sid === undefined && this.foes.length > 1) {
          const wave = [ev]; let j = i + 1;
          while (events[j] && (events[j].t === 'log' || (events[j].t === 'zap' && !events[j].jump) || (events[j].t === 'hitEnemy' && events[j].sid === undefined && !events[j].jump && !wave.some((w) => w.ei === events[j].ei)))) { if (events[j].t === 'hitEnemy') wave.push(events[j]); j++; }
          if (wave.length > 1) {
            for (let k = i; k < j; k++) if (events[k].t === 'log') await this.animate(events[k]);
            try { await this.hitWave(wave); } catch (err) { console.error('[Carticas] wave', err); }
            i = j - 1; continue;
          }
        }
        if (ev.t !== 'log') {   // golpes seguidos del mismo tipo = ráfaga (ritmo creciente y mini hit-stop)
          this.hitStreak = (ev.t === 'hitEnemy' || ev.t === 'hitPlayer') && this.lastAnimT === ev.t ? this.hitStreak + 1 : 0;
          this.lastAnimT = ev.t;
        }
        this.evAhead = events.slice(i + 1);   // para elegir el sonido de una carta según su golpe
        let n = i + 1; while (events[n] && events[n].t === 'log') n++;   // los 'log' no cuentan como siguiente
        const next = events[n];
        // 'temp' + 'chill' y 'burnSet' + 'douse' se animan como un solo efecto (el segundo trae todo)
        if (next && ((ev.t === 'temp' && next.t === 'chill') || (ev.t === 'burnSet' && next.t === 'douse'))) continue;
        try { await this.animate(ev); } catch (err) { console.error('[Carticas] anim', ev, err); }
      }
      this.busy = false;
      this.lastAnimT = null; this.hitStreak = 0;
      if (this.turbo) this.setTurbo(false);
      this.sync();
      U.saveRun(this.run);
      const c = this.run.combat;
      if (c && c.over) this.finish(c.over);
      else this.endBtn.setEnabled(true);
      if (c && !c.over && c.choice) this.openRuneChoice();   // Inscribir+
      this.clearStaleHover();
    }

    /** Varios enemigos golpeados a la vez (área): un solo hit-stop y cada uno con su impacto, número y barra. */
    async hitWave(wave) {
      Sfx.play('hit');
      const big = Math.max(...wave.map((w) => w.amount));
      if (big > 0) await this.hitStop(this.foes[wave[0].ei].enemy, big);
      for (const ev of wave) {
        this.foeIdx = this.animFoe = ev.ei;
        this.hurt(this.enemy, this.enemyBaseScale, ev.amount, ev.amount <= 0);
        if (ev.amount > 0) popNumber(this, this.eRestX + 20, this.eY - 10, ev.amount, 'hit', 1);
        if (ev.blocked > 0) popNumber(this, this.eRestX - 50, this.eY + 10, ev.blocked, 'block', -1);
        U.Fx.hit(this, this.eRestX, this.eY, ev.amount >= 20 ? C.gold : C.flame, ev.amount >= 20);
        this.eBar.set(ev.hp, this.fe.maxHp, ev.block); this.eBlock.set(ev.block); this.updateShield(ev.block);
      }
      this.shakeFor(big);
      await wait(this, 260);
    }

    async animate(ev) {
      const c = this.run.combat;
      // Grupos: cada evento anima al enemigo al que se refiere (ev.ei)
      if (c && ev.ei !== undefined && this.foes[ev.ei]) this.foeIdx = this.animFoe = ev.ei;
      switch (ev.t) {
        case 'log': this.logLines.push(ev.text); this.logLines = this.logLines.slice(-10); this.renderLog(); return;
        case 'turn':
          if (ev.who === 'player') { this.enemyPhase = false; this.setTurbo(false); } else this.enemyPhase = true;
          if (ev.who === 'player' && ev.turn === 1 && c && c.kind === 'boss') { Sfx.play('turn'); this.introing = true; try { await this.bossIntro(); } finally { this.introing = false; } this.bossQuips('start'); }   // presentación del jefe y su frase
          else if (ev.who === 'player' && ev.turn === 1 && c && c.enemies.some((x) => x.id === 'archimago')) this.bossQuips('start');   // el Archimago Caído (élite) también habla
          else if (ev.who === 'player') { Sfx.play('turn'); this.turnBanner(ev.turn === 1 ? _t('s.combate') : _t('s.tu_turno'), C.gold); await wait(this, 120); }
          else { this.turnBanner(_t('s.turno_enemigo'), C.blood); await wait(this, 160); }
          return;
        case 'energy': this.setEnergy(ev.energy, true); return;
        case 'draw': {   // sale del mazo girando y aterriza en su sitio; una cada 70 ms
          const card = c.hand.find((x) => x.uid === ev.uid) || c.discard.find((x) => x.uid === ev.uid) || c.exhaust.find((x) => x.uid === ev.uid);
          if (card && !this.cards.has(ev.uid)) { const o = this.makeCard(card, 44, 676); if (!U.Opts.reduceMotion) o.setRotation(-1.4); }
          this.layoutHand(260);
          Sfx.play('card');
          await wait(this, 70);
          return;
        }
        case 'shuffle': {   // el descarte salta al mazo en cascada
          floatText(this, 120, 600, _t('s.barajas_el_descarte'), C.muted, 18);
          const n = U.Live.room(U.Opts.reduceMotion ? 3 : 8);
          for (let i = 0; i < n; i++) {
            const b = U.Pool.image(this, 1236, 676, U.cardBackKey(this)).setScale(0.5).setDepth(LY.hand + 450).setAngle(8);
            const o = { t: 0 }, x0 = 1236, x1 = 44, my = 470 - Math.random() * 40;
            this.tweens.add({ targets: o, t: 1, duration: 360, delay: i * 40, ease: 'Sine.inOut',
              onUpdate: () => { const t = o.t; b.setPosition(x0 + (x1 - x0) * t, (1 - t) * (1 - t) * 676 + 2 * (1 - t) * t * my + t * t * 676).setAngle(8 - 380 * t); },
              onComplete: () => b.destroy() });
          }
          Sfx.play('card', { volume: 0.5 });
          await wait(this, 220 + n * 40);
          return;
        }
        case 'play': {
          const obj = this.cards.get(ev.uid);
          this.cards.delete(ev.uid);
          if (!obj) return;
          obj.hovered = false;
          obj.disableInteractive();
          this.playing = obj;
          obj.setDepth(LY.hand + 400);
          this.layoutHand(180);
          Sfx.play('card');
          this.smallFireDone = false;
          this.playCardSfx(ev);
          if (ev.combo) this.setCombo(ev.combo);
          await tw(this, { targets: obj, x: 640, y: 300, scale: 1.08, rotation: 0, duration: 150, ease: 'Quad.out' });
          // Disparada hacia el objetivo (ataque → enemigo; resto → el mago) dejando estela del color de la carta
          const atk = ev.type === 'attack', tx = atk ? this.eRestX - 30 : this.pX + 20, ty = (atk ? this.eY : this.pY) - 20;
          const col = U.cardColor({ id: ev.id }, D.CARDS[ev.id]);
          if (atk) A.lunge(this, this.mage, this.mageBaseScale, this.pX, 1, 34, this.mageIdle);
          else { A.castGlow(this, this.pX + 70, this.pY - 60, col); if (!U.Opts.reduceMotion) this.tweens.add({ targets: this.mage, angle: 5, duration: 120, yoyo: true, ease: 'Quad.out' }); }   // se inclina hacia delante
          this.casterGlow();
          if (atk && D.CARDS[ev.id].class === 'piromago') U.Fx.cast(this, this.pX + 70, this.pY - 60, tx, ty, C.flame, 220);
          let n = 0;
          await tw(this, { targets: obj, x: tx, y: ty, scale: 0.32, rotation: atk ? 0.5 : -0.4, duration: 190, ease: 'Quad.in',
            onUpdate: () => {
              if (n++ % 1) return;
              const d = this.add.image(obj.x, obj.y, 'dot').setTint(col).setScale(1.1).setAlpha(0.8).setDepth(LY.hand + 399).setBlendMode(Phaser.BlendModes.ADD);
              this.tweens.add({ targets: d, alpha: 0, scale: 0.2, duration: 280, onComplete: () => d.destroy() });
            } });
          // «Punch» de escala y se deshace en partículas del color de su tipo (ataque rojo, habilidad azul, poder dorado)
          await tw(this, { targets: obj, scale: 0.44, duration: 60, ease: 'Quad.out' });
          FL.cardDissolve(this, obj.x, obj.y, D.CARDS[ev.id].type);
          obj.setVisible(false);   // la carta «se gasta» al impactar
          return;
        }
        case 'discard':
        case 'exhaust': {
          const obj = this.playing;
          this.playing = null;
          if (!obj) return;
          if (!obj.visible) { if (ev.t === 'exhaust') burst(this, obj.x, obj.y, C.arcane, 16, 90); obj.destroy(); await wait(this, 40); return; }
          if (ev.t === 'discard') {
            this.tweens.add({ targets: obj, x: 1236, y: 676, scale: 0.2, alpha: 0.4, rotation: 0.4, duration: 260, ease: 'Quad.in', onComplete: () => obj.destroy() });
          } else {
            burst(this, obj.x, obj.y, C.arcane, 16, 90);
            this.tweens.add({ targets: obj, y: obj.y - 60, alpha: 0, scale: 0.8, duration: 320, onComplete: () => obj.destroy() });
          }
          await wait(this, 120);
          return;
        }
        case 'discardHand': {
          // Solo vuelan al descarte las que no se Conservan
          const objs = ev.uids.map((uid) => this.cards.get(uid)).filter(Boolean);
          ev.uids.forEach((uid) => this.cards.delete(uid));
          const mid = (objs.length - 1) / 2;
          objs.forEach((obj, i) => {   // en abanico: se abren un poco, giran y vuelan a la pila
            obj.disableInteractive();
            const o = { t: 0 }, x0 = obj.x, y0 = obj.y, r0 = obj.rotation, s0 = obj.scale, my = 470 - Math.abs(i - mid) * 10, rot = (i - mid) * 0.18;
            this.tweens.add({ targets: o, t: 1, duration: 320, delay: i * 35, ease: 'Quad.in',
              onUpdate: () => { const t = o.t, u = 1 - t; obj.setPosition(u * u * x0 + 2 * u * t * (x0 + (1236 - x0) * 0.4) + t * t * 1236, u * u * y0 + 2 * u * t * my + t * t * 676)
                .setRotation(r0 + (U.Opts.reduceMotion ? 0 : rot + 0.6 * t)).setScale(s0 + (0.2 - s0) * t).setAlpha(1 - 0.7 * t); },
              onComplete: () => obj.destroy() });
          });
          await wait(this, 300 + objs.length * 35);
          return;
        }
        case 'hitEnemy': {
          Sfx.play('hit');
          if (ev.sid !== undefined && ev.amount > 0) {   // golpe de una criatura: impacto verde y sin hit-stop si es flojo
            if (ev.amount >= 10) await this.hitStop(this.enemy, ev.amount);
            this.hurt(this.enemy, this.enemyBaseScale, ev.amount, false);
            popNumber(this, this.eRestX + 20, this.eY - 10, ev.amount, 'hit', 1);
            U.Fx.hit(this, this.eRestX - 20, this.eY, SUM_COL, ev.amount >= 20);
            this.eBar.set(ev.hp, this.fe.maxHp, ev.block); this.eBlock.set(ev.block); this.updateShield(ev.block);
            this.shakeFor(ev.amount * 0.6);
            await wait(this, 150);
            return;
          }
          if (ev.amount > 0) await this.hitStop(this.enemy, ev.amount);
          this.hurt(this.enemy, this.enemyBaseScale, ev.amount, true);
          if (ev.amount > 0) popNumber(this, this.eRestX + 20 + (this.hitStreak % 2 ? -26 : 0), this.eY - 10 - Math.min(this.hitStreak, 4) * 8, ev.amount, 'hit', this.hitStreak % 2 ? -1 : 1);
          if (ev.blocked > 0) popNumber(this, this.eRestX - 50, this.eY + 10, ev.blocked, 'block', -1);
          this.blockFeedback(this.eRestX, this.eY, ev.blocked, ev.amount, ev.block);
          U.Fx.hit(this, this.eRestX, this.eY, ev.amount >= 20 ? C.gold : C.flame, ev.amount >= 20);
          if (ev.amount >= 20) { A.bloom(this, 0.7, 320); U.vibrate(Math.min(1, 0.45 + ev.amount / 60), 90 + Math.min(ev.amount, 40) * 3); }
          this.eBar.set(ev.hp, this.fe.maxHp, ev.block);
          this.eBlock.set(ev.block);
          this.updateShield(ev.block);
          this.shakeFor(ev.amount);
          await wait(this, Math.max(105, 200 - 32 * this.hitStreak));   // golpes múltiples: cada vez más rápido
          return;
        }
        case 'hitPlayer': {
          if (ev.amount > 0) await this.hitStop(this.mage, ev.amount);
          this.hurt(this.mage, this.mageBaseScale, ev.amount, false);
          if (ev.amount > 0) {
            U.Fx.hit(this, this.pX, this.pY, C.blood, ev.amount >= 20);
            if (ev.amount >= 20) A.bloom(this, 0.6, 320);
            popNumber(this, this.pX + 20 + (this.hitStreak % 2 ? 30 : 0), this.pY - 100 - Math.min(this.hitStreak, 4) * 8, ev.amount, 'hit', this.hitStreak % 2 ? 1 : -1);
            if (!U.Opts.reduceMotion) { this.redFlash.setAlpha(0.22); this.tweens.add({ targets: this.redFlash, alpha: 0, duration: 320 }); }
            this.shakeFor(ev.amount);
            U.vibrate(Math.min(1, 0.3 + ev.amount / 40), 80 + Math.min(ev.amount, 40) * 4);   // recibir daño
          }
          this.blockFeedback(this.pX, this.pY - 30, ev.blocked, ev.amount, ev.block);
          const absorbed = (ev.blocked || 0) - (ev.iced || 0);   // blocked incluye lo que absorbió el hielo
          if (absorbed > 0) popNumber(this, this.pX + 60, this.pY - 50, absorbed, 'block', 1);
          if (ev.iced > 0) { this.shards(this.pIce.x, this.pIce.y, 6, 50); popNumber(this, this.pX - 110, this.pY - 110, ev.iced, 'ice', -1, _t('s.hielo_0', { 0: ev.iced })); }
          this.pBar.set(ev.hp, this.run.maxHp, ev.block);
          this.pBlock.set(ev.block);
          this.setIce(ev.ice);
          this.hud.refresh();
          Sfx.play(ev.amount > 0 ? 'hurt' : 'block');
          await wait(this, Math.max(120, 240 - 35 * this.hitStreak));
          return;
        }
        case 'blockPlayer':
          floatText(this, this.pX, this.pY - 60, _t('s.0_bloqueo', { 0: ev.amount }), C.frost, 26);
          if (ev.amount > 0) U.Fx.block(this, this.pX, this.pY);
          this.pBlock.set(ev.block); this.pBar.set(this.run.hp, this.run.maxHp, ev.block, false);
          Sfx.play('block');
          await wait(this, 180);
          return;
        case 'blockEnemy':
          floatText(this, this.eX, this.eY - 70, _t('s.0_bloqueo', { 0: ev.amount }), C.frost, 26);
          this.eBlock.set(ev.block);
          this.updateShield(ev.block);
          Sfx.play('block');
          await wait(this, 200);
          return;
        case 'burn':
          floatText(this, this.eX - 20, this.eY - 120, _t('s.0_quemadura', { 0: ev.amount }), C.ember, 26);
          U.Fx.burn(this, this.eRestX, this.eY + 20);
          this.refreshStatuses({ burn: ev.burn });
          Sfx.play('fire_burn');   // respaldo: 'burn' sintetizado
          await wait(this, 170);
          return;
        case 'burnSet': this.refreshStatuses({ burn: ev.burn }); return;
        /* ---- Guardiana ---- */
        case 'engrave': {
          this.drawRunes(ev.runes);
          const o = this.runeObjs[ev.runes.length - 1];
          if (o) { o.setIconScale(1.5).setAlpha(0.2); this.tweens.add({ targets: o, scale: 0.66 * U.icK(o), alpha: 1, duration: 260, ease: 'Back.out' }); burst(this, o.x, o.y, U.RUNE_COL[ev.id], 10, 40); }
          Sfx.play('block');
          await wait(this, 200);
          return;
        }
        case 'detonate':
          this.runeBlastFx(ev.idx, ev.id);
          Sfx.play('fire_big');
          floatText(this, this.pX, this.pY - 150, _t('s.runa_de_0_2', { 0: D.RUNES[ev.id].name }), U.RUNE_COL[ev.id], 24);
          await wait(this, 160);
          this.drawRunes(ev.runes);
          await wait(this, 120);
          return;
        case 'runePulse':
          this.runePulseFx(ev.idx, ev.id);
          await wait(this, 150);
          return;
        case 'runeDraw': return;
        /* ---- Afijos ---- */
        /* ---- Pasivas de jefe (Parche 2.9) ---- */
        case 'shatter':   // Titán: pierde la coraza para siempre
          floatText(this, this.eX, this.eY - 110, _t('fx.shatter'), 0x9fd6ff, 30);
          this.eBlock.set(0); this.updateShield(0); this.eBar.set(this.fe.hp, this.fe.maxHp, 0);
          burst(this, this.eX, this.eY, 0xbfe6ff, 18, 90);
          this.refreshStatuses();
          Sfx.play('block', { volume: 0.5 });
          await wait(this, 300);
          return;
        case 'enemyRevive':   // Archiliche: se levanta con parte de su vida
          this.enemy.setAlpha(1);
          popNumber(this, this.eRestX - 30, this.eY - 40, ev.hp, 'heal', -1);
          burst(this, this.eX, this.eY, 0xd2a8ff, 22, 110);
          this.eBar.set(ev.hp, this.fe.maxHp, 0); this.eBlock.set(0); this.updateShield(0);
          this.refreshStatuses();
          await wait(this, 260);
          return;
        case 'passive':   // Lobo Alfa / Devorador: +Fuerza
          floatText(this, this.eX + 40, this.eY - 140, _t(ev.id === 'devour' ? 'fx.devour' : 'fx.grow', { n: ev.n }), ev.id === 'devour' ? 0xff8ad8 : 0xff9a7a, 22);
          await wait(this, ev.id === 'devour' ? 120 : 200);
          return;
        case 'enemyHeal':
          popNumber(this, this.eRestX - 30, this.eY - 40, ev.amount, 'heal', -1);
          burst(this, this.eX, this.eY, ev.why === 'vampirico' ? 0xc0283c : C.leaf, 12, 60);
          this.eBar.set(ev.hp, this.fe.maxHp, this.fe.block);
          await wait(this, 220);
          return;
        case 'affix':
          floatText(this, this.eX, this.eY - 130, _t('aff.float', { a: D.AFFIXES[ev.id].name }), D.AFFIXES[ev.id].color, 28);
          await wait(this, 260);
          return;
        case 'runePower':   // Palabra de Poder
          floatText(this, this.pX, this.pY - 150, _t('s.runePowerUp', { n: ev.amount }), 0xf0cf7a, 24);
          this.drawRunes();
          await wait(this, 260);
          return;
        case 'coffin':      // Ataúd de Hielo: sigue Congelado
          floatText(this, this.eX, this.eY - 110, _t('s.coffinHold'), 0xbfe3ff, 26);
          this.refreshStatuses(); await wait(this, 260);
          return;
        case 'runeChill':
          floatText(this, this.pX, this.pY - 150, _t('s.el_frio_entumece_tus_runas'), 0x9fdcff, 22);
          this.drawRunes();
          this.sawChill = true;
          await wait(this, 300);
          return;
        case 'choice': return;
        case 'choiceDone': return;
        /* ---- Criomante ---- */
        case 'frost':
          floatText(this, this.eX + 10, this.eY - 120, _t('s.0_escarcha', { 0: ev.amount }), 0x9fdcff, 26);
          this.shards(this.eX, this.eY - 20, 6, 70);
          this.refreshStatuses({ frost: ev.frost });
          Sfx.play('ice_chill');
          await wait(this, 170);
          return;
        case 'frostSet': this.refreshStatuses({ frost: ev.frost }); return;
        case 'freeze': {
          this.sawFreeze = true;   // consejo «congelado»
          this.frozeAt = performance.now();
          const flash = this.add.circle(this.eX, this.eY, 160, 0xcfeaff, 0.5).setDepth(LY.fx + 550).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: flash, alpha: 0, scale: 1.4, duration: 420, onComplete: () => flash.destroy() });
          this.shards(this.eX, this.eY, 14, 160);
          U.Fx.freeze(this, this.eX, this.eY);
          banner(this, _t('s.congelado_2'), 0x8fd4ff, 800);
          Sfx.play('ice_freeze');
          this.refreshStatuses({ frost: 0 });
          this.updateFreezeFx();
          this.refreshIntent();
          await wait(this, 700);
          return;
        }
        case 'stunEnd': floatText(this, this.eX, this.eY - 120, _t('s.aturdido_pierde_su_accion'), C.gold, 24); this.refreshStatuses(); await wait(this, 260); return;   // Amuleto del Fénix
        case 'noDefense': floatText(this, this.pX, this.pY - 110, _t('s.expuesto'), C.frost, 22); return;                            // Corazón de Hielo
        case 'thaw':
          // El hielo se rompe: el enemigo pierde este turno y vuelve a actuar en el siguiente
          this.shake(260, 0.012);
          this.shards(this.eX, this.eY, 16, 190);
          burst(this, this.eX, this.eY, 0xffffff, 16, 140);
          floatText(this, this.eX, this.eY - 110, _t('s.pierde_el_turno'), 0xbfe3ff, 28);
          Sfx.play('ice_shatter');
          this.updateFreezeFx();
          this.refreshStatuses();
          await wait(this, 520);
          return;
        case 'shatter': {
          // Fragmentar: esquirlas que vuelan desde el mago hasta el enemigo
          for (let i = 0; i < 10; i++) {
            const sh = this.add.image(this.pX + 40, this.pY - 30 + (i % 5) * 12, 'ic_shard').setIconScale(0.3).setTint(0xdff3ff).setDepth(LY.fx + 600);
            sh.setRotation(Math.PI / 2);
            this.tweens.add({ targets: sh, x: this.eX + Phaser.Math.Between(-40, 40), y: this.eY + Phaser.Math.Between(-60, 40), delay: i * 22, duration: 230, ease: 'Quad.in', onComplete: () => sh.destroy() });
          }
          await wait(this, 300);
          this.shards(this.eX, this.eY, 12, 130);
          Sfx.play('ice_shatter');
          return;
        }
        case 'ice':
          floatText(this, this.pX - 40, this.pY - 70, _t('s.0_escudo_de_hielo', { 0: ev.amount }), 0x9fdcff, 24);
          this.setIce(ev.ice);
          this.tweens.add({ targets: this.pIce, scale: { from: 1.35, to: 1 }, duration: 240, ease: 'Back.out' });
          Sfx.play('block');
          await wait(this, 180);
          return;
        case 'iceMelt':
          if (ev.amount > 0) floatText(this, this.pIce.x, this.pIce.y - 30, `−${ev.amount}`, 0x9fdcff, 20);
          this.setIce(ev.ice);
          await wait(this, 120);
          return;
        case 'chillIce':
          floatText(this, this.pX, this.pY - 130, _t('s.el_frio_te_fortalece'), 0xbfe3ff, 24);
          this.shards(this.pX, this.pY, 8, 70);
          Sfx.play('ice_chill');
          this.sawChill = true;
          await wait(this, 300);
          return;
        /* ---- Acto II ---- */
        case 'chill': {
          // El indicador de Temperatura (primero de la fila) parpadea en azul y suelta cristales
          this.chillAt = performance.now();   // (arnés de pruebas: momento del efecto)
          const sx = this.pStatus.x, sy = this.pStatus.y;
          const flash = this.add.circle(sx, sy, 22, 0x7fc8ff, 0.85).setDepth(LY.fx + 550).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: flash, alpha: { from: 0.85, to: 0.1 }, duration: 130, yoyo: true, repeat: 2, onComplete: () => flash.destroy() });
          this.shards(sx, sy, 9, 80);
          floatText(this, sx + 34, sy - 26, `−${ev.amount}`, 0x8fd0ff, 40);
          this.tweens.add({ targets: this.aura, alpha: 0.06 + Math.min(ev.total, 8) * 0.03, scale: 1 + Math.min(ev.total, 8) * 0.04, duration: 300 });
          this.updateHeat(ev.total);
          this.mage.setTint(0xb8e2ff);
          this.time.delayedCall(380, () => this.mage.clearTint());
          // ice_freeze para los movimientos con frío 4+ (Congelación, Aliento Glacial, Aliento Absoluto)
          Sfx.play((this.intentChill || 0) >= 4 ? 'ice_freeze' : 'ice_chill');
          this.sawChill = true;   // consejo «frio»
          await wait(this, 420);
          this.refreshStatuses({ temp: ev.total });
          return;
        }
        case 'chillBlocked':
          floatText(this, this.pX, this.pY - 130, _t('s.0_sin_frio', { 0: ev.reason }), C.flame, 22);
          burst(this, this.pStatus.x, this.pStatus.y, C.flame, 10, 40);
          await wait(this, 260);
          return;
        case 'curse': {
          // Cartas Escalofrío que vuelan desde el enemigo hasta el descarte (o al robo: Corona de Brasas)
          const toDraw = ev.where === 'draw';
          if (!toDraw) this.curseAt = performance.now();   // (arnés de pruebas)
          const tx = toDraw ? 44 : 1236, ty = 676, label = toDraw ? this.drawT : this.discardT;
          let shown = Math.max(0, (toDraw ? c.draw.length : c.discard.length) - ev.amount);
          const fromX = toDraw ? 640 : this.eX, fromY = toDraw ? 300 : this.eY;
          Sfx.play('curse');
          const flights = [];
          for (let k = 0; k < ev.amount; k++) {
            const card = cardView(this, { uid: -1 - k, id: ev.id || 'escalofrio', up: false }, {});
            card.setPosition(fromX, fromY).setScale(0.15).setAlpha(0).setDepth(LY.fx + 700);
            const midX = (fromX + tx) / 2, midY = Math.min(fromY, ty) - 160;
            flights.push(new Promise((res) => {
              this.time.delayedCall(k * 170, () => {
                this.tweens.add({ targets: card, alpha: 1, scale: 0.5, x: midX, y: midY, rotation: 0.3, duration: 280, ease: 'Quad.out' });
                this.tweens.add({ targets: card, x: tx, y: ty, scale: 0.18, rotation: 0.9, delay: 300, duration: 300, ease: 'Quad.in',
                  onComplete: () => { card.destroy(); shown++; label.setText(String(shown)); burst(this, tx, ty, C.arcane, 8, 30); res(); } });
              });
            }));
          }
          await Promise.all(flights);
          return;
        }
        case 'curseBurned':
          floatText(this, this.pX, this.pY - 100, _t('s.linterna_escalofrio_agotado'), C.gold, 20);
          burst(this, 640, 560, C.gold, 14, 60);
          await wait(this, 200);
          return;
        case 'exhaustHand':
          floatText(this, this.pX, this.pY - 100, _t('s.0_maldicion_es_purgada_s', { 0: ev.uids.length }), C.flame, 22);
          ev.uids.forEach((uid) => {
            const obj = this.cards.get(uid);
            if (!obj) return;
            this.cards.delete(uid);
            burst(this, obj.x, obj.y, C.flame, 18, 80);
            this.tweens.add({ targets: obj, y: obj.y - 80, alpha: 0, scale: 0.7, duration: 360, onComplete: () => obj.destroy() });
          });
          Sfx.play('burn');
          await wait(this, 320);
          return;
        case 'unblock':
          floatText(this, this.eX, this.eY - 70, _t('s.0_bloqueo_2', { 0: ev.amount }), C.ember, 26);
          this.eBlock.set(0); this.eBar.set(this.fe.hp, this.fe.maxHp, 0);
          this.updateShield(0);
          Sfx.play('ice_shatter');   // Fundir rompe el Bloqueo
          await wait(this, 220);
          return;
        case 'douse': {
          // Vapor sobre el icono de Quemadura del enemigo (primero de su fila) y «−X»
          const lost = Math.max(0, (this.shownBurn || 0) - ev.burn);
          const sx = this.eStatus.x, sy = this.eStatus.y;
          for (let k = 0; k < 10; k++) {
            const puff = this.add.image(sx + (Math.random() - 0.5) * 24, sy, 'dot').setTint(0xdfe8ee).setAlpha(0.7).setScale(0.6 + Math.random() * 0.5).setDepth(LY.fx + 600);
            this.tweens.add({ targets: puff, y: sy - 50 - Math.random() * 40, x: puff.x + (Math.random() - 0.5) * 40, scale: 2 + Math.random(), alpha: 0,
              delay: k * 45, duration: 700 + Math.random() * 300, ease: 'Quad.out', onComplete: () => puff.destroy() });
          }
          if (lost > 0) floatText(this, sx + 30, sy - 30, `−${lost}`, 0x8fd0ff, 38);
          floatText(this, this.eX, this.eY - 120, _t('s.deshielo'), C.frost, 22);
          Sfx.play('steam');
          await wait(this, 420);
          this.refreshStatuses({ burn: ev.burn });
          return;
        }
        case 'burnTick':
          U.Fx.burn(this, this.eRestX, this.eY);
          if (!U.Fx.ok(this)) burst(this, this.eX, this.eY - 30, C.flame, 14, 70);
          popNumber(this, this.eRestX + 30, this.eY - 30, ev.amount, 'burn', 1);
          this.eBar.set(ev.hp, this.fe.maxHp, this.fe.block);
          this.refreshStatuses({ burn: ev.burn });
          this.hurt(this.enemy, this.enemyBaseScale, ev.amount);
          this.shakeFor(Math.floor(ev.amount / 2));
          Sfx.play('fire_tick', { volume: 0.6 });
          await wait(this, 420);
          return;
        case 'temp':
          if (ev.delta > 0 && !this.smallFireDone) { this.smallFireDone = true; Sfx.play('fire_small', { volume: 0.5 }); }
          floatText(this, this.pX, this.pY - 130, _t('s.0_1_temperatura', { 0: ev.delta > 0 ? '+' : '−', 1: Math.abs(ev.delta) }), C.flame, 24);
          this.refreshStatuses({ temp: ev.total });
          this.tweens.add({ targets: this.aura, alpha: 0.06 + Math.min(ev.total, 8) * 0.03, scale: 1 + Math.min(ev.total, 8) * 0.04, duration: 300 });
          await wait(this, 140);
          return;
        case 'status': {
          const labels = { vinculo: _t('s.vinculo'), weak: _t('s.debil'), str: _t('s.fuerza'), furia: _t('s.furia_ardiente'), fenix: _t('s.corazon_de_fenix'), eterna: _t('s.ascuas_eternas'), sol: _t('s.sol_interior'), thorns: _t('s.muro_de_llamas'), hoguera: _t('s.hoguera_interior'), volcan: _t('s.corazon_de_volcan'), fury: _t('s.furia_volcanica_2') };
          if (ev.value > 0 && labels[ev.key]) {
            const isP = ev.who === 'player';
            floatText(this, isP ? this.pX : this.eX, (isP ? this.pY : this.eY) - 120, labels[ev.key] + (ev.key === 'str' || ev.key === 'vinculo' ? ` ${ev.value}` : ''), ev.key === 'weak' ? 0xb7a8e6 : C.arcane, 24);
          }
          this.refreshStatuses();
          await wait(this, 160);
          return;
        }
        case 'selfDamage':
          popNumber(this, this.pX + 20, this.pY - 100, ev.amount, 'burn', -1);
          floatText(this, this.pX - 10, this.pY - 40, ev.reason, C.flame, 20);
          burst(this, this.pX, this.pY, C.ember, 14, 60);
          this.pBar.set(ev.hp, this.run.maxHp, c.player.block);
          this.hud.refresh();
          Sfx.play(ev.reason === _t('s.sobrecalentamiento') ? 'overheat' : 'hurt');
          await wait(this, 320);
          return;
        case 'enemyMove': {
          const t = T(this, this.eX, this.eY - 100, ev.name, { size: 28, font: 'display', color: C.parch, stroke: 0x000000, strokeThickness: 5 }).setDepth(LY.fx + 1000);
          this.tweens.add({ targets: t, alpha: 0, y: t.y - 20, delay: 600, duration: 300, onComplete: () => t.destroy() });
          if (this.lastIntentKind === 'attack' || ev.unleash) await A.lunge(this, this.enemy, this.enemyBaseScale, this.eRestX, -1, 90, this.enemyIdle);
          else { this.enemyIdle.pause(); await tw(this, { targets: this.enemy, scale: this.enemyBaseScale * 1.08, duration: 160, yoyo: true }); this.enemyIdle.resume(); }
          this.intent.setAlpha(0.25);
          return;
        }
        case 'intent': this.refreshIntent(); return;
        // ---------- Acto III ----------
        case 'drain':
          floatText(this, this.pX, this.pY - 130, _t('s.drenar_0_energia', { 0: ev.amount }), 0x7fa0ff, 26);
          U.Fx.hit(this, this.energyOrb ? 96 : this.pX, this.energyOrb ? 600 : this.pY, 0x5f8cff, false);
          Sfx.play('ice_chill', { volume: 0.4 });
          await wait(this, 260);
          return;
        case 'drained':
          floatText(this, 96, 520, _t('s.0_energia', { 0: ev.amount }), 0x7fa0ff, 24);
          return;
        case 'silenceNext':
          floatText(this, this.pX, this.pY - 130, _t('s.silencio_0', { 0: ev.amount }), 0xc9a8ff, 26);
          Sfx.play('deny', { volume: 0.5 });
          await wait(this, 240);
          return;
        case 'silence': {
          this.sync();
          for (const uid of ev.uids || []) { const o = this.cards.get(uid); if (o) burst(this, o.x, o.y - 30, 0xb27bff, 10, 50); }
          Sfx.play('deny', { volume: 0.5 });
          await wait(this, 260);
          return;
        }
        case 'reflectGain':
          floatText(this, this.eX, this.eY - 130, _t('s.reflejo_0', { 0: ev.charges }), 0xd8b8ff, 28);
          U.Fx.block(this, this.eX, this.eY);
          this.refreshStatuses();
          await wait(this, 240);
          return;
        case 'reflect': {
          this.refreshStatuses();
          if (ev.amount > 0) {
            const sv = ev.sid !== undefined && this.sumViews && this.sumViews.get(ev.sid);   // a la criatura que golpeó
            const tx = sv ? sv.x : this.pX + 40, ty = sv ? GROUND - sv.h / 2 : this.pY - 40;
            const shard = this.add.image(this.eX - 60, this.eY - 20, 'ic_mirror').setDepth(LY.fx + 600).setIconScale(0.6);
            await tw(this, { targets: shard, x: tx, y: ty, rotation: 6, duration: 260, ease: 'Quad.in' });
            shard.destroy();
            floatText(this, sv ? sv.x : this.pX, sv ? ty - 70 : this.pY - 150, _t('s.reflejo'), 0xd8b8ff, 24);
          }
          return;
        }
        case 'charge':
          this.refreshStatuses();
          if (ev.start) floatText(this, this.eX, this.eY - 130, _t('s.carga_arcana_2'), 0xc9a8ff, 28);
          this.tweens.add({ targets: this.enemy, scale: this.enemyBaseScale * 1.05, duration: 200, yoyo: true });
          U.Fx.burn(this, this.eRestX, this.eY, 0xb27bff);
          await wait(this, 260);
          return;
        case 'interrupt':
          banner(this, ev.why === 'freeze' ? _t('s.el_hielo_rompe_la_carga') : _t('s.carga_interrumpida'), ev.why === 'freeze' ? 0x9fdcff : 0xc9a8ff, 900);
          this.shake(260, 0.006);
          this.refreshStatuses();
          await wait(this, 700);
          return;
        case 'prisma':
          floatText(this, this.pX, this.pY - 130, _t('s.prisma_arcano_0_anulado', { 0: ev.what }), 0xe0c8ff, 24);
          await wait(this, 240);
          return;
        case 'inkDrain': {
          const o = this.cards.get(ev.uid);
          floatText(this, o ? o.x : 640, (o ? o.y : 600) - 140, _t('s.garabato_1_energia'), 0xc9a8ff, 22);
          return;
        }
        case 'inkExhaust': {   // el Garabato se Agota nada más robarlo
          const obj = this.cards.get(ev.uid);
          if (obj) {
            this.cards.delete(ev.uid);
            burst(this, obj.x, obj.y, 0xc9a8ff, 12, 60);
            this.tweens.add({ targets: obj, y: obj.y - 80, alpha: 0, scale: 0.7, duration: 320, onComplete: () => obj.destroy() });
            this.layoutHand();
          }
          return;
        }
        case 'phase': {
          this.applyEnemyTint();
          const fi = this.foeIdx;
          FL.shockwave(this, this.eRestX, this.eY, C.blood, 3, 1.2);   // rugido visual
          U.vibrate(0.7, 260);
          await A.bossPhase(this, this.enemy, ev.text, C.blood);   // cámara lenta, zoom, sacudida y texto con fuerza
          this.bossQuips('phase', fi);
          return;
        }
        // ---------- Criaturas (Invocadora) ----------
        case 'summon': {
          const v = this.renderSummons(ev.summons, ev.sid);
          if (v) this.summonAppear(v, ev.revive);
          Sfx.play('heal', { volume: 0.6 });
          await wait(this, 330);
          return;
        }
        case 'summonLeave': {
          const v = this.sumViews.get(ev.sid);
          if (v) { this.sumViews.delete(ev.sid); this.tweens.add({ targets: v, alpha: 0, y: v.y - 40, duration: 320, onComplete: () => v.destroy() }); }
          this.renderSummons(ev.summons);
          await wait(this, 200);
          return;
        }
        case 'summonAct': {
          const v = this.sumViews.get(ev.sid);
          if (!v) return;
          // Salto hacia el enemigo (vuelve a su sitio solo)
          this.tweens.killTweensOf(v.body);
          v.body.setPosition(0, 0);
          await tw(this, { targets: v.body, x: 62, y: -40, duration: 150, yoyo: true, ease: 'Quad.out' });
          return;
        }
        case 'summonHit': {
          const v = this.sumViews.get(ev.sid);
          if (!v) return;
          const col = ev.why === 'chill' ? 0x9fdcff : ev.why === 'espinoso' ? C.blood : C.blood;
          if (ev.amount > 0) {
            v.img.setTintFill(0xffffff);
            this.time.delayedCall(70, () => { if (v.img.scene) v.img.clearTint(); });
            this.tweens.add({ targets: v.body, x: { from: -6, to: 0 }, duration: 60, repeat: 2, yoyo: true });
            popNumber(this, v.x + 10, GROUND - v.h - 20, ev.amount, 'hit', -1);
            U.Fx.hit(this, v.x, GROUND - v.h / 2, col, false);
            if (ev.why === 'chill') this.shards(v.x, GROUND - v.h / 2, 5, 40);
            Sfx.play(ev.why === 'chill' ? 'ice_chill' : 'hurt', { volume: 0.5 });
          }
          const s = (ev.summons || []).find((x) => x.sid === ev.sid);
          if (s) v.bar.set(s.hp, s.maxHp, 0);
          await wait(this, 220);
          return;
        }
        case 'summonDie': {
          const v = this.sumViews.get(ev.sid);
          if (v) { this.sumViews.delete(ev.sid); this.summonLeaves(v); }
          this.renderSummons(ev.summons);
          await wait(this, 420);
          return;
        }
        case 'summonHeal': {
          const v = this.sumViews.get(ev.sid);
          if (v) {
            popNumber(this, v.x, GROUND - v.h - 20, ev.amount, 'heal', -1);
            const s = (ev.summons || []).find((x) => x.sid === ev.sid);
            if (s) v.bar.set(s.hp, s.maxHp, 0);
          }
          await wait(this, 120);
          return;
        }
        case 'heal':
          popNumber(this, this.pX, this.pY - 100, ev.amount, 'heal', -1);
          this.pBar.set(ev.hp, this.run.maxHp, 0);
          this.hud.refresh();
          Sfx.play('heal');
          await wait(this, 260);
          return;
        case 'bossMod':
          banner(this, _t(ev.text), ev.good ? C.leaf : C.blood, 1000);
          if (ev.good) this.eBar.set(this.fe.hp, this.fe.maxHp, this.fe.block, false);
          await wait(this, 1150);
          return;
        /* ---- Electromante ---- */
        case 'zap': {
          const t = this.foePos(ev.ei), o = ev.jump ? this.foePos(ev.from) : this.boltFrom();
          U.Fx.zap(this, o.x, o.y, t.x, t.y, ev.jump ? 0xbfe9ff : 0x7fd6ff, ev.jump ? { width: 5 } : {});
          if (!ev.jump) A.castGlow(this, o.x, o.y, 0x7fd6ff);
          Sfx.play('ice_chill', { volume: ev.jump ? 0.25 : 0.4 });
          await wait(this, ev.jump ? 110 : 70);
          return;
        }
        case 'static': {
          if (ev.delta > 0) floatText(this, 166, 520, _t('s.estaticaN', { n: ev.delta }), 0x7fd6ff, 22);
          this.setStatic(ev.total);
          if (ev.delta > 0 && this.staticBox) { const { x, y0 } = this.staticGeom; burst(this, x, y0 - ev.total * 11, 0x7fd6ff, 6, 26); }
          await wait(this, 90);
          return;
        }
        case 'chainMiss':
          floatText(this, this.eX, this.eY - 150, _t('s.saltoPerdido', { n: ev.n }), 0xbfe9ff, 20);
          return;
        case 'chillStatic':
          this.sawChill = true;
          floatText(this, 166, 500, _t('s.chillStatic', { n: ev.amount }), 0x9fdcff, 20);
          await wait(this, 220);
          return;
        case 'overload': {
          // Descarga a pantalla completa: destello, rayos del cielo a cada enemigo y temblor
          this.flash(0x7fd6ff, 0.55, 700);
          if (!U.Opts.reduceMotion) A.bloom(this, 0.8, 420);
          floatText(this, 640, 200, _t('s.sobrecargaN', { n: ev.dmg }), 0xffe066, 40);
          this.eachFoe((i) => { if (!this.foes[i].dead) { const t = this.foePos(i);   // (vista: el motor ya puede tenerlo muerto)
            U.Fx.zap(this, t.x + (Math.random() - 0.5) * 120, 0, t.x, t.y, 0xeaf8ff, { width: 11, wild: 60 }); U.Fx.zap(this, this.boltFrom().x, this.boltFrom().y, t.x, t.y, 0x7fd6ff, { width: 6 }); } });
          Sfx.play('hit_heavy', { volume: 0.6 });
          this.shake(260, 0.012);
          await wait(this, 260);
          return;
        }
        case 'magnet': {
          floatText(this, this.eX + 10, this.eY - 30, _t('s.magnetN', { n: ev.amount }), 0xff9a9a, 24);
          burst(this, this.eX, this.eY - 20, 0xff7a7a, 10, 70);
          this.refreshStatuses({ magnet: ev.magnet });
          await wait(this, 200);
          return;
        }
        case 'magnetSet': this.refreshStatuses({ magnet: ev.magnet }); return;
        case 'powerFx': if (ev.key === 'bucle') floatText(this, 96, 520, _t('s.bucleFx'), 0x9ff0d0, 20); return;
        /* ---- Paladín ---- */
        case 'judg': {
          // Rayo de luz sobre el enemigo y la balanza se enciende
          const top = this.eY - this.enemy.displayHeight / 2 - 40;
          const ray = this.add.rectangle(this.eX, top / 2, 70, Math.max(80, top + 40), 0xfff0b0, 0.55).setDepth(LY.fx + 540).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: ray, alpha: 0, scaleX: 0.15, duration: 420, ease: 'Quad.in', onComplete: () => ray.destroy() });
          burst(this, this.eX, this.eY - 20, 0xf2d36b, 12, 90);
          floatText(this, this.eX + 10, this.eY - 30, _t('s.juicioN', { n: ev.amount }), 0xf2d36b, 26);
          this.refreshStatuses({ judg: ev.judg });
          if (this.judgMark) this.tweens.add({ targets: this.judgMark, scale: { from: 1.3 * U.icK(this.judgMark), to: 0.9 * U.icK(this.judgMark) }, alpha: { from: 0.95, to: 0.55 }, duration: 380, ease: 'Back.out' });
          Sfx.play('block');
          await wait(this, 260);
          return;
        }
        case 'judgSet':
          if (ev.chill) floatText(this, this.eX, this.eY - 120, _t('s.chillJudg'), 0x9fdcff, 22);
          this.refreshStatuses({ judg: ev.judg });
          if (ev.chill) { this.sawChill = true; await wait(this, 260); }
          return;
        case 'judgHit':
          if (this.judgMark) this.tweens.add({ targets: this.judgMark, alpha: { from: 0.95, to: 0.55 }, duration: 260 });
          return;
        case 'fervor': this.refreshStatuses(); return;
        case 'immaterial':
          this.flash(0xe8f0ff, 0.35, 420);
          burst(this, this.pX, this.pY, 0xe8f0ff, 18, 90);
          floatText(this, this.pX, this.pY - 130, _t('s.inmaterial'), 0xe8f0ff, 26);
          this.refreshStatuses();
          await wait(this, 300);
          return;
        case 'immaterialHit':
          burst(this, this.pX, this.pY, 0xe8f0ff, 14, 80);
          floatText(this, this.pX, this.pY - 150, _t('s.atraviesa', { d: ev.amount }), 0xe8f0ff, 24);
          return;
        case 'cleanse':
          burst(this, this.pX, this.pY, 0xfff0b0, 20, 100);
          floatText(this, this.pX, this.pY - 130, _t('s.purificado'), 0xfff0b0, 24);
          this.refreshStatuses();
          await wait(this, 260);
          return;
        case 'relicFx': {
          const r = D.ALL_RELICS[ev.id];
          if (r) floatText(this, ev.id === 'estandarte' ? this.eX : this.pX, (ev.id === 'estandarte' ? this.eY : this.pY) - 150, r.name, C.gold, 22);
          await wait(this, 160);
          return;
        }
        case 'revive': {
          // Pluma de Fénix: destello dorado, llamas y texto grande
          this.flash(C.gold, 0.55, 900);
          burst(this, this.pX, this.pY, C.gold, 40, 160);
          burst(this, this.pX, this.pY + 60, C.ember, 30, 120);
          this.mage.setTintFill(0xffe9a8);
          this.time.delayedCall(220, () => this.mage.clearTint());
          if (ev.potion) { U.potionBreak(this, this.pX, this.pY, D.POTIONS[ev.potion].color); this.hud.refresh(); }
          banner(this, ev.potion ? _t('s.la_lagrima_de_fenix_te') : ev.relic === 'amuletofenix' ? _t('s.el_amuleto_del_fenix_te') : ev.power === 'ascension' ? _t('e.ascension') : _t('s.renaces_de_tus_cenizas'), C.gold, 1200);
          this.pBar.set(ev.hp, this.run.maxHp, c.player.block);
          this.hud.refresh();
          Sfx.play('heal'); Sfx.play('win');
          await wait(this, 1300);
          return;
        }
        case 'enemyDead': {
          // Se tiñe, se disuelve en ascuas hacia arriba y la cámara hace un zoom pequeño.
          // Jefes: cámara lenta 0,6 s + destello.
          const boss = (D.ENEMIES[this.fe.id] || {}).tier === 'boss', sp = U.Opts.speed, rm = U.Opts.reduceMotion;
          this.intent.setVisible(false);
          if (this.reticle) this.reticle.setVisible(false);
          this.tweens.killTweensOf(this.enemy);
          (this.affixAura || []).forEach((g) => { this.tweens.killTweensOf(g); this.tweens.add({ targets: g, alpha: 0, duration: 500 }); });
          this.deathAt = performance.now();   // (arnés: momento de la muerte)
          // Su color dominante: se desintegra en él (destello blanco primero)
          const dom = FL.dominantColor(this, this.enemy.texture.key, C.ember), dom2 = FL.lighter(dom);
          if (boss) {   // 0,4 s de cámara lenta, zoom, gran explosión y vibración
            this.tweens.timeScale = sp * 0.35; this.time.timeScale = sp * 0.35;
            setTimeout(() => { if (this.sys && this.sys.isActive()) this.applyOptions(); }, 400 / sp);
            this.flash(0xffffff, 0.7, 900);
            FL.shockwave(this, this.eX, this.eY, dom2, 3, 1.4);
            burst(this, this.eX, this.eY, dom, 40, 230); burst(this, this.eX, this.eY, C.gold, 20, 160);
            U.vibrate(1, 420);
          }
          this.enemy.setTintFill(0xffffff); this.enemy.setAlpha(0.95);
          setTimeout(() => { if (this.enemy && this.enemy.scene) this.enemy.setTintFill(dom); }, 60);
          const cam = this.cameras.main;
          if (!rm) root.CM_HIRES.camTo(cam, { f: boss ? 1.08 : 1.05, duration: 260 / sp, ease: 'Quad.easeOut' });   // zoom sobre la base R
          U.Fx.death(this, this.enemy.getBounds(), boss ? 70 : 46, dom, dom2);
          burst(this, this.eX, this.eY, dom2, 24, 120);
          this.tweens.add({ targets: this.enemyShadow, alpha: 0, duration: 700 });
          await tw(this, { targets: this.enemy, alpha: 0, scaleY: this.enemyBaseScale * 1.08, y: this.enemy.y - 14, duration: 900, delay: 120, ease: 'Sine.in' });
          if (!rm) root.CM_HIRES.camReset(cam, 320 / U.Opts.speed, 'Quad.easeInOut');
          return;
        }
        case 'enemyDie': {   // grupos: muere uno y el combate sigue (las animaciones de los demás no se cortan)
          const en = this.enemy, sh = this.enemyShadow, f = this.foes[this.foeIdx];
          this.intent.setVisible(false); if (this.nextIntent) this.nextIntent.setVisible(false);
          this.tweens.killTweensOf(en);
          (this.affixAura || []).forEach((g) => { this.tweens.killTweensOf(g); this.tweens.add({ targets: g, alpha: 0, duration: 400 }); });
          [this.eName, this.eBar, this.eBlock, this.eStatus, this.dmgPreview, this.judgMark, this.magnetMark, this.freezeFx, this.iceShield].forEach((o) => o && this.tweens.add({ targets: o, alpha: 0, duration: 300, onComplete: () => o.setVisible(false) }));
          Sfx.play('hit_heavy', { volume: 0.5 });
          const dom = FL.dominantColor(this, en.texture.key, C.ember), dom2 = FL.lighter(dom), isBoss = (D.ENEMIES[this.fe.id] || {}).tier === 'boss';
          en.setTintFill(0xffffff);
          setTimeout(() => { if (en.scene) en.setTintFill(dom); }, 60);
          U.Fx.death(this, en.getBounds(), isBoss ? 60 : 46, dom, dom2);
          burst(this, this.eX, this.eY, dom2, isBoss ? 30 : 14, isBoss ? 180 : 90);
          if (isBoss) {   // Doble jefe: cae uno de los dos
            FL.shockwave(this, this.eX, this.eY, dom2, 2, 1.2); U.vibrate(1, 380);
            if (!U.Opts.reduceMotion) { this.tweens.timeScale = this.spd() * 0.35; this.time.timeScale = this.spd() * 0.35; setTimeout(() => { if (this.sys && this.sys.isActive()) this.applyOptions(); }, 400 / this.spd()); }
          }
          this.tweens.add({ targets: sh, alpha: 0, duration: 500 });
          f.dead = true;
          await tw(this, { targets: en, alpha: 0, scaleY: this.enemyBaseScale * 1.06, y: en.y - 10, duration: 520 / 1, ease: 'Sine.in' });
          en.disableInteractive();
          return;
        }
        case 'target': this.moveReticle(); return;
        case 'enemySpawn': {   // un jefe invoca: se rehacen las vistas (el jefe sigue en su sitio) y las nuevas aparecen
          const old = this.foes.length;
          this.rebuildFoes();
          Sfx.play('summon', { volume: 0.6 });
          const fresh = this.run.combat.enemies.map((e, i) => i).filter((i) => this.run.combat.enemies[i].summoned).slice(0, ev.n || 1);
          for (const i of fresh) { const f = this.foes[i]; if (!f || !f.enemy) continue; burst(this, f.eX, f.eY, 0x9be37a, 16, 90); f.enemy.setAlpha(0); this.tweens.add({ targets: f.enemy, alpha: 1, duration: 420 }); }
          void old;
          await wait(this, 480);
          return;
        }
        case 'enemyVanish': {   // el jefe ha caído: sus invocaciones se desvanecen
          const f = this.foes[ev.ei]; if (!f || !f.enemy) return;
          [f.intent, f.eName, f.eBar, f.eBlock, f.eStatus, f.nextIntent].forEach((o) => o && o.setVisible(false));
          this.tweens.killTweensOf(f.enemy);
          this.tweens.add({ targets: [f.enemy, f.enemyShadow], alpha: 0, duration: 600 });
          return;
        }
        case 'win': Sfx.play('win'); return;
        case 'lose': Sfx.play('lose'); return;
        case 'denied': toast(this, ev.reason, C.blood); return;
        case 'potion': this.hud.refresh(); return;   // el vuelo y la rotura ya se animaron
        /* ---- Palabras clave ---- */
        case 'ethereal': {   // Etérea: se deshace en ceniza
          const obj = this.cards.get(ev.uid); this.cards.delete(ev.uid);
          if (!obj) return;
          for (let k = 0; k < 12; k++) {
            const p = this.add.image(obj.x + (Math.random() - 0.5) * 120, obj.y + (Math.random() - 0.5) * 160, 'dot').setTint(k % 2 ? 0x9a9a9a : 0x5a5a5a).setAlpha(0.7).setScale(0.7).setDepth(LY.hand + 400);
            this.tweens.add({ targets: p, y: p.y - 70 - Math.random() * 40, scale: 2.2, alpha: 0, duration: 700 + Math.random() * 300, onComplete: () => p.destroy() });
          }
          this.tweens.add({ targets: obj, alpha: 0, scale: obj.scale * 0.85, y: obj.y - 30, duration: 420, onComplete: () => obj.destroy() });
          await wait(this, 240);
          return;
        }
        case 'echoReady':
          floatText(this, this.pX, this.pY - 120, _t('s.eco_ardiente'), C.flame, 24);
          this.refreshEcho(true);
          return;
        case 'echo': {   // copia fantasma translúcida que se juega detrás
          const card = [...this.run.combat.discard, ...this.run.combat.exhaust, ...this.run.combat.hand].find((x) => x.uid === ev.uid) || { uid: ev.uid, id: ev.id, up: false };
          const ghost = cardView(this, card, { combat: this.run.combat }).setPosition(610, 290).setScale(1.0).setAlpha(0.45).setDepth(LY.hand + 390);
          ghost.list.forEach((o) => o.setTint && o.setTint(0xffc24a));
          this.refreshEcho(false);
          await tw(this, { targets: ghost, x: 700, y: 270, scale: 1.08, duration: 220, ease: 'Quad.out' });
          this.tweens.add({ targets: ghost, alpha: 0, scale: 1.2, duration: 360, onComplete: () => ghost.destroy() });
          await wait(this, 120);
          return;
        }
        case 'upgradeHand': case 'transform': {   // Forja Mental / Metamorfosis: la carta cambia en la mano
          for (const uid of ev.uids) {
            const old = this.cards.get(uid), card = this.run.combat.hand.find((x) => x.uid === uid);
            if (!old || !card) continue;
            const nv = this.makeCard(card, old.x, old.y);
            nv.setScale(old.scale).setAlpha(1).setRotation(old.rotation);
            burst(this, old.x, old.y, ev.t === 'transform' ? C.arcane : C.leaf, 16, 70);
            old.destroy();
          }
          Sfx.play('win', 0.4);
          this.layoutHand(200);
          await wait(this, 260);
          return;
        }
      }
    }

    /**
     * Sonido de fuego al jugar una carta: supernova (Supernova, Pira, con destello grande),
     * fire_big (Llamarada, Combustión o un golpe de 20+), fire_cast (resto de ataques).
     */
    playCardSfx(ev) {
      if (NOVA_CARDS.includes(ev.id)) { Sfx.play('supernova'); this.novaFx(); return; }
      if (ev.type !== 'attack') return;
      // Golpes de esta misma carta: los hitEnemy hasta el siguiente 'play' o fin de turno
      const ahead = [];
      for (const x of this.evAhead || []) { if (x.t === 'play' || x.t === 'turn') break; ahead.push(x); }
      const big = BIG_FIRE_CARDS.includes(ev.id) || ahead.some((x) => x.t === 'hitEnemy' && (x.amount + (x.blocked || 0)) >= 20);
      Sfx.play(big ? 'fire_big' : 'fire_cast');
    }
    /** Destello grande para Supernova y Pira. */
    novaFx() {
      this.flash(C.flame, 0.45, 700);
      const ring = this.add.circle(this.eX, this.eY, 30).setStrokeStyle(10, C.flame, 1).setDepth(LY.fx + 1601).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: ring, scale: 9, alpha: 0, duration: 650, ease: 'Quad.out', onComplete: () => ring.destroy() });
      burst(this, this.eX, this.eY, C.flame, 36, 200);
      burst(this, this.eX, this.eY, C.ember, 24, 140);
      this.shake(260, 0.012);
    }

    /** Retroceso al recibir daño (el enemigo hacia la derecha, el mago hacia la izquierda). white: destello breve. */
    /** Vuelve a poner el tinte (congelado, fase…) al sprite de un enemigo, sea cual sea el enemigo activo. */
    retintFoe(sprite) {
      const fi = (this.foes || []).findIndex((f) => f.enemy === sprite);
      if (fi < 0) return;
      const was = this.foeIdx; this.foeIdx = fi;
      try { this.applyEnemyTint(); } finally { this.foeIdx = was; }
    }
    /**
     * Destello del golpe: una copia del sprite teñida (tint fill) al 70 % encima del original, durante `ms` en tiempo real.
     * Así se sigue viendo al enemigo debajo y no se toca su tinte (congelado, fase…). La copia sigue al sprite.
     */
    hitFlash(sprite, color = 0xffffff, ms = 50, alpha = 0.7) {
      if (!sprite || !sprite.scene || !sprite.texture) return;
      let o = sprite._flashO;
      if (!o || !o.scene) {   // una copia por sprite, creada una vez y reutilizada en cada golpe (oculta entre golpes)
        o = sprite._flashO = this.add.image(sprite.x, sprite.y, sprite.texture.key).setVisible(false);
        const pc = sprite.parentContainer;
        if (pc) pc.addAt(o, pc.getIndex(sprite) + 1);
        o._follow = () => {
          if (!o.visible || !sprite.scene) return;
          o.setPosition(sprite.x, sprite.y).setScale(sprite.scaleX, sprite.scaleY).setAngle(sprite.angle).setDepth(sprite.depth + 0.01);
        };
        this.events.on('postupdate', o._follow);
        sprite.once('destroy', () => { if (this.events) this.events.off('postupdate', o._follow); clearTimeout(o._flashT); if (o.scene) o.destroy(); });
      }
      o.setTexture(sprite.texture.key, sprite.frame && sprite.frame.name).setOrigin(sprite.originX, sprite.originY)
        .setFlip(sprite.flipX, sprite.flipY).setTintFill(color).setAlpha(alpha * sprite.alpha).setVisible(true);
      o._follow();
      clearTimeout(o._flashT);
      o._flashT = setTimeout(() => { if (o.scene) o.setVisible(false); }, ms);
    }
    hurt(sprite, base, dmg = 0, white = true) {
      const isE = sprite === this.enemy, x0 = isE ? this.eRestX : this.pX;
      // Destello (también con «Reducir movimiento»): blanco el enemigo (50 ms), rojo el personaje (90 ms), al 70 %
      if ((white || (!isE && dmg > 0)) && performance.now() - (sprite._hsFlash || 0) > 250) this.hitFlash(sprite, isE ? 0xffffff : 0xff4a3a, isE ? 50 : 90);
      const kb = (isE ? 1 : -1) * (10 + Math.min(dmg, 30) * 0.8);
      this.tweens.add({ targets: sprite, x: { from: x0 + kb, to: x0 }, duration: 280, ease: 'Back.out' });
      A.recoil(this, sprite, dmg, isE ? 1 : -1);   // se inclina hacia atrás y tiembla según el daño
      // Squash & stretch: se aplasta y se recupera (la respiración se para mientras)
      if (dmg > 0 && !U.Opts.reduceMotion) {
        const idle = isE ? this.enemyIdle : this.mageIdle, s0 = base, k = Math.min(1, 0.4 + dmg / 25);
        if (idle) idle.pause();
        this.tweens.add({ targets: sprite, scaleX: s0 * (1 + 0.1 * k), scaleY: s0 * (1 - 0.12 * k), duration: 70, ease: 'Quad.out', yoyo: true,
          onComplete: () => { if (sprite.scene) sprite.setScale(s0); if (idle && sprite.alpha > 0) idle.resume(); } });
      }
    }
    /** Al lanzar una carta, el personaje brilla un momento con el color de su clase. */
    casterGlow() {
      const col = E.charDef(this.run).color || C.gold;
      if (this.mageCastFx) { A.unglow(this.mage, this.mageCastFx); this.mageCastFx = null; }
      const fx = this.mageCastFx = A.glow(this.mage, col, 4);
      if (!fx) return;
      this.time.delayedCall(360, () => { if (this.mageCastFx === fx) { A.unglow(this.mage, fx); this.mageCastFx = null; } });
    }
    /** Frases de los jefes (bocadillo de 2 s): 'start' al empezar el combate, 'phase' al cambiar de fase. */
    bossQuips(when, onlyFi) {
      const c = this.run.combat; if (!c) return;
      let k = 0;
      c.enemies.forEach((e, i) => {
        if (onlyFi !== undefined && i !== onlyFi) return;
        const d = D.ENEMIES[e.id] || {}, f = this.foes[i];
        if ((d.tier !== 'boss' && e.id !== 'archimago') || !E.isAlive(e) || !f || !f.enemy) return;
        // Una frase al empezar y otra al cambiar de fase: neutras para todos; con vínculo con tu personaje, las de vínculo (data.js)
        const lines = D.bossQuipKeys(e.id, this.run.char, when, (key) => I18N.has(key));
        if (!lines.length) return;
        const text = _t(lines[Math.floor(Math.random() * lines.length)]);
        const top = f.enemy.y - f.enemy.displayHeight;   // a la izquierda de su cabeza: no tapa nombre, barra ni intención
        this.time.delayedCall(k++ * 700, () => { if (f.enemy && f.enemy.scene) FL.quip(this, f.eX - f.enemy.displayWidth * 0.32, top + Math.min(110, f.enemy.displayHeight * 0.3), text, C.blood, 2000, 'left'); });
      });
    }
    /** Bloqueo: si absorbe todo el golpe, «¡Bloqueado!» con destello de escudo; si el golpe lo rompe, el escudo salta en fragmentos. */
    blockFeedback(x, y, blocked, amount, blockAfter) {
      if (!(blocked > 0)) return;
      if (amount <= 0 && blockAfter > 0) {
        floatText(this, x, y - 40, _t('feel.blocked'), C.frost, 28);
        U.Fx.block(this, x, y);
      } else if (amount > 0 && blockAfter <= 0) this.shieldBreak(x, y);
    }
    shieldBreak(x, y) {
      const n = U.Live.room(U.Opts.reduceMotion ? 6 : 14);
      for (let i = 0; i < n; i++) {
        const sh = U.Pool.image(this, x, y, 'dot').setTint(i % 3 ? C.frost : 0xe8f4ff).setDepth(LY.fx + 520);
        sh.setScale(0.25 + Math.random() * 0.3, 0.1 + Math.random() * 0.12).setAngle(Math.random() * 360);
        const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 70;
        this.tweens.add({ targets: sh, x: x + Math.cos(a) * r, duration: 520, ease: 'Quad.out' });
        this.tweens.add({ targets: sh, y: y + Math.sin(a) * r * 0.6 - 30, duration: 220, ease: 'Quad.out',
          onComplete: () => this.tweens.add({ targets: sh, y: sh.y + 90, alpha: 0, angle: sh.angle + 120, duration: 420, ease: 'Quad.in', onComplete: () => sh.destroy() }) });
      }
      const ring = this.add.circle(x, y, 40, C.frost, 0).setStrokeStyle(4, C.frost, 0.9).setDepth(LY.fx + 519).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 360, ease: 'Quad.out', onComplete: () => ring.destroy() });
      floatText(this, x, y - 60, _t('feel.broken'), C.frost, 24);
      Sfx.play('block', { volume: 0.6 });
    }

    /* ---------------- Sincronización completa desde el estado ---------------- */
    sync() {
      const c = this.run.combat;
      if (!c) return;
      if (this.cards && this.cards.size) this.clearStaleHover && this.time.delayedCall(0, () => this.clearStaleHover());
      // Cartas: crear las que falten (p. ej. al reanudar), borrar las que ya no estén
      const inHand = new Set(c.hand.map((x) => x.uid));
      for (const [uid, obj] of this.cards) if (!inHand.has(uid)) { obj.destroy(); this.cards.delete(uid); }
      c.hand.forEach((card) => { if (!this.cards.has(card.uid)) this.makeCard(card, 44, 676); });
      for (const [uid, obj] of this.cards) {
        obj.refresh(c);
        obj.setPlayable(E.canPlay(this.run, uid).ok);
        const hc = c.hand.find((x) => x.uid === uid);
        if (obj.setSealed) obj.setSealed(!!hc && hc.sealed === c.turn);   // Silencio (Acto III)
      }
      this.layoutHand();
      this.refreshBars(false);
      this.moveReticle(false);
      this.renderSummons(c.summons || []);
      this.refreshStatuses();
      this.refreshIntent();
      this.setEnergy(c.player.energy);
      this.setCombo(c.player.playedThisTurn || 0);
      this.refreshEcho(!!c.echo);
      this.drawT.setText(String(c.draw.length));
      this.discardT.setText(String(c.discard.length));
      this.exhaustT.setText(c.exhaust.length ? _t('s.agotadas_0', { 0: c.exhaust.length }) : '');
      this.hud.refresh();
      this.checkTips();
    }

    /** Consejos del combate. Se llama tras cada sincronización (es decir, con las animaciones ya terminadas). */
    checkTips() {
      const c = this.run.combat;
      if (c) this.foeIdx = c.target;   // los consejos señalan al enemigo marcado
      if (!c || c.over) return;
      showTip(this, 'energia', { x: 46, y: 550, w: 100, h: 100 });
      showTip(this, 'intencion', () => (this.intent.visible && this.intent.list.length ? boundsOf(this.intent, 4) : null));
      // Temperatura y Quemadura: la primera vez que su icono aparece (es el primero de cada fila de estados)
      if (c.player.temp > 0) showTip(this, 'temp', () => (this.pStatus.list[0] ? boundsOf(this.pStatus.list[0], 8) : null));
      if (this.fe.burn > 0) showTip(this, 'quemadura', () => (this.eStatus.list[0] ? boundsOf(this.eStatus.list[0], 8) : null));
      if (this.cardPlayed) showTip(this, 'fin', () => boundsOf(this.endBtn));
      // Acto II: primer frío (señala vida + estados del jugador) y primer Escalofrío en la mano
      if (E.hasMech(this.run, 'summon') && (c.summons || []).length) showTip(this, 'invocar', () => this.summonRect());
      if (this.staticBox) showTip(this, 'estatica', () => { const g = this.staticGeom; return { x: g.x - 18, y: g.y0 - 10 * (g.h + g.gap) - 34, w: 36, h: 10 * (g.h + g.gap) + 62 }; });
      if (E.hasMech(this.run, 'chain') && c.hand.some((x) => (E.cardVals(x).chain || 0) > 0)) showTip(this, 'rayo', () => { const k = c.hand.find((x) => (E.cardVals(x).chain || 0) > 0), o = k && this.cards.get(k.uid); return o ? boundsOf(o, 2) : null; });
      if (E.hasMech(this.run, 'fervor')) showTip(this, 'fervor', () => { const r = this.pStatus.list.find((o) => o.statusKey === 'fervor'); return r ? boundsOf(r, 8) : null; });
      if ((this.fe.judg || 0) > 0) showTip(this, 'juicio', () => { const r = this.eStatus.list.find((o) => o.statusKey === 'judg'); return r ? boundsOf(r, 8) : null; });
      if (E.actOf(this.run) >= 3) showTip(this, 'arcano', () => (this.intent.visible && this.intent.list.length ? boundsOf(this.intent, 6) : null));
      if (E.charOf(this.run) === 'guardiana' && this.runeLayer) showTip(this, 'runas', () => { const b = this.runeLayer.getBounds(); return { x: b.x - 8, y: b.y - 8, w: b.width + 16, h: b.height + 16 }; });
      if (E.charOf(this.run) === 'criomante') showTip(this, 'escarcha', () => (this.eStatus.list.length ? boundsOf(this.eStatus, 8) : boundsOf(this.enemy, 0)));
      if (this.sawFreeze || this.fe.frozen) showTip(this, 'congelado', () => (this.intent.visible && this.intent.list.length ? boundsOf(this.intent, 4) : boundsOf(this.enemy, 0)));
      if (this.sawChill && E.charOf(this.run) !== 'criomante') showTip(this, 'frio', () => ({ x: this.pX - 130, y: this.pStatus.y - 24, w: 300, h: 48 }));
      const curse = c.hand.find((x) => x.id === 'escalofrio');
      if (curse) showTip(this, 'maldicion', () => { const o = this.cards.get(curse.uid); return o ? boundsOf(o, 2) : null; });
      potionTip(this);
      const kw = c.hand.find((x) => U.hasKeyword(x));
      if (kw) showTip(this, 'palabrasClave', () => { const o = this.cards.get(kw.uid); return o ? boundsOf(o, 2) : null; });
    }

    refreshBars(animate) {
      const c = this.run.combat;
      this.pBar.set(this.run.hp, this.run.maxHp, c.player.block, animate);
      this.eachFoe(() => { this.eBar.set(this.fe.hp, this.fe.maxHp, this.fe.block, animate); this.eBlock.set(this.fe.block); this.updateShield(this.fe.block); });
      this.pBlock.set(c.player.block);
      this.setIce(c.player.ice);
      this.updateFreezeFx();
      this.drawRunes();
    }
    /** Escudo de hielo (startBlock): se rompe con un estallido cuando el Bloqueo llega a 0. */
    updateShield(block) {
      const sh = this.iceShield;
      if (!sh) return;
      if (block > 0 && !sh.visible) { sh.setVisible(true); sh.setScale(1); }
      if (block <= 0 && sh.visible && !sh.breaking) {
        sh.breaking = true;
        burst(this, this.eX, this.eY, 0xcfeaff, 22, 140);
        if (this.textures.exists('ic_shard')) this.shards(this.eX, this.eY, 10, 150);
        this.tweens.add({ targets: sh, scale: 1.25, alpha: 0, duration: 260, onComplete: () => { sh.setVisible(false).setAlpha(1); sh.breaking = false; } });
      }
    }
    /** Cristales de escarcha que salen disparados desde un punto. */
    shards(x, y, n = 8, spread = 70) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, r = spread * (0.6 + Math.random() * 0.6);
        const sh = this.add.image(x, y, 'ic_shard').setIconScale(0.18 + Math.random() * 0.12).setRotation(a + Math.PI / 2).setDepth(LY.fx + 600);
        this.tweens.add({ targets: sh, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, alpha: 0, angle: sh.angle + 120,
          duration: 520 + Math.random() * 260, ease: 'Quad.out', onComplete: () => sh.destroy() });
      }
    }

    /** «Combo ×N» junto a la energía cuando llevas 2+ cartas jugadas; pulso al subir. */
    setCombo(n) {
      if (!this.comboT) return;
      this.comboT.setVisible(n >= 2).setText(_t('s.combo_0', { 0: n }));
      if (n > this.comboShown && n >= 2) this.tweens.add({ targets: this.comboT, scale: { from: 1.35, to: 1 }, duration: 220, ease: 'Back.out' });
      this.comboShown = n;
    }
    /** Halo de Eco Ardiente en las cartas de la mano mientras esté pendiente. */
    refreshEcho(on) { for (const obj of this.cards.values()) if (obj.setEcho) obj.setEcho(on); }

    setEnergy(v, pulse) {
      const c = this.run.combat;
      this.energyT.setText(`${v}/${c.player.maxEnergy}`);
      if (pulse) this.tweens.add({ targets: this.energyT, scale: { from: 1.3, to: 1 }, duration: 200 });
      this.drawGems(v, pulse);
    }
    /** Una gema por punto de energía (más si tienes energía extra). */
    drawGems(v, animate) {
      const max = this.run.combat.player.maxEnergy, n = Math.max(max, v);
      if (this.gems.length !== n) {   // reconstruir el arco
        this.gemBox.removeAll(true); this.gems = [];
        for (let i = 0; i < n; i++) {
          const a = Phaser.Math.DegToRad(-90 + (i - (n - 1) / 2) * 26);
          const g = this.add.graphics().setPosition(Math.cos(a) * 62, Math.sin(a) * 62);
          g.full = null; this.gemBox.add(g); this.gems.push(g);
        }
        this.gemShown = null;
      }
      const paint = (g, full) => {
        g.clear(); g.full = full;
        const pts = [{ x: 0, y: -11 }, { x: 8, y: 0 }, { x: 0, y: 11 }, { x: -8, y: 0 }];
        g.fillStyle(full ? C.flame : 0x2a1206, 1); g.fillPoints(pts, true);
        if (full) { g.fillStyle(0xfff1b8, 0.85); g.fillPoints([{ x: 0, y: -8 }, { x: 4, y: -1 }, { x: 0, y: 1 }, { x: -3, y: -2 }], true); }
        g.lineStyle(2, full ? C.gold : 0x7a5a2a, 1); g.strokePoints(pts, true);
      };
      const prev = this.gemShown;
      let kEmpty = 0, kFill = 0;
      this.gems.forEach((g, i) => {
        const full = i < v;
        if (g.full === full) return;
        if (!animate || prev === null) { paint(g, full); return; }
        if (!full) {   // se vacían una a una (de la última a la primera)
          const k = kEmpty++;
          this.time.delayedCall(k * 70, () => {
            paint(g, false); this.tweens.add({ targets: g, scale: { from: 0.55, to: 1 }, duration: 180, ease: 'Back.out' });
            burst(this, this.gemBox.x + g.x, this.gemBox.y + g.y, C.flame, 6, 22);   // se gasta con una chispa
          });
        } else {       // se rellenan con un destello
          const k = kFill++;
          this.time.delayedCall(k * 85, () => {
            paint(g, true);
            this.tweens.add({ targets: g, scale: { from: 1.6, to: 1 }, duration: 240, ease: 'Back.out' });
            if (!U.Opts.reduceMotion) {
              const f = this.add.circle(this.gemBox.x + g.x, this.gemBox.y + g.y, 14, 0xfff1b8, 0.9).setDepth(LY.units + 3).setBlendMode(Phaser.BlendModes.ADD);
              this.tweens.add({ targets: f, scale: 2.2, alpha: 0, duration: 320, onComplete: () => f.destroy() });
            }
          });
        }
      });
      this.gemShown = v;
    }

    /** Pinta los estados. `over` permite mostrar valores intermedios durante la animación. */
    /** Tinte base del enemigo: fase 2 (rojo; azul violáceo en el acto II) o arte sustituto (azul hielo). */
    applyEnemyTint() {
      if (!this.enemy) return;
      const c = this.run.combat, phase2 = c && this.fe.phase === 2, phase3 = c && this.fe.phase === 3;
      if (c && this.fe.frozen) this.enemy.setTint(0x7fc4ff);
      else if (phase3) this.enemy.setTint(0xff6ad0);
      else if (phase2) this.enemy.setTint(E.actOf(this.run) >= 3 ? 0xd08aff : E.actOf(this.run) >= 2 ? 0x8f9cff : 0xff9a8a);
      else if (this.enemyTint) this.enemy.setTint(this.enemyTint);
      else this.enemy.clearTint();
    }

    refreshStatuses(over = {}) {
      const c = this.run.combat, p = c.player;
      const pl = [
        ['temp', over.temp !== undefined ? over.temp : p.temp],
        ['fervor', E.hasMech(this.run, 'fervor') ? (p.fervor || 0) : -1],   // Paladín: siempre visible (también a 0)
        ['immaterial', p.immaterial ? 1 : 0],
        ['sangre', p.powers.sangre || 0], ['juramento', p.powers.juramento || 0], ['ascension', p.powers.ascension && !c.ascUsed ? 1 : 0],
        ['weak', p.weak], ['thorns', p.thorns],
        ['furia', p.powers.furia || 0], ['fenix', p.powers.fenix || 0],
        ['eterna', p.powers.eterna || 0], ['sol', p.powers.sol || 0],
        ['hoguera', p.powers.hoguera || 0], ['volcan', p.powers.volcan || 0],
        ['ventisca', p.powers.ventisca || 0], ['invierno', p.powers.invierno || 0], ['glaciar', p.powers.glaciar || 0],
        ['maestria', p.powers.maestria || 0], ['forja', p.powers.forja || 0], ['ranura', p.powers.ranura || 0],
        ['vinculo', c.summons ? E.bondOf(c) : 0], ['espinas', p.powers.espinas || 0], ['rey', p.powers.rey ? 1 : 0],
        ['aura', p.powers.aura || 0], ['expuesto', c.noDefTurn && c.noDefTurn >= c.turn ? 1 : 0],
        ['fury', c.furyTurn === c.turn ? 1 : 0], ['ignea', c.noOverheat === c.turn ? 1 : 0],   // pociones: solo este turno
        // Sendas: Punto de Fusión y Prisma de Hielo (este turno) y los poderes nuevos
        ['fusion', c.fusion && c.fusion.turn === c.turn ? c.fusion.bonus : 0], ['prismt', c.prismShatter === c.turn ? 1 : 0],
        ...['incendio', 'permahielo', 'polar', 'golemr', 'alma', 'saviae', 'madre', 'votiva', 'castillo', 'perpetua', 'cantera', 'cicloe', 'grabado', 'raiz', 'avatar'].map((k) => [k, p.powers[k] || 0]),
        ['contra', c.iceCounter === c.turn ? 1 : 0], ['espejoj', c.judgMirror && c.judgMirror.turn === c.turn ? c.judgMirror.n : 0],
        // Electromante (la Estática va en su medidor, junto a la Energía)
        ...['bobina', 'bucle', 'nucleo', 'velocidad', 'galvan', 'ojotormenta', 'superc'].map((k) => [k, p.powers[k] || 0]), ['relay', c.relay && c.relay.turn === c.turn ? c.relay.n : 0]
      ];
      this.drawStatuses(this.pStatus, pl, this.pX);
      this.eachFoe((fi) => {
        const e = this.fe, o = fi === this.animFoe ? over : {};
        const en = [['burn', o.burn !== undefined ? o.burn : e.burn], ['str', e.str],
          ['frost', o.frost !== undefined ? o.frost : (e.frost || 0)], ['frozen', e.frozen ? 1 : 0],
          ['judg', o.judg !== undefined ? o.judg : (e.judg || 0)], ['magnet', o.magnet !== undefined ? o.magnet : (e.magnet || 0)],
          ['reflect', e.reflect || 0], ['charging', e.charging ? e.charging.left + 1 : 0], ['stunned', e.stunned ? 1 : 0], ['coffin', e.frozen && e.coffin ? 1 : 0], ...bossPassives(e)];
        this.shownBurn = en[0][1];   // valor pintado (douse calcula cuánto se apaga)
        if (e.dead) en.length = 0;
        this.drawStatuses(this.eStatus, en, this.eX);
      });
      this.refreshSummonStats();   // el Vínculo cambia el ataque que enseñan las criaturas
      this.updatePaladinFx(over.judg);
      this.eachFoe((i) => this.updateMagnetMark(i === this.animFoe && over.magnet !== undefined ? over.magnet : (this.fe.magnet || 0)));
      this.setStatic(over.static !== undefined ? over.static : (p.static || 0));
    }
    drawStatuses(cont, list, cx) {
      const c0 = this.run.combat;
      cont.removeAll(true);
      // Muchos estados: varias filas (el enemigo hasta el borde de la pantalla; tú, sin llegar a la intención enemiga)
      const perRow = cont.perRow || Math.max(1, Math.floor(((cont.isFoe ? 1262 : 800) - cont.x) / 46));
      list.filter(([k, v]) => v > 0 || (k === 'fervor' && v === 0)).forEach(([k, v], i) => {
        const info = STATUS_INFO[k];
        const x = (i % perRow) * 46, y = Math.floor(i / perRow) * 44;
        const hot = k === 'temp' && v >= E.overheatAt(this.run) && c0.noOverheat !== c0.turn;
        const ring = this.add.circle(x, y, 19, hot ? 0x4a1608 : (info.ring || 0x10140f)).setStrokeStyle(2, hot ? C.ember : info.tint ? 0x6fa8cf : C.line);
        const ic = this.add.image(x, y - 1, 'ic_' + info.icon).setIconScale(0.44);
        if (info.tint) ic.setTint(info.tint);
        if (k === 'fenix') ic.setTint(C.gold);
        if (k === 'eterna') ic.setTint(C.ember);
        if (k === 'sol') ic.setTint(C.flame);
        if (k === 'hoguera') ic.setTint(C.ember);
        if (k === 'volcan') ic.setTint(C.blood);
        if (k === 'ignea') ic.setTint(C.gold);
        const t = T(this, x + 13, y + 12, info.noNum ? '' : String(v), { size: 15, bold: true, stroke: 0x000000, strokeThickness: 4 });
        ring.statusKey = k;
        ring.setInteractive();
        ring.on('pointerover', () => this.tip.show(cont.x + x - 20, cont.y + y + 26, info.name + (info.noNum ? '' : ` ${v}`) + (hot ? _t('s.peligro') : ''), info.desc(v, this.run)));
        ring.on('pointerout', () => this.tip.hide());
        cont.add([ring, ic, t]);
      });
    }

    intentDesc(it, fi) {
      if (it.stunned) return _t('s.esta_aturdido_amuleto_del_fenix');
      if (it.frozen) return _t('s.esta_congelado_pierde_su_proximo');
      const parts = [];
      if (it.dmg !== undefined) parts.push(it.hits > 1 ? _t('s.atacara_0_veces_por_1', { 0: it.hits, 1: it.dmg }) : _t('s.atacara_por_0_de_dano', { 0: it.dmg }));
      // Daño real que te llega (Bloqueo, Escudo de Hielo e Inmaterial; con varios enemigos, en su orden de actuar)
      const c0 = this.run.combat, real = it.dmg !== undefined && c0 && !c0.over ? E.incomingDamage(c0) : null;
      if (real && fi !== undefined && it.kind !== 'charge') parts.push(_t(c0.enemies.length > 1 ? 'int.realDmg' : 'int.realDmg1', { n: real[fi] }));
      if (it.block) parts.push(_t('s.ganara_0_de_bloqueo', { 0: it.block }));
      if (it.str) parts.push(_t('s.ganara_0_de_fuerza', { 0: it.str }));
      if (it.weak) parts.push(_t('s.te_aplicara_0_de_debil', { 0: it.weak }));
      if (it.chill) { const ch = E.charOf(this.run); parts.push(ch === 'piromago' ? _t('s.frio_te_quitara_0_de', { 0: it.chill }) : _t('int.chill.' + ch, { n: it.chill })); }
      if (it.curse) parts.push(_t('s.maldicion_barajara_0_escalofrio_s', { 0: it.curse }));
      if (it.douse) parts.push(_t('s.deshielo_reducira_su_quemadura_a'));
      if (it.heal) parts.push(_t('int.heal', { n: it.heal }));
      if (it.twice) parts.push(_t('s.veloz_este_turno_actuara_dos'));
      // Acto III
      if (it.kind === 'charge') parts.unshift(_t('int.charge', { n: it.charge, hit: it.chargeHit, b: E.CHARGE_BREAK, so: this.run.combat ? _t('int.chargeSoFar', { d: (fi !== undefined ? this.run.combat.enemies[fi] : this.fe).turnDmg || 0 }) : '' }));
      if (it.unleash) parts.push(_t('s.descarga_la_carga_arcana'));
      if (it.drain) parts.push(_t('s.drenar_mana_empezaras_tu_proximo', { 0: it.drain }));
      if (it.silence) parts.push(_t('s.silencio_0_carta_s_al', { 0: it.silence }));
      if (it.reflect) parts.push(_t('s.reflejo_gana_0_carga_s', { 0: it.reflect, 1: Math.round(E.REFLECT_FRAC * 100) }));
      if (it.inkCurse) parts.push(_t('s.tinta_barajara_0_garabato_s', { 0: it.inkCurse }));
      if (it.target) {
        const s0 = (this.run.combat.summons || [])[0];
        parts.push(_t('s.golpeara_primero_a_tu_0', { 0: it.target.name, 1: s0 ? _t('int.sumHp', { n: s0.hp }) : '' }));
      }
      if (it.dmg !== undefined && this.run.combat) {
        const p = this.run.combat.player, absorb = (p.block || 0) + (p.ice || 0);
        // Golpes que te llegan de verdad: las criaturas se comen los primeros (uno cada una como mínimo)
        const hp = (this.run.combat.summons || []).map((x) => x.hp);
        let total = 0;
        for (let h = 0; h < (it.hits || 1); h++) { if (hp.length) { hp[0] -= it.dmg; if (hp[0] <= 0) hp.shift(); } else total += it.dmg; }
        const net = Math.max(0, total - absorb);
        if (!total && (this.run.combat.summons || []).length) { parts.push(_t('s.tus_criaturas_se_llevan_todos')); return parts.join(' '); }
        parts.push(absorb ? _t(p.ice ? 'int.netIce' : 'int.net', { n: net, t: total, a: Math.min(total, absorb) })
          : _t('s.te_llegaran_0_de_dano', { 0: net }));
      }
      return parts.join(' ');
    }

    refreshIntent() { this.eachFoe(() => this.refreshIntent1()); this.refreshSummonTarget(); }
    refreshIntent1() {
      const c = this.run.combat, fi = this.foeIdx;
      if (!this.intent) return;
      this.intent.removeAll(true);
      if (c.over || this.fe.dead) { this.intent.setVisible(false); if (this.nextIntent) { this.nextIntent.destroy(); this.nextIntent = null; } return; }
      if (E.hasRelic(this.run, 'velo')) { this.blindIntent(fi); return; }   // Velo de la Ceguera: no ves sus intenciones
      const it = E.intentFor(c, fi);
      this.lastIntentKind = it.kind;
      // Anuncia un ataque: el enemigo se adelanta un poco hacia el mago
      const lean = it.kind === 'attack' && this.fe.hp > 0 ? -16 : 0;
      if (lean !== this.eLean && this.enemy) {
        this.eLean = lean; this.eRestX = this.eX + lean;
        this.tweens.add({ targets: this.enemy, x: this.eRestX, duration: 380, ease: 'Back.out' });
      }
      this.intentChill = it.chill || 0;   // el sonido del frío depende de la fuerza del movimiento
      const icon = { attack: 'sword', defend: 'shield', buff: 'strength', debuff: 'weak', frozen: 'snow', charge: 'hourglass' }[it.kind];
      const label = it.stunned ? _t('s.aturdido') : it.frozen ? _t('s.congelado') : it.kind === 'charge' ? _t('s.cargando_0', { 0: it.charge }) : it.dmg !== undefined ? (it.hits > 1 ? `${it.dmg}×${it.hits}` : String(it.dmg)) : '';
      const t = T(this, 0, 0, label, { size: 30, font: 'display', color: C.parch, stroke: 0x000000, strokeThickness: 5, ox: 0 });
      // Efectos extra del acto II: copo (chill), carta (curse), gota (douse), cada uno con su número
      const extras = [];
      if (it.dmg !== undefined && it.block) extras.push(['shield', '']);
      if (it.chill) extras.push(['snow', String(it.chill)]);
      if (it.curse) extras.push(['cursecard', String(it.curse)]);
      if (it.douse) extras.push(['drop', '']);
      if (it.twice) extras.push(['bolt', '×2']);
      // Acto III: Drenar (gota azul), Silencio (candado), Reflejo (espejo), Garabatos (carta con mancha)
      if (it.kind === 'charge') extras.push(['sword', String(it.chargeHit)]);   // golpe que descargará
      if (it.drain) extras.push(['manadrop', String(it.drain)]);
      if (it.silence) extras.push(['vlock', String(it.silence)]);
      if (it.reflect) extras.push(['mirror', String(it.reflect)]);
      if (it.inkCurse) extras.push(['inkcard', String(it.inkCurse)]);
      if (it.target) extras.push(['summon_' + it.target.id, '']);   // Invocadora: golpeará primero a esta criatura
      const exW = extras.map(([, n]) => (n ? 46 : 34));
      const w = 52 + (label ? t.width + 10 : 0) + exW.reduce((a, b) => a + b, 0);
      const bg = this.add.graphics();
      const col = it.frozen ? 0x8fd4ff : it.kind === 'charge' ? 0xb27bff : it.kind === 'attack' ? C.blood : it.kind === 'defend' ? C.frost : C.arcane;
      bg.fillStyle(0x080b0a, 0.85); bg.fillRoundedRect(-w / 2, -24, w, 48, 24);
      bg.lineStyle(2, col, 1); bg.strokeRoundedRect(-w / 2, -24, w, 48, 24);
      const ic = this.add.image(-w / 2 + 26, 0, 'ic_' + icon).setIconScale(0.56);
      if (it.frozen) { ic.setTint(0xbfe3ff); t.setColor('#bfe3ff'); }
      t.setPosition(-w / 2 + 50, 2);
      this.intent.add([bg, ic, t]);
      // Ataque fuerte (15+ en total o un tercio de tu vida): la intención brilla en rojo
      const total = it.kind === 'attack' ? (it.dmg || 0) * (it.hits || 1) : it.kind === 'charge' ? it.chargeHit || 0 : 0;
      if (this.intentGlow) { A.unglow(this.intent, this.intentGlow); this.intentGlow = null; }
      if (total >= Math.min(15, this.run.hp / 3) && !it.frozen) this.intentGlow = A.glow(this.intent, it.kind === 'charge' ? 0xb27bff : 0xff4a3a, 3.5);
      let x = -w / 2 + 52 + (label ? t.width + 10 : 0) - 6;
      extras.forEach(([k, n], i) => {
        this.intent.add(this.add.image(x + 16, 0, 'ic_' + k).setIconScale(k === 'cursecard' || k === 'inkcard' ? 0.5 : 0.42));
        if (n) this.intent.add(T(this, x + 32, 10, n, { size: 16, bold: true, color: k === 'snow' ? 0xbfe3ff : k === 'manadrop' ? 0x9fbaff : k === 'vlock' || k === 'mirror' ? 0xd8b8ff : C.parch, stroke: 0x000000, strokeThickness: 4, ox: 0 }));
        x += exW[i];
      });
      // Tooltip propio de la intención (además del que sale al pasar sobre el enemigo)
      this.intent.setSize(w, 48);
      if (!this.intent.input) {
        this.intent.setInteractive({ useHandCursor: false });
        const box = this.intent;
        box.on('pointerover', () => { const i2 = E.intentFor(this.run.combat, fi); this.tip.show(Math.min(box.x - 140, 960), box.y + 30, _t('st.intent', { m: i2.name }), this.intentDesc(i2, fi), { kws: intentKws(i2), max: 4 }); });
        box.on('pointerout', () => this.tip.hide());
      } else this.intent.input.hitArea.setSize(w, 48).setPosition(0, 0);
      // Doble jefe: la intención del 2.º jefe se corre a la izquierda si llegaría a la barra o al nombre del principal
      const maxR = this.foes[fi] && this.foes[fi].intentMaxR;
      if (maxR) this.intent.x = Math.min(this.eX, maxR - (w * this.intent.scaleX) / 2);
      this.intent.setAlpha(1).setVisible(true);
      this.drawNextIntent();
    }

    /** Velo de la Ceguera (Parche 3.5): en vez de la intención, un «?» (sin pistas: ni se adelanta ni marca a quién golpeará). */
    blindIntent(fi) {
      const w = 64, bg = this.add.graphics();
      bg.fillStyle(0x080b0a, 0.85); bg.fillRoundedRect(-w / 2, -24, w, 48, 24);
      bg.lineStyle(2, C.muted, 1); bg.strokeRoundedRect(-w / 2, -24, w, 48, 24);
      this.intent.add([bg, this.add.image(0, 0, 'ic_question').setIconScale(0.5).setTint(C.muted)]);
      if (this.intentGlow) { A.unglow(this.intent, this.intentGlow); this.intentGlow = null; }
      this.intent.setSize(w, 48);
      if (!this.intent.input) {
        this.intent.setInteractive({ useHandCursor: false });
        this.intent.on('pointerover', () => this.tip.show(Math.min(this.intent.x - 140, 960), this.intent.y + 30, D.BOSS_RELICS.velo.name, D.BOSS_RELICS.velo.bad));
        this.intent.on('pointerout', () => this.tip.hide());
      } else this.intent.input.hitArea.setSize(w, 48).setPosition(0, 0);
      this.intent.setAlpha(1).setVisible(true);
      if (this.nextIntent) { this.nextIntent.destroy(); this.nextIntent = null; }
    }
    /** Ojo de Búho: intención del siguiente turno, pequeña y translúcida, junto a la actual. */
    drawNextIntent() {
      const c = this.run.combat;
      if (this.nextIntent) { this.nextIntent.destroy(); this.nextIntent = null; }
      if (!c || c.over || !E.hasRelic(this.run, 'buho')) return;
      const it = E.nextIntentFor(c, this.foeIdx);
      const icon = { attack: 'sword', defend: 'shield', buff: 'strength', debuff: 'weak', frozen: 'snow' }[it.kind] || 'question';
      const label = it.dmg !== undefined ? (it.hits > 1 ? `${it.dmg}×${it.hits}` : String(it.dmg)) : '';
      const b = this.intent.getBounds();
      const L = this.nextIntent = this.add.container(b.right + 50, this.intent.y).setAlpha(0.55).setDepth(this.intent.depth);
      const t = T(this, 6, 1, label, { size: 18, font: 'display', color: C.parch, stroke: 0x000000, strokeThickness: 4, ox: 0 });
      const w = 38 + (label ? t.width + 8 : 0);
      const maxR = this.foes[this.foeIdx] && this.foes[this.foeIdx].intentMaxR;
      if (maxR && b.right + 28 + w > maxR) L.x = b.x - 8 - w + 22;   // Doble jefe: a la izquierda, sin tocar al principal
      const g = this.add.graphics(); g.fillStyle(0x080b0a, 0.85); g.fillRoundedRect(-22, -16, w, 32, 16); g.lineStyle(1.5, C.muted, 1); g.strokeRoundedRect(-22, -16, w, 32, 16);
      L.add([g, this.add.image(-4, 0, 'ic_' + icon).setIconScale(0.36), t, T(this, (w - 44) / 2, -26, _t('s.despues'), { size: 11, color: C.muted })]);
      L.setSize(w, 32).setInteractive();
      L.on('pointerover', () => this.tip.show(L.x - 140, L.y + 26, _t('s.ojo_de_buho_despues_0', { 0: it.name }), this.intentDesc(it), { kws: intentKws(it), max: 4 }));
      L.on('pointerout', () => this.tip.hide());
    }

    renderLog() {
      if (this.logPanel.visible) this.logText.setText(this.logLines.map((l) => _t(l)).join('\n'));   // mensajes {k, v}: se traducen al pintar
    }

    async finish(result) {
      this.endBtn.setEnabled(false);
      this.busy = true;
      // Compendio: enemigo vencido o que te ha derrotado; se guarda todo lo acumulado en el combate
      Codex.add('enemies', this.fe.id, result === 'win' ? 'kills' : 'deaths');
      Codex.track(this.run); Codex.flush();
      // Logros de combate: se comprueban antes de cerrar el combate (Intocable necesita sus datos)
      const meta = loadMeta();
      notifyAchievements(this, M.onCombatEnd(meta, this.run, this.run.combat));
      saveMeta(meta);
      await wait(this, 350);
      banner(this, result === 'win' ? _t('s.victoria') : _t('s.derrota'), result === 'win' ? C.gold : C.blood, 1100);
      await wait(this, 1300);
      // Fin del combate de jefe: vuelta a la música normal, o silencio si la partida ha terminado
      if (this.run.combat && this.run.combat.kind === 'boss') { if (this.run.over) Music.stop(1500); else Music.base(); }
      E.closeCombat(this.run);
      go(this);
    }
  }

  /* =================================================================
   * Recompensa tras combate
   * ================================================================= */
  /** Sendas: «✦ Encaja con tu mazo» encima de una carta que comparte senda con 3+ cartas de tu mazo. */
  function fitBadge(scene, x, y, run, id, counts) {
    if (!run || !E.fitsDeck(run, id, counts)) return null;
    const t = T(scene, 9, 0, _t('path.fits'), { size: 14, bold: true, color: C.gold });
    const w = t.width + 34, cont = scene.add.container(x, y);
    const g = scene.add.graphics(); g.fillStyle(0x1a1408, 0.95); g.fillRoundedRect(-w / 2, -12, w, 24, 12); g.lineStyle(1.5, C.gold, 0.9); g.strokeRoundedRect(-w / 2, -12, w, 24, 12);
    // ✦ dibujada (las fuentes no traen el símbolo)
    const sx = -w / 2 + 15, P = []; for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + k * Math.PI / 4, rr = k % 2 ? 2.2 : 7; P.push(new Phaser.Geom.Point(sx + Math.cos(a) * rr, Math.sin(a) * rr)); }
    g.fillStyle(C.gold, 1); g.fillPoints(P, true);
    cont.add([g, t.setPosition(9, 0)]);
    return cont;
  }

  // Combates en grupo (Parche 3.2): estos campos de la escena son de cada enemigo. this.enemy, this.eBar… leen y
  // escriben la vista del enemigo this.foeIdx (animate lo pone según ev.ei; eachFoe recorre todos). this.fe = sus datos.
  /** Referencias de Combat que solo existen en algunos combates (se ponen a null al entrar en la escena). */
  const STALE_COMBAT_KEYS = [
    // Game feel (3.5)
    'lowHp', 'aim', 'aimFx', 'turnBox', 'orbRed', 'mageCastFx', 'orbXY',
    // Guardiana
    'runeLayer', 'runePow', 'runeObjs', 'runeChoice',
    // Electromante
    'staticBox', 'staticSegs', 'staticT', 'staticHit', 'staticGeom', 'staticCrackle', 'staticShown',
    // Criomante / Paladín
    'pIce', 'iceBar', 'palAura', 'ghost',
    // Enemigo (startBlock, Juicio, Magnetizado, Congelado, afijos, intención siguiente…)
    'iceShield', 'judgMark', 'magnetMark', 'freezeFx', 'affixAura', 'intentGlow', 'intentChill', 'nextIntent', 'enemyTint',
    // Interfaz que se crea más tarde o solo a veces
    'dmgPreview', 'comboT', 'targetTween', 'energyHit', 'reticle', 'reticleTw', 'sumLayer', 'sumViews', 'sumTarget',
    'logPanel', 'logText', 'gemBox', 'modalNav', 'padFm', 'dropHint', 'introing'
  ];
  const FOE_KEYS = ['enemy', 'eBar', 'eBlock', 'eStatus', 'eName', 'intent', 'nextIntent', 'lastIntentKind', 'judgMark', 'magnetMark', 'intentGlow', 'intentChill',
    'freezeFx', 'enemyTint', 'eRestX', 'eLean', 'shownBurn', 'iceShield', 'enemyShadow', 'enemyIdle', 'enemyBaseScale', 'eX', 'eY', 'affixAura', 'dmgPreview'];
  for (const k of FOE_KEYS) Object.defineProperty(Combat.prototype, k, {
    configurable: true,
    get() { const f = this.foes && this.foes[this.foeIdx || 0]; return f ? f[k] : undefined; },
    set(v) { if (!this.foes) this.foes = []; const i = this.foeIdx || 0; (this.foes[i] = this.foes[i] || {})[k] = v; }
  });
  Object.defineProperty(Combat.prototype, 'fe', { configurable: true, get() { const c = this.run && this.run.combat; return c ? c.enemies[this.foeIdx || 0] || c.enemy : undefined; } });

  class Reward extends Phaser.Scene {
    constructor() { super('Reward'); }
    create() {
      U.padNav(this);   // mando / flechas
      this.takeRelic = null;
      const run = this.run = this.registry.get('run');
      const p = run.pending;
      U.sceneBackdrop(this, 'treasure', 'forest');   // tesoro tras el combate
      this.tip = tooltip(this);
      this.hud = hud(this, run, { tip: this.tip });
      heading(this, 108, _t('s.victoria'));
      p.cards.forEach((id) => Codex.see('cards', id));
      if (p.relic) Codex.see('relics', p.relic);
      if (p.potion) Codex.see('potions', p.potion);
      const gl = this.add.container(640, 168);
      gl.add([this.add.image(-40, 0, 'ic_coin').setIconScale(0.42), T(this, 0, 0, _t('s.0_oro', { 0: p.gold }), { size: SZ.body, bold: true, color: C.gold, ox: 0.2 })]);
      if (p.gold > 0 && !FX_DONE.has(p)) { FX_DONE.add(p); A.coins(this, this.hud, 600, 168, run.gold - p.gold, run.gold); }   // una vez por botín

      let cardsY = 448;
      const golden = !!(p.golden && p.relicAlt);   // Élite Dorada: 2 reliquias, te quedas con una
      const both = !!(p.relic && (p.potion || golden)), bw = both ? 400 : 460;   // reliquia y poción (o las dos reliquias), lado a lado
      if (p.relic || p.potion) cardsY = 470;
      if (p.potion && !golden) this.potionBox(p, both ? 852 : 640, 226, bw);
      if (golden) {
        if (p.relicAlt) Codex.see('relics', p.relicAlt);
        T(this, 640, 272, _t('rew.goldenPick'), { size: SZ.small, bold: true, color: C.gold }).setLetterSpacing(1);
      }
      const relicBoxes = [];
      const relicBox = (id, x, alt) => {
        const r = D.RELICS[id];
        const box = this.add.container(x, 226);
        const bg = this.add.graphics(); Panel.draw(bg, -bw / 2, -30, bw, 60);
        const ic = this.add.image(-bw / 2 + 34, 0, 'ic_' + r.icon).setIconScale(0.6);
        const nm = T(this, -bw / 2 + 70, -10, r.name, { size: SZ.body, bold: true, color: C.gold, ox: 0 });
        const ds = T(this, -bw / 2 + 70, 13, r.text, { size: SZ.small, ox: 0, color: C.parch });
        U.fitLine(ds, bw - 84);
        U.fitLine(nm, bw - 84, SZ.small);
        box.add([bg, ic, nm, ds]).setSize(bw, 60).setInteractive({ useHandCursor: true });
        const take = () => {
          if (!E.takeRewardRelic(run, alt)) return;
          Sfx.play('coin');
          U.saveRun(run);
          A.flyIcon(this, 'ic_' + r.icon, box.x - bw / 2 + 34, 226, this.hud.relicPos(run.relics.length - 1), 0.6).then(() => this.hud.refresh());
          nm.setText(r.name + _t('s.obtenida'));
          relicBoxes.forEach((b) => { b.disableInteractive(); if (b !== box) this.tweens.add({ targets: b, alpha: 0.35, duration: DUR.screen }); });
          burst(this, box.x, 226, C.gold, 18, 80);
        };
        relicBoxes.push(box);
        if (p.relicTaken) { if (p.relicPicked === id || (!p.relicPicked && !alt)) nm.setText(r.name + _t('s.obtenida')); else box.setAlpha(0.35); box.disableInteractive(); } else box.on('pointerup', take);
        if (!alt) this.takeRelic = take;
      };
      if (p.relic) relicBox(p.relic, both ? 428 : 640, false);
      if (golden) relicBox(p.relicAlt, 852, true);

      const full = !p.cardTaken && E.deckFull(run);   // Personalizado «Mazo pequeño»: con 15 cartas solo se puede omitir
      T(this, 640, cardsY - 168, p.cardTaken ? _t('s.carta_anadida_a_tu_mazo') : full ? _t('cust.deckFull', { n: E.CUSTOM_DECK_MAX }) : _t('s.elige_una_carta_para_tu_2'), { size: SZ.body, color: full ? C.flame : C.parch });
      if (!p.cardTaken) {
        const counts = E.pathCounts(run);
        p.cards.forEach((id, i) => {
          const card = { uid: -10 - i, id, up: false };
          const cv = cardView(this, card);
          const x = 640 + (i - (p.cards.length - 1) / 2) * (p.cards.length > 3 ? 200 : 220);
          cv.setPosition(x, cardsY).setScale(1.12).setDepth(LY.units + 2);
          if (full) cv.setAlpha(0.45);
          const fit = fitBadge(this, x, cardsY - 141, run, id, counts);   // Sendas
          if (fit) fit.fitBadge = true;
          cv.setInteractive({ useHandCursor: true });
          this.flipIn(cv, i, D.CARDS[id].rarity);   // boca abajo → se voltean una a una (las raras, con rayos detrás)
          cv.on('pointerover', () => {
            this.tweens.add({ targets: cv, scale: 1.22, duration: DUR.hover });
            showGloss(this, card, { x, y: cardsY, scale: 1.22 });
          });
          cv.on('pointerout', () => { this.tweens.add({ targets: cv, scale: 1.12, duration: DUR.hover }); this.tip.hide(); hideGloss(this); });
          cv.on('pointerup', () => {
            if (!E.takeRewardCard(run, id)) { if (E.deckFull(run)) { toast(this, _t('cust.deckFull', { n: E.CUSTOM_DECK_MAX }), C.blood); Sfx.play('deny'); } return; }
            Sfx.play('card');
            this.tip.hide();
            hideGloss(this);
            this.children.list.filter((o) => o.cardData).forEach((o) => o.disableInteractive());   // el foco (mando) pasa a «Continuar»
            this.children.list.filter((o) => o.cardData && o !== cv).forEach((o) => this.tweens.add({ targets: o, alpha: 0, duration: DUR.screen }));
            this.children.list.filter((o) => o.cardData && o.raysFx).forEach((o) => { this.tweens.add({ targets: o.raysFx, alpha: 0, duration: DUR.screen }); });
            this.children.list.filter((o) => o.fitBadge).forEach((o) => o.destroy());
            this.tweens.add({ targets: cv, x: 1004, y: 25, scale: 0.1, alpha: 0.2, duration: DUR.screen, ease: 'Quad.in', onComplete: () => cv.destroy() });
            this.hud.refresh(); U.saveRun(run);
            this.skipBtn.setLabel(_t('s.continuar'));
            this.deckBtn.setVisible(true);
          });
        });
      }
      this.skipBtn = button(this, 640, 668, p.cardTaken ? _t('s.continuar') : _t('s.omitir_carta'), () => {
        if (this.takeRelic) this.takeRelic();
        if (p.potion && !p.potionTaken) E.takeRewardPotion(run);   // solo si cabe: si el cinturón está lleno, se queda
        E.leaveScreen(run); go(this);
      }, { w: 240, variant: p.cardTaken ? 'primary' : 'secondary' });
      // Tras coger la carta: ver el mazo sin salir de la recompensa
      this.deckBtn = button(this, 900, 668, _t('s.ver_mazo'), () => this.scene.launch('DeckView', { mode: 'view', title: _t('s.tu_mazo') }), { w: 180, variant: 'secondary' })
        .setVisible(!!p.cardTaken);
      // Ojo del Sabio (Santuario): relanza las cartas ofrecidas
      if (!p.cardTaken && run.rerolls > 0) {
        this.rerollBtn = button(this, 380, 668, _t('rew.reroll', { n: run.rerolls }), () => {
          if (!E.rerollRewardCards(run)) return;
          Sfx.play('card'); U.saveRun(run); this.scene.restart();
        }, { w: 200, variant: 'secondary' });
      }
      if (!p.cardTaken) showTip(this, 'recompensa', { x: 640 - 220 - 96, y: cardsY - 132, w: 440 + 192, h: 264 });
      potionTip(this);
    }

    /** La poción del botín como un objeto más: al pulsarla se guarda; con el cinturón lleno, eliges cuál sustituir. */
    potionBox(p, x, y, w) {
      const run = this.run, d = D.POTIONS[p.potion];
      const box = this.add.container(x, y);
      const bg = this.add.graphics();
      Panel.draw(bg, -w / 2, -36, w, 72, { raised: true });
      bg.lineStyle(TH.borderWidth, d.rarity === 'rare' ? C.gold : d.color, 1); bg.strokeRoundedRect(-w / 2, -36, w, 72, TH.radius);   // borde: rareza / color de la poción
      const fl = this.add.graphics().setPosition(-w / 2 + 34, 2);
      const draw = (time) => { fl.clear(); U.drawFlask(fl, d.shape, d.color, { t: time / 1000, scale: 1.25 }); };
      draw(0); this.events.on('update', draw); this.events.once('shutdown', () => this.events.off('update', draw));
      const nm = T(this, -w / 2 + 70, -18, `${d.name} · ${D.POTION_RARITY_LABEL[d.rarity]}`, { size: SZ.body, bold: true, color: C.gold, ox: 0 });
      U.fitText(nm, w - 84, 0, SZ.micro);
      const ds = T(this, -w / 2 + 70, -5, d.text, { size: SZ.small, ox: 0, oy: 0, color: C.parch, wrap: w - 84, lineSpacing: -3 });
      U.fitText(ds, w - 84, 38, SZ.micro);   // hasta dos líneas dentro de la caja
      box.add([bg, fl, nm, ds]).setSize(w, 72);
      const done = () => { nm.setText(d.name + _t('s.guardada')); box.disableInteractive(); burst(this, x, y, d.color, 18, 80); };
      if (p.potionTaken) { nm.setText(d.name + _t('s.guardada')); return; }
      box.setInteractive({ useHandCursor: true });
      box.on('pointerup', () => {
        if (E.takeRewardPotion(run)) {
          Sfx.play('fire_small', { volume: 0.5 }); U.saveRun(run); done();
          A.flyFlask(this, p.potion, x - w / 2 + 34, y, this.hud.potionPos(run.potions.lastIndexOf(p.potion))).then(() => this.hud.refresh());
          return;
        }
        this.replacePotion(p, done);   // cinturón lleno
      });
    }
    /** Cinturón lleno: elige qué poción sustituir (o cancela). */
    replacePotion(p, done) {
      const run = this.run, n = run.potions.length;
      const layer = this.add.container(0, 0).setDepth(LY.modal);
      const blocker = this.add.zone(0, 0, 1280, 720).setOrigin(0, 0).setInteractive();
      const dim = this.add.rectangle(640, 360, 1280, 720, TC.shade, TH.alpha.curtain);
      const W = Math.max(440, n * 150 + 40), g = this.add.graphics();
      Panel.draw(g, 640 - W / 2, 250, W, 274);
      layer.add([blocker, dim, g,
        T(this, 640, 280, _t('s.tu_cinturon_esta_lleno'), { size: SZ.h3, bold: true, color: C.gold }),
        T(this, 640, 310, _t('s.que_pocion_sustituyes_por_0', { 0: D.POTIONS[p.potion].name }), { size: SZ.small, color: C.parch })]);
      run.potions.forEach((id, i) => {
        const d = D.POTIONS[id], x = 640 + (i - (n - 1) / 2) * 150;
        const fl = this.add.graphics().setPosition(x, 360); U.drawFlask(fl, d.shape, d.color, { scale: 1.3 });
        const b = button(this, x, 420, d.name, () => {
          if (!E.takeRewardPotion(run, i)) return;
          Sfx.play('fire_small', { volume: 0.5 }); layer.destroy(); this.hud.refresh(); U.saveRun(run); done();
        }, { w: 138, h: TH.button.minH, size: SZ.small, variant: 'option' });
        layer.add([fl, b]);
      });
      layer.add(button(this, 640, 486, _t('s.dejarla'), () => layer.destroy(), { w: 160, h: TH.button.minH, size: SZ.small, variant: 'secondary', role: 'back' }));
    }
  }

  /* =================================================================
   * Tienda
   * ================================================================= */
  /** Recompensa: la carta aparece boca abajo y se voltea (i: orden). Raras y legendarias, con rayos de luz detrás. */
  Reward.prototype.flipIn = function (cv, i, rarity) {
    const rare = rarity === 'rare' || rarity === 'legendary';
    const showRays = () => { if (rare) { const r = FL.rays(this, cv.x, cv.y, rarity === 'legendary' ? TH.game.flame : C.gold, 190); r.setDepth(LY.units + 1); cv.raysFx = r; cv.once('destroy', () => r.destroy()); } };
    if (U.Opts.reduceMotion) { showRays(); return; }
    const back = this.add.image(0, 0, 'cardback').setDisplaySize(U.CARD_W, U.CARD_H);
    cv.add(back);
    cv.disableInteractive();
    const sx = cv.scaleX;
    this.tweens.chain({ targets: cv, tweens: [
      { scaleX: 0, duration: DUR.hover, delay: DUR.screen + i * 230, ease: 'Quad.in', onComplete: () => { back.destroy(); Sfx.play('card', { volume: 0.5 }); } },
      { scaleX: sx, duration: DUR.screen, ease: 'Back.out', onComplete: () => { if (cv.scene && cv.input) cv.setInteractive(); showRays(); if (rare) burst(this, cv.x, cv.y, C.gold, 18, 110); } }
    ] });
  };

  class Shop extends Phaser.Scene {
    constructor() { super('Shop'); }
    create() {
      U.padNav(this);   // mando / flechas
      this.run = this.registry.get('run');
      U.sceneBackdrop(this, 'shop');   // tienda y Mercader Ambulante
      this.tip = tooltip(this);
      this.hud = hud(this, this.run, { tip: this.tip });
      this.peddler = !!this.run.pending.peddler;   // Parche 3.5: Mercader Ambulante (3 objetos rebajados, solo uno)
      if (this.peddler) heading(this, 96, D.NODE_TYPES.peddler.name, _t('shop.peddlerSub'), C.gold);
      else heading(this, 96, _t('s.tienda_del_bosque'), _t('s.todo_a_buen_precio_para'));
      this.layer = this.add.container(0, 0);
      this.render();
      button(this, 1120, 668, this.peddler ? _t('shop.peddlerLeave') : _t('s.salir_de_la_tienda'), () => { E.leaveScreen(this.run); go(this); }, { w: 240 });
      showTip(this, 'tienda', { x: 160, y: 206, w: 960, h: 262 });
    }
    priceTag(x, y, price) {
      const ok = this.run.gold >= price;
      return [this.add.image(x - 24, y, 'ic_coin').setIconScale(0.34), T(this, x - 8, y, String(price), { size: 20, bold: true, color: ok ? C.gold : C.blood, ox: 0 })];
    }
    render() {
      const run = this.run, s = run.pending.stock;
      s.cards.forEach((x) => Codex.see('cards', x.id)); s.relics.forEach((x) => Codex.see('relics', x.id));
      (s.potions || []).forEach((x) => Codex.see('potions', x.id));
      this.layer.removeAll(true);
      this.hud.refresh();
      const counts = E.pathCounts(run);
      const ped = this.peddler;
      s.cards.forEach((item, i) => {
        const x = ped ? 640 : 248 + i * 196, y = 318;
        if (item.sold) { this.layer.add(T(this, x, y, _t('s.vendida'), { size: 22, color: C.muted, style: 'italic' })); return; }
        const card = { uid: -20 - i, id: item.id, up: false };
        const cv = cardView(this, card).setPosition(x, y).setScale(0.95);
        cv.setInteractive({ useHandCursor: true });
        cv.on('pointerover', () => {
          this.tweens.add({ targets: cv, scale: 1.04, duration: 90 });
          showGloss(this, card, { x, y, scale: 1.04 });
        });
        cv.on('pointerout', () => { this.tweens.add({ targets: cv, scale: 0.95, duration: 90 }); this.tip.hide(); hideGloss(this); });
        cv.on('pointerup', () => {
          if (E.deckFull(run)) { toast(this, _t('cust.deckFull', { n: E.CUSTOM_DECK_MAX }), C.blood); Sfx.play('deny'); return; }   // Mazo pequeño
          this.buy(() => E.buyCard(run, i), item.price);
        });
        this.layer.add([cv, ...this.priceTag(x, y + 128, item.price)]);
        const fit = fitBadge(this, x, y + 154, run, item.id, counts);   // Sendas: debajo del precio
        if (fit) this.layer.add(fit);
      });
      const relLbl = T(this, ped ? 380 : 160, 520, _t('s.reliquias'), { size: 16, bold: true, color: C.gold, ox: 0 }).setLetterSpacing(2);
      if (s.relics.length) this.layer.add(relLbl); else relLbl.destroy();
      s.relics.forEach((item, i) => {
        const r = D.RELICS[item.id], x = ped ? 440 : 220 + i * 170, y = 590;
        if (item.sold) { this.layer.add(T(this, x, y, _t('s.vendida'), { size: 18, color: C.muted, style: 'italic' })); return; }
        const ring = this.add.circle(x, y, 34, C.panel2).setStrokeStyle(2, C.gold, 1).setInteractive({ useHandCursor: true });
        const ic = this.add.image(x, y, 'ic_' + r.icon).setIconScale(0.7);
        const locked = E.hasPact(run, 'bolsillos');   // Pacto Bolsillos rotos: no se compran reliquias
        ring.on('pointerover', () => this.tip.show(x + 40, y - 120, r.name, r.text + (locked ? _t('s.pacto_bolsillos_rotos_no_puedes') : '')));
        ring.on('pointerout', () => this.tip.hide());
        ring.on('pointerup', () => { if (locked) { toast(this, _t('s.pacto_bolsillos_rotos_no_puedes_2'), C.blood); Sfx.play('deny'); return; } this.buy(() => E.buyRelic(run, i), item.price, () => A.flyIcon(this, 'ic_' + r.icon, x, y, this.hud.relicPos(run.relics.length - 1), 0.7)); });
        if (locked) { ring.setAlpha(0.45); ic.setAlpha(0.45); }
        this.layer.add([ring, ic, ...this.priceTag(x, y + 52, item.price)]);
      });
      // Pociones (tiendas guardadas antes de las pociones no tienen esta fila)
      if (s.potions && s.potions.length) {
        this.layer.add(T(this, ped ? 780 : 900, 520, _t('s.pociones'), { size: 16, bold: true, color: C.gold, ox: 0 }).setLetterSpacing(2));
        const full = !(run.potions || []).some((x) => !x);
        s.potions.forEach((item, i) => {
          const d = D.POTIONS[item.id], x = ped ? 840 : 940 + i * 100, y = 580;
          if (item.sold) { this.layer.add(T(this, x, y, _t('s.vendida'), { size: 16, color: C.muted, style: 'italic' })); return; }
          const ring = this.add.circle(x, y, 32, C.panel2).setStrokeStyle(2, d.rarity === 'rare' ? C.gold : C.line, 1).setInteractive({ useHandCursor: true });
          const fl = this.add.graphics().setPosition(x, y + 2); U.drawFlask(fl, d.shape, d.color, { scale: 1.35 });
          ring.on('pointerover', () => this.tip.show(x - 260, y - 150, d.name, `${D.POTION_RARITY_LABEL[d.rarity]}\n${d.text}${full ? _t('shop.beltFull') : ''}`));
          ring.on('pointerout', () => this.tip.hide());
          ring.on('pointerup', () => {
            if (!(run.potions || []).some((x2) => !x2)) { toast(this, _t('s.tu_cinturon_de_pociones_esta'), C.blood); Sfx.play('deny'); return; }
            this.buy(() => E.buyPotion(run, i), item.price, () => A.flyFlask(this, item.id, x, y, this.hud.potionPos(run.potions.lastIndexOf(item.id))));
          });
          this.layer.add([ring, fl, ...this.priceTag(x, y + 50, item.price)]);
        });
      }
      // Servicio de purga (el Mercader Ambulante no purga)
      if (s.removePrice === null || s.removePrice === undefined) return;
      const rx = 700, ry = 590;
      const done = s.removed;
      const box = this.add.graphics();
      Panel.draw(box, rx - 150, ry - 44, 300, 88, { glass: true });   // translúcido sobre el fondo de la tienda (sin violeta)
      if (done) box.setAlpha(0.7);
      const t1 = T(this, rx, ry - 16, done ? _t('s.purga_realizada') : _t('s.purgar_una_carta'), { size: 22, font: 'display', color: done ? C.muted : C.parch });
      const t2 = T(this, rx, ry + 14, done ? _t('s.solo_una_por_visita') : _t('s.eliminala_de_tu_mazo_para'), { size: 14, color: C.muted });
      this.layer.add([box, t1, t2]);
      if (!done) {
        if (s.removePrice === 0) this.layer.add(T(this, rx, ry + 62, _t('s.gratis_purificacion'), { size: 17, bold: true, color: 0xc9a8ff }));   // Santuario
        else this.layer.add(this.priceTag(rx, ry + 62, s.removePrice));
        const hit = this.add.rectangle(rx, ry, 300, 88, 0, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => {
          if (run.gold < s.removePrice) { toast(this, _t('s.oro_insuficiente'), C.blood); Sfx.play('deny'); return; }
          this.scene.launch('DeckView', {
            mode: 'remove', title: _t('s.elige_la_carta_a_purgar'), cancelable: true,
            onPick: (uid) => { if (E.shopRemove(run, uid)) { Sfx.play('coin'); U.saveRun(run); this.render(); } }
          });
        });
        this.layer.add(hit);
      }
    }
    buy(fn, price, fly) {
      if (this.run.gold < price) { toast(this, _t('s.oro_insuficiente'), C.blood); Sfx.play('deny'); return; }
      const g0 = this.run.gold;
      if (fn()) {
        Sfx.play('coin'); this.tip.hide(); U.saveRun(this.run); this.render();
        this.hud.countGold(g0, this.run.gold, 420);
        if (fly) fly();
      }
    }
  }

  /* =================================================================
   * Hoguera
   * ================================================================= */
  class Rest extends Phaser.Scene {
    constructor() { super('Rest'); }
    create() {
      U.padNav(this);   // mando / flechas
      const run = this.run = this.registry.get('run');
      U.sceneBackdrop(this, 'rest');   // la hoguera ya está pintada en el fondo (brasas que suben)
      this.tip = tooltip(this);
      this.hud = hud(this, run, { tip: this.tip });
      if (!this.textures.exists('bg_rest')) {   // sin fondo ilustrado: la hoguera dibujada de antes
        const fire = this.add.image(640, 290, 'ic_campfire').setIconScale(3.2);
        this.tweens.add({ targets: fire, scaleY: 3.35 * U.icK(fire), duration: DUR.screen, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      U.ambientLoop(this, 'fire_crackle_loop', 0.35, DUR.pulse);   // crepitar en bucle (se apaga al salir)
      heading(this, 104, _t('s.hoguera'), _t('s.las_brasas_crepitan_puedes_descansar'));
      this.layer = this.add.container(0, 0);
      this.render();
      if (!run.pending.done) showTip(this, 'hoguera', { x: 306, y: 486, w: 668, h: 68 });
    }
    render() {
      const run = this.run, p = run.pending;
      this.layer.removeAll(true);
      if (!p.done) {
        const healN = Math.min(E.restHealAmount(run), run.maxHp - run.hp);
        const noHeal = E.restHealAmount(run) <= 0;   // Núcleo Solar: las hogueras ya no curan
        const insomne = E.hasRelic(run, 'insomne');   // Ojo del Insomne: ni descansar ni mejorar
        const restBtn = button(this, 470, 520, noHeal ? (E.hasPact(run, 'descanso') ? _t('s.descansar_pacto_sin_descanso') : insomne ? _t('rest.insomne') : _t('s.descansar_nucleo_solar')) : _t('s.descansar_0_pv', { 0: healN }), () => {
          const h = E.restHeal(run);
          floatText(this, 640, 300, _t('s.0_pv', { 0: h }), C.leaf, 44); Sfx.play('heal');
          this.hud.refresh(); U.saveRun(run); this.render();
        }, { w: 320, h: 64, size: SZ.h3, variant: 'option' });   // las dos opciones de la hoguera: filas «option»
        restBtn.setEnabled(!noHeal);
        this.layer.add(restBtn);
        const upgradable = run.deck.filter(E.canUpgrade);
        const upBtn = button(this, 810, 520, _t('s.mejorar_una_carta'), () => {
          this.scene.launch('DeckView', {
            mode: 'upgrade', title: _t('s.elige_la_carta_a_mejorar'), cancelable: true,
            onPick: (uid) => { if (E.restUpgrade(run, uid)) { Sfx.play('win'); U.saveRun(run); this.render(); } }
          });
        }, { w: 320, h: 64, size: SZ.h3, variant: 'option' });
        upBtn.setEnabled(upgradable.length > 0 && !insomne);
        if (insomne) upBtn.setLabel(_t('rest.insomneUp'));
        this.layer.add(upBtn);
        if (insomne) this.layer.add(button(this, 640, 610, _t('s.continuar'), () => { E.leaveScreen(run); go(this); }, { w: 240, variant: 'primary' }));
      } else {
        this.layer.add(T(this, 640, 470, _t('s.recuperas_el_aliento_junto_al'), { size: SZ.body, style: 'italic', color: C.parch }));
        this.layer.add(button(this, 640, 560, _t('s.continuar'), () => { E.leaveScreen(run); go(this); }, { w: 240, variant: 'primary' }));
      }
    }
  }

  /* =================================================================
   * Cofre
   * ================================================================= */
  class Chest extends Phaser.Scene {
    constructor() { super('Chest'); }
    create() {
      U.padNav(this);   // mando / flechas
      const run = this.run = this.registry.get('run');
      const p = run.pending;
      U.sceneBackdrop(this, 'treasure', 'forest');
      this.tip = tooltip(this);
      this.hud = hud(this, run, { tip: this.tip });
      heading(this, 104, _t('s.cofre_antiguo'), _t('s.cubierto_de_musgo_pero_el'));
      const chest = this.add.image(640, 320, 'ic_chest').setIconScale(3);
      const btn = button(this, 640, 560, p.taken ? _t('s.continuar') : _t('s.abrir'), async () => {
        if (p.taken) { E.leaveScreen(run); go(this); return; }
        btn.setEnabled(false);
        const g0 = run.gold;
        await A.chestOpen(this, chest);   // sacudida, apertura y haz de luz
        E.takeChest(run);
        Sfx.play('coin');
        U.saveRun(run);
        const objs = this.reveal(p);
        A.popOut(this, objs, 330);       // el objeto sale del cofre
        if (p.relic) this.time.delayedCall(900, () => A.flyIcon(this, 'ic_' + D.RELICS[p.relic].icon, 640, 440, this.hud.relicPos(run.relics.length - 1), 0.62).then(() => this.hud.refresh()));
        else A.coins(this, this.hud, 640, 470, g0, run.gold);
        btn.setLabel(_t('s.continuar')); btn.setEnabled(true);
      }, { w: 240 });
      if (p.taken) this.reveal(p);
      else showTip(this, 'cofre', { x: 540, y: 222, w: 200, h: 196 });
    }
    /** Muestra lo que había en el cofre; devuelve los objetos (para animar su salida). */
    reveal(p) {
      if (p.relic) Codex.see('relics', p.relic);
      if (p.relic) {
        const r = D.RELICS[p.relic];
        const ring = this.add.circle(640, 440, 30, C.panel2).setStrokeStyle(2, C.gold);
        const ic = this.add.image(640, 440, 'ic_' + r.icon).setIconScale(0.62);
        A.shine(ic);
        return [ring, ic, T(this, 640, 486, r.name, { size: 24, font: 'display', color: C.gold }), T(this, 640, 512, r.text, { size: 17, color: C.parch })];
      }
      return [T(this, 640, 470, _t('s.solo_quedaban_monedas_0_oro', { 0: p.gold }), { size: 22, color: C.gold })];
    }
  }

  /* =================================================================
   * Evento
   * ================================================================= */
  const EVENT_ART = {
    altar: ['ic_campfire', 1.5], mercader: ['ic_bag', 1.5], fuente: ['ic_snow', 1.5], hongos: ['art_shroom', null],
    forja: ['ic_burst', 1.5], ermitano: ['ic_book', 1.5], lobezno: ['art_wolf', null], cofre: ['ic_chest', 1.5], estatua: ['ic_crown', 1.5],
    alquimista: ['ic_flask', 1.5], lago: ['ic_snow', 1.5], hoguera2: ['ic_campfire', 1.5], mercader2: ['ic_bag', 1.5], altar2: ['ic_snow', 1.5],
    // Parche 3.5
    socio: ['ic_bag', 1.5], favorespiritu: ['ic_ghost', 1.5], eclosion: ['ic_wyrm', 1.5], archivero: ['ic_book', 1.5], geoda: ['ic_prism', 1.5],
    portal: ['ic_globe', 1.5], corona: ['ic_crown', 1.5], cobrador: ['ic_coin', 1.5], espiritu: ['ic_ghost', 1.5], avalancha: ['ic_snow', 1.5],
    herrero: ['ic_hammer', 1.5], termas: ['ic_drop', 1.5], posada: ['ic_campfire', 1.5], santuario: ['ic_sun', 1.5], bardo: ['ic_horn', 1.5],
    ladrona: ['ic_bag', 1.5], forjanodo: ['ic_hammer', 1.5], altarmaldito: ['ic_cursecard', 1.5], contrato: ['ic_contract', 1.5]
  };

  /** Eventos que ocurren en una fragua (fondo bg_forge). */
  const FORGE_EVENTS = ['forjanodo', 'forja', 'herrero'];
  class EventScene extends Phaser.Scene {
    constructor() { super('Event'); }
    create() {
      U.padNav(this);   // mando / flechas
      const run = this.run = this.registry.get('run');
      const p = run.pending, ev = D.EVENTS[p.id];
      Codex.see('events', p.id);   // Parche 3.6: los eventos vistos cuentan para los hitos del compendio
      U.sceneBackdrop(this, FORGE_EVENTS.includes(p.id) ? 'forge' : 'altar');   // forja y herrería: fragua · el resto (y el Altar Maldito): altar
      this.tip = tooltip(this);
      this.hud = hud(this, run, { tip: this.tip });
      const g = this.add.graphics();
      Panel.draw(g, 260, 70, 760, 620, { glass: true });   // translúcido: se ve el fondo detrás
      const [art, sc] = EVENT_ART[p.id] || ['ic_question', 1.5];
      this.add.image(640, 150, art).setIconScale(sc !== null ? sc : U.heightScale(this, art, 110));
      U.fitLine(T(this, 640, 236, ev.title, { size: SZ.h1, font: 'display', color: C.gold }), 700, SZ.h2);   // título de pantalla (h1)
      T(this, 640, 300, ev.text, { size: SZ.body, wrap: 660, align: 'center', lineSpacing: 3 });
      this.layer = this.add.container(0, 0);
      this.render();
      const nVis = ev.choices.filter((ch, i) => E.eventChoiceState(run, i).show).length;
      if (!p.result) showTip(this, 'evento', { x: 310, y: 371, w: 660, h: 74 * (nVis - 1) + 58 });
    }
    render() {
      const run = this.run, p = run.pending, ev = D.EVENTS[p.id];
      this.layer.removeAll(true);
      if (!p.result) {
        // Parche 3.5: las opciones de clase, reliquia, oro o PV que no te tocan no se ven (show); las bloqueadas, sí (cond)
        const vis = ev.choices.map((ch, i) => i).filter((i) => E.eventChoiceState(run, i).show);
        vis.forEach((i, k) => {
          const ch = ev.choices[i], blocked = !E.eventChoiceState(run, i).ok;
          const label = blocked && ch.condText ? `${ch.label} — ${ch.condText}` : (ch.desc ? `${ch.label} — ${ch.desc}` : ch.label);
          const b = button(this, 640, 400 + k * 74, label, () => {
            E.eventChoose(run, i);
            this.hud.refresh(); U.saveRun(run); Sfx.play('click');
            this.render();
            if (p.result && p.result.pick && !p.result.picked) this.openPick();
          }, { w: 660, h: 58, size: SZ.body, variant: k === vis.length - 1 && vis.length > 2 && !ch.desc ? 'secondary' : 'option' });   // elegir: filas «option»; «Irse»: secundario
          if (blocked) b.setEnabled(false);
          this.layer.add(b);
        });
      } else {
        this.layer.add(T(this, 640, 440, p.result.text, { size: SZ.body, wrap: 640, align: 'center', color: C.flame, style: 'italic' }));
        const pending = !!p.result.pick && !p.result.picked;
        this.layer.add(button(this, 640, 580, pending ? _t('s.elegir_carta') : _t('s.continuar'), () => {
          if (pending) { this.openPick(); return; }
          E.leaveScreen(run); go(this);
        }, { w: 240, variant: 'primary' }));
      }
    }
    /** Elección de carta del evento: purgar (1 o 2), duplicar o quedarte una entre varias. */
    openPick() {
      const run = this.run, r = run.pending.result, n = r.count || 1, k = (r.picks || 0) + 1;
      const step = n > 1 ? ` (${k}/${n})` : '';
      const done = () => {
        U.saveRun(run); this.hud.refresh(); this.render();
        if (r.pick && !r.picked) this.time.delayedCall(60, () => this.openPick());   // siguiente de 2
      };
      if (r.pick === 'choose') {
        const cards = r.options.map((id, i) => ({ uid: -100 - i, id, up: false }));
        this.scene.launch('DeckView', { mode: 'choose', title: _t('s.elige_una_carta') + step, cards, cancelable: false,
          onPick: (uid) => { E.eventPick(run, cards.find((c) => c.uid === uid).id); done(); } });
        return;
      }
      const dup = r.pick === 'duplicate';
      const ok = new Set(E.eventPickable(run));
      // Parche 3.5: mejorar (Herrero), transmutar y fusionar (Forja)
      const title = { duplicate: _t('s.elige_la_carta_a_duplicar'), upgrade: _t('s.elige_la_carta_a_mejorar'), transform: _t('ev.pick.transform'), fuse: _t('ev.pick.fuse') }[r.pick] || _t('s.elige_la_carta_a_quitar');
      this.scene.launch('DeckView', {
        mode: dup ? 'duplicate' : r.pick === 'upgrade' ? 'upgrade' : 'remove', title: title + step, cancelable: false,
        confirm: r.pick === 'transform' ? _t('ev.pick.transformOk') : r.pick === 'fuse' ? _t('ev.pick.fuseOk') : undefined,
        cards: run.deck.filter((c) => ok.has(c.uid)),
        onPick: (uid) => { E.eventPick(run, uid); done(); }
      });
    }
  }

  /* =================================================================
   * Reliquia de jefe (tras vencer al Guardián): 3 reliquias grandes con
   * la VENTAJA en dorado y la PEGA en rojo apagado.
   * ================================================================= */
  const BAD_RED = TC.danger;
  class BossRelic extends Phaser.Scene {
    constructor() { super('BossRelic'); }
    create() {
      U.padNav(this);   // mando / flechas
      const run = this.run = this.registry.get('run');
      const p = run.pending;
      this.busy = false;
      // Fondo: el altar ilustrado (motas moradas, zoom lento)
      U.sceneBackdrop(this, 'altar');
      this.tip = tooltip(this);
      this.hud = hud(this, run, { tip: this.tip });
      runTags(this, run);

      const actNow = E.actOf(this.registry.get('run'));
      const start = this.isStart = p.kind === 'startRelic';   // Herencia (Santuario): 1 de 3 reliquias al empezar
      if (start) {
        T(this, 640, 98, _t('s.herencia_del_santuario'), { size: 15, bold: true, color: 0xc9a8ff }).setLetterSpacing(4);
        T(this, 640, 140, _t('s.elige_una_reliquia_para_empezar'), { size: 54, font: 'display', color: C.gold, stroke: 0x000000, strokeThickness: 5 });
        T(this, 640, 184, _t('s.un_recuerdo_de_tus_aventuras'), { size: 19, color: C.muted, style: 'italic' });
      } else {
        T(this, 640, 98, _t('boss.down', { a: ROMAN[actNow] || actNow }), { size: 15, bold: true, color: C.muted }).setLetterSpacing(4);
        T(this, 640, 140, _t('s.elige_una_reliquia_de_jefe'), { size: 54, font: 'display', color: C.gold, stroke: 0x000000, strokeThickness: 5 });
        T(this, 640, 184, _t(actNow >= 2 ? 'boss.relicSub3' : 'boss.relicSub2'), { size: 19, color: C.muted, style: 'italic' });
      }

      const pick = (id) => {
        if (this.busy) return;
        this.busy = true;
        if (start) {
          if (!E.takeStartRelic(run, id)) { this.busy = false; return; }
          Sfx.play(id ? 'win' : 'click');
          U.saveRun(run);
          go(this);
          return;
        }
        if (!E.takeBossRelic(run, id)) { this.busy = false; return; }
        Sfx.play(id ? 'win' : 'click');
        U.saveRun(run);
        this.scene.stop('DeckView');
        this.scene.start('ActTransition');   // la transición termina en go() → mapa del acto II
      };

      p.options.forEach((id) => Codex.see('relics', id));
      const n = p.options.length, cw = 320, ch = 350, gap = 34, cy = 410;
      const x0 = 640 - ((n - 1) * (cw + gap)) / 2;
      this.cardsRect = { x: x0 - cw / 2, y: cy - ch / 2, w: n * cw + (n - 1) * gap, h: ch };
      p.options.forEach((id, i) => {
        const r = D.ALL_RELICS[id], x = x0 + i * (cw + gap);
        const card = this.add.container(x, cy);
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.45); g.fillRoundedRect(-cw / 2 + 4, -ch / 2 + 8, cw, ch, 18);
        Panel.draw(g, -cw / 2, -ch / 2, cw, ch, { glass: true });   // translúcido: se ve el altar detrás
        g.lineStyle(1, 0x8a6a2a, 0.6); g.strokeRoundedRect(-cw / 2 + 7, -ch / 2 + 7, cw - 14, ch - 14, 13);
        // Icono grande con halo
        const halo = this.add.circle(0, -102, 62, C.gold, 0.12).setBlendMode(Phaser.BlendModes.ADD);
        const ring = this.add.circle(0, -102, 50, 0x231c10).setStrokeStyle(3, C.gold, 1);
        const ic = this.add.image(0, -102, 'ic_' + r.icon).setIconScale(1.2);
        const name = T(this, 0, -24, r.name, { size: 28, font: 'display', color: C.gold });
        U.fitText(name, cw - 30, 0, 18);
        g.lineStyle(1, C.gold, 0.4); g.lineBetween(-cw / 2 + 40, 2, cw / 2 - 40, 2);
        // Ventaja (dorado) y pega (rojo apagado), cada una con su etiqueta
        const good = r.good || r.text, bad = r.bad || '';
        const gl = T(this, 0, 22, _t('boss.good'), { size: 12, bold: true, color: C.gold }).setLetterSpacing(2);
        const gt = T(this, 0, 40, good, { size: 18, wrap: cw - 44, align: 'center', oy: 0, color: 0xf0d48a, lineSpacing: 1 });
        U.fitText(gt, cw - 44, 62, 13);
        const by = 40 + gt.height + 16;
        const bl = T(this, 0, by, bad ? _t('boss.bad') : '', { size: 12, bold: true, color: BAD_RED }).setLetterSpacing(2);
        const bt = T(this, 0, by + 18, bad, { size: 17, wrap: cw - 44, align: 'center', oy: 0, color: BAD_RED, lineSpacing: 1 });
        U.fitText(bt, cw - 44, ch / 2 - (by + 18) - 16, 12);
        card.add([g, halo, ring, ic, name, gl, gt, bl, bt]);
        const hit = this.add.rectangle(0, 0, cw, ch, 0x000000, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => {
          if (U.tipOpen(this)) return;
          this.tweens.add({ targets: card, y: cy - 16, duration: 150, ease: 'Quad.out' });
          this.tweens.add({ targets: halo, alpha: 0.28, scale: 1.12, duration: 150 });
          Sfx.play('click', 0.5);
        });
        hit.on('pointerout', () => {
          this.tweens.add({ targets: card, y: cy, duration: 150, ease: 'Quad.out' });
          this.tweens.add({ targets: halo, alpha: 0.12, scale: 1, duration: 150 });
        });
        hit.on('pointerup', () => { if (!U.tipOpen(this)) pick(id); });
        card.add(hit);
        // Entrada escalonada
        card.setAlpha(0); card.y = cy + 30;
        this.tweens.add({ targets: card, alpha: 1, y: cy, delay: 120 + i * 120, duration: 360, ease: 'Back.out' });
      });
      if (start) {
        T(this, 640, 612, _t('s.mejora_herencia_del_santuario_se'), { size: 16, color: C.muted, style: 'italic' });
        button(this, 640, 660, _t('s.saltar'), () => pick(null), { w: 120, h: 34, size: 16, variant: 'ghost' });
        return;
      }
      const nextAct = E.actOf(this.registry.get('run')) + 1, healF = (D.ACT_HEAL && D.ACT_HEAL[nextAct] !== undefined) ? D.ACT_HEAL[nextAct] : 1;
      const leg = p.legendary && D.CARDS[p.legendary];   // jefe: 2% de carta legendaria (aparte de la reliquia)
      T(this, 640, leg ? 700 : 612, _t(healF >= 1 ? 'boss.healAll' : 'boss.healPart', { p: Math.round(healF * 100), a: ROMAN[nextAct] }), { size: leg ? 14 : 16, color: C.muted, style: 'italic' });
      if (leg) {
        Codex.see('cards', p.legendary);
        const b = button(this, 640, 612, p.legendaryTaken ? _t('s.0_ya_esta_en_tu', { 0: leg.name }) : _t('s.carta_legendaria_anadir_0_al', { 0: leg.name }), () => {
          if (!E.takeBossLegendary(run)) { if (E.deckFull(run)) { toast(this, _t('cust.deckFull', { n: E.CUSTOM_DECK_MAX }), C.blood); Sfx.play('deny'); } return; }
          Sfx.play('win'); U.saveRun(run); b.setLabel(_t('s.0_ya_esta_en_tu', { 0: leg.name })); b.setEnabled(false);
        }, { w: 470, h: 38, size: 17, variant: 'gold', font: 'body' });
        if (p.legendaryTaken) b.setEnabled(false);
        b.on('pointerover', () => this.tip.show(420, 450, _t('s.0_legendaria', { 0: leg.name }), E.cardText({ id: p.legendary, up: false })));
        b.on('pointerout', () => this.tip.hide());
      }
      button(this, 640, 660, _t('s.saltar'), () => pick(null), { w: 120, h: 34, size: 16, variant: 'ghost' });
      showTip(this, 'reliquiaJefe', this.cardsRect);
    }
  }

  /* =================================================================
   * Transición entre actos (3-4 s, saltable con clic o tecla): del verde
   * del bosque al azul hielo, nieve y texto. Solo presentación: el acto
   * ya ha cambiado en el motor (si se recarga aquí, se va al mapa).
   * ================================================================= */
  class ActTransition extends Phaser.Scene {
    constructor() { super('ActTransition'); }
    create() {
      U.padNav(this, { confirm: () => this.finish(), back: () => this.finish() });   // mando / flechas
      const run = this.run = this.registry.get('run');
      const act = E.actOf(run), III = act >= 3;
      this.done = false;
      // Capa del acto nuevo (debajo) y la del anterior (encima, se desvanece)
      backdrop(this, III ? 'arcane' : 'frost');
      const before = this.children.list.length;
      backdrop(this, III ? 'frost' : 'forest');
      const old = this.children.list.slice(before);
      old.forEach((o) => this.tweens.killTweensOf(o));
      this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.35);
      this.add.image(640, 360, 'vignette');
      this.tweens.add({ targets: old, alpha: 0, duration: 1700, delay: 300, ease: 'Sine.inOut' });
      if (III) {
        // Runas violetas que flotan y brillan al irse apagando el hielo
        for (let i = 0; i < 14; i++) {
          const x = 80 + Math.random() * 1120, y = 120 + Math.random() * 460, rg = this.add.graphics().setPosition(x, y).setDepth(LY.units + 5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
          const sz = 10 + Math.random() * 12;
          rg.lineStyle(2.5, 0xc9a8ff, 1);
          if (i % 3 === 0) { rg.lineBetween(0, -sz, 0, sz); rg.lineBetween(0, -sz, sz * 0.7, -sz * 0.3); }
          else if (i % 3 === 1) { rg.strokeTriangle(0, -sz, -sz * 0.8, sz * 0.6, sz * 0.8, sz * 0.6); }
          else { rg.strokeCircle(0, 0, sz * 0.7); rg.lineBetween(-sz, 0, sz, 0); }
          this.tweens.add({ targets: rg, alpha: { from: 0, to: 0.8 }, y: y - 30, delay: 600 + i * 90, duration: 1600, yoyo: true, ease: 'Sine.inOut' });
        }
      } else {
        // Nieve delante del texto, que aparece al ir enfriándose
        const snow = U.snowfall(this, 1280, 720, 80, 5);
        snow.forEach((f) => { const a = f.alpha; f.setAlpha(0); this.tweens.add({ targets: f, alpha: a, delay: 700, duration: 1400 }); });
      }
      // El personaje avanza por la ladera / hacia la cueva
      const art = charArt(run);
      const mage = this.add.image(250, 640, art).setScale(U.heightScale(this, art, 120)).setDepth(LY.units + 4);
      this.tweens.add({ targets: mage, x: 420, y: III ? 600 : 560, duration: 3800, ease: 'Sine.inOut' });
      const who = E.charDef(run).name;
      const T1 = III ? 0xc9a8ff : C.frost;
      const t1 = T(this, 640, 236, _t('s.acto_0_2', { 0: ROMAN[act] }), { size: 26, bold: true, color: T1 }).setLetterSpacing(8).setDepth(LY.units + 6).setAlpha(0);
      const t2 = T(this, 640, 300, D.ACTS[act].name, { size: 84, font: 'display', color: III ? 0xf0e0ff : 0xe6f4ff, stroke: III ? 0x1a0a2a : 0x0a1424, strokeThickness: 7 }).setDepth(LY.units + 6).setAlpha(0);
      const fem = ['invocadora', 'guardiana'].includes(E.charOf(run));   // (el Paladín: «El Paladín»)   // «La Invocadora» / «El Piromago»
      const line = _t(III ? (fem ? 'trans.3f' : 'trans.3') : (fem ? 'trans.2f' : 'trans.2'), { who });
      const t3 = T(this, 640, 380, line, { size: 24, style: 'italic', color: C.parch, stroke: 0x000000, strokeThickness: 4 }).setDepth(LY.units + 6).setAlpha(0);
      U.fitText(t3, 1100, 0, 16);
      const hint = T(this, 640, 680, _t('s.clic_para_continuar'), { size: 14, color: C.muted, style: 'italic' }).setDepth(LY.units + 6).setAlpha(0);
      this.tweens.add({ targets: t1, alpha: 1, duration: 500, delay: 400 });
      this.tweens.add({ targets: t2, alpha: 1, scale: { from: 1.08, to: 1 }, duration: 900, delay: 700, ease: 'Quad.out' });
      this.tweens.add({ targets: t3, alpha: 1, duration: 700, delay: 1500 });
      this.tweens.add({ targets: hint, alpha: 0.8, duration: 400, delay: 1200 });
      Sfx.play('chord');
      this.time.delayedCall(3900, () => this.finish());
      this.input.on('pointerup', () => this.finish());
      if (this.input.keyboard) this.input.keyboard.on('keydown', () => this.finish());
    }
    finish() {
      if (this.done) return;
      this.done = true;
      this.cameras.main.fadeOut(350, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => go(this));
    }
  }

  /* =================================================================
   * Fin de partida
   * ================================================================= */
  /** Estado por visita de la pantalla final (se reinicia en cada create). */
  const data36 = (scene) => (scene._d36 = scene._d36 || {});
  class End extends Phaser.Scene {
    constructor() { super('End'); }
    create(data) {
      U.padNav(this, { tab: () => { if (this.showTab) this.showTab(this.tab === 'sum' ? 'graph' : 'sum'); }, tabRect: () => (this.showTab ? { x: 465, y: 179, w: 350, h: 34 } : null),
        modalBack: () => { if (this.hlLayer && this.hlClose) this.hlClose(); else if (this.legSkip) this.legSkip(); } });   // mando / flechas (B cierra los momentos o rechaza el Legado)
      this.essCount = null; this._d36 = {}; this.lvBusy = false;
      const run = this.registry.get('run');
      const win = run.over && run.over.result === 'win';
      U.Store.del(U.saveKeyOf(run));   // la personalizada tiene su propio guardado
      const s = run.stats, act = E.actOf(run);
      Music.stop(1500);
      backdrop(this, win ? 'arcane' : themeFor(run, true));
      this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.5);
      if (win) this.victoryFx();
      const title = T(this, 640, 92, win ? _t(E.bossOf(run, 3) === 'ojo' ? 's.has_cerrado_el_ojo_del' : 'end.winGeneric') : _t('s.has_caido'), { size: 72, font: 'display', color: win ? C.gold : C.blood, stroke: 0x000000, strokeThickness: 6 });
      U.fitText(title, 730, 0, 48);   // deja libres las esquinas de arriba (avisos de logro y consejo de la Esencia)
      U.fitText(title, 1180, 0, 40);
      // Derrota: dónde caíste (acto y piso) y quién te venció
      const where = _t(act >= 3 ? 'end.fell3' : act >= 2 ? 'end.fell2' : 'end.fell1', { f: s.floors });
      const sub = T(this, 640, 148, win ? _t('s.el_ojo_se_cierra_para')
        : _t('end.killedBy', { w: where, k: killerName(run.over) }), { size: 22, style: 'italic', color: C.parch });
      U.fitText(sub, 1100, 0, 15);
      const rows = [
        [_t('s.pisos_alcanzados'), _t('s.0_de_1', { 0: s.floors, 1: E.TOTAL_FLOORS })], [_t('s.enemigos_derrotados'), s.kills],
        [_t('s.dano_infligido'), s.damageDealt], [_t('s.golpe_mas_fuerte'), s.maxHit],
        [_t('s.dano_recibido'), s.damageTaken], [_t('s.cartas_jugadas'), s.cardsPlayed],
        [_t('s.oro_ganado'), s.goldEarned], [_t('s.cartas_en_el_mazo'), run.deck.length],
        [_t('s.pociones_usadas'), s.potionsUsed || 0]
      ];
      // Récords y logros (una sola vez por partida: onRunEnd es idempotente)
      const meta = loadMeta();
      const res = M.onRunEnd(meta, run);
      saveMeta(meta);

      // Pestañas: «Resumen» (estadísticas, puntuación, logros) y «Tu partida» (gráfica)
      const before = new Set(this.children.list);
      // Las estadísticas se desplazan a la izquierda para dejar sitio a la puntuación (diario o normal)
      const dx = -150;
      const g = this.add.graphics(); g.fillStyle(C.panel, 0.92); g.fillRoundedRect(380 + dx, 218, 520, 292, 14);
      rows.forEach(([k, v], i) => {
        const y = 242 + i * 30.5;   // 9 filas dentro del panel (218..510)
        T(this, 420 + dx, y, k, { size: 19, color: C.muted, ox: 0 });
        T(this, 860 + dx, y, String(v), { size: 21, bold: true, ox: 1 });
      });
      if (res.daily) this.dailyPanel(res.daily); else if (run.custom) this.customPanel(run, res); else this.scorePanel(run, res);
      if (res.essence) this.essencePanel(res.essence, run);
      if (res.affinity) this.affPanel(run, res.affinity);   // Parche 3.6: Afinidad (la barra se llena al cerrar los momentos)
      loreToast(this, res.lore);                                // Parche 3.7: fragmentos de lore nuevos
      const got = [...new Set(run.achievementsThisRun || [])].map((id) => M.BY_ID[id]).filter(Boolean);
      const achT = T(this, 640, 542, run.custom ? _t('cust.noAch') : got.length ? _t('s.logros_0', { 0: got.map((a) => a.name).join(' · ') }) : _t('s.sin_logros_nuevos_en_esta'),
        { size: 19, color: got.length ? C.gold : C.muted, bold: got.length > 0, wrap: 680, align: 'center' });
      U.fitText(achT, 680, 44, 12);   // ancho 680: a la derecha queda hueco para el consejo y los avisos
      if (res.records.length) {
        const recT = T(this, 640, 580, res.records.map((r) => _t(r)).join('   '), { size: 18, color: C.flame, bold: true, wrap: 680, align: 'center' });
        U.fitText(recT, 680, 40, 11);
      }
      if (res.ascUnlocked) this.ascUnlocked(res.ascUnlocked, res.records.length ? 608 : 584);
      this.sumLayer = this.add.container(0, 0, this.children.list.filter((o) => !before.has(o)));
      this.graphLayer = null;
      this.tabs(run);
      if (res.charUnlocked && res.charUnlocked.length) this.time.delayedCall(900, () => this.charUnlocked(res.charUnlocked[0]));
      if (run.weekly) {   // Desafío semanal: otro intento (el de esta semana) · Récords · menú
        button(this, 400, 650, _t('wk.again'), () => startWeekly(this), { w: 230 });
        button(this, 640, 650, _t('s.records'), () => this.scene.start('Records', { view: 'weekly' }), { w: 200, variant: 'gold' });
        button(this, 880, 650, _t('s.menu'), () => this.scene.start('Title'), { w: 200, variant: 'ghost' });
      } else if (run.custom) {   // misma partida (mismo código) · configurar otra · menú
        const again = Object.assign({}, run.custom);
        button(this, 400, 650, _t('cust.again'), () => { this.registry.set('run', E.newCustomRun(again)); go(this); }, { w: 230 });
        button(this, 640, 650, _t('cust.title'), () => this.scene.start('CustomSetup', { cfg: again }), { w: 200, variant: 'gold' });
        button(this, 880, 650, _t('s.menu'), () => this.scene.start('Title'), { w: 200, variant: 'ghost' });
      } else if (res.daily) {
        button(this, 280, 650, _t('s.reintentar_desafio'), () => startDaily(this, run.daily), { w: 220 });
        button(this, 520, 650, _t('s.nueva_partida'), () => this.scene.start('Prep'), { w: 220, variant: 'ghost' });
        button(this, 760, 650, _t('s.records'), () => this.scene.start('Records'), { w: 220, variant: 'gold' });
        button(this, 1000, 650, _t('s.menu'), () => this.scene.start('Title'), { w: 220, variant: 'ghost' });
      } else {
        button(this, 400, 650, _t('s.nueva_partida'), () => this.scene.start('Prep'), { w: 230 });
        button(this, 640, 650, _t('s.records'), () => this.scene.start('Records'), { w: 200, variant: 'gold' });
        button(this, 880, 650, _t('s.menu'), () => this.scene.start('Title'), { w: 200, variant: 'ghost' });
      }
      // Parche 3.6: primero los momentos destacados; después el Legado (si toca) y la barra de Afinidad
      const after = () => this.afterHighlights(run, res);
      if (!(data && data.noHl) && (res.highlights || []).length) this.showHighlights(run, res, after);
      else this.time.delayedCall(data && data.noHl ? 0 : 300, after);
    }

    /** Tras los momentos: elegir Legado (victoria normal) y llenar la barra de Afinidad. */
    afterHighlights(run, res) {
      if (data36(this).legacyDone) return;
      data36(this).legacyDone = true;
      const anim = () => this.animAffinity(run, res);
      if (res.legacyOffer && !run.legacySet) this.legacyModal(run, anim); else anim();
    }
    /** Pantalla de momentos destacados: 3-4 tarjetas animadas con lo mejor (y lo peor) de la partida. */
    showHighlights(run, res, done) {
      const L = this.hlLayer = this.add.container(0, 0).setDepth(LY.modal);
      const shade = this.add.rectangle(640, 360, 1280, 720, 0x05040a, 0.95).setInteractive();
      L.add([shade, T(this, 640, 86, _t('hl.title'), { size: 52, font: 'display', color: C.gold, stroke: 0x000000, strokeThickness: 5 })]);
      const hl = res.highlights, n = hl.length, CW = 250, CH = 310, gap = 22;
      hl.forEach((h, i) => {
        const x = 640 + (i - (n - 1) / 2) * (CW + gap), y = 360;
        const c = this.hlCard(run, h, CW, CH);
        c.setPosition(x, y + 40).setAlpha(0).setScale(0.85);
        L.add(c);
        this.tweens.add({ targets: c, y, alpha: 1, scale: 1, duration: 420, delay: 250 + i * 260, ease: 'Back.out',
          onStart: () => { Sfx.play('card', { volume: 0.5 }); }, onComplete: () => burst(this, x, y - 90, h.kind === 'killer' ? C.blood : C.gold, 12, 60) });
      });
      const close = this.hlClose = () => { if (!L.active) return; L.destroy(); this.hlLayer = null; this.hlClose = null; done(); };
      L.add(button(this, 520, 618, _t('hl.copy'), () => U.copyOrShow(this, this.shareText(run, res), { ok: _t('hl.copied'), title: _t('hl.copy') }), { w: 220, h: 46, size: 18, variant: 'ghost' }));
      L.add(button(this, 760, 618, _t('hl.continue'), close, { w: 220, h: 46, size: 20, variant: 'gold' }));
      this.input.keyboard.once('keydown-ESC', close);
    }
    /** Una tarjeta de momento destacado. */
    hlCard(run, h, W, H) {
      const c = this.add.container(0, 0);
      const COL = { hit: C.flame, mvp: C.gold, relic: 0x8fd4ff, epic: 0xc9a8ff, killer: C.blood };
      const col = COL[h.kind] || C.gold, g = this.add.graphics();
      g.fillStyle(0x000000, 0.45); g.fillRoundedRect(-W / 2 + 4, -H / 2 + 6, W, H, 16);
      g.fillStyle(C.panel, 0.98); g.fillRoundedRect(-W / 2, -H / 2, W, H, 16);
      g.lineStyle(2.5, col, 1); g.strokeRoundedRect(-W / 2, -H / 2, W, H, 16);
      g.fillStyle(col, 0.12); g.fillRoundedRect(-W / 2 + 6, -H / 2 + 6, W - 12, 40, 10);
      c.add(g);
      const head = { hit: _t('hl.hit'), mvp: _t('hl.mvp'), relic: _t('hl.relic'), epic: _t('hl.epic'), killer: _t('hl.killer') }[h.kind];
      c.add(U.fitText(T(this, 0, -H / 2 + 26, head.toUpperCase(), { size: 15, bold: true, color: col }).setLetterSpacing(2), W - 20, 0, 10));
      const icon = (key, sc = 0.9) => { c.add(this.add.circle(0, -70, 36, 0x0d0b0a, 1).setStrokeStyle(2, col, 1)); c.add(this.add.image(0, -70, key).setIconScale(sc)); };
      const big = (txt) => c.add(U.fitText(T(this, 0, 6, txt, { size: 50, font: 'display', color: C.parch, stroke: 0x000000, strokeThickness: 4 }), W - 24, 0, 22));
      const line = (y, txt, opt = {}) => { if (txt) c.add(U.fitText(T(this, 0, y, txt, { size: 16, color: C.parch, wrap: W - 24, align: 'center', ...opt }), W - 24, opt.h || 0, 9)); };
      const cardN = (id, up) => (id && D.CARDS[id] ? E.cardName({ id, up: !!up }) : '');
      const enemyN = (id) => (id && D.ENEMIES[id] ? D.ENEMIES[id].name : '');
      if (h.kind === 'hit') {
        icon(h.card ? 'ic_' + D.CARDS[h.card].icon : h.relic ? 'ic_' + D.ALL_RELICS[h.relic].icon : 'ic_sword', 0.8);
        big(String(h.dmg));
        line(62, cardN(h.card, h.up) || (h.relic ? D.ALL_RELICS[h.relic].name : _t('hl.noCard')), { bold: true, size: 18 });
        line(92, _t('hl.vs', { e: enemyN(h.enemy) }), { color: C.muted, size: 15 });
      } else if (h.kind === 'mvp') {
        icon('ic_' + D.CARDS[h.card].icon, 0.8);
        big(String(h.dmg + h.block));
        line(62, cardN(h.card), { bold: true, size: 18 });
        line(92, [h.dmg ? _t('hl.dmg', { n: h.dmg }) : '', h.block ? _t('hl.block', { n: h.block }) : ''].filter(Boolean).join(' · '), { color: C.muted, size: 15 });
      } else if (h.kind === 'relic') {
        icon('ic_' + D.ALL_RELICS[h.relic].icon, 0.6);
        big('×' + h.n);
        line(62, D.ALL_RELICS[h.relic].name, { bold: true, size: 18 });
        line(92, _t('hl.uses'), { color: C.muted, size: 15 });
      } else if (h.kind === 'epic') {
        icon('ic_crown', 0.6);
        big(h.epic === 'oneshot' ? String(h.dmg) : h.epic === 'lowhp' ? _t('hl.hp', { n: h.hp }) : String(h.n));
        line(62, _t('hl.epic.' + h.epic), { bold: true, size: 18, color: 0xc9a8ff });
        line(94, h.epic === 'oneshot' ? _t('hl.vs', { e: enemyN(h.enemy) }) : _t('hl.epicD.' + h.epic, { n: h.n, hp: h.hp }), { color: C.muted, size: 14, h: 44 });
      } else if (h.kind === 'killer') {
        const d = D.ENEMIES[h.enemy];
        let key = 'art_' + d.art;
        if (!this.textures.exists(key) && ENEMY_FALLBACK[d.art]) key = 'art_' + ENEMY_FALLBACK[d.art];
        if (this.textures.exists(key)) { const src = this.textures.get(key).getSourceImage(); c.add(this.add.image(0, 2, key).setOrigin(0.5, 1).setFlipX(flipOf(key)).setScale(Math.min(84 / src.height, (W - 60) / src.width))); }
        line(30, d.name, { size: 24, font: 'display', color: C.blood, stroke: 0x000000, strokeThickness: 4 });
        line(66, h.move ? I18N.refName(h.move) : _t('hl.noMove'), { bold: true, size: 17 });
        line(96, _t('hl.floor', { n: (run.stats || {}).floors || 0 }), { color: C.muted, size: 15 });
      }
      return c;
    }
    /** Texto para pegar en Discord: personaje, resultado, piso, momentos y código (personalizada o semanal). */
    shareText(run, res) {
      const s = run.stats || {}, win = run.over && run.over.result === 'win', cd = D.CHARACTERS[E.charOf(run)];
      const ttl = M.titleText(loadMeta(), run.char);
      const out = [_t('hl.shareHead', { c: cd.name + (ttl ? ` «${ttl}»` : ''), r: win ? _t('hl.win') : _t('hl.lose'), f: s.floors || 0, t: E.TOTAL_FLOORS }) + (run.ascension ? ` · A${run.ascension}` : '')];
      const cardN = (id, up) => (id && D.CARDS[id] ? E.cardName({ id, up: !!up }) : '');
      for (const h of res.highlights || []) {
        if (h.kind === 'hit') out.push(`⚔ ${_t('hl.hit')}: ${h.dmg} (${cardN(h.card, h.up) || (h.relic ? D.ALL_RELICS[h.relic].name : '—')} → ${D.ENEMIES[h.enemy] ? D.ENEMIES[h.enemy].name : '?'})`);
        if (h.kind === 'mvp') out.push(`★ ${_t('hl.mvp')}: ${cardN(h.card)} (${[h.dmg ? _t('hl.dmg', { n: h.dmg }) : '', h.block ? _t('hl.block', { n: h.block }) : ''].filter(Boolean).join(', ')})`);
        if (h.kind === 'relic') out.push(`◆ ${_t('hl.relic')}: ${D.ALL_RELICS[h.relic].name} ×${h.n}`);
        if (h.kind === 'epic') out.push(`✦ ${_t('hl.epic')}: ${_t('hl.epic.' + h.epic)} (${h.epic === 'oneshot' ? h.dmg : h.epic === 'lowhp' ? _t('hl.hp', { n: h.hp }) : h.n})`);
        if (h.kind === 'killer') out.push(`☠ ${_t('hl.killer')}: ${D.ENEMIES[h.enemy].name}${h.move ? ' · ' + I18N.refName(h.move) : ''}`);
      }
      if (run.weekly) out.push(_t('hl.shareWeekly', { r: fmtWeek(run.weekly), c: run.custom.code }));
      else if (run.custom) out.push(_t('hl.shareCode', { c: run.custom.code }));
      else if (run.daily) out.push(_t('hl.shareDaily', { d: fmtDay(run.daily, false) }));
      return out.join('\n');
    }
    /** Legado (victoria normal): elegir 1 carta del mazo final para la próxima partida con este personaje, o ninguna. */
    legacyModal(run, done) {
      const L = this.add.container(0, 0).setDepth(LY.modal);
      const W = 600, H = 270, x0 = 640 - W / 2, y0 = 360 - H / 2, cd = D.CHARACTERS[E.charOf(run)];
      const shade = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.78).setInteractive();
      const g = this.add.graphics();
      g.fillStyle(C.panel, 0.98); g.fillRoundedRect(x0, y0, W, H, 16);
      g.lineStyle(2, C.gold, 0.9); g.strokeRoundedRect(x0, y0, W, H, 16);
      L.add([shade, g, T(this, 640, y0 + 42, _t('leg.title'), { size: 40, font: 'display', color: C.gold }),
        U.fitText(T(this, 640, y0 + 112, _t('leg.text', { c: cd.name }), { size: 17, color: C.parch, wrap: W - 60, align: 'center' }), W - 60, 80, 11)]);
      const finish = (id) => {
        const m = loadMeta();
        if (M.setLegacy(m, run, id)) saveMeta(m);
        if (id) toast(this, _t('leg.saved', { c: D.CARDS[id].name }), C.gold);
        L.destroy(); this.legSkip = null; done();
      };
      this.legSkip = () => finish(null);
      const choices = M.legacyChoices(run).map((id, i) => ({ uid: i + 1, id, up: false }));
      L.add(button(this, 640 - 130, y0 + H - 46, _t('leg.choose'), () => this.scene.launch('DeckView', { mode: 'choose', title: _t('leg.title'), cards: choices, confirm: _t('leg.confirm'),
        onPick: (uid) => { const c = choices.find((x) => x.uid === uid); if (c) finish(c.id); } }), { w: 230, h: 46, size: 19, variant: 'gold' }));
      L.add(button(this, 640 + 130, y0 + H - 46, _t('leg.skip'), () => finish(null), { w: 230, h: 46, size: 19, variant: 'ghost' }));
    }
    /** Panel de Afinidad (izquierda): personaje, nivel, barra y desglose de la XP de la partida. */
    affPanel(run, a) {
      const x = 16, w = 204, cx = x + w / 2, y0 = 218, cd = D.CHARACTERS[a.char];
      const g = this.add.graphics();
      g.fillStyle(0x1a160b, 0.95); g.fillRoundedRect(x, y0, w, 292, 14);
      g.lineStyle(2, C.gold, 0.7); g.strokeRoundedRect(x, y0, w, 292, 14);
      T(this, cx, y0 + 22, U.glossName('affinity').toUpperCase(), { size: 14, bold: true, color: C.gold }).setLetterSpacing(2);
      U.fitText(T(this, cx, y0 + 46, cd.name, { size: 18, bold: true, color: cd.color }), w - 20, 0, 11);
      const lv0 = M.affinityLevel(a.from);
      this.affLv = T(this, cx, y0 + 86, _t('aff.lv', { n: lv0.level }), { size: 36, font: 'display', color: C.parch, stroke: 0x000000, strokeThickness: 4 });
      this.affBar = this.add.graphics();
      this.affXp = T(this, cx, y0 + 140, '', { size: 13, bold: true, color: C.muted });
      this.affDraw = (xp) => {
        const lv = M.affinityLevel(xp), bx = x + 16, bw = w - 32;
        this.affBar.clear();
        this.affBar.fillStyle(0x050706, 1); this.affBar.fillRoundedRect(bx, y0 + 116, bw, 12, 6);
        const f = lv.max ? 1 : lv.into / lv.need;
        if (f > 0) { this.affBar.fillStyle(C.gold, 1); this.affBar.fillRoundedRect(bx, y0 + 116, Math.max(10, bw * f), 12, 6); }
        this.affLv.setText(_t('aff.lv', { n: lv.level }));
        this.affXp.setText(lv.max ? _t('aff.max') : `${lv.into}/${lv.need} XP`);
      };
      this.affDraw(a.from);
      this.affGain = T(this, cx, y0 + 172, _t('aff.gain', { n: 0 }), { size: 24, bold: true, color: C.gold });
      const X = a.xp, rows = [];
      if (X.floors) rows.push([_t('aff.l.floors'), X.floors]);
      if (X.elites + X.bosses) rows.push([_t('aff.l.elites'), X.elites + X.bosses]);
      if (X.contract) rows.push([_t('aff.l.contract'), X.contract]);
      if (X.win) rows.push([_t('aff.l.win'), X.win]);
      if (X.mult !== 1) rows.push([_t('aff.l.mult'), '×' + String(X.mult).replace('.', I18N.lang === 'es' ? ',' : '.')]);
      if (a.questXp) rows.push([_t('aff.l.quests'), a.questXp]);
      rows.slice(0, 6).forEach(([k, v], i) => {
        const y = y0 + 204 + i * 15;
        U.fitText(T(this, x + 14, y, k, { size: 12, color: C.muted, ox: 0 }), 120, 0, 8);
        T(this, x + w - 14, y, typeof v === 'number' ? '+' + v : v, { size: 12, bold: true, color: C.parch, ox: 1 });
      });
    }
    /** La barra de Afinidad se llena contando; en cada nivel nuevo, «¡Nivel X!» con confeti y la recompensa. */
    animAffinity(run, res) {
      const a = res.affinity;
      if (!a || !this.affDraw) return;
      const total = a.to - a.from, o = { v: a.from };
      let lastLv = M.affinityLevel(a.from).level;
      const queue = [];
      this.tweens.add({ targets: o, v: a.to, duration: Math.min(2400, 700 + total * 2), ease: 'Sine.inOut',
        onUpdate: () => {
          const v = Math.round(o.v); this.affDraw(v); this.affGain.setText(_t('aff.gain', { n: v - a.from }));
          const lv = M.affinityLevel(v).level;
          if (lv > lastLv) { for (let k = lastLv + 1; k <= lv; k++) queue.push(k); lastLv = lv; if (queue.length === 1 || !this.lvBusy) this.nextLevelUp(queue, a.char); }
        },
        onComplete: () => { this.affDraw(a.to); this.affGain.setText(_t('aff.gain', { n: total })); } });
    }
    nextLevelUp(queue, ch) {
      if (this.lvBusy || !queue.length) return;
      this.lvBusy = true;
      const lv = queue.shift(), r = D.AFFINITY_REWARDS[lv] || {};
      const L = this.add.container(0, 0).setDepth(LY.modal - 20);
      const dim = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.55);   // oscurece todo (sin bloquear): el resumen sigue debajo
      const band = this.add.rectangle(640, 360, 1280, 170, 0x000000, 0.72);
      const t1 = T(this, 640, 336, _t('aff.levelUp', { n: lv }), { size: 72, font: 'display', color: C.gold, stroke: 0x2a1206, strokeThickness: 7 });
      const t2 = U.fitText(T(this, 640, 400, `${D.CHARACTERS[ch].name} · ${affRewardText(r, ch)}`, { size: 22, bold: true, color: C.parch }), 1100, 0, 14);
      L.add([dim, band, t1, t2]).setAlpha(0);
      this.tweens.add({ targets: L, alpha: 1, duration: 200 });
      this.tweens.add({ targets: t1, scale: { from: 0.7, to: 1 }, duration: 380, ease: 'Back.out' });
      FL.confetti(this, 640, 300, 60, 560, LY.modal - 10);
      Sfx.play('win', { volume: 0.6 });
      this.time.delayedCall(1700, () => this.tweens.add({ targets: L, alpha: 0, duration: 260, onComplete: () => { L.destroy(); this.lvBusy = false; this.nextLevelUp(queue, ch); } }));
    }
    tabs(run) {
      const line = this.add.graphics();
      const mk = (x, label, key) => {
        const b = button(this, x, 196, label, () => show(key), { w: 170, h: 34, size: 17, variant: 'ghost', font: 'body' });
        return b;
      };
      const bs = { sum: mk(550, _t('s.resumen'), 'sum'), graph: mk(730, _t('s.tu_partida'), 'graph') };
      const show = (key) => {
        if (key === 'graph' && !this.graphLayer) this.graphLayer = this.runGraph(run);
        this.sumLayer.setVisible(key === 'sum');
        if (this.graphLayer) this.graphLayer.setVisible(key === 'graph');
        const b = bs[key];
        line.clear(); line.fillStyle(C.gold, 1); line.fillRoundedRect(b.x - 70, 214, 140, 3, 1);
        this.tab = key;
      };
      this.showTab = show;
      show('sum');
    }

    /** Esencia Arcana ganada: desglose línea a línea, la gema se llena y botón «Ir al Santuario». */
    essencePanel(e, run) {
      const x = 1092, w = 172, cx = x + w / 2, y0 = 218;
      const g = this.add.graphics();
      g.fillStyle(0x150e22, 0.95); g.fillRoundedRect(x, y0, w, 292, 14);
      g.lineStyle(2, ESS, 0.8); g.strokeRoundedRect(x, y0, w, 292, 14);
      T(this, cx, y0 + 22, _t('ess.title'), { size: 14, bold: true, color: ESS }).setLetterSpacing(2);
      const gem = this.add.graphics();
      const tot = T(this, cx + 2, y0 + 60, '+0', { size: 34, font: 'display', color: C.parch, stroke: 0x000000, strokeThickness: 4, ox: 0 });
      const s = run.stats || {}, R = D.ESSENCE;
      const fmtM = (m) => '×' + String(Math.round(m * 100) / 100).replace('.', ',');
      const lines = [[_t('s.pisos_0', { 0: s.floors || 0 }), e.floors, e.floors]];
      lines.push([_t('s.elites_0', { 0: e.elites / R.elite }), e.elites, e.floors + e.elites]);
      lines.push([_t('s.jefes_0', { 0: e.bosses / R.boss }), e.bosses, e.floors + e.elites + e.bosses]);
      if (e.contract) lines.push([_t('ct.essLine'), e.contract, e.floors + e.elites + e.bosses + e.contract]);   // Contrato (Parche 3.5)
      if (e.win) lines.push([_t('s.victoria_2'), e.win, e.base]);
      if (e.ascMult !== 1) lines.push([_t('s.ascension_0', { 0: run.ascension }), fmtM(e.ascMult), Math.round(e.base * e.ascMult)]);
      if (e.noUpgMult !== 1) lines.push([_t('s.sin_mejoras'), fmtM(e.noUpgMult), e.noPathMult !== 1 ? Math.round(e.base * e.ascMult * e.noUpgMult) : e.total]);
      if (e.noPathMult && e.noPathMult !== 1) lines.push([_t('path.noneShort'), fmtM(e.noPathMult), e.total]);   // Sin senda
      if (e.customMult && e.customMult !== 1) lines.push([E.customDifficulty(run.custom).name, fmtM(e.customMult), e.total]);   // Personalizada: ×dificultad
      let acc = e.total;
      if (e.achievements) lines.push([_t('s.logros_nuevos_0', { 0: e.achievements / R.achievement }), e.achievements, acc += e.achievements]);
      if (e.firstWin) lines.push([_t('s.1_victoria'), e.firstWin, acc += e.firstWin]);
      // Parche 3.6: semanal, misiones, niveles de Afinidad e hitos del compendio
      for (const [k, key] of [['weekly', 'wk.essLine'], ['quests', 'q.essLine'], ['levels', 'aff.essLine'], ['milestones', 'cx.essLine']]) if (e[k]) lines.push([_t(key), e[k], acc += e[k]]);
      // Progreso de la gema: hacia la mejora más barata que aún puedes comprar
      const meta = loadMeta(), costs = D.UPGRADE_IDS.map((id) => M.nextUpgradeCost(meta, id)).filter((c) => c !== null);
      const target = costs.length ? Math.min(...costs) : 1, before = Math.max(0, e.balance - e.gained);
      const fillAt = (v) => (costs.length ? Math.min(1, v / target) : 1);
      const drawGem = (v) => { gem.clear(); U.essenceGem(gem, x + 34, y0 + 60, 20, fillAt(v)); };
      drawGem(before);
      const step = Math.min(19, 120 / Math.max(1, lines.length));
      lines.forEach(([k, v, run2], i) => {
        const y = y0 + 102 + i * step;
        const a = T(this, x + 14, y, k, { size: 13, color: C.muted, ox: 0 }).setAlpha(0);
        U.fitText(a, 100, 0, 9);
        const b = T(this, x + w - 14, y, typeof v === 'number' ? '+' + v : v, { size: 14, bold: true, color: typeof v === 'number' ? C.parch : ESS, ox: 1 }).setAlpha(0);
        this.time.delayedCall(500 + i * 320, () => {
          this.tweens.add({ targets: [a, b], alpha: 1, x: '-=0', duration: 200 });
          if (typeof v === 'number' && v > 0) A.essenceFly(this, x + w - 30, y, x + 34, y0 + 60, 3);   // gemitas hacia la gema grande
          const prevTot = Number(String(tot.text).replace(/\D/g, '')) || 0;
          if (this.essCount) this.essCount.stop();
          this.essCount = FL.countUp(this, tot, prevTot, run2, (v) => '+' + v, 280);   // cuenta, no salta
          this.tweens.add({ targets: tot, scale: { from: 1.2, to: 1 }, duration: 200 });
          drawGem(before + (e.gained * (i + 1)) / lines.length);
          Sfx.play('click', { volume: 0.35 });
        });
      });
      const endAt = 500 + lines.length * 320;
      const cap = T(this, cx, y0 + 256, '', { size: 12, color: C.muted, wrap: w - 16, align: 'center' });
      this.time.delayedCall(endAt, () => {
        if (this.essCount) { this.essCount.stop(); this.essCount = null; }
        tot.setText('+' + e.gained); drawGem(e.balance);
        burst(this, x + 34, y0 + 60, ESS, 20, 70);
        cap.setText(_t('ess.balance', { b: fmtScore(e.balance) }) + (costs.length ? (e.balance >= target ? _t('ess.canBuy') : _t('ess.next', { n: target })) : ''));
      });
      this.essBtn = button(this, cx, y0 + 274 - 0, _t('s.ir_al_santuario'), () => this.scene.start('Sanctuary', { from: 'Title' }), { w: 150, h: 30, size: 15, variant: 'ghost', font: 'body' });
      cap.setY(y0 + 244);
      showTip(this, 'esencia', { x: x - 4, y: y0 - 4, w: w + 8, h: 300 });
    }

    /** Puntuación de una partida normal: fórmula del diario × (1 + pactos) y récord del personaje. */
    scorePanel(run, res) {
      const x = 770, w = 310, cx = x + w / 2;
      const g = this.add.graphics();
      g.fillStyle(0x1f1a0d, 0.94); g.fillRoundedRect(x, 218, w, 292, 14);
      g.lineStyle(2, C.gold, res.newBestScore ? 1 : 0.5); g.strokeRoundedRect(x, 218, w, 292, 14);
      T(this, cx, 244, _t('s.puntuacion'), { size: 15, bold: true, color: C.gold }).setLetterSpacing(2);
      const n = (run.pacts || []).length;
      T(this, cx, 270, n ? _t('end.pactScore', { s: fmtScore(E.dailyScore(run)), m: fmtMult(E.pactBonus(run)).slice(1), n }) : _t('s.sin_pactos'), { size: 16, color: n ? C.arcane : C.muted });
      const sc = T(this, cx, 316, fmtScore(res.score || 0), { size: 56, font: 'display', color: C.parch, stroke: 0x000000, strokeThickness: 4 });
      FL.countUp(this, sc, 0, res.score || 0, fmtScore, 1000, 250);   // la puntuación sube contando
      const ch = D.CHARACTERS[E.charOf(run)].name;
      if (res.newBestScore) {
        T(this, cx, 370, _t('s.mejor_puntuacion_con_0', { 0: ch }), { size: 19, bold: true, color: C.flame });
        this.tweens.add({ targets: sc, scale: { from: 1.25, to: 1 }, duration: 500, ease: 'Back.out' });
        burst(this, cx, 316, C.gold, 24, 110);
      } else T(this, cx, 370, _t('s.mejor_con_0_1', { 0: ch, 1: fmtScore(res.bestScore || 0) }), { size: 18, color: C.gold });
      if (n) {
        const names = run.pacts.map((id) => D.PACTS[id].name).join(' · ');
        U.fitText(T(this, cx, 420, names, { size: 14, color: C.muted, wrap: w - 30, align: 'center' }), w - 30, 60, 10);
      } else T(this, cx, 420, _t('s.activa_pactos_al_elegir_personaje'), { size: 14, color: C.muted, align: 'center', style: 'italic' });
    }

    /** Personalizada: dificultad, puntuación y el código (para que tus colegas jueguen la misma partida y comparen). */
    customPanel(run, res) {
      const x = 770, w = 310, cx = x + w / 2, d = E.customDifficulty(run.custom);
      const g = this.add.graphics();
      g.fillStyle(0x1f1a0d, 0.94); g.fillRoundedRect(x, 218, w, 292, 14);
      g.lineStyle(2, d.color, 0.8); g.strokeRoundedRect(x, 218, w, 292, 14);
      U.fitText(T(this, cx, 244, run.weekly ? _t('wk.title').toUpperCase() : _t('cust.endTitle'), { size: 15, bold: true, color: C.gold }).setLetterSpacing(2), w - 20, 0, 10);
      T(this, cx, 270, run.weekly ? fmtWeek(run.weekly) : `${_t('cust.diff')}: ${d.name}`, { size: 16, bold: true, color: run.weekly ? C.parch : d.color });
      FL.countUp(this, T(this, cx, 316, fmtScore(res.score || 0), { size: 56, font: 'display', color: C.parch, stroke: 0x000000, strokeThickness: 4 }), 0, res.score || 0, fmtScore, 1000, 250);
      T(this, cx, 362, res.weekly ? _t('wk.endBest', { s: fmtScore(res.weekly.best) }) : _t('s.puntuacion'), { size: 14, color: res.weekly && res.weekly.isNewBest ? C.flame : C.muted });
      U.fitText(T(this, cx, 398, U.codeShow(run.custom.code), { size: 18, bold: true, font: 'mono', color: C.parch }), w - 24, 0, 11);   // 0 como Ø
      const names = run.custom.mods.map((id) => D.CUSTOM_MODS[id].short).join(' · ') || _t('cust.noMods');
      const wkRw = res.weekly && res.weekly.badge;   // semanal ganado por primera vez: Esencia + insignia
      U.fitText(T(this, cx, 432, wkRw ? _t('wk.badgeNow', { e: res.weekly.essence }) : names, { size: 13, bold: !!wkRw, color: wkRw ? C.gold : C.muted, wrap: w - 30, align: 'center' }), w - 30, 36, 9);
      button(this, cx, 482, _t('cust.copy'), () => U.copyOrShow(this, `${run.custom.code} · ${fmtScore(res.score || 0)}`, { ok: _t('cust.copied'), title: _t('cust.copyTitle'), mono: true }), { w: 200, h: 36, size: 17, variant: 'gold' });
    }

    /**
     * «Tu partida»: vida y oro por piso (dos líneas, ejes con etiquetas), marcadores de élites y
     * jefes, calavera donde caíste, y debajo 4 datos. Todo con Graphics.
     */
    runGraph(run) {
      const L = this.add.container(0, 0);
      const tl = (run.stats.timeline || []).slice(), s = run.stats;
      const X = 150, Y = 228, W = 980, H = 266;
      const g = this.add.graphics();
      g.fillStyle(C.panel, 0.94); g.fillRoundedRect(X, Y, W, H, 14);
      L.add(g);
      if (tl.length < 2) { L.add(T(this, 640, Y + H / 2, _t('s.sin_datos_de_esta_partida'), { size: 20, color: C.muted, style: 'italic' })); return L; }
      const maxF = Math.max(1, ...tl.map((e) => e.floor));
      const hpMax = Math.max(10, ...tl.map((e) => e.maxHp));
      const goldMax = Math.max(50, Math.ceil(Math.max(...tl.map((e) => e.gold)) / 50) * 50);
      const x0 = X + 64, x1 = X + W - 70, y0 = Y + H - 44, y1 = Y + 46;
      const px = (f) => x0 + (f / maxF) * (x1 - x0);
      const pyH = (v) => y0 - (v / hpMax) * (y0 - y1), pyG = (v) => y0 - (v / goldMax) * (y0 - y1);
      // Rejilla, ejes y etiquetas
      g.lineStyle(1, C.line, 0.35);
      for (let k = 0; k <= 4; k++) { const y = y0 - (k / 4) * (y0 - y1); g.lineBetween(x0, y, x1, y);
        L.add(T(this, x0 - 10, y, String(Math.round(hpMax * k / 4)), { size: 12, color: 0xe58b7a, ox: 1 }));
        L.add(T(this, x1 + 10, y, String(Math.round(goldMax * k / 4)), { size: 12, color: C.gold, ox: 0 })); }
      g.lineStyle(2, C.muted, 0.8); g.lineBetween(x0, y0, x1, y0); g.lineBetween(x0, y0, x0, y1 - 6); g.lineBetween(x1, y0, x1, y1 - 6);
      L.add(T(this, x0 - 10, y1 - 22, _t('s.vida'), { size: 13, bold: true, color: 0xe58b7a, ox: 1 }));
      L.add(T(this, x1 + 10, y1 - 22, _t('s.oro'), { size: 13, bold: true, color: C.gold, ox: 0 }));
      for (let f = 0; f <= maxF; f++) { g.lineBetween(px(f), y0, px(f), y0 + 5); if (maxF <= 20 || f % 2 === 0) L.add(T(this, px(f), y0 + 15, String(f), { size: 12, color: C.muted })); }
      L.add(T(this, (x0 + x1) / 2, y0 + 32, _t('s.piso'), { size: 13, bold: true, color: C.muted }));
      // Separadores de actos (el Acto II empieza en el piso 10 y el III en el 19)
      for (let k = 1; k < D.LAST_ACT; k++) {
        const f = E.FLOORS_PER_ACT * k;
        if (maxF <= f) break;
        const xs = (px(f) + px(f + 1)) / 2, col = k >= 2 ? 0xc9a8ff : C.frost;
        g.lineStyle(1.5, col, 0.6);
        for (let y = y1; y < y0; y += 10) g.lineBetween(xs, y, xs, Math.min(y + 5, y0));
        L.add(T(this, xs + 6, y1 - 6, _t('s.acto_0', { 0: ROMAN[k + 1] }), { size: 12, bold: true, color: col, ox: 0 }));
      }
      // Leyenda
      const leg = (x, col, label, dash) => { const lg = this.add.graphics(); lg.lineStyle(3, col, 1); lg.lineBetween(x, Y + 22, x + 26, Y + 22); L.add([lg, T(this, x + 34, Y + 22, label, { size: 14, ox: 0, color: C.parch })]); void dash; };
      leg(X + 300, C.blood, _t('s.vida')); leg(X + 386, C.gold, _t('s.oro')); leg(X + 466, 0x6b4a46, _t('s.vida_max'));
      // Líneas animadas (vida máxima tenue, vida y oro)
      const lines = this.add.graphics(); L.add(lines);
      const marks = this.add.container(0, 0); L.add(marks);
      const draw = (k) => {
        lines.clear();
        const upto = k * (tl.length - 1);
        const path = (fy, col, wdt, alpha) => {
          lines.lineStyle(wdt, col, alpha); lines.beginPath();
          tl.forEach((e, i) => {
            if (i > Math.ceil(upto)) return;
            let x = px(e.floor), y = fy(e);
            if (i === Math.ceil(upto) && i > 0) { const p = tl[i - 1], t = upto - (i - 1); x = px(p.floor) + (x - px(p.floor)) * t; y = fy(p) + (y - fy(p)) * t; }
            if (i === 0) lines.moveTo(x, y); else lines.lineTo(x, y);
          });
          lines.strokePath();
        };
        path((e) => pyH(e.maxHp), 0x6b4a46, 2, 0.9);
        path((e) => pyG(e.gold), C.gold, 3, 1);
        path((e) => pyH(e.hp), C.blood, 4, 1);
        tl.forEach((e, i) => { if (i <= upto + 0.001) { lines.fillStyle(C.blood, 1); lines.fillCircle(px(e.floor), pyH(e.hp), 3.5); lines.fillStyle(C.gold, 1); lines.fillCircle(px(e.floor), pyG(e.gold), 2.5); } });
      };
      this.tweens.addCounter({ from: 0, to: 1, duration: 1100, ease: 'Sine.inOut', onUpdate: (t) => draw(t.getValue()), onComplete: () => { draw(1); showMarks(); } });
      // Marcadores: élites (morado), jefes (corona/Wyrm), derrota (calavera); y tooltip por piso
      const tip = this.tip || (this.tip = tooltip(this));
      const showMarks = () => {
        tl.forEach((e, i) => {
          const x = px(e.floor), y = pyH(e.hp);
          if (e.type === 'elite') { marks.add(this.add.circle(x, y, 11, 0x2a1640).setStrokeStyle(2, C.arcane)); marks.add(this.add.image(x, y, 'ic_skull').setIconScale(0.22).setTint(0xd6b8ff)); }
          if (e.type === 'boss' && !e.dead) { marks.add(this.add.circle(x, y, 14, 0x2b2416).setStrokeStyle(2, C.gold)); marks.add(this.add.image(x, y, e.floor > E.FLOORS_PER_ACT ? 'ic_wyrm' : 'ic_crown').setIconScale(0.28)); }
          if (e.dead) {
            const sk = this.add.circle(x, y, 16, C.blood).setStrokeStyle(2, 0xffffff);
            marks.add([sk, this.add.image(x, y, 'ic_skull').setIconScale(0.3)]);
            this.tweens.add({ targets: sk, scale: { from: 1.6, to: 1 }, duration: 380, ease: 'Back.out' });
          }
          const hit = this.add.zone(x, (y0 + y1) / 2, Math.max(16, (x1 - x0) / maxF), y0 - y1).setInteractive();
          const nm = e.type === 'start' ? _t('s.entrada') : (D.NODE_TYPES[e.type] ? D.NODE_TYPES[e.type].name : e.type);
          hit.on('pointerover', () => tip.show(Math.min(x + 12, 1000), Math.max(110, y - 90), _t('tl.floor', { n: e.floor, nm }) + (e.dead ? _t('tl.dead') : ''), _t('tl.stats', { hp: e.hp, max: e.maxHp, g: e.gold })));
          hit.on('pointerout', () => tip.hide());
          marks.add(hit);
          void i;
        });
      };
      // 4 datos
      const played = Object.entries(s.playedById || {}).sort((a, b) => b[1] - a[1])[0];
      const hard = Object.entries(s.dmgByFloor || {}).sort((a, b) => b[1] - a[1])[0];
      const facts = [
        [_t('s.dano_total'), fmtScore(s.damageDealt || 0)],
        [_t('s.carta_mas_jugada'), played ? `${D.CARDS[played[0]].name} ×${played[1]}` : '—'],
        [_t('s.golpe_mas_fuerte'), String(s.maxHit || 0)],
        [_t('s.piso_mas_duro'), hard ? _t('s.piso_0_1_pv', { 0: hard[0], 1: hard[1] }) : '—']
      ];
      facts.forEach(([k, v], i) => {
        const cx = 640 + (i - 1.5) * 248, fy = 540;
        const fg = this.add.graphics(); fg.fillStyle(0x1f1a0d, 0.94); fg.fillRoundedRect(cx - 116, fy - 32, 232, 66, 12); fg.lineStyle(1.5, C.gold, 0.5); fg.strokeRoundedRect(cx - 116, fy - 32, 232, 66, 12);
        L.add([fg, T(this, cx, fy - 13, k, { size: 14, color: C.muted }), U.fitText(T(this, cx, fy + 12, v, { size: 21, bold: true, color: C.parch }), 216, 0, 12)]);
      });
      return L;
    }

    /** Final del acto II: destellos fríos y cálidos que se alternan por toda la pantalla. */
    victoryFx() {
      FL.confetti(this, 640, 70, 90, 900);   // confeti al ganar
      this.time.delayedCall(700, () => FL.confetti(this, 320, 90, 40, 500));
      this.time.delayedCall(1100, () => FL.confetti(this, 960, 90, 40, 500));
      let k = 0;
      this.time.addEvent({ delay: 240, loop: true, callback: () => {
        const warm = k++ % 2 === 0;
        const x = 100 + Math.random() * 1080, y = 80 + Math.random() * 300;
        burst(this, x, y, warm ? C.flame : 0x9fd6ff, 14, 70);
        if (!warm && Math.random() < 0.5) burst(this, x, y, 0xffffff, 6, 30);
      } });
      // Brasas que suben y nieve que cae a la vez
      for (let i = 0; i < 24; i++) {
        const e = this.add.image(Math.random() * 1280, 740, 'dot').setTint(C.ember).setScale(0.25 + Math.random() * 0.25).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: e, y: -20, x: e.x + (Math.random() - 0.5) * 160, alpha: { from: 0.9, to: 0 }, duration: 4000 + Math.random() * 3000,
          delay: Math.random() * 3000, repeat: -1 });
      }
    }

    /** «¡Nuevo personaje: X!»: su silueta negra se revela poco a poco. Clic para cerrar. */
    charUnlocked(id) {
      const cd = D.CHARACTERS[id], key = 'art_' + cd.art;
      const layer = this.add.container(0, 0).setDepth(LY.modal);
      const dim = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.8).setInteractive();
      const glow = this.add.circle(640, 340, 200, cd.color, 0.15);
      const img = this.add.image(640, 470, key).setOrigin(0.5, 1);
      img.setScale(Math.min(320 / this.textures.get(key).getSourceImage().height, 400 / this.textures.get(key).getSourceImage().width)).setTint(0x000000);
      const title = T(this, 640, 90, _t('s.nuevo_personaje_0', { 0: cd.name }), { size: 60, font: 'display', color: C.gold, stroke: 0x000000, strokeThickness: 6 }).setAlpha(0);
      const sub = T(this, 640, 520, _t('s.0_ya_puedes_elegirlo_al', { 0: cd.title }), { size: 20, color: C.parch, style: 'italic' }).setAlpha(0);
      layer.add([dim, glow, img, title, sub]);
      this.tweens.add({ targets: title, alpha: 1, scale: { from: 1.3, to: 1 }, duration: 600, ease: 'Back.out' });
      this.tweens.addCounter({ from: 0, to: 255, duration: 1800, delay: 500, onUpdate: (tw) => { const v = Math.round(tw.getValue()); img.setTint(Phaser.Display.Color.GetColor(v, v, v)); },
        onComplete: () => { img.clearTint(); burst(this, 640, 300, cd.color, 40, 200); FL.confetti(this, 640, 120, 80, 800, LY.modal + 5); this.tweens.add({ targets: sub, alpha: 1, duration: 400 }); } });
      Sfx.play('win');
      dim.on('pointerup', () => layer.destroy());
    }

    /** «¡Ascensión N desbloqueada!» con un destello dorado breve. */
    ascUnlocked(n, y) {
      const t = T(this, 640, y, _t('s.ascension_0_desbloqueada', { 0: n }), { size: 24, font: 'display', color: C.gold, stroke: 0x000000, strokeThickness: 4 });
      const glow = this.add.rectangle(640, y, t.width + 60, 34, C.gold, 0).setBlendMode(Phaser.BlendModes.ADD);
      glow.setDepth(t.depth - 1);
      this.tweens.add({ targets: glow, alpha: { from: 0.45, to: 0 }, scaleX: { from: 0.6, to: 1.15 }, duration: 900, ease: 'Quad.out' });
      this.tweens.add({ targets: t, scale: { from: 1.3, to: 1 }, duration: 450, ease: 'Back.out' });
      burst(this, 640 - t.width / 2, y, C.gold, 14, 60);
      burst(this, 640 + t.width / 2, y, C.gold, 14, 60);
      FL.confetti(this, 640, y - 20, 50, 600);   // subir de Ascensión
    }

    /** Bloque del desafío diario: puntuación, mejor del día, intento y racha. */
    dailyPanel(d) {
      const x = 770, w = 310, cx = x + w / 2;
      const g = this.add.graphics();
      g.fillStyle(0x1f1a0d, 0.94); g.fillRoundedRect(x, 218, w, 292, 14);
      g.lineStyle(2, C.gold, d.isNewBest ? 1 : 0.5); g.strokeRoundedRect(x, 218, w, 292, 14);
      T(this, cx, 244, _t('s.desafio_diario_2'), { size: 15, bold: true, color: C.gold }).setLetterSpacing(2);
      T(this, cx, 268, fmtDay(d.date), { size: 16, color: C.muted });
      T(this, cx, 300, _t('s.puntuacion_2'), { size: 15, color: C.muted });
      const sc = T(this, cx, 340, fmtScore(d.score), { size: 56, font: 'display', color: C.parch, stroke: 0x000000, strokeThickness: 4 });
      FL.countUp(this, sc, 0, d.score, fmtScore, 1000, 250);
      if (d.isNewBest) {
        T(this, cx, 392, _t('s.nuevo_mejor_del_dia'), { size: 21, bold: true, color: C.flame });
        this.tweens.add({ targets: sc, scale: { from: 1.25, to: 1 }, duration: 500, ease: 'Back.out' });
        burst(this, cx, 340, C.gold, 24, 110);
      } else {
        T(this, cx, 392, _t('s.mejor_del_dia_0', { 0: fmtScore(d.best) }), { size: 19, color: C.gold });
      }
      T(this, cx, 430, _t('s.intento_n_0', { 0: d.attempts }), { size: 18, color: C.parch });
      T(this, cx, 460, _t('daily.streak', { n: d.streak }), { size: 18, color: C.parch });
      // Compartir: texto con emojis + código comprobable (#XXXX)
      const run = this.registry.get('run');
      button(this, cx, 488, _t('s.compartir'), () => U.copyOrShow(this, E.dailyShareText(run)), { w: 180, h: 34, size: 18, variant: 'gold' });
    }
  }

  /* =================================================================
   * Visor / selector de mazo (superpuesto sobre otra escena)
   * modos: view | remove | upgrade
   * ================================================================= */
  class DeckView extends Phaser.Scene {
    constructor() { super('DeckView'); }
    create(data) {
      this.dragMoved = false; this.dy = undefined;
      const run = this.registry.get('run');
      const mode = data.mode || 'view';
      this.data_ = data;
      let cards = (data.cards || (run ? run.deck : [])).slice();
      if (mode === 'upgrade') cards = cards.filter(E.canUpgrade);
      // Orden por tipo y nombre (además, oculta el orden real del mazo de robo)
      const order = { attack: 0, skill: 1, power: 2, curse: 3 };
      const costKey = (c) => (E.isX(c) ? 99 : typeof E.cardCost(c) === 'number' ? E.cardCost(c) : 100);   // X y sin coste al final
      if (data.sort === 'cost') cards.sort((a, b) => costKey(a) - costKey(b) || E.cardName(a).localeCompare(E.cardName(b)));
      else cards.sort((a, b) => order[E.cardDef(a).type] - order[E.cardDef(b).type] || E.cardName(a).localeCompare(E.cardName(b)));
      const cancelable = mode === 'view' || data.cancelable !== false;

      this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.86).setInteractive();
      T(this, 640, 52, data.title || _t('s.mazo'), { size: 40, font: 'display', color: C.gold });
      T(this, 640, 88, mode === 'upgrade' ? _t('s.se_muestran_las_cartas_ya')
        : mode === 'view' ? _t('s.0_cartas', { 0: cards.length }) : _t('s.haz_clic_en_una_carta'), { size: 16, color: C.muted });

      // Sendas: cuántas cartas de cada senda llevas (solo tu mazo de la partida); la elegida, con borde dorado
      if (mode === 'view' && !data.cards && run) {
        const counts = E.pathCounts(run);
        E.charDef(run).paths.forEach((pth, i) => {
          const x = 742 + i * 168, y = 88, on = run.path === pth.id;
          const g = this.add.graphics(); g.fillStyle(0x0d0b0a, 0.95); g.fillRoundedRect(x, y - 15, 158, 30, 15);
          g.lineStyle(on ? 2.5 : 1.5, on ? C.gold : pth.color, 1); g.strokeRoundedRect(x, y - 15, 158, 30, 15);
          this.add.image(x + 17, y, 'ic_' + pth.icon).setIconScale(0.3);
          U.fitText(T(this, x + 34, y, pth.name, { size: 15, bold: on, ox: 0, color: pth.color }), 90, 0, 10);
          T(this, x + 146, y, String(counts[pth.id] || 0), { size: 17, bold: true, ox: 1, color: C.parch });
        });
      }
      const content = this.add.container(0, 0);
      const cols = 6, cw = 186, ch = 236, x0 = 640 - (cols - 1) * cw / 2, y0 = 240;
      const tip = tooltip(this);
      let selected = null;
      if (!cards.length) content.add(T(this, 640, 300, _t('s.no_hay_cartas_aqui'), { size: 22, color: C.muted, style: 'italic' }));
      cards.forEach((card, i) => {
        const cv = cardView(this, card, { preview: mode === 'upgrade' });
        const x = x0 + (i % cols) * cw, y = y0 + Math.floor(i / cols) * ch;
        cv.setPosition(x, y).setScale(0.9);
        if (mode !== 'view') {
          cv.setInteractive({ useHandCursor: true });
          cv.on('pointerup', () => {
            if (this.dragMoved) return;
            if (selected) selected.sel.destroy();
            const ring = this.add.graphics(); ring.lineStyle(4, C.gold, 1); ring.strokeRoundedRect(-U.CARD_W / 2 - 6, -U.CARD_H / 2 - 6, U.CARD_W + 12, U.CARD_H + 12, 14);
            cv.addAt(ring, 0); cv.sel = ring; selected = cv;
            confirm.setEnabled(true);
            Sfx.play('click');
            if (mode === 'upgrade') this.openCompare(card, () => confirm.press());   // normal → mejorada, lado a lado
          });
        }
        cv.setInteractive();
        cv.on('pointerover', () => showGloss(this, card, { x, y: y + content.y, scale: cv.scale }));
        cv.on('pointerout', () => { tip.hide(); hideGloss(this); });
        content.add(cv);
      });

      // Desplazamiento si no cabe
      const rows = Math.ceil(cards.length / cols);
      const minY = Math.min(0, 620 - (y0 + (rows - 1) * ch + ch / 2));
      const scrollTo = (v) => { content.y = Phaser.Math.Clamp(v, minY, 0); };
      this.input.on('wheel', (p, o, dx, dy) => scrollTo(content.y - dy * 0.7));
      this.input.on('pointerdown', (p) => { this.dy = p.worldY; this.dragMoved = false; });
      this.input.on('pointermove', (p) => { if (p.isDown && this.dy !== undefined && Math.abs(p.worldY - this.dy) > 4) { this.dragMoved = true; scrollTo(content.y + p.worldY - this.dy); this.dy = p.worldY; } });
      this.input.on('pointerup', () => { this.dy = undefined; });
      const mask = this.make.graphics({ add: false }); mask.fillRect(0, 110, 1280, 530);
      content.setMask(mask.createGeometryMask());

      const bar = this.add.graphics(); bar.fillStyle(0x000000, 0.6); bar.fillRect(0, 640, 1280, 80);
      const close = () => { this.scene.stop(); };
      const CONFIRM = { upgrade: _t('s.confirmar_mejora'), remove: _t('s.confirmar_purga'), duplicate: _t('s.duplicar'), choose: _t('s.elegir') };
      const confirm = button(this, mode === 'view' ? -999 : (cancelable ? 760 : 640), 680, data.confirm || CONFIRM[mode] || _t('s.confirmar'), () => {   // data.confirm: texto propio (Forja)
        if (!selected) return;
        const uid = selected.cardData.uid;
        this.scene.stop();
        data.onPick && data.onPick(uid);
      }, { w: 240, variant: mode === 'remove' ? 'danger' : 'gold' });
      confirm.setEnabled(false);
      if (mode === 'view') confirm.setVisible(false);
      if (cancelable) button(this, mode === 'view' ? 640 : 500, 680, mode === 'view' ? _t('s.cerrar') : _t('s.cancelar'), close, { w: 200, variant: 'ghost' });
      if (cancelable) this.input.keyboard.on('keydown-ESC', close);
      // Mando: flechas por la cuadrícula (con desplazamiento), A elige, B cancela, Y cierra
      U.padNav(this, {
        back: cancelable ? close : null,
        onAction: (a) => { if (a === 'deck' && cancelable) { close(); return true; } return false; },
        main: (items) => (items.find((it) => it.obj.cardData) || {}).obj,
        scroll: { root: content, top: 118, bottom: 636, get: () => content.y, set: scrollTo, step: ch }
      });
    }
  }

  /** Hoguera: comparación de la mejora antes de confirmar (normal → mejorada, coste y cambios en verde). */
  DeckView.prototype.openCompare = function (card, onConfirm) {
    if (this.compare) this.compare.destroy();
    const L = this.compare = this.add.container(0, 0).setDepth(LY.panel);
    const g = this.add.graphics(); g.fillStyle(0x070a09, 0.96); g.fillRect(0, 0, 1280, 720);
    L.add([this.add.zone(0, 0, 1280, 720).setOrigin(0, 0).setInteractive(), g,
      T(this, 640, 52, _t('s.mejorar_0', { 0: E.cardDef(card).name }), { size: 40, font: 'display', color: C.gold }),
      U.upgradeCompare(this, card, 640, 290)]);
    const close = () => { L.destroy(); this.compare = null; };
    L.add(button(this, 520, 660, _t('s.elegir_otra'), close, { w: 200, variant: 'ghost' }));
    L.add(button(this, 760, 660, _t('s.mejorar'), () => { close(); onConfirm(); }, { w: 220, variant: 'gold' }));
  };

  /* =================================================================
   * Compendio: cartas, reliquias, pociones y bestiario descubiertos,
   * con estadísticas de tus partidas (meta.codex).
   * ================================================================= */
  const CODEX_TABS = [['cards', 's.cartas'], ['relics', 's.reliquias'], ['potions', 's.pociones'], ['enemies', 's.bestiario'], ['skills', 'gl.tab'], ['lore', 'lore.tab']];   // claves: se traducen al pintar
  /**
   * Abre el Compendio en la pestaña «Habilidades» ENCIMA de la escena actual (que queda en pausa tal cual):
   * al cerrarlo se vuelve a ella. Lo usan el «?» del combate y ⚙ → «Glosario de habilidades».
   */
  function openGlossary(from) {
    if (!from || !from.scene || from.scene.isActive('Compendium')) return;
    if (from.tip) from.tip.hide();
    hideGloss(from);
    const key = from.sys.settings.key;
    from.scene.pause();
    from.scene.launch('Compendium', { tab: 'skills', over: key });
    from.scene.bringToTop('Compendium');
    if (from.scene.get('Overlay')) from.scene.bringToTop('Overlay');
  }
  U.openGlossary = openGlossary;
  /** Texto sin tildes ni mayúsculas (buscador del glosario). */
  const fold = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const RARITY_ORDER = { starter: 0, common: 1, uncommon: 2, rare: 3, legendary: 4, special: 5, curse: 6 };
  const ACT_OF_ENEMY = (id) => { for (let a = D.LAST_ACT; a >= 2; a--) if (Object.values(D.ENCOUNTERS[a] || {}).flat().includes(id)) return a; return 1; };
  const TIER_LABEL = { get normal() { return _t('s.normal'); }, get elite() { return _t('s.elite'); }, get boss() { return _t('s.jefe'); } };
  /** Textura y tinte del arte de un enemigo (igual que en combate: sustituto azul hielo si no hay PNG). */
  function enemyArt(scene, d) {
    const key = 'art_' + d.art;
    if (scene.textures.exists(key)) return { key, tint: null };
    const fb = ENEMY_FALLBACK[d.art];
    let k = 'art_' + (fb || 'rat');
    if (!scene.textures.exists(k) && fb && ENEMY_FALLBACK[fb]) k = 'art_' + ENEMY_FALLBACK[fb];   // sustituto de un sustituto
    return { key: k, tint: fallbackTint(d.art) };
  }
  /** «Victoria con ella en el mazo: 45% (12 partidas)» o «Pocos datos» si hay menos de 3 partidas. */
  const winLine = (e, what) => (e.runs >= 3 ? _t('s.victoria_con_0_1_2', { 0: what, 1: Math.round(100 * e.wins / e.runs), 2: e.runs }) : _t('s.victoria_con_0_pocos_datos', { 0: what, 1: e.runs || 0 }));
  const winRateOf = (e) => (e && e.runs >= 3 ? e.wins / e.runs : -1);

  class Compendium extends Phaser.Scene {
    constructor() { super('Compendium'); }
    create(data) {
      this.over = (data && data.over) || null;   // abierto encima de otra escena (combate, ⚙): al volver se reanuda
      this.content = null; this.countT = null; this.skillMask = null; this.searchEl = null; this.skillPanel = null;
      const goBack = () => this.leave();
      { const self = this; U.padNav(this, { back: goBack, tab: (d) => { const ks = CODEX_TABS.map((t) => t[0]), k = ks[(ks.indexOf(this.tab) + d + ks.length) % ks.length]; this.tab = k; this.scene.restart({ tab: k, over: this.over }); }, tabRect: () => ({ x: 120, y: 80, w: 1040, h: 40 }), scroll: { get root() { return self.content; }, top: 140, bottom: 712, get: () => (self.content ? self.content.y : 0), set: (v) => { if (self.content) self.scrollTo(v); }, step: 140 } }); }   // mando / flechas
      Codex.flush();   // lo que quedara pendiente
      const meta = this.meta = loadMeta();
      // «¡Nuevo!»: descubiertas después de la última visita; y se apunta esta visita
      this.lastOpen = meta.codexLastOpen || '';
      const m2 = loadMeta(); m2.codexLastOpen = new Date().toISOString(); saveMeta(m2);
      this.tab = (data && data.tab) || this.tab || 'cards';
      this.filter = this.filter || 'all'; this.order = this.order || 'rarity';
      this.dragMoved = false; this.dy = undefined;
      menuBackdrop(this, 0);
      this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.5);
      this.tip = tooltip(this);
      button(this, this.over === 'Combat' ? 110 : 80, 40, this.over === 'Combat' ? _t('gl.close') : _t('s.volver'), goBack, { w: this.over === 'Combat' ? 190 : 130, h: 40, size: 18, variant: 'ghost' });
      T(this, 640, 44, _t('s.compendio'), { size: 52, font: 'display', color: C.gold, stroke: 0x000000, strokeThickness: 5 });
      // Progreso total con barra dorada
      const pr = M.codexProgress(meta);
      T(this, 1240, 32, _t('s.descubierto_0_1', { 0: pr.seen, 1: pr.total }), { size: 17, bold: true, color: C.gold, ox: 1 });
      const bar = this.add.graphics();
      bar.fillStyle(0x0c100e, 1); bar.fillRoundedRect(1040, 50, 200, 10, 5);
      bar.fillStyle(C.gold, 1); bar.fillRoundedRect(1040, 50, Math.max(10, 200 * pr.seen / Math.max(1, pr.total)), 10, 5);
      // Parche 3.6: hitos del 25/50/75/100 % (Esencia y un cosmético; se cobran al abrir el compendio)
      {
        const m3 = loadMeta(), fresh = M.claimMilestones(m3);
        if (fresh.length) { saveMeta(m3); fresh.forEach((x) => U.questToast(this, _t('cx.milestone', { p: x.pct }), _t('cx.milestoneRw', { e: x.essence, c: _t('aff.rw.' + x.cosmetic[0], { n: D.COSMETICS[x.cosmetic[0]][x.cosmetic[1]].name }) }), C.gold)); }
        const got = m3.milestones || [];
        D.CODEX_MILESTONES.forEach((ms) => { const tx = 1040 + 2 * ms.pct; bar.fillStyle(got.includes(ms.pct) ? C.gold : 0x5a5f58, 1); bar.fillTriangle(tx - 5, 66, tx + 5, 66, tx, 59); });
        const hz = this.add.zone(1140, 56, 220, 26).setInteractive();
        const lines = D.CODEX_MILESTONES.map((ms) => `${got.includes(ms.pct) ? '✓' : '·'} ${ms.pct} %: ${_t('cx.milestoneRw', { e: ms.essence, c: _t('aff.rw.' + ms.cosmetic[0], { n: D.COSMETICS[ms.cosmetic[0]][ms.cosmetic[1]].name }) })}`);
        hz.on('pointerover', () => this.tip.show(860, 80, _t('cx.milestones'), lines.join('\n')));
        hz.on('pointerout', () => this.tip.hide());
      }
      // Pestañas
      CODEX_TABS.forEach(([k, lk], i) => {
        const label = _t(lk);
        const bt = k === 'lore' ? { seen: (this.meta.lore || []).length, total: D.LORE_IDS.length } : pr.byType[k];
        const tb = button(this, 640 + (i - (CODEX_TABS.length - 1) / 2) * 172, 100, bt ? `${label} · ${bt.seen}/${bt.total}` : label, () => { if (this.tab !== k) { this.tab = k; this.scene.restart({ tab: k, over: this.over }); } },
          { w: 164, h: 40, size: 16, variant: this.tab === k ? 'gold' : 'ghost', font: 'body' });
        U.fitText(tb.list.find((o) => o.type === 'Text'), 150, 0, 11);
      });
      // Scroll (rueda y arrastre, como el Mazo)
      this.input.on('wheel', (p, o, dx, dy) => { if (!this.detail) this.scrollTo(this.content.y - dy * 0.7); });
      this.input.on('pointerdown', (p) => { this.dy = p.worldY; this.dragMoved = false; });
      this.input.on('pointermove', (p) => {
        if (this.detail || !p.isDown || this.dy === undefined) return;
        if (Math.abs(p.worldY - this.dy) > 4) { this.dragMoved = true; this.scrollTo(this.content.y + p.worldY - this.dy); this.dy = p.worldY; }
      });
      this.input.on('pointerup', () => { this.dy = undefined; });
      this.renderTab();
    }
    scrollTo(v) { this.content.y = Phaser.Math.Clamp(v, this.minY, 0); }
    /* ---------- Pestaña «Lore» (Parche 3.7): 24 fragmentos; los bloqueados, «???» con su pista ---------- */
    renderLore() {
      const meta = loadMeta(), got = meta.lore || [];
      T(this, 40, 150, _t('lore.count', { n: got.length, t: D.LORE_IDS.length }), { size: 18, bold: true, color: 0xc9a8ff, ox: 0 });
      button(this, 1150, 150, `▶ ${_t('intro.watch')}`, () => playIntro(this), { w: 200, h: 36, size: 16, variant: 'ghost', font: 'body' });
      const top = 176, content = this.content = this.add.container(0, 0);
      const mask = this.make.graphics({ add: false }); mask.fillRect(0, top, 1280, 720 - top);
      content.setMask(mask.createGeometryMask());
      const W = 600, H = 126, gap = 10;
      D.LORE_IDS.forEach((id, i) => {
        const L = D.LORE[id], open = got.includes(id), x = i % 2 ? 640 + gap / 2 : 640 - gap / 2 - W, y = top + 8 + Math.floor(i / 2) * (H + gap);
        const g = this.add.graphics();
        g.fillStyle(open ? 0x16121f : 0x0c0e0d, 0.95); g.fillRoundedRect(x, y, W, H, 12);
        g.lineStyle(1.5, open ? 0xc9a8ff : 0x333a36, open ? 0.9 : 1); g.strokeRoundedRect(x, y, W, H, 12);
        const num = T(this, x + 16, y + 20, String(i + 1).padStart(2, '0'), { size: 15, bold: true, color: open ? 0xc9a8ff : C.muted, ox: 0 });
        const title = U.fitText(T(this, x + 52, y + 20, open ? L.title : '???', { size: 19, bold: true, font: open ? 'display' : 'body', color: open ? C.gold : C.muted, ox: 0 }), W - 70, 0, 12);
        const body = open
          ? U.fitText(T(this, x + 18, y + 40, L.text, { size: 14, color: C.parch, wrap: W - 36, ox: 0, oy: 0, lineSpacing: 2 }), W - 36, H - 48, 9)
          : U.fitText(T(this, x + 18, y + 44, _t('lore.hint', { h: L.hint }), { size: 14, style: 'italic', color: C.muted, wrap: W - 36, ox: 0, oy: 0 }), W - 36, H - 52, 9);
        content.add([g, num, title, body]);
      });
      const h = Math.ceil(D.LORE_IDS.length / 2) * (H + gap) + 16;
      this.minY = Math.min(0, 720 - (top + h));
    }
    /* ---------- Pestaña «Habilidades»: el glosario (data.js GLOSSARY) por categorías ---------- */
    renderSkills() {
      this.glChar = this.glChar || 'all';
      this.glQuery = this.glQuery || '';
      // Buscador: un <input> de verdad sobre el lienzo (con teclado en el móvil); se recoloca con el lienzo
      const box = this.add.graphics();
      box.fillStyle(0x0c100e, 0.95); box.fillRoundedRect(40, 132, 270, 36, 10);
      box.lineStyle(1.5, C.gold, 0.7); box.strokeRoundedRect(40, 132, 270, 36, 10);
      this.add.image(62, 150, 'ic_eye').setIconScale(0.3).setAlpha(0.8);
      this.searchHint = T(this, 82, 150, _t('gl.search'), { size: 16, color: C.muted, ox: 0, style: 'italic' }).setVisible(!this.glQuery);
      const zone = this.add.zone(40, 132, 270, 36).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => { if (this.searchEl) this.searchEl.focus(); });
      this.makeSearch();
      // Filtro por personaje: Todos · Común · cada personaje
      const opts = ['all', 'common', ...D.CHAR_IDS];
      const label = (k) => (k === 'all' ? _t('gl.all') : k === 'common' ? _t('gl.common') : D.CHARACTERS[k].name);   // (el botón encoge el texto si no cabe)
      const gStep = Math.min(127, Math.floor((1262 - 330) / opts.length)), gW = gStep - 7;   // 8 botones con el 6.º personaje
      this.charBtns = opts.map((k, i) => button(this, 330 + gStep / 2 + i * gStep, 150, label(k), () => { this.glChar = k; this.paintCharBtns(); this.skillsList(); },
        { w: gW, h: 34, size: 15, font: 'body', variant: 'ghost' }));
      this.charRing = this.add.graphics();
      this.paintCharBtns = () => {
        const i = opts.indexOf(this.glChar), b = this.charBtns[i];
        this.charRing.clear(); this.charRing.lineStyle(3, C.gold, 1); this.charRing.strokeRoundedRect(b.x - gW / 2 - 2, b.y - 19, gW + 4, 38, 10);
      };
      this.paintCharBtns();
      this.skillsList();
    }
    makeSearch() {
      if (this.searchEl || typeof document === 'undefined') return;
      const el = document.createElement('input');
      el.type = 'search'; el.value = this.glQuery; el.autocomplete = 'off';
      el.setAttribute('aria-label', _t('gl.search'));
      el.style.cssText = 'position:fixed;z-index:20;background:transparent;border:0;outline:0;color:' + U.TH.color.ink + ';font-family:' + U.TH.font.ui + ';padding:0;margin:0';
      document.body.appendChild(el);
      this.searchEl = el;
      const place = () => {
        const cv = this.sys.game.canvas; if (!cv || this.searchEl !== el) return;
        const b = cv.getBoundingClientRect(), k = b.width / 1280;
        Object.assign(el.style, { left: `${b.left + 82 * k}px`, top: `${b.top + 136 * k}px`, width: `${220 * k}px`, height: `${28 * k}px`, fontSize: `${16 * k}px` });
      };
      place();
      this.scale.on('resize', place); window.addEventListener('resize', place);
      el.addEventListener('input', () => { this.glQuery = el.value; this.searchHint.setVisible(!el.value); this.skillsList(); });
      el.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Escape') { el.value = ''; this.glQuery = ''; this.searchHint.setVisible(true); this.skillsList(); el.blur(); } });
      el.addEventListener('keyup', (ev) => ev.stopPropagation());
      const kill = () => { window.removeEventListener('resize', place); this.scale.off('resize', place); el.remove(); if (this.searchEl === el) this.searchEl = null; };
      this.events.once('shutdown', kill); this.events.once('destroy', kill);
    }
    /** Entradas del glosario visibles con el filtro y la búsqueda actuales, por categoría. */
    skillEntries() {
      const q = fold(this.glQuery).trim(), ch = this.glChar;
      const G = D.GLOSSARY, byCat = {};
      Object.keys(G).forEach((id) => {
        const g = G[id];
        if (ch === 'common' && g.chars) return;
        if (ch !== 'all' && ch !== 'common' && !(g.chars || []).includes(ch)) return;
        const desc = U.glossDesc(id);
        if (q && !fold(g.name + ' ' + desc).includes(q)) return;
        (byCat[g.cat] = byCat[g.cat] || []).push({ id, g, desc });
      });
      return D.GLOSSARY_CATS.filter((c) => byCat[c]).map((c) => [c, byCat[c]]);
    }
    skillsList() {
      if (this.content) this.content.destroy();
      if (this.skillMask) this.skillMask.destroy();
      const top = 184;
      if (!this.skillPanel) { this.skillPanel = this.add.rectangle(640, (top + 720) / 2, 1240, 720 - top, 0x000000, 0.35); }
      const content = this.content = this.add.container(0, 0);
      content.scrollRoot = true;   // se desplaza: lo que queda fuera de la vista no cuenta como «salirse» (test/overlap.js)
      const mask = this.skillMask = this.make.graphics({ add: false }); mask.fillRect(0, top, 1280, 720 - top);
      content.setMask(mask.createGeometryMask());
      const cats = this.skillEntries();
      let y = top + 14, n = 0;
      if (!cats.length) content.add(T(this, 640, top + 70, _t('gl.none'), { size: 20, color: C.muted, style: 'italic' }));
      for (const [cat, list] of cats) {
        content.add(T(this, 48, y + 12, _t('gl.cat.' + cat), { size: 24, font: 'display', color: C.gold, ox: 0 }));
        const lg = this.add.graphics(); lg.lineStyle(1, C.gold, 0.35); lg.lineBetween(48, y + 32, 1232, y + 32); content.add(lg);
        y += 44;
        for (let i = 0; i < list.length; i += 2) {
          let rowH = 0;
          for (let j = 0; j < 2 && i + j < list.length; j++) {
            const { g, desc } = list[i + j], x = 48 + j * 600;
            const ring = this.add.circle(x + 22, y + 22, 20, 0x10140f).setStrokeStyle(2, g.color || C.line, 0.9);
            const ic = this.add.image(x + 22, y + 21, this.textures.exists('ic_' + g.icon) ? 'ic_' + g.icon : 'ic_question').setIconScale(0.42);
            if (['strength', 'snow', 'up', 'book', 'shield', 'heart', 'leaf', 'shard'].includes(g.icon)) ic.setTint(g.color || 0xffffff);
            const chars = (g.chars || []).map((c0) => (D.CHARACTERS[c0] ? D.CHARACTERS[c0].name : '')).join(', ');
            const nm = T(this, x + 54, y + 2, g.name, { size: 18, bold: true, color: C.parch, ox: 0, oy: 0 });
            U.fitText(nm, 360, 0, 13);
            const tag = chars ? T(this, x + 62 + nm.width, y + 5, chars, { size: 13, color: C.muted, ox: 0, oy: 0, style: 'italic' }) : null;
            const dt = T(this, x + 54, y + 26, desc, { size: 15, color: C.muted, ox: 0, oy: 0, wrap: 520, lineSpacing: 1 });
            content.add([ring, ic, nm, dt].concat(tag ? [tag] : []));
            rowH = Math.max(rowH, 30 + dt.height);
            n++;
          }
          y += rowH + 14;
        }
        y += 8;
      }
      this.skillCount = n;
      if (this.countT) this.countT.destroy();
      this.countT = T(this, 1232, top + 26, _t('gl.count', { n }), { size: 13, color: C.muted, ox: 1, oy: 1 });
      content.add(this.countT);
      this.minY = Math.min(0, -(y - 700));
      content.y = 0;
    }
    /** Volver: al título, o a la escena de debajo si se abrió encima (el combate sigue tal cual). */
    leave() {
      if (this.searchEl) { this.searchEl.remove(); this.searchEl = null; }
      if (!this.over) { this.scene.start('Title'); return; }
      const key = this.over;
      this.scene.stop();
      this.scene.resume(key);
    }
    entry(type, id) { return (this.meta.codex[type] || {})[id] || null; }
    isNew(e) { return !!(e && e.seen && e.at && e.at > this.lastOpen && this.lastOpen); }

    /** Rejilla de la pestaña actual dentro de un contenedor con máscara. */
    renderTab() {
      const tab = this.tab;
      if (tab === 'skills') { this.renderSkills(); return; }
      if (tab === 'lore') { this.renderLore(); return; }
      let top = 132;
      if (tab === 'cards') top = this.cardControls();
      const content = this.content = this.add.container(0, 0);
      const mask = this.make.graphics({ add: false }); mask.fillRect(0, top, 1280, 720 - top);
      content.setMask(mask.createGeometryMask());
      const G = { cards: { cols: 9, dx: 120, dy: 160, h: 140 }, relics: { cols: 8, dx: 140, dy: 128, h: 100 },
        potions: { cols: 6, dx: 175, dy: 150, h: 120 }, enemies: { cols: 5, dx: 230, dy: 236, h: 216 } }[tab];
      const ids = this.sortedIds(tab);
      const x0 = 640 - ((G.cols - 1) * G.dx) / 2, y0 = top + 12 + G.h / 2;
      ids.forEach((id, i) => {
        const x = x0 + (i % G.cols) * G.dx, y = y0 + Math.floor(i / G.cols) * G.dy;
        const e = this.entry(tab, id), seen = !!(e && e.seen);
        const lockA = tab !== 'enemies' && !M.isUnlocked(this.meta, id) ? M.lockedBy(id) : null;   // recompensa de logro aún bloqueada
        const cell = lockA ? this.cell_locked(tab, id, x, y, lockA) : this['cell_' + tab](id, x, y, seen, e);
        content.add(cell);
        if (lockA) {
          const hit = this.add.rectangle(x, y, G.dx - 10, G.h + 10, 0, 0).setInteractive();
          const nm = tab === 'cards' ? D.CARDS[id].name : tab === 'relics' ? D.ALL_RELICS[id].name : D.POTIONS[id].name;
          hit.on('pointerover', () => this.tip.show(Math.min(x + 40, 900), Math.min(Math.max(150, y + this.content.y - 40), 560), _t('s.0_bloqueada', { 0: nm }), _t('s.se_desbloquea_con_el_logro', { 0: lockA.name, 1: lockA.desc })));
          hit.on('pointerout', () => this.tip.hide());
          content.add(hit);
          return;
        }
        if (this.isNew(e)) content.add(this.add.circle(x + G.dx / 2 - 18, y - G.h / 2 + 6, 7, C.gold).setStrokeStyle(2, 0x2a1206));
        if (seen) {
          const hit = this.add.rectangle(x, y, G.dx - 10, G.h + 10, 0, 0).setInteractive({ useHandCursor: true });
          hit.on('pointerup', () => { if (!this.dragMoved && !this.detail) this.openDetail(tab, id); });
          content.add(hit);
        }
      });
      if (!ids.length) content.add(T(this, 640, top + 80, _t('s.no_hay_nada_con_este'), { size: 20, color: C.muted, style: 'italic' }));
      const rows = Math.ceil(ids.length / G.cols);
      let bottom = y0 + (rows - 1) * G.dy + G.h / 2 + 10;
      // Bestiario: «Afijos vistos» (élites)
      if (tab === 'enemies') {
        const seenA = this.meta.affixesSeen || [];
        let y = bottom + 30;
        content.add(T(this, 640, y, _t('s.afijos_vistos_0_1', { 0: seenA.length, 1: D.AFFIX_IDS.length }), { size: 24, font: 'display', color: C.gold }));
        y += 40;
        D.AFFIX_IDS.forEach((id, i) => {
          const a = D.AFFIXES[id], seen = seenA.includes(id), x = 360 + (i % 2) * 560, yy = y + Math.floor(i / 2) * 64;
          const g = this.add.graphics(); g.fillStyle(seen ? C.panel2 : 0x0c100e, 0.95); g.fillRoundedRect(x - 260, yy - 26, 520, 54, 12);
          g.lineStyle(1.5, seen ? a.color : 0x333a36, 1); g.strokeRoundedRect(x - 260, yy - 26, 520, 54, 12);
          content.add([g, this.add.image(x - 228, yy, seen ? 'ic_' + a.icon : 'ic_question').setIconScale(0.42).setAlpha(seen ? 1 : 0.35),
            T(this, x - 200, yy - 11, seen ? a.name : '???', { size: 18, bold: true, ox: 0, color: seen ? a.color : C.muted }),
            U.fitText(T(this, x - 200, yy + 11, seen ? a.text : _t('s.vence_a_una_elite_con'), { size: 14, ox: 0, color: seen ? C.parch : C.muted, style: seen ? 'normal' : 'italic' }), 450, 0, 10)]);
        });
        bottom = y + Math.ceil(D.AFFIX_IDS.length / 2) * 64;
      }
      this.minY = Math.min(0, 708 - bottom);
    }
    sortedIds(tab) {
      let ids = M.codexIds(tab);
      if (tab === 'cards') {
        if (this.charFilter && this.charFilter !== 'all') ids = ids.filter((id) => D.CARDS[id].class === this.charFilter);
        if (this.pathFilter && this.pathFilter !== 'all') ids = ids.filter((id) => (D.CARDS[id].tags || []).includes(this.pathFilter));   // Sendas
        if (this.filter === 'kw') ids = ids.filter((id) => U.hasKeyword({ id, up: false }));
        else if (this.filter !== 'all') ids = ids.filter((id) => D.CARDS[id].type === this.filter);
        const byName = (a, b) => D.CARDS[a].name.localeCompare(D.CARDS[b].name, 'es');
        const costNum = (id) => { const c = D.CARDS[id].cost; return typeof c === 'number' ? c : c === 'X' ? 3.5 : 99; };   // X después de las de 3
        const e = (id) => this.entry('cards', id) || {};
        const sorters = {
          rarity: (a, b) => (RARITY_ORDER[D.CARDS[a].rarity] - RARITY_ORDER[D.CARDS[b].rarity]) || byName(a, b),
          cost: (a, b) => (costNum(a) - costNum(b)) || byName(a, b),
          played: (a, b) => ((e(b).played || 0) - (e(a).played || 0)) || byName(a, b),
          win: (a, b) => (winRateOf(e(b)) - winRateOf(e(a))) || byName(a, b)
        };
        ids.sort(sorters[this.order]);
      } else if (tab === 'enemies') {
        const tier = { normal: 0, elite: 1, boss: 2 };
        ids.sort((a, b) => (ACT_OF_ENEMY(a) - ACT_OF_ENEMY(b)) || (tier[D.ENEMIES[a].tier] - tier[D.ENEMIES[b].tier]));
      } else if (tab === 'potions') {
        ids.sort((a, b) => RARITY_ORDER[D.POTIONS[a].rarity] - RARITY_ORDER[D.POTIONS[b].rarity]);
      } else ids.sort((a, b) => (D.BOSS_RELICS[a] ? 1 : 0) - (D.BOSS_RELICS[b] ? 1 : 0));
      return ids;
    }
    /** Filtros, orden y «Tus 3 cartas más ganadoras». Devuelve dónde empieza la rejilla. */
    cardControls() {
      [['all', _t('s.todas')], ['attack', _t('s.ataque')], ['skill', _t('s.habilidad')], ['power', _t('s.poder')], ['kw', _t('s.palabra_clave')]].forEach(([k, label], i) => {
        button(this, 90 + i * 104 + (k === 'kw' ? 14 : 0), 148, label, () => { this.filter = k; this.scene.restart({ tab: 'cards' }); },
          { w: k === 'kw' ? 124 : 96, h: 32, size: 15, font: 'body', variant: this.filter === k ? 'gold' : 'ghost' });
      });
      // Personaje: Todas · <cada personaje> · Neutrales (cicla al pulsar)
      const chOpts = ['all', ...D.CHAR_IDS, 'neutral'], chLabel = (k) => (k === 'all' ? _t('s.pers_todos') : k === 'neutral' ? _t('s.neutrales') : D.CHARACTERS[k].name);
      this.charFilter = this.charFilter || 'all';
      button(this, 662, 148, chLabel(this.charFilter), () => { this.charFilter = chOpts[(chOpts.indexOf(this.charFilter) + 1) % chOpts.length]; this.pathFilter = 'all'; this.scene.restart({ tab: 'cards' }); },
        { w: 118, h: 32, size: 14, font: 'body', variant: this.charFilter === 'all' ? 'ghost' : 'gold' });
      T(this, 760, 148, _t('s.orden'), { size: 15, color: C.muted, ox: 1 });
      [['rarity', _t('s.rareza')], ['cost', _t('s.coste')], ['played', _t('s.mas_jugadas')], ['win', _t('s.victoria_3')]].forEach(([k, label], i) => {
        button(this, 830 + i * 112, 148, label, () => { this.order = k; this.scene.restart({ tab: 'cards' }); },
          { w: 104, h: 32, size: 15, font: 'body', variant: this.order === k ? 'gold' : 'ghost' });
      });
      // Senda: Todas · cada senda (las del personaje filtrado, o las de todos) (cicla al pulsar)
      if (this.charFilter !== 'neutral') {
        const pOpts = ['all', ...D.PATH_IDS.filter((id) => this.charFilter === 'all' || D.PATHS[id].char === this.charFilter)];
        this.pathFilter = pOpts.includes(this.pathFilter) ? this.pathFilter : 'all';
        const pf = this.pathFilter, pth = D.PATHS[pf];
        const pb = button(this, 1124, 187, pth ? _t('path.filterOne', { p: pth.name }) : _t('path.filterAll'), () => { this.pathFilter = pOpts[(pOpts.indexOf(pf) + 1) % pOpts.length]; this.scene.restart({ tab: 'cards' }); },
          { w: 210, h: 30, size: 14, font: 'body', variant: pth ? 'gold' : 'ghost' });
        if (pth) pb.add(this.add.image(-88, 0, 'ic_' + pth.icon).setIconScale(0.26));
      }
      // Tus 3 cartas más ganadoras (runs ≥ 3)
      const best = Object.entries(this.meta.codex.cards).filter(([id, e]) => e.runs >= 3 && M.codexIds('cards').includes(id))
        .sort((a, b) => winRateOf(b[1]) - winRateOf(a[1])).slice(0, 3);
      T(this, 40, 186, _t('s.tus_3_cartas_mas_ganadoras'), { size: 15, bold: true, color: C.gold, ox: 0 });
      if (!best.length) T(this, 252, 186, _t('s.juega_mas_partidas_para_verlas'), { size: 14, color: C.muted, style: 'italic', ox: 0 });
      best.forEach(([id, e], i) => {
        const x = 252 + i * 250;
        const g = this.add.graphics(); g.fillStyle(C.panel2, 1); g.fillRoundedRect(x, 174, 236, 26, 13); g.lineStyle(1, C.gold, 0.7); g.strokeRoundedRect(x, 174, 236, 26, 13);
        const t = T(this, x + 12, 187, `${i + 1}. ${D.CARDS[id].name} · ${I18N.pct(Math.round(100 * e.wins / e.runs))}`, { size: 14, ox: 0, color: C.parch });
        U.fitText(t, 214, 0, 11);
        const hit = this.add.rectangle(x + 118, 187, 236, 26, 0, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => this.openDetail('cards', id));
      });
      return 206;
    }

    /* ---------- Celdas ---------- */
    /** Recompensa de logro aún bloqueada: candado, su nombre y el logro que la da. */
    cell_locked(tab, id, x, y, ach) {
      const c = this.add.container(x, y), nm = tab === 'cards' ? D.CARDS[id].name : tab === 'relics' ? D.ALL_RELICS[id].name : D.POTIONS[id].name;
      if (tab === 'cards') {
        c.add(this.add.image(0, -14, 'cardback').setScale(1.2).setAlpha(0.55));
        c.add(this.add.image(0, -22, 'ic_lock').setIconScale(0.6));
        c.add(U.fitText(T(this, 0, 50, nm, { size: 13, bold: true, color: 0xc9a86a, wrap: 112, align: 'center' }), 112, 22, 8));
        c.add(U.fitText(T(this, 0, 76, _t('s.logro_0', { 0: ach.name }), { size: 11, color: C.muted, style: 'italic', wrap: 112, align: 'center' }), 112, 24, 8));
      } else {
        const R = tab === 'relics' ? 32 : 38, cy = tab === 'relics' ? -12 : -14;
        c.add(this.add.circle(0, cy, R, 0x0c100e).setStrokeStyle(2, 0x6b5a2e, 1));
        c.add(this.add.image(0, cy, 'ic_lock').setIconScale(0.5).setAlpha(0.9));
        c.add(U.fitText(T(this, 0, tab === 'relics' ? 34 : 38, nm, { size: 13, bold: true, color: 0xc9a86a, wrap: 126, align: 'center' }), 126, 18, 9));
        c.add(U.fitText(T(this, 0, tab === 'relics' ? 52 : 56, _t('s.logro_0', { 0: ach.name }), { size: 11, color: C.muted, style: 'italic', wrap: 126, align: 'center' }), 126, 16, 8));
      }
      return c;
    }
    cell_cards(id, x, y, seen) {
      const c = this.add.container(x, y);
      if (seen) c.add(U.cardSnapshot(this, { uid: -1, id, up: false }, 0.6));   // una imagen cacheada por carta: el compendio va fluido
      else {
        c.add(this.add.image(0, -8, 'cardback').setScale(1.3));
        c.add(T(this, 0, 64, '???', { size: 15, bold: true, color: C.muted }));
      }
      return c;
    }
    cell_relics(id, x, y, seen) {
      const r = D.ALL_RELICS[id], boss = !!D.BOSS_RELICS[id];
      const c = this.add.container(x, y);
      c.add(this.add.circle(0, -12, 32, seen ? C.panel2 : 0x0c100e).setStrokeStyle(2, seen ? (boss ? C.blood : C.gold) : 0x333a36, 1));
      c.add(this.add.image(0, -12, seen ? 'ic_' + r.icon : 'ic_question').setIconScale(0.62).setAlpha(seen ? 1 : 0.35));
      const t = T(this, 0, 38, seen ? r.name : '???', { size: 13, color: seen ? C.parch : C.muted, wrap: 126, align: 'center' });
      U.fitText(t, 126, 32, 10);
      c.add(t);
      return c;
    }
    cell_potions(id, x, y, seen) {
      const d = D.POTIONS[id], c = this.add.container(x, y);
      c.add(this.add.circle(0, -14, 38, seen ? C.panel2 : 0x0c100e).setStrokeStyle(2, seen && d.rarity === 'rare' ? C.gold : 0x333a36, 1));
      if (seen) { const g = this.add.graphics().setPosition(0, -12); U.drawFlask(g, d.shape, d.color, { scale: 1.9 }); c.add(g); }
      else c.add(this.add.image(0, -14, 'ic_question').setIconScale(0.6).setAlpha(0.35));
      c.add(T(this, 0, 42, seen ? d.name : '???', { size: 14, color: seen ? C.parch : C.muted }));
      return c;
    }
    cell_enemies(id, x, y, seen) {
      const d = D.ENEMIES[id], c = this.add.container(x, y);
      const g = this.add.graphics(); g.fillStyle(seen ? 0x0c100e : 0x26302b, 0.9); g.fillRoundedRect(-104, -108, 208, 216, 12);   // fondo más claro: la silueta negra se lee
      g.lineStyle(1.5, d.tier === 'boss' ? C.blood : d.tier === 'elite' ? C.ember : C.line, 0.9); g.strokeRoundedRect(-104, -108, 208, 216, 12);
      c.add(g);
      const art = enemyArt(this, d);
      const img = this.add.image(0, 40, art.key).setOrigin(0.5, 1).setFlipX(flipOf(art.key));   // Bestiario: mirando como en combate
      const src = this.textures.get(art.key).getSourceImage();
      img.setScale(Math.min(140 / src.height, 180 / src.width));
      if (!seen) img.setTint(0x000000).setAlpha(0.85);   // silueta negra (tint 0x000000)
      else if (art.tint) img.setTint(art.tint);
      c.add(img);
      c.add(T(this, 0, 62, seen ? d.name : '???', { size: 16, bold: true, color: seen ? C.parch : C.muted }));
      c.add(T(this, 0, 86, _t('s.acto_0_1', { 0: ROMAN[ACT_OF_ENEMY(id)], 1: TIER_LABEL[d.tier] }), { size: 13, color: C.muted }));
      return c;
    }

    /* ---------- Detalle ---------- */
    openDetail(type, id) {
      if (this.detail) this.detail.destroy();
      const e = this.entry(type, id) || {};
      const layer = this.detail = this.add.container(0, 0).setDepth(LY.modal);
      const blocker = this.add.zone(0, 0, 1280, 720).setOrigin(0, 0).setInteractive();
      const dim = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7);
      const PW = 880, PH = 540, px = 200, py = 100;
      const g = this.add.graphics();
      g.fillStyle(C.panel, 0.98); g.fillRoundedRect(px, py, PW, PH, 16);
      g.lineStyle(2, C.gold, 0.9); g.strokeRoundedRect(px, py, PW, PH, 16);
      layer.add([blocker, dim, g]);
      const close = () => { layer.destroy(); this.detail = null; };
      blocker.on('pointerup', (p) => { if (p.worldX < px || p.worldX > px + PW || p.worldY < py || p.worldY > py + PH) close(); });
      layer.add(button(this, px + PW - 70, py + PH - 36, _t('s.cerrar'), close, { w: 120, h: 38, size: 18, variant: 'ghost' }));
      const RX = 560;   // columna de texto
      const line = (y, str, o = {}) => { const t = T(this, RX, y, str, { size: 18, ox: 0, oy: 0, color: C.parch, wrap: px + PW - RX - 30, ...o }); layer.add(t); return t; };
      if (type === 'cards') {
        const d = D.CARDS[id];
        let up = false;
        const holder = this.add.container(380, 330); layer.add(holder);
        const draw = () => { holder.removeAll(true); const cv = cardView(this, { uid: -1, id, up }); cv.setScale(1.45); holder.add(cv); };
        draw();
        if (d.up) {
          const b = button(this, 380, 540, _t('s.ver_mejorada'), () => { up = !up; draw(); b.setLabel(up ? _t('s.ver_normal') : _t('s.ver_mejorada')); }, { w: 190, h: 40, size: 17, variant: 'gold' });
          layer.add(b);
        }
        line(140, d.name, { size: 34, font: 'display', color: C.gold });
        line(186, `${U.TYPE_LABEL[d.type]} · ${I18N.has('rar.' + d.rarity) ? _t('rar.' + d.rarity) : ''}${d.acts ? _t('codex.onlyAct', { a: d.acts.map((a) => ROMAN[a]).join(_t('ui.and')) }) : ''}`, { size: 16, color: C.muted });
        line(240, _t('s.cogida_0_veces', { 0: e.picked || 0 }));
        line(272, _t('s.jugada_0_veces', { 0: e.played || 0 }));
        line(304, winLine(e, _t('s.ella_en_el_mazo')), { color: e.runs >= 3 ? C.flame : C.muted });
      } else if (type === 'relics') {
        const r = D.ALL_RELICS[id], boss = !!D.BOSS_RELICS[id];
        layer.add(this.add.circle(380, 300, 90, C.panel2).setStrokeStyle(3, boss ? C.blood : C.gold, 1));
        layer.add(this.add.image(380, 300, 'ic_' + r.icon).setIconScale(1.9));
        line(140, r.name, { size: 34, font: 'display', color: C.gold });
        line(186, boss ? _t('s.reliquia_de_jefe') : _t('s.reliquia'), { size: 16, color: C.muted });
        let y = 230;
        if (boss) {
          line(y, _t('boss.good'), { size: 13, bold: true, color: C.gold }); y += 20;
          y += line(y, r.good, { color: 0xf0d48a }).height + 12;
          line(y, _t('boss.bad'), { size: 13, bold: true, color: 0xc26a5e }); y += 20;
          y += line(y, r.bad, { color: 0xc26a5e }).height + 22;
        } else y += line(y, r.text).height + 22;
        line(y, _t('s.conseguida_0_veces', { 0: e.got || 0 })); y += 32;
        line(y, winLine(e, 'ella'), { color: e.runs >= 3 ? C.flame : C.muted });
      } else if (type === 'potions') {
        const d = D.POTIONS[id];
        layer.add(this.add.circle(380, 320, 100, C.panel2).setStrokeStyle(3, d.rarity === 'rare' ? C.gold : C.line, 1));
        const fl = this.add.graphics().setPosition(380, 330); layer.add(fl);
        const anim = (time) => { fl.clear(); U.drawFlask(fl, d.shape, d.color, { t: time / 1000, scale: 4.2 }); };
        anim(0); this.events.on('update', anim); layer.once('destroy', () => this.events.off('update', anim));
        line(140, d.name, { size: 34, font: 'display', color: C.gold });
        line(186, _t('codex.potionKind', { r: D.POTION_RARITY_LABEL[d.rarity] }) + (d.target === 'any' ? _t('codex.potionAny') : ''), { size: 16, color: C.muted });
        const t = line(230, d.text);
        line(250 + t.height, _t('s.conseguida_0_veces', { 0: e.got || 0 }));
        line(282 + t.height, _t('s.usada_0_veces', { 0: e.used || 0 }));
      } else this.enemyDetail(layer, id, e, line);
    }
    /** Enemigo: arte, acto, PV, movimientos con sus iconos de intención y fase 2. */
    enemyDetail(layer, id, e, line) {
      const d = D.ENEMIES[id], art = enemyArt(this, d);
      const img = this.add.image(380, 470, art.key).setOrigin(0.5, 1).setFlipX(flipOf(art.key));
      const src = this.textures.get(art.key).getSourceImage();
      img.setScale(Math.min(300 / src.height, 300 / src.width));
      if (art.tint) img.setTint(art.tint);
      layer.add([this.add.image(380, 470, 'shadow').setDisplaySize(img.displayWidth * 0.9, 34), img]);
      layer.add(T(this, 380, 500, _t('s.vencido_0_veces', { 0: e.kills || 0 }), { size: 17, color: C.leaf }));
      layer.add(T(this, 380, 526, _t('s.te_ha_derrotado_0_veces', { 0: e.deaths || 0 }), { size: 17, color: C.blood }));
      line(130, d.name, { size: 34, font: 'display', color: d.tier === 'normal' ? C.gold : C.blood });
      line(176, _t('codex.enemyLine', { a: ROMAN[ACT_OF_ENEMY(id)], t: _t(TIER_LABEL[d.tier]), hp: d.hp[0] === d.hp[1] ? d.hp[0] : d.hp[0] + '–' + d.hp[1] }) + (d.startBlock ? _t('codex.startBlock', { n: d.startBlock }) : ''), { size: 16, color: C.muted });
      let y = 214;
      if (d.tier === 'boss' && d.desc) {   // jefes: su descripción (la del tooltip del mapa)
        const dt = T(this, 560, y, d.desc, { size: 15, ox: 0, oy: 0, color: C.parch, style: 'italic', wrap: 500 });
        layer.add(dt); y += dt.height + 14;
      }
      const moves = (title, list) => {
        line(y, title, { size: 13, bold: true, color: C.gold }); y += 22;
        list.forEach((m) => {
          const kind = m.dmg ? 'sword' : m.weak ? 'weak' : (m.block && !m.str) ? 'shield' : 'strength';
          const icons = [kind].concat(m.dmg && m.block ? ['shield'] : [], m.chill ? ['snow'] : [], m.curse ? ['cursecard'] : [], m.douse ? ['drop'] : []);
          icons.forEach((ic, k) => layer.add(this.add.image(560 + 12 + k * 24, y + 11, 'ic_' + ic).setIconScale(0.33)));
          const parts = [];
          if (m.dmg) parts.push(m.hits > 1 ? _t('s.0_1_de_dano', { 0: m.dmg, 1: m.hits }) : _t('s.0_de_dano', { 0: m.dmg }));
          if (m.block) parts.push(_t('s.0_de_bloqueo', { 0: m.block }));
          if (m.str) parts.push(_t('s.0_fuerza', { 0: m.str }));
          if (m.weak) parts.push(_t('s.0_de_debil', { 0: m.weak }));
          if (m.chill) parts.push(_t('s.0_temperatura', { 0: m.chill }));
          if (m.curse) parts.push(_t('s.0_escalofrio', { 0: m.curse }));
          if (m.douse) parts.push(_t('s.apaga_la_mitad_de_su'));
          if (m.heal) parts.push(_t('codex.heal', { n: m.heal }));
          if (m.drain) parts.push(_t('codex.drain', { n: m.drain }));
          if (m.silence) parts.push(_t('codex.silence', { n: m.silence }));
          if (m.reflect) parts.push(_t('codex.reflect', { n: m.reflect }));
          if (m.inkCurse) parts.push(_t('codex.ink', { n: m.inkCurse }));
          if (m.charge) parts.push(_t('codex.charge', { n: m.charge, hit: m.chargeHit }));
          const t = T(this, 560 + 12 + icons.length * 24 + 6, y + 2, `${m.name}: ${parts.join(', ')}`, { size: 16, ox: 0, oy: 0, color: C.parch, wrap: 1060 - 560 - icons.length * 24 - 30 });
          layer.add(t); y += Math.max(26, t.height + 8);
        });
        y += 8;
      };
      moves(_t('codex.moves'), d.moves);
      if (d.phase2) moves(d.phase2.at > 0 ? _t('codex.phase2', { p: Math.round(d.phase2.at * 100), t: d.phase2.text }) : _t('codex.phaseRevive', { t: d.phase2.text }), d.phase2.moves);
      if (d.phase3) moves(_t('codex.phase3', { p: Math.round(d.phase3.at * 100), t: d.phase3.text }), d.phase3.moves);
    }
  }

  /* =================================================================
   * Santuario: mejoras permanentes que se compran con Esencia Arcana.
   * Tres ramas (Vida · Riqueza · Saber) que salen de un altar. Toda la
   * lógica (precios, saldo, compra) vive en meta.js; esto solo pinta.
   * ================================================================= */
  const ESS = ESS_C;   // Esencia Arcana (token del tema; ya no es violeta)
  const SANCT_BRANCHES = [
    { get name() { return _t('s.vida'); }, col: TC.heal, ids: ['vitalidad', 'hoguera', 'alquimia'] },
    { get name() { return _t('s.riqueza'); }, col: C.gold, ids: ['bolsa', 'fortuna', 'purga'] },
    { get name() { return _t('s.saber'); }, col: TH.game.frost, ids: ['herreria', 'sabiduria', 'reliquia'] }
  ];
  /** Saldo con la gema dibujada: devuelve { set(n) } para repintarlo. */
  function essenceBadge(scene, x, y, n, o = {}) {
    const r = o.r || 16, g = scene.add.graphics();
    U.essenceGem(g, x, y, r, 1);
    const t = T(scene, x + r + 8, y + 2, '', { size: o.size || SZ.body, bold: true, color: ESS, ox: 0 });
    const set = (v) => t.setText(o.label === false ? fmtScore(v) : _t('s.0_esencia', { 0: fmtScore(v) }));
    set(n);
    return { g, t, set };
  }
  /** Fila de puntos de nivel ●●○○○ dibujada (no depende de la fuente). */
  function levelPips(g, x, y, lvl, max, col) {
    for (let i = 0; i < max; i++) {
      const px = x + i * 17;
      g.fillStyle(i < lvl ? col : TC.deep, 1); g.fillCircle(px, y, 6);
      g.lineStyle(TH.borderWidth, i < lvl ? TH.num(TC.ink) : C.line, i < lvl ? 0.6 : 1); g.strokeCircle(px, y, 6);
    }
  }

  class Sanctuary extends Phaser.Scene {
    constructor() { super('Sanctuary'); }
    create(data) {
      this.tip = null;   // tooltip de las mejoras (se crea al pasar por la primera)
      if (this.textures.exists('bg_sanctuary')) {   // árbol-santuario (la viñeta ya viene en el JPG)
        this.add.image(640, 360, 'bg_sanctuary').setDisplaySize(1280, 720);
        this.add.rectangle(640, 360, 1280, 720, TC.shade, TH.alpha.shadow);
      } else {
        menuBackdrop(this, 0.35);
        this.add.rectangle(640, 360, 1280, 720, TC.shade, TH.alpha.curtain);
      }
      // Altar: brillo de Esencia que respira bajo el título
      const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      for (let k = 10; k >= 1; k--) { glow.fillStyle(ESS, 0.02); glow.fillEllipse(640, 112, 70 * k, 22 * k); }
      this.tweens.add({ targets: glow, alpha: { from: 1, to: 0.6 }, duration: DUR.ambient, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      U.fireflies(this, ESS, 1280, 720, 22);
      this.back = button(this, 80, 40, _t('s.volver'), () => this.scene.start((data && data.from) || 'Title'), { w: 130, h: TH.button.minH, size: SZ.body, variant: 'secondary', role: 'back' });
      T(this, 640, 44, _t('s.santuario'), { size: SZ.h1, font: 'display', color: C.gold, stroke: TC.shade, strokeThickness: 5 });
      const meta = loadMeta();
      this.badge = essenceBadge(this, 1060, 44, M.essenceBalance(meta), { r: 18, size: SZ.h3 });
      T(this, 640, 88, _t('s.mejoras_permanentes_para_todas_tus'), { size: SZ.small, color: C.muted, style: 'italic' });
      // Altar central y raíces hacia las tres ramas
      const roots = this.add.graphics();
      const ax = 640, ay = 128;
      U.essenceGem(this.add.graphics(), ax, ay, 14, 1);
      this.nodes = {};
      SANCT_BRANCHES.forEach((br, bi) => {
        const cx = 232 + bi * 408;
        roots.lineStyle(TH.borderWidth, br.col, 0.35);
        roots.beginPath(); roots.moveTo(ax, ay + 14); roots.lineTo(cx, ay + 34); roots.lineTo(cx, 610); roots.strokePath();
        T(this, cx, 160, br.name.toUpperCase(), { size: SZ.small, bold: true, color: br.col }).setLetterSpacing(3);
        br.ids.forEach((id, k) => this.node(id, cx, 240 + k * 146, br.col));
      });
      this.foot = T(this, 640, 652, '', { size: SZ.small, color: C.muted, align: 'center' });
      T(this, 640, 682, _t('s.el_desafio_diario_y_las'), { size: SZ.small, color: C.muted, style: 'italic' });
      this.paint();
      U.padNav(this, { back: () => this.back.press(), backObj: () => this.back });
    }
    /** Un nodo del árbol: icono, nombre, nivel, efecto actual → siguiente y coste. Clic = comprar. */
    node(id, x, y, col) {
      const W = 372, H = 124, up = D.UPGRADES[id];
      const c = this.add.container(x, y);
      const g = this.add.graphics();
      const ring = this.add.circle(-W / 2 + 46, -6, 32, TC.deep).setStrokeStyle(TH.borderWidth, col, 1);
      const ic = this.add.image(-W / 2 + 46, -6, 'ic_' + up.icon).setIconScale(0.8);
      const name = T(this, -W / 2 + 90, -H / 2 + 22, up.name, { size: SZ.body, bold: true, color: C.parch, ox: 0 });
      U.fitText(name, 190, 0, SZ.small);
      const pips = this.add.graphics();
      const now = T(this, -W / 2 + 90, -6, '', { size: SZ.small, color: C.muted, ox: 0 });
      const next = T(this, -W / 2 + 90, 16, '', { size: SZ.small, color: C.parch, ox: 0 });
      const costG = this.add.graphics();
      const cost = T(this, W / 2 - 18, H / 2 - 22, '', { size: SZ.body, bold: true, ox: 1 });
      const flash = this.add.rectangle(0, 0, W, H, TH.num(TC.ink), 0).setBlendMode(Phaser.BlendModes.ADD);
      const hit = this.add.rectangle(0, 0, W, H, 0, 0).setInteractive({ useHandCursor: true });
      c.add([g, ring, ic, name, pips, now, next, costG, cost, flash, hit]);
      const n = { id, c, g, pips, now, next, cost, costG, flash, ring, col, W, H, hover: false };
      hit.on('pointerover', () => {
        n.hover = true; this.paintNode(n);
        // Tooltip: lo que da ahora y en el siguiente nivel (con las fichas del glosario si menciona alguna palabra clave)
        const lv = M.upgradeLevel(loadMeta(), id), mx = up.cost.length;
        this.tip = this.tip || tooltip(this);
        this.tip.show(x + W / 2 + 8 > 1000 ? x - W / 2 - 300 : x + W / 2 + 8, y - H / 2, up.name, `${_t('sanct.now', { t: up.fx(lv) })}${lv < mx ? '\n' + _t('sanct.next', { t: up.fx(lv + 1) }) : ''}`);
      });
      hit.on('pointerout', () => { n.hover = false; this.paintNode(n); if (this.tip) this.tip.hide(); });
      hit.on('pointerup', () => this.buy(n));
      c.press = () => this.buy(n);   // mando: A compra
      this.nodes[id] = n;
    }
    paint() {
      const meta = loadMeta();
      Object.values(this.nodes).forEach((n) => this.paintNode(n, meta));
      this.badge.set(M.essenceBalance(meta));
      const spent = (meta.essence && meta.essence.spent) || 0, all = M.allUpgradesCost();
      this.foot.setText(_t('s.invertido_0_de_1_esencia', { 0: fmtScore(spent), 1: fmtScore(all), 2: D.UPGRADE_IDS.reduce((a, id) => a + M.upgradeLevel(meta, id), 0), 3: D.UPGRADE_IDS.reduce((a, id) => a + D.UPGRADES[id].cost.length, 0) }));
    }
    paintNode(n, meta = loadMeta()) {
      const up = D.UPGRADES[n.id], lvl = M.upgradeLevel(meta, n.id), max = up.cost.length;
      const price = M.nextUpgradeCost(meta, n.id), bal = M.essenceBalance(meta);
      const can = price !== null && price <= bal, W = n.W, H = n.H;
      n.g.clear();
      n.g.fillStyle(TC.shade, TH.alpha.shadow); n.g.fillRoundedRect(-W / 2 + 4, -H / 2 + 6, W, H, TH.radius);
      Panel.draw(n.g, -W / 2, -H / 2, W, H, { raised: n.hover });   // tarjeta = Panel (sin violeta)
      if (can || price === null) { n.g.lineStyle(TH.borderWidth, can ? TC.ember : C.gold, 1); n.g.strokeRoundedRect(-W / 2, -H / 2, W, H, TH.radius); }   // comprable: ember · completa: oro
      n.ring.setFillStyle(lvl ? TC.surfaceRaised : TC.deep);
      n.pips.clear(); levelPips(n.pips, W / 2 - 18 - (max - 1) * 17, -H / 2 + 22, lvl, max, n.col);
      n.now.setText(_t('sanct.now', { t: up.fx(lvl) })).setScale(1); U.fitLine(n.now, W - 110);
      n.next.setText(price === null ? _t('s.nivel_maximo') : _t('sanct.next', { t: up.fx(lvl + 1) })).setColor(U.hex(price === null ? C.gold : C.parch)); n.next.setScale(1); U.fitLine(n.next, W - 110);
      n.costG.clear();
      if (price === null) { n.cost.setText(_t('s.max')).setColor(U.hex(C.gold)); return; }
      n.cost.setText(fmtScore(price)).setColor(U.hex(can ? ESS : BAD_RED));
      U.essenceGem(n.costG, W / 2 - 18 - n.cost.width - 16, H / 2 - 22, 10, can ? 1 : 0.35);
    }
    buy(n) {
      const meta = loadMeta(), r = M.buyUpgrade(meta, n.id);
      if (!r.ok) {
        Sfx.play('deny');
        this.tweens.add({ targets: n.c, x: n.c.x + 6, duration: DUR.press, yoyo: true, repeat: 2 });
        toast(this, r.reason || _t('s.no_se_puede_comprar'), C.blood);
        return;
      }
      saveMeta(meta);
      Sfx.play('coin'); Sfx.play('win', { volume: 0.4 });
      n.flash.setAlpha(0.7);
      this.tweens.add({ targets: n.flash, alpha: 0, duration: DUR.pulse, ease: 'Quad.out' });
      this.tweens.add({ targets: n.c, scale: { from: 1.06, to: 1 }, duration: DUR.screen, ease: 'Back.out' });
      burst(this, n.c.x - n.W / 2 + 46, n.c.y - 6, ESS, 22, 90);
      burst(this, n.c.x - n.W / 2 + 46, n.c.y - 6, TH.num(TC.ink), 8, 40);
      this.paint();
    }
  }

  /* =================================================================
   * Récords: estadísticas, últimas partidas y logros
   * ================================================================= */
  class Records extends Phaser.Scene {
    constructor() { super('Records'); }
    create(data) {
      this.recTip = null;   // el tooltip de la visita anterior ya no existe (se destruye con la escena)
      U.padNav(this, { back: () => this.scene.start('Title'), tab: (d) => { const ids = ['all', ...D.CHAR_IDS], i = ids.indexOf(this.statsChar || 'all'); this.scene.restart({ char: ids[(i + d + ids.length) % ids.length], page: this.achPage }); }, tabRect: () => ({ x: 60, y: 132, w: 334, h: 24 }) });   // mando / flechas
      const meta = loadMeta();
      menuBackdrop(this, 0);
      this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.45);
      button(this, 80, 40, _t('s.volver'), () => this.scene.start('Title'), { w: 130, h: 40, size: 18, variant: 'ghost' });
      const total = M.ACHIEVEMENTS.length, done = Object.keys(meta.achievements).length;
      T(this, 640, 44, _t('s.records'), { size: 52, font: 'display', color: C.gold, stroke: 0x000000, strokeThickness: 5 });
      T(this, 1240, 44, _t('s.0_de_1_logros', { 0: done, 1: total }), { size: 18, color: C.muted, ox: 1 });
      const tipsSeen = Object.keys(meta.tips || {}).length;
      const again = button(this, 976, 44, _t('s.volver_a_ver_los_consejos'), () => {
        const m = loadMeta(); M.resetTips(m); saveMeta(m);
        again.setLabel(_t('s.consejos_reactivados')); again.setEnabled(false);
        toast(this, _t('s.los_consejos_volveran_a_salir'), C.gold);
      }, { w: 236, h: 36, size: 15, variant: 'ghost', font: 'body' });
      if (!tipsSeen && !meta.tipsOff) again.setEnabled(false);   // no hay nada que reactivar

      const panel = (x, y, w, h, title) => {
        const g = this.add.graphics();
        g.fillStyle(C.panel, 0.92); g.fillRoundedRect(x, y, w, h, 12);
        g.lineStyle(1.5, C.line, 1); g.strokeRoundedRect(x, y, w, h, 12);
        T(this, x + 18, y + 24, title, { size: 15, bold: true, color: C.gold, ox: 0 }).setLetterSpacing(2);
      };

      // 1) Estadísticas: pestañas «Todos» y una por personaje (partidas, victorias, piso y Ascensión de ese personaje)
      const sc = this.statsChar = (data && data.char) || 'all';
      panel(40, 90, 370, 284, _t('s.estadisticas') + (sc !== 'all' && D.CHARACTERS[sc] ? ` · ${D.CHARACTERS[sc].name}` : ''));
      // Pestañas en una fila propia bajo el título: «Todos» y un retrato por personaje (con 6 los nombres ya no caben)
      const tabIds = ['all', ...D.CHAR_IDS], allW = 64, tabStep = Math.min(92, (336 - allW) / (tabIds.length - 1));
      tabIds.forEach((id, i) => {
        const w = id === 'all' ? allW - 4 : tabStep - 4, x = id === 'all' ? 58 + allW / 2 : 58 + allW + tabStep / 2 + (i - 1) * tabStep;
        const b = button(this, x, 144, id === 'all' ? _t('s.todos') : '', () => this.scene.restart({ char: id }), { w, h: 24, size: 13, font: 'body', variant: sc === id ? 'gold' : 'ghost' });
        if (id !== 'all') {
          const key = 'art_' + D.CHARACTERS[id].art, src = this.textures.get(key).getSourceImage();
          b.add(this.add.image(0, 10, key).setOrigin(0.5, 1).setScale(Math.min(20 / src.height, (w - 8) / src.width)));
          const tipObj = this.recTip = this.recTip || tooltip(this);
          b.on('pointerover', () => tipObj.show(x - 60, 162, D.CHARACTERS[id].name, D.CHARACTERS[id].title));
          b.on('pointerout', () => tipObj.hide());
        }
      });
      const cs = sc === 'all' ? { played: meta.played, wins: meta.wins, bestFloor: meta.bestFloor } : (meta.charStats[sc] || { played: 0, wins: 0, bestFloor: 0 });
      const ascCh = sc === 'all' ? (meta.lastChar || 'piromago') : sc;
      // 7 filas a 20 px: los datos cortos van por parejas (dos columnas); los largos ocupan la fila entera
      const pct = `${cs.played ? Math.round(100 * cs.wins / cs.played) : 0} %`;
      const statRows = [
        [[_t('s.partidas'), cs.played], [_t('s.victorias'), cs.wins]],
        [[_t('s.de_victorias'), pct], [_t('s.mejor_racha'), meta.bestStreak]],
        [[_t('s.mejor_piso'), cs.bestFloor ? _t('s.0_de_1', { 0: cs.bestFloor, 1: E.TOTAL_FLOORS }) : '—']],
        sc === 'all' ? [[_t('s.acto_mas_alto'), meta.bestAct ? `${ROMAN[meta.bestAct]} · ${D.ACTS[meta.bestAct].name}` : '—']] : 'paths',
        sc === 'all' ? [[_t('rec.bosses'), `${(meta.bossesBeaten || []).length}/${E.allBosses().length}`], [_t('rec.act3'), meta.eyes || 0]] : 'paths2',   // jefes distintos vencidos · veces que venciste al jefe del Acto III
        [[_t('s.golpe_mas_fuerte'), meta.bestHit || '—']],
        [[_t('rec.maxAsc') + (sc === 'all' ? ` (${D.CHARACTERS[ascCh].name})` : ''), `A${M.maxAsc(meta, ascCh)}`]]
      ];
      statRows.forEach((row, i) => {
        const y = 170 + i * 20;   // entre las pestañas (144) y «Victorias por nivel» (318)
        if (!row || row === 'paths2') return;
        if (row === 'paths') {   // Sendas: victorias por senda de este personaje (dos filas)
          T(this, 60, y, _t('path.recWins'), { size: 15, color: C.muted, ox: 0 });
          D.CHARACTERS[sc].paths.forEach((pth, k) => {
            const st = (meta.pathStats || {})[pth.id] || { played: 0, wins: 0 }, x = 60 + k * 112;
            this.add.image(x + 8, y + 21, 'ic_' + pth.icon).setIconScale(0.24);
            U.fitText(T(this, x + 19, y + 21, `${pth.name} ${st.wins}/${st.played}`, { size: 14, bold: st.wins > 0, ox: 0, color: st.wins ? pth.color : C.parch }), 92, 0, 9);
          });
          return;
        }
        const cols = row.length === 2 ? [[60, 214], [236, 390]] : [[60, 390]];
        row.forEach(([k, v], j) => {
          const [lx, rx] = cols[j];
          const val = U.fitText(T(this, rx, y, String(v), { size: 16, bold: true, ox: 1 }), row.length === 2 ? 60 : 200, 0, 11);
          U.fitText(T(this, lx, y, k, { size: 15, color: C.muted, ox: 0 }), rx - lx - val.width - 8, 0, 10);
        });
      });
      // Victorias por nivel: 9 casillas A0..A8 (las no desbloqueadas, apagadas)
      T(this, 60, 318, _t('s.victorias_por_nivel'), { size: 13, color: C.muted, ox: 0 });
      for (let lv = 0; lv <= D.MAX_ASCENSION; lv++) {
        const x = 60 + lv * 37, open = lv <= M.maxAsc(meta, ascCh), w = M.ascWinsOf(meta, ascCh)[lv] || 0;
        const gg = this.add.graphics();
        gg.fillStyle(0x0c100e, 0.9); gg.fillRoundedRect(x, 330, 33, 36, 6);
        gg.lineStyle(1, w ? C.gold : 0x333a36, 1); gg.strokeRoundedRect(x, 330, 33, 36, 6);
        T(this, x + 16.5, 340, `A${lv}`, { size: 11, color: open ? C.muted : 0x4a4f4b });
        T(this, x + 16.5, 356, open ? String(w) : '—', { size: 14, bold: true, color: w ? C.gold : (open ? C.parch : 0x4a4f4b) });
      }

      // 2) Últimas partidas
      panel(40, 386, 370, 304, _t('s.ultimas_partidas'));
      if (!meta.history.length) T(this, 225, 540, _t('s.aun_no_has_terminado_ninguna'), { size: 16, color: C.muted, style: 'italic' });
      meta.history.forEach((h, i) => {
        const y = 430 + i * 25;
        const win = h.result === 'win';
        this.add.circle(58, y, 5, win ? C.gold : C.blood);
        const tag = (h.custom ? ' · ' + _t('cust.tag') : '') + (h.daily ? _t('s.diario') : h.asc ? ` · A${h.asc}` : '');
        const kn = !win ? killerName(h) : '';
        const left = `${fmtDate(h.date, false)}  ${_t(win ? 'rec.win' : 'rec.loss')}${tag} · ${_t('rec.floor', { n: h.floor })}${kn ? ' · ' + kn : ''}`;
        U.fitText(T(this, 72, y, left, { size: 15, ox: 0, color: h.custom ? 0xc9a8ff : win ? C.parch : C.muted }), 238, 0, 11);
        T(this, 392, y, `${h.cards} c · ${h.relics} r`, { size: 14, color: C.muted, ox: 1 });
        if (h.custom) {   // Personalizada: sus modificadores, dificultad, puntuación y código al pasar el ratón
          const hz = this.add.zone(225, y, 340, 24).setInteractive();
          const mods = h.custom.mods.map((id) => D.CUSTOM_MODS[id].name).join(', ') || _t('cust.noMods');
          const htip = this.recTip = this.recTip || tooltip(this);
          hz.on('pointerover', () => htip.show(420, y - 10, `${_t('cust.tag')} · ${D.CUSTOM_DIFF[h.custom.diff].name}`,
            `${mods}\n${_t('s.puntuacion')}: ${fmtScore(h.score || 0)}\n${_t('cust.codeLine', { c: U.codeShow(h.custom.code) })}`));
          hz.on('pointerout', () => htip.hide());
        }
      });

      // 3) Logros: páginas de 4 × 4; los que dan recompensa la enseñan (con candado si aún no la tienes)
      const PER = 16, pages = Math.ceil(M.ACHIEVEMENTS.length / PER), page = this.achPage = Phaser.Math.Clamp((data && data.page) || 0, 0, pages - 1);
      const cols = 4, gap = 8, cw = Math.floor((810 - (cols - 1) * gap) / cols), ch = 113, gapY = 7, x0 = 430, y0 = 90;
      if (pages > 1) {
        const go = (d) => this.scene.restart({ char: this.statsChar, page: (page + d + pages) % pages });
        button(this, 1020, 592, '◀', () => go(-1), { w: 40, h: 28, size: 15, variant: 'ghost' });
        T(this, 1100, 592, _t('s.pagina_0_de_1', { 0: page + 1, 1: pages }), { size: 14, color: C.muted });
        button(this, 1180, 592, '▶', () => go(1), { w: 40, h: 28, size: 15, variant: 'ghost' });
      }
      M.ACHIEVEMENTS.slice(page * PER, page * PER + PER).forEach((a, i) => {
        const x = x0 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + gapY);
        const date = meta.achievements[a.id];
        const g = this.add.graphics();
        g.fillStyle(date ? 0x2a2312 : 0x121614, 0.95); g.fillRoundedRect(x, y, cw, ch, 12);
        g.lineStyle(date ? 2 : 1.5, date ? C.gold : 0x333a36, 1); g.strokeRoundedRect(x, y, cw, ch, 12);
        const ic = this.add.image(x + 26, y + 28, date ? 'ic_crown' : 'ic_lock').setIconScale(0.46);
        if (!date) ic.setAlpha(0.7);
        U.fitText(T(this, x + 46, y + 28, a.name, { size: 19, font: 'display', color: date ? C.gold : 0x8b8d86, ox: 0 }), cw - 54, 0, 11);
        const d = T(this, x + 14, y + (a.reward ? 44 : 48), a.desc, { size: 13, ox: 0, oy: 0, wrap: cw - 28, color: date ? C.parch : 0x9a9c94, lineSpacing: 1 });
        U.fitText(d, cw - 28, a.reward ? 26 : 46, 9);
        if (a.reward) {   // recompensa: verde si ya es tuya; con candado si no
          const rn = M.rewardName(a.reward), kind = _t('rec.kind.' + a.reward.type);
          if (!date) this.add.image(x + 21, y + ch - 31, 'ic_lock').setIconScale(0.24).setAlpha(0.8);
          U.fitText(T(this, x + (date ? 14 : 30), y + ch - 31, date ? _t('s.desbloqueada_0', { 0: rn }) : _t('rec.reward', { k: kind, r: rn }), { size: 12, ox: 0, color: date ? 0x9ff0c0 : 0xc9a86a, bold: !!date }), cw - (date ? 28 : 44), 0, 9);
        }
        U.fitText(T(this, x + 14, y + ch - 13, date ? _t('s.conseguido_0', { 0: fmtDateShort(date) }) : _t('s.bloqueado'), { size: 12, ox: 0, color: date ? C.flame : 0x6f726c, bold: !!date }), cw - 28, 0, 9);
      });

      // 4) Desafío diario / semanal (Parche 3.6: pestañas en el mismo panel)
      const view = this.view = (data && data.view) || this.view || 'daily';
      panel(430, 612, 810, 88, '');
      [['daily', _t('s.desafio_diario')], ['weekly', _t('wk.title')]].forEach(([k, label], i) => {
        U.fitText(button(this, 510 + i * 150, 630, label, () => { if (this.view !== k) this.scene.restart({ char: this.statsChar, page: this.achPage, view: k }); },
          { w: 142, h: 26, size: 13, font: 'body', variant: view === k ? 'gold' : 'ghost' }).list.find((o) => o.type === 'Text'), 130, 0, 9);
      });
      if (view === 'weekly') { this.weeklyRecords(meta); return; }
      const today = E.todayStr(), todayBest = (meta.daily || {})[today];
      T(this, 448, 658, todayBest ? _t('s.mejor_de_hoy_0', { 0: fmtScore(todayBest.best) }) : _t('s.hoy_aun_sin_jugar'), { size: 16, bold: !!todayBest, color: todayBest ? C.gold : C.muted, ox: 0 });
      T(this, 448, 682, _t('s.racha_0_mejor_racha_1', { 0: M.currentDailyStreak(meta, today), 1: meta.bestDailyStreak || 0 }), { size: 14, color: C.parch, ox: 0 });
      const last = M.lastDailies(meta, 5);
      // Comprobar un resultado compartido: el código debe cuadrar con su puntuación y fecha
      button(this, 1152, 668, _t('s.comprobar_codigo'), () => U.textBox({
        title: _t('s.comprobar_codigo_del_diario'), placeholder: _t('s.pega_aqui_el_resultado_compartido'), actionLabel: _t('s.comprobar'),
        onAction: (txt, show) => { const r = E.verifyDailyShare(txt); show(r.ok ? _t('s.valido_0', { 0: fmtDay(r.date) }) : _t('s.no_cuadra_0', { 0: r.reason }), r.ok); }
      }), { w: 160, h: 36, size: 15, font: 'body', variant: 'ghost' });
      if (!last.length) T(this, 880, 668, _t('s.juega_tu_primer_desafio_desde'), { size: 15, color: C.muted, style: 'italic' });
      last.forEach((dd, i) => {
        const x = 700 + i * 72, w = 66;
        const win = dd.result === 'win';
        const gg = this.add.graphics();
        gg.fillStyle(0x0c100e, 0.9); gg.fillRoundedRect(x, 646, w, 48, 8);
        gg.lineStyle(1.5, dd.date === today ? C.gold : 0x333a36, 1); gg.strokeRoundedRect(x, 646, w, 48, 8);
        U.fitText(T(this, x + w / 2 + 5, 657, fmtDay(dd.date, false), { size: 12, color: C.muted }), w - 18, 0, 9);
        this.add.circle(x + 9, 657, 4, win ? C.gold : C.blood);
        T(this, x + w / 2, 680, fmtScore(dd.best), { size: 16, bold: true, color: C.parch });
      });
    }
    /** Récords del Desafío semanal: esta semana, insignias y las últimas semanas. */
    weeklyRecords(meta) {
      const key = E.weekKey(), wk = (meta.weekly || {})[key], badges = M.weeklyBadges(meta);
      T(this, 448, 662, wk ? _t('wk.recBest', { s: fmtScore(wk.best) }) : _t('wk.notPlayed'), { size: 16, bold: !!wk, color: wk ? C.gold : C.muted, ox: 0 });
      T(this, 448, 684, _t('wk.badges', { n: badges.length }), { size: 14, color: C.parch, ox: 0 });
      const weeks = Object.keys(meta.weekly || {}).sort().reverse().slice(0, 6);
      if (!weeks.length) T(this, 940, 668, _t('wk.noHistory'), { size: 15, color: C.muted, style: 'italic' });
      weeks.forEach((k, i) => {
        const x = 700 + i * 88, w = 82, x2 = meta.weekly[k];
        const gg = this.add.graphics();
        gg.fillStyle(0x0c100e, 0.9); gg.fillRoundedRect(x, 646, w, 48, 8);
        gg.lineStyle(1.5, x2.rewarded ? C.gold : 0x333a36, 1); gg.strokeRoundedRect(x, 646, w, 48, 8);
        U.fitText(T(this, x + w / 2, 657, fmtDay(k, false), { size: 12, color: k === key ? C.gold : C.muted }), w - 8, 0, 9);
        T(this, x + w / 2, 680, fmtScore(x2.best), { size: 16, bold: true, color: C.parch });
        if (x2.rewarded) this.add.image(x + w - 12, 657, 'ic_crown').setIconScale(0.22);
      });
    }
  }

  /* =================================================================
   * Avisos de logro: capa superior permanente, sin objetos interactivos
   * (no bloquea clics). Los avisos se encolan y duran 2,5 s cada uno.
   * ================================================================= */
  /* =================================================================
   * Overlay: SIEMPRE encima de todas las escenas (se sube arriba en cada fotograma).
   * Aquí dibujan las demás escenas (vía U.overlay) consejos, tooltips, glosarios, toasts, ⚙ y menús
   * emergentes; además muestra los avisos de logro y «Mando conectado». No tiene nada interactivo
   * salvo mientras hay un consejo o una ventana (su zona bloquea los clics de debajo: globalTopOnly).
   * ================================================================= */
  class Overlay extends Phaser.Scene {
    constructor() { super('Overlay'); }
    create() {
      U.Overlay.scene = this;
      this.input.topOnly = true;
      this.sys.game.input.globalTopOnly = true;   // un objeto interactivo del Overlay tapa a las escenas de debajo
      this.queue = []; this.showing = false;
      // «🎮 Mando conectado» (si el navegador no tiene mando o el plugin no está, no pasa nada)
      try {
        if (this.input.gamepad) this.input.gamepad.on('connected', () => {
          U.Overlay.toastQ.push(() => {   // como todos los toasts: espera si hay un consejo abierto
            const t = T(this, 640, 696, _t('s.mando_conectado'), { size: 22, bold: true, color: C.gold, stroke: 0x000000, strokeThickness: 5 }).setDepth(LY.toast);
            this.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, y: 670, delay: 1600, duration: 600, onComplete: () => t.destroy() });
          });
          U.Overlay.pumpToasts();
        });
      } catch (e) { /* sin mando */ }
      this.events.once('shutdown', () => { if (U.Overlay.scene === this) U.Overlay.scene = null; });
    }
    /** Arriba del todo, siempre (cualquier escena lanzada o empezada después queda debajo). */
    update() {
      const list = this.scene.manager.scenes;
      if (list[list.length - 1] !== this) this.scene.bringToTop();
    }
    /** Avisos de logro (cola). Esperan si hay un consejo abierto. */
    push(list) {
      this.queue.push(...list);
      if (!this.showing) this.next();
    }
    next() {
      if (U.Overlay.tipOpen) { this.showing = true; this.time.delayedCall(300, () => this.next()); return; }
      const a = this.queue.shift();
      if (!a) { this.showing = false; return; }
      this.showing = true;
      const rw = a.reward ? M.rewardName(a.reward) : '';   // logro con recompensa: «¡Desbloqueado: X!»
      // En la pantalla final el título grande ocupa el centro de arriba: el aviso va a la esquina superior izquierda, más estrecho
      // (getStatus y no isActive: la pantalla final lanza el aviso desde su create(), cuando aún está en CREATING)
      const st = this.scene.getStatus('End'), atEnd = st >= Phaser.Scenes.START && st <= Phaser.Scenes.RUNNING;
      const W = atEnd ? 220 : rw ? 420 : 380, H = rw ? 88 : 64;
      const box = this.add.container(atEnd ? 140 : 640, -50).setDepth(LY.toast);
      const glow = this.add.rectangle(0, 0, W + 24, H + 24, C.gold, 0).setBlendMode(Phaser.BlendModes.ADD);
      const g = this.add.graphics();
      g.fillStyle(0x17130a, 0.96); g.fillRoundedRect(-W / 2, -H / 2, W, H, 12);
      g.lineStyle(2, C.gold, 1); g.strokeRoundedRect(-W / 2, -H / 2, W, H, 12);
      const ic = this.add.image(-W / 2 + 34, 0, 'ic_crown').setIconScale(0.6);
      const top = rw ? -12 : 0;
      ic.y = top;
      const k = T(this, -W / 2 + 66, top - 13, _t('s.logro_desbloqueado'), { size: 12, bold: true, color: C.flame, ox: 0 }).setLetterSpacing(2);
      const n = T(this, -W / 2 + 66, top + 12, a.name, { size: 24, font: 'display', color: C.gold, ox: 0 });
      U.fitText(n, W - 84, 0, 14);
      let u = null;
      if (rw) {
        u = T(this, 0, 28, _t('s.desbloqueado_0', { 0: rw }), { size: 17, bold: true, color: 0x9ff0c0 });
        U.fitText(u, W - 30, 0, 12);
        g.lineStyle(1, C.gold, 0.35); g.lineBetween(-W / 2 + 16, 13, W / 2 - 16, 13);
      }
      // Destello que recorre el aviso
      const shine = this.add.rectangle(-W / 2, 0, 26, H, 0xffffff, 0.35).setAngle(18).setBlendMode(Phaser.BlendModes.ADD);
      box.add([glow, g, ic, k, n, shine]);
      if (u) box.add(u);
      Sfx.play('win', 0.35);
      this.tweens.add({ targets: glow, alpha: { from: 0.3, to: 0 }, scale: { from: 1, to: 1.12 }, duration: 600, yoyo: true, repeat: 1 });
      this.tweens.add({ targets: shine, x: W / 2, duration: 700, delay: 300, ease: 'Quad.inOut', onComplete: () => shine.setVisible(false) });
      // 300 ms de entrada + 1900 visible + 300 de salida = 2,5 s.
      // En la pantalla final no hay HUD y el título grande ocupa y≈80–160: el aviso va por encima.
      // getStatus y no isActive: la pantalla final lanza el aviso desde su create(), cuando aún está en CREATING
      const y = atEnd ? 10 + H / 2 : 96 + (rw ? 12 : 0);
      this.tweens.add({ targets: box, y, duration: 300, ease: 'Back.out' });
      this.time.delayedCall(rw ? 3000 : 2200, () => {
        this.tweens.add({ targets: box, y: y - 26, alpha: 0, duration: 300, ease: 'Quad.in',
          onComplete: () => { box.destroy(); this.next(); } });
      });
    }
  }

  // Overlay va al final de la lista y además se sube arriba en cada fotograma
  /* =================================================================
   * Novedades: notas de parche (D.PATCH_NOTES), la más reciente arriba.
   * Al abrirla se marca la última versión como leída (punto dorado del título).
   * ================================================================= */
  class News extends Phaser.Scene {
    constructor() { super('News'); }
    create() {
      { const self = this; U.padNav(this, { back: () => this.scene.start('Title'), scroll: { get root() { return self.content; }, top: 100, bottom: 712, get: () => (self.content ? self.content.y : 0), set: (v) => { if (self.content) self.content.y = Phaser.Math.Clamp(v, self.minY || 0, 0); }, step: 160 } }); }   // mando / flechas
      const meta = loadMeta(); meta.lastSeenVersion = D.LATEST_VERSION; saveMeta(meta);
      menuBackdrop(this, 0);
      this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.55);
      button(this, 80, 40, _t('s.volver'), () => this.scene.start('Title'), { w: 130, h: 40, size: 18, variant: 'ghost' });
      T(this, 640, 46, _t('s.novedades'), { size: 52, font: 'display', color: C.gold, stroke: 0x000000, strokeThickness: 5 });
      const content = this.content = this.add.container(0, 0);
      const mask = this.make.graphics({ add: false }); mask.fillRect(0, 92, 1280, 628); content.setMask(mask.createGeometryMask());
      let y = 112;
      D.PATCH_NOTES.forEach((note, ni) => {
        // Cabecera del parche
        const g = this.add.graphics();
        g.fillStyle(0x1f1a0d, 0.95); g.fillRoundedRect(140, y, 1000, 84, 14);
        g.lineStyle(2, C.gold, ni === 0 ? 1 : 0.5); g.strokeRoundedRect(140, y, 1000, 84, 14);
        content.add([g,
          T(this, 172, y + 30, _t('s.parche_0', { 0: note.version }), { size: 15, bold: true, color: C.gold, ox: 0 }).setLetterSpacing(3),
          T(this, 172, y + 58, note.title, { size: 36, font: 'display', color: C.parch, ox: 0 }),
          T(this, 1112, y + 42, fmtDay(note.date), { size: 17, color: C.muted, ox: 1 })]);
        if (ni === 0) content.add(T(this, 1112, y + 18, _t('patch.new'), { size: 13, bold: true, color: C.flame, ox: 1 }).setLetterSpacing(2));
        y += 104;
        // Secciones en dos columnas (cada fila tan alta como su sección más larga)
        for (let i = 0; i < note.items.length; i += 2) {
          const pair = note.items.slice(i, i + 2).map((it, col) => {
            const x = 140 + col * 510, w = 490;
            const body = T(this, x + 24, y + 58, it.lines.map((l) => '•  ' + l).join('\n'), { size: 16, wrap: w - 48, ox: 0, oy: 0, color: C.parch, lineSpacing: 4 });
            return { it, x, w, body };
          });
          const h = Math.max(150, ...pair.map((q) => q.body.height + 78));
          pair.forEach(({ it, x, w, body }) => {
            const bg = this.add.graphics(); bg.fillStyle(C.panel, 0.94); bg.fillRoundedRect(x, y, w, h, 12); bg.lineStyle(1.5, C.line, 0.9); bg.strokeRoundedRect(x, y, w, h, 12);
            content.add([bg, this.add.image(x + 38, y + 32, 'ic_' + (it.icon || 'question')).setIconScale(0.5),
              T(this, x + 66, y + 32, it.head, { size: 21, bold: true, ox: 0, color: C.gold }), body]);
          });
          y += h + 16;
        }
        y += 20;
      });
      this.minY = Math.min(0, 700 - y);
      this.input.on('wheel', (p, o, dx, dy) => { content.y = Phaser.Math.Clamp(content.y - dy * 0.7, this.minY, 0); });
      let dyStart;
      this.input.on('pointerdown', (p) => { dyStart = p.worldY; });
      this.input.on('pointermove', (p) => { if (p.isDown && dyStart !== undefined) { content.y = Phaser.Math.Clamp(content.y + p.worldY - dyStart, this.minY, 0); dyStart = p.worldY; } });
      this.input.on('pointerup', () => { dyStart = undefined; });
      this.input.keyboard.once('keydown-ESC', () => this.scene.start('Title'));
    }
  }

  /* =================================================================
   * Modo personalizado (Parche 3.4): una sola pantalla de configuración (sin desplazamiento).
   * Izquierda: personaje, senda, Ascensión, semilla y código para compartir. Derecha: modificadores
   * (rejilla 3 × 4 con tooltip) y la dificultad resultante. Todo se maneja con ratón, toque o mando
   * (padNav recoge lo pulsable y, al enfocar, enseña su tooltip). La cfg se recuerda en CUSTOM_CFG_KEY.
   * ================================================================= */
  const CUSTOM_CFG_KEY = 'cm_custom_cfg';
  /** Personajes jugables en el modo personalizado: los desbloqueados en el juego normal. */
  const customChars = (meta) => D.CHAR_IDS.filter((id) => meta.unlockedChars.includes(id));
  class CustomSetup extends Phaser.Scene {
    constructor() { super('CustomSetup'); }
    create(data = {}) {
      menuBackdrop(this, 0.55);
      const meta = this.meta = loadMeta();
      this.tip = tooltip(this);
      let saved = null; try { saved = JSON.parse(U.Store.get(CUSTOM_CFG_KEY) || 'null'); } catch (e) { saved = null; }
      const cfg = this.cfg = E.normalizeCustom(data.cfg || saved || { char: meta.lastChar, seed: E.randomCustomSeed() });
      if (!meta.unlockedChars.includes(cfg.char)) cfg.char = 'piromago';
      if (D.PATHS[cfg.path] && D.PATHS[cfg.path].char !== cfg.char) cfg.path = '';
      cfg.ascension = Math.min(cfg.ascension, M.maxAsc(meta, cfg.char));
      this.focusKey = data.focus || 'start';
      this.armed = false;

      const backBtn = button(this, 80, 40, _t('s.volver'), () => this.scene.start('Title'), { w: 130, h: 40, size: 18, variant: 'ghost' });
      T(this, 170, 44, _t('cust.screen'), { size: 40, font: 'display', color: C.gold, stroke: 0x000000, strokeThickness: 4, ox: 0 });
      const label = (x, y, k) => T(this, x, y, _t(k), { size: 13, bold: true, color: C.gold, ox: 0 }).setLetterSpacing(2).setPadding(0, 0, 6, 0);

      // ---- Personaje (6 retratos; los bloqueados, en negro con candado)
      label(40, 96, 'cust.char');
      D.CHAR_IDS.forEach((id, i) => this.charTile(82 + i * 92, 164, id));
      // ---- Senda: «Al azar» + las 3 del personaje
      label(40, 236, 'cust.path');
      const cd = D.CHARACTERS[cfg.char];
      [{ id: '', name: _t('cust.random'), desc: _t('cust.randomTip') }].concat(cd.paths.map((p) => ({ id: p.id, name: p.name, desc: p.desc, star: p.star })))
        .forEach((p, i) => this.pathChip(40 + 66 + i * 140, 270, p));
      // ---- Ascensión: 0..máximo desbloqueado con ese personaje
      label(40, 320, 'cust.asc');
      this.ascRow(40, 356);
      // ---- Semilla: campo (abre un cuadro de texto) + dado
      label(40, 406, 'cust.seed');
      this.seedRow(40, 444);
      // ---- Código para compartir
      label(40, 500, 'cust.code');
      const cg = this.add.graphics(); cg.fillStyle(0x0c100e, 0.92); cg.fillRoundedRect(40, 516, 560, 44, 10); cg.lineStyle(1.5, C.line, 1); cg.strokeRoundedRect(40, 516, 560, 44, 10);
      this.codeT = T(this, 320, 538, '', { size: 21, bold: true, font: 'mono', color: C.parch });   // monoespaciada y 0 como Ø (U.codeShow)
      const copyB = button(this, 160, 598, _t('cust.copy'), () => U.copyOrShow(this, E.encodeCustom(this.cfg), { ok: _t('cust.copied'), title: _t('cust.copyTitle'), mono: true }), { w: 230, h: 44, size: 19, variant: 'ghost' });
      copyB.ckey = 'copy';
      const pasteB = button(this, 410, 598, _t('cust.paste'), () => this.pasteCode(), { w: 230, h: 44, size: 19, variant: 'ghost' });
      pasteB.ckey = 'paste';
      T(this, 40, 668, _t('cust.rules'), { size: 14, color: C.muted, ox: 0, wrap: 600, style: 'italic' });

      // ---- Modificadores (derecha): 3 × 4
      label(650, 96, 'cust.mods');
      this.activeT = T(this, 1240, 96, '', { size: 14, color: C.muted, ox: 1 });
      this.modPaint = D.CUSTOM_MOD_IDS.map((id, i) => this.modCell(650 + (i % 3) * 200, 116 + Math.floor(i / 3) * 104, 188, 94, id));
      // ---- Dificultad
      const dg = this.add.graphics(); dg.fillStyle(0x0c100e, 0.92); dg.fillRoundedRect(650, 538, 588, 82, 12); dg.lineStyle(1.5, C.line, 1); dg.strokeRoundedRect(650, 538, 588, 82, 12);
      label(670, 560, 'cust.diff');
      this.diffG = this.add.graphics();
      this.diffT = T(this, 670, 594, '', { size: 30, font: 'display', color: C.parch, ox: 0 });
      this.essT = T(this, 1218, 560, '', { size: 16, bold: true, color: 0xc9a8ff, ox: 1 });
      // ---- Comenzar
      const startB = this.startB = button(this, 1084, 668, _t('cust.start'), () => this.start(), { w: 300, h: 50, variant: 'gold' });
      startB.ckey = 'start';
      this.refresh();
      U.gearButton(this, 1236, 40, 52, 44).noMain = true;
      U.padNav(this, {
        back: () => this.scene.start('Title'), backObj: () => backBtn,
        main: (items) => { const it = items.find((x) => x.obj.ckey === this.focusKey); return it ? it.obj : startB; }
      });
    }
    /** Vuelve a pintar la pantalla con otra cfg (personaje, senda o Ascensión) y el foco en la misma fila. */
    redo(focus) { U.Store.set(CUSTOM_CFG_KEY, JSON.stringify(this.cfg)); this.tip.hide(); this.scene.restart({ cfg: this.cfg, focus }); }
    /** Código, contador de modificadores y dificultad (sin reconstruir la pantalla). */
    refresh() {
      const c = this.cfg = E.normalizeCustom(this.cfg);
      U.Store.set(CUSTOM_CFG_KEY, JSON.stringify(c));
      this.codeT.setText(U.codeShow(E.encodeCustom(c))); U.fitText(this.codeT, 540, 0, 13);
      this.activeT.setText(_t('cust.active', { n: c.mods.length }));
      this.modPaint.forEach((f) => f());
      const d = E.customDifficulty(c), k = D.CUSTOM_DIFF_IDS.indexOf(d.id);
      this.diffT.setText(d.name).setColor(U.hex(d.color));
      this.essT.setText(_t('cust.ess', { m: I18N.mult(d.mult) }));
      const g = this.diffG; g.clear();
      D.CUSTOM_DIFF_IDS.forEach((id, i) => {   // medidor de 4 tramos
        g.fillStyle(i <= k ? D.CUSTOM_DIFF[id].color : 0x2a302c, i <= k ? 0.95 : 1);
        g.fillRoundedRect(900 + i * 80, 586, 74, 16, 5);
      });
    }
    charTile(x, y, id) {
      const cd = D.CHARACTERS[id], open = this.meta.unlockedChars.includes(id), sel = id === this.cfg.char, W = 84, H = 108;
      const g = this.add.graphics();
      g.fillStyle(open ? C.panel : 0x0c100e, 0.95); g.fillRoundedRect(x - W / 2, y - H / 2, W, H, 10);
      g.lineStyle(sel ? 3 : 1.5, sel ? C.gold : open ? cd.color : 0x333a36, 1); g.strokeRoundedRect(x - W / 2, y - H / 2, W, H, 10);
      const key = 'art_' + cd.art, src = this.textures.get(key).getSourceImage();
      const img = this.add.image(x, y + 22, key).setOrigin(0.5, 1);
      img.setScale(Math.min(72 / src.height, (W - 12) / src.width));
      if (!open) { img.setTint(0x000000).setAlpha(0.8); this.add.image(x, y - 14, 'ic_lock').setIconScale(0.42); }
      U.fitText(T(this, x, y + 38, cd.name, { size: 14, bold: true, color: open ? cd.color : 0x6a6f6b }), W - 8, 0, 9);
      const hit = this.add.zone(x, y, W, H).setInteractive({ useHandCursor: true });
      hit.ckey = 'char_' + id;
      hit.on('pointerover', () => this.tip.show(x - 40, y + H / 2 + 6, cd.name, open ? `${cd.title} · ${_t('prep.hp', { n: cd.hp })}` : (cd.unlock || '')));
      hit.on('pointerout', () => this.tip.hide());
      hit.on('pointerup', () => {
        if (!open) { Sfx.play('deny'); return; }
        if (sel) return;
        Sfx.play('click'); this.cfg.char = id; this.cfg.path = ''; this.redo('char_' + id);
      });
    }
    pathChip(x, y, p) {
      const sel = (p.id || '') === (this.cfg.path || ''), W = 132, H = 40;
      const g = this.add.graphics();
      g.fillStyle(sel ? 0x3b3015 : 0x141d19, 1); g.fillRoundedRect(x - W / 2, y - H / 2, W, H, 10);
      g.lineStyle(sel ? 2.5 : 1.5, sel ? C.gold : C.line, 1); g.strokeRoundedRect(x - W / 2, y - H / 2, W, H, 10);
      U.fitText(T(this, x, y, p.name, { size: 17, bold: true, color: sel ? C.gold : C.parch }), W - 14, 0, 10);
      const hit = this.add.zone(x, y, W, H).setInteractive({ useHandCursor: true });
      hit.ckey = 'path_' + (p.id || 'azar');
      const body = p.star ? `${p.desc}\n${_t('cust.star', { c: D.CARDS[p.star].name })}` : p.desc;
      hit.on('pointerover', () => this.tip.show(x - 60, y + H / 2 + 6, p.name, body));
      hit.on('pointerout', () => this.tip.hide());
      hit.on('pointerup', () => { if (sel) return; Sfx.play('click'); this.cfg.path = p.id; this.redo(hit.ckey); });
    }
    ascRow(x0, y) {
      const max = M.maxAsc(this.meta, this.cfg.char), n = this.cfg.ascension;
      const arrow = (x, dir, key, can) => {
        const b = button(this, x, y, '', () => { if (!can) return; this.cfg.ascension = n + dir; this.redo(key); }, { w: 44, h: 38, variant: 'ghost' });
        const g = this.add.graphics(); g.fillStyle(C.parch, 1); g.fillTriangle(dir * 7, 0, -dir * 6, -8, -dir * 6, 8); b.add(g);
        b.setEnabled(can); g.setAlpha(can ? 1 : 0.3); b.ckey = key;
        return b;
      };
      arrow(x0 + 22, -1, 'asc_prev', n > 0);
      T(this, x0 + 74, y, `A${n}`, { size: 24, font: 'display', color: n > 0 ? C.ember : C.muted });
      arrow(x0 + 126, 1, 'asc_next', n < max);
      const rule = max > 0 ? ascRule(n) : _t('cust.ascNone');
      U.fitText(T(this, x0 + 160, y, rule, { size: 13, color: max > 0 ? C.flame : C.muted, ox: 0, wrap: 400 }), 400, 40, 10);
    }
    seedRow(x0, y) {
      const g = this.add.graphics(); g.fillStyle(0x0c100e, 0.95); g.fillRoundedRect(x0, y - 21, 260, 42, 10); g.lineStyle(1.5, C.line, 1); g.strokeRoundedRect(x0, y - 21, 260, 42, 10);
      this.seedT = T(this, x0 + 14, y, U.codeShow(this.cfg.seed), { size: 21, bold: true, font: 'mono', color: C.parch, ox: 0 });
      T(this, x0 + 248, y, _t('cust.edit'), { size: 13, color: C.muted, ox: 1 });
      const hit = this.add.zone(x0 + 130, y, 260, 42).setInteractive({ useHandCursor: true });
      hit.ckey = 'seed';
      hit.on('pointerover', () => this.tip.show(x0 + 270, y - 20, _t('cust.seed'), _t('cust.seedHint', { n: E.CUSTOM_SEED_MAX })));
      hit.on('pointerout', () => this.tip.hide());
      hit.on('pointerup', () => {
        this.tip.hide();
        const box = U.textBox({ title: _t('cust.seedTitle'), text: this.cfg.seed, placeholder: _t('cust.seedHint', { n: E.CUSTOM_SEED_MAX }), actionLabel: _t('cust.seedOk'), mono: true,
          onAction: (v, res) => {
            const sd = E.customSeedText(v);
            if (!sd) { res(_t('cust.seedBad'), false); return; }
            this.setSeed(sd); box && box.close();
          } });
      });
      const dice = button(this, x0 + 300, y, '', () => this.setSeed(E.randomCustomSeed()), { w: 48, h: 42, variant: 'ghost', tip: [_t('cust.dice'), _t('cust.diceTip')], tipObj: this.tip });
      const dg = this.add.graphics();   // dado dibujado (las fuentes no traen 🎲)
      dg.fillStyle(C.parch, 1); dg.fillRoundedRect(-12, -12, 24, 24, 5); dg.fillStyle(0x141d19, 1);
      [[-6, -6], [6, -6], [0, 0], [-6, 6], [6, 6]].forEach(([a, b]) => dg.fillCircle(a, b, 2.4));
      dice.add(dg); dice.ckey = 'dice';
    }
    setSeed(sd) {
      this.cfg.seed = sd; this.seedT.setText(U.codeShow(sd));
      Sfx.play('click'); this.refresh();
    }
    modCell(x, y, w, h, id) {
      const m = D.CUSTOM_MODS[id];
      const g = this.add.graphics();
      const ic = this.add.image(x + 30, y + h / 2, 'ic_' + m.icon).setIconScale(0.5);
      const name = U.fitText(T(this, x + 58, y + 30, m.short, { size: 18, bold: true, ox: 0, color: C.parch }), w - 92, 0, 11);
      const wt = T(this, x + 58, y + 58, _t('cust.weight', { w: (m.weight > 0 ? '+' : m.weight < 0 ? '−' : '±') + Math.abs(m.weight) }), { size: 13, ox: 0, color: m.weight > 0 ? C.flame : m.weight < 0 ? 0x8fe39a : C.muted });
      const hit = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      hit.ckey = 'mod_' + id;
      const on = () => this.cfg.mods.includes(id), allowed = () => on() || E.customModAllowed(this.cfg.mods, id);
      const paint = () => {
        const a = on(), ok = allowed();
        g.clear();
        g.fillStyle(a ? 0x2a2312 : 0x121614, 0.95); g.fillRoundedRect(x, y, w, h, 12);
        g.lineStyle(a ? 2.5 : 1.5, a ? C.gold : 0x333a36, 1); g.strokeRoundedRect(x, y, w, h, 12);
        g.fillStyle(0x0c100e, 1); g.fillRoundedRect(x + w - 32, y + 10, 22, 22, 5);
        g.lineStyle(2, a ? C.gold : C.line, 1); g.strokeRoundedRect(x + w - 32, y + 10, 22, 22, 5);
        if (a) { g.lineStyle(3.5, C.gold, 1); g.beginPath(); g.moveTo(x + w - 27, y + 21); g.lineTo(x + w - 23, y + 26); g.lineTo(x + w - 15, y + 15); g.strokePath(); }
        name.setColor(U.hex(a ? C.gold : ok ? C.parch : 0x6a6f6b)); ic.setAlpha(ok ? 1 : 0.4); wt.setAlpha(ok ? 1 : 0.4);
      };
      const tipBody = () => {
        const bad = D.CUSTOM_CONFLICTS.filter(([a, b]) => a === id || b === id).map(([a, b]) => (a === id ? b : a)).filter((o) => this.cfg.mods.includes(o));
        return m.text + (bad.length ? '\n' + _t('cust.conflict', { m: bad.map((o) => D.CUSTOM_MODS[o].name).join(', ') }) : '');
      };
      hit.on('pointerover', () => this.tip.show(Math.min(x, 1270 - 300), y + h + 6, m.name, tipBody()));
      hit.on('pointerout', () => this.tip.hide());
      hit.on('pointerup', () => {
        if (!allowed()) { Sfx.play('deny'); return; }
        this.cfg.mods = on() ? this.cfg.mods.filter((x2) => x2 !== id) : this.cfg.mods.concat(id);
        Sfx.play('click'); this.refresh();
        this.tip.show(Math.min(x, 1270 - 300), y + h + 6, m.name, tipBody());
      });
      return paint;
    }
    /** Pega un código: primero del portapapeles; si el navegador no deja (o no es válido), cuadro para pegarlo a mano. */
    async pasteCode() {
      const apply = (text) => {
        const c = E.decodeCustom(text);
        if (!c) return { ok: false, msg: _t('cust.bad') };
        const cn = D.CHARACTERS[c.char].name;
        if (!this.meta.unlockedChars.includes(c.char)) return { ok: false, msg: _t('cust.charLocked', { c: cn }) };
        const max = M.maxAsc(this.meta, c.char);
        const clamped = c.ascension > max;
        if (clamped) c.ascension = max;
        U.Store.set(CUSTOM_CFG_KEY, JSON.stringify(c));
        this.scene.restart({ cfg: c, focus: 'start' });
        setTimeout(() => { const sc = this.scene.get('CustomSetup'); if (sc && sc.sys.isActive()) toast(sc, clamped ? _t('cust.ascClamped', { n: max, c: cn }) : _t('cust.loaded'), clamped ? C.flame : C.gold); }, 60);
        return { ok: true };
      };
      let clip = '';
      try { if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.readText) clip = await root.navigator.clipboard.readText(); } catch (e) { clip = ''; }
      if (clip && E.decodeCustom(clip)) { const r = apply(clip); if (r.ok) return; toast(this, r.msg, C.blood); return; }
      const box = U.textBox({ title: _t('cust.pasteTitle'), placeholder: 'CM-PIRO-0A0-SEMILLA-000X', actionLabel: _t('cust.load'), mono: true,
        onAction: (v, res) => { const r = apply(v); if (r.ok) { if (box) box.close(); } else res(r.msg, false); } });
    }
    start() {
      if (U.loadRun('custom') && !this.armed) { this.armed = true; this.startB.setLabel(_t('s.seguro_se_pierde_la_actual')); return; }
      const m = loadMeta(); m.lastChar = this.cfg.char; saveMeta(m);
      U.Store.set(CUSTOM_CFG_KEY, JSON.stringify(this.cfg));
      this.registry.set('run', E.newCustomRun(this.cfg));
      go(this);
    }
  }

  /* =================================================================
   * Intro (Parche 3.7): 6 escenas a pantalla completa con movimiento lento de cámara (Ken Burns), fundidos,
   * partículas y el texto narrado. Sale sola la primera vez (meta.introSeen) y desde ⚙ y el Compendio.
   * Las imágenes (assets/intro/intro_<n>.webp) se cargan aquí, no al arrancar. Voz opcional:
   * assets/intro/vo_<idioma>_<n>.ogg|.mp3 → la escena dura lo que el audio + 0,8 s; sin audio, ~6-7 s.
   * Clic / Espacio / A: siguiente · mantener pulsado, «Saltar», Esc o B: salta toda la intro.
   * ================================================================= */
  const INTRO_MISSING = new Set();   // audios que no existen (no se vuelven a pedir)
  const INTRO_HOLD = 700;            // ms manteniendo pulsado para saltar
  class Intro extends Phaser.Scene {
    constructor() { super('Intro'); }
    init(data) { this.o = data || {}; this.idx = -1; this.done = false; this.timer = null; this.vo = null; this.holdAt = 0; this.holdFrom = null; this.extra = []; }
    preload() {
      this.cameras.main.setBackgroundColor('#000000');
      const t = T(this, 640, 360, _t('intro.loading'), { size: 20, color: C.muted });
      this.load.once('complete', () => t.destroy());
      this.load.on('loaderror', (f) => { if (f.type === 'audio') INTRO_MISSING.add(f.key); });
      for (let n = 1; n <= D.INTRO.length; n++) {
        if (!this.textures.exists('intro_' + n)) this.load.image('intro_' + n, `assets/intro/intro_${n}.webp`);
        const k = `vo_${I18N.lang}_${n}`;
        if (!this.cache.audio.exists(k) && !INTRO_MISSING.has(k)) this.load.audio(k, [`assets/intro/${k}.ogg`, `assets/intro/${k}.mp3`]);
      }
    }
    create() {
      const o = this.o;
      this.prevMusic = { key: Music.key, vol: Music.baseVol };
      Music.play(Sfx.has('bosque') ? 'bosque' : null, 0.06, 700);   // la del título, muy baja (sube en la escena 3)
      // Franja oscura abajo (degradado) y el texto narrado, en la fuente display con sombra
      const band = this.add.graphics().setDepth(50);
      band.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.82, 0.82); band.fillRect(0, 520, 1280, 200);
      this.txt = T(this, 640, 628, '', { size: 31, font: 'display', color: C.parch, wrap: 1100, align: 'center', stroke: 0x000000, strokeThickness: 5 }).setDepth(60);
      this.txt.setShadow(0, 3, '#000000', 10, true, true);
      // «Saltar» (esquina) con un anillo que se llena al mantener pulsado
      this.skipBtn = button(this, 1186, 40, _t('intro.skip'), () => this.finish(), { w: 150, h: 38, size: 17, variant: 'ghost' }).setDepth(70);
      this.holdRing = this.add.graphics().setDepth(71);
      this.hint = T(this, 1266, 706, _t('intro.hint'), { size: 13, color: C.muted, ox: 1, oy: 1 }).setDepth(70).setAlpha(0.8);
      // Toque / clic: corto = siguiente; mantenido = saltar
      const onSkipBtn = (p) => p.worldX > 1100 && p.worldY < 70;
      this.input.on('pointerdown', (p) => { if (!onSkipBtn(p)) { this.holdAt = this.time.now; this.holdFrom = 'pointer'; } });
      this.input.on('pointerup', (p) => { if (this.holdFrom !== 'pointer') return; const held = this.time.now - this.holdAt; this.holdFrom = null; if (!onSkipBtn(p) && held < INTRO_HOLD) this.next(); });
      // Espacio: igual; Enter = A (siguiente), Esc = B (saltar) llegan por Input
      if (this.input.keyboard) {
        this.input.keyboard.on('keydown-SPACE', (ev) => { if (!ev.repeat && this.holdFrom !== 'space') { this.holdAt = this.time.now; this.holdFrom = 'space'; } });
        this.input.keyboard.on('keyup-SPACE', () => { if (this.holdFrom !== 'space') return; const held = this.time.now - this.holdAt; this.holdFrom = null; if (held < INTRO_HOLD) this.next(); });
      }
      U.Input.bind(this, (a) => { if (a === 'confirm') this.next(); else if (a === 'back' || a === 'menu') this.finish(); });
      this.cameras.main.fadeIn(500, 0, 0, 0);
      this.next();
    }
    update() {
      if (this.typing) {
        const k = Math.min(this.typing.text.length, Math.floor((this.time.now - this.typing.at) / 34) + 1);
        if (this.txt.text.length !== k) this.txt.setText(this.typing.text.slice(0, k));
        if (k >= this.typing.text.length) this.typing = null;
      }
      this.holdRing.clear();
      if (!this.holdFrom || this.done) return;
      const f = (this.time.now - this.holdAt) / INTRO_HOLD;
      if (f > 0.15) { this.holdRing.lineStyle(4, C.gold, 1); this.holdRing.beginPath(); this.holdRing.arc(1092, 40, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, f)); this.holdRing.strokePath(); }
      if (f >= 1) { this.holdFrom = null; this.finish(); }
    }
    /** Duración de una escena: la del audio + 0,8 s; sin audio, según lo largo del texto (~6-7 s). */
    sceneMs(i, vo) {
      if (vo && vo.duration > 0) return Math.round(vo.duration * 1000) + 800;
      const len = D.INTRO_TEXT['s' + (i + 1)].length + (i === 5 ? D.INTRO_TEXT.s6b.length : 0);
      return i === 5 ? Phaser.Math.Clamp(6500 + 40 * len, 9000, 11000) : Phaser.Math.Clamp(3600 + 45 * len, 6000, 7400);
    }
    next() {
      if (this.done) return;
      if (this.timer) { this.timer.remove(); this.timer = null; }
      this.extra.forEach((t) => t.remove()); this.extra = [];
      if (this.vo) { try { this.vo.stop(); this.vo.destroy(); } catch (e) { /* nada */ } this.vo = null; }
      this.idx++;
      if (this.idx >= D.INTRO.length) { this.finish(); return; }
      this.showScene(this.idx);
    }
    showScene(i) {
      const n = i + 1, cfg = D.INTRO[i], rm = U.Opts.reduceMotion;
      // Voz (si existe el audio de este idioma)
      const vk = `vo_${I18N.lang}_${n}`;
      if (this.cache.audio.exists(vk)) {
        try { this.vo = this.sound.add(vk, { volume: U.Vol.voice }); if (U.Vol.voice > 0) this.vo.play(); } catch (e) { this.vo = null; }
      }
      const ms = this.sceneMs(i, this.vo);
      this.sceneDur = ms;
      // Imagen nueva con fundido; la anterior se va
      const old = this.img;
      const key = this.textures.exists('intro_' + n) ? 'intro_' + n : null;
      const img = this.img = key ? this.add.image(640, 360, key) : this.add.rectangle(640, 360, 1280, 720, 0x0a0812);
      img.setDepth(10 + i).setAlpha(0);
      const base = key ? Math.max(1280 / img.width, 720 / img.height) * 1.04 : 1;
      // Movimiento de cámara (Ken Burns), distinto en cada escena; con «Reducir movimiento», casi quieto
      const k = rm ? 0.2 : 1, M0 = {
        panR: [{ x: 640 + 52 * k, s: base * 1.09 }, { x: 640 - 52 * k, s: base * 1.09 }],
        zoomIn: [{ s: base * 1.02, y: 360 }, { s: base * (1.02 + 0.13 * k), y: 360 + 24 * k }],
        shock: [{ s: base * 1.05 }, { s: base * (1.05 + 0.06 * k) }],
        zoomCenter: [{ s: base * 1.02 }, { s: base * (1.02 + 0.14 * k) }],
        panLR: [{ x: 640 + 62 * k, s: base * 1.11 }, { x: 640 - 62 * k, s: base * 1.11 }],
        zoomOut: [{ s: base * (1.02 + 0.2 * k) }, { s: base * 1.02 }]
      }[cfg.cam];
      const [a, b] = M0;
      img.setPosition(a.x || 640, a.y || 360).setScale(key ? a.s : 1);
      this.tweens.add({ targets: img, alpha: 1, duration: i === 2 ? 120 : 900 });
      if (key) this.tweens.add({ targets: img, x: b.x || 640, y: b.y || 360, scale: b.s, duration: ms + 1200, ease: 'Sine.inOut' });
      if (old) this.tweens.add({ targets: old, alpha: 0, duration: 900, delay: 200, onComplete: () => old.destroy() });
      // Escena 3: destello blanco, temblor corto y la música sube
      if (i === 2) {
        Music.play(Sfx.has('bosque') ? 'bosque' : null, 0.4, 2500);
        if (!rm) {
          const fl = this.add.rectangle(640, 360, 1280, 720, 0xffffff, 1).setDepth(40);
          this.tweens.add({ targets: fl, alpha: 0, duration: 520, ease: 'Quad.out', onComplete: () => fl.destroy() });
          this.cameras.main.shake(320, 0.007);
        }
      }
      this.particles(cfg.fx, ms);
      // Texto narrado (letra a letra; con «Reducir movimiento», fundido)
      const T1 = D.INTRO_TEXT['s' + n];
      this.say(T1, 450);
      if (cfg.logo) {
        this.extra.push(this.time.delayedCall(Math.round(ms * 0.42), () => this.showLogo()));
        this.extra.push(this.time.delayedCall(Math.round(ms * 0.6), () => this.say(D.INTRO_TEXT.s6b, 0)));
      }
      this.timer = this.time.delayedCall(ms, () => this.next());
    }
    /** El texto aparece letra a letra (o con un fundido, con «Reducir movimiento»). */
    say(text, delay) {
      const t = this.txt;
      this.tweens.killTweensOf(t);
      this.typing = null;
      t.setText('').setAlpha(1);
      const start = () => {
        if (U.Opts.reduceMotion) { t.setText(text).setAlpha(0); this.tweens.add({ targets: t, alpha: 1, duration: 700 }); return; }
        this.typing = { text, at: this.time.now };   // letra a letra según el tiempo (no según los fotogramas)
      };
      if (delay) this.extra.push(this.time.delayedCall(delay, start)); else start();
    }
    /** Logo del juego al final de la escena 6, con un brillo. */
    showLogo() {
      const glow = this.add.image(640, 300, 'sumglow').setTint(C.gold).setBlendMode(Phaser.BlendModes.ADD).setDepth(54).setAlpha(0).setScale(5, 2.2);
      const logo = T(this, 640, 300, _t('s.carticas_magicas'), { size: 100, font: 'display', color: C.gold, stroke: 0x2a1206, strokeThickness: 8, shadow: true }).setDepth(55).setAlpha(0);
      U.fitText(logo, 1180, 0, 40);
      this.tweens.add({ targets: logo, alpha: 1, duration: 1100, ease: 'Sine.out' });
      this.tweens.add({ targets: glow, alpha: { from: 0, to: 0.55 }, duration: 900, yoyo: true, hold: 300, ease: 'Sine.inOut' });
      if (!U.Opts.reduceMotion) this.tweens.add({ targets: logo, scale: { from: logo.scale * 0.92, to: logo.scale }, duration: 1400, ease: 'Back.out' });
      this.logo = logo;
    }
    /** Partículas sutiles de cada escena (motas, destellos dorados, chispas moradas, polvo, ceniza). */
    particles(kind, ms) {
      const P = { motes: [0xfff3c0, -1, 0.5], gold: [0xf2c94c, 0, 0.6], purple: [0xb57cff, -1, 0.75], dust: [0xd8cfb8, 0, 0.35], ash: [0xc0b8b0, 1, 0.5] }[kind] || [0xffffff, -1, 0.4];
      const [col, dir, alpha] = P, n = U.Opts.reduceMotion ? 10 : 26;
      for (let j = 0; j < n; j++) {
        this.extra.push(this.time.delayedCall(Math.random() * ms * 0.8, () => {
          if (this.done) return;
          const x = Math.random() * 1280, y = dir < 0 ? 560 + Math.random() * 160 : dir > 0 ? -10 : 80 + Math.random() * 520;
          const d = this.add.image(x, y, 'dot').setTint(col).setDepth(30).setBlendMode(Phaser.BlendModes.ADD).setScale(0.12 + Math.random() * 0.22).setAlpha(0);
          const life = 2600 + Math.random() * 2400;
          this.tweens.add({ targets: d, alpha: { from: 0, to: alpha }, duration: life / 2, yoyo: true });
          this.tweens.add({ targets: d, x: x + (Math.random() - 0.5) * 120, y: dir < 0 ? y - 160 - Math.random() * 220 : dir > 0 ? y + 260 + Math.random() * 200 : y + (Math.random() - 0.5) * 60,
            duration: life, ease: 'Sine.inOut', onComplete: () => d.destroy() });
        }));
      }
    }
    /** Fin (o salto): para la voz, devuelve la música y vuelve a donde estabas (o al título). */
    finish() {
      if (this.done) return;
      this.done = true;
      if (this.timer) this.timer.remove();
      this.extra.forEach((t) => t.remove());
      if (this.vo) { try { this.vo.stop(); this.vo.destroy(); } catch (e) { /* nada */ } this.vo = null; }
      const m = loadMeta();
      if (!m.introSeen) { m.introSeen = true; saveMeta(m); }
      this.cameras.main.fadeOut(380, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        const o = this.o;
        if (o.over) {
          if (this.prevMusic.key) Music.play(this.prevMusic.key, this.prevMusic.vol, 800); else Music.stop(600);
          this.scene.resume(o.over);
          this.scene.stop();
        } else this.scene.start(o.next || 'Title');
      });
    }
  }
  /** Ver la intro encima de la escena actual (⚙ y Compendio): la escena queda en pausa y se reanuda al terminar. */
  function playIntro(scene) {
    const key = scene.scene.key;
    scene.scene.launch('Intro', { over: key });
    scene.scene.pause(key);
  }

  root.CM_SCENES = [Boot, Title, Prep, PathSelect, Contracts, MapScene, Combat, Reward, Shop, Rest, Chest, EventScene, BossRelic, ActTransition, End, CustomSetup, Compendium, DeckView, Records, Sanctuary, News, Intro, Overlay];
})(typeof globalThis !== 'undefined' ? globalThis : this);
