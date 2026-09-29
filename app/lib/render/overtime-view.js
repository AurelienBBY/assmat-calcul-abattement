/* ============================================================================
   render/overtime-view.js — Heures supplémentaires expliquées
   ----------------------------------------------------------------------------
   - R.whyBox : explication d'une journée (phrases d'overtime.explainDay)
   - R.hsMonthCard : total du mois + détail jour par jour (repliable)
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  const O = window.ABMAT && window.ABMAT.overtime;

  if (!R || !R.fmt || !O) {
    throw new Error("render/format.js et overtime.js doivent être chargés avant render/overtime-view.js.");
  }
  const h = R.h;
  const F = R.fmt;

  /**
   * @param {Object} r - résultat d'O.computeDay
   * @param {(id:string)=>string} labelOf
   * @param {boolean} [provisional] - journée en cours (« Pour l'instant : »)
   */
  R.whyBox = function whyBox(r, labelOf, provisional) {
    const ex = O.explainDay(r, labelOf);
    return h("div", { class: "why" + (r.dueMin > 0 ? " is-hs" : "") }, [
      ex.lines.map((l) => h("span", { text: l })),
      h("span", { class: "verdict", text: (provisional ? "Pour l'instant : " : "") + ex.verdict })
    ]);
  };

  /**
   * @param {{monthName:string, dueMin:number, hsDays:number,
   *   days:Array<{iso:string, r:Object, labelOf:Function}>, invalidCount:number,
   *   open:boolean, onToggle:Function}} m
   */
  R.hsMonthCard = function hsMonthCard(m) {
    const rows = m.days.filter((d) => d.r.status !== "none").map((d) => {
      const ex = O.explainDay(d.r, d.labelOf);
      const due = d.r.status === "invalid" ? "à vérifier" : (d.r.dueMin ? `${F.dur(d.r.dueMin)} sup.` : "aucune");
      return h("div", { class: "hsday" }, [
        h("div", { class: "hd" }, [
          h("span", { text: F.cap(F.dateLong(d.iso)) }),
          h("span", { class: "v" + (d.r.dueMin || d.r.status === "invalid" ? " has" : ""), text: due })
        ]),
        ex.lines.map((l) => h("span", { class: "ln", text: l })),
        h("span", { class: "ln" }, h("b", { text: ex.verdict }))
      ]);
    });

    const details = h("details", { class: "hsd", open: m.open, on: { toggle: (e) => m.onToggle(e.target.open) } }, [
      h("summary", { text: "Voir le détail jour par jour" }),
      rows.length ? rows : h("p", { class: "small muted", text: "Aucune journée passée ce mois-ci." })
    ]);

    return h("div", { class: "card" }, [
      h("h3", { text: "Heures supplémentaires" }),
      h("div", { class: "big num", text: m.dueMin ? F.dur(m.dueMin) : "0 h" }),
      h("p", { class: "small muted", text: `${F.plural(m.hsDays, "jour")} au-delà de ${F.dur(window.ABMAT_CONFIG.overtime.dailyThresholdMinutes)} en ${m.monthName} (jours passés). À comparer avec la fiche de paie.` }),
      m.invalidCount ? h("p", { class: "warn-line", text: `${F.plural(m.invalidCount, "jour")} avec un horaire incomplet : ouvrez-le dans le calendrier pour le corriger.` }) : null,
      details
    ]);
  };
})();
