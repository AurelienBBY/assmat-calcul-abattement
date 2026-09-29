/* ============================================================================
   render/year-view.js — Onglet « Mon année »
   ----------------------------------------------------------------------------
   Le montant à déclarer (case 1AJ ou 1BJ, plancher annuel), les 12 mois en
   tuiles, la comparaison avec/sans abattement, les réglages de l'année
   (SMIC du 1er janvier, accueil relais) et les documents à imprimer.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.fmt || !R.STATUS_LABELS) {
    throw new Error("render/format.js et render/month-panel.js doivent être chargés avant render/year-view.js.");
  }
  const h = R.h;
  const F = R.fmt;

  function declareCard(m, handlers) {
    const cid = "declared-" + m.year;
    return h("div", { class: "declare" }, [
      h("span", { class: "eyebrow", text: `Au printemps ${m.year + 1}, déclarez` }),
      h("span", { class: "amt num", text: F.euro(m.imposable) }),
      h("p", null, ["dans la case ", h("span", { class: "box", text: "1AJ" }), " « Salaires » (ou ", h("span", { class: "box", text: "1BJ" }),
        " si vous êtes le déclarant 2), à la place du montant déjà rempli par les impôts."]),
      h("p", { class: "small", text: `Total perçu ${F.euro(m.percu)} − abattement ${F.euro(m.abatt)}. ` +
        (m.doneCount === 12 ? "Les 12 mois sont terminés." : `Montant provisoire : ${m.doneCount} mois terminé${m.doneCount > 1 ? "s" : ""} sur 12.`) }),
      h("label", { class: "check", htmlFor: cid }, [
        h("input", { type: "checkbox", id: cid, checked: m.declared, on: { change: (e) => handlers.onDeclared(e.target.checked) } }),
        h("span", { text: "J'ai fait ma déclaration pour cette année" })
      ])
    ]);
  }

  function tile(t, handlers) {
    return h("button", { type: "button", class: "tile" + (t.current ? " is-cur" : ""), on: { click: () => handlers.onMonth(t.monthIndex) } }, [
      h("span", { class: "mn", text: F.cap(F.monthName(t.monthIndex)) }),
      h("span", { class: "chip " + t.status, text: R.STATUS_LABELS[t.status] }),
      h("span", { class: "fig num" }, t.hasData ? [`Abattement ${F.euro(t.abatt)}`, t.dueMin ? [h("br"), `Heures sup. ${F.dur(t.dueMin)}`] : null] : "—")
    ]);
  }

  function compareCard(m) {
    const withAbatt = m.imposable;
    const without = m.net;
    const win = withAbatt <= without;
    return h("div", { class: "card" }, [
      h("h3", { text: "L'abattement est-il avantageux ?" }),
      h("div", { class: "compare" }, [
        h("div", { class: "regime" + (win ? " is-win" : "") }, [h("b", { text: "Avec l'abattement" }), h("span", { class: "v num", text: F.euro(withAbatt) }),
          h("span", { class: "small muted", text: "Salaires + indemnités, moins l'abattement." })]),
        h("div", { class: "regime" + (!win ? " is-win" : "") }, [h("b", { text: "Sans l'abattement" }), h("span", { class: "v num", text: F.euro(without) }),
          h("span", { class: "small muted", text: "Salaires seuls (net imposable), indemnités non déclarées." })])
      ]),
      h("p", { class: "small muted", text: `Le plus petit montant est le plus avantageux : ${win ? "avec l'abattement" : "sans l'abattement"} cette année. Comparaison indicative.` })
    ]);
  }

  /**
   * @param {Object} m - modèle (cf. app/ctrl/year.js)
   * @param {{onYear, onMonth, onDeclared, onPrepare, onPrintYear, onPrintDossier}} handlers
   * @returns {Node[]}
   */
  R.buildYear = function buildYear(m, handlers) {
    const chips = h("div", { class: "years", role: "group", "aria-label": "Année" }, m.years.map((y) =>
      h("button", { type: "button", class: "btn", "aria-pressed": String(y.year === m.year), on: { click: () => handlers.onYear(y.year) } },
        [String(y.year), y.declared ? " ✓" : null])));

    const prepare = h("div", { class: "card" }, [
      h("h2", { text: `Préparer ${m.year}` }),
      h("p", { class: "muted", text: `À faire une fois, en janvier : le SMIC du 1er janvier ${m.year}, les enfants qui continuent, et l'accueil relais. ${m.year - 1} reste accessible pour votre déclaration du printemps.` }),
      h("div", null, h("button", { type: "button", class: "btn btn-primary", text: `Préparer ${m.year}`, on: { click: handlers.onPrepare } }))
    ]);

    return [
      chips,
      m.smic === null ? prepare : declareCard(m, handlers),
      h("div", { class: "card" }, [h("h2", { text: `${m.year}, mois par mois` }), h("div", { class: "tiles" }, m.tiles.map((t) => tile(t, handlers)))]),
      m.smic !== null && m.percu > 0 ? compareCard(m) : null,
      h("div", { class: "two" }, [
        h("div", { class: "card" }, [
          h("h3", { text: `Réglages de ${m.year}` }),
          h("dl", { class: "kv num" }, [
            h("dt", { text: `SMIC horaire brut au 1er janvier ${m.year}` }), h("dd", { text: m.smic === null ? "pas encore réglé" : F.euro(m.smic) }),
            h("dt", { text: "Abattement pour une journée de 8 h ou plus" }), h("dd", { text: m.forfait === null ? "—" : F.euro(m.forfait) }),
            h("dt", { text: "Accueil relais" }), h("dd", { text: m.relais ? "oui" : "non" })
          ]),
          m.smic !== null ? h("div", null, h("button", { type: "button", class: "btn", text: `Modifier les réglages de ${m.year}`, on: { click: handlers.onPrepare } })) : null
        ]),
        h("div", { class: "card" }, [
          h("h3", { text: "Documents à garder" }),
          h("p", { class: "small muted", text: `À imprimer (ou enregistrer en PDF) et à garder avec les feuilles de présence signées. ${m.filledCount} mois renseigné${m.filledCount > 1 ? "s" : ""}.` }),
          h("div", { class: "row" }, [
            h("button", { type: "button", class: "btn", on: { click: handlers.onPrintYear } }, [R.icon("print"), "Récapitulatif de l'année"]),
            h("button", { type: "button", class: "btn", on: { click: handlers.onPrintDossier } }, [R.icon("print"), "Dossier complet (récap + chaque mois)"])
          ])
        ])
      ])
    ];
  };
})();
