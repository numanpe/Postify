# Bundled music

Background music for the video pipeline (`src/lib/video/`). No
BYOK/provider abstraction here — there's no realistic commercial music-
generation API market to integrate against the way there is for text/
image/voice, so this is a small bundled library instead, auto-selected
by industry tone (see `src/lib/video/music.ts`).

All four tracks are by **Kevin MacLeod** (incompetech.com), licensed
under **Creative Commons: By Attribution 4.0** —
https://creativecommons.org/licenses/by/4.0/. Free for commercial use
with attribution, which this file provides:

- `calm-wallpaper.mp3` — "Wallpaper" by Kevin MacLeod
- `confident-deliberate-thought.mp3` — "Deliberate Thought" by Kevin MacLeod
- `upbeat-life-of-riley.mp3` — "Life of Riley" by Kevin MacLeod
- `warm-inspired.mp3` — "Inspired" by Kevin MacLeod

Each is trimmed to 40 seconds (from the original full-length track,
downloaded from incompetech.com) with a 3-second fade-out and
re-encoded at 128kbps — long enough to cover the pipeline's 15-30s
video output with room for auto-ducking under narration, without
bundling multi-minute originals into the repo.
