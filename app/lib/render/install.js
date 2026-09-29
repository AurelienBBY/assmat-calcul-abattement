/* ============================================================================
   render/install.js — « Installez d'abord AB’assmat » (avant la mise en route)
   ----------------------------------------------------------------------------
   Sur iPhone : les gestes de Safari, un par un, avec leurs pictogrammes. Sur
   Android : le bouton d'installation de Chrome quand il est disponible,
   sinon les gestes du menu ⋮. Pourquoi d'abord : sur iPhone, l'icône a sa
   propre mémoire — ce qui serait rempli dans Safari ne s'y retrouverait pas.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.icon) {
    throw new Error("render/dom.js doit être chargé avant render/install.js.");
  }
  const h = R.h;

  const STEPS = {
    ios: [
      ["share", "Touchez le bouton Partager", "Un carré avec une flèche vers le haut, en bas de l'écran (ou en haut, dans la barre d'adresse)."],
      ["plusSquare", "Choisissez « Sur l'écran d'accueil »", "Faites défiler la liste si besoin."],
      ["check", "Touchez « Ajouter »", "En haut à droite."],
      ["phone", "Ouvrez AB’assmat depuis sa nouvelle icône", "La mise en route commencera là. Vous pourrez fermer cette page."]
    ],
    android: [
      ["dots", "Touchez le menu ⋮", "En haut à droite de Chrome."],
      ["plusSquare", "Choisissez « Installer l'application »", "Ou « Ajouter à l'écran d'accueil »."],
      ["check", "Confirmez « Installer »", ""],
      ["phone", "Ouvrez AB’assmat depuis l'écran d'accueil", "La mise en route commencera là."]
    ]
  };

  const steps = (target) => h("ol", { class: "inst-steps" }, STEPS[target].map(([icon, title, help]) => h("li", null, [
    h("span", { class: "inst-ic", "aria-hidden": "true" }, R.icon(icon)),
    h("span", { class: "inst-txt" }, [h("b", { text: title }), help ? h("span", { class: "small muted", text: help }) : null])
  ])));

  /**
   * @param {{target:"ios"|"android", canPrompt:boolean, state:null|"done"}} m
   *   canPrompt : Chrome propose sa fenêtre d'installation ; state "done" : installée (ou « C'est fait »)
   * @param {{onPrompt, onDone, onSkip}} hd
   */
  R.buildInstall = function buildInstall(m, hd) {
    const ios = m.target === "ios";
    const head = [
      h("h2", { class: "onb-title", text: "Installez d'abord AB’assmat sur votre téléphone" }),
      h("div", { class: "inst-app" }, [h("img", { src: "app/assets/apple-touch-icon.png", alt: "" }), h("span", { text: "AB’assmat" })]),
      h("p", { class: "lead", text: "Elle s'ouvrira comme une application, depuis son icône, même sans internet." })
    ];
    if (m.state === "done") {
      return h("div", { class: "onb" }, [head,
        h("p", { class: "note ok", text: "Parfait ! Ouvrez maintenant AB’assmat depuis votre écran d'accueil : la mise en route vous y attend. Vous pouvez fermer cette page." }),
        h("div", { class: "onb-foot is-static" }, h("button", { type: "button", class: "btn btn-quiet", text: "Continuer ici quand même", on: { click: hd.onSkip } }))]);
    }
    return h("div", { class: "onb" }, [head,
      ios ? h("p", { class: "note", text: "Faites-le avant de commencer : sur iPhone, l'icône a sa propre mémoire. Ce que vous rempliriez ici, dans Safari, ne s'y retrouverait pas." }) : null,
      m.canPrompt ? null : steps(m.target),
      h("div", { class: "onb-foot is-static" }, [
        m.canPrompt
          ? h("button", { type: "button", class: "btn btn-primary btn-big", text: "Installer AB’assmat", on: { click: hd.onPrompt } })
          : h("button", { type: "button", class: "btn btn-primary btn-big", text: "C'est fait", on: { click: hd.onDone } }),
        h("button", { type: "button", class: "btn btn-quiet", text: "Continuer sans installer", on: { click: hd.onSkip } }),
        ios ? h("p", { class: "small muted", text: "Déconseillé : dans un simple onglet, l'iPhone peut effacer vos données au bout de 7 jours sans ouverture." }) : null
      ])
    ]);
  };
})();
