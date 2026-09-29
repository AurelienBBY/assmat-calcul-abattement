/* ============================================================================
   render/fiche-card.js — Mon mois : la fiche de présence (recto verso)
   ----------------------------------------------------------------------------
   Une seule fiche recto verso avec tous les enfants : une photo par face,
   à prendre, tourner (mauvais sens), remplacer (photo floue) ou supprimer.
   Toucher la miniature l'ouvre en grand.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.fmt || !R.openPhoto) {
    throw new Error("render/format.js et render/photo-viewer.js doivent être chargés avant render/fiche-card.js.");
  }
  const h = R.h;
  const F = R.fmt;

  function slot(side, url, m, hd) {
    const name = side === "recto" ? "Recto" : "Verso";
    const title = `Fiche de ${m.monthName}, ${side}`;
    const thumb = url
      ? h("button", { type: "button", class: "fthumb", "aria-label": `Voir en grand : ${title}`, on: { click: () => R.openPhoto(title, url) } }, h("img", { src: url, alt: "" }))
      : h("span", { class: "fthumb is-empty", "aria-hidden": "true" }, R.icon("camera"));
    return h("div", { class: "fslot" }, [
      thumb,
      h("div", { class: "fslot-txt" }, [
        h("b", { text: name }),
        h("span", { class: "small muted", text: url ? "Photo rangée avec le mois." : "Pas encore de photo." }),
        h("div", { class: "row" }, url ? [
          h("button", { type: "button", class: "btn btn-quiet", text: "Tourner", "aria-label": `Tourner le ${side} d'un quart de tour`, on: { click: () => hd.onTurn(side) } }),
          h("button", { type: "button", class: "btn btn-quiet", text: "Remplacer", on: { click: () => hd.onPick(side) } }),
          h("button", { type: "button", class: "btn btn-quiet", text: "Supprimer", on: { click: () => hd.onRemove(side) } })
        ] : h("button", { type: "button", class: "btn", text: "Prendre la photo", on: { click: () => hd.onPick(side) } }))
      ])
    ]);
  }

  /**
   * @param {{monthName:string, state:{recto:string|null, verso:string|null}|null}} m
   * @param {{onPick:(side)=>void, onTurn:(side)=>void, onRemove:(side)=>void}} hd
   */
  R.buildFicheCard = function buildFicheCard(m, hd) {
    return h("div", { class: "card" }, [
      h("h3", { text: `Fiche de présence de ${m.monthName}` }),
      h("p", { class: "small muted", text: "Photographiez la fiche signée par les parents, une photo par face. Elle sert à vérifier le mois, puis de justificatif dans le dossier imprimé. Photo floue ? « Remplacer ». À l'envers ? « Tourner »." }),
      m.state ? [slot("recto", m.state.recto, m, hd), slot("verso", m.state.verso, m, hd)] : h("p", { class: "small muted", text: "Chargement des photos…" }),
      h("p", { class: "small muted", text: `La fiche papier reste l'original : gardez-la. ${F.cap(m.monthName)} et ses photos s'effacent ensemble avec l'année.` })
    ]);
  };
})();
