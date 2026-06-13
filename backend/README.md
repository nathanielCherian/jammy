# Jammy Backend

Node.js/Fastify server providing session management, audio file storage, and real-time sync for Jammy.

## Quick Start

```bash
npm install
npm run dev      # http://localhost:3001
```

Node 18+ required. The SQLite database (`jammy.db`) and `uploads/` folder are created automatically on first run.

---

## REST API

### Sessions

#### Create a session
```
POST /sessions
Content-Type: application/json

{ "name": "Friday Jam" }   // name is optional
```
```json
{
  "id": "6a77e75b-a5f5-4cd0-b0ae-f6966cd54a75",
  "code": "N4WMWL",
  "name": "Friday Jam",
  "createdAt": 1781323224158
}
```
The `code` is the shareable 6-character room code. Share it with collaborators.

---

#### Load a session
```
GET /sessions/:code
```
```json
{
  "session": { "id": "...", "code": "N4WMWL", "name": "Friday Jam", "createdAt": 1781323224158 },
  "tracks": [
    {
      "id": "rec-abc123",
      "name": "Guitar",
      "audioUrl": "/uploads/6a77e75b.../rec-abc123.webm",
      "startTime": 4.5,
      "volume": 0.9,
      "color": "#ff7043",
      "enabled": true
    }
  ]
}
```

---

#### Delete a session
```
DELETE /sessions/:code
```
Returns `204`. Removes all DB rows and deletes the `uploads/{sessionId}/` folder.

---

### Tracks

#### Upload a recorded track
```
POST /sessions/:code/tracks
Content-Type: multipart/form-data
```

Two fields required:

| Field | Type | Description |
|-------|------|-------------|
| `file` | File (audio/webm) | Raw recording from MediaRecorder |
| `metadata` | JSON string | Track properties (see below) |

`metadata` shape:
```json
{
  "id": "rec-abc123",
  "name": "Guitar",
  "startTime": 4.5,
  "volume": 0.9,
  "color": "#ff7043",
  "enabled": true
}
```

Only `id` is required; all other fields have defaults.

Response `201`:
```json
{
  "track": {
    "id": "rec-abc123",
    "name": "Guitar",
    "audioUrl": "/uploads/6a77e75b.../rec-abc123.webm",
    "startTime": 4.5,
    "volume": 0.9,
    "color": "#ff7043",
    "enabled": true
  }
}
```

After upload the server emits a `track:added` Socket.IO event to all clients in the session room.

---

#### Update a track
```
PATCH /sessions/:code/tracks/:trackId
Content-Type: application/json
```

All fields optional — only include what changed:
```json
{
  "startTime": 8.0,
  "volume": 0.75,
  "enabled": false,
  "name": "Guitar (take 2)",
  "color": "#ab47bc"
}
```

Returns `200` with the full updated track object.

---

#### Delete a track
```
DELETE /sessions/:code/tracks/:trackId
```

Returns `204`. Removes the DB row and the `.webm` file from disk.

---

### Audio Files

Uploaded recordings are served as static files:
```
GET /uploads/{sessionId}/{trackId}.webm
```

This URL is what the `audioUrl` field on each track points to. Load it directly in the browser via `fetch()` or as an `<audio>` `src`.

---

## Real-Time (Socket.IO)

Connect to the server root:
```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:3001');
```

### Joining a session

```js
socket.emit('join', { code: 'N4WMWL' });

socket.on('session:state', ({ session, tracks, userId, onlineCount }) => {
  // Full session state — use this to initialize local state on load
});
```

`userId` is a server-assigned UUID for this connection (anonymous, not persisted).

---

### Presence events

```js
socket.on('user:joined', ({ userId, onlineCount }) => { });
socket.on('user:left',   ({ userId, onlineCount }) => { });
```

---

### Track mutations

Emit when the local user changes a track (e.g. drag end, volume slider):
```js
socket.emit('track:update', {
  trackId: 'rec-abc123',
  changes: { startTime: 8.0 }   // only send the fields that changed
});
```

Receive when another user changes a track:
```js
socket.on('track:updated', ({ trackId, changes }) => {
  // apply changes to local track state
});
```

Emit/receive deletions:
```js
socket.emit('track:delete', { trackId: 'rec-abc123' });
socket.on('track:deleted',  ({ trackId }) => { });
```

New track uploaded by another user:
```js
socket.on('track:added', ({ track }) => {
  // add track to local state and load its audio
});
```

---

## Notes

- **Conflict resolution**: last-write-wins. All `track:update` payloads are persisted to SQLite before broadcast.
- **Playback is independent**: the server does not sync play/pause/currentTime. Each client manages its own playback state.
- **Pre-loaded tracks**: the frontend's built-in `audio1/2/3.mp3` tracks are not stored in the backend. Only recorded tracks uploaded via `POST /sessions/:code/tracks` appear in the API.
- **Session lifetime**: sessions persist indefinitely until `DELETE /sessions/:code` is called.
- **File size limit**: 100 MB per upload (configurable via `limits.fileSize` in `src/index.ts`).
- **CORS**: allows `localhost:5173` (Vite dev) and `localhost:4173` (Vite preview) by default. Update the `origin` arrays in `src/index.ts` for production.
