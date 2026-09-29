/* ============================================================================
   app/ctrl/backup-send.js — Copie de secours : envoi (iPhone)
   ----------------------------------------------------------------------------
   « Envoyer ma copie » : les fichiers de l'année (et de ses photos de fiches
   si l'une a changé) sont préparés à l'avance, puis partagés d'un toucher —
   l'iPhone refuse d'ouvrir la feuille de partage après une attente.
   Navigateur sans partage : téléchargement.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const S = window.ABMAT.storage;
  const AS = window.ABMAT.autosave;
  const Compute = window.ABMAT.compute;
  const B = A && A.backup;

  if (!B || !B.openSheet || !S.fiches) {
    throw new Error("app/ctrl/backup.js et storage/fiches.js doivent être chargés avant app/ctrl/backup-send.js.");
  }

  function pendingYears() {
    const years = new Set(B.sync.pending.filter((k) => /^\d{4}-/.test(k)).map((k) => Number(k.slice(0, 4))));
    if (!years.size) years.add(new Date().getFullYear());
    return Array.from(years).sort();
  }

  function sent() {
    Compute.syncSent(B.sync, Date.now());
    S.setLastMergedAt(new Date().toISOString());
    B.saveSync();
    A.state.banner = null;
    R.closeSheet();
    A.render();
    R.toast("Copie envoyée. L'ordinateur la reprendra à sa prochaine ouverture.");
  }

  const jsonFile = (obj, name) => new File([JSON.stringify(obj, null, 2)], name, { type: "application/json" });

  async function prepareFiles() {
    const files = [];
    for (const y of pendingYears()) {
      files.push(jsonFile(S.buildYearExport(y), AS.fileName(y)));
      if (B.sync.pending.some((k) => k.startsWith(`${y}-`) && k.endsWith("-fiche"))) {
        const fiches = await S.fiches.exportYear(y);
        if (fiches) files.push(jsonFile(fiches, AS.fichesFileName(y)));
      }
    }
    return files;
  }

  let prepared = null;

  B.share = function share() {
    const files = prepared;
    if (typeof navigator.canShare === "function" && navigator.canShare({ files })) {
      navigator.share({ files }).then(sent, (e) => { if (e.name !== "AbortError") R.toast(`Envoi impossible : ${e.message}`); });
      return;
    }
    files.forEach((f) => S.downloadFile(f));
    sent();
  };

  /** Étapes d'envoi : le bouton « Envoyer » s'active quand la copie est prête. */
  B.openSending = function openSending() {
    prepared = null;
    const sheet = B.openSheet("sending", { preparing: true });
    prepareFiles().then((files) => {
      prepared = files;
      sheet.setBody(B.sheetBody("sending", { preparing: false }));
    }, (e) => { R.closeSheet(); R.toast(`Copie impossible à préparer : ${e.message}`); });
  };
})();
