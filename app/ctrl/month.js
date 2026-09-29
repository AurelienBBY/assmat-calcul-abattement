/* ============================================================================
   app/ctrl/month.js — Onglet « Mon mois »
   ----------------------------------------------------------------------------
   Calendrier pré-rempli (saisie par exceptions ; gestes du calendrier dans
   app/ctrl/month-calendar.js), 3 étapes du mois, photos de la fiche de
   présence, heures sup. expliquées, résultat. La fiche du jour vit dans
   app/ctrl/day.js, la vérification avec la fiche dans app/ctrl/review.js.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const C = window.ABMAT.calc;
  const Compute = window.ABMAT.compute;
  const h = R.h;
  const F = R.fmt;

  if (!A || !A.monthCal || !A.renderReview || !R.buildCalendar || !R.buildMonthTodo || !R.hsMonthCard || !R.buildFicheCard) {
    throw new Error("app/ctrl/month-calendar.js, app/ctrl/review.js et les renderers du mois doivent être chargés avant app/ctrl/month.js.");
  }

  const st = A.state;
  const current = () => A.loadMonth(st.year, st.monthIndex);

  function goMonth(delta) {
    const d = new Date(st.year, st.monthIndex + delta, 1);
    st.year = d.getFullYear();
    st.monthIndex = d.getMonth();
    st.askFiche = false;
    A.render();
  }

  function setField(mutate) {
    const data = current();
    mutate(data);
    A.saveMonth(data);
  }

  function finish() {
    st.askFiche = false;
    setField((d) => { d.done = true; });
    A.render();
    A.backup.after("month-done", F.cap(F.monthName(st.monthIndex)));
  }

  // « J'ai terminé » sans fiche jointe : on le rappelle, sans bloquer.
  function onDone() {
    const photos = A.photos.state(st.year, st.monthIndex);
    if (photos && !photos.any) { st.askFiche = true; A.render(); return; }
    finish();
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
    if (st.review) { A.renderReview(main); return; }
    const data = current();
    const photos = A.photos.state(st.year, st.monthIndex);
    if (!photos) A.photos.ensure(st.year, st.monthIndex).then(A.render);
    const profile = A.profile();
    const todayIso = A.todayIso();
    const progress = Compute.monthProgress(data, profile, todayIso);
    const forfait = A.forfait(st.year);
    const abatt = forfait === null ? 0 : C.computeMonthTotal(data.days, forfait).monthTotal;
    const percu = window.ABMAT.utils.round2(data.netImposable + data.irf);

    const cal = h("div", { class: "card" }, [
      R.buildMonthHead({ year: st.year, monthIndex: st.monthIndex, status: progress.status }, { onGo: goMonth }),
      Object.keys(data.days).length ? null : A.monthCal.emptyPrompt(),
      R.buildCalendar({ monthIndex: st.monthIndex, cal: Compute.buildCalendar(st.year, st.monthIndex, data, profile, todayIso) },
        { onDay: A.openDay, onWeek: A.monthCal.onWeek, onSaturday: A.monthCal.onSaturday })
    ]);

    const side = h("aside", { class: "side" }, [
      R.buildMonthTodo({
        monthIndex: st.monthIndex, verified: data.verified, done: data.done, toVerify: progress.toVerify,
        payDone: progress.payDone, net: data.netImposable, irf: data.irf,
        canFinish: data.verified && progress.payDone && !data.done,
        canReview: Compute.reviewWeeks(st.year, st.monthIndex, data, todayIso).length > 0,
        askFiche: Boolean(st.askFiche && !data.done)
      }, {
        onVerify: (v) => { setField((d) => { d.verified = v; }); A.render(); },
        onReview: () => A.startReview(st.year, st.monthIndex),
        onMoney: (key, v) => setField((d) => { d[key] = (v === null) ? 0 : v; }),
        onMoneyCommit: () => setTimeout(A.render, 0),
        onDone,
        onDoneAnyway: finish,
        onAttach: () => { st.askFiche = false; A.photos.pick(st.year, st.monthIndex, "recto"); }
      }),
      R.buildFicheCard({ monthName: F.monthName(st.monthIndex), state: photos }, {
        onPick: (side) => A.photos.pick(st.year, st.monthIndex, side),
        onRemove: (side) => A.photos.remove(st.year, st.monthIndex, side)
      }),
      R.hsMonthCard(hsModel(data, todayIso)),
      R.buildMonthResult({ year: st.year, monthIndex: st.monthIndex, abatt, percu, apres: window.ABMAT.utils.round2(percu - abatt),
        payDone: progress.payDone, smicMissing: forfait === null },
      { onPrint: () => A.print.month(st.year, st.monthIndex), onPrepareYear: () => A.prepareYear(st.year) })
    ]);

    main.appendChild(h("div", { class: "month-layout" }, [cal, side]));
  }

  A.views.month = { render };
})();
