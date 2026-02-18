function showCopiedFeedback(btn: HTMLElement) {
  const original = btn.innerHTML;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  btn.classList.add("copied");
  setTimeout(() => {
    btn.style.opacity = "0";
    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove("copied");
      btn.style.opacity = "1";
    }, 150);
  }, 2000);
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll<HTMLElement>("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text!);
        showCopiedFeedback(btn);
      } catch {
        // Clipboard API not available
      }
    });
  });

  document.querySelectorAll<HTMLElement>("[data-copy-code]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const block = btn.closest(".mini-code-wrap")?.querySelector(".mini-code-content");
      if (!block) {
        return;
      }
      const clone = block.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(".prompt").forEach((el) => el.remove());
      clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
      const text = (clone.textContent ?? "").trim();
      try {
        await navigator.clipboard.writeText(text);
        showCopiedFeedback(btn);
      } catch {
        // Clipboard API not available
      }
    });
  });
});
