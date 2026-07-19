/* ============================================================================
   render/day-rows.js — Lignes d'un jour (enfants visibles, créneaux, absences)
   ----------------------------------------------------------------------------
   Construit les <tr> d'une journée : une ligne par enfant visible (enfant 1
   toujours ; les autres s'ils ont des données), créneaux multiples, absence
   avec motif, badge férié, bouton « + enfant ».
   Les valeurs de données passent par .value / textContent (jamais innerHTML).
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.render = window.ABMAT.render || {};

  const R = window.ABMAT.render;
  const U = window.ABMAT.utils;

  if (!U) {
    throw new Error("ABMAT.utils est requis avant ABMAT.render (charger utils.js en premier).");
  }

  const MOTIFS = [
    { value: "", label: "Motif…" },
    { value: "malade", label: "Malade" },
    { value: "conges", label: "Congés" },
    { value: "autre", label: "Autre" }
  ];

  function childHasData(child) {
    if (!child) return false;
    if (child.absent === true) return true;
    return Array.isArray(child.slots) && child.slots.length > 0;
  }

  function visibleChildKeys(children) {
    const keys = [];
    for (let i = 1; i <= 3; i++) {
      const k = String(i);
      if (k === "1" || childHasData(children[k])) keys.push(k);
    }
    return keys;
  }

  function makeButton(className, action, attrs, label) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.setAttribute("data-action", action);
    Object.keys(attrs).forEach((k) => btn.setAttribute(k, attrs[k]));
    btn.textContent = label;
    return btn;
  }

  function makeTimeInput(isoDate, childKey, slotIndex, kind, value) {
    const input = document.createElement("input");
    input.type = "time";
    input.id = `${kind}-${isoDate}-${childKey}-${slotIndex}`;
    input.setAttribute("data-time", kind);
    input.setAttribute("data-date", isoDate);
    input.setAttribute("data-child", childKey);
    input.setAttribute("data-slot-index", String(slotIndex));
    input.setAttribute("aria-label", `${kind === "in" ? "Entrée" : "Sortie"} enfant ${childKey} (${isoDate})`);
    input.value = (typeof value === "string") ? value : "";
    return input;
  }

  function buildHorairesCell(isoDate, childKey, child) {
    const td = document.createElement("td");
    td.className = "col-horaires";

    if (child.absent === true) {
      const sel = document.createElement("select");
      sel.setAttribute("data-motif", "");
      sel.setAttribute("data-date", isoDate);
      sel.setAttribute("data-child", childKey);
      sel.setAttribute("aria-label", `Motif d'absence enfant ${childKey} (${isoDate})`);
      MOTIFS.forEach((mo) => {
        const opt = document.createElement("option");
        opt.value = mo.value;
        opt.textContent = mo.label;
        sel.appendChild(opt);
      });
      sel.value = MOTIFS.some((mo) => mo.value === child.motif) ? child.motif : "";
      td.appendChild(sel);
      return td;
    }

    const slots = (Array.isArray(child.slots) && child.slots.length > 0)
      ? child.slots
      : [{ in: "", out: "" }];

    slots.forEach((slot, idx) => {
      const s = (slot && typeof slot === "object") ? slot : {};
      const row = document.createElement("span");
      row.className = "creneau";

      row.appendChild(makeTimeInput(isoDate, childKey, idx, "in", s.in));
      const sep = document.createElement("span");
      sep.className = "creneau-sep";
      sep.setAttribute("aria-hidden", "true");
      sep.textContent = "→";
      row.appendChild(sep);
      row.appendChild(makeTimeInput(isoDate, childKey, idx, "out", s.out));

      if (slots.length > 1) {
        const del = makeButton("mt-remove", "remove-slot", {
          "data-date": isoDate, "data-child": childKey, "data-slot-index": String(idx),
          "aria-label": "Supprimer ce créneau"
        }, "✕");
        row.appendChild(del);
      }
      td.appendChild(row);
    });

    if (slots.length < 3) {
      td.appendChild(makeButton("mt-add", "add-slot", {
        "data-date": isoDate, "data-child": childKey
      }, "+ créneau"));
    }
    return td;
  }

  /**
   * Construit les lignes <tr> d'un jour.
   * @param {Object} ctx {isoDate, weekdayLabel, dayNumLabel, ferieName, dayObj, childNames}
   * @returns {HTMLTableRowElement[]}
   */
  R.buildDayRows = function buildDayRows(ctx) {
    const children = (ctx.dayObj && ctx.dayObj.children) ? ctx.dayObj.children : {};
    const keys = visibleChildKeys(children);
    const rows = [];

    keys.forEach((childKey, idx) => {
      const child = (children[childKey] && typeof children[childKey] === "object")
        ? children[childKey]
        : { absent: false, motif: "", slots: [] };

      const tr = document.createElement("tr");
      tr.setAttribute("data-date", ctx.isoDate);
      tr.setAttribute("data-child", childKey);
      if (ctx.ferieName) tr.classList.add("is-ferie");

      // Colonne Date (+ férié, + enfant) sur la 1re ligne du jour
      if (idx === 0) {
        const tdDate = document.createElement("td");
        tdDate.className = "col-date";
        tdDate.setAttribute("rowspan", String(keys.length));

        const inner = document.createElement("div");
        inner.className = "col-date__inner";
        const dayEl = document.createElement("strong");
        dayEl.className = "date-day";
        dayEl.textContent = ctx.weekdayLabel;
        const numEl = document.createElement("span");
        numEl.className = "date-num";
        numEl.textContent = ctx.dayNumLabel;
        inner.appendChild(dayEl);
        inner.appendChild(document.createElement("br"));
        inner.appendChild(numEl);

        if (ctx.ferieName) {
          const badge = document.createElement("span");
          badge.className = "ferie-badge";
          badge.textContent = `Férié — ${ctx.ferieName}`;
          inner.appendChild(badge);
        }
        if (keys.length < 3) {
          inner.appendChild(makeButton("mt-add mt-add--child", "add-child", { "data-date": ctx.isoDate }, "+ enfant"));
        }
        tdDate.appendChild(inner);
        tr.appendChild(tdDate);
      }

      // Enfant + absence
      const tdEnfant = document.createElement("td");
      tdEnfant.className = "col-enfant";
      const name = document.createElement("span");
      name.className = "child-name";
      name.textContent = (ctx.childNames && ctx.childNames[childKey]) || `Enfant ${childKey}`;
      tdEnfant.appendChild(name);

      const absentLabel = document.createElement("label");
      absentLabel.className = "absent-toggle";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.setAttribute("data-absent", "");
      cb.setAttribute("data-date", ctx.isoDate);
      cb.setAttribute("data-child", childKey);
      cb.checked = (child.absent === true);
      absentLabel.appendChild(cb);
      absentLabel.appendChild(document.createTextNode(" Absent"));
      tdEnfant.appendChild(absentLabel);
      tr.appendChild(tdEnfant);

      // Horaires (créneaux ou motif d'absence)
      tr.appendChild(buildHorairesCell(ctx.isoDate, childKey, child));

      // Temps de présence + abattement (remplis par app.js)
      const tdTemps = document.createElement("td");
      tdTemps.className = "col-temps";
      const hoursEl = document.createElement("span");
      hoursEl.setAttribute("data-hours", "");
      hoursEl.setAttribute("data-date", ctx.isoDate);
      hoursEl.setAttribute("data-child", childKey);
      hoursEl.textContent = "—";
      tdTemps.appendChild(hoursEl);
      tr.appendChild(tdTemps);

      const tdAbatt = document.createElement("td");
      tdAbatt.className = "col-abatt";
      const abattEl = document.createElement("span");
      abattEl.setAttribute("data-abatt", "");
      abattEl.setAttribute("data-date", ctx.isoDate);
      abattEl.setAttribute("data-child", childKey);
      abattEl.textContent = "—";
      tdAbatt.appendChild(abattEl);
      tr.appendChild(tdAbatt);

      // Total du jour sur la 1re ligne
      if (idx === 0) {
        const tdTotal = document.createElement("td");
        tdTotal.className = "col-daytotal";
        tdTotal.setAttribute("rowspan", String(keys.length));
        const pill = document.createElement("span");
        pill.className = "day-total-pill";
        pill.setAttribute("data-day-total", "");
        pill.setAttribute("data-date", ctx.isoDate);
        pill.textContent = "—";
        tdTotal.appendChild(pill);
        tr.appendChild(tdTotal);
      }

      rows.push(tr);
    });

    return rows;
  };
})();
