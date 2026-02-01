

/* ============================================================================
   calc.js — Calculs "métier" (sans DOM)
   ----------------------------------------------------------------------------
   Objectif :
   - Centraliser les règles de calcul (heures, abattement, totaux)
   - Garder un code testable et indépendant de l’UI
   ----------------------------------------------------------------------------
   Rappels :
   - Abattement calculé par enfant ET par jour
   - Si durée >= 8h : forfait journalier
   - Si durée < 8h : forfait × (durée / 8)
   - Cases vides : pas de valeur
   - Entrée/sortie incohérentes : invalide (⚠︎ côté UI)
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
   * Calcule les heures + l’abattement pour un slot (un enfant sur une journée).
   *
   * @param {string} inStr  - "HH:MM" (entrée)
   * @param {string} outStr - "HH:MM" (sortie)
   * @param {number} forfaitJour - forfait journalier par enfant (>=8h)
   * @returns {{status:"empty"|"invalid"|"ok", hours:number, abatt:number}}
   */
  C.computeHoursAndAbattForSlot = function computeHoursAndAbattForSlot(inStr, outStr, forfaitJour) {
    const inMin = U.parseTimeToMinutes(inStr);
    const outMin = U.parseTimeToMinutes(outStr);

    // vide complet → pas de valeur
    if (inMin === null && outMin === null) {
      return { status: "empty", hours: 0, abatt: 0 };
    }

    // incomplet / invalide
    if (inMin === null || outMin === null || outMin <= inMin) {
      return { status: "invalid", hours: 0, abatt: 0 };
    }

    const hoursRaw = (outMin - inMin) / 60;
    const hours = U.round2(hoursRaw);

    let abatt = 0;
    if (hoursRaw >= 8) {
      abatt = forfaitJour;
    } else {
      abatt = forfaitJour * (hoursRaw / 8);
    }

    return { status: "ok", hours, abatt: U.round2(abatt) };
  };

  /**
   * Calcule le total d’abattement d’une journée (somme de 3 enfants max).
   *
   * @param {Object} slots - ex: {"1":{in:"08:00",out:"12:00"},"2":{...},"3":{...}}
   * @param {number} forfaitJour
   * @returns {{dayTotal:number, perSlot:Object}}
   */
  C.computeDayTotal = function computeDayTotal(slots, forfaitJour) {
    const perSlot = {};
    let dayTotal = 0;

    const s = slots && typeof slots === "object" ? slots : {};

    for (let i = 1; i <= 3; i++) {
      const key = String(i);
      const item = s[key] || {};
      const r = C.computeHoursAndAbattForSlot(item.in || "", item.out || "", forfaitJour);

      perSlot[key] = r;

      if (r.status === "ok") {
        dayTotal += r.abatt;
      }
    }

    return { dayTotal: U.round2(dayTotal), perSlot };
  };

  /**
   * Calcule le total d’abattement du mois.
   *
   * @param {Object} daysMap - ex: {"2025-01-02":{slots:{...}}, ...}
   * @param {number} forfaitJour
   * @returns {{monthTotal:number, perDay:Object}}
   */
  C.computeMonthTotal = function computeMonthTotal(daysMap, forfaitJour) {
    const perDay = {};
    let monthTotal = 0;

    const d = daysMap && typeof daysMap === "object" ? daysMap : {};

    Object.keys(d).forEach((isoDate) => {
      const dayObj = d[isoDate] || {};
      const slots = dayObj.slots || {};
      const r = C.computeDayTotal(slots, forfaitJour);
      perDay[isoDate] = r.dayTotal;
      monthTotal += r.dayTotal;
    });

    return { monthTotal: U.round2(monthTotal), perDay };
  };
})();