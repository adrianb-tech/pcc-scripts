// ==UserScript==
// @name         Every facility — Header copy table
// @version 1.20
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Header-copy-table.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Header-copy-table.user.js
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
    // BIMS is manual-only per Adrian 2026-10-05 — never G-pushed
    if (label !== 'BIMS') {
        b.className = 'pcc-fill-copy';
        b.setAttribute('data-fill-value', text);
        b.setAttribute('data-fill-label', label);
    }
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
    // Never inject into a form page — the info table belongs in the chart header only.
    if (isFormPage(doc)) return;
    // Standalone allergies Copy button removed per user request (2026-10-02) —
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
    // BIMS row removed 2026-10-05 per Adrian: manual-only, not in info table.
    if (snap && snap.meds && snap.meds.length){
      rows.push({ label: 'Psych meds', value: snap.meds.join('; ') });
    }
    return rows;
  }

  // Glass Copy button for the dark slate card (his design pick, 2026-10-13).
  var GLASS_BTN = 'cursor:pointer;background:rgba(255,255,255,.13);color:#fff;border:1px solid rgba(255,255,255,.28);' +
    'border-radius:999px;font-weight:600;line-height:1.1;vertical-align:middle;' +
    'font-family:-apple-system,Helvetica,Arial,sans-serif;text-transform:none;';

  function smallCopyBtn(doc, text, label){
    // Mark buttons that can push to the note via G
    var b = doc.createElement('button');
    // BIMS is manual-only per Adrian 2026-10-05 — never G-pushed
    if (label !== 'BIMS') {
        b.className = 'pcc-fill-copy';
        b.setAttribute('data-fill-value', text);
        b.setAttribute('data-fill-label', label);
    }
    b.type = 'button'; b.textContent = 'Copy';
    b.style.cssText = GLASS_BTN + 'display:inline-block;font-size:13px;padding:7px 16px;margin-left:6px;flex:none;';
    b.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      copyText(text);
      // For Allergies: also drop a fill request so the note panel can
      // replace "Allergies NKA" with the real value.
      if (label === 'Allergies') {
        try {
          localStorage.setItem('pccFillAllergies', JSON.stringify({ value: text, ts: Date.now() }));
        } catch(err){}
      }
      // For Age/Sex: drop a fill request so the note can replace "HPI xx".
      if (label === 'Age/Sex') {
        try {
          localStorage.setItem('pccFillAgeSex', JSON.stringify({ value: text, ts: Date.now() }));
        } catch(err){}
      }
      // For Psych meds: drop a fill request so the note can replace "- none".
      if (label === 'Psych meds') {
        try {
          localStorage.setItem('pccFillPsychMeds', JSON.stringify({ value: text, ts: Date.now() }));
        } catch(err){}
      }
      var o = b.textContent; b.textContent = 'Copied'; setTimeout(function(){ b.textContent = o; }, 1000);
    });
    return b;
  }

  // ---------- NAME / ROOM (same finders as the S key) ----------
  function residentLastFirst(doc){
    try {
      var txt = doc.body ? (doc.body.textContent || '') : '';
      var m = txt.match(/([A-Za-z][A-Za-z'’.\-]*(?:\s+[A-Za-z][A-Za-z'’.\-]*)*\s*,\s*[A-Za-z][A-Za-z'’.\- ]*?)\s*\(\s*[A-Za-z]{0,5}\d{3,}\s*\)/);
      if (m) return m[1].replace(/\s+/g, ' ').trim();
    } catch (e) {}
    return '';
  }
  function isCrownHeights(doc){
    try {
      var els = doc.querySelectorAll('select, button, a, span, div, td');
      for (var i = 0; i < els.length; i++){
        var tx = (els[i].textContent || '').trim();
        if (tx.length > 90 || tx.length < 6) continue;
        if (!/crown\s*heights/i.test(tx)) continue;
        var r = null;
        try { r = els[i].getBoundingClientRect(); } catch (e) {}
        if (r && r.top >= -50 && r.top < 300) return true;
      }
    } catch (e) {}
    return false;
  }
  // "5 East 530-A" -> "530A"; Crown Heights keeps the wing: "6 West 612-B" -> "W612B".
  function roomBedNumber(doc, withWing){
    try {
      var txt = (doc.body && doc.body.textContent) ? doc.body.textContent : '';
      var v = '';
      var m = txt.match(/\bLocation\s*:?\s*([^\n]*?)(?=\s*(?:Status|Code Status|Physician|DOB|Admission|Initial Admission|Discharge|Allergies|Special Instructions)\b|\n|$)/);
      if (m) v = m[1].replace(/\s+/g, ' ').trim();
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

  // ---------- ADMISSION DATE ----------
  // "Admission (re-entry)" first (tagged re-entry); else the MDS initial date.
  function admissionDate(doc){
    try {
      var txt = (doc.body && doc.body.textContent) ? doc.body.textContent : '';
      var m = txt.match(/Admission\s*\(re-?entry\)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (m) return { date: m[1], kind: 're-entry' };
      m = txt.match(/Initial Admission Date[^0-9]*?(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (m) return { date: m[1], kind: 'initial' };
    } catch (e) {}
    return null;
  }

  // ---------- DARK SLATE CARD (his design, 2026-10-13) ----------
  // Replaces the old white table, same anchor (right after the allergies
  // value). Title = resident name + room pill; rows = Age/Sex, Allergies
  // (each with its glass Copy — Grab-all still finds .pcc-fill-copy and adds
  // its G badge, restyled glass inside this card), then Admission.
  function addInfoTable(doc, afterEl){
    var rows = infoRows(doc);
    var name = residentLastFirst(doc);
    var room = roomBedNumber(doc, isCrownHeights(doc));
    var adm = admissionDate(doc);
    var old = doc.getElementById('copyInfoTable');
    if (!rows.length && !name){ if (old && old.parentNode) old.parentNode.removeChild(old); return; }
    var sig = name + '|' + room + '|' + rows.map(function(r){ return r.label + '=' + r.value; }).join('|') +
      '|' + (adm ? adm.date + adm.kind : '');
    if (old && old.getAttribute('data-sig') === sig) return;
    if (old && old.parentNode) old.parentNode.removeChild(old);

    // Grab-all's G badge, glass-styled when it lands inside this card.
    if (!doc.getElementById('pccHdrCardStyle')) {
      var st = doc.createElement('style');
      st.id = 'pccHdrCardStyle';
      st.textContent = '#copyInfoTable .pcc-g-badge{background:rgba(255,255,255,.08)!important;' +
        'border:1px solid rgba(255,255,255,.25)!important;border-bottom-width:2px!important;color:#cbd5e1!important;}';
      (doc.head || doc.documentElement).appendChild(st);
    }

    var wrap = doc.createElement('span');
    wrap.id = 'copyInfoTable';
    wrap.setAttribute('data-sig', sig);
    // Floated, not in flow (v1.20, his request): the card hovers at the spot
    // right after the allergies value without stretching the header — the
    // space before/after the Allergies section keeps its original size.
    wrap.style.cssText = 'position:absolute;z-index:60;margin-left:12px;' +
      'background:linear-gradient(135deg,#263449,#131c2b);border-radius:16px;' +
      'box-shadow:0 10px 28px rgba(2,6,23,.35);padding:14px 18px 8px;min-width:430px;max-width:640px;' +
      'font-family:-apple-system,Helvetica,Arial,sans-serif;color:#f8fafc;';

    if (name) {
      var title = doc.createElement('div');
      title.style.cssText = 'display:flex;align-items:center;gap:12px;padding-bottom:10px;';
      var nm = doc.createElement('span');
      nm.textContent = name;
      nm.style.cssText = 'font-size:23px;font-weight:700;letter-spacing:.01em;color:#f8fafc;flex:1;min-width:0;';
      title.appendChild(nm);
      if (room) {
        var pill = doc.createElement('span');
        pill.style.cssText = 'flex:none;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.22);' +
          'color:#dbe7f5;font-size:14.5px;font-weight:600;padding:5px 13px;border-radius:999px;white-space:nowrap;';
        var rl = doc.createElement('span');
        rl.textContent = 'ROOM ';
        rl.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:.08em;color:#8fa3bd;';
        pill.appendChild(rl);
        pill.appendChild(doc.createTextNode(room));
        title.appendChild(pill);
      }
      wrap.appendChild(title);
    }

    function dataRow(label, value, valueColor, btn) {
      var row = doc.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid rgba(255,255,255,.09);';
      var lb = doc.createElement('span');
      lb.textContent = label;
      lb.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8fa3bd;width:88px;flex:none;';
      var vl = doc.createElement('span');
      vl.style.cssText = 'font-size:19px;font-weight:600;color:' + valueColor + ';flex:1;min-width:0;';
      if (typeof value === 'string') vl.textContent = value; else vl.appendChild(value);
      row.appendChild(lb); row.appendChild(vl);
      if (btn) row.appendChild(btn);
      return row;
    }

    for (var i = 0; i < rows.length; i++){
      var isAlg = rows[i].label === 'Allergies';
      wrap.appendChild(dataRow(rows[i].label, rows[i].value, isAlg ? '#fda4af' : '#f8fafc',
        smallCopyBtn(doc, rows[i].value, rows[i].label)));
    }
    if (adm) {
      var admVal = doc.createElement('span');
      admVal.appendChild(doc.createTextNode(adm.date + ' '));
      var kind = doc.createElement('span');
      kind.textContent = '(' + adm.kind + ')';
      kind.style.cssText = 'font-size:13px;font-weight:500;color:#8fa3bd;';
      admVal.appendChild(kind);
      wrap.appendChild(dataRow('Admission', admVal, '#f8fafc', null));
    }
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
      // Consult-Psychiatry form: the save-button row, B-section markers, or form title.
      // (No Type-filter check — form dropdowns can contain those words.)
      if (/save\s*&\s*sign\s*&\s*lock\s*&\s*exit/i.test(nt)) return true;
      if (/consult-psychiatry\s+1\.0/i.test(nt)) return true;
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

  // Run at staggered delays to catch PCC's late-loading header (not a permanent interval)
  setTimeout(runAll, 800);
  setTimeout(runAll, 2000);
  setTimeout(runAll, 5000);
})();
