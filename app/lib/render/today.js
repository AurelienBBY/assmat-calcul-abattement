/* ============================================================================
   render/today.js — Onglet « Aujourd'hui » (pointeuse) et bienvenue
   ----------------------------------------------------------------------------
   Heure du téléphone, une carte par enfant (render/punch-card.js), accueil
   relais, réunion, heures sup. de la journée expliquées en direct.
   Retourne les éléments mis à jour chaque minute (horloge, heures sup.).
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.buildPunchCard || !R.whyBox) {
    throw new Error("render/punch-card.js et render/overtime-view.js doivent être chargés avant render/today.js.");
  }
  const h = R.h;
  const F = R.fmt;

  function relaisPart(m, handlers) {
    if (!m.relaisEnabled) return null;
    if (!m.relDraft) {
      return h("div", { class: "row" }, h("button", { type: "button", class: "btn", text: "+ Enfant en accueil relais", disabled: m.full, on: { click: () => handlers.onRelaisDraft(true) } }));
    }
    const name = h("input", { type: "text", id: "rel-name", placeholder: "Prénom", autocomplete: "off", "aria-label": "Prénom de l'enfant en relais" });
    return h("div", { class: "card" }, [
      h("h3", { text: "Enfant en accueil relais" }),
      h("div", { class: "rel-form" }, [name,
        h("button", { type: "button", class: "btn btn-primary", text: "Arrivée maintenant", on: { click: () => handlers.onRelaisIn(name.value) } }),
        h("button", { type: "button", class: "btn btn-quiet", text: "Annuler", on: { click: () => handlers.onRelaisDraft(false) } })])
    ]);
  }

  function meetingPart(m, handlers) {
    const open = m.meetings.find((s) => !s.out);
    const body = open
      ? [h("p", { text: `Réunion depuis ${F.time(open.in)}.` }),
        h("div", { class: "row" }, h("button", { type: "button", class: "btn btn-primary btn-big", text: "Fin de réunion", on: { click: handlers.onMeetingEnd } }))]
      : [m.meetings.map((s, i) => h("span", { class: "times" }, [
        h("input", { type: "time", id: `pm-${i}-in`, value: s.in, "aria-label": "Réunion, début", on: { change: (e) => handlers.onMeetingTime(i, "in", e.target.value) } }),
        " → ",
        h("input", { type: "time", id: `pm-${i}-out`, value: s.out, "aria-label": "Réunion, fin", on: { change: (e) => handlers.onMeetingTime(i, "out", e.target.value) } })
      ])), h("div", { class: "row" }, h("button", { type: "button", class: "btn", text: "Début de réunion", on: { click: handlers.onMeetingStart } }))];
    return h("div", { class: "card pk" }, [h("div", { class: "pk-top" }, [h("b", { text: "Réunion" }), h("span", { class: "muted", text: "compte pour les heures sup." })]), body]);
  }

  /**
   * @param {Object} m - modèle (cf. app/ctrl/today.js) ; m.resume : carte
   *   « La mise en route vous attend » ou null
   * @param {Object} handlers
   * @returns {{node:Node, clock:Node, hs:Node}}
   */
  R.buildToday = function buildToday(m, handlers) {
    const clock = h("span", { class: "clock", text: m.clock });
    const hs = h("div");
    const head = h("div", { class: "card" }, [h("div", { class: "clockbar" }, [h("h2", { text: m.title }), clock])]);

    if (m.off) {
      return { clock, hs, node: h("div", { class: "today" }, [head, h("div", { class: "card" }, [
        h("p", { text: "Journée marquée non travaillée." }),
        h("div", { class: "row" }, h("button", { type: "button", class: "btn", text: "J'ai travaillé aujourd'hui", on: { click: handlers.onDayOn } }))
      ])]) };
    }

    const others = m.notExpected.length ? h("div", { class: "card" }, [
      h("p", { class: "small muted", text: "Pas prévus aujourd'hui :" }),
      h("div", { class: "row" }, m.notExpected.map((c) => h("button", { type: "button", class: "btn btn-quiet", text: `Arrivée de ${c.label}`, disabled: m.full, on: { click: () => handlers.onIn(c.id) } })))
    ]) : null;

    R.fillTodayHs(hs, m);
    return { clock, hs, node: h("div", { class: "today" }, [
      head,
      m.resume,
      m.cards.length ? m.cards.map((k) => R.buildPunchCard(k, m.full, handlers)) : h("p", { class: "muted", text: "Aucun enfant prévu aujourd'hui." }),
      relaisPart(m, handlers),
      others,
      meetingPart(m, handlers),
      hs
    ]) };
  };

  /** Heures sup. de la journée (recalculées chaque minute pendant la journée). */
  R.fillTodayHs = function fillTodayHs(el, m) {
    R.clear(el);
    el.className = "card";
    el.hidden = !m.hs || m.hs.status === "none";
    if (el.hidden) return;
    el.appendChild(h("h3", { text: m.hs.status === "open" ? "Journée en cours" : "Journée terminée" }));
    el.appendChild(R.whyBox(m.hs, m.labelOf, m.hs.status === "open"));
    if (m.hint) el.appendChild(h("p", { class: "small muted", text: m.hint }));
  };
})();
