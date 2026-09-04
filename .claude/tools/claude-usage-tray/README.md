# Claude Usage Tray

Windows system-tray monitor for Claude Code subscription rate limits. Reads
the same authoritative endpoint the `/usage` panel uses, so the numbers are
server-side truth rather than an estimate reconstructed from transcript logs.

## Run

    wscript.exe Start.vbs

Autostart: put a shortcut to `Start.vbs` in
`shell:startup` (Win+R, `shell:startup`).

## Credentials source

By default the tray reads the local `~/.claude/.credentials.json`. Claude Code
refreshes that token only when it runs on this PC — if you mostly use Claude
Code over SSH on a server, the local token expires and the tray goes stale.

Set `SSH_SOURCE` in `Start.vbs` (or the `CLAUDE_USAGE_TRAY_SSH` environment
variable) to `user@host` and the tray reads **both** files on each poll — the
local one and the server's over SSH — and uses whichever token expires later.
Work locally some days and over SSH on others; it picks the fresh one without
any switching. Requirements:

- Key-based auth: `ssh user@host echo ok` must succeed with no prompt. The
  tray runs `ssh -o BatchMode=yes`, so any prompt is a hard failure, shown as
  "Server unreachable".
- Same Anthropic account on the server as the one you want to monitor.

Still read-only: nothing is ever written to either credentials file.

## What it shows

Every rate-limit bucket the API returns — session, weekly, and any
model-scoped weekly bucket — plus extra-usage credits. Bucket discovery is
schema-driven: no bucket key or model name is hardcoded, because Anthropic
versions this response server-side and per-model limits now arrive only
inside `limits[]`.

## Security

- `~/.claude/.credentials.json` is opened **read-only**. Tokens are never
  refreshed, written, logged, or displayed.
- The only network destination is `api.anthropic.com`.
- Credential parse failures log the exception *type* only, never the record,
  which could contain token fragments.

## Tests

    pwsh -File tests/Usage.Parse.Tests.ps1

All parsing logic is pure and lives in `lib/Usage.Parse.ps1`, tested against a
real captured API response in `tests/fixtures/`.

## Prior art

Design informed by reading `jens-duttke/usage-monitor-for-claude` (scoped-limit
merge strategy) and `apexlocal-jz/claude-usage-tray` (WinForms structure, the
`DestroyIcon` GDI fix, the 401-to-429 escalation hazard). Neither is vendored.
