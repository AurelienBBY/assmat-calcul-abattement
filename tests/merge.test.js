/* Tests de la fusion multi-appareils par mois horodatés (mergeYearFromJsonText). */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT, store } = loadApp();
const S = ABMAT.storage;

function month(net, updatedAt) {
  const m = S.blankMonthData(2026, 0);
  m.netImposable = net;
  if (updatedAt) m.updatedAt = updatedAt;
  return m;
}

function yearFile(months, profile) {
  return JSON.stringify({ format: "abmat-year", version: 1, year: 2026, months, profile: profile || null });
}

function reset() {
  Object.keys(store).forEach((k) => delete store[k]);
}

test("le mois du fichier gagne s'il est plus récent", () => {
  reset();
  store["abmat:2026-01"] = JSON.stringify(month(100, "2026-07-01T10:00:00Z"));

  const res = S.mergeYearFromJsonText(yearFile({ "0": month(999, "2026-07-10T10:00:00Z") }));
  assert.equal(res.applied, 1);
  assert.equal(S.loadMonth(2026, 0).data.netImposable, 999);
  // L'horodatage du fichier est préservé (pas re-tamponné à l'import)
  assert.equal(S.loadMonth(2026, 0).data.updatedAt, "2026-07-10T10:00:00Z");
});

test("le mois local gagne s'il est plus récent — pas d'écrasement", () => {
  reset();
  store["abmat:2026-01"] = JSON.stringify(month(100, "2026-07-10T10:00:00Z"));

  const res = S.mergeYearFromJsonText(yearFile({ "0": month(999, "2026-07-01T10:00:00Z") }));
  assert.equal(res.applied, 0);
  assert.equal(res.kept, 1);
  assert.equal(S.loadMonth(2026, 0).data.netImposable, 100);
});

test("un mois absent du fichier reste intact localement", () => {
  reset();
  store["abmat:2026-03"] = JSON.stringify(Object.assign(S.blankMonthData(2026, 2), { netImposable: 300, updatedAt: "2026-07-01T10:00:00Z" }));

  S.mergeYearFromJsonText(yearFile({}));
  assert.equal(S.loadMonth(2026, 2).data.netImposable, 300);
});

test("conflit (les deux modifiés depuis la dernière synchro) → le résolveur arbitre", () => {
  reset();
  store["abmat:2026-01"] = JSON.stringify(month(100, "2026-07-10T10:00:00Z"));

  const calls = [];
  const res = S.mergeYearFromJsonText(
    yearFile({ "0": month(999, "2026-07-09T10:00:00Z") }),
    {
      lastMergedAt: "2026-07-05T00:00:00Z", // les deux ont bougé après
      resolveConflict: (mi, fileAt, localAt) => {
        calls.push([mi, fileAt, localAt]);
        return "file"; // l'utilisatrice choisit le fichier malgré son ancienneté
      }
    }
  );

  assert.deepEqual(res.conflicts, [0]);
  assert.equal(calls.length, 1);
  assert.equal(S.loadMonth(2026, 0).data.netImposable, 999);
});

test("pas de conflit si un seul côté a bougé depuis la dernière synchro", () => {
  reset();
  store["abmat:2026-01"] = JSON.stringify(month(100, "2026-07-01T10:00:00Z")); // avant la synchro

  const res = S.mergeYearFromJsonText(
    yearFile({ "0": month(999, "2026-07-10T10:00:00Z") }),
    { lastMergedAt: "2026-07-05T00:00:00Z", resolveConflict: () => { throw new Error("ne doit pas être appelé"); } }
  );

  assert.deepEqual(res.conflicts, []);
  assert.equal(S.loadMonth(2026, 0).data.netImposable, 999);
});

test("profil : la version la plus récente gagne", () => {
  reset();
  const oldP = S.blankProfile();
  oldP.name = "Ancien nom";
  oldP.updatedAt = "2026-07-01T10:00:00Z";
  store["abmat:profile"] = JSON.stringify(oldP);

  const newP = S.blankProfile();
  newP.name = "Nouveau nom";
  newP.updatedAt = "2026-07-10T10:00:00Z";

  S.mergeYearFromJsonText(yearFile({}, newP));
  assert.equal(S.loadProfile().name, "Nouveau nom");

  // L'inverse : un profil plus ancien dans le fichier ne régresse pas le local.
  oldP.name = "Encore plus ancien";
  S.mergeYearFromJsonText(yearFile({}, oldP));
  assert.equal(S.loadProfile().name, "Nouveau nom");
});

test("saveMonth ne tamponne que si le contenu change", () => {
  reset();
  const m = S.blankMonthData(2026, 5);
  m.netImposable = 50;

  S.saveMonth("abmat:2026-06", m);
  const t1 = JSON.parse(store["abmat:2026-06"]).updatedAt;
  assert.ok(t1);

  // Re-sauvegarde à l'identique (ex. simple consultation) → même horodatage
  S.saveMonth("abmat:2026-06", m);
  assert.equal(JSON.parse(store["abmat:2026-06"]).updatedAt, t1);

  // Vraie modification → nouvel horodatage
  m.netImposable = 60;
  S.saveMonth("abmat:2026-06", m);
  assert.notEqual(JSON.parse(store["abmat:2026-06"]).updatedAt, undefined);
  assert.equal(JSON.parse(store["abmat:2026-06"]).netImposable, 60);
});
