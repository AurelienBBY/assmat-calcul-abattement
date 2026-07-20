/* ============================================================================
   render/explain.js — Bloc d’explication (non interactif)
   ----------------------------------------------------------------------------
   Objectif :
   - Rendre uniquement le bloc "Explication" (pédagogie + règles générales)
   - Aucune interaction / aucun binding d’inputs
   - Les calculs restent dans calc.js ; les formats/helpers dans utils.js
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
   * Rend le bloc d’explication (écran uniquement, contenu générique — vit
   * désormais dans l'écran Accueil, plus dans les vues mensuelles).
   *
   * @param {HTMLElement} container
   */
  R.renderExplain = function renderExplain(container) {
    if (!container) return;
    container.innerHTML = "";

    const explain = document.createElement("div");
    explain.className = "calc-explain no-print";

    explain.innerHTML =
      `<p><strong>Pour plus de détails sur les règles officielles :</strong> ` +
      `<a href="https://www.service-public.gouv.fr/particuliers/vosdroits/F1234" target="_blank" rel="noopener noreferrer">service-public.gouv.fr</a></p>` +
      `<p>En tant qu’<strong>assistante maternelle ou familiale agréée</strong>, vous pouvez choisir de déclarer <strong>toutes les sommes perçues</strong> dans l’année, y compris les indemnités représentatives de frais (IRF). Dans ce cas, vous bénéficiez d’un <strong>abattement forfaitaire</strong> représentatif des frais.</p>` +
      `<p>L’abattement est calculé <strong>par jour et par enfant</strong>. Son montant varie selon le <strong>temps de présence</strong> de l’enfant dans la journée. Il est fixé en fonction du <strong>SMIC horaire brut</strong> au <strong>1er janvier</strong> de l’année concernée.</p>` +
      `<p><strong>Durée de garde ≥ 8h :</strong> l’abattement forfaitaire par enfant est égal à <strong>3 × le SMIC horaire brut</strong> (au 1er janvier de l’année).</p>` +
      `<p><strong>Durée de garde &lt; 8h :</strong> l’abattement est proratisé selon la formule : <code>(forfait ÷ 8) × heures de présence</code>.</p>` +
      `<p class="hint">Certains cas particuliers (garde de 24h et plus, enfant malade/handicapé/inadapté…) peuvent ouvrir droit à des abattements spécifiques et ne sont pas pris en compte dans ce calculateur.</p>`;

    container.appendChild(explain);
  };
})();