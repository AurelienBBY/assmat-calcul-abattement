/* ============================================================================
   app/ctrl/month-calendar.js — Mon mois : gestes du calendrier (A.monthCal)
   ----------------------------------------------------------------------------
   Remplir un mois vide avec les horaires habituels, « Semaine de congés »
   (un jour pointé n'est jamais touché), choisir un samedi (réunion).
   Chaque geste peut être annulé.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const U = window.ABMAT.utils;
  const Compute = window.ABMAT.compute;
  const h = R.h;
  const F = R.fmt;

  if (!A || !A.openDay || !Compute.setWeekOff || !Compute.buildMonthDaysFromProfile) {
    throw new Error("app/ctrl/day.js et compute/prefill.js doivent être chargés avant app/ctrl/month-calendar.js.");
  }

  const st = A.state;
  const current = () => A.loadMonth(st.year, st.monthIndex);

  function onPrefill() {
    const snap = A.snapshot([[st.year, st.monthIndex]]);
    const data = current();
    data.days = Compute.buildMonthDaysFromProfile(st.year, st.monthIndex, A.profile());
    A.saveMonth(data);
    A.render();
    A.undoable(`${F.plural(Object.keys(data.days).length, "jour")} rempli${Object.keys(data.days).length > 1 ? "s" : ""}. Corrigez seulement les jours différents.`, snap);
  }

  function onWeek(isos, allOff) {
    const snap = A.snapshot([[st.year, st.monthIndex]]);
    const data = current();
    Compute.setWeekOff(data, isos, !allOff, A.profile());
    A.saveMonth(data);
    A.render();
    A.undoable(allOff ? "Semaine remise comme d'habitude." : "Semaine marquée en congés.", snap);
  }

  function onSaturday() {
    const sats = [];
    const days = new Date(st.year, st.monthIndex + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const date = new Date(st.year, st.monthIndex, d);
      if (date.getDay() === 6) sats.push(U.toIsoDate(date));
    }
    R.openSheet({
      title: "Quel samedi ?",
      body: [h("p", { class: "small muted", text: "Une réunion un samedi compte entièrement en heures supplémentaires." }),
        h("div", { class: "row" }, sats.map((iso) => h("button", { type: "button", class: "btn", text: F.dateLong(iso), on: { click: () => A.openDay(iso) } })))]
    });
  }

  function emptyPrompt() {
    const days = Compute.buildMonthDaysFromProfile(st.year, st.monthIndex, A.profile());
    const n = Object.keys(days).length;
    return h("div", { class: "empty-month" }, n ? [
      h("p", null, h("b", { text: `Rien de saisi pour ${F.monthName(st.monthIndex)}.` })),
      h("p", { class: "muted", text: "Remplissez le mois avec les horaires habituels des enfants (dates d'arrivée et de départ respectées, jours fériés exclus), puis corrigez seulement les jours différents — ou pointez au jour le jour." }),
      h("button", { type: "button", class: "btn btn-primary", text: "Remplir avec les horaires habituels", on: { click: onPrefill } })
    ] : [
      h("p", null, h("b", { text: `Rien de saisi pour ${F.monthName(st.monthIndex)}.` })),
      h("p", { class: "muted", text: "Indiquez les enfants et leurs horaires habituels dans « Mon profil » : le mois se remplira en un clic. Vous pouvez aussi ouvrir un jour du calendrier pour le saisir." }),
      h("button", { type: "button", class: "btn", text: "Aller à Mon profil", on: { click: () => A.go("profile") } })
    ]);
  }

  A.monthCal = { onWeek, onSaturday, emptyPrompt };
})();
