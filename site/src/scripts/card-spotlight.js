document.addEventListener("DOMContentLoaded", () => {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (prefersReducedMotion) {
    return;
  }

  const cards = document.querySelectorAll(".feature-card, .card");

  cards.forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty("--spotlight-x", `${x}px`);
      card.style.setProperty("--spotlight-y", `${y}px`);
    });

    card.addEventListener("mouseenter", () => {
      card.classList.add("has-spotlight");
    });

    card.addEventListener("mouseleave", () => {
      card.classList.remove("has-spotlight");
    });
  });
});
