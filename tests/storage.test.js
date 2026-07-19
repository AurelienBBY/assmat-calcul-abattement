/* Tests de storage.js — normalisation des imports malformés, export/import d'année. */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT, store } = loadApp();
const S = ABMAT.storage;

test("import mois : champs malformés normalisés sans casser", () => {
  const text = JSON.stringify({
    year: 2026, monthIndex: 0,
    netImposable: "abc", irf: null, smicOverride: "n'importe quoi",
    days: { "2026-01-05": { slots: { "1": { in: 5, out: "17:00" } } } }
  });

  const res = S.importMonthFromJsonText(text, 2026, 0, false);
  assert.equal(res.data.netImposable, 0);
  assert.equal(res.data.irf, 0);
  assert.equal(res.data.smicOverride, null);
  assert.equal(res.data.days["2026-01-05"].slots["1"].in, "");   // nombre → chaîne vide
  assert.equal(res.data.days["2026-01-05"].slots["1"].out, "17:00");
});

test("import mois : mismatch refusé sans autorisation, adapté avec", () => {
  const text = JSON.stringify({ year: 2025, monthIndex: 3, netImposable: 100, irf: 0, days: {} });

  assert.throws(() => S.importMonthFromJsonText(text, 2026, 0, false));

  const res = S.importMonthFromJsonText(text, 2026, 0, true);
  assert.equal(res.adapted, true);
  assert.equal(res.data.year, 2026);
  assert.equal(res.data.monthIndex, 0);
});

test("export année : seuls les mois non vides sont inclus", () => {
  const jan = S.blankMonthData(2026, 0);
  jan.netImposable = 1200;
  S.saveMonth(S.monthKey(2026, 0), jan);

  const mai = S.blankMonthData(2026, 4);
  mai.days["2026-05-04"] = { slots: { "1": { in: "08:30", out: "17:30" }, "2": {}, "3": {} } };
  S.saveMonth(S.monthKey(2026, 4), mai);

  S.saveMonth(S.monthKey(2026, 7), S.blankMonthData(2026, 7)); // août vide → exclu

  const exp = S.buildYearExport(2026);
  assert.equal(exp.format, "abmat-year");
  assert.equal(exp.year, 2026);
  assert.equal(exp.monthsCount, 2);
  assert.deepEqual(Object.keys(exp.months).sort(), ["0", "4"]);
});

test("import année : aller-retour complet vers le localStorage", () => {
  const text = JSON.stringify(S.buildYearExport(2026));

  // On repart d'un storage vide pour prouver la restauration.
  Object.keys(store).forEach((k) => delete store[k]);

  const res = S.importYearFromJsonText(text);
  assert.deepEqual(res, { year: 2026, count: 2 });
  assert.equal(S.loadMonth(2026, 0).data.netImposable, 1200);
  assert.equal(S.loadMonth(2026, 4).data.days["2026-05-04"].slots["1"].out, "17:30");
});

test("import année : format inconnu ou année invalide → erreur explicite", () => {
  assert.throws(() => S.importYearFromJsonText(JSON.stringify({ year: 2026 })), /abmat-year/);
  assert.throws(() => S.importYearFromJsonText(JSON.stringify({ format: "abmat-year", year: "?" })), /invalide/);
});
