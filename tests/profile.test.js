/* Tests du profil v2 (enfants datés, horaires versionnés), du pré-remplissage
   et du report d'un changement d'horaires sur les mois déjà remplis. */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT, store } = loadApp();
const S = ABMAT.storage;
const Compute = ABMAT.compute;

const week = (days, a, b) => {
  const w = S.blankWeek();
  days.forEach((d) => { w[String(d)] = { in: a, out: b }; });
  return w;
};

// Lina : lun + mar 8h30-17h30 depuis toujours. Marius : lundi 8h30-16h,
// arrivé le 04/05/2026, parti le 15/05/2026. Théo : lundi, horaires qui
// changent le 11/05/2026 (9h-17h → 8h-12h).
function sampleProfile() {
  const p = S.blankProfile();
  p.firstName = "Martine";
  p.lastName = "Berger";
  p.employer = "CCAS de Testville";
  p.children = [
    { id: "c1", name: "Lina", from: null, to: null, periods: [{ from: null, week: week([1, 2], "08:30", "17:30") }] },
    { id: "c2", name: "Marius", from: "2026-05-04", to: "2026-05-15", periods: [{ from: null, week: week([1], "08:30", "16:00") }] },
    { id: "c3", name: "Théo", from: null, to: null, periods: [
      { from: "2026-05-11", week: week([1], "08:00", "12:00") },
      { from: null, week: week([1], "09:00", "17:00") }
    ] }
  ];
  return S.normalizeProfile(p);
}

test("profil v2 : aller-retour save/load, périodes triées", () => {
  assert.equal(S.saveProfile(sampleProfile()), true);
  const p = S.loadProfile();
  assert.equal(p.firstName, "Martine");
  assert.equal(p.children.length, 3);
  assert.equal(p.children[1].to, "2026-05-15");
  assert.deepEqual(p.children[2].periods.map((x) => x.from), [null, "2026-05-11"]);
});

test("profil v2 : données malformées normalisées, ids inconnus écartés", () => {
  const p = S.normalizeProfile({ version: 2, firstName: 42, children: [
    { id: "c7", name: " Léa ", from: "hier", periods: "n'importe quoi" },
    { id: "enfant", name: "Intrus" }
  ] });
  assert.equal(p.firstName, "");
  assert.equal(p.children.length, 1);
  assert.equal(p.children[0].name, "Léa");
  assert.equal(p.children[0].from, null);
  assert.equal(p.children[0].periods.length, 1);
  assert.equal(S.newChildId(p), "c8");
});

test("migration v1 → v2 : nom, enfants non vides, désactivé = parti à la date de migration", () => {
  const v1 = {
    name: "Sylvie Martin", employer: "CCAS", mention: "Agrément 42",
    children: {
      "1": { name: "Lina", active: true, week: { "1": { in: "08:30", out: "17:30" } } },
      "2": { name: "Marius", active: false },          // désactivé
      "3": { name: "", active: true, week: {} }         // jamais renseigné → retiré
    },
    updatedAt: "2026-07-01T10:00:00Z"
  };
  const p = S.normalizeProfile(v1, "2026-09-29");
  assert.equal(p.version, 2);
  assert.equal(p.lastName, "Sylvie Martin");
  assert.equal("mention" in p, false);
  assert.deepEqual(p.children.map((c) => [c.id, c.name, c.to]), [["c1", "Lina", null], ["c2", "Marius", "2026-09-29"]]);
  assert.equal(p.children[0].periods[0].from, null);
  assert.equal(p.updatedAt, "2026-07-01T10:00:00Z");
  assert.throws(() => S.normalizeProfile(v1), /date du jour/);

  // Ancienne forme « nom en chaîne »
  const old = S.normalizeProfile({ children: { "1": "Lina" } }, "2026-09-29");
  assert.deepEqual(old.children.map((c) => c.name), ["Lina"]);
});

test("chargement d'un profil v1 : migré une seule fois, horodatage conservé", () => {
  store["abmat:profile"] = JSON.stringify({ name: "Sylvie", children: { "1": { name: "Lina", active: false } }, updatedAt: "2026-07-01T10:00:00Z" });
  const first = S.loadProfile();
  const stored = JSON.parse(store["abmat:profile"]);
  assert.equal(stored.version, 2);
  assert.equal(stored.updatedAt, "2026-07-01T10:00:00Z");
  assert.equal(S.loadProfile().children[0].to, first.children[0].to); // la date ne dérive plus
});

test("accueil et horaires en vigueur à une date", () => {
  const [lina, marius, theo] = sampleProfile().children;
  assert.equal(Compute.childActiveOn(marius, "2026-05-01"), false);
  assert.equal(Compute.childActiveOn(marius, "2026-05-15"), true);   // borne incluse
  assert.equal(Compute.childActiveOn(marius, "2026-05-18"), false);
  assert.deepEqual(Compute.usualSlots(theo, "2026-05-04"), [{ in: "09:00", out: "17:00" }]);
  assert.deepEqual(Compute.usualSlots(theo, "2026-05-11"), [{ in: "08:00", out: "12:00" }]);
  assert.deepEqual(Compute.usualSlots(lina, "2026-05-06"), []);      // mercredi vide
  assert.deepEqual(Compute.usualSlots(lina, "2026-05-09"), []);      // samedi
  assert.deepEqual(["r2", "c10", "c2", "r1", "c1"].sort(Compute.compareChildIds), ["c1", "c2", "c10", "r1", "r2"]);
  assert.equal(Compute.childLabel(sampleProfile(), "c9", null), "Enfant 9");
  assert.equal(Compute.childLabel(null, "r1", { relais: true, name: "Nino" }), "Nino");
});

