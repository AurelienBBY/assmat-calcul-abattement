/* ============================================================================
   compute/punch.js — Pointeuse « Aujourd'hui » (sans DOM)
   ----------------------------------------------------------------------------
   Actions à l'heure du téléphone sur le jour courant d'un mois (schéma v3).
   Un enfant pointé porte punched=true : ses heures sont réelles, le
   pré-remplissage et un changement d'horaires ne les touchent plus.
   Toutes les fonctions mutent monthData et lèvent une erreur explicite sur
   une action impossible (l'interface ne les propose pas).
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.compute = window.ABMAT.compute || {};

  const Compute = window.ABMAT.compute;
  const U = window.ABMAT.utils;

  if (!U || !Compute.usualSlots || !Compute.compareChildIds) {
    throw new Error("ABMAT.compute : utils et compute/children.js doivent être chargés avant compute/punch.js.");
  }

  const MAX_SLOTS = 3;

  function dayOf(monthData, iso) {
    if (!monthData.days[iso] || monthData.days[iso].off) monthData.days[iso] = { off: false, children: {}, meetings: [] };
    return monthData.days[iso];
  }

  const openSlot = (p) => (p && p.slots.length && !p.slots[p.slots.length - 1].out) ? p.slots[p.slots.length - 1] : null;

  /**
   * État de chaque enfant pour la journée (enfants accueillis ce jour-là avec
   * des horaires habituels ou une donnée, puis accueil relais).
   * @returns {Array<{id, label, usual:Array, presence:Object|null, state:"waiting"|"here"|"left"|"absent"}>}
   */
  Compute.punchList = function punchList(profile, iso, day) {
    const children = (day && !day.off) ? day.children : {};
    const ids = new Set(Object.keys(children));
    profile.children.forEach((c) => { if (Compute.usualSlots(c, iso).length) ids.add(c.id); });
    return Array.from(ids).sort(Compute.compareChildIds).map((id) => {
      const presence = children[id] || null;
      const child = profile.children.find((c) => c.id === id);
      let state = "waiting";
      if (presence && presence.absent) state = "absent";
      else if (presence && presence.punched && presence.slots.length) state = openSlot(presence) ? "here" : "left";
      return { id, label: Compute.childLabel(profile, id, presence), usual: child ? Compute.usualSlots(child, iso) : [], presence, state };
    });
  };

  /** Enfants accueillis ce jour-là sans horaire habituel (« pas prévus »). */
  Compute.notExpectedToday = function notExpectedToday(profile, iso, day) {
    const listed = new Set(Compute.punchList(profile, iso, day).map((x) => x.id));
    return profile.children.filter((c) => Compute.childActiveOn(c, iso) && !listed.has(c.id));
  };

  /** Arrivée : remplace les horaires prévus par l'heure réelle. */
  Compute.punchIn = function punchIn(monthData, iso, id, hhmm) {
    const day = dayOf(monthData, iso);
    let p = day.children[id];
    if (!p || !p.punched || p.absent) {
      p = { absent: false, motif: "", slots: [], punched: true };
      day.children[id] = p;
    }
    if (openSlot(p)) throw new Error(`punchIn : ${id} est déjà arrivé (départ non pointé).`);
    if (p.slots.length >= MAX_SLOTS) throw new Error(`punchIn : ${id} a déjà ${MAX_SLOTS} horaires ce jour-là.`);
    p.slots.push({ in: hhmm, out: "" });
  };

  /** Départ : ferme le dernier horaire ouvert. */
  Compute.punchOut = function punchOut(monthData, iso, id, hhmm) {
    const p = monthData.days[iso] && monthData.days[iso].children[id];
    const slot = openSlot(p);
    if (!slot) throw new Error(`punchOut : ${id} n'est pas arrivé.`);
    if (U.parseTimeToMinutes(hhmm) <= U.parseTimeToMinutes(slot.in)) {
      throw new Error("punchOut : le départ doit être après l'arrivée.");
    }
    slot.out = hhmm;
  };

  /** « Pas là aujourd'hui ». */
  Compute.punchAbsent = function punchAbsent(monthData, iso, id, motif) {
    dayOf(monthData, iso).children[id] = { absent: true, motif: motif || "", slots: [], punched: true };
  };

  /** Annule une absence : retour aux horaires habituels (non pointés). */
  Compute.cancelAbsence = function cancelAbsence(monthData, iso, id, profile) {
    const day = dayOf(monthData, iso);
    const child = profile.children.find((c) => c.id === id);
    const usual = child ? Compute.usualSlots(child, iso) : [];
    if (usual.length) day.children[id] = { absent: false, motif: "", slots: usual, punched: false };
    else delete day.children[id];
  };

  /** Arrivée d'un enfant en accueil relais (prénom saisi sur le moment). */
  Compute.punchInRelais = function punchInRelais(monthData, iso, name, hhmm) {
    const day = dayOf(monthData, iso);
    let n = 1;
    while (day.children[`r${n}`]) n++;
    const id = `r${n}`;
    day.children[id] = { relais: true, name: String(name).trim(), absent: false, motif: "", slots: [{ in: hhmm, out: "" }], punched: true };
    return id;
  };

  /** Début / fin de réunion. */
  Compute.meetingStart = function meetingStart(monthData, iso, hhmm) {
    const day = dayOf(monthData, iso);
    if (day.meetings.some((m) => !m.out)) throw new Error("meetingStart : une réunion est déjà en cours.");
    day.meetings.push({ in: hhmm, out: "" });
  };

  Compute.meetingEnd = function meetingEnd(monthData, iso, hhmm) {
    const m = monthData.days[iso] && monthData.days[iso].meetings.find((x) => !x.out);
    if (!m) throw new Error("meetingEnd : aucune réunion en cours.");
    if (U.parseTimeToMinutes(hhmm) <= U.parseTimeToMinutes(m.in)) throw new Error("meetingEnd : la fin doit être après le début.");
    m.out = hhmm;
  };

  /** Un enfant est-il pointé présent en ce moment (arrivé, pas reparti) ? */
  Compute.someoneHere = function someoneHere(day) {
    return Boolean(day && !day.off && Object.keys(day.children).some((id) => openSlot(day.children[id])));
  };
})();
