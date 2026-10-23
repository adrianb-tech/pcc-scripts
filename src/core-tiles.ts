// The tile component - ONE implementation of a tile, used
// for every tile in the row (Lit, light DOM on purpose:
// his G key, the tile highlight, and the BIMS pop all reach
// into the row's DOM from other code, so the tiles stay in
// the document tree where that code can find them; sealing
// them in shadow DOM waits until Stage 3 absorbs those
// consumers). Rendering mirrors the legacy tile() helper
// style-for-style; behaviors ride the hooks the More/Less
// module registers on the kernel (queueCopy, hlTile,
// goWtsVitals, medsPanel, fireClick, flashLabel).
import { html, LitElement } from 'lit';

type TileOpts = {
  warn?: boolean; rose?: boolean; pad?: string; minW?: number; wide?: boolean; full?: boolean;
  grow?: boolean; natW?: boolean; maxW?: number; fixedW?: number; size?: number;
  weight?: number; color?: string; multi?: boolean; cols?: boolean; fit?: boolean;
  rows?: boolean;
  nowrap?: boolean; maxw?: string; nav?: boolean;
  click?: { label: string; value: string };
  action?: string;
  fill?: { label: string; value: string };
  delegate?: string;
  anchorCycle?: boolean;
  frozenW?: number;
  frozenH?: number;
};

class TmTile extends LitElement {
  static properties = {
    label: { type: String }, value: { type: String },
    opts: { type: Object }, chip: { type: String },
  };
  declare label: string;
  declare value: string;
  declare opts: TileOpts;
  declare chip: string;
  declare stamp: string;
  constructor() { super(); this.label = ''; this.value = ''; this.opts = {}; this.chip = ''; this.stamp = ''; }
  createRenderRoot() { return this; }  // light DOM (see header)

  private hooks(): any { return (window as any).__tmCore?.hooks || {}; }
  private card(): HTMLElement | null { return this.querySelector('[data-tm-card]'); }
  private labelSpan(): HTMLElement | null { return this.querySelector('[data-tm-label]'); }
  // The Summary tile's anchor chip: clicking it cycles the
  // summary's time window (never fills - the card keeps its
  // own click for that).
  private onAnchorClick(e: Event) {
    e.stopPropagation(); e.preventDefault();
    this.hooks().cycleSummaryAnchor?.(this);
  }

  private onMouseDown() {
    const o = this.opts || {};
    if (o.click || o.delegate || o.nav || o.action) this.hooks().hlTile?.(this.card(), false);
  }
  private onClick() {
    const o = this.opts || {};
    const h = this.hooks();
    if (o.nav) {
      if (!h.goWtsVitals?.()) {
        const ls = this.labelSpan();
        if (ls) {
          if (!ls.getAttribute('data-tm-orig')) ls.setAttribute('data-tm-orig', ls.textContent || '');
          ls.textContent = 'Not found';
          setTimeout(() => { const orig = ls.getAttribute('data-tm-orig'); if (orig) { ls.textContent = orig; ls.removeAttribute('data-tm-orig'); } }, 1400);
        }
      }
      return;
    }
    if (o.delegate === 'meds') {
      const p = h.medsPanel?.();
      if (p && p.btn) { h.fireClick?.(p.btn); h.flashLabel?.(this.labelSpan(), this.card()); }
      return;
    }
    if (o.action) { h.action?.(o.action); return; }
    if (o.click) { h.queueCopy?.(o.click.label, o.click.value); h.flashLabel?.(this.labelSpan(), this.card()); }
  }

