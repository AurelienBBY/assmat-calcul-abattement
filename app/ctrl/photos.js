/* ============================================================================
   app/ctrl/photos.js — Photos de la fiche de présence (A.photos)
   ----------------------------------------------------------------------------
   Prendre ou choisir une photo (recto, verso), la réduire (lib/image.js), la
   ranger (storage/fiches.js), la remplacer ou la supprimer (avec « Annuler »).
   Les photos d'un mois sont gardées en mémoire (adresses d'affichage) pour
   l'écran et pour l'impression, qui ne peut pas attendre.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const S = window.ABMAT.storage;
  const IMG = window.ABMAT.image;
  const F = S && S.fiches;

  if (!A || !F || !IMG) {
    throw new Error("app/ctrl/ctx.js, storage/fiches.js et image.js doivent être chargés avant app/ctrl/photos.js.");
  }

  const SIDES = ["recto", "verso"];
  const cache = {};   // clé → adresse d'affichage, ou null (pas de photo)
  const loading = {}; // "AAAA-MM" → Promise

  const monthKey = (year, m) => F.key(year, m, "recto").slice(0, 7);
  const label = (side) => (side === "recto" ? "Recto" : "Verso");

  function setCache(key, blob) {
    if (cache[key]) URL.revokeObjectURL(cache[key]);
    cache[key] = blob ? URL.createObjectURL(blob) : null;
  }

  /**
   * Charge les photos d'un mois (une fois) ; se résout quand c'est fait.
   * Stockage des photos inaccessible : message, et le mois s'affiche sans photo.
   */
  function ensure(year, m) {
    const mk = monthKey(year, m);
    if (!loading[mk]) {
      loading[mk] = Promise.all(SIDES.map((side) => {
        const key = F.key(year, m, side);
        return F.get(key).then((r) => setCache(key, r ? r.blob : null));
      })).catch((e) => {
        SIDES.forEach((side) => setCache(F.key(year, m, side), null));
        R.toast(`Photos de la fiche illisibles sur cet appareil : ${e.message}`);
      });
    }
    return loading[mk];
  }

  function changed(year, m) {
    A.backup.changed([`${monthKey(year, m)}-fiche`]);
  }

  async function store(key, blob) {
    await F.put(key, blob);
    setCache(key, blob);
  }

  A.photos = {
    ensure,
    /** État connu du mois : null tant que les photos ne sont pas chargées. */
    state(year, m) {
      const keys = SIDES.map((side) => F.key(year, m, side));
      if (!keys.every((k) => k in cache)) return null;
      return { recto: cache[keys[0]], verso: cache[keys[1]], any: Boolean(cache[keys[0]] || cache[keys[1]]) };
    },

    /** Ouvre l'appareil photo ou la photothèque pour une face. */
    pick(year, m, side) {
      const input = document.getElementById("photo-file");
      input.value = "";
      input.dataset.key = F.key(year, m, side);
      input.dataset.year = String(year);
      input.dataset.month = String(m);
      input.click();
    },

    async remove(year, m, side) {
      const key = F.key(year, m, side);
      let kept;
      try {
        kept = await F.get(key);
        await F.remove(key);
      } catch (err) {
        R.toast(`Photo non supprimée : ${err.message}`);
        return;
      }
      setCache(key, null);
      changed(year, m);
      A.render();
      R.toast(`${label(side)} supprimé.`, kept ? [{ label: "Annuler", run: async () => { await store(key, kept.blob); changed(year, m); A.render(); } }] : []);
    },

    /** Oublie les photos gardées en mémoire d'une année (après une reprise de copie). */
    forget(year) {
      Object.keys(cache).filter((k) => k.startsWith(`${year}-`)).forEach((k) => { if (cache[k]) URL.revokeObjectURL(cache[k]); delete cache[k]; });
      Object.keys(loading).filter((k) => k.startsWith(`${year}-`)).forEach((k) => { delete loading[k]; });
    },

    /** Photos d'un mois pour l'impression : [{ side, url }] (déjà chargées). */
    forPrint(year, m) {
      return SIDES.map((side) => ({ side, url: cache[F.key(year, m, side)] })).filter((p) => p.url);
    }
  };

  document.getElementById("photo-file").addEventListener("change", async (e) => {
    const input = e.target;
    if (!input.files.length) return;
    const key = input.dataset.key;
    const year = Number(input.dataset.year);
    const m = Number(input.dataset.month);
    const had = Boolean(cache[key]);
    try {
      await store(key, await IMG.compress(input.files[0]));
    } catch (err) {
      R.toast(`Photo non enregistrée : ${err.message}`);
      return;
    }
    changed(year, m);
    A.render();
    R.toast(`${label(key.slice(8))} ${had ? "remplacé" : "enregistré"}.`);
  });
})();
