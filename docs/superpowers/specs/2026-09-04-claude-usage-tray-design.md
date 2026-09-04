# Claude Usage Tray — Design Spec

**Date:** 2026-09-04
**Status:** Approved for planning
**Author:** Ryan Kelly (with Claude Code)

## Problem

Claude Code's `/usage` panel is the only authoritative view of subscription
rate-limit state, and it is only reachable from inside an interactive session.
There is no at-a-glance indicator, so you discover you are near a wall by
hitting it.

The gap is not cosmetic. On 2026-09-04 the account showed Session 88% and
Weekly 61% — two comfortable-looking numbers — while the limit actually
gating work was a **weekly bucket scoped to the Fable model at 100%**, and
extra-usage credits were exhausted at $50.09 of a $50.00 CAD cap. A widget
that reported only the two headline numbers would have been actively
misleading at the moment it mattered most.

## Goal

A Windows system-tray icon showing current rate-limit state at a glance and,
on click, a panel listing every active limit with reset times — sourced from
the same authoritative endpoint `/usage` uses.

## Non-goals

- **No token refresh.** Claude Code owns credential rotation. This tool never
  writes to `.credentials.json`.
- **No auto-update of Claude Code.** Explicitly rejected: a reference tool
  shells out to `claude update` to renew tokens, which would let a usage
  widget replace the CLI binary unattended. On this machine that risks
  reverting the `"async": true` superpowers hook fix and reintroducing the
  documented Windows TUI freeze.
- **No cost estimation from token logs.** Log-derived estimates are a
  different, weaker number than server-side utilization. (The credits/spend
  figures we *do* show come from the API's own `spend` block, not from
  reconstructing cost out of transcript logs.)
- **Not cross-platform.** Windows 10/11 only.
- **No telemetry**, and no network destination other than `api.anthropic.com`.

## Data source

```
GET https://api.anthropic.com/api/oauth/usage
  Authorization:  Bearer <claudeAiOauth.accessToken>
  Content-Type:   application/json
  anthropic-beta: oauth-2025-04-20
  User-Agent:     claude-usage-tray/<version>
```

Verified against the Claude Code binary's own call site, which uses a 5s
timeout and handles `401 -> refresh -> retry`. A cheaper variant
`?at_wall=1&skip_spend=1` exists but is not used; we want the spend block.

`anthropic-version` and `x-app: cli` appear elsewhere in the binary but are
not sent by this call — omitted.

Credentials are read from `$env:CLAUDE_CONFIG_DIR\.credentials.json`, falling
back to `~/.claude/.credentials.json`. Shape:
`claudeAiOauth.{accessToken, refreshToken, expiresAt, subscriptionType}`.
`refreshToken` is never read.

### Open question: User-Agent

The two reference implementations disagree. `jens-duttke` sends
`claude-code/<installed CLI version>`; `apexlocal-jz` sends
`claude-usage-tray/0.1` and reportedly works. A third-party claim that a
`claude-code/` User-Agent is *required* to avoid aggressive 429s is
unverified.

**Decision:** send an honest `claude-usage-tray/<version>`. Do not impersonate
the CLI. Treat robust 429 handling as mandatory rather than dodging rate
limiting by disguise. If sustained 429s appear in practice, revisit — as a
rate-limit-policy problem, not by spoofing a User-Agent.

## Architecture

Single PowerShell script plus a launcher shim. Zero runtime dependencies.

```
~/.claude/tools/claude-usage-tray/
  claude-usage-tray.ps1      # everything
  Start.vbs                  # launch with no console window
  tests/
    unit.tests.ps1           # pure-function tests
    fixtures/
      usage-2026-09-04.json  # real captured response
```

PowerShell is chosen over Python deliberately: WinForms `NotifyIcon` needs no
packaging, and .NET validates TLS against the **Windows certificate store**
natively. The Python reference needs the `truststore` library purely to get
that behaviour, which matters behind a corporate proxy injecting roots via
group policy.

### Module boundaries (within the one file)

| Section | Responsibility | Depends on |
|---|---|---|
| Credentials | Read token + `expiresAt`. Never writes. | filesystem |
| Freshness | `expiresAt` -> is the token usable now? | nothing (pure) |
| Fetch | HTTP, timeouts, size cap, status taxonomy | Credentials, Freshness |
| Parse | Response -> normalized bucket list | nothing (pure) |
| Render | Icon bitmap, tooltip, detail panel | Parse output |
| Schedule | Poll timer, jitter, backoff state | Fetch |

Everything in Freshness and Parse is pure and dot-sourceable, which is where
the entire test suite lives. Render and Fetch stay thin.

### Constants

