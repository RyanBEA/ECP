# Claude Usage Tray Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Windows system-tray icon that shows live Claude Code subscription rate-limit state and, on click, a panel listing every active limit with reset times.

**Architecture:** A PowerShell 7 entry script wires a WinForms `NotifyIcon` to a poll timer. All response normalization lives in a pure, dot-sourceable library file with no I/O, which is where every test runs. A second library owns credentials and HTTP; a third owns rendering. The tool reads `~/.claude/.credentials.json` read-only and never refreshes tokens.

**Tech Stack:** PowerShell 7.6.5, .NET WinForms (`System.Windows.Forms`), `System.Drawing`, `HttpWebRequest`. Zero third-party dependencies at runtime or test time.

**Spec:** `docs/superpowers/specs/2026-09-04-claude-usage-tray-design.md`

## Global Constraints

Every task's requirements implicitly include these. Values copied verbatim from the spec.

- **Endpoint:** `GET https://api.anthropic.com/api/oauth/usage` — the only network destination, ever.
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`, `anthropic-beta: oauth-2025-04-20`, `User-Agent: claude-usage-tray/<version>`. No `anthropic-version`, no `x-app`. Never impersonate `claude-code/`.
- **Credentials are read-only.** No code path may write `.credentials.json`. `refreshToken` is never read.
- **No bucket key or model name is ever hardcoded.** Discovery is schema-driven.
- **Token never leaves an `Authorization` header** — never logged, never displayed, never in an error message.
- **Credential parse failures log the exception *type* only** — never the exception record.
- `$RequestTimeoutSec = 5`, `$PollMs = 300000`, jitter `0–60000` ms, `$RefreshFloorSec = 60`, `$AuthBackoffSec = 300`, `$MaxBackoffSec = 3600`, `$MaxResponseBytes = 1048576`, `$SkewSeconds = 60`.
- **Icon thresholds:** green < 60, amber 60–84, red >= 85. Red also forced when credits are exhausted.
- `NotifyIcon.Text` has a hard **63-character** cap.
- Every generated icon must be released via `DestroyIcon` after the swap.
- `$LogFile = %LOCALAPPDATA%\claude-usage-tray\tray.log`.
- **Platform:** Windows 10/11, PowerShell 7. Tests run under `pwsh`.
- **Git:** the tool lives inside the existing `~/.claude` repository. Never run
  `git init` in the tool directory. Every `git add` in this plan is written
  relative to the tool directory for readability — run them from
  `~/.claude/tools/claude-usage-tray`, or prefix paths with
  `tools/claude-usage-tray/` when running from `~/.claude`.

### Deviation from the spec, deliberate

The spec describes a single `.ps1`. This plan splits it into an entry script plus three library files. Reason: the spec requires the pure functions be dot-sourceable for tests, and dot-sourcing a file that also constructs a tray icon at load time would launch the UI during every test run. The split is what actually delivers the spec's stated testability. Task 8 updates the spec's Architecture section to match.

### File structure

```
~/.claude/tools/claude-usage-tray/
  claude-usage-tray.ps1          # entry: wiring, timer, tray lifecycle
  lib/Usage.Parse.ps1            # PURE. Response -> buckets + spend. No I/O.
  lib/Usage.Api.ps1              # credentials read, HTTP fetch, backoff state
  lib/Usage.Render.ps1           # icon bitmap, tooltip string, detail panel
  tests/TestHarness.ps1          # ~40-line zero-dependency assertion harness
  tests/Usage.Parse.Tests.ps1    # all pure-function tests
  tests/fixtures/usage-2026-09-04.json
  Start.vbs                      # launch with no console window
  README.md
```

`Usage.Parse.ps1` must contain **no** `Invoke-*`, no file reads, and no WinForms types. That is what makes it testable and is checked in Task 8.

### Why a hand-rolled test harness

The machine has only Pester 3.4.0 — the version bundled with Windows PowerShell 5.1. Its assertion syntax (`Should Be`) is incompatible with Pester 5 (`Should -Be`), and it does not properly target PowerShell 7. Requiring `Install-Module Pester -Scope CurrentUser` would add a network-dependent setup step and a second syntax to get right. A 40-line harness that prints pass/fail and exits with the failure count is sufficient for pure-function tests and matches the project's zero-dependency posture.

---

### Task 1: Scaffold, test harness, and fixture

**Files:**
- Create: `~/.claude/tools/claude-usage-tray/tests/TestHarness.ps1`
- Create: `~/.claude/tools/claude-usage-tray/tests/fixtures/usage-2026-09-04.json`
- Create: `~/.claude/tools/claude-usage-tray/tests/Usage.Parse.Tests.ps1`
- Create: `~/.claude/tools/claude-usage-tray/lib/Usage.Parse.ps1`

**Interfaces:**
- Consumes: nothing.
- Produces: `Assert-Equal`, `Assert-True`, `Assert-Null`, `Assert-Near` (all `[void]`, taking `-Name [string]`); `Get-TestFixture([string]$Name)` returning a `PSCustomObject`; `Invoke-TestSummary` returning `[int]` failure count. Test file is run as `pwsh -File tests/Usage.Parse.Tests.ps1`.

- [ ] **Step 1: Create the directory tree**

```bash
mkdir -p ~/.claude/tools/claude-usage-tray/lib
mkdir -p ~/.claude/tools/claude-usage-tray/tests/fixtures
```

- [ ] **Step 2: Write the test harness**

Create `tests/TestHarness.ps1`:

```powershell
# Zero-dependency assertion harness. Pester 3.4 (the only version present)
# uses incompatible syntax and does not target PowerShell 7.
$script:TestTotal    = 0
$script:TestFailures = 0

function Assert-Equal {
    param($Expected, $Actual, [Parameter(Mandatory)][string]$Name)
    $script:TestTotal++
    $ok = if ($null -eq $Expected) { $null -eq $Actual } else { $Expected -eq $Actual }
    if ($ok) {
        Write-Host "  PASS  $Name" -ForegroundColor Green
    } else {
        $script:TestFailures++
        Write-Host "  FAIL  $Name" -ForegroundColor Red
        Write-Host "        expected: <$Expected>" -ForegroundColor Red
        Write-Host "        actual:   <$Actual>"   -ForegroundColor Red
    }
}

function Assert-Near {
    param([double]$Expected, $Actual, [Parameter(Mandatory)][string]$Name, [double]$Tolerance = 0.0001)
    $script:TestTotal++
    if ($null -ne $Actual -and [math]::Abs([double]$Actual - $Expected) -le $Tolerance) {
        Write-Host "  PASS  $Name" -ForegroundColor Green
    } else {
        $script:TestFailures++
        Write-Host "  FAIL  $Name (expected ~$Expected, got <$Actual>)" -ForegroundColor Red
    }
}

function Assert-True {
    param($Condition, [Parameter(Mandatory)][string]$Name)
    Assert-Equal -Expected $true -Actual ([bool]$Condition) -Name $Name
}

function Assert-Null {
    param($Value, [Parameter(Mandatory)][string]$Name)
    Assert-Equal -Expected $null -Actual $Value -Name $Name
}

function Get-TestFixture {
    param([Parameter(Mandatory)][string]$Name)
    $path = Join-Path $PSScriptRoot "fixtures/$Name"
    return (Get-Content $path -Raw | ConvertFrom-Json)
}

function Invoke-TestSummary {
    Write-Host ""
    if ($script:TestFailures -eq 0) {
        Write-Host "$script:TestTotal passed, 0 failed" -ForegroundColor Green
    } else {
        Write-Host "$script:TestTotal run, $script:TestFailures FAILED" -ForegroundColor Red
    }
    return $script:TestFailures
}
```

- [ ] **Step 3: Write the fixture**

Create `tests/fixtures/usage-2026-09-04.json`. This is the real captured response. Do not simplify it — every awkward property in it is load-bearing for a later test.

```json
{
  "five_hour": { "utilization": 88, "resets_at": "2026-09-04T15:59:59.611544+00:00" },
  "seven_day": { "utilization": 61, "resets_at": "2026-09-04T15:59:59.611573+00:00" },
  "seven_day_oauth_apps": null,
  "seven_day_opus": null,
  "seven_day_sonnet": null,
  "seven_day_cowork": null,
  "nimbus_quill": { "utilization": 0, "resets_at": null },
  "tangelo": null,
  "iguana_necktie": null,
  "extra_usage": {
    "is_enabled": true, "monthly_limit": 5000, "used_credits": 5009,
    "utilization": 100, "currency": "CAD", "decimal_places": 2,
    "disabled_reason": null, "user_disabled": false, "spend_limit_reached": false
  },
  "limits": [
    { "kind": "session", "group": "session", "percent": 88, "severity": "warning",
      "resets_at": "2026-09-04T15:59:59.611544+00:00", "scope": null, "is_active": false },
    { "kind": "weekly_all", "group": "weekly", "percent": 61, "severity": "normal",
      "resets_at": "2026-09-04T15:59:59.611573+00:00", "scope": null, "is_active": false },
    { "kind": "weekly_scoped", "group": "weekly", "percent": 100, "severity": "critical",
      "resets_at": "2026-09-04T15:59:59.611848+00:00",
      "scope": { "model": { "id": null, "display_name": "Fable" }, "surface": null },
      "is_active": true }
  ],
  "spend": {
    "used":  { "amount_minor": 5009, "currency": "CAD", "exponent": 2 },
    "limit": { "amount_minor": 5000, "currency": "CAD", "exponent": 2 },
    "percent": 100, "severity": "critical", "enabled": true,
    "can_purchase_credits": false, "can_toggle": false
  },
  "member_dashboard_available": false
}
```

- [ ] **Step 4: Write the failing smoke test**

Create `tests/Usage.Parse.Tests.ps1`:

```powershell
# Without this, a missing dot-source file or unknown command is a
# NON-terminating error: the script keeps running, the summary reports the
# already-passing asserts, and the red phase exits 0. Verified on PS 7.6.5.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/TestHarness.ps1"
. "$PSScriptRoot/../lib/Usage.Parse.ps1"

