/* Tests des heures supplémentaires — exemples de docs/spec-heures-supplementaires.md. */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT } = loadApp();
const O = ABMAT.overtime;

const kid = (slots, extra) => Object.assign({ absent: false, motif: "", slots: slots.map(([a, b]) => ({ in: a, out: b })), punched: false }, extra || {});
const day = (children, meetings) => ({ off: false, children, meetings: (meetings || []).map(([a, b]) => ({ in: a, out: b })) });
const due = (d, opts) => O.computeDay(d, opts).dueMin;
const names = { c1: "Léa", c2: "Tom", c3: "Inès" };
const label = (id) => names[id];

test("seuil de 10 h et arrondi à la demi-heure commencée", () => {
  assert.equal(due(day({ c1: kid([["07:30", "17:30"]]) })), 0);   // 10 h 00 pile
  assert.equal(due(day({ c1: kid([["07:30", "17:31"]]) })), 30);  // 10 h 01
  assert.equal(due(day({ c1: kid([["07:45", "18:10"]]) })), 30);  // 10 h 25
  assert.equal(due(day({ c1: kid([["07:30", "18:00"]]) })), 30);  // 10 h 30
  assert.equal(due(day({ c1: kid([["07:00", "17:45"]]) })), 60);  // 10 h 45
});

test("de la 1re arrivée au dernier départ, creux compris, absents ignorés", () => {
  const r = O.computeDay(day({ c1: kid([["07:30", "12:00"]]), c2: kid([["13:30", "18:00"]]) }));
  assert.equal(r.totalMin, 630);
  assert.equal(r.dueMin, 30);
  assert.deepEqual([r.firstId, r.lastId], ["c1", "c2"]);
  assert.equal(due(day({ c1: kid([], { absent: true }), c2: kid([["09:00", "16:00"]]) })), 0);
});

test("réunions : pause non comptée, chevauchement compté une seule fois", () => {
  // Réunion le soir : 9 h + 2 h = 11 h → 1 h
  const soir = O.computeDay(day({ c1: kid([["08:00", "17:00"]]) }, [["19:00", "21:00"]]));
  assert.deepEqual([soir.totalMin, soir.dueMin], [660, 60]);
  assert.deepEqual(soir.meetings[0].gap, [17 * 60, 19 * 60]);
  // Chevauchement d'1 h : 8h → 19h = 11 h → 1 h
  const chev = O.computeDay(day({ c1: kid([["08:00", "18:00"]]) }, [["17:00", "19:00"]]));
  assert.deepEqual([chev.totalMin, chev.meetings[0].overlapMin, chev.dueMin], [660, 60, 60]);
  // 10 h 15 + 45 min hors enfants = 11 h → 1 h
  assert.equal(due(day({ c1: kid([["08:00", "18:15"]]) }, [["17:30", "19:00"]])), 60);
  // Réunion tôt le matin : pause 7h30 → 8h non comptée, 30 min + 9 h 30 = 10 h → 0
  assert.equal(due(day({ c1: kid([["08:00", "17:30"]]) }, [["07:00", "07:30"]])), 0);
  // Deux réunions qui se chevauchent entre elles : comptées une fois
  assert.equal(O.computeDay(day({ c1: kid([["08:00", "17:00"]]) }, [["19:00", "20:00"], ["19:30", "21:00"]])).totalMin, 660);
});

test("jour sans enfant : toute la durée de la réunion est due, arrondie", () => {
  const r = O.computeDay(day({}, [["09:00", "11:15"]]));
  assert.equal(r.meetingOnly, true);
  assert.deepEqual([r.totalMin, r.dueMin], [135, 150]); // 2 h 15 → 2 h 30
});

test("horaire incomplet ou incohérent → à vérifier, jamais calculé", () => {
  assert.equal(O.computeDay(day({ c1: kid([["08:00", ""]]) })).status, "invalid");
  assert.equal(O.computeDay(day({ c1: kid([["08:00", "17:00"]]) }, [["20:00", "19:00"]])).status, "invalid");
  assert.equal(O.computeDay({ off: true, children: { c1: kid([["07:00", "19:00"]]) }, meetings: [] }).status, "none");
});

