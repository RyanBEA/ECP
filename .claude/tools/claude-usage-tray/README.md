# Claude Usage Tray

Windows system-tray monitor for Claude Code subscription rate limits. Reads
the same authoritative endpoint the `/usage` panel uses, so the numbers are
server-side truth rather than an estimate reconstructed from transcript logs.

## Run

    wscript.exe Start.vbs

Autostart: put a shortcut to `Start.vbs` in
`shell:startup` (Win+R, `shell:startup`).

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
