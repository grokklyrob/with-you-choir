/**
 * The duet page (`?show=<id>`): a pre-rendered song with two (or more) voices, each on its own 3D
 * head, side by side, moving exactly as the engine did when it sang. Nothing is synthesized here:
 * the page plays the mixed track and replays each voice's recorded telemetry at the playhead.
 *
 * A show is a folder `public/shows/<id>/` (gitignored: shows are made locally, often of songs that
 * mustn't be published) holding `show.json`, the mix and one `.tele` per voice from
 * `chimera render notes … --tele`. The voices' renders and the mix must share sample 0.
 *
 *   { "title": "…", "audio": "mix.mp3", "bpm": 103, "downbeat": 0,
 *     "voices": [{ "name": "Lower", "tele": "male.tele" }, { "name": "Upper", "tele": "female.tele" }] }
 *
 * Optional: `bpm` and `downbeat` (s, a bar's first beat) nod the heads on the beat; a voice's
 * `melody` (the melody file it was rendered from) writes its words at its mouth, and the show's
 * `spell` ({"owr": "our"}) writes a syllable spelled for the dictionary as it should read.
 */
import { useEffect, useRef, useState } from "react";
import { AnatomyView3D, type HeadFeed } from "./AnatomyView3D.tsx";
import { Screen } from "./Screen.tsx";
import { TeleTrack } from "../../show/tele.ts";
import { Transport } from "../../show/transport.ts";
import { getModel } from "../useModel.ts";
import { VoiceModel } from "../analysis.ts";
import { bodyLabel } from "../body.ts";
import type { ViewFlags } from "../render/anatomy.ts";
import { mouthWords } from "../mouthWords.ts";
import { V } from "../colors.ts";
import { g2p, zh } from "../speech.ts";
import { hasHan, lyricsToSyllables } from "../../wasm/engine.ts";
import { sungWords, wordAt, type Melody, type SungWords } from "../../show/words.ts";
import type { OverlayFn } from "./AnatomyView.tsx";
import { ArcStage, type StageOpts } from "./ArcStage.tsx";
import { lyricPhrases, lyricsUpdater, PlayPill, type OverlayOpts, type Phrase } from "./StageOverlay.tsx";
import type { HeadLook } from "../render/anatomy3d.ts";

interface ShowFile {
  title: string;
  audio: string;
  bpm?: number;
  downbeat?: number;
  spell?: Record<string, string>;
  /** "arc": all heads on one shared stage (ArcStage); default "panels": a head per panel */
  layout?: "panels" | "arc";
  stage?: StageOpts;
  /** arc layout: Play Song pill, credit and the lyric line (StageOverlay.tsx) */
  overlay?: OverlayOpts;
  voices: { name: string; tele: string; melody?: string; look?: HeadLook; scale?: number; words?: string; turn?: number; offset?: [number, number, number] }[];
}

interface Loaded {
  show: ShowFile;
  phrases: Phrase[] | null;
  voices: { name: string; track: TeleTrack; words: SungWords | null; look?: HeadLook; scale?: number; wordColor?: string; turn?: number; offset?: [number, number, number] }[];
}

/** the heads as the face screen shows them by default, less the measurement labels */
const VIEW: ViewFlags = { pressure: true, particles: true, grid: false, calipers: false };

