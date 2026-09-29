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
        monthIndex: null,     // 0..11 — pertinent seulement si pillar === "declaration"
        pillar: "declaration", // "accueil" | "infos" | "declaration" | "ma-declaration" — 4 destinations de la toolbar
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
            if (saved === "accueil" || saved === "infos" || saved === "declaration" || saved === "ma-declaration") return saved;
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

    // --- Enfants du profil (ids stables c1, c2… ; r1… pour l'accueil relais) --

    // Sans profil renseigné, l'outil reste utilisable avec « Enfant 1… 4 ».
    const DEFAULT_CHILD_IDS = ["c1", "c2", "c3", "c4"];

    // Enfants proposés à la saisie ce jour-là : accueillis à la date (profil).
    function candidateChildIds(isoDate) {
        const p = getProfile();
        if (p.children.length === 0) return DEFAULT_CHILD_IDS;
        return window.ABMAT.compute.childrenActiveOn(p, isoDate).map((c) => c.id);
    }

    // Lignes affichées pour un jour : enfants avec une donnée, sinon le 1er proposé.
    function childIdsForDay(isoDate, dayObj) {
        const withData = Object.keys((dayObj && dayObj.children) || {});
        const ids = withData.length ? withData : candidateChildIds(isoDate).slice(0, 1);
        return ids.slice().sort(window.ABMAT.compute.compareChildIds);
    }

    function canAddChild(isoDate, dayObj) {
        const shown = childIdsForDay(isoDate, dayObj);
        return candidateChildIds(isoDate).some((id) => !shown.includes(id));
    }

    function childLabel(id, presence) {
        return window.ABMAT.compute.childLabel(getProfile(), id, presence);
    }

    // --- SMIC de l'année (un seul par année : réglage, sinon barème) ---------

    // Forfait journalier par enfant de l'année affichée ; null si SMIC manquant.
    function currentForfait() {
        return window.ABMAT.compute.forfaitJourForYear(state.year);
    }

    // Pour les calculs : SMIC manquant → 0 € (l'écran affiche le champ SMIC).
    function computeForfaitJour() {
        const f = currentForfait();
        return (f === null) ? 0 : f;
    }

    // --- Données --------------------------------------------------------------

    // Garantit la présence (schéma v3) d'un enfant un jour, et la retourne.
    function ensureChild(isoDate, childKey) {
        if (!state.data.days[isoDate]) {
            state.data.days[isoDate] = { off: false, children: {}, meetings: [] };
        }
        const day = state.data.days[isoDate];
        if (!day.children[childKey]) {
            day.children[childKey] = { absent: false, motif: "", slots: [], punched: false };
        }
        return day.children[childKey];
    }

    function dayHasData(dayObj) {
        if (!dayObj) return false;
        if (dayObj.off === true || (dayObj.meetings && dayObj.meetings.length > 0)) return true;
        const children = dayObj.children || {};
        return Object.keys(children).some((k) => {
            const c = children[k];
            if (c.absent === true) return true;
            return c.slots.some((s) => s.in !== "" || s.out !== "");
        });
    }

    const isoToDate = U.isoToDate;

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

        table.querySelectorAll(`[data-hours][data-date="${isoDate}"]`).forEach((hoursEl) => {
            const child = hoursEl.getAttribute("data-child");
            const abattEl = table.querySelector(`[data-abatt][data-date="${isoDate}"][data-child="${child}"]`);
            if (!abattEl) return;

            // Ligne affichée sans donnée encore (enfant proposé) : rien à calculer.
            const r = day.perChild[child] || { status: "empty" };
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
        });

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
        // Solde du mois, négatif si l'abattement dépasse le perçu : le plancher
        // à 0 ne s'applique qu'au total annuel (compute/year-recap.js).
        const apres = U.round2(percu - (monthAbatt || 0));

        if (typeof R.updateMonthSummaryComputed === "function") {
            R.updateMonthSummaryComputed(resultsEl, {
                abatt: monthAbatt || 0,
                percu,
                apres
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

    const VALID_PILLARS = ["accueil", "infos", "declaration", "ma-declaration"];

    // Bascule entre les 4 destinations de la toolbar (onglets texte).
    function switchPillar(pillar) {
        if (VALID_PILLARS.indexOf(pillar) === -1) return;
        state.pillar = pillar;
        persistPillar();
        loadAndRenderMonth(true);
    }

    function goToMonth(monthIndex, year) {
        state.pillar = "declaration";
        state.monthIndex = Number(monthIndex);
        if (Number.isFinite(Number(year))) state.year = Number(year);
        persistPillar();
        loadAndRenderMonth(true);
    }

    function goToRecap(year) {
        state.pillar = "ma-declaration";
        if (Number.isFinite(Number(year))) state.year = Number(year);
        persistPillar();
        loadAndRenderMonth(true);
    }

    // SMIC de l'année saisi à la main (année absente du barème) : un seul par
    // année, enregistré dans les réglages de l'année (storage/year-settings.js).
    function onYearSmicChange(nextSmic) {
        const settings = S.loadYearSettings(state.year);
        settings.smic = (typeof nextSmic === "number" && Number.isFinite(nextSmic)) ? nextSmic : null;
        if (S.saveYearSettings(settings)) {
            updateSavedIndicator();
            scheduleAutosave();
        }

        // Le forfait change => recalcul table + récap
        renderAll(false);
        const monthAbatt = computeMonthTotalAbattAndRefreshTable();
        updateSummary(monthAbatt);
    }

    // Re-render structurel du tableau (créneaux ajoutés/retirés, absences…)
    // puis recalcul complet. Utilisé par tous les handlers qui changent la forme.
    function rerenderTableAndRecalc() {
        const tableEl = document.getElementById("month-table");
        if (tableEl && isMonthMode()) {
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
        // Révèle le premier enfant proposé ce jour-là qui n'est pas encore
        // affiché (créneau vide matérialisé pour qu'il reste visible). La ligne
        // affichée par défaut (sans donnée) est matérialisée aussi.
        const shown = childIdsForDay(chg.isoDate, state.data.days[chg.isoDate]);
        shown.forEach((id) => { if (!state.data.days[chg.isoDate] || !state.data.days[chg.isoDate].children[id]) ensureChild(chg.isoDate, id).slots.push({ in: "", out: "" }); });
        const next = candidateChildIds(chg.isoDate).find((id) => !shown.includes(id));
        if (next) ensureChild(chg.isoDate, next).slots.push({ in: "", out: "" });
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
            childIdsForDay,
            canAddChild,
            childLabel,
            prefillAvailable: isPrefillAvailable()
        };
    }

    // Montant validé par render/payslip-inputs.js (U.parseMoneyFR) : jamais
    // de valeur illisible ici.
    function onMoneyChange(key, value) {
        if (!state.data) return;
        if (key !== "netImposable" && key !== "irf") {
            throw new Error(`onMoneyChange : champ inconnu « ${key} ».`);
        }
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new Error(`onMoneyChange : montant invalide pour « ${key} ».`);
        }
        state.data[key] = value;
        saveNow();

        const monthAbatt = computeMonthTotalAbattAndRefreshTable();
        updateSummary(monthAbatt);
    }

    // --- Impression : gabarit dédié (#print-doc), seul visible à l'impression


    // Règles appliquées d'une année (un seul SMIC par année), pour les
    // documents imprimés.
    function buildRulesLabelsForYear(year) {
        const Compute = window.ABMAT.compute;
        const smic = Compute.smicForYear(year);
        const forfait = Compute.forfaitJourForYear(year);
        return {
            year,
            smicLabel: (smic !== null) ? U.fmtEuro(smic) : "non renseigné",
            forfaitLabel: (forfait !== null) ? U.fmtEuro(forfait) : "non calculable (SMIC manquant)"
        };
    }

    // Le dossier complet est assemblé juste avant window.print(), qui déclenche
    // lui-même « beforeprint » : sans ce drapeau, buildPrintDoc() remplacerait
    // le dossier par le seul récap affiché. Levé à « afterprint ».
    let dossierPending = false;

    function buildPrintDoc() {
        if (dossierPending) return;
        const root = document.getElementById("print-doc");
        if (!root) return;

        const Compute = window.ABMAT.compute;

        if (isMaDeclarationMode()) {
            R.renderPrintYear(root, Compute.computeYearRecap(state.year), buildRulesLabelsForYear(state.year));
            return;
        }

        // Aucune autre cible d'impression hors Déclaration (l'icône y est masquée).
        if (state.pillar !== "declaration") return;
        if (!state.data) return;

        const model = Compute.buildMonthPrintModel(
            state.year, state.monthIndex, state.data, computeForfaitJour()
        );
        model.rules = buildRulesLabelsForYear(state.year);
        R.renderPrintMonth(root, model);
    }

    // Assemble récap annuel + relevés des mois renseignés en un seul document
    // (bouton dédié dans Ma déclaration, distinct de l'icône imprimer).
    function printFullDossier() {
        const root = document.getElementById("print-doc");
        if (!root) return;

        const Compute = window.ABMAT.compute;
        const year = state.year;
        const rules = buildRulesLabelsForYear(year);
        const recap = Compute.computeYearRecap(year);

        const forfaitJour = Compute.forfaitJourForYear(year);
        const monthModels = [];
        for (let m = 0; m < 12; m++) {
            const monthRecap = recap.months[m];
            if (!monthRecap || monthRecap.status === "vide") continue;

            const monthData = S.loadMonth(year, m).data;
            const model = Compute.buildMonthPrintModel(year, m, monthData, (forfaitJour === null) ? 0 : forfaitJour);
            model.rules = rules;
            monthModels.push(model);
        }

        R.renderPrintFullYear(root, recap, monthModels, rules);
        dossierPending = true;
        window.print();
    }

    function onPrint() {
        dossierPending = false;
        buildPrintDoc();
        window.print();
    }

    // Cmd/Ctrl+P sans passer par le bouton : on construit le document au vol.
    window.addEventListener("beforeprint", buildPrintDoc);
    window.addEventListener("afterprint", () => { dossierPending = false; });

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

        // La sauvegarde de référence est l'année complète (fonctionne aussi depuis Ma déclaration).
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
                state.pillar = "ma-declaration"; // montre d'un coup le résultat de la fusion, même importé depuis Accueil/Infos
                state.year = res.year;
                persistPillar();
                loadAndRenderMonth(false);
                hideRestoreBanner();
                scheduleAutosave();
                setToolbarLoadUI("loaded", file.name);
                return;
            }

            // --- Fichier "mois" (ancien format) -----------------------------
            // Depuis Ma déclaration/Accueil/Infos, on bascule d'abord sur le mois du fichier.
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

        if (state.pillar === "accueil" || state.pillar === "infos") {
            // Accueil / Mes informations : l'onglet actif suffit, pas de contexte
            // supplémentaire à afficher (et pas de total mensuel hors Déclaration).
            ctx.textContent = "";
            if (totalEl) totalEl.hidden = true;
            return;
        }

        const y = Number(state.year);
        if (isMaDeclarationMode()) {
            ctx.textContent = `• Ma déclaration ${y}`;
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

    function isMaDeclarationMode() {
        return state.pillar === "ma-declaration";
    }

    function isInfosMode() {
        return state.pillar === "infos";
    }

    function isAccueilMode() {
        return state.pillar === "accueil";
    }

    function isMonthMode() {
        return state.pillar === "declaration";
    }

    // Un mois affiché sans aucune donnée peut être pré-rempli depuis les
    // semaines types (action volontaire — jamais automatique).
    function isPrefillAvailable() {
        if (!state.data) return false;
        const days = state.data.days || {};
        const hasAny = Object.keys(days).some((iso) => dayHasData(days[iso]));
        if (hasAny) return false;
        const Compute = window.ABMAT.compute;
        return Object.keys(Compute.buildMonthDaysFromProfile(state.year, state.monthIndex, getProfile())).length > 0;
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
        const fullName = `${p.firstName} ${p.lastName}`.trim();
        const hasChildName = p.children.some((c) => c.name !== "");
        const profileEmpty = fullName === "" && !hasChildName;

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
        const activeChildren = Compute.childrenActiveOn(p, U.toIsoDate(now)).length;

        return {
            userName: p.firstName || fullName.split(/\s+/)[0],
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

        const onboardingEl = document.getElementById("accueil-onboarding");
        if (onboardingEl && typeof R.renderOnboarding === "function") {
            R.renderOnboarding(onboardingEl, ctx);
        }
    }

    // --- Écran Ma déclaration : récap annuel + sélecteur d'année dédié ------
    //
    // Reprend à l'identique le contenu de l'ancien onglet RÉCAP de
    // Déclaration (encart 1AJ, détail par mois, comparaison des régimes),
    // promu au rang de pilier — même année que Déclaration (state.year
    // partagé), mais sans les onglets de mois : ici, on ne saisit pas, on
    // consulte et on imprime.

    function updateDossierCard(recap) {
        const yearEl = document.querySelector("[data-dossier-year]");
        const hintEl = document.querySelector("[data-dossier-hint]");
        if (yearEl) yearEl.textContent = String(state.year);
        if (!hintEl) return;

        const filled = recap.months.filter((m) => m.status !== "vide").length;
        hintEl.textContent = (filled > 0)
            ? `Récapitulatif annuel + ${filled} relevé${filled > 1 ? "s" : ""} mensuel${filled > 1 ? "s" : ""} renseigné${filled > 1 ? "s" : ""}, en un seul document avec sauts de page.`
            : "Aucun mois renseigné pour l'instant — le dossier ne contiendra que le récapitulatif annuel.";
    }

    function renderMaDeclarationScreen() {
        const yearSelEl = document.getElementById("ma-declaration-year-selector");
        const contentEl = document.getElementById("ma-declaration-content");
        if (!contentEl) return;

        const Compute = window.ABMAT.compute;
        const recap = Compute.computeYearRecap(state.year);
        const declared = S.isYearDeclared(state.year);

        if (yearSelEl && typeof R.renderYearOnlySelector === "function") {
            R.renderYearOnlySelector(
                yearSelEl,
                { year: state.year, declaredYears: S.getDeclaredYears() },
                (nextYear) => {
                    state.year = Number(nextYear);
                    renderAll(false); // rafraîchit aussi le contexte toolbar (« • Ma déclaration {année} »)
                }
            );
        }

        R.renderYearRecap(
            contentEl,
            recap,
            (monthIdx) => goToMonth(Number(monthIdx)),
            declared,
            (checked) => {
                S.setYearDeclared(state.year, checked);
                renderAll(false); // rafraîchit aussi le badge « déclarée » (Déclaration comme Ma déclaration)
            }
        );

        updateDossierCard(recap);
    }

    // Reflète le pilier actif sur les 4 onglets texte de la toolbar.
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
        const maDeclarationMode = isMaDeclarationMode();

        setElVisible(document.getElementById("accueil-section"), accueilMode);
        setElVisible(document.getElementById("infos-section"), infosMode);
        setElVisible(document.getElementById("ma-declaration-section"), maDeclarationMode);
        setElVisible(document.getElementById("period-section"), declarationMode);
        setElVisible(document.getElementById("content-grid"), declarationMode);

        // Imprimer a une cible valable sous Déclaration (relevé du mois) et
        // Ma déclaration (récap annuel) — le dossier complet a son propre bouton.
        const printableMode = declarationMode || maDeclarationMode;
        document.querySelectorAll('[data-toolbar-action="print"]').forEach((btn) => {
            setElVisible(btn, printableMode);
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

        if (maDeclarationMode) {
            renderMaDeclarationScreen();
            if (initialRender) U.forceFrenchLocale();
            return;
        }

        // --- Pilier Déclaration : saisie du mois (le récap vit dans Ma déclaration) ---

        const periodEl = U.safeEl("period-selector");
        const yearParamsEl = U.safeEl("year-params");
        const tableEl = U.safeEl("month-table");

        R.renderPeriodSelector(
            periodEl,
            { year: state.year, monthIndex: state.monthIndex, declaredYears: S.getDeclaredYears() },
            onPeriodChange
        );

        const payslipSection = document.getElementById("payslip-section");
        const resultsSection = document.getElementById("month-results-section");
        const resultsHint = resultsSection ? resultsSection.querySelector(".hint") : null;

        if (resultsHint) {
            resultsHint.textContent = "Résumé des montants calculés pour ce mois.";
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

        // Paramètres année (toujours visibles sous Déclaration)
        R.renderYearRules(
            yearParamsEl,
            {
                year: state.year,
                forfaitJour: currentForfait(),
                smic: window.ABMAT.compute.smicForYear(state.year),
                smicInConfig: window.ABMAT_CONFIG.getSmicHoraireBrut(state.year) !== null
            },
            onYearSmicChange
        );

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

        // Bouton statique (Ma déclaration) : jamais recréé, lié une seule fois.
        const dossierBtn = document.getElementById("abmat-print-dossier");
        if (dossierBtn) dossierBtn.addEventListener("click", printFullDossier);

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

    // Délégation : le bouton [data-open-tuto] vit dans Accueil (render/
    // onboarding.js), recréé à chaque affichage — jamais garanti présent au
    // moment de cette liaison unique.
    document.addEventListener("click", (e) => {
        if (!(e.target instanceof Element) || !e.target.closest("[data-open-tuto]")) return;
        setOpen(true);
    });
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