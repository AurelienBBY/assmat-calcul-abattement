/* ============================================================================
   compute/children.js — Enfants du profil : accueil, horaires, libellés
   ----------------------------------------------------------------------------
   Fonctions pures sur le profil v2 (storage/profile.js) :
   - accueil à une date (bornes from/to incluses)
   - horaires habituels en vigueur à une date (périodes versionnées)
   - ordre d'affichage des ids et prénom affiché d'une présence
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.compute = window.ABMAT.compute || {};

  const Compute = window.ABMAT.compute;
  const U = window.ABMAT.utils;

  if (!U) {
    throw new Error("ABMAT.compute : utils doit être chargé avant compute/children.js.");
  }

  /** L'enfant est-il accueilli à cette date (bornes incluses, null = sans borne) ? */
  Compute.childActiveOn = function childActiveOn(child, iso) {
    return (!child.from || child.from <= iso) && (!child.to || iso <= child.to);
  };

  /** Période d'horaires en vigueur à une date (périodes triées par from). */
  Compute.periodAt = function periodAt(child, iso) {
    let found = null;
    child.periods.forEach((p) => { if (!p.from || p.from <= iso) found = p; });
    return found;
  };

  /**
   * Horaires habituels d'un enfant à une date : [] s'il n'est pas accueilli,
   * le week-end, ou si le jour de sa semaine type est vide.
   * @returns {Array<{in:string,out:string}>}
   */
  Compute.usualSlots = function usualSlots(child, iso) {
    if (!Compute.childActiveOn(child, iso)) return [];
    const dow = U.isoToDate(iso).getDay();
    if (dow < 1 || dow > 5) return [];
    const period = Compute.periodAt(child, iso);
    const t = period ? period.week[String(dow)] : null;
    return (t && t.in && t.out) ? [{ in: t.in, out: t.out }] : [];
  };

  Compute.sameSlots = function sameSlots(a, b) {
    if (a.length !== b.length) return false;
    return a.every((s, i) => s.in === b[i].in && s.out === b[i].out);
  };

  Compute.childrenActiveOn = function childrenActiveOn(profile, iso) {
    return profile.children.filter((c) => Compute.childActiveOn(c, iso));
  };

  /** Ordre d'affichage : enfants du profil (c1, c2 … c10) puis relais (r1 …). */
  Compute.compareChildIds = function compareChildIds(a, b) {
    const ra = a[0] === "r" ? 1 : 0;
    const rb = b[0] === "r" ? 1 : 0;
    return (ra - rb) || (Number(a.slice(1)) - Number(b.slice(1)));
  };

  /** Prénom affiché pour une présence (relais : prénom saisi ce jour-là). */
  Compute.childLabel = function childLabel(profile, id, presence) {
    if (presence && presence.relais) return presence.name || "Enfant en relais";
    const child = profile ? profile.children.find((c) => c.id === id) : null;
    return (child && child.name) ? child.name : `Enfant ${id.slice(1)}`;
  };
})();
