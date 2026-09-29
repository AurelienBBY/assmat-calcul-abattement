/* ============================================================================
   app/ctrl/shell.js — Coque : onglets, rendu, bulles d'aide
   ----------------------------------------------------------------------------
   A.go(onglet) change d'onglet, A.render() redessine l'écran courant :
   la mise en route (plein écran) si elle est ouverte, sinon l'onglet, avec
   sa bulle d'aide tant qu'elle n'a pas été lue (« Compris »). Le champ qui
   avait le focus le retrouve.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const S = window.ABMAT.storage;

  if (!A || !R.buildTip || !S.tipSeen) {
    throw new Error("app/ctrl/ctx.js, render/tip.js et storage/device.js doivent être chargés avant app/ctrl/shell.js.");
  }

  const TABS = ["today", "month", "year", "profile"];

  A.go = function go(tab, opts) {
    if (!TABS.includes(tab)) throw new Error(`A.go : onglet inconnu « ${tab} ».`);
    Object.assign(A.state, opts || {}, { tab });
    if (tab !== "month") A.state.review = null;
    document.querySelectorAll("[data-tab]").forEach((b) => {
      if (b.dataset.tab === tab) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    A.render();
    window.scrollTo(0, 0);
  };

  // Pas de bulle tant qu'une mise en route commencée n'est pas terminée
  // (la carte « La mise en route vous attend » passe avant).
  function tip(tab) {
    const ob = S.loadOnboarding();
    if (S.tipSeen(tab) || (ob.step > 0 && !ob.done)) return null;
    return R.buildTip(tab, () => { S.markTipSeen(tab); A.render(); });
  }

  /** Redessine l'écran courant ; le champ qui avait le focus le retrouve. */
  A.render = function render() {
    const main = document.getElementById("main");
    const focusId = document.activeElement && main.contains(document.activeElement) ? document.activeElement.id : "";
    const st = A.state;
    const review = Boolean(st.review && st.tab === "month");
    R.clear(main);
    // Mise en route et vérification du mois : plein écran, sans les onglets.
    document.body.classList.toggle("is-focus", st.onboarding || review);
    if (st.onboarding) {
      A.renderOnboarding(main);
    } else {
      if (st.banner) main.appendChild(A.backup.buildBanner(st.banner));
      if (!review) R.append(main, tip(st.tab));
      A.views[st.tab].render(main);
    }
    A.backup.refreshPill();
    const again = focusId ? document.getElementById(focusId) : null;
    if (again) again.focus({ preventScroll: true });
  };
})();
