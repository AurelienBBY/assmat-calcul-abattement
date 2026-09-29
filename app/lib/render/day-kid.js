/* ============================================================================
   render/day-kid.js — Fiche du jour : le bloc d'un enfant
   ----------------------------------------------------------------------------
   Présence / Absence, horaires (jusqu'à 3 : « parti puis revenu »), motif
   d'absence, rappel des horaires habituels, prénom d'un enfant en relais.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.fmt) {
    throw new Error("render/format.js doit être chargé avant render/day-kid.js.");
  }
  const h = R.h;
  const F = R.fmt;
  const MAX_SLOTS = 3;

  function timeInput(id, value, label, onChange) {
    return h("input", { type: "time", id, value, "aria-label": label, on: { change: (e) => onChange(e.target.value) } });
  }

  function motifSelect(k, handlers) {
    const id = `motif-${k.id}`;
    const sel = h("select", { id, on: { change: (e) => handlers.onMotif(k.id, e.target.value) } }, [
      h("option", { value: "", text: "—" }),
      F.MOTIFS.map(([v, l]) => h("option", { value: v, text: l }))
    ]);
    sel.value = k.presence.motif;
    return h("label", { class: "small", htmlFor: id }, ["Pourquoi ? ", sel]);
  }

  function slotRows(k, handlers) {
    return k.presence.slots.map((s, i) => h("div", { class: "slot" }, [
      timeInput(`t-${k.id}-${i}-in`, s.in, `${k.label}, arrivée`, (v) => handlers.onSlot(k.id, i, "in", v)),
      " → ",
      timeInput(`t-${k.id}-${i}-out`, s.out, `${k.label}, départ`, (v) => handlers.onSlot(k.id, i, "out", v)),
      k.presence.slots.length > 1 ? h("button", { type: "button", class: "link", text: "Retirer", on: { click: () => handlers.onRemoveSlot(k.id, i) } }) : null
    ]));
  }

  /**
   * @param {{id, label, relais, presence:Object|null, usualText:string|null,
   *   weekday:string, differs:boolean, calcText:string}} k
   * @param {Object} handlers - cf. render/day-sheet.js
   * @param {Object} refs - refs.calc[id] reçoit la ligne de calcul (mise à jour sans reconstruire)
   */
  R.buildDayKid = function buildDayKid(k, handlers, refs) {
    const p = k.presence;
    const present = Boolean(p && !p.absent && p.slots.length);
    const absent = Boolean(p && p.absent);

    const top = h("div", { class: "kid-top" }, [
      h("b", null, [k.label, k.relais ? h("span", { class: "small muted", text: " (relais)" }) : null]),
      h("div", { class: "pa", role: "group", "aria-label": `${k.label} : présence` }, [
        h("button", { type: "button", text: "Présence", "aria-pressed": String(present), on: { click: () => handlers.onPresence(k.id, true) } }),
        h("button", { type: "button", text: "Absence", "aria-pressed": String(absent), on: { click: () => handlers.onPresence(k.id, false) } })
      ])
    ]);

    const parts = [top];
    if (k.relais) {
      parts.push(h("div", { class: "field" }, [
        h("label", { htmlFor: `rel-${k.id}`, text: "Prénom" }),
        h("input", { type: "text", id: `rel-${k.id}`, value: p ? (p.name || "") : "", autocomplete: "off", on: { change: (e) => handlers.onRelaisName(k.id, e.target.value) } })
      ]));
    }

    if (absent) {
      parts.push(motifSelect(k, handlers));
    } else if (!present) {
      parts.push(h("span", { class: "calc", text: k.usualText ? `D'habitude : ${k.usualText}.` : `${k.label} ne vient pas d'habitude le ${k.weekday}.` }));
    } else {
      parts.push(slotRows(k, handlers));
      if (p.slots.length < MAX_SLOTS) {
        parts.push(h("div", null, h("button", { type: "button", class: "btn btn-quiet", text: "+ 2ᵉ horaire (parti puis revenu)", on: { click: () => handlers.onAddSlot(k.id) } })));
      }
      const calc = h("span", { class: "calc", text: k.calcText });
      refs.calc[k.id] = calc;
      parts.push(calc);
      if (p.punched) parts.push(h("span", { class: "usual", text: "Heures pointées sur le téléphone." }));
      else if (k.differs && !k.relais) parts.push(h("span", { class: "usual", text: `D'habitude : ${k.usualText || "ne vient pas ce jour-là"}` }));
    }

    if (k.relais || (!k.usualText && p)) {
      parts.push(h("div", null, h("button", { type: "button", class: "link", text: `Retirer ${k.label} de cette journée`, on: { click: () => handlers.onRemoveKid(k.id) } })));
    }
    return h("div", { class: "kid" }, parts);
  };
})();
