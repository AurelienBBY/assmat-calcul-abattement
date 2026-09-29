/* ============================================================================
   storage/device.js — État propre à CET appareil (jamais exporté)
   ----------------------------------------------------------------------------
   - abmat:sync : suivi de la copie de secours manuelle (iPhone) — cf.
     compute/backup-rules.js ; illisible → état vierge (simple rappel, pas
     une donnée fiscale).
   ========================================================================== */

(function () {
  "use strict";

  const S = window.ABMAT && window.ABMAT.storage;
  const Compute = window.ABMAT && window.ABMAT.compute;

  if (!S || !S.writeRaw || !Compute || !Compute.syncBlank) {
    throw new Error("storage/core.js et compute/backup-rules.js doivent être chargés avant storage/device.js.");
  }

  const SYNC_KEY = "abmat:sync";

  S.loadDeviceSync = function loadDeviceSync() {
    const blank = Compute.syncBlank();
    try {
      const raw = JSON.parse(localStorage.getItem(SYNC_KEY) || "null");
      if (!raw || typeof raw !== "object") return blank;
      const str = (v) => (typeof v === "string") ? v : null;
      return {
        lastSentAt: str(raw.lastSentAt), lastImportAt: str(raw.lastImportAt),
        pending: Array.isArray(raw.pending) ? raw.pending.filter((k) => typeof k === "string") : [],
        lastPromptOn: str(raw.lastPromptOn), sendSnoozeUntil: str(raw.sendSnoozeUntil), importSnoozeUntil: str(raw.importSnoozeUntil)
      };
    } catch (e) {
      return blank;
    }
  };

  S.saveDeviceSync = (sync) => S.writeRaw(SYNC_KEY, sync);
})();
