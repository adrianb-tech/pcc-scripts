// ==UserScript==
// @version 1.1
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Forms-List-pending-highlight.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Forms-List-pending-highlight.user.js
// @name         Every facility — Forms List: highlight pending consults
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function(){
  var BG = '#5fb86a';   // darker green than the row default; change to any color

  function txt(el){ return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function isOne(s){ return /^1(\.0+)?$/.test(s); }

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

  function paint(doc){
    var rows = doc.querySelectorAll('tr');
    var tables = [], idxs = [];
    for (var r = 0; r < rows.length; r++){
      var tr = rows[r];
      if (tr.querySelector('tr')) continue;            // skip layout rows that wrap other rows
      var cells = tr.children;
      if (cells.length < 5) continue;
      var table = tr.closest('table');
      if (!table) continue;
      var ti = tables.indexOf(table);
      if (ti < 0){
        tables.push(table);
        idxs.push({ s: colIndex(table, 'Score'), c: colIndex(table, 'Category'), d: colIndex(table, 'Description') });
        ti = tables.length - 1;
      }
      var ix = idxs[ti];
      if (ix.s < 0 || ix.c < 0 || ix.d < 0) continue;  // not the forms table
      if (!cells[ix.s] || !cells[ix.c] || !cells[ix.d]) continue;

      var desc = txt(cells[ix.d]), cat = txt(cells[ix.c]), score = txt(cells[ix.s]);
      var isPsych = /psych/i.test(desc) || /psych/i.test(cat);
      if (!isPsych) continue;
      if (!(isOne(score) || /pending\s+psychiatry/i.test(cat))) continue;

      tr.style.setProperty('background-color', BG, 'important');
      for (var c = 0; c < cells.length; c++){
        cells[c].style.setProperty('background-color', BG, 'important');
        cells[c].style.fontWeight = '700';
      }
    }
  }

  function runAll(){
    var docs = [document];
    var ifr = document.querySelectorAll('iframe');
    for (var i = 0; i < ifr.length; i++){ try { if (ifr[i].contentDocument) docs.push(ifr[i].contentDocument); } catch(e){} }
    docs.forEach(function(d){ try { paint(d); } catch(e){} });
  }

  // Scheduling: bounded staggered runs after load + re-run on your clicks.
  // (Permanent interval removed in the reorganization — no-timers rule.)
  [400, 1000, 2000, 3500, 5500, 8000].forEach(function (ms) { setTimeout(runAll, ms); });
  var pccSchedLast = 0;
  document.addEventListener('click', function (e) {
      if (!e.isTrusted) return;
      var now = Date.now();
      if (now - pccSchedLast < 800) return;
      pccSchedLast = now;
      setTimeout(runAll, 350);
  }, true);
})();