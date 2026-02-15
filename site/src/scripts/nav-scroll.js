document.addEventListener("DOMContentLoaded", () => {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const nav = document.querySelector(".nav");
  if (!nav) {
    return;
  }

  let ticking = false;

  function updateNav() {
    const scrollY = window.scrollY;
    const threshold = 400; // roughly past hero

    if (scrollY > 10) {
      nav.classList.add("nav-scrolled");
    } else {
      nav.classList.remove("nav-scrolled");
    }

    if (!prefersReducedMotion && scrollY > threshold) {
      nav.classList.add("nav-past-hero");
    } else {
      nav.classList.remove("nav-past-hero");
    }
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateNav();
          ticking = false;
        });
        ticking = true;
      }
    },
    { passive: true },
  );

  // Run once on load
  updateNav();
});
