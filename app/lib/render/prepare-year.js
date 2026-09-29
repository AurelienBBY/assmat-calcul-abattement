/* ============================================================================
   render/prepare-year.js — Fenêtre « Préparer AAAA » (passage d'année)
   ----------------------------------------------------------------------------
   1. SMIC horaire brut au 1er janvier (contrôle de vraisemblance, aperçu du
   forfait) ; 2. enfants qui continuent en janvier ; 3. accueil relais.
   ========================================================================== */

(function () {
  "use strict";

  const R = window.ABMAT && window.ABMAT.render;
  if (!R || !R.moneyField) {
    throw new Error("render/month-panel.js doit être chargé avant render/prepare-year.js.");
  }
  const h = R.h;
  const F = R.fmt;

  function step(n, title, parts) {
    return h("div", { class: "step" }, [h("span", { class: "mk", "aria-hidden": "true", text: String(n) }), h("div", { class: "body" }, [h("b", { text: title }), parts])]);
  }

  /**
   * @param {{year, smic:number|null, editing:boolean, relais:boolean,
   *   kids:Array<{id, name, detail, leaves:boolean}>, forfaitOf:(smic)=>number}} m
   * @param {{onSave:({smic, keep, relais})=>void}} handlers
   * @returns {Node[]}
   */
  R.buildPrepareYear = function buildPrepareYear(m, handlers) {
    let smic = m.smic;
    const save = h("button", { type: "button", class: "btn btn-primary", text: m.editing ? "Enregistrer" : `Commencer ${m.year}`, disabled: smic === null });
    const describe = (v) => {
      const f = m.forfaitOf(v);
      const odd = (v < 10 || v > 16) ? " Vérifiez le chiffre : le SMIC horaire brut est proche de 12 €." : "";
      return { text: `Compris : ${F.euro(v)} de l'heure → ${F.euro(f)} par enfant pour une journée de 8 h ou plus, ${F.euro(f / 8)} par heure en dessous.${odd}`, warn: Boolean(odd) };
    };
    const smicField = R.moneyField({ id: "prep-smic", label: "SMIC horaire brut", value: smic, placeholder: "12,02", unit: "€ / heure", describe },
      (v) => { smic = v; save.disabled = (v === null); });

    const boxes = {};
    const kids = m.kids.map((k) => {
      boxes[k.id] = h("input", { type: "checkbox", id: `keep-${k.id}`, checked: !k.leaves, disabled: k.leaves });
      return h("label", { class: "check", htmlFor: `keep-${k.id}` }, [boxes[k.id], h("span", null, [k.name, " ", h("span", { class: "small muted", text: `— ${k.detail}` })])]);
    });
    const relais = h("input", { type: "checkbox", id: "prep-relais", checked: m.relais });

    save.addEventListener("click", () => {
      const keep = {};
      m.kids.forEach((k) => { keep[k.id] = boxes[k.id].checked; });
      handlers.onSave({ smic, keep, relais: relais.checked });
    });

    return [
      step(1, `Le SMIC horaire brut au 1er janvier ${m.year}`, [
        h("p", { text: "C'est lui qui fixe l'abattement de toute l'année, même si le SMIC augmente en cours d'année. Il est publié fin décembre sur service-public.fr." }),
        smicField
      ]),
      step(2, "Les enfants qui continuent en janvier", [
        h("p", { text: "Leurs horaires habituels continuent. Vous pourrez en ajouter à tout moment dans « Mon profil »." }),
        kids.length ? kids : h("p", { class: "small muted", text: "Aucun enfant dans votre profil." })
      ]),
      step(3, "L'accueil relais", h("label", { class: "check", htmlFor: "prep-relais" }, [relais, h("span", { text: `Je fais de l'accueil relais en ${m.year}` })])),
      h("div", { class: "dlg-foot" }, [h("span", { class: "small muted", text: `${m.year - 1} reste disponible pour votre déclaration.` }), save])
    ];
  };
})();
