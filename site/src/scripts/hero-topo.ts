// Animated topographic contour lines using 2D canvas
// Renders a noise field and draws iso-lines (contours) at regular thresholds

function init() {
  const canvas = document.getElementById("hero-canvas") as HTMLCanvasElement | null;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const hero = canvas.parentElement;
  if (!hero) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;

  // Simple 2D noise (value noise with smoothstep interpolation)
  const PERM = new Uint8Array(512);
  {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates with fixed seed
    let seed = 42;
    for (let i = 255; i > 0; i--) {
      seed = (seed * 16807 + 0) % 2147483647;
      const j = seed % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  }

  function fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function lerp(a: number, b: number, t: number) {
    return a + t * (b - a);
  }

  function grad(hash: number, x: number, y: number) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  function noise(x: number, y: number) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = PERM[PERM[xi] + yi];
    const ab = PERM[PERM[xi] + yi + 1];
    const ba = PERM[PERM[xi + 1] + yi];
    const bb = PERM[PERM[xi + 1] + yi + 1];
    return lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v,
    );
  }

  function fbm(x: number, y: number) {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < 4; i++) {
      val += amp * noise(x * freq, y * freq);
      freq *= 2;
      amp *= 0.5;
    }
    return val;
  }

  // Resolution for the noise field (low-res grid, then march contours)
  const CELL = 4; // pixels per cell
  const CONTOURS = 10; // number of contour levels
  const SPEED = 0.08;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas!.width = Math.floor(hero!.offsetWidth * dpr);
    canvas!.height = Math.floor(hero!.offsetHeight * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  window.addEventListener("resize", resize);

  function draw(time: number) {
    const w = hero!.offsetWidth;
    const h = hero!.offsetHeight;
    const t = time * 0.001 * SPEED;

    ctx!.clearRect(0, 0, w, h);

    const cols = Math.ceil(w / CELL) + 1;
    const rows = Math.ceil(h / CELL) + 1;

    // Build noise field
    const field = new Float32Array(cols * rows);
    const scale = 0.004;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * CELL;
        const y = r * CELL;
        field[r * cols + c] = fbm(x * scale + t, y * scale + t * 0.6);
      }
    }

    // Find min/max
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < field.length; i++) {
      if (field[i] < min) min = field[i];
      if (field[i] > max) max = field[i];
    }
    const range = max - min || 1;

    // Normalize
    for (let i = 0; i < field.length; i++) {
      field[i] = (field[i] - min) / range;
    }

    // March contour lines using marching squares
    // For each contour level, find line segments
    const centerX = w / 2;
    const centerY = h * 0.4;

    for (let level = 1; level < CONTOURS; level++) {
      const threshold = level / CONTOURS;

      // Distance-based opacity: brighter near center
      ctx!.beginPath();

      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const tl = field[r * cols + c];
          const tr = field[r * cols + c + 1];
          const br = field[(r + 1) * cols + c + 1];
          const bl = field[(r + 1) * cols + c];

          // Marching squares case
          const cas =
            (tl >= threshold ? 8 : 0) |
            (tr >= threshold ? 4 : 0) |
            (br >= threshold ? 2 : 0) |
            (bl >= threshold ? 1 : 0);

          if (cas === 0 || cas === 15) continue;

          const x = c * CELL;
          const y = r * CELL;

          // Interpolation helpers
          const lerpX = (a: number, b: number) => {
            const d = b - a;
            return d === 0 ? 0.5 : (threshold - a) / d;
          };

          const top = x + lerpX(tl, tr) * CELL;
          const right = y + lerpX(tr, br) * CELL;
          const bottom = x + lerpX(bl, br) * CELL;
          const left = y + lerpX(tl, bl) * CELL;

          const segments: [number, number, number, number][] = [];

          switch (cas) {
            case 1:
            case 14:
              segments.push([x, left, bottom, y + CELL]);
              break;
            case 2:
            case 13:
              segments.push([bottom, y + CELL, x + CELL, right]);
              break;
            case 3:
            case 12:
              segments.push([x, left, x + CELL, right]);
              break;
            case 4:
            case 11:
              segments.push([top, y, x + CELL, right]);
              break;
            case 5:
              segments.push([x, left, top, y]);
              segments.push([bottom, y + CELL, x + CELL, right]);
              break;
            case 6:
            case 9:
              segments.push([top, y, bottom, y + CELL]);
              break;
            case 7:
            case 8:
              segments.push([x, left, top, y]);
              break;
            case 10:
              segments.push([top, y, x + CELL, right]);
              segments.push([x, left, bottom, y + CELL]);
              break;
          }

          for (const [x1, y1, x2, y2] of segments) {
            ctx!.moveTo(x1, y1);
            ctx!.lineTo(x2, y2);
          }
        }
      }

      // Opacity based on distance from center (vignette-like)
      // Also vary by contour level for depth
      const baseAlpha = 0.12 + (level / CONTOURS) * 0.08;
      ctx!.strokeStyle = `rgba(234, 88, 12, ${baseAlpha})`;
      ctx!.lineWidth = 0.8;
      ctx!.stroke();
    }

    // Central radial glow overlay
    const glowGrad = ctx!.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      Math.max(w, h) * 0.5,
    );
    glowGrad.addColorStop(0, "rgba(234, 88, 12, 0.06)");
    glowGrad.addColorStop(0.3, "rgba(234, 88, 12, 0.03)");
    glowGrad.addColorStop(1, "transparent");
    ctx!.fillStyle = glowGrad;
    ctx!.fillRect(0, 0, w, h);

    if (!reducedMotion) {
      raf = requestAnimationFrame(draw);
    }
  }

  raf = requestAnimationFrame(draw);

  document.addEventListener(
    "astro:before-swap",
    () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    },
    { once: true },
  );
}

init();
document.addEventListener("astro:after-swap", init);
