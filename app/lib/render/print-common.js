/* ============================================================================
   render/print-common.js — Socle des documents imprimables
   ----------------------------------------------------------------------------
   Helpers partagés par les gabarits (relevé mensuel, récap annuel) :
   en-tête d'identité, encadré des règles, pied de page, formats.
   Les données passent par textContent — jamais par innerHTML.
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

  const S = window.ABMAT.storage;
  const Compute = window.ABMAT.compute;
  if (!S || !Compute || !Compute.childLabel) {
    throw new Error("render/print-common.js : storage et compute/children.js doivent être chargés avant.");
  }

  R.print = R.print || {};
  const P = R.print;

  P.el = function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };

  // Profil « Mes informations » (storage/profile.js, v2) ; null si jamais renseigné.
  P.getProfile = () => S.loadProfile();

  // Prénom d'un enfant sur le relevé (relais : prénom saisi ce jour-là).
  P.childName = (profile, key, entry) => Compute.childLabel(profile, key, entry);

  P.docHead = function docHead(docType, periodLabel) {
    const profile = P.getProfile();
    const head = P.el("div", "doc-head");

    const who = P.el("div", "doc-who");
    const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "";
    if (fullName) {
      who.appendChild(P.el("strong", null, fullName));
      who.appendChild(P.el("span", null, "Assistante maternelle agréée"));
    } else {
      who.appendChild(P.el("strong", null, "Assistante maternelle agréée"));
    }
    if (profile && profile.employer) who.appendChild(P.el("span", null, `Employeur : ${profile.employer}`));

    const what = P.el("div", "doc-what");
    what.appendChild(P.el("div", "doc-type", docType));
    what.appendChild(P.el("div", "doc-period", periodLabel));

    head.appendChild(who);
    head.appendChild(what);
    return head;
  };

  /** @param {Object} rules {year, smicLabel, forfaitLabel} */
  P.rulesBox = function rulesBox(rules) {
    const box = P.el("div", "doc-rules");
    box.appendChild(P.el("h4", null, "Règles appliquées"));
    box.appendChild(P.el("p", null, `SMIC horaire brut au 01/01/${rules.year} : ${rules.smicLabel}`));
    box.appendChild(P.el("p", null, `Forfait journalier par enfant (garde ≥ 8 h) : ${rules.forfaitLabel} (3 × SMIC)`));
    box.appendChild(P.el("p", null, "Garde < 8 h : forfait × heures ÷ 8, sur le total de la journée"));
    box.appendChild(P.el("p", null, "Article 80 sexies du CGI — fiche service-public F1234"));
    return box;
  };

  P.docFooter = function docFooter(extra) {
    const foot = P.el("div", "doc-foot");
    const mention = `Document d'aide au calcul établi le ${U.formatDateFR(new Date())} — sans valeur justificative.`;
    foot.appendChild(P.el("span", null, extra ? `${mention} ${extra}` : mention));
    return foot;
  };

  // "08:30" -> "8h30" (format français d'affichage)
  function fmtTimeFR(t) {
    if (typeof t !== "string" || !/^\d{2}:\d{2}$/.test(t)) return t || "?";
    return t.replace(/^0/, "").replace(":", "h");
  }

  P.slotLabel = function slotLabel(slot) {
    return `${fmtTimeFR(slot.in)} – ${fmtTimeFR(slot.out)}`;
  };

  P.motifLabel = function motifLabel(motif) {
    if (motif === "malade") return "malade";
    if (motif === "conges") return "congés";
    if (motif === "autre") return "autre";
    return "";
  };
})();
