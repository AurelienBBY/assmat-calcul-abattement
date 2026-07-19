/* ============================================================================
   compute/year-recap.js — Agrégats du récapitulatif annuel
   ----------------------------------------------------------------------------
   Relit les 12 mois depuis le storage et recalcule avec calc.js :
   - abattement réel du mois (forfait de l'année, smicOverride du mois)
   - compteurs de jours-enfant (< 8 h / ≥ 8 h)
   - statut du mois (vide / incomplet / ok)
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.compute = window.ABMAT.compute || {};

  const Compute = window.ABMAT.compute;
  const U = window.ABMAT.utils;
  const C = window.ABMAT.calc;
  const S = window.ABMAT.storage;

  if (!U || !C || !S) {
    throw new Error("ABMAT.compute : utils, calc et storage doivent être chargés avant compute/year-recap.js.");
  }

  /**
   * Forfait journalier applicable à un mois :
   * smicOverride du mois s'il existe, sinon SMIC de l'année (config).
   * Retourne 0 si aucun SMIC n'est connu (année absente du barème, pas d'override).
   *
   * @param {number} year
   * @param {Object} data - données du mois (storage)
   * @returns {number}
   */
  function forfaitJourForMonth(year, data) {
    const CFG = window.ABMAT_CONFIG;
    if (!CFG) {
      throw new Error("ABMAT.compute : ABMAT_CONFIG est requis (charger config.js en premier).");
    }

    const override = (data && typeof data.smicOverride === "number" && Number.isFinite(data.smicOverride))
      ? data.smicOverride
      : null;
    const smic = (override !== null) ? override : CFG.getSmicHoraireBrut(year);
    if (typeof smic !== "number" || !Number.isFinite(smic)) return 0;

    return CFG.computeForfaitJourFromSmic(smic, CFG.coefficient);
  }

  /**
   * Compte les jours-enfant du mois (un enfant présent un jour = un jour-enfant,
   * quel que soit son nombre de créneaux), ventilés < 8 h / ≥ 8 h.
   *
   * @param {Object} days - map "YYYY-MM-DD" -> { children }
   * @returns {{j_lt8:number, j_ge8:number}}
   */
  function countChildDays(days) {
    let j_lt8 = 0;
    let j_ge8 = 0;

    const d = (days && typeof days === "object") ? days : {};
    Object.keys(d).forEach((isoDate) => {
      const children = (d[isoDate] && d[isoDate].children) ? d[isoDate].children : {};
      for (let i = 1; i <= 3; i++) {
        const r = C.computeChildDay(children[String(i)], 0);
        if (r.status !== "ok") continue;
        if (r.hours >= 8) j_ge8 += 1;
        else j_lt8 += 1;
      }
    });

    return { j_lt8, j_ge8 };
  }

  /**
   * Récap d'un mois : montants saisis, abattement recalculé, jours, statut.
   *
   * @param {number} year
   * @param {number} monthIndex - 0..11
   */
  Compute.computeMonthRecap = function computeMonthRecap(year, monthIndex) {
    const data = S.loadMonth(year, monthIndex).data;

    const net = Number.isFinite(Number(data.netImposable)) ? Number(data.netImposable) : 0;
    const irf = Number.isFinite(Number(data.irf)) ? Number(data.irf) : 0;
    const percu = U.round2(net + irf);

    const forfaitJour = forfaitJourForMonth(year, data);
    const abatt = C.computeMonthTotal(data.days, forfaitJour).monthTotal;
    const imposable = Math.max(0, U.round2(percu - abatt));

    const days = countChildDays(data.days);
    const hasMoney = (net > 0) || (irf > 0);
    const hasDays = (days.j_lt8 + days.j_ge8) > 0;

    let status = "vide";
    if (hasMoney && hasDays) status = "ok";
    else if (hasMoney || hasDays) status = "incomplet";

    return {
      monthIndex,
      net,
      irf,
      percu,
      abatt,
      imposable,
      j_lt8: days.j_lt8,
      j_ge8: days.j_ge8,
      status
    };
  };

  /**
   * Récap des 12 mois d'une année + totaux.
   *
   * @param {number} year
   * @returns {{year:number, totals:Object, months:Array}}
   */
  Compute.computeYearRecap = function computeYearRecap(year) {
    const y = Number(year);
    const months = [];
    const totals = { net: 0, irf: 0, percu: 0, abatt: 0, imposable: 0, j_lt8: 0, j_ge8: 0 };

    for (let m = 0; m < 12; m++) {
      const rec = Compute.computeMonthRecap(y, m);
      months.push(rec);

      totals.net = U.round2(totals.net + rec.net);
      totals.irf = U.round2(totals.irf + rec.irf);
      totals.percu = U.round2(totals.percu + rec.percu);
      totals.abatt = U.round2(totals.abatt + rec.abatt);
      totals.imposable = U.round2(totals.imposable + rec.imposable);
      totals.j_lt8 += rec.j_lt8;
      totals.j_ge8 += rec.j_ge8;
    }

    return { year: y, totals, months };
  };
})();
