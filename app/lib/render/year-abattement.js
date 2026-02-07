/* ============================================================================
   render/year-abattement.js — Abattement : règles de l’année (SMIC / forfait)
   ----------------------------------------------------------------------------
   Rôle :
   - Affiche le récapitulatif des règles appliquées pour l'année sélectionnée
   - Affiche l'explication officielle (écran uniquement)
   - Permet de saisir un override du SMIC si absent
   ----------------------------------------------------------------------------
   Dépendances :
   - window.ABMAT.render (R) — initialisé par render/index.js
   - window.ABMAT.utils (U) — fmtEuro, helpers divers
   ===========================================================================
*/

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.render = window.ABMAT.render || {};

  const R = window.ABMAT.render;
  const U = window.ABMAT.utils;

  if (!U) {
    throw new Error("ABMAT.utils est requis avant ABMAT.render (charger utils.js en premier).");
  }

  // -----------------------------------------------------------------------------
  // Règles d'abattement (année)
  // -----------------------------------------------------------------------------

  /**
   * @param {HTMLElement} container
   * @param {Object} state {year, coefficient, forfaitJour, smicOverride}
   * @param {()=>{smicFromConfig:number|null, smicEffective:number|null}} getSmicInfo
   * @param {(smicOverride:number|null)=>void} onSmicOverrideChange
   */
  R.renderYearAbattement = function renderYearAbattement(container, state, getSmicInfo, onSmicOverrideChange) {
    container.innerHTML = "";

    const subtitle = document.createElement("p");
    subtitle.className = "hint";
    subtitle.textContent = `Année ${state.year}`;
    container.appendChild(subtitle);


    const info = getSmicInfo ? getSmicInfo() : { smicFromConfig: null, smicEffective: null };
    const smicFromConfig = info.smicFromConfig;
    const smicOverride = (typeof state.smicOverride === "number" && Number.isFinite(state.smicOverride)) ? state.smicOverride : null;

    // --- Explication (écran uniquement)
    const explain = document.createElement("div");
    explain.className = "calc-explain no-print";
    explain.innerHTML =
      `<p><strong>Pour plus de détails sur les règles officielles :</strong> ` +
      `<a href="https://www.service-public.gouv.fr/particuliers/vosdroits/F1234" target="_blank" rel="noopener noreferrer">service-public.gouv.fr</a></p>` +
      `<p>En tant qu’<strong>assistante maternelle ou familiale agréée</strong>, vous pouvez choisir de déclarer <strong>toutes les sommes perçues</strong> dans l’année, y compris les indemnités représentatives de frais (IRF). Dans ce cas, vous bénéficiez d’un <strong>abattement forfaitaire</strong> représentatif des frais.</p>` +
      `<p>L’abattement est calculé <strong>par jour et par enfant</strong>. Son montant varie selon le <strong>temps de présence</strong> de l’enfant dans la journée. Il est fixé en fonction du <strong>SMIC horaire brut</strong> au <strong>01/01/${state.year}</strong>.</p>` +
      `<p><strong>Durée de garde ≥ 8h :</strong> l’abattement forfaitaire par enfant est de <strong>${U.fmtEuro(state.forfaitJour || 0)}</strong> (soit <strong>3 × SMIC horaire brut</strong>).</p>` +
      `<p><strong>Durée de garde &lt; 8h :</strong> l’abattement est proratisé selon la formule : <code>(forfait ÷ 8) × heures de présence</code>.</p>` +
      `<p class="hint">Certains cas particuliers (garde de 24h et plus, enfant malade/handicapé/inadapté…) peuvent ouvrir droit à des abattements spécifiques et ne sont pas pris en compte dans ce calculateur.</p>`;
    container.appendChild(explain);

    // --- Récapitulatif (écran + PDF)
    const recapTitle = document.createElement("p");
    recapTitle.className = "year-params-subtitle";
    recapTitle.textContent = `Récapitulatif des règles appliquées — année ${state.year}`;
    container.appendChild(recapTitle);

    const recap = document.createElement("div");
    recap.className = "calc-recap";
    const smicLabel = (typeof smicFromConfig === "number")
      ? `${smicFromConfig.toFixed(2)} €`
      : "non renseigné";
    recap.innerHTML =
      `<ul class="calc-recap-list">` +
      `  <li><strong>Forfait (par enfant, garde ≥ 8h)</strong> : <strong>${U.fmtEuro(state.forfaitJour || 0)}</strong> <span class="hint">(= 3 × SMIC horaire brut au 01/01/${state.year})</span></li>` +
      `  <li><strong>Forfait (par enfant, garde &lt; 8h)</strong> : <span class="hint">(forfait ÷ 8) × heures de présence</span></li>` +
      `  <li class="hint">Calcul par jour et par enfant. SMIC au 01/01/${state.year} : <strong>${smicLabel}</strong>.</li>` +
      `</ul>`;
    container.appendChild(recap);

    // --- Saisie du SMIC (uniquement si non renseigné dans le code)
    if (typeof smicFromConfig !== "number") {
      const smicMissing = document.createElement("div");
      smicMissing.className = "year-param-row is-rule";
      smicMissing.innerHTML =
        `<div class="year-rule-title"><strong>SMIC manquant</strong> <span class="hint">pour l’année ${state.year}</span></div>` +
        `<div class="year-param-sub">` +
        `  <label class="inline-label" for="abmat-smic-input">Saisir le SMIC horaire brut :</label> ` +
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

        // Si pas encore parseable, on ne force pas (on laisse l'utilisateur corriger)
        if (!Number.isFinite(v)) return;

        onSmicOverrideChange && onSmicOverrideChange(v);
      };

      // Important : ne PAS appeler le callback à chaque frappe, sinon app.js re-render
      // et le champ "saute" (symptôme : impossible de taper plus d'un chiffre).
      smicInput.addEventListener("change", apply);
      smicInput.addEventListener("blur", apply);
    }
  };

  // Compat : ancien nom durant la refacto
  R.renderYearParams = R.renderYearParams || R.renderYearAbattement;

})();
