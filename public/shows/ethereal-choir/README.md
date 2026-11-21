# Ethereal Choir: "With You" (3-part CHIMERA show, local), lyrics v2 + v3 bass

Three CHIMERA heads (Bass / Alto / Soprano) sing Robert's lyric in F major at 131 BPM, laid over the v4 ethereal blend's grid.
**Not deployed. Nothing pushed.** `public/shows/` is gitignored. Previous versions: v2 with the old thin bass in `lyrics-v2/`; "In this void…" in `lyrics-v1/`, and the placeholder-lyric version is in `placeholder-v1/`.

## Preview
- **http://127.0.0.1:5183/?show=ethereal-choir**
- Screenshots: `/home/box/vocalsynth/screens/ethereal-v2-playing.png` (0:04–0:05, "with you" hook on all three heads) and `ethereal-v2-circle-playing.png` (0:11–0:12, "in the cir–"), and `ethereal-v3-playing.png` (v3 bass, same spot).

## Lyric (v2, Robert's words)
> with you with you with you, in the circle of life, I want to download into you, I want to download into you

"In this void, in this circle" is removed.

## Layout (131 BPM; 1 beat = 0.458 s; renders start at t0 = 0.3 s)
| Section | Beats | Words | Notes |
|---|---|---|---|
| Lead-in | 0–4 | (bed only) | 1 bar, same entry point as v4's A phrase |
| S1 hook | 4–18 | with you with you with you | **Soprano up an octave**: C5/A4 swing, last "you" held 6.5 beats. Alto a 3rd below (A4/F4). Bass on an F2 pedal, ringing to beat 19.5 |
| S2 | 20–33 | in the circle of life | Peak on B♭4 at "cir-"; alto +2 and bass +2.5 beats hang on "life" |
| S3 | 36–47 | I want to download into you | Mid register (E4–A4) |
| S4 | 48–60 | I want to download into you | Higher (up to C5) |
| S5 | 60–69 | *(my repeat)* with you, with you | Kept from v1 |
| S6 | 76–92 | *(my repeat)* I want to download into you | Closer contour, ends F4 |
| S7 outro | 96–120 | *(my repeat)* in the circle of life | Broadened, with "life" held 11 beats (~5 s). Alto +3 and bass +4 ring on |

- 46 sung syllables per part. No melismas are needed now (the v1 melismas were on "void"/"circle", which are gone). Bass sings every syllable.
- Moving everything earlier would have left ~44 s of song. I filled the length with the S7 outro: a repeat of "in the circle of life" taken from his own lines, with a long held final word.
- Length: parts are 55.66 / 57.04 / 57.49 s (S/A/B). `mix.mp3` is 57.5 s. `mix_with_bed.mp3` is 60.5 s (the bed runs past the voices and fades as before).

## v3 bass update (Robert: fuller male bass/baritone; voices-only mix is the default)
- **Show default audio is `mix.mp3`: voices only, no bed.** `mix_with_bed.mp3` is an extra file in this folder only. It is not in `public/shows/`.
- **Range:** before, F2 pedal and roots from E2 to F3 (some notes so low they came out weak). Now **C3–B♭3**, all in root position: an F3 pedal under the hook, then C3 / D3 / F3 / G3 / B♭3 for C / Dm / F / Gm / B♭. The voicing code (`bass_pitch` in build_lyrics.py) picks chord tones in A2–C4 with smooth voice leading.
- **Settings** (male body, already the longest tract the CLI offers):

| | before | after |
|---|---|---|
| source.tension | 0.35 | 0.50 (more chest) |
| source.brightness | 0.20 | 0.15 (darker) |
| source.breathiness | 0.12 | 0.04 (fuller, less air) |
| source.pressure | default 9 | 12 (stronger drive) |
| artic.larynx | −0.7 | −1.0 (lowered larynx, darker) |
| artic.epilarynx | — | 0.10 (a little ring) |
| artic.root | — | −0.10 (tongue root forward, more pharynx space) |
| artic.lipProt | 0.45 | 0.40 |
| vibrato (cents) | 26 | 22 |

- **Mix:** bass gain 0.60 → 0.66 with a +2 dB low shelf at 180 Hz. The total is trimmed 0.75 before the limiter so the limiter only catches peaks. The filter is in `analysis/mix_filter.txt`.
- `bass-solo.mp3`: the bass alone, for auditioning (−17.6 LUFS, peak −5.8 dBFS).