  render() {
    const o = this.opts || {};
    const clickable = !!(o.click || o.delegate || o.nav || o.action);
    const cardCss = 'background:' + (o.warn ? '#ff1a1a' : (o.rose ? '#fdf3f2' : '#fff')) + ';border:1px solid ' +
      (o.warn ? '#ff8080' : (o.rose ? '#f0c8c2' : '#e2e8f0')) + ';border-radius:12px;box-shadow:' +
      (o.warn ? '0 0 10px rgba(255,26,26,.55),0 1px 3px rgba(15,23,42,.05)' : '0 1px 3px rgba(15,23,42,.05)') + ';' +
      'padding:' + (o.pad || '12px 16px 14px') + ';min-width:' + (o.minW || 0) + 'px;' +
      // SMOOTH ARRIVAL freeze (audit A3): when moreless
      // has frozen this tile at presentation, the frozen
      // size IS the frame - explicit width/height, no flex
      // growth, overflow clipped - and later text wraps
      // inside it instead of resizing the tile on screen.
      (o.frozenW && o.frozenH ? 'flex:none;width:' + o.frozenW + 'px;height:' + o.frozenH + 'px;overflow:hidden;' :
      (o.full ? 'flex:1 1 auto;min-width:0;' : (o.wide ? 'flex:1 1 180px;min-width:0;' : (o.grow ? 'flex:1 1 400px;min-width:0;' : (o.natW ? 'flex:none;width:auto;' + (o.maxW ? 'max-width:' + o.maxW + 'px;' : '') : (o.fixedW ? 'flex:0 1 ' + o.fixedW + 'px;width:' + o.fixedW + 'px;' : 'flex:none;')))))) +
      (o.maxw ? 'max-width:' + o.maxw + ';' : '') + (clickable ? 'cursor:pointer;' : '');
    const labelCss = 'white-space:nowrap;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:' +
      (o.warn ? '#ffe1e1' : (o.rose ? '#a05a52' : '#8494a7')) + ';';
    const fontCss = 'font-size:' + (o.size || 21) + 'px;font-weight:' + (o.weight || 700) +
      ';line-height:' + (o.multi ? '1.45' : '1.3') + ';color:' + (o.warn ? '#ffffff' : (o.color || '#131c2b')) + ';';
    const chipCss = 'font-size:16px;font-weight:800;color:' + (o.warn ? '#ffffff' : '#2563eb') + ';';
    // Rows mode (the Admission tile, his spec 2026-10-23): the
    // value is 'Label|value' lines rendered as tight dated rows -
    // mini caps label + bold value - with NO separate label row,
    // so three rows fit the band's frozen 72px frame. The first
    // row's label carries data-tm-label (the component contract:
    // every tile has one).
    if (o.rows) {
      const rowLines = String(this.value || '').split('\n').filter((ln) => ln.length);
      return html`<div data-tm-card style=${cardCss} title=${clickable ? 'Click to copy' : ''} @mousedown=${this.onMouseDown} @click=${this.onClick}>
      <div style="margin-top:2px;">${rowLines.map((ln, i) => {
        const cut = ln.indexOf('|');
        const lab = cut >= 0 ? ln.slice(0, cut) : ln;
        const val = cut >= 0 ? ln.slice(cut + 1) : '';
        return html`<div class="tmAdmRow" style="display:flex;align-items:baseline;gap:8px;line-height:1.5;">
          <span class="tmAdmLab" ?data-tm-label=${i === 0} style="flex:none;width:66px;font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8494a7;">${lab}</span>
          <span class="tmAdmVal" style="font-size:12.5px;font-weight:700;color:${val === '—' ? '#b6c2d2' : '#131c2b'};">${val}</span>
        </div>`;
      })}</div>
    </div>`;
    }
    let valuePart: unknown;
    if (!this.value) {
      valuePart = html`<div style=${'margin-top:9px;' + fontCss + 'color:#b6c2d2;'}>—</div>`;
    } else if (o.cols) {
      const lines = String(this.value).split('\n');
      const ncols = Math.max(1, Math.ceil(lines.length / 4));
      const per = Math.ceil(lines.length / ncols);
      const cols = [];
      for (let ci = 0; ci < ncols; ci++) cols.push(lines.slice(ci * per, (ci + 1) * per));
      valuePart = html`<div data-medsfit="1" style="margin-top:9px;display:flex;gap:26px;min-width:0;">${cols.map((slice) => html`<div style="max-width:300px;flex:1 1 0;min-width:0;">${slice.map((ln) => html`<div class="tmMedLine" style=${fontCss + 'white-space:nowrap;'}>${ln}</div>`)}</div>`)}</div>`;
    } else {
      valuePart = html`<div ?data-fit=${!!o.fit} style=${'margin-top:9px;' + fontCss + (o.multi ? 'white-space:pre-line;' : '') + (o.nowrap ? 'white-space:nowrap;' : '')}>${this.value}</div>`;
    }
    return html`<div data-tm-card style=${cardCss} title=${clickable ? 'Click to copy' : ''} @mousedown=${this.onMouseDown} @click=${this.onClick}>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">
        <span data-tm-label style=${labelCss}>${this.label}</span>
        ${this.chip ? (o.anchorCycle
          ? html`<span style=${chipCss} title="Switch summary window" @click=${this.onAnchorClick}>${this.chip}</span>`
          : html`<span style=${chipCss}>${this.chip}</span>`) : ''}
      </div>
      ${valuePart}
      ${this.stamp ? html`<div style="font-size:10px;font-weight:500;color:#9aa1ab;margin-top:4px;">${this.stamp}</div>` : ''}
    </div>`;
  }
}
customElements.define('tm-tile', TmTile);
