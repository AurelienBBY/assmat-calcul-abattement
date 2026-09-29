/* ============================================================================
   app/ctrl/backup-import.js — Copie de secours : reprendre un fichier
   ----------------------------------------------------------------------------
   « Reprendre la copie » (partout) : un ou plusieurs fichiers choisis —
   l'année (abmat-year), ses photos de fiches (abmat-fiches) ou un ancien
   fichier d'un seul mois. Toujours une FUSION : rien n'est effacé.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const S = window.ABMAT.storage;
  const Compute = window.ABMAT.compute;
  const F = R.fmt;
  const B = A && A.backup;

  if (!B || !B.mergeText || !B.mergeFichesText) {
    throw new Error("app/ctrl/backup-folder.js doit être chargé avant app/ctrl/backup-import.js.");
  }

  async function importFiles(files) {
    let applied = 0;
    let photos = 0;
    const years = new Set();
    const fichesYears = new Set();
    try {
      for (const file of files) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (parsed && parsed.format === "abmat-year") {
          const res = B.mergeText(text, parsed.year);
          applied += res.applied;
          years.add(res.year);
        } else if (parsed && parsed.format === "abmat-fiches") {
          photos += (await B.mergeFichesText(text)).applied;
          fichesYears.add(Number(parsed.year));
        } else if (parsed && Number.isFinite(Number(parsed.year)) && Number.isFinite(Number(parsed.monthIndex))) {
          // Ancien fichier d'un seul mois : importé dans son mois.
          A.saveMonth(S.importMonthFromJsonText(text, Number(parsed.year), Number(parsed.monthIndex), false).data);
          applied++;
          years.add(Number(parsed.year));
        } else {
          throw new Error(`« ${file.name} » n'est pas une copie de cet outil.`);
        }
      }
    } catch (e) {
      R.toast(`Impossible de reprendre cette copie : ${e.message}`);
      return;
    }
    Compute.syncImported(B.sync, Date.now());
    B.saveSync();
    if (!B.manual) { B.writeYears(Array.from(years)); fichesYears.forEach(B.writeFiches); }
    A.render();
    const what = [applied ? F.plural(applied, "mois", "mois") + " mis à jour" : null, photos ? F.plural(photos, "photo") + " de fiche" : null].filter(Boolean);
    R.toast(what.length ? `Copie reprise : ${what.join(", ")}, rien effacé.` : "Copie reprise : tout était déjà à jour.");
  }

  B.importFile = function importFile() {
    const input = document.getElementById("backup-file");
    input.value = "";
    input.click();
  };

  document.getElementById("backup-file").addEventListener("change", (e) => {
    if (e.target.files.length) importFiles(Array.from(e.target.files));
  });
})();
