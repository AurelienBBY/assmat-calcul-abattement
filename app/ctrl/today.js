/* ============================================================================
   app/ctrl/today.js — Onglet « Aujourd'hui » (pointeuse)
   ----------------------------------------------------------------------------
   Chaque geste note l'heure du téléphone (compute/punch.js), enregistre et
   propose « Annuler ». L'horloge et les heures sup. avancent toutes seules.
   Premier lancement (aucune donnée) : carte de bienvenue.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const S = window.ABMAT.storage;
  const C = window.ABMAT.calc;
  const O = window.ABMAT.overtime;
  const Compute = window.ABMAT.compute;
  const F = R.fmt;
  const CFG = window.ABMAT_CONFIG;

  if (!A || !R.buildToday || !Compute.punchIn) {
    throw new Error("app/ctrl/ctx.js, render/today.js et compute/punch.js doivent être chargés avant app/ctrl/today.js.");
  }

  let relDraft = false;
  let live = null; // { clock, hs, minute, iso }

  function load() {
    const iso = A.todayIso();
    const [y, m] = A.monthOf(iso);
    return { iso, y, m, data: A.loadMonth(y, m) };
  }

  function hsPart(day, profile, nowMin) {
    const hs = (day && !day.off) ? O.computeDay(day, { nowMin }) : null;
    const T = CFG.overtime.dailyThresholdMinutes;
    const hint = (hs && hs.status === "open" && hs.totalMin < T)
      ? `Si la journée continue après ${F.hm(nowMin + T - hs.totalMin)}, les heures sup. commencent.` : null;
    return { hs, hint, labelOf: A.labelOf(profile, day) };
  }

  function model() {
    const { iso, y, data } = load();
    const day = data.days[iso] || null;
    const profile = A.profile();
    const now = new Date();
    const forfait = A.forfait(y);
    const list = Compute.punchList(profile, iso, day);
    const cards = list.map((k) => {
      const r = k.presence ? C.computeChildDay(k.presence, forfait === null ? 0 : forfait) : null;
      return Object.assign({}, k, {
        relais: S.isRelaisId(k.id),
        sub: S.isRelaisId(k.id) ? "accueil relais" : (k.usual.length ? `prévu ${F.slots(k.usual)}` : "pas prévu aujourd'hui"),
        calcText: (r && r.status === "ok") ? `${F.dur(Math.round(r.hours * 60))} aujourd'hui${forfait === null ? "" : ` · abattement ${F.euro(r.abatt)}`}` : ""
      });
    });
    return Object.assign({
      title: F.cap(F.dateLong(iso)),
      clock: F.hm(F.nowMin(now)),
      off: Boolean(day && day.off),
      cards,
      notExpected: Compute.notExpectedToday(profile, iso, day).map((c) => ({ id: c.id, label: Compute.childLabel(profile, c.id, null) })),
      full: list.filter((k) => k.state === "here").length >= CFG.maxChildrenAtOnce,
      relaisEnabled: S.loadYearSettings(y).relais,
      relDraft,
      meetings: (day && !day.off) ? day.meetings : []
    }, hsPart(day, profile, F.nowMin(now)));
  }

  /** Geste : instantané, modification, enregistrement ; un texte renvoyé devient
      un message avec « Annuler », false = geste refusé (message déjà affiché). */
  function act(mutate) {
    const { iso, y, m, data } = load();
    const snap = A.snapshot([[y, m]]);
    const now = new Date();
    const text = mutate(data, iso, F.nowHHMM(now), F.nowMin(now));
    if (text === false) return null;
    A.saveMonth(data);
    A.render();
    if (typeof text === "string") A.undoable(text, snap);
    return data.days[iso];
  }

  const openSlot = (p) => p.slots.find((s) => s.in && !s.out);
  const label = (data, iso, id) => Compute.childLabel(A.profile(), id, data.days[iso] && data.days[iso].children[id]);

  const handlers = {
    onIn: (id) => act((data, iso, hhmm) => { Compute.punchIn(data, iso, id, hhmm); return `Arrivée de ${label(data, iso, id)} notée à ${F.time(hhmm)}.`; }),
    onOut: (id) => {
      const day = act((data, iso, hhmm, nowMin) => {
        const slot = openSlot(data.days[iso].children[id]);
        if (nowMin <= window.ABMAT.utils.parseTimeToMinutes(slot.in)) {
          R.toast("Arrivée et départ à la même minute : réessayez dans un instant, ou corrigez l'heure à la main.");
          return false;
        }
        Compute.punchOut(data, iso, id, hhmm);
        return `Départ de ${label(data, iso, id)} noté à ${F.time(hhmm)}.`;
      });
      if (day && !Compute.someoneHere(day)) A.backup.after("day-end");
    },
    onAbsent: (id) => act((data, iso) => { Compute.punchAbsent(data, iso, id, ""); return `${label(data, iso, id)} : absence notée.`; }),
    onCancelAbsence: (id) => act((data, iso) => { Compute.cancelAbsence(data, iso, id, A.profile()); }),
    onMotif: (id, v) => act((data, iso) => { data.days[iso].children[id].motif = v; }),
    onTime: (id, i, key, v) => act((data, iso) => { data.days[iso].children[id].slots[i][key] = v; }),
    onRelaisDraft: (on) => { relDraft = on; A.render(); if (on) document.getElementById("rel-name").focus(); },
    onRelaisIn: (name) => {
      if (!name.trim()) { R.toast("Indiquez le prénom de l'enfant."); return; }
      relDraft = false;
      act((data, iso, hhmm) => { Compute.punchInRelais(data, iso, name, hhmm); return `Arrivée de ${name.trim()} notée à ${F.time(hhmm)}.`; });
    },
    onMeetingStart: () => act((data, iso, hhmm) => { Compute.meetingStart(data, iso, hhmm); return `Début de réunion noté à ${F.time(hhmm)}.`; }),
    onMeetingEnd: () => act((data, iso, hhmm, nowMin) => {
      const open = data.days[iso].meetings.find((s) => !s.out);
      if (nowMin <= window.ABMAT.utils.parseTimeToMinutes(open.in)) { R.toast("La fin doit être après le début : réessayez dans un instant."); return false; }
      Compute.meetingEnd(data, iso, hhmm);
      return `Fin de réunion notée à ${F.time(hhmm)}.`;
    }),
    onMeetingTime: (i, key, v) => act((data, iso) => { data.days[iso].meetings[i][key] = v; }),
    onDayOn: () => act((data, iso) => { Compute.setDayOff(data, iso, false, A.profile()); })
  };

  function render(main) {
    if (!A.hasAnyData()) {
      live = null;
      main.appendChild(R.buildWelcome({ onStart: () => A.go("profile"), onRestore: A.backup.importFile, onHelp: A.openHelp }));
      return;
    }
    const built = R.buildToday(model(), handlers);
    live = { clock: built.clock, hs: built.hs, minute: F.nowMin(new Date()), iso: A.todayIso() };
    main.appendChild(built.node);
  }

  // Chaque minute : horloge et heures sup. (sans toucher à une saisie en cours).
  setInterval(() => {
    if (A.state.tab !== "today" || !live || R.isSheetOpen()) return;
    const now = new Date();
    if (A.todayIso() !== live.iso) { if (!document.activeElement || document.activeElement === document.body) A.render(); return; }
    if (F.nowMin(now) === live.minute) return;
    live.minute = F.nowMin(now);
    live.clock.textContent = F.hm(live.minute);
    const { iso, data } = load();
    R.fillTodayHs(live.hs, hsPart(data.days[iso] || null, A.profile(), live.minute));
  }, 15000);

  A.views.today = { render };
})();
