/**
 * The arc stage's overlay (show.json `"overlay"`): a Play Song pill and a one-line credit in the
 * bottom-left corner, and the sung phrase as one line of italic serif at the bottom centre.
 *
 *   "overlay": { "play": "Play Song", "credit": "With you by R.Stevens",
 *                "lyricsVoice": "Soprano", "phrases": ["with you, with you, with you", …],
 *                "headWords": false }
 * `phrases` groups the lead voice's words into lines (each phrase takes as many sung words as it
 * has); without it, lines break at the syllables' phrase ends and at rests. `headWords: true`
 * brings back the floating syllable at each singer's mouth.
 */
import type { Melody } from "../../show/words.ts";
import type { Syllable } from "../../wasm/types.ts";

export interface OverlayOpts {
  play?: string;
  credit?: string;
  lyricsVoice?: string;
  phrases?: string[];
  headWords?: boolean;
}

interface Word {
  text: string;
  start: number;
  end: number;
}
export interface Phrase {
  words: Word[];
  start: number;
  end: number;
}

const bare = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/** the lead voice's sung words, timed as the CLI sang them, grouped into lines */
export function lyricPhrases(m: Melody, syls: Syllable[], phrases?: string[]): Phrase[] {
  const beat = 60 / m.bpm;
  let t = m.t0 ?? 0.3;
  // whole words (syllables joined), and where the melody rests or a phrase ends
  const words: (Word & { brk: boolean })[] = [];
  let si = 0, cur: (Word & { brk: boolean }) | null = null, rested = false;
  for (const [midi, beats] of m.notes) {
    const d = beats * beat;
    if (midi > 0) {
      const s = syls[si++];
      if (!s) break;
      if (s.melisma && cur) cur.end = t + d;
      else {
        if (!cur) {
          cur = { text: "", start: t, end: t + d, brk: rested };
          words.push(cur);
        }
        cur.text += s.text;
        cur.end = t + d;
        if (s.wordEnd) cur = null;
      }
      rested = !!s.phraseEnd;
    } else rested = true;
    t += d;
  }
  const make = (ws: Word[]): Phrase => ({ words: ws, start: ws[0].start, end: ws[ws.length - 1].end });
  const out: Phrase[] = [];
  // the show's own line breaks, when they fit the words
  if (phrases?.length) {
    let k = 0, ok = true;
    for (const p of phrases) {
      const toks = p.split(/\s+/).filter(Boolean);
      const ws = words.slice(k, k + toks.length);
      if (ws.length !== toks.length || ws.some((w, i) => bare(w.text) !== bare(toks[i]))) {
        ok = false;
        break;
      }
      out.push(make(ws.map((w, i) => ({ ...w, text: toks[i] }))));
      k += toks.length;
    }
    if (ok && k === words.length) return out;
    console.warn("overlay: phrases don't match the sung words; breaking at rests instead");
    out.length = 0;
  }
  let line: Word[] = [];
  for (const w of words) {
    if (w.brk && line.length) {
      out.push(make(line));
      line = [];
    }
    line.push({ text: w.text === "i" ? "I" : w.text, start: w.start, end: w.end });
  }
  if (line.length) out.push(make(line));
  return out;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** draws the current line into `el`; call every frame with the song time */
export function lyricsUpdater(el: HTMLElement, phrases: Phrase[]) {
  const IN = 0.35, OUT = 0.6;
  let shown = -1;
  let spans: HTMLElement[] = [];
  return (t: number, playing: boolean) => {
    let p = -1;
    for (let i = 0; i < phrases.length; i++) {
      const next = phrases[i + 1];
      const until = Math.min(phrases[i].end + OUT + 0.4, next ? next.start - IN : Infinity);
      if (t >= phrases[i].start - IN && t < until) {
        p = i;
        break;
      }
    }
    if (!playing && t <= 0.01) p = -1;
    if (p !== shown) {
      shown = p;
      el.innerHTML = p < 0 ? "" : phrases[p].words.map((w) => `<span>${esc(w.text)}</span>`).join(" ");
      spans = [...el.querySelectorAll("span")] as HTMLElement[];
    }
    if (p < 0) {
      el.style.opacity = "0";
      return;
    }
    const ph = phrases[p], next = phrases[p + 1];
    const until = Math.min(ph.end + OUT + 0.4, next ? next.start - IN : Infinity);
    const a = Math.min(1, (t - (ph.start - IN)) / IN, (until - t) / OUT);
    el.style.opacity = String(Math.max(0, a));
    ph.words.forEach((w, i) => {
      const s = spans[i];
      const state = t >= w.start && t < w.end ? "on" : t >= w.end ? "sung" : "";
      if (s && s.className !== state) s.className = state;
    });
  };
}

export function PlayPill(props: { playing: boolean; disabled: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className="play-pill" disabled={props.disabled} onClick={props.onClick} aria-label={props.playing ? "Pause" : props.label}>
      <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">
        {props.playing ? (
          <>
            <rect x="1.2" y="1" width="2.6" height="8" rx="0.5" />
            <rect x="6.2" y="1" width="2.6" height="8" rx="0.5" />
          </>
        ) : (
          <path d="M2 1 L9 5 L2 9 Z" />
        )}
      </svg>
      <span>{props.playing ? "Pause" : props.label}</span>
    </button>
  );
}
