// ==UserScript==
// @name         Every facility — Page capture (temporary diagnostic)
// @namespace    mica.pcc
// @version      1.11
// @description  Page capture + review courier (v1.4): the green HTML button downloads the frame tree with live probes and embeds unsent feedback records. The REVIEW button downloads the periodic review file: every unsent judgement paired with the pruned page snapshot stored at the moment he judged (snapshots live in IndexedDB 'pnReview'); both are marked sent so each rides exactly once.
// @match        https://*.pointclickcare.com/*
// @match        https://*.pointclickcare.ca/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Page-capture.user.js
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Page-capture.user.js
// ==/UserScript==
(function () {
  'use strict';

  var btn = document.createElement('button');
  btn.textContent = 'HTML';
  btn.setAttribute('style', [
    'position:fixed', 'right:14px', 'bottom:14px', 'z-index:2147483647',
    'background:#2f6f4f', 'color:#ffffff', 'border:none', 'border-radius:10px',
    'padding:12px 18px', 'font:700 15px -apple-system, "Segoe UI", Roboto, sans-serif',
    'cursor:pointer', 'box-shadow:0 4px 14px rgba(0,0,0,.35)'
  ].join(';'));

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  function probes(doc) {
    var out = [];
    try {
      var t = ((doc.body && doc.body.innerText) || '').toLowerCase();
      out.push("rendered text: 'view all'=" + (t.indexOf('view all') !== -1) +
               " 'add progress note'=" + (t.indexOf('add progress note') !== -1) +
               " 'progress note'=" + (t.indexOf('progress note') !== -1) +
               " 'effective date'=" + (t.indexOf('effective date') !== -1));
    } catch (e) { out.push('rendered text: ERROR ' + e.message); }
    try {
      var b = doc.querySelector('[data-testid="pn-view-all-btn"]');
      if (b) {
        var r = b.getBoundingClientRect();
        var cs = doc.defaultView.getComputedStyle(b);
        out.push('pn-view-all-btn: rect=' + Math.round(r.width) + 'x' + Math.round(r.height) +
                 ' at ' + Math.round(r.left) + ',' + Math.round(r.top) +
                 ' display=' + cs.display + ' visibility=' + cs.visibility +
                 ' offsetParent=' + (b.offsetParent ? b.offsetParent.tagName : 'null') +
                 ' disabled=' + b.disabled);
      } else out.push('pn-view-all-btn: NOT FOUND');
    } catch (e) { out.push('pn-view-all-btn: ERROR ' + e.message); }
    try {
      // Header shape (v1.8): the header block's skeleton -
      // tags, classes, punctuation - with every word of 3+
      // letters masked to ### BY THE SCRIPT ITSELF, so the
      // capture can teach the redactor the name's real shape
      // without the name ever being in the file.
      var tsp = null, allSp = doc.querySelectorAll('span');
      for (var si = 0; si < allSp.length; si++) {
        if ((allSp[si].textContent || '').replace(/\s+/g, ' ').trim() === 'Progress Notes - View All') { tsp = allSp[si]; break; }
      }
      var hroot = tsp;
      for (var hu = 0; hroot && hu < 3; hu++) hroot = hroot.parentElement;
      if (hroot) {
        var shape = hroot.outerHTML
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/[A-Za-z]{3,}/g, '###')
          .replace(/\s+/g, ' ')
          .slice(0, 1600);
        out.push('HEADER SHAPE: ' + shape);
      } else out.push('HEADER SHAPE: title span not found');
    } catch (e) { out.push('HEADER SHAPE: ERROR ' + e.message); }
    try {
      out.push('#tmPnViewAllF=' + doc.querySelectorAll('#tmPnViewAllF').length +
               ' .pcc-f-btn=' + doc.querySelectorAll('.pcc-f-btn').length +
               ' #pcc-a-badge=' + doc.querySelectorAll('#pcc-a-badge').length +
               ' #pnDxBox=' + doc.querySelectorAll('#pnDxBox').length +
               ' #tmGBtn=' + doc.querySelectorAll('#tmGBtn').length);
    } catch (e) {}
    return out.join('\n');
  }

  // His feedback store rides inside the capture (v1.3,
  // designed with him): the verdicts/corrections the Behavior
  // and Diagnosis tiles saved in this browser are embedded in
  // the file he sends, marked sent afterwards so they only
  // ride once. Nothing is uploaded anywhere by the script -
  // the file goes where HE sends it.
  function feedbackBlock() {
    var all = [];
    try { all = JSON.parse(localStorage.getItem('pnFeedback') || '[]'); } catch (e) {}
    if (!Array.isArray(all)) all = [];
    var unsent = all.filter(function (r) { return !r.sent; });
    var payload = JSON.stringify({ total: all.length, unsent: unsent }).replace(/<\//g, '<\\/');
    // Since v1.7 the HTML capture embeds a COPY of the unsent
    // judgements but does NOT mark them sent: REVIEW is the
    // delivery channel now, and a one-off capture photo must
    // not empty the pile before the batch goes out. (This
    // competition is why his fresh judgement 'vanished'.)
    return '\n\n<!-- ================= PN FEEDBACK STORE (copy of unsent judgements; REVIEW delivers them) ================= -->\n' +
      '<script type="application/json" id="pn-feedback-store">' + payload + '</' + 'script>';
  }

  // Auto-redaction (v1.5; name format fixed v1.6): every
  // SAVED file is stripped before it exists. The resident's
  // name is learned the way the S key finds it (proven on the
  // live pages): an element whose text STARTS with
  // 'Last, First (CODE)' - there is no 'Resident:' label in
  // PCC's header, which is why v1.5 learned nothing. Name ->
  // RESIDENT everywhere; the chart code, DOB, MRN -> X; the
  // chart id comes out of URLs. Live page never touched.
  var learnedCodes = [];
  function nameVariants(last, first) {
    var lastTitle = last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
    var out = [];
    [last + ', ' + first, first + ' ' + last, lastTitle, last, first]
      .forEach(function (n) { if (n && n.length > 2) out.push(n); });
    return out.sort(function (a, b) { return b.length - a.length; });
  }
  function parseName(raw, code) {
    var parts = String(raw).split(',');
    if (parts.length < 2) return [];
    var last = parts[0].trim();
    var first = parts.slice(1).join(',').trim().split(/\s+/)[0];
    if (code && learnedCodes.indexOf(code) === -1) learnedCodes.push(code);
    return nameVariants(last, first);
  }
  var NAME_EL = /^([A-Za-z][A-Za-z'\u2019.\-]+(?:\s+[A-Za-z][A-Za-z'\u2019.\-]+)?\s*,\s*[A-Za-z][A-Za-z'\u2019.\- ]+?)\s*\(\s*([A-Za-z]{0,5}\d{3,})\s*\)/;
  function learnNamesFromText(text) {
    var m = /Resident:\s*([A-Z][A-Za-z' -]+),\s*([A-Z][A-Za-z]+)/.exec(text || '');
    if (m) return nameVariants(m[1].trim(), m[2].trim());
    var hi = (text || '').indexOf('Progress Notes - View All');
    if (hi !== -1) {
      var near = (text || '').slice(hi, hi + 400);
      var hm = /([A-Z][A-Za-z'\u2019\-]+(?:\s+[A-Z][A-Za-z'\u2019\-]+)?)\s*,\s*([A-Z][A-Za-z'\u2019\-]+)/.exec(near);
      if (hm) return parseName(hm[1] + ', ' + hm[2], '');
    }
    var W = "[A-Za-z][A-Za-z'\u2019.\-]+";
    for (var words = 1; words <= 3; words++) {
      var pat = '(' + W + '(?:\s+' + W + '){' + (words - 1) + '}' +
        '\\s*,\\s*[A-Za-z][A-Za-z\'\u2019.\\- ]*?)\\s*\\(\\s*([A-Za-z]{0,5}\\d{3,})\\s*\\)';
      var mm = new RegExp(pat).exec(text || '');
      if (mm) return parseName(mm[1].replace(/\s+/g, ' ').trim(), mm[2]);
    }
    return [];
  }
  function learnNames(doc) {
    try {
      var els = doc.querySelectorAll('span, div, h1, h2, h3, td, a, b, strong');
      for (var i = 0; i < els.length; i++) {
        var tx = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (tx.length > 70 || tx.length < 5) continue;
        if (/^clinical\s/i.test(tx)) continue;
        var em = NAME_EL.exec(tx);
        if (em) return parseName(em[1].trim(), em[2]);
      }
      // The Progress Notes header carries the name WITHOUT the
      // (CODE) suffix: learn it inside that header block only -
      // the block holding the 'Progress Notes - View All'
      // title - from an element starting 'Last, First'.
      var spans = doc.querySelectorAll('span');
      for (var s = 0; s < spans.length; s++) {
        if ((spans[s].textContent || '').replace(/\s+/g, ' ').trim() !== 'Progress Notes - View All') continue;
        // Candidates from up to 3 ancestor levels, SHORTEST
        // text first: a wrapper div glues the name to the
        // next label ('WendyDOB'), corrupting the parse - the
        // name's own small element always parses clean.
        var cands = [];
        var block = spans[s].parentElement;
        for (var up = 0; block && up < 3; up++) {
          var inner = block.querySelectorAll('span, div, a, b, strong');
          for (var j = 0; j < inner.length; j++) {
            var itx = (inner[j].textContent || '').replace(/\s+/g, ' ').trim();
            if (itx.length > 60 || itx.length < 5) continue;
            if (itx === 'Progress Notes - View All') continue;
            cands.push(itx);
          }
          block = block.parentElement;
        }
        cands.sort(function (a, b) { return a.length - b.length; });
        for (var c = 0; c < cands.length; c++) {
          var im = /^([A-Z][A-Za-z'\u2019\-]+(?:\s+[A-Z][A-Za-z'\u2019\-]+)?)\s*,\s*([A-Z][A-Za-z'\u2019\-]+)/.exec(cands[c]);
          if (im) return parseName(im[1] + ', ' + im[2], '');
        }
        break;
      }
    } catch (e) {}
    // Path 4 (v1.11): the name's own element, wherever it sits -
    // a SHORT element whose text starts 'Last, First' with no
    // required suffix. Topmost on the page wins (the header
    // zone), then shortest. Long prose can't qualify.
    try {
      var els4 = doc.querySelectorAll('span, div, td, a, b, strong, li, h1, h2, h3');
      var hits = [];
      for (var q = 0; q < els4.length; q++) {
        var qtx = (els4[q].textContent || '').replace(/\s+/g, ' ').trim();
        if (qtx.length > 80 || qtx.length < 5) continue;
        if (/^clinical\s/i.test(qtx)) continue;
        var qm = /^([A-Z][A-Za-z'\u2019\-]+(?:\s+[A-Z][A-Za-z'\u2019\-]+)?)\s*,\s*([A-Z][A-Za-z'\u2019\-]+)/.exec(qtx);
        if (qm) {
          var qr = null;
          try { qr = els4[q].getBoundingClientRect(); } catch (e) {}
          hits.push({ tx: qtx, top: qr ? qr.top : 9999, m: qm });
        }
      }
      hits.sort(function (a, b) { return (a.top - b.top) || (a.tx.length - b.tx.length); });
      if (hits.length) return parseName(hits[0].m[1] + ', ' + hits[0].m[2], '');
    } catch (e) {}
    try { return learnNamesFromText((doc.body && doc.body.textContent) || ''); } catch (e) { return []; }
  }

  // Masked shapes of the name-candidate elements (v1.11):
  // shows the redactor exactly how the name element is built
  // on this page - punctuation visible, every word masked.
  function nameShapes(doc) {
    var out = [];
    try {
      var els = doc.querySelectorAll('span, div, td, a, b, strong, li');
      for (var i = 0; i < els.length && out.length < 4; i++) {
        var tx = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (tx.length > 80 || tx.length < 5) continue;
        if (/^[A-Z][A-Za-z'\u2019\-]+(?:\s+[A-Z][A-Za-z'\u2019\-]+)?\s*,\s*[A-Z][A-Za-z'\u2019\-]+/.test(tx)) {
          out.push(tx.replace(/[A-Za-z]{3,}/g, '###').replace(/\d{3,}/g, '###'));
        }
      }
    } catch (e) {}
    return out;
  }
  function redactStr(s, names) {
    var out = String(s);
    (names || []).forEach(function (n) {
      var rx = new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      out = out.replace(rx, 'RESIDENT');
    });
    learnedCodes.forEach(function (c) { out = out.split(c).join('X'); });
    out = out.replace(/ESOLclientid=\d+/g, 'ESOLclientid=X');
    out = out.replace(/\b(DOB|Date of Birth)[:\s]*\d{1,2}\/\d{1,2}\/\d{2,4}/gi, '$1: X');
    out = out.replace(/\b(MRN|Medical Record #|Chart #)[:\s]*\d{4,}/gi, '$1: X');
    return out;
  }

  function walk(doc, depth, lines, counter) {
    var n = counter.value++;
    var head = '\n\n<!-- ================= DOC ' + n + ' (depth ' + depth + ') url=' +
      esc(doc.location ? doc.location.href : '?') + ' contentType=' + esc(doc.contentType || '?') +
      ' readyState=' + esc(doc.readyState || '?') + ' iframes=' + doc.querySelectorAll('iframe').length + ' ================= -->\n' +
      '<!-- PROBES (live, at download time):\n' + probes(doc) + '\n-->\n';
    var html = '';
    try { html = doc.documentElement ? doc.documentElement.outerHTML : '(no documentElement)'; }
    catch (e) { html = '(outerHTML failed: ' + e.message + ')'; }
    var names = learnNames(doc);
    lines.push(redactStr(head, names) + redactStr(html, names));
    var frames = doc.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      var cd = null;
      try { cd = frames[i].contentDocument; } catch (e) {}
      if (cd) walk(cd, depth + 1, lines, counter);
      else lines.push('\n\n<!-- DOC (depth ' + (depth + 1) + ') iframe ' + i + ': INACCESSIBLE (cross-origin or not loaded) -->');
    }
  }

  btn.addEventListener('click', function () {
    btn.disabled = true;
    btn.textContent = 'WAIT 3s...';
    // The delay is the point: several scripts plant their
    // badges a fraction of a second AFTER a click. Photograph
    // the page at +3s, not in the click itself.
    setTimeout(function () {
      try {
        var lines = [redactStr('<!-- PCC TREE CAPTURE v1.10 (delayed 3s) ' + new Date().toISOString() + ' top=' + location.href + ' -->', learnNames(document))];
        // The header shape as a VISIBLE banner (v1.10): it used
        // to live only inside an HTML comment, which a browser
        // renders invisibly - his Cmd+F could never find it.
        // As a real element at the top of the saved file it is
        // findable and copyable. The shape text stays masked.
        try {
          var shapes = nameShapes(document);
          var banner = document.createElement('div');
          banner.setAttribute('style', 'border:2px solid #b91c1c;background:#fef2f2;color:#7f1d1d;padding:10px 12px;font:12px monospace;white-space:pre-wrap;word-break:break-all;');
          banner.textContent = 'HEADER SHAPE (masked - safe to copy to Mica): ' +
            (shapes.length ? shapes.join('  |  ') : 'no name-shaped element found');
          lines.push(banner.outerHTML);
        } catch (e) {}
        walk(document, 0, lines, { value: 0 });
        lines.push(redactStr(feedbackBlock(), learnNames(document)));
        var blob = new Blob([lines.join('\n')], { type: 'text/html' });
        var a = document.createElement('a');
        var d = new Date();
        a.href = URL.createObjectURL(blob);
        a.download = 'pcc-capture-TREE-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '.html';
        (document.body || document.documentElement).appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        btn.textContent = 'SAVED';
      } catch (e) {
        btn.textContent = 'ERROR';
      }
      setTimeout(function () { btn.disabled = false; btn.textContent = 'HTML'; }, 2500);
    }, 3000);
  });

  (document.body || document.documentElement).appendChild(btn);

  // ---- REVIEW export (v1.4, his design): one file with every
  // unsent judgement AND the page snapshot frozen when he made
  // it, for periodic review. Marked sent afterwards.
  var rbtn = document.createElement('button');
  rbtn.textContent = 'REVIEW';
  rbtn.setAttribute('style', [
    'position:fixed', 'right:14px', 'bottom:76px', 'z-index:2147483647',
    'background:#1e40af', 'color:#ffffff', 'border:none', 'border-radius:10px',
    'padding:12px 18px', 'font:700 15px -apple-system, "Segoe UI", Roboto, sans-serif',
    'cursor:pointer', 'box-shadow:0 4px 14px rgba(0,0,0,.35)'
  ].join(';'));
  (document.body || document.documentElement).appendChild(rbtn);

  function download(name, text) {
    var blob = new Blob([text], { type: 'text/html' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    (document.body || document.documentElement).appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function stamp() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
  }
  rbtn.addEventListener('click', function () {
    var all = [];
    try { all = JSON.parse(localStorage.getItem('pnFeedback') || '[]'); } catch (e) {}
    if (!Array.isArray(all)) all = [];
    var unsent = all.filter(function (r) { return !r.sent; });
    if (!unsent.length) {
      rbtn.textContent = 'NONE';
      setTimeout(function () { rbtn.textContent = 'REVIEW'; }, 2000);
      return;
    }
    rbtn.textContent = 'WORKING...';
    function finish(snaps) {
      var byKey = {};
      (snaps || []).forEach(function (s) { byKey[s.k] = s; });
      // Redact the review file too (v1.5): names learned from
      // every snapshot's own header + this page, applied to all.
      var allNames = learnNames(document);
      (snaps || []).forEach(function (s) {
        learnNamesFromText(String(s.html || '').replace(/<[^>]+>/g, ' '))
          .forEach(function (n) { if (allNames.indexOf(n) === -1) allNames.push(n); });
      });
      allNames.sort(function (a, b) { return b.length - a.length; });
      var lines = ['<!-- PCC REVIEW v1.5 ' + new Date().toISOString() + ' - ' + unsent.length + ' unsent judgements, each followed by the page frozen when it was made; auto-redacted -->'];
      unsent.forEach(function (r, i) {
        lines.push('\n\n<!-- ================= JUDGEMENT ' + (i + 1) + ' of ' + unsent.length + ' ================= -->');
        lines.push(redactStr('<script type="application/json" class="pn-review-rec">' +
          JSON.stringify(r).replace(/<\//g, '<\\/') + '</' + 'script>', allNames));
        var s = byKey[r.k];
        lines.push(s && s.html ? redactStr(s.html, allNames) : '<!-- (no page snapshot stored for this judgement) -->');
      });
      download('pcc-review-' + stamp() + '.html', lines.join('\n'));
      all.forEach(function (r) { r.sent = true; });
      try { localStorage.setItem('pnFeedback', JSON.stringify(all)); } catch (e) {}
      rbtn.textContent = 'SAVED';
      setTimeout(function () { rbtn.textContent = 'REVIEW'; }, 2500);
    }
    try {
      var rq = indexedDB.open('pnReview', 1);
      rq.onupgradeneeded = function () {
        if (!rq.result.objectStoreNames.contains('snaps')) rq.result.createObjectStore('snaps', { keyPath: 'k' });
      };
      rq.onsuccess = function () {
        var got = rq.result.transaction('snaps', 'readonly').objectStore('snaps').getAll();
        got.onsuccess = function () {
          var snaps = got.result || [];
          finish(snaps);
          try {
            var wtx = rq.result.transaction('snaps', 'readwrite').objectStore('snaps');
            snaps.forEach(function (s) { if (!s.sent) { s.sent = true; wtx.put(s); } });
          } catch (e) {}
        };
        got.onerror = function () { finish([]); };
      };
      rq.onerror = function () { finish([]); };
    } catch (e) { finish([]); }
  });
})();
