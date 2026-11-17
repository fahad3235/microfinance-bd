/* microfinance-bd \u2014 UI wiring (DOM only; all math lives in logic.js). */
(function () {
  'use strict';

  var L = window.MFBD;
  var I18N = window.MFBD_I18N;
  var LANG_KEY = 'mfbd-lang';
  var HIST_KEY = 'mfbd-history';
  var MAX_HISTORY = 200;

  var lang = 'en';
  try { lang = localStorage.getItem(LANG_KEY) || 'en'; } catch (e) { lang = 'en'; }
  if (lang !== 'bn') lang = 'en';

  var currentCalc = null; /* last successful calculator result */
  var history = [];
  try { history = JSON.parse(localStorage.getItem(HIST_KEY) || '[]') || []; } catch (e) { history = []; }
  if (!Array.isArray(history)) history = [];

  function $(id) { return document.getElementById(id); }
  function t(key) { return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key; }
  function money(n) { return L.fmtMoney(n, lang); }
  function num(n) { return L.fmtNum(n, lang); }

  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* ---- i18n: apply all strings ---- */
  var TEXT_IDS = {
    'app-title': 'title', 'app-sub': 'subtitle', 'lang-btn': 'langBtn',
    'tab-calc': 'tabCalc', 'tab-compare': 'tabCompare',
    'tab-savings': 'tabSavings', 'tab-history': 'tabHistory',
    'calc-title': 'calcTitle', 'lbl-principal': 'principal',
    'lbl-rate': null, /* rate label depends on method; set in applyI18n */
    'lbl-weeks': 'weeks', 'lbl-method': 'method', 'lbl-flat': 'flat',
    'lbl-declining': 'declining', 'calc-btn': 'calcBtn',
    'lbl-weekly': 'weeklyInst', 'lbl-charge': 'totalCharge', 'lbl-total': 'totalPayable',
    'schedule-title': 'scheduleTitle', 'th-week': 'thWeek', 'th-inst': 'thInst',
    'th-princ': 'thPrinc', 'th-charge': 'thCharge', 'th-balance': 'thBalance',
    'th-total': 'thTotal', 'save-btn': 'saveBtn', 'rounding-note': 'roundingNote',
    'compare-title': 'compareTitle', 'lbl-cmp-principal': 'cmpPrincipal',
    'lbl-cmp-flat': 'cmpFlatRate', 'lbl-cmp-annual': 'cmpAnnualRate',
    'lbl-cmp-weeks': 'cmpWeeks', 'cmp-btn': 'cmpBtn',
    'lbl-cmp-flat-total': 'cmpFlatTotal', 'lbl-cmp-dec-total': 'cmpDecTotal',
    'savings-title': 'savingsTitle', 'savings-intro': 'savingsIntro',
    'lbl-sav-weekly': 'savWeekly', 'lbl-sav-weeks': 'savWeeks',
    'sav-btn': 'savBtn', 'lbl-sav-total': 'savTotal',
    'history-title': 'historyTitle', 'history-empty': 'historyEmpty',
    'export-btn': 'exportBtn', 'lbl-import': 'importBtn', 'import-btn': 'importBtn',
    'lbl-clear': 'clearLabel', 'clear-btn': 'clearBtn',
    'foot-disclaimer': 'footer'
  };
  function applyI18n() {
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
    Object.keys(TEXT_IDS).forEach(function (id) {
      var key = TEXT_IDS[id];
      if (!key) return;
      var el = $(id);
      if (el) el.textContent = t(key);
    });
    $('lbl-rate').textContent = method() === 'declining' ? t('rateDecl') : t('rateFlat');
    $('principal').placeholder = t('principalPh');
    $('rate').placeholder = t('ratePh');
    $('weeks').placeholder = t('weeksPh');
    $('import-text').placeholder = t('importPh');
    if (currentCalc) renderCalc(currentCalc);
    renderHistory();
  }

  function method() {
    var r = document.querySelector('input[name="method"]:checked');
    return r ? r.value : 'flat';
  }

  function errKey(k) {
    return 'err' + k.split('-').map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join('');
  }
  function showErrors2(el, keys) {
    el.innerHTML = '';
    keys.forEach(function (k) {
      var d = document.createElement('div');
      d.textContent = t(errKey(k));
      el.appendChild(d);
    });
  }

  /* ---- calculator ---- */
  function renderCalc(res) {
    $('results').hidden = false;
    $('res-weekly').textContent = money(res.weekly);
    $('res-charge').textContent = money(res.charge);
    $('res-total').textContent = money(res.total);
    var body = $('schedule-body');
    body.innerHTML = '';
    var sumInst = 0, sumPrinc = 0, sumCharge = 0;
    res.schedule.forEach(function (row) {
      var tr = document.createElement('tr');
      [num(row.week), money(row.instalment), money(row.principal), money(row.charge), money(row.balance)]
        .forEach(function (v) {
          var td = document.createElement('td');
          td.textContent = v;
          tr.appendChild(td);
        });
      body.appendChild(tr);
      sumInst += row.instalment; sumPrinc += row.principal; sumCharge += row.charge;
    });
    $('tot-inst').textContent = money(Math.round(sumInst * 100) / 100);
    $('tot-princ').textContent = money(Math.round(sumPrinc * 100) / 100);
    $('tot-charge').textContent = money(Math.round(sumCharge * 100) / 100);
    $('tot-balance').textContent = money(0);
  }

  $('calc-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var p = $('principal').value, r = $('rate').value, w = $('weeks').value;
    var v = L.validateCalc(p, r, w);
    if (!v.ok) {
      showErrors2($('calc-errors'), v.errors);
      $('results').hidden = true;
      currentCalc = null;
      return;
    }
    $('calc-errors').innerHTML = '';
    currentCalc = L.calc(p, r, w, method());
    renderCalc(currentCalc);
  });

  document.querySelectorAll('input[name="method"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      $('lbl-rate').textContent = method() === 'declining' ? t('rateDecl') : t('rateFlat');
    });
  });

  /* ---- compare ---- */
  $('cmp-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var p = $('cmp-principal').value, w = $('cmp-weeks').value;
    var v1 = L.validateCalc(p, $('cmp-flat-rate').value, w);
    var v2 = L.validateCalc(p, $('cmp-annual-rate').value, w);
    var errors = [];
    v1.errors.forEach(function (e) { if (errors.indexOf(e) === -1) errors.push(e); });
    v2.errors.forEach(function (e) { if (errors.indexOf(e) === -1) errors.push(e); });
    if (errors.length) {
      showErrors2($('cmp-errors'), errors);
      $('cmp-results').hidden = true;
      return;
    }
    $('cmp-errors').innerHTML = '';
    var cmp = L.compareFlatVsDeclining(p, $('cmp-flat-rate').value, $('cmp-annual-rate').value, w);
    $('cmp-results').hidden = false;
    $('cmp-flat-total').textContent = money(cmp.flat.total);
    $('cmp-flat-weekly').textContent = t('weeklyInst') + ': ' + money(cmp.flat.weekly);
    $('cmp-declining-total').textContent = money(cmp.declining.total);
    $('cmp-declining-weekly').textContent = t('weeklyInst') + ': ' + money(cmp.declining.weekly);
    var badge = $('cmp-badge');
    if (cmp.cheaper === 'flat') badge.textContent = t('cheaperFlat') + ' ' + money(cmp.diff);
    else if (cmp.cheaper === 'declining') badge.textContent = t('cheaperDec') + ' ' + money(cmp.diff);
    else badge.textContent = t('cheaperEqual');
  });

  /* ---- savings ---- */
  $('sav-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var v = L.validateSavings($('sav-weekly').value, $('sav-weeks').value);
    if (!v.ok) {
      showErrors2($('sav-errors'), v.errors);
      $('sav-result').hidden = true;
      return;
    }
    $('sav-errors').innerHTML = '';
    var s = L.calcSavings($('sav-weekly').value, $('sav-weeks').value);
    $('sav-total').textContent = money(s.total);
    $('sav-result').hidden = false;
  });

  /* ---- history ---- */
  function persistHistory() {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(history)); } catch (e) { /* storage full/blocked */ }
  }
  function entryLabel(e) {
    var m = e.method === 'flat' ? t('flat') : t('declining');
    return money(e.principal) + ' \u00b7 ' + m + ' \u00b7 ' + num(e.rate) + '% \u00b7 ' + num(e.weeks) + ' ' + t('weeksUnit');
  }
  function renderHistory() {
    var list = $('history-list');
    list.innerHTML = '';
    $('history-empty').hidden = history.length > 0;
    history.forEach(function (e) {
      var li = document.createElement('li');
      var div = document.createElement('div');
      var main = document.createElement('span');
      main.className = 'h-main';
      main.textContent = entryLabel(e);
      var sub = document.createElement('span');
      sub.className = 'h-sub';
      var res = L.calc(e.principal, e.rate, e.weeks, e.method);
      sub.textContent = t('weeklyInst') + ': ' + money(res.weekly) + ' \u00b7 ' + t('totalPayable') + ': ' + money(res.total);
      div.appendChild(main);
      div.appendChild(sub);
      var del = document.createElement('button');
      del.className = 'del';
      del.type = 'button';
      del.textContent = t('delBtn');
      del.setAttribute('data-id', e.id);
      del.addEventListener('click', function () {
        history = history.filter(function (h) { return h.id !== e.id; });
        persistHistory();
        renderHistory();
        toast(t('deleted'));
      });
      li.appendChild(div);
      li.appendChild(del);
      list.appendChild(li);
    });
  }

  $('save-btn').addEventListener('click', function () {
    if (!currentCalc) return;
    var entry = {
      id: 'h-' + Date.now(),
      principal: currentCalc.principal,
      rate: currentCalc.rate,
      weeks: currentCalc.weeks,
      method: currentCalc.method,
      createdAt: new Date().toISOString()
    };
    history.unshift(entry);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    persistHistory();
    renderHistory();
    toast(t('saved'));
  });

  $('export-btn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'microfinance-bd-history.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });

  $('import-btn').addEventListener('click', function () {
    var msg = $('import-msg');
    var res = L.parseImport($('import-text').value.trim());
    if (!res.ok) {
      var key = errKey(res.error);
      msg.className = 'msg err';
      msg.textContent = t('importFail').replace('{msg}', t(key));
      return;
    }
    history = res.entries.concat(history).slice(0, MAX_HISTORY);
    persistHistory();
    renderHistory();
    msg.className = 'msg ok';
    msg.textContent = t('importOk')
      .replace('{n}', num(res.entries.length))
      .replace('{ies}', res.entries.length === 1 ? 'y' : 'ies');
    $('import-text').value = '';
  });

  $('clear-btn').addEventListener('click', function () {
    var msg = $('clear-msg');
    if ($('clear-input').value.trim() !== 'DELETE') {
      msg.className = 'msg err';
      msg.textContent = t('clearFail');
      return;
    }
    history = [];
    persistHistory();
    renderHistory();
    $('clear-input').value = '';
    msg.className = 'msg ok';
    msg.textContent = t('clearOk');
  });

  /* ---- tabs ---- */
  document.querySelectorAll('#tabs .tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#tabs .tab').forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      document.querySelectorAll('.view').forEach(function (v) { v.hidden = true; });
      $('view-' + btn.dataset.view).hidden = false;
    });
  });

  /* ---- language ---- */
  $('lang-btn').addEventListener('click', function () {
    lang = lang === 'en' ? 'bn' : 'en';
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
    applyI18n();
  });

  applyI18n();
})();
