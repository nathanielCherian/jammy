# Jammy

A browser-based collaborative DAW prototype. Multiple people can each record an audio track independently; the app overlays them on a shared timeline with per-track volume, enable/disable controls, and waveform visualization.

**Current branch: `feature/recording`** — adds live microphone recording on top of the v0 prototype (committed to `master`).

---

## Quick Start

```bash
npm install
npm run dev       # http://localhost:5173
```

Node 18+ required. No backend — everything runs in the browser.

---

## Features (v0 + recording branch)

- **Timeline** — draggable clips, ruler with second marks, animated playhead
- **Waveform** — rendered from decoded `AudioBuffer` data inside each clip
- **Transport** — play / pause / stop with accurate resume-from-position
- **Per-track controls** — volume slider, enable/disable toggle, color coding
- **Recording** — live mic capture while playback runs; recorded clip appears on timeline at the correct start position with its own waveform
- **Monitor toggle** — mute playback during recording to prevent speaker feedback

---

## Architecture

### Directory Layout

```
src/
├── types.ts                  # Shared TypeScript interfaces
├── constants.ts              # PIXELS_PER_SECOND, SONG_DURATION, etc.
├── data/
│   └── tracks.ts             # Initial track definitions (static for now)
├── audio/
│   ├── audioEngine.ts        # Pure class — Web Audio API orchestration
│   ├── useAudioEngine.ts     # React hook — state + callbacks for the UI
│   └── recorder.ts           # Pure class — MediaRecorder / getUserMedia
└── components/
    ├── TransportBar/         # Play/pause/stop/record controls + time display
    └── Timeline/
        ├── Timeline.tsx      # Scroll container, ruler, playhead
        ├── TrackLane.tsx     # One row: label, volume, enable toggle
        ├── Clip.tsx          # Draggable colored rectangle + waveform canvas
        ├── Playhead.tsx      # Vertical line animated via requestAnimationFrame
        └── TimelineRuler.tsx # Second/half-second tick marks
```

### Data Flow

```
useAudioEngine (single source of truth)
    │
    ├── tracks: Track[]           — all track metadata + state
    ├── clipDurations: Map        — buffer.duration per track id
    ├── audioBuffers: Map         — decoded AudioBuffer per track id (for waveforms)
    ├── playbackState             — 'stopped' | 'playing' | 'paused' | 'recording'
    ├── currentTime               — playhead position in seconds (updated by rAF)
    └── monitorEnabled            — whether mix plays through speakers during recording
          │
          ├── → AudioEngine       — imperative Web Audio API class
          └── → Recorder          — imperative MediaRecorder class
```

All UI components are stateless except `Clip` (drag state) and `TransportBar` (recording elapsed timer). Everything else is props-down, callbacks-up.

---

## Audio Engine (`src/audio/audioEngine.ts`)

### Key Design Decisions

**Single `AudioContext`** — created lazily on first user gesture (browser autoplay policy). Never closed; closing it would require re-decoding all buffers.

**Master gain node** — all track gain nodes connect to a `masterGain` node before `ctx.destination`. This is how `setMonitorEnabled()` silences the whole mix during recording without touching individual track gains.

```
AudioBufferSourceNode → TrackGainNode → masterGain → ctx.destination
```

**Pause/resume strategy** — uses `AudioContext.suspend()` / `resume()`. The context clock freezes on suspend, making `getCurrentTime()` trivial:

```typescript
getCurrentTime() {
  if (ctx.state === 'suspended') return playheadOffset;
  return playheadOffset + (ctx.currentTime - startedAtCtxTime);
}
```

`playheadOffset` accumulates across pause cycles. `startedAtCtxTime` is reset to `ctx.currentTime` on every play/resume.

**Source node lifecycle** — `AudioBufferSourceNode` is fire-and-forget; it cannot be paused. On every play/resume, all source nodes are torn down and recreated with correct buffer offsets. This is intentional and correct per the Web Audio spec.

**Scheduling correctness** — all source nodes use `this.startedAtCtxTime` (not `ctx.currentTime`) as the scheduling reference. This ensures the audio schedule and the playhead calculation share the exact same clock origin, preventing visual/audio drift.

**No looping** — clips play once for their natural buffer duration. The engine skips scheduling any track whose clip has already ended at the current playhead position.

### Adding a New Track Dynamically

```typescript
engine.addBuffer(id, audioBuffer);  // stores decoded buffer
// Then update React state via setTracks / setClipDurations / setAudioBuffers
```

---

## Recording Pipeline (`src/audio/recorder.ts`)

### getUserMedia Constraints

All browser audio processing is **disabled** for music recording:

```typescript
{
  echoCancellation: false,     // AEC treats music as echo — causes heavy distortion
  noiseSuppression: false,     // strips frequencies it thinks are noise
  autoGainControl: false,      // pumps gain in response to music dynamics
  suppressLocalAudioPlayback: true,  // Chrome 94+: prevents OS from routing
                                     // playback into the capture stream (Stereo Mix)
}
```

This matches how every professional DAW handles mic input. With headphones, the raw signal is clean. For speaker users, the Monitor toggle silences the mix during recording.

### Recording Flow

1. `startRecording()` in `useAudioEngine` — starts playback if not already running, snapshots `recordStartTime = engine.getCurrentTime()`, calls `recorder.start()`
2. `MediaRecorder` collects 100ms chunks into a `Blob[]`
3. `stopRecording()` — stops `MediaRecorder`, decodes the `Blob` via `ctx.decodeAudioData()`, calls `engine.addBuffer()`, pushes a new `Track` into React state
4. The new track's `startTime` is the timeline position where recording began — it plays back in sync with the mix

