/* ============================================================================
   compute/review.js — « Vérifier le mois » et photos de la fiche (sans DOM)
   ----------------------------------------------------------------------------
   - reviewWeeks : les semaines à vérifier (jours déjà passés seulement)
   - sheetView  : quelle moitié de la fiche de présence montrer pour un jour.
     Fiche du CCAS (confirmé le 2026-09-29) : une feuille recto verso avec
     tous les enfants, recto du 1er au 15, verso du 16 à la fin du mois ;
     chaque face coupée en deux (haut / bas).
   - changedDays : jours modifiés pendant la vérification
   - fichesMergePlan : quelles photos reprendre d'une copie (la plus récente gagne)
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.compute = window.ABMAT.compute || {};

  const Compute = window.ABMAT.compute;
  const U = window.ABMAT.utils;

  if (!U) {
    throw new Error("ABMAT.compute : utils doit être chargé avant compute/review.js.");
  }

  /**
   * Semaines à vérifier : jours du lundi au vendredi (et samedis saisis) déjà
   * passés ou d'aujourd'hui. Un mois à venir n'a rien à vérifier.
   * @returns {string[][]} dates ISO groupées par semaine
   */
  Compute.reviewWeeks = function reviewWeeks(year, monthIndex, monthData, todayIso) {
    const weeks = [];
    for (let d = 1; d <= U.daysInMonth(year, monthIndex); d++) {
      const date = new Date(year, monthIndex, d);
      const iso = U.toIsoDate(date);
      const dow = date.getDay();
      if (iso > todayIso) break;
      if (dow === 0 || (dow === 6 && !monthData.days[iso])) continue;
      if (!weeks.length || dow === 1) weeks.push([]);
      weeks[weeks.length - 1].push(iso);
    }
    return weeks.filter((w) => w.length);
  };

  /** Moitié de fiche où se trouve un jour : { page: "recto"|"verso", part: "haut"|"bas" }. */
  Compute.sheetView = function sheetView(iso) {
    const day = U.isoToDate(iso).getDate();
    if (day <= 15) return { page: "recto", part: day <= 8 ? "haut" : "bas" };
    return { page: "verso", part: day <= 23 ? "haut" : "bas" };
  };

  /** Moitié proposée pour une semaine : celle du jour du milieu. */
  Compute.weekSheetView = (week) => Compute.sheetView(week[Math.floor(week.length / 2)]);

  /** Jours dont le contenu diffère entre deux versions (normalisées) d'un mois. */
  Compute.changedDays = function changedDays(before, after) {
    const isos = new Set(Object.keys(before.days).concat(Object.keys(after.days)));
    return Array.from(isos).sort().filter((iso) =>
      JSON.stringify(before.days[iso] || null) !== JSON.stringify(after.days[iso] || null));
  };

  /**
   * Photos à reprendre d'une copie : celles plus récentes que sur l'appareil
   * (une suppression est une version comme une autre : elle gagne si elle est
   * plus récente).
   * @param {Object<string,string>} local - clé "AAAA-MM:recto" → updatedAt
   * @param {Object<string,string>} file
   * @returns {string[]}
   */
  Compute.fichesMergePlan = function fichesMergePlan(local, file) {
    return Object.keys(file).sort().filter((k) => !local[k] || file[k] > local[k]);
  };
})();
