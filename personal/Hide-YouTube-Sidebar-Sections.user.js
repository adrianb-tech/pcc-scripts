// ==UserScript==
// @name         Hide YouTube Sidebar Sections
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Hide "Explore" and "More from YouTube" sections in the YouTube sidebar
// @match        https://www.youtube.com/*
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const sectionsToHide = ['Explore', 'More from YouTube'];

    function hideSections() {
        document.querySelectorAll('ytd-guide-section-renderer').forEach(section => {
            const title = section.querySelector('#guide-section-title, yt-formatted-string.ytd-guide-section-renderer');
            if (title && sectionsToHide.includes(title.textContent.trim())) {
                section.style.display = 'none';
            }
        });
    }

    let debounceTimer;
    new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(hideSections, 150);
    }).observe(document, { subtree: true, childList: true });

    hideSections();
})();