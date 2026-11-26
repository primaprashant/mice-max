/** Home page pagination: 10 conference cards per page. The page buttons
 * toggle card visibility; prev and next step one page, disabled at the
 * ends. The status line reads "Showing 1 to 10 of N conferences" and
 * updates per page. */
const CARDS_PER_PAGE = 10;

class HomePagination extends HTMLElement {
  connectedCallback() {
    const cards = document.querySelectorAll<HTMLElement>("[data-conf-list] > li");
    const pageButtons = this.querySelectorAll<HTMLButtonElement>("[data-page]");
    const prev = this.querySelector<HTMLButtonElement>("[data-page-prev]");
    const next = this.querySelector<HTMLButtonElement>("[data-page-next]");
    const status = document.querySelector<HTMLElement>("[data-page-status]");
    const statusTemplate = status?.dataset.rangeTemplate ?? "";
    const total = cards.length;
    const totalPages = Math.max(1, Math.ceil(total / CARDS_PER_PAGE));
    let page = 1;

    const show = () => {
      cards.forEach((card, i) => {
        const on = i >= (page - 1) * CARDS_PER_PAGE && i < page * CARDS_PER_PAGE;
        card.classList.toggle("hidden", !on);
      });
      for (const b of pageButtons) {
        b.setAttribute("aria-current", Number(b.dataset.page) === page ? "page" : "false");
      }
      if (prev) prev.disabled = page === 1;
      if (next) next.disabled = page === totalPages;
      if (status) {
        const from = (page - 1) * CARDS_PER_PAGE + 1;
        const to = Math.min(page * CARDS_PER_PAGE, total);
        status.textContent = statusTemplate
          .replace("{from}", String(from))
          .replace("{to}", String(to))
          .replace("{total}", String(total));
      }
    };

    for (const b of pageButtons) {
      b.addEventListener("click", () => {
        page = Number(b.dataset.page) || 1;
        show();
      });
    }
    prev?.addEventListener("click", () => {
      page = Math.max(1, page - 1);
      show();
    });
    next?.addEventListener("click", () => {
      page = Math.min(totalPages, page + 1);
      show();
    });
    show();
  }
}

customElements.define("home-pagination", HomePagination);
