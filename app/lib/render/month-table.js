/* ============================================================================
   render/month-table.js — Tableau du mois (structure + événements)
   ----------------------------------------------------------------------------
   Rôle :
   - Génère les semaines et les jours ouvrés du mois (lignes via day-rows.js)
   - Séparateurs de semaine avec « Recopier la semaine précédente »
   - Totaux hebdomadaires
   - Délègue tous les événements (inputs, absences, boutons) aux handlers

   Handlers attendus : { onTimeChange, onSlotAdd, onSlotRemove, onAbsentToggle,
                         onMotifChange, onChildAdd, onWeekCopy }
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

  function attachEvents(table, H) {
    // Saisie d'un horaire
    table.addEventListener("input", (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLInputElement) || t.type !== "time") return;
      H.onTimeChange({
        isoDate: t.getAttribute("data-date"),
        child: t.getAttribute("data-child"),
        slotIndex: Number(t.getAttribute("data-slot-index")),
        kind: t.getAttribute("data-time"),
        value: t.value || ""
      });
    });

    // Absence (case à cocher) et motif (select)
    table.addEventListener("change", (ev) => {
      const t = ev.target;
      if (t instanceof HTMLInputElement && t.hasAttribute("data-absent")) {
        H.onAbsentToggle({
          isoDate: t.getAttribute("data-date"),
          child: t.getAttribute("data-child"),
          absent: t.checked
        });
      } else if (t instanceof HTMLSelectElement && t.hasAttribute("data-motif")) {
        H.onMotifChange({
          isoDate: t.getAttribute("data-date"),
          child: t.getAttribute("data-child"),
          motif: t.value
        });
      }
    });

    // Boutons (+ enfant, + créneau, ✕, recopier la semaine)
    table.addEventListener("click", (ev) => {
      const btn = ev.target instanceof Element ? ev.target.closest("button[data-action]") : null;
      if (!btn) return;
      const isoDate = btn.getAttribute("data-date");
      const child = btn.getAttribute("data-child");

      switch (btn.getAttribute("data-action")) {
        case "add-child":
          H.onChildAdd({ isoDate });
          break;
        case "add-slot":
          H.onSlotAdd({ isoDate, child });
          break;
        case "remove-slot":
          H.onSlotRemove({ isoDate, child, slotIndex: Number(btn.getAttribute("data-slot-index")) });
          break;
        case "copy-week":
          H.onWeekCopy({
            startIso: btn.getAttribute("data-week-start"),
            endIso: btn.getAttribute("data-week-end")
          });
          break;
      }
    });
  }

  /**
   * @param {HTMLElement} container
   * @param {Object} state {year, monthIndex, data} — data = mois v2 (source des valeurs)
   * @param {Object} handlers voir en-tête
   */
  R.renderMonthTable = function renderMonthTable(container, state, handlers) {
    container.innerHTML = "";

    const year = state.year;
    const monthIndex = state.monthIndex;
    const days = (state.data && state.data.days) ? state.data.days : {};
    const childNames = state.childNames || null;
    const holidays = U.getFrenchHolidays(year);

    const heading = document.createElement("p");
    heading.className = "month-heading";
    heading.textContent = `Mois : ${U.MONTHS_FR[monthIndex]} ${year} (jours ouvrés)`;
    container.appendChild(heading);

    // Mois vide + semaines types disponibles : proposer le pré-remplissage.
    if (state.prefillAvailable && typeof handlers.onPrefill === "function") {
      const banner = document.createElement("div");
      banner.className = "prefill-banner";

      const text = document.createElement("span");
      text.textContent = "Ce mois est vide — remplissez-le en un clic avec les semaines types de vos enfants (fériés exclus).";
      banner.appendChild(text);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "prefill-banner__btn";
      btn.textContent = "Pré-remplir le mois";
      btn.addEventListener("click", () => handlers.onPrefill());
      banner.appendChild(btn);

      container.appendChild(banner);
    }

    const table = document.createElement("table");
    table.className = "abmat-table";
    table.setAttribute("data-month", `${year}-${U.pad2(monthIndex + 1)}`);

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    [
      ["col-date", "Date"], ["", "Enfant"], ["", "Horaires (entrée → sortie)"],
      ["", "Temps de présence"], ["", "Abattement"], ["", "Total jour"]
    ].forEach(([cls, label]) => {
      const th = document.createElement("th");
      if (cls) th.className = cls;
      th.textContent = label;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const totalDays = U.daysInMonth(year, monthIndex);

    let hasRows = false;
    let started = false;
    let weekStartDate = null;

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, monthIndex, day);
      if (U.isWeekend(d)) continue;

      hasRows = true;

      // --- Début de semaine : 1re journée ouvrée du mois ou chaque lundi
      if (!started || d.getDay() === 1) {
        started = true;
        weekStartDate = new Date(d);

        let end = new Date(d);
        end.setDate(end.getDate() + (5 - end.getDay())); // vers vendredi
        if (end.getMonth() !== monthIndex) {
          end = new Date(year, monthIndex, totalDays);
          if (end.getDay() === 6) end.setDate(end.getDate() - 1); // samedi -> vendredi
          if (end.getDay() === 0) end.setDate(end.getDate() - 2); // dimanche -> vendredi
        }

        const startLabel = `${U.pad2(weekStartDate.getDate())}/${U.pad2(weekStartDate.getMonth() + 1)}`;
        const endLabel = `${U.pad2(end.getDate())}/${U.pad2(end.getMonth() + 1)}`;

        const trSep = document.createElement("tr");
        trSep.className = "week-sep";
        const tdSep = document.createElement("td");
        tdSep.colSpan = 6;
        tdSep.innerHTML = `Semaine du <strong>${startLabel}</strong> au <strong>${endLabel}</strong>`;

        // « Recopier la semaine précédente » : seulement si elle est dans le même mois
        if (weekStartDate.getDate() - 7 >= 1) {
          const copyBtn = document.createElement("button");
          copyBtn.type = "button";
          copyBtn.className = "week-copy";
          copyBtn.setAttribute("data-action", "copy-week");
          copyBtn.setAttribute("data-week-start", U.toIsoDate(weekStartDate));
          copyBtn.setAttribute("data-week-end", U.toIsoDate(end));
          copyBtn.textContent = "⟳ Recopier la semaine précédente";
          tdSep.appendChild(copyBtn);
        }

        trSep.appendChild(tdSep);
        tbody.appendChild(trSep);
      }

      const isoDate = U.toIsoDate(d);
      const weekdayLong = d.toLocaleDateString("fr-FR", { weekday: "long" });

      R.buildDayRows({
        isoDate,
        weekdayLabel: weekdayLong.charAt(0).toUpperCase() + weekdayLong.slice(1),
        dayNumLabel: `${U.pad2(day)}/${U.pad2(monthIndex + 1)}`,
        ferieName: holidays[isoDate] || null,
        dayObj: days[isoDate],
        childNames
      }).forEach((tr) => tbody.appendChild(tr));

      // --- Fin de semaine : total hebdomadaire
      let nextWorking = null;
      for (let dd = day + 1; dd <= totalDays; dd++) {
        const nd = new Date(year, monthIndex, dd);
        if (!U.isWeekend(nd)) { nextWorking = nd; break; }
      }
      const isEndOfWeek = (!nextWorking) || (nextWorking.getDay() === 1);

      if (isEndOfWeek && weekStartDate) {
        const weekEnd = new Date(d);
        const startLabel = `${U.pad2(weekStartDate.getDate())}/${U.pad2(weekStartDate.getMonth() + 1)}`;
        const endLabel = `${U.pad2(weekEnd.getDate())}/${U.pad2(weekEnd.getMonth() + 1)}`;

        const trTotal = document.createElement("tr");
        trTotal.className = "week-total";

        const tdLabel = document.createElement("td");
        tdLabel.className = "week-total-label";
        tdLabel.colSpan = 5;
        tdLabel.innerHTML = `Total abattement semaine du <strong>${startLabel}</strong> au <strong>${endLabel}</strong>`;

        const tdAmount = document.createElement("td");
        tdAmount.className = "week-total-amount col-abatt";
        tdAmount.innerHTML =
          `<span class="week-total-pill"><span data-week-total data-week-start="${U.toIsoDate(weekStartDate)}" data-week-end="${U.toIsoDate(weekEnd)}">—</span></span>`;

        trTotal.appendChild(tdLabel);
        trTotal.appendChild(tdAmount);
        tbody.appendChild(trTotal);
      }
    }

    table.appendChild(tbody);
    container.appendChild(table);
    attachEvents(table, handlers);

    if (!hasRows) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "Aucun jour ouvré à afficher pour ce mois.";
      container.appendChild(p);
    }
  };

})();
