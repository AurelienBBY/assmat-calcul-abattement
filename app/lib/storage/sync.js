/* ============================================================================
   storage/sync.js — Sauvegarde d'année : export, fusion, import de mois
   ----------------------------------------------------------------------------
   Le fichier « abmat-year » est LA sauvegarde de référence et le point de
   rencontre entre appareils. À l'import, la version LA PLUS RÉCENTE de chaque
   mois gagne (updatedAt). Conflit = le même mois modifié des deux côtés
   depuis la dernière synchro (lastMergedAt) → arbitré par le callback
   resolveConflict, jamais écrasé en silence.
   ========================================================================== */

(function () {
  "use strict";

  const S = window.ABMAT && window.ABMAT.storage;

  if (!S || !S.loadMonth || !S.loadProfile || !S.loadYearSettings) {
    throw new Error("storage/month.js, profile.js et year-settings.js doivent être chargés avant storage/sync.js.");
  }
  const U = window.ABMAT.utils;

  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * Construit l'objet d'export d'une année complète (seuls les mois non vides).
   * Format « abmat-year » v2 : enveloppe { year, months, profile, settings }
   * où chaque mois garde exactement la structure mensuelle du storage.
   *
   * @param {number} year
   * @returns {Object}
   */
  S.buildYearExport = function buildYearExport(year) {
    const y = Number(year);
    const months = {};
    let count = 0;

    for (let m = 0; m < 12; m++) {
      const data = S.loadMonth(y, m).data;
      if (S.isBlankMonth(data)) continue;
      months[String(m)] = data;
      count++;
    }

    const settings = S.loadYearSettings(y);
    return {
      format: "abmat-year",
      version: 2,
      year: y,
      exportedAt: new Date().toISOString(),
      monthsCount: count,
      months,
      profile: S.loadProfile(),
      settings: S.isBlankYearSettings(settings) ? null : settings
    };
  };

  /**
   * Exporte l'année complète dans un fichier JSON (la sauvegarde de référence).
   * Le fichier écrit reflète l'état local → on note le point de synchro.
   * @param {number} year
   */
  S.exportYearToJsonFile = function exportYearToJsonFile(year) {
    downloadJson(`abattement-assmat-${Number(year)}.json`, S.buildYearExport(year));
    S.setLastMergedAt(new Date().toISOString());
  };

  const LAST_MERGED_KEY = "abmat:lastMergedAt";

  S.getLastMergedAt = function getLastMergedAt() {
    try {
      return localStorage.getItem(LAST_MERGED_KEY) || null;
    } catch (e) {
      return null;
    }
  };

  S.setLastMergedAt = function setLastMergedAt(iso) {
    try {
      localStorage.setItem(LAST_MERGED_KEY, String(iso));
    } catch (e) {
      // non bloquant
    }
  };

  function tsOf(obj) {
    return (obj && typeof obj.updatedAt === "string") ? obj.updatedAt : "";
  }

  /**
   * Fusionne une sauvegarde d'année (format « abmat-year ») avec le stockage
   * local, mois par mois.
   *
   * @param {string} text
   * @param {Object} [options]
   *   - lastMergedAt : ISO de la dernière synchro de CET appareil
   *   - resolveConflict(monthIndex, fileUpdatedAt, localUpdatedAt) → "file"|"local"
   * @returns {{year:number, applied:number, kept:number, conflicts:number[]}}
   */
  S.mergeYearFromJsonText = function mergeYearFromJsonText(text, options) {
    const opts = options || {};
    const parsed = JSON.parse(text);
    if (!parsed || parsed.format !== "abmat-year") {
      throw new Error("Ce fichier n'est pas une sauvegarde d'année (format attendu : abmat-year).");
    }
    const y = Number(parsed.year);
    if (!Number.isFinite(y)) {
      throw new Error("Année absente ou invalide dans le fichier.");
    }

    const lastMergedAt = (typeof opts.lastMergedAt === "string") ? opts.lastMergedAt : null;
    const monthsIn = (parsed.months && typeof parsed.months === "object") ? parsed.months : {};
    let applied = 0;
    let kept = 0;
    const conflicts = [];

    for (let m = 0; m < 12; m++) {
      const raw = monthsIn[String(m)];
      const local = S.loadMonth(y, m).data;
      const localBlank = S.isBlankMonth(local);

      if (!raw) {
        if (!localBlank) kept++;
        continue;
      }

      const fileData = S.normalizeMonthData(raw, y, m);
      fileData.year = y;
      fileData.monthIndex = m;

      if (localBlank) {
        S.writeRaw(S.monthKey(y, m), fileData); // préserve l'updatedAt du fichier
        applied++;
        continue;
      }

      const tf = tsOf(fileData);
      const tl = tsOf(local);
      if (tf === tl) {
        kept++;
        continue;
      }

      let winner = (tf > tl) ? "file" : "local"; // comparaison ISO lexicographique

      const bothChangedSinceSync = Boolean(
        lastMergedAt && tf && tl && tf > lastMergedAt && tl > lastMergedAt
      );
      if (bothChangedSinceSync) {
        conflicts.push(m);
        if (typeof opts.resolveConflict === "function") {
          winner = (opts.resolveConflict(m, tf, tl) === "file") ? "file" : "local";
        }
      }

      if (winner === "file") {
        S.writeRaw(S.monthKey(y, m), fileData);
        applied++;
      } else {
        kept++;
      }
    }

    // Profil et réglages d'année : la version la plus récente gagne (pas
    // d'arbitrage — rare et bénin). Un profil v1 est migré au passage.
    if (parsed.profile && typeof parsed.profile === "object") {
      const fileProfile = S.normalizeProfile(parsed.profile, U.toIsoDate(new Date()));
      const localProfile = S.loadProfile();
      if (!localProfile || tsOf(fileProfile) > tsOf(localProfile)) {
        S.writeRaw(S.PROFILE_KEY, fileProfile);
      }
    }
    if (parsed.settings && typeof parsed.settings === "object") {
      const fileSettings = S.normalizeYearSettings(parsed.settings, y);
      const localSettings = S.loadYearSettings(y);
      if (S.isBlankYearSettings(localSettings) || tsOf(fileSettings) > tsOf(localSettings)) {
        S.writeRaw(S.settingsKey(y), fileSettings);
      }
    }

    S.setLastMergedAt(new Date().toISOString());
    return { year: y, applied, kept, conflicts };
  };

  /**
   * Importe un mois à partir du contenu texte d’un fichier JSON.
   * - Si le fichier ne correspond pas au mois affiché :
   *   - allowMismatch=false => erreur
   *   - allowMismatch=true  => on adapte year/monthIndex au mois cible
   *
   * @param {string} text
   * @param {number} targetYear
   * @param {number} targetMonthIndex
   * @param {boolean} allowMismatch
   * @returns {{data:Object, adapted:boolean}}
   */
  S.importMonthFromJsonText = function importMonthFromJsonText(text, targetYear, targetMonthIndex, allowMismatch) {
    const parsed = JSON.parse(text);
    const normalized = S.normalizeMonthData(parsed, targetYear, targetMonthIndex);

    const mismatch = (Number(parsed.year) !== Number(targetYear)) || (Number(parsed.monthIndex) !== Number(targetMonthIndex));
    if (mismatch && !allowMismatch) {
      throw new Error("Le fichier ne correspond pas au mois/année sélectionné.");
    }

    // Adaptation forcée si mismatch autorisé
    if (mismatch && allowMismatch) {
      normalized.year = Number(targetYear);
      normalized.monthIndex = Number(targetMonthIndex);
    }

    return { data: normalized, adapted: mismatch };
  };
})();
