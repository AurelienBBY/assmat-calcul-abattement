/* ============================================================================
   app/ctrl/review.js — « Vérifier le mois » (A.startReview)
   ----------------------------------------------------------------------------
   Plein écran dans « Mon mois » : une semaine à la fois, la photo de la fiche
   zoomée sur les colonnes de la semaine, et la même semaine dans l'outil
   disposée comme la fiche. Une case touchée ouvre la fiche du jour
   (app/ctrl/day.js) ; à sa fermeture, la semaine se redessine (zoom et
   position de la photo gardés), la case marquée « modifiée ». À la fin, le
   mois est marqué « jours vérifiés » et les heures sup. calculées sont
   rappelées, à comparer avec la fiche.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const U = window.ABMAT.utils;
  const Compute = window.ABMAT.compute;
  const F = R.fmt;

  if (!A || !A.openDay || !A.photos || !R.buildReview || !Compute.reviewGrid) {
    throw new Error("app/ctrl/day.js, app/ctrl/photos.js, render/review.js et compute/review.js doivent être chargés avant app/ctrl/review.js.");
  }

  const st = A.state;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const weeksOf = (rv) => Compute.reviewWeeks(rv.year, rv.m, A.loadMonth(rv.year, rv.m), A.todayIso());

  // page : face choisie (null = celle de la semaine) ; photo : zoom et position gardés.
  A.startReview = function startReview(year, m) {
    st.review = { year, m, w: 0, page: null, photo: null, before: clone(A.loadMonth(year, m)), end: false };
    A.photos.ensure(year, m).then(A.render);
    A.render();
    window.scrollTo(0, 0);
  };

  function goWeek(delta) {
    Object.assign(st.review, { w: st.review.w + delta, page: null, photo: null });
    A.render();
    window.scrollTo(0, 0);
  }

  const handlers = {
    onDay: (iso) => A.openDay(iso),
    onPage: (page) => { Object.assign(st.review, { page, photo: null }); A.render(); },
    onTurn: (page) => { st.review.photo = null; A.photos.turn(st.review.year, st.review.m, page); },
    onPick: (page) => A.photos.pick(st.review.year, st.review.m, page),
    onPhoto: (state) => { st.review.photo = state; },
    onPrev: () => goWeek(-1),
    onNext: () => {
      const rv = st.review;
      if (rv.w < weeksOf(rv).length - 1) { goWeek(1); return; }
      const data = A.loadMonth(rv.year, rv.m);
      data.verified = true;
      A.saveMonth(data);
      rv.end = true;
      A.render();
    },
    onQuit: () => { st.review = null; A.render(); window.scrollTo(0, 0); }
  };

  function endModel(rv, data) {
    const hs = A.hsDays(data, A.todayIso());
    return { monthName: F.monthName(rv.m), changed: Compute.changedDays(rv.before, data).length,
      dueMin: hs.reduce((s, d) => s + d.r.dueMin, 0), invalid: hs.filter((d) => d.r.status === "invalid").length };
  }

  /** Prénom affiché de chaque enfant du tableau (accueil relais : prénom du jour). */
  function labels(grid, week, profile) {
    const out = {};
    grid.ids.forEach((id) => {
      const iso = week.find((d) => grid.cells[id][d].presence);
      out[id] = Compute.childLabel(profile, id, grid.cells[id][iso].presence);
    });
    return out;
  }

  /** Dessine la vérification en cours dans la zone principale. */
  A.renderReview = function renderReview(main) {
    const rv = st.review;
    const data = A.loadMonth(rv.year, rv.m);
    if (rv.end) { main.appendChild(R.buildReviewEnd(endModel(rv, data), handlers)); return; }

    const weeks = weeksOf(rv);
    const week = weeks[rv.w];
    const page = rv.page || Compute.weekPage(week);
    const profile = A.profile();
    const grid = Compute.reviewGrid(week, data, rv.before, profile);
    const holidays = U.getFrenchHolidays(rv.year);
    const photos = A.photos.state(rv.year, rv.m);
    main.appendChild(R.buildReview({
      monthName: F.monthName(rv.m), weekIndex: rv.w, weekCount: weeks.length, week, page,
      focus: Compute.weekFocus(week, page), keep: rv.photo, photoUrl: photos ? photos[page] : null,
      table: { week, grid, labels: labels(grid, week, profile), feries: Object.fromEntries(week.map((iso) => [iso, holidays[iso] || null])) }
    }, handlers));
  };
})();
