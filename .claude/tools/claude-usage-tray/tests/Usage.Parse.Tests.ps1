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
# ConvertFrom-Json yields a [DateTime], not a string. Precision must survive:
# a [string] cast here silently drops the fraction and broke prefix derivation.
Assert-Equal -Expected '2026-09-04T15:59:59.6115730Z' `
    -Actual (ConvertTo-ResetUtc $fx.seven_day.resets_at).ToString('o') `
    -Name 'fixture DateTime resets_at keeps microsecond precision'
Assert-Null -Value (ConvertTo-ResetUtc 'nope') -Name 'garbage reset returns null'

Write-Host "`nConvertTo-ModelSlug" -ForegroundColor Cyan
Assert-Equal -Expected 'fable'        -Actual (ConvertTo-ModelSlug 'Fable')        -Name 'Fable -> fable'
Assert-Equal -Expected 'claude_opus_5' -Actual (ConvertTo-ModelSlug 'Claude Opus 5') -Name 'spaces become underscores'
Assert-Equal -Expected 'opus_4_8'     -Actual (ConvertTo-ModelSlug 'Opus 4.8')     -Name 'punctuation becomes a separator'

Write-Host "`nGet-UsageBuckets" -ForegroundColor Cyan
$fx = Get-TestFixture 'usage-2026-09-04.json'
$buckets = @(Get-UsageBuckets $fx)
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

Write-Host "`nGet-RetryAfterSeconds" -ForegroundColor Cyan
Assert-Equal -Expected 120  -Actual (Get-RetryAfterSeconds '120')    -Name 'valid Retry-After is used'
Assert-Equal -Expected 600  -Actual (Get-RetryAfterSeconds $null)    -Name 'absent header falls back to default'
Assert-Equal -Expected 600  -Actual (Get-RetryAfterSeconds 'abc')    -Name 'unparseable header falls back to default'
Assert-Equal -Expected 600  -Actual (Get-RetryAfterSeconds '-5')     -Name 'negative header falls back to default'
Assert-Equal -Expected 0    -Actual (Get-RetryAfterSeconds '0')      -Name 'zero is honoured'
# A malformed or hostile header must not lock the tray out for years.
Assert-Equal -Expected 3600 -Actual (Get-RetryAfterSeconds '999999') -Name 'absurd header is capped at 3600'

. "$PSScriptRoot/../lib/Usage.Render.ps1"

Write-Host "`nFormat-Remaining" -ForegroundColor Cyan
$base = [DateTime]::SpecifyKind([DateTime]::Parse('2026-09-04T12:00:00'), 'Utc')
Assert-Equal -Expected '57m'    -Actual (Format-Remaining $base.AddMinutes(57) $base)  -Name 'under an hour shows minutes'
Assert-Equal -Expected '3h 12m' -Actual (Format-Remaining $base.AddMinutes(192) $base) -Name 'over an hour shows hours and minutes'
Assert-Equal -Expected 'now'    -Actual (Format-Remaining $base.AddMinutes(-5) $base)  -Name 'past reset reads now'
Assert-Equal -Expected '-'      -Actual (Format-Remaining $null $base)                 -Name 'null reset reads dash'

Write-Host "`nGet-TooltipText" -ForegroundColor Cyan
$fx   = Get-TestFixture 'usage-2026-09-04.json'
$snap = @{ Buckets = @(Get-UsageBuckets $fx); Spend = (Get-SpendInfo $fx)
           FetchedUtc = $base; LastAttemptUtc = $base; ErrorText = $null; BackoffUntil = [DateTime]::MinValue }
$tip = Get-TooltipText $snap
Assert-True -Condition ($tip.Length -le 63) -Name 'tooltip respects the hard 63-char NotifyIcon.Text cap'
Assert-True -Condition ($tip -match '100')  -Name 'tooltip leads with the worst bucket (100%)'

$errSnap = @{ Buckets = @(); Spend = $null; FetchedUtc = $null; LastAttemptUtc = $null
              ErrorText = 'Claude Code not signed in'; BackoffUntil = [DateTime]::MinValue }
Assert-True -Condition ((Get-TooltipText $errSnap).Length -le 63) -Name 'error tooltip also respects the cap'
Assert-True -Condition ((Get-TooltipText $errSnap) -match 'signed in') -Name 'error tooltip states the error'

Write-Host "`nGet-WorstBucket - empty state" -ForegroundColor Cyan
# The pre-first-fetch repaint calls this with no buckets. It crashed the tray
# on launch: an empty array returned from a function unrolls to null.
Assert-Null -Value (Get-WorstBucket @())   -Name 'no buckets yields null, not a strict-mode throw'
Assert-Null -Value (Get-WorstBucket $null) -Name 'null buckets yields null'
Assert-Equal -Expected 'No usage data' -Actual (Get-TooltipText @{ Buckets=@(); Spend=$null; FetchedUtc=$null; LastAttemptUtc=$null; ErrorText=$null; BackoffUntil=[DateTime]::MinValue }) -Name 'pre-fetch tooltip is the neutral empty text'

