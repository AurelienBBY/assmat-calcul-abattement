/* ============================================================================
   render/day-sheet.js — Fiche du jour (ouverte depuis le calendrier)
   ----------------------------------------------------------------------------
   Contenu de la fenêtre : actions de la journée, un bloc par enfant
   (render/day-kid.js), accueil relais, réunions, heures sup. expliquées,
   abattement du jour. R.fillDayFigures met à jour les chiffres sans
   reconstruire (la saisie d'une heure ne fait pas perdre le fil).
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.buildDayKid || !R.whyBox) {
    throw new Error("render/day-kid.js et render/overtime-view.js doivent être chargés avant render/day-sheet.js.");
  }
  const h = R.h;
  const F = R.fmt;
  const MAX_MEETINGS = 3;
  const MAX_AT_ONCE = window.ABMAT_CONFIG.maxChildrenAtOnce;

  function topPart(m, handlers) {
    if (m.top === "off") {
      return [h("p", { class: "small muted", text: "Vous n'avez pas travaillé ce jour-là." }),
        h("div", { class: "row" }, h("button", { type: "button", class: "btn btn-primary", "data-autofocus": "", text: "Remettre la journée habituelle", on: { click: handlers.onUsual } }))];
    }
    if (m.top === "ferie") {
      return [h("p", { class: "small muted", text: `Jour férié (${m.ferie}). Si vous avez travaillé ce jour-là, indiquez-le.` }),
        h("div", { class: "row" }, h("button", { type: "button", class: "btn btn-primary", "data-autofocus": "", text: "J'ai travaillé ce jour-là", on: { click: handlers.onWorked } }))];
    }
    if (m.top === "normal") {
      return h("div", { class: "row" }, [
        h("button", { type: "button", class: "btn", "data-autofocus": "", text: "Journée habituelle", on: { click: handlers.onUsual } }),
        h("button", { type: "button", class: "btn", text: "Je n'ai pas travaillé", on: { click: handlers.onOff } })
      ]);
    }
    return null; // « free » : pas d'horaires habituels ce jour-là
  }

  function meetingBlock(m, handlers) {
    return h("div", { class: "kid" }, [
      h("div", { class: "kid-top" }, [h("b", { text: "Réunion" }), h("span", { class: "small muted", text: "compte pour les heures sup." })]),
      m.meetings.map((s, i) => h("div", { class: "slot" }, [
        h("input", { type: "time", id: `r-${i}-in`, value: s.in, "aria-label": "Réunion, début", on: { change: (e) => handlers.onMeeting(i, "in", e.target.value) } }),
        " → ",
        h("input", { type: "time", id: `r-${i}-out`, value: s.out, "aria-label": "Réunion, fin", on: { change: (e) => handlers.onMeeting(i, "out", e.target.value) } }),
        h("button", { type: "button", class: "link", text: "Retirer", on: { click: () => handlers.onRemoveMeeting(i) } })
      ])),
      m.meetings.length < MAX_MEETINGS ? h("div", null, h("button", { type: "button", class: "btn btn-quiet", text: "+ Ajouter une réunion", on: { click: handlers.onAddMeeting } })) : null
    ]);
  }

  /**
   * @param {Object} m - modèle (cf. app/ctrl/day.js)
   * @param {Object} handlers
   * @returns {{nodes:Node[], refs:Object}}
   */
  R.buildDaySheet = function buildDaySheet(m, handlers) {
    const refs = { calc: {}, hs: h("div"), total: h("span", { class: "small muted" }), warn: h("p", { class: "warn-line" }) };
    const nodes = [topPart(m, handlers)];

    if (m.top !== "off" && m.top !== "ferie") {
      m.kids.forEach((k) => nodes.push(R.buildDayKid(k, handlers, refs)));
      if (!m.kids.length) nodes.push(h("p", { class: "small muted", text: "Aucun enfant accueilli à cette date (voir « Mon profil »)." }));
      if (m.relaisEnabled) {
        nodes.push(h("div", null, h("button", { type: "button", class: "btn", text: "+ Enfant en accueil relais", on: { click: handlers.onRelaisAdd } })));
      }
      nodes.push(meetingBlock(m, handlers));
      nodes.push(refs.warn);
      nodes.push(h("div", null, [h("b", { text: "Heures supplémentaires de la journée" }), refs.hs]));
    }

    nodes.push(h("div", { class: "dlg-foot" }, [refs.total, h("button", { type: "button", class: "btn btn-primary", text: "OK", on: { click: handlers.onClose } })]));
    R.fillDayFigures(refs, m.figures);
    return { nodes, refs };
  };

  /**
   * @param {Object} refs
   * @param {{calc:Object<string,string>, hs:Object|null, labelOf:Function, provisional:boolean,
   *   total:number|null, tooMany:number}} fig
   */
  R.fillDayFigures = function fillDayFigures(refs, fig) {
    Object.keys(refs.calc).forEach((id) => { refs.calc[id].textContent = fig.calc[id] || ""; });
    R.clear(refs.hs);
    if (fig.hs) refs.hs.appendChild(R.whyBox(fig.hs, fig.labelOf, fig.provisional));
    refs.total.textContent = (fig.total === null) ? "" : `Abattement du jour : ${F.euro(fig.total)}`;
    refs.warn.textContent = fig.tooMany > MAX_AT_ONCE
      ? `${fig.tooMany} enfants présents en même temps à un moment de la journée : ${MAX_AT_ONCE} au maximum. Vérifiez les horaires.`
      : "";
    refs.warn.hidden = fig.tooMany <= MAX_AT_ONCE;
  };
})();
