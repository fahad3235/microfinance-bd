/* microfinance-bd \u2014 pure logic (node-testable, no DOM).
 * Two methods:
 *  Flat      \u2014 service charge = P * charge% (one-off, flat method used by
 *               many Bangladeshi MFIs). Schedule is computed in INTEGER
 *               PAISA: weekly base = floor(totalPaisa / n), the remainder
 *               goes to the final week, so the schedule sums EXACTLY to
 *               the total payable.
 *  Declining \u2014 standard amortisation on the weekly rate annual%/52.
 *               Exact (unrounded) accumulation; the final week takes the
 *               remaining balance, so the balance ends at exactly 0.00.
 * Hand-verified anchors (computed independently in node):
 *  Flat P=50000, 12.5%, 46w -> charge 6250.00, total 56250.00,
 *    weekly 1222.83; schedule 45 x 1222.82 + final 1223.10.
 *  Declining P=50000, 20%/yr, 46w -> weekly 1188.03, total 54649.28,
 *    charge 4649.28; wk1 interest 192.31 / principal 995.72 /
 *    balance 49004.28; wk46 interest 4.55 / principal 1183.48 / 0.00.
 * Rounding note (declining): weekly figures are rounded to the paisa, so
 *  the sum of the 46 DISPLAYED instalments (54649.38) differs from the
 *  exact total payable (54649.28) by 0.10 \u2014 a standard rounding artefact.
 *  The flat schedule has no such gap (integer-paisa construction). */
