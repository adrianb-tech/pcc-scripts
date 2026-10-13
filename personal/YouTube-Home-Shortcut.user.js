// ==UserScript==
// @name         YouTube Home Shortcut
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Press Q to go home; press Q again on home to refresh videos
// @match        https://www.youtube.com/*
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    document.addEventListener('keydown', (e) => {
        const active = document.activeElement;

        const isTyping = active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.isContentEditable
        );
        if (isTyping) return;

        // Skip if focus is on the live chat iframe
        const isChatFrame = active && active.tagName === 'IFRAME' &&
            (active.id || '').toLowerCase().includes('chat');
        if (isChatFrame) return;

        if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

        if (e.key.toLowerCase() === 'q') {
            const isHome = location.pathname === '/';
            if (isHome) {
                location.reload();
            } else {
                location.href = 'https://www.youtube.com/';
            }
        }
    });
})();