const DOT_SPACING = 32;
const DOT_RADIUS = 1;
const DOT_COLOR = "rgba(161, 161, 170, 0.18)"; // text-tertiary at low opacity
const GLOW_RADIUS = 200;
const GLOW_COLOR_INNER = "rgba(234, 88, 12, 0.4)";
const GLOW_COLOR_MID = "rgba(234, 88, 12, 0.08)";

function init() {
  const canvas = document.getElementById("hero-canvas") as HTMLCanvasElement | null;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const hero = canvas.parentElement;
  if (!hero) return;

  let mouseX = -1000;
  let mouseY = -1000;
  let targetX = -1000;
  let targetY = -1000;
  let raf = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas!.width = Math.floor(hero!.offsetWidth * dpr);
    canvas!.height = Math.floor(hero!.offsetHeight * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  window.addEventListener("resize", resize);

  const heroRect = () => hero!.getBoundingClientRect();

  function onMouseMove(e: MouseEvent) {
    const rect = heroRect();
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
  }

  function onMouseLeave() {
    targetX = -1000;
    targetY = -1000;
  }

  hero.addEventListener("mousemove", onMouseMove);
  hero.addEventListener("mouseleave", onMouseLeave);

  function draw() {
    const w = hero!.offsetWidth;
    const h = hero!.offsetHeight;

    // Smooth cursor follow
    mouseX += (targetX - mouseX) * 0.12;
    mouseY += (targetY - mouseY) * 0.12;

    ctx!.clearRect(0, 0, w, h);

    // Draw dot grid
    const cols = Math.ceil(w / DOT_SPACING) + 1;
    const rows = Math.ceil(h / DOT_SPACING) + 1;
    const offsetX = (w % DOT_SPACING) / 2;
    const offsetY = (h % DOT_SPACING) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = offsetX + c * DOT_SPACING;
        const y = offsetY + r * DOT_SPACING;

        const dx = x - mouseX;
        const dy = y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Base dot
        const proximity = Math.max(0, 1 - dist / GLOW_RADIUS);
        const radius = DOT_RADIUS + proximity * 2;
        const alpha = 0.18 + proximity * 0.6;

        ctx!.beginPath();
        ctx!.arc(x, y, radius, 0, Math.PI * 2);

        if (proximity > 0.01) {
          // Orange glow for nearby dots
          const orangeAlpha = proximity * 0.8;
          ctx!.fillStyle = `rgba(234, 88, 12, ${orangeAlpha})`;
        } else {
          ctx!.fillStyle = DOT_COLOR;
        }
        ctx!.fill();

        // Extra glow ring for very close dots
        if (proximity > 0.3) {
          ctx!.beginPath();
          ctx!.arc(x, y, radius + 2 + proximity * 3, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(234, 88, 12, ${proximity * 0.15})`;
          ctx!.fill();
        }
      }
    }

    // Central radial glow under cursor
    if (mouseX > -500 && mouseY > -500) {
      const gradient = ctx!.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, GLOW_RADIUS);
      gradient.addColorStop(0, GLOW_COLOR_INNER);
      gradient.addColorStop(0.4, GLOW_COLOR_MID);
      gradient.addColorStop(1, "transparent");
      ctx!.fillStyle = gradient;
      ctx!.fillRect(0, 0, w, h);
    }

    if (!reducedMotion) {
      raf = requestAnimationFrame(draw);
    }
  }

  // Draw once even with reduced motion (static dots, no cursor glow)
  raf = requestAnimationFrame(draw);

  // Cleanup
  document.addEventListener(
    "astro:before-swap",
    () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      hero!.removeEventListener("mousemove", onMouseMove);
      hero!.removeEventListener("mouseleave", onMouseLeave);
    },
    { once: true },
  );
}

init();
document.addEventListener("astro:after-swap", init);
