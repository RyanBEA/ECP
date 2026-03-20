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
| - Stereo FLAC recording   |  SFTP/    |     completed/  <- done        |
| - Metadata JSON           | paramiko  |     failed/     <- errors      |
| - Local staging + retry   |           |   transcripts/  <- output .md  |
+---------------------------+           |                                |
                                        | faster-whisper + pyannote      |
                                        +--------------------------------+
```

## Client App Design

### Audio Capture

Two simultaneous audio streams recorded into a single stereo FLAC file:

- **Left channel:** Microphone input (BEA voices — Ryan and/or Mark)
- **Right channel:** WASAPI loopback (all remote participants mixed by Teams)

This stereo split enables the server to:
- Label all left-channel speech as "BEA" without diarization
- Run diarization only on the right channel to separate individual client voices

**Sample rate handling:** WASAPI loopback devices must be opened at the system audio endpoint's native rate (typically 48kHz). The mic stream is resampled to match the loopback rate so both channels align. The server handles downsampling to 16kHz (Whisper's native rate) during transcription.

**Threading model:** Both capture streams run in separate threads using PyAudioWPatch callbacks. Each callback pushes frames to a `queue.Queue`. A dedicated writer thread drains both queues and interleaves frames by position into the stereo FLAC file. This avoids blocking in callbacks and keeps the streams synchronized.

**Libraries:**
- `PyAudioWPatch` — Both WASAPI loopback capture AND mic input (single PortAudio instance; using `sounddevice` alongside would load a conflicting PortAudio DLL)
- `numpy` — Interleave channels into stereo frames, resample mic if needed
- `soundfile` — Write stereo FLAC

**Format:** FLAC (lossless compression, ~3x smaller than WAV), recorded at the loopback device's native sample rate (typically 48kHz). A 1-hour meeting is ~225MB FLAC vs ~675MB WAV at 48kHz stereo.

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
- `pynput` — Global hotkey registration (via `pynput.keyboard.GlobalHotKeys`; works with pystray's message pump)

### File Naming & Metadata

**Naming convention:** `YYYY-MM-DD_HHmm_slugified-meeting-name`

**Slug rules:** lowercase, spaces to hyphens, strip non-alphanumeric (except hyphens), truncate at 50 characters.

Example:
```
2026-03-20_1430_client-abc-kickoff.flac
2026-03-20_1430_client-abc-kickoff.json
```

**Metadata JSON:**
```json
{
  "schema_version": 1,
  "meeting_name": "Client ABC Kickoff",
  "recorded_by": "ryan",
  "start_time": "2026-03-20T14:30:00-03:00",
  "end_time": "2026-03-20T15:15:00-03:00",
  "duration_seconds": 2700,
  "sample_rate": 48000,
  "channels": {
    "left": "bea",
    "right": "remote"
  }
}
```

### Upload & Queue Contract

**Upload target:** `ryan@bae:/opt/transcription/transcription-queue/incoming/`

**Protocol:** SFTP via `paramiko` (Python SSH library — no dependency on external `scp.exe`). Authentication via SSH key (path configurable, defaults to `~/.ssh/id_ed25519`).

**Atomic upload process:**
1. Client writes FLAC + JSON to local staging directory
2. Opens SFTP connection to bae
3. Uploads both files to `incoming/` with `.part` suffix (e.g., `meeting.flac.part`)
4. After both uploads complete, renames both files to drop the `.part` suffix (SFTP `rename()` is atomic on the same filesystem)
5. On success: deletes local copies, shows tray notification
6. On failure at any step: keeps local copies, cleans up any `.part` files on server, shows failure notification

This ensures the server never sees a half-uploaded job — files only appear without `.part` when both are fully transferred.

**Queue contract (interface between client and server):**
- A job is defined by a matching `.flac` + `.json` pair in `incoming/` (no `.part` suffix)
- The JSON file contains all metadata needed for processing
- The `channels` field tells the server how to interpret L/R audio
- The `sample_rate` field tells the server the recording rate
- File naming is consistent between the pair
- Server ignores `.part` files (uploads in progress)

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
      audio.py             # WASAPI loopback + mic capture, stereo FLAC writing
      uploader.py          # Paramiko SFTP, atomic upload, retry logic, staging
      ui.py                # Tray icon, menu, meeting name dialog
      config.py            # Server host, paths, hotkey, recorded_by, etc.
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
SSH_KEY_PATH = os.path.expanduser("~/.ssh/id_ed25519")
QUEUE_PATH = "/opt/transcription/transcription-queue/incoming/"
STAGING_DIR = os.path.join(os.environ["LOCALAPPDATA"], "BEA-Transcribe", "staging")
LOG_DIR = os.path.join(os.environ["LOCALAPPDATA"], "BEA-Transcribe", "logs")
RECORDED_BY = "ryan"  # Set to "mark" on Mark's machine
HOTKEY = "ctrl+shift+r"
RETRY_INTERVAL_SECONDS = 300
```

