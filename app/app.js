/* ============================================================================
   app.js — Démarrage
   ----------------------------------------------------------------------------
   Relie les 4 onglets (en haut sur ordinateur, en bas sur iPhone), la
   pastille de copie de secours et l'aide, puis ouvre l'onglet de départ :
   « Aujourd'hui » sur téléphone (la pointeuse) et au premier lancement
   (bienvenue), « Mon mois » sur ordinateur. Tout le reste : app/ctrl/*.
   Aucun serveur, aucun réseau : tout fonctionne hors ligne.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT && window.ABMAT.app;
  const R = window.ABMAT && window.ABMAT.render;
  const U = window.ABMAT && window.ABMAT.utils;

  if (!A || !A.views.today || !A.views.month || !A.views.year || !A.views.profile || !A.backup.init || !A.print) {
    throw new Error("Modules ABMAT manquants : vérifiez l'ordre des <script> dans index.html.");
  }

  /** Fiche « Points d'attention » (page séparée, chargée à la demande). */
  A.openHelp = function openHelp() {
    R.openSheet({ title: "Points d'attention", wide: true, body: R.h("iframe", { src: "app/modals/reference.html", title: "Points d'attention" }) });
  };

  U.forceFrenchLocale();
  document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => A.go(b.dataset.tab)));
  document.getElementById("backup-pill").addEventListener("click", A.backup.openMenu);
  document.getElementById("help-btn").addEventListener("click", A.openHelp);

  const phone = window.matchMedia("(max-width: 640px)").matches;
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
