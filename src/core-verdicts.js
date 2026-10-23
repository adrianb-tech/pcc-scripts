// Verdicts module (extracted from Copy to note v1.14 for
// PCC Core): computes the tile verdicts from the open note
// and publishes them (tmTileWarn + tmNoteOpen) for the tile
// row. The FILL half of Copy to note stays in that script
// until the Form Kit stage - this module never writes
// into the note.
(function () {
  'use strict';

  function allergySet(s) {
    return s.split(',').map(function (x) {
      var t = x.trim().toLowerCase();
      // PCN is penicillin (his correction, 2026-10-22):
      // his note writes 'PCN', the chart writes
      // 'Penicillins' - the same allergy, and the tile
      // must not shine red over the abbreviation. The
      // chart side already shortens penicillin to PCN
      // in its own copy paths; the comparator now
      // canonicalizes both spellings to one token.
      if (/penicillin/.test(t) || /\bpcn\b/.test(t)) return 'pcn';
      return t;
    }).filter(Boolean).sort().join('|');
  }


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


  function normSpec(s) { return (s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  function medSectionLines(txt) {
    var lines = txt.split('\n'), hi = -1, ei = -1, i;
    for (i = 0; i < lines.length; i++) { if (/^\s*Psych meds\s*$/.test(lines[i])) { hi = i; break; } }
    if (hi === -1) return null;
    for (i = hi + 1; i < lines.length; i++) { if (/^\s*PLAN\b/.test(lines[i])) { ei = i; break; } }
    if (ei === -1) ei = lines.length;
    return lines.slice(hi + 1, ei);
  }


  function tileVerdicts(txt, medsTxt, chart) {
    var v = { age: false, allergies: false, meds: false, rel: false, bims: false, dx: false };
    if (chart.ageSex) {
      var hm = txt.match(/^[ \t]*HPI[ \t]+(\d{1,3})[MF]\b/m);
      var qa = String(chart.ageSex).match(/\d{1,3}/);
      v.age = !hm || !qa || hm[1] !== qa[0];
    }
    // Crown Heights + Bedford (his absolute rule,
    // 2026-10-22, extended to Bedford 2026-10-23): the
    // Allergies tile NEVER paints red at either facility
    // - their notes never have to carry the allergies
    // line, so a permanent red there is noise, not
    // signal. The chart record carries facCH / facBedford
    // from the chart page (moreless publishes them);
    // when either is set, the allergies verdict is not
    // computed at all.
    if (chart.allergies && !chart.facCH && !chart.facBedford) {
      var am = txt.match(/^[ \t]*Allergies[ \t]*:?[ \t]*(.*)$/m);
      if (!am || !am[1].trim()) v.allergies = true;
      else {
        var nka = /^(NKA|NKDA|No[ \t]+known)/i;
        var noteSet = nka.test(am[1].trim()) ? '' : allergySet(am[1].trim());
        var chartSet = nka.test(String(chart.allergies).trim()) ? '' : allergySet(String(chart.allergies));
        v.allergies = noteSet !== chartSet;
      }
    }
    // A chart.meds that is only our own no-data placeholder
    // ("—") is the ABSENCE of a chart value, not a value: it
    // is no basis for a verdict (his basis rule). And a chart
    // value with no parseable med line in it ("none", "0")
    // counts as chart-none - the old exact "- none" test let
    // those through, so a resident with NO psych meds at all
    // painted red against a note saying "- none" (his
    // report, 2026-10-19; fixture h134, TREE-1437 + TREE-1307).
    if (chart.meds && !/^\s*(—|–|-)\s*$/.test(String(chart.meds))) {
      var secLines = null;
      // A separate meds field (split-field notes) is
      // sliced through the SAME section discipline as
      // a single field: whole-field text admits the
      // PLAN line ("- f/o 1-2 months or PRN") as a
      // phantom medication no fill can ever clear
      // (his report, 2026-10-21; fixture h168).
      if (medsTxt !== null && medsTxt !== undefined) secLines = medSectionLines(String(medsTxt));
      else secLines = medSectionLines(txt);
      var chartMap0 = {}, chartSeq0 = [];
      String(chart.meds).split('\n').forEach(function (l) { var p = parseMedLine(l); if (p) { chartMap0[p.canon] = normSpec(p.spec); chartSeq0.push(p.canon); } });
      var chartNone = /^\s*-\s*none\s*$/i.test(String(chart.meds).trim()) || chartSeq0.length === 0;
      if (!secLines) v.meds = true;
      else {
        var content = secLines.filter(function (l) { return l.trim() !== ''; });
        var noteNone = content.length === 1 && /^\s*-\s*none\s*$/i.test(content[0].trim());
        if (!content.length) v.meds = true;
        else if (noteNone || chartNone) v.meds = noteNone !== chartNone;
        else {
          var noteMap = {}, chartMap = chartMap0, diff = false, k;
          var noteSeq = [], chartSeq = chartSeq0;
          content.forEach(function (l) { var p = parseMedLine(l); if (p) { noteMap[p.canon] = normSpec(p.spec); noteSeq.push(p.canon); } });
          for (k in chartMap) { if (noteMap[k] !== chartMap[k]) { diff = true; break; } }
          if (!diff) { for (k in noteMap) { if (!(k in chartMap)) { diff = true; break; } } }
          // ORDER COUNTS (his rule, 2026-10-19): the same
          // meds in a different order than the chart list
          // still shine red - his note's list must follow
          // the tile's order (grouped by indication,
          // seizure/Parkinson's last), not just contain it.
          if (!diff && noteSeq.join('|') !== chartSeq.join('|')) diff = true;
          v.meds = diff;
        }
      }
    }
    // BIMS (his rulebook, AMENDED 2026-10-19): the
    // anchor is HIS NOTE against TODAY - red when the
    // last BIMS score in the note is more than 6 months
    // old, or there is none. (The first draft measured
    // against the chart's newest BIMS; he re-anchored it:
    // if the chart's newest is itself stale, the tile is
    // red with nothing newer to copy - that IS the
    // signal.) READMISSION adds a second trip: the
    // newest chart score is red when it does not sit in
    // the same 6-month period as the previous one (a
    // stale comparison window). The significant-drop
    // trip (3a) is NOT shipped - its threshold is his
    // ruling to make.
    {
      var parseD = function (ds) {
        var p = String(ds).split('/'); var y = +p[2]; if (y < 100) y += 2000;
        return new Date(y, +p[0] - 1, +p[1]);
      };
      var noteLatest = null, noteLatestVal = null;
      var blines = txt.split('\n');
      // The scan window is the note's whole BIMS
      // section: the BIMS line, the line under it, and
      // the run of score / placeholder / blank lines
      // that follows. Copy-to-note's applyBims
      // APPENDS a follow-up score below the existing
      // score lines - outside a two-line window - so
      // a filled note kept judging bims:true on the
      // old score alone (his report, 2026-10-21;
      // fixture h168).
      var bScoreRe = /^\s*\d{1,2}\s+on\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/;
      var bXxRe = /^\s*(?:\d{1,2}|xx)\s+on\s+xx\s*$/i;
      for (var bi = 0; bi < blines.length; bi++) {
        if (!/BIMS/i.test(blines[bi])) continue;
        var scanLines = [blines[bi]], bj = bi + 1;
        if (bj < blines.length) { scanLines.push(blines[bj]); bj++; }
        while (bj < blines.length && (bScoreRe.test(blines[bj]) || bXxRe.test(blines[bj]) || !blines[bj].trim())) { scanLines.push(blines[bj]); bj++; }
        var scan = scanLines.join('\n');
        var re2 = /(\d{1,2})\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/g, mm;
        while ((mm = re2.exec(scan))) {
          var dt = parseD(mm[2]);
          if (!noteLatest || dt > noteLatest) { noteLatest = dt; noteLatestVal = +mm[1]; }
        }
      }
      var sixAgo = new Date(); sixAgo.setMonth(sixAgo.getMonth() - 6);
      // STOP SCORES + THE DATE RULE (his rules,
      // 2026-10-23, the date clause added the same day
      // from his live Bedford rounds): 0 and 99 mean he
      // stops testing the BIMS. FIRST: if the note's
      // newest BIMS date is on or after the chart's BIMS
      // date, the tile is NEVER red - his note holds the
      // freshest score there is, stopped or not. ELSE
      // (the chart's score is the newer one, or the note
      // has none): a chart stop score (0/99) is red until
      // it transfers into the note - he must have one
      // 0/99 in the note before he stops monitoring. A
      // note-side stop with NO chart score at all is a
      // finished stop, never red for age. Otherwise the
      // freshness rule stands as before.
      var chartBimsVal = null, chartBimsDate = null;
      if (chart.bims) {
        var cbm = String(chart.bims).match(/^\s*(\d{1,2})\b/); if (cbm) chartBimsVal = +cbm[1];
        var cbd = String(chart.bims).match(/on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/); if (cbd) chartBimsDate = parseD(cbd[1]);
      }
      var noteStop = (noteLatestVal === 0 || noteLatestVal === 99);
      var chartStop = (chartBimsVal === 0 || chartBimsVal === 99);
      if (noteLatest && chartBimsDate && noteLatest >= chartBimsDate) v.bims = false;
      else if (chartStop) v.bims = true;
      else if (noteStop && chartBimsVal === null) v.bims = false;
      else v.bims = !noteLatest || noteLatest < sixAgo;
      if (!v.bims && chart.readmit && chart.bims && chart.bimsPrev) {
        var cn = String(chart.bims).match(/on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/);
        var cp = String(chart.bimsPrev).match(/on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/);
        if (cn && cp) {
          var newest = parseD(cn[1]), prev = parseD(cp[1]);
          var winStart = new Date(newest); winStart.setMonth(winStart.getMonth() - 6);
          if (prev < winStart) v.bims = true;
        }
      }
    }
    // Diagnoses (his rulebook, 2026-10-19): on a NEW note
    // he adds the diagnoses - red until the note's DX
    // section carries every diagnosis the tile shows.
    // Carried = the ICD code appears in the section, or
    // the normalized name does. (Scope gating below
    // keeps this dark on follow-ups entirely.)
    if (chart.dx) {
      var dsec = null;
      var dlines = txt.split('\n'), dhi = -1, dei = -1, di2;
      for (di2 = 0; di2 < dlines.length; di2++) { if (/^\s*DX\s*$/.test(dlines[di2])) { dhi = di2; break; } }
      if (dhi !== -1) {
        for (di2 = dhi + 1; di2 < dlines.length; di2++) { if (/^\s*Psych meds\s*$/.test(dlines[di2])) { dei = di2; break; } }
        if (dei === -1) dei = dlines.length;
        dsec = dlines.slice(dhi + 1, dei).join('\n');
      }
      var norm = function (x) { return String(x).toLowerCase().replace(/[^a-z0-9.]+/g, ' ').replace(/\s+/g, ' ').trim(); };
      var noteDxNorm = dsec ? norm(dsec) : '';
      var missing = false;
      String(chart.dx).split('\n').forEach(function (ln) {
        var t = ln.trim();
        if (t.length < 4) return;
        var code = t.match(/\b[A-Z]\d{2}(?:\.\d{1,2})?\b/i);
        var namePart = norm(t.replace(/\b[A-Z]\d{2}(?:\.\d{1,2})?\b/i, ''));
        var carried = false;
        if (code && noteDxNorm.indexOf(code[0].toLowerCase()) !== -1) carried = true;
        if (!carried && namePart.length >= 10 && noteDxNorm.indexOf(namePart) !== -1) carried = true;
        if (!carried && norm(t).length >= 10 && noteDxNorm.indexOf(norm(t)) !== -1) carried = true;
        if (!carried) missing = true;
      });
      v.dx = missing;
    }
    if (chart.rel) {
      var cm = txt.match(/^[ \t]*Primary contact[ \t]+(.+)$/mi);
      if (!cm || !cm[1].trim() || /^xx\b/i.test(cm[1].trim())) v.rel = true;
      else {
        // ORDER DOES NOT COUNT here (his rule, 2026-10-19 -
        // the opposite of meds): the right relationships in
        // a different order must NOT shine red. Compare the
        // two sides as sets of names/relations.
        var relSet = function (s) {
          var out = {};
          String(s).split(/[,;]|\s+and\s+/i).forEach(function (p) {
            var q = p.replace(/^[\s\-]+|[\s\-]+$/g, '').toLowerCase().replace(/\s+/g, ' ');
            if (q) out[q] = 1;
          });
          return out;
        };
        var nSet = relSet(cm[1]), cSet = relSet(chart.rel), rDiff = false, rk;
        // SELF (his rule, 2026-10-23): 'self' is a required
        // relationship only when it is the ONLY one. When
        // the chart names anyone else, self is excused on
        // BOTH sides of the compare - missing from the note
        // is fine, present in the note is fine.
        var cHasOther = false;
        for (rk in cSet) { if (rk !== 'self') { cHasOther = true; break; } }
        if (cHasOther) { delete nSet.self; delete cSet.self; }
        for (rk in cSet) { if (!nSet[rk]) { rDiff = true; break; } }
        if (!rDiff) { for (rk in nSet) { if (!cSet[rk]) { rDiff = true; break; } } }
        v.rel = rDiff;
      }
    }
    return v;
  }


  var tileWarnPublished = false, tileWarnLast = '', tileWarnTs = 0, weHoldOpen = false, openChain = false;
  function clearTileWarn() {
    // Only the document that proved the note open may
    // un-prove it (his rule, 2026-10-19): instances in
    // other windows never erase the form window's proof.
    if (weHoldOpen) { try { localStorage.removeItem('tmNoteOpen'); } catch (e) {} weHoldOpen = false; }
    if (!tileWarnPublished) return;
    tileWarnPublished = false; tileWarnLast = '';
    try { localStorage.removeItem('tmTileWarn'); } catch (e) {}
  }
  function publishTileWarn() {
    var chart = null;
    try { chart = JSON.parse(localStorage.getItem('tmTileChart') || 'null'); } catch (e) {}
    // Basis rule (v1.12, his words): a tile may only go
    // red when there is information present to contradict
    // it - this resident's chart values, published by a
    // living tile row (it heartbeats every ~20s). A stale
    // record - a previous resident's leftovers, or a
    // chart long closed - is no basis at all: no verdicts.
    // 90s, not 45s: the chart window is backgrounded
    // while he writes in the form, and its ~20s heartbeat
    // republication throttles to ~60s there - a 45s gate
    // dropped the chart record mid-note and the verdicts
    // (and the red) flickered with it.
    if (chart && chart.ts && Date.now() - chart.ts > 90000) chart = null;
    var field = findNoteField();
    if (!chart || !field) { clearTileWarn(); return; }
    var txt = field.value || '';
    if (!looksLikeHisNote(txt)) { clearTileWarn(); return; }
    var mf = findMedsField(field);
    var v = tileVerdicts(txt, mf ? (mf.value || '') : null, chart);
    // Scope by note type (his rulebook, 2026-10-19): a
    // NEW note is assessed on all six topics; a FOLLOW-UP
    // only on Age/Sex, BIMS, and Psych meds - Diagnoses,
    // Relationships, and Allergies are never assessed in
    // a follow-up, so they can never turn red in one.
    // 'Other' and unreadable eval types take the
    // follow-up scope (fewer reds) - his call can flip it.
    var evalEl = document.querySelector('input[name="Cust_A_A"]:checked');
    var isNew = !!(evalEl && String(evalEl.value) === '1');
    if (!isNew) { v.rel = false; v.allergies = false; v.dx = false; }
    var s = JSON.stringify(v);
    // Write on change, and re-write every ~20s as a heartbeat
    // while the form stays open: the tile row ignores verdicts
    // older than 2 minutes, so a form closed without a clean
    // clear can never leave a tile stuck red.
    if (s !== tileWarnLast || Date.now() - tileWarnTs > 20000) {
      tileWarnLast = s;
      tileWarnTs = Date.now();
      try { localStorage.setItem('tmTileWarn', JSON.stringify({ age: v.age, allergies: v.allergies, meds: v.meds, rel: v.rel, bims: v.bims, dx: v.dx, key: (chart && chart.key) || null, ts: tileWarnTs })); } catch (e) {}
    }
    tileWarnPublished = true;
    // Open-proof (v1.11): while his note is provably open
    // in THIS document, stamp tmNoteOpen and keep a
    // bounded 15s heartbeat chain alive. The chain lives
    // only while the note field exists - when the form
    // closes, the next pass fails the field check, clears
    // both records, and the chain stops. The dashboard
    // row paints red only while a fresh open-proof
    // exists: no open note, no red tiles - ever.
    try { localStorage.setItem('tmNoteOpen', JSON.stringify({ ts: Date.now() })); } catch (e) {}
    weHoldOpen = true;
    if (!openChain) {
      openChain = true;
      setTimeout(function () { openChain = false; try { publishTileWarn(); } catch (e) {} }, 15000);
    }
  }
  // The records die WITH the form window (his report,
  // 2026-10-19: a Profile painted the meds tile red with
  // no note open anywhere - the verdict and open-proof
  // outlived the closed form by their freshness windows,
  // up to 75s / 2min). pagehide fires when this window
  // or frame closes or navigates away - exactly when
  // the note stops existing. A merely-backgrounded form
  // never fires it, so the live cross-window display
  // (chart reds while he writes behind it) is untouched.
  // Fixture: h147 (form TREE-1539 + profile TREE-1637).
  window.addEventListener('pagehide', function () { try { clearTileWarn(); } catch (e) {} });
  window.addEventListener('beforeunload', function () { try { clearTileWarn(); } catch (e) {} });
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


  function findMedsField(mainField) {
    var tas = document.querySelectorAll('textarea');
    for (var i = 0; i < tas.length; i++) {
      if (tas[i] === mainField) continue;
      var v = tas[i].value || '';
      if (/^\s*Psych meds\s*$/m.test(v) && (/^\s*PLAN\b/m.test(v) || /^\s*DX\b/m.test(v))) return tas[i];
    }
    return null;
  }


  // Triggers (bounded one-shots + his own actions only):
  // input already republishes above; clicks and the boot
  // ladder cover open/paste paths. The 15s heartbeat chain
  // inside publishTileWarn re-arms publishTileWarn itself
  // here (in the old script it re-armed the fill pass).
  var lastClickPub = 0;
  document.addEventListener('click', function (e) {
    if (!e.isTrusted) return;
    var now = Date.now();
    if (now - lastClickPub < 1000) return;
    lastClickPub = now;
    setTimeout(publishTileWarn, 400);
  }, true);
  if (window.__tmCore && window.__tmCore.ladder) window.__tmCore.ladder(function () { publishTileWarn(); }, [800, 2000, 4000, 8000, 15000]);
  else [800, 2000, 4000, 8000, 15000].forEach(function (ms) { setTimeout(publishTileWarn, ms); });
})();