| Constant | Value | Rationale |
|---|---|---|
| `$Version` | script constant, e.g. `0.1.0` | Sole source for the User-Agent suffix |
| `$RequestTimeoutSec` | `5` | Matches Claude Code's own timeout for this call |
| `$PollMs` | `300000` (5 min) | Plus 0–60s jitter |
| `$RefreshFloorSec` | `60` | Minimum gap between click-triggered fetches |
| `$AuthBackoffSec` | `300` | Pause after a 401 so it cannot escalate to 429 |
| `$MaxBackoffSec` | `3600` | Ceiling on a hostile or malformed `Retry-After` |
| `$MaxResponseBytes` | `1048576` | Real response ~600 bytes |
| `$SkewSeconds` | `60` | Clock-skew margin on `expiresAt` |
| `$LogFile` | `%LOCALAPPDATA%\claude-usage-tray\tray.log` | Outside the repo and outside `~/.claude` |

The log records fetch outcomes, backoff decisions, and exception *types*. It
never records the token, response bodies, or raw exception records.

## Bucket discovery — the core algorithm

**Requirement: no model name and no bucket key is ever hardcoded.**

The response schema is versioned server-side and changes without notice. The
captured 2026-09-04 response carries `seven_day_sonnet: null` and
`seven_day_opus: null` — fields a 2025-era tool would have keyed on — while
carrying a live bucket under the codename `nimbus_quill` and the only
`is_active: true` limit inside the `limits[]` array as a model-scoped entry.

Normalization proceeds in three passes.

**1. Top-level buckets.** Every key whose value is an object with a non-null
`utilization` becomes a bucket. Covers `five_hour`, `seven_day`, and any
codenamed bucket the server lights up.

**2. Scoped limits from `limits[]`.** Newer responses carry per-model limits
*only* here, as entries with `scope.model.display_name`. To name one we need a
period prefix, derived from the response rather than assumed:

- Build a `resets_at -> top-level field name` map from pass 1.
- For each **non-scoped** entry in `limits[]`, map its `group` to the
  top-level field sharing its `resets_at`. So `group: "weekly"` resolves to
  prefix `seven_day`.
- A scoped entry then becomes `<prefix>_<slug(display_name)>` — a weekly limit
  scoped to Fable becomes `seven_day_fable`.

> **Implementation hazard.** The prefix must be resolved from the *non-scoped*
> entry of the same `group`, never from the scoped entry's own `resets_at`. In
> the captured response the weekly group's non-scoped `resets_at` ends
> `.611573` (matching top-level `seven_day`) while the scoped entry ends
> `.611848`. Matching on the scoped entry's own timestamp finds nothing.

Never overwrite a top-level field that already exists — it carries
higher-precision data.

**3. Spend.** The `spend` and `extra_usage` blocks normalize into a separate
credits record: used, limit, currency (from `currency` and `decimal_places`,
never assumed USD), percent, severity.

### Utilization scale detection

`utilization` may arrive as 0–1 or 0–100. The naive per-value rule "if > 1,
divide by 100" is wrong: it breaks at exactly `1.0`, rendering a true 1%
reading as 100%.

Scan **all** utilization values in the response; if any exceeds 1, treat the
entire response as 0–100. Then clamp each to `[0,1]` so a glitched response
cannot paint a 200% bar.

### Display selection

- **Icon:** highest utilization among buckets that are `is_active` or
  non-zero. Colour thresholds green < 60, amber 60–84, red >= 85. Red is also
  forced when credits are exhausted. **Empty state:** when every bucket is
  zero and none is active, show `0` on green — not an error state. When no
  fetch has ever succeeded, show a distinct grey `?` glyph.
- **Tooltip:** compact — `NotifyIcon.Text` has a hard 63-character cap.
- **Panel:** the main list holds every bucket with `utilization > 0` **or**
  `is_active: true`, each with its reset time both relative and absolute;
  then the credits line; then `last fetched HH:mm`. Buckets excluded by that
  rule — present in the response but at 0% and inactive — are named together
  on one dimmed "idle" line, so they neither vanish nor compete with live
  numbers.

## Refresh policy and failure handling

Poll every 5 minutes plus 0–60s jitter. Refresh on click, floored at 60s since
last fetch. Never poll faster.

The state machine follows one rule: **repeated 401s cause the API to escalate
to 429 with a lockout, so never retry blindly.**

| Condition | Action | User sees |
|---|---|---|
| No credentials file | Skip fetch | "Claude Code not signed in" |
| `expiresAt` past, +60s skew | **Skip fetch entirely** | Last-known values, badged "auth expired — open Claude Code" |
| `401` | Back off 300s | Last-known values, badged "token rejected" |
| `429` | Back off `Retry-After`, clamped to `[0, 3600]`, +30s | Last-known values, badged with resume time |
| `5xx` / timeout / DNS | Keep interval | Last-known values, badged stale |
| TLS failure | Keep interval | "certificate error" — distinct, signals proxy/MITM |
| Response > 1 MB | Abort parse | Stale badge |

The pre-flight expiry skip is what makes the tool self-healing: after an
overnight gap the token is dead, we make no doomed calls, and the next poll
after any Claude Code launch picks up the rotated token automatically.

**Staleness is never hidden.** Every displayed number carries its fetch time.
The failure mode this design refuses is a confident stale number.

