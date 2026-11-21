/**
 * The duet page's shared stage (`"layout": "arc"` in show.json, or `&stage=arc`): every voice's
 * head in ONE three.js scene, standing in a gentle arc, with a slow camera drifting across it over
 * the song. Each head is an Anatomy3D driven by its own recorded telemetry, exactly as on the
 * panels; this only gives them one renderer, one camera and one star field.
 *
 * show.json (all optional):
 *   "stage": { "background": "#050a1a", "stars": 1400, "starColor": "#cfd8ff",
 *              "spacing": 34, "curve": 9, "orbitDeg": 16, "distance": 150, "loop": 0 }
 *   "voices": [{ …, "look": { "palette": {…}, "shape": {…}, "drips": "#d9a441" },
 *                "scale": 1.04, "words": "#f0c060", "turn": 20 }]
 *   "stage": { "sky": "starburst", "starburst": { "core": [0, 0.23], "letterbox": 0.04, "pulse": 0.6 } }
 *   (sky "stars", the default, is the star field; "starburst" is the procedural sky in
 *   render/starburst.ts; `&sky=stars|starburst` overrides it)
 *   voices[].offset: [x, y, z] moves a head from its arc slot (stage units; a head is ~30 tall)
 * `loop` is the camera's cycle in seconds (0: the song's length, so it comes round as the song
 * ends). `turn` (deg) turns a head from facing the camera, + towards its right.
 *
 * `&clock=manual` stops the playback clock and exposes `window.__stageStep(t, dt)`, which draws the
 * frame at song time t (for frame-exact captures); `window.__stagePerf` holds frame timings.
 */
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { Anatomy3D, type HeadLook } from "../render/anatomy3d.ts";
import { Starburst, type StarburstOpts } from "../render/starburst.ts";
import { Glow } from "../render/vector.ts";
import { getModel } from "../useModel.ts";
import { VoiceModel } from "../analysis.ts";
import { mouthWords } from "../mouthWords.ts";
import { V } from "../colors.ts";
import { wordAt, type SungWords } from "../../show/words.ts";
import type { TeleTrack } from "../../show/tele.ts";
import type { Transport } from "../../show/transport.ts";
import type { ViewFlags } from "../render/anatomy.ts";
import type { OverlayFn } from "./AnatomyView.tsx";

export interface StageOpts {
  background?: string;
  stars?: number;
  starColor?: string;
  spacing?: number;
  curve?: number;
  orbitDeg?: number;
  distance?: number;
  loop?: number;
  /** NDC limits the heads keep to over the camera move (defaults x 0.93, top 0.94, bottom 0.8) */
  /** raises the camera's aim (stage units), lowering the singers in the frame */
  lift?: number;
  fit?: { x?: number; top?: number; bottom?: number };
  sky?: "stars" | "starburst";
  starburst?: StarburstOpts;
}
export interface StageVoice {
  name: string;
  track: TeleTrack;
  words: SungWords | null;
  look?: HeadLook;
  scale?: number;
  wordColor?: string;
  turn?: number;
  offset?: [number, number, number];
}

/** a #rrggbb colour as given (the stage draws untransformed sRGB, as the heads' beams do) */
const raw = (hex: string) => {
  const v = parseInt(hex.slice(1), 16);
  return new THREE.Color().setRGB(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255, THREE.LinearSRGBColorSpace);
};

const VIEW: ViewFlags = { pressure: true, particles: true, grid: false, calipers: false };

interface PerfStats {
  frames: number;
  updateMs: number;
  frameMs: number;
  worstMs: number;
  reset(): void;
}

declare global {
  interface Window {
    __stageStep?: (t: number, dt: number) => void;
    __stagePerf?: PerfStats;
  }
}

