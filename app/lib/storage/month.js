/* ============================================================================
   storage/month.js — Données d'un mois (clé abmat:YYYY-MM)
   ----------------------------------------------------------------------------
   Structure sauvegardée (par mois), schéma v2 :
   {
     version: 2, year: 2026, monthIndex: 0,
     smicOverride: 12.02 | null, netImposable: 0, irf: 0,
     days: {
       "2026-01-05": {
         children: {
           "1": { absent: false, motif: "", slots: [ {in:"08:00", out:"17:00"}, ... ] },
           "2": { ... }, "3": { ... }
         }
       }
     }
   }
   Migration v1 → v2 automatique : l'ancien { slots: {"1":{in,out}} } devient
   un enfant avec un seul créneau.
   ========================================================================== */

(function () {
  "use strict";

  const S = window.ABMAT && window.ABMAT.storage;
  const U = window.ABMAT && window.ABMAT.utils;

  if (!S || !S.writeRaw) {
    throw new Error("storage/core.js doit être chargé avant storage/month.js.");
  }

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

  /**
   * Normalise (et migre) les données d'un mois. Mute et retourne `data`.
   */
  S.normalizeMonthData = function normalizeMonthData(data, year, monthIndex) {
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
  };

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
      const normalized = S.normalizeMonthData(parsed, year, monthIndex);

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
   * L'horodatage `updatedAt` n'est posé que si le CONTENU change — consulter
   * un mois sans le modifier ne le marque pas « modifié » (sinon la fusion
   * multi-appareils verrait des conflits partout).
   * @returns {boolean} succès
   */
  S.saveMonth = function saveMonth(key, data) {
    if (S.sameContent(key, data)) return true; // rien n'a changé : ni stockage ni horodatage
    const next = Object.assign({}, data, { updatedAt: new Date().toISOString() });
    return S.writeRaw(key, next);
  };

  /**
   * Un mois est « vide » s'il n'a ni montants, ni override SMIC, ni horaire saisi.
   */
  S.isBlankMonth = function isBlankMonth(data) {
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
  };
})();