## Pronunciation
- "download" uses an explicit `syllables` field: "down" (d aʊ n, stress 1) + "load" (l oʊ d, stress 2). This fixes the "dow/nload" display labels.
- "into" = in | to; "circle" = cir (sɝ) | cle (kəl). Both are left as CMUdict has them.

## Lyric map (sec* = time in the WAV)
### Soprano (46)
| # | beat | sec* | note | beats | syllable |
|---|---|---|---|---|---|
| 1 | 4 | 2.13 | C5 | 1.5 | with |
| 2 | 5.5 | 2.82 | A4 | 1.5 | you |
| 3 | 7 | 3.51 | C5 | 1.5 | with |
| 4 | 8.5 | 4.19 | A4 | 1.5 | you |
| 5 | 10 | 4.88 | C5 | 1.5 | with |
| 6 | 11.5 | 5.57 | A4 | 6.5 | you |
| 7 | 20 | 9.46 | E4 | 1 | in |
| 8 | 21 | 9.92 | F4 | 2 | the |
| 9 | 23 | 10.83 | Bb4 | 3 | cir |
| 10 | 26 | 12.21 | A4 | 2 | cle |
| 11 | 28 | 13.12 | G4 | 1 | of |
| 12 | 29 | 13.58 | F4 | 4 | life |
| 13 | 36 | 16.79 | E4 | 1 | I |
| 14 | 37 | 17.25 | F4 | 1 | want |
| 15 | 38 | 17.70 | G4 | 1 | to |
| 16 | 39 | 18.16 | A4 | 2 | down |
| 17 | 41 | 19.08 | G4 | 1 | load |
| 18 | 42 | 19.54 | F4 | 1 | in |
| 19 | 43 | 19.99 | E4 | 1 | to |
| 20 | 44 | 20.45 | F4 | 3 | you |
| 21 | 48 | 22.28 | C5 | 1 | I |
| 22 | 49 | 22.74 | Bb4 | 1 | want |
| 23 | 50 | 23.20 | A4 | 1 | to |
| 24 | 51 | 23.66 | C5 | 2 | down |
| 25 | 53 | 24.57 | Bb4 | 1 | load |
| 26 | 54 | 25.03 | A4 | 1 | in |
| 27 | 55 | 25.49 | G4 | 1 | to |
| 28 | 56 | 25.95 | A4 | 4 | you |
| 29 | 60 | 27.78 | F4 | 1 | with |
| 30 | 61 | 28.24 | F4 | 3 | you |
| 31 | 64 | 29.61 | G4 | 1 | with |
| 32 | 65 | 30.07 | A4 | 4 | you |
| 33 | 76 | 35.11 | Bb4 | 1 | I |
| 34 | 77 | 35.57 | Bb4 | 1 | want |
| 35 | 78 | 36.03 | A4 | 1 | to |
| 36 | 79 | 36.48 | Bb4 | 3 | down |
| 37 | 82 | 37.86 | A4 | 2 | load |
| 38 | 84 | 38.77 | G4 | 1 | in |
| 39 | 85 | 39.23 | F4 | 1 | to |
| 40 | 86 | 39.69 | F4 | 6 | you |
| 41 | 96 | 44.27 | E4 | 2 | in |
| 42 | 98 | 45.19 | F4 | 2 | the |
| 43 | 100 | 46.10 | Bb4 | 4 | cir |
| 44 | 104 | 47.93 | A4 | 3 | cle |
| 45 | 107 | 49.31 | G4 | 2 | of |
| 46 | 109 | 50.22 | F4 | 11 | life |

