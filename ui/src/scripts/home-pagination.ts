/** Home page pagination: 10 conference cards per page. The page buttons
 * toggle card visibility; prev and next step one page, disabled at the
 * ends. The status line reads "Showing 1 to 10 of N conferences" and
 * updates per page. The home calendar fires `calchange` when its filter
 * changes; while a filter is on, pagination hides (the filtered list is
 * small) and when it clears, pagination re-paginates the visible set. */
const CARDS_PER_PAGE = 10;

class HomePagination extends HTMLElement {
  private page = 1;
  private totalPages = 1;
  private cards: HTMLElement[] = [];
  private pageButtons: NodeListOf<HTMLButtonElement> | null = null;
  private prev: HTMLButtonElement | null = null;
  private next: HTMLButtonElement | null = null;
  private status: HTMLElement | null = null;
  private statusTemplate = "";

  connectedCallback() {
    this.cards = [...document.querySelectorAll<HTMLElement>("[data-conf-list] > li")];
    this.pageButtons = this.querySelectorAll<HTMLButtonElement>("[data-page]");
    this.prev = this.querySelector<HTMLButtonElement>("[data-page-prev]");
    this.next = this.querySelector<HTMLButtonElement>("[data-page-next]");
    this.status = document.querySelector<HTMLElement>("[data-page-status]");
    this.statusTemplate = this.status?.dataset.rangeTemplate ?? "";

    for (const b of this.pageButtons) {
      b.addEventListener("click", () => {
        this.page = Number(b.dataset.page) || 1;
        this.show();
      });
    }
    this.prev?.addEventListener("click", () => {
      this.page = Math.max(1, this.page - 1);
      this.show();
    });
    this.next?.addEventListener("click", () => {
      this.page = Math.min(this.totalPages, this.page + 1);
      this.show();
    });
    document.addEventListener("calchange", () => this.onFilter());
    this.show();
  }

  private onFilter() {
    const visible = this.cards.filter((c) => !c.classList.contains("hidden"));
    if (visible.length < this.cards.length) {
      this.classList.add("hidden");
      this.status?.classList.add("hidden");
    } else {
      this.classList.remove("hidden");
      this.status?.classList.remove("hidden");
      this.show();
    }
  }

  private show() {
    const total = this.cards.length;
    this.totalPages = Math.max(1, Math.ceil(total / CARDS_PER_PAGE));
    this.page = Math.min(this.page, this.totalPages);
    this.cards.forEach((card, i) => {
      const on = i >= (this.page - 1) * CARDS_PER_PAGE && i < this.page * CARDS_PER_PAGE;
      card.classList.toggle("hidden", !on);
    });
    for (const b of this.pageButtons ?? []) {
      b.setAttribute("aria-current", Number(b.dataset.page) === this.page ? "page" : "false");
    }
    if (this.prev) this.prev.disabled = this.page === 1;
    if (this.next) this.next.disabled = this.page === this.totalPages;
    if (this.status) {
      const from = (this.page - 1) * CARDS_PER_PAGE + 1;
      const to = Math.min(this.page * CARDS_PER_PAGE, total);
      this.status.textContent = this.statusTemplate
        .replace("{from}", String(from))
        .replace("{to}", String(to))
        .replace("{total}", String(total));
    }
  }
}

customElements.define("home-pagination", HomePagination);
