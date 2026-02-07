/* ============================================================================
   render/footer.js — Date de génération (footer)
   ----------------------------------------------------------------------------
   Rôle :
   - Met à jour l'affichage de la date de génération du document
   - Formatage en français (JJ/MM/AAAA)

   Attendu dans le DOM :
   - #generated-date

   Dépendances :
   - window.ABMAT.render (R) — initialisé par render/index.js
   - window.ABMAT.utils (U) — formatDateFR
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.render = window.ABMAT.render || {};

  const R = window.ABMAT.render;
  const U = window.ABMAT.utils;

  if (!U) {
    throw new Error("ABMAT.utils est requis avant ABMAT.render (charger utils.js en premier).");
  }

  // ---------------------------------------------------------------------------
  // 6) Date de génération (footer)
  // ---------------------------------------------------------------------------

  R.renderGeneratedDate = function renderGeneratedDate() {
    const el = document.getElementById("generated-date");
    if (!el) return;
    el.textContent = U.formatDateFR(new Date());
  };

})();
