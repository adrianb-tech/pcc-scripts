// ==UserScript==
// @name         Every facility — Copy to note
// @version      1.0
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
    var out = lines.slice(0, mi);
    out.push(header + ' ' + dx);
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
    var xxRe = /^\s*\d{1,2}\s+on\s+xx\s*$/i;
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
      newBlock = chartLines.length ? chartLines.slice() : ['- none'];
    } else if (!chartMeds.length) {
      return txt;   // queued value didn't parse as meds — don't touch his list
    } else {
      var chartByCanon = {};
      chartMeds.forEach(function (c) { if (!chartByCanon[c.canon]) chartByCanon[c.canon] = c; });
      var used = {};
      var rebuilt = [], lastMedPos = -1;
      block.forEach(function (line) {
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
      newBlock = rebuilt;
    }

    var out = lines.slice(0, hi + 1).concat(newBlock, trailingBlanks, lines.slice(ei));
    return out.join('\n');
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

  var userTouched = false;
  ['mousedown', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { if (e.isTrusted) userTouched = true; }, true);
  });

  function findNoteField() {
    var labels = document.querySelectorAll('td, th, div, span, label, b');
    for (var i = 0; i < labels.length; i++) {
      var t = (labels[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (/^1\.\s*Psychiatry\s+Consult:?$/i.test(t) || /^Psychiatry\s+Consult:?$/i.test(t)) {
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

  function checkAndApply() {
    if (userTouched) return;
    var field = findNoteField();
    if (!field) return;
    var txt = field.value || '';
    if (!looksLikeHisNote(txt)) return;
    var changed = false;
    TOPICS.forEach(function (topic) {
      var req = readQueue(topic);
      if (!req) return;
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
