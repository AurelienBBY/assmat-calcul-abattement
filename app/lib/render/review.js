/* ============================================================================
   render/review.js — « Vérifier le mois », une semaine à la fois
   ----------------------------------------------------------------------------
   En haut (à gauche sur ordinateur) : la photo de la fiche, ouverte sur la
   moitié qui correspond à la semaine (recto / verso, haut / bas, modifiables).
   En dessous : les journées pré-remplies ; toucher un jour ouvre sa fiche du
   jour pour le corriger. Rien n'est lu automatiquement sur la photo.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.buildPhotoViewer || !R.fmt) {
    throw new Error("render/photo-viewer.js doit être chargé avant render/review.js.");
  }
  const h = R.h;
  const F = R.fmt;

  function dayText(c) {
    if (c.state === "off") return "Non travaillé";
    if (!c.lines.length) return c.ferie || "Personne";
    return c.lines.map((l) => (l.kind === "absent" ? `${l.label} : absence` : `${l.label}${l.kind === "relais" ? " (relais)" : ""} ${l.text}`))
      .concat(c.meeting ? ["réunion"] : []).join(" · ");
  }

  function seg(key, current, options, onPick) {
    return h("div", { class: "seg", role: "group", "aria-label": key === "page" ? "Face de la fiche" : "Moitié de la page" },
      options.map(([v, l]) => h("button", { type: "button", text: l, "aria-pressed": String(current === v), on: { click: () => onPick(v) } })));
  }

  /**
   * @param {Object} m - { monthName, weekIndex, weekCount, days:[{iso, cell, changed}], view:{page, part},
   *   photoUrl, zoom }
   * @param {Object} hd - onDay(iso), onView(patch), onNext, onPrev, onQuit, onPick(side), onZoom(z)
   */
  R.buildReview = function buildReview(m, hd) {
    const first = m.days[0].iso, last = m.days[m.days.length - 1].iso;
    const photo = m.photoUrl
      ? R.buildPhotoViewer({ url: m.photoUrl, alt: `Fiche de ${m.monthName}, ${m.view.page}, ${m.view.part} de page`, part: m.view.part, zoom: m.zoom, onZoom: hd.onZoom })
      : h("div", { class: "rv-missing" }, [
        h("p", { class: "small", text: `Pas encore de photo du ${m.view.page}.` }),
        h("button", { type: "button", class: "btn btn-primary", on: { click: () => hd.onPick(m.view.page) } }, [R.icon("camera"), `Prendre la photo du ${m.view.page}`])
      ]);

    const rows = m.days.map((d) => h("button", { type: "button", class: "rv-day" + (d.changed ? " is-mod" : ""), data: { day: d.iso }, on: { click: () => hd.onDay(d.iso) } }, [
      h("span", { class: "rv-d", text: F.cap(F.dateLong(d.iso).replace(/ \S+$/, "")) }),
      h("span", { class: "rv-t", text: dayText(d.cell) }),
      h("span", { class: "rv-tag", text: d.changed ? "modifié" : "" })
    ]));

    return h("div", { class: "rv" }, [
      h("div", { class: "rv-head" }, [
        h("div", { class: "rv-row" }, [h("h2", { text: `Vérifier ${m.monthName}` }), h("button", { type: "button", class: "btn btn-quiet", text: "Quitter", on: { click: hd.onQuit } })]),
        h("span", { class: "small muted", text: `Semaine ${m.weekIndex + 1} sur ${m.weekCount} · du ${F.dateLong(first).split(" ")[1]} au ${F.dateLong(last).split(" ").slice(1).join(" ")}` }),
        h("div", { class: "rv-bars", style: `grid-template-columns:repeat(${m.weekCount},1fr)`, "aria-hidden": "true" },
          Array.from({ length: m.weekCount }, (_, i) => h("span", { class: i <= m.weekIndex ? "on" : "" })))
      ]),
      h("div", { class: "rv-body" }, [
        h("div", { class: "rv-photo" }, [
          h("div", { class: "rv-tools" }, [
            seg("page", m.view.page, [["recto", "Recto"], ["verso", "Verso"]], (v) => hd.onView({ page: v })),
            seg("part", m.view.part, [["haut", "Haut"], ["bas", "Bas"]], (v) => hd.onView({ part: v }))
          ]),
          photo
        ]),
        h("div", { class: "rv-list" }, [
          h("p", { class: "small muted", text: "Comparez avec la fiche. Un jour différent ? Touchez-le pour le corriger." }),
          rows
        ])
      ]),
      h("div", { class: "rv-foot" }, [
        m.weekIndex > 0 ? h("button", { type: "button", class: "btn", text: "Semaine précédente", on: { click: hd.onPrev } }) : null,
        h("button", { type: "button", class: "btn btn-primary btn-big", text: m.weekIndex === m.weekCount - 1 ? "Terminer la vérification" : "Semaine suivante", on: { click: hd.onNext } })
      ])
    ]);
  };

  /** Fin de la vérification. */
  R.buildReviewEnd = function buildReviewEnd(m, hd) {
    return h("div", { class: "rv" }, h("div", { class: "card rv-end" }, [
      h("h2", { text: `${F.cap(m.monthName)} vérifié ✓` }),
      h("p", { text: m.changed ? `${F.plural(m.changed, "jour")} corrigé${m.changed > 1 ? "s" : ""}. Tous les autres jours sont comme sur la fiche.` : "Tous les jours sont comme sur la fiche." }),
      h("p", { class: "small muted", text: "L'étape 1 du mois est cochée. Il reste la fiche de paie, puis « J'ai terminé »." }),
      h("button", { type: "button", class: "btn btn-primary btn-big", text: "Retour au mois", on: { click: hd.onQuit } })
    ]));
  };
})();
