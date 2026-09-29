/* ============================================================================
   render/photo-viewer.js — Afficher une photo de fiche, avec zoom
   ----------------------------------------------------------------------------
   La photo occupe la largeur ; elle se déplace en faisant glisser. Zoom :
   pincer à deux doigts (iPhone, pavé tactile du Mac), Ctrl + molette, ou les
   boutons − / +. Peut s'ouvrir directement sur le haut ou le bas de la page
   (vérification du mois : la moitié de fiche qui correspond à la semaine).
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.h) {
    throw new Error("render/dom.js doit être chargé avant render/photo-viewer.js.");
  }
  const h = R.h;
  const MIN = 1;
  const MAX = 4;

  /**
   * @param {{url:string, alt:string, part?:"haut"|"bas", zoom?:number, onZoom?:(z:number)=>void}} o
   * @returns {HTMLElement}
   */
  R.buildPhotoViewer = function buildPhotoViewer(o) {
    let zoom = o.zoom || 1;
    const img = h("img", { src: o.url, alt: o.alt, draggable: false });
    const pane = h("div", { class: "pv-pane", tabindex: "0", "aria-label": `${o.alt}. Faites glisser pour la déplacer.` }, img);
    const label = h("span", { class: "pv-zoom num", "aria-live": "polite" });

    function apply(next, cx, cy) {
      const before = zoom;
      zoom = Math.min(MAX, Math.max(MIN, next));
      img.style.width = `${zoom * 100}%`;
      label.textContent = `${Math.round(zoom * 100)} %`;
      // Garde le point sous les doigts (ou le centre) au même endroit.
      const x = (cx === undefined ? pane.clientWidth / 2 : cx), y = (cy === undefined ? pane.clientHeight / 2 : cy);
      const k = zoom / before;
      pane.scrollLeft = (pane.scrollLeft + x) * k - x;
      pane.scrollTop = (pane.scrollTop + y) * k - y;
      if (o.onZoom) o.onZoom(zoom);
    }

    let base = zoom;
    pane.addEventListener("gesturestart", (e) => { e.preventDefault(); base = zoom; });
    pane.addEventListener("gesturechange", (e) => { e.preventDefault(); apply(base * e.scale); });
    pane.addEventListener("wheel", (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const r = pane.getBoundingClientRect();
      apply(zoom * (1 - e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    img.style.width = `${zoom * 100}%`;
    label.textContent = `${Math.round(zoom * 100)} %`;
    img.addEventListener("load", () => { pane.scrollTop = o.part === "bas" ? img.clientHeight / 2 : 0; });

    return h("div", { class: "pv" }, [
      pane,
      h("div", { class: "pv-tools" }, [
        h("button", { type: "button", class: "pv-btn", "aria-label": "Réduire", text: "−", on: { click: () => apply(zoom / 1.5) } }),
        label,
        h("button", { type: "button", class: "pv-btn", "aria-label": "Agrandir", text: "+", on: { click: () => apply(zoom * 1.5) } })
      ])
    ]);
  };

  /** Photo en grand, dans une fenêtre. */
  R.openPhoto = function openPhoto(title, url) {
    R.openSheet({ title, wide: true, body: h("div", { class: "pv-full" }, R.buildPhotoViewer({ url, alt: title })) });
  };
})();
