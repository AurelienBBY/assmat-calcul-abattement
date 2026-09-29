/* ============================================================================
   app/ctrl/backup-folder.js — Copie de secours : dossier automatique
   (ordinateur) et reprise d'un fichier (partout)
   ----------------------------------------------------------------------------
   Ordinateur : le fichier abattement-assmat-AAAA.json du dossier choisi est
   réécrit 0,6 s après chaque modification, et relu (fusion) à l'ouverture de
   chaque année. Reprise d'un fichier : fusion mois par mois, la version la
   plus récente gagne, un mois modifié des deux côtés est arbitré.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const S = window.ABMAT.storage;
  const AS = window.ABMAT.autosave;
  const Compute = window.ABMAT.compute;
  const F = R.fmt;
  const B = A && A.backup;

  if (!B) {
    throw new Error("app/ctrl/backup.js doit être chargé avant app/ctrl/backup-folder.js.");
  }

  const timers = {};
  const merged = {};

  function setStatus(status) {
    B.autoStatus = status;
    B.refreshPill();
  }

  /** Réécrit le fichier des années touchées (le profil voyage dans l'année en cours). */
  B.writeSoon = function writeSoon(keys) {
    writeYears(keys.map((k) => (/^\d{4}-/.test(k) ? Number(k.slice(0, 4)) : new Date().getFullYear())));
  };

  function writeYears(years) {
    new Set(years).forEach((y) => {
      clearTimeout(timers[y]);
      timers[y] = setTimeout(() => AS.writeYear(y, S.buildYearExport(y)).then((res) => {
        if (res.status === "ok") S.setLastMergedAt(new Date().toISOString());
        setStatus(res.status === "ok" ? "ready" : res.status);
      }), 600);
    });
  }

  function resolver(year) {
    return (monthIndex, fileAt, localAt) => (window.confirm(
      `${F.cap(F.monthName(monthIndex))} ${year} a été modifié sur deux appareils.\n\n` +
      `OK : garder la version de la copie (${new Date(fileAt).toLocaleString("fr-FR")})\n` +
      `Annuler : garder celle de cet appareil (${new Date(localAt).toLocaleString("fr-FR")})`
    ) ? "file" : "local");
  }

  const mergeText = (text, year) => S.mergeYearFromJsonText(text, { lastMergedAt: S.getLastMergedAt(), resolveConflict: resolver(year) });

  /** Ordinateur : reprend ce qu'un autre appareil a écrit dans le dossier (une fois par année). */
  B.mergeFolder = function mergeFolder(year) {
    if (B.manual || merged[year]) return;
    merged[year] = true;
    AS.readYear(year).then((text) => {
      if (!text) return;
      try {
        if (mergeText(text, year).applied > 0) { A.render(); R.toast(`Ce qui a été saisi sur un autre appareil pour ${year} a été repris.`); }
      } catch (e) {
        R.toast(`Le fichier de copie ${AS.fileName(year)} du dossier est illisible : ${e.message}`);
      }
    });
  };

  B.chooseFolder = function chooseFolder() {
    AS.ensureReady().then((ok) => {
      if (!ok) return;
      setStatus("ready");
      R.closeSheet();
      Object.keys(merged).forEach((y) => { merged[y] = false; });
      B.mergeFolder(A.state.year);
      writeYears([A.state.year]);
      A.render();
      R.toast("La copie de secours s'enregistrera toute seule dans ce dossier.");
    }, (e) => { if (e.name !== "AbortError") R.toast(`Dossier inaccessible : ${e.message}`); });
  };

  // --- Reprendre une copie (fichier choisi) -----------------------------------

  async function importFiles(files) {
    let applied = 0;
    const years = new Set();
    try {
      for (const file of files) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (parsed && parsed.format === "abmat-year") {
          const res = mergeText(text, parsed.year);
          applied += res.applied;
          years.add(res.year);
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
    if (!B.manual) writeYears(Array.from(years));
    A.render();
    R.toast(applied ? `Copie reprise : ${F.plural(applied, "mois", "mois")} mis à jour, rien effacé.` : "Copie reprise : tout était déjà à jour.");
  }

  B.importFile = function importFile() {
    const input = document.getElementById("backup-file");
    input.value = "";
    input.click();
  };

  document.getElementById("backup-file").addEventListener("change", (e) => {
    if (e.target.files.length) importFiles(Array.from(e.target.files));
  });

  /** Démarrage : état du dossier (ordinateur), puis rappel éventuel (iPhone). */
  B.init = function init() {
    B.refreshPill();
    if (B.manual) { B.after("open"); return; }
    AS.getStatus().then((status) => { setStatus(status); B.mergeFolder(A.state.year); });
  };
})();
