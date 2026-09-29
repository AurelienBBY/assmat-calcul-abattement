/* Tests de storage/* — normalisation et migrations du mois (v3), export/import d'année. */

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
  assert.equal("smicOverride" in res.data, false); // SMIC désormais réglé par année
  const c1 = res.data.days["2026-01-05"].children.c1;
  assert.equal(c1.slots[0].in, "");    // nombre → chaîne vide
  assert.equal(c1.slots[0].out, "17:00");
});

test("migration v1 → v3 : anciens slots → enfants c1…c3 à un créneau, vides retirés", () => {
  const text = JSON.stringify({
    version: 1, year: 2026, monthIndex: 0, netImposable: 500, irf: 0,
    days: { "2026-01-05": { slots: {
      "1": { in: "08:30", out: "17:30" },
      "2": { in: "", out: "" },
      "3": { in: "09:00", out: "12:00" }
    } } }
  });

  const res = S.importMonthFromJsonText(text, 2026, 0, false);
  assert.equal(res.data.version, 3);
  const day = res.data.days["2026-01-05"];
  assert.deepEqual(day, {
    off: false,
    children: {
      c1: { absent: false, motif: "", slots: [{ in: "08:30", out: "17:30" }], punched: false },
      c3: { absent: false, motif: "", slots: [{ in: "09:00", out: "12:00" }], punched: false }
    },
    meetings: []
  });
});

test("migration v2 → v3 : absences conservées, créneaux vides purgés, plafond 3 créneaux", () => {
  const text = JSON.stringify({
    version: 2, year: 2026, monthIndex: 0, netImposable: 0, irf: 0,
    days: {
      "2026-01-06": { children: {
        "1": { absent: true, motif: "malade", slots: [{ in: "", out: "" }] },
        "2": { slots: [
          { in: "08:00", out: "10:00" }, { in: "", out: "" },
          { in: "11:00", out: "12:00" }, { in: "13:00", out: "14:00" }, { in: "15:00", out: "16:00" }
        ] },
        "3": { absent: false, motif: "", slots: [] }
      } },
      "2026-01-07": { children: { "1": { slots: [] }, "2": {}, "3": {} } } // jour sans donnée
    }
  });

  const res = S.importMonthFromJsonText(text, 2026, 0, false);
  const children = res.data.days["2026-01-06"].children;
  assert.deepEqual(children.c1, { absent: true, motif: "malade", slots: [], punched: false });
  assert.equal(children.c2.slots.length, 3); // vide purgé, plafonné à 3
  assert.equal(children.c3, undefined);       // enfant sans donnée retiré
  assert.equal(res.data.days["2026-01-07"], undefined); // jour vide retiré
});

test("v3 : jour non travaillé, réunions, pointage et accueil relais conservés", () => {
  const text = JSON.stringify({
    version: 3, year: 2026, monthIndex: 8, netImposable: 0, irf: 0, verified: true, done: "oui",
    days: {
      "2026-09-04": { off: true, children: {}, meetings: [] },
      "2026-09-17": { children: {
        c1: { absent: false, slots: [{ in: "07:58", out: "17:34" }], punched: true },
        r1: { relais: true, name: "  Nino ", slots: [{ in: "08:00", out: "17:00" }] },
        x9: { slots: [{ in: "08:00", out: "09:00" }] }
      }, meetings: [{ in: "19:00", out: "21:00" }, { in: "", out: "" }] }
    }
  });

  const res = S.importMonthFromJsonText(text, 2026, 8, false);
  assert.equal(res.data.verified, true);
  assert.equal(res.data.done, false); // seul true compte
  assert.deepEqual(res.data.days["2026-09-04"], { off: true, children: {}, meetings: [] });
  const day = res.data.days["2026-09-17"];
  assert.equal(day.children.c1.punched, true);
  assert.deepEqual(day.children.r1, { absent: false, motif: "", slots: [{ in: "08:00", out: "17:00" }], punched: false, relais: true, name: "Nino" });
  assert.equal(day.children.x9, undefined); // clé inconnue ignorée
  assert.deepEqual(day.meetings, [{ in: "19:00", out: "21:00" }]);
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
  mai.days["2026-05-04"] = { off: false, children: { c1: { absent: false, motif: "", slots: [{ in: "08:30", out: "17:30" }], punched: false } }, meetings: [] };
  S.saveMonth(S.monthKey(2026, 4), mai);

  S.saveMonth(S.monthKey(2026, 7), S.blankMonthData(2026, 7)); // août vide → exclu

  const exp = S.buildYearExport(2026);
  assert.equal(exp.format, "abmat-year");
  assert.equal(exp.year, 2026);
  assert.equal(exp.monthsCount, 2);
  assert.deepEqual(Object.keys(exp.months).sort(), ["0", "4"]);
});

test("fusion année : restauration complète sur un appareil vide", () => {
  const text = JSON.stringify(S.buildYearExport(2026));

  // On repart d'un storage vide pour prouver la restauration.
  Object.keys(store).forEach((k) => delete store[k]);

  const res = S.mergeYearFromJsonText(text);
  assert.equal(res.year, 2026);
  assert.equal(res.applied, 2);
  assert.deepEqual(res.conflicts, []);
  assert.equal(S.loadMonth(2026, 0).data.netImposable, 1200);
  assert.equal(S.loadMonth(2026, 4).data.days["2026-05-04"].children.c1.slots[0].out, "17:30");
});

test("fusion année : format inconnu ou année invalide → erreur explicite", () => {
  assert.throws(() => S.mergeYearFromJsonText(JSON.stringify({ year: 2026 })), /abmat-year/);
  assert.throws(() => S.mergeYearFromJsonText(JSON.stringify({ format: "abmat-year", year: "?" })), /invalide/);
});

test("mois vide : un jour non travaillé ou une réunion suffit à le rendre non vide", () => {
  const m = S.blankMonthData(2026, 9);
  assert.equal(S.isBlankMonth(m), true);
  m.days["2026-10-02"] = { off: true, children: {}, meetings: [] };
  assert.equal(S.isBlankMonth(m), false);
  const n = S.blankMonthData(2026, 9);
  n.days["2026-10-03"] = { off: false, children: {}, meetings: [{ in: "09:00", out: "11:00" }] };
  assert.equal(S.isBlankMonth(n), false);
});

test("réglages d'année : SMIC invalide → non réglé, horodatage seulement si le contenu change", () => {
  assert.deepEqual(S.normalizeYearSettings({ smic: "abc", relais: "oui" }, 2027), { version: 1, year: 2027, smic: null, relais: false });
  assert.equal(S.normalizeYearSettings({ smic: 0 }, 2027).smic, null);
  assert.equal(S.isBlankYearSettings(S.loadYearSettings(2031)), true);

  S.saveYearSettings({ year: 2031, smic: 12.5, relais: true });
  const t1 = JSON.parse(store["abmat:settings:2031"]).updatedAt;
  S.saveYearSettings({ year: 2031, smic: 12.5, relais: true });
  assert.equal(JSON.parse(store["abmat:settings:2031"]).updatedAt, t1);
  assert.deepEqual([S.loadYearSettings(2031).smic, S.loadYearSettings(2031).relais], [12.5, true]);
});
