

/* ============================================================================
   render.js — Rendu DOM + branchements événements (UI)
   ----------------------------------------------------------------------------
   Objectif :
   - Centraliser tout le rendu/DOM ici, pour garder app.js très court.
   - Aucune logique "métier" : les calculs sont dans calc.js.
   - Aucune logique de stockage : localStorage + import/export sont dans storage.js.
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

  // -------------------------------------------------------------------------
  // 1) Sélecteurs mois / année
  // -------------------------------------------------------------------------

  /**
   * @param {HTMLElement} container
   * @param {Object} state {year, monthIndex}
   * @param {(next:{year:number, monthIndex:number})=>void} onPeriodChange
   */
  R.renderPeriodSelector = function renderPeriodSelector(container, state, onPeriodChange) {
    container.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "period-controls";

    // Top row (year selector)
    const top = document.createElement("div");
    top.className = "period-top";

    // Année
    const yearLabel = document.createElement("label");
    yearLabel.textContent = "Année ";
    yearLabel.setAttribute("for", "abmat-year");

    const yearSelect = document.createElement("select");
    yearSelect.id = "abmat-year";
    yearSelect.name = "year";

    const now = new Date();
    const currentYear = now.getFullYear();

    // Plage simple : année courante +/- 3
    for (let y = currentYear - 3; y <= currentYear + 3; y++) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      yearSelect.appendChild(opt);
    }

    // Valeurs initiales
    const effectiveMonth = Number.isFinite(Number(state.monthIndex)) ? Number(state.monthIndex) : now.getMonth();
    const effectiveYear = Number.isFinite(Number(state.year)) ? Number(state.year) : currentYear;
    yearSelect.value = String(effectiveYear);

    // Emit function
    const emit = (nextMonthIndex) => {
      const next = {
        monthIndex: Number.isFinite(Number(nextMonthIndex)) ? Number(nextMonthIndex) : effectiveMonth,
        year: Number(yearSelect.value)
      };
      onPeriodChange && onPeriodChange(next);
    };

    yearSelect.addEventListener("change", () => emit(effectiveMonth));

    // Month tabs (intercalaires)
    const tabs = document.createElement("div");
    tabs.className = "month-tabs";

    const monthLabelShort = (name) => {
      const s = String(name || "").trim();
      return (s.slice(0, 3) || s).toUpperCase();
    };

    const monthLabelFull = (name) => {
      return String(name || "").toUpperCase();
    };

    U.MONTHS_FR.forEach((name, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const isActive = (idx === effectiveMonth);
      btn.className = "month-tab" + (isActive ? " is-active" : "");
      btn.setAttribute("data-month", String(idx));
      btn.setAttribute("aria-label", name);
      btn.textContent = isActive ? monthLabelFull(name) : monthLabelShort(name);

      btn.addEventListener("click", () => emit(idx));
      tabs.appendChild(btn);
    });

    // Onglet RécaP (pas encore actif)
    const recapBtn = document.createElement("button");
    recapBtn.type = "button";
    recapBtn.className = "month-tab month-tab--recap";
    recapBtn.textContent = "RÉCAP";
    recapBtn.disabled = true;
    recapBtn.setAttribute("aria-disabled", "true");
    tabs.appendChild(recapBtn);

    // Assemble elements
    top.appendChild(yearLabel);
    top.appendChild(yearSelect);

    wrap.appendChild(top);
    wrap.appendChild(tabs);

    container.appendChild(wrap);
  };

  // -------------------------------------------------------------------------
  // 2) Paramètres année (SMIC / coefficient / forfait)
  // -------------------------------------------------------------------------

  /**
   * @param {HTMLElement} container
   * @param {Object} state {year, coefficient, forfaitJour, smicOverride}
   * @param {()=>{smicFromConfig:number|null, smicEffective:number|null}} getSmicInfo
   * @param {(smicOverride:number|null)=>void} onSmicOverrideChange
   */
  R.renderYearParams = function renderYearParams(container, state, getSmicInfo, onSmicOverrideChange) {
    container.innerHTML = "";

    const subtitle = document.createElement("p");
    subtitle.className = "hint";
    subtitle.textContent = `Année ${state.year}`;
    container.appendChild(subtitle);


    const info = getSmicInfo ? getSmicInfo() : { smicFromConfig: null, smicEffective: null };
    const smicFromConfig = info.smicFromConfig;
    const smicOverride = (typeof state.smicOverride === "number" && Number.isFinite(state.smicOverride)) ? state.smicOverride : null;

    // --- Explication (écran uniquement)
    const explain = document.createElement("div");
    explain.className = "calc-explain no-print";
    explain.innerHTML =
      `<p><strong>Pour plus de détails sur les règles officielles :</strong> ` +
      `<a href="https://www.service-public.gouv.fr/particuliers/vosdroits/F1234" target="_blank" rel="noopener noreferrer">service-public.gouv.fr</a></p>` +
      `<p>En tant qu’<strong>assistante maternelle ou familiale agréée</strong>, vous pouvez choisir de déclarer <strong>toutes les sommes perçues</strong> dans l’année, y compris les indemnités représentatives de frais (IRF). Dans ce cas, vous bénéficiez d’un <strong>abattement forfaitaire</strong> représentatif des frais.</p>` +
      `<p>L’abattement est calculé <strong>par jour et par enfant</strong>. Son montant varie selon le <strong>temps de présence</strong> de l’enfant dans la journée. Il est fixé en fonction du <strong>SMIC horaire brut</strong> au <strong>01/01/${state.year}</strong>.</p>` +
      `<p><strong>Durée de garde ≥ 8h :</strong> l’abattement forfaitaire par enfant est de <strong>${U.fmtEuro(state.forfaitJour || 0)}</strong> (soit <strong>3 × SMIC horaire brut</strong>).</p>` +
      `<p><strong>Durée de garde &lt; 8h :</strong> l’abattement est proratisé selon la formule : <code>(forfait ÷ 8) × heures de présence</code>.</p>` +
      `<p class="hint">Certains cas particuliers (garde de 24h et plus, enfant malade/handicapé/inadapté…) peuvent ouvrir droit à des abattements spécifiques et ne sont pas pris en compte dans ce calculateur.</p>`;
    container.appendChild(explain);

    // --- Récapitulatif (écran + PDF)
    const recapTitle = document.createElement("p");
    recapTitle.className = "year-params-subtitle";
    recapTitle.textContent = `Récapitulatif des règles appliquées — année ${state.year}`;
    container.appendChild(recapTitle);

    const recap = document.createElement("div");
    recap.className = "calc-recap";
    const smicLabel = (typeof smicFromConfig === "number")
      ? `${smicFromConfig.toFixed(2)} €`
      : "non renseigné";
    recap.innerHTML =
      `<ul class="calc-recap-list">` +
      `  <li><strong>Forfait (par enfant, garde ≥ 8h)</strong> : <strong>${U.fmtEuro(state.forfaitJour || 0)}</strong> <span class="hint">(= 3 × SMIC horaire brut au 01/01/${state.year})</span></li>` +
      `  <li><strong>Forfait (par enfant, garde &lt; 8h)</strong> : <span class="hint">(forfait ÷ 8) × heures de présence</span></li>` +
      `  <li class="hint">Calcul par jour et par enfant. SMIC au 01/01/${state.year} : <strong>${smicLabel}</strong>.</li>` +
      `</ul>`;
    container.appendChild(recap);

    // --- Saisie du SMIC (uniquement si non renseigné dans le code)
    if (typeof smicFromConfig !== "number") {
      const smicMissing = document.createElement("div");
      smicMissing.className = "year-param-row is-rule";
      smicMissing.innerHTML =
        `<div class="year-rule-title"><strong>SMIC manquant</strong> <span class="hint">pour l’année ${state.year}</span></div>` +
        `<div class="year-param-sub">` +
        `  <label class="inline-label" for="abmat-smic-input">Saisir le SMIC horaire brut :</label> ` +
        `  <input id="abmat-smic-input" type="text" inputmode="decimal" autocomplete="off" placeholder="Ex : 12,02" data-year-smic-input /> ` +
        `  <span class="hint">Cette valeur sert à calculer le forfait journalier (3 × SMIC).</span>` +
        `</div>`;
      container.appendChild(smicMissing);

      if (typeof smicOverride === "number") {
        const note = document.createElement("p");
        note.className = "hint";
        note.textContent = `Valeur manuelle enregistrée : ${smicOverride.toFixed(2)} €`;
        smicMissing.appendChild(note);
      }
    }

    const smicInput = container.querySelector("[data-year-smic-input]");
    if (smicInput) {
      if (typeof smicOverride === "number") {
        smicInput.value = String(smicOverride).replace(".", ",");
      }

      const apply = () => {
        const raw0 = String(smicInput.value || "").trim();

        // Champ vide => on enlève l'override
        if (!raw0) {
          onSmicOverrideChange && onSmicOverrideChange(null);
          return;
        }

        // Accepte virgule ou point
        const norm = raw0.replace(",", ".");
        const v = Number.parseFloat(norm);

        // Si pas encore parseable, on ne force pas (on laisse l'utilisateur corriger)
        if (!Number.isFinite(v)) return;

        onSmicOverrideChange && onSmicOverrideChange(v);
      };

      // Important : ne PAS appeler le callback à chaque frappe, sinon app.js re-render
      // et le champ "saute" (symptôme : impossible de taper plus d'un chiffre).
      smicInput.addEventListener("change", apply);
      smicInput.addEventListener("blur", apply);
    }
  };

  // -------------------------------------------------------------------------
  // 3) Tableau du mois
  // -------------------------------------------------------------------------

  /**
   * @param {HTMLElement} container
   * @param {Object} state {year, monthIndex}
   * @param {(chg:{isoDate:string, slot:number, kind:"in"|"out", value:string})=>void} onTimeChange
   */
  R.renderMonthTable = function renderMonthTable(container, state, onTimeChange) {
    container.innerHTML = "";

    const year = state.year;
    const monthIndex = state.monthIndex;

    const heading = document.createElement("p");
    heading.className = "month-heading";
    heading.textContent = `Mois : ${U.MONTHS_FR[monthIndex]} ${year} (jours ouvrés)`;
    container.appendChild(heading);

    const table = document.createElement("table");
    table.className = "abmat-table";
    table.setAttribute("data-month", `${year}-${U.pad2(monthIndex + 1)}`);

    // En-tête du tableau
    const thead = document.createElement("thead");
    const trh = document.createElement("tr");

    // Colonnes : Date | Enfant | Heure d'entrée | Heure de sortie | Temps de présence | Abattement
    const thDate = document.createElement("th");
    thDate.className = "col-date";
    thDate.textContent = "Date";
    trh.appendChild(thDate);

    const thEnfant = document.createElement("th");
    thEnfant.textContent = "Enfant";
    trh.appendChild(thEnfant);

    const thEntree = document.createElement("th");
    thEntree.textContent = "Heure d'entrée";
    trh.appendChild(thEntree);

    const thSortie = document.createElement("th");
    thSortie.textContent = "Heure de sortie";
    trh.appendChild(thSortie);

    const thTemps = document.createElement("th");
    thTemps.textContent = "Temps de présence";
    trh.appendChild(thTemps);

    const thAbatt = document.createElement("th");
    thAbatt.textContent = "Abattement";
    trh.appendChild(thAbatt);

    thead.appendChild(trh);
    table.appendChild(thead);

    // Corps du tableau
    const tbody = document.createElement("tbody");
    const totalDays = U.daysInMonth(year, monthIndex);

    let hasRows = false;
    let started = false;
    let weekStartDate = null; // Date (objet) du début de semaine affichée

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, monthIndex, day);
      if (U.isWeekend(d)) continue;

      hasRows = true;

      // --- Début de semaine : première journée ouvrée du mois ou chaque lundi
      if (!started || d.getDay() === 1) {
        started = true;
        weekStartDate = new Date(d);

        // Calcule une fin "vendredi" clampée au mois (jours ouvrés)
        let end = new Date(d);
        end.setDate(end.getDate() + (5 - end.getDay())); // vers vendredi

        if (end.getMonth() !== monthIndex) {
          end = new Date(year, monthIndex, totalDays);
          // si week-end, revenir au vendredi
          if (end.getDay() === 6) end.setDate(end.getDate() - 1); // samedi -> vendredi
          if (end.getDay() === 0) end.setDate(end.getDate() - 2); // dimanche -> vendredi
        }

        const startLabel = `${U.pad2(weekStartDate.getDate())}/${U.pad2(weekStartDate.getMonth() + 1)}`;
        const endLabel = `${U.pad2(end.getDate())}/${U.pad2(end.getMonth() + 1)}`;

        const trSep = document.createElement("tr");
        trSep.className = "week-sep";

        const tdSep = document.createElement("td");
        tdSep.colSpan = 6;
        tdSep.innerHTML = `Semaine du <strong>${startLabel}</strong> au <strong>${endLabel}</strong>`;
        trSep.appendChild(tdSep);

        tbody.appendChild(trSep);
      }

      const isoDate = `${year}-${U.pad2(monthIndex + 1)}-${U.pad2(day)}`;
      const weekdayLong = d.toLocaleDateString("fr-FR", { weekday: "long" });
      const weekdayLabel = weekdayLong.charAt(0).toUpperCase() + weekdayLong.slice(1);

      // --- 3 lignes (enfants 1..3) pour ce jour
      for (let slot = 1; slot <= 3; slot++) {
        const tr = document.createElement("tr");
        tr.setAttribute("data-date", isoDate);
        tr.setAttribute("data-slot", slot);

        // Date cell (rowspan=3) sur la 1ère ligne du jour
        if (slot === 1) {
          const tdDate = document.createElement("td");
          tdDate.className = "col-date";
          tdDate.setAttribute("rowspan", "3");
          tdDate.innerHTML =
            `<div class="col-date__inner">` +
            `<strong class="date-day">${weekdayLabel}</strong><br>` +
            `<span class="date-num">${U.pad2(day)}/${U.pad2(monthIndex + 1)}</span>` +
            `</div>`;
          tr.appendChild(tdDate);
        }

        // Enfant
        const tdEnfant = document.createElement("td");
        tdEnfant.className = "col-enfant";
        tdEnfant.textContent = `Enfant ${slot}`;
        tr.appendChild(tdEnfant);

        // Heure d'entrée
        const tdEntree = document.createElement("td");
        tdEntree.className = "col-entree";
        tdEntree.innerHTML =
          `<label class="sr-only" for="in-${isoDate}-${slot}">Entrée enfant ${slot} (${isoDate})</label>` +
          `<input type="time" id="in-${isoDate}-${slot}" data-time="in" data-date="${isoDate}" data-slot="${slot}" />`;
        tr.appendChild(tdEntree);

        // Heure de sortie
        const tdSortie = document.createElement("td");
        tdSortie.className = "col-sortie";
        tdSortie.innerHTML =
          `<label class="sr-only" for="out-${isoDate}-${slot}">Sortie enfant ${slot} (${isoDate})</label>` +
          `<input type="time" id="out-${isoDate}-${slot}" data-time="out" data-date="${isoDate}" data-slot="${slot}" />`;
        tr.appendChild(tdSortie);

        // Temps de présence
        const tdTemps = document.createElement("td");
        tdTemps.className = "col-temps";
        tdTemps.innerHTML = `<span data-hours data-date="${isoDate}" data-slot="${slot}">—</span>`;
        tr.appendChild(tdTemps);

        // Abattement
        const tdAbatt = document.createElement("td");
        tdAbatt.className = "col-abatt";
        tdAbatt.innerHTML = `<span data-abatt data-date="${isoDate}" data-slot="${slot}">—</span>`;
        tr.appendChild(tdAbatt);

        tbody.appendChild(tr);
      }

      // --- Fin de semaine : si demain est lundi (ou fin du mois)
      // On cherche le prochain jour ouvré dans le mois
      let nextWorking = null;
      for (let dd = day + 1; dd <= totalDays; dd++) {
        const nd = new Date(year, monthIndex, dd);
        if (!U.isWeekend(nd)) {
          nextWorking = nd;
          break;
        }
      }
      const isEndOfWeek = (!nextWorking) || (nextWorking.getDay() === 1);

      if (isEndOfWeek && weekStartDate) {
        const weekEnd = new Date(d);

        const startLabel = `${U.pad2(weekStartDate.getDate())}/${U.pad2(weekStartDate.getMonth() + 1)}`;
        const endLabel = `${U.pad2(weekEnd.getDate())}/${U.pad2(weekEnd.getMonth() + 1)}`;

        const isoStart = `${year}-${U.pad2(weekStartDate.getMonth() + 1)}-${U.pad2(weekStartDate.getDate())}`;
        const isoEnd = `${year}-${U.pad2(weekEnd.getMonth() + 1)}-${U.pad2(weekEnd.getDate())}`;

        const trTotal = document.createElement("tr");
        trTotal.className = "week-total";

        // Libellé sur les 5 premières colonnes
        const tdLabel = document.createElement("td");
        tdLabel.className = "week-total-label";
        tdLabel.colSpan = 5;
        tdLabel.innerHTML =
          `Total abattement semaine du <strong>${startLabel}</strong> au <strong>${endLabel}</strong>`;

        // Montant aligné sur la colonne Abattement
        const tdAmount = document.createElement("td");
        tdAmount.className = "week-total-amount col-abatt";
        tdAmount.innerHTML =
          `<span class="week-total-pill"><span data-week-total data-week-start="${isoStart}" data-week-end="${isoEnd}">—</span></span>`;

        trTotal.appendChild(tdLabel);
        trTotal.appendChild(tdAmount);
        tbody.appendChild(trTotal);
      }
    }

    table.appendChild(tbody);
    container.appendChild(table);

    // Délégation d’événements : 1 seul listener pour tous les inputs du tableau
    table.addEventListener("input", (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.type !== "time") return;
      const isoDate = t.getAttribute("data-date");
      const slot = Number(t.getAttribute("data-slot"));
      const kind = t.getAttribute("data-time"); // in/out
      if (!isoDate || !slot || (kind !== "in" && kind !== "out")) return;
      onTimeChange && onTimeChange({ isoDate, slot, kind, value: t.value || "" });
    });

    if (!hasRows) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "Aucun jour ouvré à afficher pour ce mois.";
      container.appendChild(p);
    }
  };

  // -------------------------------------------------------------------------
  // 4) Récapitulatif (paie)
  // -------------------------------------------------------------------------

  /**
   * @param {HTMLElement} container
   * @param {Object} state {netImposable, irf}
   * @param {(chg:{netImposable:number, irf:number})=>void} onMoneyChange
   */
  R.renderSummary = function renderSummary(container, state, onMoneyChange) {
    container.innerHTML = "";

    const title = document.createElement("p");
    title.className = "summary-title";
    if (Number.isFinite(Number(state.monthIndex)) && Number.isFinite(Number(state.year))) {
      title.textContent = `${U.MONTHS_FR[state.monthIndex]} ${state.year}`;
    } else {
      title.textContent = "Récapitulatif du mois";
    }
    container.appendChild(title);

    const bloc = document.createElement("div");
    bloc.className = "summary-card";
    bloc.innerHTML =
      // A) A renseigner
      `<div class="summary-section summary-section--input">` +
      `  <div class="summary-section__title"><strong>À renseigner (fiche de paie)</strong></div>` +
      `  <p class="hint summary-help">Ces montants ne viennent pas du tableau : saisissez-les tels qu’ils apparaissent sur votre fiche de paie.</p>` +
      `  <div class="year-param-row summary-row">` +
      `    <label class="inline-label" for="abmat-net">Revenu net imposable :</label>` +
      `    <input id="abmat-net" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00" />` +
      `    <div class="hint summary-sub">Montant "net imposable" du mois.</div>` +
      `  </div>` +
      `  <div class="year-param-row summary-row">` +
      `    <label class="inline-label" for="abmat-irf">Indemnités représentatives de frais (IRF) :</label>` +
      `    <input id="abmat-irf" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00" />` +
      `    <div class="hint summary-sub">Si vous n’en avez pas, laissez 0.</div>` +
      `  </div>` +
      `  <div class="summary-warning hint" data-summary-warning style="display:none"></div>` +
      `</div>` +

      // B) Résultats
      `<div class="summary-section summary-section--results">` +
      `  <div class="summary-section__title"><strong>Résultats (calculés)</strong></div>` +
      `  <div class="year-param-row summary-row">` +
      `    <span><strong>Total perçu</strong> <span class="hint">(net + IRF, avant abattement)</span> :</span>` +
      `    <span data-month-percu>—</span>` +
      `  </div>` +
      `  <div class="year-param-row summary-row">` +
      `    <span><strong>Abattement total calculé</strong> :</span>` +
      `    <span data-month-abatt>—</span>` +
      `  </div>` +
      `  <div class="summary-result" role="status" aria-live="polite">` +
      `    <div class="summary-result__label">Montant à déclarer <span class="hint">(après abattement)</span></div>` +
      `    <div class="summary-result__value" data-month-declare>—</div>` +
      `  </div>` +
      `  <div class="year-param-row summary-row summary-row--muted">` +
      `    <span>Revenu imposable après abattement :</span>` +
      `    <span data-month-imposable>—</span>` +
      `  </div>` +
      `  <p class="hint">Le montant à déclarer ne peut pas être négatif.</p>` +
      `</div>`;
    container.appendChild(bloc);

    const netEl = container.querySelector("#abmat-net");
    const irfEl = container.querySelector("#abmat-irf");

    if (netEl) netEl.value = (Number(state.netImposable) ? String(state.netImposable).replace(".", ",") : "");
    if (irfEl) irfEl.value = (Number(state.irf) ? String(state.irf).replace(".", ",") : "");

    const emit = () => {
      const net = Number(String(netEl.value).replace(",", "."));
      const irf = Number(String(irfEl.value).replace(",", "."));
      onMoneyChange && onMoneyChange({
        netImposable: Number.isFinite(net) ? net : 0,
        irf: Number.isFinite(irf) ? irf : 0
      });
    };

    if (netEl) netEl.addEventListener("input", emit);
    if (irfEl) irfEl.addEventListener("input", emit);
  };

  /**
   * Met à jour les montants calculés du récap (sans re-render complet).
   * @param {HTMLElement} container
   * @param {Object} computed {monthAbatt, percu, imposable}
   */
  R.updateSummaryComputed = function updateSummaryComputed(container, computed) {
    const abattEl = container.querySelector("[data-month-abatt]");
    const percuEl = container.querySelector("[data-month-percu]");
    const imposableEl = container.querySelector("[data-month-imposable]");
    const declareEl = container.querySelector("[data-month-declare]");

    if (abattEl) abattEl.textContent = U.fmtEuro(computed.monthAbatt || 0);
    if (percuEl) percuEl.textContent = U.fmtEuro(computed.percu || 0);
    if (imposableEl) imposableEl.textContent = U.fmtEuro(computed.imposable || 0);
    if (declareEl) declareEl.textContent = U.fmtEuro(computed.imposable || 0);
  };

  // -------------------------------------------------------------------------
  // 5) Actions (print + export/import)
  // -------------------------------------------------------------------------

  /**
   * Branche les actions sur la toolbar sticky.
   *
   * Attendus dans le DOM (toolbar) :
   * - #abmat-action-save  (bouton "Sauvegarder")
   * - #abmat-action-load  (bouton "Charger")
   * - #abmat-action-print (bouton "Imprimer")
   * - #abmat-action-file  (input[type=file] caché, accept application/json)
   *
   * NOTE: on ne rend plus de blocs "Données" / "Impression" dans la page.
   * Le param `container` est conservé pour compatibilité, mais n’est plus utilisé.
   */
  R.renderActions = function renderActions(container, state, onPrint, onExport, onImportRequest) {
    // Toolbar targets
    const btnSave = document.getElementById("abmat-action-save");
    const btnLoad = document.getElementById("abmat-action-load");
    const btnPrint = document.getElementById("abmat-action-print");
    const fileInput = document.getElementById("abmat-action-file");

    // Garde-fous : si la toolbar n’existe pas (ex: intégration partielle), on ne casse pas.
    if (!btnSave && !btnLoad && !btnPrint && !fileInput) {
      if (container) container.innerHTML = "";
      return;
    }

    // (Ré)initialise le champ fichier pour permettre de recharger le même fichier deux fois.
    const resetFile = () => {
      if (fileInput) fileInput.value = "";
    };

    // Sauvegarde (export)
    if (btnSave) {
      btnSave.addEventListener("click", () => {
        onExport && onExport();
      });
    }

    // Impression
    if (btnPrint) {
      btnPrint.addEventListener("click", () => {
        onPrint && onPrint();
      });
    }

    // Chargement (import)
    if (btnLoad) {
      btnLoad.addEventListener("click", () => {
        if (fileInput) {
          resetFile();
          fileInput.click();
        } else {
          // Fallback : si pas d'input file, on déclenche quand même le handler côté app.
          onImportRequest && onImportRequest(null);
        }
      });
    }

    // Quand un fichier est choisi
    if (fileInput) {
      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        onImportRequest && onImportRequest(file);
      });
    }

    // (Optionnel) expose le nom de fichier attendu via title sur le bouton Charger
    // sans polluer l’UI.
    if (btnLoad && state && Number.isFinite(Number(state.year)) && Number.isFinite(Number(state.monthIndex))) {
      const y = state.year;
      const m = U.pad2(state.monthIndex + 1);
      btnLoad.title = `Importer un fichier JSON (ex: abattement-assmat-${y}-${m}.json)`;
    }
  };

  // -------------------------------------------------------------------------
  // 6) Date de génération (footer)
  // -------------------------------------------------------------------------

  R.renderGeneratedDate = function renderGeneratedDate() {
    const el = document.getElementById("generated-date");
    if (!el) return;
    el.textContent = U.formatDateFR(new Date());
  };
})();