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
        monthIndex: null,     // 0..11 (mois) ; 12 = RÉCAP annuel — pertinent seulement si pillar === "declaration"
        pillar: "declaration", // "accueil" | "infos" | "declaration" — 3 destinations de la toolbar
        key: null,            // abmat:YYYY-MM
        data: null            // monthData
    };

    const PILLAR_KEY = "abmat:ui:pillar";

    function persistPillar() {
        try { localStorage.setItem(PILLAR_KEY, state.pillar); } catch (e) { /* non bloquant */ }
    }

    // Utilisé à l'init (quel pilier par défaut ?) et par la bannière de
    // restauration (a-t-on quelque chose à proposer de restaurer ?).
    function hasAnyMonthData() {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                if (/^abmat:\d{4}-\d{2}$/.test(localStorage.key(i) || "")) return true;
            }
            return false;
        } catch (e) {
            return true; // stockage illisible : ne pas insister
        }
    }

    // Premier lancement (aucun pilier mémorisé) : Accueil si l'appareil est
    // vraiment vierge, sinon Déclaration pour ne pas perturber une habitude
    // déjà prise (mise à jour de l'outil sur un appareil déjà utilisé).
    function loadInitialPillar() {
        try {
            const saved = localStorage.getItem(PILLAR_KEY);
            if (saved === "accueil" || saved === "infos" || saved === "declaration") return saved;
        } catch (e) { /* fallback ci-dessous */ }
        return hasAnyMonthData() ? "declaration" : "accueil";
    }

    // Profil « Mes informations » — chargé une fois, muté par la vue Infos.
    let profile = null;

    function getProfile() {
        if (!profile) profile = S.loadProfile() || S.blankProfile();
        return profile;
    }

    function onProfileChange() {
        if (S.saveProfile(getProfile())) {
            updateSavedIndicator();
        }
    }

    // Prénoms pour l'affichage du tableau (clé -> prénom non vide).
    function getChildNamesMap() {
        const map = {};
        const p = getProfile();
        for (let i = 1; i <= 3; i++) {
            const k = String(i);
            const c = p.children[k];
            if (c && typeof c.name === "string" && c.name.trim() !== "") map[k] = c.name.trim();
        }
        return map;
    }

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

    function updateSavedIndicator() {
        const el = document.querySelector("[data-saved-indicator]");
        if (!el) return;
        const now = new Date();
        el.textContent = `✓ Enregistré à ${U.pad2(now.getHours())}:${U.pad2(now.getMinutes())}`;
        el.hidden = false;
    }

    // --- Sauvegarde automatique (dossier via File System Access API) --------

    let autosaveTimer = null;
    const mergedYears = {}; // années déjà fusionnées depuis le dossier (par session)

    function updateAutosaveIndicator(status) {
        const el = document.querySelector("[data-autosave]");
        if (!el) return;
        if (status === "unsupported") {
            el.hidden = true;
            return;
        }
        el.hidden = false;
        el.classList.remove("is-ok", "is-warn");
        if (status === "ok" || status === "ready") {
            el.classList.add("is-ok");
            el.textContent = (status === "ok") ? "Fichier à jour ✓" : "Sauvegarde auto activée";
            el.title = "La sauvegarde s'écrit automatiquement dans votre dossier. Cliquez pour changer de dossier.";
        } else {
            el.classList.add("is-warn");
            el.textContent = (status === "permission") ? "⚠ Réactiver la sauvegarde auto" : "⚠ Activer la sauvegarde auto";
            el.title = "Cliquez pour choisir le dossier de sauvegarde automatique (ex. OneDrive).";
        }
    }

    function scheduleAutosave() {
        const A = window.ABMAT.autosave;
        if (!A || !A.isSupported()) return;
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => {
            A.writeYear(state.year, S.buildYearExport(state.year)).then((res) => {
                if (res.status === "ok") S.setLastMergedAt(new Date().toISOString());
                updateAutosaveIndicator(res.status);
            });
        }, 600);
    }

    // Arbitrage d'un conflit de fusion (même mois modifié sur deux appareils).
    function makeConflictResolver(year) {
        return (monthIdx, fileAt, localAt) => {
            const okFile = confirm(
                `Le mois de ${getMonthLabelFR(monthIdx)} ${year} a été modifié sur deux appareils.\n\n` +
                `OK : garder la version du fichier (${new Date(fileAt).toLocaleString("fr-FR")})\n` +
                `Annuler : garder celle de cet appareil (${new Date(localAt).toLocaleString("fr-FR")})`
            );
            return okFile ? "file" : "local";
        };
    }

    // Relit le fichier du dossier et fusionne (récupère la saisie d'un autre
    // appareil). Une fois par année et par session.
    function mergeFromFolder(year) {
        const A = window.ABMAT.autosave;
        if (!A || !A.isSupported() || mergedYears[year]) return;
        mergedYears[year] = true;

        A.readYear(year).then((text) => {
            if (!text) return;
            try {
                const res = S.mergeYearFromJsonText(text, {
                    lastMergedAt: S.getLastMergedAt(),
                    resolveConflict: makeConflictResolver(year)
                });
                if (res.applied > 0 && Number(state.year) === Number(year)) {
                    loadAndRenderMonth(false); // affiche ce qui vient d'un autre appareil
                }
            } catch (e) {
                console.warn("Fusion du fichier de sauvegarde impossible :", e);
            }
        });
    }

    function saveNow() {
        if (!state.key || !state.data) return;
        if (S.saveMonth(state.key, state.data)) {
            updateSavedIndicator();
            scheduleAutosave();
        }
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
                hoursEl.title = "Horaire incomplet ou sortie avant l'entrée — corrigez ce créneau.";
                abattEl.title = hoursEl.title;
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

        // Rafraîchit l'affichage de chaque jour (une carte .day-row par jour).
        const rows = Array.from(table.querySelectorAll(".day-row[data-date]"));
        rows.forEach((row) => updateDayRow(row.getAttribute("data-date")));

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

        // Total du mois visible en permanence dans la toolbar sticky.
        const totalEl = document.querySelector("[data-toolbar-total]");
        if (totalEl) {
            totalEl.textContent = `Abattement : ${U.fmtEuro(monthAbatt || 0)}`;
            totalEl.hidden = false;
        }
    }

    // --- Callbacks UI ---------------------------------------------------------

    function onPeriodChange(next) {
        state.year = Number(next.year);
        state.monthIndex = Number(next.monthIndex);
        loadAndRenderMonth(true);
    }

    // Bascule entre les 3 destinations de la toolbar (onglets texte).
    function switchPillar(pillar) {
        if (pillar !== "accueil" && pillar !== "infos" && pillar !== "declaration") return;
        state.pillar = pillar;
        persistPillar();
        loadAndRenderMonth(true);
    }

    function goToMonth(monthIndex) {
        state.pillar = "declaration";
        state.monthIndex = Number(monthIndex);
        persistPillar();
        loadAndRenderMonth(true);
    }

    function goToRecap() { goToMonth(12); }

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
        if (tableEl && !isRecapMode() && !isInfosMode()) {
            R.renderMonthTable(tableEl, buildTableState(), tableHandlers);
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
        onWeekCopy,
        onPrefill
    };

    // État complet passé au renderer du tableau.
    function buildTableState() {
        return {
            year: state.year,
            monthIndex: state.monthIndex,
            data: state.data,
            childNames: getChildNamesMap(),
            prefillAvailable: isPrefillAvailable()
        };
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

    // --- Impression : gabarit dédié (#print-doc), seul visible à l'impression

    function buildRulesLabels() {
        const info = getSmicInfo();
        const smic = Number.isFinite(Number(info.smicEffective)) ? Number(info.smicEffective) : null;
        return {
            year: state.year,
            smicLabel: (smic !== null) ? U.fmtEuro(smic) : "non renseigné",
            forfaitLabel: U.fmtEuro(computeForfaitJour())
        };
    }

    function buildPrintDoc() {
        // Aucune cible d'impression hors Déclaration (l'icône y est masquée).
        if (state.pillar !== "declaration") return;

        const root = document.getElementById("print-doc");
        if (!root) return;

        const Compute = window.ABMAT.compute;

        if (isRecapMode()) {
            R.renderPrintYear(root, Compute.computeYearRecap(state.year), buildRulesLabels());
            return;
        }

        if (!state.data) return;
        const model = Compute.buildMonthPrintModel(
            state.year, state.monthIndex, state.data, computeForfaitJour()
        );
        model.rules = buildRulesLabels();
        R.renderPrintMonth(root, model);
    }

    function onPrint() {
        buildPrintDoc();
        window.print();
    }

    // Cmd/Ctrl+P sans passer par le bouton : on construit le document au vol.
    window.addEventListener("beforeprint", buildPrintDoc);

    function onExport() {
        saveNow();

        // Sur iPhone/iPad : feuille de partage (→ « Enregistrer dans Fichiers »
        // / OneDrive) plutôt qu'un téléchargement peu visible sur iOS.
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS && typeof navigator.canShare === "function") {
            const json = JSON.stringify(S.buildYearExport(state.year), null, 2);
            const shareFile = new File([json], `abattement-assmat-${state.year}.json`, { type: "application/json" });
            if (navigator.canShare({ files: [shareFile] })) {
                navigator.share({ files: [shareFile] })
                    .then(() => S.setLastMergedAt(new Date().toISOString()))
                    .catch(() => { /* partage annulé : rien à faire */ });
                return;
            }
        }

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

            // --- Sauvegarde d'année (format "abmat-year") : FUSION ----------
            if (parsed && parsed.format === "abmat-year") {
                const y = Number(parsed.year);
                const okGo = confirm(
                    `Ce fichier contient la sauvegarde de l’année ${y}.\n` +
                    `La fusionner avec les données de cet appareil ?\n` +
                    `(pour chaque mois, la version la plus récente est conservée)`
                );
                if (!okGo) {
                    setToolbarLoadUI("idle", "");
                    return;
                }

                const res = S.mergeYearFromJsonText(text, {
                    lastMergedAt: S.getLastMergedAt(),
                    resolveConflict: makeConflictResolver(y)
                });
                state.pillar = "declaration"; // montre le résultat même importé depuis Accueil/Infos
                state.year = res.year;
                state.monthIndex = 12; // vue RÉCAP : montre d'un coup le résultat de la fusion
                persistPillar();
                loadAndRenderMonth(false);
                hideRestoreBanner();
                scheduleAutosave();
                setToolbarLoadUI("loaded", file.name);
                return;
            }

            // --- Fichier "mois" (ancien format) -----------------------------
            // Depuis RÉCAP/Accueil/Infos, on bascule d'abord sur le mois du fichier.
            if (!isMonthMode()) {
                const my = Number(parsed.year);
                const mi = Number(parsed.monthIndex);
                if (!Number.isFinite(my) || !Number.isFinite(mi) || mi < 0 || mi > 11) {
                    throw new Error("Fichier de mois invalide (année/mois manquants).");
                }
                state.pillar = "declaration";
                state.year = my;
                state.monthIndex = mi;
                persistPillar();
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
            hideRestoreBanner();
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
        const totalEl = document.querySelector("[data-toolbar-total]");

        if (state.pillar !== "declaration") {
            // Accueil / Mes informations : l'onglet actif suffit, pas de contexte
            // supplémentaire à afficher (et pas de total mensuel hors Déclaration).
            ctx.textContent = "";
            if (totalEl) totalEl.hidden = true;
            return;
        }

        const y = Number(state.year);
        if (isRecapMode()) {
            ctx.textContent = `• Récap ${y}`;
            if (totalEl) totalEl.hidden = true; // le total mensuel n'a pas de sens ici
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

    // --- Toolbar + nav : fusion visuelle une fois qu'on a quitté le hero -----
    //
    // #period-section (la nav mois/année) vit maintenant DANS #topbar-group,
    // sticky avec la toolbar : un IntersectionObserver posé directement sur un
    // élément sticky resterait "intersecting" en permanence une fois collé
    // (il reste visible à l'écran), donc on observe plutôt #period-sentinel
    // (placé juste après le groupe, hors flux sticky) — un seul signal pilote
    // à la fois le mode compact, la fusion toolbar/nav et le texte de contexte.

    function attachToolbarShrinkObserver() {
        const bar = document.getElementById("app-toolbar");
        const group = document.getElementById("topbar-group");
        const sentinel = document.getElementById("period-sentinel");
        if (!bar || !group || !sentinel || typeof IntersectionObserver !== "function") return;

        const obs = new IntersectionObserver(
            (entries) => {
                const e = entries && entries[0] ? entries[0] : null;
                if (!e) return;
                // Sentinel visible => on est encore sur le hero => groupe "large"
                // Sentinel non visible => on a scrollé => groupe "collé/fusionné"
                const stuck = !e.isIntersecting;
                bar.classList.toggle("app-toolbar--compact", stuck);
                group.classList.toggle("topbar-group--stuck", stuck);
                setToolbarContextVisible(stuck);
            },
            { root: null, threshold: 0 }
        );

        obs.observe(sentinel);
    }

    function initToolbarSticky() {
        // Contexte (mois/année) caché par défaut : pas de flash au chargement,
        // attachToolbarShrinkObserver() prend le relais dès le premier scroll.
        setToolbarContextVisible(false);
    }

    // --- Rendu global ---------------------------------------------------------

        function setElVisible(el, visible) {
        if (!el) return;
        el.style.display = visible ? "" : "none";
    }

    function isRecapMode() {
        return state.pillar === "declaration" && Number(state.monthIndex) === 12;
    }

    function isInfosMode() {
        return state.pillar === "infos";
    }

    function isAccueilMode() {
        return state.pillar === "accueil";
    }

    function isMonthMode() {
        return state.pillar === "declaration" && !isRecapMode();
    }

    // Un mois affiché sans aucune donnée peut être pré-rempli depuis les
    // semaines types (action volontaire — jamais automatique).
    function isPrefillAvailable() {
        if (!state.data) return false;
        const days = state.data.days || {};
        const hasAny = Object.keys(days).some((iso) => dayHasData(days[iso]));
        if (hasAny) return false;
        const Compute = window.ABMAT.compute;
        return Compute.profileHasTemplates(getProfile());
    }

    function onPrefill() {
        if (!state.data) return;
        const Compute = window.ABMAT.compute;
        state.data.days = Compute.buildMonthDaysFromProfile(state.year, state.monthIndex, getProfile());
        saveNow();
        rerenderTableAndRecalc();
    }

    // --- Écran Accueil : contexte adaptatif (profil, mois en cours, récap) --

    function computeAccueilContext() {
        const p = getProfile();
        const hasIdentity = typeof p.name === "string" && p.name.trim() !== "";
        const hasChildName = ["1", "2", "3"].some((k) => (
            p.children[k] && typeof p.children[k].name === "string" && p.children[k].name.trim() !== ""
        ));
        const profileEmpty = !hasIdentity && !hasChildName;

        const now = new Date();
        const nowYear = now.getFullYear();
        const nowMonthIndex = now.getMonth();

        const monthData = S.loadMonth(nowYear, nowMonthIndex).data;
        let totalWorkingDays = 0;
        const totalDaysInMonth = U.daysInMonth(nowYear, nowMonthIndex);
        for (let d = 1; d <= totalDaysInMonth; d++) {
            if (!U.isWeekend(new Date(nowYear, nowMonthIndex, d))) totalWorkingDays++;
        }
        const filledDays = Object.keys(monthData.days || {})
            .filter((iso) => dayHasData(monthData.days[iso])).length;

        const Compute = window.ABMAT.compute;
        const yearRecap = Compute.computeYearRecap(nowYear);
        const activeChildren = ["1", "2", "3"]
            .filter((k) => p.children[k] && p.children[k].active !== false).length;

        return {
            userName: hasIdentity ? p.name.trim().split(/\s+/)[0] : "",
            profileEmpty,
            currentMonthLabel: `${getMonthLabelFR(nowMonthIndex).toLowerCase()} ${nowYear}`,
            currentDaysFilled: filledDays,
            currentDaysTotal: totalWorkingDays,
            yearLabel: nowYear,
            yearImposableToDate: yearRecap.totals.imposable,
            childrenActiveCount: activeChildren,
            _nowYear: nowYear,
            _nowMonthIndex: nowMonthIndex
        };
    }

    function renderAccueilScreen() {
        const accueilEl = document.getElementById("accueil-quick");
        if (!accueilEl || typeof R.renderAccueil !== "function") return;

        const explainEl = document.getElementById("explain");
        if (explainEl && typeof R.renderExplain === "function") {
            R.renderExplain(explainEl);
        }

        const ctx = computeAccueilContext();
        R.renderAccueil(accueilEl, ctx, {
            onGoMonth: () => goToMonth(ctx._nowMonthIndex, ctx._nowYear),
            onGoRecap: () => goToRecap(ctx._nowYear),
            onGoInfos: () => switchPillar("infos"),
            onOpenTuto: () => {
                const btn = document.querySelector("[data-open-tuto]");
                if (btn) btn.click();
            }
        });
    }

    // Reflète le pilier actif sur les 3 onglets texte de la toolbar.
    function updatePillarTabs() {
        document.querySelectorAll(".pillar-tab").forEach((btn) => {
            const active = btn.getAttribute("data-pillar") === state.pillar;
            btn.classList.toggle("on", active);
            btn.setAttribute("aria-selected", active ? "true" : "false");
        });
    }

    function renderAll(initialRender) {
        updatePillarTabs();
        updateToolbarContextText();

        const accueilMode = isAccueilMode();
        const infosMode = isInfosMode();
        const declarationMode = state.pillar === "declaration";

        setElVisible(document.getElementById("accueil-section"), accueilMode);
        setElVisible(document.getElementById("infos-section"), infosMode);
        setElVisible(document.getElementById("period-section"), declarationMode);
        setElVisible(document.getElementById("content-grid"), declarationMode);

        // Imprimer n'a de cible valable que sous Déclaration (mois ou récap).
        document.querySelectorAll('[data-toolbar-action="print"]').forEach((btn) => {
            setElVisible(btn, declarationMode);
        });

        // Actions toolbar (Données, Imprimer, onglets) : liées une seule fois
        // (garde interne), mais appelées à chaque rendu pour rester robuste
        // quel que soit le premier pilier affiché au chargement.
        if (typeof R.renderActions === "function") {
            R.renderActions(null, { year: state.year, monthIndex: state.monthIndex }, onPrint, onExport, onImportRequest, switchPillar);
        }

        if (accueilMode) {
            renderAccueilScreen();
            if (initialRender) U.forceFrenchLocale();
            return;
        }

        if (infosMode) {
            const infosEl = document.getElementById("infos-content");
            if (infosEl) R.renderInfos(infosEl, getProfile(), { onChange: onProfileChange });
            if (initialRender) U.forceFrenchLocale();
            return;
        }

        // --- Pilier Déclaration : navigation + mois/récap (inchangé) ---------

        const periodEl = U.safeEl("period-selector");
        const yearParamsEl = U.safeEl("year-params");
        const tableEl = U.safeEl("month-table");

        R.renderPeriodSelector(
            periodEl,
            { year: state.year, monthIndex: state.monthIndex, declaredYears: S.getDeclaredYears() },
            onPeriodChange
        );

        const recapMode = isRecapMode();
        const overviewMode = recapMode; // Infos ne fait plus partie de ce groupe

        const payslipSection = document.getElementById("payslip-section");
        const resultsSection = document.getElementById("month-results-section");
        const tableSection = document.getElementById("month-table-section");
        const tableRoot = document.getElementById("month-table");
        const resultsHint = resultsSection ? resultsSection.querySelector(".hint") : null;

        setElVisible(payslipSection, !overviewMode);
        setElVisible(tableSection, !overviewMode);
        setElVisible(tableRoot, !overviewMode);

        // Grille 2 colonnes (résultat collant) en vue mensuelle uniquement ;
        // en RÉCAP le tableau/la fiche de paie sont masqués, une seule
        // colonne pleine largeur est plus lisible pour son contenu.
        const contentGrid = document.getElementById("content-grid");
        if (contentGrid) contentGrid.classList.toggle("content-grid--single", overviewMode);

        if (recapMode) {
            if (resultsSection) {
                const h2 = resultsSection.querySelector("h2");
                if (h2) h2.textContent = `Récap annuel — ${state.year}`;
            }
            if (resultsHint) {
                resultsHint.textContent = "Totaux annuels, détail par mois et comparaison des régimes.";
            }

            const resultsEl = document.getElementById("month-results");
            const Compute = window.ABMAT && window.ABMAT.compute;

            if (resultsEl) {
                const recap = Compute.computeYearRecap(state.year);
                const declared = S.isYearDeclared(state.year);

                R.renderYearRecap(
                    resultsEl,
                    recap,
                    (monthIdx) => goToMonth(Number(monthIdx)),
                    declared,
                    (checked) => {
                        S.setYearDeclared(state.year, checked);
                        // Rafraîchit le badge sur les pastilles d'années.
                        R.renderPeriodSelector(
                            U.safeEl("period-selector"),
                            { year: state.year, monthIndex: state.monthIndex, declaredYears: S.getDeclaredYears() },
                            onPeriodChange
                        );
                    }
                );
            }
        } else {
            if (resultsHint) {
                resultsHint.textContent = "Résumé des montants calculés (abattement total et montant à déclarer).";
            }
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

        // Paramètres année (toujours visibles sous Déclaration, mois comme récap)
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

        if (!overviewMode) {
            R.renderMonthTable(tableEl, buildTableState(), tableHandlers);

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

            const resultsEl = document.getElementById("month-results");
            if (resultsEl && typeof R.renderMonthSummary === "function") {
                R.renderMonthSummary(resultsEl, { year: state.year, monthIndex: state.monthIndex });
            }
        }

        if (typeof R.renderGeneratedDate === "function") {
            R.renderGeneratedDate();
        }

        if (initialRender) {
            // À l’init, on s’assure que la locale FR est posée
            // (utile pour l’affichage 24h des <input type="time"> selon navigateur/OS).
            U.forceFrenchLocale();
        }
    }

    // --- Écran de restauration (appareil sans données) ------------------------

    function initRestoreBanner() {
        const el = document.getElementById("restore-banner");
        if (!el) return;
        if (hasAnyMonthData()) return;

        el.hidden = false;
        const importBtn = el.querySelector("[data-restore-import]");
        const closeBtn = el.querySelector("[data-restore-dismiss]");
        if (importBtn) {
            importBtn.addEventListener("click", () => {
                const fileInput = document.getElementById("abmat-action-file");
                if (fileInput) fileInput.click();
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener("click", () => { el.hidden = true; });
        }
    }

    function hideRestoreBanner() {
        const el = document.getElementById("restore-banner");
        if (el) el.hidden = true;
    }

    // --- Chargement mois ------------------------------------------------------

    function loadAndRenderMonth(initialRender) {
        mergeFromFolder(state.year); // reprend l'éventuelle saisie d'un autre appareil
        if (!isMonthMode()) {
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

        // Pilier initial : mémorisé (localStorage), sinon Accueil sur un
        // appareil vraiment vierge, Déclaration sinon (habitude déjà prise).
        state.pillar = loadInitialPillar();

        // Mois/année par défaut : "maintenant"
        const now = new Date();
        state.year = now.getFullYear();
        state.monthIndex = now.getMonth();

        initToolbarSticky();
        attachToolbarShrinkObserver();
        setToolbarLoadUI("idle", "");

        // AVANT le premier rendu (qui enregistre un mois vierge) : proposer la
        // restauration si l'appareil n'a aucune donnée.
        initRestoreBanner();

        loadAndRenderMonth(true);
        if (typeof window.initTutoModal === "function") window.initTutoModal();

        // Sauvegarde automatique : état initial + activation au clic.
        const A = window.ABMAT.autosave;
        if (A && A.isSupported()) {
            A.getStatus().then(updateAutosaveIndicator);
            const autosaveEl = document.querySelector("[data-autosave]");
            if (autosaveEl) {
                autosaveEl.addEventListener("click", async () => {
                    try {
                        if (await A.ensureReady()) {
                            updateAutosaveIndicator("ready");
                            mergedYears[state.year] = false; // relit le dossier fraîchement accordé
                            mergeFromFolder(state.year);
                            scheduleAutosave();
                        }
                    } catch (e) {
                        // sélection de dossier annulée : rien à faire
                    }
                });
            }
        } else {
            updateAutosaveIndicator("unsupported");
        }

        // PWA : service worker (uniquement en http/https — pas en double-clic
        // local) + stockage déclaré persistant (protège de l'éviction
        // automatique du navigateur ; pas d'un nettoyage volontaire).
        if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
            navigator.serviceWorker.register("./sw.js").catch((e) => {
                console.warn("Service worker non enregistré :", e);
            });
        }
        if (navigator.storage && typeof navigator.storage.persist === "function") {
            navigator.storage.persist();
        }
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