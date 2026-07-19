/* ============================================================================
   app.js — Bootstrap (orchestration)
   ----------------------------------------------------------------------------
   Ce fichier est volontairement "court" :
   - Rendu DOM :        app/lib/render/* (ABMAT.render)
   - Calculs métier :   app/lib/calc.js    (ABMAT.calc)
   - Stockage :         app/lib/storage.js (ABMAT.storage)
   - Utilitaires :      app/lib/utils.js   (ABMAT.utils)
   ----------------------------------------------------------------------------
   Aucun serveur, aucune API : tout fonctionne hors ligne.
   ========================================================================== */

(function () {
    "use strict";

    // --- Dépendances ----------------------------------------------------------

    const U = window.ABMAT && window.ABMAT.utils;
    const C = window.ABMAT && window.ABMAT.calc;
    const S = window.ABMAT && window.ABMAT.storage;
    const R = window.ABMAT && window.ABMAT.render;

    if (!U || !C || !S || !R) {
        throw new Error("Modules ABMAT manquants. Vérifie l’ordre des <script> (utils, calc, storage, render, app).");
    }

    // --- État -----------------------------------------------------------------

    const state = {
        year: null,
        monthIndex: null,     // 0..11 (mois) ; 12 = RÉCAP annuel
        key: null,            // abmat:YYYY-MM
        data: null            // monthData
    };

    // --- Config / forfait -----------------------------------------------------

    function getCoefficient() {
        return (window.ABMAT_CONFIG && window.ABMAT_CONFIG.coefficient)
            ? Number(window.ABMAT_CONFIG.coefficient)
            : 3;
    }

    function getSmicFromConfig(year) {
        return (window.ABMAT_CONFIG && typeof window.ABMAT_CONFIG.getSmicHoraireBrut === "function")
            ? window.ABMAT_CONFIG.getSmicHoraireBrut(year)
            : null;
    }

    function getSmicInfo() {
        const smicFromConfig = getSmicFromConfig(state.year);
        // Si le SMIC est désormais renseigné dans le code (config), on n’a plus besoin
        // d’une ancienne valeur manuelle enregistrée (souvent saisie quand le SMIC manquait).
        // On la neutralise automatiquement pour éviter d’utiliser une valeur obsolète.
        if (
            state.data &&
            typeof smicFromConfig === "number" && Number.isFinite(smicFromConfig) &&
            typeof state.data.smicOverride === "number" && Number.isFinite(state.data.smicOverride)
        ) {
            state.data.smicOverride = null;
            saveNow();
        }
        const override = (state.data && typeof state.data.smicOverride === "number" && Number.isFinite(state.data.smicOverride))
            ? state.data.smicOverride
            : null;

        const smicEffective = (typeof override === "number") ? override : smicFromConfig;
        return { smicFromConfig, smicEffective };
    }

    function computeForfaitJour() {
        const coeff = getCoefficient();
        const { smicEffective } = getSmicInfo();
        const s = Number.isFinite(Number(smicEffective)) ? Number(smicEffective) : 0;

        if (window.ABMAT_CONFIG && typeof window.ABMAT_CONFIG.computeForfaitJourFromSmic === "function") {
            return U.round2(window.ABMAT_CONFIG.computeForfaitJourFromSmic(s, coeff));
        }
        return U.round2(s * coeff);
    }

    // --- Données --------------------------------------------------------------

    function ensureDayObj(isoDate) {
        if (!state.data.days[isoDate]) {
            state.data.days[isoDate] = { slots: { "1": { in: "", out: "" }, "2": { in: "", out: "" }, "3": { in: "", out: "" } } };
            return;
        }
        if (!state.data.days[isoDate].slots || typeof state.data.days[isoDate].slots !== "object") {
            state.data.days[isoDate].slots = { "1": {}, "2": {}, "3": {} };
        }
        for (let s = 1; s <= 3; s++) {
            const k = String(s);
            if (!state.data.days[isoDate].slots[k] || typeof state.data.days[isoDate].slots[k] !== "object") {
                state.data.days[isoDate].slots[k] = {};
            }
            if (typeof state.data.days[isoDate].slots[k].in !== "string") state.data.days[isoDate].slots[k].in = "";
            if (typeof state.data.days[isoDate].slots[k].out !== "string") state.data.days[isoDate].slots[k].out = "";
        }
    }

    function saveNow() {
        if (!state.key || !state.data) return;
        S.saveMonth(state.key, state.data);
    }

    // --- UI: remplissage + recalculs -----------------------------------------

    function fillTableFromData() {
        const table = document.querySelector(".abmat-table");
        if (!table || !state.data) return;

        const inputs = Array.from(table.querySelectorAll('input[type="time"][data-date][data-slot][data-time]'));
        inputs.forEach((inp) => {
            const iso = inp.getAttribute("data-date");
            const slot = inp.getAttribute("data-slot");
            const kind = inp.getAttribute("data-time"); // in/out
            const day = state.data.days[iso];
            const val = day && day.slots && day.slots[slot] ? day.slots[slot][kind] : "";
            inp.value = (typeof val === "string") ? val : "";
        });
    }

    // IMPORTANT : les calculs partent toujours de state.data (source de vérité) ;
    // le DOM n'est jamais lu pour calculer — il ne fait qu'afficher.

    function updateDayRow(isoDate) {
        const table = document.querySelector(".abmat-table");
        if (!table || !state.data) return 0;

        const forfaitJour = computeForfaitJour();
        const dayObj = state.data.days[isoDate];
        const day = C.computeDayTotal(dayObj ? dayObj.slots : {}, forfaitJour);

        for (let slot = 1; slot <= 3; slot++) {
            const hoursEl = table.querySelector(`[data-hours][data-date="${isoDate}"][data-slot="${slot}"]`);
            const abattEl = table.querySelector(`[data-abatt][data-date="${isoDate}"][data-slot="${slot}"]`);
            if (!hoursEl || !abattEl) continue;

            const r = day.perSlot[String(slot)];
            if (r.status === "empty") {
                hoursEl.textContent = "—";
                abattEl.textContent = "—";
            } else if (r.status === "invalid") {
                hoursEl.textContent = "⚠︎";
                abattEl.textContent = "⚠︎";
            } else {
                hoursEl.textContent = U.fmtHoursHM(r.hours);
                abattEl.textContent = U.fmtEuro(r.abatt);
            }
        }

        const totalEl = table.querySelector(`[data-day-total][data-date="${isoDate}"]`);
        if (totalEl) {
            totalEl.textContent = (day.dayTotal > 0) ? U.fmtEuro(day.dayTotal) : "—";
        }

        return day.dayTotal;
    }

    function computeMonthTotalAbattAndRefreshTable() {
        const table = document.querySelector(".abmat-table");
        if (!table || !state.data) return 0;

        const forfaitJour = computeForfaitJour();
        const month = C.computeMonthTotal(state.data.days, forfaitJour);

        // Rafraîchit l'affichage de chaque jour (une ligne "slot=1" par jour).
        const rows = Array.from(table.querySelectorAll('tbody tr[data-date][data-slot="1"]'));
        rows.forEach((tr) => updateDayRow(tr.getAttribute("data-date")));

        // Totaux par semaine, depuis le détail par jour du calcul.
        const weekSpans = Array.from(table.querySelectorAll("[data-week-total][data-week-start][data-week-end]"));
        weekSpans.forEach((sp) => {
            const start = sp.getAttribute("data-week-start");
            const end = sp.getAttribute("data-week-end");
            if (!start || !end) return;

            let sum = 0;
            Object.keys(month.perDay).forEach((iso) => {
                // Comparaison lexicographique OK pour YYYY-MM-DD
                if (iso >= start && iso <= end) sum += month.perDay[iso];
            });

            sp.textContent = U.fmtEuro(U.round2(sum));
        });

        return month.monthTotal;
    }

    function updateSummary(monthAbatt) {
        const resultsEl = document.getElementById("month-results");
        if (!resultsEl || !state.data) return;

        const net = Number.isFinite(Number(state.data.netImposable)) ? Number(state.data.netImposable) : 0;
        const irf = Number.isFinite(Number(state.data.irf)) ? Number(state.data.irf) : 0;

        const percu = U.round2(net + irf);
        const imposable = Math.max(0, U.round2(percu - (monthAbatt || 0)));

        if (typeof R.updateMonthSummaryComputed === "function") {
            R.updateMonthSummaryComputed(resultsEl, {
                abatt: monthAbatt || 0,
                percu,
                imposable
            });
        }
    }

    // --- Callbacks UI ---------------------------------------------------------

    function onPeriodChange(next) {
        state.year = Number(next.year);
        state.monthIndex = Number(next.monthIndex);
        loadAndRenderMonth(true);
    }

    function onSmicOverrideChange(nextOverride) {
        if (!state.data) return;
        state.data.smicOverride = (typeof nextOverride === "number" && Number.isFinite(nextOverride)) ? nextOverride : null;
        saveNow();

        // Le forfait change => recalcul table + récap
        renderAll(false);
        fillTableFromData();
        const monthAbatt = computeMonthTotalAbattAndRefreshTable();
        updateSummary(monthAbatt);
        saveNow();
    }

    function onTimeChange(chg) {
        if (!state.data) return;

        ensureDayObj(chg.isoDate);
        const slotKey = String(chg.slot);
        state.data.days[chg.isoDate].slots[slotKey][chg.kind] = chg.value || "";

        saveNow();

        const monthAbatt = (function () {
            // recalcul uniquement la ligne modifiée + total mois (sans recalc complet, mais simple et fiable)
            updateDayRow(chg.isoDate);
            return computeMonthTotalAbattAndRefreshTable();
        })();

        updateSummary(monthAbatt);
        saveNow();
    }

    function onMoneyChange(chg) {
        if (!state.data) return;

        // Compat : month-summary peut envoyer {net, irf} ou {netImposable, irf}
        const netVal = (chg && typeof chg === "object")
            ? (chg.netImposable ?? chg.net ?? 0)
            : 0;
        const irfVal = (chg && typeof chg === "object")
            ? (chg.irf ?? 0)
            : 0;

        state.data.netImposable = Number.isFinite(Number(netVal)) ? Number(netVal) : 0;
        state.data.irf = Number.isFinite(Number(irfVal)) ? Number(irfVal) : 0;
        saveNow();

        const monthAbatt = computeMonthTotalAbattAndRefreshTable();
        updateSummary(monthAbatt);
        saveNow();
    }

    function onPrint() {
        window.print();
    }

    function onExport() {
        saveNow();
        S.exportMonthToJsonFile(state.key, state.data);
    }

    async function onImportRequest(file) {
        if (!file) {
            alert("Sélectionnez d’abord un fichier JSON à importer.");
            return;
        }
        setToolbarLoadUI("loading", file && file.name ? file.name : "");

        try {
            const text = await file.text();

            // Si mismatch : on demande confirmation, puis on autorise l’adaptation
            let allowMismatch = false;
            try {
                const parsed = JSON.parse(text);
                const mismatch = (Number(parsed.year) !== Number(state.year)) || (Number(parsed.monthIndex) !== Number(state.monthIndex));
                if (mismatch) {
                    allowMismatch = confirm(
                        "Ce fichier ne correspond pas au mois/année actuellement sélectionné.\n" +
                        "Voulez-vous quand même l’importer dans le mois affiché ?"
                    );
                    if (!allowMismatch) {
                        setToolbarLoadUI("idle", "");
                        return;
                    }
                }
            } catch (e) {
                // on laisse importMonthFromJsonText gérer l’erreur
            }

            const res = S.importMonthFromJsonText(text, state.year, state.monthIndex, allowMismatch);
            state.data = res.data;
            saveNow();

            // Re-render complet + refill + recalcul
            renderAll(false);
            fillTableFromData();
            const monthAbatt = computeMonthTotalAbattAndRefreshTable();
            updateSummary(monthAbatt);
            saveNow();
            setToolbarLoadUI("loaded", file && file.name ? file.name : "");
        } catch (e) {
            setToolbarLoadUI("error", file && file.name ? file.name : "");
            alert("Impossible d’importer ce fichier : " + (e && e.message ? e.message : String(e)));
        }
    }

    // --- Toolbar sticky (actions + contexte) ---------------------------------

    function getMonthLabelFR(monthIndex) {
        const d = new Date(2000, Number(monthIndex) || 0, 1);
        let s = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(d);
        // "février" -> "Février"
        s = s.charAt(0).toUpperCase() + s.slice(1);
        return s;
    }

    function updateToolbarContextText() {
        const ctx = document.querySelector('[data-toolbar-context]');
        if (!ctx) return;
        const y = Number(state.year);
        if (isRecapMode()) {
            ctx.textContent = `• Récap ${y}`;
            return;
        }
        const m = getMonthLabelFR(state.monthIndex);
        ctx.textContent = `• ${m} ${y}`;
    }

        // --- Toolbar: état import ("Charger les données") ------------------------

    const toolbarDataState = {
        status: "idle", // idle | loading | loaded | error
        fileName: ""
    };

    function getToolbarLoadButton() {
        return document.querySelector('[data-toolbar-action="load"], [data-toolbar-action="import"]');
    }

    function getToolbarLoadStatusEl() {
        return document.querySelector('[data-toolbar-load-status]');
    }

    function setToolbarLoadUI(nextStatus, fileName) {
        toolbarDataState.status = nextStatus || "idle";
        toolbarDataState.fileName = (typeof fileName === "string") ? fileName : "";

        const btn = getToolbarLoadButton();
        const statusEl = getToolbarLoadStatusEl();

        if (btn) {
            btn.classList.remove("is-idle", "is-loading", "is-loaded", "is-error");
            btn.classList.add(
                toolbarDataState.status === "loading" ? "is-loading" :
                toolbarDataState.status === "loaded" ? "is-loaded" :
                toolbarDataState.status === "error" ? "is-error" :
                "is-idle"
            );

            // Désactive pendant le chargement
            btn.disabled = (toolbarDataState.status === "loading");

            // Libellé: on tente de cibler un sous-élément si présent, sinon textContent
            const labelNode = btn.querySelector('[data-toolbar-load-label]') || btn;
            if (toolbarDataState.status === "loading") {
                labelNode.textContent = "Chargement…";
            } else if (toolbarDataState.status === "loaded") {
                labelNode.textContent = "Données chargées";
            } else {
                labelNode.textContent = "Charger les données";
            }

            // Accessibilité
            btn.setAttribute(
                "aria-label",
                toolbarDataState.status === "loaded" && toolbarDataState.fileName
                    ? ("Données chargées : " + toolbarDataState.fileName)
                    : (toolbarDataState.status === "loading" ? "Chargement des données" : "Charger des données")
            );
        }

        if (statusEl) {
            if (toolbarDataState.status === "loaded" && toolbarDataState.fileName) {
                statusEl.textContent = "✅ " + toolbarDataState.fileName;
                statusEl.style.display = "";
            } else if (toolbarDataState.status === "error") {
                statusEl.textContent = "❌ Import impossible";
                statusEl.style.display = "";
            } else {
                statusEl.textContent = "";
                statusEl.style.display = "none";
            }
        }
    }

    function setToolbarContextVisible(visible) {
        const bar = document.getElementById("app-toolbar");
        if (!bar) return;
        if (visible) bar.classList.remove("app-toolbar--context-hidden");
        else bar.classList.add("app-toolbar--context-hidden");
    }

    // --- Toolbar sticky : mode compact quand on quitte le hero ---------------

    function attachToolbarShrinkObserver() {
        const bar = document.getElementById("app-toolbar");
        const sentinel = document.getElementById("period-sentinel");
        if (!bar || !sentinel || typeof IntersectionObserver !== "function") return;

        const obs = new IntersectionObserver(
            (entries) => {
                const e = entries && entries[0] ? entries[0] : null;
                if (!e) return;
                // Sentinel visible => on est encore sur le hero => toolbar "large"
                // Sentinel non visible => on a scrollé => toolbar "compact"
                bar.classList.toggle("app-toolbar--compact", !e.isIntersecting);
            },
            { root: null, threshold: 0 }
        );

        obs.observe(sentinel);
    }


    function initToolbarSticky() {
        const bar = document.getElementById("app-toolbar");
        if (!bar) return;

        // 2) Contexte (mois/année) : visible uniquement si on a scrollé sous la section Période
        // IMPORTANT : #period-section peut être rendu après (via renderPeriodSelector).
        // => On démarre toujours avec le contexte CACHÉ pour éviter tout flash au chargement.
        setToolbarContextVisible(false);

        function attachPeriodObserver() {
            const periodSection = document.getElementById("period-section");
            if (!periodSection || typeof IntersectionObserver !== "function") {
                // Fallback : on reste caché (zéro flash)
                return false;
            }

            const obs = new IntersectionObserver(
                (entries) => {
                    const e = entries && entries[0] ? entries[0] : null;
                    if (!e) return;
                    // Visible => on cache (redondant)
                    // Pas visible => on affiche seulement si on a scrollé APRES la période (donc si elle est au-dessus)
                    if (e.isIntersecting) {
                        setToolbarContextVisible(false);
                    } else {
                        const scrolledPast = e.boundingClientRect.top < 0;
                        setToolbarContextVisible(scrolledPast);
                    }
                },
                { root: null, threshold: 0.01 }
            );

            obs.observe(periodSection);
            return true;
        }

        // On tente tout de suite, puis on retente juste après le premier render si besoin.
        if (!attachPeriodObserver()) {
            setTimeout(attachPeriodObserver, 0);
        }
    }

    // --- Rendu global ---------------------------------------------------------

        function setElVisible(el, visible) {
        if (!el) return;
        el.style.display = visible ? "" : "none";
    }

    function isRecapMode() {
        return Number(state.monthIndex) === 12;
    }

    function renderAll(initialRender) {
        const periodEl = U.safeEl("period-selector");
        const explainEl = U.safeEl("explain");
        const yearParamsEl = U.safeEl("year-params");
        const tableEl = U.safeEl("month-table");

        // 1) Sélecteurs (on peut re-render, c’est léger)
        R.renderPeriodSelector(periodEl, { year: state.year, monthIndex: state.monthIndex }, onPeriodChange);

        // Toolbar : met à jour le texte mois/année (si présent)
        updateToolbarContextText();

        const recapMode = isRecapMode();

        const payslipSection = document.getElementById("payslip-section");
        const resultsSection = document.getElementById("month-results-section");
        const tableSection = document.getElementById("month-table-section");
        const tableRoot = document.getElementById("month-table");

        // Affichage : en mode RÉCAP on masque les éléments mensuels.
        setElVisible(payslipSection, !recapMode);
        setElVisible(tableSection, !recapMode);
        // Fallback si le conteneur section n'existe pas
        setElVisible(tableRoot, !recapMode);

    if (recapMode) {
        // Titres dynamiques : RÉCAP
        if (resultsSection) {
            const h2 = resultsSection.querySelector("h2");
            if (h2) h2.textContent = `Récap annuel — ${state.year}`;
        }

        // RÉCAP annuel — rendu avec les données réelles (compute)
        const resultsEl = document.getElementById("month-results");
        const Compute = window.ABMAT && window.ABMAT.compute;

        if (!resultsEl) {
            // rien
        } else if (typeof R.renderYearRecap !== "function") {
            resultsEl.textContent = "Erreur : renderYearRecap() non chargé (vérifie l’ordre des scripts).";
        } else if (!Compute || typeof Compute.computeYearRecap !== "function") {
            resultsEl.textContent = "Erreur : computeYearRecap() non chargé (vérifie l’ordre des scripts).";
        } else {
            const recap = Compute.computeYearRecap(state.year);

            R.renderYearRecap(resultsEl, recap, (monthIdx) => {
                state.monthIndex = Number(monthIdx);
                loadAndRenderMonth(true);
            });
        }
    } else {
            // Titres dynamiques : mensuel
            const monthLabel = getMonthLabelFR(state.monthIndex);
            const yearLabel = state.year;

            if (payslipSection) {
                const h2 = payslipSection.querySelector("h2");
                if (h2) h2.textContent = `Déclaration du mois — ${monthLabel} ${yearLabel}`;
            }

            if (resultsSection) {
                const h2 = resultsSection.querySelector("h2");
                if (h2) h2.textContent = `Résultats du mois — ${monthLabel} ${yearLabel}`;
            }
        }

        // 1bis) Explication (non interactif)
        if (explainEl && typeof R.renderExplain === "function") {
            R.renderExplain(explainEl, {
                year: state.year,
                forfaitJour: computeForfaitJour()
            });
        }

        // 2) Paramètres année
        const coeff = getCoefficient();
        const forfaitJour = computeForfaitJour();

        R.renderYearRules(
            yearParamsEl,
            {
                year: state.year,
                coefficient: coeff,
                forfaitJour,
                smicOverride: state.data ? state.data.smicOverride : null
            },
            () => {
                const info = getSmicInfo();
                return { smicFromConfig: info.smicFromConfig, smicEffective: info.smicEffective };
            },
            onSmicOverrideChange
        );

        // 3) Tableau
        if (!isRecapMode()) {
            R.renderMonthTable(tableEl, { year: state.year, monthIndex: state.monthIndex }, onTimeChange);
        }

        // 4) Déclaration du mois (fiche de paie)
        if (!isRecapMode()) {
            const payslipEl = document.getElementById("payslip-inputs");
            if (payslipEl && typeof R.renderPayslipInputs === "function") {
            R.renderPayslipInputs(
                payslipEl,
                {
                    netImposable: state.data ? state.data.netImposable : 0,
                    irf: state.data ? state.data.irf : 0
                },
                onMoneyChange
            );
            }
        }

        // 5) Résultats du mois (calculés)
        if (!isRecapMode()) {
            const resultsEl = document.getElementById("month-results");
            if (resultsEl && typeof R.renderMonthSummary === "function") {
                R.renderMonthSummary(
                    resultsEl,
                    {
                        year: state.year,
                        monthIndex: state.monthIndex
                    }
                );
            }

            // 5) Actions : branchées sur la toolbar sticky (export / import / print)
            if (typeof R.renderActions === "function") {
                R.renderActions(null, { year: state.year, monthIndex: state.monthIndex }, onPrint, onExport, onImportRequest);
            }

            // 6) Date d’édition
            if (typeof R.renderGeneratedDate === "function") {
                R.renderGeneratedDate();
            }
        }

        if (initialRender) {
            // À l’init, on s’assure que la locale FR est posée
            // (utile pour l’affichage 24h des <input type="time"> selon navigateur/OS).
            U.forceFrenchLocale();
        }
    }

    // --- Chargement mois ------------------------------------------------------

    function loadAndRenderMonth(initialRender) {
        if (Number(state.monthIndex) === 12) {
            state.key = null;
            state.data = null;
            renderAll(!!initialRender);
            return;
        }

        const loaded = S.loadMonth(state.year, state.monthIndex);
        state.key = loaded.key;
        state.data = loaded.data;

        renderAll(!!initialRender);
        fillTableFromData();

        const monthAbatt = computeMonthTotalAbattAndRefreshTable();
        updateSummary(monthAbatt);
        saveNow();
    }

    // --- Init -----------------------------------------------------------------

    document.addEventListener("DOMContentLoaded", () => {
        // Locale FR (24h)
        U.forceFrenchLocale();

        // Mois/année par défaut : "maintenant"
        const now = new Date();
        state.year = now.getFullYear();
        state.monthIndex = now.getMonth();

        initToolbarSticky();
        attachToolbarShrinkObserver();
        setToolbarLoadUI("idle", "");
        loadAndRenderMonth(true);
        if (typeof window.initTutoModal === "function") window.initTutoModal();
    });
})();

