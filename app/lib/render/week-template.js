/* ============================================================================
   render/week-template.js — Semaine type d'un enfant (Mes informations)
   ----------------------------------------------------------------------------
   Grille lundi → vendredi, un créneau (entrée/sortie) par jour. Jour laissé
   vide = pas de garde ce jour-là. Sert au pré-remplissage d'un mois vide.
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.render = window.ABMAT.render || {};

  const R = window.ABMAT.render;
  const U = window.ABMAT.utils;

  if (!U) {
    throw new Error("ABMAT.utils est requis avant ABMAT.render (charger utils.js en premier).");
  }

  const DAYS = [
    { key: "1", label: "Lundi" },
    { key: "2", label: "Mardi" },
    { key: "3", label: "Mercredi" },
    { key: "4", label: "Jeudi" },
    { key: "5", label: "Vendredi" }
  ];

  /**
   * @param {HTMLElement} container
   * @param {Object} child - entrée profil {name, active, week}
   * @param {string} childKey - "1".."3" (pour les ids)
   * @param {()=>void} onChange - appelé après chaque modification (le profil
   *                              est muté directement)
   */
  R.renderWeekTemplate = function renderWeekTemplate(container, child, childKey, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "week-template";

    const title = document.createElement("div");
    title.className = "week-template__title";
    title.textContent = "Semaine type";
    wrap.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "week-template__grid";

    DAYS.forEach((day) => {
      const cell = document.createElement("div");
      cell.className = "week-template__day";

      const label = document.createElement("div");
      label.className = "week-template__day-label";
      label.textContent = day.label;
      cell.appendChild(label);

      const t = child.week[day.key];

      ["in", "out"].forEach((kind) => {
        const input = document.createElement("input");
        input.type = "time";
        input.id = `wt-${childKey}-${day.key}-${kind}`;
        input.value = (typeof t[kind] === "string") ? t[kind] : "";
        input.setAttribute(
          "aria-label",
          `${kind === "in" ? "Entrée" : "Sortie"} type ${day.label.toLowerCase()}`
        );
        input.addEventListener("change", () => {
          t[kind] = input.value || "";
          onChange();
        });
        cell.appendChild(input);
      });

      grid.appendChild(cell);
    });

    wrap.appendChild(grid);

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Laissez un jour vide si l'enfant ne vient pas ce jour-là.";
    wrap.appendChild(hint);

    container.appendChild(wrap);
  };
})();
