/* ============================================================================
   compute/prefill.js — Pré-remplissage d'un mois depuis les semaines types
   ----------------------------------------------------------------------------
   Construit les jours d'un mois (schéma v2) à partir du profil : pour chaque
   jour ouvré non férié, applique le créneau type de chaque enfant actif.
   Pur et sans DOM — le pré-remplissage reste une action volontaire de
   l'utilisatrice (jamais automatique).
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.compute = window.ABMAT.compute || {};

  const Compute = window.ABMAT.compute;
  const U = window.ABMAT.utils;

  if (!U) {
    throw new Error("ABMAT.compute : utils doit être chargé avant compute/prefill.js.");
  }

  /**
   * Au moins un enfant actif a-t-il un créneau dans sa semaine type ?
   */
  Compute.profileHasTemplates = function profileHasTemplates(profile) {
    if (!profile || !profile.children) return false;
    return ["1", "2", "3"].some((k) => {
      const c = profile.children[k];
      if (!c || c.active === false || !c.week) return false;
      return ["1", "2", "3", "4", "5"].some((d) => {
        const t = c.week[d];
        return t && t.in && t.out;
      });
    });
  };

  /**
   * Jours d'un mois construits depuis les semaines types.
   * Jours ouvrés uniquement, fériés exclus, enfants inactifs ignorés.
   *
   * @returns {Object} map "YYYY-MM-DD" -> { children } (schéma v2)
   */
  Compute.buildMonthDaysFromProfile = function buildMonthDaysFromProfile(year, monthIndex, profile) {
    const days = {};
    if (!profile || !profile.children) return days;

    const holidays = U.getFrenchHolidays(year);
    const totalDays = U.daysInMonth(year, monthIndex);

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, monthIndex, d);
      if (U.isWeekend(date)) continue;

      const iso = U.toIsoDate(date);
      if (holidays[iso]) continue; // un férié ne se pré-remplit pas

      const dow = String(date.getDay()); // 1=lundi … 5=vendredi
      const children = {};

      for (let k = 1; k <= 3; k++) {
        const key = String(k);
        const c = profile.children[key];
        if (!c || c.active === false) continue;
        const t = c.week && c.week[dow];
        if (!t || !t.in || !t.out) continue;
        children[key] = { absent: false, motif: "", slots: [{ in: t.in, out: t.out }] };
      }

      if (Object.keys(children).length > 0) {
        days[iso] = { children };
      }
    }

    return days;
  };
})();
