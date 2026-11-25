/** Dismissible first-visit banner: "Thursday evening is free. 3 plans fit."
 * First visit only, tracked in localStorage. */
class FirstVisitBanner extends HTMLElement {
  connectedCallback() {
    if (localStorage.getItem("micemax_seen") === "1") {
      this.remove();
      return;
    }
    localStorage.setItem("micemax_seen", "1");
    const dismiss = this.querySelector("[data-dismiss]") as HTMLButtonElement | null;
    dismiss?.addEventListener("click", () => this.remove());
  }
}

customElements.define("first-visit-banner", FirstVisitBanner);
