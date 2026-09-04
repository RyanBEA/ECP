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
Assert-Null -Value (ConvertTo-ResetUtc 'nope') -Name 'garbage reset returns null'

exit (Invoke-TestSummary)
