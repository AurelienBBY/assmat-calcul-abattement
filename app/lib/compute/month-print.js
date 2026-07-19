/* ============================================================================
   compute/month-print.js — Modèle du relevé mensuel imprimable (sans DOM)
   ----------------------------------------------------------------------------
   Prépare, depuis les données v2 d'un mois, tout ce que le gabarit
   d'impression affiche : semaines → jours renseignés → enfants (créneaux,
   heures, abattement, absences), sous-totaux et synthèse.
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.compute = window.ABMAT.compute || {};

  const Compute = window.ABMAT.compute;
  const U = window.ABMAT.utils;
  const C = window.ABMAT.calc;

  if (!U || !C) {
    throw new Error("ABMAT.compute : utils et calc doivent être chargés avant compute/month-print.js.");
  }

  // Entrées "enfant" d'un jour : uniquement les enfants ayant des données.
  function childEntries(dayObj, forfaitJour) {
    const out = [];
    const children = (dayObj && dayObj.children) ? dayObj.children : {};

    for (let i = 1; i <= 3; i++) {
      const key = String(i);
      const c = children[key];
      if (!c) continue;

      const hasData = (c.absent === true) || (Array.isArray(c.slots) && c.slots.length > 0);
      if (!hasData) continue;

      const r = C.computeChildDay(c, forfaitJour);
      out.push({
        key,
        absent: c.absent === true,
        motif: (typeof c.motif === "string") ? c.motif : "",
        slots: (Array.isArray(c.slots) ? c.slots : []).map((s) => ({
          in: (s && typeof s.in === "string") ? s.in : "",
          out: (s && typeof s.out === "string") ? s.out : ""
        })),
        status: r.status,
        hours: r.hours,
        abatt: r.abatt
      });
    }
    return out;
  }

  /**
   * Modèle imprimable d'un mois.
   * @returns {{year, monthIndex, weeks:[{start,end,days:[…],subtotal}], totals:{…}}}
   */
  Compute.buildMonthPrintModel = function buildMonthPrintModel(year, monthIndex, data, forfaitJour) {
    const days = (data && data.days) ? data.days : {};
    const holidays = U.getFrenchHolidays(year);
    const totalDays = U.daysInMonth(year, monthIndex);

    const weeks = [];
    let currentWeek = null;
    let joursGarde = 0;
    let j_lt8 = 0;
    let j_ge8 = 0;
    let monthAbatt = 0;

    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, monthIndex, d);
      if (U.isWeekend(dateObj)) continue;

      // Nouvelle semaine : lundi, ou premier jour ouvré du mois
      if (!currentWeek || dateObj.getDay() === 1) {
        currentWeek = { start: U.toIsoDate(dateObj), end: U.toIsoDate(dateObj), days: [], subtotal: 0 };
        weeks.push(currentWeek);
      }
      currentWeek.end = U.toIsoDate(dateObj);

      const iso = U.toIsoDate(dateObj);
      const entries = childEntries(days[iso], forfaitJour);
      if (entries.length === 0) continue; // le relevé n'imprime que les jours renseignés

      const dayAbatt = U.round2(entries.reduce((s, e) => s + (e.status === "ok" ? e.abatt : 0), 0));
      let dayHasGarde = false;
      entries.forEach((e) => {
        if (e.status !== "ok") return;
        dayHasGarde = true;
        if (e.hours >= 8) j_ge8 += 1;
        else j_lt8 += 1;
      });
      if (dayHasGarde) joursGarde += 1;

      const weekdayShort = dateObj.toLocaleDateString("fr-FR", { weekday: "short" });
      currentWeek.days.push({
        iso,
        label: `${weekdayShort.charAt(0).toUpperCase() + weekdayShort.slice(1)} ${U.pad2(d)}/${U.pad2(monthIndex + 1)}`,
        ferie: holidays[iso] || null,
        children: entries,
        dayTotal: dayAbatt
      });
      currentWeek.subtotal = U.round2(currentWeek.subtotal + dayAbatt);
      monthAbatt = U.round2(monthAbatt + dayAbatt);
    }

    const net = Number.isFinite(Number(data && data.netImposable)) ? Number(data.netImposable) : 0;
    const irf = Number.isFinite(Number(data && data.irf)) ? Number(data.irf) : 0;
    const percu = U.round2(net + irf);

    return {
      year: Number(year),
      monthIndex: Number(monthIndex),
      weeks: weeks.filter((w) => w.days.length > 0),
      totals: {
        net,
        irf,
        percu,
        abatt: monthAbatt,
        imposable: Math.max(0, U.round2(percu - monthAbatt)),
        joursGarde,
        j_lt8,
        j_ge8
      }
    };
  };
})();
