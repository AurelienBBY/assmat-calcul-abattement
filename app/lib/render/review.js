/* ============================================================================
   render/review.js — « Vérifier le mois », une semaine à la fois
   ----------------------------------------------------------------------------
   En haut (à gauche sur ordinateur) : la photo de la fiche, zoomée sur les
   colonnes de la semaine (recto / verso modifiable, « Tourner » si elle est
   dans le mauvais sens). En dessous : la même semaine dans l'outil, disposée
   comme la fiche (render/review-table.js). Rien n'est lu automatiquement
   sur la photo.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.buildPhotoViewer || !R.buildReviewTable) {
    throw new Error("render/photo-viewer.js et render/review-table.js doivent être chargés avant render/review.js.");
  }
  const h = R.h;
  const F = R.fmt;

  const seg = (label, current, options, onPick) => h("div", { class: "seg", role: "group", "aria-label": label },
    options.map(([v, l]) => h("button", { type: "button", text: l, "aria-pressed": String(current === v), on: { click: () => onPick(v) } })));

  /**
   * @param {Object} m - { monthName, weekIndex, weekCount, week:[iso], page, focus, keep, photoUrl,
   *   table: modèle de R.buildReviewTable }
   * @param {Object} hd - onDay(iso), onPage(page), onTurn(page), onPick(page), onPhoto(state), onNext, onPrev, onQuit
   */
  R.buildReview = function buildReview(m, hd) {
    const first = m.week[0], last = m.week[m.week.length - 1];
    const photo = m.photoUrl
      ? R.buildPhotoViewer({ url: m.photoUrl, alt: `Fiche de ${m.monthName}, ${m.page}`, focus: m.focus, keep: m.keep, onChange: hd.onPhoto })
      : h("div", { class: "rv-missing" }, [
        h("p", { class: "small", text: `Pas encore de photo du ${m.page}.` }),
        h("button", { type: "button", class: "btn btn-primary", on: { click: () => hd.onPick(m.page) } }, [R.icon("camera"), `Prendre la photo du ${m.page}`])
      ]);

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
            seg("Face de la fiche", m.page, [["recto", "Recto (1–15)"], ["verso", "Verso (16–31)"]], hd.onPage),
            m.photoUrl ? h("button", { type: "button", class: "btn btn-quiet", text: "Tourner", "aria-label": `Tourner la photo du ${m.page} d'un quart de tour`, on: { click: () => hd.onTurn(m.page) } }) : null
          ]),
          photo
        ]),
        h("div", { class: "rv-list" }, [
          h("p", { class: "small muted", text: "Comparez case par case avec la fiche. Une case différente ? Touchez-la pour corriger la journée." }),
          R.buildReviewTable(m.table, hd)
        ])
      ]),
      h("div", { class: "rv-foot" }, [
        m.weekIndex > 0 ? h("button", { type: "button", class: "btn", text: "Semaine précédente", on: { click: hd.onPrev } }) : null,
        h("button", { type: "button", class: "btn btn-primary btn-big", text: m.weekIndex === m.weekCount - 1 ? "Terminer la vérification" : "Semaine suivante", on: { click: hd.onNext } })
      ])
    ]);
  };

  /**
   * Fin de la vérification.
   * @param {{monthName, changed:number, dueMin:number, invalid:number}} m
   */
  R.buildReviewEnd = function buildReviewEnd(m, hd) {
    return h("div", { class: "rv" }, h("div", { class: "card rv-end" }, [
      h("h2", { text: `${F.cap(m.monthName)} vérifié ✓` }),
      h("p", { text: m.changed ? `${F.plural(m.changed, "jour")} corrigé${m.changed > 1 ? "s" : ""}. Tous les autres jours sont comme sur la fiche.` : "Tous les jours sont comme sur la fiche." }),
      h("p", null, [`Heures sup. calculées pour ${m.monthName} : `, h("b", { text: m.dueMin ? F.dur(m.dueMin) : "aucune" }), ". Comparez avec la ligne « Heures supplémentaires » de la fiche."]),
      m.invalid ? h("p", { class: "warn-line", text: `${F.cap(F.plural(m.invalid, "journée"))} à vérifier (horaire incomplet) : les heures sup. de ${m.invalid > 1 ? "ces journées ne sont" : "cette journée ne sont"} pas comptées.` }) : null,
      h("p", { class: "small muted", text: "L'étape 1 du mois est cochée. Il reste la fiche de paie, puis « J'ai terminé »." }),
      h("button", { type: "button", class: "btn btn-primary btn-big", text: "Retour au mois", on: { click: hd.onQuit } })
    ]));
  };
})();
