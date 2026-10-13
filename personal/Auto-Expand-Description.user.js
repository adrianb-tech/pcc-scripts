// ==UserScript==
// @name         Auto Expand Description
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Automatically expand the video description on YouTube watch pages
// @match        https://www.youtube.com/*
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    function tryExpand(retries = 20) {
        if (!location.pathname.startsWith('/watch')) return;

        const expander = document.querySelector('ytd-text-inline-expander#description-inline-expander');
        const moreBtn = document.querySelector('tp-yt-paper-button#expand');

        if (expander && expander.hasAttribute('is-expanded')) return;

        if (moreBtn && moreBtn.offsetParent !== null) {
            moreBtn.click();
            return;
        }

        if (retries > 0) {
            setTimeout(() => tryExpand(retries - 1), 300);
        }
    }

    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            tryExpand();
        }
    }).observe(document, { subtree: true, childList: true });

    tryExpand();
})();