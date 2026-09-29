/* ============================================================================
   app/ctrl/backup-folder.js — Copie de secours : dossier automatique
   (ordinateur) et reprise d'un fichier (partout)
   ----------------------------------------------------------------------------
   Ordinateur : le fichier abattement-assmat-AAAA.json du dossier choisi est
   réécrit 0,6 s après chaque modification, et relu (fusion) à l'ouverture de
   chaque année ; celui des photos (…-fiches.json), quand une photo change.
   Fusion : mois par mois, la version la plus récente gagne, un mois modifié
   des deux côtés est arbitré. Reprise d'un fichier : app/ctrl/backup-import.js.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const S = window.ABMAT.storage;
  const AS = window.ABMAT.autosave;
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

  /**
   * Réécrit le fichier des années touchées (le profil voyage dans l'année en
   * cours) ; celui des photos seulement quand une photo a changé.
   */
  B.writeSoon = function writeSoon(keys) {
    const yearOf = (k) => (/^\d{4}-/.test(k) ? Number(k.slice(0, 4)) : new Date().getFullYear());
    B.writeYears(keys.filter((k) => !k.endsWith("-fiche")).map(yearOf));
    new Set(keys.filter((k) => k.endsWith("-fiche")).map(yearOf)).forEach(B.writeFiches);
  };

  B.writeFiches = async function writeFiches(year) {
    const fiches = await S.fiches.exportYear(year);
    if (!fiches) return;
    const res = await AS.writeText(AS.fichesFileName(year), JSON.stringify(fiches));
    setStatus(res.status === "ok" ? "ready" : res.status);
  };

  /** Fusionne un fichier de photos ; les photos en mémoire de cette année sont oubliées. */
  B.mergeFichesText = async function mergeFichesText(text) {
    const res = await S.fiches.mergeText(text);
    if (res.applied) A.photos.forget(res.year);
    return res;
  };

  B.writeYears = function writeYears(years) {
    new Set(years).forEach((y) => {
      clearTimeout(timers[y]);
      timers[y] = setTimeout(() => AS.writeYear(y, S.buildYearExport(y)).then((res) => {
        if (res.status === "ok") S.setLastMergedAt(new Date().toISOString());
        setStatus(res.status === "ok" ? "ready" : res.status);
      }), 600);
    });
  };

  function resolver(year) {
    return (monthIndex, fileAt, localAt) => (window.confirm(
      `${F.cap(F.monthName(monthIndex))} ${year} a été modifié sur deux appareils.\n\n` +
      `OK : garder la version de la copie (${new Date(fileAt).toLocaleString("fr-FR")})\n` +
      `Annuler : garder celle de cet appareil (${new Date(localAt).toLocaleString("fr-FR")})`
    ) ? "file" : "local");
  }

  B.mergeText = (text, year) => S.mergeYearFromJsonText(text, { lastMergedAt: S.getLastMergedAt(), resolveConflict: resolver(year) });

  /** Ordinateur : reprend ce qu'un autre appareil a écrit dans le dossier (une fois par année). */
  B.mergeFolder = function mergeFolder(year) {
    if (B.manual || merged[year]) return;
    merged[year] = true;
    AS.readYear(year).then((text) => {
      if (!text) return;
      try {
        if (B.mergeText(text, year).applied > 0) { A.render(); R.toast(`Ce qui a été saisi sur un autre appareil pour ${year} a été repris.`); }
      } catch (e) {
        R.toast(`Le fichier de copie ${AS.fileName(year)} du dossier est illisible : ${e.message}`);
      }
    });
    AS.readText(AS.fichesFileName(year)).then((text) => (text ? B.mergeFichesText(text) : null)).then((res) => {
      if (res && res.applied) { A.render(); R.toast(`${F.plural(res.applied, "photo")} de fiche reprise${res.applied > 1 ? "s" : ""} d'un autre appareil.`); }
    }, (e) => R.toast(`Le fichier ${AS.fichesFileName(year)} du dossier est illisible : ${e.message}`));
  };

  B.chooseFolder = function chooseFolder() {
    AS.ensureReady().then((ok) => {
      if (!ok) return;
      setStatus("ready");
      R.closeSheet();
      Object.keys(merged).forEach((y) => { merged[y] = false; });
      B.mergeFolder(A.state.year);
      B.writeYears([A.state.year]);
      A.render();
      R.toast("La copie de secours s'enregistrera toute seule dans ce dossier.");
    }, (e) => { if (e.name !== "AbortError") R.toast(`Dossier inaccessible : ${e.message}`); });
  };

  /** Démarrage : état du dossier (ordinateur), puis rappel éventuel (iPhone). */
  B.init = function init() {
    B.refreshPill();
    if (B.manual) { B.after("open"); return; }
    AS.getStatus().then((status) => { setStatus(status); B.mergeFolder(A.state.year); });
  };
})();
