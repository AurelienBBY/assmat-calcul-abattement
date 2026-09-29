/* ============================================================================
   render/onb-steps.js — Mise en route : étapes 1, 3, 4 et 5
   ----------------------------------------------------------------------------
   Vous (identité des documents imprimés), l'année (SMIC du 1er janvier déjà
   connu, accueil relais), les mois passés (remplis avec les horaires
   habituels), la copie de secours (premier envoi, ou dossier sur ordinateur).
   Chaque fonction renvoie le contenu de l'étape ; le cadre est dans
   render/onboarding.js.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.moneyField || !R.buildOnbFrame) {
    throw new Error("render/month-panel.js et render/onboarding.js doivent être chargés avant render/onb-steps.js.");
  }
  const h = R.h;
  const F = R.fmt;

  const text = (id, label, value, onCommit, help) => h("div", { class: "field" }, [
    h("label", { htmlFor: id, text: label }), help ? h("span", { class: "help", text: help }) : null,
    h("input", { type: "text", id, value, autocomplete: "off", on: { change: (e) => onCommit(e.target.value) } })
  ]);

  const choice = (name, value, checked, title, detail, onPick, more) => h("label", { class: "choice" }, [
    h("input", { type: "radio", name, value, checked, on: { change: () => onPick(value) } }),
    h("span", null, [h("b", { text: title }), h("span", { class: "small muted", text: detail }), more || null])
  ]);

  /** Étape 1 : prénom, nom, employeur (enregistrés en quittant chaque champ). */
  R.buildOnbMe = function buildOnbMe(m, hd) {
    return [
      text("onb-first", "Prénom", m.firstName, (v) => hd.onIdentity("firstName", v)),
      text("onb-last", "Nom", m.lastName, (v) => hd.onIdentity("lastName", v)),
      text("onb-emp", "Employeur", m.employer, (v) => hd.onIdentity("employer", v), "Par exemple : CCAS de votre ville")
    ];
  };

  /**
   * Étape 3 : SMIC du 1er janvier (confirmé d'un geste, ou corrigé) et accueil relais.
   * @param {{year, known:number|null, fix:boolean, smic:number|null, relais:boolean, forfaitOf:(v)=>number}} m
   */
  R.buildOnbYear = function buildOnbYear(m, hd) {
    const perDay = (v) => `Soit ${F.euro(m.forfaitOf(v))} par enfant pour une journée de 8 h ou plus, ${F.euro(m.forfaitOf(v) / 8)} par heure en dessous.`;
    const describe = (v) => {
      const odd = (v < 10 || v > 16) ? " Vérifiez le chiffre : le SMIC horaire brut est proche de 12 €." : "";
      return { text: `Compris : ${F.euro(v)} de l'heure. ${perDay(v)}${odd}`, warn: Boolean(odd) };
    };
    const field = R.moneyField({ id: "onb-smic", label: "SMIC horaire brut au 1er janvier", value: m.smic, placeholder: "12,02", unit: "€ / heure", describe }, hd.onSmic);
    const smicCard = m.known === null
      ? h("div", { class: "card" }, [h("h3", { text: `Le SMIC au 1er janvier ${m.year}` }),
        h("p", { class: "small muted", text: "C'est lui qui fixe l'abattement de toute l'année. Il est publié fin décembre sur service-public.fr." }), field])
      : h("div", { class: "card" }, [
        h("h3", { text: `Le SMIC au 1er janvier ${m.year}` }),
        h("p", { class: "small muted", text: "C'est lui qui fixe l'abattement de toute l'année, même s'il augmente en cours d'année. L'outil le connaît déjà." }),
        h("p", { class: "big num" }, [F.euro(m.known), " ", h("span", { class: "small muted", text: "de l'heure" })]),
        choice("onb-smic-ok", "yes", !m.fix, "C'est bien celui-là", "Cas le plus courant.", () => hd.onFix(false)),
        choice("onb-smic-ok", "no", m.fix, "Je le corrige", "Seulement si service-public.fr indique autre chose.", () => hd.onFix(true)),
        m.fix ? field : h("p", { class: "parsed", text: perDay(m.known) })
      ]);
    return [smicCard, h("div", { class: "card" }, [
      h("h3", { text: "L'accueil relais" }),
      h("label", { class: "check", htmlFor: "onb-relais" }, [
        h("input", { type: "checkbox", id: "onb-relais", checked: m.relais, on: { change: (e) => hd.onRelais(e.target.checked) } }),
        h("span", null, [`Je fais de l'accueil relais en ${m.year}`, h("br"), h("span", { class: "small muted", text: "Un bouton « + Enfant en accueil relais » apparaîtra dans la journée." })])
      ])
    ])];
  };

  /**
   * Étape 4 : remplir les mois passés avec les horaires habituels.
   * @param {{todayText, names, cur:number, choice:"jan"|"from"|"cur"|"none", from:number,
   *   summary:{months:number, days:number, extras:string[]}|null}} m
   */
  R.buildOnbPast = function buildOnbPast(m, hd) {
    const curName = F.monthName(m.cur);
    const select = h("select", { id: "onb-from", "aria-label": "Premier mois à remplir", on: { change: (e) => hd.onFrom(Number(e.target.value)) } },
      F.MONTHS.slice(1, m.cur).map((name, i) => h("option", { value: String(i + 1), selected: m.from === i + 1, text: F.cap(name) })));
    const options = (m.cur > 0 ? [
      ["jan", "Depuis janvier", `Janvier à ${curName}.`],
      m.cur > 1 ? ["from", "Depuis un autre mois", "Par exemple le mois où vous avez commencé."] : null,
      ["cur", `Seulement ${curName}`, "Vous saisirez les mois passés plus tard."]
    ] : [["cur", `${F.cap(curName)}`, "Le mois en cours."]]).filter(Boolean).concat([["none", "Rien pour l'instant", "Vous remplirez chaque mois vous-même."]]);
    const s = m.summary;
    return [
      h("p", { class: "muted", text: `Nous sommes le ${m.todayText}. L'outil peut remplir les mois avec les horaires habituels de ${m.names}, chacun seulement quand il était là. Vous corrigerez ensuite ce qui a changé : congés, absences. Les jours fériés sont déjà exclus.` }),
      options.map(([v, t, d]) => choice("onb-past", v, m.choice === v, t, d, hd.onChoice, v === "from" && m.choice === "from" ? h("span", { class: "onb-sel" }, select) : null)),
      s && s.months ? h("p", { class: "note ok", text: `${F.plural(s.months, "mois", "mois")} à remplir, ${F.plural(s.days, "journée")} de travail préparée${s.days > 1 ? "s" : ""}${s.extras.length ? `, dont ${s.extras.join(", ")}` : ""}.` }) : null,
      s && !s.months && m.choice !== "none" ? h("p", { class: "note", text: "Ces mois sont déjà remplis : rien ne sera écrasé." }) : null,
      s && s.months ? h("p", { class: "note", text: "Pour vérifier chaque mois, photographiez la fiche de présence dans « Mon mois » : elle s'affiche à côté des journées. Les fiches de paie se recopient au même endroit." }) : null
    ];
  };

  /**
   * Étape 5 : la copie de secours.
   * @param {{manual:boolean, state:"todo"|"done"|"later"}} m
   */
  R.buildOnbBackup = function buildOnbBackup(m) {
    if (m.manual) {
      return [
        h("p", { class: "muted", text: "Une copie de vos saisies, rangée dans iCloud Drive : vous ne perdez rien si le téléphone se perd, et vous retrouvez tout sur l'ordinateur." }),
        h("div", { class: "card" }, [h("h3", { text: "Ce que vous allez faire" }), h("ol", { class: "onb-steps" }, [
          h("li", { text: "Touchez « Envoyer ma copie », puis « Envoyer »." }),
          h("li", null, ["Choisissez ", h("b", { text: "Enregistrer dans Fichiers" }), "."]),
          h("li", null, ["Dans ", h("b", { text: "iCloud Drive" }), ", créez le dossier ", h("b", { text: "Abattement" }), "."]),
          h("li", null, ["Touchez ", h("b", { text: "Enregistrer" }), "."])
        ])]),
        m.state === "done" ? h("p", { class: "note ok", text: "Copie envoyée. Pensez à la renvoyer de temps en temps : l'outil vous le rappellera." }) : null,
        m.state === "later" ? h("p", { class: "note warn", text: "D'accord. L'outil vous le reproposera quand vous terminerez votre premier mois." }) : null
      ];
    }
    return [
      h("p", { class: "muted", text: "Choisissez une fois le dossier où ranger la copie. Ensuite, elle s'enregistre toute seule à chaque modification, et l'ordinateur reprend ce que vous avez saisi sur le téléphone." }),
      h("div", { class: "card" }, [h("h3", { text: "Le bon dossier" }),
        h("p", { class: "small", text: "Le dossier « Abattement » de votre iCloud Drive, le même que sur l'iPhone. Sur Windows, installez d'abord « iCloud pour Windows »." })]),
      m.state === "done" ? h("p", { class: "note ok", text: "Dossier choisi : la copie s'enregistre toute seule." }) : null,
      m.state === "later" ? h("p", { class: "note warn", text: "D'accord. La pastille « Activer la copie de secours » restera visible en haut de l'écran." }) : null
    ];
  };
})();
