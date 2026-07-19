/* ============================================================================
   render/period.js — Sélecteur de période (mois / année)
   ----------------------------------------------------------------------------
   Rôle :
   - Affiche le sélecteur d'année et les onglets des mois
   - Émet { year, monthIndex } via onPeriodChange

   Dépendances :
   - window.ABMAT.render (R) — initialisé par render/index.js
   - window.ABMAT.utils (U) — MONTHS_FR, helpers divers
   ===========================================================================
*/

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.render = window.ABMAT.render || {};

  const R = window.ABMAT.render;
  const U = window.ABMAT.utils;

  if (!U) {
    throw new Error("ABMAT.utils est requis avant ABMAT.render (charger utils.js en premier).");
  }

  // -----------------------------------------------------------------------------
  // 1) Sélecteurs mois / année
  // -----------------------------------------------------------------------------

/**
 * @param {HTMLElement} container
 * @param {Object} state {year, monthIndex}
 * @param {(next:{year:number, monthIndex:number})=>void} onPeriodChange
 */
R.renderPeriodSelector = function renderPeriodSelector(container, state, onPeriodChange) {
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "period-controls";

  // Top row (year selector)
  const top = document.createElement("div");
  top.className = "period-top";

  // Année : pastilles fixes de 2023 à l'année courante (les archives restent
  // accessibles pour toujours — pas de fenêtre glissante).
  const YEAR_MIN = 2023;

  const yearWrap = document.createElement("div");
  yearWrap.className = "period-year";

  const yearLabel = document.createElement("span");
  yearLabel.className = "period-year__label";
  yearLabel.textContent = "Année";

  const now = new Date();
  const currentYear = now.getFullYear();

  // Valeurs initiales
  const effectiveMonth = Number.isFinite(Number(state.monthIndex)) ? Number(state.monthIndex) : now.getMonth();
  const effectiveYear = Number.isFinite(Number(state.year)) ? Number(state.year) : currentYear;

  const isRecapActive = (effectiveMonth === 12);

  // Emit function
  const emit = (nextMonthIndex, nextYear) => {
    const next = {
      monthIndex: Number.isFinite(Number(nextMonthIndex)) ? Number(nextMonthIndex) : effectiveMonth,
      year: Number.isFinite(Number(nextYear)) ? Number(nextYear) : effectiveYear
    };
    onPeriodChange && onPeriodChange(next);
  };

  const yearTabs = document.createElement("div");
  yearTabs.className = "year-tabs";
  yearTabs.setAttribute("role", "group");
  yearTabs.setAttribute("aria-label", "Année");

  const minYear = Math.min(YEAR_MIN, effectiveYear);
  const maxYear = Math.max(currentYear, effectiveYear);
  for (let y = minYear; y <= maxYear; y++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "year-tab" + (y === effectiveYear ? " is-active" : "");
    btn.textContent = String(y);
    btn.setAttribute("aria-pressed", y === effectiveYear ? "true" : "false");
    const yy = y;
    btn.addEventListener("click", () => emit(effectiveMonth, yy));
    yearTabs.appendChild(btn);
  }

  // Month tabs (intercalaires)
  const tabs = document.createElement("div");
  tabs.className = "month-tabs";

  const monthLabelShort = (name) => {
    const s = String(name || "").trim();
    return (s.slice(0, 3) || s).toUpperCase();
  };

  const monthLabelFull = (name) => {
    return String(name || "").toUpperCase();
  };

  U.MONTHS_FR.forEach((name, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const isActive = (!isRecapActive && idx === effectiveMonth);
    btn.className = "month-tab" + (isActive ? " is-active" : "");
    btn.setAttribute("data-month", String(idx));
    btn.setAttribute("aria-label", name);
    btn.textContent = isActive ? monthLabelFull(name) : monthLabelShort(name);

    btn.addEventListener("click", () => emit(idx));
    tabs.appendChild(btn);
  });

  // Onglet RÉCAP (vue annuelle)
  const recapBtn = document.createElement("button");
  recapBtn.type = "button";
  recapBtn.className = "month-tab month-tab--recap" + (isRecapActive ? " is-active" : "");
  recapBtn.textContent = "RÉCAP";
  recapBtn.setAttribute("aria-label", "Récapitulatif annuel");

  recapBtn.addEventListener("click", () => emit(12));
  tabs.appendChild(recapBtn);

  // Assemble elements
  yearWrap.appendChild(yearLabel);
  yearWrap.appendChild(yearTabs);
  top.appendChild(yearWrap);

  wrap.appendChild(top);
  wrap.appendChild(tabs);

  container.appendChild(wrap);
};

})();
