/* ============================================================================
   storage/core.js — Socle du stockage local (localStorage)
   ----------------------------------------------------------------------------
   Namespace window.ABMAT.storage, partagé par les autres fichiers storage/* :
   - writeRaw : écriture brute (préserve l'updatedAt fourni — fusion)
   - sameContent : comparaison de contenu sans l'horodatage
   Remarques :
   - localStorage est lié au navigateur + machine (effacement possible).
   - L'export JSON (storage/sync.js) sert de sauvegarde durable.
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.storage = window.ABMAT.storage || {};

  const S = window.ABMAT.storage;

  if (!window.ABMAT.utils) {
    throw new Error("ABMAT.utils est requis avant ABMAT.storage (charger utils.js en premier).");
  }

  // Contenu sérialisé sans l'horodatage (updatedAt).
  function strippedJson(obj) {
    const copy = Object.assign({}, obj);
    delete copy.updatedAt;
    return JSON.stringify(copy);
  }

  /**
   * Le contenu stocké sous `key` est-il identique à `obj` (hors updatedAt) ?
   * Stockage absent ou illisible → false (on réécrira proprement).
   */
  S.sameContent = function sameContent(key, obj) {
    try {
      const existingRaw = localStorage.getItem(String(key));
      return Boolean(existingRaw) && strippedJson(JSON.parse(existingRaw)) === strippedJson(obj);
    } catch (e) {
      return false;
    }
  };

  /**
   * Écriture brute (préserve l'updatedAt fourni — utilisée par la fusion).
   * @returns {boolean} succès
   */
  S.writeRaw = function writeRaw(key, data) {
    try {
      localStorage.setItem(String(key), JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn("Impossible de sauvegarder dans localStorage:", e);
      return false;
    }
  };
})();
