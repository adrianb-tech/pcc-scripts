// ==UserScript==
// @version 1.0
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Psych-Consult-Auto-Review-Defaults-Crown-Heights.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Psych-Consult-Auto-Review-Defaults-Crown-Heights.user.js
// @name         PCC Psych Consult - Auto Review + Defaults (Crown Heights)
// @match        https://*.pointclickcare.com/care/chart/mds/mdssection.jsp*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
  setTimeout(function() {
    // 1. Set answer defaults.
    var reasonEval = document.querySelector('input[name="Cust_1_A"][value="a"]');
    if (reasonEval && !reasonEval.checked) reasonEval.click();

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
  }, 1000);
})();
