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
  const c1 = res.data.days["2026-01-05"].children["1"];
  assert.equal(c1.slots[0].in, "");    // nombre → chaîne vide
  assert.equal(c1.slots[0].out, "17:00");
});

test("migration v1 → v2 : les anciens slots deviennent des enfants à un créneau", () => {
  const text = JSON.stringify({
    version: 1, year: 2026, monthIndex: 0, netImposable: 500, irf: 0,
    days: { "2026-01-05": { slots: {
      "1": { in: "08:30", out: "17:30" },
      "2": { in: "", out: "" },
      "3": { in: "09:00", out: "12:00" }
    } } }
  });

  const res = S.importMonthFromJsonText(text, 2026, 0, false);
  assert.equal(res.data.version, 2);
  const children = res.data.days["2026-01-05"].children;
  assert.deepEqual(children["1"], { absent: false, motif: "", slots: [{ in: "08:30", out: "17:30" }] });
  assert.deepEqual(children["2"].slots, []); // enfant vide → aucun créneau
  assert.deepEqual(children["3"].slots, [{ in: "09:00", out: "12:00" }]);
});

test("normalisation v2 : absences conservées, créneaux vides purgés, plafond 3 créneaux", () => {
  const text = JSON.stringify({
    version: 2, year: 2026, monthIndex: 0, netImposable: 0, irf: 0,
    days: { "2026-01-06": { children: {
      "1": { absent: true, motif: "malade", slots: [{ in: "", out: "" }] },
      "2": { slots: [
        { in: "08:00", out: "10:00" }, { in: "", out: "" },
        { in: "11:00", out: "12:00" }, { in: "13:00", out: "14:00" }, { in: "15:00", out: "16:00" }
      ] }
    } } }
  });

  const res = S.importMonthFromJsonText(text, 2026, 0, false);
  const children = res.data.days["2026-01-06"].children;
  assert.deepEqual(children["1"], { absent: true, motif: "malade", slots: [] });
  assert.equal(children["2"].slots.length, 3); // vide purgé, plafonné à 3
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
  mai.days["2026-05-04"] = { children: { "1": { absent: false, motif: "", slots: [{ in: "08:30", out: "17:30" }] } } };
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
  assert.equal(S.loadMonth(2026, 4).data.days["2026-05-04"].children["1"].slots[0].out, "17:30");
});

test("import année : format inconnu ou année invalide → erreur explicite", () => {
  assert.throws(() => S.importYearFromJsonText(JSON.stringify({ year: 2026 })), /abmat-year/);
  assert.throws(() => S.importYearFromJsonText(JSON.stringify({ format: "abmat-year", year: "?" })), /invalide/);
});