Write-Host "`nFixture" -ForegroundColor Cyan
$fx = Get-TestFixture 'usage-2026-09-04.json'
Assert-Equal -Expected 88 -Actual $fx.five_hour.utilization -Name 'fixture loads, five_hour is 88'
Assert-Equal -Expected 3  -Actual $fx.limits.Count          -Name 'fixture has 3 limits entries'
Assert-Null  -Value $fx.seven_day_sonnet                    -Name 'fixture seven_day_sonnet is null'

exit (Invoke-TestSummary)
```

- [ ] **Step 5: Run it to verify it fails**

Run: `pwsh -File ~/.claude/tools/claude-usage-tray/tests/Usage.Parse.Tests.ps1`
Expected: FAIL — `lib/Usage.Parse.ps1` does not exist, so dot-sourcing errors out.

- [ ] **Step 6: Create the empty library file**

Create `lib/Usage.Parse.ps1` with only its contract header:

```powershell
# Usage.Parse.ps1 - PURE response normalization. No I/O, no WinForms, no network.
# Dot-sourced by both the tray entry script and the test suite.
Set-StrictMode -Version Latest
```

- [ ] **Step 7: Run it to verify it passes**

Run: `pwsh -File ~/.claude/tools/claude-usage-tray/tests/Usage.Parse.Tests.ps1`
Expected: PASS — `3 passed, 0 failed`, exit code 0.

- [ ] **Step 8: Commit**

`~/.claude` is **already a git repository** — do not run `git init` here, it
would nest a repo inside it. Commit into the existing `~/.claude` repo, and
use paths relative to it for every commit in this plan.

```bash
cd ~/.claude
git add tools/claude-usage-tray/tests tools/claude-usage-tray/lib
git commit -m "test: add zero-dep harness and real usage response fixture"
```

---

### Task 2: Token freshness

**Files:**
- Modify: `lib/Usage.Parse.ps1`
- Modify: `tests/Usage.Parse.Tests.ps1`

**Interfaces:**
- Consumes: harness from Task 1.
- Produces: `ConvertTo-ExpiryUtc($RawExpiresAt)` -> `[DateTime]` (UTC) or `$null`. `Test-TokenExpired($ExpiresAtUtc, [DateTime]$NowUtc, [int]$SkewSeconds)` -> `[bool]`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/Usage.Parse.Tests.ps1`, above the final `exit` line:

```powershell
Write-Host "`nConvertTo-ExpiryUtc" -ForegroundColor Cyan
# 1788534079 s == 2026-09-04T15:01:19Z ; the ms form is the same instant.
Assert-Equal -Expected '2026-09-04T15:01:19Z' `
    -Actual (ConvertTo-ExpiryUtc 1788534079).ToString('yyyy-MM-ddTHH:mm:ssZ') `
    -Name 'epoch seconds'
Assert-Equal -Expected '2026-09-04T15:01:19Z' `
    -Actual (ConvertTo-ExpiryUtc 1788534079457).ToString('yyyy-MM-ddTHH:mm:ssZ') `
    -Name 'epoch milliseconds'
Assert-Equal -Expected '2026-09-04T15:01:19Z' `
    -Actual (ConvertTo-ExpiryUtc '1788534079').ToString('yyyy-MM-ddTHH:mm:ssZ') `
    -Name 'numeric string'
Assert-Null -Value (ConvertTo-ExpiryUtc $null)   -Name 'null returns null'
Assert-Null -Value (ConvertTo-ExpiryUtc 0)       -Name 'zero returns null'
Assert-Null -Value (ConvertTo-ExpiryUtc -5)      -Name 'negative returns null'
Assert-Null -Value (ConvertTo-ExpiryUtc 'abc')   -Name 'garbage returns null'
Assert-Null -Value (ConvertTo-ExpiryUtc '')      -Name 'empty string returns null'

Write-Host "`nTest-TokenExpired" -ForegroundColor Cyan
$now = [DateTime]::SpecifyKind([DateTime]::Parse('2026-09-04T12:00:00'), 'Utc')
Assert-Equal -Expected $false -Actual (Test-TokenExpired $now.AddHours(1) $now)      -Name 'fresh token not expired'
Assert-Equal -Expected $true  -Actual (Test-TokenExpired $now.AddHours(-1) $now)     -Name 'past expiry is expired'
Assert-Equal -Expected $true  -Actual (Test-TokenExpired $now.AddSeconds(30) $now)   -Name 'inside 60s skew counts as expired'
Assert-Equal -Expected $false -Actual (Test-TokenExpired $now.AddSeconds(90) $now)   -Name 'outside 60s skew is fresh'
Assert-Equal -Expected $false -Actual (Test-TokenExpired $null $now)                 -Name 'unknown expiry is NOT expired (401 backstop handles it)'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pwsh -File ~/.claude/tools/claude-usage-tray/tests/Usage.Parse.Tests.ps1`
Expected: FAIL — `ConvertTo-ExpiryUtc` is not recognized as a cmdlet.

- [ ] **Step 3: Implement**

Append to `lib/Usage.Parse.ps1`:

```powershell
function ConvertTo-ExpiryUtc {
    # Accepts the raw expiresAt from .credentials.json: epoch seconds or
    # milliseconds, as number or numeric string. Returns UTC [DateTime] or $null.
    param($RawExpiresAt)
    if ($null -eq $RawExpiresAt) { return $null }
    $n = 0.0
    if (-not [double]::TryParse([string]$RawExpiresAt, [ref]$n)) { return $null }
    if ($n -le 0) { return $null }
    try {
        # Anything past ~1e12 is milliseconds; epoch seconds will not reach
        # that until the year 33658.
        if ($n -gt 1e12) {
            return [DateTimeOffset]::FromUnixTimeMilliseconds([int64]$n).UtcDateTime
        }
        return [DateTimeOffset]::FromUnixTimeSeconds([int64]$n).UtcDateTime
    } catch { return $null }
}

function Test-TokenExpired {
    # $true when the token is expired, or so near expiry that sending it risks
    # a 401. $false when safely fresh OR when expiry is unknown - in that case
    # we let the request proceed and rely on the 401 backstop.
    param(
        $ExpiresAtUtc,
        [DateTime] $NowUtc = ([DateTime]::UtcNow),
        [int] $SkewSeconds = 60
    )
    if ($null -eq $ExpiresAtUtc) { return $false }
    return ([DateTime]$NowUtc) -ge ([DateTime]$ExpiresAtUtc).AddSeconds(-$SkewSeconds)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pwsh -File ~/.claude/tools/claude-usage-tray/tests/Usage.Parse.Tests.ps1`
Expected: PASS — 16 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add lib/Usage.Parse.ps1 tests/Usage.Parse.Tests.ps1
git commit -m "feat: token freshness with epoch s/ms handling and 60s skew"
```

---

### Task 3: Scale detection, clamping, and reset parsing

**Files:**
- Modify: `lib/Usage.Parse.ps1`
- Modify: `tests/Usage.Parse.Tests.ps1`

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: `Get-UtilizationNodes($Response)` -> properties whose value has a non-null `utilization`. `Get-UtilizationDivisor($Response)` -> `[double]` 1.0 or 100.0. `ConvertTo-ResetUtc($Raw)` -> `[DateTime]` UTC or `$null`. `ConvertTo-Limit($Node, [double]$Divisor)` -> hashtable `@{ Util=<0..1 double>; ResetsAt=<DateTime or null> }` or `$null`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/Usage.Parse.Tests.ps1`, above the final `exit`:

```powershell
Write-Host "`nGet-UtilizationDivisor" -ForegroundColor Cyan
$fx = Get-TestFixture 'usage-2026-09-04.json'
Assert-Equal -Expected 100.0 -Actual (Get-UtilizationDivisor $fx) -Name 'fixture has values >1 so scale is 0-100'

# THE REGRESSION TEST. The naive rule "if >1 divide by 100" reads a max of
# exactly 1.0 as 100%, turning a true 1% reading into 100%.
$exactlyOne = '{ "five_hour": { "utilization": 1.0, "resets_at": null },
                 "seven_day": { "utilization": 0.5, "resets_at": null } }' | ConvertFrom-Json
Assert-Equal -Expected 1.0 -Actual (Get-UtilizationDivisor $exactlyOne) `
    -Name 'max of exactly 1.0 is treated as 0-1 scale, NOT 0-100'
Assert-Near -Expected 1.0 -Actual (ConvertTo-Limit $exactlyOne.five_hour (Get-UtilizationDivisor $exactlyOne)).Util `
    -Name 'utilization 1.0 on a 0-1 response means 100%'

$allZero = '{ "five_hour": { "utilization": 0, "resets_at": null } }' | ConvertFrom-Json
Assert-Equal -Expected 1.0 -Actual (Get-UtilizationDivisor $allZero) -Name 'all-zero response defaults to 0-1 scale'

