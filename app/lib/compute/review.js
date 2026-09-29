/* ============================================================================
   compute/review.js — « Vérifier le mois » et photos de la fiche (sans DOM)
   ----------------------------------------------------------------------------
   Fiche du CCAS (vue sur une vraie fiche le 2026-09-29) : une feuille recto
   verso avec tous les enfants, un jour par colonne, recto du 1er au 15,
   verso du 16 à la fin du mois ; par enfant, une ligne A (arrivée) et une
   ligne D (départ) avec les heures réelles, à la minute.
   - reviewWeeks : les semaines à vérifier (jours déjà passés seulement)
   - weekPage, weekFocus : quelle face, et quelles colonnes zoomer
   - reviewGrid : la semaine disposée comme la fiche, avec les cases où
     quelques minutes changent le calcul
   - changedDays : jours modifiés pendant la vérification
   - fichesMergePlan : quelles photos reprendre d'une copie (la plus récente gagne)
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.compute = window.ABMAT.compute || {};

  const Compute = window.ABMAT.compute;
  const U = window.ABMAT.utils;
  const O = window.ABMAT.overtime;
  const CFG = window.ABMAT_CONFIG;

  if (!U || !O || !CFG || !CFG.attendanceSheet) {
    throw new Error("ABMAT.compute : config.js, utils et overtime.js doivent être chargés avant compute/review.js.");
  }

  // Sous 8 h 15 de présence prévue, quelques minutes de moins font passer
  // sous 8 h (prorata) : ces cases se vérifient à la minute.
  const MINUTES_MATTER = 8 * 60 + 15;
  // Journée à moins de 30 min du seuil des heures sup. : idem.
  const NEAR_OVERTIME = 30;

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

  /** Face de la fiche d'une semaine : celle de son jour du milieu. */
  Compute.weekPage = (week) => (U.isoToDate(week[Math.floor(week.length / 2)]).getDate() <= 15 ? "recto" : "verso");

  /**
   * Partie de la photo redressée à montrer pour une semaine : ses 7 colonnes
   * du lundi au dimanche (un quart de colonne de marge), ramenées dans la
   * face quand la semaine déborde sur l'autre.
   * @param {string[]} week
   * @param {"recto"|"verso"} page
   * @returns {{x0:number, x1:number, y0:number}} fractions de la largeur (x) et de la hauteur (y) de la photo
   */
  Compute.weekFocus = function weekFocus(week, page) {
    const G = CFG.attendanceSheet;
    const n = G.columns[page];
    const first = U.isoToDate(week[0]);
    let c1 = first.getDate() - ((first.getDay() + 6) % 7) - (page === "recto" ? 0 : 15); // colonne du lundi
    let c2 = c1 + 6;
    if (c1 < 1) { c2 += 1 - c1; c1 = 1; }
    if (c2 > n) { c1 = Math.max(1, c1 - (c2 - n)); c2 = n; }
    const col = (G.daysRight - G.daysLeft) / n;
    return { x0: Math.max(0, G.daysLeft + (c1 - 1.25) * col), x1: Math.min(1, G.daysLeft + (c2 + 0.25) * col), y0: G.tableTop };
  };

  function presenceMin(p) {
    let total = 0;
    for (const s of p.slots) {
      const a = U.parseTimeToMinutes(s.in);
      const b = U.parseTimeToMinutes(s.out);
      if (a === null || b === null || b <= a) return null;
      total += b - a;
    }
    return total;
  }

  const presenceOf = (month, iso, id) => {
    const d = month.days[iso];
    return (d && !d.off && d.children[id]) || null;
  };

  /**
   * La semaine disposée comme la fiche : une ligne par enfant (ordre du
   * profil, puis accueils relais), une colonne par jour.
   * @param {string[]} week
   * @param {Object} monthData - le mois maintenant
   * @param {Object} before - le mois au début de la vérification
   * @param {Object} profile
   * @returns {{ids:string[], days:Object<string,{off:boolean, meetings:Array, nearOvertime:boolean}>,
   *   cells:Object<string,Object<string,{presence:Object|null, minutesMatter:boolean, changed:boolean}>>}}
   */
  Compute.reviewGrid = function reviewGrid(week, monthData, before, profile) {
    const seen = new Set();
    week.forEach((iso) => {
      const d = monthData.days[iso];
      if (d && !d.off) Object.keys(d.children).forEach((id) => seen.add(id));
    });
    const order = profile.children.map((c) => c.id);
    const ids = order.filter((id) => seen.has(id)).concat(Array.from(seen).filter((id) => !order.includes(id)).sort());
    const T = CFG.overtime.dailyThresholdMinutes;
    const days = {};
    const cells = {};
    ids.forEach((id) => { cells[id] = {}; });
    week.forEach((iso) => {
      const d = monthData.days[iso] || null;
      const r = d ? O.computeDay(d) : null;
      days[iso] = { off: Boolean(d && d.off), meetings: (d && !d.off) ? d.meetings : [],
        nearOvertime: Boolean(r && r.status === "ok" && !r.meetingOnly && r.totalMin >= T - NEAR_OVERTIME) };
      ids.forEach((id) => {
        const p = presenceOf(monthData, iso, id);
        const min = (p && !p.absent) ? presenceMin(p) : null;
        cells[id][iso] = { presence: p, minutesMatter: min !== null && min < MINUTES_MATTER,
          changed: JSON.stringify(p) !== JSON.stringify(presenceOf(before, iso, id)) };
      });
    });
    return { ids, days, cells };
  };

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
