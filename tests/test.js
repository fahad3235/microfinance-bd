/* microfinance-bd \u2014 node unit tests. Run: node tests/test.js */
'use strict';
const assert = require('node:assert');
const L = require('../js/logic.js');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + ' \u2014 ' + e.message); }
}
const sum = (rows, k) => Math.round(rows.reduce((s, r) => s + r[k], 0) * 100) / 100;

/* ---- flat anchors: P=50000, 12.5%, 46 weeks ---- */
check('flat: charge 6250.00', () => {
  assert.strictEqual(L.calcFlat(50000, 12.5, 46).charge, 6250);
});
check('flat: total 56250.00', () => {
  assert.strictEqual(L.calcFlat(50000, 12.5, 46).total, 56250);
});
check('flat: weekly 1222.83', () => {
  assert.strictEqual(L.calcFlat(50000, 12.5, 46).weekly, 1222.83);
});
check('flat: schedule has 46 rows', () => {
  assert.strictEqual(L.calcFlat(50000, 12.5, 46).schedule.length, 46);
});
check('flat: first 45 weeks are 1222.82', () => {
  const s = L.calcFlat(50000, 12.5, 46).schedule;
  for (let i = 0; i < 45; i++) assert.strictEqual(s[i].instalment, 1222.82, 'week ' + (i + 1));
});
check('flat: final week is 1223.10', () => {
  assert.strictEqual(L.calcFlat(50000, 12.5, 46).schedule[45].instalment, 1223.10);
});
check('flat: schedule instalments sum exactly to total', () => {
  const r = L.calcFlat(50000, 12.5, 46);
  assert.strictEqual(sum(r.schedule, 'instalment'), r.total);
});
check('flat: schedule principal sums exactly to 50000', () => {
  assert.strictEqual(sum(L.calcFlat(50000, 12.5, 46).schedule, 'principal'), 50000);
});
check('flat: schedule charge sums exactly to 6250', () => {
  assert.strictEqual(sum(L.calcFlat(50000, 12.5, 46).schedule, 'charge'), 6250);
});
check('flat: final balance is 0', () => {
  assert.strictEqual(L.calcFlat(50000, 12.5, 46).schedule[45].balance, 0);
});
check('flat: another case sums exactly (P=12345, 9.75%, 52w)', () => {
  const r = L.calcFlat(12345, 9.75, 52);
  assert.strictEqual(sum(r.schedule, 'instalment'), r.total);
  assert.strictEqual(sum(r.schedule, 'principal'), 12345);
  assert.strictEqual(r.schedule[51].balance, 0);
});

/* ---- declining anchors: P=50000, 20%/yr, 46 weeks ---- */
check('declining: weekly 1188.03', () => {
  assert.strictEqual(L.calcDeclining(50000, 20, 46).weekly, 1188.03);
});
check('declining: total 54649.28', () => {
  assert.strictEqual(L.calcDeclining(50000, 20, 46).total, 54649.28);
});
check('declining: charge 4649.28', () => {
  assert.strictEqual(L.calcDeclining(50000, 20, 46).charge, 4649.28);
});
check('declining: week 1 interest 192.31', () => {
  assert.strictEqual(L.calcDeclining(50000, 20, 46).schedule[0].charge, 192.31);
});
check('declining: week 1 principal 995.72', () => {
  assert.strictEqual(L.calcDeclining(50000, 20, 46).schedule[0].principal, 995.72);
});
check('declining: week 1 balance 49004.28', () => {
  assert.strictEqual(L.calcDeclining(50000, 20, 46).schedule[0].balance, 49004.28);
});
check('declining: week 46 interest 4.55', () => {
  assert.strictEqual(L.calcDeclining(50000, 20, 46).schedule[45].charge, 4.55);
});
check('declining: week 46 principal 1183.48', () => {
  assert.strictEqual(L.calcDeclining(50000, 20, 46).schedule[45].principal, 1183.48);
});
check('declining: week 46 balance 0.00', () => {
  assert.strictEqual(L.calcDeclining(50000, 20, 46).schedule[45].balance, 0);
});
check('declining: displayed instalments within 0.50 of exact total (rounding note)', () => {
  const r = L.calcDeclining(50000, 20, 46);
  assert.ok(Math.abs(sum(r.schedule, 'instalment') - r.total) <= 0.50);
});
check('declining: another case ends at 0 (P=80000, 15%, 52w)', () => {
  const r = L.calcDeclining(80000, 15, 52);
  assert.strictEqual(r.schedule[51].balance, 0);
  assert.strictEqual(r.schedule.length, 52);
});

