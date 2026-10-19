// ==UserScript==
// @name         Every facility — Copy to note
// @version      1.10
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Copy-to-note.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Copy-to-note.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Copy-to-note engine (built 2026-10-13 to Adrian's confirmed spec).
  // The six Copy buttons (Diagnoses, BIMS, Age/Sex, Allergies, Psych meds,
  // Relationships) queue values in localStorage. When a consult form with his
  // note is open, this engine lands the queued values in the note — NEW form
  // placeholders or FOLLOW UP updates — then consumes them (single use).
  //
  // Rules (all his): nothing applies if he has clicked/typed in the form;
  // fills are fresh for 15 minutes only; formatting of his note is preserved
  // exactly (empty lines, single spaces); diagnoses replace only between the
  // Medical Hx and Family/Social Hx lines; BIMS appends below the latest score
  // line (same score + same date is not duplicated); age updates the number
  // only; allergies compare first and change only if different; meds reconcile
  // (dose/frequency from the chart, his indication wording stays, new meds
  // bring the chart's indication, annotation lines untouched); relationships
  // apply only when queued.

  var FRESH_MS = 15 * 60 * 1000;

  // ==PURE-BEGIN== (text transforms — no DOM in this section)

  function applyDiagnoses(txt, dx) {
    var lines = txt.split('\n');
    var mi = -1, fi = -1, i;
    for (i = 0; i < lines.length; i++) {
      if (mi === -1 && /^\s*Medical Hx\b/.test(lines[i])) mi = i;
      else if (mi !== -1 && /^\s*Family\/Social Hx\b/.test(lines[i])) { fi = i; break; }
    }
    if (mi === -1 || fi === -1) return txt;   // hard edges: both lines must exist
    var hm = lines[mi].match(/^\s*Medical Hx\b/);
    var header = hm ? hm[0] : 'Medical Hx';   // keep only the header words — the rest of
                                              // the line is old diagnoses, which are replaced
    var headerAlone = lines[mi].slice(header.length).trim() === '';
    var out = lines.slice(0, mi);
    if (headerAlone) {
      // His templates put "Medical Hx" alone on its line with the
      // diagnoses on the line UNDER it (his fill map, 2026-10-13) — keep
      // that shape. The old code merged the list onto the header line and
      // ate the line beneath it (his Saints report, 2026-10-14).
      out.push(lines[mi]);
      out.push(dx);
      out.push('');   // his ask (2026-10-14, Saints form): an Enter at the
                      // end of the diagnoses — a blank line before
                      // Family/Social Hx. (Follow-up format has none.)
    } else {
      // Follow-up notes carry the diagnoses on the header line itself —
      // replace them there, same shape as before.
      out.push(header + ' ' + dx);
    }
    out = out.concat(lines.slice(fi));
    return out.join('\n');
  }

  function applyBims(txt, val) {
    if (!/^\d{1,2} on \d{1,2}\/\d{1,2}\/\d{2,4}$/.test(val)) return txt;
    var lines = txt.split('\n');
    var bi = -1, i;
    for (i = 0; i < lines.length; i++) { if (/\bBIMS\b/.test(lines[i])) { bi = i; break; } }
    if (bi === -1) return txt;
    var scoreRe = /^\s*\d{1,2}\s+on\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/;
    var xxRe = /^\s*(?:\d{1,2}|xx)\s+on\s+xx\s*$/i;   // "15 on xx" or "xx on xx"
    var lastScore = -1, xxLine = -1;
    for (i = bi + 1; i < lines.length; i++) {
      if (xxRe.test(lines[i])) { xxLine = i; continue; }
      if (scoreRe.test(lines[i])) {
        if (lines[i].trim() === val) return txt;   // same score + date already listed
        lastScore = i;
        continue;
      }
      break;
    }
    if (xxLine !== -1) { lines[xxLine] = val; return lines.join('\n'); }   // NEW form: fill the placeholder line
    if (lastScore !== -1) { lines.splice(lastScore + 1, 0, val); return lines.join('\n'); }  // FOLLOW UP: newest below latest
    lines.splice(bi + 1, 0, val);
    return lines.join('\n');
  }

  function applyAgeSex(txt, val) {
    var ageM = val.match(/\d{1,3}/);
    if (!ageM) return txt;
    if (/^([ \t]*HPI[ \t]+)xx\b/m.test(txt)) {
      return txt.replace(/^([ \t]*HPI[ \t]+)xx\b/m, '$1' + val);   // NEW: "HPI xx" -> "HPI 86F"
    }
    // FOLLOW UP: update the age number only; the sex letter stays his
    return txt.replace(/^([ \t]*HPI[ \t]+)\d{1,3}([MF])\b/m, function (m, p1, letter) {
      return p1 + ageM[0] + letter;
    });
  }

  function allergySet(s) {
    return s.split(',').map(function (x) { return x.trim().toLowerCase(); })
      .filter(Boolean).sort().join('|');
  }

  function applyAllergies(txt, val) {
    var m = txt.match(/^([ \t]*Allergies[ \t]*:?[ \t]*)(.+)$/m);
    if (!m) return txt;
    var cur = m[2].trim();
    var placeholder = /^(NKA|NKDA|No[ \t]+known)/i.test(cur);
    if (!placeholder && allergySet(cur) === allergySet(val)) return txt;  // same -> do nothing
    return txt.replace(/^([ \t]*Allergies[ \t]*:?[ \t]*).+$/m, '$1' + val);
  }

  function applyRelationships(txt, val) {
    return txt.replace(/^([ \t]*Primary contact[ \t]+).+$/m, '$1' + val);
  }

  // Brand/generic pairs -> canonical key (the generic). Rivastigmine is the
  // mandated display name for its pair (his rule: never "Exelon").
  var MED_PAIRS = [
    ['Risperdal', 'risperidone'], ['Seroquel', 'quetiapine'], ['Zyprexa', 'olanzapine'],
    ['Abilify', 'aripiprazole'], ['Invega', 'paliperidone'], ['Latuda', 'lurasidone'],
    ['Geodon', 'ziprasidone'], ['Haldol', 'haloperidol'], ['Prolixin', 'fluphenazine'],
    ['Thorazine', 'chlorpromazine'], ['Clozaril', 'clozapine'], ['Zoloft', 'sertraline'],
    ['Prozac', 'fluoxetine'], ['Paxil', 'paroxetine'], ['Celexa', 'citalopram'],
    ['Lexapro', 'escitalopram'], ['Effexor', 'venlafaxine'], ['Cymbalta', 'duloxetine'],
    ['Wellbutrin', 'bupropion'], ['Remeron', 'mirtazapine'], ['Trintellix', 'vortioxetine'],
    ['Viibryd', 'vilazodone'], ['Lamictal', 'lamotrigine'], ['Depakote', 'divalproex'],
    ['Depakote', 'valproic acid'], ['Depakote', 'valproate'], ['Tegretol', 'carbamazepine'],
    ['Trileptal', 'oxcarbazepine'], ['Topamax', 'topiramate'], ['Neurontin', 'gabapentin'],
    ['Lyrica', 'pregabalin'], ['Ativan', 'lorazepam'], ['Klonopin', 'clonazepam'],
    ['Xanax', 'alprazolam'], ['Valium', 'diazepam'], ['Restoril', 'temazepam'],
    ['Ambien', 'zolpidem'], ['Lunesta', 'eszopiclone'], ['Buspar', 'buspirone'],
    ['Vistaril', 'hydroxyzine'], ['Intuniv', 'guanfacine'], ['Strattera', 'atomoxetine'],
    ['Concerta', 'methylphenidate'], ['Vyvanse', 'lisdexamfetamine'], ['Adderall', 'amphetamine'],
    ['Cogentin', 'benztropine'], ['Aricept', 'donepezil'], ['Namenda', 'memantine'],
    ['Exelon', 'rivastigmine'], ['Razadyne', 'galantamine']
  ];
  var MED_CANON = {};
  MED_PAIRS.forEach(function (p) {
    MED_CANON[p[0].toLowerCase()] = p[1];
    MED_CANON[p[1]] = p[1];
  });
  var NAME_DISPLAY = { 'rivastigmine': 'Rivastigmine' };   // mandated display names

  function canonMed(name) {
    var n = (name || '').toLowerCase()
      .replace(/\b(hcl|hydrochloride|sodium|sulfate|fumarate|mesylate|succinate|phosphate)\b/g, '')
      .replace(/\b(er|xr|sr|cr|odt|ir|la)\b/g, '')
      .replace(/\s+/g, ' ').trim();
    return MED_CANON[n] || n;
  }

  // "- Risperdal 0.5mg BID for SAD" -> {name, spec, ind} | null (not a med line)
  function parseMedLine(line) {
    var m = line.match(/^-\s+(.+?)\s+(\d[\s\S]*)$/);
    if (!m) return null;
    var name = m[1].trim(), rest = m[2].trim();
    if (name.indexOf(',') !== -1) return null;                    // "GDR failed, 2026" is not a med
    var spec = rest, ind = '';
    var fi = rest.lastIndexOf(' for ');
    if (fi !== -1) { spec = rest.slice(0, fi).trim(); ind = rest.slice(fi + 5).trim(); }
    if (!/\d\s*(mg|mcg|g|ml)\b/i.test(spec) &&
        !/\b(QD|BID|TID|QID|QHS|QAM|QPM|PRN|daily|nightly|every)\b/i.test(spec)) return null;
    return { name: name, spec: spec, ind: ind, canon: canonMed(name) };
  }

  function applyMeds(txt, medsValue) {
    var chartLines = medsValue.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    var chartMeds = [];
    chartLines.forEach(function (l) { var p = parseMedLine(l); if (p) { p.line = l; chartMeds.push(p); } });
    // Specless chart-owned lines (his rule, 2026-10-14): the methadone
    // line carries no dose/frequency, so it never parses as a med —
    // but it is a real payload line and must land (at the end of the
    // list), not disqualify the whole fill.
    var chartExtras = chartLines.filter(function (l) {
      return !parseMedLine(l) && /^-\s*Methadone managed by medical\s*$/i.test(l);
    });

    var lines = txt.split('\n');
    var hi = -1, ei = -1, i;
    for (i = 0; i < lines.length; i++) { if (/^\s*Psych meds\s*$/.test(lines[i])) { hi = i; break; } }
    if (hi === -1) return txt;
    for (i = hi + 1; i < lines.length; i++) { if (/^\s*PLAN\b/.test(lines[i])) { ei = i; break; } }
    if (ei === -1) ei = lines.length;

    var block = lines.slice(hi + 1, ei);
    var trailingBlanks = [];
    while (block.length && block[block.length - 1].trim() === '') trailingBlanks.unshift(block.pop());

    var isNone = block.length === 1 && /^-\s*none\s*$/i.test(block[0].trim());
    var newBlock;
    if (isNone || block.length === 0) {
      if (!chartLines.length) newBlock = ['- none'];
      else if (chartMeds.length) newBlock = chartLines.slice();
      else newBlock = ['- none'].concat(chartLines.filter(function (l) { return !/^-\s*none\s*$/i.test(l); }));
    } else if (!chartMeds.length && !chartExtras.length) {
      return txt;   // queued value didn't parse as meds — don't touch his list
    } else {
      var chartByCanon = {};
      chartMeds.forEach(function (c) { if (!chartByCanon[c.canon]) chartByCanon[c.canon] = c; });
      var used = {};
      var rebuilt = [], lastMedPos = -1;
      block.forEach(function (line) {
        if (/^-\s*none\s*$/i.test(line.trim())) return;              // placeholder — re-derived below
        if (chartExtras.indexOf(line.trim()) !== -1) return;         // chart-owned — re-appended in place
        var p = parseMedLine(line);
        if (!p) { rebuilt.push(line); return; }                    // annotation — untouched
        var c = chartByCanon[p.canon];
        if (!c || used[p.canon]) return;                            // gone (or duplicate) — drop
        used[p.canon] = 1;
        var disp = NAME_DISPLAY[p.canon] || p.name;
        var ind = p.ind || c.ind;
        rebuilt.push('- ' + disp + ' ' + c.spec + (ind ? ' for ' + ind : ''));
        lastMedPos = rebuilt.length - 1;
      });
      var fresh = chartMeds.filter(function (c) { return !used[c.canon]; })
        .map(function (c) { return c.line; });
      if (fresh.length) {
        if (lastMedPos === -1) rebuilt = fresh.concat(rebuilt);
        else rebuilt = rebuilt.slice(0, lastMedPos + 1).concat(fresh, rebuilt.slice(lastMedPos + 1));
      }
      var anyMed = rebuilt.some(function (l) { return !!parseMedLine(l); });
      if (!anyMed) rebuilt.unshift('- none');
      newBlock = rebuilt.concat(chartExtras);
    }

    var out = lines.slice(0, hi + 1).concat(newBlock, trailingBlanks, lines.slice(ei));
    return out.join('\n');
  }

  // ---- Mismatch check (his request, 2026-10-13) ----
  // Compares the note AS OPENED against the grabbed chart values and returns
  // the topics that differ, for the "note vs chart" panel ("age - update",
  // "allergies - update", ...). Placeholder values in a NEW form are not
  // mismatches and are skipped; a topic with no grabbed value is not checked.

  function normSpec(s) { return (s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  function medSectionLines(txt) {
    var lines = txt.split('\n'), hi = -1, ei = -1, i;
    for (i = 0; i < lines.length; i++) { if (/^\s*Psych meds\s*$/.test(lines[i])) { hi = i; break; } }
    if (hi === -1) return null;
    for (i = hi + 1; i < lines.length; i++) { if (/^\s*PLAN\b/.test(lines[i])) { ei = i; break; } }
    if (ei === -1) ei = lines.length;
    return lines.slice(hi + 1, ei);
  }

  function diffLabels(txt, q) {
    var out = [];
    if (q.ageSex) {
      var hm = txt.match(/^[ \t]*HPI[ \t]+(\d{1,3})[MF]\b/m);
      var qa = String(q.ageSex).match(/\d{1,3}/);
      if (hm && qa && hm[1] !== qa[0]) out.push('age');
    }
    if (q.allergies) {
      var am = txt.match(/^[ \t]*Allergies[ \t]*:?[ \t]*(.+)$/m);
      if (am) {
        var cur = am[1].trim();
        if (!/^(NKA|NKDA|No[ \t]+known)/i.test(cur) && allergySet(cur) !== allergySet(String(q.allergies))) out.push('allergies');
      }
    }
    if (q.meds) {
      var sec = medSectionLines(txt);
      if (sec) {
        var content = sec.filter(function (l) { return l.trim() !== ''; });
        var isNone = content.length === 1 && /^-\s*none\s*$/i.test(content[0].trim());
        if (!isNone && content.length) {
          var noteMap = {}, chartMap = {}, diff = false, k;
          content.forEach(function (l) { var p = parseMedLine(l); if (p) noteMap[p.canon] = normSpec(p.spec); });
          String(q.meds).split('\n').forEach(function (l) { var p = parseMedLine(l); if (p) chartMap[p.canon] = normSpec(p.spec); });
          for (k in chartMap) { if (noteMap[k] !== chartMap[k]) { diff = true; break; } }
          if (!diff) { for (k in noteMap) { if (!(k in chartMap)) { diff = true; break; } } }
          if (diff) out.push('medications');
        }
      }
    }
    if (q.diagnoses) {
      var lines = txt.split('\n'), mi = -1, fi = -1, i2;
      for (i2 = 0; i2 < lines.length; i2++) {
        if (mi === -1 && /^\s*Medical Hx\b/.test(lines[i2])) mi = i2;
        else if (mi !== -1 && /^\s*Family\/Social Hx\b/.test(lines[i2])) { fi = i2; break; }
      }
      if (mi !== -1 && fi !== -1) {
        var block = lines.slice(mi, fi).join('\n').replace(/^\s*Medical Hx\b/, '').trim();
        if (block) {
          var setOf = function (s) {
            return s.split(',').map(function (x) { return x.toLowerCase().replace(/\s+/g, ' ').replace(/\.+$/, '').trim(); })
              .filter(Boolean).sort().join('|');
          };
          if (setOf(block) !== setOf(String(q.diagnoses))) out.push('diagnoses');
        }
      }
    }
    if (q.bims) {
      var bv = String(q.bims).replace(/^BIMS\s+/i, '');
      if (/^\d{1,2} on \d/.test(bv) && !/^\s*(?:\d{1,2}|xx)\s+on\s+xx\s*$/im.test(txt)) {
        var scoreLines = txt.match(/^\s*\d{1,2}\s+on\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/gm) || [];
        var has = scoreLines.some(function (l) { return l.trim() === bv; });
        if (!has && scoreLines.length) out.push('bims');
      }
    }
    if (q.relationships) {
      var cm = txt.match(/^[ \t]*Primary contact[ \t]+(.+)$/mi);
      if (cm && !/^xx\b/i.test(cm[1].trim()) &&
          cm[1].trim().toLowerCase() !== String(q.relationships).trim().toLowerCase()) out.push('contact');
    }
    return out;
  }

  // ==PURE-END==

  var TOPICS = [
    { key: 'pccFillDiagnoses',     seen: 'pccFillDiagnosesSeen',     apply: applyDiagnoses },
    { key: 'pccFillBims',          seen: 'pccFillBimsSeen',          apply: function (t, v) { return applyBims(t, v.replace(/^BIMS\s+/i, '')); } },
    { key: 'pccFillAgeSex',        seen: 'pccFillAgeSexSeen',        apply: applyAgeSex },
    { key: 'pccFillAllergies',     seen: 'pccFillAllergiesSeen',     apply: applyAllergies },
    { key: 'pccFillPsychMeds',     seen: 'pccFillPsychMedsSeen',     apply: applyMeds },
    { key: 'pccFillRelationships', seen: 'pccFillRelationshipsSeen', apply: applyRelationships }
  ];

  // Takeover tracking (v1.4): a timestamp, not a lifetime ban. The old
  // boolean meant ANY earlier click/keypress on a form control — e.g.
  // clicking into the note to read it — silently blocked every later fill
  // for that page load (his Saints report 2026-10-14: age never updated,
  // while the regex and queue were both fine). Now: a grab queued BEFORE
  // his last touch stays blocked (stale grabs can't land in a form he has
  // taken over), but a grab he makes AFTER touching applies — pressing G
  // is the explicit instruction.
  var touchedAt = 0;
  ['mousedown', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (!e.isTrusted) return;
      var tg = e.target;
      if (tg && tg.closest && tg.closest('textarea, input, select, button, a, label, [contenteditable]')) {
        touchedAt = Date.now();
      }
    }, true);
  });


  // ---- Tile warnings (his request, 2026-10-15) ----
  // While a consult form is open, compare the note against the
  // tile row's chart values (published by More/Less as
  // tmTileChart) and publish verdicts as tmTileWarn; the tiles
  // paint warning-red for any topic blank in the note or
  // different from the chart, white when it matches. Tile
  // rules differ from the mismatch panel on purpose: blank /
  // placeholder counts as a warning here - that is the point
  // ('so I remember to fill in the correct information').
  // Weight is NOT a topic: he never writes it into the note.
  function tileVerdicts(txt, medsTxt, chart) {
    var v = { age: false, allergies: false, meds: false, rel: false };
    if (chart.ageSex) {
      var hm = txt.match(/^[ \t]*HPI[ \t]+(\d{1,3})[MF]\b/m);
      var qa = String(chart.ageSex).match(/\d{1,3}/);
      v.age = !hm || !qa || hm[1] !== qa[0];
    }
    if (chart.allergies) {
      var am = txt.match(/^[ \t]*Allergies[ \t]*:?[ \t]*(.*)$/m);
      if (!am || !am[1].trim()) v.allergies = true;
      else {
        var nka = /^(NKA|NKDA|No[ \t]+known)/i;
        var noteSet = nka.test(am[1].trim()) ? '' : allergySet(am[1].trim());
        var chartSet = nka.test(String(chart.allergies).trim()) ? '' : allergySet(String(chart.allergies));
        v.allergies = noteSet !== chartSet;
      }
    }
    if (chart.meds) {
      var secLines = null;
      if (medsTxt !== null && medsTxt !== undefined) secLines = String(medsTxt).split('\n');
      else secLines = medSectionLines(txt);
      var chartNone = /^\s*-\s*none\s*$/i.test(String(chart.meds).trim());
      if (!secLines) v.meds = true;
      else {
        var content = secLines.filter(function (l) { return l.trim() !== ''; });
        var noteNone = content.length === 1 && /^\s*-\s*none\s*$/i.test(content[0].trim());
        if (!content.length) v.meds = true;
        else if (noteNone || chartNone) v.meds = noteNone !== chartNone;
        else {
          var noteMap = {}, chartMap = {}, diff = false, k;
          content.forEach(function (l) { var p = parseMedLine(l); if (p) noteMap[p.canon] = normSpec(p.spec); });
          String(chart.meds).split('\n').forEach(function (l) { var p = parseMedLine(l); if (p) chartMap[p.canon] = normSpec(p.spec); });
          for (k in chartMap) { if (noteMap[k] !== chartMap[k]) { diff = true; break; } }
          if (!diff) { for (k in noteMap) { if (!(k in chartMap)) { diff = true; break; } } }
          v.meds = diff;
        }
      }
    }
    if (chart.rel) {
      var cm = txt.match(/^[ \t]*Primary contact[ \t]+(.+)$/mi);
      if (!cm || !cm[1].trim() || /^xx\b/i.test(cm[1].trim())) v.rel = true;
      else v.rel = cm[1].trim().toLowerCase() !== String(chart.rel).trim().toLowerCase();
    }
    return v;
  }

  var tileWarnPublished = false, tileWarnLast = '', tileWarnTs = 0;
  function clearTileWarn() {
    if (!tileWarnPublished) return;
    tileWarnPublished = false; tileWarnLast = '';
    try { localStorage.removeItem('tmTileWarn'); } catch (e) {}
  }
  function publishTileWarn() {
    var chart = null;
    try { chart = JSON.parse(localStorage.getItem('tmTileChart') || 'null'); } catch (e) {}
    var field = findNoteField();
    if (!chart || !field) { clearTileWarn(); return; }
    var txt = field.value || '';
    if (!looksLikeHisNote(txt)) { clearTileWarn(); return; }
    var mf = findMedsField(field);
    var v = tileVerdicts(txt, mf ? (mf.value || '') : null, chart);
    var s = JSON.stringify(v);
    // Write on change, and re-write every ~20s as a heartbeat
    // while the form stays open: the tile row ignores verdicts
    // older than 2 minutes, so a form closed without a clean
    // clear can never leave a tile stuck red.
    if (s !== tileWarnLast || Date.now() - tileWarnTs > 20000) {
      tileWarnLast = s;
      tileWarnTs = Date.now();
      try { localStorage.setItem('tmTileWarn', JSON.stringify({ age: v.age, allergies: v.allergies, meds: v.meds, rel: v.rel, ts: tileWarnTs })); } catch (e) {}
    }
    tileWarnPublished = true;
  }
  var tileInputLast = 0;
  document.addEventListener('input', function (e) {
    if (!e.isTrusted) return;
    var now = Date.now();
    if (now - tileInputLast < 700) return;
    tileInputLast = now;
    setTimeout(publishTileWarn, 50);
  }, true);

  function findNoteField() {
    var labels = document.querySelectorAll('td, th, div, span, label, b');
    for (var i = 0; i < labels.length; i++) {
      var t = (labels[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (/^1\.\s*Psychiatry\s+Consult:?$/i.test(t) || /^Psychiatry\s+Consult:?$/i.test(t) || /^\d\.\s*HPI\s*\//i.test(t) || /^HPI\s*\//i.test(t)) {
        var all = document.querySelectorAll('textarea');
        for (var j = 0; j < all.length; j++) {
          if (labels[i].compareDocumentPosition(all[j]) & Node.DOCUMENT_POSITION_FOLLOWING) return all[j];
        }
      }
    }
    var tas = document.querySelectorAll('textarea'), best = null, bestArea = 0;
    for (var k = 0; k < tas.length; k++) {
      var r = tas[k].getBoundingClientRect();
      var area = r.width * r.height;
      if (area > bestArea && r.width > 100 && r.height > 50) { bestArea = area; best = tas[k]; }
    }
    return best;
  }

  function looksLikeHisNote(txt) {
    var anchors = 0;
    if (/\bHPI\b/.test(txt)) anchors++;
    if (/Medical Hx/.test(txt)) anchors++;
    if (/Psych meds/.test(txt)) anchors++;
    if (/Allergies/.test(txt)) anchors++;
    if (/Primary contact/.test(txt)) anchors++;
    if (/\bBIMS\b/.test(txt)) anchors++;
    return anchors >= 2;
  }

  function readQueue(topic) {
    try {
      var raw = localStorage.getItem(topic.key);
      if (!raw) return null;
      var req = JSON.parse(raw);
      if (!req || !req.value || !req.ts) return null;
      var seen = parseInt(localStorage.getItem(topic.seen) || '0', 10);
      if (req.ts <= seen) return null;                    // already used
      if (Date.now() - req.ts > FRESH_MS) return null;    // stale — ignore
      return req;
    } catch (e) { return null; }
  }

  function markUsed(topic, ts) {
    try { localStorage.setItem(topic.seen, String(ts)); } catch (e) {}
  }

  var dismissedSig = '';

  function renderDiff(labels, sig) {
    var old = document.getElementById('pccDiffPanel');
    if (!labels.length) { if (old && old.parentNode) old.parentNode.removeChild(old); return; }
    if (sig === dismissedSig) return;
    if (old && old.getAttribute('data-sig') === sig) return;
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var p = document.createElement('div');
    p.id = 'pccDiffPanel';
    p.setAttribute('data-sig', sig);
    p.style.cssText = 'position:fixed;top:14px;right:14px;z-index:2147483647;background:#fff;' +
      'border:1px solid #cbd5e1;border-left:5px solid #b45309;border-radius:10px;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.25);padding:10px 14px 10px 12px;' +
      'font:14px -apple-system,Helvetica,Arial,sans-serif;color:#111;min-width:170px;';
    var head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;';
    var cap = document.createElement('span');
    cap.textContent = 'note vs chart';
    cap.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;';
    var x = document.createElement('button');
    x.type = 'button';
    x.textContent = '✕';
    x.style.cssText = 'border:none;background:none;cursor:pointer;color:#64748b;font-size:13px;padding:0 0 0 10px;line-height:1;';
    x.addEventListener('click', function () {
      dismissedSig = sig;
      if (p.parentNode) p.parentNode.removeChild(p);
    });
    head.appendChild(cap);
    head.appendChild(x);
    p.appendChild(head);
    labels.forEach(function (l) {
      var d = document.createElement('div');
      d.textContent = l + ' - update';
      d.style.cssText = 'padding:1.5px 0;font-weight:600;';
      p.appendChild(d);
    });
    document.body.appendChild(p);
  }

  // CNR/Saints splits the note across two fields: the HPI field (found
  // above) holds HPI / Medical Hx / Allergies / contact, while the
  // Impression field holds DX / Psych meds / PLAN. Meds must land in THAT
  // field — running them against the HPI field found no "Psych meds"
  // section and silently did nothing (his Saints report, 2026-10-14).
  // Boro Park's single field holds everything, so no second field exists.
  function findMedsField(mainField) {
    var tas = document.querySelectorAll('textarea');
    for (var i = 0; i < tas.length; i++) {
      if (tas[i] === mainField) continue;
      var v = tas[i].value || '';
      if (/^\s*Psych meds\s*$/m.test(v) && (/^\s*PLAN\b/m.test(v) || /^\s*DX\b/m.test(v))) return tas[i];
    }
    return null;
  }

  function checkAndApply() {
    var field = findNoteField();
    if (!field) { clearTileWarn(); return; }
    var txt = field.value || '';
    if (!looksLikeHisNote(txt)) { clearTileWarn(); return; }
    var medsField = findMedsField(field);
    var medsTxt = medsField ? (medsField.value || '') : null;

    var reqs = {};
    TOPICS.forEach(function (topic) {
      var r = readQueue(topic);
      if (r && r.ts > touchedAt) reqs[topic.key] = r;   // pre-touch grabs stay blocked
    });

    // Mismatch check against the note as opened, before any fill lands.
    var q = {
      ageSex: reqs.pccFillAgeSex ? String(reqs.pccFillAgeSex.value) : null,
      allergies: reqs.pccFillAllergies ? String(reqs.pccFillAllergies.value) : null,
      meds: reqs.pccFillPsychMeds ? String(reqs.pccFillPsychMeds.value) : null,
      diagnoses: reqs.pccFillDiagnoses ? String(reqs.pccFillDiagnoses.value) : null,
      bims: reqs.pccFillBims ? String(reqs.pccFillBims.value) : null,
      relationships: reqs.pccFillRelationships ? String(reqs.pccFillRelationships.value) : null
    };
    var labels = diffLabels(txt, q);
    if (medsField && q.meds) {
      // The meds comparison belongs to the field that holds the meds.
      labels = labels.filter(function (l) { return l !== 'medications'; });
      if (diffLabels(medsTxt, { meds: q.meds }).indexOf('medications') !== -1) labels.push('medications');
    }
    var sig = labels.join(',') + '#' + TOPICS.map(function (t) {
      return reqs[t.key] ? reqs[t.key].ts : 0;
    }).join('.');

    var changed = false;
    TOPICS.forEach(function (topic) {
      var req = reqs[topic.key];
      if (!req) return;
      if (topic.key === 'pccFillPsychMeds' && medsField) return;   // handled below, in its own field
      var next = topic.apply(txt, String(req.value));
      if (next !== txt) {
        txt = next;
        changed = true;
        markUsed(topic, req.ts);
      }
    });
    if (changed) {
      field.value = txt;
      try {
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {}
    }
    // Meds land in their own field at CNR/Saints (see findMedsField).
    if (medsField && reqs.pccFillPsychMeds) {
      var mNext = applyMeds(medsTxt, String(reqs.pccFillPsychMeds.value));
      if (mNext !== medsTxt) {
        medsField.value = mNext;
        try {
          medsField.dispatchEvent(new Event('input', { bubbles: true }));
          medsField.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {}
        TOPICS.forEach(function (topic) {
          if (topic.key === 'pccFillPsychMeds') markUsed(topic, reqs.pccFillPsychMeds.ts);
        });
      }
    }
    publishTileWarn();
    renderDiff(labels, sig);
  }

  window.addEventListener('storage', function () { setTimeout(checkAndApply, 60); });
  [800, 2000, 4000, 8000, 15000].forEach(function (ms) { setTimeout(checkAndApply, ms); });
  var lastClickCheck = 0;
  document.addEventListener('click', function (e) {
    if (!e.isTrusted) return;
    var now = Date.now();
    if (now - lastClickCheck < 1000) return;
    lastClickCheck = now;
    setTimeout(checkAndApply, 400);
  }, true);
})();
