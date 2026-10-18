// ==UserScript==
// @name         Every facility — Gatherer
// @namespace    mica.pcc
// @version      1.0
// @description  Script 1 of the note system: when a chart opens, gathers in parallel from the pages already proven readable and publishes one stamped packet (JSON in a page node + a tm-gather-update event) for the Psychiatry page to render. Read-only: reads, presents, writes nothing, clicks nothing. 0 stops it.
// @match        https://*.pointclickcare.com/*
// @match        https://*.pointclickcare.ca/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Gatherer.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Gatherer.user.js
// ==/UserScript==
(function () {
  'use strict';

  // THE GATHERER (v1.0) - his design (plan §3b/§3f +
  // 2026-10-18 speed ruling): the gather is PARALLEL, not a
  // walk - every stop is read as soon as it can be, the
  // Psychiatry page fills as facts land, and total time is
  // the slowest stop, not the sum. v1 reads the stops that
  // are readable on the CURRENT page (the copy-table header
  // facts on the Dash; the extractor tiles on Progress
  // Notes). Fetch-readers for the other stops (BIMS,
  // Profile/relationships, Admission PDF, Results/labs,
  // Facesheet) join stop by stop as each read is proven;
  // until then those stops report 'not-loaded' - a fact is
  // never invented and a gap is never silent.
  //
  // Stops and what they mine:
  //   header      Dash copy-table tiles -> admission,
  //               age/sex, room, allergies, weight,
  //               psych meds
  //   behaviors   Progress Notes tiles -> behavior counts
  //               + entries (every visit)
  //   diagnoses   Progress Notes tiles -> serious diagnoses
  //               (new patients/readmissions; carried on
  //               follow-ups - the tile still reports)
  //   bims        Forms -> latest BIMS + the series
  //   relations   Profile -> relationships
  //   facesheet   Facesheet -> the link + header facts
  //   admission   Admission Record PDF -> admission facts
  //   labs        Results -> monitoring gaps, metabolic
  //               awareness, renal/hepatic
  //   ownnotes    His forms -> his prior notes sweep
  //
  // Control laws: read-only; starts on chart open (his
  // handshake: opening the chart starts the gather); '0'
  // stops it; no intervals or observers - bounded one-shot
  // passes at load + a re-read on his clicks.

  var stopped = false;
  var NODE_ID = 'tmGatherPacket';

  function nowT() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  }
  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

  function emptyPacket() {
    var stops = {};
    ['header', 'behaviors', 'diagnoses', 'bims', 'relations', 'facesheet', 'admission', 'labs', 'ownnotes']
      .forEach(function (k) { stops[k] = { status: 'not-loaded', source: '', at: '' }; });
    return { v: 1, startedAt: nowT(), stops: stops };
  }
  var packet = emptyPacket();

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

  // The copy-table header tiles: a label element inside a
  // small tile; the value is the tile's text minus the label.
  function readHeader() {
    var labels = {
      'ADMISSION': 'admission', 'ADMISSION (RE-ENTRY)': 'admission',
      'AGE / SEX': 'ageSex', 'AGE/SEX': 'ageSex',
      'ROOM': 'room', 'ALLERGIES': 'allergies', 'WEIGHT': 'weight',
      'PSYCH MEDS': 'psychMeds'
    };
    var facts = {}, found = 0;
    var els = document.querySelectorAll('div,span,td');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.children.length > 1) continue;
      var key = labels[norm(el.textContent).toUpperCase()];
      if (!key || facts[key]) continue;
      var tile = el.parentElement;
      if (!tile) continue;
      var tileText = norm(tile.textContent);
      var labelText = norm(el.textContent);
      var value = tileText.slice(tileText.toUpperCase().indexOf(labelText.toUpperCase()) + labelText.length).trim();
      if (value) { facts[key] = value.slice(0, 300); found++; }
    }
    return found >= 2 ? facts : null;
  }

  // An extractor tile's compact text by its title.
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

  function gatherPass() {
    if (stopped) return;
    var changed = false;
    var h = readHeader();
    if (h && packet.stops.header.status !== 'landed') {
      packet.stops.header = { status: 'landed', source: 'Dash', at: nowT(), facts: h };
      changed = true;
    }
    var b = readTile(/^Behaviors?\b/i, 700);
    if (b && packet.stops.behaviors.status !== 'landed') {
      packet.stops.behaviors = { status: 'landed', source: 'Progress Notes', at: nowT(), summary: b };
      changed = true;
    }
    var dx = readTile(/^Diagnoses\b/i, 700);
    if (dx && packet.stops.diagnoses.status !== 'landed') {
      packet.stops.diagnoses = { status: 'landed', source: 'Progress Notes', at: nowT(), summary: dx };
      changed = true;
    }
    if (changed) publish();
  }

  // '0' is the kill-switch: the gather stops; nothing re-reads.
  document.addEventListener('keydown', function (e) {
    if (e.key !== '0' || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    stopped = true;
  }, true);
  document.addEventListener('click', function () { gatherPass(); }, true);

  [0, 600, 1500, 3000].forEach(function (ms) { setTimeout(gatherPass, ms); });
  publish();
})();
