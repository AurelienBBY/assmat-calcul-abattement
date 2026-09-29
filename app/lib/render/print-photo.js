/* ============================================================================
   render/print-photo.js — Gabarit imprimable : photo de la fiche de présence
   ----------------------------------------------------------------------------
   Une page par face (recto, verso), placée juste après le relevé du mois,
   dans l'impression du mois comme dans le dossier complet.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  const U = window.ABMAT && window.ABMAT.utils;
  const P = R && R.print;

  if (!P || !P.docHead || !U) {
    throw new Error("render/print-common.js doit être chargé avant render/print-photo.js.");
  }

  /**
   * @param {number} year
   * @param {number} monthIndex
   * @param {{side:"recto"|"verso", url:string}} photo
   * @returns {HTMLElement} feuille non rattachée
   */
  R.buildPrintPhotoSheet = function buildPrintPhotoSheet(year, monthIndex, photo) {
    const sheet = P.el("section", "sheet sheet-photo");
    sheet.appendChild(P.docHead("FICHE DE PRÉSENCE — PHOTO", `${U.MONTHS_FR[monthIndex]} ${year} · ${photo.side}`));
    const img = P.el("img");
    img.src = photo.url;
    img.alt = `Fiche de présence de ${U.MONTHS_FR[monthIndex].toLowerCase()} ${year}, ${photo.side}`;
    sheet.appendChild(img);
    sheet.appendChild(P.docFooter("Copie de la fiche signée par les parents : l'original papier fait foi."));
    return sheet;
  };
})();
