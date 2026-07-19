/* Tests du récapitulatif annuel — abattement réel, override SMIC, statuts. */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT, CONFIG, store } = loadApp();
const Compute = ABMAT.compute;

// Janvier 2026 (SMIC 12,02 → forfait 36,06) : un jour complet + un jour invalide.
store["abmat:2026-01"] = JSON.stringify({
  version: 1, year: 2026, monthIndex: 0, smicOverride: null,
  netImposable: 1000, irf: 100,
  days: {
    "2026-01-05": { slots: {
      "1": { in: "08:30", out: "17:30" },   // 9 h → 36,06
      "2": { in: "08:30", out: "16:00" },   // 7 h 30 → 33,81
      "3": { in: "", out: "" }
    } },
    "2026-01-06": { slots: { "1": { in: "10:00", out: "09:00" }, "2": {}, "3": {} } } // invalide
  }
});

// Février 2026 : smicOverride 10 → forfait 30 ; 4 h → 15,00 ; pas d'argent saisi.
store["abmat:2026-02"] = JSON.stringify({
  version: 1, year: 2026, monthIndex: 1, smicOverride: 10,
  netImposable: 0, irf: 0,
  days: { "2026-02-03": { slots: { "1": { in: "08:00", out: "12:00" }, "2": {}, "3": {} } } }
});

test("mois complet : abattement, imposable, jours et statut ok", () => {
  const jan = Compute.computeMonthRecap(2026, 0);
  assert.equal(jan.abatt, 69.87);
  assert.equal(jan.percu, 1100);
  assert.equal(jan.imposable, 1030.13);
  assert.equal(jan.j_ge8, 1);
  assert.equal(jan.j_lt8, 1);
  assert.equal(jan.status, "ok");
});

test("smicOverride du mois prioritaire sur le barème de l'année", () => {
  const fev = Compute.computeMonthRecap(2026, 1);
  assert.equal(fev.abatt, 15);
  assert.equal(fev.status, "incomplet"); // jours sans argent
});

test("mois sans données : vide, 0 partout", () => {
  const mars = Compute.computeMonthRecap(2026, 2);
  assert.equal(mars.status, "vide");
  assert.equal(mars.abatt, 0);
  assert.equal(mars.imposable, 0);
});

test("totaux annuels agrégés sur 12 mois", () => {
  const year = Compute.computeYearRecap(2026);
  assert.equal(year.months.length, 12);
  assert.equal(year.totals.abatt, 84.87);
  assert.equal(year.totals.percu, 1100);
  assert.equal(year.totals.imposable, 1030.13);
  assert.equal(year.totals.j_ge8, 1);
  assert.equal(year.totals.j_lt8, 2);
});

test("barème : SMIC 2023 corrigé (11,27 → forfait 33,81)", () => {
  assert.equal(CONFIG.computeForfaitJourFromSmic(CONFIG.getSmicHoraireBrut(2023), 3), 33.81);
});
