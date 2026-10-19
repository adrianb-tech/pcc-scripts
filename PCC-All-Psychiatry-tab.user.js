// ==UserScript==
// @name         Every facility — Psychiatry tab
// @namespace    mica.pcc
// @version      1.8
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
        miniTile('Relationships', 'relations') + miniTile('BIMS', 'bims') + miniTile('Facesheet', 'facesheet') + miniTile('Admission facts', 'admissionFacts') +
      '</div>' +
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
      var bl = (s.bims.facts && s.bims.facts.latest) || s.bims.summary || '';
      var ser = (s.bims.series || []).slice(1).map(function (x) { return x.score; });
      if (ser.length) bl += '\nprior: ' + ser.join(' · ');
      setVal('bims', bl);
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

  function setOpen(v, bar) {
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
  document.addEventListener('click', function (e) {
    ensureTab();
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