export function ArcStage(props: {
  voices: StageVoice[];
  stage?: StageOpts;
  transport: Transport;
  bpm?: number;
  downbeat?: number;
  manual?: boolean;
  /** the floating syllable at each mouth (default on) */
  headWords?: boolean;
  /** called every drawn frame with the stage's song time (the manual clock's, when manual) */
  onFrame?: (t: number, playing: boolean) => void;
  children?: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFrameRef = useRef(props.onFrame);
  onFrameRef.current = props.onFrame;
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { voices, transport } = props;
    const st = props.stage ?? {};
    const bg = raw(st.background ?? "#050a1a");
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const glCanvas = document.createElement("canvas");
    const gl = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    gl.setClearColor(bg, 1);
    const glow = new Glow();

    const scene = new THREE.Scene();
    const fog = new THREE.Fog(bg, 100, 260);
    scene.fog = fog;
    const camera = new THREE.PerspectiveCamera(24, 1, 5, 6000);

    const skyParam = new URLSearchParams(location.search).get("sky");
    const sky = skyParam === "stars" || skyParam === "starburst" ? skyParam : (st.sky ?? "stars");
    const burst = sky === "starburst" ? new Starburst(st.starburst) : null;
    if (burst) scene.add(burst.mesh);
    // the singers' loudness, for the core's pulse: each voice's output level, normalised per voice
    const levels = voices.map((v) => {
      const tr = v.track, n = tr.frames, out = new Float32Array(n);
      let peak = 1e-6;
      for (let i = 0; i < n; i++) peak = Math.max(peak, (out[i] = tr.message(i).t.outRms));
      for (let i = 0; i < n; i++) out[i] = Math.min(1, out[i] / peak);
      return out;
    });
    let ampS = 0;

    // the star field: a shell of points well behind and around the singers
    const nStars = burst ? 0 : (st.stars ?? 1400);
    if (nStars > 0) {
      const pos = new Float32Array(nStars * 3), col = new Float32Array(nStars * 3);
      const sc = raw(st.starColor ?? "#cfd8ff");
      let seed = 11;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < nStars; i++) {
        const th = (rnd() - 0.5) * Math.PI * 1.3, ph = (rnd() - 0.5) * Math.PI * 0.75, r = 900 + 1500 * rnd();
        pos.set([r * Math.sin(th) * Math.cos(ph), 20 + r * Math.sin(ph), -r * Math.cos(th) * Math.cos(ph)], 3 * i);
        const b = 0.25 + 0.75 * rnd() ** 3;
        col.set([sc.r * b, sc.g * b, sc.b * b], 3 * i);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
      pts.renderOrder = -1;
      scene.add(pts);
    }

    // the singers: left to right in show order, on an arc whose ends come forward
    const n = voices.length, spacing = st.spacing ?? 34, curve = st.curve ?? 9;
    const heads = voices.map((v, i) => {
      const r = new Anatomy3D();
      r.centred = true;
      r.setLook(v.look);
      const model = getModel(v.track.body, v.track.sampleRate);
      const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; // -1 … 1
      const slot = new THREE.Group(), offset = new THREE.Group();
      const center = r.poses(model).target;
      offset.position.copy(center).multiplyScalar(-1);
      offset.add(r.root);
      slot.add(offset);
      const off = v.offset ?? [0, 0, 0];
      slot.position.set(u * spacing * (n - 1) * 0.5 + off[0], off[1], curve * u * u + off[2]);
      const s = v.scale ?? 1;
      slot.scale.setScalar(s);
      // body +x is the face: turn it to the camera, then a little toward the arc's middle and by `turn`
      slot.rotation.y = -Math.PI / 2 - u * 0.18 + ((v.turn ?? 0) * Math.PI) / 180;
      scene.add(slot);
      const side: 1 | -1 = u < -0.01 ? -1 : 1;
      const overlay: OverlayFn | undefined = v.words && props.headWords !== false ? mouthWords(() => wordAt(v.words!, time()), v.wordColor ?? V.green, side) : undefined;
      return { v, r, model, slot, side, overlay, u, off, epoch: -1 };
    });
    // a narrow screen draws the singers closer together (they may overlap a little in portrait)
    const layoutSlots = (aspect: number) => {
      const squeeze = Math.min(1, Math.max(0.5, aspect / 1.6));
      for (const hd of heads) hd.slot.position.x = hd.u * spacing * squeeze * (n - 1) * 0.5 + hd.off[0];
    };

    const duration = () => transport.state.duration || 60;
    let manualT = 0;
    const time = () => (props.manual ? manualT : transport.time());
    const playing = () => props.manual || transport.isPlaying;
    const beatStep = (t: number) => {
      if (!props.bpm) return -1;
      const s = Math.floor(((t - (props.downbeat ?? 0)) * props.bpm * 4) / 60);
      return s < 0 ? -1 : s % 16;
    };

    // the camera: a slow drift across the arc (azimuth), a breath of dolly and height, period = the loop
    // `lift` raises what the camera looks at, so the singers sit lower in the frame (sky above them)
    const target = new THREE.Vector3(0, st.lift ?? 0, curve * 0.4);
    // `fitK` scales the camera distance so every head stays in frame over the whole camera move
    let fitK = 1;
    const phaseAt = (t: number) => {
      const T = st.loop || duration();
      return (2 * Math.PI * (t % T)) / T;
    };
    const placeCamera = (t: number) => placeAt(phaseAt(t), fitK);
    const placeAt = (p: number, k: number) => {
      const az = ((st.orbitDeg ?? 16) * Math.PI) / 180 * Math.sin(p);
      const el = 0.07 + 0.035 * Math.sin(2 * p + 0.6);
      const d = (st.distance ?? 150) * k * (1 + 0.06 * Math.cos(p));
      camera.position.set(target.x + d * Math.sin(az) * Math.cos(el), target.y + 1.5 + d * Math.sin(el), target.z + d * Math.cos(az) * Math.cos(el));
      camera.lookAt(target.x, target.y + 0.5 * Math.sin(p), target.z);
      camera.updateMatrixWorld(true);
      fog.near = d - 20;
      fog.far = d + 90;
    };

    // the frame the heads must stay inside (NDC): the sides, the top, and above the lyric line
    // (top is low: the sky above the singers is the starburst's)
    const FIT = { x: st.fit?.x ?? 0.93, top: st.fit?.top ?? 0.5, bottom: st.fit?.bottom ?? 0.8 };
    let boxes: THREE.Box3[] | null = null;
    const corner = new THREE.Vector3();
    // the heads' screen extent over the whole camera move, aimed at `lift` alone
    const extentAt = (k: number) => {
      const y0 = target.y;
      target.y = st.lift ?? 0;
      let mx = 0, top = -9, bot = 9;
      for (let j = 0; j < 36; j++) {
        placeAt((2 * Math.PI * j) / 36, k);
        for (const b of boxes!)
          for (let c = 0; c < 8; c++) {
            corner.set(c & 1 ? b.max.x : b.min.x, c & 2 ? b.max.y : b.min.y, c & 4 ? b.max.z : b.min.z).project(camera);
            mx = Math.max(mx, Math.abs(corner.x));
            top = Math.max(top, corner.y);
            bot = Math.min(bot, corner.y);
          }
      }
      target.y = y0;
      return { mx, top, bot };
    };
    // fits when the width does and the height fits the band (the aim then centres it)
    const fitsAt = (k: number) => {
      const e = extentAt(k);
      return e.mx <= FIT.x && e.top - e.bot <= FIT.top + FIT.bottom;
    };
    const fitCamera = () => {
      if (!boxes) return;
      scene.updateMatrixWorld(true);
      boxes = heads.map((hd) => new THREE.Box3().setFromObject(hd.slot));
      let lo = 0.4, hi = 8;
      if (!fitsAt(hi)) hi = 20;
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if (fitsAt(mid)) hi = mid;
        else lo = mid;
      }
      fitK = hi;
      // aim so the band's slack is shared above and below (NDC y shifts by -Δ / (d·tan(fov/2)))
      const e = extentAt(fitK);
      const o = (FIT.top - e.top + (-FIT.bottom - e.bot)) / 2;
      target.y = (st.lift ?? 0) - o * (st.distance ?? 150) * fitK * Math.tan((camera.fov * Math.PI) / 360);
      (window as unknown as { __stageFit?: unknown }).__stageFit = { k: fitK, boxes: boxes.map((b) => [b.min.toArray(), b.max.toArray()]) };
    };
    // where the alto (the middle head) tops out on screen, for the sky's core
    const crownV = new THREE.Vector3();

    let w = 0, h = 0, dpr = 1;
    const fit = () => {
      const b = wrap.getBoundingClientRect();
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = Math.max(1, b.width);
      h = Math.max(1, b.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl.setPixelRatio(dpr);
      gl.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      for (const hd of heads) hd.r.resize(w, h);
      layoutSlots(w / h);
      fitCamera();
      burst?.resize(Math.round(w * dpr), Math.round(h * dpr));
    };
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    fit();

    const perf: PerfStats = { frames: 0, updateMs: 0, frameMs: 0, worstMs: 0, reset() { this.frames = 0; this.updateMs = 0; this.frameMs = 0; this.worstMs = 0; } };
    window.__stagePerf = perf;

    const draw = (dt: number) => {
      const t0 = performance.now();
      const t = time();
      placeCamera(t);
      scene.updateMatrixWorld(true);
      const frames = heads.map((hd) => {
        const { r, model, v } = hd;
        // each head's own camera is the stage's (what faces the camera, the fog, the projection)
        r.camera.position.copy(camera.position);
        r.camera.quaternion.copy(camera.quaternion);
        r.camera.updateMatrixWorld(true);
        const msg = v.track.message(v.track.indexAt(t), beatStep(t));
        const tele = playing() ? msg : null;
        if (transport.epoch !== hd.epoch) {
          hd.epoch = transport.epoch;
          r.resetMotion();
        }
        const a = VoiceModel.articFromArray(msg.t.artic);
        r.face.update(tele, dt);
        const f = model.frame(a);
        r.update(model, f, a, tele, VIEW, dt);
        return { f, a };
      });
      if (burst) {
        let a = 0;
        voices.forEach((v, i) => (a += levels[i][v.track.indexAt(t)] ?? 0));
        a = Math.min(1, a / Math.max(1, voices.length * 0.6));
        if (!playing()) a = 0;
        // fast attack, slow release
        const k = 1 - Math.exp(-dt / (a > ampS ? 0.06 : 0.35));
        ampS += (a - ampS) * k;
        const az = Math.atan2(camera.position.x - target.x, camera.position.z - target.z);
        // the core sits above the middle singer's crown, the corona sized to the room up there
        let core: [number, number] | undefined;
        let room = 1;
        if (boxes && n % 2 === 1) {
          const b = boxes[Math.floor((n - 1) / 2)];
          crownV.set((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2).project(camera);
          const top = crownV.y * 0.5, x = (crownV.x * 0.5 * w) / h; // frame heights from the middle
          const space = 0.5 - top;
          core = [x, top + 0.58 * space];
          room = space / 0.47;
        }
        burst.update(props.manual ? t : performance.now() / 1000, ampS * (st.starburst?.pulse ?? 0.6), az, core, room, w / h);
      }
      const t1 = performance.now();
      gl.render(scene, camera);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(glCanvas, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      heads.forEach((hd, i) => {
        if (!hd.overlay) return;
        const { f, a } = frames[i];
        const fv = hd.r.faceView(hd.model, f, a);
        // words stay in their singer's lane: a middle singer's run up to halfway to the next head
        let wLane = w;
        if (hd.side > 0 && i < heads.length - 1) {
          const lips = fv.handles(hd.model, f, a).find((x) => x.id === "lips");
          const next = heads[i + 1].r.crown(heads[i + 1].model);
          if (lips) wLane = Math.min(w, (fv.X(lips.pos) + next.x) / 2 + 20);
        }
        hd.overlay(ctx, fv, hd.model, f, a, { w: wLane, h, dt });
      });
      glow.apply(canvas, ctx, dpr);
      if (!boxes) {
        boxes = [];
        fitCamera();
      }
      onFrameRef.current?.(t, playing());
      const t2 = performance.now();
      perf.frames++;
      perf.updateMs += t1 - t0;
      perf.frameMs += t2 - t0;
      perf.worstMs = Math.max(perf.worstMs, t2 - t0);
    };

    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(dt);
      raf = requestAnimationFrame(loop);
    };
    if (props.manual) {
      window.__stageStep = (t: number, dt: number) => {
        manualT = t;
        draw(dt);
      };
      draw(1 / 30);
    } else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      delete window.__stageStep;
      for (const hd of heads) hd.r.dispose();
      burst?.dispose();
      gl.dispose();
      gl.forceContextLoss();
    };
    // the stage is built once per loaded show
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.voices, props.transport]);

  return (
    <div ref={wrapRef} className="duet-stage">
      <canvas ref={canvasRef} role="img" aria-label="The singers on one stage, in 3D" />
      {props.children}
    </div>
  );
}
