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

test("installation : iPhone, iPad, Android, ordinateur, ou déjà ouvert depuis l'icône", () => {
  const C = ABMAT.compute;
  const t = (ua, extra) => C.installTarget(Object.assign({ ua, maxTouchPoints: 0, standalone: false }, extra || {}));
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
  assert.equal(t(IPHONE), "ios");
  assert.equal(t(MAC, { maxTouchPoints: 5 }), "ios");   // iPad
  assert.equal(t(MAC), "desktop");
  assert.equal(t(ANDROID), "android");
  assert.equal(t(IPHONE, { standalone: true }), "installed");
});

test("installation : « Continuer sans installer » mémorisé", () => {
  assert.equal(S.installSkipped(), false);
  S.skipInstall();
  assert.equal(S.installSkipped(), true);
});