test("pointage en cours : l'heure actuelle tient lieu de départ", () => {
  const r = O.computeDay(day({ c1: kid([["07:58", ""]]), c2: kid([["08:34", ""]]) }), { nowMin: 18 * 60 + 10 });
  assert.equal(r.status, "open");
  assert.deepEqual([r.totalMin, r.dueMin], [612, 30]);

  // Réunion en cours (fin pas encore pointée) pendant que Léa est encore là.
  const m = O.computeDay(day({ c1: kid([["07:58", ""]]) }, [["18:00", ""]]), { nowMin: 18 * 60 + 20 });
  assert.equal(m.status, "open");
  assert.deepEqual([m.totalMin, m.meetings[0].overlapMin, m.meetings[0].addedMin], [622, 20, 0]);
  assert.equal(O.explainDay(m, () => "Léa").lines[0], "Enfants : de 7h58 (arrivée de Léa) à 18h20, pour l'instant = 10 h 22.");
  // Sans heure actuelle (calcul du mois), une réunion sans fin reste à vérifier.
  assert.equal(O.computeDay(day({ c1: kid([["08:00", "17:00"]]) }, [["18:00", ""]])).status, "invalid");
});

test("mois : total dû, jours avec heures sup., jours à vérifier", () => {
  const m = O.computeMonth({
    "2026-09-17": day({ c1: kid([["08:00", "17:30"]]) }, [["19:00", "21:00"]]), // 11 h 30 → 1 h 30
    "2026-09-22": day({ c1: kid([["07:15", "18:00"]]) }),                        // 10 h 45 → 1 h
    "2026-09-23": day({ c1: kid([["08:00", "12:00"]]) }),
    "2026-09-24": day({ c1: kid([["08:00", ""]]) })
  });
  assert.deepEqual([m.dueMin, m.hsDays, m.invalidDays], [150, 2, ["2026-09-24"]]);
});

test("explication en français simple", () => {
  const soir = O.explainDay(O.computeDay(day({ c1: kid([["08:00", "17:30"]]), c2: kid([["08:30", "16:30"]]) }, [["19:00", "21:00"]])), label);
  assert.deepEqual(soir.lines, [
    "Enfants : de 8h à 17h30 (arrivée et départ de Léa) = 9 h 30.",
    "Réunion de 19h à 21h : 2 h ajoutées. La pause de 17h30 à 19h n'est pas comptée.",
    "Journée retenue : 11 h 30."
  ]);
  assert.equal(soir.verdict, "1 h 30 au-delà de 10 h → 1 h 30 d'heures sup.");

  const chev = O.explainDay(O.computeDay(day({ c1: kid([["08:00", "18:15"]]) }, [["17:30", "19:00"]])), label);
  assert.equal(chev.lines[1], "Réunion de 17h30 à 19h : 45 min en même temps que les enfants (comptées une seule fois), 45 min ajoutées.");

  const deux = O.explainDay(O.computeDay(day({ c1: kid([["07:15", "18:00"]]), c3: kid([["08:30", "18:40"]]) })), label);
  assert.equal(deux.lines[0], "Enfants : de 7h15 (arrivée de Léa) à 18h40 (départ d'Inès) = 11 h 25.");
  assert.equal(deux.verdict, "1 h 25 au-delà de 10 h → 1 h 30 d'heures sup. (toute demi-heure commencée compte)");

  assert.equal(O.explainDay(O.computeDay(day({ c1: kid([["08:00", "17:30"]]) })), label).verdict,
    "9 h 30 : 10 h ou moins, pas d'heure supplémentaire.");
  assert.equal(O.explainDay(O.computeDay(day({}, [["09:00", "11:15"]])), label).verdict,
    "Jour sans enfant : toute la réunion compte → 2 h 30 d'heures sup. (toute demi-heure commencée compte)");
});