### Alto (46)
| # | beat | sec* | note | beats | syllable |
|---|---|---|---|---|---|
| 1 | 4 | 2.13 | A4 | 1.5 | with |
| 2 | 5.5 | 2.82 | F4 | 1.5 | you |
| 3 | 7 | 3.51 | A4 | 1.5 | with |
| 4 | 8.5 | 4.19 | F4 | 1.5 | you |
| 5 | 10 | 4.88 | A4 | 1.5 | with |
| 6 | 11.5 | 5.57 | F4 | 6.5 | you |
| 7 | 20 | 9.46 | C4 | 1 | in |
| 8 | 21 | 9.92 | C4 | 2 | the |
| 9 | 23 | 10.83 | F4 | 3 | cir |
| 10 | 26 | 12.21 | F4 | 2 | cle |
| 11 | 28 | 13.12 | E4 | 1 | of |
| 12 | 29 | 13.58 | C4 | 6 | life |
| 13 | 36 | 16.79 | C4 | 1 | I |
| 14 | 37 | 17.25 | C4 | 1 | want |
| 15 | 38 | 17.70 | E4 | 1 | to |
| 16 | 39 | 18.16 | F4 | 2 | down |
| 17 | 41 | 19.08 | E4 | 1 | load |
| 18 | 42 | 19.54 | D4 | 1 | in |
| 19 | 43 | 19.99 | C4 | 1 | to |
| 20 | 44 | 20.45 | C4 | 3 | you |
| 21 | 48 | 22.28 | A4 | 1 | I |
| 22 | 49 | 22.74 | F4 | 1 | want |
| 23 | 50 | 23.20 | F4 | 1 | to |
| 24 | 51 | 23.66 | A4 | 2 | down |
| 25 | 53 | 24.57 | G4 | 1 | load |
| 26 | 54 | 25.03 | F4 | 1 | in |
| 27 | 55 | 25.49 | E4 | 1 | to |
| 28 | 56 | 25.95 | F4 | 4 | you |
| 29 | 60 | 27.78 | D4 | 1 | with |
| 30 | 61 | 28.24 | D4 | 3 | you |
| 31 | 64 | 29.61 | E4 | 1 | with |
| 32 | 65 | 30.07 | F4 | 4 | you |
| 33 | 76 | 35.11 | F4 | 1 | I |
| 34 | 77 | 35.57 | G4 | 1 | want |
| 35 | 78 | 36.03 | F4 | 1 | to |
| 36 | 79 | 36.48 | F4 | 3 | down |
| 37 | 82 | 37.86 | F4 | 2 | load |
| 38 | 84 | 38.77 | E4 | 1 | in |
| 39 | 85 | 39.23 | D4 | 1 | to |
| 40 | 86 | 39.69 | C4 | 6 | you |
| 41 | 96 | 44.27 | C4 | 2 | in |
| 42 | 98 | 45.19 | C4 | 2 | the |
| 43 | 100 | 46.10 | F4 | 4 | cir |
| 44 | 104 | 47.93 | F4 | 3 | cle |
| 45 | 107 | 49.31 | E4 | 2 | of |
| 46 | 109 | 50.22 | C4 | 14 | life |

### Bass (46), v3 bass-baritone voicing
| # | beat | sec* | note | beats | syllable |
|---|---|---|---|---|---|
| 1 | 4 | 2.13 | F3 | 1.5 | with |
| 2 | 5.5 | 2.82 | F3 | 1.5 | you |
| 3 | 7 | 3.51 | F3 | 1.5 | with |
| 4 | 8.5 | 4.19 | F3 | 1.5 | you |
| 5 | 10 | 4.88 | F3 | 1.5 | with |
| 6 | 11.5 | 5.57 | F3 | 8 | you |
| 7 | 20 | 9.46 | C3 | 1 | in |
| 8 | 21 | 9.92 | F3 | 2 | the |
| 9 | 23 | 10.83 | Bb3 | 3 | cir |
| 10 | 26 | 12.21 | F3 | 2 | cle |
| 11 | 28 | 13.12 | C3 | 1 | of |
| 12 | 29 | 13.58 | F3 | 6.5 | life |
| 13 | 36 | 16.79 | C3 | 1 | I |
| 14 | 37 | 17.25 | F3 | 1 | want |
| 15 | 38 | 17.70 | C3 | 1 | to |
| 16 | 39 | 18.16 | F3 | 2 | down |
| 17 | 41 | 19.08 | C3 | 1 | load |
| 18 | 42 | 19.54 | D3 | 1 | in |
| 19 | 43 | 19.99 | C3 | 1 | to |
| 20 | 44 | 20.45 | F3 | 3 | you |
| 21 | 48 | 22.28 | F3 | 1 | I |
| 22 | 49 | 22.74 | Bb3 | 1 | want |
| 23 | 50 | 23.20 | F3 | 1 | to |
| 24 | 51 | 23.66 | F3 | 2 | down |
| 25 | 53 | 24.57 | G3 | 1 | load |
| 26 | 54 | 25.03 | D3 | 1 | in |
| 27 | 55 | 25.49 | C3 | 1 | to |
| 28 | 56 | 25.95 | F3 | 4 | you |
| 29 | 60 | 27.78 | Bb3 | 1 | with |
| 30 | 61 | 28.24 | D3 | 3 | you |
| 31 | 64 | 29.61 | C3 | 1 | with |
| 32 | 65 | 30.07 | F3 | 4 | you |
| 33 | 76 | 35.11 | Bb3 | 1 | I |
| 34 | 77 | 35.57 | G3 | 1 | want |
| 35 | 78 | 36.03 | F3 | 1 | to |
| 36 | 79 | 36.48 | Bb3 | 3 | down |
| 37 | 82 | 37.86 | F3 | 2 | load |
| 38 | 84 | 38.77 | C3 | 1 | in |
| 39 | 85 | 39.23 | D3 | 1 | to |
| 40 | 86 | 39.69 | F3 | 6 | you |
| 41 | 96 | 44.27 | C3 | 2 | in |
| 42 | 98 | 45.19 | F3 | 2 | the |
| 43 | 100 | 46.10 | Bb3 | 4 | cir |
| 44 | 104 | 47.93 | F3 | 3 | cle |
| 45 | 107 | 49.31 | C3 | 2 | of |
| 46 | 109 | 50.22 | F3 | 15 | life |

