const VERT = `#version 300 es
precision mediump float;
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;

out vec4 fragColor;

// Simplex-style value noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 10.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float val = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 4; i++) {
    val += amp * snoise(p * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return val;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  float t = u_time * 0.04;

  // Layered noise field
  float n1 = fbm(p * 1.8 + vec2(t * 0.3, t * 0.2));
  float n2 = fbm(p * 3.2 + vec2(-t * 0.2, t * 0.15) + n1 * 0.3);
  float n3 = fbm(p * 0.8 + vec2(t * 0.1, -t * 0.08));

  float field = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
  field = field * 0.5 + 0.5; // normalize to 0-1

  // Wandering glow hotspot
  vec2 glow_center = vec2(
    sin(t * 0.7) * 0.3 + cos(t * 0.3) * 0.1,
    cos(t * 0.5) * 0.2 + sin(t * 0.4) * 0.1
  );
  float glow = exp(-length(p - glow_center) * 1.8);

  // Vignette
  float vignette = 1.0 - length(uv - 0.5) * 1.2;
  vignette = smoothstep(0.0, 0.7, vignette);

  // Color mixing
  vec3 bg = vec3(0.035, 0.035, 0.043); // #09090b
  vec3 accent1 = vec3(0.918, 0.345, 0.047); // #ea580c
  vec3 accent2 = vec3(0.976, 0.451, 0.086); // #f97316

  float intensity = field * vignette;
  vec3 col = bg;
  col += accent1 * intensity * 0.18;
  col += accent2 * glow * 0.25 * vignette;
  col += accent1 * pow(field, 3.0) * 0.12;

  // Subtle grain
  float grain = (fract(sin(dot(uv * u_time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.012;
  col += grain;

  fragColor = vec4(col, 1.0);
}`;

function init() {
  const canvas = document.getElementById("hero-canvas") as HTMLCanvasElement | null;
  if (!canvas) return;

  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
  if (!gl) return;

  const hero = canvas.parentElement;
  if (!hero) return;

  // Compile shaders
  function compile(type: number, src: string): WebGLShader | null {
    const s = gl!.createShader(type);
    if (!s) return null;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
      gl!.deleteShader(s);
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;

  gl.useProgram(prog);

  // Full-screen quad
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "u_resolution");
  const uTime = gl.getUniformLocation(prog, "u_time");

  // Resize at half DPR for performance
  function resize() {
    const dpr = Math.min(window.devicePixelRatio, 2) * 0.5;
    const w = hero!.offsetWidth;
    const h = hero!.offsetHeight;
    canvas!.width = Math.floor(w * dpr);
    canvas!.height = Math.floor(h * dpr);
    gl!.viewport(0, 0, canvas!.width, canvas!.height);
    gl!.uniform2f(uRes, canvas!.width, canvas!.height);
  }

  resize();
  window.addEventListener("resize", resize);

  // Animation
  let raf = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function frame(t: number) {
    gl!.uniform1f(uTime, t * 0.001);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    if (!reducedMotion) {
      raf = requestAnimationFrame(frame);
    }
  }

  raf = requestAnimationFrame(frame);

  // Cleanup on Astro navigation
  document.addEventListener(
    "astro:before-swap",
    () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    },
    { once: true },
  );
}

// Run on load and Astro navigation
init();
document.addEventListener("astro:after-swap", init);
