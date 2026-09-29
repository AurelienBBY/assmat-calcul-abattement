/* ============================================================================
   storage/year-settings.js — Réglages d'une année (clé abmat:settings:AAAA)
   ----------------------------------------------------------------------------
   { version: 1, year, smic: nombre|null, relais: booléen, updatedAt }
   - smic : SMIC horaire brut au 1er janvier, réglé au passage d'année ; un
     seul par année (remplace le smicOverride mensuel des schémas v1/v2).
     null = non réglé → le barème de config.js s'applique (cf. compute).
   - relais : l'assistante maternelle fait de l'accueil relais cette année.
   Voyage dans la sauvegarde d'année (storage/sync.js).
   ========================================================================== */

(function () {
  "use strict";

  const S = window.ABMAT && window.ABMAT.storage;

  if (!S || !S.writeRaw) {
    throw new Error("storage/core.js doit être chargé avant storage/year-settings.js.");
  }

  S.settingsKey = (year) => `abmat:settings:${Number(year)}`;

  S.blankYearSettings = function blankYearSettings(year) {
    return { version: 1, year: Number(year), smic: null, relais: false };
  };

  S.normalizeYearSettings = function normalizeYearSettings(raw, year) {
    const src = (raw && typeof raw === "object") ? raw : {};
    const smic = Number(src.smic);
    const out = {
      version: 1,
      year: Number(year),
      smic: (src.smic !== null && src.smic !== "" && Number.isFinite(smic) && smic > 0) ? smic : null,
      relais: src.relais === true
    };
    if (typeof src.updatedAt === "string") out.updatedAt = src.updatedAt;
    return out;
  };

  S.isBlankYearSettings = (s) => !s || (s.smic === null && s.relais !== true);

  S.loadYearSettings = function loadYearSettings(year) {
    try {
      const raw = localStorage.getItem(S.settingsKey(year));
      return raw ? S.normalizeYearSettings(JSON.parse(raw), year) : S.blankYearSettings(year);
    } catch (e) {
      return S.blankYearSettings(year);
    }
  };

  /** Horodatage posé seulement si le contenu change (comme les mois). */
  S.saveYearSettings = function saveYearSettings(settings) {
    const normalized = S.normalizeYearSettings(settings, settings.year);
    const key = S.settingsKey(normalized.year);
    if (S.sameContent(key, normalized)) return true;
    normalized.updatedAt = new Date().toISOString();
    return S.writeRaw(key, normalized);
  };
})();