---

## `Track` Type

```typescript
interface Track {
  id: string;
  name: string;
  audioUrl: string;    // empty string '' for recorded tracks (buffer stored in engine)
  startTime: number;   // seconds from timeline start
  volume: number;      // 0.0 – 1.0
  color: string;       // CSS hex
  enabled: boolean;
}
```

**Note**: Recorded tracks have `audioUrl: ''` because the audio lives in the engine's buffer map, not as a fetchable URL. When persisting to a database, the buffer should be uploaded to object storage first and the URL stored here.

---

## Future Expansion Guide

### 1. Remote Database (Project Persistence)

**What to store:**

| Table | Fields |
|-------|--------|
| `projects` | id, name, owner_id, song_duration, created_at, updated_at |
| `tracks` | id, project_id, name, audio_url, start_time, volume, color, enabled, created_at |

**What NOT to store in the database**: audio binary data. Store it in object storage (S3, Cloudflare R2, Supabase Storage) and store only the URL in the `tracks` table.

**Recommended stack**: Supabase (Postgres + Auth + Storage + Realtime in one) or PlanetScale + S3.

**Loading a project**: Fetch `tracks` rows → use existing `engine.loadBuffers()` → pass to `useAudioEngine` initial state. The `Track` interface already matches this shape exactly.

**Saving a project**: 
- For pre-loaded tracks: `audioUrl` already points to a file, just save the track row.
- For recorded tracks: upload the raw `Blob` to object storage → get back a URL → save the track row with that URL.

```typescript
// Pseudocode for saving a recorded track
const blob = await recorder.stop();
const { url } = await storageClient.upload(`recordings/${id}.webm`, blob);
await db.tracks.insert({ ...newTrack, audioUrl: url });
```

### 2. Real-Time Collaboration

Multiple users editing the same project simultaneously. Two viable approaches:

**Approach A — Optimistic updates + database polling**
- Each client writes track mutations directly to the database
- Clients poll for changes every 1–2 seconds and reconcile
- Simple to implement; slight latency

**Approach B — WebSockets / Supabase Realtime**
- Subscribe to a channel per project: `supabase.channel('project:${id}')`
- Broadcast track mutations (startTime changes, volume changes, new tracks) as events
- Other clients apply them locally to React state without touching the audio engine (no restart needed for non-startTime changes)
- Only startTime changes require `commitTrackStartTime()` on other clients

**Conflict resolution**: Last-write-wins is fine for v1. Each mutation carries a `user_id` and `timestamp`; if two users drag the same clip simultaneously, the most recent write wins.

### 3. Audio File Storage

When users record, the `Blob` from `MediaRecorder` is currently only in memory. To persist:

1. Upload on `stopRecording()` before adding to state
2. Store as `audio/webm` (already the MediaRecorder output type)
3. On project load, fetch the URL and decode via `engine.loadBuffers()`

The `loadBuffers()` method already handles arbitrary URLs:
```typescript
const res = await fetch(track.audioUrl, { mode: 'cors' });
const arrayBuffer = await res.arrayBuffer();
const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
```
Object storage buckets must have CORS configured to allow `GET` from the app's origin.

### 4. User Authentication

Add an auth layer (Supabase Auth, Auth.js, Clerk) before any database work. The `Track` and `Project` types will need `owner_id`. Row-level security on the database should restrict project access to collaborators only.

### 5. Audio Export (Mix Down)

To export the full mix as a single audio file:

```typescript
// Render offline at 2× realtime using OfflineAudioContext
const offline = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
// Schedule all tracks into the offline context (same logic as scheduleAllTracks)
const renderedBuffer = await offline.startRendering();
// Encode renderedBuffer to WAV using a library like audiobuffer-to-wav
```

`OfflineAudioContext` renders faster than realtime and produces a lossless `AudioBuffer` that can be encoded to WAV or MP3.

### 6. Effects Chain

The current signal path is `SourceNode → TrackGain → MasterGain → destination`. To add per-track effects:

```
SourceNode → TrackGain → [EQ → Compressor → Reverb → ...] → MasterGain → destination
```

Add an `effects: EffectNode[]` array to the `Track` type and chain them between the track gain and master gain inside `scheduleAllTracks()`.

### 7. MIDI / Click Track

Add a `TempoContext` (BPM, time signature) to `constants.ts`. Use `AudioContext.currentTime` scheduling to generate a click track using `OscillatorNode` pulses. The timeline ruler can show beats instead of seconds when a BPM is set.

---

## Timeline Coordinate System

Understanding this is critical for any UI work:

- `PIXELS_PER_SECOND = 80` — the single conversion factor between screen pixels and time
- `LABEL_WIDTH = 160` — the fixed-width track label column (sticky, not scrollable)
- The ruler and playhead live in `.timelineInner` (full width) and are offset by `LABEL_WIDTH`
- Clip `left` values are relative to `.laneClipArea`, which already starts at `LABEL_WIDTH` — so clips use `startTime * PIXELS_PER_SECOND` with **no** `LABEL_WIDTH` offset

**Pixel ↔ time conversion:**
```typescript
const seconds = pixelDelta / PIXELS_PER_SECOND;
const pixels  = seconds * PIXELS_PER_SECOND;
```

---

## Branch Structure

| Branch | Description |
|--------|-------------|
| `master` | v0 — pre-loaded tracks, timeline, waveforms, enable toggles |
| `feature/recording` | Adds live mic recording, monitor toggle, recording UI |
