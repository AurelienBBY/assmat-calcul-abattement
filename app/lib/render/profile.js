/* ============================================================================
   render/profile.js — Onglet « Mon profil »
   ----------------------------------------------------------------------------
   Vous (prénom, nom, employeur), l'année en cours (accueil relais, SMIC),
   les enfants (render/profile-child.js), copie de secours, vos données.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.buildProfileChild) {
    throw new Error("render/profile-child.js doit être chargé avant render/profile.js.");
  }
  const h = R.h;
  const F = R.fmt;

  function textField(id, label, value, onChange) {
    return h("div", { class: "field" }, [
      h("label", { htmlFor: id, text: label }),
      h("input", { type: "text", id, value, autocomplete: "off", on: { change: (e) => onChange(e.target.value.trim()) } })
    ]);
  }

  function addForm(m, handlers) {
    if (!m.adding) {
      return h("div", null, h("button", { type: "button", class: "btn", text: "+ Ajouter un enfant", on: { click: () => handlers.onEdit(null, "add") } }));
    }
    const name = h("input", { type: "text", id: "nc-name", autocomplete: "off" });
    const from = h("input", { type: "date", id: "nc-from", value: m.todayIso });
    return h("div", { class: "child" }, [
      h("b", { text: "Nouvel enfant" }),
      h("div", { class: "fields" }, [
        h("div", { class: "field" }, [h("label", { htmlFor: "nc-name", text: "Prénom" }), name]),
        h("div", { class: "field" }, [h("label", { htmlFor: "nc-from", text: "Date d'arrivée" }), from])
      ]),
      h("div", { class: "row" }, [
        h("button", { type: "button", class: "btn btn-primary", text: "Ajouter", on: { click: () => handlers.onSaveNew({ name: name.value, from: from.value }) } }),
        h("button", { type: "button", class: "btn btn-quiet", text: "Annuler", on: { click: handlers.onCancelEdit } })
      ])
    ]);
  }

  /**
   * @param {{firstName, lastName, employer, year, relais, smic:number|null, children:Array,
   *   adding:boolean, todayIso, backupCard:Node}} m
   * @param {Object} handlers
   * @returns {Node[]}
   */
  R.buildProfile = function buildProfile(m, handlers) {
    return [
      h("div", { class: "two" }, [
        h("div", { class: "card" }, [
          h("h3", { text: "Vous" }),
          h("div", { class: "fields" }, [
            textField("pf-first", "Prénom", m.firstName, (v) => handlers.onIdentity("firstName", v)),
            textField("pf-last", "Nom", m.lastName, (v) => handlers.onIdentity("lastName", v)),
            textField("pf-emp", "Employeur", m.employer, (v) => handlers.onIdentity("employer", v))
          ]),
          h("p", { class: "small muted", text: "Votre nom et votre employeur apparaissent en haut des documents imprimés." })
        ]),
        h("div", { class: "card" }, [
          h("h3", { text: `Cette année (${m.year})` }),
          h("label", { class: "check", htmlFor: "pf-relais" }, [
            h("input", { type: "checkbox", id: "pf-relais", checked: m.relais, on: { change: (e) => handlers.onRelais(e.target.checked) } }),
            h("span", null, [`Je fais de l'accueil relais en ${m.year}`, h("br"),
              h("span", { class: "small muted", text: "Ajoute « + Enfant en accueil relais » dans la journée et la pointeuse." })])
          ]),
          h("dl", { class: "kv num" }, [h("dt", { text: `SMIC au 1er janvier ${m.year}` }), h("dd", { text: m.smic === null ? "pas encore réglé" : F.euro(m.smic) })]),
          h("p", { class: "small muted", text: "Le SMIC se règle au passage d'une année à l'autre, dans « Mon année »." })
        ])
      ]),
      h("div", { class: "card" }, [
        h("h3", { text: "Les enfants" }),
        h("p", { class: "small muted", text: `Autant d'enfants que nécessaire sur l'année, avec leurs dates d'arrivée et de départ. Au plus ${window.ABMAT_CONFIG.maxChildrenAtOnce} présents en même temps.` }),
        m.children.map((c) => R.buildProfileChild(c, handlers)),
        addForm(m, handlers)
      ]),
      h("div", { class: "two" }, [
        m.backupCard,
        h("div", { class: "card" }, [
          h("h3", { text: "Vos données" }),
          h("ul", { class: "plain" }, [
            h("li", { text: "Tout reste sur cet appareil et dans votre copie de secours. Rien n'est envoyé ailleurs." }),
            h("li", { text: "La copie contient les prénoms des enfants : ne l'envoyez pas par e-mail." }),
            h("li", { text: "Gardez chaque année au moins 3 ans après l'avoir déclarée (délai de contrôle des impôts) ; ensuite, vous pouvez l'effacer." })
          ]),
          h("div", { class: "row" }, [
            h("button", { type: "button", class: "btn", text: "Effacer une année…", on: { click: handlers.onEraseYear } }),
            h("button", { type: "button", class: "btn btn-quiet", text: "Tout effacer sur cet appareil…", on: { click: handlers.onEraseAll } })
          ])
        ])
      ])
    ];
  };
})();
