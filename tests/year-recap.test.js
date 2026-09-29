/* Tests du récapitulatif annuel — abattement réel, SMIC par année, statuts, case 1AJ. */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT, CONFIG, store } = loadApp();
const Compute = ABMAT.compute;

// Janvier 2026 (SMIC 12,02 → forfait 36,06) : un jour complet + un jour invalide.
// Volontairement au format v1 : prouve que la migration traverse tout le chemin.
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

// Février 2026 : ancien smicOverride 10 (ignoré en v3 : le SMIC est réglé par année)
// → forfait 36,06 ; 4 h → 18,03 ; pas d'argent saisi.
store["abmat:2026-02"] = JSON.stringify({
  version: 1, year: 2026, monthIndex: 1, smicOverride: 10,
  netImposable: 0, irf: 0,
  days: { "2026-02-03": { slots: { "1": { in: "08:00", out: "12:00" }, "2": {}, "3": {} } } }
});

// Avril 2026 (format v2) : multi-créneaux (5 h → prorata 22,54) + un enfant absent.
store["abmat:2026-04"] = JSON.stringify({
  version: 2, year: 2026, monthIndex: 3, smicOverride: null,
  netImposable: 800, irf: 50,
  days: { "2026-04-07": { children: {
    "1": { absent: false, motif: "", slots: [{ in: "08:30", out: "11:00" }, { in: "14:00", out: "16:30" }] },
    "2": { absent: true, motif: "malade", slots: [] }
  } } }
});

test("mois complet (données v1 migrées) : abattement, imposable, jours et statut ok", () => {
  const jan = Compute.computeMonthRecap(2026, 0);
  assert.equal(jan.abatt, 69.87);
  assert.equal(jan.percu, 1100);
  assert.equal(jan.apres, 1030.13);
  assert.equal(jan.j_ge8, 1);
  assert.equal(jan.j_lt8, 1);
  assert.equal(jan.status, "ok");
});

test("un seul SMIC par année : l'ancien smicOverride mensuel est ignoré", () => {
  const fev = Compute.computeMonthRecap(2026, 1);
  assert.equal(fev.abatt, 18.03);
  assert.equal(fev.apres, -18.03);       // abattement sans paie : solde négatif
  assert.equal(fev.status, "incomplet"); // jours sans argent
});

test("SMIC de l'année : réglage d'année prioritaire, sinon barème, sinon « manquant »", () => {
  store["abmat:2027-01"] = JSON.stringify({ version: 3, year: 2027, monthIndex: 0, netImposable: 100, irf: 0,
    days: { "2027-01-04": { children: { c1: { slots: [{ in: "08:00", out: "17:00" }] } } } } });

  // 2027 absent du barème et non réglé : aucun abattement inventé, signalé.
  assert.equal(Compute.smicForYear(2027), null);
  const missing = Compute.computeYearRecap(2027);
  assert.equal(missing.totals.smicMissing, true);
  assert.equal(missing.totals.abatt, 0);

  // Réglé au passage d'année : 12,20 → forfait 36,60.
  ABMAT.storage.saveYearSettings({ year: 2027, smic: 12.2, relais: false });
  const set = Compute.computeYearRecap(2027);
  assert.equal(set.totals.smicMissing, false);
  assert.equal(set.totals.abatt, 36.6);
  assert.equal(Compute.smicForYear(2026), 12.02); // barème
});

test("mois sans données : vide, 0 partout", () => {
  const mars = Compute.computeMonthRecap(2026, 2);
  assert.equal(mars.status, "vide");
  assert.equal(mars.abatt, 0);
  assert.equal(mars.apres, 0);
});

test("mois v2 : multi-créneaux au prorata, absence sans abattement", () => {
  const avr = Compute.computeMonthRecap(2026, 3);
  assert.equal(avr.abatt, 22.54);     // 5 h cumulées → 36,06 ÷ 8 × 5
  assert.equal(avr.percu, 850);
  assert.equal(avr.apres, 827.46);
  assert.equal(avr.j_lt8, 1);         // l'enfant absent ne compte pas
  assert.equal(avr.status, "ok");
});

