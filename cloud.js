/* =====================================================================
 * Carticas Mágicas — cloud.js
 * Guardado en la nube por jugador con las capacidades del artifact
 * (`db` + `user`). localStorage sigue siendo la fuente inmediata, la caché
 * y el respaldo sin conexión: el juego arranca SIEMPRE con lo local y la
 * nube se «enciende» cuando responde. Si no hay nube (sin sesión, invitado
 * sin acceso, vista previa, arnés de pruebas…), todo funciona igual que antes.
 *
 * Datos (privados del jugador): colección data/users/<id> con dos documentos
 *   meta → { meta, savedAt }               (el objeto de meta.js)
 *   run  → { run: string | null, savedAt } (partida serializada o null)
 * ===================================================================== */
(function (root) {
  'use strict';
  const U = root.CM_UI, M = root.CM_META;
  const { Store, SAVE_KEY, RUN_AT_KEY } = U;
  const DEBOUNCE_MS = 2000;

  const Cloud = {
    state: 'local',        // 'local' | 'connecting' | 'cloud'
    syncing: false,        // hay una lectura/escritura en curso (el icono gira)
    pendingRun: null,      // partida más reciente de otro dispositivo: se aplica en el título
    _listeners: new Set(),
    /** Suscribe la UI a los cambios de estado. Devuelve la función para darse de baja. */
    onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); },
    _emit() { for (const fn of this._listeners) { try { fn(this); } catch (e) { /* una escena cerrada */ } } }
  };

  let col = null;                                  // colección data/users/<id>
  const dirty = { meta: false, run: false };       // cambios locales sin subir
  const lastSent = { meta: null, run: null };      // contenido ya en la nube (para no repetir escrituras)
  let timer = null, writing = false;

  /* ---------- Documentos locales y claves de contenido (sin savedAt) ---------- */
  const localRun = () => ({ run: Store.get(SAVE_KEY) || null, savedAt: Store.get(RUN_AT_KEY) || '' });
  const metaKey = (m) => { const x = M.sanitize(m); x.savedAt = ''; return JSON.stringify(x); };
  const runKey = (d) => JSON.stringify(d && d.run ? d.run : null);
  const setSyncing = (v) => { if (Cloud.syncing !== v) { Cloud.syncing = v; Cloud._emit(); } };

  /* ---------- Escritura: debounce 2 s, un documento a la vez, solo si cambió ---------- */
  function schedule(ms = DEBOUNCE_MS) {
    if (Cloud.state !== 'cloud') return;
    clearTimeout(timer);
    timer = setTimeout(flush, ms);
  }
  async function flush() {
    timer = null;
    if (Cloud.state !== 'cloud' || writing) return;
    writing = true;
    let failed = false;
    for (const name of ['meta', 'run']) {
      if (!dirty[name]) continue;
      let payload, key;
      if (name === 'meta') { const m = M.load(Store); payload = { meta: m, savedAt: m.savedAt || new Date().toISOString() }; key = metaKey(m); }
      else { const r = localRun(); payload = { run: r.run, savedAt: r.savedAt || new Date().toISOString() }; key = runKey(r); }
      dirty[name] = false;
      if (key === lastSent[name]) continue;       // nada nuevo que subir
      setSyncing(true);
      try {
        await col.doc(name).set(payload);
        lastSent[name] = key;
      } catch (e) {
        // Sin red, límite de ritmo…: se reintenta en el SIGUIENTE guardado, nunca en bucle
        dirty[name] = true; failed = true;
        if (e && (e.code === 'revoked' || e.code === 'not_granted' || e.code === 'invalid_argument')) goLocal();
        break;
      }
    }
    writing = false;
    setSyncing(false);
    if (!failed && (dirty.meta || dirty.run)) schedule();   // cambios llegados durante la escritura
  }
  function goLocal() { Cloud.state = 'local'; col = null; clearTimeout(timer); Cloud._emit(); }

  /** Cada escritura en localStorage marca el documento como pendiente. */
  Store.onWrite = (k) => {
    if (k === M.KEY) dirty.meta = true;
    else if (k === SAVE_KEY) dirty.run = true;
    else return;
    schedule();
  };

  /* ---------- Partida de otro dispositivo: solo se aplica en el título ---------- */
  /** Devuelve true si ha sustituido la partida local por la de la nube. */
  Cloud.applyPendingRun = function () {
    const p = Cloud.pendingRun;
    if (!p) return false;
    Cloud.pendingRun = null;
    const local = localRun();
    if (M.mergeRun(local, p) !== p || runKey(local) === runKey(p)) return false;   // lo local ya es más nuevo
    if (p.run) Store.setRaw(SAVE_KEY, p.run); else Store.delRaw(SAVE_KEY);
    Store.setRaw(RUN_AT_KEY, p.savedAt || '');
    lastSent.run = runKey(p);
    return true;
  };

  /**
   * Importar progreso: sube YA meta y partida locales, sin fusionar con lo de la nube (lo importado la sustituye).
   * Si la nube aún está conectando, espera a que termine (máx. 5 s). Devuelve true si se escribió.
   */
  Cloud.pushNow = async function () {
    for (let i = 0; i < 25 && Cloud.state === 'connecting'; i++) await new Promise((r) => setTimeout(r, 200));
    if (Cloud.state !== 'cloud' || !col) return false;
    clearTimeout(timer); timer = null;
    const m = M.load(Store), r = localRun(), now = new Date().toISOString();
    setSyncing(true);
    try {
      await col.doc('meta').set({ meta: m, savedAt: m.savedAt || now });
      await col.doc('run').set({ run: r.run, savedAt: r.savedAt || now });
      lastSent.meta = metaKey(m); lastSent.run = runKey(r); dirty.meta = dirty.run = false;
      Cloud.pendingRun = null;
      return true;
    } catch (e) { return false; } finally { setSyncing(false); }
  };

  /* ---------- Arranque: nunca bloquea el juego ---------- */
  async function init() {
    const c = root.claude;
    if (!c || typeof c.use !== 'function') return;   // fuera de claude.ai: solo localStorage
    Cloud.state = 'connecting'; Cloud._emit();
    let db = null, user = null;
    try { [db, user] = await Promise.all([c.use('db'), c.use('user')]); } catch (e) { db = null; }
    const uid = db && user ? await user.id().catch(() => null) : null;
    if (!db || !user || !uid) { Cloud.state = 'local'; Cloud._emit(); return; }
    try { col = db.collection('data/users/' + uid); } catch (e) { Cloud.state = 'local'; Cloud._emit(); return; }

    setSyncing(true);
    try {
      const [mSnap, rSnap] = await Promise.all([col.doc('meta').get(), col.doc('run').get()]);
      // META: la nube vacía recibe lo local (migración); si hay en los dos sitios, se fusionan
      const local = M.load(Store);
      const cloudMeta = mSnap.exists && mSnap.data() ? mSnap.data().meta : null;
      if (cloudMeta) {
        lastSent.meta = metaKey(cloudMeta);
        const merged = M.mergeMeta(local, cloudMeta);
        if (metaKey(merged) !== metaKey(local) || merged.savedAt !== local.savedAt) Store.setRaw(M.KEY, JSON.stringify(merged));
        if (metaKey(merged) !== lastSent.meta) dirty.meta = true;
      } else if (M.hasProgress(local)) dirty.meta = true;
      // PARTIDA A MEDIAS: gana la más reciente; la de la nube espera al título
      const lr = localRun();
      const rd = rSnap.exists && rSnap.data() ? rSnap.data() : null;
      const cr = rd ? { run: typeof rd.run === 'string' ? rd.run : null, savedAt: typeof rd.savedAt === 'string' ? rd.savedAt : '' } : null;
      if (cr) {
        lastSent.run = runKey(cr);
        if (runKey(cr) !== runKey(lr)) {
          if (M.mergeRun(lr, cr) === cr) Cloud.pendingRun = cr;
          else dirty.run = true;
        }
      } else if (lr.run) dirty.run = true;
      Cloud.state = 'cloud';
    } catch (e) {
      Cloud.state = 'local'; col = null;               // sin red: se queda en local, sin errores en pantalla
    }
    setSyncing(false);
    Cloud._emit();
    if (dirty.meta || dirty.run) schedule(300);
  }

  // Al ocultar la pestaña, sube lo pendiente sin esperar al debounce
  try { root.document && root.document.addEventListener('visibilitychange', () => { if (root.document.visibilityState === 'hidden' && timer) { clearTimeout(timer); flush(); } }); } catch (e) { /* sin DOM */ }

  Cloud.init = init;
  root.CM_CLOUD = Cloud;
  init();
})(typeof globalThis !== 'undefined' ? globalThis : this);
