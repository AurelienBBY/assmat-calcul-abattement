/* ============================================================================
   compute/year-recap.js — Agrégats du récapitulatif annuel
   ----------------------------------------------------------------------------
   Relit les 12 mois depuis le storage et recalcule avec calc.js :
   - abattement réel du mois (forfait de l'année : un seul SMIC par année)
   - compteurs de jours-enfant (< 8 h / ≥ 8 h)
   - statut du mois (vide / incomplet / ok)
   Le revenu imposable (case 1AJ) est ANNUEL : total perçu − abattement de
   l'année, plancher à 0 appliqué une seule fois. Le solde d'un mois
   (`apres`) peut être négatif : il se déduit alors des autres mois.
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

  const CFG = window.ABMAT_CONFIG;
  if (!CFG) {
    throw new Error("ABMAT.compute : ABMAT_CONFIG est requis (charger config.js en premier).");
  }

  /**
   * SMIC horaire brut au 1er janvier retenu pour une année : réglage de
   * l'année s'il existe, sinon barème de config.js, sinon null (« SMIC
   * manquant » : l'interface le signale, aucun abattement n'est inventé).
   * @returns {number|null}
   */
  Compute.smicForYear = function smicForYear(year) {
    const settings = S.loadYearSettings(year);
    return (settings.smic !== null) ? settings.smic : CFG.getSmicHoraireBrut(year);
  };

  /** Forfait journalier par enfant (3 × SMIC) de l'année, ou null. */
  Compute.forfaitJourForYear = function forfaitJourForYear(year) {
    const smic = Compute.smicForYear(year);
    return (smic === null) ? null : CFG.computeForfaitJourFromSmic(smic, CFG.coefficient);
  };

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
      if (d[isoDate].off === true) return;
      const children = d[isoDate].children || {};
      Object.keys(children).forEach((id) => {
        const r = C.computeChildDay(children[id], 0);
        if (r.status !== "ok") return;
        if (r.hours >= 8) j_ge8 += 1;
        else j_lt8 += 1;
      });
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

    const forfaitJour = Compute.forfaitJourForYear(year);
    // SMIC manquant : pas d'abattement inventé, le drapeau smicMissing le signale.
    const abatt = (forfaitJour === null) ? 0 : C.computeMonthTotal(data.days, forfaitJour).monthTotal;
    const apres = U.round2(percu - abatt); // négatif si l'abattement dépasse le perçu du mois

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
      apres,
      j_lt8: days.j_lt8,
      j_ge8: days.j_ge8,
      status,
      smicMissing: forfaitJour === null
    };
  };

  /**
   * Récap des 12 mois d'une année + totaux.
   * totals.imposable = max(0, perçu annuel − abattement annuel) : montant de
   * la case 1AJ. Jamais la somme de mois plafonnés à 0 (cela perdrait
   * l'abattement des mois où il dépasse le perçu).
   *
   * @param {number} year
   * @returns {{year:number, totals:Object, months:Array}}
   */
  Compute.computeYearRecap = function computeYearRecap(year) {
    const y = Number(year);
    const months = [];
    const totals = { net: 0, irf: 0, percu: 0, abatt: 0, apres: 0, imposable: 0, j_lt8: 0, j_ge8: 0 };

    for (let m = 0; m < 12; m++) {
      const rec = Compute.computeMonthRecap(y, m);
      months.push(rec);

      totals.net = U.round2(totals.net + rec.net);
      totals.irf = U.round2(totals.irf + rec.irf);
      totals.percu = U.round2(totals.percu + rec.percu);
      totals.abatt = U.round2(totals.abatt + rec.abatt);
      totals.apres = U.round2(totals.apres + rec.apres);
      totals.j_lt8 += rec.j_lt8;
      totals.j_ge8 += rec.j_ge8;
    }

    totals.imposable = Math.max(0, totals.apres);
    totals.smicMissing = Compute.forfaitJourForYear(y) === null;
    return { year: y, totals, months };
  };
})();
