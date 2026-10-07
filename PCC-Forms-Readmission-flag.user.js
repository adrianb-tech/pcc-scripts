// ==UserScript==
// @name         PCC Forms - Readmission flag
// @version 1.2
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Forms-Readmission-flag.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Forms-Readmission-flag.user.js
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function(){
  // true  = also show a small gray line when there is NO readmission (confirms the script ran)
  // false = show nothing unless it is a readmission
  // Set to false (2026-10-02) to stop the OK/alert style flipping — only show on genuine readmission.
  var SHOW_OK = false;

  var BOX_ID = 'tmReadmitBox';

  function txt(el){ return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

  function parseDate(s){
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? new Date(+m[3], +m[1] - 1, +m[2]) : null;
  }

  function colIndex(table, name){
    var cells = table.querySelectorAll('th,td');
    for (var i = 0; i < cells.length; i++){
      if (txt(cells[i]) === name){
        var kids = cells[i].parentNode.children;
        for (var k = 0; k < kids.length; k++) if (kids[k] === cells[i]) return k;
      }
    }
    return -1;
  }

  // Latest Form Date among psychiatry forms.
  // CNR/Saints: "Consult Form - Psychiatry" under "Form Date".
  // Boro Park: "Psych: Consult" assessments under "Assessment Date".
  function lastPsychForm(){
    var best = null, bestStr = '', tableFound = false;
    // Check we're on the forms/assessments page
    var bodyText = (document.body.textContent || '').toLowerCase();
    if (bodyText.indexOf('form date') === -1 && bodyText.indexOf('assessment date') === -1) return { tableFound: false, d: null, s: '' };
    tableFound = true;
    // Find all text nodes containing "psychiatry" (CNR/Saints) or "psych:"
    // (Boro Park "Psych: Consult"), get the date from the same row
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())){
      var t = (node.nodeValue || '').toLowerCase();
      var isPsych = t.indexOf('psychiatry') !== -1 || t.indexOf('psych:') !== -1;
      if (!isPsych) continue;
      if (t.indexOf('psycholog') !== -1) continue;
      // Found a psychiatry mention — look at the parent row for a date
      var el = node.parentElement;
      var depth = 0;
      while (el && depth < 6){
        var rowText = (el.textContent || '');
        var m = rowText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m){
          var d = parseDate(m[0]);
          if (d && (!best || d > best)){ best = d; bestStr = m[0]; }
          break;
        }
        el = el.parentElement;
        depth++;
      }
    }
    return { tableFound: tableFound, d: best, s: bestStr };
  }

  // Finds the date text next to the "Admission (re-entry)" label
  function reentryDate(){
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    for (var i = 0; i < nodes.length; i++){
      if (!/Admission\s*\(\s*re-?entry\s*\)/i.test(nodes[i].nodeValue)) continue;
      var same = nodes[i].nodeValue.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
      if (same) return { node: nodes[i], str: same[0] };
      for (var j = i + 1; j < nodes.length; j++){
        var v = nodes[j].nodeValue.trim();
        if (!v) continue;
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) return { node: nodes[j], str: v };
        break;
      }
    }
    return null;
  }

  function clear(){
    var o = document.getElementById(BOX_ID);
    if (o && o.parentNode) o.parentNode.removeChild(o);
  }

  function render(anchor, mode, big, small){
    // Remove any duplicate boxes (shouldn't happen, but guards against loops)
    var dups = document.querySelectorAll('#' + BOX_ID);
    for (var di = 1; di < dups.length; di++){
      if (dups[di].parentNode) dups[di].parentNode.removeChild(dups[di]);
    }
    var box = document.getElementById(BOX_ID);
    if (box && box.__mode !== mode){
      // Mode changed — update styles in place instead of recreating
      box.__mode = mode;
      var b = box.firstChild, s = box.lastChild;
      if (mode === 'alert'){
        box.style.cssText = 'display:inline-block;margin-left:16px;padding:5px 16px;background:#e60000;color:#fff;border:3px solid #7a0000;border-radius:8px;font-family:-apple-system,Helvetica,Arial,sans-serif;font-weight:800;line-height:1.2;vertical-align:middle;';
        b.style.cssText = 'font-size:26px;letter-spacing:1px;';
        s.style.cssText = 'font-size:14px;font-weight:600;margin-left:12px;';
      } else {
        box.style.cssText = 'display:inline-block;margin-left:12px;font:12px sans-serif;color:#777;vertical-align:middle;';
        b.style.cssText = '';
        s.style.cssText = '';
      }
    }
    if (!box){
      box = document.createElement('span');
      box.id = BOX_ID; box.__mode = mode;
      var b2 = document.createElement('span'), s2 = document.createElement('span');
      if (mode === 'alert'){
        box.style.cssText = 'display:inline-block;margin-left:16px;padding:5px 16px;background:#e60000;color:#fff;border:3px solid #7a0000;border-radius:8px;font-family:-apple-system,Helvetica,Arial,sans-serif;font-weight:800;line-height:1.2;vertical-align:middle;';
        b2.style.cssText = 'font-size:26px;letter-spacing:1px;';
        s2.style.cssText = 'font-size:14px;font-weight:600;margin-left:12px;';
      } else {
        box.style.cssText = 'display:inline-block;margin-left:12px;font:12px sans-serif;color:#777;vertical-align:middle;';
      }
      box.appendChild(b2); box.appendChild(s2);
      try {
        anchor.parentNode.insertBefore(box, anchor.nextSibling);
      } catch(e){ return; }
    }
    if (box.firstChild) box.firstChild.textContent = big;
    if (box.lastChild) box.lastChild.textContent = small;
  }

  function update(){
    var re = reentryDate();
    var lf = lastPsychForm();
    if (!re || !lf.tableFound){ clear(); return; }            // not the Forms list
    var rd = parseDate(re.str);
    if (!rd){ clear(); return; }
    if (!lf.d){
      if (SHOW_OK) render(re.node, 'ok', '', 'readmission check: no psych form in this list');
      else clear();
      return;
    }
    if (rd >= lf.d) render(re.node, 'alert', 'READMISSION', 'on/after last psych form ' + lf.s);
    else if (SHOW_OK) render(re.node, 'ok', '', 're-entry ' + re.str + ' is before last psych form ' + lf.s + ' - OK');
    else clear();
  }

  setTimeout(update, 2000);
  setInterval(update, 5000);
})();