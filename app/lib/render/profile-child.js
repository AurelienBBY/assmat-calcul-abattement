/* ============================================================================
   render/profile-child.js — Mon profil : la carte d'un enfant
   ----------------------------------------------------------------------------
   Dates d'accueil, horaires habituels en vigueur, historique et changement
   prévu, formulaires « Changer ses horaires » (à partir d'une date) et
   « Modifier » (prénom, arrivée, départ). Les valeurs saisies sont lues ici
   et transmises aux handlers : jamais de lecture du DOM ailleurs.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.fmt) {
    throw new Error("render/format.js doit être chargé avant render/profile-child.js.");
  }
  const h = R.h;
  const F = R.fmt;
  const WEEKDAYS = ["1", "2", "3", "4", "5"];

  function weekTable(week) {
    return h("div", { class: "scroll-x" }, h("table", { class: "tpl" }, [
      h("thead", null, h("tr", null, WEEKDAYS.map((d) => h("th", { scope: "col", text: F.cap(F.DAYS[Number(d)].slice(0, 3)) })))),
      h("tbody", null, h("tr", null, WEEKDAYS.map((d) => h("td", { class: "num", text: week[d].in && week[d].out ? `${F.time(week[d].in)}–${F.time(week[d].out)}` : "—" }))))
    ]));
  }

  const buttons = (onSave, onCancel, saveText) => h("div", { class: "row" }, [
    h("button", { type: "button", class: "btn btn-primary", text: saveText || "Enregistrer", on: { click: onSave } }),
    h("button", { type: "button", class: "btn btn-quiet", text: "Annuler", on: { click: onCancel } })
  ]);

  function schedForm(c, handlers) {
    const f = c.schedForm;
    const from = f.needsDate ? h("input", { type: "date", id: "ns-from", value: f.from }) : null;
    const inputs = {};
    const rows = WEEKDAYS.map((d) => {
      inputs[d] = {
        in: h("input", { type: "time", id: `ns-${d}-in`, value: f.week[d].in, "aria-label": `${F.DAYS[Number(d)]}, arrivée` }),
        out: h("input", { type: "time", id: `ns-${d}-out`, value: f.week[d].out, "aria-label": `${F.DAYS[Number(d)]}, départ` })
      };
      return [h("span", { text: F.cap(F.DAYS[Number(d)]) }), inputs[d].in, inputs[d].out];
    });
    const save = () => {
      const week = {};
      WEEKDAYS.forEach((d) => { week[d] = { in: inputs[d].in.value, out: inputs[d].out.value }; });
      handlers.onSaveSched(c.id, { from: from ? from.value : null, week });
    };
    return h("div", { class: "edit" }, [
      h("b", { text: `Horaires habituels de ${c.name}` }),
      from ? h("div", { class: "field" }, [h("label", { htmlFor: "ns-from", text: "À partir du" }), from]) : null,
      h("div", { class: "wk" }, [h("span"), h("span", { class: "small muted", text: "Arrivée" }), h("span", { class: "small muted", text: "Départ" }), rows]),
      h("p", { class: "small muted", text: f.needsDate
        ? "Les jours avant cette date gardent leurs horaires. Après, seuls les jours encore « comme d'habitude » d'un mois non terminé changent. Les jours pointés ou modifiés à la main ne bougent jamais."
        : "Laissez vides les jours où l'enfant ne vient pas." }),
      buttons(save, handlers.onCancelEdit)
    ]);
  }

  function datesForm(c, handlers) {
    const f = c.datesForm;
    const name = h("input", { type: "text", id: "cd-name", value: f.name, autocomplete: "off" });
    const from = h("input", { type: "date", id: "cd-from", value: f.from });
    const to = h("input", { type: "date", id: "cd-to", value: f.to });
    return h("div", { class: "edit" }, [
      h("div", { class: "fields" }, [
        h("div", { class: "field" }, [h("label", { htmlFor: "cd-name", text: "Prénom" }), name]),
        h("div", { class: "field" }, [h("label", { htmlFor: "cd-from", text: "Arrivée" }), from]),
        h("div", { class: "field" }, [h("label", { htmlFor: "cd-to", text: "Départ (si connu)" }), to])
      ]),
      h("p", { class: "small muted", text: "Les jours pointés ou modifiés à la main, et les mois terminés, ne changent pas." }),
      buttons(() => handlers.onSaveDates(c.id, { name: name.value, from: from.value, to: to.value }), handlers.onCancelEdit)
    ]);
  }

  /**
   * @param {{id, name, dates, gone, current:{from, week}|null, history:Array<{text, next}>,
   *   editing:"sched"|"dates"|null, schedForm, datesForm}} c
   * @param {Object} handlers
   */
  R.buildProfileChild = function buildProfileChild(c, handlers) {
    let edit;
    if (c.editing === "sched") edit = schedForm(c, handlers);
    else if (c.editing === "dates") edit = datesForm(c, handlers);
    else {
      edit = h("div", { class: "row" }, [
        h("button", { type: "button", class: "btn", text: c.current ? "Changer ses horaires" : "Indiquer ses horaires", on: { click: () => handlers.onEdit(c.id, "sched") } }),
        h("button", { type: "button", class: "btn btn-quiet", text: "Prénom et dates", on: { click: () => handlers.onEdit(c.id, "dates") } })
      ]);
    }
    return h("div", { class: "child" + (c.gone ? " is-gone" : "") }, [
      h("div", { class: "child-top" }, [h("b", { text: c.name }), h("span", { class: "muted small", text: c.dates })]),
      c.current ? [h("span", { class: "small", text: c.current.from ? `Horaires habituels depuis le ${F.dateFr(c.current.from)} :` : "Horaires habituels :" }), weekTable(c.current.week)]
        : h("span", { class: "small muted", text: "Pas encore d'horaires habituels." }),
      c.history.map((l) => h("span", { class: "hist" + (l.next ? " next" : ""), text: l.text })),
      edit
    ]);
  };
})();
