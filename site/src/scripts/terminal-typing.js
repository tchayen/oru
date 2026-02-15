document.addEventListener("DOMContentLoaded", () => {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (prefersReducedMotion) {
    return;
  }

  const container = document.querySelector("[data-terminal-typing]");
  if (!container) {
    return;
  }

  const terminalBody = container.querySelector(".terminal-body");
  if (!terminalBody) {
    return;
  }

  // Collect all line/blank elements as an ordered sequence
  const elements = Array.from(terminalBody.querySelectorAll(".line, .blank"));
  if (elements.length === 0) {
    return;
  }

  // Parse elements into commands and output groups
  const groups = [];
  let i = 0;
  while (i < elements.length) {
    const el = elements[i];
    // A command line starts with a prompt
    if (el.classList.contains("line") && el.querySelector(".prompt")) {
      const command = el;
      const outputLines = [];
      i++;
      // Collect all following non-command lines as output
      while (i < elements.length) {
        const next = elements[i];
        if (next.classList.contains("line") && next.querySelector(".prompt")) {
          break;
        }
        outputLines.push(next);
        i++;
      }
      groups.push({ type: "command", command, outputLines });
    } else {
      // Standalone output or blank before first command
      groups.push({ type: "output", element: el });
      i++;
    }
  }

  // Create cursor element
  const cursor = document.createElement("span");
  cursor.className = "typing-cursor";
  cursor.textContent = "\u2588"; // Block cursor

  // Hide all elements initially
  elements.forEach((el) => {
    el.style.opacity = "0";
    el.style.height = "0";
    el.style.overflow = "hidden";
  });

  let hasStarted = false;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasStarted) {
          hasStarted = true;
          observer.unobserve(entry.target);
          startAnimation();
        }
      });
    },
    { threshold: 0.3 },
  );

  observer.observe(container);

  function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  function showElement(el) {
    el.style.opacity = "1";
    el.style.height = "";
    el.style.overflow = "";
  }

  async function typeText(element) {
    const promptEl = element.querySelector(".prompt");
    const childNodes = Array.from(element.childNodes);
    const originalHTML = element.innerHTML;

    // Get nodes after the prompt
    const afterPrompt = [];
    let foundPrompt = false;
    for (const node of childNodes) {
      if (
        node === promptEl ||
        (node.nodeType === 1 &&
          node.classList &&
          node.classList.contains("prompt"))
      ) {
        foundPrompt = true;
        continue;
      }
      if (foundPrompt) {
        afterPrompt.push(node);
      }
    }

    // Build a flat list of characters with their wrapping HTML
    const charSequence = [];
    for (const node of afterPrompt) {
      if (node.nodeType === 3) {
        for (const ch of node.textContent) {
          charSequence.push({ char: ch, wrapper: null });
        }
      } else if (node.nodeType === 1) {
        const tag = node.tagName.toLowerCase();
        const cls = node.className;
        for (const ch of node.textContent) {
          charSequence.push({ char: ch, wrapper: { tag, cls } });
        }
      }
    }

    // Show element with just the prompt and cursor
    showElement(element);
    element.innerHTML = "";
    if (promptEl) {
      element.appendChild(promptEl.cloneNode(true));
    }
    element.appendChild(cursor);

    // Type each character
    let currentWrapper = null;
    let currentSpan = null;

    for (let c = 0; c < charSequence.length; c++) {
      const { char, wrapper } = charSequence[c];

      if (cursor.parentNode) {
        cursor.parentNode.removeChild(cursor);
      }

      const wrapperKey = wrapper ? `${wrapper.tag}.${wrapper.cls}` : null;
      const prevKey = currentWrapper
        ? `${currentWrapper.tag}.${currentWrapper.cls}`
        : null;

      if (wrapperKey !== prevKey) {
        if (wrapper) {
          currentSpan = document.createElement(wrapper.tag);
          currentSpan.className = wrapper.cls;
          element.appendChild(currentSpan);
        } else {
          currentSpan = null;
        }
        currentWrapper = wrapper;
      }

      if (currentSpan) {
        currentSpan.textContent += char;
      } else {
        element.insertBefore(document.createTextNode(char), null);
      }

      element.appendChild(cursor);

      // Typing speed: vary slightly for natural feel
      const baseSpeed = 28;
      const variance = Math.random() * 18 - 9;
      await sleep(baseSpeed + variance);
    }

    if (cursor.parentNode) {
      cursor.parentNode.removeChild(cursor);
    }

    // Restore original HTML to ensure exact rendering
    element.innerHTML = originalHTML;
  }

  async function startAnimation() {
    await sleep(300);

    for (const group of groups) {
      if (group.type === "output") {
        showElement(group.element);
        continue;
      }

      await typeText(group.command);
      await sleep(150);

      for (const line of group.outputLines) {
        showElement(line);
      }

      await sleep(400);
    }
  }
});
