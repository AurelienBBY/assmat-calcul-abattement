/* ============================================================================
   render/day-rows.js — Carte d'un jour (enfants visibles, créneaux, absences)
   ----------------------------------------------------------------------------
   Redesign "Liquid Glass" : une carte par jour (au lieu de <tr>), un
   "kidline" par enfant visible (enfant 1 toujours ; les autres s'ils ont des
   données), créneaux multiples en pilules, absence avec motif, badge férié,
   bouton « + enfant ».
   IMPORTANT : les attributs data-* (data-date, data-child, data-slot-index,
   data-time, data-absent, data-motif, data-action, data-hours, data-abatt,
   data-day-total) sont inchangés — c'est le contrat utilisé par
   month-table.js (délégation d'événements) et app.js (mise à jour des
   calculs). Seule la forme du DOM (div au lieu de tr/td) change.
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

  const ICONS = {
    addChild: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>'
  };

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

  function initials(name, key) {
    const n = String(name || "").trim();
    if (!n) return `E${key}`;
    const parts = n.split(/\s+/);
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : n.slice(0, 2).toUpperCase();
  }

  function makeButton(className, action, attrs, innerHTML) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.setAttribute("data-action", action);
    Object.keys(attrs).forEach((k) => btn.setAttribute(k, attrs[k]));
    if (innerHTML.startsWith("<svg")) btn.innerHTML = innerHTML;
    else btn.textContent = innerHTML;
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

  /** Pilules de créneaux + motif d'absence (contenu variable d'un kidline). */
  function buildHoraires(isoDate, childKey, child) {
    const wrap = document.createElement("span");
    wrap.className = "kid-horaires";

    if (child.absent === true) {
      const sel = document.createElement("select");
      sel.className = "motif-sel";
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
      wrap.appendChild(sel);
      return wrap;
    }

    const slots = (Array.isArray(child.slots) && child.slots.length > 0)
      ? child.slots
      : [{ in: "", out: "" }];

    slots.forEach((slot, idx) => {
      const s = (slot && typeof slot === "object") ? slot : {};
      const chip = document.createElement("span");
      chip.className = "slot-chip";

      chip.appendChild(makeTimeInput(isoDate, childKey, idx, "in", s.in));
      chip.appendChild(document.createTextNode(" → "));
      chip.appendChild(makeTimeInput(isoDate, childKey, idx, "out", s.out));

      if (slots.length > 1) {
        const del = makeButton("slot-x", "remove-slot", {
          "data-date": isoDate, "data-child": childKey, "data-slot-index": String(idx),
          "aria-label": "Supprimer ce créneau"
        }, "✕");
        chip.appendChild(del);
      }
      wrap.appendChild(chip);
    });

    if (slots.length < 3) {
      wrap.appendChild(makeButton("addslot", "add-slot", {
        "data-date": isoDate, "data-child": childKey
      }, "+ créneau"));
    }
    return wrap;
  }

  /**
   * Construit la carte glass d'un jour (tous les enfants visibles regroupés).
   * @param {Object} ctx {isoDate, weekdayLabel, dayNumLabel, ferieName, dayObj, childNames}
   * @returns {HTMLDivElement}
   */
  R.buildDayRows = function buildDayRows(ctx) {
    const children = (ctx.dayObj && ctx.dayObj.children) ? ctx.dayObj.children : {};
    const keys = visibleChildKeys(children);

    const card = document.createElement("div");
    card.className = "day-row" + (ctx.ferieName ? " is-ferie" : "");
    card.setAttribute("data-date", ctx.isoDate);

    // --- Colonne date ---------------------------------------------------
    const dCol = document.createElement("div");
    dCol.className = "d";
    const numEl = document.createElement("b");
    numEl.textContent = ctx.dayNumLabel.slice(0, 2); // "05" (jj)
    const wkEl = document.createElement("span");
    wkEl.textContent = ctx.weekdayLabel.slice(0, 3) + ".";
    dCol.appendChild(numEl);
    dCol.appendChild(wkEl);
    if (ctx.ferieName) {
      const badge = document.createElement("span");
      badge.className = "ferie";
      badge.textContent = `Férié — ${ctx.ferieName}`;
      dCol.appendChild(badge);
    }
    if (keys.length < 3) {
      dCol.appendChild(makeButton("addchild", "add-child", { "data-date": ctx.isoDate }, "+ enfant"));
    }
    card.appendChild(dCol);

    // --- Colonne enfants (kidlines) --------------------------------------
    const kidsCol = document.createElement("div");
    kidsCol.className = "kids";

    keys.forEach((childKey) => {
      const child = (children[childKey] && typeof children[childKey] === "object")
        ? children[childKey]
        : { absent: false, motif: "", slots: [] };

      const line = document.createElement("div");
      line.className = "kidline";
      line.setAttribute("data-child", childKey);

      const avatar = document.createElement("span");
      avatar.className = "avatar";
      const displayName = (ctx.childNames && ctx.childNames[childKey]) || null;
      avatar.textContent = initials(displayName, childKey);
      avatar.title = displayName || `Enfant ${childKey}`;
      line.appendChild(avatar);

      const absentLabel = document.createElement("label");
      absentLabel.className = "abs-toggle";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.setAttribute("data-absent", "");
      cb.setAttribute("data-date", ctx.isoDate);
      cb.setAttribute("data-child", childKey);
      cb.checked = (child.absent === true);
      absentLabel.appendChild(cb);
      absentLabel.appendChild(document.createTextNode(" Absent"));
      line.appendChild(absentLabel);

      line.appendChild(buildHoraires(ctx.isoDate, childKey, child));

      // Statut discret par enfant (heures / abattement), gardé pour le
      // contrat de mise à jour d'app.js — habillé en texte secondaire.
      const status = document.createElement("span");
      status.className = "kid-status";
      const hoursEl = document.createElement("span");
      hoursEl.setAttribute("data-hours", "");
      hoursEl.setAttribute("data-date", ctx.isoDate);
      hoursEl.setAttribute("data-child", childKey);
      hoursEl.textContent = "—";
      const abattEl = document.createElement("span");
      abattEl.setAttribute("data-abatt", "");
      abattEl.setAttribute("data-date", ctx.isoDate);
      abattEl.setAttribute("data-child", childKey);
      abattEl.textContent = "—";
      status.appendChild(hoursEl);
      status.appendChild(document.createTextNode(" · "));
      status.appendChild(abattEl);
      line.appendChild(status);

      kidsCol.appendChild(line);
    });

    card.appendChild(kidsCol);

    // --- Total du jour ---------------------------------------------------
    const totalCol = document.createElement("div");
    totalCol.className = "r2";
    const pill = document.createElement("span");
    pill.className = "day-total-pill";
    pill.setAttribute("data-day-total", "");
    pill.setAttribute("data-date", ctx.isoDate);
    pill.textContent = "—";
    totalCol.appendChild(pill);
    card.appendChild(totalCol);

    return card;
  };
})();
