# BEA-Transcribe: Meeting Transcription System

**Date:** 2026-03-20
**Status:** Design approved
**Scope:** Client-side application + server-side agent prompt

## Problem

BEA staff (Ryan, Mark) cannot use Copilot transcription in Microsoft Teams for client meetings. Existing solutions either invite a visible bot to the call (unprofessional) or rely on cloud transcription (privacy concern). BEA needs an invisible, local-capture solution that leverages their on-prem GPU server (bae) for transcription.

## Solution Overview

A two-part system:

1. **Client app (Windows):** Lightweight Python tray application that captures meeting audio and uploads it to the server queue
2. **Server pipeline (bae):** Watches a queue directory, transcribes audio with speaker diarization, outputs markdown transcripts

This spec covers the **client app** implementation. The server pipeline is described as an agent prompt for future implementation.

## Architecture

```
Windows Laptop                          bae server (RTX PRO 4000)
+---------------------------+           +--------------------------------+
| BEA-Transcribe tray app   |           | /opt/transcription/            |
|                           |           |   transcription-queue/         |
| - WASAPI loopback (R ch)  |  SCP/     |     incoming/   <- new jobs    |
| - Mic input (L ch)        | paramiko  |     processing/ <- in progress |
| - Stereo WAV recording    |---------->|     completed/  <- done        |
| - Metadata JSON           |           |   transcripts/  <- output .md  |
| - Local staging + retry   |           |                                |
+---------------------------+           | faster-whisper + pyannote      |
                                        +--------------------------------+
```

## Client App Design

### Audio Capture

Two simultaneous audio streams recorded into a single stereo WAV file:

- **Left channel:** Microphone input (BEA voices — Ryan and/or Mark)
- **Right channel:** WASAPI loopback (all remote participants mixed by Teams)

This stereo split enables the server to:
- Label all left-channel speech as "BEA" without diarization
- Run diarization only on the right channel to separate individual client voices

**Libraries:**
- `PyAudioWPatch` — WASAPI loopback capture (system audio)
- `sounddevice` — Microphone capture
- `numpy` — Interleave channels into stereo frames
- `soundfile` — Write stereo WAV

