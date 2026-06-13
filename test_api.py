"""
Jammy API smoke test.
Creates a session, uploads the three pre-loaded audio tracks, then prints results.
Run with: python test_api.py
Requires: pip install requests
"""

import json
import requests

BASE = "http://127.0.0.1:3001"

TRACKS = [
    {"name": "Track 1", "startTime": 0,   "volume": 0.85, "color": "#e05252"},
    {"name": "Track 2", "startTime": 2.0, "volume": 0.75, "color": "#52a8e0"},
    {"name": "Track 3", "startTime": 1.0, "volume": 0.75, "color": "#52e09e"},
]

AUDIO_FILES = ["public/audio/audio1.mp3", "public/audio/audio2.mp3", "public/audio/audio3.mp3"]

# ── 1. Create session ─────────────────────────────────────────────────────────
r = requests.post(f"{BASE}/sessions", json={"name": "Test Session"})
r.raise_for_status()
session = r.json()
code = session["code"]
print(f"[1] Session created  code={code}  id={session['id']}")

# ── 2. Load session (verify empty) ───────────────────────────────────────────
r = requests.get(f"{BASE}/sessions/{code}")
r.raise_for_status()
print(f"[2] Session loaded   tracks={len(r.json()['tracks'])}")

# ── 3. Upload each track ──────────────────────────────────────────────────────
uploaded_ids = []
for t, audio_path in zip(TRACKS, AUDIO_FILES):
    with open(audio_path, "rb") as f:
        r = requests.post(
            f"{BASE}/sessions/{code}/tracks",
            files={"file": ("track.mp3", f, "audio/mpeg")},
            data={"metadata": json.dumps(t)},
        )
    r.raise_for_status()
    track = r.json()["track"]
    uploaded_ids.append(track["id"])
    print(f"[3] Uploaded {t['name']}  id={track['id']}  startTime={track['startTime']}  url={track['audioUrl']}")

# ── 4. Verify session now has 3 tracks ───────────────────────────────────────
r = requests.get(f"{BASE}/sessions/{code}")
r.raise_for_status()
data = r.json()
print(f"[4] Session reloaded  tracks={len(data['tracks'])}")
for tr in data["tracks"]:
    print(f"     {tr['name']}  id={tr['id']}  startTime={tr['startTime']}  enabled={tr['enabled']}")

# ── 5. Patch one track (using server-assigned id) ────────────────────────────
r = requests.patch(
    f"{BASE}/sessions/{code}/tracks/{uploaded_ids[1]}",
    json={"startTime": 5.0, "volume": 0.5},
)
r.raise_for_status()
updated = r.json()["track"]
print(f"[5] Patched {updated['name']}  startTime={updated['startTime']}  volume={updated['volume']}")

print(f"\nDone. Session code: {code}")
print(f"To delete: curl -X DELETE {BASE}/sessions/{code}")
