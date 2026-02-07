/* ============================================================================
   render/month-summary.js — Récapitulatif du mois (fiche de paie + résultats)
   ----------------------------------------------------------------------------
   Rôle :
   - Affiche 2 boxes :
     1) "À renseigner (fiche de paie)" : net imposable + IRF
     2) "Résultats (calculés)" : total perçu, abattement, montant à déclarer
   - Émet les changements de saisie via onMoneyChange
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

  function numOrNull(v) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const s = v.trim().replace(",", ".");
      if (!s) return null;
      const n = Number.parseFloat(s);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  function safeFmtEuro(v) {
    if (U && typeof U.fmtEuro === "function") return U.fmtEuro(v || 0);
    // Fallback minimal
    return `${(v || 0).toFixed(2)} €`;
  }

  function initialMoneyFromState(state) {
    const net =
      (state && (state.monthNet ?? state.netImposable ?? state.net ?? state.payslipNetImposable)) ??
      0;
    const irf =
      (state && (state.monthIrf ?? state.irf ?? state.payslipIrf)) ??
      0;
    return {
      net: (typeof net === "number" && Number.isFinite(net)) ? net : 0,
      irf: (typeof irf === "number" && Number.isFinite(irf)) ? irf : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // 4) Récapitulatif du mois (mensuel)
  // ---------------------------------------------------------------------------

  /**
   * Rendu de la box "À renseigner (fiche de paie)".
   * @param {Object} state
   * @returns {HTMLDivElement}
   */
  R.renderMonthSummaryInputsBox = function renderMonthSummaryInputsBox(state) {
    const box = document.createElement("div");
    box.className = "summary-section summary-section--input";

    box.innerHTML =
      `<div class="summary-section__title"><strong>À renseigner (fiche de paie)</strong></div>` +
      `<p class="hint summary-help">Ces montants ne viennent pas du tableau : saisissez-les tels qu’ils apparaissent sur votre fiche de paie.</p>` +
      `<div class="year-param-row summary-row">` +
      `  <label class="inline-label" for="abmat-net">Revenu net imposable :</label>` +
      `  <input id="abmat-net" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00" />` +
      `  <div class="hint summary-sub">Montant "net imposable" du mois.</div>` +
      `</div>` +
      `<div class="year-param-row summary-row">` +
      `  <label class="inline-label" for="abmat-irf">Indemnités représentatives de frais (IRF) :</label>` +
      `  <input id="abmat-irf" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00" />` +
      `  <div class="hint summary-sub">Si vous n’en avez pas, laissez 0.</div>` +
      `</div>` +
      `<div class="summary-warning hint" data-summary-warning style="display:none"></div>`;

    // Pré-remplit si on a déjà des valeurs
    const money = initialMoneyFromState(state);
    const netEl = box.querySelector("#abmat-net");
    const irfEl = box.querySelector("#abmat-irf");
    if (netEl) netEl.value = String(money.net || 0);
    if (irfEl) irfEl.value = String(money.irf || 0);

    return box;
  };

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

    // Deux box distinctes
    const inputsBox = R.renderMonthSummaryInputsBox(state);
    const resultsBox = R.renderMonthSummaryResultsBox();
    container.appendChild(inputsBox);
    container.appendChild(resultsBox);

    const netEl = inputsBox.querySelector("#abmat-net");
    const irfEl = inputsBox.querySelector("#abmat-irf");

    const emit = () => {
      const net = numOrNull(netEl ? netEl.value : "") ?? 0;
      const irf = numOrNull(irfEl ? irfEl.value : "") ?? 0;

      if (typeof onMoneyChange === "function") {
        // Compat: certains handlers attendent (net, irf), d'autres un objet
        if (onMoneyChange.length >= 2) onMoneyChange(net, irf);
        else onMoneyChange({ net, irf });
      }
    };

    if (netEl) {
      netEl.addEventListener("change", emit);
      netEl.addEventListener("blur", emit);
    }
    if (irfEl) {
      irfEl.addEventListener("change", emit);
      irfEl.addEventListener("blur", emit);
    }
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
