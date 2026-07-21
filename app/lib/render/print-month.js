/* ============================================================================
   render/print-month.js — Gabarit imprimable : relevé mensuel
   ----------------------------------------------------------------------------
   Rend le modèle produit par compute/month-print.js (model.rules = libellés
   SMIC/forfait fournis par app.js).
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

  function ddmm(iso) {
    const p = String(iso).split("-");
    return `${p[2]}/${p[1]}`;
  }

  /**
   * Construit la feuille (sans l'attacher au DOM) — réutilisé tel quel par
   * render/print-full-year.js pour assembler le dossier complet.
   */
  R.buildPrintMonthSheet = function buildPrintMonthSheet(model) {
    const P = R.print;

    const profile = P.getProfile();
    const sheet = P.el("div", "sheet");
    sheet.appendChild(P.docHead(
      "Relevé mensuel — abattement fiscal",
      `${U.MONTHS_FR[model.monthIndex]} ${model.year}`
    ));

    if (model.weeks.length === 0) {
      sheet.appendChild(P.el("p", "doc-empty", "Aucune journée renseignée ce mois-ci."));
    } else {
      const table = P.el("table", "doc-table");
      const thead = P.el("thead");
      const trh = P.el("tr");
      [["", "Jour"], ["", "Enfant"], ["", "Présence"], ["r", "Durée"], ["r", "Abattement"]].forEach(([cls, label]) => {
        const th = P.el("th", cls || null, label);
        trh.appendChild(th);
      });
      thead.appendChild(trh);
      table.appendChild(thead);

      const tbody = P.el("tbody");

      model.weeks.forEach((week) => {
        const trWeek = P.el("tr", "doc-week");
        const tdWeek = P.el("td", null, `Semaine du ${ddmm(week.start)} au ${ddmm(week.end)}`);
        tdWeek.colSpan = 5;
        trWeek.appendChild(tdWeek);
        tbody.appendChild(trWeek);

        week.days.forEach((day) => {
          day.children.forEach((child, idx) => {
            const tr = P.el("tr");

            const dayLabel = (idx === 0)
              ? (day.ferie ? `${day.label} — Férié` : day.label)
              : "";
            tr.appendChild(P.el("td", "doc-day", dayLabel));
            tr.appendChild(P.el("td", null, P.childName(profile, child.key)));

            let presence;
            let duree;
            let abatt;
            if (child.absent) {
              const motif = P.motifLabel(child.motif);
              presence = motif ? `Absent (${motif})` : "Absent";
              duree = "—";
              abatt = "—";
            } else if (child.status === "ok") {
              presence = child.slots.map(P.slotLabel).join(" + ");
              duree = U.fmtHoursHM(child.hours);
              abatt = U.fmtEuro(child.abatt);
            } else {
              presence = child.slots.map(P.slotLabel).join(" + ");
              duree = "⚠ horaires incomplets";
              abatt = "—";
            }
            tr.appendChild(P.el("td", null, presence));
            tr.appendChild(P.el("td", "r", duree));
            tr.appendChild(P.el("td", "r", abatt));

            tbody.appendChild(tr);
          });
        });

        const trSub = P.el("tr", "doc-subtotal");
        const tdLabel = P.el("td", null, "Sous-total semaine");
        tdLabel.colSpan = 4;
        trSub.appendChild(tdLabel);
        trSub.appendChild(P.el("td", "r", U.fmtEuro(week.subtotal)));
        tbody.appendChild(trSub);
      });

      table.appendChild(tbody);
      sheet.appendChild(table);
    }

    // Synthèse + règles
    const grid = P.el("div", "doc-grid");

    const synth = P.el("div", "doc-synth");
    synth.appendChild(P.el("h3", null, "Synthèse du mois"));
    const t = model.totals;
    const addRow = (label, value, final) => {
      const row = P.el("div", final ? "row final" : "row");
      row.appendChild(P.el("span", null, label));
      row.appendChild(P.el("span", "num", value));
      synth.appendChild(row);
    };
    addRow("Revenu net imposable (bulletin)", U.fmtEuro(t.net));
    addRow("Indemnités représentatives de frais", U.fmtEuro(t.irf));
    addRow("Total perçu", U.fmtEuro(t.percu));
    addRow(`Abattement forfaitaire (${t.joursGarde} jour${t.joursGarde > 1 ? "s" : ""} de garde)`, `− ${U.fmtEuro(t.abatt)}`);
    addRow(`Revenu à déclarer — ${U.MONTHS_FR[model.monthIndex].toLowerCase()} ${model.year}`, U.fmtEuro(t.imposable), true);

    grid.appendChild(synth);
    grid.appendChild(P.rulesBox(model.rules));
    sheet.appendChild(grid);

    sheet.appendChild(P.docFooter());
    return sheet;
  };

  R.renderPrintMonth = function renderPrintMonth(root, model) {
    root.innerHTML = "";
    root.appendChild(R.buildPrintMonthSheet(model));
  };
})();