## Measurement checks (no one has listened yet)
- Pitch (pyin on every note): bass median 0.01 st, max 0.11, none > 0.5. Soprano and alto are unchanged from v2 (median 0.01; max 0.21 / 0.11).
- **Bass level and tone** (stem at mix gain, integrated loudness): old v2 bass was −19.1 LUFS, 2.7 LU under the soprano (−16.4). New bass is about −15.4 LUFS, roughly level with the soprano and about 3 LU above the alto (−18.5). Active RMS of the solo render: −14.1 → −10.9 dBFS. Share of 80–500 Hz energy: 0.36 → 0.45. Spectral centroid is about the same (556 → 564 Hz), because the pitches moved up an octave while the timbre got darker.
- Whole mix: centroid 695 → 648 Hz (darker overall). mix.mp3 is −11.2 LUFS, peak −1.4 dBFS. mix_with_bed.mp3 is −11.1 LUFS, peak −1.4 dBFS.
- Listen-for:
  - The bass is now about as loud as the soprano. If it feels heavy, drop its gain from 0.66 to about 0.58.
  - The hook's F3 pedal sits close to the alto's F4, an octave apart. That's fine, but the hook is now thicker in the middle.
  - B♭3 on "cir-" / "want" / "down" is the top of the bass range and may sound a bit pressed with tension 0.5.

## How to re-render
```bash
export PATH="$HOME/.cargo/bin:$PATH"
cd /home/box/vocalsynth/ethereal-choir
/home/box/.venvs/audio/bin/python3 build_lyrics.py      # edit melody/chords/lyric tokens here
CH=/workspace/chimera-vocal-synth/target/release/chimera
$CH render notes soprano.json soprano female --tele soprano.tele
$CH render notes alto.json    alto    female --tele alto.tele
$CH render notes bass.json    bass    male   --tele bass.tele
ffmpeg -y -i soprano.wav -i alto.wav -i bass.wav -filter_complex \
 "[0:a]aformat=sample_fmts=fltp,pan=stereo|c0=0.62*c0|c1=0.48*c0[s];[1:a]aformat=sample_fmts=fltp,pan=stereo|c0=0.48*c0|c1=0.62*c0[a];[2:a]aformat=sample_fmts=fltp,lowshelf=f=180:g=2,pan=stereo|c0=0.66*c0|c1=0.66*c0[b];[s][a][b]amix=inputs=3:duration=longest:normalize=0,volume=0.75,alimiter=limit=0.84:level=false" \
 -ar 48000 -c:a pcm_s24le mix_voices.wav
ffmpeg -y -i mix_voices.wav -codec:a libmp3lame -b:a 256k mix.mp3
cp -f {soprano,alto,bass}.{json,wav,tele} mix.mp3 show.json /workspace/chimera-vocal-synth/public/shows/ethereal-choir/
cd /workspace/chimera-vocal-synth && bun run build   # preview on :5183 serves dist/
```

## What Robert should check
1. Listen to `mix.mp3` / `mix_with_bed.mp3`. Does the octave-up "with you" opening work?
2. Keep the repeats (S5 "with you, with you", S6 a third "download", S7 outro "in the circle of life")?
3. Voice roles / head look / stage layout.
4. Approve a **private** Cloudflare Pages preview (still nothing public).
