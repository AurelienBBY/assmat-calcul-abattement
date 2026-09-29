/* ============================================================================
   storage/fiches.js — Photos des fiches de présence (IndexedDB)
   ----------------------------------------------------------------------------
   Une fiche recto verso par mois : clés "AAAA-MM:recto" et "AAAA-MM:verso".
   Trop lourdes pour localStorage : base IndexedDB « abmat-fiches ».
   Enregistrement : { key, year, updatedAt, type, blob } ; une suppression
   garde la clé avec blob = null (sinon la fusion avec une autre copie
   ferait réapparaître la photo). Copie de secours : fichier à part
   { format: "abmat-fiches", version: 1, year, photos: { clé: { updatedAt,
   type, data } } } (data = image en base64, null si supprimée).
   Toutes les fonctions sont asynchrones (Promise).
   ========================================================================== */

(function () {
  "use strict";

  const S = window.ABMAT && window.ABMAT.storage;
  const Compute = window.ABMAT && window.ABMAT.compute;

  if (!S || !Compute || !Compute.fichesMergePlan) {
    throw new Error("storage/core.js et compute/review.js doivent être chargés avant storage/fiches.js.");
  }

  const DB_NAME = "abmat-fiches";
  const STORE = "photos";
  let dbPromise = null;

  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" }).createIndex("year", "year");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  function run(mode, fn) {
    return db().then((d) => new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, mode);
      const out = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(out && "result" in out ? out.result : undefined);
      tx.onerror = () => reject(tx.error);
    }));
  }

  const yearOf = (key) => Number(key.slice(0, 4));
  const record = (key, blob, updatedAt) => ({ key, year: yearOf(key), updatedAt: updatedAt || new Date().toISOString(), type: blob ? blob.type : "", blob });

  const F = S.fiches = {};

  F.key = (year, monthIndex, side) => `${year}-${String(monthIndex + 1).padStart(2, "0")}:${side}`;

  /** Photo d'une face ; null si absente ou supprimée. */
  F.get = (key) => run("readonly", (st) => st.get(key)).then((r) => (r && r.blob ? r : null));
  F.put = (key, blob, updatedAt) => run("readwrite", (st) => { st.put(record(key, blob, updatedAt)); });
  F.remove = (key) => run("readwrite", (st) => { st.put(record(key, null)); });

  /** Tous les enregistrements d'une année (suppressions comprises). */
  F.records = (year) => run("readonly", (st) => st.index("year").getAll(Number(year))).then((list) => list || []);

  F.eraseYear = (year) => F.records(year).then((list) => run("readwrite", (st) => { list.forEach((r) => st.delete(r.key)); }));

  // --- Copie de secours ----------------------------------------------------------

  const toDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  function fromDataUrl(url) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(url);
    if (!m) throw new Error("photo illisible dans la copie.");
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: m[1] });
  }

  /** Contenu du fichier des fiches d'une année ; null s'il n'y a aucune photo. */
  F.exportYear = async function exportYear(year) {
    const list = await F.records(year);
    if (!list.length) return null;
    const photos = {};
    for (const r of list) photos[r.key] = { updatedAt: r.updatedAt, type: r.type, data: r.blob ? await toDataUrl(r.blob) : null };
    return { format: "abmat-fiches", version: 1, year: Number(year), exportedAt: new Date().toISOString(), photos };
  };

  /**
   * Reprend les photos d'une copie : pour chaque face, la version la plus
   * récente gagne (suppression comprise).
   * @returns {Promise<{year:number, applied:number}>}
   */
  F.mergeText = async function mergeText(text) {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.format !== "abmat-fiches" || !parsed.photos) throw new Error("ce fichier n'est pas une copie des fiches de présence.");
    const year = Number(parsed.year);
    const local = {};
    (await F.records(year)).forEach((r) => { local[r.key] = r.updatedAt; });
    const incoming = {};
    Object.keys(parsed.photos).forEach((k) => { incoming[k] = parsed.photos[k].updatedAt; });
    const take = Compute.fichesMergePlan(local, incoming);
    for (const k of take) {
      const p = parsed.photos[k];
      await F.put(k, p.data ? fromDataUrl(p.data) : null, p.updatedAt);
    }
    return { year, applied: take.length };
  };
})();
