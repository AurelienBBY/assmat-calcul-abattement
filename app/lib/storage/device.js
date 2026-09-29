/* ============================================================================
   storage/device.js — État propre à CET appareil (jamais exporté)
   ----------------------------------------------------------------------------
   - abmat:sync : suivi de la copie de secours manuelle (iPhone) — cf.
     compute/backup-rules.js ; illisible → état vierge (simple rappel, pas
     une donnée fiscale).
   - abmat:ui:onboarding : où en est la mise en route { step, done }.
   - abmat:ui:tips : bulles d'aide déjà vues (une par onglet).
   - abmat:ui:install : « Continuer sans installer » choisi (écran d'installation).
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

  // Lecture d'un petit état d'interface ; illisible → valeur par défaut
  // (ce n'est pas une donnée fiscale : repartir de zéro est sans risque).
  function readUi(key, fallback) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "null");
      return (raw && typeof raw === "object") ? raw : fallback;
    } catch (e) {
      return fallback;
    }
  }

  const ONBOARDING_KEY = "abmat:ui:onboarding";
  const TIPS_KEY = "abmat:ui:tips";

  S.loadOnboarding = function loadOnboarding() {
    const raw = readUi(ONBOARDING_KEY, {});
    const step = Number(raw.step);
    return { step: Number.isInteger(step) && step >= 0 ? step : 0, done: raw.done === true };
  };
  S.saveOnboarding = (state) => S.writeRaw(ONBOARDING_KEY, { step: state.step, done: state.done === true });

  const INSTALL_KEY = "abmat:ui:install";
  S.installSkipped = () => readUi(INSTALL_KEY, {}).skipped === true;
  S.skipInstall = () => S.writeRaw(INSTALL_KEY, { skipped: true });

  S.tipSeen = (name) => readUi(TIPS_KEY, {})[name] === true;
  S.markTipSeen = (name) => S.writeRaw(TIPS_KEY, Object.assign(readUi(TIPS_KEY, {}), { [name]: true }));
})();
