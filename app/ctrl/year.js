/* ============================================================================
   app/ctrl/year.js — Onglet « Mon année » et « Préparer AAAA »
   ----------------------------------------------------------------------------
   Le montant à déclarer vient de Compute.computeYearRecap (plancher annuel,
   un seul SMIC par année) ; les tuiles, de chaque mois relu du stockage.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const S = window.ABMAT.storage;
  const Compute = window.ABMAT.compute;
  const CFG = window.ABMAT_CONFIG;
  const F = R.fmt;

  if (!A || !R.buildYear || !R.buildPrepareYear || !A.rescheduleChild) {
    throw new Error("app/ctrl/profile-edit.js et les renderers de l'année doivent être chargés avant app/ctrl/year.js.");
  }
  const st = A.state;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function yearsList() {
    const now = new Date();
    const set = new Set([now.getFullYear(), st.year].concat(A.storedYears()));
    if (now.getMonth() === 11) set.add(now.getFullYear() + 1); // décembre : l'année suivante se prépare
    const declared = S.getDeclaredYears();
    return Array.from(set).sort().map((year) => ({ year, declared: declared.includes(year) }));
  }

  function render(main) {
    const y = st.year;
    const profile = A.profile();
    const todayIso = A.todayIso();
    const recap = Compute.computeYearRecap(y);
    const now = new Date();
    let doneCount = 0;
    const tiles = recap.months.map((rec, m) => {
      const data = A.loadMonth(y, m);
      if (data.done) doneCount++;
      return {
        monthIndex: m,
        status: Compute.monthProgress(data, profile, todayIso).status,
        hasData: !S.isBlankMonth(data),
        abatt: rec.abatt,
        dueMin: A.hsDays(data, todayIso).reduce((s, d) => s + d.r.dueMin, 0),
        current: y === now.getFullYear() && m === now.getMonth()
      };
    });
    R.append(main, R.buildYear({
      years: yearsList(), year: y,
      smic: Compute.smicForYear(y), forfait: A.forfait(y), relais: S.loadYearSettings(y).relais,
      imposable: recap.totals.imposable, percu: recap.totals.percu, abatt: recap.totals.abatt, net: recap.totals.net,
      doneCount, filledCount: recap.months.filter((x) => x.status !== "vide").length,
      declared: S.isYearDeclared(y), tiles
    }, {
      onYear: (year) => { st.year = year; A.backup.mergeFolder(year); A.render(); },
      onMonth: (m) => A.go("month", { monthIndex: m }),
      onDeclared: (on) => { S.setYearDeclared(y, on); A.render(); },
      onPrepare: () => A.prepareYear(y),
      onPrintYear: () => A.print.year(y),
      onPrintDossier: () => A.print.dossier(y)
    }));
  }

  /** Fenêtre « Préparer AAAA » (ou modifier ses réglages). */
  A.prepareYear = function prepareYear(y) {
    const settings = S.loadYearSettings(y);
    const profile = A.profile();
    const jan1 = `${y}-01-01`;
    const kids = profile.children
      .filter((c) => (!c.to || c.to >= `${y - 1}-01-01`) && (!c.from || c.from <= `${y}-12-31`))
      .map((c) => {
        const leaves = Boolean(c.to && c.to < jan1);
        const period = Compute.periodAt(c, c.from && c.from > jan1 ? c.from : jan1) || c.periods[0];
        let detail = F.week(period.week) || "pas d'horaires habituels";
        if (leaves) detail = `départ le ${F.dateFr(c.to)}`;
        else if (c.from && c.from > jan1) detail = `arrive le ${F.dateFr(c.from)}`;
        return { id: c.id, name: Compute.childLabel(profile, c.id, null), detail, leaves };
      });

    const sheet = R.openSheet({ title: `Préparer ${y}`, onClose: A.render, body: [] });
    sheet.setBody(R.buildPrepareYear({
      year: y, kids, relais: settings.relais, editing: Boolean(settings.updatedAt),
      smic: settings.smic !== null ? settings.smic : CFG.getSmicHoraireBrut(y),
      forfaitOf: (smic) => CFG.computeForfaitJourFromSmic(smic, CFG.coefficient)
    }, {
      onSave: (form) => {
        A.saveYearSettings({ year: y, smic: form.smic, relais: form.relais });
        const p = A.profile();
        const changes = [];
        p.children.forEach((c) => {
          if (form.keep[c.id] !== false || (c.to && c.to < jan1)) return;
          changes.push([clone(c), c]);
          c.to = `${y - 1}-12-31`;
        });
        if (changes.length) {
          A.saveProfile(p);
          changes.forEach(([before, after]) => A.rescheduleChild(before, after, jan1));
        }
        st.year = y;
        R.closeSheet();
        R.toast(settings.updatedAt ? `Réglages de ${y} enregistrés.` : `${y} est prêt. Bonne année !`);
      }
    }));
  };

  A.views.year = { render };
})();
