// ==UserScript==
// @name         Clean Google Search
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Remove ads, "People also search for," related services, "Sponsored stores," "Save your favorite brands," and blocked domains from Google
// @match        https://www.google.com/search*
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const phrasesToHide = [
        'People also search for',
        'Find related products and services',
        'Sponsored stores',
        'Save your favorite brands to get more relevant results'
    ];

    const blockedDomains = [
        'instagram.com',
        'tiktok.com',
        'craigslist.org',
        'doublelist.com',
        'locanto.com',
        'x.com',
        'twitter.com',
        'snapchat.com'
    ];

    function cleanPage() {
        document.querySelectorAll('#tads, #tadsb, #bottomads').forEach(el => el.remove());

        document.querySelectorAll('*').forEach(el => {
            if (el.children.length === 0) {
                const text = el.textContent.trim();
                if (phrasesToHide.includes(text)) {
                    const container = el.closest('div[data-hveid], g-section-with-header, div[jsname]');
                    if (container) container.style.display = 'none';
                }
            }
        });

        document.querySelectorAll('a[href]').forEach(link => {
            const href = link.href;
            if (blockedDomains.some(domain => href.includes(domain))) {
                const result = link.closest('div[data-hveid], div.g, div[jscontroller]');
                if (result) result.style.display = 'none';
            }
        });
    }

    let debounceTimer;
    new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(cleanPage, 150);
    }).observe(document, { subtree: true, childList: true });

    cleanPage();
})();