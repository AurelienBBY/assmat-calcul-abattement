/* ============================================================================
   app/ctrl/ctx.js — Contexte partagé des écrans (window.ABMAT.app)
   ----------------------------------------------------------------------------
   - état de l'interface (onglet, mois affiché…) et rendu de l'onglet courant
   - accès aux données : chaque action relit le stockage, modifie, enregistre
     (pas de copie en mémoire qui pourrait diverger du stockage)
   - « Annuler » : instantané des mois/profil touchés, restauré par un nouvel
     enregistrement (nouvel horodatage : la fusion entre appareils reste juste)
   Chaque onglet s'enregistre dans A.views[tab] = { render(main) }.
   ========================================================================== */

(function () {
  "use strict";

  const U = window.ABMAT.utils;
  const S = window.ABMAT.storage;
  const R = window.ABMAT.render;
  const Compute = window.ABMAT.compute;

  if (!U || !S || !R || !R.toast || !Compute || !Compute.buildCalendar) {
    throw new Error("app/ctrl/ctx.js : utils, storage, compute et render doivent être chargés avant.");
  }

  const now = new Date();
  const A = window.ABMAT.app = {
    state: { tab: "today", year: now.getFullYear(), monthIndex: now.getMonth(), hsOpen: false, banner: null, review: null, askFiche: false },
    views: {}
  };

  A.todayIso = () => U.toIsoDate(new Date());
  A.monthOf = (iso) => { const d = U.isoToDate(iso); return [d.getFullYear(), d.getMonth()]; };

  // --- Données ----------------------------------------------------------------

  A.profile = () => S.loadProfile() || S.blankProfile();
  A.loadMonth = (year, monthIndex) => S.loadMonth(year, monthIndex).data;

  function warnNotSaved() {
    R.toast("Impossible d'enregistrer sur cet appareil (mémoire pleine ?). Faites une copie de secours.");
  }

  A.saveProfile = function saveProfile(profile) {
    const changed = !S.sameContent(S.PROFILE_KEY, S.normalizeProfile(profile));
    if (!S.saveProfile(profile)) return warnNotSaved();
    if (changed) A.backup.changed(["profile"]);
  };

  // Ce qui change réellement (pour « N jours à envoyer ») : les jours
  // modifiés (clé AAAA-MM-JJ) et les champs du mois (clé AAAA-MM).
  function changedKeys(before, after) {
    const keys = [];
    const isos = new Set(Object.keys(before.days).concat(Object.keys(after.days)));
    isos.forEach((iso) => {
      if (JSON.stringify(before.days[iso] || null) !== JSON.stringify(after.days[iso] || null)) keys.push(iso);
    });
    if (["netImposable", "irf", "verified", "done"].some((k) => before[k] !== after[k])) {
      keys.push(`${after.year}-${U.pad2(after.monthIndex + 1)}`);
    }
    return keys;
  }

  A.saveMonth = function saveMonth(data) {
    const before = A.loadMonth(data.year, data.monthIndex);
    const keys = changedKeys(before, S.normalizeMonthData(JSON.parse(JSON.stringify(data)), data.year, data.monthIndex));
    if (!S.saveMonth(S.monthKey(data.year, data.monthIndex), data)) return warnNotSaved();
    if (keys.length) A.backup.changed(keys);
  };

  A.saveYearSettings = function saveYearSettings(settings) {
    const changed = !S.sameContent(S.settingsKey(settings.year), S.normalizeYearSettings(settings, settings.year));
    if (!S.saveYearSettings(settings)) return warnNotSaved();
    if (changed) A.backup.changed([`${settings.year}-settings`]);
  };

  /** Mois déjà enregistrés sur l'appareil : [{year, monthIndex}] triés. */
  A.storedMonths = function storedMonths() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const m = /^abmat:(\d{4})-(\d{2})$/.exec(localStorage.key(i) || "");
      if (m) out.push({ year: Number(m[1]), monthIndex: Number(m[2]) - 1 });
    }
    return out.sort((a, b) => (a.year - b.year) || (a.monthIndex - b.monthIndex));
  };

  /** Années présentes sur l'appareil (mois saisis ou réglages d'année), triées. */
  A.storedYears = function storedYears() {
    const years = new Set(A.storedMonths().map((x) => x.year));
    for (let i = 0; i < localStorage.length; i++) {
      const m = /^abmat:settings:(\d{4})$/.exec(localStorage.key(i) || "");
      if (m) years.add(Number(m[1]));
    }
    return Array.from(years).sort();
  };

  A.hasAnyData = () => A.storedMonths().length > 0 || A.profile().children.length > 0;

  /** Prénom affiché d'un enfant ce jour-là. */
  A.labelOf = (profile, day) => (id) => Compute.childLabel(profile, id, day && day.children[id]);

  const punchedDay = (day) => Object.keys(day.children).some((id) => day.children[id].punched === true);

  /**
   * Heures sup. des jours passés d'un mois : [{iso, r, labelOf}] (la journée
   * en cours compte dès qu'elle a été pointée et que plus aucun enfant n'est là).
   */
  A.hsDays = function hsDays(data, todayIso) {
    const profile = A.profile();
    return Object.keys(data.days).sort()
      .filter((iso) => iso < todayIso || (iso === todayIso && punchedDay(data.days[iso]) && !Compute.someoneHere(data.days[iso])))
      .map((iso) => ({ iso, r: window.ABMAT.overtime.computeDay(data.days[iso]), labelOf: A.labelOf(profile, data.days[iso]) }));
  };

  /** Forfait par enfant pour une journée de 8 h ou plus ; null si SMIC manquant. */
  A.forfait = (year) => Compute.forfaitJourForYear(year);

  // --- Annuler ------------------------------------------------------------------

  const clone = (o) => JSON.parse(JSON.stringify(o));

  /** @param {Array<[number, number]>} months - [année, mois] ; withProfile : profil aussi */
  A.snapshot = function snapshot(months, withProfile) {
    return { months: months.map(([y, m]) => clone(A.loadMonth(y, m))), profile: withProfile ? clone(A.profile()) : null };
  };

  A.undoable = function undoable(text, snap) {
    R.toast(text, [{ label: "Annuler", run: () => {
      snap.months.forEach((data) => A.saveMonth(data));
      if (snap.profile) A.saveProfile(snap.profile);
      A.render();
      R.toast("Action annulée.");
    } }]);
  };

  // --- Rendu ----------------------------------------------------------------------

  const TABS = ["today", "month", "year", "profile"];

  A.go = function go(tab, opts) {
    if (!TABS.includes(tab)) throw new Error(`A.go : onglet inconnu « ${tab} ».`);
    Object.assign(A.state, opts || {}, { tab });
    if (tab !== "month") A.state.review = null;
    document.querySelectorAll("[data-tab]").forEach((b) => {
      if (b.dataset.tab === tab) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    A.render();
    window.scrollTo(0, 0);
  };

  /** Redessine l'onglet courant ; le champ qui avait le focus le retrouve. */
  A.render = function render() {
    const main = document.getElementById("main");
    const focusId = document.activeElement && main.contains(document.activeElement) ? document.activeElement.id : "";
    R.clear(main);
    // Vérification du mois : plein écran, sans les onglets.
    document.body.classList.toggle("is-focus", Boolean(A.state.review && A.state.tab === "month"));
    if (A.state.banner) main.appendChild(A.backup.buildBanner(A.state.banner));
    A.views[A.state.tab].render(main);
    A.backup.refreshPill();
    const again = focusId ? document.getElementById(focusId) : null;
    if (again) again.focus({ preventScroll: true });
  };
})();
