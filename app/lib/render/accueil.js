/* ============================================================================
   render/accueil.js — Écran d'accueil (bienvenue + raccourcis)
   ----------------------------------------------------------------------------
   Rôle :
   - Message de bienvenue (toujours) + invitation adaptée à l'état du profil
   - 3 raccourcis contextuels (continuer le mois / récap / mes informations)
   Le tutoriel et l'explication des règles restent des blocs HTML statiques
   dans index.html (section Accueil), inchangés — ce module ne rend que la
   partie dynamique (bienvenue + raccourcis).
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

  const ICONS = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17h.01M12 13a2 2 0 1 0-2-2"/><circle cx="12" cy="12" r="9"/></svg>'
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function quickCard(opts) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quick" + (opts.featured ? " quick--featured" : "") + (opts.muted ? " quick--muted" : "");

    if (opts.featured) btn.appendChild(el("span", "quick__badge", "Commencez ici"));

    const icon = el("span", "quick__icon");
    icon.innerHTML = ICONS[opts.icon] || "";
    btn.appendChild(icon);
    btn.appendChild(el("span", "quick__title", opts.title));
    btn.appendChild(el("span", "quick__hint", opts.hint));

    if (opts.muted) {
      btn.disabled = true;
    } else if (typeof opts.onClick === "function") {
      btn.addEventListener("click", opts.onClick);
    }
    return btn;
  }

  /**
   * @param {HTMLElement} container
   * @param {Object} ctx {
   *   userName, profileEmpty,
   *   currentMonthLabel, currentDaysFilled, currentDaysTotal,
   *   yearLabel, yearImposableToDate, childrenActiveCount
   * }
   * @param {{onGoMonth:()=>void, onGoRecap:()=>void, onGoInfos:()=>void, onOpenTuto:()=>void}} handlers
   */
  R.renderAccueil = function renderAccueil(container, ctx, handlers) {
    if (!container) return;
    container.innerHTML = "";

    // --- Bienvenue (toujours affiché, avant toute invitation à agir) --------
    const welcome = el("div", "card glass hero-home");
    welcome.appendChild(el("div", "eyebrow", "👋 Bienvenue"));
    welcome.appendChild(el("h1", null, "Abattement Ass-Mat"));
    welcome.appendChild(el("p", null,
      "L'outil qui calcule votre abattement fiscal d'assistante maternelle, mois par mois, " +
      "à partir de vos heures de présence réelles. Tout reste sur votre ordinateur : rien n'est jamais envoyé ailleurs."
    ));
    container.appendChild(welcome);

    // --- Raccourcis (adaptés à l'état du profil) -----------------------------
    const quick = el("div", "card glass hero-home");
    quick.appendChild(el("div", "eyebrow", ctx.profileEmpty ? "Pour commencer" : (ctx.userName ? `Bonjour ${ctx.userName}` : "Bonjour")));
    quick.appendChild(el("h2", null, ctx.profileEmpty ? "Configurons votre profil" : "Que voulez-vous faire ?"));

    const sub = el("p", "sub");
    sub.textContent = ctx.profileEmpty
      ? "Votre nom, votre employeur, vos enfants et leurs semaines types — 5 minutes, à faire une seule fois."
      : "Le tutoriel et les règles ne se répètent plus à chaque mois — ils vivent ici, une seule fois.";
    quick.appendChild(sub);

    const grid = el("div", "quick-grid");

    if (ctx.profileEmpty) {
      grid.appendChild(quickCard({
        featured: true, icon: "user",
        title: "Renseigner mes informations",
        hint: "Identité, enfants, semaines types",
        onClick: handlers.onGoInfos
      }));
      grid.appendChild(quickCard({
        muted: true, icon: "plus",
        title: "Commencer la saisie",
        hint: "Disponible une fois le profil rempli"
      }));
      grid.appendChild(quickCard({
        icon: "book",
        title: "Voir le tutoriel",
        hint: "Comment fonctionne l'outil",
        onClick: handlers.onOpenTuto
      }));
    } else {
      grid.appendChild(quickCard({
        featured: true, icon: "plus",
        title: `Continuer ${ctx.currentMonthLabel}`,
        hint: `${ctx.currentDaysFilled} jour${ctx.currentDaysFilled > 1 ? "s" : ""} saisi${ctx.currentDaysFilled > 1 ? "s" : ""} sur ${ctx.currentDaysTotal}`,
        onClick: handlers.onGoMonth
      }));
      grid.appendChild(quickCard({
        icon: "chart",
        title: `Voir le récap ${ctx.yearLabel}`,
        hint: `Total à date : ${U.fmtEuro(ctx.yearImposableToDate)}`,
        onClick: handlers.onGoRecap
      }));
      grid.appendChild(quickCard({
        icon: "user",
        title: "Mes informations",
        hint: `${ctx.childrenActiveCount} enfant${ctx.childrenActiveCount > 1 ? "s" : ""} actif${ctx.childrenActiveCount > 1 ? "s" : ""}`,
        onClick: handlers.onGoInfos
      }));
    }

    quick.appendChild(grid);
    container.appendChild(quick);
  };
})();
