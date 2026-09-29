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
      req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); resolve(req.result); };
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

  /**
   * Oublie le dossier choisi (« Tout effacer sur cet appareil ») : les
   * fichiers de copie qu'il contient ne sont pas touchés.
   */
  A.forget = () => window.ABMAT.storage.deleteDatabase(DB_NAME);

  A.isSupported = function isSupported() {
    return typeof window.showDirectoryPicker === "function" && typeof indexedDB !== "undefined";
  };

  A.fileName = function fileName(year) {
    return `abattement-assmat-${Number(year)}.json`;
  };

  /** Fichier à part des photos des fiches de présence (réécrit seulement quand une photo change). */
  A.fichesFileName = function fichesFileName(year) {
    return `abattement-assmat-${Number(year)}-fiches.json`;
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

  /** Écrit un fichier du dossier. Silencieux : ne demande jamais de permission. */
  A.writeText = async function writeText(name, text) {
    const status = await A.getStatus();
    if (status !== "ready") return { status };
    try {
      const dir = await getDir();
      const handle = await dir.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return { status: "ok" };
    } catch (e) {
      console.warn("Sauvegarde automatique impossible :", e);
      return { status: "error" };
    }
  };

  /** Lit un fichier du dossier (null si absent ou inaccessible). */
  A.readText = async function readText(name) {
    const status = await A.getStatus();
    if (status !== "ready") return null;
    try {
      const dir = await getDir();
      const handle = await dir.getFileHandle(name);
      return await (await handle.getFile()).text();
    } catch (e) {
      return null; // fichier pas encore créé : normal la première fois
    }
  };

  A.writeYear = (year, dataObj) => A.writeText(A.fileName(year), JSON.stringify(dataObj, null, 2));
  A.readYear = (year) => A.readText(A.fileName(year));
})();
