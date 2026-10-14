// ==UserScript==
// @version      1.5
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Bedford-CH-Consult-defaults.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Bedford-CH-Consult-defaults.user.js
// @name         Bedford + Crown Heights — Consult defaults (Crown Heights)
// @match        https://*.pointclickcare.com/care/chart/mds/mdssection.jsp*
// @match        https://*.pointclickcare.com/care/chart/assess/newassess.jsp*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
  // v1.2 speed-up (his request, same pattern as CNR+Saints): document-start
  // + a fast bounded burst until the form exists, then run ONCE — instead
  // of document-idle + a flat 1s wait. The 200ms spacing between
  // questionReviewed calls stays: that pacing is PCC's, not ours.
  var done = false;
  function run() {
    if (done) return;
    done = true;
    // 1. Set answer defaults. His rule for this form (2026-10-14):
    // NO checkboxes get checked — Reason for Consult included (the
    // 'a. Psychiatric Evaluation' check this script used to set is
    // gone). The only answers set are the two No radios below.
    // Copied/follow-up forms carry his answers — F1 recommendations
    // written, D1 boxes checked, a GDR answer that may be Yes. Forcing
    // the No radios there desyncs PCC's own trigger logic: he had to
    // press Yes, then No again to make the form register (his report,
    // 2026-10-14). Defaults are for FRESH forms only — if any editable
    // textarea already holds text, this form has been worked: set
    // nothing. (The review acks below still run; they change no answers.)
    var worked = false;
    var tas = document.querySelectorAll('textarea');
    for (var ti = 0; ti < tas.length; ti++) {
      if (tas[ti].disabled || tas[ti].readOnly) continue;
      if ((tas[ti].value || '').trim().length > 10) { worked = true; break; }
    }
    if (!worked) {
      var gdrNo = document.querySelector('input[name="Cust_3_D"][value="b"]');
      if (gdrNo && !gdrNo.checked) gdrNo.click();

      var newRecsNo = document.querySelector('input[name="Cust_3_F"][value="b"]');
      if (newRecsNo && !newRecsNo.checked) newRecsNo.click();
    }

    // 2. Find every question still needing review (hidden ack field == "N").
    var links = document.querySelectorAll('a.qcheck');
    var keys = [];
    links.forEach(function(link) {
      var ackName = link.id.replace(/^link/, '');                 // linkackCust_1_A -> ackCust_1_A
      var ackInput = document.querySelector('input[name="' + ackName + '"]');
      if (ackInput && ackInput.value === 'N') {
        keys.push(ackName.replace(/^ack/, ''));                    // ackCust_1_A -> Cust_1_A
      }
    });

    // 3. Review them one at a time, 200ms apart, so PCC processes each.
    //    questionReviewed() is PCC's own function; @grant none lets us call it.
    keys.forEach(function(key, i) {
      setTimeout(function() {
        try {
          questionReviewed(key);
        } catch (e) {
          console.log('review failed:', key, e);
        }
      }, i * 200);
    });
  }
  function attempt() {
    if (done) return;
    if (document.querySelector('input[name="Cust_1_A"]') || document.querySelector('a.qcheck')) run();
  }
  // --- Reasons for Form popup (his ask, 2026-10-14): clicking New on a
  // new patient opens this popup with the wrong form preselected. Set
  // Form = 'Consult-Psychiatry 1.0' and Type of Form = 'Initial'.
  // One-shot at open, like the form defaults — if he changes either
  // afterwards, nothing re-asserts it. Facility-gated through the
  // opener (the popup itself carries no facility name): only when the
  // chart behind it is Bedford / Crown Heights.
  function setSelectByLabel(labelText, optionText) {
    var labels = document.querySelectorAll('td, div, span, label');
    for (var i = 0; i < labels.length; i++) {
      if ((labels[i].textContent || '').trim() !== labelText) continue;
      var row = labels[i].closest('tr') || labels[i].parentElement;
      var sel = row ? row.querySelector('select') : null;
      if (!sel) continue;
      for (var j = 0; j < sel.options.length; j++) {
        if ((sel.options[j].text || '').trim() === optionText) {
          if (sel.selectedIndex !== j) {
            sel.selectedIndex = j;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return true;
        }
      }
    }
    return false;
  }
  function popupFacilityOk() {
    try {
      var od = window.opener && window.opener.document;
      var txt = (od && od.body ? od.body.innerText : '').toLowerCase();
      return txt.indexOf('crown heights') !== -1 || txt.indexOf('bedford') !== -1;
    } catch (e) { return false; }
  }
  function runPopup() {
    if (done) return;
    if (!/newassess\.jsp/.test(location.pathname)) return;
    if (!popupFacilityOk()) { done = true; return; }
    if (setSelectByLabel('Form:', 'Consult-Psychiatry 1.0')) {
      done = true;
      // Type options may refresh off the Form change — give PCC a beat.
      setTimeout(function() { setSelectByLabel('Type of Form:', 'Initial'); }, 350);
    }
  }
  var burstLeft = 50;
  (function burst() {
    attempt();
    runPopup();
    if (done || --burstLeft <= 0) return;
    setTimeout(burst, 60);
  })();
  setTimeout(attempt, 4000);
  setTimeout(attempt, 7000);
})();
