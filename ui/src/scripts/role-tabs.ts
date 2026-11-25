/** Role tabs on the login page: which view the form signs into.
 * Same pattern as day-tabs: toggle buttons with aria-pressed, one form
 * field `role` kept in sync so the server picks the redirect. The consent
 * row belongs to the attendee role only: hidden for the other roles, and
 * required only when visible. */
const CONSENT_REQUIRED_ROLE = "attendee";

class RoleTabs extends HTMLElement {
  connectedCallback() {
    const tabs = this.querySelectorAll<HTMLButtonElement>("[data-role-tab]");
    const input = document.querySelector<HTMLInputElement>("[data-role-input]");
    const consent = document.querySelector<HTMLInputElement>("[data-consent]");
    const consentRow = document.querySelector<HTMLElement>("[data-consent-row]");

    const apply = (role: string) => {
      const consentNeeded = role === CONSENT_REQUIRED_ROLE;
      if (input) input.value = role;
      if (consentRow) consentRow.classList.toggle("hidden", !consentNeeded);
      if (consent) consent.required = consentNeeded;
    };

    for (const tab of tabs) {
      tab.addEventListener("click", () => {
        const role = tab.dataset.roleTab ?? "";
        for (const t of tabs) {
          const on = t === tab;
          t.setAttribute("aria-pressed", on ? "true" : "false");
          t.classList.toggle("border-ink", on);
          t.classList.toggle("bg-ink", on);
          t.classList.toggle("text-paper", on);
          t.classList.toggle("border-ink/25", !on);
          t.classList.toggle("text-ink-soft", !on);
          t.classList.toggle("hover:bg-ink/5", !on);
        }
        apply(role);
      });
    }
  }
}

customElements.define("role-tabs", RoleTabs);
