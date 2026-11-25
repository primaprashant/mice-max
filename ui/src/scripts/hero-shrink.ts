/** The experience page hero: the cover image starts full viewport and, as
 * the page scrolls, shrinks into the top of the sticky right column while
 * the centered title flies into the compact top bar and the scroll hint
 * fades. At progress 1 the overlay hides and the in-flow band shows.
 * One rAF-gated scroll listener; reads once per frame. */

/** Undo the flying-title styles so the pill returns to its static box. */
function resetHeroTitle(heroTitle: HTMLElement) {
  const pill = heroTitle.firstElementChild as HTMLElement | null;
  if (pill) {
    pill.style.position = "";
    pill.style.left = "";
    pill.style.top = "";
    pill.style.transform = "";
    pill.style.transformOrigin = "";
    pill.style.fontSize = "";
    pill.style.lineHeight = "";
    pill.style.paddingTop = "";
    pill.style.paddingBottom = "";
    pill.style.background = "";
    pill.style.backdropFilter = "";
  }
}

class HeroShrink extends HTMLElement {
  connectedCallback() {
    const overlay = this.querySelector<HTMLImageElement>("[data-hero-overlay]");
    // The band lives in the sticky right column, outside this element.
    const band = document.querySelector<HTMLElement>("[data-hero-band]");
    if (!overlay || !band) return;

    // The scroll hint floats on the full-screen hero and fades out as the
    // shrink starts; it is useless once the layout appears.
    const hint = this.querySelector<HTMLElement>("[data-scroll-hint]");
    // The compact title bar (breadcrumb and reduced title) fades in with the
    // same eased progress that drives the image shrink.
    const titleBar = document.querySelector<HTMLElement>("[data-hero-title]");
    // The centered hero title rides the full-screen image and flies into the
    // corner title as the shrink starts, one idea of the title in two places.
    const heroTitle = this.querySelector<HTMLElement>("[data-hero-title-hero]");
    const titleTarget = titleBar?.querySelector<HTMLElement>("[data-hero-title-target]");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      overlay.remove();
      heroTitle?.remove();
      return;
    }

    // The overlay starts visible on top of the band; the band stays in the
    // layout (its box is measurable) but hidden until the handoff. The
    // markup ships the overlay display:none so nothing flashes before this
    // script runs; the first update takes over from visibility.
    overlay.classList.remove("hidden");
    band.style.visibility = "hidden";
    overlay.style.visibility = "visible";

    let ticking = false;
    // The pill's home box, measured once before any transform applies.
    let home: { left: number; top: number; height: number } | null = null;
    // The sticky column pins at lg:top-20 (80 px), so the band never reaches
    // the viewport top: progress 1 is the moment it pins there.
    const STICKY_TOP = 80;

    const update = () => {
      ticking = false;
      const rect = band.getBoundingClientRect();
      const vh = window.innerHeight;
      // Progress from scroll: 0 at load, 1 exactly when the band reaches its
      // sticky offset and pins. scrollY = initialTop - rect.top, and the pin
      // happens at scrollY = initialTop - STICKY_TOP.
      const initialTop = rect.top + window.scrollY;
      const travel = initialTop - STICKY_TOP;
      const p = travel > 0 ? Math.min(1, Math.max(0, (initialTop - rect.top) / travel)) : 1;
      const ease = 1 - Math.pow(1 - p, 3); // ease-out cubic

      if (p >= 1) {
        overlay.style.visibility = "hidden";
        band.style.visibility = "visible";
        if (hint) hint.style.opacity = "0";
        if (heroTitle) {
          heroTitle.style.opacity = "0";
          heroTitle.style.pointerEvents = "none";
          resetHeroTitle(heroTitle);
        }
        if (titleBar) {
          titleBar.style.opacity = "1";
          titleBar.style.pointerEvents = "auto";
        }
        return;
      }
      overlay.style.visibility = "visible";
      band.style.visibility = "hidden";
      if (titleBar) {
        titleBar.style.opacity = String(ease);
        titleBar.style.pointerEvents = ease > 0.9 ? "auto" : "none";
      }

      // The hero title flies to the nav bar title: interpolate its pill
      // between its home box (hero center) and the nav title's box, so the
      // motion is fully driven by progress and reverses on scroll-up. The
      // pill is position:fixed inside this element, so this wrapper must
      // keep transform:none; a transformed ancestor becomes the containing
      // block for fixed descendants and offsets the landing spot.
      if (heroTitle) {
        const pill = heroTitle.firstElementChild as HTMLElement | null;
        const tRect = titleTarget?.getBoundingClientRect();
        if (pill && tRect && tRect.width > 0) {
          heroTitle.style.transform = "none";
          if (!home || home.height === 0) {
            resetHeroTitle(heroTitle);
            const r = pill.getBoundingClientRect();
            home = { left: r.left, top: r.top, height: r.height };
          }
          // Position the pill fixed only while it is in flight (p > 0); at
          // rest it stays in flow so the scroll hint below it keeps its
          // place under the title instead of sliding up into it.
          if (p > 0) {
            const scale = (tRect.height / home.height) || 1;
            Object.assign(pill.style, {
              position: "fixed",
              left: `${home.left + (tRect.left - home.left) * ease}px`,
              top: `${home.top + (tRect.top - home.top) * ease}px`,
              transform: `scale(${1 + (scale - 1) * ease})`,
              transformOrigin: "top left",
              // Match the nav title's type as it lands: same size and line
              // height so the handoff to the static title is seamless.
              fontSize: `${24 + (16 - 24) * ease}px`,
              lineHeight: `${36 + (24 - 36) * ease}px`,
              paddingTop: `${16 * (1 - ease)}px`,
              paddingBottom: `${16 * (1 - ease)}px`,
              background: `rgba(16, 18, 27, ${0.55 * (1 - ease)})`,
              backdropFilter: ease > 0.5 ? "none" : "blur(4px)",
            });
            heroTitle.style.opacity = String(1 - ease * 0.9);
          } else {
            resetHeroTitle(heroTitle);
            heroTitle.style.opacity = "1";
          }
          heroTitle.style.pointerEvents = "none";
        }
      }

      if (hint) {
        hint.style.opacity = String(1 - p);
        hint.style.pointerEvents = p > 0.1 ? "none" : "auto";
      }

      // Interpolate the overlay from full viewport to the band's box.
      const width = window.innerWidth + (rect.width - window.innerWidth) * ease;
      const height = vh + (rect.height - vh) * ease;
      const left = rect.left * ease;
      const top = rect.top * ease;
      const radius = 12 * ease; // rounded-xl on the band

      Object.assign(overlay.style, {
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: `${radius}px`,
        zIndex: "40",
        objectFit: "cover",
        pointerEvents: "none",
      });
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          // Font or layout shifts can move the pill after the home box was
          // taken; re-measure once when the page is back at the top.
          if (window.scrollY === 0) home = null;
          update();
        });
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    // Clicking the chevron scrolls past the hero, the same move the
    // animation invites. A custom rAF tween over two seconds with an
    // ease-in-out curve: the browser's native "smooth" is short and
    // abrupt, and ease-out front-loads the motion so it reads as a jump.
    hint?.addEventListener("click", () => {
      const start = window.scrollY;
      const target = window.innerHeight * 0.1;
      const distance = target - start;
      if (distance <= 0) return;
      const DURATION = 1000;
      let startTime: number | null = null;
      const step = (now: number) => {
        if (startTime === null) startTime = now;
        const t = Math.min(1, (now - startTime) / DURATION);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        window.scrollTo(0, start + distance * eased);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    update();
  }
}

customElements.define("hero-shrink", HeroShrink);
