// ==UserScript==
// @name         PCC - Header copy button (allergies)
// @version 1.7
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Header-copy-button-allergies.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Header-copy-button-allergies.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function(){
  // Same solid blue as the BIMS Copy button
  var BTN_BLUE = 'cursor:pointer;border:2px solid #1d4ed8;background:#1d4ed8;color:#fff;border-radius:8px;font-weight:700;line-height:1.1;vertical-align:middle;font-family:-apple-system,Helvetica,Arial,sans-serif;text-transform:none;';

  function copyText(t){
    if (!t) return;
    try { if (navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(t); return; } } catch(e){}
    try {
      var ta = document.createElement('textarea');
      ta.value = t; ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    } catch(e){}
  }

  function formatAllergies(raw){
    if (!raw) return '';
    var cleaned = raw.trim();

    // Check for NKA variants (allowing trailing button noise)
    if (/^no\s+known\s+(?:drug\s+)?allergies/i.test(cleaned) || /^nkda?/i.test(cleaned)) {
      return 'NKA';
    }

    // Split on commas, semicolons, slashes, or newlines to process list items
    var list = cleaned.split(/[,;\/\n]+/);
    var formattedList = [];

    for (var i = 0; i < list.length; i++){
      var item = list[i].replace(/\s+/g, ' ').trim();
      // Strip trailing button text from individual allergy items
      item = item.replace(/(?:Copy|Copied)$/i, '').trim();
      if (!item) continue;

      // Abbreviate penicillin -> PCN
      item = item.replace(/\bpen[ie]cill?in\b/gi, 'PCN');

      formattedList.push(item);
    }

    return formattedList.join(', ');
  }

  function makeBtn(doc, id, getText, sizeCss){
    var b = doc.createElement('button');
    b.id = id; b.type = 'button'; b.textContent = 'Copy';
    b.style.cssText = BTN_BLUE + sizeCss;
    b.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      copyText(getText());
      var o = b.textContent; b.textContent = 'Copied'; setTimeout(function(){ b.textContent = o; }, 1000);
    });
    return b;
  }

  // ---------- ALLERGIES ----------
  // Never treat our own info table as chart content — its row labels would
  // otherwise get picked up by the scans below and the table would read itself.
  function inInfoTable(el){
    while (el){ if (el.id === 'copyInfoTable') return true; el = el.parentNode; }
    return false;
  }
  // Next sibling skipping our injected button/table.
  function nextRealSibling(el){
    var n = el ? el.nextElementSibling : null;
    while (n && (n.id === 'copyAllergiesBtn' || n.id === 'copyInfoTable')) n = n.nextElementSibling;
    return n;
  }

  function allergyEl(doc){
    var els = doc.querySelectorAll('td,th,span,div,label,b,strong,p,li');
    var best = null;
    for (var i = 0; i < els.length; i++){
      if (inInfoTable(els[i])) continue;
      var t = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
      // starts with "Allergies", short, has a lowercase letter (skips the all-caps ALLERGIES tab), not a link
      if (/^allergies\b/i.test(t) && t.length < 80 && /[a-z]/.test(t) && els[i].tagName !== 'A'){
        if (!best || t.length < (best.textContent || '').replace(/\s+/g, ' ').trim().length) best = els[i];
      }
    }
    return best;
  }

  // Allergies value taken from the specific host element the button sits by —
  // never from a whole-page scan, so the table can't misread other sections.
  function allergyValueFromHost(host){
    if (!host || inInfoTable(host)) return '';
    var t = (host.textContent || '').replace(/\s+/g, ' ').trim().replace(/\s*(?:Copy|Copied)$/, '');
    var m = t.match(/^allergies\s*:?\s*(.+)$/i);
    if (m) return formatAllergies(m[1]);
    if (/^allergies\s*:?$/i.test(t)){
      var sib = nextRealSibling(host);
      if (sib){
        var v = (sib.textContent || '').replace(/\s+/g, ' ').trim().replace(/\s*(?:Copy|Copied)$/, '');
        return formatAllergies(v);
      }
    }
    return '';
  }
  function currentAllergies(doc){
    return allergyValueFromHost(allergyEl(doc));
  }
  function addAllergies(doc){
    // Standalone allergies Copy button removed per user request (2026-10-02) —
    // the info table has per-row Copy buttons. Remove any leftover button.
    try {
      var oldBtn = doc.getElementById('copyAllergiesBtn');
      if (oldBtn && oldBtn.parentNode) oldBtn.parentNode.removeChild(oldBtn);
    } catch(e){}
    // Place/refresh the info table AFTER the allergy value (not just the label).
    // If label and value are in separate elements, anchor after the value.
    try {
      var host = allergyEl(doc);
      if (!host) return;
      var anchor = host;
      var t = (host.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^allergies\s*:?\s*$/i.test(t)) {
        var sib = nextRealSibling(host);
        if (sib) anchor = sib;
      }
      addInfoTable(doc, anchor);
    } catch(e2){}
  }

  // ---------- INFO TABLE (age/sex, allergies, BIMS, psych meds) ----------
  // Reads the chart snapshot cached by the Tab Shortcuts collectors
  // (localStorage pccSnap_<residentId>); age/sex + allergies also read live
  // from the current page when present.
  var SNAP_PREFIX = 'pccSnap_';

  function residentId(doc){
    try {
      var txt = doc.body ? (doc.body.textContent || '') : '';
      var re = /[A-Za-z][A-Za-z'’.\-]*\s*,\s*[A-Za-z][A-Za-z'’.\- ]*?\(\s*([A-Za-z]{0,5}\d{3,})\s*\)/g;
      var m, ids = {}, order = [];
      while ((m = re.exec(txt))) { var id = m[1].toLowerCase(); if (!ids[id]) { ids[id] = 1; order.push(m[1]); } }
      return order.length === 1 ? order[0] : null;
    } catch (e) { return null; }
  }

  function snapData(doc){
    try {
      var id = residentId(doc);
      if (!id) return null;
      var s = localStorage.getItem(SNAP_PREFIX + id);
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  }

  // "91F" / "91M" — live from the header "(91/Female)" first, then the cache.
  function readAgeSexShort(doc, snap){
    try {
      var txt = doc.body ? (doc.body.textContent || '') : '';
      var m = txt.match(/\(\s*(\d{1,3})\s*\/\s*(Male|Female)\s*\)/);
      if (m) return m[1] + m[2].charAt(0).toUpperCase();
    } catch (e) {}
    if (snap && snap.age && snap.sex) return snap.age + String(snap.sex).charAt(0).toUpperCase();
    return '';
  }

  function infoRows(doc){
    var snap = snapData(doc);
    var rows = [];
    var asx = readAgeSexShort(doc, snap);
    if (asx) rows.push({ label: 'Age/Sex', value: asx });
    var alg = currentAllergies(doc);
    if (alg) rows.push({ label: 'Allergies', value: alg });
    if (snap && snap.bims && snap.bims.score){
      var b = String(snap.bims.score) + (/\//.test(String(snap.bims.score)) ? '' : '/15');
      if (snap.bims.date) b += ' (' + snap.bims.date + ')';
      rows.push({ label: 'BIMS', value: b });
    }
    if (snap && snap.meds && snap.meds.length){
      rows.push({ label: 'Psych meds', value: snap.meds.join('; ') });
    }
    return rows;
  }

  function smallCopyBtn(doc, text){
    var b = doc.createElement('button');
    b.type = 'button'; b.textContent = 'Copy';
    b.style.cssText = BTN_BLUE + 'display:inline-block;font-size:14px;padding:4px 12px;margin-left:6px;';
    b.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      copyText(text);
      var o = b.textContent; b.textContent = 'Copied'; setTimeout(function(){ b.textContent = o; }, 1000);
    });
    return b;
  }

  // Compact table right after the allergies Copy button; each row has its own
  // Copy button. Rebuilt only when the data changes; removed when empty.
  function addInfoTable(doc, afterEl){
    var rows = infoRows(doc);
    var old = doc.getElementById('copyInfoTable');
    if (!rows.length){ if (old && old.parentNode) old.parentNode.removeChild(old); return; }
    var sig = rows.map(function(r){ return r.label + '=' + r.value; }).join('|');
    if (old && old.getAttribute('data-sig') === sig) return;
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var wrap = doc.createElement('span');
    wrap.id = 'copyInfoTable';
    wrap.setAttribute('data-sig', sig);
    wrap.style.cssText = 'display:inline-block;vertical-align:middle;margin-left:12px;' +
      'border:1px solid #999;border-radius:6px;padding:8px 10px;background:#fff;' +
      'font:400 16px -apple-system,Helvetica,Arial,sans-serif;color:#111;';
    var tbl = doc.createElement('table');
    tbl.style.cssText = 'border-collapse:collapse;';
    for (var i = 0; i < rows.length; i++){
      var tr = doc.createElement('tr');
      var tdL = doc.createElement('td');
      tdL.textContent = rows[i].label;
      tdL.style.cssText = 'font-weight:700;padding:4px 10px 4px 2px;white-space:nowrap;vertical-align:top;';
      var tdV = doc.createElement('td');
      tdV.textContent = rows[i].value;
      var bigVal = (rows[i].label === 'Age/Sex' || rows[i].label === 'Allergies');
      tdV.style.cssText = 'padding:4px 2px;vertical-align:top;max-width:520px;' +
        (bigVal ? 'font-size:20px;font-weight:700;' : '');
      var tdB = doc.createElement('td');
      tdB.style.cssText = 'padding:4px 2px 4px 6px;vertical-align:top;white-space:nowrap;';
      tdB.appendChild(smallCopyBtn(doc, rows[i].value));
      tr.appendChild(tdL); tr.appendChild(tdV); tr.appendChild(tdB);
      tbl.appendChild(tr);
    }
    wrap.appendChild(tbl);
    afterEl.parentNode.insertBefore(wrap, afterEl.nextSibling);
  }

  // ---------- FORM PAGE GUARD ----------
  // The info table belongs in the chart header, not inside a form. The
  // Bedford/Crown Heights Consult-Psychiatry form has its own "Allergies"
  // label (section B3) which allergyEl() matches — without this guard the
  // table gets injected into the form itself. Boro Park is left untouched
  // per user scope (Bedford/Crown Heights only).
  function isBoroParkSimple(doc){
    try {
      var els = doc.querySelectorAll('select, button, a, span, div, td');
      for (var i = 0; i < els.length; i++){
        var t = (els[i].textContent || '').trim();
        if (t.length > 60 || t.length < 4) continue;
        if (!/boro\s*park/i.test(t)) continue;
        var r = null;
        try { r = els[i].getBoundingClientRect(); } catch(e){}
        if (r && r.top >= -50 && r.top < 300) return true;
      }
    } catch(e){}
    return false;
  }
  function isFormPage(doc){
    try {
      var t = doc.body ? (doc.body.textContent || '') : '';
      var nt = t.replace(/\s+/g, ' ');
      // Consult-Psychiatry form: the save-button row or B-section markers.
      // (No Type-filter check — form dropdowns can contain those words.)
      if (/save\s*&\s*sign\s*&\s*lock\s*&\s*exit/i.test(nt)) return true;
      if (/\bB1\./.test(nt) && /\bB3\./.test(nt)) return true;
    } catch(e){}
    return false;
  }

  function runAll(){
    var docs = [document];
    var ifr = document.querySelectorAll('iframe');
    for (var i = 0; i < ifr.length; i++){ try { if (ifr[i].contentDocument) docs.push(ifr[i].contentDocument); } catch(e){} }
    docs.forEach(function(d){
      try {
        // The info table belongs in the chart header, never inside a form.
        if (isFormPage(d)) {
          var old = d.getElementById('copyInfoTable');
          if (old && old.parentNode) old.parentNode.removeChild(old);
          return;
        }
        addAllergies(d);
      } catch(e){}
    });
  }

  setTimeout(runAll, 800);
  setInterval(runAll, 1500);
})();
