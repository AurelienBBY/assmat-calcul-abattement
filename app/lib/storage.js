

/* ============================================================================
   storage.js — Stockage local + export/import JSON (sans serveur)
   ----------------------------------------------------------------------------
   Objectif :
   - Sauvegarde automatique par mois dans localStorage
   - Export manuel en fichier JSON (backup iCloud/clé USB)
   - Import depuis un JSON exporté précédemment
   ----------------------------------------------------------------------------
   Remarques :
   - localStorage est lié au navigateur + machine (effacement possible).
   - L’export JSON sert de sauvegarde durable et transférable.
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.storage = window.ABMAT.storage || {};

  const S = window.ABMAT.storage;
  const U = window.ABMAT.utils;

  if (!U) {
    throw new Error("ABMAT.utils est requis avant ABMAT.storage (charger utils.js en premier).");
  }

  /**
   * Structure de données sauvegardée (par mois) :
   * {
   *   version: 1,
   *   year: 2025,
   *   monthIndex: 0,
   *   smicOverride: 12.02 | null,
   *   netImposable: 0,
   *   irf: 0,
   *   days: {
   *     "2025-01-02": { slots: { "1": {in:"08:00", out:"17:00"}, "2": {...}, "3": {...} } },
   *     ...
   *   }
   * }
   */

  S.monthKey = function monthKey(year, monthIndex) {
    return `abmat:${Number(year)}-${U.pad2(Number(monthIndex) + 1)}`;
  };

  S.blankMonthData = function blankMonthData(year, monthIndex) {
    return {
      version: 1,
      year: Number(year),
      monthIndex: Number(monthIndex),
      smicOverride: null,
      netImposable: 0,
      irf: 0,
      days: {}
    };
  };

  function normalizeSlotObj(slotObj) {
    const o = slotObj && typeof slotObj === "object" ? slotObj : {};
    return {
      in: (typeof o.in === "string") ? o.in : "",
      out: (typeof o.out === "string") ? o.out : ""
    };
  }

  function normalizeDayObj(dayObj) {
    const d = dayObj && typeof dayObj === "object" ? dayObj : {};
    const slots = (d.slots && typeof d.slots === "object") ? d.slots : {};
    return {
      slots: {
        "1": normalizeSlotObj(slots["1"]),
        "2": normalizeSlotObj(slots["2"]),
        "3": normalizeSlotObj(slots["3"])
      }
    };
  }

  function normalizeData(data, year, monthIndex) {
    const out = (data && typeof data === "object") ? data : S.blankMonthData(year, monthIndex);

    out.version = 1;
    out.year = Number(out.year);
    out.monthIndex = Number(out.monthIndex);

    // Année/mois : si invalide, on force vers la cible
    if (!Number.isFinite(out.year)) out.year = Number(year);
    if (!Number.isFinite(out.monthIndex)) out.monthIndex = Number(monthIndex);

    // Champs numériques
    out.netImposable = Number(out.netImposable);
    out.irf = Number(out.irf);
    if (!Number.isFinite(out.netImposable)) out.netImposable = 0;
    if (!Number.isFinite(out.irf)) out.irf = 0;

    // SMIC override
    if (out.smicOverride === null || out.smicOverride === undefined || out.smicOverride === "") {
      out.smicOverride = null;
    } else {
      out.smicOverride = Number(out.smicOverride);
      if (!Number.isFinite(out.smicOverride)) out.smicOverride = null;
    }

    // Jours
    const daysIn = (out.days && typeof out.days === "object") ? out.days : {};
    const daysOut = {};
    Object.keys(daysIn).forEach((isoDate) => {
      daysOut[isoDate] = normalizeDayObj(daysIn[isoDate]);
    });
    out.days = daysOut;

    return out;
  }

  /**
   * Charge un mois depuis localStorage.
   * @returns {{key:string, data:Object}}
   */
  S.loadMonth = function loadMonth(year, monthIndex) {
    const key = S.monthKey(year, monthIndex);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return { key, data: S.blankMonthData(year, monthIndex) };
      }
      const parsed = JSON.parse(raw);
      const normalized = normalizeData(parsed, year, monthIndex);

      // Si l’enregistrement ne correspond pas au mois, on repart proprement
      if (normalized.year !== Number(year) || normalized.monthIndex !== Number(monthIndex)) {
        return { key, data: S.blankMonthData(year, monthIndex) };
      }

      return { key, data: normalized };
    } catch (e) {
      return { key, data: S.blankMonthData(year, monthIndex) };
    }
  };

  /**
   * Sauvegarde un mois dans localStorage.
   * @returns {boolean} succès
   */
  S.saveMonth = function saveMonth(key, data) {
    try {
      localStorage.setItem(String(key), JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn("Impossible de sauvegarder dans localStorage:", e);
      return false;
    }
  };

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
   * Exporte le mois (clé + data) dans un fichier JSON.
   * @param {string} key
   * @param {Object} data
   */
  S.exportMonthToJsonFile = function exportMonthToJsonFile(key, data) {
    const m = String(key).replace(/^abmat:/, ""); // "YYYY-MM"
    const filename = `abattement-assmat-${m}.json`;
    downloadJson(filename, data);
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
    const normalized = normalizeData(parsed, targetYear, targetMonthIndex);

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