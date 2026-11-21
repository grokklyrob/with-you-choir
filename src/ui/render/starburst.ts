/**
 * The arc stage's "starburst" sky (`"stage": { "sky": "starburst" }`): one fullscreen fragment
 * shader drawn behind the heads. A white-hot core high in the frame, a slowly turning, breathing
 * corona of jagged ink spikes with the glow bleeding through the gaps, a soft light shaft falling
 * to a valley floor, drifting flakes, wet dark ridges rising on both sides, film grain and an
 * optional letterbox. Everything is procedural (no textures); the cost is one quad.
 *
 * Options (`"stage": { "starburst": { … } }`, all optional):
 *   core: [x, y]   the core's centre, in frame heights from the middle (default [0, 0.23])
 *   size: 1        the corona's scale
 *   letterbox: 0   bar height, as a fraction of the frame height: one for both, or [top, bottom]
 *   pulse: 0.6     how much the core swells with the singers' loudness (0: steady)
 *   warm, cool     the rim tints (#rrggbb); default a gold and a pale blue
 */
import * as THREE from "three";

export interface StarburstOpts {
  core?: [number, number];
  size?: number;
  /** one height for both bars, or [top, bottom] */
  letterbox?: number | [number, number];
  pulse?: number;
  warm?: string;
  cool?: string;
}

const hex = (s: string, fb: [number, number, number]) => {
  if (!/^#[0-9a-f]{6}$/i.test(s)) return new THREE.Vector3(...fb);
  const v = parseInt(s.slice(1), 16);
  return new THREE.Vector3(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
};

const VERT = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uTime, uAmp, uPan, uSize;
uniform vec2 uLetterbox;
uniform vec2 uCore;
uniform vec3 uWarm, uCool;

const float TAU = 6.2831853;
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
vec3 h31(float p) { vec3 q = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xxy + q.yzz) * q.zyx); }
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 h22(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}

