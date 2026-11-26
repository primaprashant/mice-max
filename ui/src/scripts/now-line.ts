/** Draws the current time as a thin line across the day grid, only on the
 * today panel. Position from the grid's data attributes, refreshed every
 * minute. */
const TIME_RE = /^(\d{2}):(\d{2})$/;

function toMinutes(t: string): number {
  const m = TIME_RE.exec(t);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

class NowLine extends HTMLElement {
  private timer: number | undefined;

  connectedCallback() {
    this.render();
    this.timer = window.setInterval(() => this.render(), 60_000);
  }

  disconnectedCallback() {
    if (this.timer !== undefined) clearInterval(this.timer);
  }

  private render() {
    const gridStart = this.getAttribute("data-grid-start") ?? "00:00";
    const gridEnd = this.getAttribute("data-grid-end") ?? "23:00";
    const startMin = toMinutes(gridStart);
    const endMin = toMinutes(gridEnd);
    if (endMin <= startMin) return;

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin < startMin || nowMin > endMin) {
      this.replaceChildren();
      return;
    }

    const pos = ((nowMin - startMin) / (endMin - startMin)) * 100;
    this.style.cssText = `position:absolute;left:0;right:0;top:${pos}%;pointer-events:none;z-index:500`;
    this.innerHTML = `
      <div style="position:relative;height:0;border-top:1px solid var(--color-theme);opacity:0.7">
        <span style="position:absolute;right:0;top:-9px;font-family:var(--font-mono);font-size:10px;line-height:1;color:var(--color-theme);background:var(--color-paper);padding:0 2px;font-variant-numeric:tabular-nums"></span>
      </div>
    `;
    this.querySelector("span")!.textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }
}

customElements.define("now-line", NowLine);
