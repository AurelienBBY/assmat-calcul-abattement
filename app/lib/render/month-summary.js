/* ============================================================================
   render/month-summary.js — Résultats du mois (calculés)
   ----------------------------------------------------------------------------
   Rôle :
   - Affiche la box "Résultats (calculés)" : total perçu, abattement, montant à déclarer
   - Met à jour les montants calculés via updateMonthSummaryComputed

   Dépendances :
   - window.ABMAT.render (R) — initialisé par render/index.js
   - window.ABMAT.utils (U) — fmtEuro, MONTHS_FR, helpers divers
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
  // Helpers
  // ---------------------------------------------------------------------------

  function safeFmtEuro(v) {
    if (U && typeof U.fmtEuro === "function") return U.fmtEuro(v || 0);
    // Fallback minimal
    return `${(v || 0).toFixed(2)} €`;
  }

  // ---------------------------------------------------------------------------
  // 4) Récapitulatif du mois (mensuel)
  // ---------------------------------------------------------------------------

  /**
   * Rendu de la box "Résultats (calculés)".
   * @returns {HTMLDivElement}
   */
  R.renderMonthSummaryResultsBox = function renderMonthSummaryResultsBox() {
    const box = document.createElement("div");
    box.className = "summary-section summary-section--results";

    box.innerHTML =
      `<div class="summary-section__title"><strong>Résultats (calculés)</strong></div>` +
      `<div class="year-param-row summary-row">` +
      `  <span><strong>Total perçu</strong> <span class="hint">(net + IRF, avant abattement)</span> :</span>` +
      `  <span data-month-percu>—</span>` +
      `</div>` +
      `<div class="year-param-row summary-row">` +
      `  <span><strong>Abattement total calculé</strong> :</span>` +
      `  <span data-month-abatt>—</span>` +
      `</div>` +
      `<div class="summary-result" role="status" aria-live="polite">` +
      `  <div class="summary-result__label">Montant à déclarer <span class="hint">(après abattement)</span></div>` +
      `  <div class="summary-result__value" data-month-declare>—</div>` +
      `</div>` +
      `<div class="year-param-row summary-row summary-row--muted">` +
      `  <span>Revenu imposable après abattement :</span>` +
      `  <span data-month-imposable>—</span>` +
      `</div>` +
      `<p class="hint">Le montant à déclarer ne peut pas être négatif.</p>`;

    return box;
  };

  /**
   * Rendu du récapitulatif du mois.
   * @param {HTMLElement} container
   * @param {Object} state
   * @param {(a:any,b?:any)=>void} onMoneyChange
   */
  R.renderMonthSummary = function renderMonthSummary(container, state, onMoneyChange) {
    if (!container) return;
    container.innerHTML = "";

    const title = document.createElement("h3");
    title.className = "summary-title";
    if (U && Array.isArray(U.MONTHS_FR) && Number.isFinite(Number(state && state.monthIndex))) {
      const m = U.MONTHS_FR[state.monthIndex] || "";
      title.textContent = `Récapitulatif — ${m} ${state.year}`.trim();
    } else {
      title.textContent = "Récapitulatif";
    }
    container.appendChild(title);

    // Box unique : résultats calculés
    const resultsBox = R.renderMonthSummaryResultsBox();
    container.appendChild(resultsBox);
  };

  /**
   * Met à jour les montants calculés (mensuel).
   * @param {HTMLElement} container
   * @param {Object} computed {abatt, percu, imposable}
   */
  R.updateMonthSummaryComputed = function updateMonthSummaryComputed(container, computed) {
    if (!container) return;

    const abattEl = container.querySelector("[data-month-abatt]");
    const percuEl = container.querySelector("[data-month-percu]");
    const imposableEl = container.querySelector("[data-month-imposable]");
    const declareEl = container.querySelector("[data-month-declare]");

    const abatt = computed && typeof computed.abatt === "number" ? computed.abatt : 0;
    const percu = computed && typeof computed.percu === "number" ? computed.percu : 0;
    const imposable = computed && typeof computed.imposable === "number" ? computed.imposable : 0;

    if (abattEl) abattEl.textContent = safeFmtEuro(abatt);
    if (percuEl) percuEl.textContent = safeFmtEuro(percu);
    if (imposableEl) imposableEl.textContent = safeFmtEuro(imposable);
    if (declareEl) declareEl.textContent = safeFmtEuro(imposable);
  };
})();