test("pré-remplissage : dates d'accueil, horaires en vigueur, fériés et week-ends exclus", () => {
  // Mai 2026 : ven 01/05, ven 08/05, jeu 14/05 (Ascension), lun 25/05 (Pentecôte) fériés.
  const days = Compute.buildMonthDaysFromProfile(2026, 4, sampleProfile());

  // Lundi 04/05 : Lina, Marius (arrivé ce jour) et Théo (anciens horaires)
  assert.deepEqual(Object.keys(days["2026-05-04"].children), ["c1", "c2", "c3"]);
  assert.deepEqual(days["2026-05-04"].children.c3.slots, [{ in: "09:00", out: "17:00" }]);
  // Lundi 11/05 : Théo avec ses nouveaux horaires
  assert.deepEqual(days["2026-05-11"].children.c3.slots, [{ in: "08:00", out: "12:00" }]);
  // Lundi 18/05 : Marius est parti
  assert.deepEqual(Object.keys(days["2026-05-18"].children), ["c1", "c3"]);
  // Mardi 05/05 : Lina seule
  assert.deepEqual(Object.keys(days["2026-05-05"].children), ["c1"]);
  assert.equal(days["2026-05-05"].off, false);
  // Mercredi : personne ; fériés et week-ends jamais pré-remplis
  assert.equal(days["2026-05-06"], undefined);
  assert.equal(days["2026-05-01"], undefined);
  assert.equal(days["2026-05-25"], undefined);
  assert.equal(days["2026-05-09"], undefined);
});

test("changement d'horaires : seuls les jours encore « comme d'habitude » après la date changent", () => {
  const before = sampleProfile().children[0]; // Lina lun + mar 8h30-17h30
  const after = JSON.parse(JSON.stringify(before));
  after.periods.push({ from: "2026-05-12", week: week([1, 2, 3], "08:00", "18:00") });

  const month = S.blankMonthData(2026, 4);
  month.days = Compute.buildMonthDaysFromProfile(2026, 4, { children: [before] });
  month.days["2026-05-18"].children.c1.slots = [{ in: "10:00", out: "17:30" }]; // modifié à la main
  month.days["2026-05-19"].children.c1.punched = true;                           // pointé
  month.days["2026-05-26"].off = true;                                           // non travaillé

  const n = Compute.rescheduleMonth(month, before, after, "2026-05-12");

  assert.deepEqual(month.days["2026-05-11"].children.c1.slots, [{ in: "08:30", out: "17:30" }]); // avant la date
  assert.deepEqual(month.days["2026-05-12"].children.c1.slots, [{ in: "08:00", out: "18:00" }]);
  assert.deepEqual(month.days["2026-05-13"].children.c1.slots, [{ in: "08:00", out: "18:00" }]); // nouveau mercredi
  assert.deepEqual(month.days["2026-05-18"].children.c1.slots, [{ in: "10:00", out: "17:30" }]); // intact
  assert.deepEqual(month.days["2026-05-19"].children.c1.slots, [{ in: "08:30", out: "17:30" }]); // intact
  assert.equal(month.days["2026-05-26"].children.c1.slots[0].in, "08:30");                       // intact
  // Changés : mar 12, mer 13, mer 20, mer 27 (lun 18 modifié, mar 19 pointé, mar 26 non travaillé,
  // jeu 14 et lun 25 fériés).
  assert.equal(n, 4);
});

test("changement de date de départ : les jours prévus après le départ disparaissent, un mois terminé ne bouge pas", () => {
  const before = sampleProfile().children[0];
  const after = Object.assign(JSON.parse(JSON.stringify(before)), { to: "2026-05-15" });
  const month = S.blankMonthData(2026, 4);
  month.days = Compute.buildMonthDaysFromProfile(2026, 4, { children: [before] });

  const done = JSON.parse(JSON.stringify(month));
  done.done = true;
  assert.equal(Compute.rescheduleMonth(done, before, after, "2026-05-16"), 0);

  const n = Compute.rescheduleMonth(month, before, after, "2026-05-16");
  assert.equal(n, 3); // lun 18, mar 19, mar 26 (lun 25 férié)
  assert.equal(month.days["2026-05-18"], undefined);
  assert.ok(month.days["2026-05-12"]);
});

test("le profil voyage avec l'export d'année", () => {
  S.saveProfile(sampleProfile());
  const jan = S.blankMonthData(2026, 0);
  jan.netImposable = 100;
  S.saveMonth(S.monthKey(2026, 0), jan);

  const text = JSON.stringify(S.buildYearExport(2026));

  // Storage vidé (nouvel ordinateur) : la fusion restaure mois ET profil.
  Object.keys(store).forEach((k) => delete store[k]);
  S.mergeYearFromJsonText(text);

  assert.equal(S.loadMonth(2026, 0).data.netImposable, 100);
  assert.equal(S.loadProfile().children[0].name, "Lina");
});
