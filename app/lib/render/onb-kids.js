/* ============================================================================
   render/onb-kids.js — Mise en route, étape 2 : les enfants
   ----------------------------------------------------------------------------
   Les enfants d'aujourd'hui, puis (à partir de février) ceux partis depuis
   janvier. Formulaire : prénom, arrivée, jours d'un toucher, mêmes horaires
   ou par jour, « ses horaires ont changé » (anciens horaires), départ.
   Le formulaire (compute/onboarding.js) est modifié par les handlers ; rien
   n'est lu dans le DOM au moment d'enregistrer.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.fmt) {
    throw new Error("render/format.js doit être chargé avant render/onb-kids.js.");
  }
  const h = R.h;
  const F = R.fmt;
  const WEEKDAYS = [1, 2, 3, 4, 5];

  const dateField = (id, label, value, onChange, help) => h("div", { class: "field" }, [
    h("label", { htmlFor: id, text: label }), help ? h("span", { class: "help", text: help }) : null,
    h("input", { type: "date", id, value, on: { change: (e) => onChange(e.target.value) } })
  ]);
  const times = (id, a, b, onA, onB, label) => h("div", { class: "onb-times" }, [
    h("input", { type: "time", id: `${id}-a`, value: a, "aria-label": `${label}, arrivée`, on: { change: (e) => onA(e.target.value) } }),
    h("span", { "aria-hidden": "true", text: "→" }),
    h("input", { type: "time", id: `${id}-b`, value: b, "aria-label": `${label}, départ`, on: { change: (e) => onB(e.target.value) } })
  ]);
  const check = (id, checked, text, onChange) => h("label", { class: "check", htmlFor: id }, [
    h("input", { type: "checkbox", id, checked, on: { change: (e) => onChange(e.target.checked) } }), h("span", { text })
  ]);

  function hours(f, hd) {
    if (!f.days.length) return h("p", { class: "small muted", text: "Choisissez d'abord ses jours." });
    if (f.same) return times("onb-h", f.a, f.b, (v) => hd.onField("a", v), (v) => hd.onField("b", v), "Tous les jours");
    return h("div", { class: "onb-perday" }, f.days.map((d) => [
      h("span", { text: F.cap(F.DAYS[d]) }),
      times(`onb-h${d}`, (f.per[d] || {}).a || "", (f.per[d] || {}).b || "", (v) => hd.onPer(d, "a", v), (v) => hd.onPer(d, "b", v), F.DAYS[d])
    ]));
  }

  /** @param {{form, error, editing, canCancel, changeLabel:string|null}} m */
  function kidForm(m, hd) {
    const f = m.form;
    return h("div", { class: "card onb-form" }, [
      h("div", { class: "field" }, [h("label", { htmlFor: "onb-name", text: "Prénom de l'enfant" }),
        h("input", { type: "text", id: "onb-name", value: f.name, autocomplete: "off", on: { input: (e) => hd.onField("name", e.target.value) } })]),
      dateField("onb-from", f.before ? "Depuis quand l'accueilliez-vous ?" : "Depuis quand l'accueillez-vous ?", f.from, (v) => hd.onField("from", v, true), "Une date approximative suffit s'il est arrivé avant cette année."),
      h("div", { class: "field" }, [h("span", { class: "lbl", id: "onb-days", text: f.before ? "Quels jours venait-il ?" : "Quels jours vient-il ?" }),
        h("div", { class: "daypick", role: "group", "aria-labelledby": "onb-days" }, WEEKDAYS.map((d) =>
          h("button", { type: "button", text: F.DAYS[d].slice(0, 3), "aria-label": F.DAYS[d], "aria-pressed": String(f.days.includes(d)), on: { click: () => hd.onDay(d) } })))]),
      h("div", { class: "field" }, [h("span", { class: "lbl", text: f.before ? "Ses horaires habituels" : "Ses horaires habituels aujourd'hui" }),
        f.days.length > 1 ? check("onb-same", f.same, "Les mêmes tous ces jours-là", hd.onSame) : null, hours(f, hd)]),
      m.changeLabel ? check("onb-chg", f.chg.on, `Ses horaires ont changé ${m.changeLabel}`, (v) => hd.onChg("on", v, true)) : null,
      m.changeLabel && f.chg.on ? h("div", { class: "onb-sub" }, [
        dateField("onb-chg-date", "Les horaires ci-dessus depuis le", f.chg.date, (v) => hd.onChg("date", v)),
        h("div", { class: "field" }, [h("span", { class: "lbl", text: "Avant, il arrivait et partait à" }),
          times("onb-old", f.chg.a, f.chg.b, (v) => hd.onChg("a", v), (v) => hd.onChg("b", v), "Anciens horaires")])
      ]) : null,
      f.before ? dateField("onb-to", "Son dernier jour d'accueil", f.to, (v) => hd.onField("to", v))
        : [check("onb-gone", f.gone, "Il va partir en cours d'année", (v) => hd.onField("gone", v, true)),
          f.gone ? dateField("onb-to", "Dernier jour d'accueil prévu", f.to, (v) => hd.onField("to", v)) : null],
      m.error ? h("p", { class: "warn-line", role: "alert", text: m.error }) : null,
      h("div", { class: "row" }, [
        h("button", { type: "button", class: "btn btn-primary", text: m.editing ? "Enregistrer" : "Ajouter cet enfant", on: { click: hd.onSave } }),
        m.canCancel ? h("button", { type: "button", class: "btn btn-quiet", text: "Annuler", on: { click: hd.onCancel } }) : null
      ])
    ]);
  }

  const kidCard = (k, hd) => h("div", { class: "onb-kid" }, [
    h("span", { class: "onb-av", "aria-hidden": "true", text: k.name.charAt(0) }),
    h("span", { class: "onb-kid-txt" }, [h("b", { text: k.name }), h("span", { class: "small", text: k.times }), h("span", { class: "small muted", text: k.dates })]),
    k.editable ? h("button", { type: "button", class: "btn btn-quiet", text: "Modifier", on: { click: () => hd.onEdit(k.id) } })
      : h("span", { class: "small muted", text: "Modifiable dans « Mon profil »" })
  ]);

  /**
   * @param {{phase:"now"|"before", list:Array<{id,name,times,dates,editable}>, formModel:Object|null, beforeAns:null|"yes"|"no"}} m
   * @returns {Node[]}
   */
  R.buildOnbKids = function buildOnbKids(m, hd) {
    const list = m.list.map((k) => kidCard(k, hd));
    const form = m.formModel ? kidForm(m.formModel, hd) : null;
    if (m.phase === "now") {
      return [list, form || h("div", null, h("button", { type: "button", class: "btn", text: "+ Ajouter un autre enfant", on: { click: hd.onAdd } })),
        h("p", { class: "small muted", text: "Autant d'enfants que nécessaire sur l'année, 4 au plus présents en même temps. Un enfant en accueil relais ne s'ajoute pas ici : son prénom se saisit le jour même." })];
    }
    return [
      h("div", { class: "card" }, [
        h("h3", { text: "Avez-vous accueilli d'autres enfants depuis le 1er janvier, qui sont partis depuis ?" }),
        h("p", { class: "small muted", text: "Ils comptent dans l'abattement des mois où ils étaient là. Sans eux, le début d'année serait incomplet." }),
        m.beforeAns === null ? h("div", { class: "row" }, [
          h("button", { type: "button", class: "btn btn-primary", text: "Oui, en ajouter un", on: { click: hd.onAdd } }),
          h("button", { type: "button", class: "btn", text: "Non", on: { click: hd.onNone } })
        ]) : null
      ]),
      list, form,
      m.beforeAns === "yes" && !form ? h("div", null, h("button", { type: "button", class: "btn", text: "+ Un autre enfant parti", on: { click: hd.onAdd } })) : null,
      m.beforeAns === "no" ? h("p", { class: "small muted", text: "D'accord. Vous pourrez en ajouter un plus tard dans « Mon profil »." }) : null
    ];
  };
})();