test("totaux annuels agrégés sur 12 mois", () => {
  const year = Compute.computeYearRecap(2026);
  assert.equal(year.months.length, 12);
  assert.equal(year.totals.abatt, 110.44);
  assert.equal(year.totals.percu, 1950);
  // 1950 − 110,44 : les 18,03 € d'abattement de février (sans paie) comptent.
  assert.equal(year.totals.apres, 1839.56);
  assert.equal(year.totals.imposable, 1839.56);
  assert.equal(year.totals.j_ge8, 1);
  assert.equal(year.totals.j_lt8, 3);
});

test("barème : SMIC 2023 corrigé (11,27 → forfait 33,81)", () => {
  assert.equal(CONFIG.computeForfaitJourFromSmic(CONFIG.getSmicHoraireBrut(2023), 3), 33.81);
});

test("case 1AJ : l'abattement d'un mois qui dépasse le perçu se déduit des autres mois", () => {
  const day = (iso) => ({ [iso]: { children: {
    "1": { absent: false, motif: "", slots: [{ in: "08:00", out: "17:00" }] },
    "2": { absent: false, motif: "", slots: [{ in: "08:00", out: "17:00" }] },
    "3": { absent: false, motif: "", slots: [{ in: "08:00", out: "17:00" }] }
  } } });
  // 2025 (SMIC 11,88 → 35,64) : 3 enfants ≥ 8 h = 106,92 €/jour.
  // Juin : 10 jours (1 069,20 €) mais seulement 500 € perçus (paie versée plus tard).
  const juin = {};
  ["02", "03", "04", "05", "06", "09", "10", "11", "12", "13"].forEach((d) => Object.assign(juin, day(`2025-06-${d}`)));
  store["abmat:2025-06"] = JSON.stringify({ version: 2, year: 2025, monthIndex: 5, smicOverride: null, netImposable: 450, irf: 50, days: juin });
  // Juillet : 1 jour (106,92 €) et 2 000 € perçus.
  store["abmat:2025-07"] = JSON.stringify({ version: 2, year: 2025, monthIndex: 6, smicOverride: null, netImposable: 1800, irf: 200, days: day("2025-07-01") });

  const y = Compute.computeYearRecap(2025);
  assert.equal(y.months[5].apres, -569.2);
  assert.equal(y.months[6].apres, 1893.08);
  assert.equal(y.totals.abatt, 1176.12);
  assert.equal(y.totals.imposable, 1323.88); // 2 500 − 1 176,12 (et non 1 893,08)
});

test("case 1AJ : jamais négative sur l'année", () => {
  store["abmat:2024-03"] = JSON.stringify({ version: 2, year: 2024, monthIndex: 2, smicOverride: null, netImposable: 10, irf: 0,
    days: { "2024-03-04": { children: { "1": { absent: false, motif: "", slots: [{ in: "08:00", out: "17:00" }] } } } } });
  const y = Compute.computeYearRecap(2024);
  assert.equal(y.totals.apres, -24.95); // 10 − 34,95 (SMIC 2024 11,65 × 3)
  assert.equal(y.totals.imposable, 0);
});

test("jour non travaillé : ni abattement ni journée-enfant", () => {
  store["abmat:2026-11"] = JSON.stringify({ version: 3, year: 2026, monthIndex: 10, netImposable: 0, irf: 0,
    days: { "2026-11-02": { off: true, children: { c1: { slots: [{ in: "08:00", out: "17:00" }] } } } } });
  const nov = Compute.computeMonthRecap(2026, 10);
  assert.equal(nov.abatt, 0);
  assert.equal(nov.j_ge8 + nov.j_lt8, 0);
});
