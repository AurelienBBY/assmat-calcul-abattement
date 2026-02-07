/* ============================================================================
   render/toolbar-actions.js — Actions de la toolbar (imprimer / importer / exporter)
   ----------------------------------------------------------------------------
   Rôle :
   - Branche les boutons de la toolbar sticky sur les handlers applicatifs
   - Déclenche l'import via un input[type=file] caché (JSON)

   Attendus dans le DOM (toolbar) :
   - #abmat-action-save  (bouton "Sauvegarder")
   - #abmat-action-load  (bouton "Charger")
   - #abmat-action-print (bouton "Imprimer")
   - #abmat-action-file  (input[type=file] caché, accept application/json)

   Dépendances :
   - window.ABMAT.render (R) — initialisé par render/index.js
   - window.ABMAT.utils (U) — pad2
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.render = window.ABMAT.render || {};

  const R = window.ABMAT.render;
  const U = window.ABMAT.utils;

  if (!U) {
    throw new Error("ABMAT.utils est requis avant ABMAT.render (charger utils.js en premier). ");
  }

  // -----------------------------------------------------------------------------
  // 5) Actions (toolbar)
  // -----------------------------------------------------------------------------

  /**
   * Branche les actions sur la toolbar sticky.
   *
   * NOTE: on ne rend plus de blocs "Données" / "Impression" dans la page.
   * Le param `container` est conservé pour compatibilité, mais n’est plus utilisé.
   */
  R.renderToolbarActions = function renderToolbarActions(container, state, onPrint, onExport, onImportRequest) {
    // Toolbar targets
    const btnSave = document.getElementById("abmat-action-save");
    const btnLoad = document.getElementById("abmat-action-load");
    const btnPrint = document.getElementById("abmat-action-print");
    const fileInput = document.getElementById("abmat-action-file");

    const root = (btnSave || btnLoad || btnPrint || fileInput);
    if (root && root.dataset && root.dataset.abmatBound === "1") {
      return;
    }
    if (root && root.dataset) root.dataset.abmatBound = "1";

    // Garde-fous : si la toolbar n’existe pas (ex: intégration partielle), on ne casse pas.
    if (!btnSave && !btnLoad && !btnPrint && !fileInput) {
      if (container) container.innerHTML = "";
      return;
    }

    // (Ré)initialise le champ fichier pour permettre de recharger le même fichier deux fois.
    const resetFile = () => {
      if (fileInput) fileInput.value = "";
    };

    // Sauvegarde (export)
    if (btnSave) {
      btnSave.addEventListener("click", () => {
        onExport && onExport();
      });
    }

    // Impression
    if (btnPrint) {
      btnPrint.addEventListener("click", () => {
        onPrint && onPrint();
      });
    }

    // Chargement (import)
    if (btnLoad) {
      btnLoad.addEventListener("click", () => {
        if (fileInput) {
          resetFile();
          fileInput.click();
        } else {
          // Fallback : si pas d'input file, on déclenche quand même le handler côté app.
          onImportRequest && onImportRequest(null);
        }
      });
    }

    // Quand un fichier est choisi
    if (fileInput) {
      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        onImportRequest && onImportRequest(file);
      });
    }

    // (Optionnel) expose le nom de fichier attendu via title sur le bouton Charger
    // sans polluer l’UI.
    if (btnLoad && state && Number.isFinite(Number(state.year)) && Number.isFinite(Number(state.monthIndex))) {
      const y = state.year;
      const m = U.pad2(state.monthIndex + 1);
      btnLoad.title = `Importer un fichier JSON (ex: abattement-assmat-${y}-${m}.json)`;
    }
  };

  // Compat : ancien nom pendant la refacto
  R.renderActions = R.renderActions || R.renderToolbarActions;

})();