/* Tests de « Vérifier le mois » : semaines, face et zoom de la fiche, tableau de la semaine, jours modifiés,
   reprise des photos d'une copie. */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT, CONFIG } = loadApp();
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

test("face de la fiche d'une semaine : celle du jour du milieu (recto du 1er au 15)", () => {
  assert.equal(Compute.weekPage(["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11"]), "recto");
  assert.equal(Compute.weekPage(["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"]), "verso");
  assert.equal(Compute.weekPage(["2026-09-28", "2026-09-29"]), "verso");
});

test("zoom sur la semaine : ses 7 colonnes du lundi au dimanche, ramenées dans la face", () => {
  const G = CONFIG.attendanceSheet;
  const cols = (f, n) => [Math.round((f.x0 - G.daysLeft) / ((G.daysRight - G.daysLeft) / n) + 1.25), Math.round((f.x1 - G.daysLeft) / ((G.daysRight - G.daysLeft) / n) - 0.25)];
  // Septembre 2026 commence un mardi : le lundi (31 août) est hors de la fiche → colonnes 1 à 7.
  assert.deepEqual(cols(Compute.weekFocus(["2026-09-01", "2026-09-04"], "recto"), 15), [1, 7]);
  assert.deepEqual(cols(Compute.weekFocus(["2026-09-07", "2026-09-11"], "recto"), 15), [7, 13]);
  // Semaine du 14 au 18 : sur le verso, colonnes du 16 au 22 ; sur le recto, du 9 au 15.
  assert.deepEqual(cols(Compute.weekFocus(["2026-09-14", "2026-09-18"], "verso"), 16), [1, 7]);
  assert.deepEqual(cols(Compute.weekFocus(["2026-09-14", "2026-09-18"], "recto"), 15), [9, 15]);
  assert.deepEqual(cols(Compute.weekFocus(["2026-09-28", "2026-09-29"], "verso"), 16), [10, 16]);
  const f = Compute.weekFocus(["2026-09-01", "2026-09-04"], "recto");
  assert.ok(f.x0 > 0.19 && f.x0 < 0.21 && f.x1 > 0.55 && f.x1 < 0.57, JSON.stringify(f));
});

test("tableau de la semaine comme la fiche : ordre des enfants, cases à la minute, journée proche de 10 h", () => {
  const profile = { children: [{ id: "c2" }, { id: "c1" }] };
  const p = (a, b) => ({ absent: false, motif: "", slots: [{ in: a, out: b }], punched: false });
  const before = S.blankMonthData(2026, 8);
  before.days["2026-09-07"] = { off: false, children: { c1: p("09:00", "17:30"), c2: p("09:30", "17:30") }, meetings: [] };
  before.days["2026-09-08"] = { off: false, children: { c1: p("07:45", "17:30"), r1: Object.assign(p("10:00", "12:00"), { relais: true, name: "Zoé" }) }, meetings: [] };
  before.days["2026-09-09"] = { off: false, children: { c1: p("09:00", "17:30") }, meetings: [] };
  const now = JSON.parse(JSON.stringify(before));
  now.days["2026-09-07"].children.c1.slots[0].in = "09:10";
  now.days["2026-09-09"] = { off: true, children: {}, meetings: [] };
  const g = Compute.reviewGrid(["2026-09-07", "2026-09-08", "2026-09-09"], now, before, profile);
  assert.deepEqual(g.ids, ["c2", "c1", "r1"]);
  assert.equal(g.cells.c2["2026-09-07"].minutesMatter, true);   // 8 h pile : une minute de retard → prorata
  assert.equal(g.cells.c1["2026-09-07"].minutesMatter, false);  // 8 h 20 : au-delà de 8 h 15
  assert.equal(g.cells.r1["2026-09-08"].minutesMatter, true);   // 2 h : chaque minute compte
  assert.equal(g.cells.c1["2026-09-07"].changed, true);
  assert.equal(g.cells.c2["2026-09-07"].changed, false);
  assert.equal(g.cells.c1["2026-09-09"].changed, true);         // jour passé en « non travaillé »
  assert.equal(g.cells.c1["2026-09-09"].presence, null);
  assert.deepEqual([g.days["2026-09-07"].nearOvertime, g.days["2026-09-08"].nearOvertime, g.days["2026-09-09"].off], [false, true, true]);
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
