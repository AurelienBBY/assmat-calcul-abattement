/* Tests des années déclarées (repère manuel, local, hors export). */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT, store } = loadApp();
const S = ABMAT.storage;

test("aucune année déclarée par défaut", () => {
  assert.deepEqual(S.getDeclaredYears(), []);
  assert.equal(S.isYearDeclared(2025), false);
});

test("marquer puis retirer une année déclarée", () => {
  S.setYearDeclared(2025, true);
  assert.equal(S.isYearDeclared(2025), true);
  assert.deepEqual(S.getDeclaredYears(), [2025]);

  S.setYearDeclared(2024, true);
  assert.deepEqual(S.getDeclaredYears().sort(), [2024, 2025]);

  S.setYearDeclared(2025, false);
  assert.equal(S.isYearDeclared(2025), false);
  assert.deepEqual(S.getDeclaredYears(), [2024]);
});

test("marquer deux fois la même année ne duplique pas", () => {
  Object.keys(store).forEach((k) => delete store[k]);
  S.setYearDeclared(2026, true);
  S.setYearDeclared(2026, true);
  assert.deepEqual(S.getDeclaredYears(), [2026]);
});

test("stockage illisible → liste vide plutôt qu'une erreur", () => {
  store["abmat:declaredYears"] = "{ceci n'est pas du json";
  assert.deepEqual(S.getDeclaredYears(), []);
});

test("effacer une année : mois, réglages et repère « déclarée » ; le reste intact", () => {
  const jan = S.blankMonthData(2023, 0);
  jan.netImposable = 100;
  S.saveMonth(S.monthKey(2023, 0), jan);
  S.saveMonth(S.monthKey(2023, 11), Object.assign(S.blankMonthData(2023, 11), { irf: 5 }));
  S.saveMonth(S.monthKey(2024, 0), Object.assign(S.blankMonthData(2024, 0), { irf: 7 }));
  S.saveYearSettings({ year: 2023, smic: 11.27, relais: true });
  S.setYearDeclared(2023, true);

  S.eraseYear(2023);

  assert.equal(store["abmat:2023-01"], undefined);
  assert.equal(store["abmat:2023-12"], undefined);
  assert.equal(store["abmat:settings:2023"], undefined);
  assert.equal(S.isYearDeclared(2023), false);
  assert.equal(S.loadMonth(2024, 0).data.irf, 7);
});
