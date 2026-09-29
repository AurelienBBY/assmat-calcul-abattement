/* ============================================================================
   app/ctrl/install.js — Installer AB’assmat sur l'écran d'accueil (A.install)
   ----------------------------------------------------------------------------
   Avant la mise en route, sur iPhone et Android seulement, et jamais quand
   l'outil est déjà ouvert depuis son icône. Android (Chrome) : la fenêtre
   d'installation est gardée dès son annonce (beforeinstallprompt) pour la
   proposer par un vrai bouton. « Continuer sans installer » est mémorisé.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const S = window.ABMAT.storage;
  const Compute = window.ABMAT.compute;

  if (!A || !R.buildInstall || !S.installSkipped || !Compute.installTarget) {
    throw new Error("render/install.js, storage/device.js et compute/onboarding.js doivent être chargés avant app/ctrl/install.js.");
  }

  let prompt = null; // fenêtre d'installation de Chrome (Android)
  let done = false;  // installée, ou « C'est fait » (iPhone)

  const target = () => Compute.installTarget({
    ua: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints || 0,
    standalone: window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true
  });

  const redraw = () => { if (A.state.onboarding) A.render(); };

  window.addEventListener("beforeinstallprompt", (e) => {
    if (target() !== "android") return; // ordinateur : Chrome garde son propre bouton
    e.preventDefault();
    prompt = e;
    redraw();
  });
  window.addEventListener("appinstalled", () => { prompt = null; done = true; redraw(); });

  const handlers = {
    onPrompt: async () => {
      const p = prompt;
      prompt = null;
      await p.prompt();
      const choice = await p.userChoice;
      if (choice.outcome === "accepted") done = true;
      A.render();
    },
    onDone: () => { done = true; A.render(); window.scrollTo(0, 0); },
    onSkip: () => { S.skipInstall(); A.render(); window.scrollTo(0, 0); }
  };

  A.install = {
    /** L'écran « Installez d'abord AB’assmat » est-il à montrer ? */
    shouldAsk: () => ["ios", "android"].includes(target()) && !S.installSkipped(),
    build: () => R.buildInstall({ target: target(), canPrompt: Boolean(prompt), state: done ? "done" : null }, handlers)
  };
})();
