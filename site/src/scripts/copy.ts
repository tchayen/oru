document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll<HTMLElement>("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text!);
        const original = btn.innerHTML;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        btn.classList.add("copied");
        setTimeout(() => {
          btn.innerHTML = original;
          btn.classList.remove("copied");
        }, 2000);
      } catch {
        // Clipboard API not available
      }
    });
  });
});
