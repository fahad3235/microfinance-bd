# Microfinance BD

A complete, offline, bilingual (English / Bangla) microfinance loan calculator
for Bangladesh - Grameen-style weekly instalments, built as a single static
web app with zero network requests.

## Problem

Microfinance institutions (MFIs) in Bangladesh typically collect loans in
**weekly** instalments, using either a **flat service-charge** method or a
**declining-balance** method. Borrowers rarely have a simple way to check what
a loan really costs, how each week's payment splits between principal and
charge, or which method is cheaper for the same loan. Existing EMI calculators
assume monthly reducing-balance payments and do not match MFI practice.

## Features

1. **Loan calculator** - principal Tk 1,000-500,000, service-charge % (flat) or
 annual rate % (declining), term 4-104 weeks, method toggle. Shows weekly
 instalment, total service charge and total payable, with inline validation
 errors for out-of-range or empty inputs.
2. **Repayment schedule** - week-by-week table (week, instalment, principal
 part, charge part, remaining balance) plus a totals row. The flat schedule
 is computed in integer paisa, so it sums **exactly** to the total payable.
 The declining schedule is standard amortisation with the final week
 adjusted so the balance ends at exactly Tk 0.00.
3. **Compare** - flat vs declining side by side for the same principal and
 term, with totals and a "cheaper by Tk X" badge.
4. **Weekly savings estimator** - weekly savings amount x weeks = total
 savings (MFIs commonly collect compulsory weekly savings).
5. **History** - save a calculation to localStorage, list with delete, JSON
 export / import with strict validation (malformed imports are rejected and
 existing data stays intact), and typed-`DELETE` clear-all.
6. **Bilingual UI** - English / Bangla toggle persisted in localStorage, with
 Bengali digits in Bangla mode. Responsive down to 390px with no horizontal
 overflow. Footer disclaimer: educational estimates only.

## Stack

- Plain HTML + CSS + JavaScript, no frameworks, no build step, no network.
- `js/logic.js` - pure, node-testable calculation logic (no DOM).
- `js/i18n.js` - English / Bangla strings.
- `js/app.js` - DOM wiring only.
- All sources are pure ASCII: Bengali text lives in JS as `\uXXXX` escapes
 and in HTML as numeric entities.

## Install / run

No installation needed. Open `index.html` in any modern browser, or serve
the folder with any static server, e.g.:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Testing

```sh
node tests/test.js # node unit tests (54 checks)
node tests/smoke.mjs # headless-Chrome UI smoke test, 1440px + 390px (36 checks)
```

See `TEST_RESULTS.md` for the real results, including the hand-verified
math anchors.

## Deployment

Static site - copy the folder to any static host (GitHub Pages, Netlify, or
any web server). No environment variables, no backend, no secrets.

## Limitations

- **Declining-method rounding:** weekly figures are rounded to the paisa, so
 the sum of the displayed instalments can differ from the exact total
 payable by a few paisa (for the anchor case: displayed sum Tk 54,649.38 vs
 exact total Tk 54,649.28 - a Tk 0.10 rounding artefact). The flat schedule has
 no such gap; it sums exactly by construction.
- Weekly rate is the annual rate divided by 52; real MFIs may use 46-52
 collection weeks per year or their own rounding rules.
- Figures are estimates for education only. Actual MFI terms vary by
 institution and loan product; this is not financial advice.
- History and language preference live in the browser's localStorage only.

## Status

Complete MVP. Unit tests 54/54, headless-Chrome smoke tests 36/36, zero
console errors, zero non-file network requests.
