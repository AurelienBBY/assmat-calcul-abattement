/* ============================================================================
   render/dom.js — Construction d'éléments (jamais de donnée dans innerHTML)
   ----------------------------------------------------------------------------
   R.h(tag, props, children) :
   - props.class, props.text (textContent), props.on {click: fn…},
     props.data {clé: valeur} (dataset), tout autre prop : propriété DOM si
     elle existe (disabled, value, htmlFor…), sinon attribut (aria-*, role…)
   - children : nœuds, textes, tableaux ; null/false/undefined ignorés
   R.icon(nom) : icône SVG (tracés constants, construits en createElementNS).
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.render = window.ABMAT.render || {};
  const R = window.ABMAT.render;

  if (!window.ABMAT.utils) {
    throw new Error("ABMAT.utils est requis avant les renderers (charger utils.js en premier).");
  }

  function append(el, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach((c) => append(el, c)); return; }
    el.appendChild((child instanceof Node) ? child : document.createTextNode(String(child)));
  }

  R.h = function h(tag, props, children) {
    const el = document.createElement(tag);
    Object.keys(props || {}).forEach((k) => {
      const v = props[k];
      if (v === undefined || v === null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = String(v);
      else if (k === "on") Object.keys(v).forEach((evt) => el.addEventListener(evt, v[evt]));
      else if (k === "data") Object.keys(v).forEach((d) => { el.dataset[d] = String(v[d]); });
      else if (k in el && !k.includes("-")) el[k] = v;
      else el.setAttribute(k, v === true ? "" : String(v));
    });
    append(el, children);
    return el;
  };

  /** Ajoute des enfants (mêmes règles que R.h : tableaux aplatis, vides ignorés). */
  R.append = function appendAll(el, children) {
    append(el, children);
    return el;
  };

  R.clear = function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  };

  // Tracés 24×24 (trait), cf. maquette validée.
  const ICONS = {
    prev: [["path", { d: "m15 18-6-6 6-6" }]],
    next: [["path", { d: "m9 18 6-6-6-6" }]],
    close: [["path", { d: "M6 6l12 12M18 6 6 18" }]],
    cloud: [["path", { d: "M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z" }], ["path", { d: "m9 13 2 2 4-4" }]],
    camera: [["path", { d: "M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" }], ["circle", { cx: 12, cy: 13, r: 3.5 }]],
    print: [["path", { d: "M6 9V2h12v7" }], ["path", { d: "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" }], ["rect", { x: 6, y: 14, width: 12, height: 8 }]]
  };

  R.icon = function icon(name) {
    const parts = ICONS[name];
    if (!parts) throw new Error(`R.icon : icône inconnue « ${name} ».`);
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    [["viewBox", "0 0 24 24"], ["fill", "none"], ["stroke", "currentColor"], ["stroke-width", "2"],
      ["stroke-linecap", "round"], ["stroke-linejoin", "round"], ["aria-hidden", "true"]].forEach(([k, v]) => svg.setAttribute(k, v));
    parts.forEach(([tag, attrs]) => {
      const p = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach((k) => p.setAttribute(k, String(attrs[k])));
      svg.appendChild(p);
    });
    return svg;
  };
})();
