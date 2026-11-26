/** Home page month calendar, connpass-style: pick a month, the list shows
 * the conferences overlapping it; click a day to narrow to that day, click
 * it again to go back to the whole month. Pure client-side over the card
 * dates; the server still renders the full list. The pagination custom
 * element hides itself while a filter is on and re-paginates the filtered
 * set when it comes back. */

const WEEKDAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

class HomeCalendar extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  private render() {
    const cards = document.querySelectorAll<HTMLElement>("[data-conf-list] > li[data-conf-start]");
    if (cards.length === 0) return;

    const lang = (document.documentElement.lang === "ja" ? "ja" : "en") as "en" | "ja";
    const strings = JSON.parse(this.dataset.strings ?? "{}") as Record<string, string>;

    const weekdayRow = this.querySelector("[data-cal-weekdays]");
    if (weekdayRow && weekdayRow.childElementCount === 0) {
      const names = lang === "ja" ? WEEKDAYS_JA : WEEKDAYS_EN;
      weekdayRow.innerHTML = names
        .map((n) => `<span class="text-center text-[10px] font-medium uppercase tracking-wider text-ink-soft">${n}</span>`)
        .join("");
    }

    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth();
    let selectedDay: string | null = null;

    // Each card carries its start and end as YYYY-MM-DD.
    const spans = [...cards].map((card) => ({
      el: card,
      start: card.dataset.confStart!,
      end: card.dataset.confEnd ?? card.dataset.confStart!,
    }));

    const monthFmt = new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en-US", {
      year: "numeric", month: "long", timeZone: "UTC",
    });
    const dayFmt = new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en-US", {
      year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
    });

    /** ISO date via real date arithmetic, so day 0 and month 13 roll over. */
    const iso = (y: number, m: number, d: number) => {
      const t = new Date(Date.UTC(y, m, d));
      return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
    };

    const inMonth = (span: { start: string; end: string }, first: string, last: string) =>
      span.start <= last && span.end >= first;

    const onDay = (span: { start: string; end: string }, day: string) =>
      span.start <= day && span.end >= day;

    const firstOf = (y: number, m: number) => iso(y, m, 1);
    const lastOf = (y: number, m: number) => iso(y, m + 1, 0);

    const notify = () => {
      this.dispatchEvent(new CustomEvent("calchange", { bubbles: true }));
    };

    this.render = () => {
      const first = firstOf(year, month);
      const last = lastOf(year, month);
      const grid = this.querySelector("[data-cal-grid]")!;
      const label = this.querySelector("[data-cal-label]")!;
      const status = this.querySelector("[data-cal-status]")!;

      label.textContent = monthFmt.format(new Date(first + "T00:00:00Z"));

      // Six rows always, so the calendar does not jump height month to month.
      const rows: string[] = [];
      const lead = new Date(first + "T00:00:00Z").getUTCDay();
      const daysInMonth = Number(last.slice(8));
      for (let i = 0; i < 42; i++) {
        const dayNum = i - lead + 1;
        const inMonthCell = dayNum >= 1 && dayNum <= daysInMonth;
        const daysInPrev = Number(lastOf(year, month - 1).slice(8));
        const dayIso = dayNum >= 1 && dayNum <= daysInMonth
          ? iso(year, month, dayNum)
          : dayNum < 1
            ? iso(year, month - 1, dayNum + daysInPrev)
            : iso(year, month + 1, dayNum - daysInMonth);
        const count = inMonthCell ? spans.filter((s) => onDay(s, dayIso)).length : 0;
        const classes = [
          "flex items-center justify-center rounded-full text-xs font-mono tabular-nums",
          "aspect-square w-full min-h-11 md:min-h-0",
          inMonthCell ? "cursor-pointer" : "cursor-default",
        ];
        if (inMonthCell) {
          if (selectedDay === dayIso) {
            classes.push("bg-ink text-paper");
          } else if (count > 0) {
            classes.push("border border-ink/25 text-ink hover:bg-ink/5");
          } else {
            classes.push("text-ink-soft/60");
          }
          if (dayIso === todayIso()) classes.push("font-semibold");
        } else {
          /* Adjacent-month days: soft gray, not opacity, so they read as
             "another month" rather than disabled. */
          classes.push("text-ink-soft/40");
        }
        rows.push(
          `<button type="button" data-day="${inMonthCell ? dayIso : ""}" class="${classes.filter(Boolean).join(" ")}" ${inMonthCell ? "" : "tabindex=\"-1\""} aria-pressed="${selectedDay === dayIso}">${dayNum > 0 && dayNum <= daysInMonth ? dayNum : new Date(dayIso + "T00:00:00Z").getUTCDate()}</button>`
        );
      }
      grid.innerHTML = rows.join("");

      const filtered = selectedDay
        ? spans.filter((s) => onDay(s, selectedDay as string))
        : spans.filter((s) => inMonth(s, first, last));
      // The demo conferences always show, whatever the filter.
      const filteredSet = new Set(filtered);
      let shown = 0;
      for (const span of spans) {
        const on = filteredSet.has(span) || span.el.dataset.confDemo === "true";
        span.el.classList.toggle("hidden", !on);
        if (on) shown++;
      }
      status.textContent = (selectedDay
        ? strings.dayScope?.replace("{day}", dayFmt.format(new Date(selectedDay + "T00:00:00Z")))
        : strings.monthScope?.replace("{month}", monthFmt.format(new Date(first + "T00:00:00Z")))) ?? "";
      status.textContent += ` (${shown})`;

      notify();
    };

    const todayIso = () => iso(today.getFullYear(), today.getMonth(), today.getDate());

    // Wire controls once; the render closure above is stable.
    const prev = this.querySelector<HTMLButtonElement>("[data-cal-prev]");
    const next = this.querySelector<HTMLButtonElement>("[data-cal-next]");
    const all = this.querySelector<HTMLButtonElement>("[data-cal-all]");

    prev?.addEventListener("click", () => {
      month--; if (month < 0) { month = 11; year--; }
      selectedDay = null;
      this.render();
    });
    next?.addEventListener("click", () => {
      month++; if (month > 11) { month = 0; year++; }
      selectedDay = null;
      this.render();
    });
    all?.addEventListener("click", () => {
      selectedDay = null;
      this.render();
    });

    this.addEventListener("click", (e) => {
      const day = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-day]");
      if (!day || !day.dataset.day) return;
      selectedDay = selectedDay === day.dataset.day ? null : day.dataset.day;
      this.render();
    });

    this.render();
  }
}

customElements.define("home-calendar", HomeCalendar);
export { WEEKDAYS_EN, WEEKDAYS_JA };