/* ---- validation boundaries ---- */
check('validate: principal 999 rejected', () => {
  assert.ok(L.validateCalc(999, 12.5, 46).errors.includes('principal-range'));
});
check('validate: principal 1000 accepted', () => {
  assert.ok(L.validateCalc(1000, 12.5, 46).ok);
});
check('validate: principal 500000 accepted', () => {
  assert.ok(L.validateCalc(500000, 12.5, 46).ok);
});
check('validate: principal 500001 rejected', () => {
  assert.ok(L.validateCalc(500001, 12.5, 46).errors.includes('principal-range'));
});
check('validate: empty principal rejected', () => {
  assert.ok(L.validateCalc('', 12.5, 46).errors.includes('principal-required'));
});
check('validate: rate 0 rejected', () => {
  assert.ok(L.validateCalc(50000, 0, 46).errors.includes('rate-range'));
});
check('validate: rate 100 accepted', () => {
  assert.ok(L.validateCalc(50000, 100, 46).ok);
});
check('validate: weeks 3 rejected', () => {
  assert.ok(L.validateCalc(50000, 12.5, 3).errors.includes('weeks-range'));
});
check('validate: weeks 4 accepted', () => {
  assert.ok(L.validateCalc(50000, 12.5, 4).ok);
});
check('validate: weeks 104 accepted', () => {
  assert.ok(L.validateCalc(50000, 12.5, 104).ok);
});
check('validate: weeks 105 rejected', () => {
  assert.ok(L.validateCalc(50000, 12.5, 105).errors.includes('weeks-range'));
});
check('validate: non-integer weeks rejected', () => {
  assert.ok(L.validateCalc(50000, 12.5, 46.5).errors.includes('weeks-range'));
});

/* ---- compare ---- */
check('compare: declining cheaper by 1600.72 (anchors)', () => {
  const c = L.compareFlatVsDeclining(50000, 12.5, 20, 46);
  assert.strictEqual(c.cheaper, 'declining');
  assert.strictEqual(c.diff, 1600.72);
});
check('compare: flat cheaper when flat rate is tiny', () => {
  const c = L.compareFlatVsDeclining(50000, 1, 20, 46);
  assert.strictEqual(c.cheaper, 'flat');
  assert.ok(c.diff > 0);
});
check('compare: totals match the single-method calcs', () => {
  const c = L.compareFlatVsDeclining(50000, 12.5, 20, 46);
  assert.strictEqual(c.flat.total, L.calcFlat(50000, 12.5, 46).total);
  assert.strictEqual(c.declining.total, L.calcDeclining(50000, 20, 46).total);
});

/* ---- savings estimator ---- */
check('savings: 50 x 46 = 2300', () => {
  assert.strictEqual(L.calcSavings(50, 46).total, 2300);
});
check('savings: 100 x 52 = 5200', () => {
  assert.strictEqual(L.calcSavings(100, 52).total, 5200);
});
check('savings: zero weekly rejected', () => {
  assert.ok(L.validateSavings(0, 46).errors.includes('savings-range'));
});
check('savings: 521 weeks rejected', () => {
  assert.ok(L.validateSavings(50, 521).errors.includes('weeks-range'));
});

/* ---- import validation ---- */
check('import: valid array accepted', () => {
  const r = L.parseImport(JSON.stringify([
    { principal: 50000, rate: 12.5, weeks: 46, method: 'flat' },
    { principal: 80000, rate: 20, weeks: 52, method: 'declining', createdAt: '2026-11-17' }
  ]));
  assert.ok(r.ok);
  assert.strictEqual(r.entries.length, 2);
});
check('import: malformed JSON rejected', () => {
  assert.strictEqual(L.parseImport('{not json').ok, false);
});
check('import: non-array rejected', () => {
  assert.strictEqual(L.parseImport('{"principal":50000}').ok, false);
});
check('import: empty array rejected', () => {
  assert.strictEqual(L.parseImport('[]').ok, false);
});
check('import: entry missing principal rejected', () => {
  assert.strictEqual(L.parseImport(JSON.stringify([{ rate: 12.5, weeks: 46, method: 'flat' }])).ok, false);
});
check('import: principal out of range rejected', () => {
  assert.strictEqual(L.parseImport(JSON.stringify([{ principal: 999, rate: 12.5, weeks: 46, method: 'flat' }])).ok, false);
});
check('import: non-integer weeks rejected', () => {
  assert.strictEqual(L.parseImport(JSON.stringify([{ principal: 50000, rate: 12.5, weeks: 46.5, method: 'flat' }])).ok, false);
});
check('import: unknown method rejected', () => {
  assert.strictEqual(L.parseImport(JSON.stringify([{ principal: 50000, rate: 12.5, weeks: 46, method: 'simple' }])).ok, false);
});
check('import: string entry rejected', () => {
  assert.strictEqual(L.parseImport(JSON.stringify(['hello'])).ok, false);
});
check('import: >200 entries rejected', () => {
  const big = Array.from({ length: 201 }, () => ({ principal: 50000, rate: 12.5, weeks: 46, method: 'flat' }));
  assert.strictEqual(L.parseImport(JSON.stringify(big)).ok, false);
});

/* ---- formatting ---- */
check('fmtMoney EN: 1222.83 -> \u09f31,222.83', () => {
  assert.strictEqual(L.fmtMoney(1222.83, 'en'), '\u09f31,222.83');
});
check('fmtMoney BN: 1222.83 uses Bengali digits', () => {
  assert.strictEqual(L.fmtMoney(1222.83, 'bn'), '\u09f3\u09e7,\u09e8\u09e8\u09e8.\u09ee\u09e9');
});
check('fmtNum BN: 46 -> \u09ea\u09ec', () => {
  assert.strictEqual(L.fmtNum(46, 'bn'), '\u09ea\u09ec');
});

console.log(`\nUnit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
