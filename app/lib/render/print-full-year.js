/* ============================================================================
   render/print-full-year.js — Gabarit imprimable : dossier complet
   ----------------------------------------------------------------------------
   Assemble le récapitulatif annuel puis les relevés mensuels renseignés
   (un par page), chacun suivi des photos de sa fiche de présence, en
   réutilisant tels quels les gabarits existants (print-year.js,
   print-month.js, print-photo.js) — aucune mise en page dupliquée.
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.render = window.ABMAT.render || {};

  const R = window.ABMAT.render;

  /**
   * @param {HTMLElement} root
   * @param {Object} recap - Compute.computeYearRecap(year)
   * @param {Array} monthModels - modèles compute/month-print.js des mois renseignés (dans l'ordre),
   *   chacun avec photos : [{side, url}] (fiche de présence)
   * @param {Object} rules - {year, smicLabel, forfaitLabel}
   */
  R.renderPrintFullYear = function renderPrintFullYear(root, recap, monthModels, rules) {
    root.innerHTML = "";
    root.appendChild(R.buildPrintYearSheet(recap, rules));
    (monthModels || []).forEach((model) => {
      root.appendChild(R.buildPrintMonthSheet(model));
      model.photos.forEach((photo) => root.appendChild(R.buildPrintPhotoSheet(model.year, model.monthIndex, photo)));
    });
  };
})();
