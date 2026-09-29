/* ============================================================================
   app/ctrl/onboarding.js — Mise en route guidée (A.startOnboarding)
   ----------------------------------------------------------------------------
   Plein écran, sans les onglets : sur téléphone, d'abord « Installez
   AB’assmat » (app/ctrl/install.js) ; puis accueil (0), Vous (1), les enfants (2,
   app/ctrl/onboarding-kids.js), l'année (3), les mois passés (4), la copie de
   secours (5), c'est prêt (6). L'étape atteinte est mémorisée
   (abmat:ui:onboarding) : « Plus tard » ramène à l'outil, une carte sur
   « Aujourd'hui » propose de reprendre. Tout ce qui est rempli est enregistré
   aussitôt, rien n'est jamais écrasé (seuls les mois vides sont remplis).
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const S = window.ABMAT.storage;
  const U = window.ABMAT.utils;
  const Compute = window.ABMAT.compute;
  const F = R.fmt;

  if (!A || !A.onbKids || !A.onbSteps || !A.install || !R.buildOnbFrame) {
    throw new Error("app/ctrl/onboarding-kids.js, app/ctrl/onboarding-steps.js, app/ctrl/install.js et render/onboarding.js doivent être chargés avant app/ctrl/onboarding.js.");
  }

  let hidden = false; // carte de reprise masquée jusqu'au prochain lancement
  const B = A.backup;
  const saved = () => S.loadOnboarding();
  const thisYear = () => U.isoToDate(A.todayIso()).getFullYear();

  /** @param {number} step @param {"before"} [phase] - étape 2 : revenir aux enfants partis */
  function go(step, phase) {
    S.saveOnboarding({ step, done: saved().done });
    if (step === 2) A.onbKids.enter(phase || "now");
    A.onbSteps.enter(step);
    A.render();
    window.scrollTo(0, 0);
  }

  /** Ouvre la mise en route (à l'étape mémorisée, ou à celle indiquée). */
  A.startOnboarding = function startOnboarding(step) {
    A.state.onboarding = true;
    go(step === undefined ? saved().step : step);
  };

  function leave(done) {
    if (done) S.saveOnboarding({ step: 6, done: true });
    A.state.onboarding = false;
    A.go("today");
  }

  // --- Accueil, fin, rendu ------------------------------------------------------------

  function doneModel() {
    const y = thisYear();
    const profile = A.profile();
    const kids = profile.children.filter((c) => !c.to || c.to >= `${y}-01-01`).length;
    const smic = Compute.smicForYear(y);
    const months = A.storedMonths().filter((x) => x.year === y && !S.isBlankMonth(A.loadMonth(y, x.monthIndex))).length;
    return { firstName: profile.firstName, chips: [
      F.plural(kids, "enfant"), smic === null ? null : `SMIC ${F.euro(smic)}`,
      months ? `${F.plural(months, "mois", "mois")} préparé${months > 1 ? "s" : ""}` : null,
      A.onbSteps.backupDone() ? (B.manual ? "copie envoyée" : "copie automatique") : null,
      S.loadYearSettings(y).relais ? "accueil relais" : null
    ].filter(Boolean) };
  }

  const STEPS = {
    1: () => ({
      title: "Vous", lead: "Votre nom apparaît en haut des documents imprimés, pour qu'ils soient présentables en cas de contrôle.",
      body: R.buildOnbMe(A.profile(), { onIdentity: (key, v) => { const p = A.profile(); p[key] = v.trim(); A.saveProfile(p); } }),
      next: { label: "Continuer", onClick: () => go(2) }, onBack: () => go(0)
    }),
    2: () => A.onbKids.frame(go)
  };

  A.renderOnboarding = function renderOnboarding(main) {
    const step = saved().step;
    if (step === 0 && A.install.shouldAsk()) { main.appendChild(A.install.build()); return; }
    if (step === 0) {
      main.appendChild(R.buildOnbWelcome({ childrenCount: A.profile().children.length }, { onStart: () => go(1), onRestore: B.importFile, onFinish: () => leave(true) }));
      return;
    }
    if (step >= 6) { main.appendChild(R.buildOnbDone(doneModel(), { onFinish: () => leave(true) })); return; }
    const frame = step <= 2 ? STEPS[step]() : A.onbSteps.frame(step, go);
    main.appendChild(R.buildOnbFrame(Object.assign({ step, onLater: () => leave(false) }, frame)));
  };

  /** Carte « La mise en route vous attend » (Aujourd'hui), ou null. */
  A.onboardingCard = function onboardingCard() {
    const s = saved();
    if (s.done || s.step < 1 || hidden) return null;
    return R.buildOnbResume({ step: Math.min(s.step, 5) }, {
      onResume: () => A.startOnboarding(s.step),
      onHide: () => { hidden = true; A.render(); }
    });
  };
})();
