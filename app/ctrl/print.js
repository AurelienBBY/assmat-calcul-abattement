/* ============================================================================
   app/ctrl/print.js — Documents imprimés (A.print)
   ----------------------------------------------------------------------------
   On n'imprime jamais l'écran : un document est construit dans #print-doc
   (relevé du mois suivi des photos de sa fiche de présence, récapitulatif
   de l'année, ou dossier complet = récap + chaque mois renseigné et ses
   photos, une feuille par page). Cmd/Ctrl+P construit le document de
   l'onglet affiché (« beforeprint », avec les photos déjà chargées), sauf
   si un bouton vient de le faire.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const U = window.ABMAT.utils;
  const Compute = window.ABMAT.compute;

  if (!A || !A.photos || !R.renderPrintMonth || !R.renderPrintYear || !R.renderPrintFullYear || !R.buildPrintPhotoSheet) {
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
    model.photos = A.photos.forPrint(year, m);
    return model;
  }

  function buildMonth(year, m) {
    const model = monthModel(year, m);
    R.renderPrintMonth(root(), model);
    model.photos.forEach((photo) => root().appendChild(R.buildPrintPhotoSheet(year, m, photo)));
  }
  const buildYear = (year) => R.renderPrintYear(root(), Compute.computeYearRecap(year), rulesFor(year));

  // Un bouton a déjà construit le document : « beforeprint » ne doit pas le remplacer.
  let built = false;

  // Une photo pas encore affichée sortirait blanche : on attend qu'elle soit
  // prête (en cas d'échec, la page imprimée le montre).
  const imagesReady = () => Promise.all(Array.from(root().querySelectorAll("img")).map((img) =>
    (img.complete ? null : new Promise((done) => { img.onload = done; img.onerror = done; }))));

  async function print(build) {
    build();
    built = true;
    await imagesReady();
    window.print();
  }

  A.print = {
    month: async (year, m) => {
      await A.photos.ensure(year, m);
      await print(() => buildMonth(year, m));
    },
    year: (year) => print(() => buildYear(year)),
    dossier: async (year) => {
      const recap = Compute.computeYearRecap(year);
      const filled = recap.months.filter((x) => x.status !== "vide").map((x) => x.monthIndex);
      await Promise.all(filled.map((m) => A.photos.ensure(year, m)));
      await print(() => R.renderPrintFullYear(root(), recap, filled.map((m) => monthModel(year, m)), rulesFor(year)));
    }
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
