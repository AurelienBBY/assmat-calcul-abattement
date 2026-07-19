/* ============================================================================
   tests/harness.js — Chargement des modules réels dans node
   ----------------------------------------------------------------------------
   Charge config, utils, calc, storage et compute avec window/localStorage
   simulés. Pas de DOM : les renderers et app.js se vérifient à la main dans
   le navigateur (voir CLAUDE.md, section Lancement).
   `node --test` exécute chaque fichier de test dans son propre processus,
   donc le contexte global est isolé entre fichiers.
   ========================================================================== */

"use strict";

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function loadApp() {
  globalThis.window = globalThis;

  const store = {};
  globalThis.localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  [
    "app/config.js",
    "app/lib/utils.js",
    "app/lib/calc.js",
    "app/lib/storage.js",
    "app/lib/compute/year-recap.js",
    "app/lib/compute/month-print.js"
  ].forEach((rel) => {
    vm.runInThisContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), { filename: rel });
  });

  return {
    store,
    ABMAT: globalThis.window.ABMAT,
    CONFIG: globalThis.window.ABMAT_CONFIG
  };
}

module.exports = { loadApp };
