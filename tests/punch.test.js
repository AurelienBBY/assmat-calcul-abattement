/* Tests de la pointeuse « Aujourd'hui ». */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT } = loadApp();
const S = ABMAT.storage;
const Compute = ABMAT.compute;
const O = ABMAT.overtime;

const week = (days, a, b) => { const w = S.blankWeek(); days.forEach((d) => { w[String(d)] = { in: a, out: b }; }); return w; };
const profile = S.normalizeProfile({ version: 2, firstName: "", lastName: "", employer: "", children: [
  { id: "c1", name: "Léa", from: null, to: null, periods: [{ from: null, week: week([1, 2, 4, 5], "08:00", "17:30") }] },
  { id: "c2", name: "Tom", from: null, to: null, periods: [{ from: null, week: week([1, 2, 4, 5], "08:30", "16:30") }] },
  { id: "c3", name: "Inès", from: "2026-09-14", to: null, periods: [{ from: null, week: week([1], "08:30", "17:00") }] }
] });
const TUE = "2026-09-29";

function month() {
  const m = S.blankMonthData(2026, 8);
  m.days = Compute.buildMonthDaysFromProfile(2026, 8, profile);
  return m;
}

test("liste du jour : attendus, arrivés, partis, absents ; pas prévus à part", () => {
  const m = month();
  let list = Compute.punchList(profile, TUE, m.days[TUE]);
  assert.deepEqual(list.map((x) => [x.id, x.state]), [["c1", "waiting"], ["c2", "waiting"]]);
  assert.deepEqual(Compute.notExpectedToday(profile, TUE, m.days[TUE]).map((c) => c.id), ["c3"]);

  Compute.punchIn(m, TUE, "c1", "07:58");
  Compute.punchAbsent(m, TUE, "c2", "conges");
  list = Compute.punchList(profile, TUE, m.days[TUE]);
  assert.deepEqual(list.map((x) => [x.id, x.state]), [["c1", "here"], ["c2", "absent"]]);
  assert.deepEqual(m.days[TUE].children.c1, { absent: false, motif: "", slots: [{ in: "07:58", out: "" }], punched: true });
  assert.equal(Compute.someoneHere(m.days[TUE]), true);

  Compute.punchOut(m, TUE, "c1", "17:34");
  assert.equal(Compute.punchList(profile, TUE, m.days[TUE])[0].state, "left");
  assert.equal(Compute.someoneHere(m.days[TUE]), false);
});

test("pointage : départ avant l'arrivée ou double arrivée refusés", () => {
  const m = month();
  Compute.punchIn(m, TUE, "c1", "08:00");
  assert.throws(() => Compute.punchIn(m, TUE, "c1", "09:00"), /déjà arrivé/);
  assert.throws(() => Compute.punchOut(m, TUE, "c1", "07:59"), /après l'arrivée/);
  assert.throws(() => Compute.punchOut(m, TUE, "c2", "17:00"), /pas arrivé/);
  // Parti puis revenu : 2e horaire
  Compute.punchOut(m, TUE, "c1", "11:00");
  Compute.punchIn(m, TUE, "c1", "14:00");
  assert.equal(m.days[TUE].children.c1.slots.length, 2);
});

test("annuler une absence remet les horaires habituels ; relais ; réunion ; heures sup. en direct", () => {
  const m = month();
  Compute.punchAbsent(m, TUE, "c2", "");
  Compute.cancelAbsence(m, TUE, "c2", profile);
  assert.deepEqual(m.days[TUE].children.c2, { absent: false, motif: "", slots: [{ in: "08:30", out: "16:30" }], punched: false });

  const id = Compute.punchInRelais(m, TUE, " Nino ", "08:10");
  assert.equal(id, "r1");
  assert.equal(m.days[TUE].children.r1.name, "Nino");
  Compute.punchIn(m, TUE, "c1", "07:15");
  Compute.meetingStart(m, TUE, "19:00");
  assert.throws(() => Compute.meetingStart(m, TUE, "19:30"), /déjà en cours/);
  Compute.meetingEnd(m, TUE, "20:00");
  // 18h10 : Léa et Nino encore là → 7h15 → 18h10 = 10 h 55 (+ réunion 19h-20h = 11 h 55) → 2 h
  const r = O.computeDay(m.days[TUE], { nowMin: 18 * 60 + 10 });
  assert.equal(r.status, "open");
  assert.equal(r.dueMin, 120);
});
