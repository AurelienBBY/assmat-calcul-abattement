/* ============================================================================
   app/ctrl/month.js — Onglet « Mon mois »
   ----------------------------------------------------------------------------
   Calendrier pré-rempli (saisie par exceptions), 3 étapes du mois, heures
   sup. expliquées, résultat. La fiche du jour vit dans app/ctrl/day.js.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const C = window.ABMAT.calc;
  const Compute = window.ABMAT.compute;
  const h = R.h;
  const F = R.fmt;

  if (!A || !R.buildCalendar || !R.buildMonthTodo || !R.hsMonthCard) {
    throw new Error("app/ctrl/ctx.js et les renderers du mois doivent être chargés avant app/ctrl/month.js.");
  }

  const st = A.state;
  const current = () => A.loadMonth(st.year, st.monthIndex);

  function goMonth(delta) {
    const d = new Date(st.year, st.monthIndex + delta, 1);
    st.year = d.getFullYear();
    st.monthIndex = d.getMonth();
    A.render();
  }

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
      if (date.getDay() === 6) sats.push(window.ABMAT.utils.toIsoDate(date));
    }
    R.openSheet({
      title: "Quel samedi ?",
      body: [h("p", { class: "small muted", text: "Une réunion un samedi compte entièrement en heures supplémentaires." }),
        h("div", { class: "row" }, sats.map((iso) => h("button", { type: "button", class: "btn", text: F.dateLong(iso), on: { click: () => A.openDay(iso) } })))]
    });
  }

  function setField(mutate) {
    const data = current();
    mutate(data);
    A.saveMonth(data);
  }

  function onDone() {
    setField((d) => { d.done = true; });
    A.render();
    A.backup.after("month-done", F.cap(F.monthName(st.monthIndex)));
  }

  function hsModel(data, todayIso) {
    const days = A.hsDays(data, todayIso);
    return {
      monthName: F.monthName(st.monthIndex),
      dueMin: days.reduce((s, d) => s + d.r.dueMin, 0),
      hsDays: days.filter((d) => d.r.dueMin > 0).length,
      invalidCount: days.filter((d) => d.r.status === "invalid").length,
      days,
      open: st.hsOpen,
      onToggle: (open) => { st.hsOpen = open; }
    };
  }

  function render(main) {
    const data = current();
    const profile = A.profile();
    const todayIso = A.todayIso();
    const progress = Compute.monthProgress(data, profile, todayIso);
    const forfait = A.forfait(st.year);
    const abatt = forfait === null ? 0 : C.computeMonthTotal(data.days, forfait).monthTotal;
    const percu = window.ABMAT.utils.round2(data.netImposable + data.irf);

    const cal = h("div", { class: "card" }, [
      R.buildMonthHead({ year: st.year, monthIndex: st.monthIndex, status: progress.status }, { onGo: goMonth }),
      Object.keys(data.days).length ? null : emptyPrompt(),
      R.buildCalendar({ monthIndex: st.monthIndex, cal: Compute.buildCalendar(st.year, st.monthIndex, data, profile, todayIso) },
        { onDay: A.openDay, onWeek, onSaturday })
    ]);

    const side = h("aside", { class: "side" }, [
      R.buildMonthTodo({
        monthIndex: st.monthIndex, verified: data.verified, done: data.done, toVerify: progress.toVerify,
        payDone: progress.payDone, net: data.netImposable, irf: data.irf,
        canFinish: data.verified && progress.payDone && !data.done
      }, {
        onVerify: (v) => { setField((d) => { d.verified = v; }); A.render(); },
        onMoney: (key, v) => setField((d) => { d[key] = (v === null) ? 0 : v; }),
        onMoneyCommit: () => setTimeout(A.render, 0),
        onDone
      }),
      R.hsMonthCard(hsModel(data, todayIso)),
      R.buildMonthResult({ year: st.year, monthIndex: st.monthIndex, abatt, percu, apres: window.ABMAT.utils.round2(percu - abatt),
        payDone: progress.payDone, smicMissing: forfait === null },
      { onPrint: () => A.print.month(st.year, st.monthIndex), onPrepareYear: () => A.prepareYear(st.year) })
    ]);

    main.appendChild(h("div", { class: "month-layout" }, [cal, side]));
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

  A.views.month = { render };
})();
