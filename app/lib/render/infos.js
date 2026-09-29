/* ============================================================================
   render/infos.js — Vue « Mes informations » (profil v2)
   ----------------------------------------------------------------------------
   Vous (prénom, nom, employeur) ; enfants datés (arrivée, départ) avec leur
   semaine type en vigueur (week-template.js). Le profil passé est muté
   directement ; onChange() est appelé après chaque modification (app.js
   sauvegarde). Un enfant parti garde ses jours saisis : on renseigne sa date
   de départ au lieu de le supprimer.
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.render = window.ABMAT.render || {};

  const R = window.ABMAT.render;
  const U = window.ABMAT.utils;
  const S = window.ABMAT.storage;
  const Compute = window.ABMAT.compute;

  if (!U || !S || !Compute || !Compute.periodAt) {
    throw new Error("render/infos.js : utils, storage et compute/children.js doivent être chargés avant.");
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function field(id, type, label, hint, value, onCommit) {
    const row = el("div", "infos-row");
    const labelEl = el("label", null, label);
    labelEl.setAttribute("for", id);
    if (hint) labelEl.appendChild(el("span", "hint", hint));
    const input = document.createElement("input");
    input.type = type;
    input.id = id;
    input.className = "infos-input";
    input.value = value || "";
    input.autocomplete = "off";
    input.addEventListener("change", () => onCommit(input.value.trim()));
    row.appendChild(labelEl);
    row.appendChild(input);
    return row;
  }

  function renderChild(container, child, onChange) {
    const todayIso = U.toIsoDate(new Date());
    const gone = child.to !== null && child.to < todayIso;
    const block = el("div", "infos-child" + (gone ? " is-inactive" : ""));

    const head = el("div", "infos-child__head");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "infos-input infos-child__name";
    nameInput.id = `infos-child-name-${child.id}`;
    nameInput.placeholder = "Prénom";
    nameInput.value = child.name;
    nameInput.setAttribute("aria-label", "Prénom de l'enfant");
    nameInput.addEventListener("change", () => { child.name = nameInput.value.trim(); onChange(); });
    head.appendChild(nameInput);
    block.appendChild(head);

    block.appendChild(field(`infos-child-from-${child.id}`, "date", "Arrivée", "Premier jour d'accueil (facultatif)", child.from,
      (v) => { child.from = v || null; onChange(); }));
    block.appendChild(field(`infos-child-to-${child.id}`, "date", "Départ", "Dernier jour d'accueil, s'il est connu. Ses jours déjà saisis sont conservés.", child.to,
      (v) => { child.to = v || null; onChange(); }));

    if (gone) {
      block.appendChild(el("p", "hint", "Cet enfant est parti : il n'est plus proposé dans les mois à venir."));
    } else {
      const period = Compute.periodAt(child, todayIso) || child.periods[child.periods.length - 1];
      R.renderWeekTemplate(block, period.week, child.id, onChange);
    }
    container.appendChild(block);
  }

  /**
   * @param {HTMLElement} container
   * @param {Object} profile - profil v2 normalisé (muté directement)
   * @param {{onChange:()=>void}} handlers
   */
  R.renderInfos = function renderInfos(container, profile, handlers) {
    if (!container) return;
    container.innerHTML = "";
    const onChange = handlers.onChange;
    const rerender = () => R.renderInfos(container, profile, handlers);
    const root = el("div", "infos");

    const identity = el("div", "infos-block");
    identity.appendChild(el("h3", null, "Vous"));
    identity.appendChild(el("p", "hint", "Votre nom apparaît en haut des documents imprimés."));
    identity.appendChild(field("infos-first", "text", "Prénom", null, profile.firstName, (v) => { profile.firstName = v; onChange(); }));
    identity.appendChild(field("infos-last", "text", "Nom", null, profile.lastName, (v) => { profile.lastName = v; onChange(); }));
    identity.appendChild(field("infos-employer", "text", "Employeur", "Nom du CCAS ou de la crèche familiale", profile.employer, (v) => { profile.employer = v; onChange(); }));
    root.appendChild(identity);

    const kids = el("div", "infos-block");
    kids.appendChild(el("h3", null, "Les enfants"));
    kids.appendChild(el("p", "hint", "Autant d'enfants que nécessaire sur l'année, 4 au plus en même temps. Les horaires habituels permettent de remplir un mois vide en un clic."));
    profile.children.forEach((child) => renderChild(kids, child, onChange));

    const add = el("button", "btn", "+ Ajouter un enfant");
    add.type = "button";
    add.addEventListener("click", () => {
      profile.children.push({ id: S.newChildId(profile), name: "", from: U.toIsoDate(new Date()), to: null,
        periods: [{ from: null, week: S.blankWeek() }] });
      onChange();
      rerender();
      const input = container.querySelector(`#infos-child-name-${profile.children[profile.children.length - 1].id}`);
      if (input) input.focus();
    });
    kids.appendChild(add);
    root.appendChild(kids);

    container.appendChild(root);
  };
})();
