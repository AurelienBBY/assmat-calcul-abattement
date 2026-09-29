/* ============================================================================
   image.js — Photo de la fiche : réduite et redressée (window.ABMAT.image)
   ----------------------------------------------------------------------------
   Une photo d'iPhone pèse 2 à 5 Mo : on la ramène à 1800 px de côté au plus,
   en JPEG, soit environ 300 Ko, assez net pour relire une fiche écrite à la
   main. Le navigateur applique lui-même le sens de la photo (EXIF).
   La fiche du CCAS est en paysage : prise téléphone en main (photo en
   portrait), elle est de travers. Elle est alors redressée d'un quart de
   tour vers la gauche (sur la fiche d'exemple, le haut était à droite) ;
   « Tourner » corrige si le sens est mauvais.
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  const MAX_SIDE = 1800;
  const QUALITY = 0.8;

  function loadImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("format de photo non reconnu (prenez une photo, ou choisissez un JPEG ou un PNG).")); };
      img.src = url;
    });
  }

  /**
   * Dessine l'image réduite et tournée, en JPEG.
   * @param {number} quarter - quarts de tour dans le sens des aiguilles d'une montre (0, 1 ou 3)
   */
  function draw(img, quarter) {
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = quarter % 2 ? h : w;
    canvas.height = quarter % 2 ? w : h;
    const ctx = canvas.getContext("2d");
    if (quarter === 1) { ctx.translate(canvas.width, 0); ctx.rotate(Math.PI / 2); }
    if (quarter === 3) { ctx.translate(0, canvas.height); ctx.rotate(-Math.PI / 2); }
    ctx.drawImage(img, 0, 0, w, h);
    return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("la photo n'a pas pu être réduite."))), "image/jpeg", QUALITY));
  }

  window.ABMAT.image = {
    /**
     * Photo prise ou choisie → JPEG réduit, redressé si elle est en portrait.
     * @param {File|Blob} file
     * @returns {Promise<Blob>}
     */
    compress: async function compress(file) {
      const img = await loadImage(file);
      return draw(img, img.naturalHeight > img.naturalWidth ? 3 : 0);
    },

    /**
     * Photo déjà rangée → tournée d'un quart de tour dans le sens des aiguilles d'une montre.
     * @param {Blob} blob
     * @returns {Promise<Blob>}
     */
    turn: async function turn(blob) {
      return draw(await loadImage(blob), 1);
    }
  };
})();
