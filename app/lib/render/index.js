/* ============================================================================
   render/index.js — Namespace & bootstrap for UI renderers
   ----------------------------------------------------------------------------
   This file only:
   - Ensures global namespaces exist (window.ABMAT.render)
   - Provides a single shared object `R` that sub-render files augment
   - Performs minimal guards (Utils presence)
   ========================================================================== */

(function () {
  "use strict";

  // Global app namespace
  window.ABMAT = window.ABMAT || {};

  // Shared render namespace (sub-files attach functions to this object)
  window.ABMAT.render = window.ABMAT.render || {};

  // Convenience alias (for debugging in console)
  window.R = window.ABMAT.render;

  // Garde : utils doit être chargé avant les renderers
  if (!window.ABMAT.utils) {
    throw new Error("ABMAT.utils est requis avant les renderers (charger utils.js en premier).");
  }
})();