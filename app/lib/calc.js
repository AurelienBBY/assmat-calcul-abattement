

/* ============================================================================
   calc.js — Calculs "métier" (sans DOM)
   ----------------------------------------------------------------------------
   Objectif :
   - Centraliser les règles de calcul (heures, abattement, totaux)
   - Garder un code testable et indépendant de l’UI
   ----------------------------------------------------------------------------
   Rappels (schéma v3) :
   - Abattement calculé par enfant ET par jour ; enfants identifiés par id
     (c1, c2… ou r1… pour l'accueil relais), sans limite de nombre
   - Jour non travaillé (off) : aucun abattement
   - Un enfant peut avoir plusieurs créneaux dans la journée : les heures
     s'additionnent, puis la règle s'applique au TOTAL du jour
   - Si total >= 8h : forfait journalier ; sinon : forfait × (total / 8)
   - Enfant marqué absent : pas d'abattement ce jour-là
   - Créneau incohérent (sortie <= entrée, format invalide d'un côté) :
     l'enfant-jour entier est invalide (⚠︎ côté UI)
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.calc = window.ABMAT.calc || {};

  const C = window.ABMAT.calc;
  const U = window.ABMAT.utils;

  if (!U) {
    throw new Error("ABMAT.utils est requis avant ABMAT.calc (charger utils.js en premier).");
  }

  /**
   * Durée d'un créneau en heures (non arrondie).
   *
   * @param {string} inStr  - "HH:MM" (entrée)
   * @param {string} outStr - "HH:MM" (sortie)
   * @returns {{status:"empty"|"invalid"|"ok", hours:number}}
   */
  C.computeSlotHours = function computeSlotHours(inStr, outStr) {
    const inMin = U.parseTimeToMinutes(inStr);
    const outMin = U.parseTimeToMinutes(outStr);

    // vide complet → pas de valeur
    if (inMin === null && outMin === null) {
      return { status: "empty", hours: 0 };
    }

    // incomplet / invalide
    if (inMin === null || outMin === null || outMin <= inMin) {
      return { status: "invalid", hours: 0 };
    }

    return { status: "ok", hours: (outMin - inMin) / 60 };
  };

  /**
   * Heures et abattement d'un enfant sur une journée (schéma v2).
   * Les créneaux s'additionnent ; la règle >= 8h s'applique au total.
   *
   * @param {Object} childObj - {absent:boolean, motif:string, slots:[{in,out}]}
   * @param {number} forfaitJour - forfait journalier par enfant
   * @returns {{status:"empty"|"absent"|"invalid"|"ok", hours:number, abatt:number}}
   */
  C.computeChildDay = function computeChildDay(childObj, forfaitJour) {
    const c = (childObj && typeof childObj === "object") ? childObj : {};

    if (c.absent === true) {
      return { status: "absent", hours: 0, abatt: 0 };
    }

    const slots = Array.isArray(c.slots) ? c.slots : [];
    let totalRaw = 0;
    let filled = 0;
    let invalid = false;

    slots.forEach((s) => {
      const slot = (s && typeof s === "object") ? s : {};
      const r = C.computeSlotHours(slot.in || "", slot.out || "");
      if (r.status === "empty") return;
      filled += 1;
      if (r.status === "invalid") {
        invalid = true;
        return;
      }
      totalRaw += r.hours;
    });

    if (invalid) return { status: "invalid", hours: 0, abatt: 0 };
    if (filled === 0) return { status: "empty", hours: 0, abatt: 0 };

    const abatt = (totalRaw >= 8) ? forfaitJour : forfaitJour * (totalRaw / 8);
    return { status: "ok", hours: U.round2(totalRaw), abatt: U.round2(abatt) };
  };

  /**
   * Total d'abattement d'une journée : tous les enfants présents ce jour-là.
   *
   * @param {Object} dayObj - {off, children:{"c1":{...}, "r1":{...}}}
   * @param {number} forfaitJour
   * @returns {{dayTotal:number, perChild:Object}}
   */
  C.computeDayTotal = function computeDayTotal(dayObj, forfaitJour) {
    if (dayObj && dayObj.off === true) return { dayTotal: 0, perChild: {} };

    const children = (dayObj && dayObj.children && typeof dayObj.children === "object")
      ? dayObj.children
      : {};

    const perChild = {};
    let dayTotal = 0;

    Object.keys(children).forEach((key) => {
      const r = C.computeChildDay(children[key], forfaitJour);
      perChild[key] = r;
      if (r.status === "ok") dayTotal += r.abatt;
    });

    return { dayTotal: U.round2(dayTotal), perChild };
  };

  /**
   * Nombre maximum d'enfants présents en même temps dans la journée (agrément :
   * cf. ABMAT_CONFIG.maxChildrenAtOnce). Un départ et une arrivée à la même
   * minute ne se chevauchent pas. Absents et créneaux invalides ignorés.
   *
   * @param {Object} dayObj
   * @returns {number}
   */
  C.maxSimultaneous = function maxSimultaneous(dayObj) {
    if (!dayObj || dayObj.off === true) return 0;
    const children = (dayObj.children && typeof dayObj.children === "object") ? dayObj.children : {};
    const events = [];
    Object.keys(children).forEach((key) => {
      const c = children[key];
      if (!c || c.absent === true) return;
      (Array.isArray(c.slots) ? c.slots : []).forEach((s) => {
        const a = U.parseTimeToMinutes(s && s.in);
        const b = U.parseTimeToMinutes(s && s.out);
        if (a === null || b === null || b <= a) return;
        events.push([a, 1], [b, -1]);
      });
    });
    events.sort((x, y) => (x[0] - y[0]) || (x[1] - y[1])); // départs avant arrivées
    let current = 0;
    let max = 0;
    events.forEach(([, delta]) => { current += delta; max = Math.max(max, current); });
    return max;
  };

  /**
   * Total d'abattement du mois.
   *
   * @param {Object} daysMap - ex: {"2026-01-05":{children:{...}}, ...}
   * @param {number} forfaitJour
   * @returns {{monthTotal:number, perDay:Object}}
   */
  C.computeMonthTotal = function computeMonthTotal(daysMap, forfaitJour) {
    const perDay = {};
    let monthTotal = 0;

    const d = (daysMap && typeof daysMap === "object") ? daysMap : {};

    Object.keys(d).forEach((isoDate) => {
      const r = C.computeDayTotal(d[isoDate], forfaitJour);
      perDay[isoDate] = r.dayTotal;
      monthTotal += r.dayTotal;
    });

    return { monthTotal: U.round2(monthTotal), perDay };
  };
})();
