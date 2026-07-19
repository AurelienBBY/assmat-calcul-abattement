/* Tests de calc.js (schéma v2) — bornes 8 h, prorata, multi-créneaux, absences. */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT } = loadApp();
const C = ABMAT.calc;

const FORFAIT = 36.06; // 3 × 12,02 (SMIC 2026)

function child(slots, absent, motif) {
  return { absent: absent === true, motif: motif || "", slots: slots || [] };
}

test("créneau vide → empty ; imparsable des deux côtés → empty (historique)", () => {
  assert.deepEqual(C.computeSlotHours("", ""), { status: "empty", hours: 0 });
  assert.equal(C.computeSlotHours("25:00", "26:00").status, "empty");
});

test("créneau incomplet ou incohérent → invalid", () => {
  assert.equal(C.computeSlotHours("08:30", "").status, "invalid");
  assert.equal(C.computeSlotHours("17:00", "08:00").status, "invalid");
  assert.equal(C.computeSlotHours("08:00", "08:00").status, "invalid");
  assert.equal(C.computeSlotHours("8h30", "17:00").status, "invalid");
});

test("enfant : garde ≥ 8 h en un créneau → forfait entier", () => {
  const r = C.computeChildDay(child([{ in: "08:30", out: "17:30" }]), FORFAIT);
  assert.deepEqual(r, { status: "ok", hours: 9, abatt: 36.06 });
});

test("enfant : exactement 8 h → forfait entier (borne incluse)", () => {
  assert.equal(C.computeChildDay(child([{ in: "08:00", out: "16:00" }]), FORFAIT).abatt, 36.06);
});

test("enfant : < 8 h → prorata (forfait ÷ 8 × heures)", () => {
  assert.equal(C.computeChildDay(child([{ in: "08:00", out: "12:00" }]), FORFAIT).abatt, 18.03);   // 4 h
  assert.equal(C.computeChildDay(child([{ in: "08:30", out: "16:00" }]), FORFAIT).abatt, 33.81);   // 7 h 30
});

test("multi-créneaux : les heures s'additionnent avant la règle (médecin entre deux)", () => {
  // 8h30→11h00 (2 h 30) + 14h00→16h30 (2 h 30) = 5 h → prorata, pas le forfait
  const r = C.computeChildDay(child([
    { in: "08:30", out: "11:00" },
    { in: "14:00", out: "16:30" }
  ]), FORFAIT);
  assert.equal(r.hours, 5);
  assert.equal(r.abatt, 22.54); // 36,06 ÷ 8 × 5
});

test("multi-créneaux : le cumul peut atteindre 8 h → forfait entier", () => {
  const r = C.computeChildDay(child([
    { in: "07:00", out: "11:00" },   // 4 h
    { in: "13:30", out: "18:00" }    // 4 h 30
  ]), FORFAIT);
  assert.equal(r.hours, 8.5);
  assert.equal(r.abatt, 36.06);
});

test("un créneau invalide rend l'enfant-jour invalide (pas d'abattement partiel)", () => {
  const r = C.computeChildDay(child([
    { in: "08:00", out: "12:00" },
    { in: "16:00", out: "14:00" }    // incohérent
  ]), FORFAIT);
  assert.deepEqual(r, { status: "invalid", hours: 0, abatt: 0 });
});

test("enfant absent → status absent, 0 € même avec des créneaux résiduels", () => {
  const r = C.computeChildDay(child([{ in: "08:00", out: "17:00" }], true, "malade"), FORFAIT);
  assert.deepEqual(r, { status: "absent", hours: 0, abatt: 0 });
});

test("computeDayTotal additionne les enfants et ignore invalides/absents", () => {
  const r = C.computeDayTotal({ children: {
    "1": child([{ in: "08:30", out: "17:30" }]),                  // 36,06
    "2": child([{ in: "08:30", out: "16:00" }]),                  // 33,81
    "3": child([{ in: "10:00", out: "09:00" }])                   // invalide → ignoré
  } }, FORFAIT);

  assert.equal(r.dayTotal, 69.87);
  assert.equal(r.perChild["3"].status, "invalid");
});

test("computeMonthTotal somme les jours et détaille perDay", () => {
  const r = C.computeMonthTotal({
    "2026-01-05": { children: { "1": child([{ in: "08:30", out: "17:30" }]) } },
    "2026-01-06": { children: { "1": child([{ in: "08:00", out: "12:00" }]) } }
  }, FORFAIT);

  assert.equal(r.monthTotal, 54.09); // 36,06 + 18,03
  assert.equal(r.perDay["2026-01-05"], 36.06);
  assert.equal(r.perDay["2026-01-06"], 18.03);
});
