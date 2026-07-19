/* ============================================================================
   render/rules.js — Bloc "Règles appliquées" (année)
   ----------------------------------------------------------------------------
   Objectif :
   - Rendre uniquement le bloc contextuel lié à l’année sélectionnée :
     forfait, formule <8h, SMIC de référence et (si manquant) saisie SMIC.
   - Aucune explication longue (elle vit dans render/explain.js).
   - Interactif uniquement si SMIC manquant dans config.
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

  /**
   * Rend le bloc des règles appliquées pour l’année sélectionnée.
   *
   * @param {HTMLElement} container
   * @param {Object} state {year:number, forfaitJour:number, smicOverride?:number|null}
   * @param {()=>{smicFromConfig:number|null, smicEffective:number|null}} getSmicInfo
   * @param {(smicOverride:number|null)=>void} onSmicOverrideChange
   */
  R.renderYearRules = function renderYearRules(container, state, getSmicInfo, onSmicOverrideChange) {
    if (!container) return;
    container.innerHTML = "";

    const year = Number.isFinite(Number(state && state.year)) ? Number(state.year) : (new Date()).getFullYear();
    const forfaitJour = Number.isFinite(Number(state && state.forfaitJour)) ? Number(state.forfaitJour) : 0;

    const info = getSmicInfo ? getSmicInfo() : { smicFromConfig: null, smicEffective: null };
    const smicFromConfig = (typeof info.smicFromConfig === "number" && Number.isFinite(info.smicFromConfig)) ? info.smicFromConfig : null;

    const smicOverride = (typeof (state && state.smicOverride) === "number" && Number.isFinite(state.smicOverride))
      ? state.smicOverride
      : null;

    // Saisie du SMIC uniquement si absent de la config
    if (typeof smicFromConfig !== "number") {
      const smicMissing = document.createElement("div");
      smicMissing.className = "year-param-row is-rule";
      smicMissing.innerHTML =
        `<div class="year-rule-title"><strong>SMIC manquant</strong> <span class="hint">pour l’année ${year}</span></div>` +
        `<div class="year-param-sub">` +
        `  <label class="inline-label" for="abmat-smic-input">Saisir le SMIC horaire brut au 1er janvier ${year} :</label> ` +
        `  <input id="abmat-smic-input" type="text" inputmode="decimal" autocomplete="off" placeholder="Ex : 12,02" data-year-smic-input /> ` +
        `  <span class="hint">Cette valeur sert à calculer le forfait journalier (3 × SMIC).</span>` +
        `</div>`;
      container.appendChild(smicMissing);

      if (typeof smicOverride === "number") {
        const note = document.createElement("p");
        note.className = "hint";
        note.textContent = `Valeur manuelle enregistrée : ${smicOverride.toFixed(2)} €`;
        smicMissing.appendChild(note);
      }

      const smicInput = container.querySelector("[data-year-smic-input]");
      if (smicInput) {
        if (typeof smicOverride === "number") {
          smicInput.value = String(smicOverride).replace(".", ",");
        }

        const apply = () => {
          const raw0 = String(smicInput.value || "").trim();

          // Champ vide => on enlève l'override
          if (!raw0) {
            onSmicOverrideChange && onSmicOverrideChange(null);
            return;
          }

          // Accepte virgule ou point
          const norm = raw0.replace(",", ".");
          const v = Number.parseFloat(norm);

          // Si pas encore parseable, on ne force pas
          if (!Number.isFinite(v)) return;

          onSmicOverrideChange && onSmicOverrideChange(v);
        };

        // Ne pas re-render à chaque frappe
        smicInput.addEventListener("change", apply);
        smicInput.addEventListener("blur", apply);
      }
    }

    // Récap des règles (écran + PDF)
    const recapTitle = document.createElement("p");
    recapTitle.className = "year-params-subtitle";
    recapTitle.textContent = `Somme forfaitaire à déduire pour l'année ${year}`;
    container.appendChild(recapTitle);

    const recap = document.createElement("div");
    recap.className = "calc-recap";

    const smicLabel = (typeof smicFromConfig === "number")
      ? `${smicFromConfig.toFixed(2)} €`
      : "non renseigné";

    recap.innerHTML =
      `<ul class="calc-recap-list">` +
      `  <li><strong>Forfait (par enfant, garde ≥ 8h)</strong> : <strong>${U.fmtEuro(forfaitJour)}</strong> <span class="hint">(= 3 × SMIC horaire brut au 01/01/${year})</span></li>` +
      `  <li><strong>Forfait (par enfant, garde &lt; 8h)</strong> : <span class="hint">(forfait ÷ 8) × heures de présence</span></li>` +
      `  <li class="hint">Calcul par jour et par enfant. SMIC au 01/01/${year} : <strong>${smicLabel}</strong>.</li>` +
      `</ul>`;

    container.appendChild(recap);
  };
})();