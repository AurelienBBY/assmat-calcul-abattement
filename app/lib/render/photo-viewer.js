/* ============================================================================
   render/photo-viewer.js — Afficher une photo de fiche, avec zoom
   ----------------------------------------------------------------------------
   La photo occupe la largeur ; elle se déplace en faisant glisser. Zoom :
   pincer à deux doigts (iPhone, pavé tactile du Mac), Ctrl + molette, ou les
   boutons − / +. Peut s'ouvrir zoomée sur une partie de la largeur
   (vérification du mois : les colonnes de la semaine sur la fiche).
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

  const clamp = (z) => Math.min(MAX, Math.max(MIN, z));

  /**
   * @param {{url:string, alt:string, focus?:{x0:number, x1:number, y0:number}, keep?:{zoom, left, top},
   *   onChange?:(state:{zoom, left, top})=>void}} o
   *   focus : partie de la largeur de la photo à montrer à l'ouverture (zoom en conséquence),
   *     à partir de la hauteur y0 ;
   *   keep : zoom et position à retrouver quand l'écran est redessiné ;
   *   onChange : à chaque zoom ou déplacement.
   * @returns {HTMLElement}
   */
  R.buildPhotoViewer = function buildPhotoViewer(o) {
    let zoom = o.keep ? o.keep.zoom : (o.focus ? clamp(1 / (o.focus.x1 - o.focus.x0)) : 1);
    const img = h("img", { src: o.url, alt: o.alt, draggable: false });
    const pane = h("div", { class: "pv-pane", tabindex: "0", "aria-label": `${o.alt}. Faites glisser pour la déplacer.` }, img);
    const label = h("span", { class: "pv-zoom num", "aria-live": "polite" });
    const report = () => { if (o.onChange) o.onChange({ zoom, left: pane.scrollLeft, top: pane.scrollTop }); };

    function apply(next, cx, cy) {
      const before = zoom;
      zoom = clamp(next);
      img.style.width = `${zoom * 100}%`;
      label.textContent = `${Math.round(zoom * 100)} %`;
      // Garde le point sous les doigts (ou le centre) au même endroit.
      const x = (cx === undefined ? pane.clientWidth / 2 : cx), y = (cy === undefined ? pane.clientHeight / 2 : cy);
      const k = zoom / before;
      pane.scrollLeft = (pane.scrollLeft + x) * k - x;
      pane.scrollTop = (pane.scrollTop + y) * k - y;
      report();
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
    img.addEventListener("load", () => {
      if (o.keep) { pane.scrollLeft = o.keep.left; pane.scrollTop = o.keep.top; }
      else if (o.focus) { pane.scrollLeft = o.focus.x0 * img.clientWidth; pane.scrollTop = o.focus.y0 * img.clientHeight; }
    });
    pane.addEventListener("scroll", report, { passive: true });

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
