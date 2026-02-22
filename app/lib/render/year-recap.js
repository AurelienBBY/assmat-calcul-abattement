(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.render = window.ABMAT.render || {};

  const R = window.ABMAT.render;
  const U = window.ABMAT.utils;

  if (!U) {
    throw new Error("ABMAT.utils est requis avant ABMAT.render (charger utils.js en premier).");
  }

  // --- Format helpers -------------------------------------------------------

  const nfEUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

  function fmtEuro(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    // Prefer any project helper if present
    if (typeof U.fmtEuro === "function") return U.fmtEuro(n);
    if (typeof U.formatEuro === "function") return U.formatEuro(n);
    return nfEUR.format(n);
  }

  function fmtInt(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return String(Math.round(n));
  }

  function monthLabelFR(monthIndex) {
    if (Array.isArray(U.MONTHS_FR) && U.MONTHS_FR[monthIndex]) return String(U.MONTHS_FR[monthIndex]);
    // Fallback
    const fallback = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
    ];
    return fallback[monthIndex] || "";
  }

  function statusChip(status) {
    const s = String(status || "").toLowerCase();
    let cls = "abmat-chip";
    let label = "";

    if (s === "ok") {
      cls += " abmat-chip--ok";
      label = "OK";
    } else if (s === "incomplet" || s === "incomplete" || s === "warn") {
      cls += " abmat-chip--warn";
      label = "Incomplet";
    } else {
      cls += " abmat-chip--muted";
      label = "Vide";
    }

    return `<span class="${cls}" aria-label="Statut: ${label}">${label}</span>`;
  }

  // --- Public API -----------------------------------------------------------

  /**
   * Render the annual recap view.
   *
   * @param {HTMLElement} container  Root element where recap HTML is injected.
   * @param {Object} recap           Data to display.
   * @param {number} recap.year
   * @param {Object} recap.totals
   * @param {Array}  recap.months
   * @param {(monthIndex:number)=>void} [onSelectMonth] Callback when clicking a month row.
   */
  R.renderYearRecap = function renderYearRecap(container, recap, onSelectMonth) {
    if (!container) return;

    const year = recap && Number(recap.year);
    const totals = (recap && recap.totals) || {};
    const months = (recap && Array.isArray(recap.months) && recap.months) || [];

    // Main structure: 2 cards (annual totals + monthly breakdown)
    container.innerHTML =
      `<div class="year-recap" aria-label="Récapitulatif annuel">` +
      `  <section class="card year-recap__annual" aria-label="Résultats annuels">` +
      `    <h3 class="card__title">Résultats annuels — ${Number.isFinite(year) ? year : ""}</h3>` +
      `    <div class="summary-result" role="status" aria-live="polite">` +
      `      <div class="summary-result__label">Revenu imposable annuel après abattement</div>` +
      `      <div class="hint">À reporter sur votre déclaration.</div>` +
      `      <div class="summary-result__value" data-year-imposable>${fmtEuro(totals.imposable)}</div>` +
      `    </div>` +
      `    <div class="month-details" aria-label="Détails annuels">` +
      `      <div class="month-details__title">Détails</div>` +
      `      <div class="year-param-row summary-row"><span><strong>Total NET imposable</strong><span class="hint">Somme des montants saisis (NET).</span></span><span data-year-net>${fmtEuro(totals.net)}</span></div>` +
      `      <div class="year-param-row summary-row"><span><strong>Total IRF</strong><span class="hint">Somme des montants saisis (IRF).</span></span><span data-year-irf>${fmtEuro(totals.irf)}</span></div>` +
      `      <div class="year-param-row summary-row"><span><strong>Total perçu</strong><span class="hint">NET + IRF (avant abattement).</span></span><span data-year-percu>${fmtEuro(totals.percu)}</span></div>` +
      `      <div class="year-param-row summary-row"><span><strong>Abattement total</strong><span class="hint">Somme des abattements calculés sur l’année.</span></span><span data-year-abatt>${fmtEuro(totals.abatt)}</span></div>` +
      `      <div class="year-param-row summary-row"><span><strong>Total jours &lt; 8h</strong></span><span data-year-jlt8>${fmtInt(totals.j_lt8)}</span></div>` +
      `      <div class="year-param-row summary-row"><span><strong>Total jours ≥ 8h</strong></span><span data-year-jge8>${fmtInt(totals.j_ge8)}</span></div>` +
      `    </div>` +
      `  </section>` +
      `  <section class="card year-recap__months" aria-label="Détail par mois">` +
      `    <h3 class="card__title">Détail par mois</h3>` +
      `    <div class="hint">Cliquez sur un mois pour revenir dessus et corriger vos données.</div>` +
      `    <div class="year-recap__table-wrap">` +
      `      <table class="abmat-table year-recap__table">` +
      `        <thead>` +
      `          <tr>` +
      `            <th>Mois</th>` +
      `            <th>NET</th>` +
      `            <th class="year-recap__opcol" aria-hidden="true">+</th>` +
      `            <th>IRF</th>` +
      `            <th class="year-recap__opcol" aria-hidden="true">=</th>` +
      `            <th>Total perçu</th>` +
      `            <th class="year-recap__opcol" aria-hidden="true">−</th>` +
      `            <th>Abattement</th>` +
      `            <th class="year-recap__opcol" aria-hidden="true">=</th>` +
      `            <th>Imposable</th>` +
      `            <th>Statut</th>` +
      `          </tr>` +
      `        </thead>` +
      `        <tbody data-year-months></tbody>` +
      `      </table>` +
      `    </div>` +
      `  </section>` +
      `</div>`;

    const tbody = container.querySelector("tbody[data-year-months]");
    if (!tbody) return;

    // Render 12 months (0..11). If data missing, show empty rows.
    const byIndex = new Map();
    for (const m of months) {
      const idx = Number(m && m.monthIndex);
      if (Number.isFinite(idx)) byIndex.set(idx, m);
    }

    const frag = document.createDocumentFragment();

    for (let idx = 0; idx < 12; idx++) {
      const m = byIndex.get(idx) || { monthIndex: idx, status: "empty" };

      const net = fmtEuro(m.net);
      const irf = fmtEuro(m.irf);
      const percu = fmtEuro(m.percu);
      const abatt = fmtEuro(m.abatt);
      const imposable = fmtEuro(m.imposable);

      const jlt8 = Number(m.j_lt8);
      const jge8 = Number(m.j_ge8);
      const hasDays = Number.isFinite(jlt8) || Number.isFinite(jge8);
      const daysSub = hasDays
        ? `<div class="hint">J&lt;8h: ${fmtInt(jlt8)} • J≥8h: ${fmtInt(jge8)}</div>`
        : ``;

      const tr = document.createElement("tr");
      tr.className = "year-recap__row";
      tr.setAttribute("data-month-index", String(idx));
      tr.tabIndex = 0;

      tr.innerHTML =
        `<td>` +
        `  <div class="year-recap__month">${monthLabelFR(idx)}</div>` +
        `  ${daysSub}` +
        `</td>` +
        `<td>${net}</td>` +
        `<td class="year-recap__opcol" aria-hidden="true"></td>` +
        `<td>${irf}</td>` +
        `<td class="year-recap__opcol" aria-hidden="true"></td>` +
        `<td>${percu}</td>` +
        `<td class="year-recap__opcol" aria-hidden="true"></td>` +
        `<td>${abatt}</td>` +
        `<td class="year-recap__opcol" aria-hidden="true"></td>` +
        `<td>${imposable}</td>` +
        `<td>${statusChip(m.status)}</td>`;

      // Click / keyboard navigation back to month
      const go = () => {
        if (typeof onSelectMonth === "function") onSelectMonth(idx);
      };

      tr.addEventListener("click", go);
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });

      frag.appendChild(tr);
    }

    tbody.innerHTML = "";
    tbody.appendChild(frag);
  };
})();