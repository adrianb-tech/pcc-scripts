// ============================================================
// PCC Core - gather READERS (split from gatherer.js in the
// 2.1.0 pipeline build, 2026-10-19). The readers are the
// per-source parsers: assessments list (BIMS + his visit
// dates), Profile (relationships), Results list (labs),
// Orders (psych meds on the orders page). They hold no
// state of their own: the gatherer core passes its context
// (land, packet, publish, nowT, norm, feedRowTile, keys)
// into every call, and the core's same-name shims keep the
// old call sites and the __tmGather test hook working.
// Moved verbatim - behavior is the harness suite's to prove.
// ============================================================
(function () {
  'use strict';

  function ctxt(el) {
    if (!el) return '';
    var c = el.cloneNode(true);
    var junk = c.querySelectorAll('script, style, pre');
    for (var i = 0; i < junk.length; i++) junk[i].remove();
    // ctxt is the readers' own cell-text helper (it predates
    // the split and borrowed the core's norm; it now carries
    // the same collapse inline so it needs no context).
    return (c.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function firstDate(cells) {
    for (var i = 0; i < cells.length; i++) {
      var m = cells[i].match(/\d{1,2}\/\d{1,2}\/\d{4}/);
      if (m) return m[0];
    }
    return '';
  }

  // ---------- fetch readers (proven on his captures) ------
  var BIMS_RE = /BIMS|cognitive|cognitively|impair|intact/i;
  var PSYCH_RE = /psychiatr|psych\s*:|psych\s+consult/i;
  var MDACK_RE = /MD:\s*Psychiatry\s+Consult\s+Ack/i;
  var DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
  var SCORE_RE = /^\d{1,2}(\.\d+)?$/;
  // The BIMS points in ONE assessments list doc - the
  // Score-column core, shared by parseAssessments (the
  // base/rendered list) and the chain's search across
  // form types (gatherer merges these point by point).
  // Null when the doc has no Score column at all.
  function bimsPointsFromList(doc) {
    var heads = doc.querySelectorAll('th, td');
    var hasScore = false;
    for (var i = 0; i < heads.length; i++) if (/^Score$/i.test(ctxt(heads[i]))) { hasScore = true; break; }
    if (!hasScore) return null;
    var points = [], rowsSeen = 0;
    var rows = doc.querySelectorAll('tr');
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (!row.cells || row.cells.length < 6 || row.querySelector('tr')) continue;
      var t = Array.prototype.map.call(row.cells, ctxt);
      var dateStr = firstDate(t);
      if (!dateStr) continue;
      var rowText = t.join(' | ');
      if (MDACK_RE.test(rowText) || PSYCH_RE.test(rowText)) continue;
      var score = t.find(function (c) { return SCORE_RE.test(c); });
      if (score === undefined) continue;
      if (!t.some(function (c) { return BIMS_RE.test(c); })) continue;
      rowsSeen++;
      var n = parseFloat(score);
      // 99 is a real BIMS score - the stop code
      // (interview unable to be completed). The old
      // 0-15 range silently discarded every 99 row,
      // so a resident whose newest BIMS was a 99 kept
      // an ancient score on the tile (his live Bedford
      // case, 2026-10-23: chart 99 on 9/18/2026, tile
      // showed 3 on 8/21/22 - and G transferred the 3).
      if ((n >= 0 && n <= 15) || n === 99) points.push({ date: dateStr, score: n });
    }
    points.sort(function (a, b2) { return new Date(b2.date) - new Date(a.date); });
    return { points: points, rowsSeen: rowsSeen };
  }
  function parseAssessments(doc, G) {
    var bp = bimsPointsFromList(doc);
    if (!bp) {
      // Diagnostic (v2.0.5): name the miss on the stop, as
      // with dashmeds - fetched list vs reader, settled by
      // the next capture instead of another theory. Yields
      // to the MDS chain's census (2026-10-23): when the
      // chain has spoken, its counts are the more specific
      // diagnostic for this stop and must not be clobbered
      // by this older, blunter stamp on a later cycle.
      try { if (G.packet.stops.bims.status !== 'landed' && !/^mds chain:/.test(G.packet.stops.bims.why || '')) { G.packet.stops.bims.why = 'no Score column in fetched list'; G.publish(); } } catch (e) {}
      return;
    }
    var bims = bp.points, bimsRowsSeen = bp.rowsSeen;
    var visits = [], mdAck = '';
    var rows = doc.querySelectorAll('tr');
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (!row.cells || row.cells.length < 6 || row.querySelector('tr')) continue;
      var t = Array.prototype.map.call(row.cells, ctxt);
      var dateStr = firstDate(t);
      if (!dateStr) continue;
      var rowText = t.join(' | ');
      if (MDACK_RE.test(rowText)) { if (!mdAck) mdAck = dateStr; }
      else if (PSYCH_RE.test(rowText)) { visits.push(dateStr); }
    }
    if (!bims.length) {
      try { if (G.packet.stops.bims.status !== 'landed' && !/^mds chain:/.test(G.packet.stops.bims.why || '')) { G.packet.stops.bims.why = 'Score column present; BIMS-like rows matched=' + bimsRowsSeen + ' (0 = the fetched list holds no BIMS rows)'; G.publish(); } } catch (e) {}
    }
    if (bims.length) {
      bims.sort(function (a, b2) { return new Date(b2.date) - new Date(a.date); });
      G.land('bims', { source: 'Assessments', at: G.nowT(), facts: { latest: bims[0].score + ' on ' + bims[0].date }, series: bims.slice(0, 24),
        summary: 'BIMS ' + bims[0].score + ' on ' + bims[0].date + ' · ' + bims.length + ' scored' });
    }
    if (visits.length || mdAck) {
      G.land('ownnotes', { source: 'Assessments', at: G.nowT(),
        summary: (visits.length ? 'Your consults: ' + visits.slice(0, 12).join(', ') : '') + (mdAck ? ' · latest MD acknowledgement ' + mdAck : '') });
    }
    if (visits.length) landHisNotes(visits.map(function (d) { return { date: d, text: null, full: false }; }), G);
  }
  // ---------- BIMS from the MDS page itself (2026-10-23) --
  // The list read above lands BIMS only when he stands on the
  // rendered Assessments list; the fetched list carries no
  // Score column (proven 5/5, 2026-10-19). The MDS's own
  // section page (mdssection.jsp) DOES carry the score in its
  // served HTML at both classic-JSP facilities - proven on
  // his captures by harness h183, whose standalone parses
  // these functions mirror:
  //   Boro Park    TREE-0645/1858: header total printed AND
  //                the Cust_B_BIMS_1..7 slot sum agrees (14).
  //   CNR/Saints   TREE-0643: header total printed (15.0);
  //                the Cust_* item sum agrees (15).
  // The header parse is shared mdssection.jsp furniture: a
  // launchDetailedScores anchor whose text is the bare number
  // (its sibling anchor carries the interpretation label),
  // plus the date in #assessDate. Fail closed throughout.
  function checkedValue(doc, name) {
    var els = doc.querySelectorAll('input[type="radio"][name="' + name + '"]');
    for (var i = 0; i < els.length; i++) if (els[i].checked) return els[i].getAttribute('value');
    return null;
  }
  function parseMdsHeader(doc) {
    var score = null;
    var as = doc.querySelectorAll('a[href*="launchDetailedScores"]');
    for (var i = 0; i < as.length; i++) {
      var t = (as[i].textContent || '').trim();
      if (/^\d+(\.\d+)?$/.test(t)) score = parseFloat(t);
    }
    if (score === null || !((score >= 0 && score <= 15) || score === 99)) return null;
    var ad = doc.getElementById('assessDate');
    var m = ad && /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(ad.textContent || '');
    if (!m) return null;
    return { score: score, date: parseInt(m[1], 10) + '/' + parseInt(m[2], 10) + '/' + m[3] };
  }
  // Boro Park cross-check: the conducted slot's seven items
  // (gate Cust_B_BIMS_A checked=1; the BIMS2 slot is a second
  // administration and is never read). {score} or null.
  function parseBpBimsItems(doc) {
    if (checkedValue(doc, 'Cust_B_BIMS_A') !== '1') return null;
    var sum = 0;
    for (var n = 1; n <= 7; n++) {
      var v = checkedValue(doc, 'Cust_B_BIMS_' + n);
      if (v === null || !/^\d+$/.test(v)) return null;
      sum += parseInt(v, 10);
    }
    return { score: sum };
  }
  // CNR/Saints cross-check: the seven scored items under
  // gate Cust_Ins_1. Cust_SS_1 / Cust_D_* are not score
  // items and are never read. Sum or null.
  function cnrItemSum(doc) {
    if (checkedValue(doc, 'Cust_Ins_1') !== '1') return null;
    var items = ['Cust_A_1', 'Cust_B_1a', 'Cust_B_2a', 'Cust_B_3a', 'Cust_C_1', 'Cust_C_2', 'Cust_C_3'];
    var sum = 0;
    for (var i = 0; i < items.length; i++) {
      var v = checkedValue(doc, items[i]);
      if (v === null || !/^\d+$/.test(v)) return null;
      sum += parseInt(v, 10);
    }
    return sum;
  }
  // Carrier rows in an Assessments list doc (fetched or
  // rendered): a dated row that is not one of his consults
  // or an MD ack, whose text names BIMS or the Social
  // Service Assessment (Boro Park's BIMS rides inside the
  // SS UDA), carrying a verbatim view link (the row's
  // checkForLockPriorToView target, else a direct MDS
  // href). Newest first. The census counts ride along -
  // they are the masked diagnostic that settles whether
  // the FETCHED list exposes these links at all.
  function findBimsViewLinks(doc) {
    var census = { rows: 0, carriers: 0, anchors: 0 };
    var links = [];
    var rows = doc.querySelectorAll('tr');
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (!row.cells || row.cells.length < 5 || row.querySelector('tr')) continue;
      census.rows++;
      var t = Array.prototype.map.call(row.cells, ctxt);
      var dateStr = firstDate(t);
      if (!dateStr) continue;
      var rowText = t.join(' | ');
      if (PSYCH_RE.test(rowText) || MDACK_RE.test(rowText)) continue;
      if (!(/BIMS/i.test(rowText) || /Social Service Assessment/i.test(rowText))) continue;
      census.carriers++;
      var href = '';
      var as = row.querySelectorAll('a[href]');
      for (var i = 0; i < as.length; i++) {
        var h = as[i].getAttribute('href') || '';
        var m = /checkForLockPriorToView\('([^']+)'\)/.exec(h);
        if (m) { href = m[1]; break; }
        if (!href && /(mds\.jsp|mdssection\.jsp)/.test(h)) href = h;
      }
      if (href) { census.anchors++; links.push({ date: dateStr, href: href }); }
    }
    links.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    return { links: links, census: census };
  }
  // Which assessment TYPES on this list page can carry a
  // BIMS? The list is per-type: cp_assessment.jsp serves one
  // ESOLstdassessid at a time, and the background fetch of
  // the chart's list URL returns the tab's own type (his
  // Psych: Consults) - the 'All' value (-1) is NOT honored
  // there (live census 2026-10-23: rows=16 carriers=0 on a
  // resident whose SS rows exist). The list page's own type
  // select names every type the facility runs; the BIMS
  // carriers are the Social Service Assessment types and
  // any type with BIMS in its name. Current versions first,
  // retired last, capped at 3 - ids read from the page
  // itself, never hardcoded (they differ per facility).
  // SEARCH ALL THE FORMS (his direction, 2026-10-23):
  // facilities rename and re-version the BIMS forms
  // constantly - at Bedford the dedicated BIMS form
  // exists ONLY as retired versions (V4/V6/V9/V10) and
  // there is no 'Social Service Assessment' at all, so
  // the old net (that exact phrase or 'BIMS', cap 3)
  // missed carriers by construction. The family net is
  // now the concept words, current first, retired after
  // (newest version first - the newest BIMS usually sits
  // on the highest retired version), cap 10 - and when
  // the family still finds nothing, the gatherer sweeps
  // EVERY type's list (allTypeIds), because the row - a
  // scored BIMS row - is the evidence, not the title.
  var BIMS_TYPE_RE = /BIMS|Brief Interview|Mental Status|Cognitive|Social Service|MDS/i;
  function findBimsTypeIds(doc) {
    var sel = doc.querySelector('select[name="ESOLstdassessid"]');
    if (!sel) return [];
    var found = [];
    var opts = sel.querySelectorAll('option');
    for (var i = 0; i < opts.length; i++) {
      var v = opts[i].getAttribute('value') || '';
      var label = (opts[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (!/^\d+$/.test(v)) continue;
      if (!BIMS_TYPE_RE.test(label)) continue;
      var vm = label.match(/V\s*(\d+)\s*(\(Retired\))?\s*$/i) || label.match(/V\s*(\d+)/i);
      found.push({ id: v, retired: /retired/i.test(label), ver: vm ? parseInt(vm[1], 10) : 0, ord: i });
    }
    found.sort(function (a, b) {
      if (a.retired !== b.retired) return a.retired ? 1 : -1;
      if (a.ver !== b.ver) return b.ver - a.ver;
      return a.ord - b.ord;
    });
    return found.slice(0, 10).map(function (f) { return f.id; });
  }
  function allTypeIds(doc) {
    var sel = doc.querySelector('select[name="ESOLstdassessid"]');
    if (!sel) return [];
    var out = [];
    var opts = sel.querySelectorAll('option');
    for (var i = 0; i < opts.length; i++) {
      var v = opts[i].getAttribute('value') || '';
      if (/^\d+$/.test(v)) out.push(v);
    }
    return out;
  }
  // Union-merge one dated point into the bims stop's series
  // (the landHisNotes discipline: a sighting completes the
  // record, never rivals it). An existing point for the same
  // date stands - the native list read for that date is
  // authoritative over a fetched duplicate.
  function mergeBimsPoint(G, point, strength) {
    // 99 (the stop code) is a valid point - see the list
    // reader's note. Without it here, even a correctly
    // parsed 99 died at the merge.
    if (!point || !((point.score >= 0 && point.score <= 15) || point.score === 99) || !point.date) return;
    var cur = G.packet.stops.bims;
    var inc = strength || G.strength || 'copy';
    if (!cur || cur.status !== 'landed' || !cur.series) {
      G.land('bims', { source: 'Assessments', at: G.nowT(), strength: inc,
        facts: { latest: point.score + ' on ' + point.date }, series: [point],
        summary: 'BIMS ' + point.score + ' on ' + point.date + ' · 1 scored' });
      return;
    }
    var series = cur.series.slice();
    var seen = false;
    for (var i = 0; i < series.length; i++) if (series[i].date === point.date) { seen = true; break; }
    if (!seen) series.push(point);
    series.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    series = series.slice(0, 24);
    var top = series[0];
    cur.series = series;
    cur.facts = { latest: top.score + ' on ' + top.date };
    cur.summary = 'BIMS ' + top.score + ' on ' + top.date + ' · ' + series.length + ' scored';
    cur.at = G.nowT();
    delete cur.why; // a landing retires the diagnostic
    G.publish(); G.saveStored();
  }
  // THE FOURTH EXTRACTOR (his, 2026-10-19): all his notes.
  // The assessments list seeds the DATES of his consults;
  // an opened consult fills in its full text. Entries merge
  // by date: a full text is never downgraded by a later
  // date-only sighting, and a date-only entry is upgraded
  // when its consult is opened. The list carries no note
  // text and no per-consult links (proven on the batch
  // fixtures), so full texts come only from consults he
  // opens - the pipe says so on its face (full:false).
  function landHisNotes(entries, G) {
    var cur = G.packet.stops.hisnotes;
    var byDate = {};
    if (cur.status === 'landed' && cur.list) cur.list.forEach(function (e) { byDate[e.date] = e; });
    entries.forEach(function (e) {
      var old = byDate[e.date];
      if (!old) { byDate[e.date] = e; return; }
      if (e.full && !old.full) byDate[e.date] = e;
      else if (e.full && old.full && (e.text || '').length > (old.text || '').length) byDate[e.date] = e;
    });
    var list = Object.keys(byDate).map(function (k) { return byDate[k]; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, 24);
    var fullN = list.filter(function (e) { return e.full; }).length;
    var rec = { source: 'Assessments', at: G.nowT(), list: list,
      summary: 'Your notes: ' + list.length + ' consults · ' + fullN + ' full text · latest ' + (list[0] ? list[0].date : '-') };
    if (cur.status !== 'landed') { G.land('hisnotes', rec); return; }
    // The merge is a union, not a rival landing: it replaces
    // at equal strength (a later sighting of the same room
    // family completes the record), and a weaker merge never
    // displaces a stronger stop - the landRelations
    // discipline, since land() itself keeps the first at
    // equal strength by design.
    var inc = G.strength || 'copy';
    var RANK = { weak: 0, copy: 1, native: 2 };
    if ((RANK[inc] || 0) < (RANK[cur.strength || 'copy'] || 0)) return;
    rec.strength = inc;
    rec.status = 'landed';
    G.packet.stops.hisnotes = rec;
    G.publish(); G.saveStored();
  }
  // An opened consult (mdssection, the Cust section): the
  // note's full text lives in its Cust_* textareas (the
  // narrative field carried 1,162 chars in the TREE-1539
  // fixture); the Evaluation Type is the checked Cust_A_A
  // radio (1 New / 2 Follow Up / 3 Other, the form's own
  // labels); the note's date is the form's last-edited
  // date - the day he wrote/signed it.
  function parseOpenedConsult(doc, G) {
    var tas = doc.querySelectorAll('textarea[name^="Cust_"]');
    if (!tas.length) return;
    var parts = [];
    for (var i = 0; i < tas.length; i++) { var v = (tas[i].value || '').trim(); if (v) parts.push(v); }
    if (!parts.length) return;
    var ed = doc.querySelector('input[name="ESOLediteddate"]');
    var dm = ed && /^(\d{4})-(\d{2})-(\d{2})/.exec(ed.value || '');
    if (!dm) return;
    var date = parseInt(dm[2], 10) + '/' + parseInt(dm[3], 10) + '/' + dm[1];
    var radio = doc.querySelector('input[name="Cust_A_A"]:checked');
    var evalNames = { '1': 'New', '2': 'Follow Up', '3': 'Other' };
    var entry = { date: date, text: parts.join('\n').slice(0, 1500), full: true };
    if (radio && evalNames[radio.value]) entry.evalType = evalNames[radio.value];
    landHisNotes([entry], G);
  }
  // Late truth replaces early guesses (v2.7): his
  // 04:46 Profile landed relations as 'self' - the word
  // scan ran before the Contacts table rendered and
  // first-wins froze it, while both carriers on the page
  // held the true '5 daughters, son'. Rules: a carrier
  // or heading value is STRONG and always replaces; the
  // word scan is WEAK, lands only when nothing landed,
  // and never lands at all while a carrier element
  // exists (its value is still on its way).
  var relationsWeak = false;
  // SELF (his rule, 2026-10-23): 'self' is extracted
  // only when it is the ONLY contact. When anyone else
  // is named, the word 'self' never enters the summary
  // - not on the tile, not in the G fill, not in the
  // verdict compare. Applied at every landing funnel.
  function dropSelfUnlessAlone(summary) {
    var parts = String(summary || '').split(/,\s*/).filter(function (p) { return !!p.trim(); });
    if (parts.length < 2) return summary;
    var rest = parts.filter(function (p) { return !/^self$/i.test(p.trim()); });
    if (rest.length && rest.length !== parts.length) return rest.join(', ');
    return summary;
  }
  function landRelations(summary, G) {
    var cur = G.packet.stops.relations;
    summary = dropSelfUnlessAlone(G.norm(summary).slice(0, 300));
    // The section's own heading is not a fact: a value that
    // is only the label (plus dashes/colons) never lands.
    if (/^relationships\b[\s:—–-]*$/i.test(summary)) return;
    if (cur.status !== 'landed') {
      G.land('relations', { source: 'Profile', at: G.nowT(), summary: summary });
      G.feedRowTile(summary);
      return;
    }
    if (cur.summary !== summary) {
      // Strength law (contract rule 3): a copy never
      // displaces a native read of this session; equal or
      // stronger replaces. (Also: the repaint now rides
      // G.publish, which is settle-gated - no direct event -
      // and persistence goes through G.saveStored; the bare
      // saveStored() this path used to call never existed in
      // this module and threw silently after publishing.)
      var inc = G.strength || 'copy';
      var RANK = { weak: 0, copy: 1, native: 2 };
      if ((RANK[inc] || 0) < (RANK[cur.strength || 'copy'] || 0)) return;
      G.packet.stops.relations = { status: 'landed', source: 'Profile', at: G.nowT(), summary: summary, strength: inc };
      relationsWeak = false;
      G.feedRowTile(summary);
      G.publish(); G.saveStored();
    }
  }
  // The native Contacts table (v2.8) - the source the G
  // engine itself reads. Present in the raw Profile HTML,
  // so a FETCH of the Profile lands relations from any
  // page he arrives on. Relation comes from the Relation
  // column, or from a (SISTER)-style parenthetical in the
  // name cell when the column is blank (1901). Format
  // mirrors his tile: 'self' first, then counts by size,
  // ties in table order ('5 daughters, son').
  var RELSET = { self: 1, spouse: 1, wife: 1, husband: 1, daughter: 1, son: 1, sister: 1, brother: 1, mother: 1, father: 1, friend: 1, niece: 1, nephew: 1, partner: 1, guardian: 1, cousin: 1, grandson: 1, granddaughter: 1, aunt: 1, uncle: 1, 'daughter-in-law': 1, 'son-in-law': 1, 'mother-in-law': 1, 'father-in-law': 1, 'sister-in-law': 1, 'brother-in-law': 1 };
  // Relationships, contacts-table truth (2.1.1): the
  // gatherer's old table parse only counted rows whose
  // relationship word sat in its RELSET list - "Neighbor"
  // and "Other" are not in it, so a resident whose contacts
  // are 2 neighbors, a friend and an other landed as just
  // "friend", got saved, and was copied into his note
  // (his report, 2026-10-19; fixture h135, TREE-1440 pair).
  // The parse below is the Relationships extractor's own
  // proven table logic, ported so both engines give ONE
  // answer: the table is found by its real header row
  // (Name + Contact Type), each row's label comes from the
  // name's parenthetical or the Relation column (a value
  // the table states is a fact - no word-list gate), and
  // duplicates count in first-appearance order.
  var RELS = [
    [/\bgirl[\s-]*friends?\b/, 'girlfriend', 'girlfriends'],
    [/\bwife\b/, 'wife', 'wives'],
    [/\bhusband\b/, 'husband', 'husbands'],
    [/\bspouse\b/, 'spouse', 'spouses'],
    [/\bfianc[e\u00e9]e?\b/, 'fianc\u00e9', 'fianc\u00e9s'],
    [/\bdaughters?\b/, 'daughter', 'daughters'],
    [/\bsons?\b/, 'son', 'sons'],
    [/\bmother\b|\bmom\b/, 'mother', 'mothers'],
    [/\bfather\b|\bdad\b/, 'father', 'fathers'],
    [/\bsisters?\b/, 'sister', 'sisters'],
    [/\bbrothers?\b/, 'brother', 'brothers'],
    [/\bsiblings?\b/, 'sibling', 'siblings'],
    [/\bpartner\b/, 'partner', 'partners'],
    [/\bfriends?\b/, 'friend', 'friends'],
    [/\bneighbou?rs?\b/, 'neighbor', 'neighbors'],
    [/\broommates?\b/, 'roommate', 'roommates'],
    [/\bnieces?\b/, 'niece', 'nieces'],
    [/\bnephews?\b/, 'nephew', 'nephews'],
    [/\bcousins?\b/, 'cousin', 'cousins'],
    [/\bgranddaughters?\b/, 'granddaughter', 'granddaughters'],
    [/\bgrandsons?\b/, 'grandson', 'grandsons'],
    [/\baunt\b/, 'aunt', 'aunts'],
    [/\buncle\b/, 'uncle', 'uncles'],
    [/\bclergy\b|\bpastor\b|\bpriest\b|\bminister\b|\bimam\b|\brabbi\b/, 'clergy', 'clergy'],
    [/\bnurse\b/, 'nurse', 'nurses'],
    [/\bothers?\b/, 'other', 'others'],
    [/\bself\b/, 'self', 'self']
  ];
  RELS.forEach(function (r) { r[0] = new RegExp(r[0].source, 'i'); });
  var REL_NO_COUNT = { self: true };
  var REL_NAME_SKIP = { other: 1, nurse: 1, clergy: 1, self: 1 };
  function relCanon(text) {
    for (var k = 0; k < RELS.length; k++) {
      if (RELS[k][0].test(text)) return { c: RELS[k][1], p: RELS[k][2] };
    }
    return null;
  }
  function relTidy(t) { return /^[A-Z]{2,4}$/.test(t) ? t : t.toLowerCase(); }
  function relLabelFor(relText, nameText, G) {
    var re = /\(([^()]*[A-Za-z][^()]*)\)/g, m, unknown = null;
    while ((m = re.exec(nameText))) {
      var t = G.norm(m[1]);
      if (!t) continue;
      var c = relCanon(t);
      if (c) return c;
      if (!unknown) unknown = { c: relTidy(t), p: null };
    }
    var r = G.norm(relText);
    if (r && !/^(n\/?a|none|-+)$/i.test(r)) return relCanon(r) || { c: relTidy(r), p: null };
    if (unknown) return unknown;
    for (var k = 0; k < RELS.length; k++) {
      if (!REL_NAME_SKIP[RELS[k][1]] && RELS[k][0].test(nameText)) return { c: RELS[k][1], p: RELS[k][2] };
    }
    return null;
  }
  function parseContacts(doc, G) {
    var tables = doc.querySelectorAll('table');
    for (var ti = 0; ti < tables.length; ti++) {
      var rows = tables[ti].querySelectorAll('tr');
      var hdr = -1, nameCol = -1, relCol = -1;
      for (var i = 0; i < rows.length; i++) {
        var cells = rows[i].querySelectorAll('td, th');
        var texts = [];
        for (var c0 = 0; c0 < cells.length; c0++) texts.push(ctxt(cells[c0]));
        var n = -1;
        for (var c1 = 0; c1 < texts.length; c1++) if (/^name\b/i.test(texts[c1])) { n = c1; break; }
        var hasCT = false, rc = -1;
        for (var c2 = 0; c2 < texts.length; c2++) {
          if (/^contact type\b/i.test(texts[c2])) hasCT = true;
          if (/^relation(ship)?\b/i.test(texts[c2])) rc = c2;
        }
        if (n > -1 && hasCT) { hdr = i; nameCol = n; relCol = rc; break; }
      }
      if (hdr === -1) continue;
      var counts = {}, order = [], plural = {};
      function add(lab) {
        if (!lab) return;
        if (!(lab.c in counts)) { counts[lab.c] = 0; order.push(lab.c); plural[lab.c] = lab.p; }
        counts[lab.c]++;
      }
      for (var j = hdr + 1; j < rows.length; j++) {
        var tds = rows[j].querySelectorAll('td');
        if (tds.length <= nameCol) continue;
        add(relLabelFor(relCol > -1 && tds[relCol] ? ctxt(tds[relCol]) : '', ctxt(tds[nameCol]), G));
      }
      if (!order.length) continue;
      return order.map(function (cn) {
        if (REL_NO_COUNT[cn]) return cn;
        var n2 = counts[cn];
        if (n2 < 2) return cn;
        return plural[cn] ? n2 + ' ' + plural[cn] : cn + ' (' + n2 + ')';
      }).join(', ');
    }
    return '';
  }
  function parseProfile(doc, G) {
    var el = doc.querySelector('[data-fill-label="Relationships"]');
    // Never read our own tile as the carrier: every tile
    // carries data-fill-label for the G/fill system, and the
    // live-page parse would land the tile's own placeholder
    // ("RELATIONSHIPS —") as the relations fact, first-wins
    // blocking the real contacts (live capture TREE-1141).
    if (el && ((el.tagName && el.tagName.toLowerCase() === 'tm-tile') ||
               (el.closest && el.closest('tm-tile')))) el = null;
    var val = el ? (el.getAttribute('data-fill-value') || G.txt(el)) : '';
    if (!val || /^[—–-]+$/.test(G.norm(val)) || /^N\/?A$/i.test(G.norm(val))) {
      var cv = parseContacts(doc, G);
      if (cv) { landRelations(cv, G); return; }
    }
    if (!val) {
      var els = doc.querySelectorAll('div, span, td');
      for (var i = 0; i < els.length; i++) {
        if (els[i].closest && els[i].closest('tm-tile')) continue; // never our own tile (self-quote)
        if (/^Relationships$/i.test(G.txt(els[i])) && els[i].parentElement) {
          var pt = G.txt(els[i].parentElement);
          if (pt.length > 14) { val = pt.replace(/^Relationships\s*/i, ''); break; }
        }
      }
    }
    if (val && !/^[—–-]+$/.test(G.norm(val)) && !/^N\/?A$/i.test(G.norm(val))) {
      landRelations(val, G);
      return;
    }
    if (el) return; // carrier exists, value still coming
    if (!val && /Resident Profile/i.test(doc.title || '')) {
      // Fetched Profile pages carry PCC's native contacts,
      // not the tile box: collect the relation words.
      // 'self' is NOT in the free-text scan: the word appears
      // all over a profile (self-administer, self-pay) and a
      // noise hit landed "self" as a resident's relation
      // (live capture TREE-1202; the real contact was a
      // cousin - a word the lists didn't know at all).
      var words = ['spouse', 'wife', 'husband', 'daughter', 'son', 'sister', 'brother', 'mother', 'father', 'friend', 'niece', 'nephew', 'partner', 'guardian', 'cousin', 'grandson', 'granddaughter', 'aunt', 'uncle'];
      var bodyT = (doc.body && doc.body.textContent) || '';
      var found = words.filter(function (wd) { return new RegExp('\\b' + wd + '\\b', 'i').test(bodyT); });
      if (found.length) val = found.join(', ');
    }
    // A placeholder is not a fact: the tile row shows '-'
    // until a grab, and landing it first would block the
    // real value (land is first-wins). His live Dash test
    // landed relations as '-' - never again.
    if (val && !/^[—–-]+$/.test(G.norm(val)) && !/^N\/?A$/i.test(G.norm(val))) {
      if (G.packet.stops.relations.status !== 'landed') {
        relationsWeak = true;
        G.land('relations', { source: 'Profile', at: G.nowT(), strength: 'weak', summary: dropSelfUnlessAlone(G.norm(val).slice(0, 300)) });
      }
    }
  }
  function parseResults(doc, G) {
    var reports = [];
    var rows = doc.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
      var link = rows[i].querySelector('[onclick*="viewReportPopup"]');
      if (!link) continue;
      var cells = rows[i].cells ? Array.prototype.map.call(rows[i].cells, ctxt) : [];
      var date = firstDate(cells);
      var name = '';
      for (var k = 0; k < cells.length; k++) if (cells[k].length > name.length && !/Actions/i.test(cells[k])) name = cells[k];
      reports.push({ name: name.slice(0, 80), date: date });
    }
    if (reports.length) {
      G.land('labs', { source: 'Results', at: G.nowT(), reports: reports.slice(0, 40),
        summary: reports.length + ' reports · latest ' + (reports[0].name || '') + ' ' + (reports[0].date || '') });
    }
  }
  // A single lab report's analytes (the View Lab Report
  // page; fixture TREE-1537__2): the results table's header
  // carries 'Ref. Range' + 'Flag'; analyte rows carry name /
  // result / units / range / PCC's own flag. Panel header
  // rows (name only) are skipped. PCC's flags are taken as
  // fact - ranges are never invented (his rule).
  function parseLabReport(doc, G) {
    var tables = doc.querySelectorAll('table');
    var tbl = null;
    for (var i = 0; i < tables.length; i++) {
      var h = tables[i].querySelector('tr');
      if (h && /Ref\. Range/i.test(h.textContent || '') && /Flag/i.test(h.textContent || '')) { tbl = tables[i]; break; }
    }
    if (!tbl) return;
    // The report's date: the first date in the page's
    // header matter (Result for: ... and the order block).
    var date = '';
    var allText = (doc.body && doc.body.textContent) || '';
    var dm = /(?:Collected|Result Date|Report Date|Ordered)[^0-9]{0,20}(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(allText);
    if (dm) date = dm[1];
    if (!date) { var any = /(\d{1,2}\/\d{1,2}\/\d{4})/.exec(allText); if (any) date = any[1]; }
    var analytes = [];
    var rows = tbl.querySelectorAll('tr');
    for (var r2 = 1; r2 < rows.length; r2++) {
      var cells = rows[r2].cells ? Array.prototype.map.call(rows[r2].cells, ctxt) : [];
      if (cells.length < 6) continue;
      var name = cells[1] || '';
      var value = cells[2] || '';
      if (!name || !value || !/^[\d.<>]+/.test(value)) continue;
      analytes.push({ name: name.slice(0, 60), value: value, units: cells[3] || '', flag: (cells[5] || '').trim().slice(0, 3), date: date });
    }
    if (!analytes.length) return;
    // Merge into the labs stop: reports (from the Results
    // list) and analytes (from report pages) coexist; the
    // union replaces at equal strength, weaker never
    // displaces - the hisnotes discipline.
    var cur = G.packet.stops.labs;
    var rec = { source: 'Results', at: G.nowT(), reports: (cur.status === 'landed' && cur.reports) || [], analytes: analytes,
      summary: ((cur.status === 'landed' && cur.reports) ? cur.reports.length + ' reports · ' : '') + analytes.length + ' analytes from report ' + date };
    if (cur.status !== 'landed') { G.land('labs', rec); return; }
    var inc = G.strength || 'copy';
    var RANK = { weak: 0, copy: 1, native: 2 };
    if ((RANK[inc] || 0) < (RANK[cur.strength || 'copy'] || 0)) return;
    rec.strength = inc; rec.status = 'landed';
    G.packet.stops.labs = rec;
    G.publish(); G.saveStored();
  }
  var PSYCH_MED_RE = /alprazolam|xanax|citalopram|celexa|escitalopram|lexapro|sertraline|zoloft|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|venlafaxine|effexor|duloxetine|cymbalta|desvenlafaxine|bupropion|wellbutrin|mirtazapine|remeron|trazodone|nefazodone|vilazodone|vortioxetine|clozapine|clozaril|olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|paliperidone|invega|aripiprazole|abilify|ziprasidone|geodon|lurasidone|latuda|cariprazine|brexpiprazole|haloperidol|haldol|fluphenazine|chlorpromazine|perphenazine|loxapine|asenapine|iloperidone|divalproex|depakote|valproate|lamotrigine|lamictal|carbamazepine|tegretol|oxcarbazepine|lithium|gabapentin|neurontin|pregabalin|lyrica|topiramate|hydroxyzine|vistaril|buspirone|clonazepam|klonopin|lorazepam|ativan|diazepam|valium|temazepam|zolpidem|ambien|eszopiclone|zaleplon|ramelteon|suvorexant|doxepin|amitriptyline|nortriptyline|imipramine|clomipramine|methylphenidate|amphetamine|adderall|lisdexamfetamine|vyvanse|atomoxetine|guanfacine|clonidine|prazosin|propranolol|benztropine|donepezil|memantine|rivastigmine|galantamine|naltrexone|acamprosate|disulfiram|methadone|buprenorphine/i;
  function parseOrders(doc, G) {
    var active = [], psych = [];
    var rows = doc.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row.cells || row.cells.length < 5) continue;
      var t = Array.prototype.map.call(row.cells, ctxt);
      var statusIdx = t.findIndex(function (c) { return /^Active$/i.test(c); });
      if (statusIdx < 0) continue;
      // The sig cell ('Give 1 tablet by mouth...') anchors the
      // medication cell right before it (layout rows carry
      // empty and Actions cells ahead of the pair).
      var sigIdx = t.findIndex(function (c) { return /^(Give|Apply|Inject|Take|Instill|Inhale)\b/i.test(c); });
      var medCell = sigIdx > 0 ? t[sigIdx - 1] : '';
      var sig = sigIdx >= 0 ? t[sigIdx] : '';
      var start = '';
      for (var k = statusIdx + 1; k < t.length; k++) if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(t[k])) { start = t[k]; break; }
      if (!medCell) continue;
      var rec = { name: medCell.slice(0, 90), sig: sig.slice(0, 140), start: start.slice(0, 16) };
      active.push(rec);
      if (PSYCH_MED_RE.test(medCell)) psych.push(rec);
    }
    if (active.length) {
      G.land('orders', { source: 'Orders', at: G.nowT(), active: active.length, psych: psych.slice(0, 30),
        summary: active.length + ' active orders · ' + psych.length + ' psychiatric: ' +
          psych.slice(0, 8).map(function (p) { return p.name; }).join('; ') });
    }
  }

  window.__tmReaders = {
    parseAssessments: parseAssessments,
    parseOpenedConsult: parseOpenedConsult,
    parseLabReport: parseLabReport,
    parseProfile: parseProfile,
    parseResults: parseResults,
    parseOrders: parseOrders,
    parseMdsHeader: parseMdsHeader,
    parseBpBimsItems: parseBpBimsItems,
    cnrItemSum: cnrItemSum,
    findBimsViewLinks: findBimsViewLinks,
    findBimsTypeIds: findBimsTypeIds,
    allTypeIds: allTypeIds,
    bimsPointsFromList: bimsPointsFromList,
    mergeBimsPoint: mergeBimsPoint
  };
})();
