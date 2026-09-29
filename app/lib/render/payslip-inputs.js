/* ============================================================================
   render/payslip-inputs.js — Saisie fiche de paie (mensuel)
   ----------------------------------------------------------------------------
   Rôle :
   - Deux montants du mois : revenu net imposable, indemnités (IRF)
   - Champs texte (pas type="number") : la virgule et le point sont acceptés
     quelle que soit la langue du navigateur — un champ number en anglais
     lisait « 1234,56 » comme 123456, sans rien signaler.
   - Le montant compris est réaffiché sous le champ ; une saisie illisible
     est signalée et n'est PAS enregistrée (jamais de 0 silencieux).
   - Émet onMoneyChange(clé, valeur) avec clé "netImposable" | "irf".

   Dépendances :
   - window.ABMAT.render (R) — initialisé par render/index.js
   - window.ABMAT.utils (U) — parseMoneyFR, fmtEuro
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

  const FIELDS = [
    { key: "netImposable", id: "abmat-net", label: "Revenu net imposable",
      hint: "Ligne « Net imposable » de la fiche de paie (pas la somme virée sur le compte)." },
    { key: "irf", id: "abmat-irf", label: "Indemnités représentatives de frais (IRF)",
      hint: "Indemnités d'entretien et de repas. Si vous n'en avez pas, laissez vide." }
  ];

  // 1850.4 -> "1850,40" (valeur du champ) ; 0 -> "" (champ vide).
  function toFieldText(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) return "";
    return n.toFixed(2).replace(".", ",");
  }

  function buildRow(field, value, isFirst) {
    const row = document.createElement("div");
    row.className = "payslip-row" + (isFirst ? "" : " payslip-row--divider");

    const text = document.createElement("div");
    text.className = "payslip-row__text";
    const label = document.createElement("label");
    label.className = "inline-label";
    label.setAttribute("for", field.id);
    label.textContent = field.label;
    const hint = document.createElement("div");
    hint.className = "hint payslip-hint";
    hint.textContent = field.hint;
    text.appendChild(label);
    text.appendChild(hint);

    const fieldWrap = document.createElement("div");
    fieldWrap.className = "payslip-row__field";
    const inputWrap = document.createElement("div");
    inputWrap.className = "payslip-field--currency";
    const input = document.createElement("input");
    input.id = field.id;
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.placeholder = "ex. 1850,40";
    input.value = toFieldText(value);
    input.setAttribute("aria-describedby", `${field.id}-parsed`);
    const currency = document.createElement("span");
    currency.className = "payslip-currency";
    currency.textContent = "€";
    inputWrap.appendChild(input);
    inputWrap.appendChild(currency);

    const parsed = document.createElement("div");
    parsed.id = `${field.id}-parsed`;
    parsed.className = "payslip-parsed";
    parsed.setAttribute("aria-live", "polite");
    fieldWrap.appendChild(inputWrap);
    fieldWrap.appendChild(parsed);

    row.appendChild(text);
    row.appendChild(fieldWrap);
    return { row, input, parsed };
  }

  function showParsed(el, result) {
    el.classList.toggle("is-error", result.status === "invalid");
    if (result.status === "ok") el.textContent = `Compris : ${U.fmtEuro(result.value)}`;
    else if (result.status === "invalid") el.textContent = "Montant non compris, il n'est pas enregistré. Exemple : 1850,40";
    else el.textContent = "";
  }

  /**
   * Rend les deux champs et branche les listeners.
   * @param {HTMLElement} container
   * @param {{netImposable:number, irf:number}} state
   * @param {(key:"netImposable"|"irf", value:number)=>void} onMoneyChange
   */
  R.renderPayslipInputs = function renderPayslipInputs(container, state, onMoneyChange) {
    if (!container) return;
    container.innerHTML = "";

    const box = document.createElement("div");
    box.className = "payslip-form";

    FIELDS.forEach((field, idx) => {
      const { row, input, parsed } = buildRow(field, state[field.key], idx === 0);
      box.appendChild(row);

      // Retour immédiat pendant la frappe ; enregistrement à la validation du champ.
      input.addEventListener("input", () => showParsed(parsed, U.parseMoneyFR(input.value)));
      input.addEventListener("change", () => {
        const result = U.parseMoneyFR(input.value);
        showParsed(parsed, result);
        if (result.status === "invalid") return;
        onMoneyChange(field.key, result.status === "ok" ? result.value : 0);
      });
    });

    container.appendChild(box);
  };
})();
