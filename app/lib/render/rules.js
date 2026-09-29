/* ============================================================================
   render/rules.js — Bloc "Règles appliquées" (année)
   ----------------------------------------------------------------------------
   Objectif :
   - Rendre uniquement le bloc contextuel lié à l’année sélectionnée :
     forfait, formule <8h, SMIC de référence et (année hors barème) saisie
     du SMIC de l'année.
   - Aucune explication longue (elle vit dans render/explain.js).
   - Interactif uniquement si l'année n'est pas au barème de config.js.
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
   * Rend le bloc des règles appliquées pour l'année sélectionnée.
   *
   * @param {HTMLElement} container
   * @param {{year:number, forfaitJour:number|null, smic:number|null, smicInConfig:boolean}} state
   *   smic : SMIC retenu pour l'année (réglage d'année, sinon barème) ;
   *   smicInConfig : l'année figure au barème de config.js.
   * @param {(smic:number|null)=>void} onYearSmicChange - saisie manuelle (année hors barème)
   */
  R.renderYearRules = function renderYearRules(container, state, onYearSmicChange) {
    if (!container) return;
    container.innerHTML = "";

    const year = state.year;

    // Saisie du SMIC uniquement si l'année n'est pas au barème : un seul SMIC
    // par année, enregistré dans les réglages de l'année.
    if (!state.smicInConfig) {
      const row = document.createElement("div");
      row.className = "year-param-row is-rule";
      row.innerHTML =
        `<div class="year-rule-title"><strong>SMIC de l'année</strong> <span class="hint"></span></div>` +
        `<div class="year-param-sub">` +
        `  <label class="inline-label" for="abmat-smic-input"></label> ` +
        `  <input id="abmat-smic-input" type="text" inputmode="decimal" autocomplete="off" placeholder="Ex : 12,02" data-year-smic-input /> ` +
        `  <span class="hint">Cette valeur sert à calculer l’abattement de toute l’année (3 × SMIC par journée de 8 h).</span>` +
        `</div>`;
      row.querySelector(".year-rule-title .hint").textContent = `à saisir pour ${year}`;
      row.querySelector("label").textContent = `SMIC horaire brut au 1er janvier ${year} :`;
      container.appendChild(row);

      const input = row.querySelector("[data-year-smic-input]");
      if (state.smic !== null) input.value = String(state.smic).replace(".", ",");

      input.addEventListener("change", () => {
        const result = U.parseMoneyFR(input.value);
        if (result.status === "invalid") return; // le montant reste affiché tel quel, rien n'est enregistré
        onYearSmicChange(result.status === "ok" ? result.value : null);
      });
    }

    const recapTitle = document.createElement("p");
    recapTitle.className = "year-params-subtitle";
    recapTitle.textContent = `Somme forfaitaire à déduire pour l'année ${year}`;
    container.appendChild(recapTitle);

    const list = document.createElement("ul");
    list.className = "calc-recap-list";
    const item = (html) => { const li = document.createElement("li"); li.innerHTML = html; list.appendChild(li); return li; };

    if (state.forfaitJour === null) {
      item(`<strong>SMIC ${year} manquant</strong> : l’abattement ne peut pas être calculé tant qu’il n’est pas saisi.`);
    } else {
      item(`<strong>Forfait (par enfant, garde ≥ 8h)</strong> : <strong>${U.fmtEuro(state.forfaitJour)}</strong> <span class="hint">(= 3 × SMIC horaire brut au 01/01/${year})</span>`);
      item(`<strong>Forfait (par enfant, garde &lt; 8h)</strong> : <span class="hint">(forfait ÷ 8) × heures de présence</span>`);
      const last = item(`Calcul par jour et par enfant. SMIC au 01/01/${year} : <strong>${U.fmtEuro(state.smic)}</strong>.`);
      last.className = "hint";
    }

    const recap = document.createElement("div");
    recap.className = "calc-recap";
    recap.appendChild(list);
    container.appendChild(recap);
  };
})();