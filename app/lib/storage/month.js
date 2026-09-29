/* ============================================================================
   storage/month.js — Données d'un mois (clé abmat:YYYY-MM), schéma v3
   ----------------------------------------------------------------------------
   {
     version: 3, year: 2026, monthIndex: 8,
     netImposable: 0, irf: 0, verified: false, done: false,
     days: {
       "2026-09-14": {
         off: false,                       // jour non travaillé
         children: {                       // seulement les enfants avec une donnée
           "c1": { absent: false, motif: "", slots: [ {in:"08:00", out:"17:30"} ], punched: false },
           "r1": { relais: true, name: "Nino", absent: false, motif: "", slots: [...], punched: false }
         },
         meetings: [ {in:"19:00", out:"21:00"} ]
       }
     }
   }
   Migrations v1 → v2 → v3 dans normalizeMonthData (cf. docs/schema-donnees-v3.md).
   ========================================================================== */

(function () {
  "use strict";

  const S = window.ABMAT && window.ABMAT.storage;
  const U = window.ABMAT && window.ABMAT.utils;

  if (!S || !S.writeRaw) {
    throw new Error("storage/core.js doit être chargé avant storage/month.js.");
  }

  const CHILD_ID = /^c\d+$/;
  const RELAIS_ID = /^r\d+$/;
  const LEGACY_ID = /^[123]$/; // schémas v1/v2 : enfants "1", "2", "3"
  const MAX_SLOTS = 3;

  S.isRelaisId = (id) => RELAIS_ID.test(String(id));

  S.monthKey = function monthKey(year, monthIndex) {
    return `abmat:${Number(year)}-${U.pad2(Number(monthIndex) + 1)}`;
  };

  S.blankMonthData = function blankMonthData(year, monthIndex) {
    return {
      version: 3,
      year: Number(year),
      monthIndex: Number(monthIndex),
      netImposable: 0,
      irf: 0,
      verified: false,
      done: false,
      days: {}
    };
  };

  function normalizeSlot(slotObj) {
    const o = slotObj && typeof slotObj === "object" ? slotObj : {};
    return {
      in: (typeof o.in === "string") ? o.in : "",
      out: (typeof o.out === "string") ? o.out : ""
    };
  }

  const isEmptySlot = (s) => s.in === "" && s.out === "";

  function normalizeSlots(list) {
    return (Array.isArray(list) ? list : []).map(normalizeSlot).filter((s) => !isEmptySlot(s)).slice(0, MAX_SLOTS);
  }

  // Présence d'un enfant un jour ; null si elle ne porte aucune donnée.
  function normalizePresence(raw, id) {
    const c = raw && typeof raw === "object" ? raw : {};
    const p = {
      absent: c.absent === true,
      motif: (typeof c.motif === "string") ? c.motif : "",
      slots: normalizeSlots(c.slots),
      punched: c.punched === true
    };
    if (RELAIS_ID.test(id)) {
      p.relais = true;
      p.name = (typeof c.name === "string") ? c.name.trim() : "";
    }
    if (p.absent) p.slots = [];
    return (p.absent || p.slots.length > 0) ? p : null;
  }

  function normalizeDay(dayObj) {
    const d = dayObj && typeof dayObj === "object" ? dayObj : {};
    const childrenIn = {};

    if (d.slots && typeof d.slots === "object" && !d.children) {
      // v1 : { slots: {"1":{in,out}} } → un créneau par enfant
      Object.keys(d.slots).forEach((k) => { childrenIn[k] = { slots: [d.slots[k]] }; });
    } else if (d.children && typeof d.children === "object") {
      Object.assign(childrenIn, d.children);
    }

    const children = {};
    Object.keys(childrenIn).forEach((rawId) => {
      const id = LEGACY_ID.test(rawId) ? `c${rawId}` : rawId;
      if (!CHILD_ID.test(id) && !RELAIS_ID.test(id)) return; // clé inconnue : ignorée
      const p = normalizePresence(childrenIn[rawId], id);
      if (p) children[id] = p;
    });

    return { off: d.off === true, children, meetings: normalizeSlots(d.meetings) };
  }

  const dayIsEmpty = (day) => !day.off && Object.keys(day.children).length === 0 && day.meetings.length === 0;

  /**
   * Normalise (et migre vers v3) les données d'un mois. Mute et retourne `data`.
   * Le smicOverride mensuel (v1/v2) est abandonné : le SMIC se règle par année.
   */
  S.normalizeMonthData = function normalizeMonthData(data, year, monthIndex) {
    const out = (data && typeof data === "object") ? data : S.blankMonthData(year, monthIndex);

    out.version = 3;
    out.year = Number(out.year);
    out.monthIndex = Number(out.monthIndex);
    if (!Number.isFinite(out.year)) out.year = Number(year);
    if (!Number.isFinite(out.monthIndex)) out.monthIndex = Number(monthIndex);

    out.netImposable = Number(out.netImposable);
    out.irf = Number(out.irf);
    if (!Number.isFinite(out.netImposable)) out.netImposable = 0;
    if (!Number.isFinite(out.irf)) out.irf = 0;

    out.verified = out.verified === true;
    out.done = out.done === true;
    delete out.smicOverride;

    const daysIn = (out.days && typeof out.days === "object") ? out.days : {};
    const daysOut = {};
    Object.keys(daysIn).forEach((isoDate) => {
      const day = normalizeDay(daysIn[isoDate]);
      if (!dayIsEmpty(day)) daysOut[isoDate] = day;
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
      const normalized = S.normalizeMonthData(JSON.parse(raw), year, monthIndex);

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
   * Un mois est « vide » s'il n'a ni montants, ni jour portant une donnée
   * (présence, absence, jour non travaillé, réunion).
   */
  S.isBlankMonth = function isBlankMonth(data) {
    if (!data) return true;
    if (Number(data.netImposable) > 0 || Number(data.irf) > 0) return false;
    const days = (data.days && typeof data.days === "object") ? data.days : {};
    return !Object.keys(days).some((iso) => !dayIsEmpty(normalizeDay(days[iso])));
  };
})();
