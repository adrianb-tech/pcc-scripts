// ==UserScript==
// @version 1.0
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Emphasize-age-sex-location-admission-in-header.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Emphasize-age-sex-location-admission-in-header.user.js
// @name         PCC - Emphasize age / sex / location / admission in header
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function(){
  var EMPH = 'font-weight:900;font-size:1.7em;color:#1d4ed8;';   // extra bold, much bigger, blue

  var LABELS = 'DOB|Physician|Location|Status|Code Status|Allergies|Admission|Initial Admission Date|Discharge Date';

  function makeSpan(text){
    var s = document.createElement('span');
    s.textContent = text; s.style.cssText = EMPH; s.__emph = 1;
    return s;
  }

  function boldWholeNode(tn){
    var p = tn.parentNode; if (!p) return;
    var txt = tn.nodeValue;
    var lead = txt.match(/^\s*/)[0], trail = txt.match(/\s*$/)[0];
    var core = txt.slice(lead.length, txt.length - trail.length);
    if (!core) return;
    var frag = document.createDocumentFragment();
    if (lead) frag.appendChild(document.createTextNode(lead));
    frag.appendChild(makeSpan(core));
    if (trail) frag.appendChild(document.createTextNode(trail));
    p.replaceChild(frag, tn);
  }

  function isLabel(v){
    return new RegExp('^\\s*(?:' + LABELS + ')\\b', 'i').test(v) || /:\s*$/.test(v);
  }

  function allTextNodes(){
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), out = [], n;
    while ((n = w.nextNode())) out.push(n);
    return out;
  }

  // Bold the VALUE that follows a label, whether it's in the same node or a following one.
  // valueRe validates the value so we only touch the real header field.
  function boldLabelValue(labelSrc, valueRe){
    var nodes = allTextNodes();
    var labRe = new RegExp(labelSrc + '\\s*:?\\s*', 'i');
    for (var i = 0; i < nodes.length; i++){
      var tn = nodes[i], p = tn.parentNode;
      if (!p || p.__emph) continue;
      var tag = p.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') continue;
      var txt = tn.nodeValue;
      var m = txt.match(labRe);
      if (!m) continue;
      var cut = m.index + m[0].length;
      var rest = txt.slice(cut);

      if (rest.trim()) {                          // value in the SAME node
        var stop = rest.search(new RegExp('\\b(?:' + LABELS + ')\\b\\s*:', 'i'));
        var value = stop >= 0 ? rest.slice(0, stop) : rest;
        var suffix = stop >= 0 ? rest.slice(stop) : '';
        var t = value.match(/\s*$/)[0];
        if (t) { value = value.slice(0, value.length - t.length); suffix = t + suffix; }
        if (!value.trim() || (valueRe && !valueRe.test(value))) continue;
        var frag = document.createDocumentFragment();
        frag.appendChild(document.createTextNode(txt.slice(0, cut)));
        frag.appendChild(makeSpan(value));
        if (suffix) frag.appendChild(document.createTextNode(suffix));
        p.replaceChild(frag, tn);
      } else {                                    // value is in a FOLLOWING node
        for (var j = i + 1; j < nodes.length; j++){
          var vt = nodes[j], vp = vt.parentNode;
          if (!vp || vp.__emph) continue;
          var v = vt.nodeValue;
          if (!v.trim()) continue;
          if (isLabel(v)) break;                  // hit the next label — stop
          if (!valueRe || valueRe.test(v)) boldWholeNode(vt);
          break;
        }
      }
    }
  }

  // Wrap every regex match inside root (the age/sex parenthetical)
  function wrapPattern(source){
    allTextNodes().forEach(function(tn){
      var p = tn.parentNode;
      if (!p || p.__emph) return;
      var tag = p.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return;
      var txt = tn.nodeValue, r = new RegExp(source, 'gi');
      if (!r.test(txt)) return;
      r.lastIndex = 0;
      var frag = document.createDocumentFragment(), last = 0, m;
      while ((m = r.exec(txt))){
        if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
        frag.appendChild(makeSpan(m[0]));
        last = m.index + m[0].length;
        if (m.index === r.lastIndex) r.lastIndex++;
      }
      if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
      p.replaceChild(frag, tn);
    });
  }

  function run(){
    wrapPattern('\\(\\s*\\d{1,3}\\s*\\/\\s*(?:male|female|m|f)\\s*\\)');   // (94/Female)
    boldLabelValue('Location', /\d{1,4}-[A-Za-z]/);                        // 8 East 836-B, IPU 821-P, W 242-P
    boldLabelValue('Admission\\s*\\(re-?entry\\)', /\d{1,2}\/\d{1,2}\/\d{2,4}/);  // 9/20/2026
  }

  setTimeout(run, 800);
  setInterval(run, 2000);
})();