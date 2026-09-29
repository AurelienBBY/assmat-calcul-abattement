/* ============================================================================
   overtime.js — Heures supplémentaires : calcul et explication (sans DOM)
   ----------------------------------------------------------------------------
   Règle validée (docs/spec-heures-supplementaires.md) :
   - journée « enfants » = de la 1re arrivée au dernier départ, creux compris ;
   - réunions : ajoutées hors de cette plage, sans double compte ni pause
     (union des plages horaires) ;
   - au-delà du seuil (10 h), toute demi-heure commencée est due ;
   - jour sans enfant : toute la durée de la réunion est due (arrondie).
   Un horaire incomplet ou incohérent → « invalid » : jamais de calcul
   silencieux. Pointage en cours (enfant encore là, réunion pas finie) :
   opts.nowMin tient lieu de départ ou de fin.
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  const O = window.ABMAT.overtime = {};
  const U = window.ABMAT.utils;
  const CFG = window.ABMAT_CONFIG;

  if (!U || !CFG || !CFG.overtime) {
    throw new Error("ABMAT.overtime : config.js (overtime) et utils.js doivent être chargés avant overtime.js.");
  }

  const T = () => CFG.overtime.dailyThresholdMinutes;
  const STEP = () => CFG.overtime.roundingStepMinutes;
  const roundUp = (min) => Math.ceil(min / STEP()) * STEP();

  // Union d'intervalles [début, fin] en minutes.
  function union(intervals) {
    const merged = [];
    intervals.slice().sort((p, q) => p[0] - q[0]).forEach((iv) => {
      const last = merged[merged.length - 1];
      if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
      else merged.push(iv.slice());
    });
    return merged;
  }

  /**
   * Heures supplémentaires d'une journée (schéma v3).
   * @param {Object} dayObj
   * @param {{nowMin?:number}} [opts]
   * @returns {{status:"none"|"ok"|"open"|"invalid", start:number|null, end:number|null,
   *   firstId:string|null, lastId:string|null, kidsMin:number, meetings:Array,
   *   totalMin:number, overMin:number, dueMin:number, meetingOnly:boolean}}
   */
  O.computeDay = function computeDay(dayObj, opts) {
    const nowMin = (opts && Number.isFinite(opts.nowMin)) ? opts.nowMin : null;
    const result = { status: "none", start: null, end: null, firstId: null, lastId: null,
      kidsMin: 0, meetings: [], totalMin: 0, overMin: 0, dueMin: 0, meetingOnly: false };
    if (!dayObj || dayObj.off === true) return result;

    const children = dayObj.children || {};
    let open = false;
    for (const id of Object.keys(children).sort()) {
      const c = children[id];
      if (!c || c.absent === true) continue;
      for (const s of (c.slots || [])) {
        if (!s.in && !s.out) continue; // créneau vide : aucune donnée
        const x = U.parseTimeToMinutes(s.in);
        let y = U.parseTimeToMinutes(s.out);
        if (x !== null && !s.out && nowMin !== null && nowMin > x) { y = nowMin; open = true; }
        if (x === null || y === null || y <= x) return Object.assign(result, { status: "invalid" });
        if (result.start === null || x < result.start) { result.start = x; result.firstId = id; }
        if (result.end === null || y > result.end) { result.end = y; result.lastId = id; }
      }
    }

    const meetingIntervals = [];
    for (const s of (dayObj.meetings || [])) {
      const x = U.parseTimeToMinutes(s.in);
      let y = U.parseTimeToMinutes(s.out);
      if (x !== null && !s.out && nowMin !== null && nowMin > x) { y = nowMin; open = true; } // réunion en cours
      if (x === null || y === null || y <= x) return Object.assign(result, { status: "invalid" });
      meetingIntervals.push([x, y]);
    }

    const hasKids = result.start !== null;
    if (!hasKids && meetingIntervals.length === 0) return result;

    result.kidsMin = hasKids ? result.end - result.start : 0;
    let added = 0;
    result.meetings = union(meetingIntervals).map(([s, e]) => {
      const overlapMin = hasKids ? Math.max(0, Math.min(e, result.end) - Math.max(s, result.start)) : 0;
      const addedMin = (e - s) - overlapMin;
      let gap = null;
      if (hasKids && s > result.end) gap = [result.end, s];
      if (hasKids && e < result.start) gap = [e, result.start];
      added += addedMin;
      return { start: s, end: e, overlapMin, addedMin, gap };
    });

    result.totalMin = result.kidsMin + added;
    result.meetingOnly = !hasKids;
    result.overMin = result.meetingOnly ? result.totalMin : Math.max(0, result.totalMin - T());
    result.dueMin = result.overMin ? roundUp(result.overMin) : 0;
    result.status = open ? "open" : "ok";
    return result;
  };

  /**
   * Heures supplémentaires d'un mois : total dû et jours à vérifier.
   * @returns {{dueMin:number, hsDays:number, invalidDays:string[], days:Object}}
   */
  O.computeMonth = function computeMonth(daysMap) {
    const out = { dueMin: 0, hsDays: 0, invalidDays: [], days: {} };
    Object.keys(daysMap || {}).sort().forEach((iso) => {
      const r = O.computeDay(daysMap[iso]);
      out.days[iso] = r;
      if (r.status === "invalid") out.invalidDays.push(iso);
      if (r.dueMin > 0) { out.dueMin += r.dueMin; out.hsDays += 1; }
    });
    return out;
  };

  // --- Explication en français simple ---------------------------------------

  const hm = (min) => { const h = Math.floor(min / 60); const m = min % 60; return m ? `${h}h${U.pad2(m)}` : `${h}h`; };
  O.fmtDuration = function fmtDuration(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m} min`;
    return m ? `${h} h ${U.pad2(m)}` : `${h} h`;
  };
  const d = O.fmtDuration;
  // « de Léa », « d'Inès » (élision devant voyelle ou h)
  const de = (name) => (/^[aeiouyhâàéèêëîïôöûü]/i.test(name) ? `d'${name}` : `de ${name}`);

  /**
   * Phrases qui expliquent le résultat d'une journée.
   * @param {Object} r - résultat de computeDay
   * @param {(id:string)=>string} labelOf - prénom affiché d'un enfant
   * @returns {{lines:string[], verdict:string}}
   */
  O.explainDay = function explainDay(r, labelOf) {
    if (r.status === "invalid") {
      return { lines: [], verdict: "Horaire incomplet ou incohérent ce jour-là : heures sup. à vérifier." };
    }
    if (r.status === "none") return { lines: [], verdict: "Aucun enfant ni réunion ce jour-là." };

    const lines = [];
    if (r.meetingOnly) {
      lines.push("Aucun enfant ce jour-là.");
    } else if (r.status === "open") {
      lines.push(`Enfants : de ${hm(r.start)} (arrivée ${de(labelOf(r.firstId))}) à ${hm(r.end)}, pour l'instant = ${d(r.kidsMin)}.`);
    } else if (r.firstId === r.lastId) {
      lines.push(`Enfants : de ${hm(r.start)} à ${hm(r.end)} (arrivée et départ ${de(labelOf(r.firstId))}) = ${d(r.kidsMin)}.`);
    } else {
      lines.push(`Enfants : de ${hm(r.start)} (arrivée ${de(labelOf(r.firstId))}) à ${hm(r.end)} (départ ${de(labelOf(r.lastId))}) = ${d(r.kidsMin)}.`);
    }

    r.meetings.forEach((m) => {
      const what = `Réunion de ${hm(m.start)} à ${hm(m.end)}`;
      if (r.meetingOnly) lines.push(`${what} : ${d(m.addedMin)}.`);
      else if (m.addedMin === 0) lines.push(`${what} : pendant que des enfants étaient là, déjà comptée. Rien à ajouter.`);
      else if (m.overlapMin > 0) lines.push(`${what} : ${d(m.overlapMin)} en même temps que les enfants (comptées une seule fois), ${d(m.addedMin)} ajoutées.`);
      else lines.push(`${what} : ${d(m.addedMin)} ajoutées.${m.gap ? ` La pause de ${hm(m.gap[0])} à ${hm(m.gap[1])} n'est pas comptée.` : ""}`);
    });
    if (r.meetings.length && !r.meetingOnly) lines.push(`Journée retenue : ${d(r.totalMin)}.`);

    const rounded = (r.dueMin !== r.overMin) ? " (toute demi-heure commencée compte)" : "";
    let verdict;
    if (r.meetingOnly) verdict = `Jour sans enfant : toute la réunion compte → ${d(r.dueMin)} d'heures sup.${rounded}`;
    else if (r.overMin === 0) verdict = `${d(r.totalMin)} : ${d(T())} ou moins, pas d'heure supplémentaire.`;
    else verdict = `${d(r.overMin)} au-delà de ${d(T())} → ${d(r.dueMin)} d'heures sup.${rounded}`;
    return { lines, verdict };
  };
})();
