/* ============================================================================
   storage/profile.js — Profil « Mes informations » (clé abmat:profile)
   ----------------------------------------------------------------------------
   { version:1, name, employer, mention,
     children: { "1": { name, active, week: { "1".."5": {in,out} } }, … } }
   week = semaine type (lundi=1 … vendredi=5), un créneau par jour.
   ========================================================================== */

(function () {
  "use strict";

  const S = window.ABMAT && window.ABMAT.storage;

  if (!S || !S.writeRaw) {
    throw new Error("storage/core.js doit être chargé avant storage/profile.js.");
  }

  S.PROFILE_KEY = "abmat:profile";

  function normalizeWeekDay(t) {
    const o = (t && typeof t === "object") ? t : {};
    return {
      in: (typeof o.in === "string") ? o.in : "",
      out: (typeof o.out === "string") ? o.out : ""
    };
  }

  function normalizeProfileChild(c) {
    const o = (c && typeof c === "object") ? c : {};
    const week = {};
    for (let d = 1; d <= 5; d++) {
      week[String(d)] = normalizeWeekDay(o.week && o.week[String(d)]);
    }
    return {
      name: (typeof o.name === "string") ? o.name : "",
      active: o.active !== false,
      week
    };
  }

  S.blankProfile = function blankProfile() {
    const children = {};
    for (let i = 1; i <= 3; i++) children[String(i)] = normalizeProfileChild(null);
    return { version: 1, name: "", employer: "", mention: "", children };
  };

  S.normalizeProfile = function normalizeProfile(p) {
    const src = (p && typeof p === "object") ? p : {};
    const out = S.blankProfile();
    out.name = (typeof src.name === "string") ? src.name : "";
    out.employer = (typeof src.employer === "string") ? src.employer : "";
    out.mention = (typeof src.mention === "string") ? src.mention : "";

    const childrenIn = (src.children && typeof src.children === "object") ? src.children : {};
    for (let i = 1; i <= 3; i++) {
      const k = String(i);
      const c = childrenIn[k];
      // Compat : accepte l'ancienne forme « nom en chaîne »
      out.children[k] = normalizeProfileChild((typeof c === "string") ? { name: c } : c);
    }
    if (typeof src.updatedAt === "string") out.updatedAt = src.updatedAt;
    return out;
  };

  S.loadProfile = function loadProfile() {
    try {
      const raw = localStorage.getItem(S.PROFILE_KEY);
      if (!raw) return null;
      return S.normalizeProfile(JSON.parse(raw));
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
