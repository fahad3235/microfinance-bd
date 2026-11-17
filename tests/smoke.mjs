/* microfinance-bd headless-Chrome smoke test (raw CDP, no deps).
 * Run: node tests/smoke.mjs  (from the microfinance-bd folder)
 * Loads index.html over file://, drives the real UI, collects
 * console/page errors, asserts visible state at 1440px and 390px.
 * All source in this file is ASCII; Bengali is detected by Unicode
 * code-point range (U+0980-U+09FF), never by literal characters. */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const PAGE_URL = 'file:///home/hatch/workspace/muse-project-factory/builds/microfinance-bd/index.html';
const PORT = 9226;

let pass = 0, fail = 0;
const errors = [];
const netReqs = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' &#8212; ' + extra : '')); }
}

const chrome = spawn(SHELL, ['--headless', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${PORT}`, 'about:blank'], { stdio: 'ignore' });

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error('headless_shell did not start');
}

let msgId = 0;
const pending = new Map();
let ws;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
}
async function click(selector) {
  await evalJs(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) throw new Error('missing ' + ${JSON.stringify(selector)}); e.click(); return true; })()`);
}
async function setVal(selector, value) {
  await evalJs(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); e.value = ${JSON.stringify(value)}; e.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
}
/* true when the string holds at least one Bengali code point (U+0980-U+09FF) */
const HAS_BN = `(s) => [...String(s)].some((c) => { const n = c.codePointAt(0); return n >= 0x0980 && n <= 0x09FF; })`;

