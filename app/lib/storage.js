

/* ============================================================================
   storage.js — Stockage local + export/import JSON (sans serveur)
   ----------------------------------------------------------------------------
   Objectif :
   - Sauvegarde automatique par mois dans localStorage
   - Export manuel de l'année complète en fichier JSON (backup iCloud/clé USB)
   - Import depuis un JSON exporté précédemment (année, ou ancien fichier mois)
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
   * Structure de données sauvegardée (par mois), schéma v2 :
   * {
   *   version: 2,
   *   year: 2026,
   *   monthIndex: 0,
   *   smicOverride: 12.02 | null,
   *   netImposable: 0,
   *   irf: 0,
   *   days: {
   *     "2026-01-05": {
   *       children: {
   *         "1": { absent: false, motif: "", slots: [ {in:"08:00", out:"17:00"}, ... ] },
   *         "2": { ... }, "3": { ... }
   *       }
   *     }
   *   }
   * }
   * Migration v1 → v2 automatique : l'ancien { slots: {"1":{in,out}} } devient
   * un enfant avec un seul créneau.
   */

  S.monthKey = function monthKey(year, monthIndex) {
    return `abmat:${Number(year)}-${U.pad2(Number(monthIndex) + 1)}`;
  };

  S.blankMonthData = function blankMonthData(year, monthIndex) {
    return {
      version: 2,
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

  function isEmptySlot(s) {
    return s.in === "" && s.out === "";
  }

  function normalizeChildObj(childObj) {
    const c = childObj && typeof childObj === "object" ? childObj : {};
    const slotsIn = Array.isArray(c.slots) ? c.slots : [];
    const slots = slotsIn.map(normalizeSlotObj).filter((s) => !isEmptySlot(s)).slice(0, 3);
    return {
      absent: c.absent === true,
      motif: (typeof c.motif === "string") ? c.motif : "",
      slots
    };
  }

  function normalizeDayObj(dayObj) {
    const d = dayObj && typeof dayObj === "object" ? dayObj : {};

    // Migration v1 : { slots: {"1":{in,out}, ...} } → un créneau par enfant.
    if (d.slots && typeof d.slots === "object" && !d.children) {
      const children = {};
      for (let i = 1; i <= 3; i++) {
        const s = normalizeSlotObj(d.slots[String(i)]);
        children[String(i)] = { absent: false, motif: "", slots: isEmptySlot(s) ? [] : [s] };
      }
      return { children };
    }

    const childrenIn = (d.children && typeof d.children === "object") ? d.children : {};
    const children = {};
    for (let i = 1; i <= 3; i++) {
      children[String(i)] = normalizeChildObj(childrenIn[String(i)]);
    }
    return { children };
  }

  function normalizeData(data, year, monthIndex) {
    const out = (data && typeof data === "object") ? data : S.blankMonthData(year, monthIndex);

    out.version = 2;
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
   * Un mois est « vide » s'il n'a ni montants, ni override SMIC, ni horaire saisi.
   */
  function isBlankMonth(data) {
    if (!data) return true;
    if (Number(data.netImposable) > 0 || Number(data.irf) > 0) return false;
    if (data.smicOverride !== null && data.smicOverride !== undefined) return false;

    const days = (data.days && typeof data.days === "object") ? data.days : {};
    return !Object.keys(days).some((iso) => {
      const children = (days[iso] && days[iso].children) ? days[iso].children : {};
      return ["1", "2", "3"].some((k) => {
        const c = children[k] || {};
        if (c.absent === true) return true; // une absence notée est une donnée
        const slots = Array.isArray(c.slots) ? c.slots : [];
        return slots.some((s) => (s && ((s.in && s.in !== "") || (s.out && s.out !== ""))));
      });
    });
  }

  /**
   * Construit l'objet d'export d'une année complète (seuls les mois non vides).
   * Format « abmat-year » : enveloppe { year, months } où chaque mois garde
   * exactement la structure mensuelle du storage.
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
      if (isBlankMonth(data)) continue;
      months[String(m)] = data;
      count++;
    }

    return {
      format: "abmat-year",
      version: 1,
      year: y,
      exportedAt: new Date().toISOString(),
      monthsCount: count,
      months,
      profile: S.loadProfile()
    };
  };

  /**
   * Exporte l'année complète dans un fichier JSON (la sauvegarde de référence).
   * @param {number} year
   */
  S.exportYearToJsonFile = function exportYearToJsonFile(year) {
    downloadJson(`abattement-assmat-${Number(year)}.json`, S.buildYearExport(year));
  };

  /**
   * Importe une année complète (format « abmat-year ») : chaque mois présent
   * est normalisé puis écrit dans le localStorage (remplace l'existant).
   *
   * @param {string} text
   * @returns {{year:number, count:number}}
   */
  S.importYearFromJsonText = function importYearFromJsonText(text) {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.format !== "abmat-year") {
      throw new Error("Ce fichier n'est pas une sauvegarde d'année (format attendu : abmat-year).");
    }
    const y = Number(parsed.year);
    if (!Number.isFinite(y)) {
      throw new Error("Année absente ou invalide dans le fichier.");
    }

    // Le profil (Mes informations) voyage avec la sauvegarde d'année.
    if (parsed.profile && typeof parsed.profile === "object") {
      S.saveProfile(parsed.profile);
    }

    const monthsIn = (parsed.months && typeof parsed.months === "object") ? parsed.months : {};
    let count = 0;

    for (let m = 0; m < 12; m++) {
      const raw = monthsIn[String(m)];
      if (!raw) continue;

      const normalized = normalizeData(raw, y, m);
      normalized.year = y;
      normalized.monthIndex = m;
      S.saveMonth(S.monthKey(y, m), normalized);
      count++;
    }

    return { year: y, count };
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

  /* --- Profil « Mes informations » (clé abmat:profile) ---------------------
     { version:1, name, employer, mention,
       children: { "1": { name, active, week: { "1".."5": {in,out} } }, … } }
     week = semaine type (lundi=1 … vendredi=5), un créneau par jour.       */

  const PROFILE_KEY = "abmat:profile";

  function normalizeWeekDay(t) {
    const o = (t && typeof t === "object") ? t : {};
    return {
      in: (typeof o.in === "string") ? o.in : "",
      out: (typeof o.out === "string") ? o.out : ""
    };
  }

  function normalizeProfileChild(c) {
    const o = (c && typeof c === "object") ? c : {};
    const week = {};
    for (let d = 1; d <= 5; d++) {
      week[String(d)] = normalizeWeekDay(o.week && o.week[String(d)]);
    }
    return {
      name: (typeof o.name === "string") ? o.name : "",
      active: o.active !== false,
      week
    };
  }

  S.blankProfile = function blankProfile() {
    const children = {};
    for (let i = 1; i <= 3; i++) children[String(i)] = normalizeProfileChild(null);
    return { version: 1, name: "", employer: "", mention: "", children };
  };

  S.normalizeProfile = function normalizeProfile(p) {
    const src = (p && typeof p === "object") ? p : {};
    const out = S.blankProfile();
    out.name = (typeof src.name === "string") ? src.name : "";
    out.employer = (typeof src.employer === "string") ? src.employer : "";
    out.mention = (typeof src.mention === "string") ? src.mention : "";

    const childrenIn = (src.children && typeof src.children === "object") ? src.children : {};
    for (let i = 1; i <= 3; i++) {
      const k = String(i);
      const c = childrenIn[k];
      // Compat : accepte l'ancienne forme « nom en chaîne »
      out.children[k] = normalizeProfileChild((typeof c === "string") ? { name: c } : c);
    }
    return out;
  };

  S.loadProfile = function loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return null;
      return S.normalizeProfile(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  };

  S.saveProfile = function saveProfile(profile) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(S.normalizeProfile(profile)));
      return true;
    } catch (e) {
      console.warn("Impossible d'enregistrer le profil:", e);
      return false;
    }
  };
})();