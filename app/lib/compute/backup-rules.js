/* ============================================================================
   compute/backup-rules.js — Rappels de copie de secours sur iPhone (sans DOM)
   ----------------------------------------------------------------------------
   Sur iPhone, la copie iCloud se fait à la main (feuille de partage). Règles
   (feuille de route, lot 12) :
   - reprise : « Avez-vous saisi sur l'ordinateur ? » à l'ouverture, si la
     dernière reprise date de plus de 7 jours ; « Non » → une semaine de calme ;
   - envoi : à la fin d'un mois (fenêtre), en fin de journée pointée si au
     moins 3 jours non envoyés (message), à l'ouverture si la copie a plus de
     7 jours (fenêtre) ; « Plus tard » → 3 jours de calme ;
   - au plus une fenêtre par jour ; jamais de fenêtre pendant qu'un enfant
     est pointé présent (un bandeau la remplace).
   État de l'appareil : { lastSentAt, lastImportAt, pending:[clés], lastPromptOn,
   sendSnoozeUntil, importSnoozeUntil } (storage/device.js).
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.compute = window.ABMAT.compute || {};
  const Compute = window.ABMAT.compute;

  const DAY_MS = 24 * 3600 * 1000;
  const olderThan = (iso, days, now) => !iso || (now - Date.parse(iso)) > days * DAY_MS;
  const passed = (iso, now) => !iso || Date.parse(iso) <= now;
  const addDays = (now, days) => new Date(now + days * DAY_MS).toISOString();

  /**
   * Quel rappel montrer ?
   * @param {Object} sync - état de l'appareil
   * @param {"open"|"month-done"|"day-end"} trigger
   * @param {{manual:boolean, childHere:boolean, now:number, todayIso:string}} ctx
   * @returns {{type:"import"|"send-old"|"send-month"|"send-day", kind:"modal"|"banner"|"toast"}|null}
   */
  Compute.backupPrompt = function backupPrompt(sync, trigger, ctx) {
    if (!ctx.manual) return null; // ordinateur : la copie est automatique
    const pending = sync.pending.length;
    const quiet = ctx.childHere || sync.lastPromptOn === ctx.todayIso;
    const windowKind = quiet ? "banner" : "modal";

    if (trigger === "month-done") return pending ? { type: "send-month", kind: ctx.childHere ? "banner" : "modal" } : null;
    if (trigger === "day-end") {
      return (pending >= 3 && passed(sync.sendSnoozeUntil, ctx.now)) ? { type: "send-day", kind: "toast" } : null;
    }
    // Ouverture
    if (sync.lastImportAt && olderThan(sync.lastImportAt, 7, ctx.now) && passed(sync.importSnoozeUntil, ctx.now)) {
      return { type: "import", kind: windowKind };
    }
    if (pending && olderThan(sync.lastSentAt, 7, ctx.now) && passed(sync.sendSnoozeUntil, ctx.now)) {
      return { type: "send-old", kind: windowKind };
    }
    return null;
  };

  Compute.syncBlank = () => ({ lastSentAt: null, lastImportAt: null, pending: [], lastPromptOn: null, sendSnoozeUntil: null, importSnoozeUntil: null });

  /** Une modification locale (clé = date ou mois) pas encore envoyée. */
  Compute.syncChanged = (sync, key) => { if (!sync.pending.includes(key)) sync.pending.push(key); };
  Compute.syncSent = (sync, now) => { sync.pending = []; sync.lastSentAt = new Date(now).toISOString(); sync.sendSnoozeUntil = null; };
  Compute.syncImported = (sync, now) => { sync.lastImportAt = new Date(now).toISOString(); sync.importSnoozeUntil = null; };
  Compute.syncPrompted = (sync, todayIso) => { sync.lastPromptOn = todayIso; };
  Compute.syncSnoozeSend = (sync, now) => { sync.sendSnoozeUntil = addDays(now, 3); };
  Compute.syncSnoozeImport = (sync, now) => { sync.importSnoozeUntil = addDays(now, 7); };
})();
