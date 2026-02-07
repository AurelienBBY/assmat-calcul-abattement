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

  // Guard: Utils must be loaded before renderers
  if (!window.U) {
    // Non-fatal: some pages/tests may load renderers without the full app.
    // But in the main app this should never happen.
    console.warn(
      "ABMAT: Utils (window.U) not found. Ensure app/lib/utils.js is loaded before render/*.js"
    );
  }
})();