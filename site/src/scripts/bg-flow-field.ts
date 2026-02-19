const canvas = document.getElementById("bg-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const PARTICLE_COUNT = 280;
const SPEED = 1.4;
const TRAIL_LENGTH = 30;
const RESPAWN_MARGIN = 60;

interface Particle {
  x: number;
  y: number;
  trail: Array<{ x: number; y: number }>;
  age: number;
  maxAge: number;
}

let particles: Particle[] = [];
let dpr = 1;
let t = 0;

function noise(x: number, y: number): number {
  return (
    Math.sin(x * 0.008 + t * 0.18) * Math.cos(y * 0.007 + t * 0.13) +
    Math.sin((x + y) * 0.004 + t * 0.09) * 0.6 +
    Math.cos((x - y) * 0.006 + t * 0.22) * 0.4
  );
}

function flowAngle(x: number, y: number): number {
  return noise(x, y) * Math.PI * 2;
}

function randomParticle(forceNew = false): Particle {
  const x = forceNew
    ? Math.random() * window.innerWidth
    : -RESPAWN_MARGIN + Math.random() * (window.innerWidth + RESPAWN_MARGIN * 2);
  const y = forceNew
    ? Math.random() * window.innerHeight
    : -RESPAWN_MARGIN + Math.random() * (window.innerHeight + RESPAWN_MARGIN * 2);
  return {
    x,
    y,
    trail: [],
    age: 0,
    maxAge: 180 + Math.floor(Math.random() * 220),
  };
}

function resize() {
  dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function init() {
  resize();
  window.addEventListener("resize", resize);
  particles = Array.from({ length: PARTICLE_COUNT }, () => randomParticle(true));
  requestAnimationFrame(tick);
}

function tick() {
  t += 0.004;

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  for (const p of particles) {
    const angle = flowAngle(p.x, p.y);
    p.x += Math.cos(angle) * SPEED;
    p.y += Math.sin(angle) * SPEED;
    p.age++;

    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > TRAIL_LENGTH) {
      p.trail.shift();
    }

    const offscreen =
      p.x < -RESPAWN_MARGIN ||
      p.x > window.innerWidth + RESPAWN_MARGIN ||
      p.y < -RESPAWN_MARGIN ||
      p.y > window.innerHeight + RESPAWN_MARGIN;

    if (offscreen || p.age > p.maxAge) {
      Object.assign(p, randomParticle());
      continue;
    }

    if (p.trail.length < 2) {
      continue;
    }

    const lifeRatio = 1 - p.age / p.maxAge;

    for (let i = 1; i < p.trail.length; i++) {
      const segRatio = i / p.trail.length;
      const alpha = segRatio * lifeRatio * 0.45;
      ctx.beginPath();
      ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
      ctx.lineTo(p.trail[i].x, p.trail[i].y);
      ctx.strokeStyle = `rgba(250,250,250,${alpha.toFixed(3)})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  requestAnimationFrame(tick);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
