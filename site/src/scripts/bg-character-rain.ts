const canvas = document.getElementById("bg-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const CHARS = "[]>|_{};:/\\-+=".split("");
const CELL = 20;
const FONT_SIZE = 12;
const ACTIVE_COLUMNS = 15;
const STEP_INTERVAL = 80;

interface RainColumn {
  col: number;
  headRow: number;
  tailLen: number;
  chars: string[];
}

let cols: RainColumn[] = [];
let numCols = 0;
let numRows = 0;
let lastStep = 0;
let dpr = 1;
const usedCols = new Set<number>();

function resize() {
  dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  numCols = Math.floor(window.innerWidth / CELL);
  numRows = Math.floor(window.innerHeight / CELL) + 1;
}

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

function spawnColumn(): RainColumn {
  const available: number[] = [];
  for (let i = 0; i < numCols; i++) {
    if (!usedCols.has(i)) {
      available.push(i);
    }
  }
  const col =
    available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : Math.floor(Math.random() * numCols);
  usedCols.add(col);
  const tailLen = 6 + Math.floor(Math.random() * 5);
  return {
    col,
    headRow: -Math.floor(Math.random() * 8),
    tailLen,
    chars: Array.from({ length: tailLen + 1 }, randomChar),
  };
}

function step() {
  for (const c of cols) {
    c.headRow++;
    if (Math.random() < 0.3) {
      const idx = 1 + Math.floor(Math.random() * (c.chars.length - 1));
      c.chars[idx] = randomChar();
    }
    c.chars[0] = randomChar();
    if (c.headRow - c.tailLen > numRows) {
      usedCols.delete(c.col);
      Object.assign(c, spawnColumn());
    }
  }
}

function drawFrame(now: number) {
  if (now - lastStep >= STEP_INTERVAL) {
    step();
    lastStep += STEP_INTERVAL;
  }

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.font = `${FONT_SIZE}px "Geist Mono", monospace`;
  ctx.textAlign = "center";

  const x0 = CELL / 2;

  for (const c of cols) {
    const cx = x0 + c.col * CELL;
    for (let i = 0; i <= c.tailLen; i++) {
      const row = c.headRow - i;
      if (row < 0 || row > numRows) {
        continue;
      }
      const cy = row * CELL;
      let alpha: number;
      if (i === 0) {
        alpha = 0.85;
      } else {
        const t = i / c.tailLen;
        alpha = (1 - t) * (1 - t) * 0.22;
      }
      if (alpha < 0.01) {
        continue;
      }
      ctx.fillStyle = `rgba(250,250,250,${alpha.toFixed(3)})`;
      ctx.fillText(c.chars[i] ?? randomChar(), cx, cy);
    }
  }

  requestAnimationFrame(drawFrame);
}

function init() {
  resize();
  window.addEventListener("resize", () => {
    usedCols.clear();
    cols = [];
    resize();
    for (let i = 0; i < ACTIVE_COLUMNS; i++) {
      cols.push(spawnColumn());
    }
  });
  for (let i = 0; i < ACTIVE_COLUMNS; i++) {
    cols.push(spawnColumn());
  }
  lastStep = performance.now();
  requestAnimationFrame(drawFrame);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
