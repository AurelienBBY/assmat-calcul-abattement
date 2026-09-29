/* Tests de « Vérifier le mois » : semaines, moitié de fiche, jours modifiés,
   reprise des photos d'une copie. */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT } = loadApp();
const S = ABMAT.storage;
const Compute = ABMAT.compute;

test("semaines à vérifier : lundi → vendredi, jours passés seulement, samedi saisi inclus", () => {
  const m = S.blankMonthData(2026, 8);
  m.days["2026-09-26"] = { off: false, children: {}, meetings: [{ in: "09:00", out: "11:00" }] };
  const w = Compute.reviewWeeks(2026, 8, m, "2026-09-29");
  assert.deepEqual(w.map((x) => [x[0], x[x.length - 1]]), [
    ["2026-09-01", "2026-09-04"], ["2026-09-07", "2026-09-11"], ["2026-09-14", "2026-09-18"],
    ["2026-09-21", "2026-09-26"], ["2026-09-28", "2026-09-29"]
  ]);
  assert.deepEqual(Compute.reviewWeeks(2026, 7, S.blankMonthData(2026, 7), "2026-09-29").length, 5); // août entier
  assert.deepEqual(Compute.reviewWeeks(2026, 9, S.blankMonthData(2026, 9), "2026-09-29"), []);      // octobre à venir
});

test("moitié de fiche : recto du 1er au 15, verso du 16 à la fin, haut puis bas", () => {
  const v = (iso) => Object.values(Compute.sheetView(iso)).join(" ");
  assert.equal(v("2026-09-01"), "recto haut");
  assert.equal(v("2026-09-08"), "recto haut");
  assert.equal(v("2026-09-09"), "recto bas");
  assert.equal(v("2026-09-15"), "recto bas");
  assert.equal(v("2026-09-16"), "verso haut");
  assert.equal(v("2026-09-24"), "verso bas");
  assert.deepEqual(Compute.weekSheetView(["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11"]), { page: "recto", part: "bas" });
});

test("jours modifiés pendant la vérification", () => {
  const before = S.blankMonthData(2026, 8);
  before.days["2026-09-10"] = { off: false, children: { c1: { absent: false, motif: "", slots: [{ in: "08:00", out: "17:30" }], punched: false } }, meetings: [] };
  const after = JSON.parse(JSON.stringify(before));
  after.days["2026-09-10"].children.c1.slots[0].out = "18:15";
  after.days["2026-09-11"] = { off: true, children: {}, meetings: [] };
  assert.deepEqual(Compute.changedDays(before, after), ["2026-09-10", "2026-09-11"]);
});

test("photos d'une copie : la plus récente gagne, suppression comprise", () => {
  const local = { "2026-09:recto": "2026-09-20T10:00:00Z", "2026-09:verso": "2026-09-25T10:00:00Z" };
  const file = { "2026-09:recto": "2026-09-22T10:00:00Z", "2026-09:verso": "2026-09-21T10:00:00Z", "2026-08:recto": "2026-08-31T10:00:00Z" };
  assert.deepEqual(Compute.fichesMergePlan(local, file), ["2026-08:recto", "2026-09:recto"]);
});
