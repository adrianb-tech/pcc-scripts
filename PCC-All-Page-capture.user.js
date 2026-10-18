// ==UserScript==
// @name         Every facility — Page capture (temporary diagnostic)
// @namespace    mica.pcc
// @version      1.5
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
    var block = '\n\n<!-- ================= PN FEEDBACK STORE (unsent judgements ride here) ================= -->\n' +
      '<script type="application/json" id="pn-feedback-store">' + payload + '</' + 'script>';
    if (unsent.length) {
      all.forEach(function (r) { r.sent = true; });
      try { localStorage.setItem('pnFeedback', JSON.stringify(all)); } catch (e) {}
    }
    return block;
  }

  // Auto-redaction (v1.5, Phase 0 of the note-system build):
  // every SAVED file is stripped before it exists - the
  // resident's name (learned from the page's own header) ->
  // RESIDENT, DOB and MRN numbers -> X, chart id out of URLs.
  // The live page is never touched; only the file is.
  function learnNamesFromText(text) {
    var names = [];
    var m = /Resident:\s*([A-Z][A-Za-z' -]+),\s*([A-Z][A-Za-z]+)/.exec(text || '');
    if (m) {
      var last = m[1].trim();
      var first = m[2].trim();
      var lastTitle = last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
      [last + ', ' + first, first + ' ' + last, lastTitle, last, first]
        .forEach(function (n) { if (n && n.length > 2) names.push(n); });
    }
    return names.sort(function (a, b) { return b.length - a.length; });
  }
  function learnNames(doc) {
    // Learn from the element carrying 'Resident:' - shortest
    // text first, and reject a parse whose first name runs
    // straight into more letters (page text glues the name to
    // the next label and corrupts it, e.g. 'WendyDOB').
    try {
      var els = doc.querySelectorAll('span, div, td, th, li, a');
      var cands = [];
      for (var i = 0; i < els.length; i++) {
        var tx = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (tx.indexOf('Resident:') !== -1 && tx.length < 90) cands.push(tx);
      }
      cands.sort(function (a, b) { return a.length - b.length; });
      for (var c = 0; c < cands.length; c++) {
        var got = learnNamesFromText(cands[c]);
        if (!got.length) continue;
        var m = /Resident:\s*[A-Z][A-Za-z' -]+,\s*([A-Z][A-Za-z]+)/.exec(cands[c]);
        var after = m ? cands[c].slice(m.index + m[0].length) : '';
        if (/^[A-Za-z]/.test(after)) continue; // glued - not this element
        return got;
      }
      return learnNamesFromText((doc.body && doc.body.textContent) || '');
    } catch (e) { return []; }
  }
  function redactStr(s, names) {
    var out = String(s);
    (names || []).forEach(function (n) {
      var rx = new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      out = out.replace(rx, 'RESIDENT');
    });
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
        var lines = [redactStr('<!-- PCC TREE CAPTURE v1.5 (delayed 3s) ' + new Date().toISOString() + ' top=' + location.href + ' -->', learnNames(document))];
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
