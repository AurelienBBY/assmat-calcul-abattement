/* ============================================================================
   render/payslip-inputs.js — Saisie fiche de paie (mensuel)
   ----------------------------------------------------------------------------
   Rôle :
   - Affiche la box "À renseigner (fiche de paie)" :
     - Revenu net imposable
     - Indemnités représentatives de frais (IRF)
   - Émet les changements via onMoneyChange

   Attendus dans le DOM :
   - Le conteneur passé en paramètre (la box est rendue à l'intérieur)

   Dépendances :
   - window.ABMAT.render (R) — initialisé par render/index.js
   - window.ABMAT.utils (U) — helpers divers (fmt, etc.)
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

  function initialMoneyFromState(state) {
    // Compat : on accepte plusieurs clés possibles
    const net =
      (state && (state.netImposable ?? state.net ?? state.monthNet ?? state.payslipNetImposable)) ??
      0;
    const irf = (state && (state.irf ?? state.monthIrf ?? state.payslipIrf)) ?? 0;

    return {
      net: (typeof net === "number" && Number.isFinite(net)) ? net : 0,
      irf: (typeof irf === "number" && Number.isFinite(irf)) ? irf : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Payslip inputs
  // ---------------------------------------------------------------------------

  /**
   * Crée la box DOM "À renseigner (fiche de paie)".
   * @param {Object} state
   * @returns {HTMLDivElement}
   */
  R.renderPayslipInputsBox = function renderPayslipInputsBox(state) {
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

    // Pré-remplissage
    const money = initialMoneyFromState(state);
    const netEl = box.querySelector("#abmat-net");
    const irfEl = box.querySelector("#abmat-irf");
    if (netEl) netEl.value = String(money.net || 0);
    if (irfEl) irfEl.value = String(money.irf || 0);

    return box;
  };

  /**
   * Rend la box dans un conteneur et branche les listeners.
   * @param {HTMLElement} container
   * @param {Object} state
   * @param {(a:any,b?:any)=>void} onMoneyChange
   */
  R.renderPayslipInputs = function renderPayslipInputs(container, state, onMoneyChange) {
    if (!container) return;
    container.innerHTML = "";

    const box = R.renderPayslipInputsBox(state);
    container.appendChild(box);

    const netEl = box.querySelector("#abmat-net");
    const irfEl = box.querySelector("#abmat-irf");

    // Garde anti double-bind (si re-render)
    const root = box;
    if (root && root.dataset && root.dataset.abmatBound === "1") return;
    if (root && root.dataset) root.dataset.abmatBound = "1";

    const emit = () => {
      const net = numOrNull(netEl ? netEl.value : "") ?? 0;
      const irf = numOrNull(irfEl ? irfEl.value : "") ?? 0;

      if (typeof onMoneyChange === "function") {
        // On envoie un objet explicite (recommandé)
        onMoneyChange({ netImposable: net, irf });
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

  // ---------------------------------------------------------------------------
  // Compat : anciens noms pendant la refacto
  // ---------------------------------------------------------------------------

  // Ancien helper utilisé dans month-summary.js (avant découpage)
  R.renderMonthSummaryInputsBox = R.renderMonthSummaryInputsBox || R.renderPayslipInputsBox;

})();
