/* ============================================================================
   image.js — Réduction d'une photo avant de la ranger (window.ABMAT.image)
   ----------------------------------------------------------------------------
   Une photo d'iPhone pèse 2 à 5 Mo : on la ramène à 1800 px de côté au plus,
   en JPEG, soit environ 300 Ko, assez net pour relire une fiche écrite à la
   main. Le navigateur applique lui-même le sens de la photo (EXIF).
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  const MAX_SIDE = 1800;
  const QUALITY = 0.78;

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("format de photo non reconnu (prenez une photo, ou choisissez un JPEG ou un PNG).")); };
      img.src = url;
    });
  }

  window.ABMAT.image = {
    /**
     * @param {File|Blob} file - photo choisie ou prise
     * @returns {Promise<Blob>} JPEG réduit
     */
    compress: async function compress(file) {
      const img = await loadImage(file);
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("la photo n'a pas pu être réduite."))), "image/jpeg", QUALITY));
    }
  };
})();
