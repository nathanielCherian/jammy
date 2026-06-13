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
    {"id": "track1", "name": "Track 1", "startTime": 0,   "volume": 0.85, "color": "#e05252"},
    {"id": "track2", "name": "Track 2", "startTime": 2.0, "volume": 0.75, "color": "#52a8e0"},
    {"id": "track3", "name": "Track 3", "startTime": 1.0, "volume": 0.75, "color": "#52e09e"},
]

AUDIO_DIR = "public/audio"

# ── 1. Create session ─────────────────────────────────────────────────────────
r = requests.post(f"{BASE}/sessions", json={"name": "Test Session"})
r.raise_for_status()
session = r.json()
code = session["code"]
print(f"[1] Session created  code={code}  id={session['id']}")

# ── 2. Load session (verify empty) ───────────────────────────────────────────
r = requests.get(f"{BASE}/sessions/{code}")
r.raise_for_status()
data = r.json()
print(f"[2] Session loaded   tracks={len(data['tracks'])}")

# ── 3. Upload each track ──────────────────────────────────────────────────────
for t in TRACKS:
    audio_path = f"{AUDIO_DIR}/{t['id'].replace('track', 'audio')}.mp3"
    with open(audio_path, "rb") as f:
        r = requests.post(
            f"{BASE}/sessions/{code}/tracks",
            files={"file": (f"{t['id']}.mp3", f, "audio/mpeg")},
            data={"metadata": json.dumps(t)},
        )
    r.raise_for_status()
    track = r.json()["track"]
    print(f"[3] Uploaded {t['name']}  startTime={track['startTime']}  url={track['audioUrl']}")

# ── 4. Verify session now has 3 tracks ───────────────────────────────────────
r = requests.get(f"{BASE}/sessions/{code}")
r.raise_for_status()
data = r.json()
print(f"[4] Session reloaded  tracks={len(data['tracks'])}")
for tr in data["tracks"]:
    print(f"     {tr['name']}  startTime={tr['startTime']}  enabled={tr['enabled']}")

# ── 5. Patch one track ────────────────────────────────────────────────────────
r = requests.patch(
    f"{BASE}/sessions/{code}/tracks/track2",
    json={"startTime": 5.0, "volume": 0.5},
)
r.raise_for_status()
updated = r.json()["track"]
print(f"[5] Patched track2   startTime={updated['startTime']}  volume={updated['volume']}")

print(f"\nDone. Session code: {code}")
print(f"To delete: curl -X DELETE {BASE}/sessions/{code}")
