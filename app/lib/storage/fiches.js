/* ============================================================================
   storage/fiches.js — Photos des fiches de présence (IndexedDB)
   ----------------------------------------------------------------------------
   Une fiche recto verso par mois : clés "AAAA-MM:recto" et "AAAA-MM:verso".
   Trop lourdes pour localStorage : base IndexedDB « abmat-fiches ».
   Enregistrement : { key, year, updatedAt, type, bytes } — les octets de
   l'image (ArrayBuffer) et non un Blob : Safari sur iPhone enregistre mal
   les Blob dans IndexedDB (« Error preparing Blob/File data… »). Une
   suppression garde la clé avec bytes = null (sinon la fusion avec une
   autre copie ferait réapparaître la photo). Copie de secours : fichier à part
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

  // Ouverture de la base ; si elle ne répond pas, on le dit (au lieu
  // d'attendre sans fin) et le prochain geste réessaie.
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        const timer = setTimeout(() => reject(new Error("la mémoire des photos ne répond pas : fermez l'outil puis rouvrez-le.")), 10000);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" }).createIndex("year", "year");
        req.onsuccess = () => { clearTimeout(timer); resolve(req.result); };
        req.onerror = () => { clearTimeout(timer); reject(req.error); };
      });
      dbPromise.catch(() => { dbPromise = null; });
    }
    return dbPromise;
  }

  function run(mode, fn) {
    return db().then((d) => new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, mode);
      const out = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(out && "result" in out ? out.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("enregistrement interrompu (mémoire du téléphone pleine ?)."));
    }));
  }

  const yearOf = (key) => Number(key.slice(0, 4));

  // Les octets sont lus AVANT d'ouvrir la transaction (une transaction
  // IndexedDB se ferme dès qu'on attend autre chose qu'elle).
  const record = async (key, blob, updatedAt) => ({ key, year: yearOf(key), updatedAt: updatedAt || new Date().toISOString(),
    type: blob ? blob.type : "", bytes: blob ? await blob.arrayBuffer() : null });

  // Image d'un enregistrement (null = supprimée). Les tout premiers
  // enregistrements (29/09/2026, ordinateur) gardaient un Blob : lus tels quels.
  const blobOf = (r) => (r.bytes ? new Blob([r.bytes], { type: r.type }) : (r.blob || null));

  const F = S.fiches = {};

  F.key = (year, monthIndex, side) => `${year}-${String(monthIndex + 1).padStart(2, "0")}:${side}`;

  /** Photo d'une face : { key, updatedAt, blob } ; null si absente ou supprimée. */
  F.get = (key) => run("readonly", (st) => st.get(key)).then((r) => {
    const blob = r ? blobOf(r) : null;
    return blob ? { key, updatedAt: r.updatedAt, blob } : null;
  });
  F.put = async (key, blob, updatedAt) => {
    const rec = await record(key, blob, updatedAt);
    return run("readwrite", (st) => { st.put(rec); });
  };
  F.remove = (key) => F.put(key, null);

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
    for (const r of list) {
      const blob = blobOf(r);
      photos[r.key] = { updatedAt: r.updatedAt, type: r.type, data: blob ? await toDataUrl(blob) : null };
    }
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
