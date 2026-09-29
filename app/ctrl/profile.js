/* ============================================================================
   app/ctrl/profile.js — Onglet « Mon profil » : affichage
   ----------------------------------------------------------------------------
   Construit le modèle de chaque enfant (dates, horaires en vigueur, historique,
   formulaires ouverts). Les modifications vivent dans app/ctrl/profile-edit.js.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const S = window.ABMAT.storage;
  const U = window.ABMAT.utils;
  const Compute = window.ABMAT.compute;
  const F = R.fmt;

  if (!A || !R.buildProfile) {
    throw new Error("app/ctrl/ctx.js et render/profile.js doivent être chargés avant app/ctrl/profile.js.");
  }

  // Formulaire ouvert : { id, kind: "sched" | "dates" } ou { kind: "add" }.
  A.profileEdit = null;

  A.weekIsBlank = (week) => Object.keys(week).every((d) => !week[d].in && !week[d].out);

  function dayBefore(iso) {
    const d = U.isoToDate(iso);
    d.setDate(d.getDate() - 1);
    return U.toIsoDate(d);
  }

  /** Premier lundi strictement après aujourd'hui (date d'effet proposée). */
  A.nextMonday = function nextMonday(todayIso) {
    const d = U.isoToDate(todayIso);
    do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 1);
    return U.toIsoDate(d);
  };

  function datesText(c, todayIso) {
    if (c.from && c.to) return `du ${F.dateFr(c.from)} au ${F.dateFr(c.to)}`;
    if (c.from) return (c.from > todayIso ? "arrive le " : "depuis le ") + F.dateFr(c.from);
    if (c.to) return `jusqu'au ${F.dateFr(c.to)}`;
    return "";
  }

  function childModel(c, todayIso) {
    let ref = todayIso;
    if (c.from && c.from > todayIso) ref = c.from;
    if (c.to && c.to < todayIso) ref = c.to;
    const cur = Compute.periodAt(c, ref) || c.periods[0];
    const history = [];
    c.periods.forEach((p, i) => {
      if (p === cur || A.weekIsBlank(p.week)) return;
      const week = F.week(p.week) || "pas d'horaires";
      if (p.from && p.from > ref) { history.push({ next: true, text: `À partir du ${F.dateFr(p.from)} : ${week}` }); return; }
      const end = F.dateFr(dayBefore(c.periods[i + 1].from));
      history.push({ next: false, text: p.from ? `Du ${F.dateFr(p.from)} au ${end} : ${week}` : `Jusqu'au ${end} : ${week}` });
    });
    const edit = A.profileEdit && A.profileEdit.id === c.id ? A.profileEdit.kind : null;
    const hasTimes = c.periods.some((p) => !A.weekIsBlank(p.week));
    return {
      id: c.id,
      name: Compute.childLabel({ children: [c] }, c.id, null),
      dates: datesText(c, todayIso),
      gone: Boolean(c.to && c.to < todayIso),
      current: A.weekIsBlank(cur.week) ? null : cur,
      history,
      editing: edit,
      schedForm: edit === "sched" ? {
        needsDate: hasTimes,
        from: (c.from && c.from > todayIso) ? c.from : A.nextMonday(todayIso),
        week: cur.week
      } : null,
      datesForm: edit === "dates" ? { name: c.name, from: c.from || "", to: c.to || "" } : null
    };
  }

  function render(main) {
    const p = A.profile();
    const todayIso = A.todayIso();
    const year = U.isoToDate(todayIso).getFullYear();
    const children = p.children.map((c) => childModel(c, todayIso)).sort((a, b) => Number(a.gone) - Number(b.gone));
    R.append(main, R.buildProfile({
      firstName: p.firstName, lastName: p.lastName, employer: p.employer,
      year, relais: S.loadYearSettings(year).relais, smic: Compute.smicForYear(year),
      children, adding: Boolean(A.profileEdit && A.profileEdit.kind === "add"), todayIso,
      backupCard: A.backup.buildProfileCard()
    }, A.profileHandlers));
  }

  // --- Effacer une année (RGPD : ne garder que le nécessaire) --------------------

  function erase(y) {
    S.eraseYear(y);
    R.closeSheet();
    S.fiches.eraseYear(y).then(() => {
      A.photos.forget(y);
      R.toast(`${y} est effacée de cet appareil.`);
    }, (e) => R.toast(`${y} est effacée, sauf les photos des fiches : ${e.message}`));
  }

  A.eraseYearSheet = function eraseYearSheet() {
    const h = R.h;
    const years = A.storedYears();
    const sheet = R.openSheet({ title: "Effacer une année", onClose: A.render, body: [] });
    const list = () => sheet.setBody([
      h("p", { class: "small muted", text: "Gardez chaque année au moins 3 ans après l'avoir déclarée : en cas de contrôle, vous en aurez besoin." }),
      years.length ? h("div", { class: "row" }, years.map((y) => h("button", { type: "button", class: "btn", text: `Effacer ${y}…`, on: { click: () => confirm(y) } })))
        : h("p", { text: "Aucune année enregistrée sur cet appareil." })
    ]);
    const confirm = (y) => sheet.setBody([
      h("p", null, h("b", { text: `Effacer définitivement ${y} de cet appareil ?` })),
      h("p", { class: "small", text: "Les jours, les fiches de paie, les photos des fiches de présence et les réglages de cette année seront supprimés. Votre copie de secours (le fichier) n'est pas touchée : supprimez-la vous-même si besoin." }),
      h("div", { class: "row" }, [
        h("button", { type: "button", class: "btn btn-primary", text: `Oui, effacer ${y}`, on: { click: () => erase(y) } }),
        h("button", { type: "button", class: "btn", text: "Annuler", on: { click: list } })
      ])
    ]);
    list();
  };

  A.views.profile = { render };
})();
