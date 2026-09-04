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
