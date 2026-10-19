// ==UserScript==
// @name         Every facility — Psychiatry tab
// @namespace    mica.pcc
// @version      1.13
// @description  Adds a Psychiatry tab to the chart's tab bar. Clicking it opens the one page below the tabs (title, header tile row, Your words tile, section tiles). Toggles closed on the tab, on another tab, or with 0. Read-only; writes nothing anywhere.
// @match        https://*.pointclickcare.com/*
// @match        https://*.pointclickcare.ca/*
// @run-at       document-idle
// @allFrames    true
// @grant        none
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Psychiatry-tab.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Psychiatry-tab.user.js
// ==/UserScript==
(function () {
  'use strict';

  // The Psychiatry tab (his naming + placement, plan 2026-10-17):
  // its own tab in PCC's tab bar, styled as one of his MAIN tab
  // tiles (white tile, colored dot; filled while open). The page
  // renders BELOW the tabs, over whatever chart page he is on -
  // it never navigates him anywhere. Control laws: the page
  // opens only on his click; '0' closes it (never while typing);
  // clicking a real PCC tab closes it too. No timers beyond
  // bounded placement one-shots; a click anywhere re-seats the
  // tab if PCC re-renders the bar. Day one is the shell: the
  // header tile row + Your words (working) + the section tiles
  // the Gatherer will fill.

  var COLOR = '#be185d';   // rose - distinct from DASH blue,
                           // PROFILE violet, FORMS amber,
                           // PROG NOTES green
  var FONT = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  var ALL_TABS = ['DASH', 'PROFILE', 'CENSUS', 'MED DIAG', 'PROBLEMS', 'ALLERGIES', 'IMMUN',
    'ORDERS', 'WTS/VITALS', 'RESULTS', 'MDS', 'FORMS', 'ASSMNTS', 'THERAPY', 'PROG NOTES', 'CARE PLAN',
    'TASKS', 'MISC'];

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }

  function findBar() {
    var els = document.querySelectorAll('a,button,[role="tab"],td,li,span,div');
    var cands = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.children.length > 2) continue;
      var t = norm(el.textContent);
      if (ALL_TABS.indexOf(t) !== -1) cands.push(el);
    }
    var byNode = new Map(), recs = [];
    cands.forEach(function (el) {
      var node = el.parentElement;
      for (var up = 0; up < 8 && node; up++) {
        var rec = byNode.get(node);
        if (!rec) { rec = { node: node, names: {} }; byNode.set(node, rec); recs.push(rec); }
        rec.names[norm(el.textContent)] = 1;
        node = node.parentElement;
      }
    });
    var best = null;
    recs.forEach(function (rec) {
      var n = Object.keys(rec.names).length;
      if (n < 5) return;
      if (!best || n > best.n || (n === best.n && rec.node.querySelectorAll('*').length < best.size)) {
        best = { node: rec.node, n: n, size: rec.node.querySelectorAll('*').length };
      }
    });
    return best ? best.node : null;
  }

  var open = false;
  var words = '';        // his words live in memory only -
                         // never saved, never sent anywhere

  function styleTile(tile, isOpen) {
    tile.style.cssText = 'display:inline-flex;align-items:center;cursor:pointer;white-space:nowrap;' +
      'box-sizing:border-box;line-height:1.15;border-radius:12px;padding:10px 14px;' +
      'font:700 16px ' + FONT + ';box-shadow:0 1px 2px rgba(16,24,40,.05);' +
      (isOpen
        ? 'background:' + COLOR + ';color:#ffffff;border:1px solid ' + COLOR + ';'
        : 'background:#ffffff;color:#131c2b;border:1px solid #e2e8f0;');
    var dot = tile.querySelector('.tmTabDot');
    if (dot) {
      dot.style.cssText = 'display:inline-block;border-radius:50%;margin-right:8px;vertical-align:middle;' +
        (isOpen
          ? 'width:8px;height:8px;background:transparent;border:2.5px solid #ffffff;'
          : 'width:11px;height:11px;background:' + COLOR + ';border:2.5px solid transparent;');
    }
  }

  function miniTile(label, key) {
    return '<div style="flex:1 1 104px;min-width:96px;background:#f8fafc;border:1px solid #e2e8f0;' +
      'border-radius:10px;padding:7px 9px;">' +
      '<div style="font:700 10.5px ' + FONT + ';letter-spacing:.04em;color:#64748b;text-transform:uppercase;">' + label + '</div>' +
      '<div data-val-for="' + (key || '') + '" style="font:600 14px ' + FONT + ';color:#0f172a;margin-top:2px;white-space:pre-wrap;">—</div></div>';
  }

  // A tile that is a BUTTON (his spec): press it and its trend
  // pops out in place below the rows. Weight and BIMS work
  // this way; the pop-outs fill with real trends when the
  // Gatherer lands.
  function buttonTile(id, label, key) {
    return '<div id="' + id + '" role="button" style="flex:1 1 104px;min-width:96px;background:#ffffff;' +
      'border:1.5px solid #cbd5e1;border-radius:10px;padding:7px 9px;cursor:pointer;">' +
      '<div style="font:700 10.5px ' + FONT + ';letter-spacing:.04em;color:#64748b;text-transform:uppercase;">' + label + ' <span style="color:#94a3b8;">▾</span></div>' +
      '<div data-val-for="' + (key || '') + '" style="font:600 14px ' + FONT + ';color:#0f172a;margin-top:2px;white-space:pre-wrap;">—</div></div>';
  }

  function sectionTile(title, key) {
    return '<div style="flex:1 1 260px;min-width:230px;background:#ffffff;border:1px solid #e2e8f0;' +
      'border-radius:12px;padding:10px 12px;min-height:74px;">' +
      '<div style="font:700 13px ' + FONT + ';color:#0f172a;">' + title + '</div>' +
      '<div data-section-for="' + (key || '') + '" style="font:400 12.5px ' + FONT + ';color:#94a3b8;margin-top:4px;white-space:pre-wrap;">Arrives with the Gatherer.</div></div>';
  }

  // ---- BIMS trend pop-out (the weekend design, his
  // specs 2026-10-17 + the analysis line, 2026-10-19) ----
  // Press the BIMS tile: the trend pops out in place -
  // a true-time line over shaded severity bands, every
  // point dated, the dated scores as a table under it,
  // and a plain analysis of the scores over time.
  var bimsWin = 'all'; // 'all' = since admission
  function bimsBand(score) {
    if (score === null || score === undefined || isNaN(score)) return null;
    if (score >= 13) return { name: 'none', tile: '', band: 'rgba(255,255,255,0)' };
    if (score >= 10) return { name: 'mild', tile: '#fff5f6', band: 'rgba(254,205,211,.45)' };
    if (score >= 8) return { name: 'moderate', tile: '#ffeef0', band: 'rgba(253,164,175,.45)' };
    return { name: 'severe', tile: '#ffe4e6', band: 'rgba(251,113,133,.35)' };
  }
  function bimsPoints(win) {
    var pkt = readPacket();
    var ser = (pkt && pkt.stops && pkt.stops.bims && pkt.stops.bims.series) || [];
    var pts = ser.map(function (x) { return { d: new Date(x.date), score: x.score, label: x.date }; })
      .filter(function (x) { return !isNaN(x.d.getTime()); })
      .sort(function (a, b) { return a.d - b.d; });
    if (!pts.length) return pts;
    if (win !== 'all') {
      var months = win === '6m' ? 6 : 12;
      var cut = new Date(pts[pts.length - 1].d); cut.setMonth(cut.getMonth() - months);
      pts = pts.filter(function (x) { return x.d >= cut; });
    }
    // Thin older history to one point per month; keep
    // everything from the last 30 days (his rule).
    var last = pts[pts.length - 1].d, out = [], seenMonth = {};
    pts.forEach(function (x) {
      if (last - x.d <= 30 * 864e5) { out.push(x); return; }
      var k = x.d.getFullYear() + '-' + x.d.getMonth();
      if (!seenMonth[k]) { seenMonth[k] = 1; out.push(x); }
    });
    return out;
  }
  function spanText(a, b) {
    var days = Math.round((b - a) / 864e5);
    if (days < 45) return 'over ' + days + ' days';
    var months = Math.round(days / 30.44);
    if (months < 24) return 'over ' + months + (months === 1 ? ' month' : ' months');
    var yrs = (days / 365.25).toFixed(1).replace(/\.0$/, '');
    return 'over ' + yrs + ' years';
  }
  function bimsAnalysis(pts) {
    if (!pts.length) return '';
    var first = pts[0], lastP = pts[pts.length - 1];
    if (pts.length === 1) return 'One scored BIMS on file: ' + first.score + ' on ' + first.label + ' (' + bimsBand(first.score).name + '). No trend yet.';
    var delta = lastP.score - first.score;
    var dir = delta === 0 ? 'level overall' : (delta > 0 ? 'up ' + delta + ' overall' : 'down ' + Math.abs(delta) + ' overall');
    var s = pts.length + ' scored BIMS ' + spanText(first.d, lastP.d) + ': ' + first.score + ' \u2192 ' + lastP.score + ', ' + dir + '.';
    var step = 0, stepTxt = '';
    for (var i = 1; i < pts.length; i++) {
      var d = pts[i].score - pts[i - 1].score;
      if (Math.abs(d) > Math.abs(step)) { step = d; stepTxt = pts[i - 1].label + ' \u2192 ' + pts[i].label; }
    }
    if (step !== 0) s += ' Biggest single step: ' + (step > 0 ? '+' : '') + step + ' (' + stepTxt + ').';
    var bands = pts.map(function (x) { return bimsBand(x.score).name; });
    var same = bands.every(function (b) { return b === bands[0]; });
    if (same) s += ' Every score sits in the ' + bands[0] + ' band.';
    else {
      var path = [bands[0]];
      bands.forEach(function (b) { if (b !== path[path.length - 1]) path.push(b); });
      s += ' Band path: ' + path.join(' \u2192 ') + '.';
    }
    if (pts.length >= 2 && pts[pts.length - 1].score === pts[pts.length - 2].score) s += ' The last two scores are level at ' + lastP.score + '.';
    return s;
  }
  function renderBimsPop(p) {
    var pop = p.querySelector('#tmPsychBimsPop');
    if (!pop) return;
    var pts = bimsPoints(bimsWin);
    var seg = [['all', 'Since admission'], ['1y', '1 year'], ['6m', '6 months']].map(function (w) {
      var on = bimsWin === w[0];
      return '<button type="button" data-bims-win="' + w[0] + '" style="border:1px solid ' + (on ? '#0f172a' : '#cbd5e1') + ';background:' + (on ? '#0f172a' : '#ffffff') + ';color:' + (on ? '#ffffff' : '#334155') + ';border-radius:999px;padding:3px 10px;font:600 11.5px ' + FONT + ';cursor:pointer;">' + w[1] + '</button>';
    }).join(' ');
    if (!pts.length) { pop.innerHTML = '<div style="border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;max-width:520px;font:400 12.5px ' + FONT + ';color:#94a3b8;">No scored BIMS in this window.</div>'; wireBimsPop(p); return; }
    var W = 560, H = 168, PL = 26, PR = 10, PT = 10, PB = 30;
    var t0 = pts[0].d.getTime(), t1 = pts[pts.length - 1].d.getTime();
    if (t1 === t0) { t0 -= 15 * 864e5; t1 += 15 * 864e5; }
    function X(d) { return PL + (d.getTime() - t0) / (t1 - t0) * (W - PL - PR); }
    function Y(s) { return PT + (15 - s) / 15 * (H - PT - PB); }
    var bandsSvg = [[13, 15, bimsBand(14).band, 'none'], [10, 12, bimsBand(11).band, 'mild'], [8, 9, bimsBand(9).band, 'moderate'], [0, 7, bimsBand(5).band, 'severe']].map(function (b) {
      return '<rect x="' + PL + '" y="' + Y(b[1]) + '" width="' + (W - PL - PR) + '" height="' + (Y(b[0]) - Y(b[1])) + '" fill="' + b[2] + '"/>' +
        '<text x="2" y="' + (Y(b[1]) + 10) + '" font-size="8" fill="#94a3b8">' + b[3] + '</text>';
    }).join('');
    var line = pts.map(function (x) { return X(x.d).toFixed(1) + ',' + Y(x.score).toFixed(1); }).join(' ');
    var dots = pts.map(function (x) {
      return '<circle cx="' + X(x.d).toFixed(1) + '" cy="' + Y(x.score).toFixed(1) + '" r="3.5" fill="#0f172a"/>' +
        '<text x="' + X(x.d).toFixed(1) + '" y="' + (Y(x.score) - 8).toFixed(1) + '" font-size="10" font-weight="700" fill="#0f172a" text-anchor="middle">' + x.score + '</text>' +
        '<text x="' + X(x.d).toFixed(1) + '" y="' + (H - 8) + '" font-size="8.5" fill="#64748b" text-anchor="middle">' + x.label.replace(/\/\d{4}$/, '') + '</text>';
    }).join('');
    var rows = pts.slice().reverse().map(function (x) {
      var b = bimsBand(x.score);
      return '<tr><td style="padding:4px 8px;border-top:1px solid #f1f5f9;">' + x.label + '</td>' +
        '<td style="padding:4px 8px;border-top:1px solid #f1f5f9;font-weight:700;">' + x.score + '</td>' +
        '<td style="padding:4px 8px;border-top:1px solid #f1f5f9;color:#64748b;">' + b.name + '</td></tr>';
    }).join('');
    var first = pts[0], lastP = pts[pts.length - 1];
    // His sizing ruling (2026-10-19): the pop-out is a
    // tile-sized thing - capped at a double tile's width,
    // never the full panel.
    pop.innerHTML = '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;max-width:520px;">' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span style="font:700 13px ' + FONT + ';color:#0f172a;">BIMS trend</span>' +
      '<span style="font:400 12px ' + FONT + ';color:#64748b;">' + first.score + ' \u2192 ' + lastP.score + ' \u00b7 ' + spanText(first.d, lastP.d) + '</span>' +
      '<span style="margin-left:auto;display:flex;gap:4px;">' + seg + '</span></div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;margin-top:6px;">' + bandsSvg +
      '<polyline points="' + line + '" fill="none" stroke="#0f172a" stroke-width="1.6"/>' + dots + '</svg>' +
      '<table style="border-collapse:collapse;font:400 12.5px ' + FONT + ';color:#0f172a;margin-top:4px;"><tr><td style="padding:2px 8px;font-weight:700;color:#64748b;">Date</td><td style="padding:2px 8px;font-weight:700;color:#64748b;">Score</td><td style="padding:2px 8px;font-weight:700;color:#64748b;">Level</td></tr>' + rows + '</table>' +
      '<div style="font:400 12.5px ' + FONT + ';color:#334155;margin-top:8px;">' + bimsAnalysis(pts) + '</div></div>';
    wireBimsPop(p);
  }
  function wireBimsPop(p) {
    p.querySelectorAll('[data-bims-win]').forEach(function (b) {
      b.addEventListener('click', function () { bimsWin = b.getAttribute('data-bims-win'); renderBimsPop(p); });
    });
  }

  function buildPanel() {
    var p = document.createElement('div');
    p.id = 'tmPsychPage';
    p.style.cssText = 'background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;' +
      'margin:10px 8px;padding:14px;box-shadow:0 4px 16px rgba(16,24,40,.07);';
    p.innerHTML =
      '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px;">' +
        '<span style="font:800 19px ' + FONT + ';color:#0f172a;">Psychiatry</span>' +
        '<span style="font:400 12px ' + FONT + ';color:#94a3b8;">the one page — everything psychiatrically connected, in one place</span>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">' +
        buttonTile('tmPsychBimsTile', 'BIMS', 'bims') + miniTile('Facesheet', 'facesheet') + miniTile('Admission facts', 'admissionFacts') +
      '</div>' +
      '<div id="tmPsychBimsPop" style="display:none;margin-bottom:8px;"></div>' +
      '<div id="tmPsychStamp" style="font:400 11px ' + FONT + ';color:#94a3b8;margin-bottom:8px;">Gatherer: waiting…</div>' +
      '<div id="tmPsychDxSlot" style="margin-bottom:8px;"></div>' +
      '<div id="tmPsychBehSlot" style="margin-bottom:8px;"></div>' +
      '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px 12px;margin-bottom:10px;">' +
        '<div style="font:700 13px ' + FONT + ';color:#9a3412;">Your words</div>' +
        '<textarea id="tmPsychWords" rows="3" placeholder="Dictate or type here — verbatim, editable. Lives only on this page; nothing is saved or sent." ' +
          'style="width:100%;box-sizing:border-box;margin-top:6px;border:1px solid #fdba74;border-radius:8px;' +
          'padding:8px;font:400 14px ' + FONT + ';color:#0f172a;background:#ffffff;resize:vertical;"></textarea>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
        sectionTile('Script summary', 'summary') + sectionTile('Labs & monitoring', 'labs') + sectionTile('Your prior notes', 'ownnotes') +
      '</div>';
    fillSlots(p);
    renderPacketInto(p);
    var btile = p.querySelector('#tmPsychBimsTile');
    if (btile) btile.addEventListener('click', function () {
      var pop = p.querySelector('#tmPsychBimsPop');
      if (!pop) return;
      var show = pop.style.display === 'none';
      pop.style.display = show ? '' : 'none';
      if (show) renderBimsPop(p);
    });
    var ta = p.querySelector('#tmPsychWords');
    ta.value = words;
    ta.addEventListener('input', function () { words = ta.value; });
    return p;
  }

  // Render the Gatherer's packet into the page (v1.2).
  // Values land per stop; a stop that has not landed leaves
  // its tile at the honest dash.
  function readPacket() {
    try {
      var n = document.getElementById('tmGatherPacket');
      return n ? JSON.parse(n.textContent || '{}') : null;
    } catch (e) { return null; }
  }
  function renderPacketInto(p) {
    var pkt = readPacket();
    if (!pkt || !pkt.stops) return;
    var s = pkt.stops;
    function setVal(key, val) {
      var el = p.querySelector('[data-val-for="' + key + '"]');
      if (el && val) el.textContent = val;
    }
    if (s.relations && s.relations.status === 'landed') setVal('relations', (s.relations.summary || '').slice(0, 90));
    if (s.bims && s.bims.status === 'landed') {
      // His format: just the score and the date - no prior
      // list on the tile (2026-10-19). The series lives in
      // the pop-out behind the press.
      setVal('bims', (s.bims.facts && s.bims.facts.latest) || s.bims.summary || '');
      var bt = p.querySelector('#tmPsychBimsTile');
      if (bt) { var bb = bimsBand((s.bims.series || [])[0] ? (s.bims.series || [])[0].score : null); if (bb) bt.style.background = bb.tile; }
      var pop = p.querySelector('#tmPsychBimsPop');
      if (pop && pop.style.display !== 'none') renderBimsPop(p);
    }
    var dxFb = p.querySelector('[data-dx-fallback="1"]');
    if (dxFb && s.diagnoses && s.diagnoses.status === 'landed') {
      dxFb.style.color = '#0f172a';
      dxFb.textContent = (s.diagnoses.summary || '') + '\n— ' + s.diagnoses.source + ' · ' + s.diagnoses.at;
    }
    var behFb = p.querySelector('[data-beh-fallback="1"]');
    if (behFb && s.behaviors && s.behaviors.status === 'landed') {
      behFb.style.color = '#0f172a';
      behFb.textContent = (s.behaviors.summary || '') + '\n— ' + s.behaviors.source + ' · ' + s.behaviors.at;
    }
    function setSection(key, stop) {
      var el = p.querySelector('[data-section-for="' + key + '"]');
      if (el && stop && stop.status === 'landed') {
        el.style.color = '#0f172a';
        el.textContent = (stop.summary || '') + '\n— ' + stop.source + ' · ' + stop.at;
      }
    }
    setSection('labs', s.labs);
    setSection('ownnotes', s.ownnotes);
    var stamp = p.querySelector('#tmPsychStamp');
    if (stamp) {
      var landed = Object.keys(s).filter(function (k) { return s[k].status === 'landed'; });
      stamp.textContent = 'Gatherer: ' + landed.length + ' of ' + Object.keys(s).length +
        ' stops landed' + (landed.length ? ' · ' + landed.join(', ') : '') + ' · packet ' + (pkt.startedAt || '');
    }
  }
  document.addEventListener('tm-gather-update', function () {
    var p = document.getElementById('tmPsychPage');
    if (p && open) renderPacketInto(p);
  });

  // Live tiles (v1.4, his ask from the TREE capture): on the
  // Progress Notes page the REAL Diagnoses and Behavior tiles
  // move into the tab while it is open - the same nodes, so
  // their buttons, range pills, jump-to-note entries and
  // feedback marks all keep working - and they return to
  // their exact spots when the tab closes. On other pages
  // the slots show fallback cards the Gatherer fills.
  var adopted = [];
  // The chart is a shell: the extractor tiles live in the
  // Progress Notes FRAME, the tab lives in the shell. Find
  // a node by id in this document or any same-origin frame
  // document (v1.6, from his 2138 capture: the notes page
  // itself carries no tab bar at all).
  function findInFrames(id) {
    var n = document.getElementById(id);
    if (n) return n;
    var frames = document.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      try {
        var fd = frames[i].contentDocument;
        if (fd) { var fn = fd.getElementById(id); if (fn) return fn; }
      } catch (e) {}
    }
    return null;
  }
  function adoptTiles(p) {
    adopted = [];
    var jobs = [
      { slot: 'tmPsychDxSlot', ids: ['pnDxBtnRow', 'pnDxBox'] },
      { slot: 'tmPsychBehSlot', ids: ['pnBehBox'] }
    ];
    jobs.forEach(function (job) {
      var slot = p.querySelector('#' + job.slot);
      if (!slot) return;
      if (slot.dataset.live === '1') return;
      slot.innerHTML = '';
      job.ids.forEach(function (id) {
        var node = findInFrames(id);
        if (!node || !node.parentNode) return;
        var marker = node.ownerDocument.createComment('tmPsychSpot-' + id);
        node.parentNode.insertBefore(marker, node);
        slot.appendChild(node);
        adopted.push({ node: node, marker: marker });
      });
      if (slot.children.length) slot.dataset.live = '1';
    });
    fillSlots(p);
  }
  function restoreTiles(p) {
    adopted.forEach(function (a) {
      if (a.marker.isConnected && a.marker.parentNode) {
        a.marker.parentNode.insertBefore(a.node, a.marker);
        a.marker.parentNode.removeChild(a.marker);
      } else if (a.node.parentNode) {
        // The frame that owned the tile is gone; the tile
        // goes with its page (the extractors rebuild it on
        // the next notes load).
        a.node.parentNode.removeChild(a.node);
      }
    });
    adopted = [];
    ['tmPsychDxSlot', 'tmPsychBehSlot'].forEach(function (id) {
      var slot = p.querySelector('#' + id);
      if (slot) delete slot.dataset.live;
    });
    fillSlots(p);
  }
  function fillSlots(p) {
    var dx = p.querySelector('#tmPsychDxSlot');
    if (dx && !dx.children.length && dx.dataset.live !== '1') {
      dx.innerHTML = '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;">' +
        '<div style="font:700 13px ' + FONT + ';color:#0f172a;">Diagnoses</div>' +
        '<div data-dx-fallback="1" style="font:400 12.5px ' + FONT + ';color:#94a3b8;margin-top:4px;white-space:pre-wrap;">The live tile joins here when you open this tab on the Progress Notes page.</div></div>';
    }
    var beh = p.querySelector('#tmPsychBehSlot');
    if (beh && !beh.children.length && beh.dataset.live !== '1') {
      beh.innerHTML = '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;">' +
        '<div style="font:700 13px ' + FONT + ';color:#0f172a;">Behaviors</div>' +
        '<div data-beh-fallback="1" style="font:400 12.5px ' + FONT + ';color:#94a3b8;margin-top:4px;white-space:pre-wrap;">The live tile joins here when you open this tab on the Progress Notes page.</div></div>';
    }
  }

  // ---- Same-document hosting (v1.11) ----
  // The extractor tiles' functions split in two: buttons
  // bound on the elements travel anywhere, but the
  // behavior tile's jump-to-note rides a click handler
  // delegated on ITS document - moving the tile into the
  // shell document keeps the feedback buttons and kills
  // the jumps. So when the tiles live in a frame, the
  // panel opens INSIDE that frame (same document - every
  // function intact) and the shell tile calls across.
  // His requirement, 2026-10-19: the tiles bring their
  // saving and their jumping with them.
  function tilesFrameWin() {
    var frames = document.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      try {
        var fw = frames[i].contentWindow;
        var fd = frames[i].contentDocument;
        if (fw && fd && fw.__tmPsych && (fd.getElementById('pnBehBox') || fd.getElementById('pnDxBox'))) return fw;
      } catch (e) {}
    }
    return null;
  }
  function openHere() {
    // Runs inside the tiles' own document.
    var panel = document.getElementById('tmPsychPage');
    if (panel && panel.style.display !== 'none') { setOpen(false); return false; }
    if (!panel) {
      panel = buildPanel();
      var wrap = document.getElementById('pnTilesWrap');
      if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(panel, wrap);
      else if (document.body) document.body.insertBefore(panel, document.body.firstChild);
    } else panel.style.display = '';
    open = true;
    adoptTiles(panel);
    renderPacketInto(panel);
    return true;
  }
  try { window.__tmPsych = { openHere: openHere }; } catch (e) {}

  function setOpen(v, bar) {
    if (!v) {
      // Closing also closes a frame-hosted panel.
      try { var fw0 = tilesFrameWin(); if (fw0 && open) fw0.__tmPsych.openHere(); } catch (e) {}
    }
    open = v;
    var tile = document.getElementById('tmPsychTab');
    var panel = document.getElementById('tmPsychPage');
    if (tile) styleTile(tile, open);
    if (open) {
      if (!panel && bar) {
        panel = buildPanel();
        bar.parentNode.insertBefore(panel, bar.nextSibling);
      } else if (panel) panel.style.display = '';
      if (panel) { adoptTiles(panel); renderPacketInto(panel); }
    } else if (panel) {
      restoreTiles(panel);
      panel.style.display = 'none';
    }
  }

  function ensureTab() {
    try {
      var bar = findBar();
      if (!bar) return;
      var tile = document.getElementById('tmPsychTab');
      if (!tile) {
        tile = document.createElement('div');
        tile.id = 'tmPsychTab';
        tile.setAttribute('role', 'button');
        var dot = document.createElement('span');
        dot.className = 'tmTabDot';
        dot.setAttribute('aria-hidden', 'true');
        tile.appendChild(dot);
        tile.appendChild(document.createTextNode('Psychiatry'));
        tile.addEventListener('click', function (e) {
          e.stopPropagation();
          var fw = tilesFrameWin();
          if (fw) {
            // The tiles live in a frame: the panel opens
            // in the frame's document, not the shell's.
            var nowOpen = fw.__tmPsych.openHere();
            open = !!nowOpen;
            styleTile(tile, open);
            return;
          }
          setOpen(!open, findBar());
        });
        styleTile(tile, open);
      }
      // His ruling (2026-10-19): Psychiatry sits on the
      // LEFT, first in the bar, on every tab - the ASSMNTS
      // page had drifted it to the far right because the
      // tile was appended and PCC's own rendering ordered
      // the rest around it. Seat it first, and re-seat it
      // first on every pass.
      if (!bar.contains(tile) || bar.firstElementChild !== tile) {
        bar.insertBefore(tile, bar.firstChild);
      }
      // A re-rendered bar loses the panel too; if the page was
      // open, re-seat it under the new bar.
      if (open && !document.getElementById('tmPsychPage')) {
        bar.parentNode.insertBefore(buildPanel(), bar.nextSibling);
      }
    } catch (e) {}
  }

  // Clicking a real PCC tab means he is navigating - close.
  // (v1.13) ensureTab() no longer runs on clicks: it
  // re-seated the tile and rebuilt the panel inside the
  // click's own dispatch - work that can shift the bar
  // mid-click and eat the very navigation click he just
  // made (his report: tab clicks not registering). The
  // tile is seated by the load passes; clicks only close.
  document.addEventListener('click', function (e) {
    if (!open) return;
    var bar = findBar();
    if (bar && bar.contains(e.target) && !document.getElementById('tmPsychTab').contains(e.target)) {
      setOpen(false, bar);
    }
  }, true);

  // '0' closes - never while typing (the Your words tile is a
  // typing surface; his law: keys are dead while typing).
  document.addEventListener('keydown', function (e) {
    if (!open || e.key !== '0') return;
    var t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    setOpen(false, findBar());
  }, true);

  [0, 350, 900, 2000].forEach(function (ms) { setTimeout(ensureTab, ms); });
})();
