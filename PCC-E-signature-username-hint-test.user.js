// ==UserScript==
// @version 1.2
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-E-signature-username-hint-test.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-E-signature-username-hint-test.user.js
// @name         PCC - E-signature auto-fill username
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function(){
  // Facility keyword (checked in order, first match wins) -> saved Chrome login
  var MAP = [
    [/crown\s*heights/i,                   'allure.AdBalestra'],
    [/bedford/i,                           'allure.abalestra'],
    [/boro(ugh)?\s*park/i,                 'csc.abalestra'],
    [/saints?|joachim|downtown|\bcnr\b/i,  'pja.abalestra']
  ];

  function tag(msg){
    var t = document.getElementById('tmHintTag');
    if (!t){
      t = document.createElement('div');
      t.id = 'tmHintTag';
      t.style.cssText = 'position:fixed;right:6px;bottom:4px;font:11px sans-serif;color:#888;z-index:99999;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
  }

  // Reads the facility name from the main PCC window that opened this popup.
  // Scans aggressively: direct facility keywords anywhere in the opener,
  // then falls back to the Brooklyn/NY/SNF heuristic in the header area.
  function facilityText(){
    var docs = [];
    try { if (window.opener){ docs.push(window.opener.top.document); docs.push(window.opener.document); } } catch(e){}
    try { if (window.top && window.top !== window) docs.push(window.top.document); } catch(e){}
    var FAC_RE = /boro\s*park|bedford|crown\s*heights|saints?|joachim|downtown|\bbpcnr\b|\bcnr\b/i;
    for (var d = 0; d < docs.length; d++){
      var bodyT = '';
      try { bodyT = docs[d].body ? docs[d].body.innerText : ''; } catch(e){ continue; }
      var m = bodyT.match(FAC_RE);
      if (m) return m[0];
      // Fallback: header-area heuristic
      var els = docs[d].querySelectorAll('span,div,a,button,li,p,td,th,h1,h2,h3');
      var best = '';
      for (var i = 0; i < els.length; i++){
        var t = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (t.length < 10 || t.length > 150) continue;
        if (FAC_RE.test(t)) return t.match(FAC_RE)[0];
        var r = els[i].getBoundingClientRect();
        if (r.top > 300 || r.height === 0) continue;
        if (/(?:Brooklyn|,\s*NY|\bSNF\b|Rehabilitation|Nursing)/i.test(t) && (!best || t.length < best.length)) best = t;
      }
      if (best) return best;
    }
    return '';
  }

  // Watches for up to ~2.5 minutes; once the password is filled, puts the cursor on the Sign button.
  // It does NOT click Sign; you still press Enter yourself.
  function focusSignWhenFilled(pw){
    var tries = 0;
    var iv = setInterval(function(){
      tries++;
      if (pw.value){
        clearInterval(iv);
        setTimeout(function(){
          var btns = document.querySelectorAll('input[type="button"],input[type="submit"],button');
          var found = false;
          for (var i = 0; i < btns.length; i++){
            if (/^Sign$/i.test((btns[i].value || btns[i].textContent || '').trim())){ btns[i].focus(); found = true; break; }
          }
          tag(found ? 'password filled - Sign focused' : 'password filled - Sign button not found');
        }, 150);
      } else if (tries > 600){
        clearInterval(iv);
      }
    }, 250);
  }

  function run(){
    if (document.getElementById('tmUserHint')) return;
    if (!/Electronic Signature/i.test(document.title + ' ' + (document.body ? document.body.innerText.slice(0, 400) : ''))) return;
    var pw = document.querySelector('input[type="password"]');
    if (!pw) return;

    var fac = facilityText();
    if (!fac){ tag('login hint: facility name not found' + (window.opener ? '' : ' (no opener)')); return; }

    var user = '';
    for (var i = 0; i < MAP.length; i++){ if (MAP[i][0].test(fac)){ user = MAP[i][1]; break; } }
    if (!user){ tag('login hint: no match for "' + fac.slice(0, 60) + '"'); return; }

    var u = document.createElement('input');
    u.type = 'text'; u.id = 'tmUserHint'; u.name = 'username'; u.autocomplete = 'username'; u.value = user;
    u.tabIndex = -1;
    u.style.cssText = 'position:absolute;top:0;left:0;width:2px;height:2px;opacity:0.01;border:0;padding:0;pointer-events:none;';
    pw.parentNode.insertBefore(u, pw);
    tag('login hint: ' + user);
    focusSignWhenFilled(pw);

    // Auto-focus the password field and show which login to pick.
    // (Browser security prevents scripts from selecting the native
    // password dropdown, so type the prefix + Enter yourself.)
    setTimeout(function(){
      try {
        pw.focus();
        var prefix = user.split('.')[0] || user;
        tag(user + ' — type "' + prefix + '" + Enter');
      } catch(e){}
    }, 600);
  }

  setTimeout(run, 300);
  setInterval(run, 1000);
})();