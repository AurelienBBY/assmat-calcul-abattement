/* ============================================================================
   render/format.js — Formats d'affichage en français simple (R.fmt)
   ----------------------------------------------------------------------------
   Heures « 8h30 », durées « 1 h 30 », dates « lundi 29 septembre »,
   « 1er octobre 2026 », mois, semaines types.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  const U = window.ABMAT && window.ABMAT.utils;
  const O = window.ABMAT && window.ABMAT.overtime;

  if (!R || !R.h || !U || !O) {
    throw new Error("render/dom.js, utils.js et overtime.js doivent être chargés avant render/format.js.");
  }

  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const dayNum = (d) => (d.getDate() === 1 ? "1er" : String(d.getDate()));

  /** Minutes depuis minuit → « 8h30 » / « 17h ». */
  function hm(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h${U.pad2(m)}` : `${h}h`;
  }

  /** « 08:30 » → « 8h30 » ; heure manquante → « … ». */
  function time(hhmm) {
    const v = U.parseTimeToMinutes(hhmm);
    return v === null ? "…" : hm(v);
  }

  const slots = (list) => list.map((s) => `${time(s.in)}–${time(s.out)}`).join(", ");

  R.fmt = {
    MONTHS,
    DAYS,
    /** Motifs d'absence (valeurs stockées → libellés). */
    MOTIFS: [["malade", "Malade"], ["conges", "Congés des parents"], ["autre", "Autre"]],
    cap,
    hm,
    time,
    slots,
    dur: O.fmtDuration,
    euro: U.fmtEuro,
    /** Heure du téléphone « HH:MM » et minutes depuis minuit. */
    nowHHMM: (d) => `${U.pad2(d.getHours())}:${U.pad2(d.getMinutes())}`,
    nowMin: (d) => d.getHours() * 60 + d.getMinutes(),
    monthName: (m) => MONTHS[m],
    /** « lundi 29 septembre » */
    dateLong: (iso) => { const d = U.isoToDate(iso); return `${DAYS[d.getDay()]} ${dayNum(d)} ${MONTHS[d.getMonth()]}`; },
    /** « 29 septembre 2026 » */
    dateFr: (iso) => { const d = U.isoToDate(iso); return `${dayNum(d)} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; },
    /** « lun. 8h–17h30 · mar. 8h–12h » (semaine type du profil) */
    week: (week) => ["1", "2", "3", "4", "5"]
      .filter((d) => week[d].in && week[d].out)
      .map((d) => `${DAYS[Number(d)].slice(0, 3)}. ${time(week[d].in)}–${time(week[d].out)}`)
      .join(" · "),
    /** « 2 jours », « 1 jour » */
    plural: (n, one, many) => `${n} ${n > 1 ? (many || one + "s") : one}`
  };
})();
