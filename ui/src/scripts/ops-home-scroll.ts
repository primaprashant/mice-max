/** /ops page motion: counters count up once, timeline beats fade in, the line fills on scroll. */
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
document.querySelector(".oh-page")?.classList.add("oh-ready");

function countUp() {
  const els = document.querySelectorAll<HTMLElement>("[data-count]");
  if (reduced || !els.length) return;
  const fmt = new Intl.NumberFormat(document.documentElement.lang === "ja" ? "ja-JP" : "en-US");
  const start = performance.now();
  const dur = 1500;
  const frame = (now: number) => {
    const p = Math.min(1, (now - start) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    els.forEach((el) => (el.textContent = fmt.format(Math.round(Number(el.dataset.count) * e))));
    if (p < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function timeline() {
  const list = document.querySelector<HTMLElement>("[data-oh-timeline]");
  const fill = document.querySelector<HTMLElement>("[data-oh-fill]");
  if (!list || !fill) return;
  const beats = list.querySelectorAll<HTMLElement>("[data-oh-beat]");
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("is-in"), io.unobserve(e.target))),
    { rootMargin: "0px 0px -15% 0px" }
  );
  beats.forEach((b) => io.observe(b));

  if (reduced) return fill.style.setProperty("--p", "1");
  let queued = false;
  const update = () => {
    queued = false;
    const r = list.getBoundingClientRect();
    const p = (innerHeight * 0.6 - r.top) / r.height;
    fill.style.setProperty("--p", String(Math.max(0, Math.min(1, p))));
  };
  addEventListener("scroll", () => !queued && (queued = true, requestAnimationFrame(update)), { passive: true });
  addEventListener("resize", update);
  update();
}

countUp();
timeline();
