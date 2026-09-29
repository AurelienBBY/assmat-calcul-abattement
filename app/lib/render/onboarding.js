/* ============================================================================
   render/onboarding.js — Mise en route : cadre, accueil, fin, reprise
   ----------------------------------------------------------------------------
   5 étapes courtes, une question par écran. Cadre commun : retour, « Étape n
   sur 5 », « Plus tard », barre de progression, gros bouton en bas.
   Les étapes elles-mêmes : render/onb-steps.js et render/onb-kids.js.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.fmt || !R.icon) {
    throw new Error("render/format.js doit être chargé avant render/onboarding.js.");
  }
  const h = R.h;

  R.ONB_STEPS = ["Vous", "Les enfants", "Cette année", "Les mois passés", "La copie de secours"];

  /**
   * @param {{step:number, title:string, lead?:string, body:Node[], next:{label, disabled?, onClick},
   *   extra?:Node, onBack:Function, onLater:Function}} m
   */
  R.buildOnbFrame = function buildOnbFrame(m) {
    return h("div", { class: "onb" }, [
      h("div", { class: "onb-top" }, [
        h("div", { class: "onb-row" }, [
          h("button", { type: "button", class: "nav-btn", "aria-label": "Étape précédente", on: { click: m.onBack } }, R.icon("prev")),
          h("span", { class: "onb-label", text: `Étape ${m.step} sur 5 · ${R.ONB_STEPS[m.step - 1]}` }),
          h("button", { type: "button", class: "btn btn-quiet", text: "Plus tard", on: { click: m.onLater } })
        ]),
        h("div", { class: "onb-progress", "aria-hidden": "true" }, R.ONB_STEPS.map((_, i) => h("span", { class: i < m.step ? "on" : "" })))
      ]),
      h("h2", { class: "onb-title", text: m.title }),
      m.lead ? h("p", { class: "muted", text: m.lead }) : null,
      m.body,
      h("div", { class: "onb-foot" }, [
        h("button", { type: "button", class: "btn btn-primary btn-big", text: m.next.label, disabled: m.next.disabled, on: { click: m.next.onClick } }),
        m.extra || null
      ])
    ]);
  };

  /** Accueil (premier lancement). */
  R.buildOnbWelcome = function buildOnbWelcome(m, hd) {
    const restored = m.childrenCount > 0;
    return h("div", { class: "onb" }, [
      h("img", { class: "onb-logo", src: "app/assets/icon.svg", alt: "" }),
      h("h2", { class: "onb-title", text: "Bienvenue dans AB’assmat" }),
      h("p", { class: "lead", text: "Cet outil calcule votre abattement d'assistante maternelle, le montant à déclarer aux impôts et vos heures supplémentaires. Tout reste sur cet appareil." }),
      restored
        ? h("div", { class: "card" }, [h("h3", { text: "Copie reprise ✓" }), h("p", { text: `${R.fmt.plural(m.childrenCount, "enfant")} et vos mois retrouvés : la mise en route n'est pas nécessaire.` })])
        : h("div", { class: "card" }, [
          h("h3", { text: "Mettons-le en route ensemble" }),
          h("p", { class: "small muted", text: "5 petites étapes, environ 5 minutes. Tout restera modifiable ensuite." }),
          h("ol", { class: "onb-steps" }, R.ONB_STEPS.map((s) => h("li", { text: s })))
        ]),
      h("div", { class: "onb-foot" }, restored
        ? h("button", { type: "button", class: "btn btn-primary btn-big", text: "Ouvrir l'outil", on: { click: hd.onFinish } })
        : [
          h("button", { type: "button", class: "btn btn-primary btn-big", text: "Commencer", "data-autofocus": "", on: { click: hd.onStart } }),
          h("button", { type: "button", class: "btn btn-quiet", text: "J'ai déjà une copie de secours", on: { click: hd.onRestore } })
        ])
    ]);
  };

  /** Fin : ce qui a été fait, puis le rythme d'utilisation. */
  R.buildOnbDone = function buildOnbDone(m, hd) {
    const rhythm = [["today", "Chaque jour : Aujourd'hui", "Touchez « Arrivée » et « Départ ». L'heure est notée toute seule."],
      ["month", "Chaque mois : Mon mois", "Photographiez la fiche de présence, vérifiez les jours avec elle, recopiez la fiche de paie, touchez « J'ai terminé »."],
      ["year", "Au printemps : Mon année", "Le montant à reporter case 1AJ de votre déclaration."]];
    return h("div", { class: "onb" }, [
      h("h2", { class: "onb-title", text: m.firstName ? `C'est prêt, ${m.firstName} !` : "C'est prêt !" }),
      h("div", { class: "row" }, m.chips.map((c) => h("span", { class: "chip done", text: c }))),
      h("div", { class: "onb-rhythm" }, rhythm.map(([, t, d]) => h("div", { class: "card" }, [h("b", { text: t }), h("span", { class: "small muted", text: d })]))),
      h("p", { class: "small muted", text: "Vous pourrez revoir cette mise en route avec le bouton « ? », et tout modifier dans « Mon profil »." }),
      h("div", { class: "onb-foot" }, h("button", { type: "button", class: "btn btn-primary btn-big", text: "Commencer", on: { click: hd.onFinish } }))
    ]);
  };

  /** Carte « La mise en route vous attend » (onglet Aujourd'hui). */
  R.buildOnbResume = function buildOnbResume(m, hd) {
    return h("div", { class: "card onb-resume" }, [
      h("h3", { text: "La mise en route vous attend" }),
      h("p", { class: "small", text: `Étape ${m.step} sur 5 : ${R.ONB_STEPS[m.step - 1].toLowerCase()}. Ce que vous avez déjà rempli est gardé.` }),
      h("div", { class: "row" }, [
        h("button", { type: "button", class: "btn btn-primary", text: "Reprendre", on: { click: hd.onResume } }),
        h("button", { type: "button", class: "btn btn-quiet", text: "Plus tard", on: { click: hd.onHide } })
      ])
    ]);
  };
})();
