// ==UserScript==
// @name         Block YouTube Shorts
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Hide all Shorts content and redirect away from Shorts pages
// @match        https://www.youtube.com/*
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Redirect if you land on a /shorts/ URL
    function redirectIfShorts() {
        if (location.pathname.startsWith('/shorts')) {
            location.replace('https://www.youtube.com/');
        }
    }
    redirectIfShorts();

    // Watch for URL changes (YouTube is a single-page app)
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            redirectIfShorts();
        }
    }).observe(document, { subtree: true, childList: true });

    // Hide Shorts shelves, sidebar links, and thumbnails
    const style = document.createElement('style');
    style.textContent = `
        ytd-reel-shelf-renderer,
        ytd-rich-shelf-renderer[is-shorts],
        ytd-guide-entry-renderer:has(a[title="Shorts"]),
        ytd-mini-guide-entry-renderer:has(a[title="Shorts"]),
        a[href^="/shorts"] {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
})();