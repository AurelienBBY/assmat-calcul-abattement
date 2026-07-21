/* ============================================================================
   render/toolbar-actions.js — Actions de la toolbar (imprimer / importer / exporter)
   ----------------------------------------------------------------------------
   Rôle :
   - Branche les boutons de la toolbar sticky sur les handlers applicatifs
   - Déclenche l'import via un input[type=file] caché (JSON)

   Attendus dans le DOM (toolbar) :
   - #abmat-action-save  (bouton "Sauvegarder", dans le menu Données)
   - #abmat-action-load  (bouton "Charger", dans le menu Données)
   - [data-toolbar-action="print"] (1 ou plusieurs boutons "Imprimer")
   - #abmat-action-file  (input[type=file] caché, accept application/json)
   - #abmat-action-data-toggle + #abmat-data-menu (menu Données)
   - .pillar-tab[data-pillar] (4 onglets : accueil / infos / declaration / ma-declaration)

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
  R.renderToolbarActions = function renderToolbarActions(container, state, onPrint, onExport, onImportRequest, onSwitchPillar) {
    // Impression : peut exister à plusieurs endroits (icône toolbar toujours
    // présente + CTA dans le héros du résultat, recréé à chaque rendu du
    // mois). Indépendant de la garde ci-dessous : ce bloc s'exécute à chaque
    // appel pour (re)lier les nouveaux boutons ; un garde-fou par élément
    // évite les doubles écoutes sur les boutons déjà liés.
    document.querySelectorAll('[data-toolbar-action="print"]').forEach((btn) => {
      if (btn.dataset.printBound === "1") return;
      btn.dataset.printBound = "1";
      btn.addEventListener("click", () => {
        onPrint && onPrint();
      });
    });

    // Toolbar targets
    const btnSave = document.getElementById("abmat-action-save");
    const btnLoad = document.getElementById("abmat-action-load");
    const fileInput = document.getElementById("abmat-action-file");
    const btnDataToggle = document.getElementById("abmat-action-data-toggle");
    const dataMenu = document.getElementById("abmat-data-menu");
    const pillarTabs = document.querySelectorAll(".pillar-tab[data-pillar]");

    const root = (btnSave || btnLoad || fileInput);
    if (root && root.dataset && root.dataset.abmatBound === "1") {
      return;
    }
    if (root && root.dataset) root.dataset.abmatBound = "1";

    // Garde-fous : si la toolbar n’existe pas (ex: intégration partielle), on ne casse pas.
    if (!btnSave && !btnLoad && !fileInput) {
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

    // Bouton « Données » : ouvre/ferme le menu (Sauvegarder / Importer / auto-sauvegarde)
    if (btnDataToggle && dataMenu) {
      const closeMenu = () => {
        dataMenu.hidden = true;
        btnDataToggle.setAttribute("aria-expanded", "false");
      };
      btnDataToggle.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const willOpen = dataMenu.hidden;
        dataMenu.hidden = !willOpen;
        btnDataToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });
      // Ferme le menu après un clic sur une de ses actions, ou en cliquant ailleurs.
      dataMenu.addEventListener("click", (ev) => {
        if (ev.target instanceof Element && ev.target.closest("button")) closeMenu();
      });
      document.addEventListener("click", closeMenu);
    }

    // Onglets Accueil / Mes informations / Déclaration : bascule de pilier.
    pillarTabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        onSwitchPillar && onSwitchPillar(btn.getAttribute("data-pillar"));
      });
    });

    // (Optionnel) expose le nom de fichier attendu via title sur le bouton Charger
    // sans polluer l’UI.
    if (btnLoad && state && Number.isFinite(Number(state.year))) {
      btnLoad.title = `Importer un fichier JSON (ex: abattement-assmat-${state.year}.json)`;
    }
  };

  // Compat : ancien nom pendant la refacto
  R.renderActions = R.renderActions || R.renderToolbarActions;

})();