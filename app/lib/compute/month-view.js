/* ============================================================================
   compute/month-view.js — Calendrier du mois : états et actions (sans DOM)
   ----------------------------------------------------------------------------
   - dayState : l'état d'un jour tel que le calendrier l'affiche (habituel,
     modifié, pointé, non travaillé, férié, à venir, aujourd'hui…)
   - buildCalendar : semaines lun → ven (+ samedis portant une donnée)
   - monthProgress : ce qu'il reste à faire pour le mois (3 étapes)
   - setDayUsual / setDayOff / setWeekOff : actions de masse sur un mois
   « Habituel » = conforme aux horaires en vigueur du profil (compute/children).
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.compute = window.ABMAT.compute || {};

  const Compute = window.ABMAT.compute;
  const U = window.ABMAT.utils;

  if (!U || !Compute.usualSlots || !Compute.childLabel) {
    throw new Error("ABMAT.compute : utils et compute/children.js doivent être chargés avant compute/month-view.js.");
  }

  const hm = (t) => { const v = U.parseTimeToMinutes(t); if (v === null) return "…"; const h = Math.floor(v / 60); const m = v % 60; return m ? `${h}h${U.pad2(m)}` : `${h}h`; };
  const slotsText = (slots) => slots.map((s) => `${hm(s.in)}–${hm(s.out)}`).join(", ");

  // Horaires habituels d'un enfant ce jour-là (aucun un jour férié).
  function usualOn(profile, id, iso, holidays) {
    if (holidays[iso]) return [];
    const child = profile.children.find((c) => c.id === id);
    return child ? Compute.usualSlots(child, iso) : [];
  }

  /** Journée conforme aux horaires habituels ? (réunions non prises en compte) */
  Compute.dayDiffers = function dayDiffers(iso, day, profile, holidays) {
    if (day.off === true) return true;
    const ids = Object.keys(day.children);
    const changed = ids.some((id) => {
      const p = day.children[id];
      return p.relais === true || p.absent === true || !Compute.sameSlots(p.slots, usualOn(profile, id, iso, holidays));
    });
    const missing = profile.children.some((c) => !ids.includes(c.id) && usualOn(profile, c.id, iso, holidays).length > 0);
    return changed || missing;
  };

  /**
   * État d'un jour pour le calendrier.
   * @returns {"empty"|"ferie"|"off"|"today"|"punched"|"future"|"modified"|"usual"}
   */
  Compute.dayState = function dayState(iso, day, profile, todayIso, holidays) {
    if (!day) return holidays[iso] ? "ferie" : "empty";
    if (day.off === true) return "off";
    if (iso === todayIso) return "today";
    if (Object.keys(day.children).some((id) => day.children[id].punched === true)) return "punched";
    if (iso > todayIso) return "future";
    return Compute.dayDiffers(iso, day, profile, holidays) ? "modified" : "usual";
  };

  function cell(iso, day, profile, todayIso, holidays) {
    const state = Compute.dayState(iso, day, profile, todayIso, holidays);
    const lines = [];
    if (day && !day.off) {
      Object.keys(day.children).sort(Compute.compareChildIds).forEach((id) => {
        const p = day.children[id];
        const label = Compute.childLabel(profile, id, p);
        const changed = p.relais === true || !Compute.sameSlots(p.slots, usualOn(profile, id, iso, holidays));
        if (p.absent) lines.push({ id, label, text: "absence", kind: "absent" });
        else lines.push({ id, label, text: slotsText(p.slots), kind: p.relais ? "relais" : (changed ? "changed" : "usual") });
      });
    }
    return { iso, dayNumber: U.isoToDate(iso).getDate(), state, ferie: holidays[iso] || null, lines,
      meeting: Boolean(day && day.meetings.length) };
  }

  /**
   * Semaines du mois (lundi → vendredi), plus les samedis qui portent une donnée
   * (réunion un jour sans enfant).
   * @returns {{weeks:Array<{isos:string[], cells:Array, allOff:boolean, hasDays:boolean}>, saturdays:Array}}
   */
  Compute.buildCalendar = function buildCalendar(year, monthIndex, monthData, profile, todayIso) {
    const holidays = U.getFrenchHolidays(year);
    const weeks = [];
    const saturdays = [];
    for (let d = 1; d <= U.daysInMonth(year, monthIndex); d++) {
      const date = new Date(year, monthIndex, d);
      const iso = U.toIsoDate(date);
      const dow = date.getDay();
      if (dow === 6 && monthData.days[iso]) saturdays.push(cell(iso, monthData.days[iso], profile, todayIso, holidays));
      if (dow === 0 || dow === 6) continue;
      if (!weeks.length || dow === 1) weeks.push({ isos: [], cells: [] });
      const week = weeks[weeks.length - 1];
      week.isos.push(iso);
      week.cells.push(cell(iso, monthData.days[iso], profile, todayIso, holidays));
    }
    weeks.forEach((w) => {
      const withDays = w.isos.filter((iso) => monthData.days[iso]);
      w.hasDays = withDays.length > 0;
      w.allOff = w.hasDays && withDays.every((iso) => monthData.days[iso].off === true);
    });
    return { weeks, saturdays };
  };

  /**
   * Où en est le mois : jours à vérifier, fiche de paie, état global.
   * @returns {{toVerify:number, payDone:boolean, status:"future"|"empty"|"check"|"pay"|"ready"|"done"}}
   */
  Compute.monthProgress = function monthProgress(monthData, profile, todayIso) {
    const holidays = U.getFrenchHolidays(monthData.year);
    const isos = Object.keys(monthData.days);
    const toVerify = isos.filter((iso) => {
      const s = Compute.dayState(iso, monthData.days[iso], profile, todayIso, holidays);
      return s === "modified" || s === "off";
    }).length;
    const payDone = monthData.netImposable > 0;
    const firstIso = `${monthData.year}-${U.pad2(monthData.monthIndex + 1)}-01`;
    let status;
    if (monthData.done) status = "done";
    else if (!isos.length && !payDone) status = (firstIso > todayIso) ? "future" : "empty";
    else if (!monthData.verified) status = "check";
    else if (!payDone) status = "pay";
    else status = "ready";
    return { toVerify, payDone, status };
  };

  /** Journée habituelle (horaires en vigueur) ; réunions conservées. */
  Compute.setDayUsual = function setDayUsual(monthData, iso, profile) {
    const holidays = U.getFrenchHolidays(monthData.year);
    const meetings = monthData.days[iso] ? monthData.days[iso].meetings : [];
    const children = {};
    profile.children.forEach((c) => {
      const slots = usualOn(profile, c.id, iso, holidays);
      if (slots.length) children[c.id] = { absent: false, motif: "", slots, punched: false };
    });
    if (Object.keys(children).length || meetings.length) monthData.days[iso] = { off: false, children, meetings };
    else delete monthData.days[iso];
  };

  /** « Je n'ai pas travaillé » (off=true) ou retour à la journée habituelle. */
  Compute.setDayOff = function setDayOff(monthData, iso, off, profile) {
    if (off) monthData.days[iso] = { off: true, children: {}, meetings: [] };
    else Compute.setDayUsual(monthData, iso, profile);
  };

  /** Semaine de congés : chaque jour prévu (habituel ou saisi) devient non travaillé. */
  Compute.setWeekOff = function setWeekOff(monthData, isos, off, profile) {
    const holidays = U.getFrenchHolidays(monthData.year);
    isos.forEach((iso) => {
      if (off) {
        const planned = monthData.days[iso] || profile.children.some((c) => usualOn(profile, c.id, iso, holidays).length);
        if (planned) Compute.setDayOff(monthData, iso, true, profile);
      } else if (monthData.days[iso] && monthData.days[iso].off) {
        Compute.setDayOff(monthData, iso, false, profile);
      }
    });
  };
})();
