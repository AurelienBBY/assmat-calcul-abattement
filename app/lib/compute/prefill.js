/* ============================================================================
   compute/prefill.js — Horaires habituels → jours du mois (schéma v3)
   ----------------------------------------------------------------------------
   - buildMonthDaysFromProfile : pré-remplissage d'un mois vide (jours ouvrés,
     fériés exclus, enfants accueillis à la date, période d'horaires en
     vigueur). Action volontaire de l'utilisatrice, jamais automatique.
   - rescheduleMonth : report d'un changement d'horaires ou de dates d'un
     enfant sur un mois déjà rempli, sans jamais toucher un jour pointé,
     modifié à la main, non travaillé, ni un mois terminé.
   Pur et sans DOM.
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.compute = window.ABMAT.compute || {};

  const Compute = window.ABMAT.compute;
  const U = window.ABMAT.utils;

  if (!U || !Compute.usualSlots) {
    throw new Error("ABMAT.compute : utils et compute/children.js doivent être chargés avant compute/prefill.js.");
  }

  const presence = (slots) => ({ absent: false, motif: "", slots, punched: false });
  const dayIsEmpty = (day) => !day.off && Object.keys(day.children).length === 0 && day.meetings.length === 0;

  // Jours ouvrés non fériés du mois, au format ISO.
  function workingDays(year, monthIndex) {
    const holidays = U.getFrenchHolidays(year);
    const out = [];
    for (let d = 1; d <= U.daysInMonth(year, monthIndex); d++) {
      const date = new Date(year, monthIndex, d);
      const iso = U.toIsoDate(date);
      if (!U.isWeekend(date) && !holidays[iso]) out.push(iso);
    }
    return out;
  }

  /**
   * Jours d'un mois construits depuis les horaires habituels du profil.
   * @returns {Object} map "YYYY-MM-DD" -> { off, children, meetings }
   */
  Compute.buildMonthDaysFromProfile = function buildMonthDaysFromProfile(year, monthIndex, profile) {
    const days = {};
    if (!profile) return days;

    workingDays(year, monthIndex).forEach((iso) => {
      const children = {};
      profile.children.forEach((child) => {
        const slots = Compute.usualSlots(child, iso);
        if (slots.length) children[child.id] = presence(slots);
      });
      if (Object.keys(children).length) days[iso] = { off: false, children, meetings: [] };
    });

    return days;
  };

  /**
   * Reporte sur un mois déjà rempli le changement d'un enfant (horaires ou
   * dates d'accueil) : `before` et `after` sont le même enfant avant/après.
   * Seuls les jours à partir de `fromIso` encore « comme d'habitude » pour cet
   * enfant changent. Mute monthData.days.
   * @returns {number} nombre de jours modifiés
   */
  Compute.rescheduleMonth = function rescheduleMonth(monthData, before, after, fromIso) {
    if (before.id !== after.id) {
      throw new Error("rescheduleMonth : before et after doivent être le même enfant.");
    }
    const days = monthData.days;
    // Mois terminé : intouchable. Mois pas encore commencé : le pré-remplissage s'en chargera.
    if (monthData.done === true || Object.keys(days).length === 0) return 0;

    let changed = 0;
    workingDays(monthData.year, monthData.monthIndex).forEach((iso) => {
      if (iso < fromIso) return;
      const day = days[iso];
      if (day && day.off) return;
      const oldSlots = Compute.usualSlots(before, iso);
      const newSlots = Compute.usualSlots(after, iso);
      if (Compute.sameSlots(oldSlots, newSlots)) return;
      const entry = day ? day.children[before.id] : null;

      if (entry) {
        // Pointé, absent ou modifié à la main : c'est ce qui s'est passé, on n'y touche pas.
        if (entry.punched || entry.absent || !Compute.sameSlots(entry.slots, oldSlots)) return;
        if (newSlots.length) {
          entry.slots = newSlots;
        } else {
          delete day.children[before.id];
          if (dayIsEmpty(day)) delete days[iso];
        }
        changed++;
      } else if (oldSlots.length === 0 && newSlots.length > 0) {
        const target = day || (days[iso] = { off: false, children: {}, meetings: [] });
        target.children[before.id] = presence(newSlots);
        changed++;
      }
    });
    return changed;
  };
})();