## Security constraints

1. `.credentials.json` is opened read-only. No code path writes it.
2. On credential parse failure, log **only the exception type** — an error
   record can embed fragments of the file being parsed, i.e. the token.
3. The token appears only in an `Authorization` header. Never logged, never in
   the panel, never in an error message.
4. Single network destination: `api.anthropic.com`. No other host, ever.
5. `Bitmap.GetHicon()` leaks a GDI handle; every generated icon must be freed
   via a `DestroyIcon` P/Invoke after the swap. At 5-minute polling an unfreed
   handle leaks ~288/day in a process intended to run for weeks.
6. Response body capped at 1 MB before `ConvertFrom-Json` (real response is
   ~600 bytes).

## Testing

Tests come first, against `fixtures/usage-2026-09-04.json` — the real captured
response, which is a usefully awkward case: two null legacy model fields, a
zero-valued codenamed bucket, an active scoped limit whose timestamp differs
from its group's, and a spend block at over 100%.

Pure-function coverage:

- `ConvertTo-ExpiryUtc` — epoch **seconds vs milliseconds**, numeric string,
  zero, negative, absent, garbage.
- `Test-TokenExpired` — fresh, expired, inside the 60s skew, and unknown
  expiry (must return "not expired" and let the 401 backstop handle it).
- Scale detection — a response whose maximum is exactly `1.0` must be read as
  0–1, not 0–100. This is the regression test for the reference bug.
- Bucket discovery — from the fixture, must yield `five_hour` 88%,
  `seven_day` 61%, and **`seven_day_fable` 100% flagged active**. Must not
  emit `seven_day_sonnet`. Must survive `limits[]` absent, empty, or holding a
  scoped entry whose group has no non-scoped sibling.
- Clamping — utilization 150 -> 1.0; -5 -> 0.0.
- `Retry-After` parsing — valid, absent, negative, `"abc"`, `999999`.
- Spend normalization — `amount_minor` 5009 with `exponent` 2 and `CAD`
  renders `$50.09 CAD`, not `$5009`.

Manual verification: launch, confirm the icon reflects the live account,
confirm the panel names the Fable bucket, force staleness by pointing at an
edited fixture copy, and confirm no GDI handle growth over an hour via
`Get-Process`.

## Prior art

Reviewed as reference. Neither installed nor vendored.

- **`jens-duttke/usage-monitor-for-claude`** (272 stars, MIT, Python) — source
  of the scoped-limit merge strategy and the header set. Rejected as a
  dependency for its `claude update` auto-invoke.
- **`apexlocal-jz/claude-usage-tray`** (7 stars, MIT, PowerShell) — source of
  the WinForms structure, the `DestroyIcon` fix, the 401->429 escalation
  insight, and the scale-detection bug. Its own bucket handling is hardcoded
  to `five_hour`/`seven_day`/`seven_day_sonnet` and would tell this account
  nothing about Fable or credits.
- **`aqua5230/usage`** (307 stars) and several others estimate from local
  JSONL logs — a different and weaker number. Rejected.

No official Anthropic API covers subscription rate limits; the published Rate
Limits and Usage/Cost APIs serve API-key consumers only. `/api/oauth/usage` is
undocumented and may change without notice — which is precisely why bucket
discovery is schema-driven rather than keyed on names.

## Appendix: captured response (2026-09-04, abridged)

```json
{
  "five_hour": { "utilization": 88, "resets_at": "2026-09-04T15:59:59.611544+00:00" },
  "seven_day": { "utilization": 61, "resets_at": "2026-09-04T15:59:59.611573+00:00" },
  "seven_day_opus": null,
  "seven_day_sonnet": null,
  "seven_day_cowork": null,
  "nimbus_quill": { "utilization": 0, "resets_at": null },
  "tangelo": null,
  "extra_usage": {
    "is_enabled": true, "monthly_limit": 5000, "used_credits": 5009,
    "utilization": 100, "currency": "CAD", "decimal_places": 2,
    "spend_limit_reached": false
  },
  "limits": [
    { "kind": "session", "group": "session", "percent": 88,
      "severity": "warning", "resets_at": "2026-09-04T15:59:59.611544+00:00",
      "scope": null, "is_active": false },
    { "kind": "weekly_all", "group": "weekly", "percent": 61,
      "severity": "normal", "resets_at": "2026-09-04T15:59:59.611573+00:00",
      "scope": null, "is_active": false },
    { "kind": "weekly_scoped", "group": "weekly", "percent": 100,
      "severity": "critical", "resets_at": "2026-09-04T15:59:59.611848+00:00",
      "scope": { "model": { "id": null, "display_name": "Fable" } },
      "is_active": true }
  ],
  "spend": {
    "used":  { "amount_minor": 5009, "currency": "CAD", "exponent": 2 },
    "limit": { "amount_minor": 5000, "currency": "CAD", "exponent": 2 },
    "percent": 100, "severity": "critical", "enabled": true
  },
  "member_dashboard_available": false
}
```