(function (root) {
  'use strict';

  var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];
  var TAKA = '\u09f3';

  function toBnDigits(s) {
    return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }
  function r2(x) { return Math.round(x * 100) / 100; }

  /* Money: "\u09f31,222.83" (EN) / "\u09f3\u09e7,\u09e8\u09e8\u09e8.\u09ee\u09e9" (BN). Manual grouping so the
   * output is identical in node and in headless Chrome. */
  function fmtMoney(n, lang) {
    if (n === null || n === undefined || !isFinite(n)) return '\u2014';
    var neg = n < 0;
    var s = Math.abs(n).toFixed(2);
    var parts = s.split('.');
    var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var out = (neg ? '-' : '') + TAKA + intPart + '.' + parts[1];
    return lang === 'bn' ? toBnDigits(out) : out;
  }
  function fmtNum(n, lang) {
    if (n === null || n === undefined || !isFinite(n)) return '\u2014';
    var s = String(n);
    return lang === 'bn' ? toBnDigits(s) : s;
  }

  var LIMITS = {
    principalMin: 1000, principalMax: 500000,
    rateMin: 0, rateMax: 100,
    weeksMin: 4, weeksMax: 104,
    savingsWeeksMin: 1, savingsWeeksMax: 520
  };

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  /* Validate a calculator input set. Returns { ok, errors:[keys] }. */
  function validateCalc(principal, rate, weeks) {
    var errors = [];
    var p = num(principal);
    if (p === null) errors.push('principal-required');
    else if (p < LIMITS.principalMin || p > LIMITS.principalMax) errors.push('principal-range');
    var r = num(rate);
    if (r === null) errors.push('rate-required');
    else if (r <= LIMITS.rateMin || r > LIMITS.rateMax) errors.push('rate-range');
    var w = num(weeks);
    if (w === null) errors.push('weeks-required');
    else if (Math.floor(w) !== w || w < LIMITS.weeksMin || w > LIMITS.weeksMax) errors.push('weeks-range');
    return { ok: errors.length === 0, errors: errors };
  }

  function validateSavings(weekly, weeks) {
    var errors = [];
    var a = num(weekly);
    if (a === null) errors.push('savings-required');
    else if (a <= 0 || a > 100000) errors.push('savings-range');
    var w = num(weeks);
    if (w === null) errors.push('weeks-required');
    else if (Math.floor(w) !== w || w < LIMITS.savingsWeeksMin || w > LIMITS.savingsWeeksMax) errors.push('weeks-range');
    return { ok: errors.length === 0, errors: errors };
  }

  /* ---- FLAT method (integer paisa) ---- */
  function calcFlat(principal, chargePct, weeks) {
    var P = num(principal), pct = num(chargePct), n = Math.floor(num(weeks));
    var charge = r2(P * pct / 100);
    var total = r2(P + charge);
    var totalPaisa = Math.round(total * 100);
    var princPaisa = Math.round(P * 100);
    var baseInst = Math.floor(totalPaisa / n);
    var remInst = totalPaisa - baseInst * n;
    var basePrinc = Math.floor(princPaisa / n);
    var remPrinc = princPaisa - basePrinc * n;
    var schedule = [];
    var cumPrinc = 0;
    for (var w = 1; w <= n; w++) {
      var instP = baseInst + (w === n ? remInst : 0);
      var princP = basePrinc + (w === n ? remPrinc : 0);
      cumPrinc += princP;
      schedule.push({
        week: w,
        instalment: instP / 100,
        principal: princP / 100,
        charge: (instP - princP) / 100,
        balance: (princPaisa - cumPrinc) / 100
      });
    }
    return {
      method: 'flat', principal: P, rate: pct, weeks: n,
      charge: charge, total: total, weekly: r2(total / n),
      schedule: schedule
    };
  }

  /* ---- DECLINING method (standard amortisation) ---- */
  function calcDeclining(principal, annualPct, weeks) {
    var P = num(principal), pct = num(annualPct), n = Math.floor(num(weeks));
    var wr = pct / 100 / 52; /* weekly rate */
    var instExact = P * wr / (1 - Math.pow(1 + wr, -n));
    var weekly = r2(instExact);
    var total = r2(instExact * n);
    var charge = r2(total - P);
    var schedule = [];
    var bal = P;
    for (var w = 1; w <= n; w++) {
      var interestExact = bal * wr;
      var princExact = (w === n) ? bal : instExact - interestExact;
      var inst = (w === n) ? interestExact + princExact : instExact;
      schedule.push({
        week: w,
        instalment: r2(inst),
        principal: r2(princExact),
        charge: r2(interestExact),
        balance: r2(bal - princExact)
      });
      bal -= princExact;
    }
    return {
      method: 'declining', principal: P, rate: pct, weeks: n,
      charge: charge, total: total, weekly: weekly,
      schedule: schedule
    };
  }

  function calc(principal, rate, weeks, method) {
    return method === 'declining'
      ? calcDeclining(principal, rate, weeks)
      : calcFlat(principal, rate, weeks);
  }

  /* Compare flat vs declining for the same principal and term. */
  function compareFlatVsDeclining(principal, flatPct, annualPct, weeks) {
    var flat = calcFlat(principal, flatPct, weeks);
    var dec = calcDeclining(principal, annualPct, weeks);
    var diff = r2(Math.abs(flat.total - dec.total));
    var cheaper = flat.total < dec.total ? 'flat'
      : dec.total < flat.total ? 'declining' : 'equal';
    return { flat: flat, declining: dec, cheaper: cheaper, diff: diff };
  }

  /* Weekly savings estimator (compulsory weekly savings at MFIs). */
  function calcSavings(weeklyAmount, weeks) {
    var a = num(weeklyAmount), n = Math.floor(num(weeks));
    return { weekly: a, weeks: n, total: r2(a * n) };
  }

  /* ---- History import: strict validation ----
   * Accepts a JSON string (or already-parsed value) holding an array of
   * entries { principal, rate, weeks, method, createdAt? }.
   * Returns { ok:true, entries:[...] } or { ok:false, error:'<key>' }. */
  function parseImport(text) {
    var data;
    try {
      data = (typeof text === 'string') ? JSON.parse(text) : text;
    } catch (e) {
      return { ok: false, error: 'import-bad-json' };
    }
    if (!Array.isArray(data)) return { ok: false, error: 'import-not-array' };
    if (data.length === 0) return { ok: false, error: 'import-empty' };
    if (data.length > 200) return { ok: false, error: 'import-too-many' };
    var entries = [];
    for (var i = 0; i < data.length; i++) {
      var e = data[i];
      if (!e || typeof e !== 'object' || Array.isArray(e)) {
        return { ok: false, error: 'import-bad-entry' };
      }
      var v = validateCalc(e.principal, e.rate, e.weeks);
      if (!v.ok) return { ok: false, error: 'import-bad-entry' };
      if (e.method !== 'flat' && e.method !== 'declining') {
        return { ok: false, error: 'import-bad-entry' };
      }
      if (e.createdAt !== undefined && e.createdAt !== null &&
          typeof e.createdAt !== 'string' && typeof e.createdAt !== 'number') {
        return { ok: false, error: 'import-bad-entry' };
      }
      entries.push({
        id: (typeof e.id === 'string' && e.id) ? e.id : ('imp-' + Date.now() + '-' + i),
        principal: num(e.principal),
        rate: num(e.rate),
        weeks: Math.floor(num(e.weeks)),
        method: e.method,
        createdAt: e.createdAt || new Date().toISOString()
      });
    }
    return { ok: true, entries: entries };
  }

  var api = {
    LIMITS: LIMITS,
    toBnDigits: toBnDigits, fmtMoney: fmtMoney, fmtNum: fmtNum,
    validateCalc: validateCalc, validateSavings: validateSavings,
    calcFlat: calcFlat, calcDeclining: calcDeclining, calc: calc,
    compareFlatVsDeclining: compareFlatVsDeclining,
    calcSavings: calcSavings, parseImport: parseImport
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MFBD = api;
})(typeof self !== 'undefined' ? self : this);
