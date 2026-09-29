/* ============================================================================
   render/punch-card.js — Pointeuse : la carte d'un enfant
   ----------------------------------------------------------------------------
   En attente → « Arrivée » / « Pas là aujourd'hui » ; présent → « Départ » ;
   parti → heures du jour (corrigeables) et « Nouvelle arrivée » ; absent →
   motif et « Annuler l'absence ».
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.fmt) {
    throw new Error("render/format.js doit être chargé avant render/punch-card.js.");
  }
  const h = R.h;
  const F = R.fmt;
  const MAX_AT_ONCE = window.ABMAT_CONFIG.maxChildrenAtOnce;

  function times(k, handlers) {
    return k.presence.slots.map((s, i) => h("span", { class: "times" }, [
      h("input", { type: "time", id: `pt-${k.id}-${i}-in`, value: s.in, "aria-label": `${k.label}, arrivée`, on: { change: (e) => handlers.onTime(k.id, i, "in", e.target.value) } }),
      " → ",
      s.out
        ? h("input", { type: "time", id: `pt-${k.id}-${i}-out`, value: s.out, "aria-label": `${k.label}, départ`, on: { change: (e) => handlers.onTime(k.id, i, "out", e.target.value) } })
        : h("span", { class: "muted", text: "encore là" })
    ]));
  }

  function motif(k, handlers) {
    const sel = h("select", { id: `pm-${k.id}`, on: { change: (e) => handlers.onMotif(k.id, e.target.value) } }, [
      h("option", { value: "", text: "—" }), F.MOTIFS.map(([v, l]) => h("option", { value: v, text: l }))
    ]);
    sel.value = k.presence.motif;
    return h("label", { class: "small", htmlFor: sel.id }, ["Pourquoi ? ", sel]);
  }

  /**
   * @param {{id, label, sub, state:"waiting"|"here"|"left"|"absent", presence, calcText}} k
   * @param {boolean} full - déjà 4 enfants présents
   * @param {Object} handlers
   */
  R.buildPunchCard = function buildPunchCard(k, full, handlers) {
    let body;
    if (k.state === "absent") {
      body = [h("p", { text: "Absence aujourd'hui" }), motif(k, handlers),
        h("div", { class: "row" }, h("button", { type: "button", class: "btn", text: "Annuler l'absence", on: { click: () => handlers.onCancelAbsence(k.id) } }))];
    } else if (k.state === "waiting") {
      body = [h("div", { class: "row" }, [
        h("button", { type: "button", class: "btn btn-primary btn-big", text: "Arrivée", disabled: full, on: { click: () => handlers.onIn(k.id) } }),
        k.relais ? null : h("button", { type: "button", class: "btn", text: "Pas là aujourd'hui", on: { click: () => handlers.onAbsent(k.id) } })
      ]), full ? h("p", { class: "small muted", text: `${MAX_AT_ONCE} enfants sont déjà là : c'est le maximum.` }) : null];
    } else if (k.state === "here") {
      body = [times(k, handlers), h("div", { class: "row" }, h("button", { type: "button", class: "btn btn-primary btn-big", text: "Départ", on: { click: () => handlers.onOut(k.id) } }))];
    } else {
      body = [times(k, handlers), h("p", { class: "small muted", text: k.calcText }),
        h("div", { class: "row" }, [
          h("button", { type: "button", class: "btn", text: "Nouvelle arrivée", disabled: full, on: { click: () => handlers.onIn(k.id) } }),
          h("span", { class: "small muted", text: `si ${k.label} revient` })
        ])];
    }
    return h("div", { class: "card pk" + (k.state === "absent" ? " is-abs" : "") }, [
      h("div", { class: "pk-top" }, [h("b", { text: k.label }), h("span", { class: "muted", text: k.sub })]),
      body
    ]);
  };
})();