### Logging

Rotating log file at `%LOCALAPPDATA%\BEA-Transcribe\logs\bea-transcribe.log`. Standard Python `logging` module with `RotatingFileHandler`. Logs audio device selection, recording start/stop, upload attempts/results, and errors. Essential for debugging audio device issues on a headless tray app (no console output with `pythonw`).

### Dependencies

```
PyAudioWPatch
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

**Context:** A client app on Windows captures Teams meeting audio as stereo FLAC files (left channel = local mic / "BEA" voices, right channel = WASAPI loopback / remote participants) and uploads them via SFTP along with a metadata JSON file to `/opt/transcription/transcription-queue/incoming/`. Files are uploaded with a `.part` suffix and renamed atomically when complete — ignore any `.part` files.

**Metadata JSON schema (version 1):**
```json
{
  "schema_version": 1,
  "meeting_name": "Client ABC Kickoff",
  "recorded_by": "ryan",
  "start_time": "2026-03-20T14:30:00-03:00",
  "end_time": "2026-03-20T15:15:00-03:00",
  "duration_seconds": 2700,
  "sample_rate": 48000,
  "channels": { "left": "bea", "right": "remote" }
}
```

**Requirements:**

1. **Queue watcher:** A systemd service that watches `/opt/transcription/transcription-queue/incoming/` for new `.json` + `.flac` pairs (ignore `.part` files — those are still uploading).

2. **Processing pipeline:**
   - Move the pair to `processing/` while working
   - Split the stereo FLAC into left and right channels
   - Resample both to 16kHz (Whisper's native rate) — the `sample_rate` field in the JSON gives the source rate
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

4. **File lifecycle:**
   - Success: move the FLAC + JSON pair to `completed/`
   - Failure: move to `failed/`, write an error JSON alongside (e.g., `meeting.error.json` with error message, traceback, timestamp)
   - Log all processing to `/opt/transcription/logs/`

5. **Dependencies to install:** `faster-whisper`, `pyannote-audio`, `torch` (with CUDA support for RTX PRO 4000), `soundfile`, `numpy`, `librosa` (for resampling). Use a Python venv at `/opt/transcription/venv/`.

6. **Hardware:** This server has an NVIDIA RTX PRO 4000 (24GB VRAM), 62GB RAM, Ubuntu 24.04, Python 3.12, ffmpeg installed. CUDA drivers are already present (580.126.09).

7. **Note on pyannote:** Requires accepting the model license on Hugging Face and providing an auth token. Prompt the user for this during setup.

8. **Directory structure to create:**
   ```
   /opt/transcription/
     venv/
     transcription-queue/
       incoming/
       processing/
       completed/
       failed/
     transcripts/
     logs/
   ```

---

## Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| Stereo L/R split instead of mono | Eliminates need for diarization on BEA voices; reduces server-side diarization to remote-only |
| Record at native rate, resample server-side | WASAPI loopback cannot open at arbitrary rates; must match system audio endpoint (typically 48kHz). Server resamples to 16kHz for Whisper |
| FLAC instead of WAV | Lossless compression, ~3x smaller files. `soundfile` supports both natively |
| PyAudioWPatch for both mic and loopback | Using `sounddevice` alongside would load a conflicting PortAudio DLL — single library avoids device contention |
| Atomic SFTP upload with .part rename | Prevents server from processing half-uploaded files |
| paramiko SFTP instead of shelling out to scp | No dependency on Windows SSH tools being on PATH; SFTP rename() enables atomic uploads |
| venv instead of PyInstaller .exe | Simpler to update, only used on known machines |
| Local staging with retry | Prevents data loss when offsite or server unavailable |
| Metadata JSON alongside FLAC | Clean contract between client and server; extensible with schema versioning |
