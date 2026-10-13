// ==UserScript==
// @name         YouTube Arrow Navigation
// @namespace    adrianb-tech
// @version      1.1
// @description  Navigate YouTube homepage videos with arrow keys. Enter plays the selected video.
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  let enabled = true;
  let selectedEl = null;

  const HIGHLIGHT_STYLE = 'outline:3px solid #3ea6ff !important;outline-offset:2px;border-radius:12px;';

  // Load indicator: small dot bottom-right, proves the script is running
  function showIndicator() {
    if (document.getElementById('yt-nav-indicator')) return;
    const dot = document.createElement('div');
    dot.id = 'yt-nav-indicator';
    dot.title = 'YouTube Arrow Navigation active (0 to toggle)';
    dot.style.cssText = 'position:fixed;bottom:16px;right:16px;width:12px;height:12px;border-radius:50%;background:#3ea6ff;z-index:99999;opacity:0.7;pointer-events:none;';
    document.body.appendChild(dot);
  }
  function updateIndicator() {
    const dot = document.getElementById('yt-nav-indicator');
    if (dot) dot.style.background = enabled ? '#3ea6ff' : '#666';
  }
  showIndicator();

  function isTyping() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
    if (el.isContentEditable) return true;
    // YouTube search box
    if (el.closest('ytd-searchbox')) return true;
    return false;
  }

  function getVideos() {
    // Homepage grid + search results + subscription feed.
    // No :has() — filter in JS for max compatibility.
    const selectors = ['ytd-rich-item-renderer', 'ytd-video-renderer', 'ytd-grid-video-renderer', 'ytd-compact-video-renderer'];
    const items = [];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => {
        if (!el.querySelector('a#thumbnail')) return;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) items.push(el);
      });
    }
    return items;
  }

  function clearHighlight() {
    if (selectedEl) {
      selectedEl.removeAttribute('data-yt-nav-selected');
      const thumb = selectedEl.querySelector('#thumbnail');
      if (thumb) thumb.removeAttribute('style');
      selectedEl = null;
    }
    document.querySelectorAll('[data-yt-nav-selected]').forEach(el => {
      el.removeAttribute('data-yt-nav-selected');
      const thumb = el.querySelector('#thumbnail');
      if (thumb) thumb.removeAttribute('style');
    });
  }

  function highlight(el) {
    clearHighlight();
    selectedEl = el;
    el.setAttribute('data-yt-nav-selected', 'true');
    const thumb = el.querySelector('#thumbnail');
    if (thumb) thumb.setAttribute('style', HIGHLIGHT_STYLE);
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function center(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function move(direction) {
    const videos = getVideos();
    if (!videos.length) return;

    if (!selectedEl || !document.contains(selectedEl)) {
      // Start at the first visible video
      const visible = videos.filter(el => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.top < window.innerHeight;
      });
      highlight(visible[0] || videos[0]);
      return;
    }

    const cur = center(selectedEl);
    let best = null;
    let bestScore = Infinity;

    for (const el of videos) {
      if (el === selectedEl) continue;
      const p = center(el);
      const dx = p.x - cur.x;
      const dy = p.y - cur.y;

      let primary, secondary;
      if (direction === 'left') { primary = -dx; secondary = Math.abs(dy); if (dx >= -4) continue; }
      else if (direction === 'right') { primary = dx; secondary = Math.abs(dy); if (dx <= 4) continue; }
      else if (direction === 'up') { primary = -dy; secondary = Math.abs(dx); if (dy >= -4) continue; }
      else { primary = dy; secondary = Math.abs(dx); if (dy <= 4) continue; }

      // Prefer closest in the direction, penalize off-axis distance
      const score = primary + secondary * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    }

    if (best) highlight(best);
  }

  function playSelected() {
    if (!selectedEl) {
      const videos = getVideos();
      if (videos.length) highlight(videos[0]);
      return;
    }
    const link = selectedEl.querySelector('a#thumbnail');
    if (link) link.click();
  }

  document.addEventListener('keydown', (e) => {
    // Kill switch
    if (e.key === '0' && !isTyping()) {
      enabled = !enabled;
      updateIndicator();
      if (!enabled) clearHighlight();
      return;
    }
    if (!enabled || isTyping()) return;

    const k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
      // Don't hijack arrows when a video player has focus (let seek work)
      if (document.activeElement && document.activeElement.closest('.html5-video-player')) return;
      e.preventDefault();
      e.stopPropagation();
      move(k.replace('Arrow', '').toLowerCase());
    } else if (k === 'Enter') {
      if (selectedEl && document.contains(selectedEl)) {
        e.preventDefault();
        e.stopPropagation();
        playSelected();
      }
    } else if (k === 'Escape') {
      clearHighlight();
    }
  }, true);

  // Clear selection when navigating (YouTube SPA fires yt-navigate-finish)
  window.addEventListener('yt-navigate-finish', () => {
    clearHighlight();
  });
})();
