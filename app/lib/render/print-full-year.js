/* ============================================================================
   render/print-full-year.js — Gabarit imprimable : dossier complet
   ----------------------------------------------------------------------------
   Assemble le récapitulatif annuel puis les relevés mensuels renseignés
   (un par page), en réutilisant tels quels les gabarits existants
   (print-year.js / print-month.js) — aucune mise en page dupliquée.
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.render = window.ABMAT.render || {};

  const R = window.ABMAT.render;

  /**
   * @param {HTMLElement} root
   * @param {Object} recap - Compute.computeYearRecap(year)
   * @param {Array} monthModels - modèles compute/month-print.js des mois renseignés (dans l'ordre)
   * @param {Object} rules - {year, smicLabel, forfaitLabel}
   */
  R.renderPrintFullYear = function renderPrintFullYear(root, recap, monthModels, rules) {
    root.innerHTML = "";
    root.appendChild(R.buildPrintYearSheet(recap, rules));
    (monthModels || []).forEach((model) => {
      root.appendChild(R.buildPrintMonthSheet(model));
    });
  };
})();