Write-Host "`nConvertTo-Limit clamping" -ForegroundColor Cyan
$over  = '{ "utilization": 150, "resets_at": null }' | ConvertFrom-Json
$under = '{ "utilization": -5,  "resets_at": null }' | ConvertFrom-Json
Assert-Near -Expected 1.0 -Actual (ConvertTo-Limit $over  100.0).Util -Name 'utilization 150 clamps to 1.0'
Assert-Near -Expected 0.0 -Actual (ConvertTo-Limit $under 100.0).Util -Name 'utilization -5 clamps to 0.0'
Assert-Near -Expected 0.88 -Actual (ConvertTo-Limit $fx.five_hour 100.0).Util -Name 'five_hour 88 becomes 0.88'
Assert-Null -Value (ConvertTo-Limit $null 100.0)              -Name 'null node returns null'
Assert-Null -Value (ConvertTo-Limit $fx.seven_day_sonnet 100.0) -Name 'null seven_day_sonnet returns null'

Write-Host "`nConvertTo-ResetUtc" -ForegroundColor Cyan
Assert-Equal -Expected '2026-09-04T15:59:59Z' `
    -Actual (ConvertTo-ResetUtc '2026-09-04T15:59:59.611544+00:00').ToString('yyyy-MM-ddTHH:mm:ssZ') `
    -Name 'ISO8601 with microseconds and offset'
Assert-Equal -Expected '2026-09-04T15:01:19Z' `
    -Actual (ConvertTo-ResetUtc 1788534079).ToString('yyyy-MM-ddTHH:mm:ssZ') `
    -Name 'epoch seconds reset'
Assert-Null -Value (ConvertTo-ResetUtc $null)  -Name 'null reset returns null'
Assert-Null -Value (ConvertTo-ResetUtc 'nope') -Name 'garbage reset returns null'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pwsh -File ~/.claude/tools/claude-usage-tray/tests/Usage.Parse.Tests.ps1`
Expected: FAIL — `Get-UtilizationDivisor` not recognized.

- [ ] **Step 3: Implement**

Append to `lib/Usage.Parse.ps1`:

```powershell
# Keys that carry a 'utilization' but are not rate-limit buckets. Excluded
# from BOTH bucket discovery and scale detection - if buckets ever arrive 0-1
# while extra_usage stays 0-100, including it would divide every bucket by 100.
$script:NonBucketKeys = @('extra_usage')

function Get-Prop {
    # Safe property read for server-supplied JSON. Under Set-StrictMode Latest,
    # `$obj.missing` THROWS PropertyNotFoundException - and the server dropping
    # fields is this tool's stated threat model. The PSObject.Properties
    # indexer returns $null for a missing name and is also safe on scalars
    # (bool/number/string), where `.Properties.Name -contains` throws.
    param($Obj, [Parameter(Mandatory)][string]$Name)
    if ($null -eq $Obj) { return $null }
    $p = $Obj.PSObject.Properties[$Name]
    if ($null -eq $p) { return $null }
    return $p.Value
}

function Get-UtilizationNodes {
    # Every top-level property whose value is an object carrying a non-null
    # 'utilization'. This is how buckets are discovered without naming them:
    # the server adds and retires bucket keys without notice.
    param($Response)
    if ($null -eq $Response) { return ,@() }
    $nodes = @($Response.PSObject.Properties | Where-Object {
        $null -ne (Get-Prop $_.Value 'utilization')
    })
    return ,$nodes
}

function Get-UtilizationDivisor {
    # 'utilization' may arrive as 0-1 or 0-100. Deciding per value is wrong:
    # a max of exactly 1.0 is ambiguous, and the naive "if >1 divide by 100"
    # rule renders a true 1% reading as 100%. Decide once for the whole
    # response - if ANY bucket value exceeds 1, the response is 0-100.
    param($Response)
    foreach ($p in (Get-UtilizationNodes $Response)) {
        if ($script:NonBucketKeys -contains $p.Name) { continue }
        if ([double](Get-Prop $p.Value 'utilization') -gt 1.0) { return 100.0 }
    }
    return 1.0
}

function ConvertTo-ResetUtc {
    # resets_at is an ISO8601 string in current responses, but accept epoch
    # numbers too rather than trusting one shape.
    param($Raw)
    if ($null -eq $Raw) { return $null }
    if ($Raw -is [int] -or $Raw -is [int64] -or $Raw -is [double]) {
        if ([double]$Raw -le 0) { return $null }
        try { return [DateTimeOffset]::FromUnixTimeSeconds([int64]$Raw).UtcDateTime } catch { return $null }
    }
    $s = [string]$Raw
    if ([string]::IsNullOrWhiteSpace($s)) { return $null }
    try { return ([DateTimeOffset]::Parse($s)).UtcDateTime } catch { return $null }
}

function ConvertTo-Limit {
    # Normalize one bucket node to a 0..1 fraction plus a UTC reset time.
    param($Node, [double]$Divisor)
    $raw = Get-Prop $Node 'utilization'
    if ($null -eq $raw) { return $null }
    $u = [double]$raw / $Divisor
    # Clamp so a glitched response cannot paint a 200% bar.
    if ($u -gt 1.0) { $u = 1.0 }
    if ($u -lt 0.0) { $u = 0.0 }
    return @{ Util = $u; ResetsAt = (ConvertTo-ResetUtc (Get-Prop $Node 'resets_at')) }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pwsh -File ~/.claude/tools/claude-usage-tray/tests/Usage.Parse.Tests.ps1`
Expected: PASS — 29 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add lib/Usage.Parse.ps1 tests/Usage.Parse.Tests.ps1
git commit -m "feat: response-wide scale detection, clamping, reset parsing"
```

---

### Task 4: Bucket discovery, including model-scoped limits

This is the core of the tool. Everything else is plumbing around it.

**Files:**
- Modify: `lib/Usage.Parse.ps1`
- Modify: `tests/Usage.Parse.Tests.ps1`

**Interfaces:**
- Consumes: `Get-UtilizationNodes`, `Get-UtilizationDivisor`, `ConvertTo-Limit`, `ConvertTo-ResetUtc` from Task 3.
- Produces: `ConvertTo-ModelSlug([string]$DisplayName)` -> `[string]`. `Get-UsageBuckets($Response)` -> ordered array of hashtables `@{ Key=[string]; Label=[string]; Util=[double 0..1]; ResetsAt=[DateTime|null]; IsActive=[bool]; Severity=[string|null] }`, sorted by `Util` descending.

- [ ] **Step 1: Write the failing tests**

Append to `tests/Usage.Parse.Tests.ps1`, above the final `exit`:

```powershell
Write-Host "`nConvertTo-ModelSlug" -ForegroundColor Cyan
Assert-Equal -Expected 'fable'        -Actual (ConvertTo-ModelSlug 'Fable')        -Name 'Fable -> fable'
Assert-Equal -Expected 'claude_opus_5' -Actual (ConvertTo-ModelSlug 'Claude Opus 5') -Name 'spaces become underscores'
Assert-Equal -Expected 'opus_4_8'     -Actual (ConvertTo-ModelSlug 'Opus 4.8')     -Name 'punctuation becomes a separator'

Write-Host "`nGet-UsageBuckets" -ForegroundColor Cyan
$fx = Get-TestFixture 'usage-2026-09-04.json'
$buckets = Get-UsageBuckets $fx
$byKey = @{}; foreach ($b in $buckets) { $byKey[$b.Key] = $b }

Assert-Near  -Expected 0.88 -Actual $byKey['five_hour'].Util -Name 'five_hour is 0.88'
Assert-Near  -Expected 0.61 -Actual $byKey['seven_day'].Util -Name 'seven_day is 0.61'

# The whole point. The scoped Fable limit exists ONLY inside limits[].
Assert-True  -Condition $byKey.ContainsKey('seven_day_fable') `
    -Name 'scoped Fable limit is discovered and named seven_day_fable'
Assert-Near  -Expected 1.0   -Actual $byKey['seven_day_fable'].Util     -Name 'Fable bucket is 100%'
Assert-Equal -Expected $true -Actual $byKey['seven_day_fable'].IsActive -Name 'Fable bucket is flagged active'
Assert-Equal -Expected 'critical' -Actual $byKey['seven_day_fable'].Severity -Name 'Fable severity is critical'

# Legacy fields are null in this response and must not appear.
Assert-Equal -Expected $false -Actual $byKey.ContainsKey('seven_day_sonnet') -Name 'null seven_day_sonnet is not emitted'
Assert-Equal -Expected $false -Actual $byKey.ContainsKey('seven_day_opus')   -Name 'null seven_day_opus is not emitted'
# extra_usage carries a utilization but is spend, not a rate-limit bucket.
Assert-Equal -Expected $false -Actual $byKey.ContainsKey('extra_usage')      -Name 'extra_usage is excluded from buckets'
# A zero-valued codenamed bucket is still discovered (Task 7 dims it).
Assert-True  -Condition $byKey.ContainsKey('nimbus_quill') -Name 'zero-valued codenamed bucket is still discovered'

Assert-Equal -Expected 'seven_day_fable' -Actual $buckets[0].Key -Name 'buckets are sorted by utilization descending'

Write-Host "`nGet-UsageBuckets - degenerate responses" -ForegroundColor Cyan
# Every call site wraps in @(...). PowerShell unrolls a returned array on
# output: a one-bucket result would otherwise arrive as a bare hashtable
# (.Count = its key count, 6) and an empty result as AutomationNull, on which
# .Count THROWS under strict mode. Verified on PS 7.6.5.
$noLimits = '{ "five_hour": { "utilization": 5, "resets_at": null } }' | ConvertFrom-Json
Assert-Equal -Expected 1 -Actual @(Get-UsageBuckets $noLimits).Count -Name 'limits[] absent still yields top-level buckets'

$emptyLimits = '{ "five_hour": { "utilization": 5, "resets_at": null }, "limits": [] }' | ConvertFrom-Json
Assert-Equal -Expected 1 -Actual @(Get-UsageBuckets $emptyLimits).Count -Name 'limits[] empty is handled'

# A scoped entry whose group has no non-scoped sibling cannot have its period
# prefix derived, so it must be skipped rather than guessed at or crash.
$orphan = '{ "five_hour": { "utilization": 5, "resets_at": "2026-09-04T15:00:00+00:00" },
             "limits": [ { "kind": "weekly_scoped", "group": "weekly", "percent": 50,
                           "resets_at": "2026-09-04T16:00:00+00:00",
                           "scope": { "model": { "display_name": "Ghost" } },
                           "is_active": true } ] }' | ConvertFrom-Json
