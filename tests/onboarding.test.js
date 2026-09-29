/* Tests de la mise en route : formulaire enfant (anciens horaires, enfant
   parti), mois passés remplis sans rien écraser. */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT } = loadApp();
const S = ABMAT.storage;
const Compute = ABMAT.compute;
const TODAY = "2026-09-29";

const lea = () => Object.assign(Compute.blankChildForm(false), {
  name: " Léa ", from: "2024-09-02", days: [1, 2, 4, 5], same: true, a: "08:00", b: "17:30",
  chg: { on: true, date: "2026-04-06", a: "08:30", b: "17:00" }
});

test("formulaire → enfant : horaires actuels depuis la date du changement, anciens avant", () => {
  const c = Compute.childFromForm(lea(), "c1");
  assert.equal(c.name, "Léa");
  assert.equal(c.to, null);
  assert.deepEqual(c.periods.map((p) => p.from), [null, "2026-04-06"]);
  assert.deepEqual(Compute.usualSlots(c, "2026-03-02"), [{ in: "08:30", out: "17:00" }]);
  assert.deepEqual(Compute.usualSlots(c, "2026-04-06"), [{ in: "08:00", out: "17:30" }]);
  assert.deepEqual(Compute.usualSlots(c, "2026-04-08"), []); // mercredi : ne vient pas
  const back = Compute.formFromChild(c, TODAY);
  assert.deepEqual([back.days, back.same, back.a, back.chg.on, back.chg.date, back.chg.a], [[1, 2, 4, 5], true, "08:00", true, "2026-04-06", "08:30"]);
});

test("formulaire : horaires différents selon le jour, enfant parti", () => {
  const f = Object.assign(Compute.blankChildForm(true, "2026-01-01"), {
    name: "Jules", from: "2025-09-01", days: [1, 3], same: false,
    per: { 1: { a: "08:00", b: "16:30" }, 3: { a: "08:00", b: "12:00" } }, to: "2026-03-27"
  });
  const c = Compute.childFromForm(f, "c4");
  assert.equal(c.to, "2026-03-27");
  assert.deepEqual(Compute.usualSlots(c, "2026-03-04"), [{ in: "08:00", out: "12:00" }]);
  assert.deepEqual(Compute.usualSlots(c, "2026-03-30"), []); // parti
  assert.equal(Compute.formFromChild(c, TODAY).before, true);
  assert.equal(Compute.formFromChild(c, TODAY).same, false);
});

test("formulaire : erreurs expliquées en français simple", () => {
  const err = (patch) => Compute.childFormError(Object.assign(lea(), patch), TODAY);
  assert.equal(err({}), null);
  assert.match(err({ name: " " }), /prénom/);
  assert.match(err({ days: [] }), /au moins un jour/);
  assert.match(err({ b: "07:00" }), /départ après/);
  assert.match(err({ same: false, per: { 1: { a: "08:00", b: "17:00" } } }), /mardi/);
  assert.match(err({ chg: { on: true, date: "2024-01-01", a: "08:00", b: "17:00" } }), /après son arrivée/);
  assert.match(err({ chg: { on: true, date: "2026-12-01", a: "08:00", b: "17:00" } }), /futur/);
  assert.match(Compute.childFormError(Object.assign(lea(), { before: true, chg: { on: false } }), TODAY), /dernier jour/);
  assert.match(err({ to: "2024-01-01" }), /après son arrivée/);
});

test("mois passés : seulement les mois vides, chaque enfant entre ses dates", () => {
  const profile = S.normalizeProfile({ version: 2, children: [
    Compute.childFromForm(lea(), "c1"),
    Compute.childFromForm(Object.assign(Compute.blankChildForm(true), { name: "Jules", from: "2025-09-01", days: [5], a: "08:00", b: "16:00", to: "2026-03-27" }), "c2")
  ] });
  const blank = { 0: true, 1: false, 2: true, 3: true };
  const plan = Compute.pastMonthsPlan(2026, 0, 3, profile, (m) => blank[m]);
  assert.deepEqual(plan.map((p) => p.monthIndex), [0, 2, 3]); // février n'est pas vide : jamais écrasé
  const mars = plan[1].days;
  assert.deepEqual(mars["2026-03-27"].children.c2.slots, [{ in: "08:00", out: "16:00" }]);
  assert.deepEqual(mars["2026-03-02"].children.c1.slots, [{ in: "08:30", out: "17:00" }]); // anciens horaires
  const avril = plan[2].days;
  assert.equal(avril["2026-04-03"].children.c2, undefined); // Jules parti
  assert.deepEqual(avril["2026-04-07"].children.c1.slots, [{ in: "08:00", out: "17:30" }]);
});
