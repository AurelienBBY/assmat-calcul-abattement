

/* ============================================================================
   utils.js — Utilitaires (dates, formats, parsing)
   ----------------------------------------------------------------------------
   Objectif : regrouper les petites fonctions réutilisées partout, pour garder
   les autres fichiers plus lisibles (render, calc, storage, app).
   ----------------------------------------------------------------------------
   Pas de dépendances, pas de réseau, compatible ouverture locale (double-clic).
   ========================================================================== */

(function () {
  "use strict";

  // Namespace global (sans modules/bundler)
  window.ABMAT = window.ABMAT || {};
  window.ABMAT.utils = window.ABMAT.utils || {};

  const U = window.ABMAT.utils;

  // --- Constantes FR --------------------------------------------------------

  U.MONTHS_FR = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  // 0=dimanche ... 6=samedi (convention JS Date.getDay())
  U.WEEKDAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  // --- Helpers génériques ---------------------------------------------------

  U.pad2 = function pad2(n) {
    return String(n).padStart(2, "0");
  };

  U.formatDateFR = function formatDateFR(d) {
    // dd/mm/yyyy
    return `${U.pad2(d.getDate())}/${U.pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  U.daysInMonth = function daysInMonth(year, monthIndex0) {
    // monthIndex0: 0..11
    return new Date(year, monthIndex0 + 1, 0).getDate();
  };

  U.isWeekend = function isWeekend(dateObj) {
    const day = dateObj.getDay(); // 0=dim ... 6=sam
    return day === 0 || day === 6;
  };

  U.toIsoDate = function toIsoDate(d) {
    // Date -> "YYYY-MM-DD"
    return `${d.getFullYear()}-${U.pad2(d.getMonth() + 1)}-${U.pad2(d.getDate())}`;
  };

  /**
   * Jours fériés français d'une année : map "YYYY-MM-DD" -> nom.
   * Fixes + fêtes mobiles dérivées de Pâques (algorithme de Meeus/Butcher).
   */
  U.getFrenchHolidays = function getFrenchHolidays(year) {
    const y = Number(year);

    // Dimanche de Pâques
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    const easter = new Date(y, month - 1, day);

    const shift = (base, days) => {
      const out = new Date(base);
      out.setDate(out.getDate() + days);
      return out;
    };

    const map = {};
    const add = (date, name) => { map[U.toIsoDate(date)] = name; };

    add(new Date(y, 0, 1), "Jour de l'an");
    add(new Date(y, 4, 1), "Fête du Travail");
    add(new Date(y, 4, 8), "Victoire 1945");
    add(new Date(y, 6, 14), "Fête nationale");
    add(new Date(y, 7, 15), "Assomption");
    add(new Date(y, 10, 1), "Toussaint");
    add(new Date(y, 10, 11), "Armistice 1918");
    add(new Date(y, 11, 25), "Noël");
    add(shift(easter, 1), "Lundi de Pâques");
    add(shift(easter, 39), "Ascension");
    add(shift(easter, 50), "Lundi de Pentecôte");

    return map;
  };

  U.safeEl = function safeEl(id) {
    const el = document.getElementById(id);
    if (!el) {
      throw new Error(`Élément introuvable: #${id}`);
    }
    return el;
  };

  // --- Formats (euros / heures) --------------------------------------------

  U.fmtEuro = function fmtEuro(amount) {
    const n = Number(amount);
    const safe = Number.isFinite(n) ? n : 0;

    // Si le config expose un formateur, on le réutilise.
    if (window.ABMAT_CONFIG && typeof window.ABMAT_CONFIG.formatEuro === "function") {
      return window.ABMAT_CONFIG.formatEuro(safe);
    }
    // Fallback
    return safe.toFixed(2).replace(".", ",") + " €";
  };

  U.fmtHours = function fmtHours(hours) {
    const n = Number(hours);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " h";
  };

  // --- Parsing + maths ------------------------------------------------------

  U.parseTimeToMinutes = function parseTimeToMinutes(hhmm) {
    // "08:30" -> 510
    if (!hhmm || typeof hhmm !== "string") return null;
    const m = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
    if (!m) return null;

    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;

    return (hh * 60) + mm;
  };

  U.round2 = function round2(n) {
    return Math.round(Number(n) * 100) / 100;
  };

  // --- Locale FR (UX) -------------------------------------------------------
  // Force la locale FR au niveau du document.
  // Utile pour garantir l’affichage 24h des <input type="time">
  // selon le navigateur / OS (notamment Safari).
  U.forceFrenchLocale = function forceFrenchLocale() {
    try {
      document.documentElement.lang = "fr";
      document.documentElement.setAttribute("data-locale", "fr-FR");
    } catch (e) {
      // Silencieux : non bloquant
    }
  };

    /**
   * Convertit des heures décimales en format lisible "XhYY"
   * Exemples :
   *  - 7.5  -> "7h30"
   *  - 4.25 -> "4h15"
   *  - 8    -> "8h00"
   */
  U.fmtHoursHM = function fmtHoursHM(hours) {
    const h = Number(hours);
    if (!Number.isFinite(h)) return "—";

    const totalMinutes = Math.round(h * 60);
    const hh = Math.floor(totalMinutes / 60);
    const mm = totalMinutes % 60;

    return `${hh}h${U.pad2(mm)}`;
  };
})();