/* ============================================================================
   render/onboarding.js — Écran d'accueil : "comment ça marche"
   ----------------------------------------------------------------------------
   Explique l'enchaînement des 3 piliers de travail (Mes informations →
   Déclaration → Ma déclaration), dans l'ordre où on s'en sert. Remplace
   l'ancien encart "tuto" (liste à puces générique). L'étape 1 est mise en
   avant seulement tant que le profil est vide (seule action possible à ce
   stade) ; ensuite, les 3 étapes restent affichées à égalité — l'écran
   Accueil n'étant visité qu'occasionnellement, pas besoin de le condenser.
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

  // Mêmes icônes que les raccourcis d'Accueil (accueil.js) — une icône = un
  // sens partout dans l'app.
  const ICONS = {
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function arrow() {
    const span = el("span", "onb-arrow");
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = ICONS.arrow;
    return span;
  }

  function step(n, icon, pillarName, phase, text, current) {
    const card = el("div", "onb-step glass" + (current ? " onb-current" : ""));
    card.appendChild(el("span", "num", String(n)));

    const iconEl = el("span", "icon");
    iconEl.innerHTML = ICONS[icon] || "";
    card.appendChild(iconEl);

    card.appendChild(el("span", "pillar-name", pillarName));
    card.appendChild(el("h4", null, phase));
    card.appendChild(el("p", null, text));
    return card;
  }

  /**
   * @param {HTMLElement} container
   * @param {Object} ctx {profileEmpty} — cf. computeAccueilContext() dans app.js
   */
  R.renderOnboarding = function renderOnboarding(container, ctx) {
    if (!container) return;
    container.innerHTML = "";

    const card = el("div", "card glass hero-home");
    card.appendChild(el("div", "eyebrow", "Comment ça marche"));
    card.appendChild(el("h2", null, "Trois destinations, dans l'ordre"));
    card.appendChild(el("p", "sub", "Chacune correspond à un onglet en haut de l'écran."));

    const flow = el("div", "onb-flow");
    flow.appendChild(step(
      1, "user", "Mes informations", "Commencez ici",
      "Votre nom, vos enfants, leurs semaines types — une seule fois, 5 minutes. Ça personnalise toute la suite.",
      !!(ctx && ctx.profileEmpty)
    ));
    flow.appendChild(arrow());
    flow.appendChild(step(
      2, "plus", "Déclaration", "Chaque mois",
      "Saisissez les heures de présence réelles et la fiche de paie. L'abattement se calcule tout seul."
    ));
    flow.appendChild(arrow());
    flow.appendChild(step(
      3, "chart", "Ma déclaration", "En fin d'année",
      "Récupérez le total à reporter sur votre déclaration, et imprimez le dossier complet à classer."
    ));
    card.appendChild(flow);

    // [data-open-tuto] : ouverture gérée par délégation dans initTutoModal()
    // (app.js) — cette carte est recréée à chaque affichage d'Accueil, une
    // liaison directe ici serait perdue au rendu suivant.
    const actions = el("div", "tuto-actions");
    const btn = el("button", "btn-secondary", "Voir les points d'attention");
    btn.type = "button";
    btn.setAttribute("data-open-tuto", "");
    actions.appendChild(btn);
    card.appendChild(actions);

    container.appendChild(card);
  };
})();
