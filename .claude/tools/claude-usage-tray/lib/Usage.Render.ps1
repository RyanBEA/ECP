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

$script:DetailForm = $null

function New-BarPanel {
    # Owner-drawn bar. A stock ProgressBar ignores ForeColor once visual styles
    # are on, so we paint the fill ourselves. State lives in .Tag so the Paint
    # handler has no closure over locals.
    param([double]$Util, $Color, [int]$Width, [int]$Height)
    $pnl = New-Object System.Windows.Forms.Panel
    $pnl.Size = New-Object System.Drawing.Size $Width, $Height
    $pnl.Tag  = @{ Util = $Util; Color = $Color }
    $pnl.Add_Paint({
        $g = $_.Graphics
        $w = $this.Width; $h = $this.Height
        $track = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(225, 225, 225))
        $fill  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]$this.Tag.Color)
        try {
            $g.FillRectangle($track, 0, 0, $w, $h)
            $fw = [int][math]::Round($w * [double]$this.Tag.Util)
            if ($fw -gt 0) { $g.FillRectangle($fill, 0, 0, $fw, $h) }
        } finally { $track.Dispose(); $fill.Dispose() }
    })
    return $pnl
}

function New-Label {
    param([string]$Text, [int]$X, [int]$Y, [int]$Width, [bool]$Bold = $false,
          $Color = [System.Drawing.Color]::FromArgb(30, 30, 30), [string]$Align = 'MiddleLeft', [int]$Size = 9)
    $l = New-Object System.Windows.Forms.Label
    $l.Text = $Text
    $l.Location = New-Object System.Drawing.Point $X, $Y
    $l.Size = New-Object System.Drawing.Size $Width, 20
    $style = if ($Bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $l.Font = New-Object System.Drawing.Font 'Segoe UI', $Size, $style
    $l.ForeColor = $Color
    $l.TextAlign = $Align
    $l.AutoEllipsis = $true
    return $l
}

function Show-DetailPanel {
    # Flyout anchored above the tray. Closes on focus loss like the Windows
    # volume/network flyouts. Clicking the tray again while open toggles it shut.
    param([Parameter(Mandatory)][scriptblock]$GetSnapshot, [scriptblock]$OnRefresh)

    if ($script:DetailForm -and -not $script:DetailForm.IsDisposed) {
        $script:DetailForm.Close(); $script:DetailForm = $null; return
    }
    $s = & $GetSnapshot

    $grey  = [System.Drawing.Color]::FromArgb(120, 120, 120)
    $W = 600; $pad = 16; $rowH = 30; $y = $pad
    $colName = 140; $colBar = 160; $colPct = 48; $colReset = $W - (2*$pad) - $colName - $colBar - $colPct - 24

    $f = New-Object System.Windows.Forms.Form
    $f.FormBorderStyle = 'None'; $f.ShowInTaskbar = $false; $f.TopMost = $true
    $f.StartPosition = 'Manual'; $f.BackColor = [System.Drawing.Color]::FromArgb(250, 250, 250)
    $f.Width = $W

    $title = New-Label -Text 'Claude usage' -X $pad -Y $y -Width 200 -Bold $true -Size 11
    $f.Controls.Add($title)
    $x = New-Label -Text ([string][char]0x2715) -X ($W - $pad - 20) -Y $y -Width 20 -Color $grey -Align 'MiddleCenter'
    $x.Cursor = 'Hand'; $x.Add_Click({ $this.FindForm().Close() })
    $f.Controls.Add($x)
    $y += 34

    $exhausted = [bool]($s.Spend -and $s.Spend.Exhausted)
    $live = @(Get-LiveBuckets $s.Buckets)
    foreach ($b in $live) {
        $pct = [int][math]::Round($b.Util * 100)
        $name = if ($b.IsActive) { ([string][char]0x25CF) + ' ' + $b.Label } else { $b.Label }
        $f.Controls.Add((New-Label -Text $name -X $pad -Y $y -Width $colName -Bold $b.IsActive))
        $bar = New-BarPanel -Util $b.Util -Color (Get-UtilColor $b.Util $false) -Width $colBar -Height 12
        $bar.Location = New-Object System.Drawing.Point ($pad + $colName), ($y + 4)
        $f.Controls.Add($bar)
        $f.Controls.Add((New-Label -Text "$pct%" -X ($pad + $colName + $colBar + 6) -Y $y -Width $colPct -Bold $true -Align 'MiddleRight'))
        $reset = if ($null -ne $b.ResetsAt) {
            $rem = Format-Remaining $b.ResetsAt
            $lead = if ($rem -eq 'now') { 'resetting' } else { "in $rem" }
            '{0}  {1}  {2:HH:mm}' -f $lead, [char]0x00B7, ([DateTime]$b.ResetsAt).ToLocalTime()
        } else { '' }
        $f.Controls.Add((New-Label -Text $reset -X ($pad + $colName + $colBar + $colPct + 18) -Y $y -Width $colReset -Color $grey))
        $y += $rowH
    }
    if ($live.Count -eq 0) {
        $f.Controls.Add((New-Label -Text 'No active limits' -X $pad -Y $y -Width 300 -Color $grey)); $y += $rowH
    }

    $idle = @(@($s.Buckets) | Where-Object { $null -ne $_ -and -not $_.IsActive -and $_.Util -le 0 })
    if ($idle.Count -gt 0) {
        $f.Controls.Add((New-Label -Text ('Idle: ' + (($idle | ForEach-Object { $_.Label }) -join ', ')) -X $pad -Y $y -Width ($W - 2*$pad) -Color $grey))
        $y += 26
    }

    if ($s.Spend) {
        $y += 6
        $f.Controls.Add((New-Label -Text 'Extra usage credits' -X $pad -Y $y -Width $colName -Bold $exhausted))
        $c = if ($exhausted) { [System.Drawing.Color]::FromArgb(200, 40, 40) } else { Get-UtilColor $s.Spend.Percent $false }
        $bar = New-BarPanel -Util $s.Spend.Percent -Color $c -Width $colBar -Height 12
        $bar.Location = New-Object System.Drawing.Point ($pad + $colName), ($y + 4)
        $f.Controls.Add($bar)
        $f.Controls.Add((New-Label -Text ("{0}%" -f [int][math]::Round($s.Spend.Percent*100)) -X ($pad + $colName + $colBar + 6) -Y $y -Width $colPct -Bold $true -Align 'MiddleRight'))
        $txt = $s.Spend.Text + $(if ($exhausted) { '  ' + [char]0x00B7 + '  exhausted' } else { '' })
        $f.Controls.Add((New-Label -Text $txt -X ($pad + $colName + $colBar + $colPct + 18) -Y $y -Width $colReset -Color $grey))
        $y += $rowH
    }

    # Footer
    $y += 6
    $sep = New-Object System.Windows.Forms.Panel
    $sep.Location = New-Object System.Drawing.Point $pad, $y; $sep.Size = New-Object System.Drawing.Size ($W - 2*$pad), 1
    $sep.BackColor = [System.Drawing.Color]::FromArgb(215, 215, 215); $f.Controls.Add($sep); $y += 8
    $foot = if ($s.FetchedUtc) { 'Fetched {0:HH:mm:ss}' -f ([DateTime]$s.FetchedUtc).ToLocalTime() } else { 'Never fetched' }
    if ($s.ErrorText) { $foot += '  ' + [char]0x00B7 + '  ' + $s.ErrorText }
    $f.Controls.Add((New-Label -Text $foot -X $pad -Y ($y + 3) -Width ($W - 2*$pad - 100) -Color $grey))
    if ($OnRefresh) {
        $btn = New-Object System.Windows.Forms.Button
        $btn.Text = 'Refresh'; $btn.FlatStyle = 'Flat'; $btn.Font = New-Object System.Drawing.Font 'Segoe UI', 9
        $btn.Size = New-Object System.Drawing.Size 80, 26
        $btn.Location = New-Object System.Drawing.Point ($W - $pad - 80), $y
        $btn.Tag = @{ Refresh = $OnRefresh; Get = $GetSnapshot }
        $btn.Add_Click({
            & $this.Tag.Refresh
            $get = $this.Tag.Get; $ref = $this.Tag.Refresh
            $this.FindForm().Close(); $script:DetailForm = $null
            Show-DetailPanel -GetSnapshot $get -OnRefresh $ref
        })
        $f.Controls.Add($btn)
    }
    $y += 26 + $pad
    $f.Height = $y

    $wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $f.Location = New-Object System.Drawing.Point ($wa.Right - $W - 12), ($wa.Bottom - $f.Height - 12)
    $f.Add_Deactivate({ $this.Close() })
    $f.Add_FormClosed({ $script:DetailForm = $null })
    $script:DetailForm = $f
    $f.Show(); $f.Activate()
}
