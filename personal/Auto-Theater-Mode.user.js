// ==UserScript==
// @name         Auto Theater Mode
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatically enable theater mode on YouTube video pages
// @match        https://www.youtube.com/*
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    function enableTheaterMode() {
        if (!location.pathname.startsWith('/watch')) return;

        // Check if already in theater mode
        const player = document.querySelector('ytd-watch-flexy');
        if (player && player.hasAttribute('theater')) return;

        // Find and click the theater mode button
        const theaterBtn = document.querySelector('.ytp-size-button');
        if (theaterBtn) {
            theaterBtn.click();
        }
    }

    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            setTimeout(enableTheaterMode, 500); // small delay for player to load
        }
    }).observe(document, { subtree: true, childList: true });

    setTimeout(enableTheaterMode, 500);
})();