/* ============================================================================
   render/calendar.js — Mon mois : calendrier (saisie par exceptions)
   ----------------------------------------------------------------------------
   Affiche Compute.buildCalendar : un bouton par jour ouvré (ce qui diffère des
   horaires habituels est mis en avant), une action « Semaine de congés » par
   semaine, les samedis saisis à part.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  const U = window.ABMAT && window.ABMAT.utils;

  if (!R || !R.fmt || !U) {
    throw new Error("render/format.js doit être chargé avant render/calendar.js.");
  }
  const h = R.h;
  const F = R.fmt;

  const TAGS = {
    today: ["now", "aujourd'hui", "is-pt"],
    punched: ["pt", "pointé", "is-pt"],
    future: ["plan", "prévu", "is-future"],
    modified: ["", "modifié", "is-mod"]
  };

  function lineText(l) {
    if (l.kind === "absent") return `${l.label} : absence`;
    return `${l.label}${l.kind === "relais" ? " (relais)" : ""} ${l.text}`;
  }

  function dayCell(c, onDay) {
    const tag = TAGS[c.state];
    const highlight = c.state === "modified";
    const cls = ["day", tag ? tag[2] : "", c.state === "off" ? "is-off" : "", c.state === "ferie" ? "is-fer" : ""].filter(Boolean).join(" ");
    const kids = c.lines.map((l) => {
      const mark = l.kind === "absent" ? "abs" : (highlight && l.kind === "changed" ? "chg" : (l.kind === "relais" ? "rel" : ""));
      return { line: h("span", { class: "kl" + (mark === "abs" ? " abs" : (mark === "chg" ? " chg" : "")), text: lineText(l) }),
        dot: h("span", { class: "dot" + (mark ? " " + mark : ""), text: l.label.charAt(0) }) };
    });

    let sub = null;
    if (c.state === "off") sub = "Non travaillé";
    else if (c.state === "ferie" || (c.ferie && !kids.length)) sub = c.ferie;
    else if (c.state === "empty") sub = "—";

    const aria = [F.dateLong(c.iso), tag ? tag[1] : null, sub, c.lines.map(lineText).join(", "), c.meeting ? "réunion" : null]
      .filter(Boolean).join(", ");
    return h("button", { type: "button", class: cls, "aria-label": aria, data: { day: c.iso }, on: { click: (e) => onDay(c.iso, e.currentTarget) } }, [
      h("span", { class: "n" }, [String(c.dayNumber), tag ? h("span", { class: "tag " + tag[0], text: tag[1] }) : null]),
      kids.map((k) => k.line),
      c.meeting ? h("span", { class: "kl meet", text: "+ réunion" }) : null,
      sub ? h("span", { class: "sub", text: sub }) : null,
      h("span", { class: "dots", "aria-hidden": "true" }, kids.map((k) => k.dot))
    ]);
  }

  function weekSection(w, monthName, handlers) {
    const first = U.isoToDate(w.isos[0]);
    const last = U.isoToDate(w.isos[w.isos.length - 1]);
    const range = `${first.getDate()} au ${last.getDate()} ${monthName}`;
    const pads = [];
    for (let i = 1; i < first.getDay(); i++) pads.push(h("span", { class: "day pad", "aria-hidden": "true" }));
    const action = w.hasDays ? h("button", { type: "button", class: "btn btn-quiet", on: { click: () => handlers.onWeek(w.isos, w.allOff) } }, [
      h("span", { class: "long", text: w.allOff ? "Annuler les congés" : "Semaine de congés" }),
      h("span", { class: "short", text: w.allOff ? "Annuler" : "Congés" })
    ]) : null;
    return h("section", { class: "week", "aria-label": `Semaine du ${range}` }, [
      h("div", { class: "week-head" }, [
        h("span", null, [
          h("span", { class: "long" }, ["Semaine du ", h("b", { text: range })]),
          h("span", { class: "short" }, h("b", { text: `${first.getDate()} – ${last.getDate()} ${monthName.slice(0, 4)}.` }))
        ]),
        action
      ]),
      h("div", { class: "days" }, [pads, w.cells.map((c) => dayCell(c, handlers.onDay))])
    ]);
  }

  /**
   * @param {{monthIndex:number, cal:Object}} model - cal = Compute.buildCalendar
   * @param {{onDay:(iso, el)=>void, onWeek:(isos, allOff)=>void, onSaturday:()=>void}} handlers
   * @returns {Node[]}
   */
  R.buildCalendar = function buildCalendar(model, handlers) {
    const monthName = F.monthName(model.monthIndex);
    const legend = h("div", { class: "legend" }, [
      ["", "Comme d'habitude"], ["mod", "Modifié"], ["pt", "Pointé"], ["off", "Non travaillé"], ["fer", "Férié"]
    ].map(([k, t]) => h("span", null, [h("i", { class: "sw " + k }), t])));
    const dow = h("div", { class: "dow", "aria-hidden": "true" }, ["Lun", "Mar", "Mer", "Jeu", "Ven"].map((d) => h("span", { text: d })));

    const saturdays = h("section", { class: "saturdays", "aria-label": "Samedis" }, [
      model.cal.saturdays.length ? h("div", { class: "week-head" }, h("b", { text: "Samedis" })) : null,
      model.cal.saturdays.length ? h("div", { class: "days" }, model.cal.saturdays.map((c) => dayCell(c, handlers.onDay))) : null,
      h("div", null, h("button", { type: "button", class: "btn btn-quiet", text: "+ Un samedi travaillé (réunion…)", on: { click: handlers.onSaturday } }))
    ]);

    return [legend, dow, model.cal.weeks.map((w) => weekSection(w, monthName, handlers)), saturdays];
  };
})();