**Format:** 16-bit PCM WAV, 16kHz sample rate (Whisper's native rate — no resampling needed server-side).

### Tray Application UX

System tray application with minimal interaction:

**Idle state:**
- Grey microphone icon in system tray
- Right-click menu: "Start Recording", "Upload Pending (N)" (if any), "Exit"
- Global hotkey: `Ctrl+Shift+R` to toggle recording

**Recording state:**
- Icon changes to red/active color
- Right-click menu: "Stop Recording", "Exit"
- Hotkey: same `Ctrl+Shift+R` to stop

**On stop:**
- Small tkinter dialog appears with:
  - Text field for meeting name (pre-filled with today's date)
  - OK button
- On OK: writes files to local staging, attempts upload to bae

**Libraries:**
- `pystray` — System tray icon and menu
- `Pillow` — Icon image generation
- `tkinter` — Meeting name dialog (bundled with Python)
- `keyboard` or `pynput` — Global hotkey registration

### File Naming & Metadata

**Naming convention:** `YYYY-MM-DD_HHmm_slugified-meeting-name`

Example:
```
2026-03-20_1430_client-abc-kickoff.wav
2026-03-20_1430_client-abc-kickoff.json
```

**Metadata JSON:**
```json
{
  "meeting_name": "Client ABC Kickoff",
  "recorded_by": "ryan",
  "start_time": "2026-03-20T14:30:00-03:00",
  "end_time": "2026-03-20T15:15:00-03:00",
  "duration_seconds": 2700,
  "channels": {
    "left": "bea",
    "right": "remote"
  }
}
```

### Upload & Queue Contract

**Upload target:** `ryan@bae:/opt/transcription/transcription-queue/incoming/`

**Protocol:** SCP via `paramiko` (Python SSH library — no dependency on external `scp.exe`).

**Process:**
1. Client writes WAV + JSON to local staging directory
2. Attempts SCP of both files to `incoming/` on bae
3. On success: deletes local copies, shows tray notification
4. On failure: keeps local copies, shows failure notification

**Queue contract (interface between client and server):**
- A job is defined by a matching `.wav` + `.json` pair in `incoming/`
- The JSON file contains all metadata needed for processing
- The `channels` field tells the server how to interpret L/R audio
- File naming is consistent between the pair

### Local Staging & Retry

**Staging directory:** `%LOCALAPPDATA%\BEA-Transcribe\staging\`

**Offline resilience:**
- All recordings are written to staging first, then uploaded
- If bae is unreachable (offsite, server down), files remain in staging
- Tray menu shows "Upload Pending (N)" with count of queued files
- Clicking "Upload Pending" retries all pending uploads
- Auto-retry every 5 minutes while the app is running
- No silent data loss — local copy always exists until confirmed uploaded

### Project Structure

**Location:** `C:\Users\RyanKelly\opt\bea-transcribe\`

```
bea-transcribe/
  venv/                    # Python virtual environment
  src/
    bea_transcribe/
      __init__.py
      app.py               # Main entry point, tray app lifecycle
      audio.py             # WASAPI loopback + mic capture, stereo WAV writing
      uploader.py          # Paramiko SCP, retry logic, staging management
      ui.py                # Tray icon, menu, meeting name dialog
      config.py            # Server host, paths, hotkey, etc.
  assets/
    icon_idle.png          # Grey mic icon
    icon_recording.png     # Red/active mic icon
  BEA-Transcribe.bat       # Launcher: activates venv, runs app
  requirements.txt
  README.md
```

### Configuration

Hardcoded defaults with optional config file override (`config.py`):

```python
SERVER_HOST = "bae"
SERVER_USER = "ryan"
QUEUE_PATH = "/opt/transcription/transcription-queue/incoming/"
STAGING_DIR = os.path.join(os.environ["LOCALAPPDATA"], "BEA-Transcribe", "staging")
SAMPLE_RATE = 16000
HOTKEY = "ctrl+shift+r"
RETRY_INTERVAL_SECONDS = 300
```

### Dependencies

```
PyAudioWPatch
sounddevice
numpy
soundfile
pystray
Pillow
paramiko
pynput
```

### Startup

`BEA-Transcribe.bat`:
```batch
@echo off
call "%~dp0venv\Scripts\activate.bat"
pythonw -m bea_transcribe.app
```

Optionally add a shortcut to `shell:startup` for auto-start with Windows.

## Server-Side Agent Prompt

The following prompt can be given to Claude Code on bae to build the server pipeline:

---

**Task:** Build a transcription processing pipeline on this server.

**Context:** A client app on Windows captures Teams meeting audio as stereo WAV files (left channel = local mic / "BEA" voices, right channel = WASAPI loopback / remote participants) and SCPs them along with a metadata JSON file to `/opt/transcription/transcription-queue/incoming/`.

**Requirements:**

1. **Queue watcher:** A systemd service that watches `/opt/transcription/transcription-queue/incoming/` for new `.json` + `.wav` pairs.

2. **Processing pipeline:**
   - Move the pair to `processing/` while working
   - Split the stereo WAV into left and right channels
   - Run `faster-whisper` (Large v3 model) on each channel separately
   - Left channel: label all speech as "BEA" (no diarization)
   - Right channel: run `pyannote-audio` speaker diarization to identify individual remote speakers, then transcribe each segment with `faster-whisper`
   - Merge the two transcript streams chronologically by timestamp

3. **Output format:** Timestamped markdown at `/opt/transcription/transcripts/YYYY-MM-DD_HHmm_meeting-name.md`:
   ```
   # Client ABC Kickoff
   **Date:** 2026-03-20 14:30 — 15:15 AST
   **Duration:** 45 minutes

   ---

   [00:01:23] **BEA:** We'd recommend upgrading the envelope first...
   [00:01:45] **Client Speaker 1:** What's the cost impact of that?
   [00:02:10] **BEA:** Roughly $15,000 for the above-grade walls...
   [00:02:30] **Client Speaker 2:** Can we phase that over two years?
   ```

4. **File lifecycle:** After successful transcription, move the WAV + JSON pair to `completed/`.

5. **Dependencies to install:** `faster-whisper`, `pyannote-audio`, `torch` (with CUDA support for RTX PRO 4000), `soundfile`, `numpy`. Use a Python venv at `/opt/transcription/venv/`.

6. **Hardware:** This server has an NVIDIA RTX PRO 4000 (24GB VRAM), 62GB RAM, Ubuntu 24.04, Python 3.12, ffmpeg installed. CUDA drivers are already present (580.126.09).

7. **Note on pyannote:** Requires accepting the model license on Hugging Face and providing an auth token. Prompt the user for this during setup.

---

## Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| Stereo L/R split instead of mono | Eliminates need for diarization on BEA voices; reduces server-side diarization to remote-only |
| 16kHz sample rate | Whisper's native rate — avoids resampling, smaller files |
| paramiko instead of shelling out to scp | No dependency on Windows SSH tools being on PATH |
| venv instead of PyInstaller .exe | Simpler to update, only used on known machines |
| Local staging with retry | Prevents data loss when offsite or server unavailable |
| Metadata JSON alongside WAV | Clean contract between client and server; extensible |
