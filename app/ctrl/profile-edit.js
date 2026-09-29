/* ============================================================================
   app/ctrl/profile-edit.js — Mon profil : modifications (A.profileHandlers)
   ----------------------------------------------------------------------------
   Changer les horaires « à partir du … », les dates d'accueil, ajouter un
   enfant. Chaque changement d'enfant est reporté sur les mois déjà remplis
   (Compute.rescheduleMonth : seuls les jours encore « comme d'habitude »
   d'un mois non terminé bougent) et peut être annulé.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const S = window.ABMAT.storage;
  const U = window.ABMAT.utils;
  const Compute = window.ABMAT.compute;
  const F = R.fmt;

  if (!A || !A.weekIsBlank || !Compute.rescheduleMonth) {
    throw new Error("app/ctrl/profile.js et compute/prefill.js doivent être chargés avant app/ctrl/profile-edit.js.");
  }

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const minIso = (list) => list.filter(Boolean).sort()[0];

  function nextDay(iso) {
    const d = U.isoToDate(iso);
    d.setDate(d.getDate() + 1);
    return U.toIsoDate(d);
  }

  /** Message d'erreur pour une semaine type incohérente, ou null. */
  function weekError(week) {
    for (const d of ["1", "2", "3", "4", "5"]) {
      const t = week[d];
      const day = F.DAYS[Number(d)];
      if (Boolean(t.in) !== Boolean(t.out)) return `Indiquez l'arrivée et le départ du ${day}, ou laissez les deux vides.`;
      if (t.in && U.parseTimeToMinutes(t.out) <= U.parseTimeToMinutes(t.in)) return `Le départ du ${day} doit être après l'arrivée.`;
    }
    return null;
  }

  /** Mois enregistrés touchés par un changement à partir de fromIso : [[année, mois]]. */
  A.monthsFrom = (fromIso) => A.storedMonths()
    .filter((x) => `${x.year}-${U.pad2(x.monthIndex + 1)}` >= fromIso.slice(0, 7))
    .map((x) => [x.year, x.monthIndex]);

  /** Reporte le changement d'un enfant (before → after) sur les mois enregistrés ; nombre de jours changés. */
  A.rescheduleChild = function rescheduleChild(before, after, fromIso) {
    let n = 0;
    A.monthsFrom(fromIso).forEach(([y, m]) => {
      const data = A.loadMonth(y, m);
      const k = Compute.rescheduleMonth(data, before, after, fromIso);
      if (k) { n += k; A.saveMonth(data); }
    });
    return n;
  };

  /** Enregistre le profil puis reporte le changement de l'enfant, avec « Annuler ». */
  function apply(profile, before, after, fromIso, message) {
    const snap = A.snapshot(A.monthsFrom(fromIso), true);
    A.saveProfile(profile);
    const n = A.rescheduleChild(before, after, fromIso);
    A.profileEdit = null;
    A.render();
    A.undoable(message(n), snap);
  }

  const daysText = (n) => n
    ? ` ${F.plural(n, "jour")} encore « comme d'habitude » mis à jour ; les jours pointés ou modifiés ne changent pas.`
    : " Les jours déjà saisis ne changent pas.";

  function focusFirst(selector) {
    const el = document.querySelector(selector);
    if (el) el.focus();
  }

  A.profileHandlers = {
    onIdentity: (key, v) => { const p = A.profile(); p[key] = v; A.saveProfile(p); },
    onRelais: (on) => {
      const settings = S.loadYearSettings(U.isoToDate(A.todayIso()).getFullYear());
      settings.relais = on;
      A.saveYearSettings(settings);
    },
    onEdit: (id, kind) => { A.profileEdit = { id, kind }; A.render(); focusFirst(".edit input, #nc-name"); },
    onCancelEdit: () => { A.profileEdit = null; A.render(); },
    onEraseYear: () => A.eraseYearSheet(),

    onSaveSched: (id, form) => {
      const err = weekError(form.week);
      if (err) { R.toast(err); return; }
      const p = A.profile();
      const child = p.children.find((c) => c.id === id);
      const before = clone(child);
      const firstTime = child.periods.every((x) => A.weekIsBlank(x.week));
      if (!firstTime && !form.from) { R.toast("Indiquez la date à partir de laquelle les horaires changent."); return; }
      if (firstTime) child.periods = [{ from: null, week: form.week }];
      else child.periods = child.periods.filter((x) => x.from !== form.from).concat([{ from: form.from, week: form.week }]);
      const fromIso = firstTime ? (child.from || "0000-01-01") : form.from;
      apply(p, before, child, fromIso, (n) => firstTime
        ? `Horaires de ${child.name} enregistrés.${daysText(n)}`
        : `Nouveaux horaires de ${child.name} à partir du ${F.dateFr(form.from)}.${daysText(n)}`);
    },

    onSaveDates: (id, form) => {
      if (!form.name.trim()) { R.toast("Indiquez le prénom."); return; }
      if (form.from && form.to && form.to < form.from) { R.toast("La date de départ doit être après la date d'arrivée."); return; }
      const p = A.profile();
      const child = p.children.find((c) => c.id === id);
      const before = clone(child);
      Object.assign(child, { name: form.name.trim(), from: form.from || null, to: form.to || null });
      // Premier jour dont l'accueil change : bornes modifiées (sans borne = depuis toujours).
      const changes = [];
      if (before.from !== child.from) changes.push(before.from && child.from ? minIso([before.from, child.from]) : "0000-01-01");
      if (before.to !== child.to) changes.push(nextDay(minIso([before.to, child.to])));
      if (!changes.length) { A.saveProfile(p); A.profileEdit = null; A.render(); R.toast("Enregistré."); return; }
      apply(p, before, child, minIso(changes), (n) => `Dates de ${child.name} enregistrées.${daysText(n)}`);
    },

    onSaveNew: (form) => {
      if (!form.name.trim() || !form.from) { R.toast("Indiquez le prénom et la date d'arrivée."); return; }
      const p = A.profile();
      const id = S.newChildId(p);
      p.children.push({ id, name: form.name.trim(), from: form.from, to: null, periods: [{ from: null, week: S.blankWeek() }] });
      A.saveProfile(p);
      A.profileEdit = { id, kind: "sched" };
      A.render();
      focusFirst(".edit input");
      R.toast(`Enfant ajouté : ${form.name.trim()}. Indiquez ses horaires habituels.`);
    }
  };
})();
