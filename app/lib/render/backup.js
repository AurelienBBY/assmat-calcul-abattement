/* ============================================================================
   render/backup.js — Copie de secours : pastille, fenêtres, bandeau, carte
   ----------------------------------------------------------------------------
   Ordinateur : copie automatique dans un dossier (iCloud Drive / OneDrive).
   iPhone : deux gestes guidés, « Envoyer ma copie » (partage → Fichiers →
   iCloud Drive) et « Reprendre la copie » (fusion, rien n'est effacé).
   info = { manual, pendingDays, pendingAny, lastSentAt, lastImportAt, autoStatus, firstName }
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.fmt) {
    throw new Error("render/format.js doit être chargé avant render/backup.js.");
  }
  const h = R.h;
  const F = R.fmt;

  const when = (iso) => (iso ? F.dateLong(iso.slice(0, 10)) : "jamais");
  const pendingText = (i) => (i.pendingDays ? F.plural(i.pendingDays, "jour") : "des modifications");
  const btn = (text, onClick, primary) => h("button", { type: "button", class: "btn" + (primary ? " btn-primary" : ""), text, on: { click: onClick } });

  /** Pastille de l'en-tête : [libellé ordinateur, libellé iPhone, alerte ?]. */
  R.backupPillText = function backupPillText(i) {
    if (i.manual) {
      if (i.pendingAny) return [i.pendingDays ? `${F.plural(i.pendingDays, "jour")} à envoyer` : "Copie à envoyer", i.pendingDays ? `${i.pendingDays} j. à envoyer` : "À envoyer", true];
      return [i.lastSentAt ? "Copie envoyée" : "Copie de secours", i.lastSentAt ? "À jour" : "Copie", false];
    }
    if (i.autoStatus === "unconfigured") return ["Activer la copie de secours", "Activer", true];
    if (i.autoStatus === "permission") return ["Réactiver la copie de secours", "Réactiver", true];
    if (i.autoStatus === "error") return ["Copie de secours en erreur", "Erreur", true];
    return ["Copie de secours à jour", "À jour", false];
  };

  const AUTO_TEXT = {
    unconfigured: "Choisissez une fois le dossier iCloud Drive (ou OneDrive) où ranger la copie : ensuite, elle s'enregistre toute seule à chaque modification.",
    permission: "Le navigateur demande de confirmer l'accès au dossier de la copie.",
    error: "La dernière copie n'a pas pu s'écrire dans le dossier. Vérifiez qu'il existe toujours, ou choisissez-en un autre.",
    ok: "La copie s'enregistre toute seule dans votre dossier à chaque modification, et l'outil la relit à l'ouverture pour reprendre ce qui a été saisi sur le téléphone."
  };

  function autoBody(i, hd) {
    const status = AUTO_TEXT[i.autoStatus] ? i.autoStatus : "ok";
    return [
      h("p", { text: AUTO_TEXT[status] }),
      h("div", { class: "row" }, btn(status === "ok" ? "Changer de dossier" : (status === "permission" ? "Réactiver la copie" : "Choisir le dossier"), hd.onChooseFolder, status !== "ok")),
      h("hr", { class: "hr" }),
      h("p", { class: "small muted", text: "Autres gestes, à la main :" }),
      h("div", { class: "row" }, [btn("Enregistrer une copie (fichier)", hd.onDownload), btn("Reprendre une copie (fichier)", hd.onImport)])
    ];
  }

  function manualBody(i, hd) {
    return [
      h("dl", { class: "kv" }, [h("dt", { text: "Dernière copie envoyée" }), h("dd", { text: when(i.lastSentAt) }),
        h("dt", { text: "Saisi depuis sur cet appareil" }), h("dd", { text: i.pendingAny ? pendingText(i) : "rien" })]),
      h("div", { class: "row" }, btn("Envoyer ma copie", hd.onSend, true)),
      h("p", { class: "small muted", text: "Pour retrouver sur l'ordinateur ce que vous avez saisi ici, et ne rien perdre si le téléphone se perd." }),
      h("hr", { class: "hr" }),
      h("dl", { class: "kv" }, [h("dt", { text: "Dernière reprise de l'ordinateur" }), h("dd", { text: when(i.lastImportAt) })]),
      h("div", { class: "row" }, btn("Reprendre la copie de l'ordinateur", hd.onImport)),
      h("p", { class: "small muted", text: "À faire si vous avez saisi quelque chose sur l'ordinateur. Rien n'est effacé : l'outil ajoute ce qui manque et garde la version la plus récente de chaque mois." })
    ];
  }

  /**
   * Contenu d'une fenêtre de copie de secours.
   * @param {"menu"|"import"|"send-old"|"send-month"|"send-day"|"sending"} kind
   * @returns {{title:string, body:Node[]}}
   */
  R.buildBackupSheet = function buildBackupSheet(kind, i, hd) {
    const hello = i.firstName ? `Bonjour ${i.firstName}` : "Bonjour";
    const sendLater = h("div", { class: "row" }, [btn("Envoyer ma copie", hd.onSend, true), btn("Plus tard", hd.onLater)]);
    switch (kind) {
      case "menu": return { title: "Copie de secours", body: i.manual ? manualBody(i, hd) : autoBody(i, hd) };
      case "import": return { title: hello, body: [
        h("p", { text: `Avez-vous saisi quelque chose sur l'ordinateur depuis le ${when(i.lastImportAt)} ?` }),
        h("div", { class: "row" }, [btn("Oui, reprendre la copie", hd.onImport, true), btn("Non, rien de nouveau", hd.onNoNew)]),
        h("p", { class: "small muted", text: "Reprendre la copie ajoute sur ce téléphone ce qui manque, sans rien effacer." })] };
      case "send-old": case "send-day": return { title: i.lastSentAt ? `Votre copie date du ${when(i.lastSentAt)}` : "Pensez à votre copie de secours", body: [
        h("p", { text: `Ce que vous avez saisi (${pendingText(i)}) n'existe que sur ce téléphone.` }),
        h("p", { class: "small muted", text: "Envoyez la copie dans iCloud pour la retrouver sur l'ordinateur, et ne rien perdre si le téléphone se perd." }), sendLater] };
      case "send-month": return { title: `${i.monthName} est terminé ✓`, body: [
        h("p", { text: `C'est le bon moment pour envoyer votre copie : vous retrouverez ${i.monthName.toLowerCase()} sur l'ordinateur.` }), sendLater] };
      case "sending": return { title: "Envoyer ma copie", body: [
        h("ol", { class: "ios-steps" }, [
          h("li", null, ["Touchez ", h("b", { text: "Envoyer" }), " : la fenêtre de partage de l'iPhone s'ouvre."]),
          h("li", null, ["Choisissez ", h("b", { text: "Enregistrer dans Fichiers" }), "."]),
          h("li", null, ["Choisissez ", h("b", { text: "iCloud Drive" }), ", puis le dossier ", h("b", { text: "Abattement" }), "."]),
          h("li", null, ["Touchez ", h("b", { text: "Enregistrer" }), ". Si l'iPhone le demande, choisissez ", h("b", { text: "Remplacer" }), "."])
        ]),
        h("div", { class: "row" }, [
          h("button", { type: "button", class: "btn btn-primary", text: i.preparing ? "Préparation de la copie…" : "Envoyer", disabled: i.preparing, on: { click: hd.onShare } }),
          btn("Annuler", R.closeSheet)
        ])] };
      default: throw new Error(`R.buildBackupSheet : fenêtre inconnue « ${kind} ».`);
    }
  };

  /** Bandeau non bloquant (un enfant est là : pas de fenêtre). */
  R.buildBackupBanner = function buildBackupBanner(kind, i, hd) {
    const ask = kind === "import";
    return h("div", { class: "card banner" }, [
      h("b", { text: ask ? `Avez-vous saisi quelque chose sur l'ordinateur depuis le ${when(i.lastImportAt)} ?` : `Pensez à envoyer votre copie de secours (${pendingText(i)}).` }),
      h("p", { class: "small", text: "Un enfant est là : on ne vous interrompt pas. Répondez quand vous avez une minute." }),
      h("div", { class: "row" }, ask ? [btn("Oui, reprendre la copie", hd.onImport, true), btn("Non", hd.onNoNew)] : [btn("Envoyer ma copie", hd.onSend, true), btn("Plus tard", hd.onLater)])
    ]);
  };

  /** Carte de « Mon profil ». */
  R.buildBackupCard = function buildBackupCard(i, hd) {
    return h("div", { class: "card" }, [h("h3", { text: "Copie de secours" }), i.manual ? manualBody(i, hd) : autoBody(i, hd)]);
  };
})();