$orphanBuckets = @(Get-UsageBuckets $orphan)
Assert-Equal -Expected 1 -Actual $orphanBuckets.Count -Name 'orphan scoped limit with no derivable prefix is skipped'

Assert-Equal -Expected 0 -Actual @(Get-UsageBuckets ('{}' | ConvertFrom-Json)).Count -Name 'empty response yields no buckets'
Assert-Equal -Expected 0 -Actual @(Get-UsageBuckets $null).Count -Name 'null response yields no buckets'

# A limits[] entry missing fields must not crash the whole fetch under strict mode.
$sparse = '{ "five_hour": { "utilization": 5, "resets_at": null }, "limits": [ { "kind": "session" } ],
             "member_dashboard_available": false }' | ConvertFrom-Json
Assert-Equal -Expected 1 -Actual @(Get-UsageBuckets $sparse).Count -Name 'sparse limits entry and scalar top-level values do not throw'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pwsh -File ~/.claude/tools/claude-usage-tray/tests/Usage.Parse.Tests.ps1`
Expected: FAIL — `ConvertTo-ModelSlug` not recognized.

- [ ] **Step 3: Implement**

Append to `lib/Usage.Parse.ps1`:

```powershell
function ConvertTo-ModelSlug {
    # 'Fable' -> 'fable'; 'Claude Opus 5' -> 'claude_opus_5'
    param([Parameter(Mandatory)][string]$DisplayName)
    $chars = $DisplayName.ToLowerInvariant().ToCharArray() |
        ForEach-Object { if ([char]::IsLetterOrDigit($_)) { $_ } else { ' ' } }
    $cleaned = -join $chars
    return (($cleaned -split '\s+' | Where-Object { $_ }) -join '_')
}

function Get-PrettyBucketLabel {
    # Human label for a discovered key. Known periods get proper names; any
    # unknown key (including server codenames) is title-cased from its slug.
    param([Parameter(Mandatory)][string]$Key)
    switch ($Key) {
        'five_hour' { return 'Session (5h)' }
        'seven_day' { return 'Weekly (all)' }
        default {
            if ($Key -like 'seven_day_*') {
                $model = ($Key -replace '^seven_day_', '') -replace '_', ' '
                return "Weekly - $([System.Globalization.CultureInfo]::InvariantCulture.TextInfo.ToTitleCase($model))"
            }
            $words = ($Key -replace '_', ' ')
            return [System.Globalization.CultureInfo]::InvariantCulture.TextInfo.ToTitleCase($words)
        }
    }
}

