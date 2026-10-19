// ==UserScript==
// @name         Every facility — Gatherer
// @namespace    mica.pcc
// @version      2.4
// @description  Script 1 of the note system: when a chart opens, gathers in parallel - page-read stops from the page he is on plus background fetches of the chart's other pages (Assessments/BIMS, Profile, Results, Orders) discovered from the tab bar - and publishes one stamped packet for the tiles. Read-only: reads and presents; writes nothing, clicks nothing. 0 stops it.
// @match        https://*.pointclickcare.com/*
// @match        https://*.pointclickcare.ca/*
// @run-at       document-idle
// @allFrames    true
// @grant        none
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Gatherer.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Gatherer.user.js
// ==/UserScript==
(function () {
  'use strict';

  // THE GATHERER v2.0 - parallel by design (his ruling,
  // 2026-10-18: order doesn't matter, fastest wins). v1 read
  // the stops visible on the current page. v2 adds the
  // background FETCH stops, each reader proven offline
  // against his own captures:
  //   fetch: Assessments list -> BIMS series + his visit
  //          dates + latest MD acknowledgement (bims,
  //          ownnotes stops)
  //          Profile -> relationships (relations)
  //          Results list -> which reports exist, dated
  //          (labs)
  //          Orders -> active orders + the psych meds with
  //          dose/sig/start (orders)
  //   page:  header facts, behaviors, diagnoses (v1, from
  //          the proven finders), weights series when he is
  //          standing on Wts/Vitals (weights)
  //   still not-loaded, honestly: facesheet (uncaptured),
  //   admission (the PDF route is known - reader is the
  //   next increment, PDF.js bundled separately).
  // Stop URLs are DISCOVERED from the chart's own tab
  // links - nothing is guessed. Fetches are same-origin
  // GETs in his session. '0' aborts the gather.

  var stopped = false;
  var NODE_ID = 'tmGatherPacket';
  var fetched = false;

  function nowT() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  }
  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function txt(el) { return norm(el && (el.innerText !== undefined ? el.innerText : el.textContent)); }

  var STOP_KEYS = ['header', 'behaviors', 'diagnoses', 'bims', 'relations', 'facesheet', 'admission', 'labs', 'ownnotes', 'orders', 'weights'];
  function emptyPacket() {
    var stops = {};
    STOP_KEYS.forEach(function (k) { stops[k] = { status: 'not-loaded', source: '', at: '' }; });
    return { v: 2, startedAt: nowT(), stops: stops };
  }
  var packet = emptyPacket();

  // Per-resident persistence (v2.3, from his 'i don't see
  // any information gathered'): PCC's JSP pages return
  // shells to fetch, so several stops can only be read on
  // their own page. The packet now PERSISTS per resident
  // (localStorage, keyed by the chart's EID - the same
  // pattern as the G engine's per-resident storage): a
  // stop read once, on its own page, rides in the packet
  // on every other page afterwards, keeping its original
  // source + time stamp. Facts stay in his browser.
  function residentKey() {
    var m = location.href.match(/ESOLclientid=(EID_[A-Za-z0-9]+)/);
    if (m) return m[1];
    var as = document.querySelectorAll('a[href*="ESOLclientid="]');
    for (var i = 0; i < as.length; i++) {
      var mm = (as[i].getAttribute('href') || '').match(/ESOLclientid=(EID_[A-Za-z0-9]+)/);
      if (mm) return mm[1];
    }
    return null;
  }
  var storeKey = null;
  function loadStored() {
    try {
      storeKey = residentKey();
      if (!storeKey) return;
      var raw = localStorage.getItem('tmGatherV2:' + storeKey);
      if (!raw) return;
      var stored = JSON.parse(raw);
      if (!stored || !stored.stops) return;
      STOP_KEYS.forEach(function (k) {
        if (stored.stops[k] && stored.stops[k].status === 'landed') packet.stops[k] = stored.stops[k];
      });
    } catch (e) {}
  }
  // Adopt stored landings not yet landed in THIS frame
  // (v2.4): the chart is one shell page whose tabs swap
  // content frames - the Profile lives in a frame of its
  // own, so the Gatherer runs in every frame and the
  // packet converges through the shared per-resident
  // store. Stamps stay original.
  function mergeStored() {
    try {
      if (!storeKey) storeKey = residentKey();
      if (!storeKey) return;
      var raw = localStorage.getItem('tmGatherV2:' + storeKey);
      if (!raw) return;
      var stored = JSON.parse(raw);
      if (!stored || !stored.stops) return;
      var changed = false;
      STOP_KEYS.forEach(function (k) {
        if (packet.stops[k].status !== 'landed' && stored.stops[k] && stored.stops[k].status === 'landed') {
          packet.stops[k] = stored.stops[k];
          changed = true;
        }
      });
      if (changed) publish();
    } catch (e) {}
  }
  function saveStored() {
    try {
      if (!storeKey) storeKey = residentKey();
      if (storeKey) localStorage.setItem('tmGatherV2:' + storeKey, JSON.stringify(packet));
    } catch (e) {}
  }

  function publish() {
    var node = document.getElementById(NODE_ID);
    if (!node) {
      node = document.createElement('script');
      node.type = 'application/json';
      node.id = NODE_ID;
      node.style.display = 'none';
      (document.body || document.documentElement).appendChild(node);
    }
    node.textContent = JSON.stringify(packet);
    try { document.dispatchEvent(new CustomEvent('tm-gather-update')); } catch (e) {}
  }
  function land(key, data) {
    if (stopped) return;
    if (packet.stops[key] && packet.stops[key].status === 'landed') return;
    data.status = 'landed';
    packet.stops[key] = data;
    publish();
    saveStored();
  }

  // ---------- page-read stops (v1, proven finders) ----------
  function fmtAllergies(raw) {
    if (!raw) return '';
    var cleaned = raw.trim();
    if (/^no\s+known\s+(?:drug\s+)?allergies/i.test(cleaned) || /^nkda?/i.test(cleaned)) return 'NKA';
    var list = cleaned.split(/[,;\/\n]+/);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i].replace(/\s+/g, ' ').trim();
      item = item.replace(/(?:Copy|Copied)$/i, '').trim();
      if (!item) continue;
      item = item.replace(/\bpen[ie]cill?in\b/gi, 'PCN');
      out.push(item);
    }
    return out.join(', ');
  }
  function isCrownHeights(doc) {
    try {
      var els = doc.querySelectorAll('select, button, a, span, div, td');
      for (var i = 0; i < els.length; i++) {
        var tx = (els[i].textContent || '').trim();
        if (tx.length > 90 || tx.length < 6) continue;
        if (!/crown\s*heights/i.test(tx)) continue;
        return true;
      }
    } catch (e) {}
    return false;
  }
  function roomBedNumber(doc, withWing) {
    try {
      var t = (doc.body && doc.body.textContent) ? doc.body.textContent : '';
      var v = '';
      var m = t.match(/\bLocation\s*:?\s*([^\n]*?)(?=\s*(?:Status|Code Status|Physician|DOB|Admission|Initial Admission|Discharge|Allergies|Special Instructions)\b|\n|$)/);
      if (m) v = m[1].replace(/\s+/g, ' ').trim();
      if (!v) {
        var li = t.search(/\bLocation\b/i);
        if (li !== -1) v = t.substr(li, 40).replace(/\s+/g, ' ').trim();
      }
      var rm = v.match(/\b(\d{2,4})\s*-?\s*([A-Za-z])?\b/);
      if (!rm) return '';
      var pre = '';
      if (withWing) {
        var tok = v.slice(0, rm.index).match(/([A-Za-z]+)\s*$/);
        if (tok && /^(east|west)$/i.test(tok[1])) pre = tok[1].charAt(0).toUpperCase();
        else if (tok && tok[1].length === 1 && /[ew]/i.test(tok[1])) pre = tok[1].toUpperCase();
      }
      return pre + rm[1] + (rm[2] ? rm[2].toUpperCase() : '');
    } catch (e) { return ''; }
  }
  function weightBlock(doc) {
    var blocks = doc.querySelectorAll('.vitalDetails');
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i].querySelector('b');
      var v = blocks[i].querySelector('.vitalValue');
      if (b && v && /^weight$/i.test((b.textContent || '').trim())) {
        var m = (v.textContent || '').match(/([\d.]+)\s*lbs/i);
        if (m) {
          var td = blocks[i].closest ? blocks[i].closest('td') : null;
          return { value: m[1] + ' lbs', flagged: !!(td && td.classList && td.classList.contains('vitalWithException')) };
        }
      }
    }
    return null;
  }
  function selfHeader(doc) {
    var out = {};
    try {
      var t = (doc.body && doc.body.textContent) ? doc.body.textContent : '';
      var m = t.match(/\((\d{1,3})\/(Male|Female)\)/);
      if (m) out.ageSex = m[1] + (m[2] === 'Male' ? 'M' : 'F');
      var room = roomBedNumber(doc, isCrownHeights(doc));
      if (room) out.room = room;
      var al = doc.querySelector('.residentAllergies .residentDetailValue');
      if (al) { var fa = fmtAllergies((al.textContent || '').trim()); if (fa) out.allergies = fa; }
      var a1 = t.match(/Admission\s*\(re-?entry\)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (a1) out.admission = a1[1];
      else {
        var a2 = t.match(/Initial Admission Date[^0-9]*?(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
        if (a2) out.admission = a2[1];
      }
      var wb = weightBlock(doc);
      if (wb) { out.weight = wb.value; if (wb.flagged) out.weightFlagged = true; }
      var btn = doc.getElementById('copyMedListBtn');
      if (btn) {
        var bNode = btn.parentElement;
        for (var bUp = 0; bUp < 3 && bNode; bUp++) {
          var bTx = norm(bNode.textContent);
          if (/psych med list/i.test(bTx) && bTx.length > 30) {
            var meds2 = bTx.replace(/^Psych med list\s*(Copy\s*)?/i, '').trim();
            if (meds2) { out.psychMeds = meds2.slice(0, 300); break; }
          }
          bNode = bNode.parentElement;
        }
      }
    } catch (e) {}
    return out;
  }
  function readTile(titleRx, maxLen) {
    var wrap = document.getElementById('pnTilesWrap');
    if (!wrap) return null;
    var tiles = wrap.children;
    for (var i = 0; i < tiles.length; i++) {
      var tx = norm(tiles[i].textContent);
      if (titleRx.test(tx)) return tx.slice(0, maxLen);
    }
    return null;
  }
  function readWeightsPage(doc) {
    // Only on the real Weights and Vitals page - an
    // unguarded date+number scan false-positives on other
    // grids (it did on Orders in harness49).
    if (!/Weights and Vitals/i.test(doc.title || '')) return null;
    // Wts/Vitals history: rows carrying a date + a weight.
    // The numbers must be ANCHORED to a Weight column: the
    // vitals grid carries many numbers per row, and an
    // unanchored scan landed '49 lbs' (not a weight) in his
    // live test. Find the header cell that says Weight and
    // read only its column; no anchor, no landing.
    var tables = doc.querySelectorAll('table');
    for (var ti = 0; ti < tables.length; ti++) {
      var trows = tables[ti].querySelectorAll('tr');
      if (!trows.length) continue;
      var headCells = trows[0].cells ? Array.prototype.map.call(trows[0].cells, txt) : [];
      var wIdx = headCells.findIndex(function (c) { return /weight/i.test(c); });
      var dIdx = headCells.findIndex(function (c) { return /date/i.test(c); });
      if (wIdx < 0) continue;
      var pts = [];
      for (var i = 1; i < trows.length; i++) {
        var cells = trows[i].cells ? Array.prototype.map.call(trows[i].cells, txt) : [];
        var wv = parseFloat((cells[wIdx] || '').replace(/[^\d.]/g, ''));
        var dv = dIdx >= 0 ? (cells[dIdx] || '') : (cells.find(function (c) { return /\d{1,2}\/\d{1,2}\/\d{4}/.test(c); }) || '');
        var dm = dv.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
        if (dm && wv >= 50 && wv <= 700) pts.push({ date: dm[0], weight: wv });
      }
      if (pts.length >= 2) return pts.slice(0, 40);
    }
    return null;
  }
  function gatherPage() {
    if (stopped) return;
    mergeStored();
    var h = selfHeader(document);
    if (Object.keys(h).length >= 2) land('header', { source: 'Dash', at: nowT(), facts: h });
    var b = readTile(/^Behaviors?\b/i, 700);
    if (b) land('behaviors', { source: 'Progress Notes', at: nowT(), summary: b });
    var dx = readTile(/^Diagnoses\b/i, 700);
    if (dx) land('diagnoses', { source: 'Progress Notes', at: nowT(), summary: dx });
    var wp = readWeightsPage(document);
    if (wp) land('weights', { source: 'Wts/Vitals', at: nowT(), series: wp, summary: wp.length + ' dated weights; latest ' + wp[0].weight + ' lbs on ' + wp[0].date });
    // The fetch readers also run against the LIVE page when
    // he is standing on their page (v2.1 - the live test
    // showed ordersChart's raw fetch returns a shell, and
    // the relationships box lives in the rendered Profile).
    // Each reader self-selects: it lands only when its
    // markers are present, so these calls no-op elsewhere.
    try { parseAssessments(document); } catch (e) {}
    try { parseProfile(document); } catch (e) {}
    try { parseOrders(document); } catch (e) {}
    try { parseResults(document); } catch (e) {}
  }

  // ---------- fetch engine ----------
  function discoverUrls() {
    var map = {};
    var anchors = document.querySelectorAll('a[href]');
    var want = [
      [/assmnts|assessments/i, 'assess'],
      [/profile/i, 'profile'],
      [/results/i, 'results'],
      [/orders/i, 'orders'],
      [/wts|weights/i, 'weights']
    ];
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var label = norm(a.textContent);
      if (!label || label.length > 24) continue;
      for (var j = 0; j < want.length; j++) {
        if (want[j][0].test(label) && !map[want[j][1]]) {
          try { map[want[j][1]] = new URL(a.getAttribute('href'), location.href).href; } catch (e) {}
        }
      }
    }
    return map;
  }
  var controllers = [];
  function fetchDoc(url) {
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    if (ctl) { controllers.push(ctl); setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 12000); }
    return fetch(url, { credentials: 'same-origin', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.text(); })
      .then(function (html) { return new DOMParser().parseFromString(html, 'text/html'); });
  }

  function ctxt(el) {
    if (!el) return '';
    var c = el.cloneNode(true);
    var junk = c.querySelectorAll('script, style, pre');
    for (var i = 0; i < junk.length; i++) junk[i].remove();
    return norm(c.textContent);
  }
  function firstDate(cells) {
    for (var i = 0; i < cells.length; i++) {
      var m = cells[i].match(/\d{1,2}\/\d{1,2}\/\d{4}/);
      if (m) return m[0];
    }
    return '';
  }

  // ---------- fetch readers (proven on his captures) ------
  var BIMS_RE = /BIMS|cognitive|cognitively|impair|intact/i;
  var PSYCH_RE = /psychiatr|psych\s*:|psych\s+consult/i;
  var MDACK_RE = /MD:\s*Psychiatry\s+Consult\s+Ack/i;
  var DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
  var SCORE_RE = /^\d{1,2}(\.\d+)?$/;
  function parseAssessments(doc) {
    var heads = doc.querySelectorAll('th, td');
    var hasScore = false;
    for (var i = 0; i < heads.length; i++) if (/^Score$/i.test(ctxt(heads[i]))) { hasScore = true; break; }
    if (!hasScore) return;
    var bims = [], visits = [], mdAck = '';
    var rows = doc.querySelectorAll('tr');
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (!row.cells || row.cells.length < 6 || row.querySelector('tr')) continue;
      var t = Array.prototype.map.call(row.cells, ctxt);
      var dateStr = firstDate(t);
      if (!dateStr) continue;
      var rowText = t.join(' | ');
      var score = t.find(function (c) { return SCORE_RE.test(c); });
      if (MDACK_RE.test(rowText)) { if (!mdAck) mdAck = dateStr; }
      else if (PSYCH_RE.test(rowText)) { visits.push(dateStr); }
      else if (t.some(function (c) { return BIMS_RE.test(c); }) && score !== undefined) {
        var n = parseFloat(score);
        if (n >= 0 && n <= 15) bims.push({ date: dateStr, score: n });
      }
    }
    if (bims.length) {
      bims.sort(function (a, b2) { return new Date(b2.date) - new Date(a.date); });
      land('bims', { source: 'Assessments', at: nowT(), facts: { latest: bims[0].score + ' on ' + bims[0].date }, series: bims.slice(0, 24),
        summary: 'BIMS ' + bims[0].score + ' on ' + bims[0].date + ' · ' + bims.length + ' scored' });
    }
    if (visits.length || mdAck) {
      land('ownnotes', { source: 'Assessments', at: nowT(),
        summary: (visits.length ? 'Your consults: ' + visits.slice(0, 12).join(', ') : '') + (mdAck ? ' · latest MD acknowledgement ' + mdAck : '') });
    }
  }
  function parseProfile(doc) {
    var el = doc.querySelector('[data-fill-label="Relationships"]');
    var val = el ? (el.getAttribute('data-fill-value') || txt(el)) : '';
    if (!val) {
      var els = doc.querySelectorAll('div, span, td');
      for (var i = 0; i < els.length; i++) {
        if (/^Relationships$/i.test(txt(els[i])) && els[i].parentElement) {
          var pt = txt(els[i].parentElement);
          if (pt.length > 14) { val = pt.replace(/^Relationships\s*/i, ''); break; }
        }
      }
    }
    if (!val && /Resident Profile/i.test(doc.title || '')) {
      // Fetched Profile pages carry PCC's native contacts,
      // not the tile box: collect the relation words.
      var words = ['self', 'spouse', 'wife', 'husband', 'daughter', 'son', 'sister', 'brother', 'mother', 'father', 'friend', 'niece', 'nephew', 'partner', 'guardian'];
      var bodyT = (doc.body && doc.body.textContent) || '';
      var found = words.filter(function (wd) { return new RegExp('\\b' + wd + '\\b', 'i').test(bodyT); });
      if (found.length) val = found.join(', ');
    }
    // A placeholder is not a fact: the tile row shows '-'
    // until a grab, and landing it first would block the
    // real value (land is first-wins). His live Dash test
    // landed relations as '-' - never again.
    if (val && !/^[—–-]+$/.test(norm(val)) && !/^N\/?A$/i.test(norm(val))) {
      land('relations', { source: 'Profile', at: nowT(), summary: norm(val).slice(0, 300) });
    }
  }
  function parseResults(doc) {
    var reports = [];
    var rows = doc.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
      var link = rows[i].querySelector('[onclick*="viewReportPopup"]');
      if (!link) continue;
      var cells = rows[i].cells ? Array.prototype.map.call(rows[i].cells, ctxt) : [];
      var date = firstDate(cells);
      var name = '';
      for (var k = 0; k < cells.length; k++) if (cells[k].length > name.length && !/Actions/i.test(cells[k])) name = cells[k];
      reports.push({ name: name.slice(0, 80), date: date });
    }
    if (reports.length) {
      land('labs', { source: 'Results', at: nowT(), reports: reports.slice(0, 40),
        summary: reports.length + ' reports · latest ' + (reports[0].name || '') + ' ' + (reports[0].date || '') });
    }
  }
  var PSYCH_MED_RE = /alprazolam|xanax|citalopram|celexa|escitalopram|lexapro|sertraline|zoloft|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|venlafaxine|effexor|duloxetine|cymbalta|desvenlafaxine|bupropion|wellbutrin|mirtazapine|remeron|trazodone|nefazodone|vilazodone|vortioxetine|clozapine|clozaril|olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|paliperidone|invega|aripiprazole|abilify|ziprasidone|geodon|lurasidone|latuda|cariprazine|brexpiprazole|haloperidol|haldol|fluphenazine|chlorpromazine|perphenazine|loxapine|asenapine|iloperidone|divalproex|depakote|valproate|lamotrigine|lamictal|carbamazepine|tegretol|oxcarbazepine|lithium|gabapentin|neurontin|pregabalin|lyrica|topiramate|hydroxyzine|vistaril|buspirone|clonazepam|klonopin|lorazepam|ativan|diazepam|valium|temazepam|zolpidem|ambien|eszopiclone|zaleplon|ramelteon|suvorexant|doxepin|amitriptyline|nortriptyline|imipramine|clomipramine|methylphenidate|amphetamine|adderall|lisdexamfetamine|vyvanse|atomoxetine|guanfacine|clonidine|prazosin|propranolol|benztropine|donepezil|memantine|rivastigmine|galantamine|naltrexone|acamprosate|disulfiram|methadone|buprenorphine/i;
  function parseOrders(doc) {
    var active = [], psych = [];
    var rows = doc.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row.cells || row.cells.length < 5) continue;
      var t = Array.prototype.map.call(row.cells, ctxt);
      var statusIdx = t.findIndex(function (c) { return /^Active$/i.test(c); });
      if (statusIdx < 0) continue;
      // The sig cell ('Give 1 tablet by mouth...') anchors the
      // medication cell right before it (layout rows carry
      // empty and Actions cells ahead of the pair).
      var sigIdx = t.findIndex(function (c) { return /^(Give|Apply|Inject|Take|Instill|Inhale)\b/i.test(c); });
      var medCell = sigIdx > 0 ? t[sigIdx - 1] : '';
      var sig = sigIdx >= 0 ? t[sigIdx] : '';
      var start = '';
      for (var k = statusIdx + 1; k < t.length; k++) if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(t[k])) { start = t[k]; break; }
      if (!medCell) continue;
      var rec = { name: medCell.slice(0, 90), sig: sig.slice(0, 140), start: start.slice(0, 16) };
      active.push(rec);
      if (PSYCH_MED_RE.test(medCell)) psych.push(rec);
    }
    if (active.length) {
      land('orders', { source: 'Orders', at: nowT(), active: active.length, psych: psych.slice(0, 30),
        summary: active.length + ' active orders · ' + psych.length + ' psychiatric: ' +
          psych.slice(0, 8).map(function (p) { return p.name; }).join('; ') });
    }
  }
  function parseWeights(doc) {
    var wp = readWeightsPage(doc);
    if (wp) land('weights', { source: 'Wts/Vitals', at: nowT(), series: wp, summary: wp.length + ' dated weights; latest ' + wp[0].weight + ' lbs on ' + wp[0].date });
  }

  function gatherFetches() {
    if (fetched || stopped) return;
    var urls = discoverUrls();
    var jobs = [];
    function add(key, url, fn) {
      if (!url) return;
      jobs.push(fetchDoc(url).then(function (doc) { if (!stopped) fn(doc); }).catch(function () {}));
    }
    add('assess', urls.assess, parseAssessments);
    add('profile', urls.profile, parseProfile);
    add('results', urls.results, parseResults);
    add('orders', urls.orders, parseOrders);
    add('weights', urls.weights, parseWeights);
    if (jobs.length) { fetched = true; Promise.allSettled(jobs); }
  }

  // '0' is the kill-switch: stop everything, abort fetches.
  document.addEventListener('keydown', function (e) {
    if (e.key !== '0' || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    stopped = true;
    controllers.forEach(function (c) { try { c.abort(); } catch (err) {} });
  }, true);
  document.addEventListener('click', function () { gatherPage(); gatherFetches(); }, true);

  loadStored();
  [0, 600, 1500, 3000].forEach(function (ms) { setTimeout(function () { gatherPage(); gatherFetches(); }, ms); });
  publish();

  // Harness hook (inert in the browser): lets the offline
  // suite drive the readers against captured pages.
  try { window.__tmGather = { packet: packet, parseAssessments: parseAssessments, parseProfile: parseProfile, parseResults: parseResults, parseOrders: parseOrders, land: land }; } catch (e) {}
})();
