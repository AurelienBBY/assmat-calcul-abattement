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

  function getMonthLabelLower(state) {
    try {
      const idx = state && typeof state.monthIndex === "number" ? state.monthIndex : null;
      if (idx === null) return "";
      const months = U && Array.isArray(U.MONTHS_FR) ? U.MONTHS_FR : null;
      const label = months && months[idx] ? String(months[idx]) : "";
      return label ? label.toLowerCase() : "";
    } catch (e) {
      return "";
    }
  }

  // ---------------------------------------------------------------------------
  // 4) Récapitulatif du mois (mensuel)
  // ---------------------------------------------------------------------------

  /**
   * Rendu de la box "Résultats (calculés)".
   * @returns {HTMLDivElement}
   */
  R.renderMonthSummaryResultsBox = function renderMonthSummaryResultsBox(state) {
    const box = document.createElement("div");

    // IMPORTANT: pas de sous-carte ici. La section HTML est déjà la carte principale.
    box.className = "month-results";

    const monthLabel = getMonthLabelLower(state);
    const monthSuffix = monthLabel ? ` de ${monthLabel}` : "";

    box.innerHTML =
      `<div class="summary-result" role="status" aria-live="polite">` +
      `  <div class="summary-result__label">Revenu imposable après abattement</div>` +
      `  <div class="hint">À reporter sur votre déclaration.</div>` +
      `  <div class="summary-result__value" data-month-imposable>—</div>` +
      `  <div class="summary-result__note" data-month-percu-note></div>` +
      `  <button type="button" class="btn btn-primary summary-result__print" data-toolbar-action="print">` +
      `    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>` +
      `    Imprimer ce mois` +
      `  </button>` +
      `</div>` +
      `<div class="month-details" aria-label="Détails du calcul">` +
      `  <div class="month-details__title">Détails</div>` +
      `  <div class="year-param-row summary-row">` +
      `    <span>` +
      `      <strong>Total perçu</strong>` +
      `      <span class="hint">Net + IRF, avant abattement.</span>` +
      `    </span>` +
      `    <span data-month-percu>—</span>` +
      `  </div>` +
      `  <div class="year-param-row summary-row">` +
      `    <span>` +
      `      <strong>Abattement total pour le mois${monthSuffix}</strong>` +
      `      <span class="hint">Somme des abattements calculés sur le tableau.</span>` +
      `    </span>` +
      `    <span data-month-abatt>—</span>` +
      `  </div>` +
      `  <p class="hint month-details__note">Le revenu imposable après abattement ne peut pas être négatif.</p>` +
      `</div>`;
      
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

    // Box unique : résultats calculés (la section parente porte déjà le titre du mois)
    const resultsBox = R.renderMonthSummaryResultsBox(state);
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
    const noteEl = container.querySelector("[data-month-percu-note]");

    const abatt = computed && typeof computed.abatt === "number" ? computed.abatt : 0;
    const percu = computed && typeof computed.percu === "number" ? computed.percu : 0;
    const imposable = computed && typeof computed.imposable === "number" ? computed.imposable : 0;

    if (abattEl) abattEl.textContent = safeFmtEuro(abatt);
    if (percuEl) percuEl.textContent = safeFmtEuro(percu);
    if (imposableEl) imposableEl.textContent = safeFmtEuro(imposable);
    if (noteEl) {
      if (percu > 0 && imposable < percu) {
        // La comparaison ne parle que si un abattement réduit réellement le perçu.
        noteEl.textContent = `au lieu de ${safeFmtEuro(percu)} perçus`;
      } else if (percu === 0 && abatt > 0) {
        // Des jours saisis mais pas de fiche de paie : un 0 € serait trompeur.
        noteEl.textContent = "Renseignez votre fiche de paie pour obtenir le montant à déclarer.";
      } else {
        noteEl.textContent = "";
      }
    }
  };
})();
