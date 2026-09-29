/* ============================================================================
   app/ctrl/review.js — « Vérifier le mois » (A.startReview)
   ----------------------------------------------------------------------------
   Plein écran dans « Mon mois » : une semaine à la fois, la fiche de présence
   photographiée à côté. Un jour touché s'ouvre dans la fiche du jour
   (app/ctrl/day.js) ; à sa fermeture, la semaine se redessine avec le jour
   marqué « modifié ». À la fin, le mois est marqué « jours vérifiés ».
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const Compute = window.ABMAT.compute;
  const F = R.fmt;

  if (!A || !A.openDay || !A.photos || !R.buildReview || !Compute.reviewWeeks) {
    throw new Error("app/ctrl/day.js, app/ctrl/photos.js, render/review.js et compute/review.js doivent être chargés avant app/ctrl/review.js.");
  }

  const st = A.state;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  A.startReview = function startReview(year, m) {
    st.review = { year, m, w: 0, view: null, zoom: 1, before: clone(A.loadMonth(year, m)), end: false };
    A.photos.ensure(year, m).then(A.render);
    A.render();
    window.scrollTo(0, 0);
  };

  function quit() {
    st.review = null;
    A.render();
    window.scrollTo(0, 0);
  }

  const handlers = {
    onDay: (iso) => A.openDay(iso),
    onView: (patch) => {
      const rv = st.review;
      rv.view = Object.assign({}, rv.view || Compute.weekSheetView(weeksOf(rv)[rv.w]), patch);
      A.render();
    },
    onZoom: (z) => { st.review.zoom = z; },
    onPick: (side) => A.photos.pick(st.review.year, st.review.m, side),
    onPrev: () => { st.review.w--; st.review.view = null; A.render(); window.scrollTo(0, 0); },
    onNext: () => {
      const rv = st.review;
      if (rv.w < weeksOf(rv).length - 1) { rv.w++; rv.view = null; A.render(); window.scrollTo(0, 0); return; }
      const data = A.loadMonth(rv.year, rv.m);
      data.verified = true;
      A.saveMonth(data);
      rv.end = true;
      A.render();
    },
    onQuit: quit
  };

  const weeksOf = (rv) => Compute.reviewWeeks(rv.year, rv.m, A.loadMonth(rv.year, rv.m), A.todayIso());

  /** Dessine la vérification en cours dans la zone principale. */
  A.renderReview = function renderReview(main) {
    const rv = st.review;
    const data = A.loadMonth(rv.year, rv.m);
    const changed = Compute.changedDays(rv.before, data);
    const monthName = F.monthName(rv.m);
    if (rv.end) { main.appendChild(R.buildReviewEnd({ monthName, changed: changed.length }, handlers)); return; }

    const weeks = weeksOf(rv);
    const cal = Compute.buildCalendar(rv.year, rv.m, data, A.profile(), A.todayIso());
    const cells = {};
    cal.weeks.forEach((w) => w.cells.forEach((c) => { cells[c.iso] = c; }));
    cal.saturdays.forEach((c) => { cells[c.iso] = c; });
    const week = weeks[rv.w];
    const view = rv.view || Compute.weekSheetView(week);
    const photos = A.photos.state(rv.year, rv.m);
    main.appendChild(R.buildReview({
      monthName, weekIndex: rv.w, weekCount: weeks.length, view, zoom: rv.zoom,
      photoUrl: photos ? photos[view.page] : null,
      days: week.map((iso) => ({ iso, cell: cells[iso], changed: changed.includes(iso) }))
    }, handlers));
  };
})();
