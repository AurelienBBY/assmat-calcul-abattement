/* ============================================================================
   compute/onboarding.js — Mise en route : formulaire enfant, mois passés
   ----------------------------------------------------------------------------
   Formulaire d'un enfant (mise en route) :
     { name, from, days: [1..5], same, a, b, per: { "1": {a, b} }, to,
       chg: { on, date, a, b }, before }
   - same : mêmes horaires (a → b) tous les jours choisis, sinon per[jour]
   - chg  : « ses horaires ont changé » — anciens horaires (a → b, mêmes
            jours) jusqu'à la veille de chg.date
   - before : enfant déjà parti (date de départ obligatoire)
   Pur et sans DOM.
   ========================================================================== */

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.compute = window.ABMAT.compute || {};

  const Compute = window.ABMAT.compute;
  const U = window.ABMAT.utils;

  if (!U || !Compute.buildMonthDaysFromProfile || !Compute.periodAt) {
    throw new Error("ABMAT.compute : utils, compute/children.js et compute/prefill.js doivent être chargés avant compute/onboarding.js.");
  }

  const WEEKDAYS = [1, 2, 3, 4, 5];
  const DAY_NAMES = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi"];

  function weekOf(days, timeOf) {
    const week = {};
    WEEKDAYS.forEach((d) => {
      const t = days.includes(d) ? timeOf(d) : null;
      week[String(d)] = t ? { in: t.a, out: t.b } : { in: "", out: "" };
    });
    return week;
  }

  /** Formulaire vide (enfant accueilli aujourd'hui, ou parti si before). */
  Compute.blankChildForm = function blankChildForm(before, defaultFrom) {
    return { name: "", from: defaultFrom || "", days: [], same: true, a: "", b: "", per: {}, to: "",
      chg: { on: false, date: "", a: "", b: "" }, before: before === true };
  };

  /** Enfant du profil (v2) construit depuis le formulaire. */
  Compute.childFromForm = function childFromForm(form, id) {
    const current = weekOf(form.days, (d) => (form.same ? { a: form.a, b: form.b } : form.per[d]));
    const periods = form.chg.on
      ? [{ from: null, week: weekOf(form.days, () => ({ a: form.chg.a, b: form.chg.b })) }, { from: form.chg.date, week: current }]
      : [{ from: null, week: current }];
    return { id, name: form.name.trim(), from: form.from || null, to: form.to || null, periods };
  };

  /** Formulaire pré-rempli depuis un enfant du profil (pour « Modifier »). */
  Compute.formFromChild = function formFromChild(child, todayIso) {
    const last = child.periods[child.periods.length - 1];
    const days = WEEKDAYS.filter((d) => last.week[String(d)].in && last.week[String(d)].out);
    const per = {};
    days.forEach((d) => { per[d] = { a: last.week[String(d)].in, b: last.week[String(d)].out }; });
    const first = days.length ? per[days[0]] : { a: "", b: "" };
    const same = days.every((d) => per[d].a === first.a && per[d].b === first.b);
    const old = child.periods.length > 1 ? child.periods[0].week : null;
    const oldDay = old ? WEEKDAYS.find((d) => old[String(d)].in) : null;
    return {
      name: child.name, from: child.from || "", days, same, a: first.a, b: first.b, per, to: child.to || "",
      chg: (old && oldDay) ? { on: true, date: last.from, a: old[String(oldDay)].in, b: old[String(oldDay)].out } : { on: false, date: "", a: "", b: "" },
      before: Boolean(child.to && child.to < todayIso)
    };
  };

  const mins = U.parseTimeToMinutes;
  const badPair = (a, b) => mins(a) === null || mins(b) === null || mins(b) <= mins(a);

  /**
   * Ce qui empêche d'enregistrer le formulaire, en français simple ; null si tout va bien.
   * @returns {string|null}
   */
  Compute.childFormError = function childFormError(form, todayIso) {
    if (!form.name.trim()) return "Indiquez le prénom de l'enfant.";
    if (!form.from) return "Indiquez depuis quand vous l'accueillez.";
    if (!form.days.length) return "Choisissez au moins un jour.";
    if (form.same && badPair(form.a, form.b)) return "Indiquez l'arrivée et le départ (le départ après l'arrivée).";
    if (!form.same) {
      const bad = form.days.find((d) => !form.per[d] || badPair(form.per[d].a, form.per[d].b));
      if (bad) return `Indiquez l'arrivée et le départ du ${DAY_NAMES[bad]} (le départ après l'arrivée).`;
    }
    if (form.before && !form.to) return "Indiquez son dernier jour d'accueil.";
    if (form.to && form.to < form.from) return "Le dernier jour doit être après son arrivée.";
    if (form.chg.on) {
      if (!form.chg.date || form.chg.date <= form.from) return "La date du changement doit être après son arrivée.";
      if (form.chg.date > todayIso) return "La date du changement ne peut pas être dans le futur.";
      if (badPair(form.chg.a, form.chg.b)) return "Indiquez les anciens horaires (le départ après l'arrivée).";
    }
    return null;
  };

  /**
   * Mois passés à remplir avec les horaires habituels : seulement les mois
   * encore vides (rien n'est jamais écrasé) et où au moins un enfant venait.
   * @param {(m:number)=>boolean} isBlank - le mois m est-il vide ?
   * @returns {Array<{monthIndex:number, days:Object}>}
   */
  Compute.pastMonthsPlan = function pastMonthsPlan(year, fromMonth, toMonth, profile, isBlank) {
    const out = [];
    for (let m = fromMonth; m <= toMonth; m++) {
      if (!isBlank(m)) continue;
      const days = Compute.buildMonthDaysFromProfile(year, m, profile);
      if (Object.keys(days).length) out.push({ monthIndex: m, days });
    }
    return out;
  };
})();