function initTutoModal() {
    const modal = document.getElementById("tuto-modal");
    if (!modal) return;

    const panel = modal.querySelector(".modal__panel");
    const openBtns = document.querySelectorAll("[data-open-tuto]");
    const closeBtns = modal.querySelectorAll("[data-close-tuto]");

    let lastActiveEl = null;

    const setOpen = (isOpen) => {
        modal.setAttribute("aria-hidden", isOpen ? "false" : "true");
        if (isOpen) {
            lastActiveEl = document.activeElement;
            document.body.style.overflow = "hidden";
            if (panel) panel.focus();
        } else {
            document.body.style.overflow = "";
            if (lastActiveEl && lastActiveEl.focus) lastActiveEl.focus();
        }
    };

    const isOpen = () => modal.getAttribute("aria-hidden") === "false";

    openBtns.forEach((btn) => btn.addEventListener("click", () => setOpen(true)));
    closeBtns.forEach((btn) => btn.addEventListener("click", () => setOpen(false)));

    document.addEventListener("keydown", (e) => {
        if (!isOpen()) return;

        if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            return;
        }

        // Focus trap léger
        if (e.key === "Tab") {
            const focusables = modal.querySelectorAll(
                'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
            );
            if (!focusables.length) return;

            const first = focusables[0];
            const last = focusables[focusables.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });
}