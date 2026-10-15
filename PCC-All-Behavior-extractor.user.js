// ==UserScript==
// @name         Every facility — Progress Notes: behavior extractor
// @namespace    mica.pcc
// @version      1.6
// @description  On the Progress Notes View All page, reads the loaded notes and shows a Behavior tile under the Diagnoses tile: how many notes in the last 7 days mention each behavior/symptom signal (refusals, agitation, falls, poor sleep...). Negated mentions ("no agitation", "denies falling") and template labels do not count. Display + Copy only; nothing is clicked or filled.
// @match        https://*.pointclickcare.com/*
// @match        https://*.pointclickcare.ca/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Behavior-extractor.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Behavior-extractor.user.js
// ==/UserScript==

(function () {
  'use strict';

  // Behavior / symptom signals (his list, agreed 2026-10-15 - he will
  // tune it with Mica as real charts come in). Each note counts ONCE
  // per signal, however many times the words appear in it.
  var SIGNALS = [
    { label: 'Refusals', words: ['refused', 'refuses', 'refusing', 'refusal'] },
    { label: 'Agitation', words: ['agitated', 'agitation', 'agitating', 'restless', 'restlessness'] },
    { label: 'Sundowning', words: ['sundowning', 'sundowner'] },
    { label: 'Poor sleep', phrases: ['poor sleep', 'did not sleep', "didn't sleep", 'slept poorly', 'unable to sleep', 'up all night', 'awake all night', 'sleepless'], words: ['insomnia'] },
    { label: 'Falls', words: ['fell', 'fall', 'falls'], phrases: ['found on the floor', 'found on floor', 'slid out of bed', 'slid out of the chair', 'slipped out of bed'] },
    { label: 'Yelling / calling out', words: ['yelling', 'screaming', 'shouting'], phrases: ['calling out', 'vocalizing', 'vocalization'] },
    { label: 'Wandering', words: ['wandering', 'wandered'], phrases: ['exit seeking', 'exit-seeking', 'trying to leave', 'attempted to leave', 'attempting to leave'] },
    { label: 'Aggression', words: ['hitting', 'struck', 'kicked', 'kicking', 'biting', 'scratching', 'combative', 'aggressive', 'assaultive'], phrases: ['spit at', 'spitting at', 'threw at', 'throwing objects'] },
    { label: 'Tearfulness', words: ['tearful', 'tearfulness', 'crying', 'weeping'], phrases: ['crying spells', 'crying episodes'] },
    { label: 'Anxiety', words: ['anxious', 'anxiety', 'panicky', 'worried'], phrases: ['panic attack'] },
    { label: 'Poor appetite', phrases: ['poor appetite', 'appetite poor', 'decreased appetite', 'appetite decreased', 'no appetite', 'not eating', 'refusing meals', 'refused meals', 'refusing food', 'refused food', 'poor intake'] },
    { label: 'Withdrawn', words: ['withdrawn'], phrases: ['isolating', 'isolates', 'stays in room', 'stayed in room', 'remains in room', 'in room all day', 'refuses activities', 'refused activities', 'not participating'] }
  ];

  // Template / boilerplate contexts that must NOT count as a Fall.
  var FALL_GUARDS = [/fall\s+risk/i, /risk\s+of\s+fall/i, /risk\s+for\s+fall/i, /fall\s+precaution/i, /fall\s+prevention/i, /falls\s+risk/i];
  var NEG = /\b(no|not|denies|denied|deny|without|none|never|absent|free of)\b/i;

  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  var COMPILED = SIGNALS.map(function (sig) {
    var pats = [];
    (sig.words || []).forEach(function (w) { pats.push(new RegExp('\\b' + escRe(w) + '\\b', 'gi')); });
    (sig.phrases || []).forEach(function (p) { pats.push(new RegExp(escRe(p).replace(/\s+/g, '\\s+'), 'gi')); });
    return { label: sig.label, pats: pats };
  });

  // A match counts unless it is negated in its own sentence (a
  // negation word shortly before it) or, for falls, part of a
  // template phrase like "fall risk".
  function matchCounts(text, m, isFall) {
    var start = m.index, end = start + m[0].length;
    if (isFall) {
      var around = text.slice(Math.max(0, start - 14), end + 14);
      for (var g = 0; g < FALL_GUARDS.length; g++) if (FALL_GUARDS[g].test(around)) return false;
    }
    // sentence start: last ., !, ? or newline before the match
    var cut = Math.max(
      text.lastIndexOf('.', start - 1), text.lastIndexOf('!', start - 1),
      text.lastIndexOf('?', start - 1), text.lastIndexOf('\n', start - 1),
      text.lastIndexOf(';', start - 1));
    var before = text.slice(cut + 1, start);
    if (before.length > 48) before = before.slice(before.length - 48);
    if (NEG.test(before)) return false;
    return true;
  }

  // The sentence a match lives in, so the tile can describe
  // what actually happened (his ask, v1.6).
  function sentenceAround(text, idx) {
    var start = Math.max(text.lastIndexOf('.', idx - 1), text.lastIndexOf('\n', idx - 1),
      text.lastIndexOf('!', idx - 1), text.lastIndexOf('?', idx - 1)) + 1;
    if (idx - start > 90) {
      // Run-on template text with no sentence break: keep the
      // clause around the match instead of the whole blob.
      start = idx - 90;
      var sp = text.indexOf(' ', start);
      if (sp !== -1 && sp < idx) start = sp + 1;
    }
    var ends = [text.indexOf('.', idx), text.indexOf('\n', idx), text.indexOf('!', idx), text.indexOf('?', idx)]
      .filter(function (x) { return x !== -1; });
    var end = ends.length ? Math.min.apply(null, ends) + 1 : text.length;
    var s = text.slice(start, end).replace(/\s+/g, ' ').trim();
    if (s.length > 170) s = s.slice(0, 167).trim() + '\u2026';
    return s;
  }

  function noteScan(text) {
    var found = {};
    COMPILED.forEach(function (sig) {
      var isFall = sig.label === 'Falls';
      for (var i = 0; i < sig.pats.length && !found[sig.label]; i++) {
        var re = sig.pats[i];
        re.lastIndex = 0;
        var m;
        while ((m = re.exec(text)) !== null) {
          if (matchCounts(text, m, isFall)) { found[sig.label] = sentenceAround(text, m.index); break; }
          if (m[0].length === 0) re.lastIndex++;
        }
      }
    });
    return found;
  }

  function noteSignals(text) {
    var hits = {};
    COMPILED.forEach(function (sig) {
      var isFall = sig.label === 'Falls';
      for (var i = 0; i < sig.pats.length; i++) {
        var re = sig.pats[i];
        re.lastIndex = 0;
        var m;
        while ((m = re.exec(text)) !== null) {
          if (matchCounts(text, m, isFall)) { hits[sig.label] = true; break; }
          if (m[0].length === 0) re.lastIndex++;
        }
        if (hits[sig.label]) break;
      }
    });
    return hits;
  }

  // ---- note rows (same table the diagnosis extractor reads) ----
  function viewLinks() {
    return [].slice.call(document.querySelectorAll('a')).filter(function (a) {
      return (a.textContent || '').trim().toLowerCase() === 'view';
    });
  }

  function rowText(row) {
    var clone = row.cloneNode(true);
    // Template labels are bold and end with a colon ("Objectives
    // and Assessment (resident reports SOB, agitation, etc.):").
    // They are prompts, not findings - drop them before scanning.
    var bs = clone.querySelectorAll('b, strong');
    for (var i = 0; i < bs.length; i++) {
      if (/:\s*$/.test((bs[i].textContent || '').trim())) bs[i].remove();
    }
    return (clone.textContent || '').replace(/\s+/g, ' ');
  }

  function rowDate(text) {
    var m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
    if (!m) return null;
    return new Date(+m[3], +m[1] - 1, +m[2]);
  }

  // Three views (his ask, v1.6): last 7 days, last 14 days,
  // or everything on the page.
  var behDays = 7;
  function rangeName() { return behDays === 0 ? 'all notes' : 'last ' + behDays + ' days'; }

  function analyze(days) {
    var links = viewLinks();
    if (!links.length) return null;
    var table = links[0].closest('table');
    if (!table) return null;
    var cutoff = null;
    if (days > 0) {
      var now = new Date(); now.setHours(0, 0, 0, 0);
      cutoff = new Date(now.getTime() - (days - 1) * 86400000);
    }
    var counts = {}, detail = {}, notes = 0, stopped = false;
    var rows = table.querySelectorAll('tr');
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (!row.querySelector('a')) continue;
      var hasView = [].slice.call(row.querySelectorAll('a')).some(function (a) {
        return (a.textContent || '').trim().toLowerCase() === 'view';
      });
      if (!hasView) continue;
      var text = rowText(row);
      var d = rowDate(text);
      if (d) {
        if (cutoff && d < cutoff) { stopped = true; continue; }
      } else if (stopped) {
        continue;   // undated rows after the window are old-list tail
      }
      notes++;
      // When + what kind of note, so he can go read it himself
      // (his ask, v1.1): the date/time string as PCC prints it,
      // and the note-type cell (the one right after the date).
      var whenM = /(\d{1,2}\/\d{1,2}\/\d{4})(\s+\d{1,2}:\d{2}(?:\s*[AP]M)?)?/i.exec(text);
      var when = whenM ? (whenM[1] + (whenM[2] || '')) : '';
      var type = '';
      var cells = row.querySelectorAll('td');
      var dateCell = -1;
      for (var c = 0; c < cells.length - 1; c++) {
        if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(cells[c].textContent || '')) {
          type = (cells[c + 1].textContent || '').replace(/\s+/g, ' ').trim();
          dateCell = c;
          break;
        }
      }
      // Scan the note's own prose cell (the one after the type),
      // not the whole row - otherwise row metadata (view, date,
      // type) leaks into the description sentence (v1.6 fix).
      var prose = text;
      if (dateCell !== -1 && cells[dateCell + 2]) {
        var pt = rowText(cells[dateCell + 2]);
        if (pt && pt.length >= 10) prose = pt;
      }
      var scan = noteScan(prose);
      Object.keys(scan).forEach(function (k) {
        counts[k] = (counts[k] || 0) + 1;
        (detail[k] = detail[k] || []).push({ when: when, type: type, desc: scan[k], row: row });
      });
    }
    return { counts: counts, detail: detail, notes: notes };
  }

  // ---- the tile ----
  var lastSig = '';
  var jumpRows = [], paintedJump = null, flashRowTimer = 0;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function paintViews() {
    var btns = document.querySelectorAll('.pnBehView');
    for (var i = 0; i < btns.length; i++) {
      var on = +btns[i].getAttribute('data-days') === behDays;
      btns[i].style.background = on ? '#334155' : '#fff';
      btns[i].style.color = on ? '#fff' : '#334155';
      btns[i].style.borderColor = on ? '#334155' : '#cbd5e1';
    }
    var r = document.getElementById('pnBehRange');
    if (r) r.textContent = rangeName();
  }
  function render(res) {
    var out = document.getElementById('pnBehOut');
    var copy = document.getElementById('pnBehCopy');
    if (!out) return;
    paintViews();
    if (!res || !res.notes) {
      out.textContent = 'No notes (' + rangeName() + ') on this page.';
      if (copy) copy.style.display = 'none';
      lastSig = 'none';
      return;
    }
    var items = Object.keys(res.counts).map(function (k) {
      return { label: k, n: res.counts[k], notes: (res.detail && res.detail[k]) || [] };
    });
    items.sort(function (a, b) { return b.n - a.n; });
    var sig = JSON.stringify(items) + '|' + res.notes + '|' + behDays;
    if (sig === lastSig) return;
    lastSig = sig;
    jumpRows = [];
    if (!items.length) {
      out.innerHTML = '<div style="color:#475569;">No behavior signals charted (' + rangeName() + ').</div>' +
        '<div style="color:#94a3b8;font-size:11px;margin-top:4px;">from ' + res.notes + ' notes</div>';
      if (copy) copy.style.display = 'none';
      return;
    }
    out.innerHTML = items.map(function (it) {
      var head = '<div style="display:flex;justify-content:space-between;padding:2.5px 0;">' +
        '<span style="color:#0f172a;">' + it.label + '</span>' +
        '<span style="color:#475569;">' + it.n + (it.n === 1 ? ' note' : ' notes') + '</span></div>';
      var subs = it.notes.slice(0, 10).map(function (nt) {
        jumpRows.push(nt.row);
        var ji = jumpRows.length - 1;
        var s = esc((nt.when || '') + (nt.type ? ' — ' + nt.type : ''));
        var d = nt.desc ? '<div style="color:#334155;font-size:12px;padding-top:1px;">' + esc(nt.desc) + '</div>' : '';
        // Click an entry to jump to that note (his ask, v1.6):
        // it paints blue while held, and clicking scrolls the
        // note's row into view and flashes it. No copy here.
        return '<div class="pnBehJump" data-j="' + ji + '" title="Go to this note" style="cursor:pointer;border-radius:6px;padding:2px 6px 3px 12px;">' +
          '<div style="color:#7c8aa0;font-size:11.5px;">' + s + '</div>' + d + '</div>';
      }).join('');
      if (it.notes.length > 10) subs += '<div style="color:#94a3b8;font-size:11.5px;padding:0 0 2px 12px;">+ ' + (it.notes.length - 10) + ' more</div>';
      return '<div style="border-bottom:1px solid #f1f5f9;padding-bottom:3px;margin-bottom:3px;">' + head + subs + '</div>';
    }).join('') +
      '<div style="color:#94a3b8;font-size:11px;margin-top:5px;">from ' + res.notes + ' notes (' + rangeName() + ')</div>';
    if (copy) {
      copy.style.display = '';
      copy.setAttribute('data-text', 'Behavior (' + rangeName() + '): ' + items.map(function (it) { return it.label + ' x' + it.n; }).join(' · '));
    }
  }

  function copyText(text, btn) {
    function done() { var o = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = o; }, 1200); }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () {}); return; }
    } catch (e) {}
  }

  // Views row cleanup (his ask, v1.2): he only ever looks at
  // All Notes and Custom - hide the time-window links and the
  // dashes that separate them. Display only.
  var HIDE_VIEWS = ['Last 8 hrs', 'Last 24 hrs', 'Last 72 hrs', 'Last 7 days', 'Last 30 days'];
  function hideViewLinks() {
    var links = document.querySelectorAll('a[data-testid^="pn-viewall-view-option-"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var tid = a.getAttribute('data-testid') || '';
      var m = /option-(\d+)$/.exec(tid);
      var byText = HIDE_VIEWS.indexOf((a.textContent || '').trim()) !== -1;
      if (!((m && +m[1] >= 2) || byText)) continue;
      a.style.display = 'none';
      var p = a.previousSibling;
      if (p && p.nodeType === 3 && /^\s*-\s*$/.test(p.nodeValue)) p.nodeValue = '';
    }
  }

  // Press language, same as the tile row (his ask, v1.2): while
  // the Copy button is pressed, this tile lights light blue with
  // the #93c5fd border; release restores it.
  function lightBeh(on) {
    var b = document.getElementById('pnBehBox');
    if (!b) return;
    b.style.background = on ? '#dbeafe' : '#fff';
    b.style.borderColor = on ? '#93c5fd' : '#cbd5e1';
  }

  // Move the Views into the header (his layout, v1.4): top
  // center, on the same row as the resident's name, above the
  // tiles. The links keep working (inline javascript: hrefs);
  // the emptied bar cell is hidden. Runs before the hiding so
  // the hidden links travel with the rest.
  function moveViews() {
    var bar = document.querySelector('.pn-views-bar');
    if (!bar || document.getElementById('pnViewsMoved')) return;
    // Anchor on the page title, not the first 'Resident' span
    // on the page (v1.5 - live, the first match was some other
    // element and the links landed somewhere invisible): the
    // resident row is the block inside the SAME header as the
    // 'Progress Notes - View All' title.
    var nameRow = null;
    var allSpans = document.querySelectorAll('span');
    var headerDiv = null;
    for (var i = 0; i < allSpans.length; i++) {
      if ((allSpans[i].textContent || '').trim() === 'Progress Notes - View All') {
        headerDiv = allSpans[i].parentElement;
        break;
      }
    }
    if (headerDiv) {
      var kids = headerDiv.querySelectorAll('div');
      for (var k = 0; k < kids.length; k++) {
        var ks = kids[k].querySelectorAll('span');
        for (var s = 0; s < ks.length; s++) {
          if ((ks[s].textContent || '').trim() === 'Resident') { nameRow = kids[k]; break; }
        }
        if (nameRow) break;
      }
    }
    if (!nameRow) {
      for (var j = 0; j < allSpans.length; j++) {
        if ((allSpans[j].textContent || '').trim() === 'Resident' && allSpans[j].parentElement) {
          nameRow = allSpans[j].parentElement;
          break;
        }
      }
    }
    if (!nameRow) return;
    var slot = document.createElement('div');
    slot.id = 'pnViewsMoved';
    slot.style.cssText = 'flex:1 1 auto;text-align:center;font-size:14px;';
    while (bar.firstChild) slot.appendChild(bar.firstChild);
    nameRow.style.display = 'flex';
    nameRow.style.alignItems = 'center';
    nameRow.appendChild(slot);
    bar.style.display = 'none';
  }

  function viewLink(txt) {
    var links = document.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) if ((links[i].textContent || '').trim() === txt) return links[i];
    return null;
  }

  function insertBox() {
    var all = viewLink('All Notes');
    if (!all) return;
    var box = document.getElementById('pnBehBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'pnBehBox';
      box.style.cssText = 'margin:8px 0;padding:14px 16px;background:#fff;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,.05);font-size:13px;box-sizing:border-box;overflow-wrap:anywhere;';
      var btnCss = 'padding:2px 10px;font-size:11px;font-weight:600;cursor:pointer;border-radius:6px;border:1px solid #cbd5e1;background:#fff;color:#334155;';
      box.innerHTML =
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">' +
        '<span style="font-weight:700;color:#334155;">Behavior — <span id="pnBehRange">last 7 days</span></span>' +
        '<button id="pnBehCopy" type="button" style="' + btnCss + 'display:none;">Copy</button>' +
        '<span style="margin-left:auto;display:flex;gap:4px;">' +
        '<button type="button" class="pnBehView" data-days="7" style="' + btnCss + 'border-radius:999px;">7d</button>' +
        '<button type="button" class="pnBehView" data-days="14" style="' + btnCss + 'border-radius:999px;">14d</button>' +
        '<button type="button" class="pnBehView" data-days="0" style="' + btnCss + 'border-radius:999px;">All</button>' +
        '</span>' +
        '</div>' +
        '<div id="pnBehOut" style="color:#0f172a;">Reading notes…</div>';
      var dx = document.getElementById('pnDxBox');
      if (dx && dx.parentNode) dx.parentNode.insertBefore(box, dx.nextSibling);
      else {
        var bar = all.parentElement;
        bar.parentNode.insertBefore(box, bar.nextSibling);
      }
      var behCopy = document.getElementById('pnBehCopy');
      behCopy.onclick = function () {
        var t = this.getAttribute('data-text');
        if (t) copyText(t, this);
      };
      behCopy.addEventListener('mousedown', function () { lightBeh(true); });
      window.addEventListener('mouseup', function () { lightBeh(false); });
      // View switcher: re-render with the chosen window.
      var vbtns = box.querySelectorAll('.pnBehView');
      for (var vi = 0; vi < vbtns.length; vi++) {
        vbtns[vi].addEventListener('click', function () {
          behDays = +this.getAttribute('data-days');
          paintViews();
          render(analyze(behDays));
        });
      }
      // Entry press + jump (no copy - just a button to the note).
      box.addEventListener('mousedown', function (e) {
        var j = e.target.closest ? e.target.closest('.pnBehJump') : null;
        if (paintedJump) { paintedJump.style.background = ''; paintedJump = null; }
        if (j) { j.style.background = '#dbeafe'; paintedJump = j; }
      });
      window.addEventListener('mouseup', function () {
        if (paintedJump) { paintedJump.style.background = ''; paintedJump = null; }
      });
      box.addEventListener('click', function (e) {
        var j = e.target.closest ? e.target.closest('.pnBehJump') : null;
        if (!j) return;
        var row = jumpRows[+j.getAttribute('data-j')];
        if (!row) return;
        try { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        catch (err) { row.scrollIntoView(); }
        var old = row.style.background;
        row.style.background = '#dbeafe';
        if (flashRowTimer) clearTimeout(flashRowTimer);
        flashRowTimer = setTimeout(function () { row.style.background = old; }, 1600);
      });
    }
    // Sit inside the white card with the Diagnoses tile when it
    // exists (v1.3); otherwise keep the old standalone placement.
    var wrap = document.getElementById('pnTilesWrap');
    if (wrap) {
      if (box.parentElement !== wrap) wrap.appendChild(box);
      box.style.margin = '8px 0 0';
    } else if (box.parentElement) {
      var dx2 = document.getElementById('pnDxBox');
      if (dx2 && dx2.parentNode && box.previousElementSibling !== dx2) {
        dx2.parentNode.insertBefore(box, dx2.nextSibling);
      }
    }
    // Second net for the stray grab badge (it belongs to the
    // Diagnoses tile but can park below this one).
    if (box.parentElement) {
      var bs = box.parentElement.querySelectorAll(':scope > .pcc-g-badge');
      for (var i2 = 0; i2 < bs.length; i2++) bs[i2].style.display = 'none';
    }
    render(analyze(behDays));
  }

  function tick() {
    var all = viewLink('All Notes');
    if (!all) return;
    moveViews();
    hideViewLinks();
    // Same one-time expansion the diagnosis extractor uses: the
    // full note text only loads in the All Notes view. Shared
    // session flag so the two scripts never double-click it.
    if (!sessionStorage.getItem('pnClickedAll')) {
      try { sessionStorage.setItem('pnClickedAll', '1'); } catch (e) {}
      all.click();
      return;
    }
    insertBox();
  }

  [400, 1000, 2000, 3500, 5500, 8000].forEach(function (ms) { setTimeout(tick, ms); });
  var last = 0;
  document.addEventListener('click', function (e) {
    if (!e.isTrusted) return;
    var now = Date.now();
    if (now - last < 800) return;
    last = now;
    setTimeout(tick, 350);
  }, true);
})();
