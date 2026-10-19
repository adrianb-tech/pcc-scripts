// ==UserScript==
// @name         Every facility — PCC Extractors (all miners)
// @version      1.0.2
// @description  Stage 3 merge: BIMS, Behavior, Diagnosis, Relationships, Vitals, Psych orders, S-key, Header copy table, Grab all - nine keypress miners in ONE script, each module verbatim in its own scope. Replaces the nine separate extractor scripts.
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Extractors.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Extractors.user.js
// @match        https://*.pointclickcare.com/*
// @match        https://*.pointclickcare.ca/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// ----- module: PCC-All-BIMS-extractor.user.js -----
(function () {
    'use strict';

    var BIMS_RE = /BIMS|cognitive|cognitively|impair|intact/i;
    var PSYCH_RE = /psychiatr|psych\s*:|psych\s+consult/i;
    var MDACK_RE = /MD:\s*Psychiatry\s+Consult\s+Ack/i;      // "MD: Psychiatry Consult Acknowledgement"
    var DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
    var SCORE_RE = /^\d{1,2}(\.\d+)?$/;
    var STYLE = {
        bims:  { bg: '#cfe8fb', bar: '#007bb6' },   // blue
        psych: { bg: '#d9f2c9', bar: '#4c9a2a' },   // green  (Psych: Consult)
        mdack: { bg: '#fde3b8', bar: '#d97706' }    // amber  (MD: Psychiatry Consult Acknowledgement)
    };
    var KIND_RANK = { bims: 0, psych: 1, mdack: 2 };           // display order

    function txt(el) { return (el.innerText || el.textContent || '').trim(); }

    function findByLabel(root, sel, re) {
        return Array.from(root.querySelectorAll(sel)).find(function (el) {
            return re.test((el.value || el.textContent || '').trim());
        });
    }

    function getBar() {
        var apply = findByLabel(document, 'input[type="button"],input[type="submit"],button', /^Apply$/i);
        if (!apply) return null;
        var el = apply.parentElement;
        while (el && el.querySelectorAll('select').length < 2) el = el.parentElement;
        return el;
    }

    function filtersAreAll() {
        var bar = getBar();
        if (!bar) return true;
        return Array.from(bar.querySelectorAll('select')).every(function (s) {
            var o = s.options[s.selectedIndex];
            return o && /^All$/i.test(o.text.trim());
        });
    }

    function readRow(row) {
        if (row.querySelector('tr') || row.cells.length < 6) return null;
        var t = Array.from(row.cells).map(txt);
        var dateStr = t.find(function (c) { return DATE_RE.test(c); }); // first date = assessment/form date
        if (!dateStr) return null;
        var rowText = t.join(' | ');
        var kind = MDACK_RE.test(rowText) ? 'mdack'
                 : PSYCH_RE.test(rowText) ? 'psych'
                 : (t.some(function (c) { return BIMS_RE.test(c); }) ? 'bims' : null);
        return {
            row: row, kind: kind, dateStr: dateStr, d: new Date(dateStr),
            score: t.find(function (c) { return SCORE_RE.test(c); }),
            complete: t.some(function (c) { return /^Complete$/i.test(c); })
        };
    }

    function organize(items) {
        if (!items.length) return;
        var parent = items[0].row.parentNode;
        var rows = items.filter(function (i) { return i.row.parentNode === parent; });
        var special = rows.filter(function (i) { return i.kind; }).sort(function (a, b) {
            if (a.kind !== b.kind) return KIND_RANK[a.kind] - KIND_RANK[b.kind];   // BIMS, then Psych: Consult, then MD ack
            return b.d - a.d;                                                      // newest first within each group
        });
        var others = rows.filter(function (i) { return !i.kind; });
        var desired = special.concat(others);

        var same = desired.every(function (it, i) { return it === rows[i]; });
        if (!same) {
            var after = rows[rows.length - 1].row.nextSibling;
            desired.forEach(function (it) { parent.insertBefore(it.row, after); });
        }

        special.forEach(function (it) {
            if (it.row.dataset.hl === it.kind) return;
            var s = STYLE[it.kind];
            Array.from(it.row.cells).forEach(function (c, idx) {
                c.style.backgroundColor = s.bg;
                if (idx === 0) c.style.borderLeft = '4px solid ' + s.bar;
            });
            it.row.dataset.hl = it.kind;
        });
    }

    function copyText(text, btn) {
        function done(msg) {
            btn.textContent = msg;
            setTimeout(function () { btn.textContent = 'Copy'; }, 1200);
        }
        function fallback() {
            var ok = false;
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            try { ok = document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
            done(ok ? 'Copied!' : 'Copy failed');
        }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () { done('Copied!'); }, fallback);
            } else {
                fallback();
            }
        } catch (e) { fallback(); }
    }

    // Badge is 2x the original size
    function makeBadge() {
        var box = document.createElement('span');
        box.id = 'custom-bims-badge';
        box.style.cssText = 'display:none;align-items:center;gap:20px;margin-left:16px;padding:8px 22px;border:2px solid #93c5fd;background:#eff6ff;border-radius:16px;font:26px/1.3 -apple-system,sans-serif;vertical-align:middle;';
        // Hidden since the tile row carries this value (his cleanup
        // ask, 2026-10-14). Box + button stay in the DOM: the tile
        // reads the button's fill value across frames.

        var title = document.createElement('b');
        title.textContent = 'BIMS';
        title.style.cssText = 'color:#1d4ed8;font-size:26px;';

        var value = document.createElement('span');
        value.className = 'bims-value';
        value.style.cssText = 'color:#111;font-weight:bold;font-size:30px;';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pcc-fill-copy';
        btn.setAttribute('data-fill-label', 'BIMS');
        btn.textContent = 'Copy';
        btn.style.cssText = 'cursor:pointer;border:2px solid #1d4ed8;background:#1d4ed8;color:#fff;border-radius:10px;padding:4px 24px;font:bold 24px sans-serif;';
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var v = box.dataset.copy || '';
            copyText(v, btn);
            // Also queue the score for the Copy-to-note engine (his click only —
            // BIMS is never pushed automatically). Value: "13 on 10/5/26".
            if (/^\d{1,2} on \d/.test(v)) {
                try { localStorage.setItem('pccFillBims', JSON.stringify({ value: v, ts: Date.now() })); } catch (err) {}
            }
        });

        box.appendChild(title);
        box.appendChild(value);
        box.appendChild(btn);
        return box;
    }

    // The Forms/Assessments list has a "Score" column header; the resident search list does not.
    function hasScoreHeader() {
        return Array.from(document.querySelectorAll('th,td')).some(function (c) {
            return /^Score$/i.test(txt(c));
        });
    }

    function tick() {
        var apply = findByLabel(document, 'input[type="button"],input[type="submit"],button', /^Apply$/i);
        if (!apply || !hasScoreHeader()) {   // not the Forms/Assessments list
            var old = document.getElementById('custom-bims-badge');
            if (old && old.parentNode) old.parentNode.removeChild(old);
            return;
        }

        var items = [];
        document.querySelectorAll('tr').forEach(function (r) {
            var it = readRow(r);
            if (it) items.push(it);
        });

        organize(items);

        var best = items.filter(function (i) {
            var n = parseFloat(i.score);
            // Don't require Complete: SSA is often In Progress but BIMS score is valid
            return i.kind === 'bims' && i.score !== undefined && n >= 0 && n <= 15;
        }).sort(function (a, b) { return b.d - a.d; })[0];

        var box = document.getElementById('custom-bims-badge') || makeBadge();
        var newBtn = findByLabel(document, 'input[type="button"],input[type="submit"],button,a', /^New$/i);
        if (newBtn) {
            if (newBtn.nextElementSibling !== box) newBtn.insertAdjacentElement('afterend', box);
        } else if (apply.previousElementSibling !== box) {
            apply.insertAdjacentElement('beforebegin', box);
        }

        var out = 'N/A';
        if (best) {
            var p = best.dateStr.split('/');
            out = parseFloat(best.score) + ' on ' + parseInt(p[0], 10) + '/' + parseInt(p[1], 10) + '/' + p[2].slice(-2);
        }
        box.querySelector('.bims-value').textContent = out;
        box.dataset.copy = out;
        var cb = box.querySelector('button');
        if (cb) cb.setAttribute('data-fill-value', out);   // for the G sweep
        box.title = (!best && !filtersAreAll()) ? 'List is filtered, so a BIMS may exist under other types' : '';
    }

    // Scheduling (v1.2): NO permanent interval. Bounded staggered runs after
    // load (PCC grids populate late), then re-runs only on YOUR clicks
    // (e.g. after you press Apply and the grid refreshes in place).
    [400, 1200, 2500, 4500, 7000].forEach(function (ms) { setTimeout(tick, ms); });
    var lastClickRun = 0;
    document.addEventListener('click', function (e) {
        if (!e.isTrusted) return;
        var now = Date.now();
        if (now - lastClickRun < 800) return;
        lastClickRun = now;
        setTimeout(tick, 350);
    }, true);
})();
;
// ----- module: PCC-All-Behavior-extractor.user.js -----
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
    { label: 'Withdrawn', words: ['withdrawn'], phrases: ['isolating', 'isolates', 'stays in room', 'stayed in room', 'remains in room', 'in room all day', 'refuses activities', 'refused activities', 'not participating'] },
    // Compliance is its own category, not a symptom (his
    // ruling, v1.8): explicit compliance language only - the
    // plain refusal events stay under Refusals.
    { label: 'Non-compliance', phrases: ['non-compliant', 'noncompliant', 'non-compliance', 'noncompliance', 'not compliant', 'poorly compliant'] }
  ];

  // Template / boilerplate contexts that must NOT count as a Fall.
  var FALL_GUARDS = [/fall\s+risk/i, /risk\s+of\s+fall/i, /risk\s+for\s+fall/i, /fall\s+precaution/i, /fall\s+prevention/i, /falls\s+risk/i];
  var NEG = /\b(no|not|denies|denied|deny|without|none|never|absent|free of)\b/i;

  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  var behStart = Date.now();
  var COMPILED = SIGNALS.map(function (sig) {
    var pats = [];
    (sig.words || []).forEach(function (w) { pats.push(new RegExp('\\b' + escRe(w) + '\\b', 'gi')); });
    (sig.phrases || []).forEach(function (p) { pats.push(new RegExp(escRe(p).replace(/\s+/g, '\\s+'), 'gi')); });
    return { label: sig.label, pats: pats };
  });

  // A match counts unless it is negated in its own sentence (a
  // negation word shortly before it) or, for falls, part of a
  // template phrase like "fall risk".
  // His editorial rules (his feedback, 2026-10-15, v1.8):
  // (1) The tile surfaces COMPLAINTS - symptoms/behaviors
  // reported by staff or the patient. A medication ORDER line
  // ("Melatonin ... by mouth at bedtime for Insomnia, ACTIVE")
  // is a drug dispensed FOR the symptom, not a complaint; a
  // care-plan GOAL statement ("...refusing food by review
  // date") is not an event either. Neither counts.
  // (2) Compliance is its OWN category (the Non-compliance
  // signal below) - meds, ADLs, showering, eating.
  var ORDER_RE = /\b(give|apply|instill|inhale|inject)\b[^.!?]*\b(by mouth|topically|orally)\b/i;
  var ACTIVE_RE = /\bACTIVE\s*,/;
  var GOAL_RE = /by (review|target) date/i;
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
    var sent = sentenceAround(text, m.index);
    if (ORDER_RE.test(sent) || ACTIVE_RE.test(sent) || GOAL_RE.test(sent)) return false;
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
          if (matchCounts(text, m, isFall)) { found[sig.label] = { sent: sentenceAround(text, m.index), phrase: m[0] }; break; }
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
    var tb = clone.querySelectorAll('.pnBehTopBtn, .pnBehFbBar');
    for (var q = 0; q < tb.length; q++) tb[q].remove();
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
        (detail[k] = detail[k] || []).push({
          label: k, when: when, type: type, desc: scan[k].sent, phrase: scan[k].phrase,
          row: row, cell: (dateCell !== -1 && cells[dateCell + 2]) ? cells[dateCell + 2] : null
        });
      });
    }
    return { counts: counts, detail: detail, notes: notes };
  }

  // ---- the tile ----
  var lastSig = '';
  var jumpRows = [], paintedJump = null;
  // The identified note (his design, v1.7): the row gets the
  // light blue fill + a blue border, the matched sentence gets
  // the DARKER blue, and a back-to-top button sits on the note.
  // It stays marked until the next jump or the button.
  var marked = null;
  function unmarkNote() {
    if (!marked) return;
    marked.cells.forEach(function (c) {
      c.td.style.background = c.bg;
      c.td.style.borderTop = c.bt; c.td.style.borderBottom = c.bb;
      c.td.style.borderLeft = c.bl; c.td.style.borderRight = c.br;
    });
    if (marked.span && marked.span.parentNode) {
      marked.span.parentNode.replaceChild(document.createTextNode(marked.span.textContent), marked.span);
    }
    if (marked.bar && marked.bar.parentNode) marked.bar.parentNode.removeChild(marked.bar);
    marked = null;
  }
  function highlightSentence(cell, sent, phrase) {
    if (!cell) return null;
    var walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    var norm = function (s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); };
    var target = norm(sent), ph = norm(phrase);
    for (var i = 0; i < nodes.length; i++) {
      var raw = nodes[i].nodeValue, low = norm(raw);
      var from = -1, to = -1;
      var ti = target ? low.indexOf(target.slice(0, 60)) : -1;
      if (ti !== -1) { from = ti; to = ti + target.length; }
      else if (ph && low.indexOf(ph) !== -1) {
        var pi = low.indexOf(ph);
        from = Math.max(raw.lastIndexOf('.', pi - 1), raw.lastIndexOf('\n', pi - 1)) + 1;
        var ends = [raw.indexOf('.', pi), raw.indexOf('\n', pi)].filter(function (x) { return x !== -1; });
        to = ends.length ? Math.min.apply(null, ends) + 1 : raw.length;
      }
      if (from === -1) continue;
      // map normalized offsets back onto the raw text loosely:
      // find the phrase in the raw node and expand to its
      // sentence there instead (exact for single-node prose).
      var rp = ph ? raw.toLowerCase().indexOf(ph) : -1;
      if (rp === -1) continue;
      from = Math.max(raw.lastIndexOf('.', rp - 1), raw.lastIndexOf('\n', rp - 1)) + 1;
      var e2 = [raw.indexOf('.', rp), raw.indexOf('\n', rp)].filter(function (x) { return x !== -1; });
      to = e2.length ? Math.min.apply(null, e2) + 1 : raw.length;
      var span = document.createElement('span');
      span.style.cssText = 'background:#93c5fd;color:#172554;padding:1px 3px;border-radius:3px;';
      var mid = document.createTextNode(raw.slice(from, to));
      var after = document.createTextNode(raw.slice(to));
      nodes[i].nodeValue = raw.slice(0, from);
      span.appendChild(mid);
      var parent = nodes[i].parentNode;
      parent.insertBefore(span, nodes[i].nextSibling);
      parent.insertBefore(after, span.nextSibling);
      return span;
    }
    return null;
  }
  function markNote(entry) {
    unmarkNote();
    var row = entry.row;
    if (!row) return;
    var tds = row.querySelectorAll('td');
    var recs = [];
    for (var i = 0; i < tds.length; i++) {
      var td = tds[i];
      recs.push({ td: td, bg: td.style.background, bt: td.style.borderTop, bb: td.style.borderBottom, bl: td.style.borderLeft, br: td.style.borderRight });
      td.style.background = '#dbeafe';
      td.style.borderTop = '2px solid #2563eb';
      td.style.borderBottom = '2px solid #2563eb';
      if (i === 0) td.style.borderLeft = '2px solid #2563eb';
      if (i === tds.length - 1) td.style.borderRight = '2px solid #2563eb';
    }
    var span = highlightSentence(entry.cell, entry.desc, entry.phrase);
    var bar = null;
    if (entry.cell) {
      // His feedback bar (v1.9): back-to-top + right/wrong +
      // an optional 'why'. Same press language as everywhere
      // else; the verdict saves to this browser's store only.
      bar = document.createElement('div');
      bar.className = 'pnBehFbBar';
      bar.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 6px;';
      var pill = 'display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;cursor:pointer;';
      bar.innerHTML =
        '<button type="button" class="pnBehTopBtn" style="' + pill + 'border:none;background:#2563eb;color:#fff;box-shadow:0 2px 6px rgba(37,99,235,.35);">\u2191 back to top</button>' +
        '<button type="button" class="pnBehFbR" style="' + pill + 'border:1px solid #cbd5e1;background:#fff;color:#15803d;">\u2713 right</button>' +
        '<button type="button" class="pnBehFbW" style="' + pill + 'border:1px solid #cbd5e1;background:#fff;color:#b91c1c;">\u2717 wrong</button>' +
        '<input type="text" class="pnBehFbWhy" placeholder="why? (optional)" style="flex:0 1 220px;padding:3px 8px;border:1px solid #cbd5e1;border-radius:999px;font-size:11.5px;color:#0f172a;background:#fff;">' +
        '<button type="button" class="pnBehFbSaveWhy" style="' + pill + 'border:1px solid #cbd5e1;background:#fff;color:#334155;">save my comment</button>' +
        '<span class="pnBehFbWhySaved" style="font-size:11px;color:#15803d;font-weight:600;"></span>' +
        '<span class="pnBehFbSaved" style="font-size:11px;color:#15803d;font-weight:600;"></span>';
      var topBtn = bar.querySelector('.pnBehTopBtn');
      var rBtn = bar.querySelector('.pnBehFbR');
      var wBtn = bar.querySelector('.pnBehFbW');
      var whyInp = bar.querySelector('.pnBehFbWhy');
      var saveWhyBtn = bar.querySelector('.pnBehFbSaveWhy');
      var whySavedSpan = bar.querySelector('.pnBehFbWhySaved');
      var savedSpan = bar.querySelector('.pnBehFbSaved');
      topBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var wrap = document.getElementById('pnTilesWrap') || document.getElementById('pnBehBox');
        unmarkNote();
        if (wrap) { try { wrap.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (err) { wrap.scrollIntoView(); } }
      });
      // Judge ONCE (his rule, v1.12, same as the diagnoses
      // tile): the chosen button stays filled, both lock, and
      // 'completed' stays written there. The why can still be
      // finished afterwards - it updates the same record.
      var curVerdict = '';
      function paintVerdict(v) {
        rBtn.style.background = v === 'right' ? '#dcfce7' : '#fff';
        rBtn.style.borderColor = v === 'right' ? '#15803d' : '#cbd5e1';
        wBtn.style.background = v === 'wrong' ? '#fee2e2' : '#fff';
        wBtn.style.borderColor = v === 'wrong' ? '#b91c1c' : '#cbd5e1';
        var locked = !!v;
        rBtn.disabled = locked;
        wBtn.disabled = locked;
        rBtn.style.cursor = locked ? 'default' : 'pointer';
        wBtn.style.cursor = locked ? 'default' : 'pointer';
        savedSpan.textContent = v ? 'completed' : '';
      }
      function recFor(v) {
        return {
          k: 'beh|' + entry.label + '|' + entry.when + '|' + (entry.desc || '').slice(0, 40),
          kind: 'beh', verdict: v, signal: entry.label, when: entry.when, type: entry.type,
          sentence: entry.desc, phrase: entry.phrase, why: whyInp.value || '',
          site: location.hostname, ts: Date.now(), sent: false
        };
      }
      function saveVerdict(v) {
        if (curVerdict) return;
        curVerdict = v;
        var rec = recFor(v);
        fbSave(rec);
        fbSnap(rec.k);
        paintVerdict(v);
        lastSig = '';
        render(analyze(behDays));
      }
      // Explicit save for the comment (his ask, v1.13): the
      // button stores it - into the record once a verdict
      // exists, or staged in the field until he picks one -
      // and 'comment saved' stays written next to it.
      saveWhyBtn.addEventListener('mousedown', function () { saveWhyBtn.style.background = '#dbeafe'; });
      saveWhyBtn.addEventListener('mouseup', function () { saveWhyBtn.style.background = '#fff'; });
      function saveWhy() {
        if (curVerdict) fbSave(recFor(curVerdict));
        whySavedSpan.textContent = 'comment saved';
      }
      saveWhyBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        saveWhy();
      });
      // Enter inside the comment field = save my comment
      // (his ask, v1.14; same on the diagnoses editor).
      whyInp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); saveWhy(); }
      });
      whyInp.addEventListener('input', function () { whySavedSpan.textContent = ''; });
      rBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); saveVerdict('right'); });
      wBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); saveVerdict('wrong'); });
      whyInp.addEventListener('click', function (e) { e.stopPropagation(); });
      whyInp.addEventListener('keydown', function (e) { e.stopPropagation(); });
      // Prefill an earlier verdict on this same entry, if any.
      var prev = fbLoad().filter(function (r) {
        return r.kind === 'beh' && r.signal === entry.label && r.when === entry.when;
      })[0];
      if (prev) {
        whyInp.value = prev.why || '';
        curVerdict = prev.verdict;
        paintVerdict(prev.verdict);
        if (prev.why) whySavedSpan.textContent = 'comment saved';
      }
      entry.cell.insertBefore(bar, entry.cell.firstChild);
    }
    marked = { cells: recs, span: span, bar: bar };
  }
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
  // His feedback store (shared with the diagnosis tile):
  // verdicts + explanations, saved in THIS browser only, and
  // carried to Mica inside page captures he chooses to send.
  var FB_KEY = 'pnFeedback';
  function fbLoad() {
    try { var a = JSON.parse(localStorage.getItem(FB_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function fbSave(rec) {
    var a = fbLoad().filter(function (r) { return r.k !== rec.k; });
    a.push(rec);
    while (a.length > 1000) a.shift();
    try { localStorage.setItem(FB_KEY, JSON.stringify(a)); } catch (e) {}
  }
// Judgement snapshots (his design): the moment he judges,
  // a pruned copy of this notes page is stored in the
  // browser's big storage (IndexedDB 'pnReview'), linked to
  // the record by its key - so a periodic review file can
  // pair every judgement with the page it was made on.
  // Pruned: scripts/styles/images and our own UI stripped;
  // the notes themselves stay whole.
  function snapPrune(root) {
    var c = root.cloneNode(true);
    c.removeAttribute('style');
    var kill = c.querySelectorAll('script, style, link, img, svg, iframe, .pnBehFbBar, #pnTilesWrap');
    for (var i = 0; i < kill.length; i++) kill[i].remove();
    var all = c.querySelectorAll('*');
    for (var j = 0; j < all.length; j++) { all[j].removeAttribute('style'); all[j].removeAttribute('onclick'); }
    return c.outerHTML;
  }
  function snapHTML() {
    var card = null;
    var as = document.querySelectorAll('a');
    for (var i = 0; i < as.length; i++) {
      var tr = as[i].closest ? as[i].closest('tr') : null;
      var tds = tr ? tr.querySelectorAll('td') : [];
      if (tds.length > 2 && /^\d{1,2}\/\d{1,2}\/\d{4}/.test((tds[1].textContent || '').replace(/\s+/g, ' ').trim())) {
        var tb = as[i].closest('table');
        card = (tb && tb.closest('.evergreen-card')) || tb;
        break;
      }
    }
    if (!card) return '';
    var head = '';
    var spans = document.querySelectorAll('span');
    for (var s = 0; s < spans.length; s++) {
      if ((spans[s].textContent || '').replace(/\s+/g, ' ').trim() === 'Progress Notes - View All') {
        var hp = spans[s].parentElement;
        if (hp) head = snapPrune(hp);
        break;
      }
    }
    return '<div class="pn-snap">' + head + snapPrune(card) + '</div>';
  }
  function fbSnap(key) {
    try {
      var html = snapHTML();
      if (!html || typeof indexedDB === 'undefined') return;
      var rq = indexedDB.open('pnReview', 1);
      rq.onupgradeneeded = function () {
        if (!rq.result.objectStoreNames.contains('snaps')) rq.result.createObjectStore('snaps', { keyPath: 'k' });
      };
      rq.onsuccess = function () {
        try {
          var store = rq.result.transaction('snaps', 'readwrite').objectStore('snaps');
          store.put({ k: key, html: html, ts: Date.now(), sent: false });
          var all = store.getAll();
          all.onsuccess = function () {
            var rows = all.result || [];
            if (rows.length <= 500) return;
            rows.sort(function (a, b) { return (a.sent === b.sent) ? a.ts - b.ts : (a.sent ? -1 : 1); });
            rows.slice(0, rows.length - 500).forEach(function (r) { store.delete(r.k); });
          };
        } catch (e) {}
      };
      rq.onerror = function () {};
    } catch (e) {}
  }

  function verdictMap() {
    var map = {};
    fbLoad().forEach(function (r) { if (r.kind === 'beh') map[r.signal + '|' + r.when] = r.verdict; });
    return map;
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
    var vmap = verdictMap();
    var sig = JSON.stringify(items) + '|' + res.notes + '|' + behDays + '|' + JSON.stringify(vmap);
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
        jumpRows.push(nt);
        var ji = jumpRows.length - 1;
        var s = esc((nt.when || '') + (nt.type ? ' — ' + nt.type : ''));
        var d = nt.desc ? '<div style="color:#334155;font-size:12px;padding-top:1px;">' + esc(nt.desc) + '</div>' : '';
        var vm = vmap[it.label + '|' + nt.when];
        var vmark = vm === 'right' ? ' <span style="color:#15803d;font-weight:700;">\u2713</span>'
          : vm === 'wrong' ? ' <span style="color:#b91c1c;font-weight:700;">\u2717</span>' : '';
        // Click an entry to jump to that note (his ask, v1.6):
        // it paints blue while held, and clicking scrolls the
        // note's row into view and flashes it. No copy here.
        return '<div class="pnBehJump" data-j="' + ji + '" title="Go to this note" style="cursor:pointer;border-radius:6px;padding:2px 6px 3px 12px;">' +
          '<div style="color:#7c8aa0;font-size:11.5px;">' + s + vmark + '</div>' + d + '</div>';
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

  function insertBox(skipScan) {
    var all = viewLink('All Notes');
    if (!all) return;
    var box = document.getElementById('pnBehBox');
    if (!box) {
      // Final anchor only (v1.11): until the Diagnoses tile or
      // the white card exists, WAIT - this tile used to park
      // after the views bar first and then jump into the card.
      if (!document.getElementById('pnDxBox') && !document.getElementById('pnTilesWrap') &&
          Date.now() - behStart < 6000) return;
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
      var wrap0 = document.getElementById('pnTilesWrap');
      if (dx && dx.parentNode) dx.parentNode.insertBefore(box, dx.nextSibling);
      else if (wrap0) wrap0.appendChild(box);
      else {
        // Reachable only after the 6s wait on a page with no
        // card at all: park after the views bar (old fallback).
        var bar = all.parentElement;
        if (bar && bar.parentNode) bar.parentNode.insertBefore(box, bar.nextSibling);
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
        var entry = jumpRows[+j.getAttribute('data-j')];
        if (!entry || !entry.row) return;
        markNote(entry);
        try { entry.row.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        catch (err) { entry.row.scrollIntoView(); }
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
    if (!skipScan) render(analyze(behDays));
  }

  // Speed (v1.10): re-scanning every note on every pass was
  // the page's main drag. The scan now runs only when the
  // notes table actually changed (rows + total text length);
  // repeat passes cost almost nothing.
  var lastFp = '';
  function notesFp() {
    var links = viewLinks();
    if (!links.length) return '';
    var table = links[0].closest('table');
    if (!table) return '';
    return table.rows.length + ':' + (table.textContent || '').length;
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
    var fp = notesFp();
    if (fp && fp === lastFp && document.getElementById('pnBehBox')) {
      // unchanged notes: still keep the wrap/badge housekeeping
      insertBox(true);
      return;
    }
    if (fp) lastFp = fp;
    insertBox(false);
  }

  [300, 700, 1400, 2400, 4000, 6000, 8000].forEach(function (ms) { setTimeout(tick, ms); });
  var last = 0;
  document.addEventListener('click', function (e) {
    if (!e.isTrusted) return;
    var now = Date.now();
    if (now - last < 800) return;
    last = now;
    setTimeout(tick, 350);
  }, true);
})();
;
// ----- module: PCC-All-Diagnosis-extractor.user.js -----
(function(){
  var pnStart = Date.now();
  // ===== Medical Abbreviations Mapping =====
  var ABBR = [
    // Cardiac / Vascular
    [/\b(?:obstructive\s+)?hypertrophic\s+(?:obstructive\s+)?cardiomyopathy\b/gi, 'HOCM'],
    [/\bcardiomyopathy\b/gi, 'CMP'],
    [/\bnonrheumatic\s+mitral\s+(?:\(valve\)\s+)?insufficiency\b/gi, 'MR'],
    [/\bmitral\s+valve\s+insufficiency\b/gi, 'MR'],
    [/\bmitral\s+regurgitation\b/gi, 'MR'],
    [/\bheart\s+failure\b/gi, 'HF'],
    [/\bcongestive\s+heart\s+failure\b/gi, 'CHF'],
    [/\bhypertension\b/gi, 'HTN'],
    [/\bhyperlipidemia\b/gi, 'HLD'],
    [/\bosteoarthritis\b/gi, 'OA'],
    [/\batrial\s+fibrillation\b/gi, 'AFib'],
    [/\bcoronary\s+artery\s+disease\b/gi, 'CAD'],

    // Psychiatric / Neuro
    [/\bmajor\s+depressive\s+disorder\b/gi, 'MDD'],
    [/\bdepression\b/gi, 'MDD'],
    [/\bgeneralized\s+anxiety\s+disorder\b/gi, 'GAD'],
    [/\bcerebrovascular\s+accident\b/gi, 'CVA'],
    [/\btransient\s+ischemic\s+attack\b/gi, 'TIA'],

    // GI / Renal / Endocrine
    [/\bgastro-?esophageal\s+reflux(?:\s*disease)?(?:\s*without\s+esophagitis)?\b/gi, 'GERD'],
    [/\bchronic\s+kidney\s+disease\b/gi, 'CKD'],
    [/\bacute\s+kidney\s+injury\b/gi, 'AKI'],
    [/\bdiabetes\s+mellitus\b/gi, 'DM'],
    [/\btype\s*2\s*diabetes\b/gi, 'DMII'],

    // Heme / Onc
    [/\bmalt\s+lymphoma\b/gi, 'MALT Lymphoma'],
    [/\b(?:personal\s+history\s+of\s+other\s+)?malignant\s+neoplasms?\s+of\s+lymphoid(?:\s*,\s*hematopoietic[^\n]*)?\b/gi, 'MALT Lymphoma'],
    [/\biron\s+deficiency\s+anemia\b/gi, 'IDA'],
    [/\banemia\b/gi, 'Anemia'],

    // Wounds / Infections / Other
    [/\b(?:sacral\s+)?pressure\s+(?:ulcer|injury)(?:\s+of\s+sacral\s+region)?(?:\s+with\s+osteomyelitis)?\b/gi, 'Sacral Decubitus Ulcer'],
    [/\bsacral\s+osteomyelitis\b/gi, 'Sacral Osteomyelitis'],
    [/\bhypo-?osmolality(?:\s*,\s*hyponatremia)?\b/gi, 'Hyponatremia'],
    [/\bhyponatremia\b/gi, 'Hyponatremia'],
    [/\bovarian\s+cyst\b/gi, 'Ovarian Cyst'],
    [/\b(?:localized\s+)?visual\s+field\s+defect(?:\s+of\s+the\s+right\s+eye)?\b/gi, 'Visual Field Defect'],

    // Misspellings / mangled forms seen in charts — corrected (his standing OK, 2026-10-13)
    [/\bT2DM\b/gi, 'DM'],
    [/\bT@DM\b/gi, 'DM'],
    [/\bdiabeties\b/gi, 'Diabetes'],
    [/\bhypertention\b/gi, 'Hypertension']
  ];

  function grab(text, re){
    var out = [], m;
    while ((m = re.exec(text)) !== null) {
      out.push(m[1]);
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    return out;
  }

  function extractDx(text){
    if (!text) return [];
    text = text.replace(/[\u2018\u2019]/g, "'").replace(/[\u2010-\u2015]/g, '-')
               .replace(/\u00A0/g, ' ').replace(/\r/g, '');
    text = text.replace(/[ \t]+/g, ' ');
    // Template brackets are markup, not text; "Dementia(FTLD)" needs its space (2026-10-13)
    text = text.replace(/[\[\]]/g, '').replace(/([A-Za-z])\(/g, '$1 (');
    // "Primary admitting diagnosis:" is a label, not a diagnosis (his rule, 2026-10-13)
    // "c. diff" carries a period that reads as a sentence end to the list
    // captures below — the PMHX grab stopped mid-list at "...stroke, c"
    // (his Saints chart, 2026-10-14). Normalize it to C-Diff up front.
    text = text.replace(/\bc\.\s*diff\b/gi, 'C-Diff');
    text = text.replace(/\b(?:primary\s+)?admitting diagnosis\s*:\s*/gi, '');
    text = text.replace(/\badmission diagnosis\s*:\s*/gi, '');

    var raw = [];
    function push(s){ if (s) raw.push(s); }

    // Read ICD lines
    grab(text, /^[ ]*[A-Za-z]\d{1,3}(?:\.\w{1,4})?:[ ]*([^\n]+?)[ ]*$/gm).forEach(function(s){
      s = s.split(',')[0].replace(/^(?:other|unspecified)\s+/i, '').replace(/\s*\([^)]*\)\s*$/, '');
      push(s);
    });

    // Read PMH sections
    grab(text, /(?:past\s+)?(?:medical|psychiatric)\s+history\s*(?:of|significant\s+for|includes?|notable\s+for|:|\/psh)\s*([^\n]+?)(?=\.\s+[A-Z]|\n|$)/gi).forEach(push);
    grab(text, /\bPMHx?\b\s*:?\s*(?:significant for\s*)?([^\n]+?)(?=\.\s+[A-Z]|\n|$)/gi).forEach(push);
    // "The patient with h/o CHF, Asthma, ... was seen" carries the whole
    // list (CNR note, 2026-10-13). The capture must span line breaks:
    // PCC wraps the sentence across lines ("...response post\nPPM..."),
    // and a single-line capture silently loses the list — the all-caps
    // PMH dump then wins by default and fragments like "SUBSEQUENT
    // ENCOUNTER" become diagnoses (his CNR chart, 2026-10-14).
    var hoLists = [];
    grab(text, /\b(?:patient|pt)\s+with\s+(?:h\/o|history\s+of)\s+([\s\S]+?)\s+was\s+seen\b/gi).forEach(function (s) {
      hoLists.push(s.replace(/\s*\n\s*/g, ' '));
    });

    // Nursing notes carry the facility's canonical list as "Dx- A, B, C."
    // (his Saints chart, 2026-10-14). That list IS the answer when present:
    // verbatim as written (no abbreviation pass — "Osteoarthritis" stays
    // whole), and prose mining is skipped entirely, so partial prose lists
    // (the MD's PMHX sentence) can't pollute or truncate it.
    var dxLists = [];
    grab(text, /\bDx\s*[-:]\s*([A-Z][^\n]+?)(?=\.\s+[A-Z]|\.\s*$|\n|$)/gm).forEach(function (s) {
      s = s.trim();
      if (/^[A-Z]\d{1,3}(?:\.\d+)?\b/.test(s)) return;   // "Dx: G30.9 ..." code-first lines aren't prose lists
      if (s.length < 3) return;
      dxLists.push(s);
    });
    // "The resident is post admission to the facility with diagnoses
    // of: A, B, C." (his CH wound note, 2026-10-14) is the same kind
    // of canonical list — verbatim, and prose mining is skipped. The
    // extractor missed it and mined AUD/tobacco fragments from other
    // notes instead (his screenshot: "HTN, HLD, AUD, tobacco use
    // disorder" for a chart whose answer was the admission list).
    grab(text, /\bwith\s+diagnoses\s+of\s*:\s*([A-Z][^\n]+?)(?=\.\s+[A-Z0-9]|\.\s*$|\n|$)/gm).forEach(function (s) {
      s = s.trim();
      if (s.length < 3) return;
      if (dxLists.indexOf(s) < 0) dxLists.push(s);
    });
    // "With a DX of leg swelling, heart failure, essential
    // hypertension, prediabetes." (his CH social-work note,
    // 2026-10-14) — the same canonical family: a clinician stating
    // the resident's diagnosis list outright. Items here are
    // lowercase prose, so no capital-start requirement.
    grab(text, /\bwith\s+(?:a\s+)?dx\s+of\s*:?\s*([A-Za-z][^\n]+?)(?=\.\s+[A-Z]|\.\s*$|\n|$)/gi).forEach(function (s) {
      s = s.trim();
      if (s.length < 3) return;
      if (dxLists.indexOf(s) < 0) dxLists.push(s);
    });
    var verbatimOnly = dxLists.length > 0;
    // When a prose h/o list exists, it IS the answer (his CNR chart,
    // 2026-10-14: the physician's "patient with h/o ..." list, not the
    // admission note's coded PMH dump). The coded grabs don't compete.
    if (hoLists.length) raw = hoLists;

    // "Additional Diagnosis:" / "Secondary diagnosis:" — capture verbatim
    // (explicit clinician statements, bypass condensing filters)
    var verbatim = [];
    grab(text, /\bAdditional Diagnosis\s*:\s*([^\n]+)/gi).forEach(function(s){ verbatim.push(s.trim()); });
    grab(text, /\bSecondary diagnosis\s*:\s*([^\n]+)/gi).forEach(function(s){
      // Avoid double-counting if already inside an Additional Diagnosis capture
      var dup = verbatim.some(function(v){ return v.toLowerCase().indexOf(s.trim().toLowerCase()) >= 0; });
      if (!dup) verbatim.push(s.trim());
    });

    function applyAbbr(s) {
      for (var i = 0; i < ABBR.length; i++) s = s.replace(ABBR[i][0], ABBR[i][1]);
      return s;
    }

    // Verbatim lines: "S/P mechanical fall" is the same thing as "Status postfall"
    // (his call, 2026-10-13) — if a line has both, drop the S/P segment.
    verbatim = verbatim.map(function (s) {
      // Generalized history labels are not diagnoses — the whole list is a history
      // (his rule, 2026-10-13). Specific "hx of falls"-type mentions are untouched.
      // "Secondary Dx;" / "Secondary diagnosis:" is a label, not a diagnosis (his rule, 2026-10-13)
      s = s.replace(/\b(?:secondary|additional)\s+(?:diagnosis|dx)\s*[:;]\s*/gi, '');
      s = s.replace(/\bPMHx?\s*:\s*/gi, '').replace(/\bpast\s+(?:medical|psychiatric)\s+history\s*:\s*/gi, '');
      s = s.replace(/\.\s+/g, ', ');
      s = s.replace(/^\s*weakness\s*\.\s*/i, '');
      s = applyAbbr(s);   // abbreviations apply everywhere, verbatim included (his "always" rule, 2026-10-13)
      s = s.split(/\s*,\s*/).filter(function (p) {
        if (isProcedureItem(p) || isWeaknessItem(p)) return false;
        if (/^(?:unspecified|not intractable|intractable|with status epilepticus|without status epilepticus)$/i.test(p.trim())) return false;
        return true;
      }).join(', ');
      var parts = s.split(/\s*,\s*/);
      var hasPost = parts.some(function (p) { return /\bpostfall\b/i.test(p) || /\bstatus\s*post\s*fall/i.test(p); });
      if (!hasPost) return s;
      return parts.filter(function (p) { return !(/^\s*s\/?p\s+/i.test(p) && /\bfall\b/i.test(p)); }).join(', ');
    });

    // Filters for non-serious symptoms, functional items, and admission fluff
    var EXCLUDE_EXACT = /^(?:constipation|insomnia|advance careplanning|moderate protein-calorie malnutrition|muscle weakness|difficulty in walking|falling|need for assistance with personal care|gw|generalized weakness|history of|hx of|hx|past surgical history|surgical history|psh|reviewed in electronic medical record|reviewed in emr|reviewed in chart|reviewed in the chart|unspecified|not intractable|intractable|with status epilepticus|without status epilepticus)$/i;
    var ADMIN_JUNK = /^(?:CPT Codes|ICD Codes|Admission|Minimal Depression|Moderate Depression|Severe Depression|Score|Attestation|Time spent|Date of Service|Transition of Care)/i;
    // A test/procedure is not a diagnosis — "H/O chest x-ray" (his rule, 2026-10-13)
    // Weakness and difficulty walking are functional notes, not diagnoses (his rule, 2026-10-13)
    function isWeaknessItem(s) {
      var x = (s || '').trim();
      if (/\bweakness\b/i.test(x) && x.split(/\s+/).length <= 4) return true;
      return /\bdifficulty\s+(?:in\s+|with\s+)?walking\b/i.test(x) || /\bwalking\s+difficulty\b/i.test(x);
    }
    function isProcedureItem(s) {
      return /^(?:(?:h\/o|hx|history)\s+(?:of\s+)?)?[\w\s-]*?\b(x-?ray|ct\s+scan|pet\s+scan|mri|mra|ecg|ekg|echocardiogram|ultrasound|sonogram|mammogram|colonoscopy|endoscopy|bronchoscopy|angiogram)\b[\w\s-]*$/i.test((s || '').trim());
    }
    var PROSE = /^(?:the |res\b|resident|patient\b|pt\b|he |she )|\b(?:arrived|accompanied|presents?|presented|reports?|reported|denies|stretcher|ambulance|admitted to|was admitted|hospitalized|was hospitalized|seen (?:at|by))\b/i;
    // Fragments: start with preposition/conjunction/verb, or are narrative leftovers
    var FRAGMENT = /^(?:of|with|and|or|is|are|was|were|has|have|had|for|in|on|at|by|to|presence of)\b/i;
    var NARRATIVE = /\b(?:significant for|status post|s\/p|baseline|goals of care)\b/i;

    // Normalize for dedup: lowercase, strip qualifiers, keep the core concept
    function normDx(s){
      // DM type-2 spellings are one concept (his Saints list says "DM2";
      // prose says "type 2 DM" — keep the first form, drop the rest)
      if (/\b(?:dm2|dmii|t2dm)\b/i.test(s) || /\btype\s*(?:2|ii)\s*(?:dm|diabetes)/i.test(s) || /\bdiabetes\s+mellitus\s+type\s*(?:2|ii)/i.test(s)) return 'dm2key';
      // "stroke" in prose == "Cerebral Infarction" in the canonical list
      if (/\bstroke\b/i.test(s) || /\bcerebral\s+infarction\b/i.test(s) || /\bcva\b/i.test(s)) return 'strokekey';
      // "S/P mechanical fall" / "status postfall" / "s/p fall" = one concept (his call, 2026-10-13)
      if (/\bpostfall\b/i.test(s) || (/\b(?:s\/?p|status\s*post)\b/i.test(s) && /\bfall\b/i.test(s))) return 'fallstatus';
      // "Seizures" and "Seizure disorder" are the same thing (his call, 2026-10-13)
      if (/\bseizures?\b/i.test(s) || /\bseizure disorder\b/i.test(s)) return 'seizurekey';
      return s.toLowerCase()
        .replace(/\b(?:chronic|acute|bilateral|unilateral|recurrent|severe|mild|moderate)\b/g, '')
        .replace(/\s*(?:with|s\/p|\/)\s*.*$/, '')  // strip "with X", "s/p X", "/ X" tails
        .replace(/[^a-z0-9]/g, '');
    }

    // Dx- lists lead, cleaned only by the safety filters (procedures and
    // weakness/function items out) — never abbreviated, never condensed.
    function cleanDxList(s) {
      return s.replace(/[\s.]+$/, '').split(/\s*,\s*/).filter(function (p) {
        if (!p || isProcedureItem(p) || isWeaknessItem(p)) return false;
        if (/^(?:unspecified|not intractable|intractable|with status epilepticus|without status epilepticus)$/i.test(p.trim())) return false;
        return true;
      }).join(', ');
    }

    var seen = {}, out = [];
    dxLists.forEach(function (s) {
      var c = cleanDxList(s);
      if (c && !seen['v:' + c.toLowerCase()]) { seen['v:' + c.toLowerCase()] = 1; out.push(c); }
    });
    // Verbatim diagnoses go first, unfiltered
    verbatim.forEach(function(v){
      if (v && !seen['v:'+v.toLowerCase()]) { seen['v:'+v.toLowerCase()] = 1; out.push(v); }
    });
    if (!verbatimOnly) raw.forEach(function(str){
      // Clean out tailing narrative phrases like "seen today for PA admission"
      str = str.replace(/\bseen\s+today\s+for\s+[^\n,]*/gi, '');
      // Generalized history labels are not diagnoses — the whole list is a history
      // (his rule, 2026-10-13). Specific "hx of falls"-type mentions are untouched.
      str = str.replace(/\bPMHx?\s*:\s*/gi, '');
      str = str.replace(/\bpast\s+(?:medical|psychiatric)\s+history\s*:\s*/gi, '');
      str = str.replace(/\.\s+/g, ', ');
      // Diagnosis codes aren't needed in the list (his rule, 2026-10-13)
      str = str.replace(/\((?:\d{3}(?:\.\d+)?|[A-Z]\d{2}(?:\.\d+)?)(?:\s*\/\s*(?:\d{3}(?:\.\d+)?|[A-Z]\d{2}(?:\.\d+)?))*\)\s*/g, '');
      // "who was hospitalized on 08/19/2026 for X" -> split into separate items
      // ("daily alcohol use" and "X" become separate diagnoses)
      str = str.replace(/\bwho\s+was\s+hospitalized\s+on\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s+for\s+/gi, ', ');
      // Trailing "reviewed in electronic medical record" is charting fluff, not a diagnosis
      str = str.replace(/,?\s*reviewed\s+in\s+(?:the\s+)?electronic\s+medical\s+record\.?\s*$/gi, '');
      // "Secondary Dx;" / "Secondary diagnosis:" is a label, not a diagnosis (his rule, 2026-10-13)
      str = str.replace(/\b(?:secondary|additional)\s+(?:diagnosis|dx)\s*[:;]\s*/gi, '');
      // Same for "reviewed in chart" (his rule, 2026-10-13)
      str = str.replace(/,?\s*reviewed\s+in\s+(?:the\s+)?chart\.?\s*$/gi, '');

      str.split(/\s*(?:,(?![^()]*\))|;|\u2022|\/\s+)\s*|\s+and\s+/i).forEach(function(it){
        it = (it || '').replace(/\s+/g, ' ')
               .replace(/^[-–—:\s.;()]+|[-–—:\s.;()]+$/g, '')
               .replace(/^(?:hx|h\/o|history|recent|adm with dx|admitted for)\s+of\s+/i, '')
               .replace(/^\/PSH\s*/i, '');

        if (/^(?:c|diff)$/i.test(it)) return;   // split "c. diff" debris is not a diagnosis
        if (/^post\s+(?:fall|falls|falling)\b/i.test(it)) return;   // "post fall due to ..." is the tail of the previous item, not a diagnosis (his CNR chart, 2026-10-14)
        if (/^(?:(?:subsequent|initial)\s+encounter|site not specified|not elsewhere classified|unspecified severity|stage\s+\d+\s+unspecified)$/i.test(it)) return;   // ICD description fragments, not diagnoses
        if (!it || ADMIN_JUNK.test(it) || PROSE.test(it) || EXCLUDE_EXACT.test(it) || isProcedureItem(it) || isWeaknessItem(it)) return;
        if (/\d+\.\d+/.test(it)) return;
        // Reject fragments and narrative leftovers
        if (FRAGMENT.test(it) || NARRATIVE.test(it)) return;
        // Reject overly long items (real diagnoses are concise; longer = narrative)
        if (it.split(/\s+/).length > 6 || it.length > 50) return;

        // Apply Abbreviation Mappings
        it = applyAbbr(it);
        it = it.replace(/\s+/g, ' ').trim();

        if (!it || ADMIN_JUNK.test(it) || EXCLUDE_EXACT.test(it) || isProcedureItem(it) || isWeaknessItem(it)) return;
        if (FRAGMENT.test(it) || NARRATIVE.test(it)) return;
        if (it.split(/\s+/).length > 6 || it.length > 50) return;

        // Smart Deduplication: normalize and keep the shortest form
        var k = normDx(it);
        if (!k) return;
        if (seen[k]) {
          // Keep the shorter (cleaner) version
          var idx = seen[k] - 1;
          if (it.length < out[idx].length) out[idx] = it;
          return;
        }
        seen[k] = out.length + 1;
        out.push(it);
      });
    });
    // Final dedupe across everything (verbatim lines included): split combined
    // lines on ", " so a concept mentioned twice — once inside a line, once on
    // its own (Seizure disorder / Seizures, hypertension / HTN) — appears once.
    out = out.map(function (s) {
      s = s.replace(/\((?:\d{3}(?:\.\d+)?|[A-Z]\d{2}(?:\.\d+)?)(?:\s*\/\s*(?:\d{3}(?:\.\d+)?|[A-Z]\d{2}(?:\.\d+)?))*\)\s*/g, '');
      s = s.replace(/^(?:[A-Z]\d{2}\.\d+|\d{3}\.\d+)\s+/, '');
      return s.replace(/\s*,\s*/g, ', ').replace(/\.\s+/g, ', ').replace(/[\s.,]+$/, '').replace(/\s+/g, ' ').trim();
    });
    var seenAll = {}, finalOut = [];
    out.forEach(function (item) {
      var kept = [];
      item.split(', ').forEach(function (seg) {
        var k = normDx(seg);
        if (!k || seenAll[k]) return;
        seenAll[k] = 1;
        kept.push(seg);
      });
      if (kept.length) finalOut.push(kept.join(', '));
    });
    out = finalOut;
    // Cap at 12 most important (ICD lines come first, so they're prioritized)
    return { items: out.slice(0, 12), verbatimOnly: verbatimOnly };
  }

  // ===== DOM Helpers =====
  function viewLink(txt){
    var links = document.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) if ((links[i].textContent || '').trim() === txt) return links[i];
    return null;
  }

  function notesText(){
    var links = [].slice.call(document.querySelectorAll('a')).filter(function(a){
      return (a.textContent || '').trim().toLowerCase() === 'view';
    });
    if (!links.length) return '';
    var table = links[0].closest('table');
    if (!table) return '';
    return (table.innerText || '').replace(/\t/g, '\n');
  }

  function copyText(text, btn){
    function done(){ if (!btn) return; var o = btn.textContent; btn.textContent = 'Copied'; setTimeout(function(){ btn.textContent = o; }, 1200); }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, fb); return; }
    } catch (e) {}
    fb();
    function fb(){
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta); done();
      } catch (e) {}
    }
  }

  // Common diagnosis abbreviations. Full name (lowercase) -> abbreviation.
  // If already abbreviated (e.g. "HTN"), it's left alone.
  var DX_ABBR = {
    'hypertension': 'HTN',
    'hyperlipidemia': 'HLD',
    'major depressive disorder': 'MDD',
    'major depression': 'MDD',
    'depressive disorder': 'MDD',
    'diabetes mellitus': 'DM',
    'diabetes mellitus type 2': 'DM2',
    'type 2 diabetes mellitus': 'DM2',
    'type 2 diabetes': 'DM2',
    'chronic kidney disease': 'CKD',
    'congestive heart failure': 'CHF',
    'coronary artery disease': 'CAD',
    'atrial fibrillation': 'AFib',
    'gastroesophageal reflux disease': 'GERD',
    'urinary tract infection': 'UTI',
    'benign prostatic hyperplasia': 'BPH',
    'chronic obstructive pulmonary disease': 'COPD',
    'cerebrovascular accident': 'CVA',
    'transient ischemic attack': 'TIA',
    'deep vein thrombosis': 'DVT',
    'pulmonary embolism': 'PE',
    'altered mental status': 'AMS',
    'urinary incontinence': 'UI',
    'fecal incontinence': 'FI',
    'chronic pain': 'chronic pain',
    'low back pain': 'LBP',
    'dementia': 'dementia',
    "alzheimer's disease": "Alz",
    'alzheimers disease': 'Alz',
    'parkinson disease': "Parkinson's",
    "parkinson's disease": "Parkinson's",
    'anxiety disorder': 'anxiety',
    'generalized anxiety disorder': 'GAD',
    'bipolar disorder': 'bipolar',
    'schizophrenia': 'schizophrenia',
    'schizoaffective disorder': 'schizoaffective',
    'insomnia': 'insomnia',
    'hypothyroidism': 'hypothyroid',
    'hyperthyroidism': 'hyperthyroid',
    'anemia': 'anemia',
    'hyponatremia': 'hyponatremia',
    'hypernatremia': 'hypernatremia',
    'hypokalemia': 'hypokalemia',
    'hyperkalemia': 'hyperkalemia',
    'leukocytosis': 'leukocytosis'
  };

  function abbrDx(items){
    var seen = {}, out = [];
    for (var i = 0; i < items.length; i++) {
      var raw = (items[i] || '').trim().replace(/\.+$/, '');
      if (!raw) continue;
      var low = raw.toLowerCase();
      var ab = raw;
      // Already abbreviated? (all caps, short, no spaces) -> leave it
      if (!/^[A-Z0-9]+$/.test(raw) || raw.length > 6) {
        if (DX_ABBR[low]) ab = DX_ABBR[low];
      }
      var key = ab.toLowerCase();
      if (!seen[key]) { seen[key] = true; out.push(ab); }
    }
    return out;
  }

  var dxText = '';
  // His diagnoses feedback (v1.33, designed with him): a
  // check and an x on the tile. Check = the script was right.
  // X opens an editor holding the script's version; he saves
  // HIS version, and from then on this tile copies/queues his
  // words on this chart. Both judgements save to the shared
  // browser feedback store and reach Mica inside captures.
  var dxScriptText = '', dxCorrected = '';
  var FB_KEY = 'pnFeedback';
  function fbLoad() {
    try { var a = JSON.parse(localStorage.getItem(FB_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function fbSave(rec) {
    var a = fbLoad().filter(function (r) { return r.k !== rec.k; });
    a.push(rec);
    while (a.length > 1000) a.shift();
    try { localStorage.setItem(FB_KEY, JSON.stringify(a)); } catch (e) {}
  }
  function dxCid() {
    var m = /ESOLclientid=(\d+)/.exec(location.search || '');
    return m ? m[1] : '';
  }
  function loadCorr() {
    try {
      var c = JSON.parse(sessionStorage.getItem('pnDxCorr') || 'null');
      if (c && c.cid === dxCid() && c.text) dxCorrected = c.text;
    } catch (e) {}
  }
// Judgement snapshots (his design): the moment he judges,
  // a pruned copy of this notes page is stored in the
  // browser's big storage (IndexedDB 'pnReview'), linked to
  // the record by its key - so a periodic review file can
  // pair every judgement with the page it was made on.
  // Pruned: scripts/styles/images and our own UI stripped;
  // the notes themselves stay whole.
  function snapPrune(root) {
    var c = root.cloneNode(true);
    c.removeAttribute('style');
    var kill = c.querySelectorAll('script, style, link, img, svg, iframe, .pnBehFbBar, #pnTilesWrap');
    for (var i = 0; i < kill.length; i++) kill[i].remove();
    var all = c.querySelectorAll('*');
    for (var j = 0; j < all.length; j++) { all[j].removeAttribute('style'); all[j].removeAttribute('onclick'); }
    return c.outerHTML;
  }
  function snapHTML() {
    var card = null;
    var as = document.querySelectorAll('a');
    for (var i = 0; i < as.length; i++) {
      var tr = as[i].closest ? as[i].closest('tr') : null;
      var tds = tr ? tr.querySelectorAll('td') : [];
      if (tds.length > 2 && /^\d{1,2}\/\d{1,2}\/\d{4}/.test((tds[1].textContent || '').replace(/\s+/g, ' ').trim())) {
        var tb = as[i].closest('table');
        card = (tb && tb.closest('.evergreen-card')) || tb;
        break;
      }
    }
    if (!card) return '';
    var head = '';
    var spans = document.querySelectorAll('span');
    for (var s = 0; s < spans.length; s++) {
      if ((spans[s].textContent || '').replace(/\s+/g, ' ').trim() === 'Progress Notes - View All') {
        var hp = spans[s].parentElement;
        if (hp) head = snapPrune(hp);
        break;
      }
    }
    return '<div class="pn-snap">' + head + snapPrune(card) + '</div>';
  }
  function fbSnap(key) {
    try {
      var html = snapHTML();
      if (!html || typeof indexedDB === 'undefined') return;
      var rq = indexedDB.open('pnReview', 1);
      rq.onupgradeneeded = function () {
        if (!rq.result.objectStoreNames.contains('snaps')) rq.result.createObjectStore('snaps', { keyPath: 'k' });
      };
      rq.onsuccess = function () {
        try {
          var store = rq.result.transaction('snaps', 'readwrite').objectStore('snaps');
          store.put({ k: key, html: html, ts: Date.now(), sent: false });
          var all = store.getAll();
          all.onsuccess = function () {
            var rows = all.result || [];
            if (rows.length <= 500) return;
            rows.sort(function (a, b) { return (a.sent === b.sent) ? a.ts - b.ts : (a.sent ? -1 : 1); });
            rows.slice(0, rows.length - 500).forEach(function (r) { store.delete(r.k); });
          };
        } catch (e) {}
      };
      rq.onerror = function () {};
    } catch (e) {}
  }

  function fbDel(key) {
    try { localStorage.setItem(FB_KEY, JSON.stringify(fbLoad().filter(function (r) { return r.k !== key; }))); } catch (e) {}
  }
  function dxVerdict() {
    if (dxCorrected) return 'wrong';
    var k = 'dxok|' + dxCid() + '|' + (dxScriptText || '').slice(0, 40);
    return fbLoad().some(function (r) { return r.k === k; }) ? 'right' : '';
  }
  // Judge ONCE (his rule, v1.36): after a verdict the buttons
  // lock, the chosen one stays filled, and 'completed' stays
  // written next to them - visible while he looks around.
  function paintDxFb() {
    var v = dxVerdict();
    var r = document.getElementById('pnDxFbR');
    var w = document.getElementById('pnDxFbW');
    var saved = document.getElementById('pnDxFbSaved');
    if (r) {
      r.style.background = v === 'right' ? '#dcfce7' : '#fff';
      r.style.borderColor = v === 'right' ? '#15803d' : '#cbd5e1';
      r.disabled = !!v;
      r.style.cursor = v ? 'default' : 'pointer';
    }
    if (w) {
      w.style.background = v === 'wrong' ? '#fee2e2' : '#fff';
      w.style.borderColor = v === 'wrong' ? '#b91c1c' : '#cbd5e1';
      w.disabled = !!v;
      w.style.cursor = v ? 'default' : 'pointer';
    }
    if (saved) saved.textContent = v ? 'completed' : '';
    var rst = document.getElementById('pnDxEditReset');
    if (rst) rst.style.display = dxCorrected ? '' : 'none';
    var lab = document.getElementById('pnDxLabel');
    if (lab && !lab.getAttribute('data-orig')) {
      lab.textContent = dxCorrected ? 'Diagnoses \u2014 your version' : 'Diagnoses';
    }
  }
  function applyDx() {
    var out = document.getElementById('pnDxOut');
    var box = document.getElementById('pnDxBox');
    dxText = dxCorrected || dxScriptText;
    if (out) out.textContent = dxText;
    if (box && dxText) {
      box.classList.add('pcc-fill-copy');
      box.setAttribute('data-fill-label', 'Diagnoses');
      box.setAttribute('data-fill-value', dxText);
    }
    paintDxFb();
  }
  function runDx(){
    var out = document.getElementById('pnDxOut');
    var box = document.getElementById('pnDxBox');
    var res = extractDx(notesText());
    var items = res.items;
    if (!items.length) {
      dxText = '';
      dxScriptText = '';
      out.textContent = 'No serious diagnoses found in the loaded notes.';
      return;
    }
    // A clinician's own list (Dx- / Additional / Secondary) is presented
    // as written; the abbreviation pass is only for prose-mined items.
    items = res.verbatimOnly ? items : abbrDx(items);
    dxScriptText = items.join(', ');
    // The TILE is the copy target (v1.23): applyDx puts the
    // effective text (his correction when he's made one) on the
    // tile and into the fill contract for G / grab-all.
    applyDx();
  }

  // Clicking the tile = clicking the old Copy button: the tile
  // flashes like a tile-row tile and the diagnoses copy + queue.
  function tileGrab(){
    if (!dxText) return;
    copyText(dxText, null);
    try {
      localStorage.setItem('pccFillDiagnoses', JSON.stringify({ value: dxText, ts: Date.now() }));
    } catch (err) {}
  }
  // Press language, identical to the tile row (his spec, v1.25):
  // the tile is lit (light blue fill, #93c5fd border, label reads
  // 'Copied') ONLY while it is pressed - mouse down on it, or G
  // held - and restores the moment the press ends. A plain click
  // also flashes the label 'Copied' for a second, like the tile
  // row's Copy buttons do.
  // Label and fill move TOGETHER, locked to the press (his
  // spec, v1.28): press - by the G key, the G button, or the
  // tile itself - and the tile turns blue AND reads 'Copied'
  // in the same instant; let go and both restore together.
  // No separate label timer.
  var lit = false;
  // The light is owned by SOURCES (his G-key report, v1.29):
  // pressing G fires the grab, whose synthetic clicks land on
  // this tile mid-hold and used to restore it instantly. Only
  // trusted presses count now - the light lasts exactly as
  // long as a real key/mouse/button hold does.
  var srcKey = false, srcMouse = false, srcBtn = false, srcTm = false;
  function renderLight() { lightTile(srcKey || srcMouse || srcBtn || srcTm); }
  function lightTile(on) {
    var b = document.getElementById('pnDxBox');
    if (!b) return;
    lit = on;
    b.style.background = on ? '#dbeafe' : '#fff';
    b.style.borderColor = on ? '#93c5fd' : '#cbd5e1';
    var lab = document.getElementById('pnDxLabel');
    if (lab) {
      if (on) {
        if (!lab.getAttribute('data-orig')) lab.setAttribute('data-orig', lab.textContent);
        lab.textContent = 'Copied';
      } else if (lab.getAttribute('data-orig')) {
        lab.textContent = lab.getAttribute('data-orig');
        lab.removeAttribute('data-orig');
      }
    }
  }

  // S and G buttons for the box, same actions as the header's
  // (his ask, 2026-10-14). G mirrors the header G exactly: click
  // this page's G badge, else broadcast the grab signal. S must
  // fire in the HEADER document - that is where the resident
  // name lives and where the S listener finds it.
  function boxTriggerG() {
    var badge = document.querySelector('.pcc-g-badge');
    if (badge) { badge.click(); return; }
    try { localStorage.setItem('pccGrabSignal', String(Date.now())); } catch (e) {}
  }
  function boxTriggerS() {
    var docs = [];
    try {
      var top = window.top;
      (function walk(w) {
        try { docs.push(w.document); } catch (e) { return; }
        for (var i = 0; i < w.frames.length; i++) walk(w.frames[i]);
      })(top);
    } catch (e) { docs = [document]; }
    var target = null;
    for (var i = 0; i < docs.length; i++) {
      if (docs[i].getElementById && docs[i].getElementById('residentHeaderButtons')) { target = docs[i]; break; }
    }
    if (!target) target = document;
    var KEv = (target.defaultView && target.defaultView.KeyboardEvent) || KeyboardEvent;
    target.dispatchEvent(new KEv('keydown', { key: 's', bubbles: true, cancelable: true }));
  }

  // The button's clicked state is BLUE (like the header tiles
  // lighting up) - the word 'Copied' never shows. markCopied is
  // re-asserted after the copy helper's text flash would land.
  // (markCopied painted the old Copy button blue; since
  // v1.23 the tile itself flashes - see flashTile above.)

  // The tile has its own G now - hide the grab-all badge that
  // parks itself next to this Copy button (the G key and the
  // tile's G still grab it exactly as before).
  function hideBoxBadge() {
    var box = document.getElementById('pnDxBox');
    if (!box) return;
    var badge = box.querySelector('.pcc-g-badge');
    if (badge) badge.style.display = 'none';
    // The grab script parks this tile's G badge as a sibling -
    // and the Behavior tile can slide in between them, so sweep
    // every badge sharing the tile's parent (on this page the
    // only grab target is this tile, so any such badge is its).
    var p = box.parentElement;
    if (p) {
      var bs = p.querySelectorAll(':scope > .pcc-g-badge');
      for (var i = 0; i < bs.length; i++) bs[i].style.display = 'none';
    }
  }

  window.addEventListener('storage', function (e) {
    if (e.key === 'pccGrabSignal' && e.newValue) {
      setTimeout(function () { hideBoxBadge(); }, 400);
    }
    // G held on a chart page: the tile row's signal (tmGPress).
    if (e.key === 'tmGPress') { srcTm = !!e.newValue; renderLight(); }
  });

  // On THIS page the tile-row script never runs, so tmGPress is
  // never written here (his live report, v1.27): the tile lit
  // for zero milliseconds - only the label flashed. So this
  // script watches the G key itself (paint only - the grab
  // itself still belongs to the Grab-all script): lit while
  // the key is down, restored on release. Same guards as every
  // key script: trusted, dead while typing, no repeat.
  function typingNow() {
    var a = document.activeElement;
    if (!a) return false;
    var tg = (a.tagName || '').toLowerCase();
    return tg === 'input' || tg === 'textarea' || tg === 'select' || !!a.isContentEditable;
  }
  document.addEventListener('keydown', function (e) {
    if (!e.isTrusted || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== 'g' && e.key !== 'G') return;
    if (typingNow()) return;
    srcKey = true; renderLight();
  }, true);
  document.addEventListener('keyup', function (e) {
    if (e.key !== 'g' && e.key !== 'G') return;
    srcKey = false; renderLight();
  }, true);

  // Separation (his ask, v1.31): the Progress Notes panel
  // sits flush under the tiles. Two moves, either topology:
  // a spacer right after the tiles card, and a top margin on
  // the .evergreen-card panel when it follows the card (the
  // card's own bottom margin gets swallowed by the table
  // layout around it).
  function gapSection() {
    var wrap = document.getElementById('pnTilesWrap');
    if (!wrap) return;
    var cards = document.querySelectorAll('.evergreen-card');
    for (var i = 0; i < cards.length; i++) {
      if (wrap.compareDocumentPosition(cards[i]) & 4) {
        cards[i].style.marginTop = '18px';
        break;
      }
    }
  }

  // The Progress Notes panel: the .evergreen-card that holds
  // the notes table. The tiles card belongs BEFORE it, outside
  // its white entirely (his correction, v1.32: the panel's
  // white was extending up behind the S and G buttons because
  // the tiles had landed inside the panel).
  function pnCard() {
    var tbl = notesTable();
    if (!tbl || !tbl.closest) return null;
    return tbl.closest('.evergreen-card');
  }

  function notesTable() {
    var tables = document.querySelectorAll('table'), best = null, bestN = 0;
    for (var i = 0; i < tables.length; i++) {
      var n = 0, links = tables[i].querySelectorAll('a');
      for (var j = 0; j < links.length; j++) {
        if ((links[j].textContent || '').trim().toLowerCase() === 'view') n++;
      }
      if (n > bestN) { bestN = n; best = tables[i]; }
    }
    return best;
  }

  function insertBox(){
    if (document.getElementById('pnDxBox')) return;
    var all = viewLink('All Notes');
    if (!all) return;
    // v1.26 (his design): both Progress Notes tiles sit on one
    // white card, like the tile row's background. S and G move
    // OUT of the Diagnoses tile into their own row above it,
    // still inside the white card.
    var wrap = document.getElementById('pnTilesWrap');
    if (!wrap) {
      // Final anchor only (v1.35): while the notes panel is
      // still rendering, WAIT - never park the card at a
      // provisional spot it will jump away from a beat later.
      if (!pnCard() && Date.now() - pnStart < 6000) return;
      wrap = document.createElement('div');
      wrap.id = 'pnTilesWrap';
      wrap.style.cssText = 'background:#fff;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 2px 10px rgba(15,23,42,.10);padding:10px;margin:10px 0 18px;box-sizing:border-box;';
      // Anchor: right BEFORE the Progress Notes panel, outside
      // its white. Fallbacks: before the notes table, then
      // after the views bar.
      var card = pnCard();
      var tbl = notesTable();
      if (card && card.parentNode) {
        card.parentNode.insertBefore(wrap, card);
      } else if (tbl && tbl.parentNode) {
        tbl.parentNode.insertBefore(wrap, tbl);
      } else {
        var bar = all.parentElement;
        bar.parentNode.insertBefore(wrap, bar.nextSibling);
      }
    }
    // The grab script plants its G badge next to the tile a
    // beat after the tile appears; sweep for it right away on
    // a few quick one-shot passes so it never gets seen
    // sitting there on refresh (v1.37).
    [0, 120, 300, 700].forEach(function (ms) { setTimeout(hideBoxBadge, ms); });
    if (!document.getElementById('pnDxBtnRow')) {
      var hdrCss = 'font-size:13px;font-weight:600;padding:5px 14px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#334155;cursor:pointer;';
      var row = document.createElement('div');
      row.id = 'pnDxBtnRow';
      row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px;';
      // The verdict buttons live HERE, not in the tile (v1.34):
      // inside the tile they were tiny targets nested in one
      // big copy button - hard to hit, and every press lit the
      // tile. In this row they are standalone buttons, like S/G.
      var fbCss = 'font-size:13px;font-weight:700;padding:5px 13px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;';
      row.innerHTML =
        '<button class="rh-header-btn" id="pnDxS" type="button" title="Copy name + room (same as the S key)" style="' + hdrCss + '">S</button>' +
        '<button class="rh-header-btn" id="pnDxG" type="button" title="Grab all - queue everything on screen (same as the G key)" style="' + hdrCss + 'background:#dbeafe;">G</button>' +
        '<button id="pnDxFbR" type="button" title="The diagnoses are right" style="' + fbCss + 'color:#15803d;">\u2713</button>' +
        '<button id="pnDxFbW" type="button" title="The diagnoses are wrong - I will give my version" style="' + fbCss + 'color:#b91c1c;">\u2717</button>' +
        '<span id="pnDxFbSaved" style="font-size:11px;color:#15803d;font-weight:600;"></span>' +
        '<button id="pnDxEditReset" type="button" style="display:none;font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;color:#334155;cursor:pointer;">back to script version</button>';
      wrap.insertBefore(row, wrap.firstChild);
      document.getElementById('pnDxS').onclick = boxTriggerS;
      var gBtn = document.getElementById('pnDxG');
      gBtn.onclick = boxTriggerG;
      // Holding the G button lights the tile for exactly the
      // press, same as the key and the tile itself (v1.28).
      gBtn.addEventListener('mousedown', function (e) { if (e.isTrusted) { srcBtn = true; renderLight(); } });
    }
    var box = document.createElement('div');
    box.id = 'pnDxBox';
    box.style.cssText = 'margin:0;padding:14px 16px;background:#fff;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,.05);font-size:13px;box-sizing:border-box;overflow-wrap:anywhere;';
    box.innerHTML =
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">' +
      '<span id="pnDxLabel" style="font-weight:700;color:#334155;">Diagnoses</span>' +
      '</div>' +
      '<div id="pnDxEditor" style="display:none;margin-bottom:8px;">' +
      '<textarea id="pnDxEditText" rows="3" style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:8px;font-size:13px;font-family:inherit;color:#0f172a;"></textarea>' +
      '<div style="display:flex;gap:6px;margin-top:6px;align-items:center;">' +
      '<button id="pnDxEditSave" type="button" style="font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px;border:1px solid #93c5fd;background:#dbeafe;color:#1e3a5f;cursor:pointer;">Save my version</button>' +
      '<button id="pnDxEditCancel" type="button" style="font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;color:#334155;cursor:pointer;">Cancel</button>' +
      '</div></div>' +
      '<div id="pnDxOut" style="color:#0f172a;"></div>';
    box.style.cursor = 'pointer';
    wrap.appendChild(box);
    loadCorr();
    var fbR = document.getElementById('pnDxFbR');
    var fbW = document.getElementById('pnDxFbW');
    var fbSaved = document.getElementById('pnDxFbSaved');
    var editor = document.getElementById('pnDxEditor');
    var editText = document.getElementById('pnDxEditText');
    fbR.onclick = function () {
      if (dxVerdict()) return;
      var rec = {
        k: 'dxok|' + dxCid() + '|' + (dxScriptText || '').slice(0, 40),
        kind: 'dx', verdict: 'right', script: dxScriptText,
        site: location.hostname, ts: Date.now(), sent: false
      };
      fbSave(rec);
      fbSnap(rec.k);
      paintDxFb();
    };
    fbW.onclick = function () {
      if (dxVerdict()) return;
      editText.value = dxCorrected || dxScriptText;
      editor.style.display = '';
      editText.focus();
    };
    document.getElementById('pnDxEditSave').onclick = function () {
      var v = (editText.value || '').replace(/\s+/g, ' ').trim();
      if (!v) return;
      dxCorrected = v;
      try { sessionStorage.setItem('pnDxCorr', JSON.stringify({ cid: dxCid(), text: v })); } catch (e) {}
      var rec2 = {
        k: 'dx|' + dxCid(), kind: 'dx', verdict: 'wrong',
        script: dxScriptText, corrected: v,
        site: location.hostname, ts: Date.now(), sent: false
      };
      fbSave(rec2);
      fbSnap(rec2.k);
      editor.style.display = 'none';
      applyDx();
    };
    // Enter inside the editor = Save my version (his ask,
    // v1.38; corrections are one line, so Enter never needs
    // to be a newline here).
    editText.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('pnDxEditSave').click();
      }
    });
    document.getElementById('pnDxEditCancel').onclick = function () {
      editor.style.display = 'none';
    };
    document.getElementById('pnDxEditReset').onclick = function () {
      // Withdrawing the correction withdraws the judgement
      // too: the record leaves the store and the buttons
      // unlock, so he can judge again if he wants.
      dxCorrected = '';
      fbDel('dx|' + dxCid());
      try { sessionStorage.removeItem('pnDxCorr'); } catch (e) {}
      editor.style.display = 'none';
      applyDx();
    };
    box.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('#pnDxEditor, #pnDxFbR, #pnDxFbW')) return;
      tileGrab();
    });
    box.addEventListener('mousedown', function (e) {
      if (e.target.closest && e.target.closest('#pnDxEditor')) return;
      if (e.isTrusted) { srcMouse = true; renderLight(); }
    });
    window.addEventListener('mouseup', function (e) {
      if (!e.isTrusted) return;
      srcMouse = false; srcBtn = false; renderLight();
    });
    runDx();
    hideBoxBadge();
    setTimeout(hideBoxBadge, 600);
  }

  function tick(){
    hideBoxBadge();
    var all = viewLink('All Notes');
    var onPN = all && viewLink('Last 30 days');
    if (!onPN) { try { sessionStorage.removeItem('pnClickedAll'); } catch (e) {} return; }
    if (!sessionStorage.getItem('pnClickedAll')) {
      try { sessionStorage.setItem('pnClickedAll', '1'); } catch (e) {}
      all.click();
      return;
    }
    insertBox();
    gapSection();
    if (document.getElementById('pnDxBox')) {
      // Cheap fingerprint first (v1.34 speed): building the
      // full notes text on every pass was part of the drag.
      var tbl2 = notesTable();
      var fp2 = tbl2 ? tbl2.rows.length + ':' + (tbl2.textContent || '').length : '';
      if (fp2 !== lastFpDx) {
        lastFpDx = fp2;
        var len = notesText().length;
        if (len !== lastNotesLen) { lastNotesLen = len; runDx(); }
      }
    }
  }
  var lastNotesLen = -1;
  var lastFpDx = '';

  // Scheduling: bounded staggered runs after load + re-run on your clicks.
  // (Permanent interval removed in the reorganization — no-timers rule.)
  [400, 1000, 2000, 3500, 5500, 8000].forEach(function (ms) { setTimeout(tick, ms); });
  var pccSchedLast = 0;
  document.addEventListener('click', function (e) {
      if (!e.isTrusted) return;
      var now = Date.now();
      if (now - pccSchedLast < 800) return;
      pccSchedLast = now;
      setTimeout(tick, 350);
  }, true);
})();
;
// ----- module: PCC-All-Relationships-copy-box.user.js -----
(function () {
  // [pattern, singular, plural]. Most specific FIRST ("daughter-in-law" before "daughter").
  var RELS = [
    [/\bex[\s-]*wife\b/,               'ex-wife',          'ex-wives'],
    [/\bex[\s-]*husband\b/,            'ex-husband',       'ex-husbands'],
    [/\bmother[\s-]*in[\s-]*law\b/,    'mother-in-law',    'mothers-in-law'],
    [/\bfather[\s-]*in[\s-]*law\b/,    'father-in-law',    'fathers-in-law'],
    [/\bdaughter[\s-]*in[\s-]*law\b|\bdaughterinlaw\b/, 'daughter-in-law', 'daughters-in-law'],
    [/\bson[\s-]*in[\s-]*law\b|\bsoninlaw\b/,           'son-in-law',      'sons-in-law'],
    [/\bsister[\s-]*in[\s-]*law\b/,    'sister-in-law',    'sisters-in-law'],
    [/\bbrother[\s-]*in[\s-]*law\b/,   'brother-in-law',   'brothers-in-law'],
    [/\bin[\s-]*laws?\b/,              'in-law',           'in-laws'],
    [/\bstep[\s-]*sons?\b/,            'stepson',          'stepsons'],
    [/\bstep[\s-]*daughters?\b/,       'stepdaughter',     'stepdaughters'],
    [/\bstep[\s-]*mother\b|\bstepmom\b/, 'stepmother',     'stepmothers'],
    [/\bstep[\s-]*father\b|\bstepdad\b/, 'stepfather',     'stepfathers'],
    [/\bgrand[\s-]*sons?\b/,           'grandson',         'grandsons'],
    [/\bgrand[\s-]*daughters?\b/,      'granddaughter',    'granddaughters'],
    [/\bgrand[\s-]*(child|children|kids?)\b/, 'grandchild', 'grandchildren'],
    [/\bgrand[\s-]*(mother|ma|mom)\b/, 'grandmother',      'grandmothers'],
    [/\bgrand[\s-]*(father|pa|dad)\b/, 'grandfather',      'grandfathers'],
    [/\bgrand[\s-]*parents?\b/,        'grandparent',      'grandparents'],
    [/\bcase[\s-]*workers?\b/,         'case worker',      'case workers'],
    [/\bcase[\s-]*managers?\b|\bcare[\s-]*managers?\b/, 'case manager', 'case managers'],
    [/\bsocial[\s-]*workers?\b/,       'social worker',    'social workers'],
    [/\bpower of attorney\b|\bpoa\b/,  'POA',              'POAs'],
    [/\bhealth[\s-]*care[\s-]*proxy\b|\bhcp\b/, 'health care proxy', 'health care proxies'],
    [/\bguardian\b/,                   'guardian',         'guardians'],
    [/\bconservator\b/,                'conservator',      'conservators'],
    [/\blawyers?\b|\battorneys?\b|\besq\b/, 'lawyer',      'lawyers'],
    [/\bco[\s-]*workers?\b|\bcolleagues?\b/, 'coworker',   'coworkers'],
    [/\bboy[\s-]*friends?\b/,          'boyfriend',        'boyfriends'],
    [/\bgirl[\s-]*friends?\b/,         'girlfriend',       'girlfriends'],
    [/\bwife\b/,                       'wife',             'wives'],
    [/\bhusband\b/,                    'husband',          'husbands'],
    [/\bspouse\b/,                     'spouse',           'spouses'],
    [/\bfianc[eé]e?\b/,                'fiancé',           'fiancés'],
    [/\bdaughters?\b/,                 'daughter',         'daughters'],
    [/\bsons?\b/,                      'son',              'sons'],
    [/\bmother\b|\bmom\b/,             'mother',           'mothers'],
    [/\bfather\b|\bdad\b/,             'father',           'fathers'],
    [/\bsisters?\b/,                   'sister',           'sisters'],
    [/\bbrothers?\b/,                  'brother',          'brothers'],
    [/\bsiblings?\b/,                  'sibling',          'siblings'],
    [/\bpartner\b/,                    'partner',          'partners'],
    [/\bfriends?\b/,                   'friend',           'friends'],
    [/\bneighbou?rs?\b/,               'neighbor',         'neighbors'],
    [/\broommates?\b/,                 'roommate',         'roommates'],
    [/\bnieces?\b/,                    'niece',            'nieces'],
    [/\bnephews?\b/,                   'nephew',           'nephews'],
    [/\bcousins?\b/,                   'cousin',           'cousins'],
    [/\baunt\b/,                       'aunt',             'aunts'],
    [/\buncle\b/,                      'uncle',            'uncles'],
    [/\bclergy\b|\bpastor\b|\bpriest\b|\bminister\b|\bimam\b|\brabbi\b/, 'clergy', 'clergy'],
    [/\bnurse\b/,                      'nurse',            'nurses'],
    [/\bothers?\b/,                    'other',            'others'],
    [/\bself\b/,                       'self',             'self']
  ];
  RELS.forEach(function (r) { r[0] = new RegExp(r[0].source, 'i'); });

  var NO_COUNT = { self: true };                                  // self is only ever shown once
  var NAME_SKIP = { other: 1, nurse: 1, clergy: 1, self: 1 };     // too ambiguous to guess from a name

  function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function cellText(c) { return clean(c.innerText || c.textContent); }

  function tidy(t) { return /^[A-Z]{2,4}$/.test(t) ? t : t.toLowerCase(); }

  function canon(text) {
    for (var k = 0; k < RELS.length; k++) {
      if (RELS[k][0].test(text)) return { c: RELS[k][1], p: RELS[k][2], k: k };
    }
    return null;
  }

  // One relationship per contact row. Priority:
  // 1) a recognized relationship in parentheses in the Name column, e.g. "Gail Troche (sister) (4446481)" -> sister
  // 2) the Relation column
  // 3) any other (LABEL) in the Name column
  // 4) a relationship word inside the Name
  function labelFor(relText, nameText) {
    var re = /\(([^()]*[A-Za-z][^()]*)\)/g, m, unknown = null;
    while ((m = re.exec(nameText))) {
      var t = clean(m[1]);
      if (!t) continue;
      var c = canon(t);
      if (c) return c;
      if (!unknown) unknown = { c: tidy(t), p: null };
    }

    var r = clean(relText);
    if (r && !/^(n\/?a|none|-+)$/i.test(r)) return canon(r) || { c: tidy(r), p: null };

    if (unknown) return unknown;

    for (var k = 0; k < RELS.length; k++) {
      if (!NAME_SKIP[RELS[k][1]] && RELS[k][0].test(nameText)) return { c: RELS[k][1], p: RELS[k][2] };
    }
    return null;
  }

  function contactsTable() {
    var tables = document.querySelectorAll('table');
    var i;
    for (i = 0; i < tables.length; i++) {
      var hit = Array.from(tables[i].rows).some(function (r) {
        var t = Array.from(r.cells).map(cellText);
        return t.some(function (x) { return /^name\b/i.test(x); }) && t.some(function (x) { return /^contact type\b/i.test(x); });
      });
      if (hit) return tables[i];
    }
    // No loose fallback (his rule, 2026-10-13): the box belongs on the Profile
    // page only. A table whose TEXT merely mentions "Contact Type" (e.g. the
    // Progress Notes grid, where note bodies contain those words) must NOT
    // match — only a real contacts table with a Name + Contact Type header row.
    return null;
  }

  function extract(table) {
    var rows = Array.from(table.rows);
    var hdr = -1, nameCol = -1, relCol = -1;
    for (var i = 0; i < rows.length; i++) {
      var cells = Array.from(rows[i].cells).map(cellText);
      var n = cells.findIndex(function (x) { return /^name\b/i.test(x); });
      if (n > -1 && cells.some(function (x) { return /^contact type\b/i.test(x); })) {
        hdr = i; nameCol = n;
        relCol = cells.findIndex(function (x) { return /^relation(ship)?\b/i.test(x); });
        break;
      }
    }

    var counts = {}, order = [], plural = {};
    function add(lab) {
      if (!lab) return;
      if (!(lab.c in counts)) { counts[lab.c] = 0; order.push(lab.c); plural[lab.c] = lab.p; }
      counts[lab.c]++;
    }

    if (hdr === -1) return '';   // no real contacts header row -> not the Profile contacts table; stay silent

    for (var j = hdr + 1; j < rows.length; j++) {
      var tds = rows[j].cells;
      if (tds.length <= nameCol) continue;
      add(labelFor(relCol > -1 && tds[relCol] ? cellText(tds[relCol]) : '', cellText(tds[nameCol])));
    }

    return order.map(function (c) {
      if (NO_COUNT[c]) return c;
      var n = counts[c];
      if (n < 2) return c;
      return plural[c] ? n + ' ' + plural[c] : c + ' (' + n + ')';
    }).join(', ');
  }

  function copyText(text, btn) {
    function done(msg) { btn.textContent = msg; setTimeout(function () { btn.textContent = 'Copy'; }, 1200); }
    function fallback() {
      var ok = false;
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      done(ok ? 'Copied!' : 'Copy failed');
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(text).then(function () { done('Copied!'); }, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }

  function ensureBox(table) {
    var box = document.getElementById('relBox');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'relBox';
    box.style.cssText = 'display:none;margin:8px 0;padding:10px 12px;border:1px solid #93c5fd;background:#eff6ff;border-radius:8px;font:13px/1.4 -apple-system,sans-serif;max-width:460px;';
    // Hidden since the tile row carries this value (his cleanup ask,
    // 2026-10-14). The box + Copy button stay in the DOM: the tile
    // reads the button's fill value across frames, and the note
    // engine's queue contract is unchanged.
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
        '<b style="color:#1d4ed8;">Relationships</b>' +
        '<button type="button" id="relCopyBtn" class="pcc-fill-copy" data-fill-label="Relationships" style="cursor:pointer;border:1px solid #1d4ed8;background:#1d4ed8;color:#fff;border-radius:5px;padding:2px 10px;font:12px sans-serif;">Copy</button>' +
      '</div>' +
      '<div id="relOut" style="color:#111;white-space:pre-wrap;"></div>';
    table.parentNode.insertBefore(box, table);
    return box;
  }

  function run() {
    var table = contactsTable();
    if (!table) return;
    var out = extract(table) || 'N/A';
    var box = ensureBox(table);
    box.querySelector('#relOut').textContent = out;
    var btn = box.querySelector('#relCopyBtn');
    btn.setAttribute('data-fill-value', out);   // for the G sweep (skips 'N/A')
    btn.onclick = function (e) {
      e.preventDefault(); e.stopPropagation();
      copyText(out, btn);
      // Also drop a fill request so the note panel can replace
      // "Primary contact xx" with the relationships.
      try {
        localStorage.setItem('pccFillRelationships', JSON.stringify({ value: out, ts: Date.now() }));
      } catch(err){}
    };
  }

  // Scheduling: bounded staggered runs after load + re-run on your clicks.
  // (Permanent interval removed in the reorganization — no-timers rule.)
  [400, 1000, 2000, 3500, 5500, 8000].forEach(function (ms) { setTimeout(run, ms); });
  var pccSchedLast = 0;
  document.addEventListener('click', function (e) {
      if (!e.isTrusted) return;
      var now = Date.now();
      if (now - pccSchedLast < 800) return;
      pccSchedLast = now;
      setTimeout(run, 350);
  }, true);
})();
;
// ----- module: PCC-All-Vitals-expanded.user.js -----
(function(){
  var done = false;   // one shot per page load — manual switches are respected

  function ctxText(el){
    var t = '', p = el.parentElement, up = 0;
    while (p && up < 4){ t += ' ' + (p.textContent || ''); p = p.parentElement; up++; }
    return t;
  }

  function isSelected(el){
    var c = (el.getAttribute('class') || '');
    if (/select|active|current|pressed/i.test(c)) return true;
    if (el.getAttribute('aria-pressed') === 'true') return true;
    if (el.getAttribute('aria-selected') === 'true') return true;
    if (el.disabled) return true;
    // in PCC the active option is usually plain text; inactive ones are links
    if (el.tagName !== 'A' && el.tagName !== 'BUTTON' && !el.onclick && el.getAttribute('onclick') == null) return true;
    return false;
  }

  function findCompact(){
    // Flipped 2026-10-14 (his call): the tile row pulls everything he
    // needs out of Compact view, so this script now opens COMPACT.
    // (It used to open Expanded — that is what had moved his setting
    // from Standard to Expanded.) Same finder shape, new target:
    // the toggle option whose text is 'compact', in the group that
    // also offers Expanded + Standard.
    var lists = [document.querySelectorAll('a,button'), document.querySelectorAll('span,td,div,label')];
    for (var l = 0; l < lists.length; l++){
      var els = lists[l];
      for (var i = 0; i < els.length; i++){
        var el = els[i];
        if ((el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() !== 'compact') continue;
        var ctx = ctxText(el);                                  // must be the view toggle
        if (/expanded/i.test(ctx) && /standard/i.test(ctx)) return el;
      }
    }
    return null;
  }

  function run(){
    if (done) return;
    var el = findCompact();
    if (!el) return;
    if (isSelected(el)){ done = true; return; }                 // already Compact — leave it
    var last = +(sessionStorage.getItem('pccCompactView') || 0);
    if (Date.now() - last < 6000){ done = true; return; }       // just clicked — don't loop
    sessionStorage.setItem('pccCompactView', Date.now());
    el.click();
    done = true;
  }

  // ---- F = Weight's 'view all' (his ask, 2026-10-15) ----
  // On the Weight & Vitals page, F opens the Weight history.
  // The view-all controls are MUI buttons (data-testid
  // vtl_Vitals_viewAll_N); Weight's row is found by its Vital
  // Sign cell, with the _1 testid as fallback. Same key rules
  // as the facility Keys: real presses only, never while
  // typing, no repeat on hold, 0 toggles it off.
  var fEnabled = true;
  function weightViewAllBtn() {
    var btns = document.querySelectorAll('button[data-testid^="vtl_Vitals_viewAll_"]');
    for (var i = 0; i < btns.length; i++) {
      var row = btns[i].closest ? btns[i].closest('[role="row"], tr') : null;
      if (!row) continue;
      var cells = row.querySelectorAll('[role="cell"], td');
      for (var j = 0; j < cells.length; j++) {
        if ((cells[j].textContent || '').replace(/\s+/g, ' ').trim() === 'Weight') return btns[i];
      }
    }
    return document.querySelector('button[data-testid="vtl_Vitals_viewAll_1"]');
  }
  function plantFBadge() {
    // Fixed overlay on <body> (v1.5): the vitals table is a
    // React app that re-renders its rows; badges planted
    // inside the row got clipped (v1.3) or wiped (v1.4). The
    // overlay tracks the Weight button's position instead.
    var btn = weightViewAllBtn();
    var badge = document.getElementById('tmWtsFBadge');
    if (!btn) { if (badge) badge.style.display = 'none'; return; }
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'tmWtsFBadge';
      badge.textContent = 'F';
      badge.title = 'Shortcut: press F for Weight view all';
      badge.setAttribute('style',
        'position:fixed;z-index:999999;' +
        'display:flex;align-items:center;justify-content:center;' +
        'width:20px;height:20px;border-radius:999px;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
        'font-size:11px;font-weight:700;color:#fff;' +
        'background:linear-gradient(135deg,#ef4444,#dc2626);' +
        'box-shadow:0 2px 8px rgba(220,38,38,.35),0 1px 2px rgba(0,0,0,.1);' +
        'pointer-events:none;user-select:none;');
      (document.body || document.documentElement).appendChild(badge);
    }
    var r = btn.getClientRects()[0];
    if (!r) { badge.style.display = 'none'; return; }
    badge.style.display = 'flex';
    badge.style.left = (r.right + 4) + 'px';
    badge.style.top = (r.top + Math.max(0, (r.height - 20) / 2)) + 'px';
  }
  var wtsScrollLast = 0;
  function wtsOnScroll() { var n = Date.now(); if (n - wtsScrollLast < 250) return; wtsScrollLast = n; plantFBadge(); }
  window.addEventListener('scroll', wtsOnScroll, true);
  window.addEventListener('resize', wtsOnScroll);
  function fireClick(el) {
    var w = el.ownerDocument.defaultView;
    ['mousedown', 'mouseup', 'click'].forEach(function (type) {
      el.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true, view: w }));
    });
  }
  document.addEventListener('keydown', function (e) {
    if (!e.isTrusted) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.repeat) return;
    var tg = e.target, tag = tg && tg.tagName ? tg.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (tg && tg.isContentEditable) return;
    var k = (e.key || '').toUpperCase();
    if (k === '0') { fEnabled = !fEnabled; return; }
    if (!fEnabled || k !== 'F') return;
    var btn = weightViewAllBtn();
    if (!btn) return;
    e.preventDefault();
    fireClick(btn);
  }, true);

  // Scheduling: bounded staggered runs after load + re-run on your clicks.
  // (Permanent interval removed in the reorganization — no-timers rule.)
  [400, 1000, 2000, 3500, 5500, 8000].forEach(function (ms) { setTimeout(function () { run(); plantFBadge(); }, ms); });
  var pccSchedLast = 0;
  document.addEventListener('click', function (e) {
      if (!e.isTrusted) return;
      var now = Date.now();
      if (now - pccSchedLast < 800) return;
      pccSchedLast = now;
      setTimeout(function () { run(); plantFBadge(); }, 350);
  }, true);
})();
;
// ----- module: PCC-All-Psych-orders.user.js -----
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Keyword lists (lowercase; matched as substrings of a row's text)
  // ---------------------------------------------------------------------------
  const CONSULT = [
    'psych consult','psychiatry consult','psychiatric consult',
    'psych consultation','psychiatry consultation','psychiatric consultation',
    'psych eval','psychiatry eval','psychiatric eval'
  ];

  const PSYCH_MEDS = [
    // Antipsychotics
    'olanzapine','quetiapine','seroquel','risperidone','risperdal','aripiprazole',
    'abilify','haloperidol','haldol','ziprasidone','geodon','paliperidone','invega',
    'clozapine','lurasidone','latuda','asenapine','chlorpromazine','fluphenazine',
    'perphenazine','thioridazine','loxapine','brexpiprazole','rexulti','cariprazine',
    'vraylar','pimavanserin','nuplazid',
    // Antidepressants (incl. doxepin)
    'sertraline','zoloft','fluoxetine','prozac','citalopram','celexa','escitalopram',
    'lexapro','paroxetine','paxil','venlafaxine','effexor','desvenlafaxine','pristiq',
    'duloxetine','cymbalta','bupropion','wellbutrin','mirtazapine','remeron','trazodone',
    'amitriptyline','nortriptyline','doxepin','imipramine','desipramine','vilazodone',
    'vortioxetine','fluvoxamine',
    // Mood stabilizers
    'lithium','valproate','valproic','divalproex','depakote','lamotrigine','lamictal',
    'carbamazepine','tegretol','oxcarbazepine',
    // Anxiolytics / benzodiazepines
    'lorazepam','ativan','alprazolam','xanax','clonazepam','klonopin','diazepam','valium',
    'buspirone','buspar','hydroxyzine','vistaril','atarax','chlordiazepoxide','temazepam','oxazepam',
    // Dementia
    'memantine','namenda','donepezil','aricept','rivastigmine','exelon','galantamine','razadyne',
    // Sleep
    'melatonin','zolpidem','ambien','eszopiclone','lunesta','zaleplon','sonata','ramelteon',
    'rozerem','suvorexant','belsomra','lemborexant','dayvigo',
    // ADHD
    'methylphenidate','ritalin','concerta','amphetamine','dextroamphetamine','lisdexamfetamine',
    'vyvanse','adderall','atomoxetine','strattera','guanfacine','intuniv','clonidine','kapvay',
    'modafinil','armodafinil',
    // Addiction
    'buprenorphine','suboxone','naltrexone','vivitrol','naloxone','methadone','acamprosate',
    'campral','disulfiram','antabuse','nicotine','varenicline','chantix',
    // EPS meds
    'benztropine','cogentin','trihexyphenidyl','artane','diphenhydramine','amantadine',
    'propranolol','valbenazine','ingrezza','deutetrabenazine','austedo','tetrabenazine','biperiden'
  ];

  const has = (t, list) => list.some(k => t.includes(k));
  const groupOf = text => {
    const t = (text || '').toLowerCase();
    if (has(t, CONSULT)) return 0;      // psych/psychiatry consult -> very top
    if (has(t, PSYCH_MEDS)) return 1;   // psych meds -> next
    return 2;                           // everything else, unchanged
  };

  // ---------------------------------------------------------------------------
  // Reorder the order table(s): consult, then psych meds, then the rest.
  // ---------------------------------------------------------------------------
  function reorderTable(tbody) {
    const rows = Array.from(tbody.children)
      .filter(r => r.tagName === 'TR' && !r.querySelector('th'));
    if (rows.length < 2) return;
    const dec = rows.map((row, i) => ({ row, i, g: groupOf(row.textContent) }));
    const sorted = [...dec].sort((a, b) => a.g - b.g || a.i - b.i);
    if (sorted.every((d, idx) => d === dec[idx])) return;
    sorted.forEach(d => tbody.appendChild(d.row));
  }

  function reorderOrderTables() {
    document.querySelectorAll('table').forEach(table => {
      const head = (table.tHead ? table.tHead.textContent : '').toLowerCase();
      const first = table.querySelector('tr');
      const looksLikeOrders = head.includes('order') ||
        (first && first.textContent.toLowerCase().includes('order'));
      if (looksLikeOrders) table.querySelectorAll('tbody').forEach(reorderTable);
    });
  }

  // ---------------------------------------------------------------------------
  // Am I on the Orders screen?
  // ---------------------------------------------------------------------------
  function onOrdersScreen() {
    const txt = document.body.innerText || '';
    return /Order Listing/i.test(txt) && /Display Filters/i.test(txt);
  }

  // ---------------------------------------------------------------------------
  // Toggle:
  //   OFF = all categories, active only (consult + psych meds float to top)
  //   ON  = pharmacy only, active + completed + discontinued (psych meds on top)
  // ---------------------------------------------------------------------------
  const MODE = 'pccPsychMode';

  function findFilterForm() {
    const anchor =
      document.querySelector('input[name="status_active"]') ||
      document.querySelector('input[name="status_discontinued"]');
    return anchor ? anchor.form : null;
  }

  function findDisplayFiltersToggle() {
    for (const el of document.querySelectorAll('a, span, div, td, th, button')) {
      if (el.childElementCount > 2) continue;
      const t = (el.textContent || '').trim().toLowerCase();
      if (t === 'display filters' || t === '+ display filters' || t === '- display filters') return el;
    }
    return null;
  }

  function ensureFilterForm(cb) {
    let form = findFilterForm();
    if (form) return cb(form);
    const expander = findDisplayFiltersToggle();
    if (!expander) return cb(null);
    expander.click();
    let tries = 0;
    const iv = setInterval(() => {
      form = findFilterForm();
      if (form || ++tries > 25) { clearInterval(iv); cb(form); }
    }, 100);
  }

  function setChk(form, name, on) {
    const el = form.elements[name];
    if (el && 'checked' in el) el.checked = on;
  }
  function setVal(form, name, val) {
    const el = form.elements[name];
    if (el && 'value' in el) el.value = val;
  }

  // Set every category_* checkbox on/off.
  function setAllCategories(form, on) {
    Array.from(form.elements).forEach(el => {
      if (el.type === 'checkbox' && /^category_/i.test(el.name || '')) el.checked = on;
    });
  }
  // Pharmacy only: uncheck all categories, then check pharmacy.
  function pharmacyOnly(form) {
    setAllCategories(form, false);
    setChk(form, 'category_pharmacy', true);
  }

  function submitFilter(mode) {
    ensureFilterForm(form => {
      if (!form) { toast("Couldn't open PCC's order filter — expand Display Filters once, then use the toggle."); return; }
      if (mode === 'on') {
        pharmacyOnly(form);                    // meds only
        setChk(form, 'status_active', true);
        setChk(form, 'status_completed', true);
        setChk(form, 'status_discontinued', true);
      } else {
        setAllCategories(form, true);          // all categories
        setChk(form, 'status_active', true);
        setChk(form, 'status_completed', false);
        setChk(form, 'status_discontinued', false);
      }
      setVal(form, 'filter', 'true');
      setVal(form, 'ESOLfilterRefresh', 'Y');
      setVal(form, 'page', '1');
      setVal(form, 'isChangingPage', 'false');
      localStorage.setItem(MODE, mode);
      form.submit();
    });
  }

  // ---------------------------------------------------------------------------
  // Single-line draggable toggle (bottom-right by default)
  // ---------------------------------------------------------------------------
  const OFF_LABEL = 'All active orders — psych + consult on top';
  const ON_LABEL  = 'All meds — active, completed & discontinued';

  function paint(wrap, on) {
    wrap.querySelector('.pcc-label').textContent = on ? ON_LABEL : OFF_LABEL;
    wrap.querySelector('.pcc-track').style.background = on ? '#2e7d32' : '#bbb';
    wrap.querySelector('.pcc-knob').style.left = on ? '22px' : '2px';
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText =
      'position:fixed;bottom:70px;right:16px;z-index:2147483647;background:#b00020;color:#fff;' +
      'padding:10px 14px;border-radius:8px;font:13px sans-serif;max-width:340px;box-shadow:0 2px 8px rgba(0,0,0,.3);';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 6000);
  }

  function mountToggle() {
    if (document.getElementById('pcc-psych-toggle')) return;

    const wrap = document.createElement('div');
    wrap.id = 'pcc-psych-toggle';
    wrap.style.cssText =
      'position:fixed;z-index:2147483647;display:flex;align-items:center;gap:8px;' +
      'background:#fff;border:1px solid #999;border-radius:20px;padding:6px 12px 6px 8px;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.25);font:13px/1.2 sans-serif;color:#222;' +
      'user-select:none;white-space:nowrap;';

    let placed = false;
    try {
      const saved = JSON.parse(localStorage.getItem('pccPsychTogglePos') || 'null');
      if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
        const L = Math.min(Math.max(saved.left, 0), Math.max(window.innerWidth - 60, 0));
        const T = Math.min(Math.max(saved.top, 0), Math.max(window.innerHeight - 30, 0));
        wrap.style.left = L + 'px'; wrap.style.top = T + 'px';
        placed = true;
      }
    } catch (e) {}
    if (!placed) { wrap.style.right = '16px'; wrap.style.bottom = '16px'; }

    wrap.innerHTML =
      '<span class="pcc-handle" title="Drag to move" style="cursor:move;font-size:14px;color:#888;padding:0 2px;">⠿</span>' +
      '<span class="pcc-switch" title="Toggle" style="position:relative;width:40px;height:20px;flex:0 0 auto;cursor:pointer;">' +
        '<span class="pcc-track" style="position:absolute;inset:0;border-radius:20px;background:#bbb;transition:background .15s;"></span>' +
        '<span class="pcc-knob"  style="position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.4);transition:left .15s;"></span>' +
      '</span>' +
      '<span class="pcc-label" style="cursor:pointer;"></span>';

    document.body.appendChild(wrap);

    const isOn = () => localStorage.getItem(MODE) === 'on';
    paint(wrap, isOn());

    const flip = () => { const next = !isOn(); paint(wrap, next); submitFilter(next ? 'on' : 'off'); };
    wrap.querySelector('.pcc-switch').addEventListener('click', flip);
    wrap.querySelector('.pcc-label').addEventListener('click', flip);

    const handle = wrap.querySelector('.pcc-handle');
    let sx, sy, ox, oy, dragging = false;
    handle.addEventListener('mousedown', e => {
      dragging = true;
      const r = wrap.getBoundingClientRect();
      ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
      wrap.style.left = ox + 'px'; wrap.style.top = oy + 'px';
      wrap.style.right = 'auto'; wrap.style.bottom = 'auto';
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      wrap.style.left = (ox + e.clientX - sx) + 'px';
      wrap.style.top  = (oy + e.clientY - sy) + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      const r = wrap.getBoundingClientRect();
      localStorage.setItem('pccPsychTogglePos', JSON.stringify({ left: r.left, top: r.top }));
    });
  }

  function removeToggle() {
    const t = document.getElementById('pcc-psych-toggle');
    if (t) t.remove();
  }

  // ---------------------------------------------------------------------------
  // Run only on the Orders screen.
  // ---------------------------------------------------------------------------
  function run() {
    if (!onOrdersScreen()) { removeToggle(); return; }
    reorderOrderTables();
    mountToggle();
  }

  run();
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; run(); }, 300);
  }).observe(document.body, { childList: true, subtree: true });
})();
;
// ----- module: PCC-All-S-copy-name-room.user.js -----
(function () {
  'use strict';

  function toast(msg) {
    try {
      var t = document.createElement('div');
      t.textContent = msg;
      t.setAttribute('style', 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);' +
        'z-index:999999;padding:6px 14px;font:700 13px system-ui,sans-serif;color:#fff;' +
        'background:#222;border-radius:6px;opacity:.95;pointer-events:none;');
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 1400);
    } catch (e) {}
  }

  // Yellow "S" confirmation badge + what was copied. Fades out on its own.
  function flashCopied(name, room) {
    try {
      var d = document.createElement('div');
      d.setAttribute('style', 'position:fixed;right:16px;bottom:16px;z-index:999999;' +
        'display:flex;align-items:center;gap:12px;padding:12px 20px;background:#222;' +
        'border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.45);' +
        'font:700 20px system-ui,sans-serif;color:#fff;pointer-events:none;transition:opacity .4s;');
      var s = document.createElement('span');
      s.textContent = 'S';
      s.setAttribute('style', 'display:inline-block;padding:4px 14px;font-size:22px;font-weight:900;' +
        'color:#000;background:#ffea00;border:2px solid #7a6400;border-radius:5px;');
      var t = document.createElement('span');
      t.textContent = name + '  ' + room;
      d.appendChild(s); d.appendChild(t);
      (document.body || document.documentElement).appendChild(d);
      setTimeout(function () {
        try { d.style.opacity = '0'; } catch (e) {}
        setTimeout(function () { try { d.parentNode.removeChild(d); } catch (e2) {} }, 450);
      }, 1700);
    } catch (e) {}
  }

  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text); return; }
    } catch (e) {}
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e2) {}
  }

  // True when the header facility picker shows Crown Heights (scoped to the
  // top of the page so a mention deep in the chart can't false-positive).
  function isCrownHeights(doc) {
    try {
      var els = doc.querySelectorAll('select, button, a, span, div, td');
      for (var i = 0; i < els.length; i++) {
        var t = (els[i].textContent || '').trim();
        if (t.length > 90 || t.length < 6) continue;
        if (!/crown\s*heights/i.test(t)) continue;
        var r = null;
        try { r = els[i].getBoundingClientRect(); } catch (e) {}
        if (r && r.top >= -50 && r.top < 300) return true;
      }
    } catch (e) {}
    return false;
  }

  function residentLastFirst(doc) {
    // Primary: the resident-name element itself — its own text STARTS
    // with the name. (The old body-wide regex swallowed a preceding
    // page word: on the assessment list the text runs '... Clinical
    // Brown, William (CH187985) ...', so S copied 'Clinical Brown,
    // William'. His report, 2026-10-14.)
    try {
      var els = doc.querySelectorAll('span, div, h1, h2, h3, td, a, b, strong');
      for (var i = 0; i < els.length; i++) {
        var tx = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (tx.length > 70 || tx.length < 5) continue;
        if (/^clinical\s/i.test(tx)) continue; // page chrome, never a name
        var em = tx.match(/^([A-Za-z][A-Za-z'’.\-]+(?:\s+[A-Za-z][A-Za-z'’.\-]+)?\s*,\s*[A-Za-z][A-Za-z'’.\- ]+?)\s*\(\s*[A-Za-z]{0,5}\d{3,}\s*\)/);
        if (em) return em[1].trim();
      }
    } catch (e) {}
    // Fallback: body-wide, but SHORTEST last name first (1 word, then
    // 2, then 3) so a chain of page words before the name can't get
    // swallowed into it.
    try {
      var txt = doc.body ? (doc.body.textContent || '') : '';
      var W = "[A-Za-z][A-Za-z'’.\\-]+";
      var FIRST = "[A-Za-z][A-Za-z'’.\\- ]*?";
      for (var words = 1; words <= 3; words++) {
        var pat = '(' + W + '(?:\\s+' + W + ')' + '{' + (words - 1) + '}' +
          '\\s*,\\s*' + FIRST + ')\\s*\\(\\s*[A-Za-z]{0,5}\\d{3,}\\s*\\)';
        var m = txt.match(new RegExp(pat));
        if (m) return m[1].replace(/\s+/g, ' ').trim();
      }
    } catch (e) {}
    return '';
  }

  // "6 West 612-B" -> "612B" (or "W612B" at Crown Heights).
  // "2 East 237-B" -> "237B" (no wing prefix except Crown Heights).
  function roomBedNumber(doc, withWing) {
    try {
      var txt = (doc.body && doc.body.textContent) ? doc.body.textContent : '';
      // Try the Location label first, then fall back to searching near "Location"
      var v = '';
      var m = txt.match(/\bLocation\s*:?\s*([^\n]*?)(?=\s*(?:Status|Code Status|Physician|DOB|Admission|Initial Admission|Discharge|Allergies|Special Instructions)\b|\n|$)/);
      if (m) v = m[1].replace(/\s+/g, ' ').trim();
      // Fallback: find "Location" then grab the next 30 chars
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

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.repeat) return;
    var tg = e.target, tag = tg && tg.tagName ? tg.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (tg && tg.isContentEditable) return;
    if ((e.key || '').toUpperCase() !== 'S') return;
    var doc = document;
    var name = residentLastFirst(doc);
    if (!name) { toast('No resident name found'); return; }
    var room = roomBedNumber(doc, isCrownHeights(doc));
    if (!room) { toast('No room found for ' + name); return; }
    copyText(name + '\t' + room);
    flashCopied(name, room);
    e.preventDefault();
  }, true);
})();
;
// ----- module: PCC-All-Header-copy-table.user.js -----
(function () {
  'use strict';
  function removeCard() {
    var card = document.getElementById('copyInfoTable');
    if (card && card.parentNode) card.parentNode.removeChild(card);
    var st = document.getElementById('pccHdrCardStyle');
    if (st && st.parentNode) st.parentNode.removeChild(st);
  }
  removeCard();
  [600, 1800, 4000].forEach(function (ms) { setTimeout(removeCard, ms); });
})();
;
// ----- module: PCC-All-Grab-all.user.js -----
(function () {
  'use strict';

  // Grab all (built 2026-10-13, reviving the Oct 5 G key at Adrian's direction).
  // Press G on any chart page: every Copy button ON THAT PAGE queues its value
  // for the Copy-to-note engine — exactly what is on the screen, nothing more.
  // A header page queues Age/Sex + Allergies; the Dashboard adds Psych meds;
  // Progress Notes adds Diagnoses; the Profile adds Relationships; the Forms
  // list adds the BIMS score showing there. Rules: dead while typing, no
  // repeat on hold, Allergies are skipped when they read NKA, empty ("N/A")
  // values are skipped, and a small badge names what got queued.

  var ORDER = ['Age/Sex', 'Allergies', 'Psych meds', 'Diagnoses', 'BIMS', 'Relationships'];

  function isTyping() {
    var a = document.activeElement;
    if (!a) return false;
    var t = (a.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || t === 'select' || !!a.isContentEditable;
  }

  function fireClick(el) {
    ['mousedown', 'mouseup', 'click'].forEach(function (type) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });
  }

  function showBadge(labels) {
    var old = document.getElementById('pccGrabBadge');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var b = document.createElement('div');
    b.id = 'pccGrabBadge';
    b.textContent = 'Queued: ' + labels.join(' · ');
    b.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;pointer-events:none;' +
      'background:#1e3a5f;color:#fff;font:600 15px -apple-system,Helvetica,Arial,sans-serif;' +
      'padding:10px 16px;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.35);opacity:1;transition:opacity .4s;';
    document.body.appendChild(b);
    setTimeout(function () { b.style.opacity = '0'; }, 2000);
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 2450);
  }

  // A Copy target counts as shown when it has a box of
  // its own OR any visible descendant does. Core's tiles
  // are display:contents hosts (no box of their own), and
  // the old own-rects-only check skipped every tile on
  // the page - G queued nothing but the classic buttons
  // (his report, 2026-10-19: G sends diagnoses only).
  function isShown(el) {
    if (el.getClientRects().length) return true;
    var kids = el.querySelectorAll ? el.querySelectorAll('*') : [];
    for (var i = 0; i < kids.length; i++) if (kids[i].getClientRects().length) return true;
    return false;
  }

  function grabAll() {    var btns = document.querySelectorAll('.pcc-fill-copy');
    var queued = [];
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (!isShown(b)) continue;                       // not on screen
      var label = b.getAttribute('data-fill-label') || '';
      var value = b.getAttribute('data-fill-value');
      if (value === 'N/A') continue;                                  // nothing real to queue
      if (label === 'Allergies' && value && /^NKA\b/i.test(value)) continue;  // NKA stays unqueued
      fireClick(b);
      if (label && queued.indexOf(label) === -1) queued.push(label);
    }
    if (!queued.length) return;
    queued.sort(function (x, y) { return ORDER.indexOf(x) - ORDER.indexOf(y); });
    showBadge(queued);
  }

  // A small keyboard-key "G" badge sits next to every Copy button (his
  // request, 2026-10-13) — a reminder that G grabs it, and clicking the
  // badge is the same as pressing G.
  function addBadges() {
    var btns = document.querySelectorAll('.pcc-fill-copy');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b.getAttribute('data-g-badge')) continue;
      if (!isShown(b)) continue;                 // not on screen yet
      if (b.getAttribute('data-fill-value') === 'N/A') continue;
      b.setAttribute('data-g-badge', '1');
      var g = document.createElement('span');
      g.className = 'pcc-g-badge';
      g.textContent = 'G';
      g.title = 'Press G to grab everything on this page';
      g.style.cssText = 'display:inline-block;vertical-align:middle;margin-left:6px;padding:1px 7px;' +
        'background:#fff;border:2px solid #1d4ed8;border-radius:6px;color:#1d4ed8;' +
        'font:bold 13px -apple-system,Helvetica,Arial,sans-serif;cursor:pointer;user-select:none;';
      g.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        requestGrab();
      });
      if (b.parentNode) b.parentNode.insertBefore(g, b.nextSibling);
    }
  }

  // PCC pages are several frames in one tab (header frame, content frame),
  // and a keypress reaches only the focused one. So a grab is broadcast:
  // the frame that got the key writes a signal, and every VISIBLE frame in
  // the tab clicks its own Copy buttons. (His live report, 2026-10-13: on
  // the Dashboard only the header frame heard G, so meds never queued.)
  var lastSignal = 0;
  function requestGrab() {
    var ts = Date.now();
    lastSignal = ts;
    grabAll();
    try { localStorage.setItem('pccGrabSignal', String(ts)); } catch (e) {}
  }
  window.addEventListener('storage', function (e) {
    if (e.key !== 'pccGrabSignal' || !e.newValue) return;
    var ts = parseInt(e.newValue, 10);
    if (!ts || ts <= lastSignal || Date.now() - ts > 5000) return;
    if (document.visibilityState === 'hidden') return;   // background tabs stay out
    lastSignal = ts;
    grabAll();
  });

  document.addEventListener('keydown', function (e) {
    if (!e.isTrusted || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== 'g' && e.key !== 'G') return;
    if (isTyping()) return;
    requestGrab();
  }, true);

  // Badges render on bounded staggered runs + after his clicks (no timers).
  [400, 1200, 2500, 4500, 7000, 10000].forEach(function (ms) { setTimeout(addBadges, ms); });
  var lastBadgeRun = 0;
  document.addEventListener('click', function (e) {
    if (!e.isTrusted) return;
    var now = Date.now();
    if (now - lastBadgeRun < 1000) return;
    lastBadgeRun = now;
    setTimeout(addBadges, 350);
  }, true);
})();
;
