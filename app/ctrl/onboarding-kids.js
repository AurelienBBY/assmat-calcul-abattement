/* ============================================================================
   app/ctrl/onboarding-kids.js — Mise en route, étape 2 : les enfants
   ----------------------------------------------------------------------------
   D'abord les enfants d'aujourd'hui (au moins un), puis — à partir de
   février — ceux partis depuis janvier. Chaque enfant est enregistré dans le
   profil dès « Ajouter » (rien n'est perdu avec « Plus tard ») et reporté sur
   les mois déjà remplis (A.rescheduleChild : seuls les jours encore « comme
   d'habitude » bougent).
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const S = window.ABMAT.storage;
  const U = window.ABMAT.utils;
  const Compute = window.ABMAT.compute;
  const F = R.fmt;

  if (!A || !A.rescheduleChild || !R.buildOnbKids || !Compute.childFromForm) {
    throw new Error("app/ctrl/profile-edit.js, render/onb-kids.js et compute/onboarding.js doivent être chargés avant app/ctrl/onboarding-kids.js.");
  }

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const K = { phase: "now", form: null, editId: null, error: null, beforeAns: null };

  const today = () => A.todayIso();
  const year = () => U.isoToDate(today()).getFullYear();
  const isGone = (c) => Boolean(c.to && c.to < today());
  const nowKids = (p) => p.children.filter((c) => !isGone(c));
  const beforeKids = (p) => p.children.filter((c) => isGone(c) && c.to >= `${year()}-01-01`);
  // Les enfants partis ne se demandent qu'à partir de février.
  const askBefore = () => U.isoToDate(today()).getMonth() >= 1;

  // « Modifier » seulement si le formulaire sait représenter l'enfant sans rien
  // perdre (sinon, plusieurs changements d'horaires : c'est « Mon profil »).
  function lossless(c) {
    const back = Compute.childFromForm(Compute.formFromChild(c, today()), c.id);
    return JSON.stringify([back.from, back.to, back.periods]) === JSON.stringify([c.from, c.to, c.periods]);
  }

  function card(c) {
    const week = F.week(c.periods[c.periods.length - 1].week) || "pas d'horaires habituels";
    let dates = c.from ? `depuis le ${F.dateFr(c.from)}` : "";
    if (isGone(c)) dates = `${c.from ? `du ${F.dateFr(c.from)} ` : ""}au ${F.dateFr(c.to)}`;
    else if (c.to) dates += `, jusqu'au ${F.dateFr(c.to)}`;
    return { id: c.id, name: c.name, times: week, dates, editable: lossless(c) };
  }

  /** Le formulaire propose « ses horaires ont changé » pour un enfant arrivé avant ce mois-ci. */
  function changeLabel(f) {
    if (f.before || !f.from || !f.days.length || f.from >= `${today().slice(0, 7)}-01`) return null;
    return f.from < `${year()}-01-01` ? "depuis janvier" : "depuis son arrivée";
  }

  function focusName() {
    const el = document.getElementById("onb-name");
    if (el) el.focus();
  }

  function open(form, editId) {
    Object.assign(K, { form, editId, error: null });
    A.render();
    focusName();
  }

  function save() {
    const f = K.form;
    if (!f.before && !f.gone) f.to = "";
    K.error = Compute.childFormError(f, today());
    if (K.error) { A.render(); return; }
    const p = A.profile();
    const id = K.editId || S.newChildId(p);
    const after = Compute.childFromForm(f, id);
    const i = p.children.findIndex((c) => c.id === id);
    const before = i >= 0 ? clone(p.children[i]) : Object.assign({}, after, { periods: [{ from: null, week: S.blankWeek() }] });
    if (i >= 0) p.children[i] = after; else p.children.push(after);
    A.saveProfile(p);
    A.rescheduleChild(before, after, "0000-01-01");
    Object.assign(K, { form: null, editId: null, error: null });
    A.render();
  }

  const handlers = {
    onField: (key, v, rerender) => { K.form[key] = v; if (key === "gone" && !v) K.form.to = ""; if (rerender) A.render(); },
    onPer: (d, key, v) => { K.form.per[d] = Object.assign({ a: "", b: "" }, K.form.per[d], { [key]: v }); },
    onDay: (d) => {
      const f = K.form;
      f.days = f.days.includes(d) ? f.days.filter((x) => x !== d) : f.days.concat([d]).sort();
      if (!f.per[d]) f.per[d] = { a: f.a, b: f.b };
      A.render();
    },
    onSame: (on) => {
      const f = K.form;
      f.same = on;
      if (on && !f.a && f.days.length && f.per[f.days[0]]) Object.assign(f, f.per[f.days[0]]);
      if (!on) f.days.forEach((d) => { if (!f.per[d] || !f.per[d].a) f.per[d] = { a: f.a, b: f.b }; });
      A.render();
    },
    onChg: (key, v, rerender) => { K.form.chg[key] = v; if (rerender) A.render(); },
    onSave: save,
    onCancel: () => { Object.assign(K, { form: null, editId: null, error: null }); A.render(); },
    onEdit: (id) => {
      const form = Compute.formFromChild(A.profile().children.find((c) => c.id === id), today());
      open(Object.assign(form, { gone: Boolean(form.to) }), id);
    },
    onAdd: () => {
      if (K.phase === "before") K.beforeAns = "yes";
      open(Object.assign(Compute.blankChildForm(K.phase === "before", ""), { gone: false }), null);
    },
    onNone: () => { K.beforeAns = "no"; A.render(); }
  };

  A.onbKids = {
    /** Entrée dans l'étape : par les enfants d'aujourd'hui (ou par les partis, en revenant de l'étape 3). */
    enter: (phase) => Object.assign(K, { phase: phase === "before" && askBefore() ? "before" : "now", form: null, editId: null, error: null, beforeAns: null }),

    /** Contenu de l'étape pour le cadre (render/onboarding.js). */
    frame: function frame(go) {
      const p = A.profile();
      const now = nowKids(p);
      const gone = beforeKids(p);
      if (K.phase === "now" && !now.length && !K.form) K.form = Object.assign(Compute.blankChildForm(false, ""), { gone: false });
      if (K.phase === "before" && gone.length && K.beforeAns === null) K.beforeAns = "yes";
      const list = (K.phase === "now" ? now : gone).map(card);
      const formModel = K.form ? {
        form: K.form, error: K.error, editing: Boolean(K.editId), changeLabel: changeLabel(K.form),
        canCancel: K.phase === "before" || now.length > 0
      } : null;
      const body = R.buildOnbKids({ phase: K.phase, list, formModel, beforeAns: K.beforeAns }, handlers);
      if (K.phase === "now") {
        return {
          title: "Les enfants", body,
          lead: now.length ? null : "Les enfants que vous accueillez aujourd'hui, un par un, avec leurs horaires habituels. Le calendrier et la pointeuse partent de là.",
          next: { label: now.length ? "C'est tout, continuer" : "Ajoutez au moins un enfant", disabled: !now.length || Boolean(K.form),
            onClick: () => { if (askBefore()) { A.onbKids.enter("before"); A.render(); window.scrollTo(0, 0); } else go(3); } },
          onBack: () => go(1)
        };
      }
      return {
        title: "Et depuis janvier ?", body,
        next: { label: "Continuer", disabled: K.beforeAns === null || Boolean(K.form), onClick: () => go(3) },
        onBack: () => { A.onbKids.enter("now"); A.render(); }
      };
    }
  };
})();
