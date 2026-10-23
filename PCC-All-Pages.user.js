// ==UserScript==
// @name         Every facility — PCC Pages (forms list & furniture)
// @version      1.2.1
// @description  Stage 3 merge: Forms List (2.5, incl. last-mode memory), Forms highlight, CNR/Saints Forms List, Readmission flag, Hide profile sections, Header emphasis, View All checkbox, Split view - eight page scripts in ONE, each module gated to its own page as before. The tab bar (Hide unused tabs) ships as its own standalone script since 1.2.1.
// @match        https://*.pointclickcare.com/*
// @match        https://*.pointclickcare.ca/*
// @run-at       document-idle
// ==/UserScript==

(function() {
	"use strict";
	window.__tmPagesBundle = 1;
	(function() {
		"use strict";
		function norm(s) {
			return (s || "").replace(/\s+/g, " ").trim();
		}
		function isFormsPage() {
			try {
				var url = location.href;
				if (/Forms/i.test(url)) return true;
				var t = document.body ? document.body.innerText.slice(0, 2e3) : "";
				return /Forms (List|Schedules)/i.test(t);
			} catch (e) {
				return false;
			}
		}
		if (!isFormsPage()) return;
		function isCNRSaints() {
			try {
				var t = document.body ? document.body.innerText.slice(0, 4e3) : "";
				if (/Downtown Brooklyn/i.test(t)) return true;
				if (/Saints Joachim/i.test(t)) return true;
				if (/Joachim\s*&\s*Anne/i.test(t)) return true;
			} catch (e) {}
			return false;
		}
		if (isCNRSaints()) return;
		function fireClick(el) {
			try {
				el.dispatchEvent(new MouseEvent("mousedown", {
					bubbles: true,
					cancelable: true
				}));
				el.dispatchEvent(new MouseEvent("mouseup", {
					bubbles: true,
					cancelable: true
				}));
				el.dispatchEvent(new MouseEvent("click", {
					bubbles: true,
					cancelable: true
				}));
				if (el.click) el.click();
			} catch (e) {
				try {
					el.click();
				} catch (e2) {}
			}
		}
		var tabClicked = false;
		function ensureInProgressTab() {
			if (tabClicked) return;
			try {
				var bodyText = document.body ? document.body.innerText.slice(0, 2e3) : "";
				if (/In Progress List/i.test(bodyText) && !/Scheduled List/i.test(bodyText)) return;
				if (/Scheduled List/i.test(bodyText)) {
					var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
					var tn, tabEl = null;
					while (tn = walker.nextNode()) if ((tn.nodeValue || "").trim() === "In Progress") {
						var el = tn.parentElement;
						if (el && norm(el.textContent).length < 30) {
							tabEl = el;
							break;
						}
					}
					if (tabEl) {
						var clickable = tabEl;
						for (var d = 0; d < 6 && clickable; d++) {
							var tag = clickable.tagName;
							if (tag === "A" || tag === "BUTTON" || tag === "TD" || tag === "LI" || clickable.onclick || clickable.getAttribute("onclick")) break;
							clickable = clickable.parentElement;
						}
						if (!clickable) clickable = tabEl;
						tabClicked = true;
						fireClick(clickable);
					}
				}
			} catch (e) {}
		}
		var filterDone = false;
		function setPsychFormFilter() {
			if (filterDone) return;
			try {
				var inputs = document.querySelectorAll("input, select");
				for (var i = 0; i < inputs.length; i++) {
					var v = inputs[i].value || "";
					if (/Consult Form - Psychiatry/i.test(v)) {
						filterDone = true;
						return;
					}
				}
				var els = document.querySelectorAll("a, span, div, button");
				for (var j = 0; j < els.length; j++) if (norm(els[j].textContent) === "Set Filter" && els[j].children.length === 0) {
					var table = els[j].closest("table");
					if (table && /Form Type/i.test(table.textContent)) {
						fireClick(els[j]);
						setTimeout(function() {
							var boxes = document.querySelectorAll("input[type=\"checkbox\"]");
							var target = null;
							for (var k = 0; k < boxes.length; k++) {
								var lbl = boxes[k].parentElement ? norm(boxes[k].parentElement.textContent) : "";
								if (/Consult Form - Psychiatry/i.test(lbl) && !/retired/i.test(lbl)) {
									if (/Psychiatry 4/i.test(lbl)) {
										target = boxes[k];
										break;
									}
									if (!target) target = boxes[k];
								}
							}
							if (target && !target.checked) fireClick(target);
							setTimeout(function() {
								var btns = document.querySelectorAll("button, input[type=\"button\"]");
								for (var m = 0; m < btns.length; m++) {
									var bt = norm(btns[m].textContent || btns[m].value);
									if (/^(Apply|OK)$/i.test(bt) && btns[m].offsetParent !== null) {
										fireClick(btns[m]);
										filterDone = true;
										break;
									}
								}
							}, 500);
						}, 800);
						return;
					}
				}
			} catch (e) {}
		}
		var modeApplied = false, modeOverridden = false;
		function typeSelect() {
			var sels = document.querySelectorAll("select"), best = null, bestScore = -1;
			for (var i = 0; i < sels.length; i++) {
				var s = sels[i], score = 0, opts = s.options || [];
				for (var j = 0; j < opts.length; j++) if (/consult|bims|psychiatry/i.test(opts[j].textContent || "")) score += 2;
				if (opts.length > 3) score += 1;
				var host = s;
				for (var d = 0; d < 4 && host; d++) {
					host = host.parentElement;
					if (host && /^\s*Type\b/i.test(norm(host.textContent).slice(0, 12))) {
						score += 4;
						break;
					}
				}
				if (score > bestScore) {
					bestScore = score;
					best = s;
				}
			}
			return best && bestScore >= 4 ? best : null;
		}
		function savedMode() {
			try {
				var m = JSON.parse(localStorage.getItem("tmFormsMode") || "null");
				return m && m.type ? m : null;
			} catch (e) {
				return null;
			}
		}
		function learnMode() {
			var s = typeSelect();
			if (!s || !s.options || s.selectedIndex < 0) return;
			var txt = norm(s.options[s.selectedIndex].textContent);
			if (!txt) return;
			try {
				localStorage.setItem("tmFormsMode", JSON.stringify({
					type: txt,
					ts: Date.now()
				}));
			} catch (e) {}
		}
		document.addEventListener("change", function(e) {
			if (!e.isTrusted) return;
			var s = typeSelect();
			if (s && e.target === s) {
				modeOverridden = true;
				learnMode();
			}
		}, true);
		document.addEventListener("click", function(e) {
			if (!e.isTrusted) return;
			if (/^Apply$/i.test(norm(e.target.textContent || "")) && typeSelect()) {
				modeOverridden = true;
				learnMode();
			}
		}, true);
		function restoreMode() {
			if (modeApplied || modeOverridden) return;
			var s = typeSelect();
			if (!s) return;
			var saved = savedMode();
			if (!saved) {
				modeApplied = true;
				return;
			}
			var target = null;
			for (var j = 0; j < s.options.length; j++) if (norm(s.options[j].textContent) === saved.type) {
				target = s.options[j];
				break;
			}
			if (!target) {
				modeApplied = true;
				return;
			}
			if (s.value === target.value) {
				modeApplied = true;
				return;
			}
			s.value = target.value;
			try {
				s.dispatchEvent(new Event("change", { bubbles: true }));
			} catch (e) {}
			try {
				s.dispatchEvent(new Event("input", { bubbles: true }));
			} catch (e) {}
			var btns = document.querySelectorAll("button, input[type=\"button\"], input[type=\"submit\"]");
			for (var m = 0; m < btns.length; m++) if (/^Apply$/i.test(norm(btns[m].textContent || btns[m].value)) && btns[m].offsetParent !== null) {
				fireClick(btns[m]);
				break;
			}
			modeApplied = true;
		}
		var sortAttempts = 0;
		function sortScoreAscending() {
			if (sortAttempts >= 3) return;
			sortAttempts++;
			try {
				var tables = document.querySelectorAll("table");
				for (var ti = 0; ti < tables.length; ti++) {
					var headers = tables[ti].querySelectorAll("th");
					for (var hi = 0; hi < headers.length; hi++) if (norm(headers[hi].textContent) === "Score") {
						fireClick(headers[hi]);
						(function(table, th, idx) {
							setTimeout(function() {
								try {
									var scores = getColumnScores(table, idx, 3);
									if (scores.length >= 2 && scores[0] > scores[1]) sortScoreAscending();
								} catch (e) {}
							}, 2e3);
						})(tables[ti], headers[hi], hi);
						return;
					}
				}
			} catch (e) {}
		}
		function getColumnScores(table, colIdx, max) {
			var scores = [];
			var rows = table.querySelectorAll("tr");
			for (var r = 0; r < rows.length && scores.length < max; r++) {
				var tds = rows[r].querySelectorAll("td");
				if (tds.length <= colIdx) continue;
				var m = norm(tds[colIdx].textContent).match(/^(\d+(?:\.\d+)?)/);
				if (m) scores.push(parseFloat(m[1]));
			}
			return scores;
		}
		function highlightScoreOnes() {
			try {
				var rows = document.querySelectorAll("tr");
				for (var r = 0; r < rows.length; r++) {
					if ((rows[r].textContent || "").indexOf("Consult Form - Psychiatry") === -1) continue;
					var tds = rows[r].querySelectorAll("td");
					if (tds.length < 5) continue;
					var hasOne = false;
					for (var c = 0; c < tds.length; c++) if (norm(tds[c].textContent) === "1.0") {
						hasOne = true;
						break;
					}
					if (hasOne) {
						rows[r].style.backgroundColor = "#fff9c4";
						rows[r].style.outline = "2px solid #f9a825";
						rows[r].style.outlineOffset = "-2px";
					}
				}
			} catch (e) {}
		}
		function init() {
			ensureInProgressTab();
			setTimeout(function() {
				if (!typeSelect()) setPsychFormFilter();
			}, 2500);
			[
				0,
				900,
				2e3,
				3500
			].forEach(function(ms) {
				setTimeout(restoreMode, ms);
			});
			setTimeout(function() {
				sortScoreAscending();
				setTimeout(highlightScoreOnes, 4e3);
			}, 6e3);
		}
		if (document.readyState === "complete") setTimeout(init, 1500);
		else window.addEventListener("load", function() {
			setTimeout(init, 1500);
		});
	})();
	(function() {
		var BG = "#5fb86a";
		function txt(el) {
			return (el.textContent || "").replace(/\s+/g, " ").trim();
		}
		function isOne(s) {
			return /^1(\.0+)?$/.test(s);
		}
		function colIndex(table, name) {
			var cells = table.querySelectorAll("th,td");
			for (var i = 0; i < cells.length; i++) if (txt(cells[i]) === name) {
				var kids = cells[i].parentNode.children;
				for (var k = 0; k < kids.length; k++) if (kids[k] === cells[i]) return k;
			}
			return -1;
		}
		function paint(doc) {
			var rows = doc.querySelectorAll("tr");
			var tables = [], idxs = [];
			for (var r = 0; r < rows.length; r++) {
				var tr = rows[r];
				if (tr.querySelector("tr")) continue;
				var cells = tr.children;
				if (cells.length < 5) continue;
				var table = tr.closest("table");
				if (!table) continue;
				var ti = tables.indexOf(table);
				if (ti < 0) {
					tables.push(table);
					idxs.push({
						s: colIndex(table, "Score"),
						c: colIndex(table, "Category"),
						d: colIndex(table, "Description")
					});
					ti = tables.length - 1;
				}
				var ix = idxs[ti];
				if (ix.s < 0 || ix.c < 0 || ix.d < 0) continue;
				if (!cells[ix.s] || !cells[ix.c] || !cells[ix.d]) continue;
				var desc = txt(cells[ix.d]), cat = txt(cells[ix.c]), score = txt(cells[ix.s]);
				if (!(/psych/i.test(desc) || /psych/i.test(cat))) continue;
				if (!(isOne(score) || /pending\s+psychiatry/i.test(cat))) continue;
				tr.style.setProperty("background-color", BG, "important");
				for (var c = 0; c < cells.length; c++) {
					cells[c].style.setProperty("background-color", BG, "important");
					cells[c].style.fontWeight = "700";
				}
			}
		}
		function runAll() {
			var docs = [document];
			var ifr = document.querySelectorAll("iframe");
			for (var i = 0; i < ifr.length; i++) try {
				if (ifr[i].contentDocument) docs.push(ifr[i].contentDocument);
			} catch (e) {}
			docs.forEach(function(d) {
				try {
					paint(d);
				} catch (e) {}
			});
		}
		[
			400,
			1e3,
			2e3,
			3500,
			5500,
			8e3
		].forEach(function(ms) {
			setTimeout(runAll, ms);
		});
		var pccSchedLast = 0;
		document.addEventListener("click", function(e) {
			if (!e.isTrusted) return;
			var now = Date.now();
			if (now - pccSchedLast < 800) return;
			pccSchedLast = now;
			setTimeout(runAll, 350);
		}, true);
	})();
	(function() {
		"use strict";
		function norm(s) {
			return (s || "").replace(/\s+/g, " ").trim();
		}
		function isFormsPage() {
			try {
				var url = location.href;
				if (/Forms/i.test(url)) return true;
				var t = document.body ? document.body.innerText.slice(0, 2e3) : "";
				return /Forms (List|Schedules)/i.test(t);
			} catch (e) {
				return false;
			}
		}
		if (!isFormsPage()) return;
		function isCNRSaints() {
			try {
				var t = document.body ? document.body.innerText.slice(0, 4e3) : "";
				if (/Downtown Brooklyn/i.test(t)) return true;
				if (/Saints Joachim/i.test(t)) return true;
				if (/Joachim\s*&\s*Anne/i.test(t)) return true;
			} catch (e) {}
			return false;
		}
		if (!isCNRSaints()) return;
		var EXACT_FORM = "Consult Form - Psychiatry 4 - V 1";
		function fireClick(el) {
			try {
				el.dispatchEvent(new MouseEvent("mousedown", {
					bubbles: true,
					cancelable: true
				}));
				el.dispatchEvent(new MouseEvent("mouseup", {
					bubbles: true,
					cancelable: true
				}));
				el.dispatchEvent(new MouseEvent("click", {
					bubbles: true,
					cancelable: true
				}));
				if (el.click) el.click();
			} catch (e) {
				try {
					el.click();
				} catch (e2) {}
			}
		}
		var tabClicked = false;
		function ensureInProgressTab() {
			if (tabClicked) return;
			try {
				var bodyText = document.body ? document.body.innerText.slice(0, 2e3) : "";
				if (/In Progress List/i.test(bodyText) && !/Scheduled List/i.test(bodyText)) return;
				if (/Scheduled List/i.test(bodyText)) {
					var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
					var tn, tabEl = null;
					while (tn = walker.nextNode()) if ((tn.nodeValue || "").trim() === "In Progress") {
						var el = tn.parentElement;
						if (el && norm(el.textContent).length < 30) {
							tabEl = el;
							break;
						}
					}
					if (tabEl) {
						var clickable = tabEl;
						for (var d = 0; d < 6 && clickable; d++) {
							var tag = clickable.tagName;
							if (tag === "A" || tag === "BUTTON" || tag === "TD" || tag === "LI" || clickable.onclick || clickable.getAttribute("onclick")) break;
							clickable = clickable.parentElement;
						}
						if (!clickable) clickable = tabEl;
						tabClicked = true;
						fireClick(clickable);
					}
				}
			} catch (e) {}
		}
		var filterDone = false;
		function setPsychFormFilter() {
			if (filterDone) return;
			try {
				var inputs = document.querySelectorAll("input, select");
				for (var i = 0; i < inputs.length; i++) if (norm(inputs[i].value || "").toLowerCase() === EXACT_FORM.toLowerCase()) {
					filterDone = true;
					return;
				}
				var els = document.querySelectorAll("a, span, div, button");
				for (var j = 0; j < els.length; j++) if (norm(els[j].textContent) === "Set Filter" && els[j].children.length === 0) {
					var table = els[j].closest("table");
					if (table && /Form Type/i.test(table.textContent)) {
						fireClick(els[j]);
						setTimeout(function() {
							var boxes = document.querySelectorAll("input[type=\"checkbox\"]");
							var target = null;
							for (var k = 0; k < boxes.length; k++) if ((boxes[k].parentElement ? norm(boxes[k].parentElement.textContent) : "").toLowerCase() === EXACT_FORM.toLowerCase()) {
								target = boxes[k];
								break;
							}
							if (target && !target.checked) fireClick(target);
							setTimeout(function() {
								var btns = document.querySelectorAll("button, input[type=\"button\"]");
								for (var m = 0; m < btns.length; m++) {
									var bt = norm(btns[m].textContent || btns[m].value);
									if (/^(Apply|OK)$/i.test(bt) && btns[m].offsetParent !== null) {
										fireClick(btns[m]);
										filterDone = true;
										break;
									}
								}
							}, 500);
						}, 800);
						return;
					}
				}
			} catch (e) {}
		}
		function init() {
			ensureInProgressTab();
			setTimeout(setPsychFormFilter, 2500);
		}
		if (document.readyState === "complete") setTimeout(init, 1500);
		else window.addEventListener("load", function() {
			setTimeout(init, 1500);
		});
	})();
	(function() {
		var BOX_ID = "tmReadmitBox";
		function parseDate(s) {
			var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
			return m ? new Date(+m[3], +m[1] - 1, +m[2]) : null;
		}
		function lastPsychForm() {
			var best = null, bestStr = "", psychRows = 0;
			var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: function(n) {
				var p = n.parentElement;
				while (p) {
					if (p.tagName === "SCRIPT" || p.tagName === "STYLE" || p.tagName === "TEMPLATE") return NodeFilter.FILTER_REJECT;
					p = p.parentElement;
				}
				return NodeFilter.FILTER_ACCEPT;
			} });
			var node;
			while (node = walker.nextNode()) {
				var t = (node.nodeValue || "").toLowerCase();
				if (!(t.indexOf("psychiatry") !== -1 || t.indexOf("psych:") !== -1)) continue;
				if (t.indexOf("psycholog") !== -1) continue;
				var el = node.parentElement, depth = 0, found = null;
				while (el && depth < 6) {
					var rt = el.textContent || "";
					if (rt.length > 400) break;
					var m = rt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
					if (m) {
						found = m[0];
						break;
					}
					if (el.tagName === "TR") break;
					el = el.parentElement;
					depth++;
				}
				if (found) {
					psychRows++;
					var d = parseDate(found);
					if (d && (!best || d > best)) {
						best = d;
						bestStr = found;
					}
				}
			}
			var headerRow = false;
			var trs = document.querySelectorAll("tr");
			for (var i = 0; i < trs.length; i++) {
				var ht = (trs[i].textContent || "").toLowerCase();
				if (ht.length > 300) continue;
				if (ht.indexOf("form date") !== -1 || ht.indexOf("assessment date") !== -1) {
					headerRow = true;
					break;
				}
			}
			return {
				tableFound: headerRow || psychRows > 0 || !!document.getElementById("assessments"),
				d: best,
				s: bestStr
			};
		}
		function reentryDate() {
			var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), nodes = [], n;
			while (n = w.nextNode()) nodes.push(n);
			for (var i = 0; i < nodes.length; i++) {
				if (!/Admission\s*\(\s*re-?entry\s*\)/i.test(nodes[i].nodeValue)) continue;
				var same = nodes[i].nodeValue.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
				if (same) return {
					node: nodes[i],
					str: same[0]
				};
				for (var j = i + 1; j < nodes.length; j++) {
					var v = nodes[j].nodeValue.trim();
					if (!v) continue;
					if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) return {
						node: nodes[j],
						str: v
					};
					break;
				}
			}
			return null;
		}
		function clear() {
			var o = document.getElementById(BOX_ID);
			if (o && o.parentNode) o.parentNode.removeChild(o);
		}
		function render(anchor, mode, big, small) {
			var dups = document.querySelectorAll("#" + BOX_ID);
			for (var di = 1; di < dups.length; di++) if (dups[di].parentNode) dups[di].parentNode.removeChild(dups[di]);
			var box = document.getElementById(BOX_ID);
			if (box && box.__mode !== mode) {
				box.__mode = mode;
				var b = box.firstChild, s = box.lastChild;
				if (mode === "alert") {
					box.style.cssText = "display:inline-block;margin-left:16px;padding:5px 16px;background:#ff1a1a;color:#fff;border:3px solid #ff8080;box-shadow:0 0 16px rgba(255,0,0,.6);border-radius:8px;font-family:-apple-system,Helvetica,Arial,sans-serif;font-weight:800;line-height:1.2;vertical-align:middle;";
					b.style.cssText = "font-size:26px;letter-spacing:1px;";
					s.style.cssText = "font-size:14px;font-weight:600;margin-left:12px;";
				} else {
					box.style.cssText = "display:inline-block;margin-left:12px;font:12px sans-serif;color:#777;vertical-align:middle;";
					b.style.cssText = "";
					s.style.cssText = "";
				}
			}
			if (!box) {
				box = document.createElement("span");
				box.id = BOX_ID;
				box.__mode = mode;
				var b2 = document.createElement("span"), s2 = document.createElement("span");
				if (mode === "alert") {
					box.style.cssText = "display:inline-block;margin-left:16px;padding:5px 16px;background:#ff1a1a;color:#fff;border:3px solid #ff8080;box-shadow:0 0 16px rgba(255,0,0,.6);border-radius:8px;font-family:-apple-system,Helvetica,Arial,sans-serif;font-weight:800;line-height:1.2;vertical-align:middle;";
					b2.style.cssText = "font-size:26px;letter-spacing:1px;";
					s2.style.cssText = "font-size:14px;font-weight:600;margin-left:12px;";
				} else box.style.cssText = "display:inline-block;margin-left:12px;font:12px sans-serif;color:#777;vertical-align:middle;";
				box.appendChild(b2);
				box.appendChild(s2);
				try {
					anchor.parentNode.insertBefore(box, anchor.nextSibling);
				} catch (e) {
					return;
				}
			}
			box.style.display = "none";
			if (box.firstChild) box.firstChild.textContent = big;
			if (box.lastChild) box.lastChild.textContent = small;
		}
		function chartId() {
			try {
				var els = document.querySelectorAll("span, div, h1, h2, h3, td, a, b, strong");
				for (var i = 0; i < els.length; i++) {
					var tx = (els[i].textContent || "").replace(/\s+/g, " ").trim();
					if (tx.length > 70 || tx.length < 5) continue;
					if (/^clinical\s/i.test(tx)) continue;
					var em = tx.match(/^[A-Za-z][A-Za-z'’.\-]+(?:\s+[A-Za-z][A-Za-z'’.\-]+)?\s*,\s*[A-Za-z][A-Za-z'’.\- ]+?\s*\(\s*[A-Za-z]{0,5}(\d{3,})\s*\)/);
					if (em) return em[1];
				}
			} catch (e) {}
			return "";
		}
		function publishVerdict(verdict, reStr, lastFormStr) {
			try {
				localStorage.setItem("tmReadmitVerdict", JSON.stringify({
					id: chartId(),
					reentry: reStr,
					verdict,
					lastForm: lastFormStr || "",
					ts: Date.now()
				}));
			} catch (e) {}
		}
		function dropNote() {
			try {
				localStorage.removeItem("tmReadmitNote");
			} catch (e) {}
		}
		function update() {
			var re = reentryDate();
			var lf = lastPsychForm();
			if (!re || !lf.tableFound) {
				clear();
				return;
			}
			var rd = parseDate(re.str);
			if (!rd) {
				clear();
				return;
			}
			if (!lf.d) {
				dropNote();
				publishVerdict("new", re.str, "");
				clear();
				return;
			}
			if (rd >= lf.d) {
				var cand = re.str + "|" + lf.s;
				if (update._cand !== cand) {
					update._cand = cand;
					return;
				}
				publishVerdict("readmit", re.str, lf.s);
				render(re.node, "alert", "READMISSION", "on/after last psych form " + lf.s);
				try {
					localStorage.setItem("tmReadmitNote", JSON.stringify({
						id: chartId(),
						date: re.str,
						ts: Date.now()
					}));
				} catch (e) {}
			} else {
				publishVerdict("ok", re.str, lf.s);
				try {
					var cur = JSON.parse(localStorage.getItem("tmReadmitNote") || "null");
					if (cur && cur.date === re.str) localStorage.removeItem("tmReadmitNote");
				} catch (e) {}
				clear();
			}
		}
		[
			600,
			2e3,
			4e3,
			7e3
		].forEach(function(ms) {
			setTimeout(update, ms);
		});
	})();
	(function() {
		"use strict";
		var TARGETS = [
			"Medical Professionals",
			"User Defined Fields",
			"External Facilities"
		];
		var GUARDS = [
			"Admission Record",
			"Contacts",
			"Emergency Contacts",
			"Resident Profile",
			"Medical Professionals",
			"User Defined Fields",
			"External Facilities"
		];
		function norm(s) {
			return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
		}
		function headingEls(text) {
			var want = norm(text);
			var els = document.querySelectorAll("div, span, h1, h2, h3, h4, td, th, b, strong");
			var out = [];
			for (var i = 0; i < els.length; i++) {
				if (els[i].children.length > 2) continue;
				if (norm(els[i].textContent) === want) out.push(els[i]);
			}
			return out;
		}
		function containsHeading(container, text) {
			var want = norm(text);
			var els = container.querySelectorAll("div, span, h1, h2, h3, h4, td, th, b, strong");
			for (var i = 0; i < els.length; i++) {
				if (els[i].children.length > 2) continue;
				if (norm(els[i].textContent) === want) return true;
			}
			return false;
		}
		function sectionCard(headingEl, ownText) {
			var node = headingEl;
			for (var up = 0; up < 8 && node; up++) {
				node = node.parentElement;
				if (!node) break;
				var tbl = node.querySelector("table");
				if (!tbl) continue;
				if (tbl.querySelectorAll("tr").length > 12) continue;
				if (node.querySelectorAll("*").length > 1500) continue;
				var clean = true;
				for (var g = 0; g < GUARDS.length; g++) {
					if (GUARDS[g] === ownText) continue;
					if (containsHeading(node, GUARDS[g])) {
						clean = false;
						break;
					}
				}
				if (clean) return node;
			}
			return null;
		}
		function isProfilePage() {
			return containsHeading(document.body, "Admission Record") || containsHeading(document.body, "Resident Profile");
		}
		function run() {
			if (!isProfilePage()) return;
			TARGETS.forEach(function(text) {
				headingEls(text).forEach(function(h) {
					var card = sectionCard(h, text);
					if (card) card.style.display = "none";
				});
			});
		}
		[
			400,
			1e3,
			2e3,
			3500,
			5500,
			8e3
		].forEach(function(ms) {
			setTimeout(run, ms);
		});
		var lastRun = 0;
		document.addEventListener("click", function(e) {
			if (!e.isTrusted) return;
			var now = Date.now();
			if (now - lastRun < 1e3) return;
			lastRun = now;
			setTimeout(run, 300);
		}, true);
	})();
	(function() {
		function run() {}
		[
			400,
			1e3,
			2e3,
			3500,
			5500,
			8e3
		].forEach(function(ms) {
			setTimeout(run, ms);
		});
		var pccSchedLast = 0;
		document.addEventListener("click", function(e) {
			if (!e.isTrusted) return;
			var now = Date.now();
			if (now - pccSchedLast < 800) return;
			pccSchedLast = now;
			setTimeout(run, 350);
		}, true);
	})();
	(function() {
		"use strict";
		var lastKey = null;
		var MANUAL_TTL = 15e3;
		function findByLabel(root, sel, re) {
			return Array.from(root.querySelectorAll(sel)).find(function(el) {
				return re.test((el.value || el.textContent || "").trim());
			});
		}
		function getBar() {
			var apply = findByLabel(document, "input[type=\"button\"],input[type=\"submit\"],button", /^Apply$/i);
			if (!apply) return null;
			var el = apply.parentElement;
			while (el && el.querySelectorAll("select").length < 2) el = el.parentElement;
			return el;
		}
		function getViewAll() {
			return Array.from(document.querySelectorAll("input[type=\"checkbox\"]")).find(function(cb) {
				var host = cb.closest("td,th,label") || cb.parentElement;
				return host && /View\s*All/i.test(host.textContent);
			});
		}
		function filtersAreAll(bar) {
			return Array.from(bar.querySelectorAll("select")).every(function(s) {
				var o = s.options[s.selectedIndex];
				return o && /^All$/i.test(o.text.trim());
			});
		}
		document.addEventListener("click", function(e) {
			if (!e.isTrusted) return;
			var cb = getViewAll();
			if (!cb) return;
			var host = cb.closest("td,th,label") || cb.parentElement;
			if (!host || !host.contains(e.target)) return;
			var bar = getBar();
			try {
				sessionStorage.setItem("va_manual", JSON.stringify({
					key: bar && filtersAreAll(bar) ? "all" : "filtered",
					t: Date.now()
				}));
			} catch (err) {}
		}, true);
		function manualOverride(key) {
			try {
				var m = JSON.parse(sessionStorage.getItem("va_manual") || "null");
				return !!m && m.key === key && Date.now() - m.t < MANUAL_TTL;
			} catch (err) {
				return false;
			}
		}
		function tick() {
			var bar = getBar();
			if (!bar) return;
			var cb = getViewAll();
			if (!cb) return;
			var allAll = filtersAreAll(bar);
			var key = allAll ? "all" : "filtered";
			if (key === lastKey) return;
			if (manualOverride(key)) {
				lastKey = key;
				return;
			}
			if (cb.checked === allAll) {
				lastKey = key;
				return;
			}
			var last = +(sessionStorage.getItem("va_cooldown") || 0);
			if (Date.now() - last < 3e3) return;
			sessionStorage.setItem("va_cooldown", Date.now());
			lastKey = key;
			cb.click();
		}
		[
			400,
			1200,
			2500,
			4500
		].forEach(function(ms) {
			setTimeout(tick, ms);
		});
		document.addEventListener("change", function(e) {
			if (e.target && e.target.tagName === "SELECT") setTimeout(tick, 150);
		}, true);
		document.addEventListener("click", function(e) {
			if (!e.isTrusted) return;
			var v = (e.target && (e.target.value || e.target.textContent) || "").trim();
			if (/^Apply$/i.test(v)) setTimeout(tick, 900);
		}, true);
	})();
	(function() {
		"use strict";
		var topWin = window.top;
		var PANEL_ID;
		try {
			PANEL_ID = topWin.__pccPanelId || (topWin.__pccPanelId = Math.random().toString(36).slice(2) + Date.now().toString(36));
		} catch (e) {
			PANEL_ID = Math.random().toString(36).slice(2);
		}
		var OFF = false;
		function allDocs() {
			var docs = [];
			var seen = [];
			(function walk(w) {
				try {
					if (seen.indexOf(w) !== -1) return;
					seen.push(w);
					if (w.document) docs.push(w.document);
					for (var i = 0; i < w.frames.length; i++) walk(w.frames[i]);
				} catch (e) {}
			})(topWin);
			return docs;
		}
		function fireClick(el) {
			try {
				el.dispatchEvent(new MouseEvent("mousedown", {
					bubbles: true,
					cancelable: true,
					view: window
				}));
				el.dispatchEvent(new MouseEvent("mouseup", {
					bubbles: true,
					cancelable: true,
					view: window
				}));
				el.dispatchEvent(new MouseEvent("click", {
					bubbles: true,
					cancelable: true,
					view: window
				}));
				if (el.click) el.click();
			} catch (e) {
				try {
					el.click();
				} catch (e2) {}
			}
		}
		function norm(s) {
			return (s || "").replace(/\s+/g, " ").trim().toUpperCase();
		}
		function findTab(labels) {
			var docs = allDocs();
			for (var d = 0; d < docs.length; d++) {
				var els = docs[d].querySelectorAll("a,button,[role=\"tab\"],td,li,span,div");
				for (var i = 0; i < els.length; i++) {
					var el = els[i];
					if (el.children.length > 2) continue;
					var t = norm(el.textContent);
					if (labels.indexOf(t) === -1) continue;
					var clickable = el;
					for (var up = 0; up < 6 && clickable; up++) {
						var tag = clickable.tagName;
						if (tag === "A" || tag === "BUTTON" || tag === "TD" || tag === "LI" || clickable.onclick || clickable.getAttribute("onclick")) break;
						clickable = clickable.parentElement;
					}
					return clickable || el;
				}
			}
			return null;
		}
		function residentName() {
			try {
				var m = (topWin.document.body ? topWin.document.body.innerText : "").slice(0, 4e3).match(/\b([A-Z]{2,}(?:['\u2019\-][A-Z]+)?,\s*[A-Z]{2,}(?:\s+[A-Z])?)\b/);
				return m ? m[1].replace(/\s+/g, " ") : "";
			} catch (e) {
				return "";
			}
		}
		function toast(msg) {
			try {
				var doc = topWin.document;
				var old = doc.getElementById("pcc-split-toast");
				if (old) old.remove();
				var el = doc.createElement("div");
				el.id = "pcc-split-toast";
				el.textContent = msg;
				el.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:2147483647;background:#1f2937;color:#fff;font:600 13px -apple-system,sans-serif;padding:8px 14px;border-radius:999px;box-shadow:0 4px 16px rgba(0,0,0,.25);opacity:0;transition:opacity .18s;pointer-events:none;";
				doc.body.appendChild(el);
				requestAnimationFrame(function() {
					el.style.opacity = "1";
				});
				setTimeout(function() {
					el.style.opacity = "0";
					setTimeout(function() {
						el.remove();
					}, 250);
				}, 1600);
			} catch (e) {}
		}
		var channel = null;
		try {
			channel = new BroadcastChannel("pcc-split-view-v1");
		} catch (e) {}
		if (channel && window === topWin) channel.onmessage = function(ev) {
			var msg = ev.data || {};
			if (msg.type !== "goto-notes" || msg.from === PANEL_ID || OFF) return;
			var mine = residentName();
			if (msg.name && mine && msg.name !== mine) return;
			var tab = findTab(["PROG NOTES"]);
			if (tab) {
				fireClick(tab);
				toast("Split view: this side = Progress Notes");
			}
		};
		function isTyping(target) {
			if (!target) return false;
			var tag = (target.tagName || "").toUpperCase();
			return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable === true;
		}
		document.addEventListener("keydown", function(e) {
			if (!e.isTrusted || e.repeat) return;
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			if (isTyping(e.target)) return;
			if (e.key === "0") {
				OFF = !OFF;
				toast(OFF ? "Split view OFF" : "Split view ON");
				return;
			}
			if (OFF) return;
			if (!e.key || e.key.toLowerCase() !== "t") return;
			var formsTab = findTab(["FORMS", "ASSMNTS"]);
			if (!formsTab) return;
			fireClick(formsTab);
			toast("Split view: this side = Forms");
			if (channel) try {
				channel.postMessage({
					type: "goto-notes",
					from: PANEL_ID,
					name: residentName()
				});
			} catch (e2) {}
			e.preventDefault();
		}, true);
	})();
})();
