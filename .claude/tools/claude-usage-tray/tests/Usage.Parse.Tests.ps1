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

exit (Invoke-TestSummary)
