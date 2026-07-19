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

    // Garantit la structure v2 d'un enfant précis d'un jour, et la retourne.
    function ensureChild(isoDate, childKey) {
        if (!state.data.days[isoDate] || typeof state.data.days[isoDate] !== "object") {
            state.data.days[isoDate] = { children: {} };
        }
        const day = state.data.days[isoDate];
        if (!day.children || typeof day.children !== "object") {
            day.children = {};
        }
        if (!day.children[childKey] || typeof day.children[childKey] !== "object") {
            day.children[childKey] = { absent: false, motif: "", slots: [] };
        }
        const child = day.children[childKey];
        if (typeof child.absent !== "boolean") child.absent = false;
        if (typeof child.motif !== "string") child.motif = "";
        if (!Array.isArray(child.slots)) child.slots = [];
        return child;
    }

    function dayHasData(dayObj) {
        const children = (dayObj && dayObj.children) ? dayObj.children : {};
        return ["1", "2", "3"].some((k) => {
            const c = children[k];
            if (!c) return false;
            if (c.absent === true) return true;
            const slots = Array.isArray(c.slots) ? c.slots : [];
            return slots.some((s) => s && ((s.in && s.in !== "") || (s.out && s.out !== "")));
        });
    }

    function isoToDate(iso) {
        const parts = String(iso).split("-").map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function shiftIso(iso, deltaDays) {
        const d = isoToDate(iso);
        d.setDate(d.getDate() + deltaDays);
        return U.toIsoDate(d);
    }

    function listWorkingDays(startIso, endIso) {
        const out = [];
        let d = isoToDate(startIso);
        const end = isoToDate(endIso);
        while (d <= end) {
            if (!U.isWeekend(d)) out.push(U.toIsoDate(d));
            d = new Date(d);
            d.setDate(d.getDate() + 1);
        }
        return out;
    }

    function saveNow() {
        if (!state.key || !state.data) return;
        S.saveMonth(state.key, state.data);
    }

    // --- UI: recalculs (le DOM affiche, l'état calcule) ----------------------

    // IMPORTANT : les calculs partent toujours de state.data (source de vérité) ;
    // le DOM n'est jamais lu pour calculer — il ne fait qu'afficher.

    function updateDayRow(isoDate) {
        const table = document.querySelector(".abmat-table");
        if (!table || !state.data) return 0;

        const forfaitJour = computeForfaitJour();
        const day = C.computeDayTotal(state.data.days[isoDate], forfaitJour);

        for (let child = 1; child <= 3; child++) {
            const hoursEl = table.querySelector(`[data-hours][data-date="${isoDate}"][data-child="${child}"]`);
            const abattEl = table.querySelector(`[data-abatt][data-date="${isoDate}"][data-child="${child}"]`);
            if (!hoursEl || !abattEl) continue;

            const r = day.perChild[String(child)];
            if (r.status === "empty") {
                hoursEl.textContent = "—";
                abattEl.textContent = "—";
            } else if (r.status === "absent") {
                hoursEl.textContent = "Absent";
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

        // Rafraîchit l'affichage de chaque jour (l'enfant 1 est toujours visible).
        const rows = Array.from(table.querySelectorAll('tbody tr[data-date][data-child="1"]'));
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
        const monthAbatt = computeMonthTotalAbattAndRefreshTable();
        updateSummary(monthAbatt);
        saveNow();
    }

    // Re-render structurel du tableau (créneaux ajoutés/retirés, absences…)
    // puis recalcul complet. Utilisé par tous les handlers qui changent la forme.
    function rerenderTableAndRecalc() {
        const tableEl = document.getElementById("month-table");
        if (tableEl && !isRecapMode()) {
            R.renderMonthTable(
                tableEl,
                { year: state.year, monthIndex: state.monthIndex, data: state.data },
                tableHandlers
            );
        }
        const monthAbatt = computeMonthTotalAbattAndRefreshTable();
        updateSummary(monthAbatt);
    }

    function onTimeChange(chg) {
        if (!state.data) return;

        const child = ensureChild(chg.isoDate, String(chg.child));
        while (child.slots.length <= chg.slotIndex) {
            child.slots.push({ in: "", out: "" });
        }
        child.slots[chg.slotIndex][chg.kind] = chg.value || "";

        saveNow();
        updateDayRow(chg.isoDate);
        const monthAbatt = computeMonthTotalAbattAndRefreshTable();
        updateSummary(monthAbatt);
        saveNow();
    }

    function onSlotAdd(chg) {
        if (!state.data) return;
        const child = ensureChild(chg.isoDate, String(chg.child));
        // Le créneau affiché sans données n'existe pas encore dans l'état :
        // on le matérialise avant d'en ajouter un second.
        if (child.slots.length === 0) child.slots.push({ in: "", out: "" });
        if (child.slots.length < 3) child.slots.push({ in: "", out: "" });
        saveNow();
        rerenderTableAndRecalc();
    }

    function onSlotRemove(chg) {
        if (!state.data) return;
        const child = ensureChild(chg.isoDate, String(chg.child));
        if (chg.slotIndex >= 0 && chg.slotIndex < child.slots.length) {
            child.slots.splice(chg.slotIndex, 1);
        }
        saveNow();
        rerenderTableAndRecalc();
    }

    function onAbsentToggle(chg) {
        if (!state.data) return;
        const child = ensureChild(chg.isoDate, String(chg.child));
        child.absent = (chg.absent === true);
        if (!child.absent) child.motif = "";
        saveNow();
        rerenderTableAndRecalc();
    }

    function onMotifChange(chg) {
        if (!state.data) return;
        const child = ensureChild(chg.isoDate, String(chg.child));
        child.motif = String(chg.motif || "");
        saveNow();
    }

    function onChildAdd(chg) {
        if (!state.data) return;
        // Révèle le premier enfant encore sans données (créneau vide matérialisé
        // pour qu'il reste visible pendant la session).
        for (let k = 1; k <= 3; k++) {
            const key = String(k);
            const day = state.data.days[chg.isoDate];
            const c = (day && day.children) ? day.children[key] : null;
            const visible = (key === "1") || (c && (c.absent === true || (Array.isArray(c.slots) && c.slots.length > 0)));
            if (!visible) {
                ensureChild(chg.isoDate, key).slots.push({ in: "", out: "" });
                break;
            }
        }
        saveNow();
        rerenderTableAndRecalc();
    }

    function onWeekCopy(chg) {
        if (!state.data || !chg.startIso || !chg.endIso) return;

        const targets = listWorkingDays(chg.startIso, chg.endIso);
        const hasExisting = targets.some((iso) => dayHasData(state.data.days[iso]));
        if (hasExisting && !confirm(
            "Remplacer les horaires de cette semaine par ceux de la semaine précédente ?"
        )) {
            return;
        }

        targets.forEach((iso) => {
            const srcIso = shiftIso(iso, -7);
            const srcDay = state.data.days[srcIso];
            if (srcDay) {
                state.data.days[iso] = JSON.parse(JSON.stringify(srcDay));
            } else {
                delete state.data.days[iso];
            }
        });

        saveNow();
        rerenderTableAndRecalc();
    }

    const tableHandlers = {
        onTimeChange,
        onSlotAdd,
        onSlotRemove,
        onAbsentToggle,
        onMotifChange,
        onChildAdd,
        onWeekCopy
    };

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
        // La sauvegarde de référence est l'année complète (fonctionne aussi depuis le RÉCAP).
        S.exportYearToJsonFile(state.year);
    }

    async function onImportRequest(file) {
        if (!file) {
            alert("Sélectionnez d’abord un fichier JSON à importer.");
            return;
        }
        setToolbarLoadUI("loading", file && file.name ? file.name : "");

        try {
            const text = await file.text();
            const parsed = JSON.parse(text);

            // --- Sauvegarde d'année (format "abmat-year") -------------------
            if (parsed && parsed.format === "abmat-year") {
                const y = Number(parsed.year);
                const okGo = confirm(
                    `Ce fichier contient la sauvegarde de l’année ${y}.\n` +
                    `Les mois déjà enregistrés pour ${y} seront remplacés. Continuer ?`
                );
                if (!okGo) {
                    setToolbarLoadUI("idle", "");
                    return;
                }

                const res = S.importYearFromJsonText(text);
                state.year = res.year;
                state.monthIndex = 12; // vue RÉCAP : montre d'un coup ce qui vient d'être importé
                loadAndRenderMonth(false);
                setToolbarLoadUI("loaded", file.name);
                return;
            }

            // --- Fichier "mois" (ancien format) -----------------------------
            // Depuis le RÉCAP, on bascule d'abord sur le mois du fichier.
            if (isRecapMode()) {
                const my = Number(parsed.year);
                const mi = Number(parsed.monthIndex);
                if (!Number.isFinite(my) || !Number.isFinite(mi) || mi < 0 || mi > 11) {
                    throw new Error("Fichier de mois invalide (année/mois manquants).");
                }
                state.year = my;
                state.monthIndex = mi;
                loadAndRenderMonth(false);
            }

            // Si mismatch : on demande confirmation, puis on autorise l’adaptation
            let allowMismatch = false;
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

            const res = S.importMonthFromJsonText(text, state.year, state.monthIndex, allowMismatch);
            state.data = res.data;
            saveNow();

            // Re-render complet + recalcul
            renderAll(false);
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

        // 3) Tableau (les valeurs sont remplies depuis state.data par le renderer)
        if (!isRecapMode()) {
            R.renderMonthTable(
                tableEl,
                { year: state.year, monthIndex: state.monthIndex, data: state.data },
                tableHandlers
            );
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