/* Tests du profil « Mes informations » et du pré-remplissage semaine type. */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT, store } = loadApp();
const S = ABMAT.storage;
const Compute = ABMAT.compute;

function sampleProfile() {
  const p = S.blankProfile();
  p.name = "Martine Berger";
  p.employer = "CCAS de Testville";
  p.children["1"].name = "Lina";
  p.children["1"].week["1"] = { in: "08:30", out: "17:30" }; // lundi
  p.children["1"].week["2"] = { in: "08:30", out: "17:30" }; // mardi
  p.children["2"].name = "Marius";
  p.children["2"].week["1"] = { in: "08:30", out: "16:00" };
  p.children["3"].name = "Théo";
  p.children["3"].active = false;
  p.children["3"].week["1"] = { in: "09:00", out: "17:00" }; // inactif → ignoré
  return p;
}

test("profil : aller-retour save/load avec normalisation", () => {
  assert.equal(S.saveProfile(sampleProfile()), true);
  const p = S.loadProfile();
  assert.equal(p.name, "Martine Berger");
  assert.equal(p.children["1"].name, "Lina");
  assert.equal(p.children["1"].week["1"].out, "17:30");
  assert.equal(p.children["3"].active, false);
});

test("profil : données malformées normalisées (compat nom en chaîne)", () => {
  const p = S.normalizeProfile({
    name: 42,
    children: { "1": "Lina", "2": { name: "Marius", week: "n'importe quoi" } }
  });
  assert.equal(p.name, "");
  assert.equal(p.children["1"].name, "Lina");
  assert.equal(p.children["2"].week["3"].in, "");
  assert.equal(p.children["3"].active, true);
});

test("profileHasTemplates : vrai si un enfant actif a un créneau type", () => {
  assert.equal(Compute.profileHasTemplates(null), false);
  assert.equal(Compute.profileHasTemplates(S.blankProfile()), false);
  assert.equal(Compute.profileHasTemplates(sampleProfile()), true);

  // Seul l'enfant inactif a une semaine type → non
  const p = S.blankProfile();
  p.children["1"].active = false;
  p.children["1"].week["1"] = { in: "08:00", out: "17:00" };
  assert.equal(Compute.profileHasTemplates(p), false);
});

test("pré-remplissage : jours ouvrés, fériés exclus, enfants inactifs ignorés", () => {
  // Mai 2026 : ven 01/05 et ven 08/05 fériés ; jeu 14/05 (Ascension) férié ;
  // lun 25/05 (Pentecôte) férié.
  const days = Compute.buildMonthDaysFromProfile(2026, 4, sampleProfile());

  // Lundi 04/05 : Lina + Marius, pas Théo (inactif)
  const lundi = days["2026-05-04"];
  assert.ok(lundi);
  assert.deepEqual(Object.keys(lundi.children).sort(), ["1", "2"]);
  assert.deepEqual(lundi.children["1"].slots, [{ in: "08:30", out: "17:30" }]);
  assert.deepEqual(lundi.children["2"].slots, [{ in: "08:30", out: "16:00" }]);

  // Mardi 05/05 : Lina seulement (Marius n'a que le lundi)
  assert.deepEqual(Object.keys(days["2026-05-05"].children), ["1"]);

  // Mercredi : personne → jour absent du résultat
  assert.equal(days["2026-05-06"], undefined);

  // Fériés jamais pré-remplis
  assert.equal(days["2026-05-01"], undefined);
  assert.equal(days["2026-05-08"], undefined);
  assert.equal(days["2026-05-25"], undefined); // lundi de Pentecôte

  // Week-ends jamais pré-remplis
  assert.equal(days["2026-05-09"], undefined);
});

test("le profil voyage avec l'export d'année", () => {
  S.saveProfile(sampleProfile());
  const jan = S.blankMonthData(2026, 0);
  jan.netImposable = 100;
  S.saveMonth(S.monthKey(2026, 0), jan);

  const text = JSON.stringify(S.buildYearExport(2026));

  // Storage vidé (nouvel ordinateur) : l'import restaure mois ET profil.
  Object.keys(store).forEach((k) => delete store[k]);
  S.importYearFromJsonText(text);

  assert.equal(S.loadMonth(2026, 0).data.netImposable, 100);
  assert.equal(S.loadProfile().children["1"].name, "Lina");
});