try {
  const wsUrl = await getWsUrl();
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE.ERROR: ' + JSON.stringify(m.params.args).slice(0, 300));
    if (m.method === 'Network.requestWillBeSent') netReqs.push(m.params.request.url);
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(1500);

  /* ---- initial render ---- */
  check('title is Microfinance BD', await evalJs(`document.title.includes('Microfinance BD')`));
  check('4 tabs rendered', await evalJs(`document.querySelectorAll('#tabs .tab').length`) === 4);
  check('calculator view visible', await evalJs(`!document.querySelector('#view-calc').hidden`));
  check('disclaimer footer present', await evalJs(`document.querySelector('#foot-disclaimer').textContent.includes('not financial advice')`));
  check('no horizontal overflow at 1440px', await evalJs(`document.documentElement.scrollWidth <= 1440`));

  /* ---- flat calc: P=50000, 12.5%, 46w -> weekly 1222.83 ---- */
  await setVal('#principal', '50000');
  await setVal('#rate', '12.5');
  await setVal('#weeks', '46');
  await click('#calc-btn');
  await sleep(400);
  check('flat weekly is 1222.83', await evalJs(`document.querySelector('#res-weekly').textContent`) === '\u09f31,222.83');
  check('flat total is 56250.00', await evalJs(`document.querySelector('#res-total').textContent`) === '\u09f356,250.00');
  check('flat charge is 6250.00', await evalJs(`document.querySelector('#res-charge').textContent`) === '\u09f36,250.00');
  check('schedule renders 46 rows', await evalJs(`document.querySelectorAll('#schedule-body tr').length`) === 46);
  check('schedule totals row sums to 56250.00', await evalJs(`document.querySelector('#tot-inst').textContent`) === '\u09f356,250.00');
  check('schedule final balance is 0.00', await evalJs(`[...document.querySelectorAll('#schedule-body tr')].pop().lastElementChild.textContent`) === '\u09f30.00');

  /* ---- declining calc: same loan, 20%/yr -> weekly 1188.03 ---- */
  await click('#method-declining');
  await sleep(200);
  await setVal('#rate', '20');
  await click('#calc-btn');
  await sleep(400);
  check('declining weekly is 1188.03', await evalJs(`document.querySelector('#res-weekly').textContent`) === '\u09f31,188.03');
  check('declining total is 54649.28', await evalJs(`document.querySelector('#res-total').textContent`) === '\u09f354,649.28');
  check('declining charge is 4649.28', await evalJs(`document.querySelector('#res-charge').textContent`) === '\u09f34,649.28');
  check('declining schedule still 46 rows', await evalJs(`document.querySelectorAll('#schedule-body tr').length`) === 46);
  check('declining week 1 interest is 192.31', await evalJs(`document.querySelector('#schedule-body tr').children[3].textContent`) === '\u09f3192.31');
  check('declining final balance is 0.00', await evalJs(`[...document.querySelectorAll('#schedule-body tr')].pop().lastElementChild.textContent`) === '\u09f30.00');

  /* ---- validation: empty principal shows error ---- */
  await setVal('#principal', '');
  await click('#calc-btn');
  await sleep(300);
  check('empty principal shows validation error', await evalJs(`document.querySelector('#calc-errors').textContent.includes('loan amount')`));
  await setVal('#principal', '50000');

  /* ---- compare tab ---- */
  await click('#tab-compare');
  await sleep(300);
  await setVal('#cmp-principal', '50000');
  await setVal('#cmp-flat-rate', '12.5');
  await setVal('#cmp-annual-rate', '20');
  await setVal('#cmp-weeks', '46');
  await click('#cmp-btn');
  await sleep(400);
  check('compare flat total 56250.00', await evalJs(`document.querySelector('#cmp-flat-total').textContent`) === '\u09f356,250.00');
  check('compare declining total 54649.28', await evalJs(`document.querySelector('#cmp-declining-total').textContent`) === '\u09f354,649.28');
  check('compare badge says declining cheaper by 1600.72', await evalJs(`document.querySelector('#cmp-badge').textContent.includes('Declining is cheaper by') && document.querySelector('#cmp-badge').textContent.includes('1,600.72')`));

  /* ---- savings tab ---- */
  await click('#tab-savings');
  await sleep(300);
  await setVal('#sav-weekly', '50');
  await setVal('#sav-weeks', '46');
  await click('#sav-btn');
  await sleep(300);
  check('savings 50 x 46 = 2300.00', await evalJs(`document.querySelector('#sav-total').textContent`) === '\u09f32,300.00');

  /* ---- history: save, then malformed import rejected, data intact ---- */
  await click('#tab-calc');
  await sleep(200);
  await click('#method-flat');
  await setVal('#rate', '12.5');
  await click('#calc-btn');
  await sleep(400);
  await click('#save-btn');
  await sleep(300);
  await click('#tab-history');
  await sleep(300);
  check('history lists 1 saved entry', await evalJs(`document.querySelectorAll('#history-list li').length`) === 1);
  check('history entry shows 50000 loan', await evalJs(`document.querySelector('#history-list li').textContent.includes('50,000')`));
  await setVal('#import-text', '{bad json');
  await click('#import-btn');
  await sleep(300);
  check('malformed import rejected', await evalJs(`document.querySelector('#import-msg').textContent.includes('rejected')`));
  check('history intact after rejected import', await evalJs(`document.querySelectorAll('#history-list li').length`) === 1);

  /* ---- BN toggle: Bengali digits + persistence across reload ---- */
  await click('#tab-calc');
  await sleep(200);
  await click('#lang-btn');
  await sleep(400);
  check('BN toggle renders Bengali title', await evalJs(`(${HAS_BN})(document.querySelector('#app-title').textContent)`));
  check('BN weekly result uses Bengali digits', await evalJs(`(${HAS_BN})(document.querySelector('#res-weekly').textContent)`));
  check('BN lang persisted in localStorage', await evalJs(`localStorage.getItem('mfbd-lang')`) === 'bn');
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(1500);
  check('BN title survives reload', await evalJs(`(${HAS_BN})(document.querySelector('#app-title').textContent)`));
  await click('#tab-history');
  await sleep(300);
  check('history entry survives reload', await evalJs(`document.querySelectorAll('#history-list li').length`) === 1);
  await click('#lang-btn');
  await sleep(300);
  check('EN toggle back restores English title', await evalJs(`document.querySelector('#app-title').textContent.includes('Microfinance BD')`));

  /* ---- mobile 390px ---- */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(800);
  check('390px no horizontal overflow', await evalJs(`document.documentElement.scrollWidth <= 391`));
  check('no leaf element overflows 390px viewport', await evalJs(`(() => {
    const bad = [];
    document.querySelectorAll('body *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width > 391 || r.right > 391) bad.push(el.tagName + '.' + (el.className || '')); });
    return bad.length === 0 ? true : bad.slice(0, 5).join(','); })()`) === true);

  /* ---- network / errors ---- */
  const nonFile = netReqs.filter((u) => !u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('blob:') && u !== 'about:blank');
  check('zero non-file network requests', nonFile.length === 0, nonFile.join(', '));
  check('zero console/page errors', errors.length === 0, errors.join(' | ').slice(0, 300));
} catch (e) {
  fail++;
  console.log('FAIL harness error &#8212; ' + e.message);
} finally {
  chrome.kill();
}

console.log(`\nSmoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
