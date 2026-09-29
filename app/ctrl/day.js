/* ============================================================================
   app/ctrl/day.js — Fiche du jour (A.openDay)
   ----------------------------------------------------------------------------
   Le mois du jour est chargé à l'ouverture et enregistré à chaque geste. Une
   heure modifiée ne met à jour que les chiffres (le fil de la saisie est
   gardé) ; un changement de forme (présence, horaire ajouté…) reconstruit.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const U = window.ABMAT.utils;
  const S = window.ABMAT.storage;
  const C = window.ABMAT.calc;
  const O = window.ABMAT.overtime;
  const Compute = window.ABMAT.compute;
  const F = R.fmt;

  if (!A || !R.buildDaySheet) {
    throw new Error("app/ctrl/ctx.js et render/day-sheet.js doivent être chargés avant app/ctrl/day.js.");
  }

  const blankSlot = () => ({ in: "", out: "" });

  function calcText(p, forfait) {
    if (p.absent) return "";
    if (p.slots.some((s) => s.in && !s.out)) return "Encore là (départ pas encore pointé).";
    const r = C.computeChildDay(p, forfait === null ? 0 : forfait);
    if (r.status === "ok") return `${F.dur(Math.round(r.hours * 60))} de présence${forfait === null ? "" : ` · abattement ${F.euro(r.abatt)}`}`;
    if (r.status === "invalid") return "Horaire à corriger : le départ doit être après l'arrivée.";
    return "Horaire à compléter.";
  }

  A.openDay = function openDay(iso) {
    const [y, m] = A.monthOf(iso);
    const data = A.loadMonth(y, m);
    const ferie = U.getFrenchHolidays(y)[iso] || null;
    const weekday = F.DAYS[U.isoToDate(iso).getDay()];
    let worked = false; // « J'ai travaillé ce jour-là » un jour férié
    let refs = null;

    const day = () => data.days[iso] || null;
    function ensureDay() {
      if (!data.days[iso] || data.days[iso].off) data.days[iso] = { off: false, children: {}, meetings: [] };
      return data.days[iso];
    }
    const usualOf = (profile, id) => {
      const child = profile.children.find((c) => c.id === id);
      return child ? Compute.usualSlots(child, iso) : [];
    };

    function figures() {
      const d = day();
      const forfait = A.forfait(y);
      const calc = {};
      const on = Boolean(d && !d.off);
      if (on) Object.keys(d.children).forEach((id) => { calc[id] = calcText(d.children[id], forfait); });
      const isToday = iso === A.todayIso();
      return {
        calc,
        hs: on ? O.computeDay(d, isToday ? { nowMin: F.nowMin(new Date()) } : undefined) : null,
        labelOf: A.labelOf(A.profile(), d),
        provisional: isToday && Compute.someoneHere(d),
        total: (on && forfait !== null) ? C.computeDayTotal(d, forfait).dayTotal : null,
        tooMany: C.maxSimultaneous(d)
      };
    }

    function model() {
      const profile = A.profile();
      const d = day();
      const hasUsual = profile.children.some((c) => Compute.usualSlots(c, iso).length);
      let top = "free";
      if (d && d.off) top = "off";
      else if (!d && ferie && !worked) top = "ferie";
      else if (hasUsual && !ferie) top = "normal";

      const ids = new Set(Compute.childrenActiveOn(profile, iso).map((c) => c.id));
      if (d && !d.off) Object.keys(d.children).forEach((id) => ids.add(id));
      const kids = Array.from(ids).sort(Compute.compareChildIds).map((id) => {
        const presence = (d && !d.off && d.children[id]) || null;
        const usual = usualOf(profile, id);
        return {
          id, presence, weekday, relais: S.isRelaisId(id),
          label: Compute.childLabel(profile, id, presence),
          usualText: usual.length ? F.slots(usual) : null,
          differs: Boolean(presence && !presence.absent && !Compute.sameSlots(presence.slots, usual)),
          calcText: ""
        };
      });
      return { top, ferie, kids, relaisEnabled: S.loadYearSettings(y).relais, meetings: d && !d.off ? d.meetings : [], figures: figures() };
    }

    const sheet = R.openSheet({ title: F.cap(F.dateLong(iso)), body: [], onClose: A.render });

    function rebuild(focusId) {
      const built = R.buildDaySheet(model(), handlers);
      refs = built.refs;
      sheet.setBody(built.nodes);
      const el = focusId ? document.getElementById(focusId) : null;
      if (el) el.focus();
    }
    const save = () => A.saveMonth(data);
    const saveAndRebuild = (focusId) => { save(); rebuild(focusId); };
    const presenceOf = (id) => ensureDay().children[id];

    const handlers = {
      onUsual: () => { worked = false; Compute.setDayUsual(data, iso, A.profile()); saveAndRebuild(); },
      onWorked: () => { worked = true; rebuild(); },
      onOff: () => {
        const snap = A.snapshot([[y, m]]);
        Compute.setDayOff(data, iso, true, A.profile());
        save();
        R.closeSheet();
        A.undoable("Journée marquée non travaillée.", snap);
      },
      onPresence: (id, present) => {
        const d = ensureDay();
        const p = d.children[id];
        const relais = S.isRelaisId(id) ? { relais: true, name: p ? p.name : "" } : {};
        if (present && !(p && !p.absent && p.slots.length)) {
          const usual = usualOf(A.profile(), id);
          d.children[id] = Object.assign({ absent: false, motif: "", slots: usual.length ? usual : [blankSlot()], punched: false }, relais);
        } else if (!present) {
          d.children[id] = Object.assign({ absent: true, motif: p ? p.motif : "", slots: [], punched: false }, relais);
        }
        saveAndRebuild();
      },
      onMotif: (id, v) => { presenceOf(id).motif = v; save(); },
      onSlot: (id, i, key, v) => { presenceOf(id).slots[i][key] = v; save(); R.fillDayFigures(refs, figures()); },
      onAddSlot: (id) => { const p = presenceOf(id); p.slots.push(blankSlot()); saveAndRebuild(`t-${id}-${p.slots.length - 1}-in`); },
      onRemoveSlot: (id, i) => { presenceOf(id).slots.splice(i, 1); saveAndRebuild(); },
      onRemoveKid: (id) => { delete ensureDay().children[id]; saveAndRebuild(); },
      onRelaisAdd: () => {
        const d = ensureDay();
        let n = 1;
        while (d.children[`r${n}`]) n++;
        d.children[`r${n}`] = { relais: true, name: "", absent: false, motif: "", slots: [blankSlot()], punched: false };
        saveAndRebuild(`rel-r${n}`);
      },
      onRelaisName: (id, v) => { presenceOf(id).name = v.trim(); save(); setTimeout(() => rebuild(document.activeElement && document.activeElement.id), 0); },
      onMeeting: (i, key, v) => { ensureDay().meetings[i][key] = v; save(); R.fillDayFigures(refs, figures()); },
      onAddMeeting: () => { const d = ensureDay(); d.meetings.push(blankSlot()); saveAndRebuild(`r-${d.meetings.length - 1}-in`); },
      onRemoveMeeting: (i) => { ensureDay().meetings.splice(i, 1); saveAndRebuild(); },
      onClose: R.closeSheet
    };

    rebuild();
  };
})();
