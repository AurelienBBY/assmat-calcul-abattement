/* ============================================================================
   render/erase-all.js — Fenêtre « Tout effacer sur cet appareil »
   ----------------------------------------------------------------------------
   Deux temps : ce qui sera effacé (et ce qui ne l'est pas : la copie de
   secours), avec « Envoyer ma copie d'abord » si elle n'est pas à jour ;
   puis la confirmation, sans retour possible.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.fmt) {
    throw new Error("render/format.js doit être chargé avant render/erase-all.js.");
  }
  const h = R.h;
  const F = R.fmt;

  function warning(m) {
    if (m.warn === "never") return m.manual ? "Vous n'avez encore jamais envoyé de copie de secours : tout sera perdu." : "Aucune copie de secours n'est activée sur cet ordinateur : tout sera perdu.";
    if (m.warn === "pending") {
      return m.pendingDays
        ? `${F.cap(F.plural(m.pendingDays, "jour"))} pas encore envoyé${m.pendingDays > 1 ? "s" : ""} dans votre copie : envoyez-la d'abord si vous voulez pouvoir les retrouver.`
        : "Des modifications ne sont pas encore dans votre copie : envoyez-la d'abord si vous voulez pouvoir les retrouver.";
    }
    return null;
  }

  /**
   * @param {{step:"explain"|"confirm"|"working", manual:boolean, warn:null|"never"|"pending", pendingDays:number}} m
   * @param {{onBackup, onContinue, onCancel, onErase}} hd
   * @returns {Node[]}
   */
  R.buildEraseAll = function buildEraseAll(m, hd) {
    if (m.step === "working") return [h("p", { text: "Effacement en cours…" })];
    if (m.step === "confirm") {
      return [
        h("p", null, h("b", { text: "Effacer définitivement tout ce qui est sur cet appareil ?" })),
        h("p", { class: "small", text: "Ce n'est pas annulable. L'outil repartira de zéro, avec la mise en route." }),
        h("div", { class: "row" }, [
          h("button", { type: "button", class: "btn btn-danger", text: "Oui, tout effacer", on: { click: hd.onErase } }),
          h("button", { type: "button", class: "btn", text: "Annuler", on: { click: hd.onCancel } })
        ])
      ];
    }
    const warn = warning(m);
    return [
      h("p", { text: "Tout ce qui est enregistré sur cet appareil sera supprimé : votre profil, les enfants, tous les mois et leurs fiches de paie, les réglages des années et les photos des fiches de présence." }),
      h("p", { class: "small muted", text: m.manual
        ? "Votre copie de secours (le fichier dans iCloud Drive) n'est pas touchée : « Reprendre la copie » ramènerait tout. Pour repartir vraiment de zéro, supprimez-la aussi dans l'app Fichiers."
        : "Le dossier de copie est oublié, mais les fichiers qu'il contient ne sont pas touchés : « Reprendre la copie » ramènerait tout. Pour repartir vraiment de zéro, supprimez-les aussi." }),
      warn ? h("p", { class: "warn-line", text: warn }) : null,
      warn ? h("div", null, h("button", { type: "button", class: "btn btn-primary", text: m.manual ? "Envoyer ma copie d'abord" : "Choisir le dossier de copie d'abord", on: { click: hd.onBackup } })) : null,
      h("div", { class: "row" }, [
        h("button", { type: "button", class: "btn", text: "Continuer", on: { click: hd.onContinue } }),
        h("button", { type: "button", class: "btn btn-quiet", text: "Annuler", on: { click: hd.onCancel } })
      ])
    ];
  };
})();
