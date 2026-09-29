/* ============================================================================
   app.js — Démarrage
   ----------------------------------------------------------------------------
   Relie les 4 onglets (en haut sur ordinateur, en bas sur iPhone), la
   pastille de copie de secours et l'aide, puis ouvre l'onglet de départ :
   la mise en route au premier lancement (aucune donnée), « Aujourd'hui » sur
   téléphone (la pointeuse), « Mon mois » sur ordinateur. Tout le reste :
   app/ctrl/*.
   Aucun serveur, aucun réseau : tout fonctionne hors ligne.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT && window.ABMAT.app;
  const R = window.ABMAT && window.ABMAT.render;
  const U = window.ABMAT && window.ABMAT.utils;
  const S = window.ABMAT && window.ABMAT.storage;

  if (!A || !A.views.today || !A.views.month || !A.views.year || !A.views.profile || !A.backup.init || !A.print || !A.startOnboarding) {
    throw new Error("Modules ABMAT manquants : vérifiez l'ordre des <script> dans index.html.");
  }

  /** Aide : revoir la mise en route, et « Points d'attention » (page séparée, chargée à la demande). */
  A.openHelp = function openHelp() {
    R.openSheet({ title: "Points d'attention", wide: true, body: [
      A.state.onboarding ? null : R.h("div", { class: "row" }, R.h("button", { type: "button", class: "btn", text: "Revoir la mise en route",
        on: { click: () => { R.closeSheet(); A.startOnboarding(1); } } })),
      R.h("iframe", { src: "app/modals/reference.html", title: "Points d'attention" })
    ] });
  };

  U.forceFrenchLocale();
  document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => A.go(b.dataset.tab)));
  document.getElementById("backup-pill").addEventListener("click", A.backup.openMenu);
  document.getElementById("help-btn").addEventListener("click", A.openHelp);

  const phone = window.matchMedia("(max-width: 640px)").matches;
  A.state.onboarding = !S.loadOnboarding().done && !A.hasAnyData();
  A.go(phone || !A.hasAnyData() ? "today" : "month");
  A.backup.init();

  // PWA : service worker (uniquement en http/https — pas en double-clic local)
  // + stockage déclaré persistant (protège de l'éviction automatique).
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch((e) => {
      console.warn("Service worker non enregistré :", e);
    });
  }
  if (navigator.storage && typeof navigator.storage.persist === "function") {
    navigator.storage.persist();
  }
})();
