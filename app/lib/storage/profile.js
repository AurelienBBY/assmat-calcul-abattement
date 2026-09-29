/* ============================================================================
   storage/profile.js — Profil « Mes informations » (clé abmat:profile), v2
   ----------------------------------------------------------------------------
   { version: 2, firstName, lastName, employer,
     children: [ { id: "c1", name, from: iso|null, to: iso|null,
                   periods: [ { from: iso|null, week: { "1".."5": {in,out} } } ] } ] }
   - id stable, jamais réutilisé (S.newChildId) ; from/to bornent l'accueil ;
   - periods : horaires habituels versionnés, triés par from (null = depuis
     toujours), un créneau par jour ouvré (lundi=1 … vendredi=5).
   Migration v1 → v2 (cf. docs/schema-donnees-v3.md) : enregistrée une fois
   au chargement, sans changer updatedAt.
   ========================================================================== */

(function () {
  "use strict";

  const S = window.ABMAT && window.ABMAT.storage;
  const U = window.ABMAT && window.ABMAT.utils;

  if (!S || !S.writeRaw) {
    throw new Error("storage/core.js doit être chargé avant storage/profile.js.");
  }

  S.PROFILE_KEY = "abmat:profile";

  const CHILD_ID = /^c\d+$/;
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const str = (v) => (typeof v === "string") ? v : "";
  const isoOrNull = (v) => (typeof v === "string" && ISO.test(v)) ? v : null;

  function normalizeWeek(w) {
    const src = (w && typeof w === "object") ? w : {};
    const week = {};
    for (let d = 1; d <= 5; d++) {
      const t = (src[String(d)] && typeof src[String(d)] === "object") ? src[String(d)] : {};
      week[String(d)] = { in: str(t.in), out: str(t.out) };
    }
    return week;
  }

  S.blankWeek = () => normalizeWeek(null);

  function normalizeChild(c) {
    const periodsIn = Array.isArray(c.periods) ? c.periods : [];
    const periods = periodsIn
      .map((p) => ({ from: isoOrNull(p && p.from), week: normalizeWeek(p && p.week) }))
      .sort((a, b) => (a.from || "").localeCompare(b.from || ""));
    return {
      id: c.id,
      name: str(c.name).trim(),
      from: isoOrNull(c.from),
      to: isoOrNull(c.to),
      periods: periods.length ? periods : [{ from: null, week: normalizeWeek(null) }]
    };
  }

  const weekHasTimes = (week) => Object.keys(week).some((d) => week[d].in || week[d].out);

  // v1 : { name, employer, mention, children: { "1": {name, active, week} | "prénom" } }
  function migrateV1(src, todayIso) {
    if (!ISO.test(String(todayIso))) {
      throw new Error("normalizeProfile : la date du jour (AAAA-MM-JJ) est requise pour migrer un profil v1.");
    }
    const childrenIn = (src.children && typeof src.children === "object") ? src.children : {};
    const children = [];
    ["1", "2", "3"].forEach((k) => {
      const raw = (typeof childrenIn[k] === "string") ? { name: childrenIn[k] } : (childrenIn[k] || {});
      const week = normalizeWeek(raw.week);
      if (!str(raw.name).trim() && !weekHasTimes(week)) return; // enfant jamais renseigné
      children.push(normalizeChild({
        id: `c${k}`, name: raw.name, from: null,
        to: raw.active === false ? todayIso : null, // « désactivé » = parti au plus tard aujourd'hui
        periods: [{ from: null, week }]
      }));
    });
    return { version: 2, firstName: "", lastName: str(src.name).trim(), employer: str(src.employer), children };
  }

  S.blankProfile = function blankProfile() {
    return { version: 2, firstName: "", lastName: "", employer: "", children: [] };
  };

  /**
   * Normalise un profil (v2) ou migre un profil v1.
   * @param {Object} p
   * @param {string} [todayIso] - requis seulement pour migrer un v1
   */
  S.normalizeProfile = function normalizeProfile(p, todayIso) {
    const src = (p && typeof p === "object") ? p : {};
    const out = (src.version === 2) ? {
      version: 2,
      firstName: str(src.firstName).trim(),
      lastName: str(src.lastName).trim(),
      employer: str(src.employer),
      children: (Array.isArray(src.children) ? src.children : [])
        .filter((c) => c && typeof c === "object" && CHILD_ID.test(String(c.id)))
        .map(normalizeChild)
    } : migrateV1(src, todayIso);

    if (typeof src.updatedAt === "string") out.updatedAt = src.updatedAt;
    return out;
  };

  /** Prochain id libre (jamais réutilisé tant que le profil le connaît). */
  S.newChildId = function newChildId(profile) {
    const max = profile.children.reduce((m, c) => Math.max(m, Number(c.id.slice(1))), 0);
    return `c${max + 1}`;
  };

  S.loadProfile = function loadProfile() {
    try {
      const raw = localStorage.getItem(S.PROFILE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const profile = S.normalizeProfile(parsed, U.toIsoDate(new Date()));
      // Migration v1 → v2 enregistrée une seule fois (updatedAt conservé).
      if (parsed.version !== 2) S.writeRaw(S.PROFILE_KEY, profile);
      return profile;
    } catch (e) {
      return null;
    }
  };

  S.saveProfile = function saveProfile(profile) {
    const normalized = S.normalizeProfile(profile);
    if (S.sameContent(S.PROFILE_KEY, normalized)) return true; // inchangé : on garde l'horodatage
    normalized.updatedAt = new Date().toISOString();
    return S.writeRaw(S.PROFILE_KEY, normalized);
  };
})();
