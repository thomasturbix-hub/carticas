/* =====================================================================
 * Carticas Mágicas — data.js
 * Contenido del juego como datos puros: cartas, enemigos, reliquias,
 * eventos y tablas de encuentros. Sin lógica de motor ni de UI.
 *
 * Convenciones de cartas:
 *   v     → valores base       up → valores que cambian al mejorar (+)
 *   fx    → lista de operaciones [op, arg?] que ejecuta engine.js
 *   text  → plantilla; {clave} se sustituye por el valor (o el daño real
 *           en combate para {dmg}; {dmgx} añade el daño calculado)
 * ===================================================================== */
(function (root) {
  'use strict';
  const I18N = (typeof module !== 'undefined' && module.exports) ? require('./i18n.js') : root.CM_I18N;
  /** Textos que se generan al jugar (resultados de eventos): _m = mensaje para guardar; _t = texto para mostrar ya. */
  const _m = I18N.msg, _t = (k, v) => I18N.t(k, v);

  const CARDS = {
    // ---------- Iniciales ----------
    llama: {
      name: 'Llama', class: 'piromago', cost: 1, type: 'attack', rarity: 'starter', icon: 'flame',
      v: { dmg: 5, burn: 2 }, up: { dmg: 8, burn: 3 },
      fx: [['attack'], ['burn']],
      text: 'Inflige {dmg} de daño.\nAplica {burn} Quemadura.'
    },
    chispa: {
      name: 'Chispa Ígnea', class: 'piromago', cost: 1, type: 'attack', rarity: 'starter', icon: 'spark',
      v: { dmg: 6, burn: 1 }, up: { dmg: 10, burn: 2 },
      fx: [['attack'], ['burn']],
      text: 'Inflige {dmg} de daño.\nAplica {burn} Quemadura.'
    },
    piel: {
      name: 'Piel de Llama', class: 'piromago', cost: 1, type: 'skill', rarity: 'starter', icon: 'shield',
      v: { block: 5, burn: 1 }, up: { block: 9, burn: 1 },
      fx: [['block'], ['burn']],
      text: 'Gana {block} de Bloqueo.\nAplica {burn} Quemadura.'
    },
    bola: {
      name: 'Bola de Fuego', class: 'piromago', cost: 2, type: 'attack', rarity: 'starter', icon: 'fireball',
      v: { dmg: 12 }, up: { dmg: 17 },
      fx: [['attack']],
      text: 'Inflige {dmg} de daño.'
    },
    combustion: {
      name: 'Combustión', class: 'piromago', cost: 1, type: 'attack', rarity: 'starter', icon: 'burst',
      v: { mult: 2 }, up: { mult: 3 },
      fx: [['combust']],
      text: 'Inflige daño igual a {mult}× la Quemadura del enemigo{dmgx}.\nReduce su Quemadura a la mitad.'
    },

    // ---------- Comunes ----------
    golpe: {
      tags: ['horno'], name: 'Golpe Ardiente', class: 'piromago', cost: 1, type: 'attack', rarity: 'common', icon: 'flame',
      v: { dmg: 8, temp: 1 }, up: { dmg: 11 },
      fx: [['attack'], ['temp']],
      text: 'Inflige {dmg} de daño.\n+{temp} Temperatura.'
    },
    sobrecarga: {
      tags: ['horno'], name: 'Sobrecarga', class: 'piromago', cost: 1, type: 'attack', rarity: 'common', icon: 'spark',
      v: { dmg: 4, hits: 2, temp: 2 }, up: { dmg: 6 },
      fx: [['attack'], ['temp']],
      text: 'Inflige {dmg} de daño 2 veces.\n+{temp} Temperatura.'
    },
    brasas: {
      aim: 'all',   // Parche 3.2: área (objetivo: todos)
      tags: ['brasa'], name: 'Lluvia de Brasas', class: 'piromago', cost: 2, type: 'attack', rarity: 'common', icon: 'fireball',
      v: { dmg: 3, hits: 3, burn: 2 }, up: { dmg: 4, burn: 3 },
      fx: [['attack'], ['burn']],
      text: 'Inflige {dmg} de daño 3 veces.\nAplica {burn} Quemadura.'
    },
    ceniza: {
      tags: ['horno'], name: 'Ceniza', class: 'piromago', cost: 0, type: 'skill', rarity: 'common', icon: 'book',
      v: { draw: 2, temp: 1 }, up: { draw: 3 },
      fx: [['draw'], ['temp']],
      text: 'Roba {draw} {draw|carta|cartas}.\n+{temp} Temperatura.'
    },
    enfriar: {
      tags: ['horno'], name: 'Enfriar', class: 'piromago', cost: 1, type: 'skill', rarity: 'common', icon: 'snow',
      v: { block: 9, cool: 2 }, up: { block: 12, cool: 3 },
      fx: [['block'], ['cool']],
      text: 'Gana {block} de Bloqueo.\nPierde {cool} de Temperatura.'
    },
    chamuscar: {
      tags: ['brasa'], name: 'Chamuscar', class: 'piromago', cost: 1, type: 'skill', rarity: 'common', icon: 'flame',
      v: { burn: 5 }, up: { burn: 8 },
      fx: [['burn']],
      text: 'Aplica {burn} Quemadura.'
    },

    brasaviva: {
      tags: ['horno'], name: 'Brasa Viva', class: 'piromago', cost: 0, type: 'attack', rarity: 'common', icon: 'spark',
      v: { dmg: 3, temp: 1 }, up: { dmg: 5 },
      fx: [['attack'], ['temp']],
      text: 'Inflige {dmg} de daño.\n+{temp} Temperatura.'
    },
    escudoascuas: {
      tags: ['brasa'], name: 'Escudo de Ascuas', class: 'piromago', cost: 1, type: 'skill', rarity: 'common', icon: 'shield',
      v: { block: 6, burn: 2 }, up: { block: 10, burn: 3 },
      fx: [['block'], ['burn']],
      text: 'Gana {block} de Bloqueo.\nAplica {burn} Quemadura.'
    },
    ignicion: {
      tags: ['horno'], name: 'Ignición', class: 'piromago', cost: 0, type: 'skill', rarity: 'common', icon: 'up',
      v: { temp: 2, draw: 1 }, up: { draw: 2 },
      fx: [['temp'], ['draw']],
      text: '+{temp} Temperatura.\nRoba {draw} {draw|carta|cartas}.'
    },

    // ---------- Poco comunes ----------
    infierno: {
      aim: 'all',   // Parche 3.2: área (objetivo: todos)
      tags: ['brasa'], name: 'Infierno', class: 'piromago', cost: 2, type: 'attack', rarity: 'uncommon', icon: 'fireball',
      v: { dmg: 8, burn: 4 }, up: { dmg: 10, burn: 6 },
      fx: [['attack'], ['burn']],
      text: 'Inflige {dmg} de daño.\nAplica {burn} Quemadura.'
    },
    muro: {
      tags: ['brasa'], name: 'Muro de Llamas', class: 'piromago', cost: 2, type: 'skill', rarity: 'uncommon', icon: 'wall',
      v: { block: 13, thorns: 3 }, up: { block: 17, thorns: 4 },
      fx: [['block'], ['thorns']],
      text: 'Gana {block} de Bloqueo.\nEste turno, cada golpe recibido aplica {thorns} Quemadura al atacante.'
    },
    avivar: {
      tags: ['brasa', 'ceniza'], name: 'Avivar', class: 'piromago', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'burst', exhaust: true,
      v: {}, up: { cost: 0 },
      fx: [['double']],
      text: 'Duplica la Quemadura del enemigo.\nAgotar.'
    },
    furia: {
      tags: ['horno'], name: 'Furia Ardiente', class: 'piromago', cost: 1, type: 'power', rarity: 'uncommon', icon: 'up',
      v: { amt: 1 }, up: { cost: 0 },
      fx: [['power', 'furia']],
      text: 'Al inicio de cada turno, +{amt} Temperatura.'
    },
    llamarada: {
      tags: ['horno'], name: 'Llamarada', class: 'piromago', cost: 1, type: 'attack', rarity: 'uncommon', icon: 'flame',
      v: { dmg: 4 }, up: { dmg: 8 },
      fx: [['flare']],
      text: 'Inflige {dmg} de daño.\nLa Temperatura cuenta triple.'
    },
    vapor: {
      tags: ['horno'], name: 'Vapor Ígneo', class: 'piromago', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'snow',
      v: { block: 5 }, up: { block: 8 },
      fx: [['blockTemp']],
      text: 'Gana {block} de Bloqueo, +2 por cada punto de Temperatura.'
    },

    disipar: {
      tags: ['horno'], name: 'Disipar Calor', class: 'piromago', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'snow',
      v: { per: 4 }, up: { per: 6 },
      fx: [['vent']],
      text: 'Pierde toda tu Temperatura.\nGana {per} de Bloqueo por cada punto perdido.'
    },
    fragua: {
      tags: ['horno', 'ceniza'], name: 'Fragua', class: 'piromago', cost: 0, type: 'skill', rarity: 'uncommon', icon: 'burst', exhaust: true,
      v: { energy: 2, temp: 2 }, up: { energy: 3 },
      fx: [['energy'], ['temp']],
      text: 'Gana {energy} de Energía.\n+{temp} Temperatura.\nAgotar.'
    },
    eterna: {
      tags: ['brasa'], name: 'Ascuas Eternas', class: 'piromago', cost: 2, type: 'power', rarity: 'uncommon', icon: 'up',
      v: { amt: 1 }, up: { cost: 1 },
      fx: [['power', 'eterna']],
      text: 'La Quemadura del enemigo ya no se reduce al final del turno.'
    },

    // ---------- Raras ----------
    erupcion: {
      aim: 'all',   // Parche 3.2: área (objetivo: todos)
      tags: ['horno'], name: 'Erupción', class: 'piromago', cost: 3, type: 'attack', rarity: 'rare', icon: 'burst',
      v: { dmg: 27, self: 3 }, up: { dmg: 36 },
      fx: [['attack'], ['self']],
      text: 'Inflige {dmg} de daño.\nPierde {self} PV.'
    },
    fenix: {
      tags: ['brasa'], name: 'Corazón de Fénix', class: 'piromago', cost: 2, type: 'power', rarity: 'rare', icon: 'up',
      v: { amt: 1 }, up: { cost: 1 },
      fx: [['power', 'fenix']],
      text: 'Cada vez que juegues un Ataque, aplica {amt} de Quemadura.'
    },
    pira: {
      tags: ['brasa', 'horno'], name: 'Pira', class: 'piromago', cost: 2, type: 'skill', rarity: 'rare', icon: 'fireball',
      v: { mult: 2 }, up: { cost: 1 },
      fx: [['pyre']],
      text: 'Aplica Quemadura igual a {mult}× tu Temperatura.\nPierde toda tu Temperatura.'
    },

    sol: {
      tags: ['horno'], name: 'Sol Interior', class: 'piromago', cost: 2, type: 'power', rarity: 'rare', icon: 'up',
      v: { amt: 1 }, up: { cost: 1 },
      fx: [['power', 'sol']],
      text: 'El Sobrecalentamiento ya no te hace daño.'
    },
    supernova: {
      aim: 'all',   // Parche 3.2: área (objetivo: todos)
      tags: ['horno', 'ceniza'], name: 'Supernova', class: 'piromago', cost: 2, type: 'attack', rarity: 'rare', icon: 'burst', exhaust: true,
      v: { mult: 3 }, up: { mult: 4 },
      fx: [['nova']],
      text: 'Inflige daño igual a {mult}× tu Temperatura{dmgx}.\nPierde toda tu Temperatura.\nAgotar.'
    },

    // ---------- Acto II (Cumbres de Escarcha) ----------
    // acts: [2] → solo salen en recompensas, tiendas y eventos del Acto II (las demás cartas, en ambos actos)
    fundir: {
      tags: ['brasa'], name: 'Fundir', class: 'piromago', cost: 1, type: 'attack', rarity: 'common', icon: 'burst', acts: [2],
      v: { dmg: 8 }, up: { dmg: 11 },
      fx: [['melt'], ['attack']],
      text: 'Quita todo el Bloqueo del enemigo.\nInflige {dmg} de daño.'
    },
    persistente: {
      tags: ['brasa'], name: 'Llama Persistente', class: 'piromago', cost: 1, type: 'attack', rarity: 'common', icon: 'flame', acts: [2],
      v: { dmg: 6, draw: 1 }, up: { dmg: 10 },
      fx: [['attack'], ['drawIfBurn']],
      text: 'Inflige {dmg} de daño.\nSi el enemigo tiene Quemadura, roba {draw}.'
    },
    cenizacaliente: {
      tags: ['horno'], name: 'Ceniza Caliente', class: 'piromago', cost: 0, type: 'skill', rarity: 'common', icon: 'spark', acts: [2],
      v: { temp: 2, draw: 1 }, up: { temp: 3 },
      fx: [['temp'], ['draw']],
      text: '+{temp} Temperatura.\nRoba {draw} {draw|carta|cartas}.'
    },
    caldera: {
      tags: ['horno'], name: 'Caldera', class: 'piromago', cost: 2, type: 'skill', rarity: 'common', icon: 'shield', acts: [2],
      v: { block: 10, temp: 2 }, up: { block: 13 },
      fx: [['block'], ['temp']],
      text: 'Gana {block} de Bloqueo.\n+{temp} Temperatura.'
    },
    purgar: {
      tags: ['ceniza'], name: 'Purgar con Fuego', class: 'piromago', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'fireball', acts: [2],
      v: {}, up: { cost: 0 },
      fx: [['purge']],
      text: 'Agota todas las Maldiciones de tu mano.\nRoba 1 carta por cada una.'
    },
    hoguerainterior: {
      tags: ['horno'], name: 'Hoguera Interior', class: 'piromago', cost: 1, type: 'power', rarity: 'uncommon', icon: 'campfire', acts: [2],
      v: { amt: 1 }, up: { amt: 2 },
      fx: [['power', 'hoguera']],
      text: 'Al empezar tu turno, +{amt} Temperatura.'
    },
    magma: {
      tags: ['brasa', 'horno'], name: 'Magma', class: 'piromago', cost: 2, type: 'attack', rarity: 'uncommon', icon: 'fireball', acts: [2],
      v: { dmg: 13 }, up: { dmg: 18 },
      fx: [['attack'], ['burnTemp']],
      text: 'Inflige {dmg} de daño.\nAplica Quemadura igual a tu Temperatura.'
    },
    volcan: {
      tags: ['horno'], name: 'Corazón de Volcán', class: 'piromago', cost: 2, type: 'power', rarity: 'rare', icon: 'up', acts: [2],
      v: { amt: 1 }, up: { cost: 1 },
      fx: [['power', 'volcan']],
      text: 'Los enemigos no pueden reducir tu Temperatura.\nEl Sobrecalentamiento te quita 1 PV menos.'
    },

    // ---------- Palabras clave (Conservar, Etérea, Templar, Combo, Coste X) ----------
    // Las palabras clave van como datos de la carta (retain, ethereal, temper, combo, cost 'X') y la UI
    // las pinta en una línea dorada encima del texto; por eso no se repiten dentro de `text`.
    brasag: {
      tags: ['horno'], name: 'Brasa Guardada', class: 'piromago', cost: 1, type: 'skill', rarity: 'common', icon: 'shield', retain: true,
      v: { block: 8, temp: 1 }, up: { block: 11 },
      fx: [['block'], ['temp']],
      text: 'Gana {block} de Bloqueo.\n+{temp} Temperatura.'
    },
    lanza: {
      tags: ['brasa'], name: 'Lanza Templada', class: 'piromago', cost: 1, type: 'attack', rarity: 'common', icon: 'bolt',
      v: { dmg: 6, temper: 3 }, up: { dmg: 9, temper: 4 },
      fx: [['attack']],
      text: 'Inflige {dmg} de daño.'
    },
    chispazo: {
      tags: ['ceniza'], name: 'Chispazo Fugaz', class: 'piromago', cost: 0, type: 'attack', rarity: 'common', icon: 'spark', ethereal: true,
      v: { dmg: 5, draw: 1 }, up: { dmg: 9 },
      fx: [['attack'], ['draw']],
      text: 'Inflige {dmg} de daño.\nRoba {draw} {draw|carta|cartas}.'
    },
    encadenar: {
      tags: ['brasa'], name: 'Encadenar Llamas', class: 'piromago', cost: 1, type: 'attack', rarity: 'common', icon: 'flame',
      v: { dmg: 8, comboN: 3, comboDmg: 7, comboBurn: 2 }, up: { comboN: 2 },
      fx: [['attack'], ['comboBurn']],
      text: 'Inflige {dmg} de daño.\nCombo {comboN}: +{comboDmg} de daño y {comboBurn} Quemadura.'
    },
    torbellino: {
      aim: 'all',   // Parche 3.2: área (objetivo: todos)
      tags: ['brasa'], name: 'Torbellino Ígneo', class: 'piromago', cost: 'X', type: 'attack', rarity: 'uncommon', icon: 'fireball',
      v: { dmg: 6 }, up: { dmg: 8 },
      fx: [['xAttack'], ['xBurn']],
      text: 'Inflige {dmg} de daño X veces.\nAplica X Quemadura.'
    },
    reserva: {
      tags: ['horno'], name: 'Reserva de Calor', class: 'piromago', cost: 'X', type: 'skill', rarity: 'uncommon', icon: 'thermo',
      v: { xPlus: 0, xl: 'X' }, up: { xPlus: 1, xl: 'X+1' },
      fx: [['xHeat']],
      text: 'Gana 2×{xl} de Temperatura y 4×{xl} de Bloqueo.'
    },
    eco: {
      tags: ['ceniza'], name: 'Eco Ardiente', class: 'piromago', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'burst', exhaust: true,
      v: {}, up: { cost: 0 },
      fx: [['echo']],
      text: 'La siguiente carta que juegues este turno se juega dos veces.\nAgotar.'
    },
    paciente: {
      tags: ['horno'], name: 'Llama Paciente', class: 'piromago', cost: 2, type: 'attack', rarity: 'uncommon', icon: 'campfire', retain: true,
      v: { dmg: 13, per: 4 }, up: { per: 6 },
      fx: [['attack']],
      text: 'Inflige {dmg} de daño.\n+{per} por cada turno que pase en tu mano.'
    },
    forja: {
      tags: ['ceniza'], name: 'Forja Mental', class: 'piromago', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'up',
      v: { target: '1 carta al azar de tu mano', all: 0 }, up: { target: 'todas las cartas de tu mano', all: 1 },
      fx: [['forge']],
      text: 'Mejora {target} para este combate.'
    },
    metamorfosis: {
      tags: ['ceniza'], name: 'Metamorfosis', class: 'piromago', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'eye', exhaust: true,
      v: { n: 2 }, up: { n: 3 },
      fx: [['transform']],
      text: 'Transforma {n} {n|carta|cartas} al azar de tu mano en cartas aleatorias. Cuestan 0 este turno.\nAgotar.'
    },
    cadena: {
      tags: ['ceniza'], name: 'Cadena Infernal', class: 'piromago', cost: 2, type: 'attack', rarity: 'rare', icon: 'burst',
      v: { dmg: 11, comboN: 4, comboHits: 2, comboEnergy: 2 }, up: { dmg: 14 },
      fx: [['attack'], ['comboChain']],
      text: 'Inflige {dmg} de daño.\nCombo {comboN}: golpea {comboHits} veces más y gana {comboEnergy} de Energía.'
    },
    corazonfenix: {
      tags: ['ceniza', 'brasa'], name: 'Corazón del Fénix', class: 'piromago', cost: 3, type: 'power', rarity: 'rare', icon: 'heart',
      v: { amt: 3 }, up: { cost: 2 },
      fx: [['power', 'renacer']],
      text: 'Cada vez que una carta se Agote, aplica {amt} de Quemadura y gana {amt} de Bloqueo.'
    },

    // ================= CRIOMANTE (class: 'criomante') =================
    // Escarcha (frost) en el enemigo: −25% a sus ataques, baja 1 por turno; a 10 (15 jefes) queda Congelado.
    // Escudo de Hielo (ice) en el jugador: absorbe antes que el Bloqueo y se derrite 3 por turno.
    esquirla: {
      class: 'criomante', name: 'Esquirla', cost: 1, type: 'attack', rarity: 'starter', icon: 'bolt',
      v: { dmg: 8 }, up: { dmg: 11 }, fx: [['attack']], text: 'Inflige {dmg} de daño.'
    },
    muroescarcha: {
      class: 'criomante', name: 'Muro de Escarcha', cost: 1, type: 'skill', rarity: 'starter', icon: 'shield',
      v: { block: 5 }, up: { block: 8 }, fx: [['block']], text: 'Gana {block} de Bloqueo.'
    },
    alientogelido: {
      class: 'criomante', name: 'Aliento Gélido', cost: 1, type: 'skill', rarity: 'starter', icon: 'snow',
      v: { frost: 4 }, up: { frost: 6 }, fx: [['frost']], text: 'Aplica {frost} Escarcha.'
    },
    fragmentar: {
      class: 'criomante', name: 'Fragmentar', cost: 1, type: 'attack', rarity: 'starter', icon: 'burst',
      v: { per: 4 }, up: { per: 5 }, fx: [['shatter']], text: 'Inflige {per} de daño por cada Escarcha del enemigo{dmgx} y la consume toda.'
    },
    esquirlaaf: {
      tags: ['esquirlas'], class: 'criomante', name: 'Esquirla Afilada', cost: 1, type: 'attack', rarity: 'common', icon: 'bolt',
      v: { dmg: 10, frost: 1 }, up: { dmg: 13 }, fx: [['attack'], ['frost']], text: 'Inflige {dmg} de daño.\nAplica {frost} Escarcha.'
    },
    ventiscac: {
      aim: 'all',   // Parche 3.2: área (objetivo: todos)
      tags: ['glaciar'], class: 'criomante', name: 'Ventisca', cost: 1, type: 'skill', rarity: 'common', icon: 'snow',
      v: { frost: 2, draw: 1 }, up: { frost: 3 }, fx: [['frost'], ['draw']], text: 'Aplica {frost} Escarcha.\nRoba {draw} {draw|carta|cartas}.'
    },
    corazah: {
      tags: ['muralla'], class: 'criomante', name: 'Coraza Helada', cost: 1, type: 'skill', rarity: 'common', icon: 'shield',
      v: { ice: 6 }, up: { ice: 9 }, fx: [['ice']], text: 'Gana {ice} de Escudo de Hielo.'
    },
    granizo: {
      aim: 'all',   // Parche 3.2: área (objetivo: todos)
      tags: ['esquirlas'], class: 'criomante', name: 'Lluvia de Granizo', cost: 1, type: 'attack', rarity: 'common', icon: 'snow',
      v: { dmg: 4, hits: 3 }, up: { dmg: 5 }, fx: [['attack']], text: 'Inflige {dmg} de daño 3 veces.'
    },
    tempano: {
      tags: ['glaciar'], class: 'criomante', name: 'Témpano', cost: 2, type: 'attack', rarity: 'common', icon: 'bolt',
      v: { dmg: 18, frostBonus: 6, frostAt: 5 }, up: { dmg: 23 }, fx: [['attack']], text: 'Inflige {dmg} de daño.\n+{frostBonus} si el enemigo tiene {frostAt}+ Escarcha.'
    },
    rocio: {
      tags: ['glaciar', 'muralla'], class: 'criomante', name: 'Rocío Frío', cost: 0, type: 'skill', rarity: 'common', icon: 'snow',
      v: { frost: 1, block: 3 }, up: { frost: 2, block: 5 }, fx: [['frost'], ['block']], text: 'Aplica {frost} Escarcha.\nGana {block} de Bloqueo.'
    },
    carambano: {
      tags: ['esquirlas'], class: 'criomante', name: 'Carámbano', cost: 1, type: 'attack', rarity: 'common', icon: 'bolt',
      v: { dmg: 5, draw: 1 }, up: { dmg: 8 }, fx: [['attack'], ['drawIfFrost']], text: 'Inflige {dmg} de daño.\nSi el enemigo tiene Escarcha, roba {draw}.'
    },
    alientoinv: {
      tags: ['glaciar'], class: 'criomante', name: 'Aliento Invernal', cost: 1, type: 'skill', rarity: 'common', icon: 'shield',
      v: { block: 4, frost: 2 }, up: { block: 6, frost: 3 }, fx: [['block'], ['frost']], text: 'Gana {block} de Bloqueo.\nAplica {frost} Escarcha.'
    },
    glaciacion: {
      tags: ['glaciar'], class: 'criomante', name: 'Glaciación', cost: 2, type: 'skill', rarity: 'uncommon', icon: 'snow', exhaust: true,
      v: {}, up: { cost: 1 }, fx: [['frostDouble']], text: 'Duplica la Escarcha del enemigo.\nAgotar.'
    },
    cristalizar: {
      tags: ['muralla'], class: 'criomante', name: 'Cristalizar', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'shield',
      v: { extra: 0, extraTxt: '' }, up: { extra: 4, extraTxt: ' y gana 4 extra' }, fx: [['crystal']], text: 'Convierte todo tu Bloqueo en Escudo de Hielo{extraTxt}.'
    },
    ventiscap: {
      tags: ['glaciar'], class: 'criomante', name: 'Ventisca Perpetua', cost: 2, type: 'power', rarity: 'uncommon', icon: 'snow',
      v: { amt: 2 }, up: { amt: 3 }, fx: [['power', 'ventisca']], text: 'Al empezar tu turno, aplica {amt} Escarcha.'
    },
    ruptura: {
      tags: ['esquirlas'], class: 'criomante', name: 'Ruptura', cost: 2, type: 'attack', rarity: 'uncommon', icon: 'burst',
      v: { per: 5 }, up: { per: 6 }, fx: [['shatter']], text: 'Inflige {per} de daño por cada Escarcha del enemigo{dmgx} y la consume toda.'
    },
    espejo: {
      tags: ['muralla', 'glaciar'], class: 'criomante', name: 'Espejo de Hielo', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'shield', retain: true,
      v: { block: 8, frost: 2 }, up: { block: 11 }, fx: [['block'], ['mirror']], text: 'Gana {block} de Bloqueo.\nSi el enemigo te ataca este turno, recibe {frost} Escarcha.'
    },
    ceroabs: {
      tags: ['glaciar'], class: 'criomante', name: 'Cero Absoluto', cost: 'X', type: 'skill', rarity: 'uncommon', icon: 'snow',
      v: { xPlus: 0, xl: 'X' }, up: { xPlus: 1, xl: 'X+1' }, fx: [['xFrost']], text: 'Aplica 3×{xl} Escarcha.'
    },
    avalancha: {
      aim: 'all',   // Parche 3.2: área (objetivo: todos)
      tags: ['glaciar'], class: 'criomante', name: 'Avalancha', cost: 3, type: 'attack', rarity: 'uncommon', icon: 'burst', frostDiscount: 4,
      v: { dmg: 32 }, up: { dmg: 39 }, fx: [['attack']], text: 'Inflige {dmg} de daño.\nCuesta 1 menos por cada 4 de Escarcha del enemigo.'
    },
    lanzab: {
      tags: ['esquirlas'], class: 'criomante', name: 'Lanza Boreal', cost: 1, type: 'attack', rarity: 'uncommon', icon: 'bolt',
      v: { dmg: 7, frost: 1, temper: 3 }, up: { dmg: 9 }, fx: [['attack'], ['frost']], text: 'Inflige {dmg} de daño.\nAplica {frost} Escarcha.'
    },
    inviernoet: {
      tags: ['glaciar'], class: 'criomante', name: 'Invierno Eterno', cost: 3, type: 'power', rarity: 'rare', icon: 'snow',
      v: { amt: 1 }, up: { cost: 2 }, fx: [['power', 'invierno']], text: 'La Escarcha del enemigo ya no baja.'
    },
    corglaciar: {
      tags: ['glaciar'], class: 'criomante', name: 'Corazón de Glaciar', cost: 2, type: 'power', rarity: 'rare', icon: 'heart',
      v: { amt: 1 }, up: { cost: 1 }, fx: [['power', 'glaciar']], text: 'Cada vez que Congeles al enemigo, gana 2 de Energía y roba 2 cartas en tu siguiente turno.'
    },
    tormentap: {
      aim: 'all',   // Parche 3.2: área (objetivo: todos)
      tags: ['esquirlas', 'glaciar'], class: 'criomante', name: 'Tormenta Polar', cost: 2, type: 'attack', rarity: 'rare', icon: 'snow',
      v: { per: 5 }, up: { per: 6 }, fx: [['storm']], text: 'Inflige {per} de daño por cada Escarcha del enemigo{dmgx} sin consumirla.'
    },
    eraglacial: {
      tags: ['glaciar'], class: 'criomante', name: 'Era Glacial', cost: 3, type: 'skill', rarity: 'rare', icon: 'snow', exhaust: true,
      v: {}, up: { cost: 2 }, fx: [['freezeNow']], text: 'Congela al enemigo ahora mismo (también a los jefes).\nAgotar.'
    },

    // ================= GUARDIANA RÚNICA (class: 'guardiana') =================
    // Runas: se graban en ranuras (3). Al final de tu turno cada runa activa su PASIVO (izq. → der.).
    // Grabar con las ranuras llenas DETONA la más antigua. Potencia de runa: suma a pasivos y detonaciones.
    golperunico: {
      class: 'guardiana', name: 'Golpe Rúnico', cost: 1, type: 'attack', rarity: 'starter', icon: 'bolt',
      v: { dmg: 6 }, up: { dmg: 9 }, fx: [['attack']], text: 'Inflige {dmg} de daño.'
    },
    guardia: {
      class: 'guardiana', name: 'Guardia', cost: 1, type: 'skill', rarity: 'starter', icon: 'shield',
      v: { block: 5 }, up: { block: 8 }, fx: [['block']], text: 'Gana {block} de Bloqueo.'
    },
    tallarllama: {
      class: 'guardiana', name: 'Tallar Llama', cost: 1, type: 'skill', rarity: 'starter', icon: 'rune_fuego',
      v: { hit: 0, hitTxt: '' }, up: { hit: 4, hitTxt: '\nInflige 4 de daño.' }, fx: [['engrave', 'fuego'], ['runeHit']], text: 'Graba Fuego.{hitTxt}'
    },
    tallarescudo: {
      class: 'guardiana', name: 'Tallar Escudo', cost: 1, type: 'skill', rarity: 'starter', icon: 'rune_piedra',
      v: { block: 0, blkTxt: '' }, up: { block: 4, blkTxt: '\nGana 4 de Bloqueo.' }, fx: [['engrave', 'piedra'], ['block']], text: 'Graba Piedra.{blkTxt}'
    },
    tallarviento: {
      tags: ['ecos'], class: 'guardiana', name: 'Tallar Viento', cost: 1, type: 'skill', rarity: 'common', icon: 'rune_viento',
      v: { draw: 1 }, up: { cost: 0 }, fx: [['engrave', 'viento'], ['draw']], text: 'Graba Viento.\nRoba {draw} {draw|carta|cartas}.'
    },
    martillo: {
      tags: ['ecos'], class: 'guardiana', name: 'Martillo Rúnico', cost: 1, type: 'attack', rarity: 'common', icon: 'burst',
      v: { dmg: 7, perRuneType: 3 }, up: { dmg: 10 }, fx: [['attack']], text: 'Inflige {dmg} de daño.\n+{perRuneType} por cada tipo de runa distinto grabado.'
    },
    murograbado: {
      tags: ['bastion'], class: 'guardiana', name: 'Muro Grabado', cost: 1, type: 'skill', rarity: 'common', icon: 'shield',
      v: { per: 4 }, up: { per: 5 }, fx: [['runeBlock']], text: 'Gana {per} de Bloqueo por cada runa grabada.'
    },
    ecoruna: {
      tags: ['ecos'], class: 'guardiana', name: 'Eco de Runa', cost: 0, type: 'skill', rarity: 'common', icon: 'rune',
      v: { times: 1, timesTxt: '' }, up: { times: 2, timesTxt: ' dos veces' }, fx: [['echoRune']], text: 'Activa el pasivo de tu runa más reciente{timesTxt}.'
    },
    golpedoble: {
      tags: ['ecos'], class: 'guardiana', name: 'Golpe Doble', cost: 1, type: 'attack', rarity: 'common', icon: 'bolt',
      v: { dmg: 4, hits: 2, draw: 1 }, up: { dmg: 6 }, fx: [['attack'], ['drawIfRunes']], text: 'Inflige {dmg} de daño 2 veces.\nSi tienes 3 runas, roba {draw}.'
    },
    inscribir: {
      tags: ['ecos'], class: 'guardiana', name: 'Inscribir', cost: 1, type: 'skill', rarity: 'common', icon: 'rune',
      v: { choose: false, insTxt: 'una runa aleatoria' }, up: { choose: true, insTxt: 'la runa que elijas' }, fx: [['inscribe']], text: 'Graba {insTxt} (Fuego, Piedra o Viento).'
    },
    cincelada: {
      tags: ['fuegorunico'], class: 'guardiana', name: 'Cincelada', cost: 1, type: 'attack', rarity: 'common', icon: 'bolt',
      v: { dmg: 8 }, up: { dmg: 11 }, fx: [['attack'], ['engraveIfNone', 'fuego']], text: 'Inflige {dmg} de daño.\nSi no tienes runas, Graba Fuego.'
    },
    paredgranito: {
      tags: ['bastion'], class: 'guardiana', name: 'Pared de Granito', cost: 2, type: 'skill', rarity: 'common', icon: 'rune_piedra',
      v: { block: 13 }, up: { block: 17 }, fx: [['block'], ['engrave', 'piedra']], text: 'Gana {block} de Bloqueo.\nGraba Piedra.'
    },
    detonacion: {
      tags: ['fuegorunico'], class: 'guardiana', name: 'Detonación', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'burst',
      v: { draw: 1 }, up: { cost: 0 }, fx: [['detonateOldest'], ['draw']], text: 'Detona tu runa más antigua.\nRoba {draw} {draw|carta|cartas}.'
    },
    cadenarunica: {
      tags: ['ecos'], class: 'guardiana', name: 'Cadena Rúnica', cost: 2, type: 'skill', rarity: 'uncommon', icon: 'rune',
      v: {}, up: { cost: 1 }, fx: [['runeChain']], text: 'Activa el pasivo de todas tus runas.'
    },
    potencia: {
      tags: ['ecos'], class: 'guardiana', name: 'Potencia', cost: 1, type: 'power', rarity: 'uncommon', icon: 'up',
      v: { amt: 1 }, up: { amt: 2 }, fx: [['power', 'potencia']], text: '+{amt} Potencia de runa.'
    },
    ranura: {
      tags: ['ecos'], class: 'guardiana', name: 'Ranura Extra', cost: 2, type: 'power', rarity: 'uncommon', icon: 'rune',
      v: { amt: 1 }, up: { cost: 1 }, fx: [['power', 'ranura']], text: '+1 ranura de runa.'
    },
    tallarsangre: {
      tags: ['ecos'], class: 'guardiana', name: 'Tallar Sangre', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'rune_sangre',
      v: {}, up: { cost: 0 }, fx: [['engrave', 'sangre']], text: 'Graba Sangre.'
    },
    resonancia: {
      tags: ['ecos'], class: 'guardiana', name: 'Resonancia', cost: 'X', type: 'skill', rarity: 'uncommon', icon: 'rune', exhaust: true,
      v: { xPlus: 0, xl: 'X' }, up: { xPlus: 1, xl: 'X+1' }, fx: [['resonate']], text: 'Activa los pasivos de todas tus runas {xl} veces.\nAgotar.'
    },
    escudorunico: {
      tags: ['bastion'], class: 'guardiana', name: 'Escudo Rúnico', cost: 2, type: 'skill', rarity: 'uncommon', icon: 'shield',
      v: { block: 12 }, up: { block: 16 }, fx: [['block'], ['keepBlockIfStone']], text: 'Gana {block} de Bloqueo.\nSi tienes una Runa de Piedra, tu Bloqueo no se pierde al empezar el próximo turno.'
    },
    explosionr: {
      aim: 'all',   // Parche 3.2: área (objetivo: todos)
      tags: ['fuegorunico'], class: 'guardiana', name: 'Explosión Rúnica', cost: 2, type: 'attack', rarity: 'uncommon', icon: 'burst',
      v: { per: 3 }, up: { per: 5 }, fx: [['detonateAll']], text: 'Detona TODAS tus runas{dmgx}.\nInflige {per} de daño extra por cada una.'
    },
    maestria: {
      tags: ['ecos'], class: 'guardiana', name: 'Maestría Rúnica', cost: 3, type: 'power', rarity: 'rare', icon: 'book',
      v: { amt: 1 }, up: { cost: 2 }, fx: [['power', 'maestria']], text: 'Los pasivos de tus runas se activan dos veces.'
    },
    runaancestral: {
      tags: ['ecos'], class: 'guardiana', name: 'Runa Ancestral', cost: 2, type: 'skill', rarity: 'rare', icon: 'rune_ancestral',
      v: {}, up: { cost: 1 }, fx: [['engrave', 'ancestral']], text: 'Graba Ancestral.'
    },
    grangrabado: {
      tags: ['fuegorunico', 'ecos'], class: 'guardiana', name: 'Gran Grabado', cost: 1, type: 'skill', rarity: 'rare', icon: 'rune', exhaust: true,
      v: { exTxt: '\nAgotar.' }, up: { noExhaust: true, exTxt: '' }, fx: [['fillRunes']], text: 'Llena tus ranuras vacías con runas aleatorias.{exTxt}'
    },
    forjaeterna: {
      tags: ['bastion'], class: 'guardiana', name: 'Forja Eterna', cost: 2, type: 'power', rarity: 'rare', icon: 'shield',
      v: { amt: 2 }, up: { amt: 3 }, fx: [['power', 'forja']], text: 'Cada vez que Grabes una runa, gana {amt} de Bloqueo.'
    },

    // ================= INVOCADORA (class: 'invocadora') =================
    // Criaturas (combat.summons, máx. 3): actúan al FINAL de tu turno (izq. → der.) y reciben los golpes
    // enemigos (la más antigua primero; el daño sobrante no pasa a la Invocadora). Vínculo: +ataque a todas.
    golpevara: {
      class: 'invocadora', name: 'Golpe de Vara', cost: 1, type: 'attack', rarity: 'starter', icon: 'bolt',
      v: { dmg: 6 }, up: { dmg: 9 }, fx: [['attack']], text: 'Inflige {dmg} de daño.'
    },
    corteza: {
      class: 'invocadora', name: 'Corteza', cost: 1, type: 'skill', rarity: 'starter', icon: 'shield',
      v: { block: 5 }, up: { block: 8 }, fx: [['block']], text: 'Gana {block} de Bloqueo.'
    },
    llamarlobezno: {
      class: 'invocadora', name: 'Llamar Lobezno', cost: 2, type: 'skill', rarity: 'starter', icon: 'summon_lobezno',
      v: {}, up: { cost: 1 }, fx: [['summon', 'lobezno']], text: 'Invoca un Lobezno Espectral.'
    },
    ordenataque: {
      class: 'invocadora', name: 'Orden de Ataque', cost: 1, type: 'skill', rarity: 'starter', icon: 'summon',
      v: { draw: 0, drawTxt: '' }, up: { draw: 1, drawTxt: '\nRoba 1 carta.' }, fx: [['command'], ['draw']], text: 'Tus criaturas actúan ahora (además de al final del turno).{drawTxt}'
    },
    llamartreant: {
      tags: ['arboleda'], class: 'invocadora', name: 'Llamar Treant', cost: 3, type: 'skill', rarity: 'common', icon: 'summon_treant',
      v: {}, up: { cost: 2 }, fx: [['summon', 'treant']], text: 'Invoca un Treant Joven.'
    },
    llamarbuho: {
      tags: ['ciclo'], class: 'invocadora', name: 'Llamar Búho', cost: 2, type: 'skill', rarity: 'common', icon: 'summon_buho',
      v: {}, up: { cost: 1 }, fx: [['summon', 'buho']], text: 'Invoca un Búho Arcano.'
    },
    llamarhada: {
      tags: ['manada'], class: 'invocadora', name: 'Llamar Hada', cost: 2, type: 'skill', rarity: 'common', icon: 'summon_hada',
      v: {}, up: { cost: 1 }, fx: [['summon', 'hada']], text: 'Invoca un Hada de Espinas.'
    },
    manada: {
      tags: ['manada'], class: 'invocadora', name: 'Manada', cost: 1, type: 'attack', rarity: 'common', icon: 'claw',
      v: { dmg: 4, perSummon: 2 }, up: { perSummon: 3 }, fx: [['attack']], text: 'Inflige {dmg} de daño.\n+{perSummon} por cada criatura.'
    },
    savia: {
      tags: ['arboleda'], class: 'invocadora', name: 'Savia', cost: 1, type: 'skill', rarity: 'common', icon: 'heart',
      v: { sheal: 4, block: 4 }, up: { sheal: 6, block: 6 }, fx: [['healSummons'], ['block']], text: 'Cura {sheal} PV a todas tus criaturas.\nGana {block} de Bloqueo.'
    },
    raices: {
      tags: ['arboleda'], class: 'invocadora', name: 'Raíces', cost: 1, type: 'skill', rarity: 'common', icon: 'shield',
      v: { block: 7, draw: 1 }, up: { block: 10 }, fx: [['block'], ['drawIfFull']], text: 'Gana {block} de Bloqueo.\nSi tienes 3 criaturas, roba {draw}.'
    },
    zarpazo: {
      tags: ['manada'], class: 'invocadora', name: 'Zarpazo Guiado', cost: 1, type: 'attack', rarity: 'common', icon: 'claw',
      v: { dmg: 5 }, up: { dmg: 8 }, fx: [['attack'], ['strongest']], text: 'Inflige {dmg} de daño.\nTu criatura más fuerte ataca.'
    },
    brote: {
      tags: ['manada'], class: 'invocadora', name: 'Brote', cost: 0, type: 'skill', rarity: 'common', icon: 'leaf', exhaust: true,
      v: { bond: 1, exTxt: '\nAgotar.' }, up: { noExhaust: true, exTxt: '' }, fx: [['bondTurn']], text: 'Vínculo {bond} este turno.{exTxt}'
    },
    vinculosalvaje: {
      tags: ['manada'], class: 'invocadora', name: 'Vínculo Salvaje', cost: 1, type: 'power', rarity: 'uncommon', icon: 'leaf',
      v: { amt: 1 }, up: { amt: 2 }, fx: [['power', 'vinculo']], text: 'Vínculo {amt}.'
    },
    sacrificionat: {
      tags: ['ciclo'], class: 'invocadora', name: 'Sacrificio Natural', cost: 0, type: 'skill', rarity: 'uncommon', icon: 'heart',
      v: { energy: 2, draw: 2 }, up: { draw: 3 }, fx: [['releaseOldest']], text: 'Tu criatura más antigua se va:\ngana {energy} de Energía y roba {draw}.'
    },
    estampida: {
      aim: 'all',   // Parche 3.2: área (objetivo: todos)
      tags: ['manada'], class: 'invocadora', name: 'Estampida', cost: 2, type: 'attack', rarity: 'uncommon', icon: 'claw',
      v: { times: 2 }, up: { cost: 1 }, fx: [['summonsAttack']], text: 'Cada criatura ataca {times} veces ahora.'
    },
    murobestias: {
      tags: ['arboleda'], class: 'invocadora', name: 'Muro de Bestias', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'shield',
      v: { max: 20 }, up: { max: 30 }, fx: [['beastWall']], text: 'Gana Bloqueo igual a los PV de tus criaturas (máx. {max}).'
    },
    renacer: {
      tags: ['ciclo'], class: 'invocadora', name: 'Renacer', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'leaf', exhaust: true, needsDead: true,
      v: {}, up: { cost: 0 }, fx: [['revive']], text: 'Invoca de nuevo la última criatura que murió.\nAgotar.'
    },
    llamadadoble: {
      tags: ['manada', 'ciclo'], class: 'invocadora', name: 'Llamada Doble', cost: 3, type: 'skill', rarity: 'uncommon', icon: 'summon',
      v: {}, up: { cost: 2 }, fx: [['summonRandom', 2]], text: 'Invoca 2 criaturas comunes al azar.'
    },
    espinasbosque: {
      tags: ['arboleda'], class: 'invocadora', name: 'Espinas del Bosque', cost: 1, type: 'power', rarity: 'uncommon', icon: 'burst',
      v: { amt: 3 }, up: { amt: 5 }, fx: [['power', 'espinas']], text: 'Cuando el enemigo golpea a una criatura, recibe {amt} de daño.'
    },
    llamarespiritu: {
      tags: ['arboleda'], class: 'invocadora', name: 'Llamar Espíritu', cost: 3, type: 'skill', rarity: 'rare', icon: 'summon_espiritu',
      v: {}, up: { cost: 2 }, fx: [['summon', 'espiritu']], text: 'Invoca un Espíritu Ancestral.'
    },
    reybosque: {
      tags: ['arboleda'], class: 'invocadora', name: 'Rey del Bosque', cost: 3, type: 'power', rarity: 'rare', icon: 'crown',
      v: { amt: 1 }, up: { cost: 2 }, fx: [['power', 'rey']], text: 'Tus criaturas entran con el doble de PV.\nVínculo 1.'
    },
    coro: {
      tags: ['manada'], class: 'invocadora', name: 'Coro de la Arboleda', cost: 2, type: 'skill', rarity: 'rare', icon: 'summon', exhaust: true,
      v: { times: 3, exTxt: '\nAgotar.' }, up: { noExhaust: true, exTxt: '' }, fx: [['command', 3]], text: 'Todas tus criaturas actúan {times} veces.{exTxt}'
    },

    // ================= PALADÍN (class: 'paladin') =================
    // Juicio (en el enemigo): cada golpe de un Ataque te da 2 de Bloqueo por cada Juicio; baja 1 al final de su turno.
    // Fervor (pasiva): tus ataques infligen +1 por cada 10 % de PV que te falte. Inmaterial: el próximo golpe que
    // recibas este turno enemigo hace 0. Autodaño de sus cartas (op 'hurt'): ignora el Bloqueo y nunca te mata.
    golpesagrado: {
      class: 'paladin', name: 'Golpe Sagrado', cost: 1, type: 'attack', rarity: 'starter', icon: 'sword',
      v: { dmg: 6 }, up: { dmg: 9 }, fx: [['attack']], text: 'Inflige {dmg} de daño.'
    },
    escudofe: {
      class: 'paladin', name: 'Escudo de Fe', cost: 1, type: 'skill', rarity: 'starter', icon: 'shield',
      v: { block: 5 }, up: { block: 8 }, fx: [['block']], text: 'Gana {block} de Bloqueo.'
    },
    veredicto: {
      class: 'paladin', name: 'Veredicto', cost: 1, type: 'skill', rarity: 'starter', icon: 'scales',
      v: { judg: 2 }, up: { judg: 3 }, fx: [['judge']], text: 'Aplica {judg} de Juicio.'
    },
    penitencia: {
      class: 'paladin', name: 'Penitencia', cost: 0, type: 'skill', rarity: 'starter', icon: 'heart',
      v: { self: 4, energy: 1 }, up: { self: 3 }, fx: [['hurt'], ['energy']], text: 'Pierde {self} PV.\nGana {energy} de Energía.'
    },
    martillojuicio: {
      tags: ['juicio'], class: 'paladin', name: 'Martillo del Juicio', cost: 2, type: 'attack', rarity: 'common', icon: 'hammer',
      v: { dmg: 10, judg: 2 }, up: { dmg: 14 }, fx: [['attack'], ['judge']], text: 'Inflige {dmg} de daño.\nAplica {judg} de Juicio.'
    },
    castigo: {
      tags: ['juicio'], class: 'paladin', name: 'Castigo', cost: 1, type: 'attack', rarity: 'common', icon: 'sword',
      v: { dmg: 5, judgBonus: 5 }, up: { dmg: 7, judgBonus: 7 }, fx: [['attack']], text: 'Inflige {dmg} de daño.\n+{judgBonus} si el enemigo tiene Juicio.'
    },
    egida: {
      tags: ['egida', 'penitencia'], class: 'paladin', name: 'Égida', cost: 1, type: 'skill', rarity: 'common', icon: 'shield',
      v: { block: 7, low: 11 }, up: { block: 10, low: 15 }, fx: [['aegis']], text: 'Gana {block} de Bloqueo ({low} con menos del 50 % de tus PV).'
    },
    plegaria: {
      tags: ['penitencia'], class: 'paladin', name: 'Plegaria', cost: 1, type: 'skill', rarity: 'common', icon: 'sun',
      v: { heal: 4, draw: 1 }, up: { heal: 6 }, fx: [['healSelf'], ['draw']], text: 'Recupera {heal} PV.\nRoba {draw} {draw|carta|cartas}.'
    },
    sentencia: {
      tags: ['juicio'], class: 'paladin', name: 'Sentencia', cost: 1, type: 'attack', rarity: 'common', icon: 'scales',
      v: { per: 4 }, up: { per: 5 }, fx: [['sentence']], text: 'Inflige {per} de daño por cada Juicio del enemigo{dmgx}.'
    },
    cilicio: {
      tags: ['penitencia', 'egida'], class: 'paladin', name: 'Cilicio', cost: 1, type: 'skill', rarity: 'common', icon: 'shield',
      v: { self: 3, block: 10 }, up: { block: 14 }, fx: [['hurt'], ['block']], text: 'Pierde {self} PV.\nGana {block} de Bloqueo.'
    },
    golpeescudo: {
      tags: ['egida'], class: 'paladin', name: 'Golpe de Escudo', cost: 1, type: 'attack', rarity: 'common', icon: 'shield',
      v: { div: 2, part: 'la mitad de tu Bloqueo' }, up: { div: 1, part: 'tu Bloqueo' }, fx: [['shieldBash']], text: 'Inflige daño igual a {part}{dmgx} sin perderlo.'
    },
    luzpurif: {
      tags: ['egida'], class: 'paladin', name: 'Luz Purificadora', cost: 1, type: 'skill', rarity: 'common', icon: 'sun', exhaust: true,
      v: { draw: 1, exTxt: '\nAgotar.' }, up: { noExhaust: true, exTxt: '' }, fx: [['cleanse'], ['draw']], text: 'Quita tus estados negativos (Débil, Expuesto, cartas Silenciadas, Drenar y Silencio pendientes).\nRoba {draw} {draw|carta|cartas}.{exTxt}'
    },
    flagelacion: {
      tags: ['penitencia'], class: 'paladin', name: 'Flagelación', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'ghost',
      v: { self: 6 }, up: { self: 4 }, fx: [['hurt'], ['immaterial']], text: 'Pierde {self} PV.\nTe vuelves Inmaterial.'
    },
    martir: {
      tags: ['penitencia'], class: 'paladin', name: 'Mártir', cost: 2, type: 'attack', rarity: 'uncommon', icon: 'sun',
      v: { dmg: 12, fervorX: 1 }, up: { cost: 1 }, fx: [['attack']], text: 'Inflige {dmg} de daño.\nTu Fervor cuenta el doble.'
    },
    tribunal: {
      tags: ['juicio', 'egida'], class: 'paladin', name: 'Tribunal', cost: 2, type: 'skill', rarity: 'uncommon', icon: 'scales',
      v: { judg: 4, block: 8 }, up: { judg: 5, block: 11 }, fx: [['judge'], ['block']], text: 'Aplica {judg} de Juicio.\nGana {block} de Bloqueo.'
    },
    sangreconsagrada: {
      tags: ['penitencia', 'juicio'], class: 'paladin', name: 'Sangre Consagrada', cost: 1, type: 'power', rarity: 'uncommon', icon: 'heart',
      v: { amt: 1 }, up: { amt: 2 }, fx: [['power', 'sangre']], text: 'Cada vez que pierdas PV por tus cartas, aplica {amt} de Juicio.'
    },
    juramento: {
      tags: ['penitencia'], class: 'paladin', name: 'Juramento', cost: 1, type: 'power', rarity: 'uncommon', icon: 'medal',
      v: { amt: 1 }, up: { cost: 0 }, fx: [['power', 'juramento']], text: 'Al empezar tu turno, si tienes menos del 50 % de tus PV, gana {amt} de Energía.'
    },
    contricion: {
      tags: ['penitencia'], class: 'paladin', name: 'Contrición', cost: 'X', type: 'skill', rarity: 'uncommon', icon: 'heart', exhaust: true,
      v: { per: 3, gain: 2 }, up: { per: 2 }, fx: [['contrition']], text: 'Pierde {per}×X PV.\nEl próximo turno, gana {gain}×X de Energía.\nAgotar.'
    },
    escudosagrado: {
      tags: ['egida'], class: 'paladin', name: 'Escudo Sagrado', cost: 2, type: 'skill', rarity: 'uncommon', icon: 'shield',
      v: { block: 14 }, up: { block: 18 }, fx: [['block'], ['keepBlock']], text: 'Gana {block} de Bloqueo.\nTu Bloqueo no se pierde al empezar tu próximo turno.'
    },
    iradivina: {
      tags: ['penitencia'], class: 'paladin', name: 'Ira Divina', cost: 3, type: 'attack', rarity: 'rare', icon: 'sun', lowHpFree: 0.3,
      v: { dmg: 30 }, up: { dmg: 40 }, fx: [['attack']], text: 'Inflige {dmg} de daño.\nCon menos del 30 % de tus PV, cuesta 0.'
    },
    ascensioncel: {
      tags: ['penitencia'], class: 'paladin', name: 'Ascensión Celestial', cost: 2, type: 'power', rarity: 'rare', icon: 'ghost',
      v: { amt: 1 }, up: { cost: 1 }, fx: [['power', 'ascension']], text: 'Una vez por combate, al llegar a 0 PV te quedas con 1 PV y te vuelves Inmaterial.'
    },
    juiciofinal: {
      aim: 'all',   // Parche 3.2: área (objetivo: todos)
      tags: ['juicio'], class: 'paladin', name: 'Juicio Final', cost: 2, type: 'attack', rarity: 'rare', icon: 'scales',
      v: { per: 8 }, up: { per: 10 }, fx: [['finalJudgment']], text: 'Inflige {per} de daño por cada Juicio del enemigo{dmgx} y lo consume todo.'
    },

    // ================= NEUTRALES (class: 'neutral', para todos los personajes) =================
    // Salen en recompensas y tienda con un 10% de probabilidad por hueco (su rareza, la normal).
    improvisar: {
      class: 'neutral', name: 'Improvisar', cost: 0, type: 'skill', rarity: 'common', icon: 'deck',
      v: { draw: 2 }, up: { draw: 3 }, fx: [['draw'], ['discardChoice']], text: 'Roba {draw} {draw|carta|cartas} y descarta 1 a tu elección.'
    },
    segundoaliento: {
      class: 'neutral', name: 'Segundo Aliento', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'shield',
      v: { per: 5 }, up: { per: 7 }, fx: [['secondWind']], text: 'Agota todas las cartas que no sean de Ataque de tu mano.\nGana {per} de Bloqueo por cada una.'
    },
    sacrificio: {
      class: 'neutral', name: 'Sacrificio', cost: 0, type: 'skill', rarity: 'common', icon: 'heart', exhaust: true,
      v: { self: 3, energy: 2 }, up: { self: 2 }, fx: [['sacrifice'], ['energy']], text: 'Pierde {self} PV.\n+{energy} Energía.\nAgotar.'
    },
    golpesuerte: {
      class: 'neutral', name: 'Golpe de Suerte', cost: 1, type: 'attack', rarity: 'common', icon: 'burst',
      v: { lo: 4, hi: 14 }, up: { lo: 7, hi: 17 }, fx: [['luckyHit']], text: 'Inflige entre {lo} y {hi} de daño.'
    },
    planificar: {
      class: 'neutral', name: 'Planificar', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'book',
      v: {}, up: { cost: 0 }, fx: [['retainAll']], text: 'Conserva toda tu mano este turno.'
    },
    botin: {
      class: 'neutral', name: 'Botín', cost: 1, type: 'skill', rarity: 'common', icon: 'coin', exhaust: true,
      v: { gold: 20 }, up: { gold: 30 }, fx: [['loot']], text: 'Si ganas este combate, +{gold} de oro.\nAgotar.'
    },
    ultimorecurso: {
      class: 'neutral', name: 'Último Recurso', cost: 1, type: 'attack', rarity: 'uncommon', icon: 'skull',
      v: { div: 3, frac: 'un tercio' }, up: { div: 2, frac: 'la mitad' }, fx: [['lastStand']], text: 'Inflige daño igual a {frac} de tus PV perdidos{dmgx}.'
    },
    trascender: {
      class: 'neutral', name: 'Trascender', cost: 2, type: 'skill', rarity: 'rare', icon: 'up', exhaust: true,
      v: {}, up: { cost: 1 }, fx: [['transcend']], text: 'Mejora PERMANENTEMENTE todas las cartas de tu mano.\nAgotar.'
    },

    // ================= RECOMPENSAS DE LOGRO (Parche 2.7) =================
    // Bloqueadas hasta conseguir su logro (REWARD_LOCK más abajo; el motor las filtra con run.unlocked).
    combustionesp: {
      tags: ['brasa', 'ceniza'], class: 'piromago', name: 'Combustión Espontánea', cost: 0, type: 'attack', rarity: 'rare', icon: 'burst', exhaust: true,
      v: { mult: 4 }, up: { mult: 5 }, fx: [['consumeBurn']], text: 'Inflige daño igual a {mult}× la Quemadura del enemigo{dmgx} y consúmela toda.\nAgotar.'
    },
    sinfonia: {
      tags: ['ciclo'], class: 'invocadora', name: 'Sinfonía Salvaje', cost: 1, type: 'skill', rarity: 'rare', icon: 'summon',
      v: {}, up: { cost: 0 }, fx: [['symphony']], text: 'Sacrifica todas tus criaturas.\nPor cada una: roba 1 carta y gana 1 de Energía.'
    },
    auraarcana: {
      class: 'neutral', name: 'Aura Arcana', cost: 2, type: 'power', rarity: 'legendary', icon: 'prism',
      v: { amt: 2 }, up: { cost: 1 }, fx: [['power', 'aura']], text: 'Tus ataques infligen +{amt}.\nTus cartas que dan Bloqueo dan +{amt} más.'
    },
    cataclismo: {
      aim: 'all',   // Parche 3.2: área (objetivo: todos)
      class: 'neutral', name: 'Cataclismo', cost: 3, type: 'attack', rarity: 'legendary', icon: 'fireball',
      v: { dmg: 50, st: 6 }, up: { dmg: 60 }, fx: [['attack'], ['cataclysm']], text: 'Inflige {dmg} de daño.\nAdemás, según tu personaje: 6 de Quemadura · 6 de Escarcha · Graba una Runa de Fuego · Invoca un Lobezno Espectral · 6 de Juicio.'
    },
    // Criomante (Parche 2.7)
    corazonhielo: {
      tags: ['muralla'], class: 'criomante', name: 'Corazón de Hielo', cost: 1, type: 'attack', rarity: 'rare', icon: 'shard',
      v: {}, up: { cost: 0 }, fx: [['iceHeart']], text: 'Inflige daño igual a tu Bloqueo + Escudo de Hielo{dmgx} y piérdelos.\nEl próximo turno no puedes ganar Bloqueo ni Escudo de Hielo.'
    },

    // ---------- Maldiciones ----------
    escalofrio: {
      name: 'Escalofrío', class: 'curse', cost: null, type: 'curse', rarity: 'curse', icon: 'snow', unplayable: true,
      v: {}, fx: [],
      text: 'Injugable.\nOcupa espacio en tu mano.'
    },
    // Acto III: maldición de tinta (de combate con inkCurse; permanente con «El Pacto del Abismo»)
    garabato: {
      name: 'Garabato', class: 'curse', cost: null, type: 'curse', rarity: 'curse', icon: 'inkcard', unplayable: true, onDrawEnergy: 1,
      v: {}, fx: [],
      text: 'Injugable.\nAl robarla, pierdes 1 de Energía y se Agota.'
    },
    // ---------- Sendas (Parche 3.1): cartas iniciales de cada senda (★) ----------
    puntofusion: {
      name: 'Punto de Fusión', class: 'piromago', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'thermo', tags: ['horno'],
      v: { bonus: 3 }, up: { bonus: 5 }, fx: [['fusion']],
      text: 'Este turno no te Sobrecalientas y tus Ataques infligen +{bonus} de daño.\nAl final del turno pierdes toda tu Temperatura.'
    },
    pirafuneraria: {
      name: 'Pira Funeraria', class: 'piromago', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'urn', tags: ['ceniza', 'brasa'],
      v: { plus: 3 }, up: { plus: 5 }, fx: [['pyreChoice']],
      text: 'Agota 1 carta de tu mano y aplica Quemadura igual a 2× su coste +{plus}.'
    },
    incendioctrl: {
      name: 'Incendio Controlado', class: 'piromago', cost: 2, type: 'power', rarity: 'rare', icon: 'flame', tags: ['brasa'],
      v: { amt: 1, at: 10 }, up: { cost: 1 }, fx: [['power', 'incendio']],
      text: 'Al final de tu turno, si el enemigo tiene {at}+ Quemadura, sufre su Quemadura una vez más.'
    },
    permafrostp: {
      name: 'Permafrost', class: 'criomante', cost: 1, type: 'power', rarity: 'uncommon', icon: 'wall', tags: ['muralla'],
      v: { amt: 1 }, up: { cost: 0 }, fx: [['power', 'permahielo']],
      text: 'Tu Escudo de Hielo ya no se derrite.'
    },
    prismaice: {
      name: 'Prisma de Hielo', class: 'criomante', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'prism', tags: ['esquirlas'],
      v: { draw: 1 }, up: { cost: 0 }, fx: [['prismShatter'], ['draw']],
      text: 'Tu próximo Fragmentar este turno no consume la Escarcha.\nRoba {draw} {draw|carta|cartas}.'
    },
    corazonpolar: {
      name: 'Corazón Polar', class: 'criomante', cost: 3, type: 'power', rarity: 'rare', icon: 'heart', tags: ['glaciar'],
      v: { amt: 15 }, up: { amt: 20 }, fx: [['power', 'polar']],
      text: 'Cada vez que Congelas al enemigo, sufre {amt} de daño.'
    },
    sobrecargarun: {
      name: 'Sobrecarga Rúnica', class: 'guardiana', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'rune_fuego', tags: ['fuegorunico'],
      v: { times: 2 }, up: { cost: 0 }, fx: [['overload']],
      text: 'Detona tu runa más reciente dos veces.'
    },
    circuloperf: {
      name: 'Círculo Perfecto', class: 'guardiana', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'rune', tags: ['ecos'],
      v: { energy: 2, draw: 2 }, up: { energy: 3, draw: 3 }, fx: [['perfectCircle']],
      text: 'Si tus ranuras están llenas con runas distintas, gana {energy} de Energía y roba {draw} cartas.'
    },
    golemrunas: {
      name: 'Gólem de Runas', class: 'guardiana', cost: 2, type: 'power', rarity: 'rare', icon: 'rune_piedra', tags: ['bastion'],
      v: { amt: 1, need: 2 }, up: { cost: 1 }, fx: [['power', 'golemr']],
      text: 'Tu Bloqueo no se pierde mientras tengas {need}+ runas de Piedra.'
    },
    almabosque: {
      name: 'Alma del Bosque', class: 'invocadora', cost: 1, type: 'power', rarity: 'uncommon', icon: 'leaf', tags: ['ciclo'],
      v: { amt: 1, block: 3 }, up: { cost: 0 }, fx: [['power', 'alma']],
      text: 'Cuando una criatura muere, roba 1 carta y gana {block} de Bloqueo.'
    },
    saviaeterna: {
      name: 'Savia Eterna', class: 'invocadora', cost: 2, type: 'power', rarity: 'uncommon', icon: 'drop', tags: ['arboleda'],
      v: { amt: 2 }, up: { amt: 3 }, fx: [['power', 'saviae']],
      text: 'Al final de tu turno, tus criaturas recuperan {amt} PV.'
    },
    madrebosque: {
      name: 'Madre del Bosque', class: 'invocadora', cost: 3, type: 'power', rarity: 'rare', icon: 'summon_lobezno', tags: ['manada'],
      v: { amt: 1 }, up: { cost: 2 }, fx: [['power', 'madre']],
      text: 'Al empezar tu turno, si tienes menos de 3 criaturas, invoca un Lobezno Espectral.'
    },
    llamavotiva: {
      name: 'Llama Votiva', class: 'paladin', cost: 1, type: 'power', rarity: 'uncommon', icon: 'sun', tags: ['penitencia'],
      v: { amt: 1, per: 7 }, up: { per: 5 }, fx: [['votive']],
      text: '+1 de Fervor permanente por cada {per} PV que pierdas por tus cartas este combate.'
    },
    castillofe: {
      name: 'Castillo de Fe', class: 'paladin', cost: 2, type: 'power', rarity: 'uncommon', icon: 'shield', tags: ['egida'],
      v: { amt: 1 }, up: { cost: 1 }, fx: [['power', 'castillo']],
      text: 'Tu Bloqueo no se pierde al empezar tu turno.'
    },
    sacrificiosag: {
      name: 'Sacrificio Sagrado', class: 'paladin', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'drop', tags: ['penitencia', 'juicio'],
      v: { self: 5, judg: 3, block: 8 }, up: { self: 4 }, fx: [['hurt'], ['judge'], ['block']],
      text: 'Pierde {self} PV.\nAplica {judg} de Juicio.\nGana {block} de Bloqueo.'
    },
    // ---------- Sendas (Parche 3.1): cartas nuevas ----------
    // Piromago
    ascuasgemelas: {
      name: 'Ascuas Gemelas', class: 'piromago', cost: 1, type: 'attack', rarity: 'common', icon: 'spark', tags: ['brasa'],
      v: { dmg: 4, hits: 2, burn: 1 }, up: { dmg: 5 }, fx: [['hitsBurn']],
      text: 'Inflige {dmg} de daño 2 veces.\nCada golpe aplica {burn} Quemadura.'
    },
    termostato: {
      name: 'Termostato', class: 'piromago', cost: 0, type: 'skill', rarity: 'common', icon: 'thermo', tags: ['horno'],
      v: { at: 5, draw: 2, temp: 2 }, up: { draw: 3, temp: 3 }, fx: [['thermostat']],
      text: 'Si tienes {at}+ Temperatura, roba {draw} cartas.\nSi no, +{temp} Temperatura.'
    },
    braserovivo: {
      name: 'Brasero Vivo', class: 'piromago', cost: 1, type: 'skill', rarity: 'common', icon: 'campfire', tags: ['brasa'],
      v: { block: 6, max: 8 }, up: { block: 9 }, fx: [['blockBurn']],
      text: 'Gana {block} de Bloqueo, +1 por cada 2 de Quemadura del enemigo (máx. +{max}).'
    },
    cenizasviento: {
      name: 'Cenizas al Viento', class: 'piromago', cost: 1, type: 'attack', rarity: 'uncommon', icon: 'cloud', tags: ['ceniza'],
      v: { per: 3, max: 30 }, up: { per: 4, max: 40 }, fx: [['ashes']],
      text: 'Inflige {per} de daño por cada carta Agotada este combate{dmgx} (máx. {max}).'
    },
    ignicontotal: {
      name: 'Ignición Total', class: 'piromago', cost: 1, type: 'attack', rarity: 'rare', icon: 'burst', tags: ['ceniza'],
      v: { dmg: 6, burn: 2 }, up: { dmg: 8, burn: 3 }, fx: [['totalIgnition']],
      text: 'Agota tu mano. Por cada carta, inflige {dmg} de daño y aplica {burn} Quemadura.'
    },
    // Criomante
    escarchafina: {
      name: 'Escarcha Fina', class: 'criomante', cost: 0, type: 'skill', rarity: 'common', icon: 'snow', tags: ['glaciar'],
      v: { frost: 2, at: 5, draw: 1 }, up: { frost: 3 }, fx: [['frost'], ['drawIfFrostAt']],
      text: 'Aplica {frost} Escarcha.\nSi el enemigo tiene {at}+ Escarcha, roba {draw} {draw|carta|cartas}.'
    },
    tempestadagujas: {
      aim: 'all',   // Parche 3.2: área (objetivo: todos)
      name: 'Tempestad de Agujas', class: 'criomante', cost: 1, type: 'attack', rarity: 'common', icon: 'shard', tags: ['esquirlas'],
      v: { dmg: 2, hits: 4 }, up: { dmg: 3 }, fx: [['attack']],
      text: 'Inflige {dmg} de daño 4 veces.'
    },
    capanieve: {
      name: 'Capa de Nieve', class: 'criomante', cost: 1, type: 'skill', rarity: 'common', icon: 'snow', tags: ['muralla', 'glaciar'],
      v: { ice: 5, frost: 1 }, up: { ice: 8, frost: 2 }, fx: [['ice'], ['frost']],
      text: 'Gana {ice} de Escudo de Hielo.\nAplica {frost} Escarcha.'
    },
    golpeglacial: {
      name: 'Golpe Glacial', class: 'criomante', cost: 2, type: 'attack', rarity: 'common', icon: 'bolt', tags: ['glaciar'],
      v: { dmg: 12, frozenX: 1 }, up: { dmg: 16 }, fx: [['attack']],
      text: 'Inflige {dmg} de daño.\nEl doble si el enemigo está Congelado.'
    },
    vientocortante: {
      name: 'Viento Cortante', class: 'criomante', cost: 1, type: 'attack', rarity: 'common', icon: 'shard', tags: ['esquirlas'],
      v: { dmg: 6, per: 1 }, up: { dmg: 9 }, fx: [['attack'], ['shatter']],
      text: 'Inflige {dmg} de daño.\nFragmentar: {per} de daño por cada Escarcha del enemigo.'
    },
    escarchaperpetua: {
      name: 'Escarcha Perpetua', class: 'criomante', cost: 1, type: 'power', rarity: 'uncommon', icon: 'snow', tags: ['glaciar'],
      v: { amt: 3 }, up: { amt: 5 }, fx: [['power', 'perpetua']],
      text: 'Al Congelar al enemigo, conserva {amt} de Escarcha.'
    },
    fortalezahelada: {
      name: 'Fortaleza Helada', class: 'criomante', cost: 2, type: 'skill', rarity: 'uncommon', icon: 'wall', tags: ['muralla', 'glaciar'],
      v: { mult: 2, max: 30 }, up: { mult: 3, max: 40 }, fx: [['iceFromFrost']],
      text: 'Gana Escudo de Hielo igual a {mult}× la Escarcha del enemigo (máx. {max}).'
    },
    contraataquegel: {
      name: 'Contraataque Gélido', class: 'criomante', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'shield', tags: ['muralla'],
      v: { ice: 8 }, up: { ice: 11 }, fx: [['ice'], ['iceCounter']],
      text: 'Gana {ice} de Escudo de Hielo.\nSi el enemigo te ataca este turno, recibe la mitad de tu Escudo de Hielo restante.'
    },
    lluviaesquirlas: {
      name: 'Lluvia de Esquirlas', class: 'criomante', cost: 'X', type: 'attack', rarity: 'uncommon', icon: 'shard', tags: ['esquirlas', 'glaciar'],
      v: { dmg: 4, frost: 1 }, up: { dmg: 5 }, fx: [['xHitsFrost']],
      text: 'Inflige {dmg} de daño X veces.\nCada golpe aplica {frost} Escarcha.'
    },
    ventiscainterior: {
      name: 'Ventisca Interior', class: 'criomante', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'snow', tags: ['muralla', 'glaciar'],
      v: { div: 3 }, up: { div: 2 }, fx: [['blockToFrost']],
      text: 'Convierte tu Bloqueo en Escarcha: 1 por cada {div} de Bloqueo.'
    },
    glaciareterno: {
      name: 'Glaciar Eterno', class: 'criomante', cost: 2, type: 'skill', rarity: 'rare', icon: 'wall', tags: ['muralla'], exhaust: true,
      v: { exTxt: '\nAgotar.' }, up: { noExhaust: true, exTxt: '' }, fx: [['iceDouble']],
      text: 'Duplica tu Escudo de Hielo.{exTxt}'
    },
    ataudhielo: {
      name: 'Ataúd de Hielo', class: 'criomante', cost: 1, type: 'skill', rarity: 'rare', icon: 'snow', tags: ['glaciar'], exhaust: true,
      v: { exTxt: '\nAgotar.' }, up: { noExhaust: true, exTxt: '' }, fx: [['coffin']],
      text: 'Si el enemigo está Congelado, sigue Congelado un turno más (una vez por congelación).{exTxt}'
    },
    // Guardiana
    martillazo: {
      name: 'Martillazo', class: 'guardiana', cost: 2, type: 'attack', rarity: 'common', icon: 'hammer', tags: ['fuegorunico'],
      v: { dmg: 16, fireBonus: 7 }, up: { dmg: 21, fireBonus: 9 }, fx: [['attack']],
      text: 'Inflige {dmg} de daño.\n+{fireBonus} si tienes una runa de Fuego.'
    },
    golpegrabado: {
      name: 'Golpe Grabado', class: 'guardiana', cost: 1, type: 'attack', rarity: 'common', icon: 'rune', tags: ['ecos'],
      v: { dmg: 6 }, up: { dmg: 8 }, fx: [['attack'], ['inscribe']],
      text: 'Inflige {dmg} de daño.\nGraba una runa aleatoria.'
    },
    chisparunica: {
      name: 'Chispa Rúnica', class: 'guardiana', cost: 0, type: 'attack', rarity: 'common', icon: 'spark', tags: ['ecos'],
      v: { per: 3 }, up: { per: 4 }, fx: [['runeSpark']],
      text: 'Inflige {per} de daño por cada runa grabada{dmgx}.'
    },
    tallarapida: {
      name: 'Talla Rápida', class: 'guardiana', cost: 0, type: 'skill', rarity: 'common', icon: 'rune_piedra', tags: ['bastion'], exhaust: true,
      v: { exTxt: '\nAgotar.' }, up: { noExhaust: true, exTxt: '' }, fx: [['engrave', 'piedra']],
      text: 'Graba Piedra.{exTxt}'
    },
    glifodefensivo: {
      name: 'Glifo Defensivo', class: 'guardiana', cost: 1, type: 'skill', rarity: 'common', icon: 'shield', tags: ['bastion'],
      v: { block: 5, per: 3 }, up: { block: 8, per: 4 }, fx: [['stoneBlock']],
      text: 'Gana {block} de Bloqueo, +{per} por cada runa de Piedra.'
    },
    cinceldoble: {
      name: 'Cincel Doble', class: 'guardiana', cost: 1, type: 'skill', rarity: 'common', icon: 'rune', tags: ['ecos'],
      v: {}, up: { cost: 0 }, fx: [['doubleChisel']],
      text: 'Graba 2 runas aleatorias de tipos distintos.'
    },
    martilloardiente: {
      name: 'Martillo Ardiente', class: 'guardiana', cost: 1, type: 'attack', rarity: 'uncommon', icon: 'hammer', tags: ['fuegorunico'],
      v: { dmg: 9 }, up: { dmg: 13 }, fx: [['attack'], ['detonateFire']],
      text: 'Inflige {dmg} de daño.\nSi tienes una runa de Fuego, la Detona.'
    },
    canteraviva: {
      name: 'Cantera Viva', class: 'guardiana', cost: 1, type: 'power', rarity: 'uncommon', icon: 'rune_piedra', tags: ['bastion', 'fuegorunico'],
      v: { amt: 1 }, up: { cost: 0 }, fx: [['power', 'cantera']],
      text: 'Cada vez que una runa Detona, Graba Piedra (si hay una ranura libre).'
    },
    avalancharunica: {
      aim: 'all',   // Parche 3.2: área (objetivo: todos)
      name: 'Avalancha Rúnica', class: 'guardiana', cost: 2, type: 'attack', rarity: 'uncommon', icon: 'burst', tags: ['fuegorunico'],
      v: { per: 6 }, up: { per: 8 }, fx: [['runeAvalanche']],
      text: 'Inflige {per} de daño por cada runa que haya Detonado este combate{dmgx}.'
    },
    guardiarunica: {
      name: 'Guardia Rúnica', class: 'guardiana', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'rune_piedra', tags: ['bastion'],
      v: { block: 4 }, up: { block: 7 }, fx: [['block'], ['stonePassives']],
      text: 'Gana {block} de Bloqueo.\nActiva el pasivo de tus runas de Piedra.'
    },
    cicloeterno: {
      name: 'Ciclo Eterno', class: 'guardiana', cost: 3, type: 'power', rarity: 'rare', icon: 'rune_fuego', tags: ['fuegorunico'],
      v: { amt: 1 }, up: { cost: 2 }, fx: [['power', 'cicloe']],
      text: 'Cada runa que Detona se vuelve a Grabar al final de tu turno.'
    },
    palabrapoder: {
      name: 'Palabra de Poder', class: 'guardiana', cost: 2, type: 'skill', rarity: 'rare', icon: 'book', tags: ['ecos'], exhaust: true,
      v: { amt: 3 }, up: { cost: 1 }, fx: [['runePowerUp']],
      text: '+{amt} Potencia de runa este combate.\nAgotar.'
    },
    grabadoprofundo: {
      name: 'Grabado Profundo', class: 'guardiana', cost: 1, type: 'power', rarity: 'rare', icon: 'rune_fuego', tags: ['fuegorunico', 'ecos'],
      v: { amt: 3 }, up: { amt: 5 }, fx: [['power', 'grabado']],
      text: 'El pasivo de tus runas de Fuego inflige +{amt} de daño.'
    },
    // Invocadora
    aullido: {
      name: 'Aullido', class: 'invocadora', cost: 1, type: 'skill', rarity: 'common', icon: 'claw', tags: ['manada'],
      v: { bond: 2, draw: 1 }, up: { bond: 3 }, fx: [['bondTurn'], ['draw']],
      text: 'Tus criaturas atacan +{bond} este turno.\nRoba {draw} {draw|carta|cartas}.'
    },
    semillac: {
      name: 'Semilla', class: 'invocadora', cost: 0, type: 'skill', rarity: 'common', icon: 'leaf', tags: ['manada', 'ciclo'], exhaust: true,
      v: { less: 3, exTxt: '\nAgotar.' }, up: { noExhaust: true, exTxt: '' }, fx: [['summonWeak', 'lobezno']],
      text: 'Invoca un Lobezno Espectral con {less} PV menos.{exTxt}'
    },
    zarza: {
      name: 'Zarza', class: 'invocadora', cost: 1, type: 'skill', rarity: 'common', icon: 'leaf', tags: ['arboleda'],
      v: { block: 7, sgain: 2 }, up: { block: 11, sgain: 3 }, fx: [['block'], ['summonsGain']],
      text: 'Gana {block} de Bloqueo.\nTus criaturas ganan {sgain} PV.'
    },
    mordiscomanada: {
      name: 'Mordisco de la Manada', class: 'invocadora', cost: 1, type: 'attack', rarity: 'common', icon: 'claw', tags: ['manada'],
      v: { dmg: 3, perWolf: 3 }, up: { dmg: 4, perWolf: 4 }, fx: [['attack']],
      text: 'Inflige {dmg} de daño, +{perWolf} por cada Lobezno Espectral.'
    },
    escudocorteza: {
      name: 'Escudo de Corteza', class: 'invocadora', cost: 1, type: 'skill', rarity: 'common', icon: 'shield', tags: ['arboleda'],
      v: { sgain: 10 }, up: { sgain: 14 }, fx: [['oldestGain']],
      text: 'Tu criatura más antigua gana {sgain} PV.'
    },
    hojarasca: {
      name: 'Hojarasca', class: 'invocadora', cost: 1, type: 'skill', rarity: 'common', icon: 'leaf', tags: ['arboleda'],
      v: { block: 9 }, up: { block: 13 }, fx: [['block'], ['summonIfNone', 'hada']],
      text: 'Gana {block} de Bloqueo.\nSi no tienes criaturas, invoca un Hada de Espinas.'
    },
    criarapida: {
      name: 'Cría Rápida', class: 'invocadora', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'summon', tags: ['manada'], freeIfNoSummons: true,
      v: {}, up: { cost: 0 }, fx: [['summonRandom', 1]],
      text: 'Invoca una criatura común al azar.\nCuesta 0 si no tienes ninguna.'
    },
    ofrenda: {
      name: 'Ofrenda', class: 'invocadora', cost: 0, type: 'skill', rarity: 'uncommon', icon: 'drop', tags: ['ciclo'],
      v: { mult: 4 }, up: { mult: 6 }, fx: [['offering']],
      text: 'Sacrifica tu criatura con menos PV: inflige {mult}× su ataque.'
    },
    vinculoancestral: {
      name: 'Vínculo Ancestral', class: 'invocadora', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'leaf', tags: ['manada'],
      v: { bond: 2, bondFull: 3 }, up: { bond: 3, bondFull: 4 }, fx: [['bondTurnFull']],
      text: 'Vínculo {bond} este turno ({bondFull} si tienes 3 criaturas).'
    },
    pactoraices: {
      name: 'Pacto de Raíces', class: 'invocadora', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'summon_treant', tags: ['ciclo', 'arboleda'],
      v: {}, up: { cost: 0 }, fx: [['rootPact']],
      text: 'Tu criatura más antigua se va e invocas un Treant Joven.'
    },
    raizprofunda: {
      name: 'Raíz Profunda', class: 'invocadora', cost: 1, type: 'power', rarity: 'uncommon', icon: 'leaf', tags: ['arboleda'],
      v: { amt: 1 }, up: { amt: 2 }, fx: [['power', 'raiz']],
      text: 'Tus criaturas reciben {amt} de daño menos por golpe.'
    },
    ordenferoz: {
      name: 'Orden Feroz', class: 'invocadora', cost: 1, type: 'attack', rarity: 'uncommon', icon: 'claw', tags: ['manada'],
      v: { times: 2 }, up: { times: 3 }, fx: [['strongestN']],
      text: 'Tu criatura más fuerte ataca {times} veces.'
    },
    ciclovida: {
      name: 'Ciclo de la Vida', class: 'invocadora', cost: 2, type: 'skill', rarity: 'rare', icon: 'hourglass', tags: ['ciclo'], exhaust: true,
      v: { atk: 2 }, up: { cost: 1 }, fx: [['lifeCycle']],
      text: 'Sacrifica todas tus criaturas y vuelve a invocarlas con los PV completos y +{atk} de ataque este combate.\nAgotar.'
    },
    rugidoprimigenio: {
      name: 'Rugido Primigenio', class: 'invocadora', cost: 2, type: 'attack', rarity: 'rare', icon: 'claw', tags: ['manada'],
      v: { dmg: 7, bond: 3 }, up: { dmg: 9 }, fx: [['attack'], ['roar']],
      text: 'Inflige {dmg} de daño.\nTodas tus criaturas atacan con Vínculo +{bond}.'
    },
    // Paladín
    golpejusto: {
      name: 'Golpe Justo', class: 'paladin', cost: 1, type: 'attack', rarity: 'common', icon: 'hammer', tags: ['juicio'],
      v: { dmg: 6, judg: 1 }, up: { dmg: 8 }, fx: [['attack'], ['judge']],
      text: 'Inflige {dmg} de daño.\nAplica {judg} de Juicio.'
    },
    votodolor: {
      name: 'Voto de Dolor', class: 'paladin', cost: 0, type: 'skill', rarity: 'common', icon: 'drop', tags: ['penitencia'],
      v: { self: 2, draw: 2 }, up: { draw: 3 }, fx: [['hurt'], ['draw']],
      text: 'Pierde {self} PV.\nRoba {draw} cartas.'
    },
    baluarte: {
      name: 'Baluarte', class: 'paladin', cost: 2, type: 'skill', rarity: 'common', icon: 'shield', tags: ['egida', 'juicio'],
      v: { block: 12, judg: 1 }, up: { block: 16 }, fx: [['block'], ['judge']],
      text: 'Gana {block} de Bloqueo.\nAplica {judg} de Juicio.'
    },
    embate: {
      name: 'Embate', class: 'paladin', cost: 1, type: 'attack', rarity: 'common', icon: 'sword', tags: ['juicio'],
      v: { dmg: 4, hits: 2 }, up: { dmg: 6 }, fx: [['attack']],
      text: 'Inflige {dmg} de daño 2 veces.'
    },
    oracioncombate: {
      name: 'Oración de Combate', class: 'paladin', cost: 1, type: 'skill', rarity: 'common', icon: 'sun', tags: ['penitencia'],
      v: { block: 7, energy: 1 }, up: { block: 11 }, fx: [['block'], ['prayerEnergy']],
      text: 'Gana {block} de Bloqueo.\nSi has perdido PV este turno, gana {energy} de Energía.'
    },
    golpecontrito: {
      name: 'Golpe Contrito', class: 'paladin', cost: 1, type: 'attack', rarity: 'common', icon: 'hammer', tags: ['penitencia'],
      v: { dmg: 9, self: 2 }, up: { dmg: 13 }, fx: [['attack'], ['hurt']],
      text: 'Inflige {dmg} de daño.\nPierde {self} PV.'
    },
    fefirme: {
      name: 'Fe Firme', class: 'paladin', cost: 1, type: 'skill', rarity: 'common', icon: 'shield', tags: ['juicio', 'egida'],
      v: { block: 5, judg: 1 }, up: { block: 8 }, fx: [['block'], ['judgeIfJudged']],
      text: 'Gana {block} de Bloqueo.\nSi el enemigo ya tiene Juicio, aplica {judg} más.'
    },
    martilloluz: {
      name: 'Martillo de Luz', class: 'paladin', cost: 2, type: 'attack', rarity: 'uncommon', icon: 'hammer', tags: ['egida'],
      v: { dmg: 10, blockDiv: 3 }, up: { dmg: 14, blockDiv: 2 }, fx: [['attack']],
      text: 'Inflige {dmg} de daño (+1 por cada {blockDiv} de Bloqueo que tengas).'
    },
    penitente: {
      name: 'Penitente', class: 'paladin', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'book', tags: ['penitencia'],
      v: { draw: 3, self: 5 }, up: { self: 4 }, fx: [['penitent']],
      text: 'Si tienes más del 50 % de tus PV, pierde {self} PV.\nRoba {draw} cartas.'
    },
    escudoreflejo: {
      name: 'Escudo Reflejo', class: 'paladin', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'mirror', tags: ['egida', 'juicio'],
      v: { block: 8, judg: 2 }, up: { block: 11 }, fx: [['block'], ['judgMirror']],
      text: 'Gana {block} de Bloqueo.\nSi el enemigo te ataca este turno, recibe {judg} de Juicio.'
    },
    expiacion: {
      name: 'Expiación', class: 'paladin', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'heart', tags: ['juicio'], exhaust: true,
      v: { mult: 2 }, up: { mult: 3 }, fx: [['atone']],
      text: 'Recupera PV igual a {mult}× el Juicio del enemigo.\nAgotar.'
    },
    muroplegarias: {
      name: 'Muro de Plegarias', class: 'paladin', cost: 2, type: 'skill', rarity: 'uncommon', icon: 'wall', tags: ['egida'],
      v: { block: 10, heal: 3 }, up: { block: 14, heal: 5 }, fx: [['block'], ['healSelf']],
      text: 'Gana {block} de Bloqueo.\nRecupera {heal} PV.'
    },
    avatarluz: {
      name: 'Avatar de la Luz', class: 'paladin', cost: 3, type: 'power', rarity: 'rare', icon: 'sun', tags: ['penitencia'],
      v: { amt: 1 }, up: { cost: 2 }, fx: [['power', 'avatar']],
      text: 'Tu Fervor cuenta el doble.'
    },
    juiciohierro: {
      name: 'Juicio de Hierro', class: 'paladin', cost: 2, type: 'skill', rarity: 'rare', icon: 'scales', tags: ['egida', 'juicio'],
      v: { div: 4 }, up: { div: 3 }, fx: [['ironJudgment']],
      text: 'Aplica 1 de Juicio por cada {div} de Bloqueo que tengas.'
    },
    martirio: {
      name: 'Martirio', class: 'paladin', cost: 0, type: 'skill', rarity: 'rare', icon: 'ghost', tags: ['penitencia'], exhaust: true,
      v: { energy: 3 }, up: { energy: 4 }, fx: [['martyrdom']],
      text: 'Pierde la mitad de tus PV actuales.\nGana {energy} de Energía y te vuelves Inmaterial.\nAgotar.'
    },
    // ---- Parche 3.2: cartas de área (2 por personaje) ----
    chubasco: {
      name: 'Chubasco de Chispas', class: 'piromago', cost: 1, type: 'attack', rarity: 'common', icon: 'spark', tags: ['brasa'], aim: 'all',
      v: { dmg: 4, burn: 2 }, up: { dmg: 5, burn: 3 }, fx: [['attack'], ['burn']],
      text: 'Inflige {dmg} de daño y aplica {burn} Quemadura a todos los enemigos.'
    },
    olacalor: {
      name: 'Ola de Calor', class: 'piromago', cost: 2, type: 'attack', rarity: 'uncommon', icon: 'thermo', tags: ['horno'], aim: 'all',
      v: { dmg: 6 }, up: { dmg: 9 }, fx: [['flare']],
      text: 'Inflige {dmg} de daño más el doble de tu Temperatura a todos los enemigos.'
    },
    neblina: {
      name: 'Neblina Helada', class: 'criomante', cost: 1, type: 'skill', rarity: 'common', icon: 'cloud', tags: ['glaciar'], aim: 'all',
      v: { frost: 3 }, up: { frost: 4 }, fx: [['frost']],
      text: 'Aplica {frost} Escarcha a todos los enemigos.'
    },
    rafagaesq: {
      name: 'Ráfaga de Esquirlas', class: 'criomante', cost: 2, type: 'attack', rarity: 'uncommon', icon: 'shard', tags: ['esquirlas'], aim: 'all',
      v: { dmg: 5, hits: 2 }, up: { dmg: 7 }, fx: [['attack']],
      text: 'Inflige {dmg} de daño 2 veces a todos los enemigos.'
    },
    ondarunica: {
      name: 'Onda Rúnica', class: 'guardiana', cost: 1, type: 'attack', rarity: 'common', icon: 'rune', tags: ['bastion'], aim: 'all',
      v: { dmg: 5, block: 4 }, up: { dmg: 7, block: 5 }, fx: [['attack'], ['block']],
      text: 'Inflige {dmg} de daño a todos los enemigos.\nGana {block} de Bloqueo.'
    },
    tormentarunas: {
      name: 'Tormenta de Runas', class: 'guardiana', cost: 2, type: 'attack', rarity: 'uncommon', icon: 'rune_fuego', tags: ['fuegorunico'], aim: 'all',
      v: { dmg: 8 }, up: { dmg: 11 }, fx: [['engrave', 'fuego'], ['attack']],
      text: 'Graba Fuego.\nInflige {dmg} de daño a todos los enemigos.'
    },
    cargasalvaje: {
      name: 'Carga Salvaje', class: 'invocadora', cost: 1, type: 'attack', rarity: 'common', icon: 'claw', tags: ['manada'], aim: 'all',
      v: { dmg: 4, perSummon: 1 }, up: { dmg: 5, perSummon: 2 }, fx: [['attack']],
      text: 'Inflige {dmg} de daño a todos los enemigos.\n+{perSummon} por cada criatura.'
    },
    lluviaesporas: {
      name: 'Lluvia de Esporas', class: 'invocadora', cost: 2, type: 'attack', rarity: 'uncommon', icon: 'leaf', tags: ['arboleda'], aim: 'all',
      v: { dmg: 7, sheal: 3 }, up: { dmg: 9, sheal: 5 }, fx: [['attack'], ['healSummons']],
      text: 'Inflige {dmg} de daño a todos los enemigos.\nCura {sheal} PV a todas tus criaturas.'
    },
    destello: {
      name: 'Destello Sagrado', class: 'paladin', cost: 1, type: 'attack', rarity: 'common', icon: 'sun', tags: ['juicio'], aim: 'all',
      v: { dmg: 4, judg: 1 }, up: { dmg: 5, judg: 2 }, fx: [['attack'], ['judge']],
      text: 'Inflige {dmg} de daño y aplica {judg} de Juicio a todos los enemigos.'
    },
    ondaegida: {
      name: 'Onda de Égida', class: 'paladin', cost: 2, type: 'skill', rarity: 'uncommon', icon: 'shield', tags: ['egida'], aim: 'all',
      v: { block: 8, div: 2 }, up: { block: 11 }, fx: [['block'], ['shieldBash']],
      text: 'Gana {block} de Bloqueo.\nInflige daño igual a la mitad de tu Bloqueo a todos los enemigos.'
    },
    // ================= ELECTROMANTE (class: 'electromante') =================
    // Rayo X (op 'zap'): X al objetivo (cuenta como Ataque; +2 por cada Magnetizado del enemigo; Guante de Cobre +2).
    // Encadena N (v.chain): después salta a N enemigos distintos (al azar con run.rng, sin repetir) con la mitad del daño;
    // cada salto que no encuentra a quién saltar te da 1 de Estática. Estática (tuya, máx. 10): con 10 al final de tu
    // turno, Sobrecarga: 10 a todos los enemigos (20 si solo queda uno) y vuelve a 0. Magnetizado: baja 1 al final de su turno.
    // Balance (bot, 1000 partidas A0) frente al encargo: Chispazo 6 (9), Pulso 6 (9) de Bloqueo, Tormenta Eléctrica 7 (10),
    // Bobina +3 (+4), Estática Acumulada +5 (+7), Sobretensión 5 (6), Condensador 8 (11), Núcleo de Plasma coste 2 (1), Magnetizar 1 (2)
    // (con 2 la senda Tormenta ganaba 10 puntos más que las otras), Circuito también en Chispas y Relé (8 cartas por senda) y la
    // Sobrecarga doble contra un solo enemigo. Con los números del encargo ganaba el 2 % (media de los demás: ~18 %).
    chispazoe: {
      class: 'electromante', name: 'Chispazo', cost: 1, type: 'attack', rarity: 'starter', icon: 'ebolt',
      v: { dmg: 6, chain: 1 }, up: { dmg: 9 }, fx: [['zap']], text: 'Rayo {dmg}.\nEncadena {chain}.'
    },
    pulso: {
      class: 'electromante', name: 'Pulso', cost: 1, type: 'skill', rarity: 'starter', icon: 'shield',
      v: { block: 6, st: 1 }, up: { block: 9, st: 2 }, fx: [['block'], ['static']], text: 'Gana {block} de Bloqueo.\n+{st} Estática.'
    },
    cargae: {
      class: 'electromante', name: 'Carga', cost: 1, type: 'skill', rarity: 'starter', icon: 'coil',
      v: { st: 3, draw: 1 }, up: { st: 4 }, fx: [['static'], ['draw']], text: '+{st} Estática.\nRoba {draw} {draw|carta|cartas}.'
    },
    arcovoltaico: {
      class: 'electromante', name: 'Arco Voltaico', cost: 1, type: 'attack', rarity: 'starter', icon: 'ebolt', aim: 'all',
      v: { dmg: 4 }, up: { dmg: 6 }, fx: [['zap']], text: 'Rayo {dmg} a todos los enemigos.'
    },
    rayobif: {
      tags: ['tormenta'], class: 'electromante', name: 'Rayo Bifurcado', cost: 1, type: 'attack', rarity: 'common', icon: 'ebolt',
      v: { dmg: 6, chain: 2 }, up: { dmg: 8 }, fx: [['zap']], text: 'Rayo {dmg}.\nEncadena {chain}.'
    },
    magnetizar: {
      tags: ['tormenta'], class: 'electromante', name: 'Magnetizar', cost: 0, type: 'skill', rarity: 'common', icon: 'magnet',
      v: { mag: 1, draw: 1 }, up: { mag: 2 }, fx: [['magnet'], ['draw']], text: 'Aplica {mag} de Magnetizado.\nRoba {draw} {draw|carta|cartas}.'
    },
    chispas: {
      tags: ['tormenta', 'circuito'], class: 'electromante', name: 'Chispas', cost: 1, type: 'attack', rarity: 'common', icon: 'spark', aim: 'random', each: true,
      v: { dmg: 2, hits: 3 }, up: { dmg: 3 }, fx: [['zapRandom']], text: 'Rayo {dmg} 3 veces, cada uno a un enemigo al azar.'
    },
    condensador: {
      tags: ['descarga'], class: 'electromante', name: 'Condensador', cost: 1, type: 'skill', rarity: 'common', icon: 'coil',
      v: { block: 8 }, up: { block: 11 }, fx: [['condenser']], text: 'Gana {block} de Bloqueo más la mitad de tu Estática.'
    },
    estaticaac: {
      tags: ['descarga'], class: 'electromante', name: 'Estática Acumulada', cost: 1, type: 'skill', rarity: 'common', icon: 'ebolt',
      v: { st: 5 }, up: { st: 7 }, fx: [['static']], text: '+{st} Estática.'
    },
    tomatierra: {
      tags: ['descarga'], class: 'electromante', name: 'Toma de Tierra', cost: 1, type: 'skill', rarity: 'common', icon: 'shield',
      v: { block: 8, max: 3, per: 4 }, up: { block: 11 }, fx: [['ground']], text: 'Gana {block} de Bloqueo.\nPierde hasta {max} de Estática y gana {per} de Bloqueo por cada punto.'
    },
    cortocircuito: {
      tags: ['circuito'], class: 'electromante', name: 'Cortocircuito', cost: 0, type: 'attack', rarity: 'common', icon: 'spark',
      v: { dmg: 3, comboN: 3, energy: 1 }, up: { dmg: 5 }, fx: [['zap'], ['comboEnergy']], text: 'Rayo {dmg}.\nCombo {comboN}: +{energy} Energía.'
    },
    interruptor: {
      tags: ['circuito'], class: 'electromante', name: 'Interruptor', cost: 0, type: 'skill', rarity: 'common', icon: 'coil',
      v: { draw: 1, st: 1 }, up: { draw: 2 }, fx: [['draw'], ['static']], text: 'Roba {draw} {draw|carta|cartas}.\n+{st} Estática.'
    },
    tormentaelec: {
      tags: ['tormenta'], class: 'electromante', name: 'Tormenta Eléctrica', cost: 2, type: 'attack', rarity: 'uncommon', icon: 'ebolt', aim: 'all',
      v: { dmg: 7, chain: 1 }, up: { dmg: 10 }, fx: [['zap']], text: 'Rayo {dmg} a todos los enemigos.\nEncadena {chain}.'
    },
    rele: {
      tags: ['tormenta', 'circuito'], class: 'electromante', name: 'Relé', cost: 0, type: 'skill', rarity: 'uncommon', icon: 'coil',
      v: { extra: 2, draw: 1 }, up: { extra: 3 }, fx: [['relay'], ['draw']], text: 'Tu próximo Rayo de este turno Encadena {extra} más.\nRoba {draw} {draw|carta|cartas}.'
    },
    polaridad: {
      tags: ['tormenta', 'descarga'], class: 'electromante', name: 'Polaridad Inversa', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'magnet',
      v: {}, up: { cost: 0 }, fx: [['polarity']], text: 'Convierte toda tu Estática en Magnetizado sobre el enemigo (1 por cada punto).'
    },
    bobina: {
      tags: ['descarga'], class: 'electromante', name: 'Bobina de Tesla', cost: 1, type: 'power', rarity: 'uncommon', icon: 'coil',
      v: { amt: 3 }, up: { amt: 4 }, fx: [['power', 'bobina']], text: 'Al final de tu turno, +{amt} Estática.'
    },
    sobretension: {
      tags: ['descarga'], class: 'electromante', name: 'Sobretensión', cost: 'X', type: 'attack', rarity: 'uncommon', icon: 'ebolt',
      v: { dmg: 5 }, up: { dmg: 6 }, fx: [['xZap']], text: 'Rayo {dmg} X veces.\n+X Estática.'
    },
    faraday: {
      tags: ['descarga'], class: 'electromante', name: 'Jaula de Faraday', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'wall',
      v: { block: 10, bonus: 4, at: 5 }, up: { block: 13, bonus: 6 }, fx: [['faraday']], text: 'Gana {block} de Bloqueo.\n+{bonus} si tienes {at} o más de Estática.'
    },
    bucle: {
      tags: ['circuito'], class: 'electromante', name: 'Bucle Infinito', cost: 1, type: 'power', rarity: 'uncommon', icon: 'loop',
      v: { amt: 1 }, up: { cost: 0 }, fx: [['power', 'bucle']], text: 'La 4.ª carta que juegas cada turno te devuelve 1 de Energía.'
    },
    microchispas: {
      tags: ['circuito', 'tormenta'], class: 'electromante', name: 'Microchispas', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'spark',
      v: { n: 2 }, up: { n: 3 }, fx: [['microSparks']], text: 'Añade {n} {n|Chispazo|Chispazos} a tu mano.\nCuestan 0 y son cartas Etéreas.'
    },
    rayoglobular: {
      tags: ['tormenta'], class: 'electromante', name: 'Rayo Globular', cost: 2, type: 'attack', rarity: 'rare', icon: 'ebolt',
      v: { dmg: 20 }, up: { dmg: 26 }, fx: [['zapAll']], text: 'Rayo {dmg}.\nEncadena a todos los demás enemigos sin perder fuerza.'
    },
    supercarga: {
      tags: ['descarga'], class: 'electromante', name: 'Supercarga', cost: 1, type: 'skill', rarity: 'rare', icon: 'ebolt', exhaust: true,
      v: { exTxt: '\nAgotar.' }, up: { noExhaust: true, exTxt: '' }, fx: [['supercharge']], text: 'Duplica tu Estática (máx. 10).{exTxt}'
    },
    nucleoplasma: {
      tags: ['descarga'], class: 'electromante', name: 'Núcleo de Plasma', cost: 2, type: 'power', rarity: 'rare', icon: 'prism',
      v: { amt: 1 }, up: { cost: 1 }, fx: [['power', 'nucleo']], text: 'Cada Sobrecarga te da 2 de Energía y 2 cartas en tu siguiente turno.'
    },
    velocidadluz: {
      tags: ['circuito'], class: 'electromante', name: 'Velocidad de la Luz', cost: 2, type: 'power', rarity: 'rare', icon: 'up',
      v: { amt: 1 }, up: { cost: 1 }, fx: [['power', 'velocidad']], text: 'Tus cartas de coste 0 roban 1 carta al jugarse.'
    },
    irazeus: {
      tags: ['circuito', 'tormenta'], class: 'electromante', name: 'Ira de Zeus', cost: 3, type: 'attack', rarity: 'rare', icon: 'ebolt', aim: 'all',
      v: { dmg: 12, perCard: 3 }, up: { dmg: 15, perCard: 4 }, fx: [['zap']], text: 'Rayo {dmg} a todos los enemigos.\n+{perCard} por cada carta que hayas jugado antes este turno.'
    }
  };

  /** Mazo inicial del Piromago. La pantalla de preparación lo lee de aquí,
   *  así nunca puede desincronizarse con lo que realmente se reparte. */
  const STARTER_DECK = ['llama', 'llama', 'llama', 'chispa', 'piel', 'piel', 'piel', 'piel', 'bola', 'combustion'];
  const STARTER_GUARD = ['golperunico', 'golperunico', 'golperunico', 'golperunico', 'guardia', 'guardia', 'guardia', 'guardia', 'tallarllama', 'tallarescudo'];
  /* Runas de la Guardiana. passive/det: efectos; half: la Potencia solo suma +1 cada 2 puntos
   * (Viento y Sangre: robar y curar escalan peor para que no se rompan). */
  const RUNES = {
    fuego:     { name: 'Fuego',     color: 0xff7a3d, passive: { dmg: 4 },            det: { dmg: 10 } },
    piedra:    { name: 'Piedra',    color: 0xb9b2a3, passive: { block: 3 },          det: { block: 10 } },
    viento:    { name: 'Viento',    color: 0x8fe0c8, passive: { draw: 1 },           det: { draw: 3 }, half: true },
    sangre:    { name: 'Sangre',    color: 0xd23a4a, passive: { heal: 1 },           det: { heal: 6 }, half: true },
    ancestral: { name: 'Ancestral', color: 0xffd36a, passive: { dmg: 4, block: 4 },  det: { dmg: 20 } }
  };
  const RUNE_IDS = Object.keys(RUNES);
  const STARTER_INVO = ['golpevara', 'golpevara', 'golpevara', 'golpevara', 'corteza', 'corteza', 'corteza', 'corteza', 'llamarlobezno', 'ordenataque'];
  /* Criaturas de la Invocadora. atk (× hits) al final de tu turno; block: Bloqueo para ti; draw: robas al empezar tu turno.
   * art: clave de textura (assets/summons/<id>.png); si falta, arte de enemigo teñido de verde (scenes.js). */
  const SUMMONS = {
    lobezno:  { name: 'Lobezno Espectral',  hp: 6,  atk: 3, art: 'sum_lobezno', text: 'Ataca 3.' },
    treant:   { name: 'Treant Joven',       hp: 12, atk: 1, block: 3, art: 'sum_treant', text: 'Ataca 1 y te da 3 de Bloqueo.' },
    buho:     { name: 'Búho Arcano',        hp: 4,  atk: 0, draw: 1, art: 'sum_buho', text: 'Robas 1 carta al empezar tu turno.' },
    hada:     { name: 'Hada de Espinas',    hp: 5,  atk: 2, hits: 2, art: 'sum_hada', text: 'Ataca 2, dos veces.' },
    espiritu: { name: 'Espíritu Ancestral', hp: 12, atk: 6, art: 'sum_espiritu', rare: true, text: 'Ataca 6.' }
  };
  const SUMMON_IDS = Object.keys(SUMMONS);
  const MAX_SUMMONS = 3;
  const STARTER_PALADIN = ['golpesagrado', 'golpesagrado', 'golpesagrado', 'golpesagrado', 'escudofe', 'escudofe', 'escudofe', 'escudofe', 'veredicto', 'penitencia'];
  const STARTER_ELECTRO = ['chispazoe', 'chispazoe', 'chispazoe', 'chispazoe', 'pulso', 'pulso', 'pulso', 'pulso', 'cargae', 'arcovoltaico'];
  const STARTER_CRIO = ['esquirla', 'esquirla', 'esquirla', 'esquirla', 'muroescarcha', 'muroescarcha', 'muroescarcha', 'muroescarcha', 'alientogelido', 'fragmentar'];


  /* ------------------------------------------------------------------ *
   * SENDAS (Parche 3.1): 3 arquetipos por personaje. Cada carta de personaje lleva tags: [ids de senda]
   * (una o dos; las iniciales, ninguna). star: la carta poco común (o rara) que se añade al mazo inicial
   * al elegir esa senda. Las recompensas y la tienda favorecen las sendas que ya llevas (engine.js).
   * ------------------------------------------------------------------ */
  const PATHS = {
    brasa:       { id: 'brasa',       char: 'piromago',   name: 'Brasa',        icon: 'flame',       color: 0xff6a3d, star: 'incendioctrl',
                   desc: 'Apila Quemadura y haz que arda más fuerte y durante más tiempo.' },
    horno:       { id: 'horno',       char: 'piromago',   name: 'Horno',        icon: 'thermo',      color: 0xffb23d, star: 'puntofusion',
                   desc: 'Sube la Temperatura para golpear fuerte sin llegar a quemarte.' },
    ceniza:      { id: 'ceniza',      char: 'piromago',   name: 'Ceniza',       icon: 'urn',         color: 0xbfae9f, star: 'pirafuneraria',
                   desc: 'Agota cartas y convierte cada pérdida en poder.' },
    glaciar:     { id: 'glaciar',     char: 'criomante',  name: 'Glaciar',      icon: 'snow',        color: 0x8fd4ff, star: 'corazonpolar',
                   desc: 'Acumula Escarcha y Congela al enemigo una y otra vez.' },
    muralla:     { id: 'muralla',     char: 'criomante',  name: 'Muralla',      icon: 'wall',        color: 0xd8efff, star: 'permafrostp',
                   desc: 'Levanta un Escudo de Hielo que dura y devuelve los golpes.' },
    esquirlas:   { id: 'esquirlas',   char: 'criomante',  name: 'Esquirlas',    icon: 'shard',       color: 0x6fa8ff, star: 'prismaice',
                   desc: 'Golpes múltiples y Fragmentar para romper la Escarcha.' },
    fuegorunico: { id: 'fuegorunico', char: 'guardiana',  name: 'Fuego Rúnico', icon: 'rune_fuego',  color: 0xff7a3d, star: 'sobrecargarun',
                   desc: 'Graba runas y Detónalas en cadena.' },
    bastion:     { id: 'bastion',     char: 'guardiana',  name: 'Bastión',      icon: 'rune_piedra', color: 0xd8c9a8, star: 'golemrunas',
                   desc: 'Runas de Piedra y un Bloqueo que no se derrumba.' },
    ecos:        { id: 'ecos',        char: 'guardiana',  name: 'Ecos',         icon: 'rune_viento', color: 0x8fe0c8, star: 'circuloperf',
                   desc: 'Activa los pasivos de tus runas y sube su Potencia.' },
    manada:      { id: 'manada',      char: 'invocadora', name: 'Manada',       icon: 'claw',        color: 0xe0a46a, star: 'madrebosque',
                   desc: 'Muchas criaturas a la vez y Vínculo para que muerdan más.' },
    arboleda:    { id: 'arboleda',    char: 'invocadora', name: 'Arboleda',     icon: 'leaf',        color: 0x6fd08a, star: 'saviaeterna',
                   desc: 'Criaturas resistentes que se curan y te protegen.' },
    ciclo:       { id: 'ciclo',       char: 'invocadora', name: 'Ciclo',        icon: 'hourglass',   color: 0xc9a8ff, star: 'almabosque',
                   desc: 'Sacrifica criaturas y haz que vuelvan más fuertes.' },
    juicio:      { id: 'juicio',      char: 'paladin',    name: 'Juicio',       icon: 'scales',      color: 0xf2d36b, star: 'sacrificiosag',
                   desc: 'Aplica Juicio y convierte cada golpe en Bloqueo.' },
    penitencia:  { id: 'penitencia',  char: 'paladin',    name: 'Penitencia',   icon: 'drop',        color: 0xe0475a, star: 'llamavotiva',
                   desc: 'Hiérete con tus cartas y deja que el Fervor arda.' },
    egida:       { id: 'egida',       char: 'paladin',    name: 'Égida',        icon: 'shield',      color: 0xa8c8ff, star: 'castillofe',
                   desc: 'Un Bloqueo que se conserva y se convierte en daño.' },
    tormenta:    { id: 'tormenta',    char: 'electromante', name: 'Tormenta', icon: 'ebolt',      color: 0x7fd6ff, star: 'tormentaelec',
                   desc: 'Rayos que Encadenan de enemigo en enemigo y golpes a todos a la vez.' },
    descarga:    { id: 'descarga',    char: 'electromante', name: 'Sobrecarga', icon: 'coil',     color: 0xffe066, star: 'bobina',
                   desc: 'Acumula Estática y descárgala toda de golpe.' },
    circuito:    { id: 'circuito',    char: 'electromante', name: 'Circuito', icon: 'loop',       color: 0x9ff0d0, star: 'bucle',
                   desc: 'Muchas cartas baratas en un mismo turno.' }
  };
  const PATH_IDS = Object.keys(PATHS);
  /** Las 3 sendas de un personaje, en orden. */
  const pathsOf = (ch) => PATH_IDS.filter((id) => PATHS[id].char === ch).map((id) => PATHS[id]);

  /* ------------------------------------------------------------------ *
   * PERSONAJES. mechanics: mecánicas propias ('temp' = Temperatura y Sobrecalentamiento).
   * unlock: cómo se desbloquea (texto) — null si empieza desbloqueado.
   * ------------------------------------------------------------------ */
  const CHARACTERS = {
    piromago: {
      id: 'piromago',
      name: 'Piromago',
      title: 'Mago de Fuego',
      hp: 55,
      lore: 'Sobrevivió a la combustión espontánea de los Desiertos de Ceniza. Su magia prende una Quemadura que devora al enemigo turno a turno, y su Temperatura interna potencia cada golpe… a costa de quemarse a sí mismo.',
      mechanicText: 'Quemadura y Temperatura: cuanto más caliente, más daño… y más riesgo.',
      color: 0xff7a2f,
      art: 'mage',
      starterDeck: STARTER_DECK,
      starterRelic: 'corazon_ardiente',   // partidas nuevas (las guardadas antes no la reciben)
      mechanics: ['temp'],
      unlock: null
    },
    criomante: {
      id: 'criomante',
      name: 'Criomante',
      title: 'Mago de Escarcha',
      hp: 58,
      lore: 'Exiliado de los picos helados del Norte, sacrificó su propia calidez para contener el frío primordial en su corazón. Su magia congela poco a poco la sangre de sus víctimas hasta paralizarlas, y cuando se ve acorralado convierte sus defensas de hielo en un impacto devastador… aunque el esfuerzo lo deje expuesto.',
      mechanicText: 'Acumula Escarcha para debilitar y congelar a tus enemigos.',
      color: 0x8fd4ff,
      art: 'criomante',              // assets/criomante.png; sin PNG, el arte del Piromago tintado de azul hielo
      starterDeck: STARTER_CRIO,
      starterRelic: 'corazon_gelido',
      mechanics: ['frost', 'ice'],
      unlock: 'Derrota al jefe del Acto I una vez.'
    },
    guardiana: {
      id: 'guardiana',
      name: 'Guardiana Rúnica',
      title: 'Forjadora de Runas',
      hp: 64,
      lore: 'Última de los talladores de la montaña. No lanza hechizos: los graba en piedra, y la piedra nunca olvida.',
      mechanicText: 'Graba runas que actúan solas cada turno y Detonan al sustituirlas.',
      color: 0xc9a46a,
      art: 'guardiana',              // assets/guardiana.png; sin PNG, el arte del Piromago tintado de piedra/ámbar
      starterDeck: STARTER_GUARD,
      starterRelic: 'piedra_inicial',
      mechanics: ['runes'],
      unlock: 'Gana una partida con cualquier personaje.'
    },
    invocadora: {
      id: 'invocadora',
      name: 'Invocadora',
      title: 'Invocadora del Bosque',
      hp: 52,                        // balance (bot, A0): con 60 y las invocaciones a 1 de Energía ganaba el 77%
      lore: 'Habla con lo que duerme bajo las raíces. Ella no pelea: el bosque pelea por ella.',
      mechanicText: 'Invoca criaturas que atacan al final de tu turno y reciben los golpes por ti.',
      color: 0x6fd08a,
      art: 'invocadora',             // assets/invocadora.png; sin PNG, el arte del Piromago tintado de verde
      starterDeck: STARTER_INVO,
      starterRelic: 'cuerno',
      mechanics: ['summon'],
      unlock: 'Llega al Acto II con cualquier personaje.'
    },
    paladin: {
      id: 'paladin',
      name: 'Paladín',
      title: 'Juez de la Luz',
      hp: 68,
      lore: 'Fanático de una orden sagrada caída, ve en el dolor la prueba definitiva de la fe. Juzga los pecados de sus enemigos y convierte cada golpe en un escudo; cuanto más sangra, más arde su fervor.',
      mechanicText: 'Juicio: tus golpes te dan Bloqueo. Fervor: más daño con menos PV.',
      color: 0xf2d36b,
      art: 'paladin',                // assets/paladin.png (arte propio; si fallara, Piromago tintado de dorado)
      starterDeck: STARTER_PALADIN,
      starterRelic: 'medallon',
      mechanics: ['judgment', 'fervor'],
      unlock: 'Derrota a cualquier jefe del Acto II.',
      dailyFrom: '2026-11-05'        // entra en el sorteo del desafío diario desde esta fecha (los diarios anteriores no cambian)
    },
    electromante: {
      id: 'electromante',
      name: 'Electromante',
      title: 'Tejedor de Tormentas',
      hp: 64,
      lore: 'Sobrevivió a un rayo que debió matarlo y desde entonces la tormenta vive bajo su piel. Acumula electricidad hasta que el aire chisporrotea… y entonces todo a su alrededor estalla.',
      mechanicText: 'Rayos que Encadenan entre enemigos y Estática que estalla en Sobrecarga.',
      color: 0x7fd6ff,
      art: 'electromante',           // assets/electromante.png (si falta: el Piromago tintado de azul eléctrico)
      starterDeck: STARTER_ELECTRO,
      starterRelic: 'pararrayos',
      mechanics: ['static', 'chain'],
      unlock: 'Gana 10 combates en grupo (con cualquier personaje).',
      dailyFrom: '2026-11-07'
    }
  };
  const CHAR_IDS = Object.keys(CHARACTERS);
  CHAR_IDS.forEach((id) => { CHARACTERS[id].paths = pathsOf(id); });   // CHARACTERS[id].paths: sus 3 sendas
  /** Compatibilidad: código anterior que lee D.MAGE. */
  const MAGE = CHARACTERS.piromago;

  /* Movimientos de enemigos (todos los campos son opcionales y se combinan):
   *   dmg (+hits)  daño por golpe (× golpes)        block   bloqueo que gana el enemigo
   *   str          Fuerza que gana el enemigo       weak    Débil que aplica al jugador
   *   chill: n     el jugador pierde n de Temperatura (mínimo 0)            [Acto II]
   *   curse: n     baraja n Escalofríos en el DESCARTE del jugador, solo
   *                durante ese combate (no entran en el mazo permanente)    [Acto II]
   *   douse: true  el enemigo reduce su Quemadura a la mitad (hacia abajo)  [Acto II]
   *   drain: n     DRENAR MANÁ: empiezas tu próximo turno con n Energía menos (mínimo 1)        [Acto III]
   *   silence: n   SILENCIO: n cartas al azar de tu próxima mano quedan selladas ese turno      [Acto III]
   *   reflect: n   REFLEJO: gana n cargas; cada carta de Ataque que juegues mientras tenga
   *                cargas te devuelve el 50% del daño que inflige (gasta 1 carga)              [Acto III]
   *   charge: n    CARGA ARCANA: carga n turnos («Cargando… n», …, «…1») y después lanza un golpe
   *                de chargeHit. Si recibe 15+ de daño en uno de tus turnos mientras carga, se
   *                interrumpe (pierde el golpe)                                                [Acto III]
   *   inkCurse: n  baraja n Garabatos (maldición de combate) en tu descarte                      [Acto III]
   * Fases de jefe: phase2 y phase3 = { at (fracción de vida), text, moves, str? (Fuerza al entrar) }.
   * Pasiva opcional del enemigo: startBlock: n → empieza el combate con n de bloqueo.
   * Jefes (Parche 2.9): subtitle (intro) y desc (tooltip del mapa y Compendio). Pasivas:
   *   grow: n        al final de cada uno de sus turnos gana n de Fuerza                        (Lobo Alfa)
   *   devour: [a, b] cada carta que juegues a partir de la a-ésima del turno le da +1 Fuerza;
   *                  en la fase 2, a partir de la b-ésima                                      (Devorador)
   *   revive: f      la primera vez que llega a 0 PV revive con f de su vida y pasa a la fase 2 (Archiliche)
   *   phase2.noBlock al entrar en la fase pierde todo su Bloqueo y ya no puede ganarlo         (Titán)
   *   heal: n        movimiento que le cura n PV (sin pasar del máximo)                         (Matriarca)
   * Se ejecutan en orden cíclico; el primer movimiento de enemigos normales es aleatorio.
   * art: clave de la imagen (assets/<art>.png → 'art_<art>'). Si no existe, la UI usa un sustituto. */
  /** flip: true → su dibujo mira a la derecha; en combate (y en todo lo que copia el sprite) se voltea para mirar al personaje. */
  const ENEMIES = {
    rata: {
      name: 'Rata del Bosque', hp: [25, 30], art: 'rat', tier: 'normal',
      moves: [{ name: 'Mordisco', dmg: 9 }, { name: 'Mordisco', dmg: 10 }, { name: 'Esconderse', block: 6 }]
    },
    seta: {
      name: 'Seta Venenosa', hp: [35, 39], art: 'shroom', tier: 'normal',
      moves: [{ name: 'Esporas', weak: 2 }, { name: 'Embestida', dmg: 13 }, { name: 'Embestida', dmg: 14 }]
    },
    lobo: {
      name: 'Lobo Sombrío', hp: [48, 53], art: 'wolf', tier: 'normal',
      moves: [{ name: 'Zarpazo', dmg: 8, hits: 2 }, { name: 'Aullido', str: 2 }, { name: 'Dentellada', dmg: 18 }]
    },
    bandido: {
      name: 'Bandido del Camino', hp: [44, 48], art: 'bandit', flip: true, tier: 'normal',
      moves: [{ name: 'Puñalada', dmg: 10, block: 5 }, { name: 'Navajazo', dmg: 20 }, { name: 'Finta', block: 8, str: 1 }]
    },
    treant: {
      name: 'Árbol Corrupto', hp: [80, 86], art: 'treant', tier: 'elite',
      moves: [{ name: 'Raíces', block: 12, str: 2 }, { name: 'Aplastar', dmg: 16 }, { name: 'Látigo de Ramas', dmg: 5, hits: 3 }]
    },
    bruja: {
      name: 'Bruja del Pantano', hp: [75, 81], art: 'witch', flip: true, tier: 'elite',
      moves: [{ name: 'Maleficio', dmg: 10, weak: 2 }, { name: 'Escudo de Musgo', block: 12 }, { name: 'Rayo Pútrido', dmg: 25 }]
    },
    guardian: {
      name: 'Guardián del Bosque', hp: [140, 140], art: 'guardian', tier: 'boss',
      subtitle: 'Corazón de roble del Bosque Encantado',
      desc: 'Se protege con Bloqueo y Fuerza. A la mitad de sus PV entra en furia y golpea más fuerte.',
      moves: [
        { name: 'Despertar', block: 15, str: 2 },
        { name: 'Golpe Sísmico', dmg: 16 },
        { name: 'Lluvia de Espinas', dmg: 5, hits: 3 },
        { name: 'Enraizar', block: 10, weak: 2 }
      ],
      phase2: {
        at: 0.5,
        text: '¡El Guardián entra en furia!',
        moves: [
          { name: 'Furia Ancestral', str: 2, block: 10 },
          { name: 'Aplastamiento', dmg: 18 },
          { name: 'Lluvia de Espinas', dmg: 6, hits: 3 }
        ]
      }
    },
    // ---- Parche 2.9: jefes alternativos del Acto I (uno al azar por partida, con run.rng) ----
    matriarca: {
      name: 'Matriarca Fúngica', hp: [164, 164], art: 'matriarca', tier: 'boss',
      subtitle: 'Madre de todas las setas del bosque',
      desc: 'Te debilita y te llena el mazo de Escalofríos. A la mitad de sus PV suelta una nube tóxica, invoca 2 Setas Brote y se cura (hasta 3 veces).',
      moves: [
        { name: 'Esporas', weak: 2, curse: 2 },
        { name: 'Embestida', dmg: 17 },
        { name: 'Raíz Madre', block: 14, str: 1 }
      ],
      phase2: {
        at: 0.5,
        text: '¡La Matriarca libera su nube de esporas y brotan dos Setas Brote!',
        spawn: ['setab', 'setab'],   // Parche 3.2: invoca (no dan recompensa y desaparecen si muere la Matriarca)
        moves: [
          { name: 'Nube Tóxica', dmg: 5, hits: 3, weak: 1 },   // Parche 3.2: 7 → 5 (ahora invoca Setas)
          { name: 'Brote', heal: 8 },                           // Parche 3.2: 13 → 8
          { name: 'Embestida', dmg: 17 }
        ]
      }
    },
    alfa: {
      name: 'Lobo Alfa', hp: [104, 104], art: 'alfa', tier: 'boss',
      subtitle: 'El líder de la manada',
      desc: 'Gana 1 de Fuerza al final de cada uno de sus turnos: cuanto más dure el combate, más fuerte golpea. Al 40 % de sus PV enloquece.',
      grow: 1,
      moves: [
        { name: 'Zarpazo', dmg: 4, hits: 2 },
        { name: 'Dentellada', dmg: 14 },
        { name: 'Aullido de la Manada', str: 1, block: 8 }
      ],
      phase2: {
        at: 0.4,
        text: '¡El Alfa enloquece!',
        moves: [
          { name: 'Frenesí', dmg: 4, hits: 4 },
          { name: 'Dentellada', dmg: 14 }
        ]
      }
    },

    // ================= Acto II: Cumbres de Escarcha =================
    murcielago: {
      name: 'Murciélago Gélido', hp: [34, 38], art: 'murcielago', tier: 'normal',
      moves: [{ name: 'Picotazos', dmg: 4, hits: 3 }, { name: 'Aleteo Helado', dmg: 6, chill: 2 }, { name: 'Chillido', weak: 2 }]
    },
    espiritu: {
      name: 'Espíritu de Ventisca', hp: [42, 46], art: 'espiritu', tier: 'normal',
      moves: [{ name: 'Ventisca', chill: 3, block: 8 }, { name: 'Toque Helado', dmg: 15, weak: 1 }, { name: 'Deshielo', douse: true, dmg: 8 }]
    },
    huargo: {
      name: 'Huargo de Escarcha', hp: [58, 63], art: 'huargo', tier: 'normal',
      moves: [{ name: 'Zarpazo', dmg: 10, hits: 2 }, { name: 'Aullido Glacial', str: 2, chill: 1 }, { name: 'Dentellada', dmg: 22 }]
    },
    yeti: {
      name: 'Yeti Joven', hp: [66, 72], art: 'yeti', tier: 'normal',
      moves: [{ name: 'Bola de Nieve', dmg: 12, curse: 1 }, { name: 'Golpetazo', dmg: 25 }, { name: 'Pelaje', block: 14 }]
    },
    cazador: {
      name: 'Cazador de Pieles', hp: [55, 60], art: 'cazador', tier: 'normal',
      moves: [{ name: 'Trampa de Hielo', curse: 2, dmg: 6 }, { name: 'Arpón', dmg: 18 }, { name: 'Afilar', str: 2, block: 6 }]
    },
    golem: {
      name: 'Gólem de Hielo', hp: [120, 128], art: 'golem', tier: 'elite', startBlock: 15,
      moves: [{ name: 'Coraza Helada', block: 20 }, { name: 'Puño Glaciar', dmg: 27 }, { name: 'Temblor', dmg: 8, hits: 3 }]
    },
    hechicera: {
      name: 'Hechicera de Escarcha', hp: [105, 112], art: 'hechicera', flip: true, tier: 'elite',
      moves: [{ name: 'Congelación', chill: 4, weak: 2 }, { name: 'Lanza de Hielo', dmg: 31 },
              { name: 'Escarcha', curse: 2, block: 12 }, { name: 'Deshielo', douse: true, dmg: 10 }]
    },
    wyrm: {
      name: 'Wyrm de Escarcha', hp: [130, 130], art: 'wyrm', tier: 'boss',
      subtitle: 'Señor de las Cumbres de Escarcha',
      desc: 'Su aliento te enfría y te maldice. A la mitad de sus PV despliega las alas y apaga tu Quemadura.',
      moves: [
        { name: 'Aliento Glacial', dmg: 8, chill: 5 },
        { name: 'Escamas', block: 20, str: 2 },
        { name: 'Coletazo', dmg: 4, hits: 4 },
        { name: 'Ventisca Eterna', curse: 2, weak: 2 }
      ],
      phase2: {
        at: 0.5,
        text: '¡El Wyrm despliega sus alas heladas!',
        moves: [
          { name: 'Aliento Absoluto', dmg: 16, chill: 3 },
          { name: 'Tormenta', dmg: 5, hits: 4 },
          { name: 'Deshielo Total', douse: true, block: 25, str: 3 }
        ]
      }
    },
    // ---- Parche 2.9: jefes alternativos del Acto II ----
    titan: {
      name: 'Titán del Glaciar', hp: [145, 145], art: 'titan', tier: 'boss', startBlock: 22,
      subtitle: 'Un glaciar que aprendió a andar',
      desc: 'Empieza con 22 de Bloqueo y se acoraza aún más. A la mitad de sus PV pierde la coraza para siempre, pero lanza Avalanchas.',
      moves: [
        { name: 'Coraza Glacial', block: 17 },
        { name: 'Puño Glaciar', dmg: 16, chill: 2 },
        { name: 'Temblor', dmg: 6, hits: 3 }
      ],
      phase2: {
        at: 0.5,
        text: '¡La coraza del Titán se resquebraja!',
        noBlock: true,
        moves: [
          { name: 'Temblor', dmg: 6, hits: 3 },
          { name: 'Avalancha', dmg: 24 }
        ]
      }
    },
    espectro: {
      name: 'Espectro de la Tormenta', hp: [165, 165], art: 'espectro', tier: 'boss',
      subtitle: 'El aullido helado de las cumbres',
      desc: 'Te enfría, te maldice y ataca muchas veces. A la mitad de sus PV desata la tormenta y apaga tu Quemadura.',
      moves: [
        { name: 'Rayo Helado', dmg: 12, chill: 2 },
        { name: 'Lamento', curse: 2, weak: 2 },
        { name: 'Ráfaga', dmg: 5, hits: 4 }
      ],
      phase2: {
        at: 0.5,
        text: '¡El Espectro desata la tormenta!',
        moves: [
          { name: 'Tormenta', dmg: 7, hits: 4, douse: true },
          { name: 'Rayo Helado', dmg: 12, chill: 2 },
          { name: 'Lamento', curse: 2, weak: 2 }
        ]
      }
    },

    // ================= Acto III: Caverna Arcana =================
    // Balance (bot, A0): muchos golpes por ataque (las criaturas de la Invocadora absorben golpes, no daño)
    duende: {
      name: 'Duende de Maná', hp: [66, 72], art: 'duende', tier: 'normal',
      moves: [{ name: 'Mordisco', dmg: 7, hits: 2 }, { name: 'Sorber Maná', drain: 1, dmg: 6, hits: 2 }, { name: 'Chispa', dmg: 4, hits: 6 }]
    },
    fatuo: {
      name: 'Fuego Fatuo Arcano', hp: [60, 66], art: 'fatuo', tier: 'normal',
      moves: [{ name: 'Destello', silence: 2, dmg: 4, hits: 3 }, { name: 'Llama Violeta', dmg: 7, hits: 3 }, { name: 'Parpadeo', block: 12 }]
    },
    grimorio: {
      name: 'Grimorio Viviente', hp: [88, 94], art: 'grimorio', tier: 'normal',
      moves: [{ name: 'Mordisco de Páginas', dmg: 6, hits: 4 }, { name: 'Tinta Maldita', inkCurse: 2, dmg: 5, hits: 3 }, { name: 'Capítulo Prohibido', str: 3 }]
    },
    centinela: {
      name: 'Centinela Rúnico', hp: [96, 102], art: 'centinela', tier: 'normal', startBlock: 18,
      moves: [{ name: 'Puño Rúnico', dmg: 7, hits: 4 }, { name: 'Glifo Protector', block: 20, reflect: 1 }, { name: 'Pisotón', dmg: 5, hits: 5 }]
    },
    acolito: {
      name: 'Acólito Encapuchado', hp: [82, 88], art: 'acolito', tier: 'normal',
      moves: [{ name: 'Rayo', dmg: 6, hits: 3 }, { name: 'Ritual', charge: 2, chargeHit: 44 }, { name: 'Maldición', silence: 1, weak: 2 }]
    },
    espejo: {
      name: 'Espejo Viviente', hp: [190, 200], art: 'espejo', tier: 'elite',
      moves: [{ name: 'Reflejarte', reflect: 2, block: 15 }, { name: 'Golpe Duplicado', dmg: 10, hits: 3 }, { name: 'Fragmentos', dmg: 5, hits: 6 }]
    },
    archimago: {
      name: 'Archimago Caído', hp: [210, 220], art: 'archimago', flip: true, tier: 'elite',
      moves: [{ name: 'Sorber Mente', drain: 1, silence: 2 }, { name: 'Meteoro', charge: 1, chargeHit: 44 },
              { name: 'Tinta', inkCurse: 2, block: 18 }, { name: 'Rayo Arcano', dmg: 7, hits: 5 }]
    },
    ojo: {
      name: 'El Ojo del Abismo', hp: [300, 300], art: 'ojo', tier: 'boss',
      subtitle: 'Lo que mira desde el fondo de la Caverna',
      desc: 'Drena tu maná y te Silencia. Tiene tres fases y Cargas Arcanas enormes: interrúmpelas con 15 de daño en un turno.',
      moves: [{ name: 'Mirada', dmg: 6, hits: 3 }, { name: 'Absorber', drain: 1, block: 12 }, { name: 'Visión', silence: 1, dmg: 5, hits: 3 }],
      phase2: {
        at: 0.66,
        text: '¡El Ojo se abre por completo!',
        moves: [{ name: 'Rayo Desintegrador', charge: 1, chargeHit: 40 }, { name: 'Espejo Infinito', reflect: 1, dmg: 4, hits: 4 }, { name: 'Lluvia Arcana', dmg: 4, hits: 9 }]
      },
      phase3: {
        at: 0.33,
        text: '¡La caverna entera se desmorona!',
        str: 2,
        moves: [{ name: 'Devorar Maná', drain: 1, dmg: 5, hits: 3 }, { name: 'Fin de Todo', charge: 2, chargeHit: 60 }, { name: 'Colapso', dmg: 5, hits: 6 }]
      }
    },

    // ---- Parche 2.9: jefes alternativos del Acto III ----
    lich: {
      name: 'Archiliche Rúnico', hp: [300, 300], art: 'lich', tier: 'boss',
      subtitle: 'Las runas lo atan a este mundo',
      desc: 'Te Silencia, Refleja tus ataques y Drena tu maná. La primera vez que cae, revive con el 30 % de sus PV, llama a un Acólito y prepara una Carga Final.',
      revive: 0.3,
      moves: [
        { name: 'Sello', silence: 2, dmg: 12 },
        { name: 'Espejo de Almas', reflect: 2, block: 15 },
        { name: 'Drenaje', drain: 1, dmg: 16 }
      ],
      phase2: {
        at: 0,
        text: '¡El Archiliche se niega a morir y llama a un Acólito!',
        spawn: ['acolito'],
        moves: [
          { name: 'Carga Final', charge: 2, chargeHit: 50 },
          { name: 'Drenaje', drain: 1, dmg: 14 },
          { name: 'Sello', silence: 2, dmg: 10 }
        ]
      }
    },
    devorador: {
      name: 'Devorador de Hechizos', hp: [360, 360], art: 'devorador', tier: 'boss',
      subtitle: 'Se alimenta de tu magia',
      desc: 'Cada carta que juegues después de la 4.ª en un mismo turno le da 1 de Fuerza (desde la 3.ª cuando está por debajo de la mitad).',
      devour: [5, 3],
      moves: [
        { name: 'Mordisco Arcano', dmg: 22 },
        { name: 'Tragar Maná', drain: 1, inkCurse: 1 },
        { name: 'Indigestión', charge: 1, chargeHit: 45 }
      ],
      phase2: {
        at: 0.5,
        text: '¡El Devorador tiene más hambre!',
        moves: [
          { name: 'Mordisco Arcano', dmg: 22 },
          { name: 'Tragar Maná', drain: 1, inkCurse: 1 },
          { name: 'Indigestión', charge: 1, chargeHit: 45 }
        ]
      }
    }
  };
  /* Parche 3.2 (combates en grupo): variantes MENORES — mismo arte al 80 % de tamaño, ~60 % de PV y de daño
   * (y de Bloqueo, curación y estados que aplican, mínimo 1). Solo salen en grupos. */
  const MINOR_OF = {
    rataj: ['rata', 'Rata Joven'], lobeznos: ['lobo', 'Lobezno Salvaje'],
    // la Seta Brote no debilita (con 2 o 3 a la vez, el Débil encadenado era demasiado): suelta polen y se escuda
    setab: ['seta', 'Seta Brote', [{ name: 'Polen', block: 6 }, { name: 'Embestida', dmg: 13 }, { name: 'Embestida', dmg: 14 }]],
    murcielagop: ['murcielago', 'Murciélago Pequeño'], huargoj: ['huargo', 'Huargo Joven'],
    fatuom: ['fatuo', 'Fuego Fatuo Menor'], duendem: ['duende', 'Duende Menor']
  };
  for (const [id, [base, name, own]] of Object.entries(MINOR_OF)) {
    const b = ENEMIES[base], sc = (n) => Math.max(1, Math.round(n * 0.6));
    ENEMIES[id] = { name, hp: b.hp.map(sc), art: b.art, tier: 'normal', minor: true, base,
      moves: (own || b.moves).map((m) => { const o = { ...m }; for (const k of ['dmg', 'block', 'chargeHit', 'heal', 'weak', 'chill', 'curse', 'inkCurse', 'str', 'reflect']) if (typeof o[k] === 'number') o[k] = sc(o[k]); return o; }) };
  }

  /* Encuentros por acto. ENCOUNTERS.easy/hard/elite/boss (forma antigua) siguen
   * existiendo como alias del acto 1, por compatibilidad. */
  /* Parche 3.2: ajuste de PV y daño de cada grupo (multiplicadores para TODOS sus miembros, variantes menores incluidas;
   * en las élites en grupo, solo para los acompañantes). Sin entrada: 70 % de PV y 80 % de daño, y las menores como vienen. */
  const GROUP_TUNE = {
    'bandido+rataj': { hp: 0.65, dmg: 0.7 }, 'lobeznos+lobeznos': { hp: 0.75, dmg: 0.7 },
    'cazador+huargoj': { hp: 0.65, dmg: 0.7 },
    'acolito+centinela': { hp: 0.55, dmg: 0.6 }, 'fatuom+fatuom+fatuom': { hp: 0.7, dmg: 0.65 }, 'grimorio+duendem+duendem': { hp: 0.5, dmg: 0.55 },
    // élites en grupo: hp/dmg para los acompañantes; lead, para el líder (que además lleva el afijo)
    'bruja+setab+setab': { hp: 0.45, dmg: 0.5, lead: { hp: 0.8, dmg: 0.9 } }, 'golem+murcielago': { hp: 0.6, dmg: 0.6, lead: { hp: 0.85, dmg: 0.9 } },
    'archimago+acolito': { hp: 0.6, dmg: 0.6, lead: { hp: 0.85, dmg: 0.9 } }
  };
  const ENCOUNTERS_ACT1 = {
    easy: ['rata', 'seta'],
    hard: ['lobo', 'bandido', 'seta', 'lobo'],
    elite: ['treant', 'bruja'],
    // Parche 3.2: grupos (~35 % de los combates normales, desde el 2.º piso) y una élite en grupo (el afijo, solo al líder)
    groups: [['rataj', 'rataj', 'rataj'], ['seta', 'rata'], ['lobeznos', 'lobeznos'], ['bandido', 'rataj']],
    eliteGroups: [['bruja', 'setab', 'setab']],
    boss: 'guardian',                          // el de siempre (partidas antiguas y primer jefe de la lista)
    bosses: ['guardian', 'matriarca', 'alfa']
  };
  const ENCOUNTERS = Object.assign({
    1: ENCOUNTERS_ACT1,
    2: {
      easy: ['murcielago', 'espiritu'],
      hard: ['huargo', 'yeti', 'cazador'],
      elite: ['golem', 'hechicera'],
      groups: [['murcielago', 'murcielago'], ['cazador', 'huargoj'], ['espiritu', 'murcielagop']],
      eliteGroups: [['golem', 'murcielago']],
      boss: 'wyrm',
      bosses: ['wyrm', 'titan', 'espectro']
    },
    3: {
      easy: ['duende', 'fatuo'],
      hard: ['grimorio', 'centinela', 'acolito'],
      elite: ['espejo', 'archimago'],
      groups: [['acolito', 'centinela'], ['fatuom', 'fatuom', 'fatuom'], ['grimorio', 'duendem', 'duendem']],
      eliteGroups: [['archimago', 'acolito']],
      boss: 'ojo',
      bosses: ['ojo', 'lich', 'devorador']
    }
  }, ENCOUNTERS_ACT1);
  const ACTS = { 1: { name: 'Bosque Encantado' }, 2: { name: 'Cumbres de Escarcha' }, 3: { name: 'Caverna Arcana' } };
  const LAST_ACT = 3;
  /** Al pasar al acto N: fracción de la vida QUE FALTA que se recupera (Acto II: toda; Acto III: 75%). */
  const ACT_HEAL = { 2: 1, 3: 0.75 };

  const RELICS = {
    // Neutrales del Parche 2.0 (para todos)
    mapa:       { class: 'any', name: 'Mapa del Cartógrafo', icon: 'question', text: 'Ves qué hay en las salas «?» del mapa (evento, tienda o cofre).' },
    saco:       { class: 'any', name: 'Saco Sin Fondo',      icon: 'bag',      text: 'Las recompensas de carta ofrecen 1 carta más.' },
    moneda:     { class: 'any', name: 'Moneda Trucada',      icon: 'coin',     text: 'Todo en la tienda cuesta un 20 % menos.' },
    brujula2:   { class: 'any', name: 'Brújula Rota',        icon: 'eye',      text: 'Al entrar en una sala de evento, 25 % de que sea un cofre.' },
    reloj2:     { class: 'any', name: 'Reloj Parado',        icon: 'book',     text: 'En los combates de jefe, robas 3 cartas más en el primer turno.' },
    buho:       { class: 'any', name: 'Ojo de Búho',         icon: 'eye',      text: 'Ves también la intención del SIGUIENTE turno del enemigo.' },
    brasero:    { class: 'any', name: 'Brasero Eterno',      icon: 'campfire', text: '+1 Energía en el primer turno de cada combate.' },
    ascua:      { class: 'piromago', name: 'Ascua Viva',          icon: 'flame',    text: 'Empiezas cada combate con 2 de Temperatura.' },
    salamandra: { class: 'piromago', name: 'Ojo de Salamandra',   icon: 'eye',      text: 'Cada vez que aplicas Quemadura, aplicas 1 más.' },
    obsidiana:  { class: 'any', name: 'Corazón de Obsidiana', icon: 'heart',   text: '+10 PV máximos.' },
    urna:       { class: 'any', name: 'Urna de Cenizas',     icon: 'urn',      text: 'Al ganar un combate, recuperas 5 PV.' },
    // Parche 3.2: combates en grupo
    hoz:        { class: 'any', name: 'Hoz de Cosechador',   icon: 'skull',    text: 'Cada vez que matas a un enemigo, +1 Energía.' },
    bombahumo:  { class: 'any', name: 'Bomba de Humo',       icon: 'cloud',    text: 'Al empezar un combate en grupo, el enemigo más fuerte pierde su primer turno.' },
    grimorio:   { class: 'any', name: 'Grimorio Chamuscado', icon: 'book',     text: 'Robas 2 cartas más en el primer turno de cada combate.' },
    fuelle:     { class: 'piromago', name: 'Fuelle de Herrero',   icon: 'flame',    text: 'Cada vez que juegas una carta de coste 0, +1 Temperatura.' },
    termometro: { class: 'piromago', name: 'Termómetro Rúnico',   icon: 'eye',      text: 'El Sobrecalentamiento solo te quita 1 PV.' },
    carbon:     { class: 'piromago', name: 'Carbón Encantado',    icon: 'flame',    text: 'Al empezar cada combate, el enemigo recibe 3 de Quemadura.' },
    escama:     { class: 'piromago', name: 'Escama de Dragón',    icon: 'heart',    text: 'Al final de tu turno, si tienes 3 o más de Temperatura, ganas 4 de Bloqueo.' },
    mecha:      { class: 'any', name: 'Mecha Inagotable',    icon: 'book',     text: 'Cada vez que una carta se Agota, robas 1 carta.' },
    pluma:      { class: 'any', name: 'Pluma de Fénix',      icon: 'campfire', text: 'La primera vez que fueras a morir, renaces con el 25 % de tus PV máximos. Un solo uso.' },
    guante:     { class: 'piromago', name: 'Guante de Lava',      icon: 'burst',    text: 'Tus ataques infligen +2 de daño si tienes 5 o más de Temperatura.' },
    amuleto:    { class: 'piromago', name: 'Amuleto Polar',       icon: 'snow',     text: 'La primera vez en cada combate que un enemigo te reduciría la Temperatura, se anula.' },
    piedra:     { class: 'piromago', name: 'Piedra de Calor',     icon: 'thermo',   text: 'Al final de tu turno, si tienes 0 de Temperatura, ganas 1.' },
    linterna:   { class: 'any', name: 'Linterna de Cristal', icon: 'eye',      text: 'Las Maldiciones se Agotan al robarlas (y robas otra en su lugar).' },
    // Palabras clave
    reloj:      { class: 'any', name: 'Reloj de Arena',      icon: 'urn',      text: 'La primera carta Conservada de cada turno cuesta 1 menos ese turno.' },
    abanico:    { class: 'any', name: 'Abanico Ígneo',       icon: 'burst',    text: 'Cada 3.ª carta que juegas en un turno te hace robar 1 carta.' },
    // Acto III
    prisma:     { class: 'any', name: 'Prisma Arcano',       icon: 'prism',    acts: [3], text: 'La primera vez en cada combate que un enemigo te Drenaría o Silenciaría, se anula.' },
    tomo:       { class: 'any', name: 'Tomo Sellado',        icon: 'book',     acts: [3], text: 'Las recompensas de élite ofrecen 1 carta más.' },
    // Piromago: reliquia inicial
    corazon_ardiente: { class: 'piromago', starter: true, name: 'Corazón Ardiente', icon: 'heart', v: 1, text: 'La primera carta de Ataque de cada combate aplica 1 de Quemadura.' },   // con 3 el Piromago subía +15 puntos en A0; con 1, +2,7
    // Invocadora
    cuerno:     { class: 'invocadora', starter: true, name: 'Cuerno del Bosque', icon: 'horn', text: 'Empiezas cada combate con un Lobezno Espectral invocado.' },
    collar:     { class: 'invocadora', name: 'Collar de Colmillos',  icon: 'claw', v: 3, text: 'Tus criaturas entran con +3 PV.' },
    semilla:    { class: 'invocadora', name: 'Semilla Eterna',       icon: 'leaf', text: 'La primera criatura que muere en cada combate renace con la mitad de sus PV.' },
    tambor:     { class: 'invocadora', name: 'Tambor Tribal',        icon: 'up',   v: 1, text: 'Vínculo 1 permanente.' },
    // Paladín
    medallon:   { class: 'paladin', starter: true, name: 'Medallón del Alba', icon: 'medal', v: 8, text: 'La primera vez en cada combate que bajas del 50 % de tus PV, ganas 8 de Bloqueo.' },
    estandarte: { class: 'paladin', name: 'Estandarte del Alba', icon: 'banner', v: 3, text: 'Cada vez que una carta te da Bloqueo, el enemigo recibe 3 de daño.' },
    relicario:  { class: 'paladin', name: 'Relicario de Fe',     icon: 'medal', v: 0.5, text: 'Una vez por combate, al bajar del 30 % de tus PV, ganas Bloqueo igual al 50 % de tus PV máximos.' },
    cilicioh:   { class: 'paladin', name: 'Cilicio de Hierro',   icon: 'sun', v: 2, text: '+2 de Fervor permanente.' },
    // Electromante
    pararrayos: { class: 'electromante', starter: true, name: 'Pararrayos', icon: 'ebolt', v: 3, text: 'Empiezas cada combate con 3 de Estática. Tu primera Sobrecarga de cada combate inflige +10.' },
    guantecobre: { class: 'electromante', name: 'Guante de Cobre', icon: 'burst', v: 2, text: 'Tus Rayos infligen +2 de daño.' },
    leyden:     { class: 'electromante', name: 'Botella de Leyden', icon: 'flask', v: 5, text: 'Al empezar un combate, conservas hasta 5 de la Estática con la que acabaste el anterior.' },
    varitatesla: { class: 'electromante', name: 'Varita de Tesla', icon: 'coil', text: 'Cada salto de un Rayo te da 1 de Estática.' },
    // Criomante
    piedra_inicial: { class: 'guardiana', starter: true, name: 'Piedra Angular', icon: 'rune_piedra', text: 'Empiezas cada combate con una Runa de Piedra grabada.' },
    cincel:     { class: 'guardiana', name: 'Cincel de Plata',     icon: 'up',   v: 1, text: '+1 Potencia de runa.' },
    anillo:     { class: 'guardiana', name: 'Anillo Resonante',    icon: 'rune', text: 'Cada vez que detonas una runa, robas 1 carta.' },
    cuarta:     { class: 'guardiana', name: 'Cuarta Piedra',       icon: 'rune_piedra', text: '+1 ranura de runa.' },
    corazon_gelido: { class: 'criomante', starter: true, name: 'Corazón Gélido', icon: 'snow', v: 4, text: 'Al empezar cada combate, aplicas 4 de Escarcha.' },
    copo:       { class: 'criomante', name: 'Copo Eterno',         icon: 'snow', v: 10, text: 'La primera vez que congelas al enemigo en cada combate, ganas 10 de Escudo de Hielo.' },
    brujula:    { class: 'criomante', name: 'Brújula Polar',       icon: 'eye',      text: 'Fragmentar y Ruptura infligen un 50 % más de daño.' },
    lagrima:    { class: 'criomante', name: 'Lágrima Glacial',     icon: 'urn',      text: 'El Escudo de Hielo se derrite 1 por turno en vez de 3.' },
    // Pociones
    cinturon:   { class: 'any', name: 'Cinturón de Alquimista', icon: 'flask', text: '+2 huecos de poción (pasas a tener 5).' },
    vapores:    { class: 'piromago', name: 'Vapores Ardientes',   icon: 'fireball', text: 'Al beber una poción en combate, +2 Temperatura.' },
    // Parche 2.7: reliquias nuevas (pool normal)
    brea:       { class: 'piromago', name: 'Frasco de Brea Rúnica', icon: 'flask', v: 0.2, text: 'Los enemigos con Quemadura reciben un 20 % más de daño de tus ataques.' },
    permafrost: { class: 'criomante', name: 'Manto de Permafrost',  icon: 'snow', v: 5, text: 'Cuando un golpe te llega con Escudo de Hielo, el atacante recibe 5 de daño y 1 de Escarcha.' },
    totem:      { class: 'invocadora', name: 'Tótem de Huesos',     icon: 'skull', text: 'Tus criaturas entran con un 25 % más de PV y +1 de ataque.' },
    afilado:    { class: 'any', name: 'Piedra de Afilado',    icon: 'sword', v: 2, text: 'Tus Ataques de coste 1 o más infligen +2 de daño.' },
    inestable:  { class: 'any', name: 'Grimorio Inestable',   icon: 'book',  text: 'Al empezar cada combate, una carta aleatoria de tu personaje llega a tu mano. Cuesta 0 y es Etérea.' },
    efervescente: { class: 'any', name: 'Vial de Maná Efervescente', icon: 'manadrop', text: 'La 5.ª carta que juegas cada turno te da +1 Energía.' },
    consagracion: { class: 'any', name: 'Elixir de Consagración', icon: 'flask', text: 'Al empezar cada combate, la carta más cara de tu mano cuesta 1 menos ese turno.' },
    frascoviento: { class: 'any', name: 'Frasco de Viento',     icon: 'cloud', text: 'Una vez por acto, en el mapa puedes saltar a una sala vecina de la siguiente fila aunque no esté unida a tu camino.' },
    avaricioso: { class: 'any', name: 'Anillo del Avaricioso', icon: 'coin', text: 'La tienda ofrece 1 carta y 1 reliquia más. Los jefes te infligen +2 de daño en cada golpe.' },
    // Parche 2.7: recompensas de logro (bloqueadas hasta conseguirlo; ver REWARD_LOCK)
    prismahelado: { class: 'criomante', name: 'Prisma Helado',   icon: 'prism', text: 'Si el enemigo ya tiene Escarcha, tus cartas le aplican 1 más.' },
    escudoeter: { class: 'any', name: 'Escudo de Éter',       icon: 'shield', v: 0.1, text: 'Al empezar cada combate, ganas Bloqueo igual al 10 % de tus PV actuales.' },
    amuletofenix: { class: 'any', name: 'Amuleto del Fénix',  icon: 'heart', v: 0.2, text: 'Una vez por partida, al recibir un golpe mortal recuperas el 20 % de tus PV máximos y el enemigo pierde su siguiente acción. (Compatible con la Pluma de Fénix).' },
    bolsaabundancia: { class: 'any', name: 'Bolsa de la Abundancia', icon: 'bag', v: 75, text: 'Al conseguirla, +75 de oro.' }
  };

  /* Reliquias de jefe: SOLO en la elección tras vencer al Guardián.
   * Nunca en tiendas, cofres, recompensas ni eventos (esos usan RELICS). */
  /** Reliquias de jefe: `good` (ventaja) y `bad` (pega) se muestran por separado en la elección;
   *  `text` es la descripción completa que usa el resto de la UI (HUD, tooltips). */
  const BOSS_RELICS = {
    corona:     { class: 'any', name: 'Corona de Brasas',    icon: 'crown', good: '+1 Energía por turno.',
                  bad: 'Empiezas cada combate con 1 Escalofrío en tu mazo de robo.' },
    nucleo:     { class: 'any', name: 'Núcleo Solar',        icon: 'spark', good: '+1 Energía por turno.',
                  bad: 'Las hogueras ya no curan (solo puedes mejorar).' },
    caliz:      { class: 'piromago', name: 'Cáliz Ardiente',      icon: 'urn',   good: 'Al empezar cada combate: +3 Temperatura y el enemigo recibe 5 de Quemadura.',
                  bad: 'Pierdes 3 PV al empezar cada combate.' },
    librollama: { class: 'piromago', name: 'Libro Prohibido',     icon: 'book',  good: 'Robas 1 carta más cada turno.',
                  bad: 'Te Sobrecalientas con 1 de Temperatura menos.' },
    brasaguard: { class: 'any', name: 'Brasa del Guardián',  icon: 'heart', good: '+15 PV máximos.',
                  bad: 'Las recompensas de carta ofrecen 2 cartas en vez de 3.' }
  };
  for (const r of Object.values(BOSS_RELICS)) r.text = `${r.good} ${r.bad}`;
  /** Todas las reliquias (normales + de jefe), para mostrar cualquiera que tenga el jugador. */
  const ALL_RELICS = Object.assign({}, RELICS, BOSS_RELICS);

  const NODE_TYPES = {
    combat: { name: 'Combate', desc: 'Enfréntate a un enemigo.' },
    elite:  { name: 'Élite',   desc: 'Un enemigo poderoso. Da una reliquia como recompensa.' },
    event:  { name: 'Evento',  desc: 'Un encuentro con decisiones.' },
    shop:   { name: 'Tienda',  desc: 'Compra cartas y reliquias o purga tu mazo.' },
    rest:   { name: 'Hoguera', desc: 'Descansa o mejora una carta.' },
    chest:  { name: 'Cofre',   desc: 'Una reliquia te espera.' },
    boss:   { name: 'Jefe',    desc: 'El jefe de este acto.' }
  };

  /* Eventos: cada opción recibe (run, api) y devuelve { text, pick? }.
   * api = utilidades del motor (curar, perder PV, oro, cartas, reliquias, azar).
   * acts: en qué actos puede salir el evento. */
  /* ------------------------------------------------------------------ *
   * POCIONES: un solo uso. Se guardan en los huecos del cinturón (run.potions).
   *   rarity: common | uncommon | rare · color: líquido (0xRRGGBB)
   *   shape: 'redondo' | 'vial' | 'cuadrado' (forma del frasco dibujado)
   *   target: 'combat' (solo en tu turno) | 'any' (también fuera de combate)
   *   fx: operación del motor (usePotion) y sus valores
   * ------------------------------------------------------------------ */
  const POTIONS = {
    // Comunes
    fuego:   { class: 'any', name: 'Poción de Fuego',      rarity: 'common',   color: 0xe8452c, shape: 'redondo',  target: 'combat', fx: 'damage', v: 20, text: 'Inflige 20 de daño.' },
    bloqueo: { class: 'any', name: 'Poción de Piedra',     rarity: 'common',   color: 0x9a9384, shape: 'cuadrado', target: 'combat', fx: 'block',  v: 12, text: 'Gana 12 de Bloqueo.' },
    ascuas:  { class: 'piromago', name: 'Frasco de Ascuas',     rarity: 'common',   color: 0xff8a1e, shape: 'vial',     target: 'combat', fx: 'burn',   v: 8,  text: 'Aplica 8 de Quemadura.' },
    energia: { class: 'any', name: 'Elixir de Energía',    rarity: 'common',   color: 0xc6ec3c, shape: 'vial',     target: 'combat', fx: 'energy', v: 2,  text: '+2 Energía.' },
    robo:    { class: 'any', name: 'Tinta Veloz',          rarity: 'common',   color: 0x3e64d6, shape: 'cuadrado', target: 'combat', fx: 'draw',   v: 3,  text: 'Roba 3 cartas.' },
    helada:  { class: 'piromago', name: 'Agua Helada',          rarity: 'common',   color: 0x8fe3ff, shape: 'redondo',  target: 'combat', fx: 'vent',   v: 2,  text: 'Pierde toda tu Temperatura y gana el doble en Bloqueo.' },
    // Poco comunes
    salam:   { class: 'piromago', name: 'Sangre de Salamandra', rarity: 'uncommon', color: 0xa3122e, shape: 'vial',     target: 'combat', fx: 'double',        text: 'Duplica la Quemadura del enemigo.' },
    cura:    { class: 'any', name: 'Poción Curativa',      rarity: 'uncommon', color: 0x4fd36a, shape: 'redondo',  target: 'any',    fx: 'heal',   v: 0.2, text: 'Recupera el 20 % de tus PV máximos. También fuera de combate.' },
    ignea:   { class: 'piromago', name: 'Esencia Ígnea',        rarity: 'uncommon', color: 0xffb02e, shape: 'cuadrado', target: 'combat', fx: 'ignite', v: 5,  text: '+5 Temperatura. Este turno no te Sobrecalientas.' },
    caos:    { class: 'any', name: 'Poción de Caos',       rarity: 'uncommon', color: 0x9b5de5, shape: 'redondo',  target: 'combat', fx: 'chaos',  v: 3,  text: 'Añade 3 cartas aleatorias a tu mano. Cuestan 0 este turno.' },
    // Raras
    explosivo: { class: 'any', name: 'Frasco Explosivo',   rarity: 'common',   color: 0xff9a3c, shape: 'redondo',  target: 'combat', fx: 'damageAll', v: 10, text: 'Inflige 10 de daño a todos los enemigos.' },
    fenixp:  { class: 'any', name: 'Lágrima de Fénix',     rarity: 'rare',     color: 0xff6a3d, shape: 'vial',     target: 'any',    fx: 'heal',   v: 0.3, text: 'Recupera el 30 % de tus PV máximos. Si fueras a morir mientras la llevas, se bebe sola y renaces con ese 30 %.' },
    ventiscapo: { class: 'criomante', name: 'Frasco de Ventisca', rarity: 'common', color: 0xbfe6ff, shape: 'vial', target: 'combat', fx: 'frost', v: 6, text: 'Aplica 6 de Escarcha.' },
    tintarunica: { class: 'guardiana', name: 'Tinta Rúnica', rarity: 'common', color: 0xd9a55a, shape: 'vial', target: 'combat', fx: 'runes', v: 2, text: 'Graba 2 runas aleatorias.' },
    polvocantera: { class: 'guardiana', name: 'Polvo de Cantera', rarity: 'uncommon', color: 0xb9b2a3, shape: 'cuadrado', target: 'combat', fx: 'runePower', v: 2, text: '+2 Potencia de runa este combate.' },
    elixirsalvaje: { class: 'invocadora', name: 'Elixir Salvaje', rarity: 'common', color: 0x5fd07a, shape: 'vial', target: 'combat', fx: 'summons', text: 'Invoca un Lobezno Espectral y un Hada de Espinas.' },
    rociobosque: { class: 'invocadora', name: 'Rocío del Bosque', rarity: 'uncommon', color: 0x9ff0c0, shape: 'redondo', target: 'combat', fx: 'healSummons', v: 10, text: 'Cura 10 PV a todas tus criaturas.' },
    aguabendita: { class: 'paladin', name: 'Agua Bendita', rarity: 'common', color: 0xbfe4ff, shape: 'redondo', target: 'any', fx: 'healFlat', v: 15, text: 'Recupera 15 PV. También fuera de combate.' },
    aceiteuncion: { class: 'paladin', name: 'Aceite de Unción', rarity: 'common', color: 0xf2d36b, shape: 'vial', target: 'combat', fx: 'judge', v: 5, text: 'Aplica 5 de Juicio.' },
    rayoemb: { class: 'electromante', name: 'Rayo Embotellado', rarity: 'common', color: 0x7fd6ff, shape: 'vial', target: 'combat', fx: 'damageAll', v: 12, text: 'Inflige 12 de daño a todos los enemigos.' },
    electrolito: { class: 'electromante', name: 'Electrolito', rarity: 'uncommon', color: 0xffe066, shape: 'redondo', target: 'combat', fx: 'electrolyte', v: 5, text: '+5 Estática y roba 2 cartas.' },
    hieloliq: { class: 'criomante', name: 'Hielo Líquido',       rarity: 'uncommon', color: 0x6fc3ff, shape: 'cuadrado', target: 'combat', fx: 'ice', v: 15, text: 'Gana 15 de Escudo de Hielo.' },
    manapuro: { class: 'any', name: 'Elixir de Maná Puro', rarity: 'rare', color: 0x7fe7ff, shape: 'vial', target: 'combat', fx: 'freeHand', text: 'Las cartas de tu mano cuestan 0 este turno.' },
    furia:   { class: 'any', name: 'Furia Volcánica',      rarity: 'rare',     color: 0xd81b1b, shape: 'cuadrado', target: 'combat', fx: 'fury',          text: 'Este turno, tus ataques infligen el doble de daño.' }
  };
  /** Probabilidad de cada rareza al sortear una poción (botín, tienda, eventos). */
  const POTION_ODDS = [['common', 65], ['uncommon', 25], ['rare', 10]];
  const POTION_RARITY_LABEL = { common: 'Común', uncommon: 'Poco común', rare: 'Rara' };

  /* Recompensas de logro: id (carta, reliquia o poción) → logro que la desbloquea (meta.js → ACHIEVEMENTS.reward).
   * Mientras el jugador no tenga el logro, el motor nunca las ofrece (recompensas, tiendas, cofres, eventos, pociones…).
   * Ids únicos entre cartas, reliquias y pociones. */
  const REWARD_LOCK = {
    combustionesp: 'rojo', prismahelado: 'ceroabsoluto', sinfonia: 'ejercito', escudoeter: 'muralla', manapuro: 'calcinada',
    amuletofenix: 'creyente', bolsaabundancia: 'ahorro', auraarcana: 'dominio', cataclismo: 'devastador'
  };
  /** Rareza legendaria: 2% por carta en recompensas de élite y jefe; nunca en tiendas. */
  const LEGENDARY_CHANCE = 0.02;

  const EVENTS = {
    // ---------- Acto III: Caverna Arcana ----------
    biblioteca: {
      acts: [3],
      title: 'Biblioteca Olvidada',
      text: 'Estanterías de cristal violeta se pierden en la oscuridad. Los tomos susurran cuando pasas: algunos piden ser leídos; otros, ser olvidados.',
      choices: [
        { label: 'Leer un tomo', desc: 'Pierdes 6 PV. Eliges 1 de 3 cartas raras.',
          cond: (run) => run.hp > 6, condText: 'Necesitas más de 6 PV.',
          run: (run, api) => { api.loseHp(6); return { text: _m('d.las_letras_arden_en_tus'), pick: 'choose', count: 1, options: api.offerCards('rare', 3) }; } },
        { label: 'Quemar los libros', desc: 'Quitas 2 cartas a elegir de tu mazo.',
          cond: (run) => run.deck.length >= 3, condText: 'Necesitas al menos 3 cartas.',
          run: () => ({ text: _m('d.las_paginas_se_retuercen_en'), pick: 'remove', count: 2 }) },
        { label: 'Irse', desc: '',
          run: () => ({ text: _m('d.los_susurros_te_siguen_un') }) }
      ]
    },
    fuentemana: {
      acts: [3],
      title: 'Fuente de Maná',
      text: 'Un manantial de luz líquida brota de la roca. Su zumbido te eriza la piel: es magia pura.',
      choices: [
        { label: 'Beber', desc: '+1 Energía en el primer turno de tus 3 próximos combates.',
          run: (run) => { run.manaFont = 3; return { text: _m('d.el_mana_te_recorre_las') }; } },
        { label: 'Embotellarla', desc: 'Una poción rara.',
          run: (run, api) => { const id = api.randomPotion('rare'); const ok = api.addPotion(id); return { text: ok ? _m('d.llenas_un_frasco_de_luz', { 0: api.potionLabel(id) }) : _m('d.llenas_un_frasco_pero_no') }; } },
        { label: 'Irse', desc: '',
          run: () => ({ text: _m('d.hay_poderes_que_es_mejor') }) }
      ]
    },
    pactoabismo: {
      acts: [3],
      title: 'El Pacto del Abismo',
      text: 'Una voz sin boca te habla desde la grieta: «Un tesoro de reyes a cambio de unas pocas líneas en tu libro. Unas líneas que no podrás borrar».',
      choices: [
        { label: 'Aceptar', desc: 'Una reliquia de jefe al azar. Recibes 2 Garabatos en tu mazo.',
          run: (run, api) => {
            const id = api.randomBossRelic();
            api.addCard('garabato'); api.addCard('garabato');
            if (id) api.addRelic(id);
            return { text: id ? _m('d.la_tinta_se_te_mete', { 0: api.relicLabel(id) }) : _m('d.la_voz_se_rie_no') };
          } },
        { label: 'Rechazar', desc: '',
          run: () => ({ text: _m('d.volveras_dice_la_voz_la') }) }
      ]
    },
    altar: {
      acts: [1],
      title: 'Altar de las Brasas',
      text: 'Entre raíces ennegrecidas, un altar arde sin consumirse. Las llamas parecen esperar una ofrenda.',
      choices: [
        { label: 'Ofrecer sangre', desc: 'Pierdes 7 PV. Obtienes una carta rara.',
          run: (run, api) => { api.loseHp(7); const id = api.randomCard('rare'); api.addCard(id); return { text: _m('d.el_altar_acepta_tu_sangre', { 0: api.cardLabel(id) }) }; } },
        { label: 'Rezar', desc: 'Recuperas 12 PV.',
          run: (run, api) => { api.heal(12); return { text: _m('d.el_calor_del_altar_cierra') }; } },
        { label: 'Marcharse', desc: '',
          run: () => ({ text: _m('d.dejas_que_el_fuego_siga') }) }
      ]
    },
    mercader: {
      acts: [1],
      title: 'Mercader Errante',
      text: 'Un hombrecillo con una mochila enorme te cierra el paso. «Reliquias auténticas, casi sin maldecir».',
      choices: [
        { label: 'Comprar (60 de oro)', desc: 'Obtienes una reliquia al azar.',
          cond: (run) => run.gold >= 60 && !(run.pacts || []).includes('bolsillos'),
          condText: 'Necesitas 60 de oro (y no tener el pacto Bolsillos rotos).',
          run: (run, api) => { api.gold(-60); const r = api.randomRelic(); if (r) { api.addRelic(r); return { text: _m('d.te_vende_0_parece_autentica', { 0: api.relicLabel(r) }) }; } api.gold(60); return { text: _m('d.no_le_queda_nada_que') }; } },
        { label: 'Robarle', desc: '50 %: +70 de oro. 50 %: pierdes 10 PV.',
          run: (run, api) => { if (api.chance(0.5)) { api.gold(70); return { text: _m('d.te_escabulles_con_su_bolsa') }; } api.loseHp(10); return { text: _m('d.te_pilla_su_baston_pesa') }; } },
        { label: 'Pedir fiado', desc: 'Una reliquia al azar ahora. Alguien vendrá a cobrar.', show: (run) => run.gold < 60 && !(run.pacts || []).includes('bolsillos'),
          run: (run, api) => { const r = api.randomRelic(); if (!r) return { text: _m('d.no_le_queda_nada_que') }; api.addRelic(r); api.setFlag('deuda', 'debe'); return { text: _m('rj.ev.mercader.debt', { 0: api.relicLabel(r) }) }; } },
        { label: 'Ignorarlo', desc: '',
          run: () => ({ text: _m('d.sigues_tu_camino_mientras_te') }) }
      ]
    },
    fuente: {
      acts: [1],
      title: 'Fuente Encantada',
      text: 'El agua brilla con un frío antinatural. Tu fuego interior se encoge al acercarte.',
      choices: [
        { label: 'Beber', desc: 'Recuperas todos tus PV. Recibes un Escalofrío (Maldición) en tu mazo.',
          run: (run, api) => { api.heal(run.maxHp); api.addCard('escalofrio'); return { text: _m('d.te_sientes_como_nuevo_pero') }; } },
        { label: 'Purificar una carta', desc: 'Eliminas una carta de tu mazo.',
          run: () => ({ text: _m('d.sumerges_una_carta_en_el'), pick: 'remove' }) },
        { label: 'Seguir adelante', desc: '',
          run: () => ({ text: _m('d.el_frio_te_sigue_unos') }) }
      ]
    },
    hongos: {
      acts: [1],
      title: 'Círculo de Hongos',
      text: 'Hongos luminosos forman un anillo perfecto. Huelen a canela y a mala idea.',
      choices: [
        { label: 'Comer uno', desc: '50 %: +6 PV máximos. 50 %: pierdes 8 PV.',
          run: (run, api) => { if (api.chance(0.5)) { api.maxHp(6); return { text: _m('d.una_calidez_extrana_te_fortalece') }; } api.loseHp(8); return { text: _m('d.mala_idea_como_prometia_el') }; } },
        { label: 'Recolectar', desc: 'Ganas 25 de oro.',
          run: (run, api) => { api.gold(25); return { text: _m('d.algun_alquimista_pagara_bien_por') }; } },
        { label: 'Pasar de largo', desc: '',
          run: () => ({ text: _m('d.los_hongos_parpadean_ofendidos') }) }
      ]
    },
    forja: {
      acts: [1],
      title: 'Forja Abandonada',
      text: 'Un yunque cubierto de musgo y unas brasas que, de algún modo, siguen vivas. Alguien forjó aquí hace mucho.',
      choices: [
        { label: 'Avivar la forja', desc: 'Pierdes 6 PV. Mejoras 2 cartas al azar.',
          run: (run, api) => {
            api.loseHp(6);
            const ups = [api.upgradeRandom(), api.upgradeRandom()].filter(Boolean);
            if (!ups.length) return { text: _m('d.tus_manos_arden_sobre_el') };
            return { text: _m('d.tus_manos_arden_sobre_el_2', { 0: api.upList(ups) }) };
          } },
        { label: 'Rebuscar entre la chatarra', desc: 'Ganas 35 de oro.',
          run: (run, api) => { api.gold(35); return { text: _m('d.herramientas_viejas_pero_de_buen') }; } },
        { label: 'Marcharse', desc: '',
          run: () => ({ text: _m('d.las_brasas_se_apagan_a') }) }
      ]
    },
    ermitano: {
      acts: [1],
      title: 'Ermitaño del Musgo',
      text: 'Un anciano cubierto de liquen te observa desde un tronco hueco. «El Guardián no odia el fuego. Odia lo que el fuego olvida».',
      choices: [
        { label: 'Escuchar su historia', desc: 'Obtienes una carta poco común al azar.',
          run: (run, api) => { const id = api.randomCard('uncommon'); api.addCard(id); return { text: _m('d.te_habla_de_piromagos_que', { 0: api.cardLabel(id) }) }; } },
        { label: 'Darle comida (30 de oro)', desc: 'Pierdes 30 de oro. +7 PV máximos.', cond: (run) => run.gold >= 30,
          run: (run, api) => { api.gold(-30); api.maxHp(7); return { text: _m('d.comparte_contigo_una_infusion_de') }; } },
        { label: 'Seguir', desc: '',
          run: () => ({ text: _m('d.volveras_murmura_no_suena_a') }) }
      ]
    },
    lobezno: {
      acts: [1],
      title: 'Lobezno Atrapado',
      text: 'Un cachorro de lobo sombrío gime con la pata atrapada entre raíces. Desde la espesura, unos ojos azules te vigilan.',
      choices: [
        { label: 'Liberarlo', desc: 'Pierdes 5 PV. Obtienes una reliquia al azar.',
          run: (run, api) => {
            api.loseHp(5);
            const r = api.randomRelic();
            if (r) { api.addRelic(r); return { text: _m('d.te_muerde_al_soltarlo_mas', { 0: api.relicLabel(r) }) }; }
            api.gold(40);   // ya tienes todas las reliquias
            return { text: _m('d.te_muerde_al_soltarlo_mas_2') };
          } },
        { label: 'Quitarle el collar de plata', desc: 'Ganas 50 de oro. Recibes un Escalofrío (Maldición) en tu mazo.',
          run: (run, api) => { api.gold(50); api.addCard('escalofrio'); return { text: _m('d.plata_buena_pero_los_aullidos') }; } },
        { label: 'Dejarlo', desc: '',
          run: () => ({ text: _m('d.los_ojos_azules_te_siguen') }) }
      ]
    },
    cofre: {
      acts: [1],
      title: 'Cofre Musgoso',
      text: 'Un cofre a medio enterrar respira. Lenta, muy lentamente.',
      choices: [
        { label: 'Abrirlo', desc: '60 %: una reliquia. 40 %: es un mímico y pierdes 12 PV.',
          run: (run, api) => {
            if (api.chance(0.6)) {
              const r = api.randomRelic();
              if (r) { api.addRelic(r); return { text: _m('d.solo_era_el_viento_dentro', { 0: api.relicLabel(r) }) }; }
              api.gold(40);
              return { text: _m('d.solo_era_el_viento_dentro_2') };
            }
            api.loseHp(12);
            return { text: _m('d.el_cofre_tiene_dientes') };
          } },
        { label: 'Quemarlo desde lejos', desc: 'Ganas 20 de oro.',
          run: (run, api) => { api.gold(20); return { text: _m('d.algo_chilla_dentro_entre_las') }; } },
        { label: 'Mirar con cuidado', desc: 'Dentro hay un huevo caliente. Te lo llevas.',
          run: (run, api) => { api.setFlag('huevo', true); return { text: _m('rj.ev.cofre.egg') }; } },
        { label: 'Alejarse despacio', desc: '',
          run: () => ({ text: _m('d.juras_que_el_cofre_suspira') }) }
      ]
    },
    estatua: {
      acts: [1], onlyBoss: 'guardian',   // solo sale si el jefe de este acto es el Guardián (la ofrenda/saqueo solo le afecta a él)
      title: 'Estatua del Guardián',
      text: 'Una talla de piedra con astas de madera preside un claro lleno de ofrendas. Las runas de su pecho brillan al verte.',
      choices: [
        { label: 'Dejar una ofrenda (40 de oro)', desc: 'Pierdes 40 de oro. El Guardián tendrá 15 PV menos.', cond: (run) => run.gold >= 40,
          run: (run, api) => { api.gold(-40); api.bossMod('hp', -15); return { text: _m('d.las_runas_se_apagan_un') }; } },
        { label: 'Saquear las ofrendas', desc: 'Ganas 70 de oro. El Guardián empezará con 2 de Fuerza.',
          run: (run, api) => { api.gold(70); api.bossMod('str', 2); return { text: _m('d.llenas_la_bolsa_muy_lejos') }; } },
        { label: 'Hacer una reverencia', desc: '',
          run: () => ({ text: _m('d.la_estatua_no_responde_o') }) }
      ]
    },

    // ================= Acto II =================
    alquimista: {
      acts: [1, 2],
      title: 'El Alquimista Errante',
      text: 'Un anciano empuja un carro tintineante lleno de frascos humeantes. «¿Un trago para el camino, joven mago?»',
      choices: [
        { label: 'Comprar un frasco (40 de oro)', desc: 'Una poción al azar.',
          cond: (run) => run.gold >= 40 && (run.potions || []).some((p) => !p), condText: 'Necesitas 40 de oro y un hueco libre en el cinturón.',
          run: (run, api) => { api.gold(-40); const id = api.randomPotion(); api.addPotion(id); return { text: _m('d.el_anciano_te_tiende_un', { 0: api.potionLabel(id) }) }; } },
        { label: 'Beber la mezcla misteriosa', desc: '50 %: recuperas 15 PV y ganas una poción rara. 50 %: pierdes 8 PV.',
          run: (run, api) => {
            if (api.chance(0.5)) {
              api.heal(15); const id = api.randomPotion('rare');
              return { text: api.addPotion(id) ? _m('d.delicioso_15_pv_y_te', { 0: api.potionLabel(id) }) : _m('d.delicioso_15_pv_te_ofrece', { 0: api.potionLabel(id) }) };
            }
            api.loseHp(8); return { text: _m('d.sabe_a_rayos_y_a') };
          } },
        { label: 'Seguir adelante', desc: '',
          run: () => ({ text: _m('d.el_tintineo_del_carro_se') }) }
      ]
    },
    lago: {
      acts: [2],
      title: 'Lago Helado',
      text: 'Bajo una capa de hielo transparente se mueven sombras plateadas. El frío muerde a través de tus botas.',
      choices: [
        { label: 'Pescar bajo el hielo', desc: '50 %: una carta rara. 50 %: pierdes 8 PV.',
          run: (run, api) => { if (api.chance(0.5)) { const id = api.randomCard('rare'); api.addCard(id); return { text: _m('d.algo_brillante_muerde_el_anzuelo', { 0: api.cardLabel(id) }) }; } api.loseHp(8); return { text: _m('d.el_hielo_cruje_y_caes') }; } },
        { label: 'Derretir el hielo con fuego', desc: 'Pierdes 6 PV. Obtienes una reliquia al azar.',
          run: (run, api) => { api.loseHp(6); const r = api.randomRelic(); if (r) { api.addRelic(r); return { text: _m('d.el_vapor_te_quema_las', { 0: api.relicLabel(r) }) }; } api.gold(40); return { text: _m('d.el_vapor_te_quema_las_2') }; } },
        { label: 'Seguir adelante', desc: '',
          run: () => ({ text: _m('d.las_sombras_te_siguen_bajo') }) }
      ]
    },
    hoguera2: {
      acts: [2],
      title: 'Hoguera Abandonada',
      text: 'Unas brasas mortecinas resisten entre la nieve. Alrededor, huellas que se alejan a toda prisa.',
      choices: [
        { label: 'Descansar', desc: 'Recuperas el 20 % de tus PV máximos. Recibes un Escalofrío (Maldición) en tu mazo.',
          run: (run, api) => { api.heal(Math.round(run.maxHp * 0.2)); api.addCard('escalofrio'); return { text: _m('d.duermes_un_rato_junto_al') }; } },
        { label: 'Avivarla', desc: 'Pierdes 10 PV. Mejoras 2 cartas al azar.',
          run: (run, api) => {
            api.loseHp(10);
            const ups = [api.upgradeRandom(), api.upgradeRandom()].filter(Boolean);
            return { text: ups.length ? _m('d.las_llamas_te_devuelven_la', { 0: api.upList(ups) }) : _m('d.las_llamas_rugen_pero_no') };
          } },
        { label: 'Seguir adelante', desc: '',
          run: () => ({ text: _m('d.dejas_las_brasas_apagarse_solas') }) }
      ]
    },
    mercader2: {
      acts: [2],
      title: 'Mercader Congelado',
      text: 'El mercader del bosque está atrapado en un bloque de hielo, con la mochila todavía a la espalda.',
      choices: [
        { label: 'Descongelarlo', desc: 'Pierdes 8 PV. Te regala 100 de oro.',
          run: (run, api) => { api.loseHp(8); api.gold(100); return { text: _m('d.por_fin_tome_tome_y') }; } },
        { label: 'Saquear su mochila', desc: 'Obtienes una carta rara. Recibes 2 Escalofríos (Maldición) en tu mazo.',
          run: (run, api) => { const id = api.randomCard('rare'); api.addCard(id); api.addCard('escalofrio'); api.addCard('escalofrio'); return { text: _m('d.te_llevas_0_sus_ojos', { 0: api.cardLabel(id) }) }; } },
        { label: 'Dejarlo en paz', desc: '',
          run: () => ({ text: _m('d.quiza_el_deshielo_le_llegue') }) }
      ]
    },
    altar2: {
      acts: [2],
      title: 'Altar de Hielo y Fuego',
      text: 'Media piedra arde, media está cubierta de escarcha. Una voz pregunta qué estás dispuesto a dar.',
      choices: [
        { label: 'Ofrecer calor', desc: 'Pierdes 5 PV máximos. Eliminas todas tus Maldiciones y mejoras 1 carta al azar.',
          cond: (run) => run.deck.some((c) => CARDS[c.id] && CARDS[c.id].type === 'curse'), condText: 'Necesitas alguna Maldición en tu mazo.',
          run: (run, api) => { api.loseMaxHp(5); const n = api.removeCurses(); const up = api.upgradeRandom(); return { text: I18N.msg(up ? 'ev.altar2.heatUp' : 'ev.altar2.heat', { n, c: api.cardRef(up, true) }) }; } },
        { label: 'Ofrecer frío', desc: 'Recibes un Escalofrío (Maldición) en tu mazo. Obtienes una reliquia al azar.',
          run: (run, api) => { api.addCard('escalofrio'); const r = api.randomRelic(); if (r) { api.addRelic(r); return { text: _m('d.la_escarcha_te_cubre_el', { 0: api.relicLabel(r) }) }; } api.gold(40); return { text: _m('d.la_escarcha_te_cubre_el_2') }; } },
        { label: 'Marcharse', desc: '',
          run: () => ({ text: _m('d.la_voz_se_rie_mitad') }) }
      ]
    },

    /* ---- Eventos de texto (pase 2) ---- */
    jugador: {
      acts: [1, 2],
      title: 'El Jugador de Cartas',
      text: 'Un tahúr de sonrisa torcida baraja junto al fuego. «Una mano, viajero. Solo una. ¿Qué te juegas?»',
      choices: [
        { label: 'Apostar 50 de oro', desc: '50 %: ganas 120 de oro. 50 %: pierdes los 50.',
          cond: (run) => run.gold >= 50, condText: 'Necesitas 50 de oro.',
          run: (run, api) => {
            api.gold(-50);
            if (api.chance(0.5)) { api.gold(120); return { text: _m('d.escalera_de_llamas_el_tahur') }; }
            return { text: _m('d.su_ultima_carta_ya_estaba') };
          } },
        { label: 'Apostar una carta al azar de tu mazo', desc: '50 %: recibes una carta rara. 50 %: se queda con la tuya.',
          cond: (run) => run.deck.filter((c) => c.id !== 'escalofrio').length >= 2, condText: 'Necesitas al menos 2 cartas que apostar.',
          run: (run, api) => {
            if (api.chance(0.5)) { const id = api.randomCard('rare'); api.addCard(id); return { text: _m('d.ganas_la_mano_te_entrega', { 0: api.cardLabel(id) }) }; }
            const lost = api.removeRandomCard();
            return { text: _m('d.pierdes_la_mano_se_guarda', { 0: api.cardLabel(lost) }) };
          } },
        { label: 'No jugar', desc: '',
          run: () => ({ text: _m('d.otra_vez_sera_dice_y') }) }
      ]
    },
    espejo: {
      acts: [1, 2],
      title: 'Espejo Encantado',
      text: 'Un espejo de marco retorcido cuelga de una rama. Tu reflejo tarda un instante de más en imitarte.',
      choices: [
        { label: 'Asomarse', desc: 'Pierdes 7 PV. Duplicas una carta a elegir.',
          cond: (run) => run.deck.some((c) => c.id !== 'escalofrio'), condText: 'No tienes cartas que duplicar.',
          run: (run, api) => { api.loseHp(7); return { text: _m('d.tu_reflejo_alarga_la_mano'), pick: 'duplicate', count: 1 }; } },
        { label: 'Romperlo', desc: 'Recibes un Escalofrío (Maldición) en tu mazo. Obtienes una reliquia al azar.',
          run: (run, api) => {
            api.addCard('escalofrio');
            const r = api.randomRelic();
            if (r) { api.addRelic(r); return { text: _m('d.el_cristal_estalla_en_mil', { 0: api.relicLabel(r) }) }; }
            api.gold(40); return { text: _m('d.el_cristal_estalla_en_mil_2') };
          } },
        { label: 'Irse', desc: '',
          run: () => ({ text: _m('d.al_darte_la_vuelta_juras') }) }
      ]
    },
    recuerdos: {
      acts: [2],
      title: 'El Mercader de Recuerdos',
      text: 'Una figura encapuchada vende frascos llenos de niebla. «Puedo quitarte lo que sobra… o devolverte lo que olvidaste».',
      choices: [
        { label: 'Olvidar (30 de oro)', desc: 'Pierdes 30 de oro. Quitas 2 cartas a elegir de tu mazo.',
          cond: (run) => run.gold >= 30 && run.deck.length >= 3, condText: 'Necesitas 30 de oro y al menos 3 cartas.',
          run: (run, api) => { api.gold(-30); return { text: _m('d.destapa_un_frasco_vacio_elige'), pick: 'remove', count: 2 }; } },
        { label: 'Recordar', desc: 'Pierdes 6 PV máximos. Mejoras 2 cartas al azar.',
          cond: (run) => run.deck.some((c) => !c.up && CARDS[c.id] && !!CARDS[c.id].up), condText: 'No te quedan cartas que mejorar.',
          run: (run, api) => {
            api.loseMaxHp(6);
            const ups = [api.upgradeRandom(), api.upgradeRandom()].filter(Boolean);
            return { text: _m('d.la_niebla_te_devuelve_lecciones', { 0: api.upList(ups) }) };
          } },
        { label: 'Irse', desc: '',
          run: () => ({ text: _m('d.todos_vuelven_susurra_aunque_no') }) }
      ]
    },
    arbol: {
      acts: [1],
      title: 'Árbol de los Deseos',
      text: 'De cada rama de un roble enorme cuelgan cintas de colores. Tres frutos dorados brillan a tu alcance. Solo puedes tomar uno: los demás se marchitarán.',
      choices: [
        { label: 'Pedir salud', desc: '+8 PV máximos.',
          run: (run, api) => { api.maxHp(8); return { text: _m('d.el_fruto_sabe_a_miel') }; } },
        { label: 'Pedir poder', desc: 'Una carta poco común a elegir entre 3.',
          run: (run, api) => ({ text: _m('d.el_fruto_se_abre_como'), pick: 'choose', count: 1, options: api.offerCards('uncommon', 3) }) },
        { label: 'Pedir riqueza', desc: '+75 de oro.',
          run: (run, api) => { api.gold(75); return { text: _m('d.el_fruto_es_de_oro') }; } }
      ]
    },
    sacrificio: {
      acts: [1, 2],
      title: 'Altar del Sacrificio',
      text: 'Una losa manchada de rojo, rodeada de velas que nadie enciende. Una inscripción: «Todo se paga».',
      choices: [
        { label: 'Sacrificar sangre', desc: 'Pierdes el 25 % de tus PV actuales. Obtienes una reliquia al azar.',
          cond: (run) => run.hp >= 4, condText: 'Te quedan muy pocos PV.',
          run: (run, api) => {
            const lost = api.loseHp(Math.max(1, Math.floor(run.hp * 0.25)));
            const r = api.randomRelic();
            if (r) { api.addRelic(r); return { text: _m('d.las_velas_se_encienden_solas', { 0: lost, 1: api.relicLabel(r) }) }; }
            api.gold(40); return { text: _m('d.las_velas_se_encienden_solas_2', { 0: lost }) };
          } },
        { label: 'Sacrificar oro', desc: 'Pierdes todo tu oro (mínimo 40). Obtienes una reliquia al azar.',
          cond: (run) => run.gold >= 40, condText: 'Necesitas al menos 40 de oro.',
          run: (run, api) => {
            const r = api.randomRelic();
            if (!r) return { text: _m('d.la_losa_no_acepta_tu') };
            const g = run.gold; api.gold(-g); api.addRelic(r);
            return { text: _m('d.las_monedas_se_funden_en', { 0: g, 1: api.relicLabel(r) }) };
          } },
        { label: 'Rezar', desc: 'Recuperas 10 PV.',
          run: (run, api) => { api.heal(10); return { text: _m('d.una_calma_extrana_te_recorre') }; } }
      ]
    },
    grieta: {
      acts: [2],
      title: 'La Grieta',
      text: 'Una niebla espesa sale de una grieta en la roca. Al otro lado se oye el viento de las cumbres: es un atajo… si te atreves.',
      choices: [
        { label: 'Atravesarla', desc: 'Saltas a la fila anterior al jefe. Empiezas el próximo combate con 2 Escalofríos en la mano.',
          run: (run, api) => { api.warpToBossRow(); api.nextCombatCurses(2); return { text: _m('d.la_niebla_te_muerde_los') }; } },
        { label: 'Rodearla', desc: 'Pierdes 5 PV.',
          run: (run, api) => { api.loseHp(5); return { text: _m('d.das_un_largo_rodeo_entre') }; } }
      ]
    }
  };

  /* Notas de parche (pantalla «Novedades»). La más reciente, la primera. Para futuros parches:
   * añade una entrada { version, date, title, items: [{ head, lines }] } al principio. */
  const PATCH_NOTES = [
    {
      version: '3.7', date: '2026-11-12', title: 'La Grieta baraja',
      items: [
        { head: 'Intro de Arcandia', icon: 'book', lines: [
          'Una intro nueva cuenta cómo Khadegar quiso escribir toda la magia en una sola carta y abrió la Grieta. Sale la primera vez; después, en ⚙ y en el Compendio.',
          'Nuevo control de volumen «Voz» en Ajustes (para la narración).'] },
        { head: 'Fragmentos de lore', icon: 'star', lines: [
          'Pestaña «Lore» en el Compendio con 24 fragmentos que se desbloquean jugando (jefes, Afinidad, contratos…).',
          'Los jefes tienen frases nuevas (algunos reconocen a su personaje) y cada mago, su frase en la selección de personaje.'] }
      ]
    },
    {
      version: '3.6', date: '2026-11-12', title: 'Motivos para volver',
      items: [
        { head: 'Afinidad, Legado y cosméticos', icon: 'star', lines: [
          'Cada personaje sube de Afinidad (niveles 1-15) al jugar: Esencia, 2 reliquias iniciales alternativas, un mazo inicial de senda, marcos, dorsos, aura y un título. Se eligen en «Personalizar».',
          'Al ganar una partida normal, eliges 1 carta como Legado: tu próxima partida con ese personaje empieza con ella. Al final, momentos destacados (golpe más fuerte, carta MVP…) y «Copiar resumen».'] },
        { head: 'Misiones y Desafío semanal', icon: 'contract', lines: [
          '3 misiones siempre a la vista en el título (40 en total, en 3 dificultades) y 1 diaria especial; dan Esencia y XP de Afinidad, y puedes cambiar 1 al día.',
          'Un Desafío semanal igual para todo el mundo, con insignia en Récords, e hitos del compendio al 25, 50, 75 y 100 % (con un marco exclusivo).'] }
      ]
    },
    {
      version: '3.5', date: '2026-11-11', title: 'Rejugabilidad',
      items: [
        { head: 'Contratos y caminos con carácter', icon: 'contract', lines: [
          'Al empezar, eliges 1 de 3 Contratos (o ninguno): 15 objetivos opcionales, uno por personaje, con reliquia, carta rara o Esencia de premio.',
          'Nodos nuevos: Misterio, Forja (con cartas «++»), Altar Maldito, Mercader Ambulante y la Élite Dorada. Cada acto tiene una ruta arriesgada y otra segura.'] },
        { head: '16 eventos, 28 reliquias y 14 cartas', icon: 'book', lines: [
          'Eventos con opciones de clase, riesgos con probabilidad y cadenas entre actos (una deuda, un espíritu, un huevo). Ninguno se repite en la misma partida.',
          '28 reliquias que cambian cómo juegas (6 de jefe con desventaja), 14 cartas para el Electromante y 4 afijos de élite nuevos.'] }
      ]
    },
    {
      version: '3.4', date: '2026-11-10', title: 'Modo personalizado',
      items: [
        { head: 'Tus reglas, tu semilla', icon: 'crown', lines: [
          'Nuevo botón «Personalizado» en el título (se abre al terminar una partida): eliges personaje, senda, Ascensión, semilla y 12 modificadores, de «Cristal» a «Doble jefe».',
          'La dificultad (Fácil, Normal, Difícil o Locura) sale de los modificadores y multiplica la Esencia de ×0,5 a ×1,5. No cuenta para logros, Ascensión, rachas ni desbloqueos.'] },
        { head: 'Códigos para compartir', icon: 'medal', lines: [
          'Copia el código de la partida (p. ej. CM-PALA-0A4-K7F2-1M4A) y pásaselo a tus colegas: con el mismo código, el mismo mapa, las mismas recompensas y los mismos enemigos.',
          'La partida personalizada tiene su propio guardado y no borra la normal; en el historial aparece con la etiqueta «Personalizada».'] }
      ]
    },
    {
      version: '3.3', date: '2026-11-06', title: 'El Electromante',
      items: [
        { head: 'Personaje nuevo: el Electromante', icon: 'ebolt', lines: [
          'Tejedor de Tormentas con 64 PV. Se desbloquea al ganar 10 combates en grupo con cualquier personaje.',
          'Rayo: golpea al objetivo y Encadena a otros enemigos con la mitad del daño; cada salto sin enemigo te da Estática.',
          'Estática: con 10 al acabar tu turno llega la Sobrecarga, 10 de daño a todos los enemigos (20 si solo queda uno). Magnetizado: el enemigo recibe más daño de tus Rayos.'] },
        { head: 'Tormenta, Sobrecarga y Circuito', icon: 'coil', lines: [
          '25 cartas en tres sendas, 4 reliquias (con el Pararrayos inicial), 2 pociones y un logro nuevo: «Tormenta perfecta».'] }
      ]
    },
    {
      version: '3.2', date: '2026-11-06', title: 'Combates en grupo',
      items: [
        { head: 'Hasta 3 enemigos', icon: 'sword', lines: [
          'Algunos combates normales y una élite por acto te enfrentan a 2 o 3 enemigos a la vez, con variantes menores como la Rata Joven o la Seta Brote.',
          'Arrastra la carta hasta un enemigo (o selecciónala y púlsalo) para elegir objetivo; un clic sin carta lo marca con la retícula dorada. Con mando: ←/→ con la carta cogida y el gatillo derecho sin ella.'] },
        { head: 'Cartas de Área', icon: 'burst', lines: [
          'Las cartas de Área golpean a todos los enemigos a la vez: 15 de las de siempre y 10 nuevas (2 por personaje).',
          'La Matriarca Fúngica y el Archiliche piden refuerzos. Novedades: Hoz de Cosechador, Bomba de Humo, Frasco Explosivo y el logro «Masacre».'] }
      ]
    },
    {
      version: '3.1', date: '2026-11-04', title: 'Sendas',
      items: [
        { head: 'Elige tu senda', icon: 'deck', lines: [
          'Cada personaje tiene 3 sendas (estilos de mazo). Tras elegir personaje, eliges una y su carta inicial entra en tu mazo; «Sin senda» da +10 % de Esencia.',
          'Las recompensas y la tienda ofrecen más cartas de las sendas que ya llevas (una de cada 3 opciones sigue siendo al azar). «Encaja con tu mazo» te avisa.',
          'El Mazo cuenta tus cartas por senda, el Compendio filtra por senda y los Récords guardan tus victorias por senda.'] },
        { head: '74 cartas nuevas', icon: 'book', lines: [
          'Entre 8 y 18 cartas nuevas por personaje, repartidas entre sus sendas, con poderes nuevos como Incendio Controlado, Corazón Polar, Ciclo Eterno, Madre del Bosque o Avatar de la Luz.'] }
      ]
    },
    {
      version: '3.0', date: '2026-11-04', title: 'El Paladín',
      items: [
        { head: 'Personaje nuevo: el Paladín', icon: 'sun', lines: [
          'Juez de la Luz con 68 PV. Se desbloquea al derrotar a cualquier jefe del Acto II.',
          'Juicio: aplícalo al enemigo y cada golpe de tus Ataques te dará Bloqueo. Fervor: cuantos menos PV te quedan, más daño infliges.',
          'Inmaterial: el próximo golpe que recibas te inflige 0 de daño. Sus cartas que te quitan PV nunca te matan.',
          '22 cartas, 4 reliquias, 2 pociones y un logro nuevo: Fe inquebrantable.'] }
      ]
    },
    {
      version: '2.9', date: '2026-10-30', title: 'Nueve jefes',
      items: [
        { head: 'Jefes nuevos', icon: 'crown', lines: [
          'Cada acto tiene ahora 3 jefes posibles y en cada partida te toca uno: Matriarca Fúngica y Lobo Alfa (Acto I), Titán del Glaciar y Espectro de la Tormenta (Acto II), Archiliche Rúnico y Devorador de Hechizos (Acto III).',
          'El mapa te enseña arriba a la derecha qué jefe te espera; pasa por encima para leer cómo pelea.',
          'Pasivas nuevas: Fuerza creciente, coraza que se rompe, revivir una vez y un Devorador que se alimenta de cada carta de más que juegas.'] },
        { head: 'Todo lo demás, con cualquier jefe', icon: 'eye', lines: [
          'Ascensión A6 y A8, logros, Récords y Compendio cuentan con los 9 jefes. La Estatua del Guardián solo aparece si te espera el Guardián.',
          'Logro nuevo: Cazador de jefes (derrota a los 9).'] }
      ]
    },
    {
      version: '2.8', date: '2026-10-30', title: 'Ahora en inglés',
      items: [
        { head: 'Idiomas', icon: 'book', lines: [
          'Carticas Mágicas se puede jugar en español o en inglés: cartas, reliquias, enemigos, eventos, logros y toda la interfaz.',
          'Elige el idioma con el globo 🌐 del título o en ⚙ → «Idioma / Language». La primera vez se usa el de tu navegador.',
          'Cambiar de idioma no pierde la partida: puedes empezarla en un idioma y terminarla en el otro.'] },
        { head: 'Fechas y números', icon: 'eye', lines: [
          'Fechas, puntuaciones y el texto de compartir del diario salen en el formato de cada idioma, y el código se comprueba en los dos.'] }
      ]
    },
    {
      version: '2.7', date: '2026-10-29', title: 'Logros con premio',
      items: [
        { head: 'Logros con recompensa', icon: 'crown', lines: [
          '9 logros dan una carta, reliquia o poción que no sale en ninguna partida hasta que los consigues: ¿Quién encendió la estufa?, Cero absoluto, Ejército del bosque, Muralla viva, Tierra calcinada, El último creyente, Ahorro extremo, Dominio elemental y Golpe devastador.',
          'Cartas legendarias (Aura Arcana y Cataclismo): 2 % en las recompensas de élite y de jefe, con marco dorado. Nunca en tiendas.',
          'El Compendio y los Récords enseñan con candado lo que aún te falta y qué logro lo desbloquea.'] },
        { head: 'Reliquias y Criomante', icon: 'snow', lines: [
          'Reliquias nuevas: Frasco de Brea Rúnica, Manto de Permafrost, Tótem de Huesos, Piedra de Afilado, Grimorio Inestable, Vial de Maná Efervescente, Elixir de Consagración, Frasco de Viento y Anillo del Avaricioso.',
          'Criomante: carta rara Corazón de Hielo y nueva historia.'] },
        { head: 'Consejos siempre a la vista', icon: 'eye', lines: [
          'Los consejos, avisos y ventanas se dibujan siempre por encima de todo y buscan un hueco libre: ya no quedan tapados por el mazo, los ajustes o los avisos de logro.'] }
      ]
    },
    {
      version: '2.6', date: '2026-10-28', title: 'Más vida',
      items: [
        { head: 'Animaciones', icon: 'spark', lines: [
          'Los personajes respiran y los voladores flotan; al atacar cogen impulso y embisten, y al recibir un golpe se inclinan y tiemblan según el daño.',
          'Cambio de fase del jefe a cámara lenta, fundidos entre pantallas y la ficha de tu personaje viaja por el mapa.',
          'Las monedas vuelan al contador de oro, las reliquias y pociones vuelan a la barra y el cofre se abre con un haz de luz.',
          'Respetan «Velocidad de animación» y «Reducir movimiento» (sin temblores, destellos ni movimientos de cámara).'] },
        { head: 'Arte y Récords', icon: 'eye', lines: [
          'Nuevas ilustraciones del Ojo del Abismo y del Archimago Caído.',
          'Récords: fecha corta en los logros y estadísticas con más aire.'] }
      ]
    },
    {
      version: '2.5', date: '2026-10-28', title: 'Nuevas ilustraciones',
      items: [
        { head: 'Arte nuevo', icon: 'eye', lines: [
          'Ilustraciones propias para el Ojo del Abismo, el Espejo Viviente y los enemigos de la Caverna Arcana (Duende, Fuego Fatuo, Grimorio, Centinela, Acólito), y para el Murciélago, el Espíritu de Ventisca y el Cazador de las Cumbres.',
          'Fondos nuevos: la Caverna Arcana, el Santuario y el mapa del mundo en pergamino.',
          'Ilustraciones: creadas por el autor con ChatGPT.'] }
      ]
    },
    {
      version: '2.4', date: '2026-10-28', title: 'Equilibrio arcano',
      items: [
        { head: 'Caverna Arcana: interacciones', icon: 'mirror', lines: [
          'Congelar a un enemigo rompe su Carga Arcana. La Quemadura cuenta para los 15 de daño que la interrumpen.',
          'El Reflejo también devuelve daño a las detonaciones de runas (gasta carga) y a las criaturas que golpean (a la criatura, sin gastar carga).'] },
        { head: 'Piromago y Criomante', icon: 'flame', lines: [
          'Piromago: más daño en Bola de Fuego, Golpe Ardiente, Infierno, Magma, Erupción, Fundir, Encadenar Llamas, Cadena Infernal y Llama Paciente; más Bloqueo en Enfriar, Brasa Guardada, Caldera y Muro de Llamas; y en varias versiones mejoradas.',
          'Criomante: más daño en Esquirla, Esquirla Afilada, Témpano y Avalancha.'] }
      ]
    },
    {
      version: '2.3', date: '2026-10-28', title: 'El Santuario',
      items: [
        { head: 'Esencia Arcana', icon: 'eye', lines: [
          'Al terminar cualquier partida, ganes o pierdas, consigues Esencia: pisos, élites, jefes y victoria, con extra por Ascensión, por logros nuevos y por la primera victoria con cada personaje.'] },
        { head: 'Santuario', icon: 'crown', lines: [
          'Nuevo botón en el título: 9 mejoras permanentes en tres ramas (Vida, Riqueza y Saber), desde +PV máximos hasta elegir una reliquia al empezar.',
          'El desafío diario nunca usa mejoras. Si quieres más reto, activa «Jugar sin mejoras» al elegir personaje y gana +20 % de Esencia.'] }
      ]
    },
    {
      version: '2.2', date: '2026-10-28', title: 'La Caverna Arcana',
      items: [
        { head: 'Acto III: Caverna Arcana', icon: 'eye', lines: [
          'Vencer al Wyrm ya no termina la partida: eliges reliquia de jefe, recuperas el 75 % de la vida que te falta y bajas a la Caverna Arcana (pisos 19-27).',
          '5 enemigos, 2 élites y un jefe final de 3 fases: El Ojo del Abismo. Es el acto más difícil.'] },
        { head: 'Trucos arcanos', icon: 'hourglass', lines: [
          'Drenar (empiezas con menos Energía), Silencio (cartas selladas), Reflejo (tus Ataques te devuelven daño), Carga Arcana (interrúmpela con 15+ de daño en un turno) y Garabatos (Maldición que roba Energía).'] },
        { head: 'Contenido nuevo', icon: 'book', lines: [
          '3 eventos (Biblioteca Olvidada, Fuente de Maná, El Pacto del Abismo), 2 reliquias (Prisma Arcano, Tomo Sellado) y 2 logros (Cerrar el Ojo, Ilesa la mente).'] }
      ]
    },
    {
      version: '2.1', date: '2026-10-25', title: 'La Invocadora',
      items: [
        { head: 'Nuevo personaje: Invocadora', icon: 'leaf', lines: [
          'Invocadora del Bosque, 52 PV. Se desbloquea al llegar al Acto II con cualquier personaje.',
          'Invoca hasta 3 criaturas (Lobezno, Treant, Búho, Hada y Espíritu Ancestral) que actúan al final de tu turno.',
          'Los golpes enemigos van primero a la criatura más antigua, y el daño sobrante no pasa a ti.',
          'Vínculo: +ataque a todas tus criaturas. 22 cartas, 3 reliquias y 2 pociones propias.'] },
        { head: 'Piromago: Corazón Ardiente', icon: 'flame', lines: [
          'Nueva reliquia inicial: la primera carta de Ataque de cada combate aplica 1 de Quemadura.',
          'Solo en partidas nuevas; las que ya tenías empezadas siguen igual.'] },
        { head: 'Mando y mejoras', icon: 'up', lines: [
          'Mando en todas las pantallas: menús, tienda, hoguera, eventos, Compendio (LB/RB), pociones (LT/RT) y Ajustes.',
          'La mano de 7 a 10 cartas se abre más y siempre se leen el coste y el nombre.',
          'Mejorar una carta en la hoguera enseña la carta normal y la mejorada lado a lado, con los cambios en verde.'] }
      ]
    },
    {
      version: '2.0', date: '2026-10-25', title: 'Runas y Afijos',
      items: [
        { head: 'Nuevo personaje: Guardiana Rúnica', icon: 'rune', lines: [
          'Forjadora de Runas, 64 PV. Se desbloquea al ganar una partida con cualquier personaje.',
          'Graba runas (Fuego, Piedra, Viento, Sangre y Ancestral) que actúan solas al final de cada turno.',
          'Con las ranuras llenas, la runa más antigua DETONA con un efecto más fuerte.',
          '24 cartas, 3 reliquias (Cincel de Plata, Anillo Resonante, Cuarta Piedra) y 2 pociones propias.'] },
        { head: 'Élites con afijos', icon: 'skull', lines: [
          'Cada élite trae un afijo al azar (dos en Ascensión 5+): Blindado, Veloz, Vampírico, Espinoso, Enorme o Regenerador.',
          'Más oro al vencerlas: +15 con un afijo y +25 con dos.',
          'Bestiario: nueva sección «Afijos vistos». Logro nuevo: Domador.'] },
        { head: 'Contenido para todos', icon: 'deck', lines: [
          '8 cartas neutrales (marco gris piedra) que salen en recompensas y tiendas: Improvisar, Trascender, Golpe de Suerte…',
          '6 reliquias nuevas: Mapa del Cartógrafo, Saco Sin Fondo, Moneda Trucada, Brújula Rota, Reloj Parado y Ojo de Búho.',
          'Las salas «?» pueden esconder una tienda o un cofre.'] },
        { head: 'Ajustes de balance', icon: 'up', lines: [
          'Criomante: 58 PV y Corazón Gélido aplica 4 de Escarcha.',
          'Los tres personajes quedan a menos de 3 puntos entre sí en victorias (A0, bot de pruebas).'] }
      ]
    }
  ];
  const LATEST_VERSION = PATCH_NOTES[0].version;

  /* Afijos de élite: cada combate de élite recibe 1 al azar (2 distintos en A5+). v: cifras. */
  const AFFIXES = {
    blindado:    { name: 'Blindado',    color: 0x9fb4c8, icon: 'shield',   v: { start: 10, turn: 3 },  text: 'Empieza con 10 de Bloqueo y gana 3 cada turno.' },
    veloz:       { name: 'Veloz',       color: 0xffe066, icon: 'bolt',     v: {},                       text: 'En su primer turno actúa dos veces.' },
    vampirico:   { name: 'Vampírico',   color: 0xc0283c, icon: 'drop',     v: { frac: 0.5 },            text: 'Se cura la mitad del daño que te inflige (después de tu Bloqueo).' },
    espinoso:    { name: 'Espinoso',    color: 0x7fbf5a, icon: 'burst',    v: { dmg: 1 },               text: 'Recibes 1 de daño cada vez que le golpeas con un ataque (por golpe).' },
    enorme:      { name: 'Enorme',      color: 0xb08a5a, icon: 'up',       v: { hp: 0.3, dmgDown: 0.1 }, text: '+30 % de PV, −10 % de daño.' },
    regenerador: { name: 'Regenerador', color: 0x5fd38a, icon: 'heart',    v: { heal: 3 },              text: 'Se cura 3 al final de su turno (no si está Congelado).' }
  };
  const AFFIX_IDS = Object.keys(AFFIXES);

  /* Pactos: retos voluntarios (se eligen antes de empezar, no en el diario). Cada uno suma su
   * bonus al multiplicador de la puntuación final: puntos × (1 + suma). La lógica, en engine.js. */
  const PACTS = {
    llama:     { name: 'Llama tenue',     text: 'Empiezas con 10 PV máximos menos.', bonus: 0.10 },
    bolsillos: { name: 'Bolsillos rotos', text: 'No puedes comprar reliquias.', bonus: 0.10 },
    descanso:  { name: 'Sin descanso',    text: 'Las hogueras no curan.', bonus: 0.15 },
    pesado:    { name: 'Mazo pesado',     text: 'Empiezas con 2 Escalofríos.', bonus: 0.15 },
    elite:     { name: 'Élite feroz',     text: 'Las élites tienen +25 % de PV.', bonus: 0.15 },
    pociones:  { name: 'Sin pociones',    text: 'No consigues pociones.', bonus: 0.10 },
    reloj:     { name: 'Contrarreloj',    text: 'Cada combate de más de 8 turnos te quita 5 PV por turno extra.', bonus: 0.20 }
  };
  const PACT_IDS = Object.keys(PACTS);

  /* ------------------------------------------------------------------ *
   * MODO PERSONALIZADO (Parche 3.4): modificadores que el jugador activa en la pantalla de configuración.
   * El orden de CUSTOM_MOD_IDS es el de los bits del código para compartir: SOLO se añaden al final.
   * weight: lo que suma a la dificultad (negativo = más fácil). Ver E.customDifficulty. Calibrado con CUSTOMTEST=1 node test/sim.js 200
   * (piso medio y victorias del bot con cada modificador frente a sin ninguno).
   * ------------------------------------------------------------------ */
  const CUSTOM_MODS = {
    cristal:     { icon: 'prism',     weight: 3,  name: 'Cristal',             short: 'Cristal',      text: 'Empiezas con el 50 % de tus PV máximos.' },
    rico:        { icon: 'coin',      weight: -1, name: 'Rico',                short: 'Rico',         text: 'Empiezas con 300 de oro.' },
    arsenal:     { icon: 'hammer',    weight: -4, name: 'Arsenal',             short: 'Arsenal',      text: 'Todas las cartas iniciales empiezan mejoradas.' },
    caos:        { icon: 'question',  weight: -1,  name: 'Caos',                short: 'Caos',         text: 'Tu mazo inicial son 10 cartas al azar de tu personaje (con Arsenal, mejoradas).' },
    elitetotal:  { icon: 'skull',     weight: 5,  name: 'Élite total',         short: 'Élite total',  text: 'Todos los combates normales del mapa son élites.' },
    doblejefe:   { icon: 'crown',     weight: 3,  name: 'Doble jefe',          short: 'Doble jefe',   text: 'Cada jefe de acto viene acompañado de otro jefe del mismo acto (combate en grupo, con el escalado de los grupos).' },
    sindescanso: { icon: 'campfire',  weight: 1,  name: 'Sin descanso',        short: 'Sin descanso', text: 'No hay hogueras en el mapa (se convierten en salas «?»).' },
    sintiendas:  { icon: 'bag',       weight: 1,  name: 'Sin tiendas',         short: 'Sin tiendas',  text: 'No hay tiendas en el mapa (se convierten en salas «?», que tampoco esconden tiendas).' },
    maldito:     { icon: 'cursecard', weight: 1,  name: 'Maldito',             short: 'Maldito',      text: 'Empiezas con 2 Escalofríos permanentes en el mazo.' },
    reliquias:   { icon: 'medal',     weight: -2, name: 'Reliquias a lo loco', short: 'Reliquias',    text: 'Empiezas con 3 reliquias comunes al azar.' },
    hechizo:     { icon: 'bolt',      weight: 1,  name: 'Hechizo rápido',      short: 'Hechizo rápido', text: 'Robas 1 carta más por turno, pero los enemigos tienen +25 % de PV.' },
    mazopeq:     { icon: 'deck',      weight: 1,  name: 'Mazo pequeño',        short: 'Mazo pequeño', text: 'No puedes tener más de 15 cartas en el mazo (las recompensas de carta se pueden saltar siempre).' }
  };
  const CUSTOM_MOD_IDS = Object.keys(CUSTOM_MODS);
  /** Parejas que no se pueden activar a la vez (ninguna de momento: Sin descanso + Sin tiendas y Caos + Arsenal son válidas). */
  const CUSTOM_CONFLICTS = [];
  /** Dificultad del modo personalizado: la puntuación (modificadores + Ascensión) cae en un tramo; mult = Esencia. */
  const CUSTOM_DIFF = {
    facil:   { max: -2,       mult: 0.5,  color: 0x8fe39a, name: 'Fácil' },
    normal:  { max: 2,        mult: 1,    color: 0xf0e4c8, name: 'Normal' },
    dificil: { max: 6,        mult: 1.25, color: 0xff9a52, name: 'Difícil' },
    locura:  { max: Infinity, mult: 1.5,  color: 0xff5a4d, name: 'Locura' }
  };
  const CUSTOM_DIFF_IDS = Object.keys(CUSTOM_DIFF);
  /** Personaje en el código para compartir (4 letras, sin tildes). */
  const CUSTOM_CHAR_CODE = { piromago: 'PIRO', criomante: 'CRIO', guardiana: 'GUAR', invocadora: 'INVO', paladin: 'PALA', electromante: 'ELEC' };

  /* ------------------------------------------------------------------ *
   * SANTUARIO: mejoras permanentes que se compran con Esencia Arcana (meta.upgrades = { id: nivel }).
   *   cost[i] = precio del nivel i+1 · fx(n) = texto del efecto con n niveles (n = 0: sin la mejora)
   *   Se aplican en engine.newRun (y en el motor), nunca en el desafío diario ni con «sin mejoras».
   * ------------------------------------------------------------------ */
  const UPGRADES = {
    vitalidad: { name: 'Raíces Profundas',  icon: 'heart',    per: 1, cost: [40, 70, 100, 140, 180], fx: (n) => (n ? _t('d.0_pv_maximos', { 0: n }) : _t('d.sin_bonus_de_vida')) },
    bolsa:     { name: 'Bolsa del Viajero', icon: 'coin',     per: 15, cost: [30, 50, 80, 120, 160], fx: (n) => (n ? _t('d.0_de_oro_inicial', { 0: 15 * n }) : _t('d.sin_oro_extra')) },
    alquimia:  { name: 'Alquimista',        icon: 'flask',    cost: [180],                  fx: (n) => (n ? _t('d.empiezas_con_1_pocion_comun') : _t('d.sin_pociones_iniciales')) },
    herreria:  { name: 'Yunque Ancestral',  icon: 'up',       cost: [260],                  fx: (n) => (n ? _t('d.1_golpe_inicial_mejorado') : _t('d.mazo_inicial_sin_mejorar')) },
    purga:     { name: 'Purificación',      icon: 'flame',    cost: [140],                  fx: (n) => (n ? _t('d.la_primera_purga_en_la') : _t('d.las_purgas_cuestan_oro')) },
    fortuna:   { name: 'Mano de Midas',     icon: 'bag',      per: 10, cost: [60, 120, 200], fx: (n) => (n ? _t('d.0_de_oro_en_los', { 0: 10 * n }) : _t('d.oro_normal')) },
    hoguera:   { name: 'Fuego del Hogar',   icon: 'campfire', per: 2, cost: [70, 140, 220], fx: (n) => (n ? _t('d.las_hogueras_curan_0', { 0: 2 * n }) : _t('d.hogueras_normales')) },
    sabiduria: { name: 'Ojo del Sabio',     icon: 'eye',      cost: [160, 300],             fx: (n) => (n ? _t('upg.rerolls', { n }) : _t('d.sin_relanzamientos')) },
    reliquia:  { name: 'Herencia',          icon: 'crown',    cost: [500],                  fx: (n) => (n ? _t('d.al_empezar_eliges_1_de') : _t('d.sin_reliquia_de_herencia')) }
  };
  // Ajuste de balance (Parche 2.3): con los valores del encargo (+3 PV/nivel, 3 cartas cualquiera, +5 %/nivel y la mitad de coste)
  // todo al máximo subía la victoria +31-36 puntos en A0 y se compraba todo en ~22 partidas. Cada carta básica mejorada
  // vale ~+3-4 puntos (3 niveles: +9-13), así que el Yunque se queda en 1 nivel (solo un Golpe) y el Alquimista en 1 poción; la Herencia solo ofrece reliquias comunes (de todos los personajes).
  const UPGRADE_IDS = Object.keys(UPGRADES);
  /** Esencia Arcana: tarifas (engine.essenceFor y meta.onRunEnd). */
  const ESSENCE = { floor: 2, elite: 5, boss: 15, win: 30, perAsc: 0.10, noUpgrades: 1.2, noPath: 1.1, achievement: 25, firstWinChar: 50 };

  /* Ascensión: dificultad progresiva. Las reglas son acumulativas (el nivel N aplica 1..N).
   * Los efectos se aplican en engine.js; aquí solo están los textos para la UI. */
  const ASCENSION = [
    { id: 'a1', level: 1, text: 'Enemigos normales: +10 % de PV máximos' },
    { id: 'a2', level: 2, text: 'Élites: +15 % de PV máximos' },
    { id: 'a3', level: 3, text: 'Empiezas con 6 PV máximos menos' },
    { id: 'a4', level: 4, text: 'Descansar cura el 25 % en vez del 30 %' },
    { id: 'a5', level: 5, text: 'Oro de los combates: −25 %' },
    { id: 'a6', level: 6, text: 'Los jefes tienen +20 PV máximos' },
    { id: 'a7', level: 7, text: 'Enemigos normales y élites empiezan con +1 Fuerza' },
    { id: 'a8', level: 8, text: 'Los jefes empiezan con +2 Fuerza' }
  ];
  const MAX_ASCENSION = ASCENSION.length;

  /* ------------------------------------------------------------------ *
   * GLOSARIO DE HABILIDADES: la única fuente de nombres y explicaciones de palabras clave, estados,
   * mecánicas, intenciones enemigas y afijos (tooltips de cartas y estados, pestaña «Habilidades»).
   *   cat    enemy · you · char · card · intent · affix   (orden de GLOSSARY_CATS)
   *   chars  personajes a los que pertenece (null = común; filtro del Compendio)
   *   match  formas en que aparece en los textos (expresión regular, por idioma) para enlazar su ficha
   *   desc   explicación general · now: con el valor actual ({n}…), para los iconos de estado
   * Los números del juego van entre llaves ({overheatAt}, {iceMelt}…) y los pone ui.js desde E.RULES.
   * Las runas, criaturas y afijos se añaden solos al final (rune_<id>, sum_<id>, aff_<id>).
   * ------------------------------------------------------------------ */
  const GLOSSARY_CATS = ['enemy', 'you', 'char', 'card', 'intent', 'affix'];
  const GLOSSARY = {
    burn: { cat: 'enemy', icon: 'flame', color: 0xff7a2e, chars: ['piromago'], name: 'Quemadura', match: 'Quemaduras?', desc: 'Al final de tu turno, el enemigo pierde tantos PV como Quemadura tenga (ignora el Bloqueo). Después baja 1.', now: 'Al final de tu turno pierde {n} PV (ignora el Bloqueo). Después baja a {m}.' },
    frost: { cat: 'enemy', icon: 'snow', color: 0x9fdcff, chars: ['criomante'], name: 'Escarcha', match: 'Escarchas?', desc: 'Mientras tenga Escarcha, los ataques del enemigo infligen un {frostPct} % menos. Baja 1 al final de su turno. Con {freezeAt} ({freezeAtBoss} los jefes) queda Congelado.', now: 'Sus ataques infligen un {frostPct} % menos. Baja 1 al final de su turno. Con {f} queda Congelado (lleva {n}).' },
    frozen: { cat: 'enemy', icon: 'snow', color: 0xffffff, chars: ['criomante'], name: 'Congelado', match: 'Congelad[oa]s?|Congela|Congelas|Congeles?|Congelarlo|Congelar', desc: 'El enemigo pierde su siguiente turno entero (también corta una Carga Arcana) y su Escarcha vuelve a 0.' },
    str: { cat: 'enemy', icon: 'strength', color: 0xff9a7a, chars: null, name: 'Fuerza', match: 'Fuerza', desc: 'Cada punto suma +1 de daño a cada golpe de quien la tiene.', now: '+{n} de daño a cada golpe.' },
    reflect: { cat: 'enemy', icon: 'mirror', color: 0xc9a8ff, chars: null, name: 'Reflejo', match: 'Reflejos?', desc: 'Por cada carga, el siguiente Ataque que juegues (o detonación de runa) te devuelve el {reflectPct} % del daño que inflige. Las criaturas que lo golpean reciben la mitad sin gastar carga.', now: 'Cargas: {n}. Cada Ataque que juegues (y cada detonación de runa) te devuelve el {reflectPct} % del daño y gasta 1 carga. Las criaturas que lo golpean reciben la mitad sin gastarla.' },
    charging: { cat: 'enemy', icon: 'hourglass', color: 0xc9a8ff, chars: null, name: 'Carga Arcana', match: 'Carga Arcana|Cargas? Arcanas?', desc: 'El enemigo prepara un golpe enorme durante unos turnos. Inflígele {chargeBreak} o más de daño en un mismo turno (la Quemadura cuenta) o Congélalo para interrumpirla.', now: 'Descargará un golpe de {hit} dentro de {n} {n|turno|turnos}. Inflígele {chargeBreak} o más de daño en un turno para interrumpirla (llevas {d}). Congelarlo también la rompe.' },
    stunned: { cat: 'enemy', icon: 'heart', color: 0xffb36b, chars: null, name: 'Aturdido', match: 'Aturdid[oa]|Aturde', desc: 'Pierde su siguiente acción (lo provoca el Amuleto del Fénix).' },
    grow: { cat: 'enemy', icon: 'strength', color: 0xff9a7a, chars: null, name: 'Fuerza creciente', match: 'Fuerza creciente', desc: 'Pasiva de jefe: gana Fuerza al final de cada uno de sus turnos.', now: 'Gana {n} de Fuerza al final de cada uno de sus turnos.' },
    devour: { cat: 'enemy', icon: 'book', color: 0xff8ad8, chars: null, name: 'Devorador', desc: 'Pasiva de jefe: cada carta que juegues a partir de cierta cantidad en un mismo turno le da +1 Fuerza.', now: 'Cada carta que juegues a partir de la {n}.ª de este turno le da +1 Fuerza. Llevas {k}.' },
    revive: { cat: 'enemy', icon: 'heart', color: 0xd2a8ff, chars: null, name: 'Se niega a morir', desc: 'Pasiva de jefe: la primera vez que llega a 0 PV, revive con parte de sus PV y cambia de fase.', now: 'La primera vez que llegue a 0 PV, revivirá con el {p} % de sus PV y preparará su Carga Final.' },
    judgment: { cat: 'enemy', icon: 'scales', color: 0xf2d36b, chars: ['paladin'], name: 'Juicio', match: 'Juicios?', desc: 'Cada vez que golpeas al enemigo con un Ataque, ganas {judgBlock} de Bloqueo por cada Juicio. Baja 1 al final de su turno.', now: 'Cada golpe de tus Ataques te da {b} de Bloqueo. Baja 1 al final de su turno.' },
    noblock: { cat: 'enemy', icon: 'shield', color: 0x9fd6ff, chars: null, name: 'Coraza rota', desc: 'Ha perdido su coraza: ya no puede ganar Bloqueo.' },
    temp: { cat: 'you', icon: 'thermo', color: 0xff9a3d, chars: ['piromago'], name: 'Temperatura', match: 'Temperatura', desc: 'Cada punto suma +1 de daño a tus ataques. Con {overheatAt} o más te Sobrecalientas al acabar el turno.', now: '+{n} de daño a tus ataques. Con {at} o más te Sobrecalientas al terminar el turno.' },
    overheat: { cat: 'you', icon: 'thermo', color: 0xff5a2e, chars: ['piromago'], name: 'Sobrecalentamiento', match: 'Sobrecali?ent\\p{L}*', desc: 'Si acabas el turno con {overheatAt} o más de Temperatura, pierdes {overheatDmg} PV (ignora el Bloqueo).' },
    block: { cat: 'you', icon: 'shield', color: 0x9fd6ff, chars: null, name: 'Bloqueo', match: 'Bloqueo', desc: 'Absorbe el daño de los golpes. Se pierde al empezar tu siguiente turno.', now: 'Absorbe {n} de daño. Se pierde al empezar tu siguiente turno.' },
    ice: { cat: 'you', icon: 'shard', color: 0x9fdcff, chars: ['criomante'], name: 'Escudo de Hielo', match: 'Escudos? de Hielo', desc: 'Absorbe daño antes que el Bloqueo. No desaparece al empezar tu turno: se derrite {iceMelt} por turno.', now: 'Absorbe {n} de daño antes que el Bloqueo. Se derrite {m} al empezar tu turno.' },
    weak: { cat: 'you', icon: 'weak', color: 0xb7a6ff, chars: null, name: 'Débil', match: 'Débil(?:es)?', desc: 'Tus ataques hacen un {weakPct} % menos de daño. Baja 1 al final de cada turno.', now: 'Tus ataques infligen un {weakPct} % menos de daño. {n|Queda|Quedan} {n} {n|turno|turnos}.' },
    energy: { cat: 'you', icon: 'bolt', color: 0xffd75a, chars: null, name: 'Energía', match: 'Energía', desc: 'Cada carta cuesta Energía. Al empezar tu turno vuelves a tener {energy} (más la de tus reliquias).', now: 'Te quedan {n} de {m}. Se recarga al empezar tu turno.' },
    thorns: { cat: 'you', icon: 'wall', color: 0xff7a2e, chars: ['piromago'], name: 'Muro de Llamas', match: 'Muro de Llamas', desc: 'Este turno, cada golpe que recibes aplica Quemadura al atacante.', now: 'Este turno, cada golpe recibido aplica {n} Quemadura al atacante.' },
    furia: { cat: 'you', icon: 'up', color: 0xff9a3d, chars: ['piromago'], name: 'Furia Ardiente', desc: 'Poder: ganas Temperatura al inicio de cada turno.', now: '+{n} Temperatura al inicio de cada turno.' },
    fenix: { cat: 'you', icon: 'up', color: 0xf0cf7a, chars: ['piromago'], name: 'Corazón de Fénix', desc: 'Poder: cada Ataque que juegas aplica Quemadura.', now: 'Cada Ataque que juegas aplica {n} Quemadura.' },
    eterna: { cat: 'you', icon: 'up', color: 0xff7a2e, chars: ['piromago'], name: 'Ascuas Eternas', desc: 'Poder: la Quemadura del enemigo ya no baja al final del turno.' },
    sol: { cat: 'you', icon: 'up', color: 0xffb02e, chars: ['piromago'], name: 'Sol Interior', desc: 'Poder: el Sobrecalentamiento ya no te hace daño.' },
    hoguera: { cat: 'you', icon: 'up', color: 0xff7a2e, chars: ['piromago'], name: 'Hoguera Interior', desc: 'Poder: ganas Temperatura al inicio de cada turno.', now: '+{n} Temperatura al inicio de cada turno.' },
    fury: { cat: 'you', icon: 'burst', color: 0xff5a2e, chars: ['piromago'], name: 'Furia Volcánica', desc: 'Este turno, tus ataques infligen el doble de daño.' },
    ignea: { cat: 'you', icon: 'thermo', color: 0xf0cf7a, chars: ['piromago'], name: 'Esencia Ígnea', desc: 'Este turno no te Sobrecalientas.' },
    volcan: { cat: 'you', icon: 'up', color: 0xc0283c, chars: ['piromago'], name: 'Corazón de Volcán', desc: 'Poder: los enemigos no pueden reducir tu Temperatura y el Sobrecalentamiento te quita 1 PV menos.' },
    ventisca: { cat: 'you', icon: 'snow', color: 0x9fdcff, chars: ['criomante'], name: 'Ventisca Perpetua', desc: 'Poder: al empezar tu turno aplicas Escarcha.', now: 'Al empezar tu turno aplicas {n} de Escarcha.' },
    invierno: { cat: 'you', icon: 'snow', color: 0xb6a8ff, chars: ['criomante'], name: 'Invierno Eterno', desc: 'Poder: la Escarcha del enemigo ya no baja.' },
    glaciar: { cat: 'you', icon: 'up', color: 0x9fdcff, chars: ['criomante'], name: 'Corazón de Glaciar', desc: 'Poder: cada vez que Congelas al enemigo, ganas Energía y robas cartas en tu siguiente turno.', now: 'Cada vez que Congelas al enemigo, ganas {e} Energía y robas {e} en tu siguiente turno.' },
    expuesto: { cat: 'you', icon: 'shard', color: 0x9fdcff, chars: ['criomante'], name: 'Expuesto', match: 'Expuest[oa]', desc: 'Corazón de Hielo: durante ese turno no puedes ganar Bloqueo ni Escudo de Hielo.' },
    maestria: { cat: 'you', icon: 'book', color: 0xf0cf7a, chars: ['guardiana'], name: 'Maestría Rúnica', desc: 'Poder: los pasivos de tus runas se activan dos veces.' },
    forja: { cat: 'you', icon: 'shield', color: 0xf0cf7a, chars: ['guardiana'], name: 'Forja Eterna', desc: 'Poder: cada vez que Grabas una runa, ganas Bloqueo.', now: 'Cada vez que Grabas una runa, ganas {n} de Bloqueo.' },
    ranura: { cat: 'you', icon: 'rune', color: 0xffc46a, chars: ['guardiana'], name: 'Ranura Extra', desc: 'Poder: tienes más ranuras de runa este combate.', now: 'Ranuras de runa extra: +{n}.' },
    aura: { cat: 'you', icon: 'prism', color: 0xffd75a, chars: null, name: 'Aura Arcana', desc: 'Poder: tus ataques infligen más daño y tus cartas que dan Bloqueo dan más.', now: 'Tus ataques infligen +{n}. Tus cartas que dan Bloqueo dan +{n} más.' },
    espinas: { cat: 'you', icon: 'burst', color: 0x6fd08a, chars: ['invocadora'], name: 'Espinas del Bosque', desc: 'Poder: cuando el enemigo golpea a una de tus criaturas, recibe daño.', now: 'Cuando el enemigo golpea a una criatura, recibe {n} de daño.' },
    rey: { cat: 'you', icon: 'crown', color: 0x9ff0b4, chars: ['invocadora'], name: 'Rey del Bosque', desc: 'Poder: tus criaturas entran con el doble de PV.' },
    fervor: { cat: 'you', icon: 'sun', color: 0xf2d36b, chars: ['paladin'], name: 'Fervor', match: 'Fervor', desc: 'Pasiva del Paladín: tus ataques infligen +1 por cada 10 % de PV que te falte.', now: 'Tus ataques infligen +{n}. Te faltan el {p} % de tus PV.' },
    immaterial: { cat: 'you', icon: 'ghost', color: 0xe8f0ff, chars: ['paladin'], name: 'Inmaterial', match: 'Inmateriale?s?', desc: 'El próximo golpe que recibas en el turno del enemigo te inflige 0 de daño. Se gasta con el primer golpe (en los ataques de varios golpes, solo ese).' },
    sangre: { cat: 'you', icon: 'heart', color: 0xf2d36b, chars: ['paladin'], name: 'Sangre Consagrada', desc: 'Poder: cada vez que pierdes PV por tus cartas, aplicas Juicio.', now: 'Cada vez que pierdes PV por tus cartas, aplicas {n} de Juicio.' },
    juramento: { cat: 'you', icon: 'medal', color: 0xf2d36b, chars: ['paladin'], name: 'Juramento', desc: 'Poder: al empezar tu turno, si tienes menos del 50 % de tus PV, ganas Energía.', now: 'Al empezar tu turno, con menos del 50 % de tus PV, ganas {n} de Energía.' },
    ascension: { cat: 'you', icon: 'ghost', color: 0xe8f0ff, chars: ['paladin'], name: 'Ascensión Celestial', desc: 'Poder: una vez por combate, al llegar a 0 PV te quedas con 1 PV y te vuelves Inmaterial.' },
    // Sendas (Parche 3.1): poderes y efectos de las cartas ★
    fusion: { cat: 'you', icon: 'thermo', color: 0xffb23d, chars: ['piromago'], name: 'Punto de Fusión', desc: 'Este turno no te Sobrecalientas y tus Ataques infligen más daño. Al final del turno pierdes toda tu Temperatura.', now: 'Este turno no te Sobrecalientas y tus Ataques infligen +{n}. Al final del turno pierdes toda tu Temperatura.' },
    incendio: { cat: 'you', icon: 'flame', color: 0xff6a3d, chars: ['piromago'], name: 'Incendio Controlado', desc: 'Poder: al final de tu turno, si el enemigo tiene {incendioAt}+ Quemadura, la sufre una vez más.', now: 'Al final de tu turno, con {incendioAt}+ Quemadura, el enemigo la sufre {n} {n|vez|veces} más.' },
    permahielo: { cat: 'you', icon: 'wall', color: 0xd8efff, chars: ['criomante'], name: 'Permafrost', desc: 'Poder: tu Escudo de Hielo ya no se derrite al empezar tu turno.' },
    prismt: { cat: 'you', icon: 'prism', color: 0x6fa8ff, chars: ['criomante'], name: 'Prisma de Hielo', desc: 'Tu próximo Fragmentar de este turno no consume la Escarcha del enemigo.' },
    polar: { cat: 'you', icon: 'heart', color: 0x8fd4ff, chars: ['criomante'], name: 'Corazón Polar', desc: 'Poder: cada vez que Congelas al enemigo, sufre daño.', now: 'Cada vez que Congelas al enemigo, sufre {n} de daño.' },
    golemr: { cat: 'you', icon: 'rune_piedra', color: 0xd8c9a8, chars: ['guardiana'], name: 'Gólem de Runas', desc: 'Poder: tu Bloqueo no se pierde al empezar tu turno mientras tengas {golemStones}+ runas de Piedra.' },
    alma: { cat: 'you', icon: 'leaf', color: 0xc9a8ff, chars: ['invocadora'], name: 'Alma del Bosque', desc: 'Poder: cuando una criatura muere, robas cartas y ganas Bloqueo.', now: 'Cuando una criatura muere, robas {n} y ganas {b} de Bloqueo.' },
    saviae: { cat: 'you', icon: 'drop', color: 0x6fd08a, chars: ['invocadora'], name: 'Savia Eterna', desc: 'Poder: al final de tu turno, tus criaturas recuperan PV.', now: 'Al final de tu turno, tus criaturas recuperan {n} PV.' },
    madre: { cat: 'you', icon: 'summon_lobezno', color: 0xe0a46a, chars: ['invocadora'], name: 'Madre del Bosque', desc: 'Poder: al empezar tu turno, si tienes menos de 3 criaturas, invocas un Lobezno Espectral.' },
    votiva: { cat: 'you', icon: 'sun', color: 0xe0475a, chars: ['paladin'], name: 'Llama Votiva', desc: 'Poder: ganas Fervor por los PV que pierdes por tus cartas en este combate.', now: '+{n} de Fervor por cada {per} PV que pierdas por tus cartas (llevas {l}).' },
    castillo: { cat: 'you', icon: 'shield', color: 0xa8c8ff, chars: ['paladin'], name: 'Castillo de Fe', desc: 'Poder: tu Bloqueo no se pierde al empezar tu turno.' },
    perpetua: { cat: 'you', icon: 'snow', color: 0x8fd4ff, chars: ['criomante'], name: 'Escarcha Perpetua', desc: 'Poder: al Congelar al enemigo, conserva parte de su Escarcha.', now: 'Al Congelar al enemigo, conserva {n} de Escarcha.' },
    contra: { cat: 'you', icon: 'shield', color: 0xd8efff, chars: ['criomante'], name: 'Contraataque Gélido', desc: 'Si el enemigo te ataca este turno, recibe la mitad de tu Escudo de Hielo restante.' },
    coffin: { cat: 'enemy', icon: 'snow', color: 0xbfe3ff, chars: ['criomante'], name: 'Ataúd de Hielo', desc: 'Seguirá Congelado un turno más.' },
    cantera: { cat: 'you', icon: 'rune_piedra', color: 0xd8c9a8, chars: ['guardiana'], name: 'Cantera Viva', desc: 'Poder: cada vez que una runa Detona, Grabas Piedra si hay una ranura libre.' },
    cicloe: { cat: 'you', icon: 'rune_fuego', color: 0xff7a3d, chars: ['guardiana'], name: 'Ciclo Eterno', desc: 'Poder: cada runa que Detona se vuelve a Grabar al final de tu turno.' },
    grabado: { cat: 'you', icon: 'rune_fuego', color: 0xff9a52, chars: ['guardiana'], name: 'Grabado Profundo', desc: 'Poder: el pasivo de tus runas de Fuego inflige más daño.', now: 'El pasivo de tus runas de Fuego inflige +{n} de daño.' },
    raiz: { cat: 'you', icon: 'leaf', color: 0x6fd08a, chars: ['invocadora'], name: 'Raíz Profunda', desc: 'Poder: tus criaturas reciben menos daño por golpe.', now: 'Tus criaturas reciben {n} de daño menos por golpe.' },
    avatar: { cat: 'you', icon: 'sun', color: 0xffe9a8, chars: ['paladin'], name: 'Avatar de la Luz', desc: 'Poder: tu Fervor cuenta el doble.' },
    espejoj: { cat: 'you', icon: 'mirror', color: 0xf2d36b, chars: ['paladin'], name: 'Escudo Reflejo', desc: 'Si el enemigo te ataca este turno, recibe Juicio.', now: 'Si el enemigo te ataca este turno, recibe {n} de Juicio.' },
    // Electromante
    static: { cat: 'you', icon: 'ebolt', color: 0x7fd6ff, chars: ['electromante'], name: 'Estática', match: 'Estáticas?', desc: 'La ganan tus cartas (máx. {staticMax}). Si acabas tu turno con {staticMax}, Sobrecarga.', now: 'Llevas {n} de {staticMax}. Con {staticMax} al final de tu turno, Sobrecarga.' },
    overload: { cat: 'char', icon: 'burst', color: 0xffe066, chars: ['electromante'], name: 'Sobrecarga', match: 'Sobrecargas?', desc: 'Al final de tu turno, con {staticMax} de Estática: inflige {overloadDmg} de daño a todos los enemigos ({overloadSolo} si solo queda uno) y la Estática vuelve a 0.' },
    bolt: { cat: 'char', icon: 'ebolt', color: 0x7fd6ff, chars: ['electromante'], name: 'Rayo', match: 'Rayos?', desc: 'Inflige ese daño al objetivo. Cuenta como un Ataque (Reflejo solo devuelve el golpe principal, no los saltos).' },
    chain: { cat: 'char', icon: 'ebolt', color: 0x7fd6ff, chars: ['electromante'], name: 'Encadenar', match: 'Encaden(?:a|an|ar)', desc: 'Después del golpe, el Rayo salta a esa cantidad de enemigos distintos (al azar, sin repetir) con la mitad del daño. Cada salto que no encuentra a quién saltar te da 1 de Estática.' },
    magnet: { cat: 'enemy', icon: 'magnet', color: 0xff7a7a, chars: ['electromante'], name: 'Magnetizado', match: 'Magnetizad[oa]s?', desc: 'Recibe +2 de daño de Rayo por cada punto. Baja 1 al final de su turno.', now: 'Recibe +{b} de daño de cada Rayo. Baja 1 al final de su turno.' },
    bobina: { cat: 'you', icon: 'coil', color: 0x7fd6ff, chars: ['electromante'], name: 'Bobina de Tesla', desc: 'Poder: al final de tu turno ganas Estática.', now: 'Al final de tu turno, +{n} Estática.' },
    bucle: { cat: 'you', icon: 'loop', color: 0x9ff0d0, chars: ['electromante'], name: 'Bucle Infinito', desc: 'Poder: la 4.ª carta que juegas cada turno te devuelve Energía.', now: 'La 4.ª carta que juegas cada turno te devuelve {n} de Energía.' },
    nucleo: { cat: 'you', icon: 'prism', color: 0xffe066, chars: ['electromante'], name: 'Núcleo de Plasma', desc: 'Poder: cada Sobrecarga te da Energía y cartas en tu siguiente turno.', now: 'Cada Sobrecarga te da {e} de Energía y {e} cartas en tu siguiente turno.' },
    velocidad: { cat: 'you', icon: 'up', color: 0x9ff0d0, chars: ['electromante'], name: 'Velocidad de la Luz', desc: 'Poder: tus cartas de coste 0 roban al jugarse.', now: 'Tus cartas de coste 0 roban {n} al jugarse.' },
    galvan: { cat: 'you', icon: 'coil', color: 0xffe066, chars: ['electromante'], name: 'Galvanizar', desc: 'Poder: cada Ataque que juegas te da Estática.', now: 'Cada Ataque que juegas te da +{n} Estática.' },
    ojotormenta: { cat: 'you', icon: 'eye', color: 0x7fd6ff, chars: ['electromante'], name: 'Ojo de la Tormenta', desc: 'Poder: tus Rayos Encadenan más veces.', now: 'Tus Rayos Encadenan {n} {n|vez|veces} más.' },
    superc: { cat: 'you', icon: 'prism', color: 0x9ff0d0, chars: ['electromante'], name: 'Superconductor', desc: 'Poder: tus cartas de coste 0 te dan Estática al jugarse.', now: 'Tus cartas de coste 0 te dan +{n} Estática al jugarse.' },
    relay: { cat: 'you', icon: 'coil', color: 0x7fd6ff, chars: ['electromante'], name: 'Relé', desc: 'Tu próximo Rayo de este turno Encadena más.', now: 'Tu próximo Rayo de este turno Encadena {n} más.' },
    path: { cat: 'card', icon: 'star', color: 0xf0cf7a, chars: null, name: 'Senda', match: 'Sendas?', desc: 'Cada personaje tiene 3 sendas (estilos de mazo). Al empezar eliges una y recibes su carta inicial; las recompensas y la tienda ofrecen más cartas de las sendas que ya llevas.' },
    runes: { cat: 'char', icon: 'rune', color: 0xffc46a, chars: ['guardiana'], name: 'Runas', match: 'Runas?', desc: 'La Guardiana tiene {runeSlots} ranuras de runa. Al final de tu turno, cada runa activa su pasivo; si Grabas con las ranuras llenas, la más antigua Detona.' },
    engrave: { cat: 'char', icon: 'rune', color: 0xffc46a, chars: ['guardiana'], name: 'Grabar', match: 'Grab(?:a|as|ar|ada|es|e)', desc: 'Añade la runa a la derecha de tus ranuras. Si están llenas, la más antigua Detona y sale.' },
    detonate: { cat: 'char', icon: 'burst', color: 0xffc46a, chars: ['guardiana'], name: 'Detonar', match: 'Deton(?:a|as|ar|an|ado|ada|ados|adas)', desc: 'La runa aplica su efecto de detonación (más fuerte que su pasivo) y sale de su ranura.' },
    runepower: { cat: 'char', icon: 'up', color: 0xffc46a, chars: ['guardiana'], name: 'Potencia de runa', match: 'Potencia(?: de runa)?', desc: 'Suma a los pasivos y detonaciones de tus runas (Viento y Sangre: +1 cada 2 puntos).', now: 'Potencia actual: {n}.' },
    summons: { cat: 'char', icon: 'summon', color: 0x9ff0b4, chars: ['invocadora'], name: 'Criaturas', match: 'Criaturas?', desc: 'La Invocadora lucha con hasta {maxSummons} criaturas. Actúan al final de tu turno, de izquierda a derecha, y los golpes del enemigo van primero a la más antigua (el daño que sobra no pasa a ti).' },
    summon: { cat: 'char', icon: 'summon', color: 0x9ff0b4, chars: ['invocadora'], name: 'Invocar', match: 'Invoc(?:a|as|ar)', desc: 'Añade la criatura a la derecha de tu fila (máx. {maxSummons}; si está llena, la más antigua se va).' },
    bond: { cat: 'char', icon: 'leaf', color: 0x9ff0b4, chars: ['invocadora'], name: 'Vínculo', match: 'Vínculo', desc: 'Suma ese número al ataque de todas tus criaturas.', now: '+{n} al ataque de todas tus criaturas.' },
    shatter: { cat: 'char', icon: 'shard', color: 0x9fdcff, chars: ['criomante'], name: 'Fragmentar', match: 'Fragment(?:a|ar)', desc: 'Inflige el daño indicado por cada Escarcha del enemigo y la consume toda.' },
    area: { cat: 'card', icon: 'burst', color: 0xffd27a, chars: null, name: 'Área', match: 'Área', desc: 'La carta afecta a todos los enemigos a la vez. Con un solo enemigo, funciona igual que siempre.' },
    exhaust: { cat: 'card', icon: 'burst', color: 0xbfb8a0, chars: null, name: 'Agotar', match: 'Agot(?:a|ar|an|ada|adas|arse|e|en)', desc: 'La carta se retira hasta el final del combate.' },
    retain: { cat: 'card', icon: 'book', color: 0xbfb8a0, chars: null, name: 'Conservar', match: 'Conserv(?:ar|a|ada|adas)', desc: 'No se descarta al final del turno: se queda en tu mano.' },
    ethereal: { cat: 'card', icon: 'cloud', color: 0xbfb8a0, chars: null, name: 'Etérea', match: 'Etére(?:a|as)', desc: 'Si sigue en tu mano al final del turno, se Agota.' },
    temper: { cat: 'card', icon: 'up', color: 0xbfb8a0, chars: null, name: 'Templar', match: 'Templ(?:ar|a)', desc: 'Cada vez que la juegas, su daño sube durante el resto del combate.' },
    combo: { cat: 'card', icon: 'spark', color: 0xbfb8a0, chars: null, name: 'Combo', match: 'Combo', desc: 'Si es la carta número N (o más) que juegas este turno, gana su bonus.' },
    xcost: { cat: 'card', icon: 'bolt', color: 0xbfb8a0, chars: null, name: 'Coste X', match: 'Coste X', desc: 'Gasta toda tu Energía. X es la Energía gastada.' },
    power: { cat: 'card', icon: 'prism', color: 0xb27bff, chars: null, name: 'Poder', match: 'Poder(?:es)?', desc: 'Queda activo el resto del combate. Se retira tras jugarse.' },
    unplayable: { cat: 'card', icon: 'lock', color: 0x8a8573, chars: null, name: 'Injugable', match: 'Injugables?', desc: 'No se puede jugar. Solo estorba en tu mano.' },
    curse: { cat: 'card', icon: 'cursecard', color: 0x8a8573, chars: null, name: 'Maldición', match: 'Maldici(?:ón|ones)', desc: 'Carta mala que entra en tu mazo o en tu descarte. Las de combate desaparecen al terminar el combate.' },
    shiver: { cat: 'card', icon: 'snow', color: 0x8a8573, chars: null, name: 'Escalofrío', match: 'Escalofríos?', desc: 'Maldición injugable: ocupa un hueco de tu mano.' },
    scribble: { cat: 'card', icon: 'inkcard', color: 0x8a8573, chars: null, name: 'Garabato', match: 'Garabatos?', desc: 'Maldición injugable: al robarla pierdes 1 de Energía ese turno y se Agota.' },
    i_attack: { cat: 'intent', icon: 'sword', color: 0xe85a3a, chars: null, name: 'Ataque', desc: 'Va a golpearte: el número es el daño por golpe, ya con su Fuerza y tu Débil o su Escarcha (×N golpes).' },
    i_block: { cat: 'intent', icon: 'shield', color: 0x9fd6ff, chars: null, name: 'Defensa', desc: 'Va a ganar Bloqueo, que absorbe tu daño hasta su siguiente turno.' },
    i_buff: { cat: 'intent', icon: 'strength', color: 0xff9a7a, chars: null, name: 'Mejora', desc: 'Va a hacerse más fuerte (normalmente Fuerza).' },
    i_debuff: { cat: 'intent', icon: 'weak', color: 0xb7a6ff, chars: null, name: 'Debilitar', desc: 'Va a ponerte un estado negativo, como Débil.' },
    i_chill: { cat: 'intent', icon: 'snow', color: 0x9fdcff, chars: null, name: 'Frío', match: 'Fr[ií]o', desc: 'Te quita Temperatura. Si no usas Temperatura: al Criomante le da Escudo de Hielo, entumece las runas de la Guardiana, hiere a la criatura más antigua de la Invocadora y le quita 1 de Juicio al enemigo del Paladín.' },
    i_curse: { cat: 'intent', icon: 'cursecard', color: 0x8a8573, chars: null, name: 'Maldecir', desc: 'Baraja Escalofríos en tu descarte para este combate.' },
    i_ink: { cat: 'intent', icon: 'inkcard', color: 0x8a8573, chars: null, name: 'Tinta', match: 'Tinta', desc: 'Baraja Garabatos en tu descarte para este combate.' },
    i_drain: { cat: 'intent', icon: 'manadrop', color: 0x7fe7ff, chars: null, name: 'Drenar', match: 'Dren\\p{L}+', desc: 'Empezarás tu próximo turno con menos Energía (nunca menos de 1).' },
    i_silence: { cat: 'intent', icon: 'vlock', color: 0xc9a8ff, chars: null, name: 'Silencio', match: 'Silenci\\p{L}+', desc: 'Bloquea cartas de tu próxima mano: no podrás jugarlas ese turno.' },
    i_charge: { cat: 'intent', icon: 'hourglass', color: 0xc9a8ff, chars: null, name: 'Cargar', desc: 'Empieza una Carga Arcana: el número es el golpe que descargará.' },
    i_douse: { cat: 'intent', icon: 'drop', color: 0x7fd0ff, chars: null, name: 'Deshielo', match: 'Deshielo', desc: 'Apaga la mitad de la Quemadura que lleva encima.' },
    i_heal: { cat: 'intent', icon: 'heart', color: 0x6fd08a, chars: null, name: 'Curarse', desc: 'Va a recuperar PV.' },
    i_reflect: { cat: 'intent', icon: 'mirror', color: 0xc9a8ff, chars: null, name: 'Espejo', desc: 'Va a ganar cargas de Reflejo.' }
  };

  /* =====================================================================
   * Parche 3.5 — Rejugabilidad (parte 1)
   * Contratos, nodos nuevos del mapa, 16 eventos (con cadenas), cartas de evento,
   * reliquias que cambian cómo juegas, 14 cartas del Electromante y 4 afijos de élite.
   * ===================================================================== */

  /* ---------- Contratos: objetivo opcional que se elige al empezar (3 al azar; 1 o ninguno) ----------
   * reward: 'relic' (una reliquia al azar al terminar el acto) · 'card' (eliges 1 de 3 cartas raras de tu clase)
   *         · 'essence' (Esencia extra al terminar la partida). Si se cumple en el último acto, se paga en Esencia.
   * goal: para el indicador de progreso (cuántos de cuántos). La detección vive en engine.js (contractTick). */
  const CONTRACTS = {
    jefe6:       { name: 'Cazarrecompensas',    icon: 'crown',   reward: 'relic',   goal: 6,  text: 'Mata al jefe del Acto\u00a0I en 6 turnos o menos.' },
    sinhoguera:  { name: 'Vigilia',             icon: 'campfire', reward: 'relic',  text: 'No descanses en ninguna hoguera del Acto\u00a0II.' },
    mazo8:       { name: 'Mazo Ligero',         icon: 'deck',    reward: 'card',    goal: 8,  text: 'Termina un acto con 8 cartas o menos en tu mazo.' },
    intacto3:    { name: 'Sin un Rasguño',      icon: 'shield',  reward: 'relic',   goal: 3,  text: 'Gana 3 combates sin recibir daño.' },
    oro300:      { name: 'Cofre Lleno',         icon: 'coin',    reward: 'essence', ess: 60, goal: 300, text: 'Llega al jefe final con 300 de oro o más.' },
    poderes5:    { name: 'Torre de Poder',      icon: 'up',      reward: 'card',    goal: 5,  text: 'Juega 5 Poderes en un mismo combate.' },
    elites3:     { name: 'Matagigantes',        icon: 'skull',   reward: 'relic',   goal: 2,  text: 'Derrota a 2 élites en un mismo acto.' },
    ahorro:      { name: 'Bolsa Cerrada',       icon: 'bag',     reward: 'essence', ess: 40, text: 'No compres nada durante todo un acto (ni cartas, ni reliquias, ni pociones, ni purgas).' },
    grupo3t:     { name: 'Barrido',             icon: 'sword',   reward: 'card',    goal: 3,  text: 'Gana un combate en grupo en 3 turnos o menos.' },
    // Uno por personaje (solo se ofrece al suyo)
    ascuas25:    { name: 'Pira Viviente',       icon: 'flame',   reward: 'relic',   goal: 25, class: 'piromago',     text: 'Lleva a un enemigo a 25 de Quemadura.' },
    congelajefe: { name: 'Jefe de Hielo',       icon: 'snow',    reward: 'card',    class: 'criomante',    text: 'Congela a un jefe.' },
    runas4:      { name: 'Lluvia de Runas',     icon: 'rune',    reward: 'relic',   goal: 8,  class: 'guardiana',    text: 'Detona 8 runas en un mismo combate.' },
    manada3:     { name: 'Manada Completa',     icon: 'summon',  reward: 'card',    goal: 3,  class: 'invocadora',   text: 'Gana un combate con 3 criaturas vivas.' },
    juicio15:    { name: 'Balanza Implacable',  icon: 'scales',  reward: 'relic',   goal: 15, class: 'paladin',      text: 'Lleva a un enemigo a 15 de Juicio.' },
    tormenta3:   { name: 'Alto Voltaje',        icon: 'ebolt',   reward: 'card',    goal: 4,  class: 'electromante', text: 'Provoca 4 Sobrecargas en un mismo combate.' }
  };
  const CONTRACT_IDS = Object.keys(CONTRACTS);
  /** Esencia de un contrato cumplido que no se ha podido pagar con reliquia o carta (último acto o derrota). */
  const CONTRACT_ESSENCE = 50;

  // Nodos nuevos del mapa (los nombres y descripciones se ven en la leyenda y en los tooltips)
  Object.assign(NODE_TYPES, {
    mystery:     { name: 'Misterio',           desc: 'Puede ser un evento, un combate, una tienda o un cofre.' },
    forge:       { name: 'Forja',              desc: 'Mejora, transforma o fusiona tus cartas.' },
    cursedaltar: { name: 'Altar Maldito',      desc: 'Una reliquia a cambio de una maldición. Puedes negarte.' },
    goldelite:   { name: 'Élite Dorada',       desc: 'Élite con 2 afijos: 2 reliquias a elegir y oro doble.' },
    peddler:     { name: 'Mercader Ambulante', desc: '3 objetos con un 30 % de descuento; solo puedes comprar uno.' }
  });

  // Afijos de élite nuevos (de 6 a 10)
  Object.assign(AFFIXES, {
    rabioso:   { name: 'Rabioso',   color: 0xff6a4a, icon: 'strength', v: { str: 3 },  text: 'La primera vez que baja del 50 % de sus PV, gana 3 de Fuerza.' },
    toxico:    { name: 'Tóxico',    color: 0x9fd35a, icon: 'weak',     v: { weak: 1 }, text: 'Cada vez que te ataca, quedas Débil 1 turno.' },
    explosivo: { name: 'Explosivo', color: 0xff9a3d, icon: 'fireball', v: { dmg: 8 },  text: 'Al morir, explota y te inflige 8 de daño (el Bloqueo lo absorbe).' },
    espejado:  { name: 'Espejado',  color: 0xc9a8ff, icon: 'mirror',   v: { n: 1 },    text: 'Empieza el combate con 1 carga de Reflejo.' }
  });
  AFFIX_IDS.splice(0, AFFIX_IDS.length, ...Object.keys(AFFIXES));

  /* ---------- Cartas de evento (rareza «especial»: nunca salen en recompensas ni tiendas) ---------- */
  Object.assign(CARDS, {
    favorespiritu: {
      class: 'neutral', name: 'Favor del Espíritu', cost: 0, type: 'skill', rarity: 'special', icon: 'ghost', exhaust: true,
      v: { heal: 6 }, up: { heal: 9 }, fx: [['healSelf']], text: 'Recuperas {heal} PV.\nAgotar.'
    },
    alientocria: {
      class: 'neutral', name: 'Aliento de la Cría', cost: 1, type: 'attack', rarity: 'special', icon: 'wyrm', aim: 'all',
      v: { dmg: 8, burn: 2 }, up: { dmg: 11, burn: 3 }, fx: [['attack'], ['burn']], text: 'Inflige {dmg} de daño a todos los enemigos.\nAplica {burn} Quemadura.'
    },
    cancionmarcha: {
      class: 'neutral', name: 'Canción de Marcha', cost: 1, type: 'skill', rarity: 'special', icon: 'horn', retain: true,
      v: { draw: 2 }, up: { draw: 3 }, fx: [['draw']], text: 'Roba {draw} {draw|carta|cartas}.\nConservar.'
    },
    /* ---------- Electromante: 14 cartas nuevas (5 comunes, 5 poco comunes, 4 raras) ---------- */
    descargae: {
      tags: ['descarga'], class: 'electromante', name: 'Descarga Estática', cost: 1, type: 'attack', rarity: 'common', icon: 'ebolt',
      v: { dmg: 5, st: 2 }, up: { dmg: 7, st: 3 }, fx: [['zap'], ['static']], text: 'Rayo {dmg}.\n+{st} Estática.'
    },
    escudoionico: {
      tags: ['descarga'], class: 'electromante', name: 'Escudo Iónico', cost: 1, type: 'skill', rarity: 'common', icon: 'shield',
      v: { block: 7, at: 5, draw: 1 }, up: { block: 10 }, fx: [['ionShield']], text: 'Gana {block} de Bloqueo.\nSi tienes {at} o más de Estática, roba {draw} {draw|carta|cartas}.'
    },
    saltoarco: {
      tags: ['tormenta'], class: 'electromante', name: 'Salto de Arco', cost: 1, type: 'attack', rarity: 'common', icon: 'magnet',
      v: { mag: 1, dmg: 4, chain: 1 }, up: { dmg: 6 }, fx: [['magnet'], ['zap']], text: 'Aplica {mag} de Magnetizado.\nRayo {dmg}.\nEncadena {chain}.'
    },
    pulsorapido: {
      tags: ['circuito'], class: 'electromante', name: 'Pulso Rápido', cost: 0, type: 'attack', rarity: 'common', icon: 'spark',
      v: { dmg: 3, comboN: 3, draw: 1 }, up: { dmg: 4, draw: 2 }, fx: [['zap'], ['comboDraw']], text: 'Rayo {dmg}.\nCombo {comboN}: roba {draw} {draw|carta|cartas}.'
    },
    aislante: {
      tags: ['circuito'], class: 'electromante', name: 'Aislante', cost: 0, type: 'skill', rarity: 'common', icon: 'wall', retain: true,
      v: { block: 4 }, up: { block: 6 }, fx: [['block']], text: 'Gana {block} de Bloqueo.\nConservar.'
    },
    cadenarel: {
      tags: ['tormenta'], class: 'electromante', name: 'Cadena de Relámpagos', cost: 2, type: 'attack', rarity: 'uncommon', icon: 'ebolt',
      v: { dmg: 9, chain: 3 }, up: { dmg: 12 }, fx: [['zap']], text: 'Rayo {dmg}.\nEncadena {chain}.'
    },
    campomag: {
      tags: ['tormenta'], class: 'electromante', name: 'Campo Magnético', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'magnet', aim: 'all',
      v: { mag: 2 }, up: { mag: 3 }, fx: [['magnetAll']], text: 'Aplica {mag} de Magnetizado a todos los enemigos.'
    },
    galvanizar: {
      tags: ['descarga'], class: 'electromante', name: 'Galvanizar', cost: 1, type: 'power', rarity: 'uncommon', icon: 'coil',
      v: { amt: 1 }, up: { cost: 0 }, fx: [['power', 'galvan']], text: 'Cada vez que juegas un Ataque, +{amt} Estática.'
    },
    retroalim: {
      tags: ['circuito'], class: 'electromante', name: 'Retroalimentación', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'loop',
      v: { draw: 2, st: 1 }, up: { draw: 3 }, fx: [['draw'], ['staticPerZero']], text: 'Roba {draw} {draw|carta|cartas}.\n+{st} Estática por cada carta de coste 0 en tu mano.'
    },
    cortafuegos: {
      tags: ['descarga'], class: 'electromante', name: 'Cortafuegos', cost: 1, type: 'skill', rarity: 'uncommon', icon: 'wall',
      v: { block: 4, mult: 2 }, up: { block: 6 }, fx: [['staticBlock']], text: 'Gana {block} de Bloqueo más {mult} por cada punto de Estática.'
    },
    ojotormenta: {
      tags: ['tormenta'], class: 'electromante', name: 'Ojo de la Tormenta', cost: 2, type: 'power', rarity: 'rare', icon: 'eye',
      v: { amt: 1 }, up: { cost: 1 }, fx: [['power', 'ojotormenta']], text: 'Tus Rayos Encadenan {amt} vez más.'
    },
    descargatotal: {
      tags: ['descarga'], class: 'electromante', name: 'Descarga Total', cost: 2, type: 'skill', rarity: 'rare', icon: 'burst', exhaust: true,
      v: { exTxt: '\nAgotar.' }, up: { cost: 1 }, fx: [['forceOverload']], text: 'Provoca una Sobrecarga ahora, aunque no tengas 10 de Estática.{exTxt}'
    },
    superconductor: {
      tags: ['circuito', 'descarga'], class: 'electromante', name: 'Superconductor', cost: 1, type: 'power', rarity: 'rare', icon: 'prism',
      v: { amt: 1 }, up: { amt: 2 }, fx: [['power', 'superc']], text: 'Tus cartas de coste 0 te dan +{amt} Estática al jugarse.'
    },
    truenojuicio: {
      tags: ['tormenta'], class: 'electromante', name: 'Juicio del Trueno', cost: 3, type: 'attack', rarity: 'rare', icon: 'ebolt', aim: 'all',
      v: { dmg: 10, st: 1 }, up: { dmg: 14 }, fx: [['zap'], ['staticPerAlive']], text: 'Rayo {dmg} a todos los enemigos.\n+{st} Estática por cada enemigo vivo.'
    }
  });

  /* ---------- Reliquias nuevas ---------- */
  Object.assign(RELICS, {
    // 10 comunes «de construcción» (para todos)
    eco:        { class: 'any', name: 'Diapasón de Eco',      icon: 'loop',     text: 'La primera carta de coste 0 que juegas cada turno se juega 2 veces.' },
    bateria:    { class: 'any', name: 'Batería Agotada',      icon: 'manadrop', text: 'Si terminas el turno con 0 de Energía, robas 1 carta más el siguiente.' },
    metronomo:  { class: 'any', name: 'Metrónomo',            icon: 'hourglass', text: 'Cada 4.º Ataque que juegas en un combate cuesta 0.' },
    cenizas:    { class: 'any', name: 'Cenizas Vengativas',   icon: 'fireball', v: 3, text: 'Cada vez que una carta se Agota, inflige 3 de daño a todos los enemigos.' },
    corcho:     { class: 'any', name: 'Corcho Encantado',     icon: 'flask',    v: 4, text: 'Las pociones que bebes en combate también te dan 4 de Bloqueo.' },
    lastre:     { class: 'any', name: 'Lastre del Coleccionista', icon: 'deck', v: 25, text: 'Si tu mazo tiene 25 cartas o más, empiezas cada combate con +1 Energía.' },
    diezmo:     { class: 'any', name: 'Bolsa de Diezmos',     icon: 'coin',     v: 15, text: 'Al ganar un combate sin perder PV, +15 de oro.' },
    vela:       { class: 'any', name: 'Vela de Vigilia',      icon: 'campfire', v: 6, text: 'Si terminas un turno sin haber jugado ningún Ataque, ganas 6 de Bloqueo.' },
    dado:       { class: 'any', name: 'Dado Cargado',         icon: 'disk',     text: 'Al empezar cada combate, una carta al azar de tu mano cuesta 0 ese turno.' },
    clepsidra:  { class: 'any', name: 'Clepsidra',            icon: 'urn',      v: 5, text: 'Cada vez que barajas tus descartes en el mazo, ganas 5 de Bloqueo.' },
    // Guardiana
    polvoruna:  { class: 'guardiana', name: 'Polvo de Runa',      icon: 'rune',        v: 3, text: 'Cada vez que detonas una runa, ganas 3 de Bloqueo.' },
    glifo:      { class: 'guardiana', name: 'Glifo Protector',    icon: 'rune_piedra', v: 5, text: 'Si terminas el turno con todas tus ranuras de runa llenas, ganas 5 de Bloqueo.' },
    esquirlar:  { class: 'guardiana', name: 'Esquirla Rúnica',    icon: 'shard',       v: 2, text: 'Cada vez que detonas una runa, inflige 2 de daño a todos los enemigos.' },
    // Paladín
    balanza:    { class: 'paladin', name: 'Balanza Dorada',     icon: 'scales', text: 'Cada vez que aplicas Juicio, aplicas 1 más.' },
    cirio:      { class: 'paladin', name: 'Cirio Votivo',       icon: 'sun',    v: 4, text: 'La primera vez en cada turno que una carta te quita PV, ganas 4 de Bloqueo.' },
    escudomartir: { class: 'paladin', name: 'Escudo del Mártir', icon: 'shield', text: 'Al empezar cada combate, ganas Bloqueo igual al doble de tu Fervor.' },
    // Electromante
    acumulador: { class: 'electromante', name: 'Acumulador',     icon: 'coil',   v: 2, text: 'Al empezar tu turno, si tienes 0 de Estática, ganas 2.' },
    toroide:    { class: 'electromante', name: 'Toroide de Cobre', icon: 'loop',  text: 'Tus Rayos Encadenan 1 vez más.' },
    fusible:    { class: 'electromante', name: 'Fusible Quemado', icon: 'burst',  v: 2, text: 'Después de cada Sobrecarga, robas 2 cartas.' },
    // Invocadora
    silbato:    { class: 'invocadora', name: 'Silbato de Hueso',  icon: 'horn',  v: 2, text: 'Cada vez que invocas una criatura, ganas 2 de Bloqueo.' },
    coronamusgo: { class: 'invocadora', name: 'Corona de Musgo', icon: 'leaf',  text: 'Cada vez que muere una de tus criaturas, robas 1 carta.' },
    cuenco:     { class: 'invocadora', name: 'Cuenco de Ofrendas', icon: 'urn', v: 4, text: 'Al ganar un combate con al menos 1 criatura viva, recuperas 4 PV.' }
  });

  /* Reliquias de jefe nuevas: +1 Energía con una pega fuerte */
  Object.assign(BOSS_RELICS, {
    velo:      { class: 'any', name: 'Velo de la Ceguera',    icon: 'eye',       good: '+1 Energía por turno.', bad: 'No ves las intenciones de los enemigos.' },
    insomne:   { class: 'any', name: 'Ojo del Insomne',       icon: 'eye',       good: '+1 Energía por turno.', bad: 'No puedes usar las hogueras (ni descansar ni mejorar).' },
    grilletes: { class: 'any', name: 'Grilletes del Tiempo',  icon: 'lock',      good: '+1 Energía por turno.', bad: 'Robas 1 carta menos cada turno.' },
    usurero:   { class: 'any', name: 'Sello del Usurero',     icon: 'coin',      good: '+1 Energía por turno.', bad: 'Todo en las tiendas cuesta un 50 % más.' },
    odre:      { class: 'any', name: 'Odre Agrietado',        icon: 'flask',     good: '+1 Energía por turno.', bad: 'Solo puedes llevar 1 poción.' },
    penitente: { class: 'any', name: 'Cadena del Penitente',  icon: 'cursecard', good: '+1 Energía por turno.', bad: 'Empiezas cada combate con 1 Escalofrío en la mano.' }
  });
  for (const id of ['velo', 'insomne', 'grilletes', 'usurero', 'odre', 'penitente']) BOSS_RELICS[id].text = `${BOSS_RELICS[id].good} ${BOSS_RELICS[id].bad}`;
  Object.assign(ALL_RELICS, RELICS, BOSS_RELICS);
  /** Reliquias de jefe que suman +1 Energía por turno (la pega va aparte, en el motor). */
  const ENERGY_BOSS_RELICS = ['corona', 'nucleo', 'velo', 'insomne', 'grilletes', 'usurero', 'odre', 'penitente'];

  /* ---------- Eventos nuevos ----------
   * needs(run): el evento solo puede salir si se cumple (cadenas). show(run) en una opción: la opción solo se ve
   * si se cumple (opciones de clase, reliquia, oro o PV). node: true → no sale al azar (lo abre un nodo del mapa).
   * run.flags guarda las consecuencias de las cadenas: deuda ('debe' → 'pagada' | 'saldada' | 'huida'),
   * espiritu ('libre') y huevo (true). */
  const flag = (run, k) => (run.flags || {})[k];
  const hasBookRelic = (run) => run.relics.some((id) => (ALL_RELICS[id] || {}).icon === 'book');
  Object.assign(EVENTS, {
    // ---------- Acto III (7) ----------
    socio: {
      acts: [3], chainId: 'deuda', needs: (run) => flag(run, 'deuda') === 'pagada',
      title: 'El Socio del Mercader',
      text: 'Una mujer con la misma mochila enorme te saluda. «Mi socio dice que pagas tus deudas. Eso, aquí abajo, vale oro».',
      choices: [
        { label: 'Aceptar su regalo', desc: 'Una reliquia al azar.',
          run: (run, api) => { const r = api.randomRelic(); if (r) { api.addRelic(r); return { text: _m('rj.ev.socio.relic', { 0: api.relicLabel(r) }) }; } api.gold(100); return { text: _m('rj.ev.socio.gold') }; } },
        { label: 'Pedirle oro', desc: '+100 de oro.',
          run: (run, api) => { api.gold(100); return { text: _m('rj.ev.socio.gold') }; } }
      ]
    },
    favorespiritu: {
      acts: [3], chainId: 'espiritu', needs: (run) => flag(run, 'espiritu') === 'libre',
      title: 'El Espíritu Agradecido',
      text: 'Una luz azulada se posa en tu hombro. Es el espíritu que liberaste en las cumbres. «Te debo una», susurra.',
      choices: [
        { label: 'Sanar tus heridas', desc: 'Recuperas todos tus PV.',
          run: (run, api) => { api.heal(run.maxHp); return { text: _m('rj.ev.favor.heal') }; } },
        { label: 'Bendecir tus cartas', desc: 'Mejora 3 cartas al azar.',
          run: (run, api) => { const ids = [api.upgradeRandom(), api.upgradeRandom(), api.upgradeRandom()].filter(Boolean); return { text: ids.length ? _m('rj.ev.favor.up', { 0: api.upList(ids) }) : _m('rj.ev.favor.none') }; } },
        { label: 'Quedarte con su recuerdo', desc: 'Añade Favor del Espíritu a tu mazo.',
          run: (run, api) => { api.addCard('favorespiritu'); return { text: _m('rj.ev.favor.card', { 0: api.cardLabel('favorespiritu') }) }; } }
      ]
    },
    eclosion: {
      acts: [3], chainId: 'huevo', needs: (run) => !!flag(run, 'huevo'),
      title: 'El Huevo Eclosiona',
      text: 'El huevo que sacaste del cofre musgoso se agrieta en tu mochila. Una cría de dragón asoma la cabeza y estornuda chispas.',
      choices: [
        { label: 'Criarla', desc: 'Añade Aliento de la Cría a tu mazo.',
          run: (run, api) => { api.addCard('alientocria'); return { text: _m('rj.ev.eclosion.card', { 0: api.cardLabel('alientocria') }) }; } },
        { label: 'Dejar que crezca', desc: '+10 PV máximos.',
          run: (run, api) => { api.maxHp(10); return { text: _m('rj.ev.eclosion.hp') }; } },
        { label: 'Vendérsela a un coleccionista', desc: '+150 de oro.',
          run: (run, api) => { api.gold(150); return { text: _m('rj.ev.eclosion.gold') }; } }
      ]
    },
    archivero: {
      acts: [3],
      title: 'El Archivero Ciego',
      text: 'Un anciano sin ojos ordena pergaminos al tacto. «Léeme algo, viajero. O préstame uno de tus libros, si llevas alguno».',
      choices: [
        { label: 'Leer en voz alta', desc: '60 %: duplicas una carta de tu mazo. 40 %: pierdes 8 PV.',
          run: (run, api) => { if (api.chance(0.6)) return { text: _m('rj.ev.archivero.dup'), pick: 'duplicate', count: 1 }; api.loseHp(8); return { text: _m('rj.ev.archivero.hurt') }; } },
        { label: 'Prestarle un libro', desc: 'Eliges 1 de 3 cartas raras.', show: hasBookRelic,
          run: (run, api) => ({ text: _m('rj.ev.archivero.book'), pick: 'choose', count: 1, options: api.offerCards('rare', 3) }) },
        { label: 'Irse', desc: '',
          run: () => ({ text: _m('rj.ev.archivero.leave') }) }
      ]
    },
    geoda: {
      acts: [3],
      title: 'La Geoda Viva',
      text: 'Una geoda del tamaño de un carro late con luz violeta. Por dentro, algo zumba como una colmena de cristal.',
      choices: [
        { label: 'Romperla', desc: '50 %: una poción rara y 40 de oro. 50 %: pierdes 10 PV y un Garabato.',
          run: (run, api) => {
            if (api.chance(0.5)) { const id = api.randomPotion('rare'); const ok = api.addPotion(id); api.gold(40); return { text: ok ? _m('rj.ev.geoda.win', { 0: api.potionLabel(id) }) : _m('rj.ev.geoda.winfull') }; }
            api.loseHp(10); api.addCard('garabato'); return { text: _m('rj.ev.geoda.lose') };
          } },
        { label: 'Cargarla de Estática', desc: 'Mejora 2 cartas al azar.', show: (run) => run.char === 'electromante',
          run: (run, api) => { const ids = [api.upgradeRandom(), api.upgradeRandom()].filter(Boolean); return { text: ids.length ? _m('rj.ev.geoda.charge', { 0: api.upList(ids) }) : _m('rj.ev.favor.none') }; } },
        { label: 'Escucharla', desc: '+5 PV máximos.',
          run: (run, api) => { api.maxHp(5); return { text: _m('rj.ev.geoda.listen') }; } }
      ]
    },
    portal: {
      acts: [3],
      title: 'Portal al Vacío',
      text: 'Un círculo de nada flota sobre el suelo. Al otro lado se ven estrellas que no conoces y un brillo de tesoro.',
      choices: [
        { label: 'Cruzarlo', desc: '70 %: una reliquia y 50 de oro. 30 %: pierdes 8 PV máximos.',
          run: (run, api) => {
            if (api.chance(0.7)) { const r = api.randomRelic(); api.gold(50); if (r) { api.addRelic(r); return { text: _m('rj.ev.portal.win', { 0: api.relicLabel(r) }) }; } return { text: _m('rj.ev.portal.gold') }; }
            api.loseMaxHp(8); return { text: _m('rj.ev.portal.lose') };
          } },
        { label: 'Sellarlo (80 de oro)', desc: 'Quitas 1 carta de tu mazo.',
          cond: (run) => run.gold >= 80 && run.deck.length >= 2, condText: 'Necesitas 80 de oro.',
          run: (run, api) => { api.gold(-80); return { text: _m('rj.ev.portal.seal'), pick: 'remove', count: 1 }; } },
        { label: 'Irse', desc: '',
          run: () => ({ text: _m('rj.ev.portal.leave') }) }
      ]
    },
    corona: {
      acts: [3],
      title: 'La Corona Olvidada',
      text: 'Sobre un trono de cuarzo descansa una corona de hierro negro. Quien se la pone oye una voz: «Más. Siempre más».',
      choices: [
        { label: 'Ponértela', desc: 'Pierdes 15 PV. Una reliquia de jefe al azar.',
          cond: (run) => run.hp > 15, condText: 'Necesitas más de 15 PV.',
          run: (run, api) => { api.loseHp(15); const id = api.randomBossRelic(); if (id) { api.addRelic(id); return { text: _m('rj.ev.corona.boss', { 0: api.relicLabel(id) }) }; } api.gold(80); return { text: _m('rj.ev.corona.none') }; } },
        { label: 'Consagrarla', desc: '+8 PV máximos y mejora 1 carta al azar.', show: (run) => run.char === 'paladin',
          run: (run, api) => { api.maxHp(8); const id = api.upgradeRandom(); return { text: _m('rj.ev.corona.holy', { 0: id ? api.cardRef(id, true) : '—' }) }; } },
        { label: 'Fundirla', desc: '+90 de oro.',
          run: (run, api) => { api.gold(90); return { text: _m('rj.ev.corona.gold') }; } }
      ]
    },
    // ---------- Acto II (5) ----------
    cobrador: {
      acts: [2], chainId: 'deuda', needs: (run) => flag(run, 'deuda') === 'debe',
      title: 'El Cobrador',
      text: 'Un tipo enorme con una libreta te corta el paso en la nieve. «El mercader del bosque te fió una reliquia. Vengo a cobrar».',
      choices: [
        { label: 'Pagar (90 de oro)', desc: 'Saldas la deuda… y alguien lo recordará.',
          cond: (run) => run.gold >= 90, condText: 'Necesitas 90 de oro.',
          run: (run, api) => { api.gold(-90); api.setFlag('deuda', 'pagada'); return { text: _m('rj.ev.cobrador.pay') }; } },
        { label: 'Pagar con sangre', desc: 'Pierdes 6 PV máximos.',
          run: (run, api) => { api.loseMaxHp(6); api.setFlag('deuda', 'saldada'); return { text: _m('rj.ev.cobrador.blood') }; } },
        { label: 'Huir', desc: '50 %: escapas. 50 %: pierdes 12 PV y 50 de oro.',
          run: (run, api) => { api.setFlag('deuda', 'huida'); if (api.chance(0.5)) return { text: _m('rj.ev.cobrador.run') }; api.loseHp(12); api.gold(-50); return { text: _m('rj.ev.cobrador.caught') }; } }
      ]
    },
    espiritu: {
      acts: [2], chainId: 'espiritu',
      title: 'Espíritu Encadenado',
      text: 'Unas cadenas de hielo atan a un espíritu azul a la roca. Te mira sin decir nada; el frío le está apagando.',
      choices: [
        { label: 'Romper las cadenas', desc: 'Pierdes 8 PV. Quizá te lo devuelva algún día.',
          cond: (run) => run.hp > 8, condText: 'Necesitas más de 8 PV.',
          run: (run, api) => { api.loseHp(8); api.setFlag('espiritu', 'libre'); return { text: _m('rj.ev.espiritu.free') }; } },
        { label: 'Absorber su esencia', desc: 'Mejora 2 cartas al azar. Recibes un Escalofrío.',
          run: (run, api) => { const ids = [api.upgradeRandom(), api.upgradeRandom()].filter(Boolean); api.addCard('escalofrio'); return { text: _m('rj.ev.espiritu.absorb', { 0: ids.length ? api.upList(ids) : '—' }) }; } },
        { label: 'Irse', desc: '',
          run: () => ({ text: _m('rj.ev.espiritu.leave') }) }
      ]
    },
    avalancha: {
      acts: [2],
      title: 'Avalancha',
      text: 'Un rugido blanco baja por la ladera. Bajo la nieve que se acerca asoma la mano de un viajero atrapado.',
      choices: [
        { label: 'Desenterrar al viajero', desc: '60 %: una reliquia al azar. 40 %: pierdes 12 PV.',
          run: (run, api) => { if (api.chance(0.6)) { const r = api.randomRelic(); if (r) { api.addRelic(r); return { text: _m('rj.ev.avalancha.win', { 0: api.relicLabel(r) }) }; } api.gold(50); return { text: _m('rj.ev.avalancha.gold') }; } api.loseHp(12); return { text: _m('rj.ev.avalancha.lose') }; } },
        { label: 'Detener la nieve', desc: 'Mejora 1 carta al azar y +50 de oro.', show: (run) => run.char === 'criomante',
          run: (run, api) => { const id = api.upgradeRandom(); api.gold(50); return { text: _m('rj.ev.avalancha.frost', { 0: id ? api.cardRef(id, true) : '—' }) }; } },
        { label: 'Refugiarte', desc: 'Pierdes 4 PV.',
          run: (run, api) => { api.loseHp(4); return { text: _m('rj.ev.avalancha.hide') }; } }
      ]
    },
    herrero: {
      acts: [2],
      title: 'El Herrero de Escarcha',
      text: 'Un enano forja junto a un glaciar, usando el hielo como yunque. «Te mejoro lo que quieras. Si pagas».',
      choices: [
        { label: 'Mejorar una carta (50 de oro)', desc: 'Eliges qué carta mejorar.',
          cond: (run) => run.gold >= 50 && run.deck.some((c) => !c.up && CARDS[c.id] && CARDS[c.id].up), condText: 'Necesitas 50 de oro y una carta mejorable.',
          run: (run, api) => { api.gold(-50); return { text: _m('rj.ev.herrero.up'), pick: 'upgrade', count: 1 }; } },
        { label: 'Venderle una poción', desc: '+70 de oro (pierdes tu primera poción).',
          show: (run) => (run.potions || []).some(Boolean),
          run: (run, api) => { const id = api.dropPotion(); api.gold(70); return { text: _m('rj.ev.herrero.sell', { 0: id ? api.potionLabel(id) : '—' }) }; } },
        { label: 'Irse', desc: '',
          run: () => ({ text: _m('rj.ev.herrero.leave') }) }
      ]
    },
    termas: {
      acts: [2],
      title: 'Aguas Termales',
      text: 'Entre la nieve humea una poza de agua caliente. Huele a azufre y a descanso merecido.',
      choices: [
        { label: 'Bañarte', desc: 'Recuperas 15 PV.',
          run: (run, api) => { api.heal(15); return { text: _m('rj.ev.termas.bath') }; } },
        { label: 'Calentarlas aún más', desc: '+6 PV máximos.', show: (run) => run.char === 'piromago',
          run: (run, api) => { api.maxHp(6); return { text: _m('rj.ev.termas.fire') }; } },
        { label: 'Lavar tus maldiciones', desc: 'Quitas todas las Maldiciones de tu mazo. Pierdes 6 PV.',
          cond: (run) => run.deck.some((c) => CARDS[c.id] && CARDS[c.id].type === 'curse'), condText: 'No tienes ninguna Maldición.',
          run: (run, api) => { const n = api.removeCurses(); api.loseHp(6); return { text: _m('rj.ev.termas.clean', { 0: n }) }; } }
      ]
    },
    // ---------- Cualquier acto (4) ----------
    posada: {
      acts: [1, 2, 3],
      title: 'Posada del Cruce',
      text: 'Una posada torcida en mitad de la nada. Dentro huele a guiso y los viajeros cuentan rumores sobre los caminos.',
      choices: [
        { label: 'Pagar una cama (40 de oro)', desc: 'Recuperas la mitad de tus PV máximos.',
          cond: (run) => run.gold >= 40, condText: 'Necesitas 40 de oro.',
          run: (run, api) => { api.gold(-40); api.heal(Math.ceil(run.maxHp / 2)); return { text: _m('rj.ev.posada.bed') }; } },
        { label: 'Escuchar rumores', desc: 'Ves qué hay en las salas de Misterio de este acto.',
          run: (run, api) => { api.setFlag('rumores', run.act || 1); return { text: _m('rj.ev.posada.rumor') }; } },
        { label: 'Seguir', desc: '',
          run: () => ({ text: _m('rj.ev.posada.leave') }) }
      ]
    },
    santuario: {
      acts: [1, 2, 3],
      title: 'Santuario Olvidado',
      text: 'Una hornacina cubierta de musgo guarda una estatuilla sin rostro y un cuenco con monedas antiguas.',
      choices: [
        { label: 'Rezar', desc: '60 %: mejora 1 carta al azar y recuperas 8 PV. 40 %: recibes un Escalofrío.',
          run: (run, api) => { if (api.chance(0.6)) { const id = api.upgradeRandom(); api.heal(8); return { text: _m('rj.ev.santuario.pray', { 0: id ? api.cardRef(id, true) : '—' }) }; } api.addCard('escalofrio'); return { text: _m('rj.ev.santuario.curse') }; } },
        { label: 'Saquearlo', desc: '+60 de oro. Pierdes 6 PV.',
          run: (run, api) => { api.gold(60); api.loseHp(6); return { text: _m('rj.ev.santuario.loot') }; } },
        { label: 'Dejar una ofrenda (30 de oro)', desc: '+6 PV máximos.',
          cond: (run) => run.gold >= 30, condText: 'Necesitas 30 de oro.',
          run: (run, api) => { api.gold(-30); api.maxHp(6); return { text: _m('rj.ev.santuario.gift') }; } }
      ]
    },
    bardo: {
      acts: [1, 2, 3],
      title: 'El Bardo Errante',
      text: 'Un bardo afina un laúd con tres cuerdas. «¡Una canción por unas monedas! O una historia por otra historia».',
      choices: [
        { label: 'Pedirle una canción (25 de oro)', desc: 'Añade Canción de Marcha a tu mazo.',
          cond: (run) => run.gold >= 25, condText: 'Necesitas 25 de oro.',
          run: (run, api) => { api.gold(-25); api.addCard('cancionmarcha'); return { text: _m('rj.ev.bardo.song', { 0: api.cardLabel('cancionmarcha') }) }; } },
        { label: 'Contarle tu viaje', desc: 'Recuperas 8 PV.',
          run: (run, api) => { api.heal(8); return { text: _m('rj.ev.bardo.story') }; } },
        { label: 'Seguir', desc: '',
          run: () => ({ text: _m('rj.ev.bardo.leave') }) }
      ]
    },
    ladrona: {
      acts: [1, 2, 3],
      title: 'La Ladronzuela',
      text: 'Una niña con capucha camina muy cerca de ti. Cuando te giras, ya corre con algo tuyo en la mano.',
      choices: [
        { label: 'Perseguirla', desc: '50 %: le quitas su botín (+80 de oro). 50 %: pierdes 30 de oro.',
          run: (run, api) => { if (api.chance(0.5)) { api.gold(80); return { text: _m('rj.ev.ladrona.win') }; } api.gold(-30); return { text: _m('rj.ev.ladrona.lose') }; } },
        { label: 'Ofrecerle un trato', desc: 'Pierdes 1 reliquia al azar. Obtienes 2 reliquias al azar.',
          show: (run) => run.relics.filter((id) => !(RELICS[id] || {}).starter).length >= 2,
          run: (run, api) => { const gone = api.loseRandomRelic(); const a = api.randomRelic(); if (a) api.addRelic(a); const b = api.randomRelic(); if (b) api.addRelic(b);
            return { text: _m('rj.ev.ladrona.deal', { 0: gone ? api.relicLabel(gone) : '—', 1: a ? api.relicLabel(a) : '—', 2: b ? api.relicLabel(b) : '—' }) }; } },
        { label: 'Dejarla ir', desc: '',
          run: () => ({ text: _m('rj.ev.ladrona.leave') }) }
      ]
    },
    // ---------- Pantallas de nodo y de contrato (no salen al azar) ----------
    forjanodo: {
      node: true, acts: [],
      title: 'Forja',
      text: 'Un yunque tibio, un fuelle remendado y un martillo que pesa justo lo que debe. Aquí puedes trabajar tus cartas.',
      choices: [
        { label: 'Templar', desc: 'Mejora 2 cartas al azar.',
          cond: (run) => run.deck.some((c) => !c.up && CARDS[c.id] && CARDS[c.id].up), condText: 'No tienes cartas mejorables.',
          run: (run, api) => { const ids = [api.upgradeRandom(), api.upgradeRandom()].filter(Boolean); return { text: _m('rj.forge.up', { 0: api.upList(ids) }) }; } },
        { label: 'Transmutar', desc: 'Transforma 1 carta en otra de tu clase de la misma rareza.',
          cond: (run, api) => api.canTransform(), condText: 'No tienes cartas que transformar.',
          run: () => ({ text: _m('rj.forge.tr'), pick: 'transform', count: 1 }) },
        { label: 'Fusionar', desc: '2 copias de la misma carta se funden en 1 versión «++».',
          cond: (run, api) => api.canFuse(), condText: 'Necesitas 2 copias de una carta mejorable.',
          run: () => ({ text: _m('rj.forge.fuse'), pick: 'fuse', count: 1 }) },
        { label: 'Irse', desc: '',
          run: () => ({ text: _m('rj.forge.leave') }) }
      ]
    },
    altarmaldito: {
      node: true, acts: [],
      title: 'Altar Maldito',
      text: 'Un altar de piedra negra rezuma tinta. Sobre él, una reliquia brilla entre cadenas: puedes llevártela… y algo más contigo.',
      choices: [
        { label: 'Aceptar', desc: 'Una reliquia al azar ahora y una Maldición en tu mazo.',
          run: (run, api) => { run.stats.altar = (run.stats.altar || 0) + 1; const r = api.randomRelic(); const curse = api.randomCurse(); api.addCard(curse); if (r) { api.addRelic(r); return { text: _m('rj.altar.yes', { 0: api.relicLabel(r), 1: api.cardLabel(curse) }) }; } api.gold(60); return { text: _m('rj.altar.gold', { 1: api.cardLabel(curse) }) }; } },
        { label: 'Negarte', desc: '',
          run: () => ({ text: _m('rj.altar.no') }) }
      ]
    },
    contrato: {
      node: true, acts: [],
      title: 'Contrato Cumplido',
      text: 'Un sello de lacre se rompe solo en tu bolsillo: has cumplido tu contrato y llega la recompensa.',
      choices: [{ label: 'Continuar', desc: '', run: () => ({ text: '' }) }]
    }
  });

  /* ---------- Glosario: la partida (contratos, nodos nuevos, fusión «++») ---------- */
  GLOSSARY_CATS.push('run');
  Object.assign(GLOSSARY, {
    contract:    { cat: 'run', icon: 'contract', color: 0xf2c94c, chars: null, name: 'Contrato', desc: 'Objetivo opcional que eliges al empezar la partida (1 de 3, o ninguno). Si lo cumples, recibes una reliquia, una carta rara de tu clase o Esencia extra; si fallas, no pasa nada. Su progreso se ve en la barra superior.' },
    mystery:     { cat: 'run', icon: 'question', color: 0xb98cff, chars: null, name: 'Misterio', match: 'Misterios?', desc: 'Sala del mapa que se revela al entrar: evento (60 %), combate (20 %), tienda (10 %) o cofre (10 %).' },
    forge:       { cat: 'run', icon: 'hammer', color: 0xd9904a, chars: null, name: 'Forja', desc: 'Sala del mapa. Eliges una: mejorar 2 cartas al azar, transformar 1 carta en otra de tu clase de la misma rareza o fusionar 2 copias de una carta en su versión «++».' },
    fused:       { cat: 'run', icon: 'up', color: 0x8fe0a0, chars: null, name: 'Carta «++»', desc: 'Carta fusionada en la Forja: además de su mejora, los números de su texto suben un 50 % (redondeando). No se puede mejorar más.' },
    cursedaltar: { cat: 'run', icon: 'cursecard', color: 0x8a5ad8, chars: null, name: 'Altar Maldito', desc: 'Sala del mapa: una reliquia al azar a cambio de una Maldición en tu mazo. Puedes negarte.' },
    goldelite:   { cat: 'run', icon: 'skull', color: 0xffd27a, chars: null, name: 'Élite Dorada', desc: 'Élite rara (como mucho 1 por acto, en los caminos de los bordes del mapa) con 2 afijos. Da 2 reliquias a elegir 1 y el doble de oro.' },
    peddler:     { cat: 'run', icon: 'cart', color: 0xf2c94c, chars: null, name: 'Mercader Ambulante', desc: 'Sala del mapa: una carta, una reliquia y una poción con un 30 % de descuento. Solo puedes comprar una.' }
  });

  /* =====================================================================
   * Parche 3.6 — Rejugabilidad (parte 2): motivos para volver
   * Afinidad por personaje, misiones, desafío semanal, Legado, momentos destacados e hitos del compendio.
   * La lógica vive en meta.js (progreso entre partidas) y engine.js (lo que pasa dentro de la partida).
   * ===================================================================== */

  /* ---------- Afinidad (niveles 1–15) ---------- */
  const AFFINITY_MAX = 15;
  /** XP para pasar del nivel L al L+1 (cada vez un poco más). */
  const affinityNeed = (L) => 140 + 45 * (L - 1);
  /** XP de una partida: pisos, élites, jefes, contrato y victoria (× Ascensión; × dificultad en las personalizadas). */
  const AFFINITY_XP = { floor: 8, elite: 20, boss: 40, contract: 40, win: 150, ascStep: 0.1 };
  /** Recompensa de cada nivel (alternas: siempre hay algo cerca). */
  const AFFINITY_REWARDS = {
    2: { essence: 30 }, 3: { relic: 0 }, 4: { frame: 'silver' }, 5: { back: 'hero' }, 6: { deck: true }, 7: { essence: 50 },
    8: { frame: 'gold' }, 9: { relic: 1 }, 10: { aura: 'hero' }, 11: { essence: 75 }, 12: { frame: 'arcane' }, 13: { essence: 100 },
    14: { essence: 125 }, 15: { title: 'hero' }
  };
  /** Título del nivel 15 de cada personaje. */
  const AFFINITY_TITLES = {
    piromago: 'Archipiromago', criomante: 'Señor del Invierno', guardiana: 'Guardiana Eterna',
    invocadora: 'Voz del Bosque', paladin: 'Mano de la Aurora', electromante: 'Señor de la Tormenta'
  };

  /* ---------- Reliquias iniciales alternativas (Afinidad 3 y 9): cambian el estilo, no son mejores ---------- */
  Object.assign(RELICS, {
    ini_mecha:    { class: 'piromago',     starter: true, alt: true, name: 'Mecha Lenta',         icon: 'flame',     v: 2, text: 'Al empezar cada combate, aplicas 2 de Quemadura a todos los enemigos.' },
    ini_horno:    { class: 'piromago',     starter: true, alt: true, name: 'Horno Portátil',      icon: 'fireball',  v: 3, text: 'Empiezas cada combate con 3 de Temperatura.' },
    ini_copo:     { class: 'criomante',    starter: true, alt: true, name: 'Copo Eterno',         icon: 'snow',      v: 1, text: 'Desde el segundo turno, al empezar cada turno aplicas 1 de Escarcha al enemigo con más PV.' },
    ini_coraza:   { class: 'criomante',    starter: true, alt: true, name: 'Coraza de Escarcha',  icon: 'shield',    v: 10, text: 'Al empezar cada combate, ganas 10 de Bloqueo.' },
    ini_fuego:    { class: 'guardiana',    starter: true, alt: true, name: 'Piedra de Fuego',     icon: 'rune',      text: 'Empiezas cada combate con una Runa de Fuego grabada y 1 ranura de runa más.' },
    ini_viento:   { class: 'guardiana',    starter: true, alt: true, name: 'Piedra de Viento',    icon: 'rune_piedra', text: 'Empiezas cada combate con una Runa de Viento grabada y 1 ranura de runa más.' },
    ini_semilla:  { class: 'invocadora',   starter: true, alt: true, name: 'Semilla de Treant',   icon: 'leaf',      text: 'Empiezas cada combate con un Treant Joven invocado.' },
    ini_pluma:    { class: 'invocadora',   starter: true, alt: true, name: 'Pluma de Búho',       icon: 'eye',       text: 'Empiezas cada combate con un Búho Arcano invocado.' },
    ini_rosario:  { class: 'paladin',      starter: true, alt: true, name: 'Rosario de Espinas',  icon: 'scales',    v: 3, text: 'Al empezar cada combate, pierdes 3 PV y aplicas 1 de Juicio a todos los enemigos.' },
    ini_balanza:  { class: 'paladin',      starter: true, alt: true, name: 'Balanza de Plata',    icon: 'scales',    v: 1, text: 'La primera vez en cada combate que aplicas Juicio, aplicas 1 más.' },
    ini_bobina:   { class: 'electromante', starter: true, alt: true, name: 'Bobina de Arranque',  icon: 'coil',      v: 6, text: 'Empiezas cada combate con 6 de Estática.' },
    ini_iman:     { class: 'electromante', starter: true, alt: true, name: 'Imán de Campo',       icon: 'magnet',    v: 2, text: 'Al empezar cada combate, aplicas 2 de Magnetizado a todos los enemigos.' }
  });
  Object.assign(ALL_RELICS, RELICS);
  /** Las dos alternativas de cada personaje: [nivel 3, nivel 9]. */
  const ALT_STARTERS = {
    piromago: ['ini_mecha', 'ini_horno'], criomante: ['ini_copo', 'ini_coraza'], guardiana: ['ini_fuego', 'ini_viento'],
    invocadora: ['ini_semilla', 'ini_pluma'], paladin: ['ini_rosario', 'ini_balanza'], electromante: ['ini_bobina', 'ini_iman']
  };

  /* ---------- Cosméticos (solo se ven: no cambian nada del juego) ---------- */
  const COSMETICS = {
    frame:  { none: { name: 'Normal' }, silver: { name: 'Plata', color: 0xd8dde6 }, gold: { name: 'Oro', color: 0xf2c94c },
              arcane: { name: 'Arcano', color: 0xb98cff, anim: true }, prism: { name: 'Prismático', color: 0x9ff0ff, anim: true } },
    back:   { none: { name: 'Normal' }, hero: { name: 'Del personaje' }, scroll: { name: 'Pergamino', color: 0xd9c79a } },
    aura:   { none: { name: 'Ninguna' }, hero: { name: 'Del personaje' }, ink: { name: 'Tinta', color: 0x6a5acd } },
    title:  { none: { name: 'Ninguno' }, hero: { name: 'De Afinidad' }, sage: { name: 'Enciclopedista' } }
  };
  const COSMETIC_SLOTS = ['frame', 'back', 'aura', 'title'];

  /* ---------- Hitos del compendio ---------- */
  const CODEX_MILESTONES = [
    { pct: 25, essence: 100, cosmetic: ['back', 'scroll'] },
    { pct: 50, essence: 200, cosmetic: ['aura', 'ink'] },
    { pct: 75, essence: 300, cosmetic: ['title', 'sage'] },
    { pct: 100, essence: 500, cosmetic: ['frame', 'prism'] }
  ];

  /* ---------- Misiones: 40 en 3 dificultades ----------
   * stat: qué se cuenta (meta.js lo lee de la partida) · mode: 'sum' (se acumula entre partidas) o 'max' (en una sola)
   * char: solo con ese personaje · custom: false = no cuentan las personalizadas. */
  const QUEST_REWARD = { 1: { essence: 30, xp: 40 }, 2: { essence: 60, xp: 80 }, 3: { essence: 100, xp: 140 } };
  const QUEST_DAILY_MULT = 2;   // la misión diaria especial da el doble
  const QUESTS = {
    burn60:      { tier: 1, stat: 'burn',     goal: 60,  text: 'Aplica 60 de Quemadura en total.' },
    frost50:     { tier: 1, stat: 'frost',    goal: 50,  text: 'Aplica 50 de Escarcha en total.' },
    kills20:     { tier: 1, stat: 'kills',    goal: 20,  text: 'Derrota a 20 enemigos.' },
    floors20:    { tier: 1, stat: 'floors',   goal: 20,  text: 'Supera 20 pisos.' },
    mystery5:    { tier: 1, stat: 'mystery',  goal: 5,   text: 'Entra en 5 nodos de Misterio.' },
    cards100:    { tier: 1, stat: 'cards',    goal: 100, text: 'Juega 100 cartas.' },
    gold300:     { tier: 1, stat: 'gold',     goal: 300, text: 'Consigue 300 de oro.' },
    potions5:    { tier: 1, stat: 'potions',  goal: 5,   text: 'Bebe 5 pociones.' },
    events6:     { tier: 1, stat: 'events',   goal: 6,   text: 'Vive 6 eventos.' },
    forge2:      { tier: 1, stat: 'forge',    goal: 2,   text: 'Visita 2 Forjas.' },
    daily1:      { tier: 1, stat: 'daily',    goal: 1,   text: 'Juega un desafío diario.' },
    elites3:     { tier: 1, stat: 'elites',   goal: 3,   text: 'Derrota a 3 élites.' },
    summon10:    { tier: 1, stat: 'summons',  goal: 10,  char: 'invocadora',   text: 'Invoca 10 criaturas con la Invocadora.' },
    overload5:   { tier: 1, stat: 'overloads', goal: 5,  char: 'electromante', text: 'Provoca 5 Sobrecargas con el Electromante.' },
    guardElites: { tier: 2, stat: 'elites',   goal: 3,   char: 'guardiana',    text: 'Derrota a 3 élites con la Guardiana.' },
    groupNoDmg:  { tier: 2, stat: 'groupNoDmg', goal: 1, text: 'Gana un combate en grupo sin perder PV.' },
    contracts2:  { tier: 2, stat: 'contracts', goal: 2,  text: 'Completa 2 contratos.' },
    electroAct3: { tier: 2, stat: 'act3',     goal: 1,   char: 'electromante', mode: 'max', text: 'Llega al Acto III con el Electromante.' },
    bosses3:     { tier: 2, stat: 'bosses',   goal: 3,   text: 'Derrota a 3 jefes.' },
    hit40:       { tier: 2, stat: 'maxHit',   goal: 40,  mode: 'max', text: 'Inflige 40 de daño de un solo golpe.' },
    runes15:     { tier: 2, stat: 'runes',    goal: 15,  char: 'guardiana',    text: 'Detona 15 runas con la Guardiana.' },
    judg40:      { tier: 2, stat: 'judg',     goal: 40,  char: 'paladin',      text: 'Aplica 40 de Juicio con el Paladín.' },
    burnPiro:    { tier: 2, stat: 'burn',     goal: 150, char: 'piromago',     text: 'Aplica 150 de Quemadura con el Piromago.' },
    frostCrio:   { tier: 2, stat: 'frost',    goal: 120, char: 'criomante',    text: 'Aplica 120 de Escarcha con el Criomante.' },
    goldElite:   { tier: 2, stat: 'goldKills', goal: 1,  text: 'Derrota a una Élite Dorada.' },
    peddler2:    { tier: 2, stat: 'peddler',  goal: 2,   text: 'Visita 2 Mercaderes Ambulantes.' },
    combo8:      { tier: 2, stat: 'combo',    goal: 8,   mode: 'max', text: 'Juega 8 cartas en un mismo turno.' },
    altar1:      { tier: 2, stat: 'altar',    goal: 1,   text: 'Acepta el trato de un Altar Maldito.' },
    kills60:     { tier: 2, stat: 'kills',    goal: 60,  text: 'Derrota a 60 enemigos.' },
    bossRelics3: { tier: 3, stat: 'bossRelics', goal: 3, mode: 'max', text: 'Termina una partida con 3 reliquias de jefe.' },
    customHard:  { tier: 3, stat: 'customHard', goal: 1, text: 'Gana una partida personalizada en Difícil o más.' },
    win1:        { tier: 3, stat: 'win',      goal: 1,   text: 'Gana una partida.' },
    ascWin:      { tier: 3, stat: 'ascWin',   goal: 1,   custom: false, text: 'Gana una partida en Ascensión 1 o más.' },
    hpLow:       { tier: 3, stat: 'hpLow',    goal: 1,   text: 'Gana un combate con 5 PV o menos.' },
    floors60:    { tier: 3, stat: 'floors',   goal: 60,  text: 'Supera 60 pisos.' },
    deckSmall:   { tier: 3, stat: 'deckSmall', goal: 1,  text: 'Gana una partida con 15 cartas o menos en tu mazo.' },
    hit80:       { tier: 3, stat: 'maxHit',   goal: 80,  mode: 'max', text: 'Inflige 80 de daño de un solo golpe.' },
    bosses8:     { tier: 3, stat: 'bosses',   goal: 8,   text: 'Derrota a 8 jefes.' },
    contracts4:  { tier: 3, stat: 'contracts', goal: 4,  text: 'Completa 4 contratos.' },
    gold1000:    { tier: 3, stat: 'gold',     goal: 1000, text: 'Consigue 1000 de oro.' }
  };
  const QUEST_IDS = Object.keys(QUESTS);

  /* ---------- Desafío semanal ---------- */
  const WEEKLY = { essence: 300, keep: 12, ascMax: 2 };

  /* ---------- Glosario: la partida (Parche 3.6) ---------- */
  Object.assign(GLOSSARY, {
    affinity: { cat: 'run', icon: 'star', color: 0xf2c94c, chars: null, name: 'Afinidad', desc: 'Cada partida da XP de Afinidad al personaje con el que juegas (pisos, élites, jefes, contrato y victoria; más con Ascensión). Cada nivel, hasta el 15, da algo: Esencia, reliquias iniciales alternativas, un mazo inicial de senda o cosméticos.' },
    quest:    { cat: 'run', icon: 'contract', color: 0x8fe0a0, chars: null, name: 'Misión', desc: 'Siempre tienes 3 misiones a la vista en el título y 1 diaria especial. Su progreso cuenta durante la partida y dan Esencia y XP de Afinidad. Puedes cambiar 1 misión al día.' },
    weekly:   { cat: 'run', icon: 'crown', color: 0xc9a8ff, chars: null, name: 'Desafío semanal', desc: 'Un reto igual para todo el mundo cada semana (de lunes a domingo): personaje, senda, semilla y modificadores fijos. Intentos ilimitados; completarlo da Esencia y la insignia de la semana una vez.' },
    legacy:   { cat: 'run', icon: 'card', color: 0xf2c94c, chars: null, name: 'Legado', desc: 'Al ganar una partida normal, puedes elegir 1 carta de tu mazo: tu próxima partida con ese personaje empieza con ella (sin mejorar). Solo dura una partida.' }
  });

  /* ------------------------------------------------------------------ *
   * LORE (Parche 3.7): canon de Arcandia, 24 fragmentos del Compendio, vínculos jefe ↔ personaje
   *   cond (técnico, no se traduce): 'runs' · 'act1boss' · 'combats:N' · 'death' · 'kill:<jefe>' · 'killas:<jefe>:<pj>'
   *   · 'aff5:<pj>' · 'contracts:N' · 'ascwin:N' · 'allsix' · 'all'
   * ------------------------------------------------------------------ */
  const LORE = {
    l01: { cond: 'runs', title: 'El agua viva', hint: 'Juega tu primera partida.',
      text: 'Mi abuela decía que de niña bebía magia del río con las manos. Nadie la creyó nunca. Hoy la magia se guarda en cartas y se cuenta como monedas.' },
    l02: { cond: 'act1boss', title: 'La Noche Rota', hint: 'Llega al jefe del Acto I.',
      text: 'Esa noche el cielo se volvió morado y la montaña gritó. Por la mañana la torre de Khadegar ya no estaba. En su lugar había una herida que respiraba.' },
    l03: { cond: 'combats:10', title: 'El Concilio de los Naipes', hint: 'Gana 10 combates en total.',
      text: 'Doce magos, doce barajas, un solo juramento: ninguna carta volvería a contener demasiada magia. Fue el primer juramento que se rompió.' },
    l04: { cond: 'death', title: 'La Grieta baraja', hint: 'Cae por primera vez.',
      text: 'Caes. Oscuridad. Un sonido como de naipes mezclándose. Y despiertas a la entrada del bosque, con tu baraja intacta y los caminos cambiados. Algo quiere que lo intentes otra vez.' },
    l05: { cond: 'kill:guardian', title: 'El árbol que no duerme', hint: 'Derrota al Guardián del Bosque.',
      text: 'El Guardián plantó el bosque semilla a semilla. La Grieta le enseñó a tener miedo, y un árbol con miedo no deja pasar a nadie.' },
    l06: { cond: 'kill:matriarca', title: 'Nosotras', hint: 'Derrota a la Matriarca Fúngica.',
      text: 'La Matriarca no es una seta: son diez mil. Comen restos de hechizos y comparten un solo pensamiento: crecer. Tú eres abono con patas.' },
    l07: { cond: 'killas:alfa:invocadora', title: 'El hermano lobo', hint: 'Derrota al Lobo Alfa con la Invocadora.',
      text: 'Antes de hablar con las raíces, la Invocadora corría con una manada. El Alfa la cuidaba como a una cría. Cuando por fin la miró a los ojos, ya no la reconoció.' },
    l08: { cond: 'killas:wyrm:criomante', title: 'El corazón robado', hint: 'Derrota al Wyrm de Escarcha con el Criomante.',
      text: 'Para salvar su aldea del deshielo, el Criomante robó un trozo de hielo vivo de la cueva del Wyrm. El Norte se salvó. El Wyrm despertó.' },
    l09: { cond: 'killas:titan:guardiana', title: 'Protocolo: sello', hint: 'Derrota al Titán del Glaciar con la Guardiana.',
      text: 'Los talladores grabaron una sola orden en el Titán: proteger el sello. La Grieta borró la mitad de la runa. Ahora solo entiende «proteger»… y no sabe qué.' },
    l10: { cond: 'killas:espectro:electromante', title: 'Lo que el rayo prestó', hint: 'Derrota al Espectro de la Tormenta con el Electromante.',
      text: 'El último mago de tormentas del Concilio se disolvió en su propia tempestad. Antes de perderse del todo, eligió a alguien y le prestó su chispa. Quiere que se la devuelva.' },
    l11: { cond: 'kill:ojo', title: 'La mirada', hint: 'Derrota al Ojo del Abismo.',
      text: 'El Ojo no tiene cuerpo, solo atención. Ha visto cada intento, cada caída, cada baraja. Y los recuerda todos.' },
    l12: { cond: 'killas:lich:paladin', title: 'El último presidente', hint: 'Derrota al Archiliche Rúnico con el Paladín.',
      text: 'Mordrath presidía el Concilio cuando selló la Grieta. Juró vigilarla hasta su último aliento, así que dejó de respirar. Lleva siglos sin parpadear.' },
    l13: { cond: 'kill:devorador', title: 'Hambre', hint: 'Derrota al Devorador de Hechizos.',
      text: 'Lo que sale de la Grieta tiene hambre de magia. El Devorador es solo el que más ha comido. Cada carta que juegas delante de él es un plato servido.' },
    l14: { cond: 'killas:archimago:piromago', title: 'Casi', hint: 'Derrota al Archimago Caído con el Piromago.',
      text: 'El eco de Khadegar vaga por la caverna repitiendo la misma palabra: «casi». Le falta una sola carta para terminar. El Piromago sabe cuál es, porque la lleva dentro.' },
    l15: { cond: 'aff5:piromago', title: 'El secreto del Piromago', hint: 'Llega a Afinidad 5 con el Piromago.',
      text: 'La esquirla que lo hace arder es un pedazo de la Carta Última. Si la Grieta se cierra, su fuego se apagará con ella. Baja de todos modos.' },
    l16: { cond: 'aff5:criomante', title: 'El secreto del Criomante', hint: 'Llega a Afinidad 5 con el Criomante.',
      text: 'No lleva el frío dentro por castigo, sino por amor: es el corazón del Wyrm. Devolverlo significa volver a sentir calor… y perder lo que salvó a su aldea.' },
    l17: { cond: 'aff5:guardiana', title: 'El secreto de la Guardiana', hint: 'Llega a Afinidad 5 con la Guardiana.',
      text: 'Su pueblo grabó el primer sello y construyó al Titán. Cuando la Grieta los fue borrando uno a uno, ella sobrevivió porque nadie la había grabado aún en ninguna piedra.' },
    l18: { cond: 'aff5:invocadora', title: 'El secreto de la Invocadora', hint: 'Llega a Afinidad 5 con la Invocadora.',
      text: 'El bosque no le pidió ayuda: le pidió permiso. Si cae, será ella quien se convierta en su nueva guardiana.' },
    l19: { cond: 'aff5:paladin', title: 'El secreto del Paladín', hint: 'Llega a Afinidad 5 con el Paladín.',
      text: 'La Orden de la Luz no protegió el ritual por error: lo hizo porque creía en Khadegar. Él también creyó. Cada herida que se hace es una disculpa.' },
    l20: { cond: 'aff5:electromante', title: 'El secreto del Electromante', hint: 'Llega a Afinidad 5 con el Electromante.',
      text: 'A veces habla con una voz que no es la suya. A veces sus rayos llegan antes de que los piense. El Espectro no se fue del todo: comparten el cuerpo.' },
    l21: { cond: 'contracts:5', title: 'Los Desiertos de Ceniza', hint: 'Completa 5 contratos.',
      text: 'Hubo un bosque allí, más grande que el Encantado. Un solo Destello de la Grieta lo convirtió en ceniza en una noche. Solo sobrevivió un niño, que no dejaba de arder.' },
    l22: { cond: 'ascwin:5', title: 'La Orden caída', hint: 'Gana una partida en Ascensión 5 o más.',
      text: 'Tras la Noche Rota, el reino quemó los estandartes de la Orden de la Luz. Sus caballeros se dispersaron. Uno no dejó de rezar.' },
    l23: { cond: 'allsix', title: 'La mano perfecta', hint: 'Gana una partida con cada uno de los seis magos.',
      text: 'Seis magos, seis barajas. La Grieta no baraja por azar: busca la combinación exacta que la termine. O que la cierre. Nadie sabe cuál de las dos.' },
    l24: { cond: 'all', title: 'Khadegar', hint: 'Desbloquea los otros 23 fragmentos.',
      text: '«No quería poder. Quería que nadie volviera a quedarse sin magia.» Escrito en el borde de una carta quemada, hallada en lo más hondo de la caverna. Debajo, una escalera que baja hacia la luz morada.' }
  };
  const LORE_IDS = Object.keys(LORE);
  /** Jefes con vínculo con un personaje: su frase de inicio cambia si juegas con él. */
  const BOSS_BONDS = { alfa: 'invocadora', wyrm: 'criomante', titan: 'guardiana', espectro: 'electromante', lich: 'paladin', archimago: 'piromago' };
  /**
   * Frases de jefe que tocan (claves i18n): con vínculo con tu personaje, la de vínculo (inicio: quip.<id>.bond;
   * cambio de fase: quip.<id>.bondPhase) si existe; si no, las neutras (quip.<id>.start0 / phase0…). has(key) → existe.
   */
  function bossQuipKeys(id, char, when, has) {
    if (BOSS_BONDS[id] === char) {
      const k = `quip.${id}.${when === 'start' ? 'bond' : 'bondPhase'}`;
      if (has(k)) return [k];
    }
    return [0, 1, 2].map((n) => `quip.${id}.${when}${n}`).filter(has);
  }
  /** Frase de cada personaje (selección de personaje, en cursiva). */
  const CHAR_QUOTES = {
    piromago: 'Tranquilo, solo quemo lo necesario. Casi siempre.', criomante: 'No es nada personal. Es que soy así de frío.',
    guardiana: 'La piedra nunca olvida. Yo tampoco.', invocadora: 'Yo no peleo. Ellos sí.',
    paladin: 'El dolor es una plegaria. Y hoy rezo mucho.', electromante: '¿Notas un cosquilleo? Yo también. Corre.'
  };
  /** Intro: 6 escenas (imagen assets/intro/intro_<n>.webp, movimiento de cámara y partículas); el texto, en INTRO_TEXT. */
  const INTRO = [
    { cam: 'panR', fx: 'motes' }, { cam: 'zoomIn', fx: 'gold' }, { cam: 'shock', fx: 'purple' },
    { cam: 'zoomCenter', fx: 'dust' }, { cam: 'panLR', fx: 'ash' }, { cam: 'zoomOut', fx: 'motes', logo: true }
  ];
  const INTRO_TEXT = {
    s1: 'Hubo un tiempo en que la magia corría libre por Arcandia… como el agua.',
    s2: 'Hasta que el Archimago Khadegar quiso escribirla toda… en una sola carta.',
    s3: 'La Carta Última ardió a medio escribir. Y el mundo se rompió.',
    s4: 'Para sobrevivir, el Concilio encerró la magia que quedaba… en naipes.',
    s5: 'Pero la Grieta crece. El bosque enloquece. Las cumbres se congelan. Y algo despierta en las profundidades.',
    s6: 'Seis magos. Seis barajas. Un solo camino.',
    s6b: 'Y cada vez que caigas… la Grieta volverá a barajar.'
  };

  for (const id of Object.keys(CHAR_QUOTES)) CHARACTERS[id].quote = CHAR_QUOTES[id];   // se traduce con CHARACTERS

  const DATA = { CUSTOM_MODS, CUSTOM_MOD_IDS, CUSTOM_CONFLICTS, CUSTOM_DIFF, CUSTOM_DIFF_IDS, CUSTOM_CHAR_CODE, GROUP_TUNE, REWARD_LOCK, LEGENDARY_CHANCE, UPGRADES, UPGRADE_IDS, ESSENCE, ACT_HEAL, SUMMONS, SUMMON_IDS, MAX_SUMMONS, STARTER_INVO, PATCH_NOTES, LATEST_VERSION, AFFIXES, AFFIX_IDS, RUNES, RUNE_IDS, STARTER_GUARD, PACTS, PACT_IDS, CARDS, STARTER_DECK, MAGE, ENEMIES, ENCOUNTERS, ACTS, LAST_ACT, RELICS, BOSS_RELICS, ALL_RELICS, NODE_TYPES, EVENTS, ASCENSION, MAX_ASCENSION,
                 POTIONS, POTION_ODDS, POTION_RARITY_LABEL, CHARACTERS, CHAR_IDS, GLOSSARY, GLOSSARY_CATS, PATHS, PATH_IDS, STARTER_ELECTRO,
                 CONTRACTS, CONTRACT_IDS, CONTRACT_ESSENCE, ENERGY_BOSS_RELICS,
                 AFFINITY_MAX, affinityNeed, AFFINITY_XP, AFFINITY_REWARDS, AFFINITY_TITLES, ALT_STARTERS, COSMETICS, COSMETIC_SLOTS,
                 CODEX_MILESTONES, QUEST_REWARD, QUEST_DAILY_MULT, QUESTS, QUEST_IDS, WEEKLY,
                 LORE, LORE_IDS, BOSS_BONDS, bossQuipKeys, INTRO, INTRO_TEXT };

  /* ------------------------------------------------------------------ *
   * IDIOMAS: este archivo trae los textos en español. Se registran aquí y i18n.js los cambia por los del
   * idioma elegido (DATA_TEXT.<lang>['CARDS.llama.name'] …). Las listas van por id, no por posición:
   * notas de parche por versión («PATCH.2_7.title») y Ascensión por id («ASCENSION.a3.text»).
   * ------------------------------------------------------------------ */
  const SKIP_TECH = new Set(['aim', 'base', 'spawn', 'id', 'art', 'icon', 'tier', 'class', 'rarity', 'type', 'shape', 'target', 'fx', 'starterRelic', 'starterDeck',
    'mechanics', 'acts', 'version', 'date', 'color', 'level', 'cost', 'xl', 'when', 'onlyBoss', 'cat', 'chars', 'dailyFrom', 'tags', 'paths', 'star', 'char', 'each', 'reward', 'chainId', 'node', 'mode', 'stat', 'cond', 'cam', 'fx']);   // (unlock de los personajes sí es texto)
  const reg = (name, obj, after) => I18N.registerData(name, obj, { skip: SKIP_TECH, after });
  I18N.registerData('CARDS', CARDS, { skip: new Set([...SKIP_TECH].filter((k) => k !== 'target')) });   // v.target (Forja Mental) es texto
  reg('RELICS', RELICS);
  reg('BOSS_RELICS', BOSS_RELICS, (o) => { for (const r of Object.values(o)) r.text = `${r.good} ${r.bad}`; });
  reg('POTIONS', POTIONS); reg('ENEMIES', ENEMIES); reg('EVENTS', EVENTS); reg('CHARACTERS', CHARACTERS); reg('PATHS', PATHS);
  reg('ACTS', ACTS); reg('NODE_TYPES', NODE_TYPES); reg('AFFIXES', AFFIXES); reg('PACTS', PACTS); reg('UPGRADES', UPGRADES);
  reg('CUSTOM_MODS', CUSTOM_MODS); reg('CUSTOM_DIFF', CUSTOM_DIFF); reg('CONTRACTS', CONTRACTS); reg('QUESTS', QUESTS); reg('COSMETICS', COSMETICS); reg('AFFINITY_TITLES', AFFINITY_TITLES); reg('LORE', LORE); reg('INTRO_TEXT', INTRO_TEXT);
  reg('SUMMONS', SUMMONS); reg('RUNES', RUNES); reg('POTION_RARITY_LABEL', POTION_RARITY_LABEL);
  reg('ASCENSION', Object.fromEntries(ASCENSION.map((a) => [a.id, a])));
  reg('PATCH', Object.fromEntries(PATCH_NOTES.map((n) => [n.version.replace(/\./g, '_'), n])));
  reg('GLOSSARY', GLOSSARY);
  // Glosario: cada runa, criatura y afijo tiene su ficha (sus textos ya están traducidos en RUNES/SUMMONS/AFFIXES)
  const fxText = (fx, det) => [fx.dmg && _t('s.0_de_dano', { 0: fx.dmg }), fx.block && _t('s.0_de_bloqueo', { 0: fx.block }),
    fx.draw && (det ? _t('s.roba_0', { 0: fx.draw }) : _t('s.0_carta_el_proximo_turno', { 0: fx.draw })), fx.heal && _t('s.cura_0', { 0: fx.heal })].filter(Boolean).join(_t('ui.and'));
  RUNE_IDS.forEach((id) => {
    const r = RUNES[id];
    GLOSSARY['rune_' + id] = { cat: 'char', icon: 'rune_' + id, color: r.color, chars: ['guardiana'], rune: id,
      get name() { return _t('gl.rune', { r: r.name }); }, get match() { return _t('gl.rune.m', { r: r.name }); },
      get desc() { return _t('gl.rune.d', { p: fxText(r.passive, false), d: fxText(r.det, true) }); } };
  });
  SUMMON_IDS.forEach((id) => {
    const m = SUMMONS[id];
    GLOSSARY['sum_' + id] = { cat: 'char', icon: 'summon_' + id, color: 0x9ff0b4, chars: ['invocadora'], summon: id,
      get name() { return m.name; }, get match() { return m.name; }, get desc() { return _t('gl.sum.d', { t: m.text, hp: m.hp }); } };
  });
  AFFIX_IDS.forEach((id) => {
    const a = AFFIXES[id];
    GLOSSARY['aff_' + id] = { cat: 'affix', icon: a.icon, color: a.color, chars: null, affix: id,
      get name() { return a.name; }, get desc() { return a.text; } };
  });

  root.CM_DATA = DATA;   // también en Node: i18n.js resuelve los nombres por id con él
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
