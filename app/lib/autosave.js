/* ============================================================================
   autosave.js — Sauvegarde automatique dans un dossier (File System Access API)
   ----------------------------------------------------------------------------
   Sur Chrome/Edge : l'utilisatrice choisit une fois un dossier (idéalement
   OneDrive), l'outil y écrit ensuite abattement-assmat-AAAA.json à chaque
   modification et le relit au démarrage (fusion multi-appareils).
   La poignée du dossier est conservée en IndexedDB. Navigateurs non
   compatibles (Safari/iOS…) : module inerte, l'export manuel reste la voie.
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  const A = window.ABMAT.autosave = {};

  const DB_NAME = "abmat-autosave";
  const STORE = "kv";
  const DIR_KEY = "dir";

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function kvGet(key) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }

  function kvSet(key, value) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }

  A.isSupported = function isSupported() {
    return typeof window.showDirectoryPicker === "function" && typeof indexedDB !== "undefined";
  };

  A.fileName = function fileName(year) {
    return `abattement-assmat-${Number(year)}.json`;
  };

  function getDir() {
    if (!A.isSupported()) return Promise.resolve(null);
    return kvGet(DIR_KEY).catch(() => null);
  }

  /** État sans interaction : "unsupported" | "unconfigured" | "permission" | "ready". */
  A.getStatus = async function getStatus() {
    if (!A.isSupported()) return "unsupported";
    const dir = await getDir();
    if (!dir) return "unconfigured";
    const perm = await dir.queryPermission({ mode: "readwrite" });
    return (perm === "granted") ? "ready" : "permission";
  };

  /** À appeler depuis un clic : garantit un dossier accessible en écriture. */
  A.ensureReady = async function ensureReady() {
    let dir = await getDir();
    if (dir) {
      let perm = await dir.queryPermission({ mode: "readwrite" });
      if (perm === "prompt") perm = await dir.requestPermission({ mode: "readwrite" });
      if (perm === "granted") return true;
    }
    dir = await window.showDirectoryPicker({ mode: "readwrite" });
    await kvSet(DIR_KEY, dir);
    return (await dir.queryPermission({ mode: "readwrite" })) === "granted";
  };

  /** Écrit la sauvegarde d'année. Silencieux : ne demande jamais de permission. */
  A.writeYear = async function writeYear(year, dataObj) {
    const status = await A.getStatus();
    if (status !== "ready") return { status };
    try {
      const dir = await getDir();
      const handle = await dir.getFileHandle(A.fileName(year), { create: true });
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(dataObj, null, 2));
      await writable.close();
      return { status: "ok" };
    } catch (e) {
      console.warn("Sauvegarde automatique impossible :", e);
      return { status: "error" };
    }
  };

  /** Lit la sauvegarde d'année du dossier (null si absente ou inaccessible). */
  A.readYear = async function readYear(year) {
    const status = await A.getStatus();
    if (status !== "ready") return null;
    try {
      const dir = await getDir();
      const handle = await dir.getFileHandle(A.fileName(year));
      const file = await handle.getFile();
      return await file.text();
    } catch (e) {
      return null; // fichier pas encore créé : normal la première fois
    }
  };
})();
