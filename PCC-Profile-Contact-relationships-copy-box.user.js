// ==UserScript==
// @version 1.3
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Profile-Contact-relationships-copy-box.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Profile-Contact-relationships-copy-box.user.js
// @name         PCC Profile - Contact relationships (copy box)
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

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
    for (i = 0; i < tables.length; i++) {
      if (/Contact Type/i.test(tables[i].innerText || '') && !tables[i].querySelector('table')) return tables[i];
    }
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

    if (hdr > -1) {
      for (var j = hdr + 1; j < rows.length; j++) {
        var tds = rows[j].cells;
        if (tds.length <= nameCol) continue;
        add(labelFor(relCol > -1 && tds[relCol] ? cellText(tds[relCol]) : '', cellText(tds[nameCol])));
      }
    } else {                                                     // columns not found: scan whole rows
      var all = table.querySelectorAll('tr');
      for (var q = 0; q < all.length; q++) {
        if (all[q].cells.length < 3) continue;
        add(labelFor('', cellText(all[q])));
      }
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
    box.style.cssText = 'margin:8px 0;padding:10px 12px;border:1px solid #93c5fd;background:#eff6ff;border-radius:8px;font:13px/1.4 -apple-system,sans-serif;max-width:460px;';
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

  setTimeout(run, 800);
  setInterval(run, 1500);
})();