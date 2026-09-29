/* ============================================================================
   app/ctrl/backup.js — Copie de secours (A.backup)
   ----------------------------------------------------------------------------
   iPhone (pas d'accès aux dossiers) : copie « à la main » — rappels aux
   moments clés selon Compute.backupPrompt, envoi par la feuille de partage,
   reprise par fusion. Ordinateur : dossier automatique (app/ctrl/backup-folder.js).
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

  // --- Envoi (iPhone) ------------------------------------------------------------

  function pendingYears() {
    const years = new Set(sync.pending.filter((k) => /^\d{4}-/.test(k)).map((k) => Number(k.slice(0, 4))));
    if (!years.size) years.add(new Date().getFullYear());
    return Array.from(years).sort();
  }

  function sent() {
    Compute.syncSent(sync, Date.now());
    S.setLastMergedAt(new Date().toISOString());
    saveSync();
    A.state.banner = null;
    R.closeSheet();
    A.render();
    R.toast("Copie envoyée. L'ordinateur la reprendra à sa prochaine ouverture.");
  }

  function share() {
    const years = pendingYears();
    const files = years.map((y) => new File([JSON.stringify(S.buildYearExport(y), null, 2)], AS.fileName(y), { type: "application/json" }));
    if (typeof navigator.canShare === "function" && navigator.canShare({ files })) {
      navigator.share({ files }).then(sent, (e) => { if (e.name !== "AbortError") R.toast(`Envoi impossible : ${e.message}`); });
      return;
    }
    years.forEach((y) => S.exportYearToJsonFile(y)); // navigateur sans partage : téléchargement
    sent();
  }

  function openSheet(kind, extra) {
    const s = R.buildBackupSheet(kind, Object.assign(info(), extra || {}), handlers);
    R.openSheet({ title: s.title, body: s.body });
  }

  const handlers = {
    onSend: () => openSheet("sending"),
    onShare: share,
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

  B.openMenu = () => openSheet("menu");
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
      R.toast(`Journée terminée. ${F.cap(F.plural(info().pendingDays, "jour"))} pas encore envoyé${info().pendingDays > 1 ? "s" : ""} dans iCloud.`, [{ label: "Envoyer ma copie", run: () => openSheet("sending") }]);
    } else if (prompt.kind === "banner") {
      A.state.banner = prompt.type === "import" ? "import" : "send";
      A.render();
    } else {
      Compute.syncPrompted(sync, A.todayIso());
      saveSync();
      openSheet(prompt.type === "send-day" ? "send-old" : prompt.type, { monthName });
    }
  };
})();
