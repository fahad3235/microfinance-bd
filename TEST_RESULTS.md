# Microfinance BD - Test Results

Run on 2026-11-17 (Asia/Dhaka), from
`~/workspace/muse-project-factory/builds/microfinance-bd/`.

## Unit tests - 54 passed, 0 failed

Command: `node tests/test.js`

Coverage: flat anchors, declining anchors, exact schedule sums, validation
boundaries, compare math, savings estimator, import validation (10 cases),
money formatting (EN/BN digits).

## Smoke tests - 36 passed, 0 failed

Command: `node tests/smoke.mjs` (raw-CDP headless Chrome,
`chromium_headless_shell-1187`, port 9226)

Coverage at 1440px and 390px: initial render, flat calc via real UI inputs
(weekly Tk 1,222.83), declining calc via real UI (weekly Tk 1,188.03), 46-row
schedule with exact totals, compare tab with cheaper badge, savings
estimator, save-to-history + reload persistence, BN toggle with Bengali
digits + persistence, malformed import rejected with data intact, zero
console/page errors, zero non-file network requests, 390px no horizontal
overflow (document and leaf-element checks).

## Hand-verified math anchors (asserted in tests)

All anchors were computed independently in node before the app was built
and are asserted exactly in `tests/test.js` (flat) and in the smoke test
(flat + declining via the real UI).

### Flat method - P=50,000, service charge 12.5%, 46 weeks

- Service charge: Tk 6,250.00
- Total payable: Tk 56,250.00
- Weekly instalment: Tk 1,222.83
- Schedule (integer paisa): 45 weeks x Tk 1,222.82 + final week Tk 1,223.10;
 sums exactly to Tk 56,250.00. Principal column sums exactly to Tk 50,000.00,
 charge column to Tk 6,250.00, final balance Tk 0.00.

### Declining method - P=50,000, annual rate 20%, 46 weeks

- Weekly rate: 0.20 / 52
- Weekly instalment: Tk 1,188.03
- Total payable: Tk 54,649.28
- Total charge: Tk 4,649.28
- Week 1: interest Tk 192.31, principal Tk 995.72, balance Tk 49,004.28
- Week 46: interest Tk 4.55, principal Tk 1,183.48, balance Tk 0.00

### Compare anchor

- Same loan (P=50,000, 46 weeks, flat 12.5% vs declining 20%):
 declining is cheaper by Tk 1,600.72.

### Rounding note (declining)

Weekly figures are rounded to the paisa, so the sum of the 46 displayed
declining instalments (Tk 54,649.38) differs from the exact total payable
(Tk 54,649.28) by Tk 0.10. This is a standard rounding artefact, documented in
the app (rounding note under the schedule) and in the README. The unit test
asserts the displayed sum is within Tk 0.50 of the exact total; the flat
schedule is asserted to sum exactly.

## Repairs made

1. **App bug - error-message key mapping (found by smoke test, repair cycle 1).**
 The smoke test "empty principal shows validation error" failed: the error
 area rendered the raw key `errprincipalRequired` instead of the message
 "Enter a loan amount." Cause: `errKey()` in `js/app.js` did not capitalise
 the first word, so `principal-required` mapped to `errprincipalRequired`
 while the i18n key is `errPrincipalRequired`; `t()` fell back to the key
 itself. The same bug affected import-error keys. Fix: capitalise every
 word in `errKey()` and reuse it for import errors. Re-ran smoke: 36/36.
 (App bug, not a test bug - the test expectation was correct.)
2. No other repairs. Unit tests passed 54/54 on the first run; no test
 expectation was changed.

## ASCII-sources check

`grep -rP '[^\x00-\x7F]' --include='*.html' --include='*.js' --include='*.css' .`
returns zero matches. Bengali is stored only as `\uXXXX` escapes in JS and
numeric HTML entities in HTML. (One em-dash found in a CSS comment during the
check was replaced with a hyphen.)
