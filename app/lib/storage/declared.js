/* ============================================================================
   storage/declared.js — Années déclarées (repère manuel, non fiscal) et
   effacement d'une année
   ----------------------------------------------------------------------------
   Simple pense-bête posé par l'utilisatrice dans le récap annuel une fois
   sa déclaration faite — PAS une date calculée (les fenêtres de
   déclaration varient chaque année, un calcul codé en dur serait faux
   l'année suivante). Volontairement local uniquement (pas de merge multi-
   appareils, pas inclus dans l'export d'année) : c'est un simple repère
   visuel, pas une donnée fiscale à synchroniser.
   ========================================================================== */

(function () {
  "use strict";

  const S = window.ABMAT && window.ABMAT.storage;

  if (!S || !S.writeRaw) {
    throw new Error("storage/core.js doit être chargé avant storage/declared.js.");
  }

  const DECLARED_KEY = "abmat:declaredYears";

  S.getDeclaredYears = function getDeclaredYears() {
    try {
      const raw = JSON.parse(localStorage.getItem(DECLARED_KEY) || "[]");
      return Array.isArray(raw) ? raw.map(Number).filter(Number.isFinite) : [];
    } catch (e) {
      return [];
    }
  };

  S.isYearDeclared = function isYearDeclared(year) {
    return S.getDeclaredYears().includes(Number(year));
  };

  S.setYearDeclared = function setYearDeclared(year, declared) {
    const y = Number(year);
    const current = S.getDeclaredYears();
    const next = declared
      ? Array.from(new Set([...current, y]))
      : current.filter((v) => v !== y);
    try {
      localStorage.setItem(DECLARED_KEY, JSON.stringify(next));
      return true;
    } catch (e) {
      return false;
    }
  };

  /**
   * Efface une année de cet appareil (RGPD : ne garder que le nécessaire) :
   * ses 12 mois, ses réglages et son repère « déclarée ». Le profil et la
   * copie de secours (fichier) ne sont pas touchés.
   */
  S.eraseYear = function eraseYear(year) {
    const y = Number(year);
    for (let m = 0; m < 12; m++) localStorage.removeItem(S.monthKey(y, m));
    localStorage.removeItem(S.settingsKey(y));
    S.setYearDeclared(y, false);
  };
})();
