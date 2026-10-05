// ==UserScript==
// @version 1.0
// @updateURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Auto-Advance-Copied-Assessment-Boro-Park-Only.user.js
// @downloadURL https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-Auto-Advance-Copied-Assessment-Boro-Park-Only.user.js
// @name         PCC - Auto-Advance Copied Assessment (Boro Park Only)
// @match        https://*.pointclickcare.com/*
// @run-at       document-idle
// @allFrames    true
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function isBoroPark() {
        try {
            var topDoc = window.top ? window.top.document : document;
            var openerDoc = window.opener ? window.opener.document : null;
            var text = (topDoc.body ? topDoc.body.innerText : '') +
                       ' ' + (openerDoc && openerDoc.body ? openerDoc.body.innerText : '') +
                       ' ' + (document.body ? document.body.innerText : '');
            return /boro\s*park/i.test(text);
        } catch(e) {
            return true;
        }
    }

    function runWorkflow() {
        if (!isBoroPark()) return;

        var fullText = document.body ? document.body.innerText : '';

        // HARD STOP: Never auto-click on general BIMS/PHQ9 screens
        if (/BIMS/i.test(fullText) || /PHQ9/i.test(fullText) || /Cognition and Co-morbidities/i.test(fullText)) {
            return;
        }

        // STEP 0: Initial Popup - Set Assessment, Reason/Type, Check NEW, Focus Field 1
        var selects = document.querySelectorAll('select');
        var assessmentSet = false;
        var reasonSet = false;

        selects.forEach(function(sel) {
            Array.from(sel.options).forEach(function(opt) {
                if (!assessmentSet && /Psych:\s*Consult/i.test(opt.text)) {
                    if (sel.value !== opt.value) {
                        sel.value = opt.value;
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    assessmentSet = true;
                }
                if (!reasonSet && /Admission/i.test(opt.text)) {
                    if (sel.value !== opt.value) {
                        sel.value = opt.value;
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    reasonSet = true;
                }
            });
        });

        // Auto-check "NEW" radio/checkbox
        var newRadio = Array.from(document.querySelectorAll('input[type="radio"], input[type="checkbox"]')).find(function(i) {
            var label = i.closest('label') || (i.parentElement ? i.parentElement.innerText : '');
            return /NEW/i.test(label) || /NEW/i.test(i.value);
        });
        if (newRadio && !newRadio.checked) {
            newRadio.click();
        }

        // Focus field 1 if on form entry page
        var firstInput = document.querySelector('input[type="text"], textarea');
        if (firstInput && !firstInput.dataset.focused && !/search/i.test(firstInput.name || '')) {
            firstInput.focus();
            firstInput.dataset.focused = "true";
        }

        // STEP 1: Intermediate Table - Click edit ONLY on active "In Progress" Psych Consults
        var links = document.querySelectorAll('a');
        for (var a = 0; a < links.length; a++) {
            var link = links[a];
            if ((link.textContent || '').trim().toLowerCase() === 'edit') {
                var row = link.closest('tr');
                if (row) {
                    var rowText = row.innerText || '';
                    if (/In Progress/i.test(rowText) && /abalestra/i.test(rowText) && /Psych:\s*Consult/i.test(rowText)) {
                        link.click();
                        return;
                    }
                }
            }
        }

        // STEP 2: Summary Page - Click section edit ONLY if on Psych Consult summary view
        if (/SECTION Cust\. Psych:\s*Consult/i.test(fullText) || (/Reasons for Assessment/i.test(fullText) && /Psych:\s*Consult/i.test(fullText))) {
            for (var k = 0; k < links.length; k++) {
                var editLink = links[k];
                if ((editLink.textContent || '').trim().toLowerCase() === 'edit') {
                    var parentRow = editLink.closest('tr');
                    if (parentRow && /Psych:\s*Consult/i.test(parentRow.innerText)) {
                        editLink.click();
                        return;
                    }
                }
            }
        }

        // STEP 3: Electronic Signature Popup
        if (/Electronic Signature/i.test(fullText) || document.title.indexOf("Electronic Signature") !== -1) {
            var signBtn = document.querySelector('input[value="Sign"], button[type="submit"]');
            var pwInput = document.querySelector('input[type="password"]');
            if (pwInput && !pwInput.dataset.focused) {
                pwInput.focus();
                pwInput.dataset.focused = "true";
            }
            if (signBtn && pwInput && pwInput.value.length > 0) {
                signBtn.click();
                return;
            }
        }

        // STEP 4: Lock ONLY IF explicitly in the final Post-Signature view (No edit links present)
        var hasEditLinks = false;
        for (var e = 0; e < links.length; e++) {
            if ((links[e].textContent || '').trim().toLowerCase() === 'edit') {
                hasEditLinks = true;
                break;
            }
        }

        if (!hasEditLinks && /Signed\s+By/i.test(fullText) && (/Adrian\s+Balestra/i.test(fullText) || /abalestra/i.test(fullText))) {
            var allInputs = Array.from(document.querySelectorAll('input, button'));
            var lockBtn = allInputs.find(function(el) {
                return (el.value || el.textContent || '').trim().toLowerCase() === 'lock';
            });
            if (lockBtn) {
                lockBtn.click();
                return;
            }
        }

        // STEP 5: Lock Confirmation Popup - Auto-click Close
        if (/locked\s+SUCCESSFULLY/i.test(fullText) || /Lock Assessment Result/i.test(fullText)) {
            var allInputsClose = Array.from(document.querySelectorAll('input, button'));
            var closeBtn = allInputsClose.find(function(el) {
                return (el.value || el.textContent || '').trim().toLowerCase() === 'close';
            });
            if (closeBtn) {
                closeBtn.click();
                return;
            }
        }
    }

    setInterval(runWorkflow, 300);
})();