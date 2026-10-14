// ==UserScript==
// @version      1.3
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Bedford-CH-Consult-defaults.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Bedford-CH-Consult-defaults.user.js
// @name         Bedford + Crown Heights — Consult defaults (Crown Heights)
// @match        https://*.pointclickcare.com/care/chart/mds/mdssection.jsp*
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
    var gdrNo = document.querySelector('input[name="Cust_3_D"][value="b"]');
    if (gdrNo && !gdrNo.checked) gdrNo.click();

    var newRecsNo = document.querySelector('input[name="Cust_3_F"][value="b"]');
    if (newRecsNo && !newRecsNo.checked) newRecsNo.click();

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
  var burstLeft = 50;
  (function burst() {
    attempt();
    if (done || --burstLeft <= 0) return;
    setTimeout(burst, 60);
  })();
  setTimeout(attempt, 4000);
  setTimeout(attempt, 7000);
})();