function Get-UsageBuckets {
    <#
      Normalize a usage response into a sorted bucket list. No bucket key and
      no model name is hardcoded: the server versions this schema and changes
      it without notice. As of 2026-09-04 the legacy top-level per-model
      fields (seven_day_sonnet, seven_day_opus) are null and per-model limits
      appear ONLY inside limits[] as entries with scope.model.
    #>
    param($Response)
    if ($null -eq $Response) { return ,@() }

    $divisor = Get-UtilizationDivisor $Response
    $buckets = [ordered]@{}

    # --- Pass 1: top-level buckets ---
    foreach ($p in (Get-UtilizationNodes $Response)) {
        if ($script:NonBucketKeys -contains $p.Name) { continue }
        $lim = ConvertTo-Limit $p.Value $divisor
        if ($null -eq $lim) { continue }
        $buckets[$p.Name] = @{
            Key      = $p.Name
            Label    = (Get-PrettyBucketLabel $p.Name)
            Util     = $lim.Util
            ResetsAt = $lim.ResetsAt
            IsActive = $false
            Severity = $null
        }
    }

    # Every JSON field below is read via Get-Prop: the server dropping a field
    # is the threat model, and a bare `$l.field` throws under strict mode.
    $limits = @()
    $rawLimits = Get-Prop $Response 'limits'
    if ($null -ne $rawLimits) { $limits = @($rawLimits | Where-Object { $null -ne $_ }) }

    # --- resets_at -> existing top-level field name (the prefix source) ---
    $resetToField = @{}
    foreach ($key in @($buckets.Keys)) {
        $r = $buckets[$key].ResetsAt
        if ($null -ne $r) {
            $stamp = $r.ToString('o')
            if (-not $resetToField.ContainsKey($stamp)) { $resetToField[$stamp] = $key }
        }
    }

    # --- group -> period prefix, via the NON-scoped limit of that group ---
    # Must use the non-scoped sibling: in a real response the weekly group's
    # non-scoped resets_at matches top-level seven_day to the microsecond,
    # while the scoped entry's own timestamp differs. Matching on the scoped
    # entry's timestamp finds nothing.
    $groupPrefix = @{}
    foreach ($l in $limits) {
        if ($null -ne (Get-Prop $l 'scope')) { continue }
        $g = [string](Get-Prop $l 'group')
        $r = ConvertTo-ResetUtc (Get-Prop $l 'resets_at')
        if (-not $g -or $null -eq $r) { continue }
        $stamp = $r.ToString('o')
        if ($resetToField.ContainsKey($stamp) -and -not $groupPrefix.ContainsKey($g)) {
            $groupPrefix[$g] = $resetToField[$stamp]
        }
    }

    # --- Pass 2: model-scoped limits ---
    foreach ($l in $limits) {
        $display = Get-Prop (Get-Prop (Get-Prop $l 'scope') 'model') 'display_name'
        if ([string]::IsNullOrWhiteSpace([string]$display)) { continue }
        $g = [string](Get-Prop $l 'group')
        if (-not $groupPrefix.ContainsKey($g)) { continue }   # prefix not derivable - skip, never guess
        $key = '{0}_{1}' -f $groupPrefix[$g], (ConvertTo-ModelSlug ([string]$display))
        if ($buckets.Contains($key)) { continue }             # top-level data wins - higher precision

        # limits[].percent is always 0-100 by definition of the field name,
        # independent of the 'utilization' scale detected above.
        $u = [double]0
        $pct = Get-Prop $l 'percent'
        if ($null -ne $pct) { $u = [double]$pct / 100.0 }
        if ($u -gt 1.0) { $u = 1.0 }
        if ($u -lt 0.0) { $u = 0.0 }

        $buckets[$key] = @{
            Key      = $key
            Label    = (Get-PrettyBucketLabel $key)
            Util     = $u
            ResetsAt = (ConvertTo-ResetUtc (Get-Prop $l 'resets_at'))
            IsActive = [bool](Get-Prop $l 'is_active')
            Severity = [string](Get-Prop $l 'severity')
        }
    }

    # --- Flag top-level buckets active from their non-scoped limits entry ---
    foreach ($l in $limits) {
        if ($null -ne (Get-Prop $l 'scope')) { continue }
        $g = [string](Get-Prop $l 'group')
        if (-not $groupPrefix.ContainsKey($g)) { continue }
        $key = $groupPrefix[$g]
        if ($buckets.Contains($key)) {
            if ([bool](Get-Prop $l 'is_active')) { $buckets[$key].IsActive = $true }
            $sev = Get-Prop $l 'severity'
            if ($sev) { $buckets[$key].Severity = [string]$sev }
        }
    }

    # Leading comma prevents PowerShell unrolling the array on output, so a
    # one-bucket result is still an array and an empty one is @(), not
    # AutomationNull. Callers wrap in @(...) as well - belt and braces.
    $sorted = @($buckets.Values | Sort-Object -Property @{ Expression = { $_.Util }; Descending = $true })
    return ,$sorted
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pwsh -File ~/.claude/tools/claude-usage-tray/tests/Usage.Parse.Tests.ps1`
Expected: PASS — 49 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add lib/Usage.Parse.ps1 tests/Usage.Parse.Tests.ps1
git commit -m "feat: schema-driven bucket discovery incl. model-scoped limits"
```

---

### Task 5: Spend and credits normalization

**Files:**
- Modify: `lib/Usage.Parse.ps1`
- Modify: `tests/Usage.Parse.Tests.ps1`

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: `ConvertTo-Money($MoneyNode)` -> `@{ Amount=[double]; Currency=[string]; Text=[string] }` or `$null`. `Get-SpendInfo($Response)` -> `@{ Used=<money>; Limit=<money>; Percent=[double 0..1]; Severity=[string]; Exhausted=[bool]; Text=[string] }` or `$null` when spend is absent or disabled.

- [ ] **Step 1: Write the failing tests**

Append to `tests/Usage.Parse.Tests.ps1`, above the final `exit`:

```powershell
Write-Host "`nConvertTo-Money" -ForegroundColor Cyan
$fx = Get-TestFixture 'usage-2026-09-04.json'
# amount_minor 5009 with exponent 2 is $50.09 - NOT $5009. Getting this wrong
# overstates spend by 100x.
Assert-Near  -Expected 50.09     -Actual (ConvertTo-Money $fx.spend.used).Amount   -Name '5009 minor units with exponent 2 is 50.09'
Assert-Equal -Expected 'CAD'     -Actual (ConvertTo-Money $fx.spend.used).Currency -Name 'currency is read, not assumed USD'
Assert-Equal -Expected '50.09 CAD' -Actual (ConvertTo-Money $fx.spend.used).Text   -Name 'money renders as amount + currency'
Assert-Near  -Expected 50.00     -Actual (ConvertTo-Money $fx.spend.limit).Amount  -Name 'limit is 50.00'
Assert-Null  -Value (ConvertTo-Money $null) -Name 'null money node returns null'

$zeroExp = '{ "amount_minor": 7, "currency": "JPY", "exponent": 0 }' | ConvertFrom-Json
Assert-Near -Expected 7.0 -Actual (ConvertTo-Money $zeroExp).Amount -Name 'exponent 0 currency is not divided'

Write-Host "`nGet-SpendInfo" -ForegroundColor Cyan
$spend = Get-SpendInfo $fx
Assert-Near  -Expected 1.0        -Actual $spend.Percent   -Name 'spend percent 100 becomes 1.0'
Assert-Equal -Expected $true      -Actual $spend.Exhausted -Name 'used >= limit means exhausted'
Assert-Equal -Expected 'critical' -Actual $spend.Severity  -Name 'severity is carried through'
Assert-Equal -Expected '50.09 / 50.00 CAD' -Actual $spend.Text -Name 'spend text reads used / limit currency'

$disabled = '{ "spend": { "enabled": false } }' | ConvertFrom-Json
Assert-Null -Value (Get-SpendInfo $disabled) -Name 'disabled spend returns null'
Assert-Null -Value (Get-SpendInfo ('{}' | ConvertFrom-Json)) -Name 'absent spend returns null'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pwsh -File ~/.claude/tools/claude-usage-tray/tests/Usage.Parse.Tests.ps1`
Expected: FAIL — `ConvertTo-Money` not recognized.

- [ ] **Step 3: Implement**

Append to `lib/Usage.Parse.ps1`:

```powershell
function ConvertTo-Money {
    # The API sends money as minor units plus an exponent, with an explicit
    # currency. 5009 with exponent 2 is 50.09. Never assume USD or 2 decimals.
    param($MoneyNode)
    $minor = Get-Prop $MoneyNode 'amount_minor'
    if ($null -eq $minor) { return $null }
    $exp = 0
    $rawExp = Get-Prop $MoneyNode 'exponent'
    if ($null -ne $rawExp) { $exp = [int]$rawExp }
    $amount = [double]$minor / [math]::Pow(10, $exp)
    $cur = [string](Get-Prop $MoneyNode 'currency')
    return @{
        Amount   = $amount
        Currency = $cur
        Text     = ('{0} {1}' -f $amount.ToString("F$exp", [cultureinfo]::InvariantCulture), $cur)
    }
}

function Get-SpendInfo {
    # Extra-usage credits. Returns $null when spend is absent or disabled, so
    # callers can simply omit the line.
    param($Response)
    $s = Get-Prop $Response 'spend'
    if ($null -eq $s -or -not [bool](Get-Prop $s 'enabled')) { return $null }

    $used  = ConvertTo-Money (Get-Prop $s 'used')
    $limit = ConvertTo-Money (Get-Prop $s 'limit')
    if ($null -eq $used -or $null -eq $limit) { return $null }

    $pct = 0.0
    $rawPct = Get-Prop $s 'percent'
    if ($null -ne $rawPct) { $pct = [double]$rawPct / 100.0 }
    if ($pct -gt 1.0) { $pct = 1.0 }
    if ($pct -lt 0.0) { $pct = 0.0 }

    $exp = 0
    $rawExp = Get-Prop (Get-Prop $s 'used') 'exponent'
    if ($null -ne $rawExp) { $exp = [int]$rawExp }
    $inv = [cultureinfo]::InvariantCulture

    return @{
        Used      = $used
        Limit     = $limit
        Percent   = $pct
        Severity  = [string](Get-Prop $s 'severity')
        Exhausted = ($used.Amount -ge $limit.Amount)
        Text      = ('{0} / {1} {2}' -f $used.Amount.ToString("F$exp", $inv),
                                        $limit.Amount.ToString("F$exp", $inv),
                                        $used.Currency)
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pwsh -File ~/.claude/tools/claude-usage-tray/tests/Usage.Parse.Tests.ps1`
Expected: PASS — 61 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add lib/Usage.Parse.ps1 tests/Usage.Parse.Tests.ps1
git commit -m "feat: spend normalization with minor units and explicit currency"
```

---

### Task 6: Backoff arithmetic, credentials, and fetch

The backoff decision is pure and tested. The HTTP call itself is thin and verified manually in Task 8.

**Files:**
- Create: `lib/Usage.Api.ps1`
- Modify: `lib/Usage.Parse.ps1` (backoff helper — pure, belongs with the tested code)
- Modify: `tests/Usage.Parse.Tests.ps1`

**Interfaces:**
- Consumes: `ConvertTo-ExpiryUtc`, `Test-TokenExpired` from Task 2; `Get-UsageBuckets`, `Get-SpendInfo` from Tasks 4–5.
- Produces: `Get-RetryAfterSeconds($HeaderValue, [int]$Default, [int]$MaxSeconds)` -> `[int]`. `Get-StoredCredential()` -> `@{ Token=[string]; ExpiresAtUtc=[DateTime|null] }` or `$null`. `Get-UsageSnapshot()` -> `@{ Buckets=<array>; Spend=<hashtable|null>; FetchedUtc=[DateTime|null]; ErrorText=[string|null]; BackoffUntil=[DateTime] }`.

- [ ] **Step 1: Write the failing test for backoff arithmetic**

Append to `tests/Usage.Parse.Tests.ps1`, above the final `exit`:

```powershell
Write-Host "`nGet-RetryAfterSeconds" -ForegroundColor Cyan
Assert-Equal -Expected 120  -Actual (Get-RetryAfterSeconds '120')    -Name 'valid Retry-After is used'
Assert-Equal -Expected 600  -Actual (Get-RetryAfterSeconds $null)    -Name 'absent header falls back to default'
Assert-Equal -Expected 600  -Actual (Get-RetryAfterSeconds 'abc')    -Name 'unparseable header falls back to default'
Assert-Equal -Expected 600  -Actual (Get-RetryAfterSeconds '-5')     -Name 'negative header falls back to default'
Assert-Equal -Expected 0    -Actual (Get-RetryAfterSeconds '0')      -Name 'zero is honoured'
# A malformed or hostile header must not lock the tray out for years.
Assert-Equal -Expected 3600 -Actual (Get-RetryAfterSeconds '999999') -Name 'absurd header is capped at 3600'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pwsh -File ~/.claude/tools/claude-usage-tray/tests/Usage.Parse.Tests.ps1`
Expected: FAIL — `Get-RetryAfterSeconds` not recognized.

- [ ] **Step 3: Implement the pure helper**

Append to `lib/Usage.Parse.ps1`:

```powershell
function Get-RetryAfterSeconds {
    # Clamp Retry-After into [0, MaxSeconds]. A malformed, missing, or hostile
    # header must never be able to disable the tray for hours or years.
    param($HeaderValue, [int]$Default = 600, [int]$MaxSeconds = 3600)
    $n = 0
    if (-not [int]::TryParse([string]$HeaderValue, [ref]$n)) { return $Default }
    if ($n -lt 0) { return $Default }
    if ($n -gt $MaxSeconds) { return $MaxSeconds }
    return $n
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pwsh -File ~/.claude/tools/claude-usage-tray/tests/Usage.Parse.Tests.ps1`
Expected: PASS — 67 passed, 0 failed.

- [ ] **Step 5: Write the API layer**

Create `lib/Usage.Api.ps1`:

```powershell
# Usage.Api.ps1 - credentials (READ ONLY) and the single HTTP call.
# The only network destination in this project is api.anthropic.com.
Set-StrictMode -Version Latest

$script:Version           = '0.1.0'
$script:UsageUrl          = 'https://api.anthropic.com/api/oauth/usage'
$script:AnthropicBeta     = 'oauth-2025-04-20'
$script:RequestTimeoutSec = 5
$script:MaxResponseBytes  = 1048576
$script:AuthBackoffSec    = 300
$script:MaxBackoffSec     = 3600
$script:SkewSeconds       = 60
$script:ExpiredMsg        = 'Auth expired - open Claude Code to refresh'

$script:LogDir  = Join-Path $env:LOCALAPPDATA 'claude-usage-tray'
$script:LogFile = Join-Path $script:LogDir 'tray.log'

# Mutable fetch state. LastAttemptUtc is set on EVERY attempt (success or
# not) - the click-refresh floor keys off it, so repeated clicks during a
# 5xx/timeout outage cannot hammer the endpoint. FetchedUtc is success-only.
$script:State = @{
    Buckets        = @()
    Spend          = $null
    FetchedUtc     = $null
    LastAttemptUtc = $null
    ErrorText      = $null
    BackoffUntil   = [DateTime]::MinValue
}

function Write-TrayLog {
    param([string]$Message)
    try {
        if (-not (Test-Path $script:LogDir)) {
            New-Item -ItemType Directory -Path $script:LogDir -Force | Out-Null
        }
        $line = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $Message
        Add-Content -Path $script:LogFile -Value $line -ErrorAction Stop
    } catch { }   # logging must never break the tray
}

function Get-CredentialPath {
    $dir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $env:USERPROFILE '.claude' }
    return (Join-Path $dir '.credentials.json')
}

function Get-StoredCredential {
    # READ ONLY. Claude Code owns token rotation; this tool never writes here
    # and never reads refreshToken.
    $path = Get-CredentialPath
    if (-not (Test-Path $path)) { return $null }
    try {
        $oauth = (Get-Content $path -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop).claudeAiOauth
        $tok = [string]$oauth.accessToken
        if ([string]::IsNullOrWhiteSpace($tok)) { return $null }
        return @{ Token = $tok; ExpiresAtUtc = (ConvertTo-ExpiryUtc $oauth.expiresAt) }
    } catch {
        # Log the exception TYPE only. A raw error record can embed fragments
        # of the file being parsed - i.e. the access token.
        Write-TrayLog ('Failed to read credentials ({0})' -f $_.Exception.GetType().Name)
        return $null
    }
}

function Invoke-UsageFetch {
    # Updates $script:State in place. Returns nothing.
    if ((Get-Date) -lt $script:State.BackoffUntil) {
        Write-TrayLog ('Skipping fetch - backing off until {0:HH:mm:ss}' -f $script:State.BackoffUntil)
        return
    }

    $cred = Get-StoredCredential
    if ($null -eq $cred) {
        $script:State.ErrorText = 'Claude Code not signed in'
        return
    }

    # Pre-flight expiry check. Claude Code owns refresh, so an expired token
    # just 401s - and repeated 401s get escalated by the API into a 429 with a
    # long lockout. Skipping the call entirely lets the tray self-heal: the
    # next poll after any Claude Code launch picks up the rotated token.
    if (Test-TokenExpired -ExpiresAtUtc $cred.ExpiresAtUtc -SkewSeconds $script:SkewSeconds) {
        if ($script:State.ErrorText -ne $script:ExpiredMsg) {
            Write-TrayLog 'Access token expired - pausing fetches until Claude Code refreshes it'
        }
        $script:State.ErrorText = $script:ExpiredMsg
        return
    }

    $script:State.LastAttemptUtc = (Get-Date).ToUniversalTime()

    $req = [System.Net.HttpWebRequest]::Create($script:UsageUrl)
    $req.Method           = 'GET'
    $req.Timeout          = $script:RequestTimeoutSec * 1000
    $req.ReadWriteTimeout = $script:RequestTimeoutSec * 1000
    $req.ContentType      = 'application/json'
    $req.UserAgent        = "claude-usage-tray/$script:Version"
    $req.Headers.Add('Authorization', "Bearer $($cred.Token)")
    $req.Headers.Add('anthropic-beta', $script:AnthropicBeta)

    try {
        $resp = $req.GetResponse()
        try {
            $stream = $resp.GetResponseStream()
            $buf = New-Object byte[] 8192
            $ms  = New-Object System.IO.MemoryStream
            try {
                # Hard size cap. The real response is ~600 bytes; anything
                # wildly larger is a misconfigured proxy or a hostile response
                # trying to exhaust memory inside ConvertFrom-Json.
                while (($n = $stream.Read($buf, 0, $buf.Length)) -gt 0) {
                    if ($ms.Length + $n -gt $script:MaxResponseBytes) {
                        throw "Response exceeded $script:MaxResponseBytes bytes"
                    }
                    $ms.Write($buf, 0, $n)
                }
                $body = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
            } finally { $ms.Dispose() }

            $json = $body | ConvertFrom-Json -ErrorAction Stop
            $script:State.Buckets    = @(Get-UsageBuckets $json)
            $script:State.Spend      = Get-SpendInfo    $json
            $script:State.FetchedUtc = (Get-Date).ToUniversalTime()
            $script:State.ErrorText  = $null
        } finally { $resp.Dispose() }
    }
    catch [System.Net.WebException] {
        $we   = $_.Exception
        $http = $we.Response -as [System.Net.HttpWebResponse]
        $code = if ($http) { [int]$http.StatusCode } else { 0 }

        if ($code -eq 429) {
            $retry = Get-RetryAfterSeconds $http.Headers['Retry-After'] 600 $script:MaxBackoffSec
            $script:State.BackoffUntil = (Get-Date).AddSeconds($retry + 30)
            $script:State.ErrorText = 'Rate limited (429) - retry {0:HH:mm}' -f $script:State.BackoffUntil
        }
        elseif ($code -eq 401) {
            # The token looked unexpired but was rejected (rotated, revoked, or
            # not yet written). Pause rather than retry: repeated 401s escalate
            # to a 429 lockout.
            $script:State.BackoffUntil = (Get-Date).AddSeconds($script:AuthBackoffSec)
            $script:State.ErrorText = 'Token rejected (401) - open Claude Code'
        }
        elseif ($code -ge 500 -and $code -lt 600) {
            $script:State.ErrorText = "Anthropic server error ($code)"
        }
        elseif ($we.Status -eq [System.Net.WebExceptionStatus]::TrustFailure -or
                $we.Status -eq [System.Net.WebExceptionStatus]::SecureChannelFailure) {
            # Distinct from a plain network error: signals a proxy or MITM.
            $script:State.ErrorText = 'Certificate error - check proxy'
        }
        else {
            $script:State.ErrorText = "Network error: $($we.Status)"
        }
        Write-TrayLog $script:State.ErrorText
        if ($http) { $http.Dispose() }
    }
    catch {
        $script:State.ErrorText = 'Fetch failed ({0})' -f $_.Exception.GetType().Name
        Write-TrayLog $script:State.ErrorText
    }
}

function Get-UsageSnapshot { return $script:State }
```

- [ ] **Step 6: Verify no write path to credentials exists**

Two greps over the **whole tool directory**, not one file. The first lists every
consumer of the credential path; the second lists every filesystem-mutating
call. The two lists must not intersect.

```bash
cd ~/.claude/tools/claude-usage-tray
echo "== credential path consumers =="
grep -rnE "Get-CredentialPath|\.credentials\.json" --include=*.ps1 .
echo "== filesystem writers =="
grep -rnE "Set-Content|Add-Content|Out-File|Clear-Content|New-Item|Copy-Item|Move-Item|Remove-Item|Rename-Item|Set-ItemProperty|\[(System\.)?IO\.File\]::(Write|Append|Open|Create|Delete|Move|Copy)|>>?[[:space:]]*\\$" --include=*.ps1 .
```
Expected: `Get-CredentialPath` is consumed only by `Get-StoredCredential`; the only writers are `Add-Content` and `New-Item -ItemType Directory` inside `Write-TrayLog`, both targeting the log directory. **Any writer touching a credential path is a stop-the-line defect.** Task 8 Step 6 adds the runtime mtime check on top of this static check.

- [ ] **Step 7: Verify the parse library stayed pure**

Run:
```bash
grep -nE "Invoke-|Get-Content|Set-Content|System.Windows.Forms|HttpWebRequest" ~/.claude/tools/claude-usage-tray/lib/Usage.Parse.ps1
```
Expected: no output. The parse library must have no I/O and no UI types.

- [ ] **Step 8: Commit**

```bash
git add lib/Usage.Api.ps1 lib/Usage.Parse.ps1 tests/Usage.Parse.Tests.ps1
git commit -m "feat: read-only credentials, guarded fetch, clamped backoff"
```

---

### Task 7: Rendering — icon, tooltip, panel

**Files:**
- Create: `lib/Usage.Render.ps1`
- Modify: `tests/Usage.Parse.Tests.ps1` (tooltip is pure and testable)

**Interfaces:**
- Consumes: bucket hashtables from Task 4, spend from Task 5, snapshot from Task 6.
- Produces: `Format-Remaining([DateTime]$Utc)` -> `[string]` like `57m` / `3h 12m` / `-`. `Get-TooltipText($Snapshot)` -> `[string]` of at most 63 characters. `Get-UtilColor([double]$Util, [bool]$CreditsExhausted)` -> `[System.Drawing.Color]`. `New-PctIcon([int]$Pct, $Color)` -> `[System.Drawing.Icon]`. `Update-TrayIcon($NotifyIcon, $Snapshot)` -> `[void]`. `Show-DetailPanel($Snapshot)` -> `[void]`.

- [ ] **Step 1: Write the failing tooltip tests**

Append to `tests/Usage.Parse.Tests.ps1`, above the final `exit`:

```powershell
. "$PSScriptRoot/../lib/Usage.Render.ps1"

Write-Host "`nFormat-Remaining" -ForegroundColor Cyan
$base = [DateTime]::SpecifyKind([DateTime]::Parse('2026-09-04T12:00:00'), 'Utc')
Assert-Equal -Expected '57m'    -Actual (Format-Remaining $base.AddMinutes(57) $base)  -Name 'under an hour shows minutes'
Assert-Equal -Expected '3h 12m' -Actual (Format-Remaining $base.AddMinutes(192) $base) -Name 'over an hour shows hours and minutes'
Assert-Equal -Expected 'now'    -Actual (Format-Remaining $base.AddMinutes(-5) $base)  -Name 'past reset reads now'
Assert-Equal -Expected '-'      -Actual (Format-Remaining $null $base)                 -Name 'null reset reads dash'

Write-Host "`nGet-TooltipText" -ForegroundColor Cyan
$fx   = Get-TestFixture 'usage-2026-09-04.json'
$snap = @{ Buckets = (Get-UsageBuckets $fx); Spend = (Get-SpendInfo $fx)
           FetchedUtc = $base; ErrorText = $null; BackoffUntil = [DateTime]::MinValue }
$tip = Get-TooltipText $snap
Assert-True -Condition ($tip.Length -le 63) -Name 'tooltip respects the hard 63-char NotifyIcon.Text cap'
Assert-True -Condition ($tip -match '100')  -Name 'tooltip leads with the worst bucket (100%)'

$errSnap = @{ Buckets = @(); Spend = $null; FetchedUtc = $null
              ErrorText = 'Claude Code not signed in'; BackoffUntil = [DateTime]::MinValue }
Assert-True -Condition ((Get-TooltipText $errSnap).Length -le 63) -Name 'error tooltip also respects the cap'
Assert-True -Condition ((Get-TooltipText $errSnap) -match 'signed in') -Name 'error tooltip states the error'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pwsh -File ~/.claude/tools/claude-usage-tray/tests/Usage.Parse.Tests.ps1`
Expected: FAIL — `lib/Usage.Render.ps1` does not exist.

- [ ] **Step 3: Implement**

Create `lib/Usage.Render.ps1`:

```powershell
# Usage.Render.ps1 - icon bitmap, tooltip string, detail panel.
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Bitmap.GetHicon() allocates a GDI handle that the GC does not release.
# Without DestroyIcon this leaks one handle per repaint - ~288/day at a
# 5-minute poll, in a process meant to run for weeks.
if (-not ('Win32Icon' -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Win32Icon {
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern bool DestroyIcon(IntPtr handle);
}
'@
}

$script:CurrentIcon = $null

function Format-Remaining {
    param($Utc, [DateTime]$NowUtc = ([DateTime]::UtcNow))
    if ($null -eq $Utc) { return '-' }
    $span = ([DateTime]$Utc) - $NowUtc
    if ($span.TotalSeconds -le 0) { return 'now' }
    if ($span.TotalMinutes -lt 60) { return ('{0}m' -f [int][math]::Floor($span.TotalMinutes)) }
    return ('{0}h {1}m' -f [int][math]::Floor($span.TotalHours), $span.Minutes)
}

function Get-UtilColor {
    param([double]$Util, [bool]$CreditsExhausted = $false)
    $pct = [int][math]::Round($Util * 100)
    if ($CreditsExhausted -or $pct -ge 85) { return [System.Drawing.Color]::FromArgb(200, 40, 40) }
    if ($pct -ge 60) { return [System.Drawing.Color]::FromArgb(205, 130, 20) }
    return [System.Drawing.Color]::FromArgb(35, 130, 60)
}

function Get-WorstBucket {
    param($Buckets)
    $live = @($Buckets | Where-Object { $_.IsActive -or $_.Util -gt 0 })
    if ($live.Count -eq 0) { return $null }
    return ($live | Sort-Object -Property @{ Expression = { $_.Util }; Descending = $true })[0]
}

function Get-TooltipText {
    # NotifyIcon.Text throws above 63 characters. Truncate, never risk it.
    param($Snapshot)
    $text = ''
    if ($Snapshot.ErrorText -and $null -eq $Snapshot.FetchedUtc) {
        $text = [string]$Snapshot.ErrorText
    } else {
        $parts = @()
        foreach ($b in @($Snapshot.Buckets | Where-Object { $_.IsActive -or $_.Util -gt 0 } |
                         Sort-Object -Property @{ Expression = { $_.Util }; Descending = $true })) {
            $parts += ('{0} {1}%' -f (Get-ShortLabel $b.Key), [int][math]::Round($b.Util * 100))
        }
        if ($Snapshot.Spend -and $Snapshot.Spend.Exhausted) { $parts += 'credits out' }
        $text = ($parts -join ' ')
        if ($Snapshot.ErrorText) { $text = "$text (stale)" }
        if (-not $text) { $text = 'No usage data' }
    }
    if ($text.Length -gt 63) { $text = $text.Substring(0, 63) }
    return $text
}

function Get-ShortLabel {
    param([string]$Key)
    switch ($Key) {
        'five_hour' { return 'S' }
        'seven_day' { return 'W' }
        default {
            if ($Key -like 'seven_day_*') {
                $m = $Key -replace '^seven_day_', ''
                return ($m.Substring(0, [math]::Min(2, $m.Length))).ToUpperInvariant()
            }
            return ($Key.Substring(0, [math]::Min(2, $Key.Length))).ToUpperInvariant()
        }
    }
}

function New-PctIcon {
    # -Label overrides the numeric text, e.g. '?' for the never-fetched state.
    param([int]$Pct, $Color, [string]$Label = '')
    $bmp = New-Object System.Drawing.Bitmap 16, 16
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.Clear($Color)
        $label = if ($Label) { $Label } elseif ($Pct -ge 100) { '99' } else { [string]$Pct }
        $font  = New-Object System.Drawing.Font 'Segoe UI', 7, ([System.Drawing.FontStyle]::Bold)
        $fmt   = New-Object System.Drawing.StringFormat
        $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
        $rect  = New-Object System.Drawing.RectangleF 0, 0, 16, 16
        $g.DrawString($label, $font, [System.Drawing.Brushes]::White, $rect, $fmt)
        $font.Dispose(); $fmt.Dispose()
    } finally { $g.Dispose() }

    $h    = $bmp.GetHicon()
    $icon = ([System.Drawing.Icon]::FromHandle($h)).Clone()
    [Win32Icon]::DestroyIcon($h) | Out-Null   # release the GDI handle
    $bmp.Dispose()
    return [System.Drawing.Icon]$icon
}

function Update-TrayIcon {
    param($NotifyIcon, $Snapshot)
    $exhausted = [bool]($Snapshot.Spend -and $Snapshot.Spend.Exhausted)
    $worst = Get-WorstBucket $Snapshot.Buckets

    if ($null -eq $Snapshot.FetchedUtc) {
        # Never fetched successfully - a distinct grey '?' per spec, so it can
        # never be mistaken for the legitimate all-zero state.
        $newIcon = New-PctIcon -Pct 0 -Label '?' -Color ([System.Drawing.Color]::FromArgb(110, 110, 110))
    } elseif ($null -eq $worst) {
        $newIcon = New-PctIcon -Pct 0 -Color (Get-UtilColor 0 $exhausted)
    } else {
        $pct = [int][math]::Round($worst.Util * 100)
        $newIcon = New-PctIcon -Pct $pct -Color (Get-UtilColor $worst.Util $exhausted)
    }

    $old = $script:CurrentIcon
    $NotifyIcon.Icon    = $newIcon
    $NotifyIcon.Text    = Get-TooltipText $Snapshot
    $script:CurrentIcon = $newIcon
    if ($old) { $old.Dispose() }
}

function Show-DetailPanel {
    param($Snapshot)
    $lines = @()
    $live = @($Snapshot.Buckets | Where-Object { $_.IsActive -or $_.Util -gt 0 } |
              Sort-Object -Property @{ Expression = { $_.Util }; Descending = $true })
    foreach ($b in $live) {
        $flag = if ($b.IsActive) { '  <-- ACTIVE' } else { '' }
        # Spec: reset time both relative and absolute.
        $abs = if ($null -ne $b.ResetsAt) { ' ({0:HH:mm} local)' -f ([DateTime]$b.ResetsAt).ToLocalTime() } else { '' }
        $lines += ('{0,-22} {1,3}%   resets in {2}{3}{4}' -f $b.Label,
                    [int][math]::Round($b.Util * 100), (Format-Remaining $b.ResetsAt), $abs, $flag)
    }
    if ($live.Count -eq 0) { $lines += 'No active limits.' }

    # Buckets present in the response but idle - named, not hidden, not loud.
    $idle = @($Snapshot.Buckets | Where-Object { -not $_.IsActive -and $_.Util -le 0 })
    if ($idle.Count -gt 0) { $lines += ''; $lines += ('Idle: ' + (($idle | ForEach-Object { $_.Label }) -join ', ')) }

    if ($Snapshot.Spend) {
        $lines += ''
        $suffix = if ($Snapshot.Spend.Exhausted) { '  (exhausted)' } else { '' }
        $lines += ('Extra usage credits: {0}{1}' -f $Snapshot.Spend.Text, $suffix)
    }

    $lines += ''
    $lines += if ($Snapshot.FetchedUtc) {
        'Last fetched {0:HH:mm:ss} local' -f ([DateTime]$Snapshot.FetchedUtc).ToLocalTime()
    } else { 'Never fetched successfully' }
    if ($Snapshot.ErrorText) { $lines += ('Status: ' + $Snapshot.ErrorText) }

    [System.Windows.Forms.MessageBox]::Show(($lines -join "`n"), 'Claude usage',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pwsh -File ~/.claude/tools/claude-usage-tray/tests/Usage.Parse.Tests.ps1`
Expected: PASS — 75 passed, 0 failed.

- [ ] **Step 5: Verify DestroyIcon is called on every icon path**

Run:
```bash
grep -c "GetHicon" ~/.claude/tools/claude-usage-tray/lib/Usage.Render.ps1
grep -c "DestroyIcon" ~/.claude/tools/claude-usage-tray/lib/Usage.Render.ps1
```
Expected: one `GetHicon` and two `DestroyIcon` (the P/Invoke declaration plus one call). Every `GetHicon` must be paired with a `DestroyIcon`.

- [ ] **Step 6: Commit**

```bash
git add lib/Usage.Render.ps1 tests/Usage.Parse.Tests.ps1
git commit -m "feat: tray icon, capped tooltip, detail panel with GDI cleanup"
```

---

### Task 8: Wiring, launcher, docs, and manual verification

**Files:**
- Create: `claude-usage-tray.ps1`
- Create: `Start.vbs`
- Create: `README.md`
- Modify: `docs/superpowers/specs/2026-09-04-claude-usage-tray-design.md` (Architecture section — record the file split)

**Interfaces:**
- Consumes: everything from Tasks 2–7.
- Produces: the runnable tool.

- [ ] **Step 1: Write the entry script**

Create `claude-usage-tray.ps1`:

```powershell
<#
  Claude Usage Tray - Windows system-tray monitor for Claude Code rate limits.
  Reads ~/.claude/.credentials.json READ ONLY. Never refreshes tokens.
  Only network destination: api.anthropic.com
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. "$PSScriptRoot/lib/Usage.Parse.ps1"
. "$PSScriptRoot/lib/Usage.Api.ps1"
. "$PSScriptRoot/lib/Usage.Render.ps1"

$PollMs          = 300000
$JitterMaxMs     = 60000
$RefreshFloorSec = 60
$rand            = New-Object System.Random

$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
[void]$menu.Items.Add('Refresh now', $null, {
    $snap = Get-UsageSnapshot
    # 60s floor keyed off the last ATTEMPT, not the last success - otherwise
    # repeated clicks during a 5xx/timeout outage would fetch with no floor.
    if ($snap.LastAttemptUtc -and ((Get-Date).ToUniversalTime() - $snap.LastAttemptUtc).TotalSeconds -lt $RefreshFloorSec) {
        return
    }
    Invoke-UsageFetch
    Update-TrayIcon $notifyIcon (Get-UsageSnapshot)
})
[void]$menu.Items.Add('Show details', $null, { Show-DetailPanel (Get-UsageSnapshot) })
[void]$menu.Items.Add('View log', $null, {
    $log = Join-Path $env:LOCALAPPDATA 'claude-usage-tray\tray.log'
    if (Test-Path $log) { Start-Process notepad.exe $log }
})
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
# Exit only stops the message loop. Disposal happens once, in the finally
# block below - disposing here too would make finally touch a disposed object
# under $ErrorActionPreference = 'Stop' and error on every clean exit.
[void]$menu.Items.Add('Exit', $null, { [System.Windows.Forms.Application]::Exit() })
$notifyIcon.ContextMenuStrip = $menu

# Left-click opens details; right-click gets the menu for free.
$notifyIcon.Add_MouseClick({
    if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        Show-DetailPanel (Get-UsageSnapshot)
    }
})

Update-TrayIcon $notifyIcon (Get-UsageSnapshot)

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 3000        # first fetch soon after launch
$timer.Add_Tick({
    Invoke-UsageFetch
    Update-TrayIcon $notifyIcon (Get-UsageSnapshot)
    # Jitter every interval so many machines never synchronize onto the API.
    $timer.Interval = $PollMs + $rand.Next(0, $JitterMaxMs)
})
$timer.Start()

try {
    [System.Windows.Forms.Application]::Run()
} finally {
    $timer.Stop(); $timer.Dispose()
    if ($notifyIcon) { $notifyIcon.Visible = $false; $notifyIcon.Dispose() }
}
```

- [ ] **Step 2: Write the launcher shim**

Create `Start.vbs`:

```vbscript
' Launch the tray with no console window.
Dim shell, here
Set shell = CreateObject("WScript.Shell")
here = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
shell.Run "pwsh.exe -NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & here & "claude-usage-tray.ps1""", 0, False
```

- [ ] **Step 3: Run the full test suite one final time**

Run: `pwsh -File ~/.claude/tools/claude-usage-tray/tests/Usage.Parse.Tests.ps1`
Expected: PASS — 75 passed, 0 failed, exit code 0. **Do not proceed on any failure.**

- [ ] **Step 4: Launch and verify against the live account**

Run: `wscript.exe ~/.claude/tools/claude-usage-tray/Start.vbs`

Confirm all of:
1. A coloured icon appears in the notification area within ~5 seconds.
2. Left-click opens the panel.
3. The panel's numbers match what `/usage` reports in Claude Code right now.
4. **Any bucket the API reports `is_active` is listed and marked `<-- ACTIVE`** — this is the requirement the reference tools fail.
5. The credits line appears with the correct currency, and reads `(exhausted)` when used >= limit.
6. `Last fetched HH:mm:ss local` is present and recent.

- [ ] **Step 5: Verify no GDI handle leak**

Run:
```powershell
$p = Get-Process pwsh | Where-Object { $_.MainWindowTitle -eq '' } | Select-Object -First 1
$p.Id; $p.HandleCount
```
Note the count, wait through at least three poll cycles (~15 minutes), then re-run. Expected: the handle count is flat, not climbing by ~1 per repaint. A steady climb means a `GetHicon` path is missing its `DestroyIcon`.

- [ ] **Step 6: Verify the credentials file was never written**

Run:
```bash
ls -l --time-style=full-iso ~/.claude/.credentials.json
```
Expected: the modification time predates the tray launch. **If it changed, stop — a write path exists and must be removed.**

- [ ] **Step 7: Write the README**

Create `README.md`:

```markdown
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
```

- [ ] **Step 8: Reconcile the spec with the delivered structure**

In `docs/superpowers/specs/2026-09-04-claude-usage-tray-design.md`, replace the
"Single PowerShell script plus a launcher shim" wording and its file tree with
the four-file layout actually built (`claude-usage-tray.ps1` plus
`lib/Usage.Parse.ps1`, `lib/Usage.Api.ps1`, `lib/Usage.Render.ps1`), noting
that the split is what makes the pure functions dot-sourceable without
launching the UI during tests. In the same tree, rename `tests/unit.tests.ps1`
to the two files actually built: `tests/TestHarness.ps1` and
`tests/Usage.Parse.Tests.ps1`. Leave every other section unchanged.

- [ ] **Step 9: Commit**

```bash
git add claude-usage-tray.ps1 Start.vbs README.md
git commit -m "feat: tray wiring, launcher shim, and README"
cd ~ && git add docs/superpowers/specs/2026-09-04-claude-usage-tray-design.md
git commit -m "docs: reconcile spec architecture with delivered file split"
```

---

## Self-review

**Spec coverage.** Every spec section maps to a task: data source and headers → Task 6; credentials read-only → Task 6 (verified in Step 6); bucket discovery three passes → Task 4; scale detection → Task 3; display selection incl. empty state → Task 7; refresh policy and the full failure table → Task 6; security constraints 1–6 → Tasks 6 (1,2,3,4,6) and 7 (5), with grep verification steps; testing section → Tasks 1–7, every listed case present; constants table → Task 6 script scope and Task 8 entry script.

**Deliberate spec deviations, both recorded:** the single-file architecture becomes four files (justified above, spec reconciled in Task 8 Step 8), and Pester is replaced by a hand-rolled harness (justified above — only Pester 3.4.0 is installed).

**Placeholder scan.** No TBD/TODO. No "add error handling" — the failure table is implemented as explicit branches. No "similar to Task N". No create-then-delete stubs.

**Type consistency.** `@{ Util; ResetsAt }` from `ConvertTo-Limit` (Task 3) is consumed under those names in Task 4. Bucket keys `Key/Label/Util/ResetsAt/IsActive/Severity` (Task 4) are the names read in Task 7. `Get-SpendInfo`'s `Used/Limit/Percent/Severity/Exhausted/Text` (Task 5) match Task 7's reads. `Get-UsageSnapshot` returns the `Buckets/Spend/FetchedUtc/LastAttemptUtc/ErrorText/BackoffUntil` shape that Tasks 7 and 8 destructure. `Get-RetryAfterSeconds` is defined in Task 6 Step 3 before its use in Step 5. `Get-Prop` is defined in Task 3 and used by Tasks 4–5.

**Strict-mode and pipeline hazards, verified on PS 7.6.5 before planning:** `$obj.missing` throws under `Set-StrictMode -Version Latest` (hence `Get-Prop` everywhere a JSON field is read); `.PSObject.Properties.Name -contains` throws on a boolean value (hence the indexer); a returned single-element array unrolls to its element and an empty one to AutomationNull whose `.Count` throws (hence `return ,$arr` plus `@(...)` at every call site); an unknown command is non-terminating in a script (hence `$ErrorActionPreference = 'Stop'` at the top of the test file, so the red phase actually exits non-zero).

**Cumulative test counts** (3, 16, 29, 49, 61, 67, 75) assume tests are appended in task order; if executed out of order, treat the count as advisory and only require zero failures.

**Independent review (2026-09-04):** a fresh reviewer raised 12 findings; all were verified (four empirically) and folded in above.
