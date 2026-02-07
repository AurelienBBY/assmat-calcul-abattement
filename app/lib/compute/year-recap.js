

(function () {
  "use strict";

  window.ABMAT = window.ABMAT || {};
  window.ABMAT.compute = window.ABMAT.compute || {};

  const Compute = window.ABMAT.compute;
  const S = window.ABMAT.storage;
  const C = window.ABMAT.calc;

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function pick(obj, keys) {
    if (!obj) return undefined;
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return undefined;
  }

  function safeLoadMonth(storage, year, monthIndex) {
    if (!storage) return { key: null, data: null };

    // Preferred: same API used by app.js
    if (typeof storage.loadMonth === "function") {
      try {
        return storage.loadMonth(year, monthIndex) || { key: null, data: null };
      } catch (e) {
        return { key: null, data: null };
      }
    }

    // Fallback: getMonth(year, monthIndex) returning data
    if (typeof storage.getMonth === "function") {
      try {
        const data = storage.getMonth(year, monthIndex) || null;
        return { key: null, data };
      } catch (e) {
        return { key: null, data: null };
      }
    }

    return { key: null, data: null };
  }

  function extractDayRows(data) {
    const arr =
      pick(data, ["days", "rows", "table", "entries", "lines"]) ||
      [];
    return Array.isArray(arr) ? arr : [];
  }

  function extractHours(row) {
    if (!row) return null;
    const v = pick(row, ["hours", "heures", "h", "duration", "duree", "durationHours"]);
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function computeAbattementForMonth(year, monthIndex, data) {
    if (!C) return 0;

    // Try multiple signatures to avoid coupling
    const candidates = [
      () => (typeof C.computeMonthAbattement === "function" ? C.computeMonthAbattement({ year, monthIndex, data }) : undefined),
      () => (typeof C.computeMonthAbattement === "function" ? C.computeMonthAbattement(data, year, monthIndex) : undefined),
      () => (typeof C.computeAbattementMonth === "function" ? C.computeAbattementMonth(data, year, monthIndex) : undefined),
      () => (typeof C.computeAbattement === "function" ? C.computeAbattement(data, year, monthIndex) : undefined),
    ];

    for (const fn of candidates) {
      try {
        const out = fn();
        if (out === undefined || out === null) continue;

        // Allow both numeric or object result
        if (typeof out === "number") return num(out);
        if (typeof out === "object") {
          // Common keys
          return num(pick(out, ["abattement", "abatt", "totalAbattement", "total_abattement"]));
        }
      } catch (e) {
        // continue
      }
    }

    return 0;
  }

  function computeDayCounts(data) {
    const rows = extractDayRows(data);
    let j_lt8 = 0;
    let j_ge8 = 0;

    for (const r of rows) {
      const h = extractHours(r);
      if (h === null) continue;
      if (h >= 8) j_ge8 += 1;
      else j_lt8 += 1;
    }

    return { j_lt8, j_ge8, daysCount: j_lt8 + j_ge8 };
  }

  function computeMoney(data) {
    const net = num(pick(data, ["netImposable", "net_imposable", "net", "netMonthly"]));
    const irf = num(pick(data, ["irf", "IRF", "indemnites", "indemnitesRepas", "irfAmount"]));
    return { net, irf, percu: net + irf };
  }

  function computeStatus(hasMoney, hasDays) {
    if (hasMoney && hasDays) return "ok";
    if (hasMoney || hasDays) return "incomplet";
    return "vide";
  }

  /**
   * Compute recap for a single month.
   * Returns an object compatible with the year recap renderer.
   */
  Compute.computeMonthRecap = function computeMonthRecap(year, monthIndex) {
    const loaded = safeLoadMonth(S, year, monthIndex);
    const data = loaded && loaded.data ? loaded.data : null;

    if (!data) {
      return {
        monthIndex,
        net: 0,
        irf: 0,
        percu: 0,
        abatt: 0,
        imposable: 0,
        j_lt8: 0,
        j_ge8: 0,
        status: "vide",
      };
    }

    const money = computeMoney(data);
    const days = computeDayCounts(data);

    const abatt = computeAbattementForMonth(year, monthIndex, data);
    const imposable = Math.max(0, money.percu - abatt);

    const hasMoney = (money.net > 0) || (money.irf > 0);
    const hasDays = (days.daysCount > 0);

    return {
      monthIndex,
      net: money.net,
      irf: money.irf,
      percu: money.percu,
      abatt,
      imposable,
      j_lt8: days.j_lt8,
      j_ge8: days.j_ge8,
      status: computeStatus(hasMoney, hasDays),
    };
  };

  /**
   * Compute recap for the whole year (12 months).
   * Returns: { year, totals: {...}, months: [...] }
   */
  Compute.computeYearRecap = function computeYearRecap(year) {
    const y = Number(year);

    const months = [];
    const totals = {
      net: 0,
      irf: 0,
      percu: 0,
      abatt: 0,
      imposable: 0,
      j_lt8: 0,
      j_ge8: 0,
    };

    for (let m = 0; m < 12; m++) {
      const rec = Compute.computeMonthRecap(y, m);
      months.push(rec);

      totals.net += num(rec.net);
      totals.irf += num(rec.irf);
      totals.percu += num(rec.percu);
      totals.abatt += num(rec.abatt);
      totals.imposable += num(rec.imposable);
      totals.j_lt8 += num(rec.j_lt8);
      totals.j_ge8 += num(rec.j_ge8);
    }

    return {
      year: y,
      totals,
      months,
    };
  };
})();