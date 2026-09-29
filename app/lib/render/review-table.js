/* ============================================================================
   render/review-table.js — « Vérifier le mois » : la semaine comme la fiche
   ----------------------------------------------------------------------------
   Même disposition que la fiche de présence du CCAS : par enfant, une ligne
   A (arrivée) et une ligne D (départ) ; une colonne par jour. On compare
   case par case avec la photo ; toucher une case ouvre la fiche du jour.
   Marquées : les cases modifiées pendant la vérification, et celles où
   quelques minutes changent le calcul (compute/review.js).
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  const U = window.ABMAT && window.ABMAT.utils;
  if (!R || !R.fmt || !U) {
    throw new Error("utils.js et render/format.js doivent être chargés avant render/review-table.js.");
  }
  const h = R.h;
  const F = R.fmt;

  const dayNum = (iso) => { const d = Number(iso.slice(8)); return d === 1 ? "1er" : String(d); };

  function dayHead(iso, info, ferie, onDay) {
    const dow = F.DAYS[U.isoToDate(iso).getDay()];
    let tag = null;
    if (info.off) tag = h("span", { class: "rvt-tag", text: "congé" });
    else if (ferie) tag = h("span", { class: "rvt-tag", text: "férié" });
    else if (info.nearOvertime) tag = h("span", { class: "rvt-tag is-warn", text: "≈ 10 h", title: "Journée proche de 10 h : les minutes comptent pour les heures sup." });
    return h("th", { scope: "col" }, h("button", { type: "button", class: "rvt-day", "aria-label": `${F.cap(F.dateLong(iso))} : ouvrir la journée`, on: { click: () => onDay(iso) } }, [
      h("span", { text: F.cap(dow.slice(0, 3)) }), h("b", { text: dayNum(iso) }), tag
    ]));
  }

  // Case d'une ligne (A ou D) : heures des créneaux, une par ligne.
  function cell(c, key, name, iso, onDay) {
    const p = c.presence;
    const cls = "rvt-cell" + (c.changed ? " is-mod" : "") + (c.minutesMatter ? " is-min" : "");
    const what = key === "in" ? "arrivée" : "départ";
    if (p && p.absent) {
      return key === "out" ? null : h("td", { rowSpan: 2 }, h("button", { type: "button", class: cls + " is-abs", text: "abs.",
        "aria-label": `${name}, ${F.dateLong(iso)} : absent. Corriger.`, on: { click: () => onDay(iso) } }));
    }
    const times = p ? p.slots.map((s) => F.time(s[key])) : [];
    return h("td", null, h("button", { type: "button", class: cls, "aria-label": `${name}, ${F.dateLong(iso)}, ${what} : ${times.join(" et ") || "rien"}. Corriger.`,
      on: { click: () => onDay(iso) } }, times.length ? times.map((t) => h("span", { text: t })) : h("span", { class: "muted", "aria-hidden": "true", text: "·" })));
  }

  /**
   * @param {{week:string[], grid:Object, labels:Object<string,string>, feries:Object<string,string>}} m
   *   grid : Compute.reviewGrid ; labels : prénom par id ; feries : date → nom du jour férié
   * @param {{onDay:(iso)=>void}} hd
   */
  R.buildReviewTable = function buildReviewTable(m, hd) {
    const g = m.grid;
    const withMeetings = m.week.some((iso) => g.days[iso].meetings.length);
    const flagged = g.ids.some((id) => m.week.some((iso) => g.cells[id][iso].minutesMatter)) || m.week.some((iso) => g.days[iso].nearOvertime);
    const body = [];
    g.ids.forEach((id) => {
      const name = m.labels[id];
      body.push(h("tr", { class: "rvt-a" }, [h("th", { scope: "row", rowSpan: 2, class: "rvt-name", text: name }), h("td", { class: "rvt-ad", text: "A" }),
        m.week.map((iso) => cell(g.cells[id][iso], "in", name, iso, hd.onDay))]));
      body.push(h("tr", { class: "rvt-d" }, [h("td", { class: "rvt-ad", text: "D" }),
        m.week.map((iso) => cell(g.cells[id][iso], "out", name, iso, hd.onDay))]));
    });
    if (withMeetings) {
      body.push(h("tr", { class: "rvt-meet" }, [h("th", { scope: "row", colSpan: 2, class: "rvt-name", text: "Réunion" }),
        m.week.map((iso) => h("td", null, h("button", { type: "button", class: "rvt-cell", on: { click: () => hd.onDay(iso) } },
          g.days[iso].meetings.map((s) => h("span", { text: `${F.time(s.in)}–${F.time(s.out)}` })))))]));
    }
    return h("div", { class: "rvt-box" }, [
      h("div", { class: "rvt-wrap" }, h("table", { class: "rvt" }, [
        h("colgroup", null, [h("col", { class: "rvt-c-name" }), h("col", { class: "rvt-c-ad" }), m.week.map(() => h("col"))]),
        h("thead", null, h("tr", null, [h("th", { colSpan: 2, scope: "col" }, h("span", { class: "sr-only", text: "Enfant" })),
          m.week.map((iso) => dayHead(iso, g.days[iso], m.feries[iso], hd.onDay))])),
        h("tbody", null, g.ids.length ? body : h("tr", null, h("td", { colSpan: m.week.length + 2, class: "muted", text: "Aucun enfant cette semaine." })))
      ])),
      h("p", { class: "small muted" }, flagged
        ? [h("span", { class: "rvt-dot", "aria-hidden": "true" }), " À vérifier à la minute : moins de 8 h 15 prévues (sous 8 h, l'abattement baisse) ou journée proche de 10 h (heures sup.). Ailleurs, quelques minutes d'écart ne changent rien."]
        : "Au-delà de 8 h de présence, quelques minutes d'écart avec la fiche ne changent rien au calcul.")
    ]);
  };
})();
