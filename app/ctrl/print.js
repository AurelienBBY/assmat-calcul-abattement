/* ============================================================================
   app/ctrl/print.js — Documents imprimés (A.print)
   ----------------------------------------------------------------------------
   On n'imprime jamais l'écran : un document est construit dans #print-doc
   (relevé du mois, récapitulatif de l'année, ou dossier complet = récap +
   chaque mois renseigné, un par page). Cmd/Ctrl+P construit le document de
   l'onglet affiché (« beforeprint »), sauf si un bouton vient de le faire.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const U = window.ABMAT.utils;
  const Compute = window.ABMAT.compute;

  if (!A || !R.renderPrintMonth || !R.renderPrintYear || !R.renderPrintFullYear) {
    throw new Error("app/ctrl/ctx.js et les gabarits d'impression doivent être chargés avant app/ctrl/print.js.");
  }

  const root = () => document.getElementById("print-doc");

  function rulesFor(year) {
    const smic = Compute.smicForYear(year);
    const forfait = A.forfait(year);
    return {
      year,
      smicLabel: smic !== null ? U.fmtEuro(smic) : "non renseigné",
      forfaitLabel: forfait !== null ? U.fmtEuro(forfait) : "non calculable (SMIC manquant)"
    };
  }

  function monthModel(year, m) {
    const forfait = A.forfait(year);
    const model = Compute.buildMonthPrintModel(year, m, A.loadMonth(year, m), forfait === null ? 0 : forfait);
    model.rules = rulesFor(year);
    return model;
  }

  const buildMonth = (year, m) => R.renderPrintMonth(root(), monthModel(year, m));
  const buildYear = (year) => R.renderPrintYear(root(), Compute.computeYearRecap(year), rulesFor(year));

  // Un bouton a déjà construit le document : « beforeprint » ne doit pas le remplacer.
  let built = false;

  function print(build) {
    build();
    built = true;
    window.print();
  }

  A.print = {
    month: (year, m) => print(() => buildMonth(year, m)),
    year: (year) => print(() => buildYear(year)),
    dossier: (year) => print(() => {
      const recap = Compute.computeYearRecap(year);
      const months = recap.months.filter((x) => x.status !== "vide").map((x) => monthModel(year, x.monthIndex));
      R.renderPrintFullYear(root(), recap, months, rulesFor(year));
    })
  };

  window.addEventListener("beforeprint", () => {
    if (built) return;
    const st = A.state;
    if (st.tab === "year") buildYear(st.year);
    else if (st.tab === "month") buildMonth(st.year, st.monthIndex);
    else { const [y, m] = A.monthOf(A.todayIso()); buildMonth(y, m); }
  });
  window.addEventListener("afterprint", () => { built = false; });
})();
