/* ============================================================================
   render/print-year.js — Gabarit imprimable : récapitulatif annuel
   ----------------------------------------------------------------------------
   Rend le résultat de compute/year-recap.js. Le montant « case 1AJ » ouvre le
   document : c'est l'information cherchée au moment de la déclaration.
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

  /**
   * Construit la feuille (sans l'attacher au DOM) — réutilisé tel quel par
   * render/print-full-year.js pour assembler le dossier complet.
   * @param {Object} rules {year, smicLabel, forfaitLabel}
   */
  R.buildPrintYearSheet = function buildPrintYearSheet(recap, rules) {
    const P = R.print;

    const sheet = P.el("div", "sheet");
    sheet.appendChild(P.docHead(
      "Récapitulatif annuel — déclaration des revenus",
      `Année ${recap.year}`
    ));

    // Encadré « case 1AJ »
    const declare = P.el("div", "doc-declare");
    declare.appendChild(P.el("div", "lab",
      "Montant à reporter case 1AJ « Traitements et salaires », à la place du montant prérempli :"));
    declare.appendChild(P.el("div", "amt", U.fmtEuro(recap.totals.imposable)));
    sheet.appendChild(declare);

    // Tableau des 12 mois
    const table = P.el("table", "doc-table");
    const thead = P.el("thead");
    const trh = P.el("tr");
    [["", "Mois"], ["r", "Net imposable"], ["r", "Indemnités"], ["r", "Perçu"], ["r", "Abattement"], ["r", "À déclarer"]].forEach(([cls, label]) => {
      trh.appendChild(P.el("th", cls || null, label));
    });
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = P.el("tbody");
    recap.months.forEach((m) => {
      const tr = P.el("tr");
      tr.appendChild(P.el("td", null, U.MONTHS_FR[m.monthIndex]));
      if (m.status === "vide") {
        ["", "", "", "", ""].forEach(() => tr.appendChild(P.el("td", "r", "—")));
      } else {
        [m.net, m.irf, m.percu, m.abatt, m.imposable].forEach((v) => {
          tr.appendChild(P.el("td", "r", U.fmtEuro(v)));
        });
      }
      tbody.appendChild(tr);
    });

    const trTotal = P.el("tr", "doc-total");
    trTotal.appendChild(P.el("td", null, `Total ${recap.year}`));
    const t = recap.totals;
    [t.net, t.irf, t.percu, t.abatt, t.imposable].forEach((v) => {
      trTotal.appendChild(P.el("td", "r", U.fmtEuro(v)));
    });
    tbody.appendChild(trTotal);

    table.appendChild(tbody);
    sheet.appendChild(table);

    // Mémo + règles
    const grid = P.el("div", "doc-grid");

    const synth = P.el("div", "doc-synth");
    synth.appendChild(P.el("h3", null, "Mémo déclaration"));
    const addRow = (label, value, final) => {
      const row = P.el("div", final ? "row final" : "row");
      row.appendChild(P.el("span", null, label));
      row.appendChild(P.el("span", "num", value));
      synth.appendChild(row);
    };
    addRow("Total perçu (salaires + indemnités)", U.fmtEuro(t.percu));
    addRow("Abattement forfaitaire annuel", `− ${U.fmtEuro(t.abatt)}`);
    addRow(`Revenu imposable ${recap.year}`, U.fmtEuro(t.imposable), true);
    addRow("Jours de garde ≥ 8 h", String(t.j_ge8));
    addRow("Jours de garde < 8 h", String(t.j_lt8));

    grid.appendChild(synth);
    grid.appendChild(P.rulesBox(rules));
    sheet.appendChild(grid);

    sheet.appendChild(P.docFooter("Conservez les relevés mensuels en annexe."));
    return sheet;
  };

  /** @param {Object} rules {year, smicLabel, forfaitLabel} */
  R.renderPrintYear = function renderPrintYear(root, recap, rules) {
    root.innerHTML = "";
    root.appendChild(R.buildPrintYearSheet(recap, rules));
  };
})();
