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
