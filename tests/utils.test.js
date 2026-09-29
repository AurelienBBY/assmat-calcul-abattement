/* Tests de utils.js — jours fériés français (fixes + mobiles) et dates ISO. */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT } = loadApp();
const U = ABMAT.utils;

test("toIsoDate formate en YYYY-MM-DD", () => {
  assert.equal(U.toIsoDate(new Date(2026, 4, 4)), "2026-05-04");
});

test("fériés fixes 2026", () => {
  const h = U.getFrenchHolidays(2026);
  assert.equal(h["2026-01-01"], "Jour de l'an");
  assert.equal(h["2026-05-01"], "Fête du Travail");
  assert.equal(h["2026-05-08"], "Victoire 1945");
  assert.equal(h["2026-07-14"], "Fête nationale");
  assert.equal(h["2026-12-25"], "Noël");
});

test("fêtes mobiles 2026 (Pâques le 5 avril)", () => {
  const h = U.getFrenchHolidays(2026);
  assert.equal(h["2026-04-06"], "Lundi de Pâques");
  assert.equal(h["2026-05-14"], "Ascension");
  assert.equal(h["2026-05-25"], "Lundi de Pentecôte");
});

test("fêtes mobiles 2025 (Pâques le 20 avril)", () => {
  const h = U.getFrenchHolidays(2025);
  assert.equal(h["2025-04-21"], "Lundi de Pâques");
  assert.equal(h["2025-05-29"], "Ascension");
  assert.equal(h["2025-06-09"], "Lundi de Pentecôte");
});

test("un jour ordinaire n'est pas férié", () => {
  const h = U.getFrenchHolidays(2026);
  assert.equal(h["2026-05-04"], undefined);
});

test("parseMoneyFR : virgule, point, espaces (y compris insécables)", () => {
  assert.deepEqual(U.parseMoneyFR("1234,56"), { status: "ok", value: 1234.56 });
  assert.deepEqual(U.parseMoneyFR("1234.56"), { status: "ok", value: 1234.56 });
  assert.deepEqual(U.parseMoneyFR(" 1 234,5 "), { status: "ok", value: 1234.5 });
  assert.deepEqual(U.parseMoneyFR("1\u202f850,40"), { status: "ok", value: 1850.4 });
  assert.deepEqual(U.parseMoneyFR("210"), { status: "ok", value: 210 });
  assert.deepEqual(U.parseMoneyFR("0"), { status: "ok", value: 0 });
});

test("parseMoneyFR : vide et saisies ambiguës ou fausses signalées, jamais converties", () => {
  assert.deepEqual(U.parseMoneyFR(""), { status: "empty", value: null });
  assert.deepEqual(U.parseMoneyFR("   "), { status: "empty", value: null });
  ["1.234,56", "1,234.56", "12,345", "12€", "-50", "abc", "1234,"].forEach((txt) => {
    assert.equal(U.parseMoneyFR(txt).status, "invalid", txt);
  });
});
