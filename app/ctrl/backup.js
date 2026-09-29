/* ============================================================================
   app/ctrl/backup.js — Copie de secours (A.backup)
   ----------------------------------------------------------------------------
   iPhone (pas d'accès aux dossiers) : copie « à la main » — rappels aux
   moments clés selon Compute.backupPrompt, envoi par la feuille de partage
   (app/ctrl/backup-send.js), reprise par fusion (app/ctrl/backup-import.js).
   Ordinateur : dossier automatique (app/ctrl/backup-folder.js).
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const S = window.ABMAT.storage;
  const AS = window.ABMAT.autosave;
  const Compute = window.ABMAT.compute;
  const F = R.fmt;

  if (!A || !AS || !R.buildBackupSheet || !Compute.backupPrompt || !S.loadDeviceSync) {
    throw new Error("app/ctrl/ctx.js, autosave.js, render/backup.js et compute/backup-rules.js doivent être chargés avant app/ctrl/backup.js.");
  }

  const manual = !AS.isSupported();
  const sync = S.loadDeviceSync();
  const saveSync = () => S.saveDeviceSync(sync);
  const B = A.backup = { manual, sync, saveSync, autoStatus: manual ? "unsupported" : "ready" };

  function info() {
    return {
      manual, autoStatus: B.autoStatus, firstName: A.profile().firstName,
      pendingDays: sync.pending.filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).length,
      pendingAny: sync.pending.length > 0, lastSentAt: sync.lastSentAt, lastImportAt: sync.lastImportAt
    };
  }

  B.refreshPill = function refreshPill() {
    const pill = document.getElementById("backup-pill");
    const [lbl, short, warn] = R.backupPillText(info());
    pill.querySelector(".lbl").textContent = lbl;
    pill.querySelector(".lbl-phone").textContent = short;
    pill.classList.toggle("is-warn", warn);
    pill.setAttribute("aria-label", `Copie de secours : ${lbl}`);
  };

  /** @param {string[]} keys - jours (AAAA-MM-JJ), mois (AAAA-MM), « AAAA-settings », « profile » */
  B.changed = function changed(keys) {
    if (!manual) { B.writeSoon(keys); return; }
    keys.forEach((k) => Compute.syncChanged(sync, k));
    saveSync();
    B.refreshPill();
  };

  // Fenêtres de la copie (render/backup.js) ; l'envoi est dans app/ctrl/backup-send.js.
  const sheetOf = (kind, extra) => R.buildBackupSheet(kind, Object.assign(info(), extra || {}), handlers);
  B.info = info;
  B.sheetBody = (kind, extra) => sheetOf(kind, extra).body;
  B.openSheet = function openSheet(kind, extra) {
    const s = sheetOf(kind, extra);
    return R.openSheet({ title: s.title, body: s.body });
  };

  const handlers = {
    onSend: () => B.openSending(),
    onShare: () => B.share(),
    onImport: () => { R.closeSheet(); A.state.banner = null; B.importFile(); },
    onNoNew: () => { Compute.syncSnoozeImport(sync, Date.now()); saveSync(); B.dismiss("D'accord. La question reviendra dans une semaine."); },
    onLater: () => { Compute.syncSnoozeSend(sync, Date.now()); saveSync(); B.dismiss("D'accord. Rappel dans 3 jours."); },
    onChooseFolder: () => B.chooseFolder(),
    onDownload: () => S.exportYearToJsonFile(A.state.year)
  };

  B.dismiss = function dismiss(message) {
    R.closeSheet();
    if (A.state.banner) { A.state.banner = null; A.render(); }
    R.toast(message);
  };

  B.openMenu = () => B.openSheet("menu");
  B.buildProfileCard = () => R.buildBackupCard(info(), handlers);
  B.buildBanner = (kind) => R.buildBackupBanner(kind, info(), handlers);

  // --- Rappels aux moments clés -------------------------------------------------

  function todayDay() {
    const iso = A.todayIso();
    const [y, m] = A.monthOf(iso);
    return A.loadMonth(y, m).days[iso] || null;
  }

  /**
   * @param {"open"|"month-done"|"day-end"} trigger
   * @param {string} [monthName] - mois terminé (« Septembre »)
   */
  B.after = function after(trigger, monthName) {
    if (!manual) {
      if (trigger === "month-done") R.toast(`${monthName} est terminé.${B.autoStatus === "ready" ? " La copie de secours s'est enregistrée toute seule." : ""}`);
      return;
    }
    const prompt = Compute.backupPrompt(sync, trigger, { manual, childHere: Compute.someoneHere(todayDay()), now: Date.now(), todayIso: A.todayIso() });
    if (!prompt) {
      if (trigger === "month-done") R.toast(`${monthName} est terminé.`);
      return;
    }
    if (prompt.kind === "toast") {
      R.toast(`Journée terminée. ${F.cap(F.plural(info().pendingDays, "jour"))} pas encore envoyé${info().pendingDays > 1 ? "s" : ""} dans iCloud.`, [{ label: "Envoyer ma copie", run: () => B.openSending() }]);
    } else if (prompt.kind === "banner") {
      A.state.banner = prompt.type === "import" ? "import" : "send";
      A.render();
    } else {
      Compute.syncPrompted(sync, A.todayIso());
      saveSync();
      B.openSheet(prompt.type === "send-day" ? "send-old" : prompt.type, { monthName });
    }
  };
})();
