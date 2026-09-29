/* ============================================================================
   render/month-panel.js — Mon mois : en-tête, 3 étapes, résultat
   ----------------------------------------------------------------------------
   Étapes : 1. vérifier les jours, 2. recopier la fiche de paie, 3. terminer.
   Les montants se tapent comme sur la fiche (« 1 850,40 ») : U.parseMoneyFR.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  const U = window.ABMAT && window.ABMAT.utils;

  if (!R || !R.fmt || !U) {
    throw new Error("render/format.js doit être chargé avant render/month-panel.js.");
  }
  const h = R.h;
  const F = R.fmt;

  R.STATUS_LABELS = { future: "À venir", empty: "Vide", check: "Jours à vérifier", pay: "Fiche de paie à saisir", ready: "Prêt à terminer", done: "Terminé" };

  /**
   * Champ montant avec retour « Compris : … ».
   * @param {{id, label, help, value:number|null, placeholder, unit, describe?:(v)=>{text, warn}}} f
   * @param {(value:number|null)=>void} onValue - à chaque frappe valide (null = vide)
   * @param {()=>void} [onCommit] - quand on quitte le champ
   */
  R.moneyField = function moneyField(f, onValue, onCommit) {
    const describe = f.describe || ((v) => ({ text: `Compris : ${F.euro(v)}`, warn: false }));
    const out = h("span", { class: "parsed", "aria-live": "polite" });
    const show = (v) => { const d = describe(v); out.textContent = d.text; out.classList.toggle("err", d.warn); };
    const input = h("input", {
      id: f.id, type: "text", inputmode: "decimal", autocomplete: "off", placeholder: `ex. ${f.placeholder}`,
      value: f.value === null ? "" : f.value.toFixed(2).replace(".", ","),
      on: {
        input: (e) => {
          const r = U.parseMoneyFR(e.target.value);
          if (r.status === "invalid") { out.textContent = `Montant non compris. Exemple : ${f.placeholder}`; out.classList.add("err"); return; }
          if (r.status === "empty") { out.textContent = ""; out.classList.remove("err"); onValue(null); return; }
          show(r.value);
          onValue(r.value);
        },
        change: () => { if (onCommit) onCommit(); }
      }
    });
    if (f.value !== null) show(f.value);
    return h("div", { class: "field" }, [
      h("label", { htmlFor: f.id, text: f.label }),
      f.help ? h("span", { class: "help", text: f.help }) : null,
      h("div", { class: "money" }, [input, h("span", { "aria-hidden": "true", text: f.unit || "€" })]),
      out
    ]);
  };

  /** Flèches mois précédent / suivant, titre, état du mois. */
  R.buildMonthHead = function buildMonthHead(m, handlers) {
    return h("div", { class: "month-head" }, [
      h("button", { type: "button", class: "nav-btn", "aria-label": "Mois précédent", on: { click: () => handlers.onGo(-1) } }, R.icon("prev")),
      h("h2", { text: `${F.cap(F.monthName(m.monthIndex))} ${m.year}` }),
      h("button", { type: "button", class: "nav-btn", "aria-label": "Mois suivant", on: { click: () => handlers.onGo(1) } }, R.icon("next")),
      h("span", { class: "chip " + m.status, text: R.STATUS_LABELS[m.status] })
    ]);
  };

  function step(n, done, title, text, content) {
    return h("div", { class: "step" + (done ? " is-done" : "") }, [
      h("span", { class: "mk", "aria-hidden": "true", text: done ? "✓" : String(n) }),
      h("div", { class: "body" }, [h("b", { text: title }), text ? h("p", { text }) : null, content])
    ]);
  }

  /**
   * @param {{monthIndex, verified, done, toVerify, payDone, net, irf, canFinish, canReview, askFiche}} m
   *   canReview : il y a des jours passés à vérifier ; askFiche : « Terminer » sans fiche jointe
   * @param {{onVerify, onReview, onMoney:(key, v)=>void, onMoneyCommit, onDone, onDoneAnyway, onAttach}} handlers
   */
  R.buildMonthTodo = function buildMonthTodo(m, handlers) {
    const name = F.monthName(m.monthIndex);
    const verifyText = m.toVerify
      ? `${F.plural(m.toVerify, "jour")} différent${m.toVerify > 1 ? "s" : ""} de d'habitude. Les jours pointés sont déjà justes.`
      : "Aucun jour différent de d'habitude. Les jours pointés sont déjà justes.";
    return h("div", { class: "card" }, [
      h("h3", { text: `À faire pour ${name}` }),
      step(1, m.verified, "Vérifier les jours", m.verified ? verifyText : `${verifyText} Le plus simple : semaine par semaine, la fiche de présence à côté.`,
        h("div", { class: "row" }, m.verified ? [
          h("button", { type: "button", class: "btn", text: "Vérifié ✓", "aria-pressed": "true", on: { click: () => handlers.onVerify(false) } }),
          m.canReview ? h("button", { type: "button", class: "btn btn-quiet", text: "Revérifier avec la fiche", on: { click: handlers.onReview } }) : null
        ] : [
          m.canReview ? h("button", { type: "button", class: "btn btn-primary", text: "Vérifier avec la fiche", on: { click: handlers.onReview } }) : null,
          h("button", { type: "button", class: m.canReview ? "btn btn-quiet" : "btn", text: "J'ai déjà vérifié", on: { click: () => handlers.onVerify(true) } })
        ])),
      step(2, m.payDone, "Recopier la fiche de paie", `La fiche de paie versée en ${name}.`, [
        R.moneyField({ id: "f-net", label: "Net imposable", help: "Ligne « Net imposable » (pas la somme virée)", value: m.net > 0 ? m.net : null, placeholder: "1 850,40" },
          (v) => handlers.onMoney("netImposable", v), handlers.onMoneyCommit),
        R.moneyField({ id: "f-irf", label: "Indemnités d'entretien et de repas", help: "Pas d'indemnités ? Écrivez 0.", value: (m.irf > 0 || m.payDone) ? m.irf : null, placeholder: "199,50" },
          (v) => handlers.onMoney("irf", v), handlers.onMoneyCommit)
      ]),
      step(3, m.done, "Terminer le mois", m.done ? "Mois terminé. Vous pouvez encore le corriger." : "Une copie de secours vous est proposée au passage.",
        m.askFiche ? [
          h("p", { class: "warn-line", text: "La fiche de présence n'est pas jointe. Elle sert de justificatif : elle est imprimée avec le mois dans le dossier." }),
          h("div", { class: "row" }, [
            h("button", { type: "button", class: "btn btn-primary", on: { click: handlers.onAttach } }, [R.icon("camera"), "Joindre la fiche"]),
            h("button", { type: "button", class: "btn btn-quiet", text: "Terminer quand même", on: { click: handlers.onDoneAnyway } })
          ])
        ] : h("div", null, h("button", { type: "button", class: "btn btn-primary", text: m.done ? "Terminé ✓" : `J'ai terminé ${name}`, disabled: !m.canFinish, on: { click: handlers.onDone } })))
    ]);
  };

  /**
   * @param {{monthIndex, year, abatt, percu, apres, payDone, smicMissing}} m
   * @param {{onPrint, onPrepareYear}} handlers
   */
  R.buildMonthResult = function buildMonthResult(m, handlers) {
    const name = F.monthName(m.monthIndex);
    return h("div", { class: "card" }, [
      h("h3", { text: `Résultat de ${name}` }),
      m.smicMissing ? h("p", { class: "warn-line" }, [
        `Le SMIC de ${m.year} n'est pas encore réglé : l'abattement ne peut pas être calculé. `,
        h("button", { type: "button", class: "btn btn-quiet", text: `Préparer ${m.year}`, on: { click: handlers.onPrepareYear } })
      ]) : null,
      m.payDone ? [
        h("div", { class: "big num", text: F.euro(m.apres) }),
        h("p", { class: "small muted", text: m.apres < 0
          ? "L'abattement dépasse ce que vous avez perçu ce mois-ci : la différence se déduit des autres mois. Rien à déclarer maintenant."
          : "comptent dans votre revenu de l'année. Rien à déclarer maintenant : le total vous attend dans « Mon année »." })
      ] : h("p", { class: "small muted", text: "Recopiez la fiche de paie pour voir ce que ce mois ajoute à votre revenu." }),
      h("dl", { class: "kv num" }, [
        h("dt", { text: "Abattement du mois" }), h("dd", { text: F.euro(m.abatt) }),
        m.payDone ? [h("dt", { text: "Perçu (salaire + indemnités)" }), h("dd", { text: F.euro(m.percu) })] : null
      ]),
      h("div", null, h("button", { type: "button", class: "btn", on: { click: handlers.onPrint } }, [R.icon("print"), "Imprimer ce mois"]))
    ]);
  };
})();