async function fetchOk(url: string): Promise<Response> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status} ${r.statusText}`);
  return r;
}

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export function DuetPage(props: { id: string }) {
  const base = `${import.meta.env.BASE_URL}shows/${props.id}/`;
  // one transport per mount (its context closes on unmount)
  const [transport, setTransport] = useState<Transport | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  // the lyric line is written straight into the DOM each frame (no re-render per frame)
  const lyricsRef = useRef<HTMLDivElement>(null);
  const updRef = useRef<{ el: HTMLElement; ph: Phrase[]; f: (t: number, p: boolean) => void } | null>(null);
  const phrasesRef = useRef<Phrase[] | null>(null);
  const onFrame = useRef((t: number, playing: boolean) => {
    const el = lyricsRef.current, ph = phrasesRef.current;
    if (!el || !ph) return;
    if (!updRef.current || updRef.current.el !== el || updRef.current.ph !== ph) updRef.current = { el, ph, f: lyricsUpdater(el, ph) };
    updRef.current.f(t, playing);
  }).current;

  useEffect(() => {
    const t = new Transport();
    setTransport(t);
    return () => t.dispose();
  }, []);

  useEffect(() => {
    if (!transport) return;
    let live = true;
    setLoaded(null);
    (async () => {
      const show = (await (await fetchOk(base + "show.json")).json()) as ShowFile;
      if (!show.voices?.length || !show.audio) throw new Error("show.json needs audio and voices");
      if (show.title) document.title = show.title;
      const [audio, ...teles] = await Promise.all([fetchOk(base + show.audio).then((r) => r.arrayBuffer()), ...show.voices.map((v) => fetchOk(base + v.tele).then((r) => r.arrayBuffer()))]);
      // the words: syllables as the CLI splits them (the pronouncing dictionary first, as it does)
      const melodies = await Promise.all(show.voices.map((v) => (v.melody ? fetchOk(base + v.melody).then((r) => r.json() as Promise<Melody>) : null)));
      if (melodies.some(Boolean)) await g2p.load().catch(() => {});
      if (melodies.some((m) => m && !m.syllables && hasHan(m.lyrics))) await zh.load().catch(() => {});
      const words = melodies.map((m) => {
        if (!m) return null;
        try {
          return sungWords(m, m.syllables ?? lyricsToSyllables(m.lyrics), show.spell);
        } catch (e) {
          console.warn("duet: no words for a voice:", e);
          return null;
        }
      });
      const voices = show.voices.map((v, i) => ({ name: v.name, track: new TeleTrack(teles[i]), words: words[i], look: v.look, scale: v.scale, wordColor: v.words, turn: v.turn, offset: v.offset }));
      // the lyric line: the lead voice's words, grouped into the show's phrases
      let phrases: Phrase[] | null = null;
      if (show.overlay) {
        const want = show.overlay.lyricsVoice?.toLowerCase();
        let li = show.voices.findIndex((v, i) => melodies[i] && v.name.toLowerCase() === want);
        if (li < 0) li = melodies.findIndex(Boolean);
        const m = li >= 0 ? melodies[li] : null;
        if (m) {
          try {
            phrases = lyricPhrases(m, m.syllables ?? lyricsToSyllables(m.lyrics), show.overlay.phrases);
          } catch (e) {
            console.warn("duet: no lyric line:", e);
          }
        }
      }
      await transport.load(audio);
      if (live) setLoaded({ show, voices, phrases });
    })().catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [base, transport]);

  // the readouts follow the transport: at once on a change, and a few times a second while it plays
  useEffect(() => {
    if (!transport) return;
    const off = transport.subscribe(() => setTick((n) => n + 1));
    const id = setInterval(() => transport.isPlaying && setTick((n) => n + 1), 250);
    return () => {
      off();
      clearInterval(id);
    };
  }, [transport]);

  if (error)
    return (
      <div className="duet">
        <p className="duet-msg error">This show could not load: {error}</p>
      </div>
    );
  phrasesRef.current = loaded?.phrases ?? null;
  const st = transport?.state ?? { playing: false, time: 0, duration: 0, epoch: 0 };
  const title = loaded?.show.title ?? "Loading…";
  // `&stage=arc|panels` overrides the show's own layout
  const params = new URLSearchParams(window.location.search);
  const arc = (params.get("stage") ?? loaded?.show.layout ?? "panels") === "arc";
  const manual = params.get("clock") === "manual";
  const overlay = arc ? loaded?.show.overlay : undefined;
  const atEnd = st.duration > 0 && st.time >= st.duration - 0.05;
  return (
    <div className="duet">
      <header className="duet-top">
        <span className="wordmark">Chimera</span>
        <span className="duet-title">{title}</span>
      </header>
      {arc && loaded && transport ? (
        <main className="duet-arc">
          <ArcStage
            voices={loaded.voices}
            stage={loaded.show.stage}
            transport={transport}
            bpm={loaded.show.bpm}
            downbeat={loaded.show.downbeat}
            manual={manual}
            headWords={overlay ? !!overlay.headWords : true}
            onFrame={onFrame}
          >
            {overlay && (
              <div className="stage-overlay">
                <div className="stage-lyrics" ref={lyricsRef} aria-hidden="true" />
                <div className="stage-corner">
                  <PlayPill playing={st.playing && !atEnd} disabled={!loaded} label={overlay.play ?? "Play Song"} onClick={() => (st.playing ? transport.pause() : transport.play())} />
                  {overlay.credit && <div className="stage-credit">{overlay.credit}</div>}
                </div>
              </div>
            )}
          </ArcStage>
        </main>
      ) : (
        <main className="duet-heads" style={{ "--voices": loaded?.voices.length ?? 2 } as React.CSSProperties}>
          {loaded && transport ? loaded.voices.map((v, i) => <Head key={i} name={v.name} track={v.track} words={v.words} show={loaded.show} transport={transport} facing={i > 0 && i === loaded.voices.length - 1 ? -1 : 1} />) : <p className="duet-msg">Loading the song…</p>}
        </main>
      )}
      <footer className="duet-bar" hidden={!!overlay}>
        <button className="primary large" disabled={!loaded} onClick={() => (st.playing ? transport?.pause() : transport?.play())}>
          {st.playing ? "Pause" : st.duration > 0 && st.time >= st.duration - 0.05 ? "Again" : "Play"}
        </button>
        <span className="duet-time">
          {clock(st.time)} / {clock(st.duration)}
        </span>
        <input
          type="range"
          aria-label="Position in the song"
          min={0}
          max={st.duration || 1}
          step={0.1}
          value={st.time}
          disabled={!loaded}
          onChange={(e) => transport?.seek(Number(e.target.value))}
          style={{ "--pos": `${st.duration ? (100 * st.time) / st.duration : 0}%` } as React.CSSProperties}
        />
      </footer>
    </div>
  );
}

/** one voice's head; the last of several turns to face the others */
function Head(props: { name: string; track: TeleTrack; words: SungWords | null; show: ShowFile; transport: Transport; facing: 1 | -1 }) {
  const { track, show, transport, words } = props;
  const feedRef = useRef<HeadFeed | null>(null);
  // the syllable at the mouth, written on the side the face looks to
  const overlayRef = useRef<OverlayFn | undefined>(undefined);
  if (words && !overlayRef.current) overlayRef.current = mouthWords(() => wordAt(words, transport.time()), V.green, props.facing);
  if (!feedRef.current) {
    const model = getModel(track.body, track.sampleRate);
    const beatStep = (t: number) => {
      if (!show.bpm) return -1;
      const s = Math.floor(((t - (show.downbeat ?? 0)) * show.bpm * 4) / 60);
      return s < 0 ? -1 : s % 16;
    };
    feedRef.current = {
      model,
      view: VIEW,
      maxDpr: 1.5,
      facing: props.facing,
      frame: () => {
        const t = transport.time();
        const i = track.indexAt(t);
        const msg = track.message(i, beatStep(t));
        // paused: the head keeps its shape, the voice and the face come to rest
        if (!transport.isPlaying) return { tele: null, artic: VoiceModel.articFromArray(msg.t.artic), epoch: transport.epoch };
        return { tele: msg, artic: VoiceModel.articFromArray(msg.t.artic), epoch: transport.epoch };
      },
    };
  }
  return (
    <Screen className="duet-head" focus title={props.name} sub={bodyLabel(track.body)} label={`${props.name} voice, ${bodyLabel(track.body)}, in 3D`}>
      <AnatomyView3D feed={feedRef.current} readouts={false} overlay={overlayRef.current} />
    </Screen>
  );
}