// one ring of ink spikes around the core: x = ink cover, y = lit rim
vec2 spikes(vec2 d, float n, float rot, float seed, float len, float wid, float aa) {
  float r = length(d);
  float a = atan(d.y, d.x) + rot;
  float u = (a / TAU + 0.5) * n;
  float ci = floor(u);
  float ink = 0.0, rim = 0.0;
  float r0 = 0.03 * uSize;
  for (int k = -1; k <= 1; k++) {
    float cell = ci + float(k);
    float id = mod(cell, n) + seed;
    vec3 h = h31(id);
    float c = cell + 0.5 + (h.x - 0.5) * 0.9;
    // a little bend along the spike, so the corona is not a perfect sunburst
    float bend = 0.035 * sin(r * 22.0 + id * 3.1 + uTime * 0.25) * smoothstep(0.0, 0.2, r);
    float da = ((u - c) / n) * TAU + bend;
    da = mod(da + 0.5 * TAU, TAU) - 0.5 * TAU;
    float L = len * uSize * (0.05 + 0.15 * h.y * h.y + 0.26 * step(0.86, h.z) * h.y);
    L *= 1.0 + 0.07 * sin(uTime * 0.37 + id) + 0.06 * uAmp;
    float t = clamp((r - r0) / L, 0.0, 1.0);
    // ink-like: fat at the root, tapering to a needle, with notches along the edge
    float notch = 0.65 + 0.7 * vnoise(vec2(r * 90.0, id * 7.0));
    float hw = wid * uSize * (0.0035 + 0.011 * h.z) * pow(1.0 - t, 1.25) * notch;
    float dist = abs(da) * r;
    float inside = step(r0 * 0.6, r) * step(r, r0 + L);
    float m = smoothstep(hw + aa, hw - aa, dist) * inside;
    float e = (smoothstep(hw + 3.0 * aa, hw, dist) - m) * inside * (1.0 - t);
    ink = max(ink, m);
    rim = max(rim, e * (0.4 + 0.6 * h.x));
  }
  return vec2(ink, rim);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 p = (fc - 0.5 * uRes) / uRes.y;
  float A = uRes.x / uRes.y;
  float aa = 1.4 / uRes.y;
  float t = uTime;

  vec2 core = uCore + vec2(uPan * 0.12, 0.0);
  vec2 d = p - core;
  float r = length(d);
  float amp = uAmp;

  // the sky: charcoal, a breath of blue up high, warmer towards the valley
  vec3 col = mix(vec3(0.05, 0.05, 0.055), vec3(0.026, 0.03, 0.052), smoothstep(-0.2, 0.5, p.y));
  col += 0.025 * vec3(1.0, 0.9, 0.75) * (1.0 - smoothstep(-0.5, 0.1, p.y));
  col += 0.04 * (fbm(p * 2.2 + vec2(t * 0.01, 0.0)) - 0.5) * vec3(0.8, 0.85, 1.0);

  // the glow behind everything: wide haze, then the hot halo
  float pulse = 1.0 + amp;
  // below the core the haze thins, so a singer standing in the shaft keeps its contrast
  float haze = exp(-r * 2.6 / uSize) * (0.4 + 0.6 * smoothstep(-0.32, 0.02, d.y));
  float halo = exp(-r * 9.0 / uSize);
  col += haze * 0.16 * mix(uCool, vec3(1.0, 0.95, 0.88), 0.55);
  col += halo * 0.55 * pulse * mix(uWarm, vec3(1.0, 0.97, 0.92), 0.6);

  // the light shaft from the core to the valley floor, with soft volumetric streaks
  float below = -d.y;
  if (below > 0.0) {
    float wdt = 0.03 + below * 0.33;
    float ang = d.x / max(below, 1e-3);
    float streak = 0.6 + 0.4 * vnoise(vec2(ang * 9.0, t * 0.15)) * vnoise(vec2(ang * 23.0 + 4.0, t * 0.11));
    float shaft = exp(-pow(d.x / wdt, 2.0)) * smoothstep(0.0, 0.12, below) * streak;
    col += shaft * 0.065 * smoothstep(0.75, 0.15, below) * (0.85 + 0.3 * amp) * vec3(1.0, 0.95, 0.85);
  }
  // the pool of light where the shaft lands
  vec2 fl = p - vec2(core.x, -0.43);
  col += 0.08 * exp(-(fl.x * fl.x * 14.0 + fl.y * fl.y * 160.0)) * vec3(1.0, 0.93, 0.8);

  // the corona: two rings turning slowly against each other, ink over the glow
  vec2 s1 = spikes(d, 104.0, t * 0.012, 3.0, 1.0, 1.35, aa);
  vec2 s2 = spikes(d, 50.0, -t * 0.007 + 0.4, 101.0, 1.6, 0.9, aa);
  vec2 s3 = spikes(d, 64.0, t * 0.02 + 1.3, 57.0, 0.55, 2.3, aa);
  float ink = max(max(s1.x, s2.x), s3.x), rim = max(max(s1.y, s2.y), s3.y);
  float bleed = exp(-r * 30.0 / uSize); // right at the core the light eats the ink
  col = mix(col, vec3(0.006, 0.007, 0.011), ink * (1.0 - 0.6 * bleed));
  float rimT = h11(floor(atan(d.y, d.x) * 6.0));
  col += rim * exp(-r * 4.0 / uSize) * 0.55 * mix(uWarm, uCool, step(0.5, rimT));

  // the white-hot core on top, swelling with the voices
  float cr = 0.032 * uSize * (1.0 + 0.18 * amp);
  col += smoothstep(cr, cr * 0.45, r) * vec3(1.0, 0.98, 0.94) * 1.1;
  col += exp(-r * 45.0 / uSize) * 0.9 * pulse * vec3(1.0, 0.96, 0.88);

  // flakes: three drifting layers, densest towards the sides; dark against the light, lit at the edge in the dark
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float sc = 9.0 + 7.0 * fi;
    vec2 q = p * sc + vec2(t * (0.12 + 0.07 * fi) + uPan * (0.6 + fi), sin(t * 0.21 + fi) * 0.4 - t * 0.03);
    vec2 cell = floor(q), f = fract(q) - 0.5;
    vec2 hh = h22(cell + fi * 31.7);
    float dens = 0.05 + 0.4 * smoothstep(0.25, 1.1, abs(p.x));
    if (hh.x < dens) {
      vec2 o = (h22(cell + 7.3) - 0.5) * 0.55;
      float ang = t * (hh.y - 0.5) * 2.5 + hh.y * 9.0;
      vec2 g = f - o;
      g = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * g;
      float sz = (0.05 + 0.07 * hh.y) * (1.0 - 0.2 * fi);
      float fd = length(vec2(g.x, g.y * (2.0 + 2.5 * hh.y))) - sz;
      float m = smoothstep(1.5 * sc * aa, 0.0, fd);
      float lum = dot(col, vec3(0.33));
      col = mix(col, vec3(0.008), m * 0.85 * smoothstep(0.02, 0.12, lum));
      col += m * 0.05 * (1.0 - smoothstep(0.02, 0.12, lum)) * uWarm;
    }
  }

  // the ridges: a far, veiled range and the near wet rock, low in the middle, high at the sides
  float px = p.x + uPan * 0.25;
  float ax = clamp(abs(px) / (0.5 * A), 0.0, 1.0);
  float side = sign(px);
  float yb = p.y + 0.5;
  if (yb < 0.75) {
    float far = 0.08 + 0.42 * pow(smoothstep(0.1, 1.0, ax), 1.2) + 0.09 * fbm(vec2(px * 5.0 + side * 9.0, 2.0)) - 0.03;
    if (yb < far) col = mix(col, vec3(0.03, 0.033, 0.042) + 0.35 * haze * vec3(0.5, 0.48, 0.45), 0.8);
    float hn = fbm(vec2(px * 3.3 + side * 3.0, 0.5));
    float near = 0.035 + 0.6 * pow(smoothstep(0.16, 1.0, ax), 1.35) + 0.12 * (hn - 0.5) * (0.3 + ax) + 0.025 * (vnoise(vec2(px * 28.0, 1.0)) - 0.5);
    float depth = near - yb;
    if (depth > -aa) {
      float m = smoothstep(-aa, aa, depth);
      float tex = fbm(vec2(px * 11.0, yb * 19.0) + side * 5.0);
      vec3 rock = vec3(0.012, 0.013, 0.017) + 0.02 * tex;
      // lit from the core: the inner faces and the crest catch it
      float face = 0.35 + 0.65 * (1.0 - ax);
      float light = face * (0.6 + 0.6 * exp(-length(p - core) * 1.5));
      float crest = exp(-depth * 70.0) * (0.5 + 0.5 * vnoise(vec2(px * 40.0, 3.0)));
      float wet = pow(vnoise(vec2(px * 60.0 + tex * 6.0, yb * 7.0)), 5.0) * exp(-depth * 5.0);
      float sheen = pow(clamp(tex * 1.6 - 0.45, 0.0, 1.0), 4.0) * 0.6;
      rock += light * (crest * 0.7 + wet * 1.5 + sheen * 0.2) * mix(vec3(1.0, 0.94, 0.85), uCool, 0.25 + 0.3 * tex);
      col = mix(col, rock, m);
    }
  }

  // grain, vignette, letterbox
  col *= 1.0 - 0.35 * pow(length(p * vec2(0.75 / A * 1.9, 1.0)), 2.2);
  col += (h21(fc + fract(t * 7.13) * 911.0) - 0.5) * 0.055;
  col = max(col, 0.0);
  float yy = fc.y / uRes.y;
  if (yy < uLetterbox.y || yy > 1.0 - uLetterbox.x) col = vec3(0.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class Starburst {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  constructor(o: StarburstOpts = {}) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uAmp: { value: 0 },
        uPan: { value: 0 },
        uLetterbox: { value: new THREE.Vector2(...(typeof o.letterbox === "number" ? [o.letterbox, o.letterbox] : (o.letterbox ?? [0, 0]))) },
        uSize: { value: o.size ?? 1 },
        uCore: { value: new THREE.Vector2(...(o.core ?? [0, 0.23])) },
        uWarm: { value: hex(o.warm ?? "", [0.95, 0.74, 0.36]) },
        uCool: { value: hex(o.cool ?? "", [0.55, 0.68, 0.95]) },
      },
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }
  /** pixel size of the drawing buffer */
  resize(w: number, h: number): void {
    (this.mat.uniforms.uRes.value as THREE.Vector2).set(w, h);
  }
  /** t: seconds; amp: 0…1 loudness (already scaled by the pulse option); pan: the camera's azimuth (rad) */
  update(t: number, amp: number, pan: number): void {
    const u = this.mat.uniforms;
    u.uTime.value = t;
    u.uAmp.value = amp;
    u.uPan.value = pan;
  }
  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
