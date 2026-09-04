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

function Get-LiveBuckets {
    # Buckets worth showing: active, or carrying any utilization. Sorted worst first.
    param($Buckets)
    # $null -ne $_ first: @($null) is a one-element array, and .IsActive on null throws.
    return @(@($Buckets) | Where-Object { $null -ne $_ -and ($_.IsActive -or $_.Util -gt 0) } |
             Sort-Object -Property @{ Expression = { $_.Util }; Descending = $true })
}

function Get-WorstBucket {
    param($Buckets)
    # @(...) at the call site: a returned empty array unrolls to AutomationNull,
    # whose .Count throws under strict mode. Bit us on the pre-first-fetch repaint.
    $live = @(Get-LiveBuckets $Buckets)
    if ($live.Count -eq 0) { return $null }
    return $live[0]
}

function Get-ShortLabel {
    param([string]$Key)
    switch ($Key) {
        'five_hour' { return 'S' }
        'seven_day' { return 'W' }
        default {
            $m = if ($Key -like 'seven_day_*') { $Key -replace '^seven_day_', '' } else { $Key }
            return ($m.Substring(0, [math]::Min(2, $m.Length))).ToUpperInvariant()
        }
    }
}

function Get-TooltipText {
    # NotifyIcon.Text throws above 63 characters. Truncate, never risk it.
    param($Snapshot)
    $text = ''
    if ($Snapshot.ErrorText -and $null -eq $Snapshot.FetchedUtc) {
        $text = [string]$Snapshot.ErrorText
    } else {
        $parts = @()
        foreach ($b in (Get-LiveBuckets $Snapshot.Buckets)) {
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

function New-PctIcon {
    # -Label overrides the numeric text, e.g. '?' for the never-fetched state.
    param([int]$Pct, $Color, [string]$Label = '')
    $bmp = New-Object System.Drawing.Bitmap 16, 16
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.Clear($Color)
        $text = if ($Label) { $Label } elseif ($Pct -ge 100) { '99' } else { [string]$Pct }
        $font = New-Object System.Drawing.Font 'Segoe UI', 7, ([System.Drawing.FontStyle]::Bold)
        $fmt  = New-Object System.Drawing.StringFormat
        $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
        $rect = New-Object System.Drawing.RectangleF 0, 0, 16, 16
        $g.DrawString($text, $font, [System.Drawing.Brushes]::White, $rect, $fmt)
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
    $live = @(Get-LiveBuckets $Snapshot.Buckets)
    foreach ($b in $live) {
        $flag = if ($b.IsActive) { '  <-- ACTIVE' } else { '' }
        # Spec: reset time both relative and absolute.
        $abs = if ($null -ne $b.ResetsAt) { ' ({0:HH:mm} local)' -f ([DateTime]$b.ResetsAt).ToLocalTime() } else { '' }
        $lines += ('{0,-22} {1,3}%   resets in {2}{3}{4}' -f $b.Label,
                    [int][math]::Round($b.Util * 100), (Format-Remaining $b.ResetsAt), $abs, $flag)
    }
    if ($live.Count -eq 0) { $lines += 'No active limits.' }

    # Buckets present in the response but idle - named, not hidden, not loud.
    $idle = @(@($Snapshot.Buckets) | Where-Object { -not $_.IsActive -and $_.Util -le 0 })
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
