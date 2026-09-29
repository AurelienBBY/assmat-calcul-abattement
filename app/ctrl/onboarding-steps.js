/* ============================================================================
   app/ctrl/onboarding-steps.js — Mise en route, étapes 3 à 5 (A.onbSteps)
   ----------------------------------------------------------------------------
   L'année (SMIC du 1er janvier confirmé d'un geste, accueil relais), les mois
   passés (seuls les mois encore vides sont remplis avec les horaires
   habituels), la copie de secours (premier envoi, ou dossier sur ordinateur).
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const S = window.ABMAT.storage;
  const U = window.ABMAT.utils;
  const Compute = window.ABMAT.compute;
  const CFG = window.ABMAT_CONFIG;
  const F = R.fmt;

  if (!A || !A.backup || !A.backup.openSending || !R.buildOnbYear || !Compute.pastMonthsPlan) {
    throw new Error("app/ctrl/backup-send.js, render/onb-steps.js et compute/onboarding.js doivent être chargés avant app/ctrl/onboarding-steps.js.");
  }

  const ui = { year: null, past: null, backupLater: false };
  const B = A.backup;
  const thisYear = () => U.isoToDate(A.todayIso()).getFullYear();
  const listFr = (names) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}` : names.join(""));
  const dayMonth = (iso) => F.dateFr(iso).replace(/ \d{4}$/, "");

  // --- Étape 3 : l'année ----------------------------------------------------------

  function enterYear() {
    const y = thisYear();
    const settings = S.loadYearSettings(y);
    const known = CFG.getSmicHoraireBrut(y);
    ui.year = { year: y, known, relais: settings.relais, smic: settings.smic !== null ? settings.smic : known,
      fix: settings.smic !== null && settings.smic !== known };
  }

  function yearStep(go) {
    const m = ui.year;
    const free = m.fix || m.known === null;
    return {
      title: `L'année ${m.year}`,
      body: R.buildOnbYear(Object.assign({ forfaitOf: (v) => CFG.computeForfaitJourFromSmic(v, CFG.coefficient) }, m), {
        onFix: (on) => { m.fix = on; if (!on) m.smic = m.known; A.render(); },
        onSmic: (v) => { m.smic = v; const next = document.querySelector(".onb-foot .btn-primary"); if (next) next.disabled = (v === null); },
        onRelais: (on) => { m.relais = on; }
      }),
      next: { label: "Continuer", disabled: free && m.smic === null, onClick: () => {
        // SMIC confirmé : le barème de l'outil (null) ; corrigé : la valeur saisie.
        A.saveYearSettings({ year: m.year, smic: free ? m.smic : null, relais: m.relais });
        go(4);
      } },
      onBack: () => go(2, "before")
    };
  }

  // --- Étape 4 : les mois passés ----------------------------------------------------

  function enterPast() {
    const cur = U.isoToDate(A.todayIso()).getMonth();
    ui.past = { choice: cur > 0 ? "jan" : "cur", from: 1, cur };
  }

  function plan() {
    const m = ui.past;
    if (m.choice === "none") return [];
    const first = { jan: 0, from: m.from, cur: m.cur }[m.choice];
    const y = thisYear();
    return Compute.pastMonthsPlan(y, first, m.cur, A.profile(), (i) => S.isBlankMonth(A.loadMonth(y, i)));
  }

  function pastStep(go) {
    const m = ui.past;
    const y = thisYear();
    const p = plan();
    const profile = A.profile();
    const inYear = profile.children.filter((c) => (!c.to || c.to >= `${y}-01-01`) && (!c.from || c.from <= A.todayIso()));
    const extras = inYear.filter((c) => c.to && c.to < A.todayIso()).map((c) => `${c.name} jusqu'au ${dayMonth(c.to)}`)
      .concat(inYear.filter((c) => c.periods.length > 1 && c.periods[1].from >= `${y}-01-01`).map((c) => `${c.name} avec ses anciens horaires avant le ${dayMonth(c.periods[1].from)}`));
    const days = p.reduce((s, x) => s + Object.keys(x.days).length, 0);
    return {
      title: "Les mois déjà passés",
      body: R.buildOnbPast({
        todayText: dayMonth(A.todayIso()), names: listFr(inYear.map((c) => c.name)), cur: m.cur, choice: m.choice, from: m.from,
        summary: { months: p.length, days, extras: p.length ? extras : [] }
      }, {
        onChoice: (v) => { m.choice = v; A.render(); },
        onFrom: (v) => { m.from = v; A.render(); }
      }),
      next: { label: p.length ? `Remplir ${F.plural(p.length, "mois", "mois")}` : "Continuer", onClick: () => {
        p.forEach((x) => { const data = A.loadMonth(y, x.monthIndex); data.days = x.days; A.saveMonth(data); });
        go(5);
      } },
      onBack: () => go(3)
    };
  }

  // --- Étape 5 : la copie de secours -------------------------------------------------

  const backupDone = () => (B.manual ? Boolean(B.sync.lastSentAt) && !B.sync.pending.length : B.autoStatus === "ready");

  function backupStep(go) {
    const done = backupDone();
    const state = done ? "done" : (ui.backupLater ? "later" : "todo");
    const act = B.manual ? { label: "Envoyer ma copie", onClick: () => B.openSending() } : { label: "Choisir le dossier", onClick: () => B.chooseFolder() };
    return {
      title: "La copie de secours",
      body: R.buildOnbBackup({ manual: B.manual, state }),
      next: done ? { label: "Continuer", onClick: () => go(6) } : act,
      extra: done ? null : (ui.backupLater
        ? R.h("button", { type: "button", class: "btn", text: "Continuer sans copie", on: { click: () => go(6) } })
        : R.h("button", { type: "button", class: "btn btn-quiet", text: "Je le ferai plus tard", on: { click: () => { ui.backupLater = true; A.render(); } } })),
      onBack: () => go(4)
    };
  }

  A.onbSteps = {
    /** Prépare l'étape au moment d'y entrer (valeurs enregistrées ou proposées). */
    enter: (step) => { if (step === 3) enterYear(); if (step === 4) enterPast(); },
    frame: (step, go) => {
      if (step === 3 && !ui.year) enterYear();
      if (step === 4 && !ui.past) enterPast();
      return { 3: yearStep, 4: pastStep, 5: backupStep }[step](go);
    },
    backupDone
  };
})();
