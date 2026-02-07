/* ============================================================================
   render/month-table.js — Tableau du mois (saisie des heures / calculs affichés)
   ----------------------------------------------------------------------------
   Rôle :
   - Génère le tableau des jours ouvrés du mois sélectionné
   - Affiche 3 lignes (enfants 1..3) par jour
   - Affiche les séparateurs + totaux hebdomadaires
   - Délègue les événements `input[type=time]` via un seul listener

   Dépendances :
   - window.ABMAT.render (R) — initialisé par render/index.js
   - window.ABMAT.utils (U) — MONTHS_FR, pad2, daysInMonth, isWeekend, fmt, etc.
   ========================================================================= */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.render = window.ABMAT.render || {};

  const R = window.ABMAT.render;
  const U = window.ABMAT.utils;

  if (!U) {
    throw new Error("ABMAT.utils est requis avant ABMAT.render (charger utils.js en premier).");
  }

  /**
   * @param {HTMLElement} container
   * @param {Object} state {year, monthIndex}
   * @param {(chg:{isoDate:string, slot:number, kind:"in"|"out", value:string})=>void} onTimeChange
   */
  R.renderMonthTable = function renderMonthTable(container, state, onTimeChange) {
    container.innerHTML = "";

    const year = state.year;
    const monthIndex = state.monthIndex;

    const heading = document.createElement("p");
    heading.className = "month-heading";
    heading.textContent = `Mois : ${U.MONTHS_FR[monthIndex]} ${year} (jours ouvrés)`;
    container.appendChild(heading);

    const table = document.createElement("table");
    table.className = "abmat-table";
    table.setAttribute("data-month", `${year}-${U.pad2(monthIndex + 1)}`);

    // En-tête du tableau
    const thead = document.createElement("thead");
    const trh = document.createElement("tr");

    // Colonnes : Date | Enfant | Heure d'entrée | Heure de sortie | Temps de présence | Abattement
    const thDate = document.createElement("th");
    thDate.className = "col-date";
    thDate.textContent = "Date";
    trh.appendChild(thDate);

    const thEnfant = document.createElement("th");
    thEnfant.textContent = "Enfant";
    trh.appendChild(thEnfant);

    const thEntree = document.createElement("th");
    thEntree.textContent = "Heure d'entrée";
    trh.appendChild(thEntree);

    const thSortie = document.createElement("th");
    thSortie.textContent = "Heure de sortie";
    trh.appendChild(thSortie);

    const thTemps = document.createElement("th");
    thTemps.textContent = "Temps de présence";
    trh.appendChild(thTemps);

    const thAbatt = document.createElement("th");
    thAbatt.textContent = "Abattement";
    trh.appendChild(thAbatt);

    thead.appendChild(trh);
    table.appendChild(thead);

    // Corps du tableau
    const tbody = document.createElement("tbody");
    const totalDays = U.daysInMonth(year, monthIndex);

    let hasRows = false;
    let started = false;
    let weekStartDate = null; // Date (objet) du début de semaine affichée

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, monthIndex, day);
      if (U.isWeekend(d)) continue;

      hasRows = true;

      // --- Début de semaine : première journée ouvrée du mois ou chaque lundi
      if (!started || d.getDay() === 1) {
        started = true;
        weekStartDate = new Date(d);

        // Calcule une fin "vendredi" clampée au mois (jours ouvrés)
        let end = new Date(d);
        end.setDate(end.getDate() + (5 - end.getDay())); // vers vendredi

        if (end.getMonth() !== monthIndex) {
          end = new Date(year, monthIndex, totalDays);
          // si week-end, revenir au vendredi
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
        trSep.appendChild(tdSep);

        tbody.appendChild(trSep);
      }

      const isoDate = `${year}-${U.pad2(monthIndex + 1)}-${U.pad2(day)}`;
      const weekdayLong = d.toLocaleDateString("fr-FR", { weekday: "long" });
      const weekdayLabel = weekdayLong.charAt(0).toUpperCase() + weekdayLong.slice(1);

      // --- 3 lignes (enfants 1..3) pour ce jour
      for (let slot = 1; slot <= 3; slot++) {
        const tr = document.createElement("tr");
        tr.setAttribute("data-date", isoDate);
        tr.setAttribute("data-slot", slot);

        // Date cell (rowspan=3) sur la 1ère ligne du jour
        if (slot === 1) {
          const tdDate = document.createElement("td");
          tdDate.className = "col-date";
          tdDate.setAttribute("rowspan", "3");
          tdDate.innerHTML =
            `<div class="col-date__inner">` +
            `<strong class="date-day">${weekdayLabel}</strong><br>` +
            `<span class="date-num">${U.pad2(day)}/${U.pad2(monthIndex + 1)}</span>` +
            `</div>`;
          tr.appendChild(tdDate);
        }

        // Enfant
        const tdEnfant = document.createElement("td");
        tdEnfant.className = "col-enfant";
        tdEnfant.textContent = `Enfant ${slot}`;
        tr.appendChild(tdEnfant);

        // Heure d'entrée
        const tdEntree = document.createElement("td");
        tdEntree.className = "col-entree";
        tdEntree.innerHTML =
          `<label class="sr-only" for="in-${isoDate}-${slot}">Entrée enfant ${slot} (${isoDate})</label>` +
          `<input type="time" id="in-${isoDate}-${slot}" data-time="in" data-date="${isoDate}" data-slot="${slot}" />`;
        tr.appendChild(tdEntree);

        // Heure de sortie
        const tdSortie = document.createElement("td");
        tdSortie.className = "col-sortie";
        tdSortie.innerHTML =
          `<label class="sr-only" for="out-${isoDate}-${slot}">Sortie enfant ${slot} (${isoDate})</label>` +
          `<input type="time" id="out-${isoDate}-${slot}" data-time="out" data-date="${isoDate}" data-slot="${slot}" />`;
        tr.appendChild(tdSortie);

        // Temps de présence
        const tdTemps = document.createElement("td");
        tdTemps.className = "col-temps";
        tdTemps.innerHTML = `<span data-hours data-date="${isoDate}" data-slot="${slot}">—</span>`;
        tr.appendChild(tdTemps);

        // Abattement
        const tdAbatt = document.createElement("td");
        tdAbatt.className = "col-abatt";
        tdAbatt.innerHTML = `<span data-abatt data-date="${isoDate}" data-slot="${slot}">—</span>`;
        tr.appendChild(tdAbatt);

        tbody.appendChild(tr);
      }

      // --- Fin de semaine : si demain est lundi (ou fin du mois)
      // On cherche le prochain jour ouvré dans le mois
      let nextWorking = null;
      for (let dd = day + 1; dd <= totalDays; dd++) {
        const nd = new Date(year, monthIndex, dd);
        if (!U.isWeekend(nd)) {
          nextWorking = nd;
          break;
        }
      }
      const isEndOfWeek = (!nextWorking) || (nextWorking.getDay() === 1);

      if (isEndOfWeek && weekStartDate) {
        const weekEnd = new Date(d);

        const startLabel = `${U.pad2(weekStartDate.getDate())}/${U.pad2(weekStartDate.getMonth() + 1)}`;
        const endLabel = `${U.pad2(weekEnd.getDate())}/${U.pad2(weekEnd.getMonth() + 1)}`;

        const isoStart = `${year}-${U.pad2(weekStartDate.getMonth() + 1)}-${U.pad2(weekStartDate.getDate())}`;
        const isoEnd = `${year}-${U.pad2(weekEnd.getMonth() + 1)}-${U.pad2(weekEnd.getDate())}`;

        const trTotal = document.createElement("tr");
        trTotal.className = "week-total";

        // Libellé sur les 5 premières colonnes
        const tdLabel = document.createElement("td");
        tdLabel.className = "week-total-label";
        tdLabel.colSpan = 5;
        tdLabel.innerHTML =
          `Total abattement semaine du <strong>${startLabel}</strong> au <strong>${endLabel}</strong>`;

        // Montant aligné sur la colonne Abattement
        const tdAmount = document.createElement("td");
        tdAmount.className = "week-total-amount col-abatt";
        tdAmount.innerHTML =
          `<span class="week-total-pill"><span data-week-total data-week-start="${isoStart}" data-week-end="${isoEnd}">—</span></span>`;

        trTotal.appendChild(tdLabel);
        trTotal.appendChild(tdAmount);
        tbody.appendChild(trTotal);
      }
    }

    table.appendChild(tbody);
    container.appendChild(table);

    // Délégation d’événements : 1 seul listener pour tous les inputs du tableau
    table.addEventListener("input", (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.type !== "time") return;
      const isoDate = t.getAttribute("data-date");
      const slot = Number(t.getAttribute("data-slot"));
      const kind = t.getAttribute("data-time"); // in/out
      if (!isoDate || !slot || (kind !== "in" && kind !== "out")) return;
      onTimeChange && onTimeChange({ isoDate, slot, kind, value: t.value || "" });
    });

    if (!hasRows) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "Aucun jour ouvré à afficher pour ce mois.";
      container.appendChild(p);
    }
  };

})();