const canvas = document.getElementById("bg-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const CHARS = "|/\\-[]{}();:=+_>".split("");
const COLUMN_WIDTH = 28;
const FONT_SIZE = 13;
const MAX_ACTIVE = 14;
const SPEED_MIN = 40; // px per second
const SPEED_MAX = 90;

interface Column {
  x: number;
  y: number;
  speed: number;
  chars: string[];
  tailLength: number;
}

let columns: Column[] = [];
let lastTime = 0;
let animId: number;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

function spawnColumn() {
  const numCols = Math.floor(window.innerWidth / COLUMN_WIDTH);
  const colIndex = Math.floor(Math.random() * numCols);
  const tailLength = 6 + Math.floor(Math.random() * 6);
  const chars = Array.from({ length: tailLength }, randomChar);
  columns.push({
    x: colIndex * COLUMN_WIDTH + COLUMN_WIDTH / 2,
    y: -tailLength * FONT_SIZE * 1.4,
    speed: SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN),
    chars,
    tailLength,
  });
}

function tick(time: number) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${FONT_SIZE}px "Geist Mono", monospace`;
  ctx.textAlign = "center";

  if (columns.length < MAX_ACTIVE && Math.random() < 0.04) {
    spawnColumn();
  }

  columns = columns.filter((col) => col.y - col.tailLength * FONT_SIZE * 1.4 < canvas.height + 60);

  for (const col of columns) {
    col.y += col.speed * dt;
    if (Math.random() < 0.15) {
      const idx = Math.floor(Math.random() * col.chars.length);
      col.chars[idx] = randomChar();
    }

    for (let i = 0; i < col.tailLength; i++) {
      const charY = col.y - i * FONT_SIZE * 1.4;
      if (charY < -FONT_SIZE || charY > canvas.height + FONT_SIZE) {
        continue;
      }
      const t = i / (col.tailLength - 1);
      const alpha = i === 0 ? 0.9 : (1 - t) * 0.18 + 0.02;
      ctx.fillStyle = `rgba(250, 250, 250, ${alpha})`;
      ctx.fillText(col.chars[i], col.x, charY);
    }
  }

  animId = requestAnimationFrame(tick);
}

function init() {
  resize();
  window.addEventListener("resize", resize);
  for (let i = 0; i < 6; i++) {
    spawnColumn();
  }
  lastTime = performance.now();
  animId = requestAnimationFrame(tick);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
