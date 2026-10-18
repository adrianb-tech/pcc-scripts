// ==UserScript==
// @name         Every facility — Gatherer
// @namespace    mica.pcc
// @version      1.2
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

  // The header facts (v1.2). His first live test landed
  // only Admission + Allergies by scraping the tile row.
  // The tile row is SELF-SOURCED (More/Less script): it
  // computes its values from PCC's native header with
  // proven finders. The Gatherer now uses THE SAME
  // finders, so a fact on the Psychiatry page is the same
  // fact as on his tiles by construction (his consistency
  // rule: a fact stated anywhere must match everywhere).
  // The v1.1 tile climb stays as a fallback.
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
  function isCrownHeights() {
    try {
      var els = document.querySelectorAll('select, button, a, span, div, td');
      for (var i = 0; i < els.length; i++) {
        var tx = (els[i].textContent || '').trim();
        if (tx.length > 90 || tx.length < 6) continue;
        if (!/crown\s*heights/i.test(tx)) continue;
        var r = null;
        try { r = els[i].getBoundingClientRect(); } catch (e) {}
        if (r && r.top >= -50 && r.top < 300) return true;
      }
    } catch (e) {}
    return false;
  }
  function roomBedNumber(withWing) {
    try {
      var txt = (document.body && document.body.textContent) ? document.body.textContent : '';
      var v = '';
      var m = txt.match(/\bLocation\s*:?\s*([^\n]*?)(?=\s*(?:Status|Code Status|Physician|DOB|Admission|Initial Admission|Discharge|Allergies|Special Instructions)\b|\n|$)/);
      if (m) v = m[1].replace(/\s+/g, ' ').trim();
      if (!v) {
        var li = txt.search(/\bLocation\b/i);
        if (li !== -1) v = txt.substr(li, 40).replace(/\s+/g, ' ').trim();
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
  function weightBlock() {
    var blocks = document.querySelectorAll('.vitalDetails');
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
  function selfHeader() {
    var out = {};
    try {
      var txt = (document.body && document.body.textContent) ? document.body.textContent : '';
      var m = txt.match(/\((\d{1,3})\/(Male|Female)\)/);
      if (m) out.ageSex = m[1] + (m[2] === 'Male' ? 'M' : 'F');
      var room = roomBedNumber(isCrownHeights());
      if (room) out.room = room;
      var al = document.querySelector('.residentAllergies .residentDetailValue');
      if (al) { var fa = fmtAllergies((al.textContent || '').trim()); if (fa) out.allergies = fa; }
      var a1 = txt.match(/Admission\s*\(re-?entry\)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (a1) out.admission = a1[1];
      else {
        var a2 = txt.match(/Initial Admission Date[^0-9]*?(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
        if (a2) out.admission = a2[1];
      }
      var wb = weightBlock();
      if (wb) { out.weight = wb.value; if (wb.flagged) out.weightFlagged = true; }
      var btn = document.getElementById('copyMedListBtn');
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
  function tileClimbHeader() {
    var labels = [
      ['ADMISSION (RE-ENTRY)', 'admission'], ['ADMISSION', 'admission'],
      ['AGE / SEX', 'ageSex'], ['AGE/SEX', 'ageSex'],
      ['ROOM', 'room'], ['ALLERGIES', 'allergies'],
      ['WEIGHT', 'weight'], ['PSYCH MEDS', 'psychMeds']
    ];
    var facts = {}, found = 0;
    var els = document.querySelectorAll('div,span,td,th');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var et = norm(el.textContent).toUpperCase();
      if (!et || et.length > 60) continue;
      var hit = null;
      for (var j = 0; j < labels.length; j++) {
        if (et === labels[j][0] || et.indexOf(labels[j][0]) === 0) { hit = labels[j]; break; }
      }
      if (!hit || facts[hit[1]]) continue;
      var node = el;
      for (var up = 0; up < 4 && node; up++) {
        var tt = norm(node.textContent);
        var rest = tt.toUpperCase().indexOf(hit[0]) === 0 ? tt.slice(hit[0].length).trim() : '';
        rest = rest.replace(/^Copy(?=\s|[A-Z])\s*/, '');
        if (rest && rest.length <= 600 && rest.toUpperCase() !== et) { facts[hit[1]] = rest.slice(0, 600); found++; break; }
        node = node.parentElement;
      }
    }
    return found ? facts : null;
  }
  function readHeader() {
    var out = selfHeader();
    var n = Object.keys(out).length;
    if (n < 4) {
      var fb = tileClimbHeader();
      if (fb) Object.keys(fb).forEach(function (k) { if (!out[k]) { out[k] = fb[k]; n++; } });
    }
    return n >= 2 ? out : null;
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
