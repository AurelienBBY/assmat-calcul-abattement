/* Tests de l'état d'interface mémorisé : étape de la mise en route, bulles d'aide vues. */

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./harness");

const { ABMAT, store } = loadApp();
const S = ABMAT.storage;

test("mise en route : pas commencée par défaut, étape et fin mémorisées", () => {
  assert.deepEqual(S.loadOnboarding(), { step: 0, done: false });
  S.saveOnboarding({ step: 3, done: false });
  assert.deepEqual(S.loadOnboarding(), { step: 3, done: false });
  S.saveOnboarding({ step: 6, done: true });
  assert.deepEqual(S.loadOnboarding(), { step: 6, done: true });
});

test("mise en route : état illisible ou absurde → repartir de l'accueil (pas une donnée fiscale)", () => {
  store["abmat:ui:onboarding"] = "{illisible";
  assert.deepEqual(S.loadOnboarding(), { step: 0, done: false });
  store["abmat:ui:onboarding"] = JSON.stringify({ step: -2, done: "oui" });
  assert.deepEqual(S.loadOnboarding(), { step: 0, done: false });
});

test("bulles d'aide : une par onglet, vue une seule fois", () => {
  assert.equal(S.tipSeen("month"), false);
  S.markTipSeen("month");
  S.markTipSeen("today");
  assert.equal(S.tipSeen("month"), true);
  assert.equal(S.tipSeen("today"), true);
  assert.equal(S.tipSeen("year"), false);
});
