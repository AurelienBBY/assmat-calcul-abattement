/* Tests de compute/month-print.js — modèle du relevé mensuel imprimable. */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT } = loadApp();
const Compute = ABMAT.compute;

const FORFAIT = 36.06;

function monthData(days, net, irf) {
  return { version: 2, year: 2026, monthIndex: 0, smicOverride: null, netImposable: net || 0, irf: irf || 0, days: days || {} };
}

test("mois vide → aucune semaine, totaux à zéro", () => {
  const m = Compute.buildMonthPrintModel(2026, 0, monthData({}), FORFAIT);
  assert.equal(m.weeks.length, 0);
  assert.equal(m.totals.abatt, 0);
  assert.equal(m.totals.joursGarde, 0);
});

test("relevé : jours renseignés seulement, groupés par semaine, sous-totaux", () => {
  // Jan 2026 : lun 05 et mar 06 (même semaine), lun 12 (semaine suivante).
  const data = monthData({
    "2026-01-05": { children: {
      "1": { absent: false, motif: "", slots: [{ in: "08:30", out: "17:30" }] },          // 36,06
      "2": { absent: true, motif: "malade", slots: [] }
    } },
    "2026-01-06": { children: {
      "1": { absent: false, motif: "", slots: [{ in: "08:00", out: "10:00" }, { in: "13:00", out: "16:00" }] } // 5 h → 22,54
    } },
    "2026-01-12": { children: {
      "1": { absent: false, motif: "", slots: [{ in: "09:00", out: "12:00" }] }           // 3 h → 13,52
    } }
  }, 1000, 100);

  const m = Compute.buildMonthPrintModel(2026, 0, data, FORFAIT);

  assert.equal(m.weeks.length, 2);
  assert.equal(m.weeks[0].days.length, 2);
  assert.equal(m.weeks[0].subtotal, 58.6);           // 36,06 + 22,54
  assert.equal(m.weeks[1].subtotal, 13.52);          // 36,06 ÷ 8 × 3

  const lundi = m.weeks[0].days[0];
  assert.equal(lundi.children.length, 2);            // l'enfant absent figure sur le relevé
  assert.equal(lundi.children[1].absent, true);
  assert.equal(lundi.dayTotal, 36.06);               // l'absent ne compte pas

  assert.equal(m.totals.abatt, 72.12);
  assert.equal(m.totals.percu, 1100);
  assert.equal(m.totals.imposable, 1027.88);
  assert.equal(m.totals.joursGarde, 3);
  assert.equal(m.totals.j_ge8, 1);
  assert.equal(m.totals.j_lt8, 2);
});

test("férié détecté et enfant invalide sans abattement", () => {
  // 14 juillet 2026 (mardi, férié) : garde quand même + un créneau incohérent.
  const data = monthData({
    "2026-07-14": { children: {
      "1": { absent: false, motif: "", slots: [{ in: "08:00", out: "17:00" }] },  // 9 h → forfait
      "2": { absent: false, motif: "", slots: [{ in: "15:00", out: "10:00" }] }   // invalide
    } }
  });
  data.monthIndex = 6;

  const m = Compute.buildMonthPrintModel(2026, 6, data, FORFAIT);
  const day = m.weeks[0].days[0];
  assert.equal(day.ferie, "Fête nationale");
  assert.equal(day.children[1].status, "invalid");
  assert.equal(day.dayTotal, 36.06);
});
