/* Tests de calc.js — bornes 8 h, prorata, créneaux invalides, agrégats. */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT } = loadApp();
const C = ABMAT.calc;

const FORFAIT = 36.06; // 3 × 12,02 (SMIC 2026)

test("créneau entièrement vide → empty, 0 €", () => {
  assert.deepEqual(C.computeHoursAndAbattForSlot("", "", FORFAIT), { status: "empty", hours: 0, abatt: 0 });
});

test("créneau incomplet (entrée seule) → invalid", () => {
  assert.equal(C.computeHoursAndAbattForSlot("08:30", "", FORFAIT).status, "invalid");
});

test("sortie avant ou égale à l'entrée → invalid", () => {
  assert.equal(C.computeHoursAndAbattForSlot("17:00", "08:00", FORFAIT).status, "invalid");
  assert.equal(C.computeHoursAndAbattForSlot("08:00", "08:00", FORFAIT).status, "invalid");
});

test("format non HH:MM d'un côté → invalid", () => {
  assert.equal(C.computeHoursAndAbattForSlot("8h30", "17:00", FORFAIT).status, "invalid");
});

test("deux horaires imparsables → empty (comportement historique : équivaut à une case vide)", () => {
  assert.equal(C.computeHoursAndAbattForSlot("25:00", "26:00", FORFAIT).status, "empty");
});

test("garde ≥ 8 h → forfait entier", () => {
  const r = C.computeHoursAndAbattForSlot("08:30", "17:30", FORFAIT);
  assert.deepEqual(r, { status: "ok", hours: 9, abatt: 36.06 });
});

test("garde exactement 8 h → forfait entier (borne incluse)", () => {
  assert.equal(C.computeHoursAndAbattForSlot("08:00", "16:00", FORFAIT).abatt, 36.06);
});

test("garde juste sous 8 h → prorata, pas le forfait", () => {
  const r = C.computeHoursAndAbattForSlot("08:00", "15:59", FORFAIT);
  assert.ok(r.abatt < 36.06);
});

test("garde < 8 h → prorata (forfait ÷ 8 × heures)", () => {
  assert.equal(C.computeHoursAndAbattForSlot("08:00", "12:00", FORFAIT).abatt, 18.03); // 4 h
  assert.equal(C.computeHoursAndAbattForSlot("08:30", "16:00", FORFAIT).abatt, 33.81); // 7 h 30
});

test("computeDayTotal additionne les enfants et ignore les invalides", () => {
  const r = C.computeDayTotal({
    "1": { in: "08:30", out: "17:30" },  // 36,06
    "2": { in: "08:30", out: "16:00" },  // 33,81
    "3": { in: "10:00", out: "09:00" }   // invalide → ignoré
  }, FORFAIT);

  assert.equal(r.dayTotal, 69.87);
  assert.equal(r.perSlot["3"].status, "invalid");
});

test("computeMonthTotal somme les jours et détaille perDay", () => {
  const r = C.computeMonthTotal({
    "2026-01-05": { slots: { "1": { in: "08:30", out: "17:30" } } },
    "2026-01-06": { slots: { "1": { in: "08:00", out: "12:00" } } }
  }, FORFAIT);

  assert.equal(r.monthTotal, 54.09); // 36,06 + 18,03
  assert.equal(r.perDay["2026-01-05"], 36.06);
  assert.equal(r.perDay["2026-01-06"], 18.03);
});
