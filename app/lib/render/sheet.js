/* ============================================================================
   render/sheet.js — Fenêtre (feuille du bas sur iPhone) et message du bas
   ----------------------------------------------------------------------------
   R.openSheet({title, body, wide, onClose}) : une seule fenêtre à la fois ;
   Échap, fond grisé et « ✕ » ferment ; le focus revient où il était.
   R.toast(text, actions) : message 8 s, avec boutons (« Annuler »…).
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.h || !R.icon) {
    throw new Error("render/dom.js doit être chargé avant render/sheet.js.");
  }
  const h = R.h;

  let current = null; // { scrim, el, onClose, lastFocus }

  function focusables(el) {
    return Array.from(el.querySelectorAll("button:not([disabled]), input:not([disabled]), select, summary, iframe, [tabindex]:not([tabindex='-1'])"));
  }

  R.closeSheet = function closeSheet() {
    if (!current) return;
    const { scrim, el, onClose, lastFocus } = current;
    current = null;
    scrim.remove();
    el.remove();
    document.removeEventListener("keydown", onKey);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    if (onClose) onClose();
  };

  function onKey(e) {
    if (!current) return;
    if (e.key === "Escape") { e.preventDefault(); R.closeSheet(); return; }
    if (e.key !== "Tab") return;
    const list = focusables(current.el);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /**
   * @param {{title:string, body:Node|Node[], wide?:boolean, onClose?:Function}} opts
   * @returns {{el:HTMLElement, setBody:(body)=>void, close:()=>void}}
   */
  R.openSheet = function openSheet(opts) {
    const lastFocus = current ? current.lastFocus : document.activeElement;
    if (current) { current.onClose = null; R.closeSheet(); }

    const content = h("div", { class: "dlg-body" });
    const el = h("div", { class: "dlg" + (opts.wide ? " is-wide" : ""), role: "dialog", "aria-modal": "true", "aria-label": opts.title, tabindex: "-1" }, [
      h("div", { class: "dlg-head" }, [
        h("h3", { text: opts.title }),
        h("button", { type: "button", class: "close", "aria-label": "Fermer", on: { click: R.closeSheet } }, R.icon("close"))
      ]),
      content
    ]);
    const scrim = h("div", { class: "scrim", on: { click: R.closeSheet } });
    document.body.appendChild(scrim);
    document.body.appendChild(el);
    current = { scrim, el, onClose: opts.onClose || null, lastFocus };
    document.addEventListener("keydown", onKey);

    const setBody = (body) => { R.clear(content); (Array.isArray(body) ? body : [body]).forEach((n) => n && content.appendChild(n)); };
    setBody(opts.body);
    (el.querySelector("[data-autofocus]") || el).focus({ preventScroll: true });
    return { el, setBody, close: R.closeSheet };
  };

  R.isSheetOpen = () => current !== null;

  // --- Message du bas --------------------------------------------------------

  let toastEl = null;
  let toastTimer = null;

  function hideToast() {
    clearTimeout(toastTimer);
    if (toastEl) toastEl.remove();
    toastEl = null;
  }

  /**
   * @param {string} text
   * @param {Array<{label:string, run:Function}>} [actions]
   */
  R.toast = function toast(text, actions) {
    hideToast();
    toastEl = h("div", { class: "toast", role: "status" }, [
      h("span", { text }),
      (actions || []).map((a) => h("button", { type: "button", text: a.label, on: { click: () => { hideToast(); a.run(); } } }))
    ]);
    document.body.appendChild(toastEl);
    toastTimer = setTimeout(hideToast, 8000);
  };
})();
