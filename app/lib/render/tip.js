/* ============================================================================
   render/tip.js — Bulles d'aide (une par onglet, jusqu'à « Compris »)
   ----------------------------------------------------------------------------
   Le geste principal de l'onglet, en une phrase, la première fois qu'il
   s'affiche. Ce qui a été vu est mémorisé par app/ctrl/shell.js.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.h) {
    throw new Error("render/dom.js doit être chargé avant render/tip.js.");
  }

  const TIPS = {
    today: "Quand un enfant arrive, touchez « Arrivée » : l'heure est notée. Une erreur ? Touchez l'heure pour la corriger.",
    month: "Chaque jour est déjà rempli avec les horaires habituels. Chaque mois, photographiez la fiche de présence puis touchez « Vérifier avec la fiche » : elle s'affiche semaine par semaine à côté des journées.",
    year: "Ce montant se complète mois après mois. Au printemps, reportez-le case 1AJ de votre déclaration.",
    profile: "Un enfant arrive, part ou change d'horaires ? C'est ici, « à partir du … » : les jours déjà passés ne bougent pas."
  };

  /** @param {"today"|"month"|"year"|"profile"} tab */
  R.buildTip = function buildTip(tab, onOk) {
    return R.h("div", { class: "tip", role: "note" }, [
      R.h("span", { text: TIPS[tab] }),
      R.h("button", { type: "button", text: "Compris", on: { click: onOk } })
    ]);
  };
})();
