/** The language toggle island: wires all `lang-toggle` elements on the page.
 * Sets the `lang` cookie and reloads so the server re-renders in that
 * language. Shared by the header and the login page. */
const toggles = document.querySelectorAll("lang-toggle");

for (const toggle of toggles) {
  const buttons = toggle.querySelectorAll("button");

  function setActive(lang: string) {
    buttons.forEach((b) => {
      const on = b.dataset.lang === lang;
      b.classList.toggle("bg-ink", on);
      b.classList.toggle("text-paper", on);
    });
  }

  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      const lang = b.dataset.lang ?? "en";
      setActive(lang);
      document.cookie = `lang=${lang}; path=/; max-age=31536000`;
      location.reload();
    })
  );

  const cookie = document.cookie.match(/(?:^|;\s*)lang=(\w+)/);
  setActive(cookie?.[1] ?? "en");
}
