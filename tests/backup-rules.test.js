/* Tests des rappels de copie de secours sur iPhone. */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT, store } = loadApp();
const Compute = ABMAT.compute;
const S = ABMAT.storage;

const NOW = Date.parse("2026-09-29T08:00:00Z");
const ago = (days) => new Date(NOW - days * 24 * 3600 * 1000).toISOString();
const ctx = (extra) => Object.assign({ manual: true, childHere: false, now: NOW, todayIso: "2026-09-29" }, extra || {});
const sync = (extra) => Object.assign(Compute.syncBlank(), extra || {});

test("ordinateur : jamais de rappel (copie automatique)", () => {
  assert.equal(Compute.backupPrompt(sync({ pending: ["a", "b", "c"], lastImportAt: ago(30) }), "open", ctx({ manual: false })), null);
});

test("ouverture : question de reprise si la dernière reprise a plus de 7 jours", () => {
  assert.deepEqual(Compute.backupPrompt(sync({ lastImportAt: ago(9) }), "open", ctx()), { type: "import", kind: "modal" });
  assert.equal(Compute.backupPrompt(sync({ lastImportAt: ago(2) }), "open", ctx()), null);
  assert.equal(Compute.backupPrompt(sync(), "open", ctx()), null); // jamais repris : l'accueil propose la restauration
  // « Non, rien de nouveau » → une semaine de calme
  const s = sync({ lastImportAt: ago(9) });
  Compute.syncSnoozeImport(s, NOW);
  assert.equal(Compute.backupPrompt(s, "open", ctx()), null);
});

test("jamais de fenêtre pendant qu'un enfant est présent, au plus une fenêtre par jour", () => {
  assert.deepEqual(Compute.backupPrompt(sync({ lastImportAt: ago(9) }), "open", ctx({ childHere: true })), { type: "import", kind: "banner" });
  assert.deepEqual(Compute.backupPrompt(sync({ lastImportAt: ago(9), lastPromptOn: "2026-09-29" }), "open", ctx()), { type: "import", kind: "banner" });
});

test("envoi : copie de plus de 7 jours, fin de mois, fin de journée (3 jours ou plus)", () => {
  assert.deepEqual(Compute.backupPrompt(sync({ pending: ["2026-09-22"], lastSentAt: ago(8) }), "open", ctx()), { type: "send-old", kind: "modal" });
  assert.equal(Compute.backupPrompt(sync({ pending: [], lastSentAt: ago(8) }), "open", ctx()), null);
  assert.deepEqual(Compute.backupPrompt(sync({ pending: ["2026-09"] }), "month-done", ctx()), { type: "send-month", kind: "modal" });
  assert.equal(Compute.backupPrompt(sync({ pending: ["a", "b"] }), "day-end", ctx()), null);
  assert.deepEqual(Compute.backupPrompt(sync({ pending: ["a", "b", "c"] }), "day-end", ctx()), { type: "send-day", kind: "toast" });
  const s = sync({ pending: ["a", "b", "c"], lastSentAt: ago(10) });
  Compute.syncSnoozeSend(s, NOW); // « Plus tard » → 3 jours de calme
  assert.equal(Compute.backupPrompt(s, "day-end", ctx()), null);
  assert.equal(Compute.backupPrompt(s, "open", ctx()), null);
});

test("état de l'appareil : modifications en attente, envoi, stockage", () => {
  const s = sync();
  Compute.syncChanged(s, "2026-09-29");
  Compute.syncChanged(s, "2026-09-29");
  Compute.syncChanged(s, "2026-09");
  assert.deepEqual(s.pending, ["2026-09-29", "2026-09"]);
  Compute.syncSent(s, NOW);
  assert.deepEqual([s.pending, s.lastSentAt], [[], "2026-09-29T08:00:00.000Z"]);
  S.saveDeviceSync(s);
  assert.deepEqual(S.loadDeviceSync(), s);
  store["abmat:sync"] = "{illisible";
  assert.deepEqual(S.loadDeviceSync(), Compute.syncBlank());
});