. "$PSScriptRoot/../lib/Usage.Api.ps1"

Write-Host "`nConvertTo-Credential" -ForegroundColor Cyan
# Fake token; shape mirrors the real file (extra keys present, refreshToken ignored).
$credJson = '{ "claudeAiOauth": { "accessToken": "sk-ant-oat01-FAKE", "refreshToken": "sk-ant-ort01-FAKE",
                "expiresAt": 1788571154875, "scopes": ["user:inference"], "subscriptionType": "max" } }'
$cred = ConvertTo-Credential $credJson
Assert-Equal -Expected 'sk-ant-oat01-FAKE' -Actual $cred.Token -Name 'access token is read'
Assert-Equal -Expected '2026-09-05T01:19:14Z' -Actual $cred.ExpiresAtUtc.ToString('yyyy-MM-ddTHH:mm:ssZ') -Name 'expiresAt (ms) is parsed'
Assert-Equal -Expected $false -Actual $cred.ContainsKey('RefreshToken') -Name 'refreshToken is never carried'
Assert-Null -Value (ConvertTo-Credential '{ "claudeAiOauth": { "accessToken": "" } }') -Name 'empty token yields null'
Assert-Null -Value (ConvertTo-Credential '{}')  -Name 'missing claudeAiOauth yields null, no strict-mode throw'
Assert-Null -Value (ConvertTo-Credential '')    -Name 'empty text yields null'

Write-Host "`nSelect-FreshestCredential" -ForegroundColor Cyan
$t0 = [DateTime]::SpecifyKind([DateTime]::Parse('2026-09-04T12:00:00'), 'Utc')
$older = @{ Token = 'OLD'; ExpiresAtUtc = $t0 }
$newer = @{ Token = 'NEW'; ExpiresAtUtc = $t0.AddHours(6) }
$unknown = @{ Token = 'UNK'; ExpiresAtUtc = $null }
Assert-Equal -Expected 'NEW' -Actual (Select-FreshestCredential @($older, $newer)).Token -Name 'later expiry wins'
Assert-Equal -Expected 'NEW' -Actual (Select-FreshestCredential @($newer, $older)).Token -Name 'order does not matter'
Assert-Equal -Expected 'OLD' -Actual (Select-FreshestCredential @($unknown, $older)).Token -Name 'known expiry beats unknown'
Assert-Equal -Expected 'UNK' -Actual (Select-FreshestCredential @($unknown)).Token -Name 'sole unknown-expiry candidate is still used'
Assert-Equal -Expected 'OLD' -Actual (Select-FreshestCredential @($null, $older, $null)).Token -Name 'null candidates (failed sources) are skipped'
Assert-Null -Value (Select-FreshestCredential @()) -Name 'no candidates yields null'
Assert-Null -Value (Select-FreshestCredential @($null)) -Name 'all sources failed yields null'

Write-Host "`nInvoke-NativeWithTimeout" -ForegroundColor Cyan
# Regression: ssh hung for 2 days after connect (ConnectTimeout only bounds the
# TCP handshake), freezing the tray's UI thread with its menu stuck on screen.
$pwshExe = (Get-Process -Id $PID).Path
$ok = Invoke-NativeWithTimeout -FilePath $pwshExe -Arguments @('-NoProfile','-Command','"a";"b"') -TimeoutMs 15000
Assert-Equal -Expected $false -Actual $ok.TimedOut -Name 'fast command does not time out'
Assert-Equal -Expected 0      -Actual $ok.ExitCode -Name 'fast command exit code is captured'
Assert-Equal -Expected "a`nb" -Actual ($ok.Output.Trim() -replace "`r`n", "`n") -Name 'stdout is captured'

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$hang = Invoke-NativeWithTimeout -FilePath $pwshExe -Arguments @('-NoProfile','-Command','Start-Sleep 60') -TimeoutMs 1500
$sw.Stop()
Assert-Equal -Expected $true -Actual $hang.TimedOut -Name 'hung command times out'
Assert-True  -Condition ($sw.Elapsed.TotalSeconds -lt 10) -Name "hung command returns promptly (took $([int]$sw.Elapsed.TotalSeconds)s)"
Assert-True  -Condition ($null -eq (Get-Process -Id $hang.Pid -ErrorAction SilentlyContinue)) -Name 'hung process is killed, not orphaned'

exit (Invoke-TestSummary)
