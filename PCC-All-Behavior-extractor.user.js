// ==UserScript==
// @name         Every facility — Progress Notes: behavior extractor
// @namespace    mica.pcc
// @version      1.1
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

  function analyze() {
    var links = viewLinks();
    if (!links.length) return null;
    var table = links[0].closest('table');
    if (!table) return null;
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var cutoff = new Date(now.getTime() - 6 * 86400000);
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
        if (d < cutoff) { stopped = true; continue; }
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
      for (var c = 0; c < cells.length - 1; c++) {
        if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(cells[c].textContent || '')) {
          type = (cells[c + 1].textContent || '').replace(/\s+/g, ' ').trim();
          break;
        }
      }
      var hits = noteSignals(text);
      Object.keys(hits).forEach(function (k) {
        counts[k] = (counts[k] || 0) + 1;
        (detail[k] = detail[k] || []).push({ when: when, type: type });
      });
    }
    return { counts: counts, detail: detail, notes: notes };
  }

  // ---- the tile ----
  var lastSig = '';
  function render(res) {
    var out = document.getElementById('pnBehOut');
    var copy = document.getElementById('pnBehCopy');
    if (!out) return;
    if (!res || !res.notes) {
      out.textContent = 'No notes in the last 7 days on this page.';
      if (copy) copy.style.display = 'none';
      lastSig = 'none';
      return;
    }
    var items = Object.keys(res.counts).map(function (k) {
      return { label: k, n: res.counts[k], notes: (res.detail && res.detail[k]) || [] };
    });
    items.sort(function (a, b) { return b.n - a.n; });
    var sig = JSON.stringify(items) + '|' + res.notes;
    if (sig === lastSig) return;
    lastSig = sig;
    if (!items.length) {
      out.innerHTML = '<div style="color:#475569;">No behavior signals charted in the last 7 days.</div>' +
        '<div style="color:#94a3b8;font-size:11px;margin-top:4px;">from ' + res.notes + ' notes</div>';
      if (copy) copy.style.display = 'none';
      return;
    }
    out.innerHTML = items.map(function (it) {
      var head = '<div style="display:flex;justify-content:space-between;padding:2.5px 0;">' +
        '<span style="color:#0f172a;">' + it.label + '</span>' +
        '<span style="color:#475569;">' + it.n + (it.n === 1 ? ' note' : ' notes') + '</span></div>';
      var subs = it.notes.slice(0, 10).map(function (nt) {
        var s = (nt.when || '') + (nt.type ? ' — ' + nt.type : '');
        return '<div style="color:#7c8aa0;font-size:11.5px;padding:0 0 2px 12px;">' + s.replace(/</g, '&lt;') + '</div>';
      }).join('');
      if (it.notes.length > 10) subs += '<div style="color:#94a3b8;font-size:11.5px;padding:0 0 2px 12px;">+ ' + (it.notes.length - 10) + ' more</div>';
      return '<div style="border-bottom:1px solid #f1f5f9;padding-bottom:3px;margin-bottom:3px;">' + head + subs + '</div>';
    }).join('') +
      '<div style="color:#94a3b8;font-size:11px;margin-top:5px;">from ' + res.notes + ' notes in the last 7 days</div>';
    if (copy) {
      copy.style.display = '';
      copy.setAttribute('data-text', 'Behavior (last 7 days): ' + items.map(function (it) { return it.label + ' x' + it.n; }).join(' · '));
    }
  }

  function copyText(text, btn) {
    function done() { var o = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = o; }, 1200); }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () {}); return; }
    } catch (e) {}
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
      box.style.cssText = 'margin:8px 0;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,.05);font-size:13px;box-sizing:border-box;overflow-wrap:anywhere;';
      var btnCss = 'padding:2px 10px;font-size:11px;font-weight:600;cursor:pointer;border-radius:6px;border:1px solid #cbd5e1;background:#fff;color:#334155;';
      box.innerHTML =
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">' +
        '<span style="font-weight:700;color:#334155;">Behavior — last 7 days</span>' +
        '<button id="pnBehCopy" type="button" style="' + btnCss + 'display:none;">Copy</button>' +
        '</div>' +
        '<div id="pnBehOut" style="color:#0f172a;">Reading notes…</div>';
      var dx = document.getElementById('pnDxBox');
      if (dx && dx.parentNode) dx.parentNode.insertBefore(box, dx.nextSibling);
      else {
        var bar = all.parentElement;
        bar.parentNode.insertBefore(box, bar.nextSibling);
      }
      document.getElementById('pnBehCopy').onclick = function () {
        var t = this.getAttribute('data-text');
        if (t) copyText(t, this);
      };
    } else {
      // keep it tucked directly under the Diagnoses tile
      var dx2 = document.getElementById('pnDxBox');
      if (dx2 && dx2.parentNode && box.previousElementSibling !== dx2) {
        dx2.parentNode.insertBefore(box, dx2.nextSibling);
      }
    }
    render(analyze());
  }

  function tick() {
    var all = viewLink('All Notes');
    if (!all) return;
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
