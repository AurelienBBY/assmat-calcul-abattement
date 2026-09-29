/* Tests du calendrier du mois : états des jours, avancement, actions de masse. */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT } = loadApp();
const S = ABMAT.storage;
const Compute = ABMAT.compute;

const week = (days, a, b) => { const w = S.blankWeek(); days.forEach((d) => { w[String(d)] = { in: a, out: b }; }); return w; };
const profile = S.normalizeProfile({ version: 2, firstName: "", lastName: "", employer: "", children: [
  { id: "c1", name: "Léa", from: null, to: null, periods: [{ from: null, week: Object.assign(week([1, 2, 4, 5], "08:00", "17:30"), { "3": { in: "08:00", out: "12:00" } }) }] },
  { id: "c2", name: "Tom", from: null, to: null, periods: [{ from: null, week: week([1, 2, 4, 5], "08:30", "16:30") }] }
] });
const TODAY = "2026-09-29";

function september() {
  const m = S.blankMonthData(2026, 8);
  m.days = Compute.buildMonthDaysFromProfile(2026, 8, profile);
  return m;
}

test("états des jours : habituel, modifié, pointé, non travaillé, aujourd'hui, à venir", () => {
  const m = september();
  m.days["2026-09-15"].children.c1 = { absent: true, motif: "malade", slots: [], punched: false };
  m.days["2026-09-22"].children.c1.slots = [{ in: "07:15", out: "18:00" }];
  m.days["2026-09-25"].children.c1.punched = true;
  m.days["2026-09-11"].off = true;
  const h = ABMAT.utils.getFrenchHolidays(2026);
  const st = (iso) => Compute.dayState(iso, m.days[iso], profile, TODAY, h);
  assert.equal(st("2026-09-14"), "usual");
  assert.equal(st("2026-09-15"), "modified");
  assert.equal(st("2026-09-22"), "modified");
  assert.equal(st("2026-09-25"), "punched");
  assert.equal(st("2026-09-11"), "off");
  assert.equal(st("2026-09-29"), "today");
  assert.equal(st("2026-09-30"), "future");
  delete m.days["2026-09-17"].children.c2; // Tom attendu mais absent de la journée → modifié
  assert.equal(st("2026-09-17"), "modified");
  assert.equal(Compute.dayState("2026-11-11", undefined, profile, TODAY, ABMAT.utils.getFrenchHolidays(2026)), "ferie");
  assert.equal(Compute.dayState(TODAY, undefined, profile, TODAY, h), "today"); // rien encore saisi aujourd'hui
  assert.equal(Compute.dayState("2026-09-30", undefined, profile, TODAY, h), "empty");
});

test("calendrier : semaines lun → ven, lignes par enfant, samedis avec donnée", () => {
  const m = september();
  m.days["2026-09-10"].children.c2.slots = [{ in: "08:30", out: "12:00" }, { in: "13:30", out: "16:30" }];
  m.days["2026-09-26"] = { off: false, children: {}, meetings: [{ in: "09:00", out: "11:00" }] }; // samedi
  const cal = Compute.buildCalendar(2026, 8, m, profile, TODAY);
  assert.equal(cal.weeks.length, 5);
  assert.deepEqual(cal.weeks[0].isos, ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]);
  const jeudi10 = cal.weeks[1].cells.find((c) => c.iso === "2026-09-10");
  assert.deepEqual(jeudi10.lines.map((l) => [l.label, l.text, l.kind]), [["Léa", "8h–17h30", "usual"], ["Tom", "8h30–12h, 13h30–16h30", "changed"]]);
  assert.equal(cal.saturdays.length, 1);
  assert.equal(cal.saturdays[0].meeting, true);
});

test("avancement du mois : jours à vérifier, fiche de paie, état", () => {
  const m = september();
  m.days["2026-09-11"].off = true;
  m.days["2026-09-15"].children.c1.slots = [{ in: "10:00", out: "17:30" }];
  assert.deepEqual(Compute.monthProgress(m, profile, TODAY), { toVerify: 2, payDone: false, status: "check" });
  m.verified = true;
  assert.equal(Compute.monthProgress(m, profile, TODAY).status, "pay");
  m.netImposable = 1850.4;
  assert.equal(Compute.monthProgress(m, profile, TODAY).status, "ready");
  m.done = true;
  assert.equal(Compute.monthProgress(m, profile, TODAY).status, "done");
  assert.equal(Compute.monthProgress(S.blankMonthData(2026, 11), profile, TODAY).status, "future");
  assert.equal(Compute.monthProgress(S.blankMonthData(2026, 5), profile, TODAY).status, "empty");
});

test("journée habituelle, jour non travaillé, semaine de congés", () => {
  const m = september();
  m.days["2026-09-16"].children.c1.slots = [{ in: "10:00", out: "11:00" }];
  m.days["2026-09-16"].meetings = [{ in: "19:00", out: "21:00" }];
  Compute.setDayUsual(m, "2026-09-16", profile);
  assert.deepEqual(m.days["2026-09-16"].children.c1.slots, [{ in: "08:00", out: "12:00" }]);
  assert.equal(m.days["2026-09-16"].meetings.length, 1); // réunion conservée

  Compute.setDayOff(m, "2026-09-18", true, profile);
  assert.deepEqual(m.days["2026-09-18"], { off: true, children: {}, meetings: [] });
  Compute.setDayOff(m, "2026-09-18", false, profile);
  assert.deepEqual(Object.keys(m.days["2026-09-18"].children), ["c1", "c2"]);

  const semaine = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"];
  Compute.setWeekOff(m, semaine, true, profile);
  assert.ok(semaine.every((iso) => m.days[iso].off));
  assert.equal(Compute.buildCalendar(2026, 8, m, profile, TODAY).weeks[3].allOff, true);
  Compute.setWeekOff(m, semaine, false, profile);
  assert.ok(semaine.every((iso) => !m.days[iso].off));

  // Un jour pointé garde ses heures réelles : ni congés, ni retour à l'habituel.
  m.days["2026-09-28"].children.c1 = { absent: false, motif: "", slots: [{ in: "07:56", out: "17:34" }], punched: true };
  const fin = ["2026-09-28", "2026-09-29", "2026-09-30"];
  Compute.setWeekOff(m, fin, true, profile);
  assert.equal(m.days["2026-09-28"].off, false);
  assert.equal(m.days["2026-09-29"].off, true);
  assert.equal(Compute.buildCalendar(2026, 8, m, profile, TODAY).weeks[4].allOff, true);
  Compute.setWeekOff(m, fin, false, profile);
  assert.deepEqual(m.days["2026-09-28"].children.c1.slots, [{ in: "07:56", out: "17:34" }]);
});
