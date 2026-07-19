/* ============================================================================
   render/infos.js — Vue « Mes informations » (profil)
   ----------------------------------------------------------------------------
   Identité (nom, employeur, mention), enfants (prénom, actif/inactif,
   semaine type via week-template.js). Le profil passé est muté directement ;
   onChange() est appelé après chaque modification (app.js sauvegarde).
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

  function textField(id, label, hint, value, onCommit) {
    const row = document.createElement("div");
    row.className = "infos-row";

    const labelWrap = document.createElement("label");
    labelWrap.setAttribute("for", id);
    labelWrap.textContent = label;
    if (hint) {
      const small = document.createElement("span");
      small.className = "hint";
      small.textContent = hint;
      labelWrap.appendChild(small);
    }

    const input = document.createElement("input");
    input.type = "text";
    input.id = id;
    input.className = "infos-input";
    input.value = value || "";
    input.autocomplete = "off";
    const commit = () => onCommit(input.value.trim());
    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);

    row.appendChild(labelWrap);
    row.appendChild(input);
    return row;
  }

  function renderChild(container, profile, childKey, onChange, rerender) {
    const child = profile.children[childKey];

    const block = document.createElement("div");
    block.className = "infos-child" + (child.active === false ? " is-inactive" : "");

    const head = document.createElement("div");
    head.className = "infos-child__head";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "infos-input infos-child__name";
    nameInput.id = `infos-child-name-${childKey}`;
    nameInput.placeholder = `Enfant ${childKey}`;
    nameInput.value = child.name || "";
    nameInput.setAttribute("aria-label", `Prénom de l'enfant ${childKey}`);
    const commitName = () => {
      child.name = nameInput.value.trim();
      onChange();
    };
    nameInput.addEventListener("change", commitName);
    nameInput.addEventListener("blur", commitName);
    head.appendChild(nameInput);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "infos-toggle";
    toggle.textContent = (child.active === false) ? "Réactiver" : "Désactiver";
    toggle.addEventListener("click", () => {
      child.active = (child.active === false);
      onChange();
      rerender(); // re-rend toute la vue (clic bouton : pas de focus à préserver)
    });
    head.appendChild(toggle);

    block.appendChild(head);

    if (child.active === false) {
      const note = document.createElement("p");
      note.className = "hint";
      note.textContent = "Enfant désactivé : il reste visible sur les mois passés, mais n'est plus pré-rempli.";
      block.appendChild(note);
    } else {
      R.renderWeekTemplate(block, child, childKey, onChange);
    }

    container.appendChild(block);
  }

  /**
   * @param {HTMLElement} container
   * @param {Object} profile - profil normalisé (muté directement)
   * @param {{onChange:()=>void}} handlers
   */
  R.renderInfos = function renderInfos(container, profile, handlers) {
    if (!container) return;
    container.innerHTML = "";

    const onChange = handlers.onChange;
    const root = document.createElement("div");
    root.className = "infos";

    // --- Qui suis-je ---
    const identity = document.createElement("div");
    identity.className = "infos-block";
    const h3a = document.createElement("h3");
    h3a.textContent = "Qui suis-je";
    identity.appendChild(h3a);
    const hintA = document.createElement("p");
    hintA.className = "hint";
    hintA.textContent = "Rempli une seule fois — ces informations apparaissent en en-tête des documents imprimés.";
    identity.appendChild(hintA);

    identity.appendChild(textField("infos-name", "Nom et prénom", null, profile.name, (v) => { profile.name = v; onChange(); }));
    identity.appendChild(textField("infos-employer", "Employeur", "Nom du CCAS ou de la crèche familiale", profile.employer, (v) => { profile.employer = v; onChange(); }));
    identity.appendChild(textField("infos-mention", "Mention sur les documents", "Facultatif — ex. n° d'agrément", profile.mention, (v) => { profile.mention = v; onChange(); }));
    root.appendChild(identity);

    // --- Les enfants ---
    const kids = document.createElement("div");
    kids.className = "infos-block";
    const h3b = document.createElement("h3");
    h3b.textContent = "Les enfants";
    kids.appendChild(h3b);
    const hintB = document.createElement("p");
    hintB.className = "hint";
    hintB.textContent = "Les prénoms remplacent « Enfant 1/2/3 » dans la saisie et sur les relevés. La semaine type permet de pré-remplir un mois vide en un clic.";
    kids.appendChild(hintB);

    const rerender = () => R.renderInfos(container, profile, handlers);
    for (let i = 1; i <= 3; i++) {
      renderChild(kids, profile, String(i), onChange, rerender);
    }
    root.appendChild(kids);

    container.appendChild(root);
  };
})();
