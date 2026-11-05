# Usage.Api.ps1 - credentials (READ ONLY) and the single HTTP call.
# The only network destination in this project is api.anthropic.com.
Set-StrictMode -Version Latest

$script:Version           = '0.1.0'
$script:UsageUrl          = 'https://api.anthropic.com/api/oauth/usage'
$script:AnthropicBeta     = 'oauth-2025-04-20'
$script:RequestTimeoutSec = 5
$script:SshTimeoutSec     = 10
$script:FetchInProgress   = $false
$script:MaxResponseBytes  = 1048576
$script:AuthBackoffSec    = 300
$script:MaxBackoffSec     = 3600
$script:SkewSeconds       = 60
$script:ExpiredMsg        = 'Auth expired - open Claude Code to refresh'
$script:CredSourceError   = $null

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

function ConvertTo-Credential {
    # PURE: raw credentials JSON text -> @{ Token; ExpiresAtUtc } or $null.
    # Shared by the local-file and SSH sources. Never reads refreshToken.
    param([string]$JsonText)
    if ([string]::IsNullOrWhiteSpace($JsonText)) { return $null }
    $json  = $JsonText | ConvertFrom-Json -ErrorAction Stop
    $oauth = Get-Prop $json 'claudeAiOauth'
    $tok   = [string](Get-Prop $oauth 'accessToken')
    if ([string]::IsNullOrWhiteSpace($tok)) { return $null }
    return @{ Token = $tok; ExpiresAtUtc = (ConvertTo-ExpiryUtc (Get-Prop $oauth 'expiresAt')) }
}

function Select-FreshestCredential {
    # PURE: from candidate credentials, pick the one whose token expires last.
    # Unknown expiry ranks lowest. $null candidates are skipped.
    param($Candidates)
    $best = $null
    foreach ($c in @($Candidates)) {
        if ($null -eq $c) { continue }
        if ($null -eq $best) { $best = $c; continue }
        $ce = $c.ExpiresAtUtc; $be = $best.ExpiresAtUtc
        if ($null -eq $ce) { continue }
        if ($null -eq $be -or $ce -gt $be) { $best = $c }
    }
    return $best
}

function Get-LocalCredentialText {
    $path = Get-CredentialPath
    if (-not (Test-Path $path)) { return $null }
    return (Get-Content $path -Raw -ErrorAction Stop)
}

function Invoke-NativeWithTimeout {
    # Run an external program with a HARD wall-clock deadline. On timeout the
    # whole process tree is killed. Everything in this tray runs on the WinForms
    # UI thread, so an unbounded native call freezes the icon and any open menu.
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$Arguments = @(),
        [Parameter(Mandatory)][int]$TimeoutMs
    )
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName               = $FilePath
    foreach ($a in $Arguments) { $psi.ArgumentList.Add($a) }
    $psi.UseShellExecute        = $false
    $psi.CreateNoWindow         = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.RedirectStandardInput  = $true

    $p = [System.Diagnostics.Process]::Start($psi)
    $p.StandardInput.Close()
    # Drain both pipes asynchronously: a synchronous ReadToEnd would itself
    # block past the deadline, and an undrained stderr can fill and deadlock.
    $outTask = $p.StandardOutput.ReadToEndAsync()
    $errTask = $p.StandardError.ReadToEndAsync()
    try {
        if (-not $p.WaitForExit($TimeoutMs)) {
            try { $p.Kill($true) } catch { }
            [void]$p.WaitForExit(2000)
            return @{ TimedOut = $true; ExitCode = $null; Output = $null; Pid = $p.Id }
        }
        $p.WaitForExit()   # flush async readers after exit
        [void]$errTask.Wait(1000)
        return @{ TimedOut = $false; ExitCode = $p.ExitCode; Output = $outTask.Result; Pid = $p.Id }
    } finally { $p.Dispose() }
}

function Get-SshCredentialText {
    # Read the credentials file from a machine where Claude Code actually runs
    # and therefore keeps its token fresh. READ ONLY. BatchMode: never prompt -
    # a prompt would hang the hidden tray process. ConnectTimeout only bounds
    # the TCP handshake: a link that drops AFTER connecting (sleep, Wi-Fi/VPN
    # change) left ssh blocked for days. ServerAlive* lets ssh notice; the hard
    # process deadline guarantees it regardless.
    param([string]$SshHost)
    $r = Invoke-NativeWithTimeout -FilePath 'ssh' -TimeoutMs ($script:SshTimeoutSec * 1000) -Arguments @(
        '-n', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5',
        '-o', 'ServerAliveInterval=3', '-o', 'ServerAliveCountMax=2',
        '-o', 'StrictHostKeyChecking=accept-new',
        $SshHost, 'cat ~/.claude/.credentials.json')
    if ($r.TimedOut) {
        Write-TrayLog "SSH read from $SshHost timed out after $($script:SshTimeoutSec)s - killed"
        return $null
    }
    if ($r.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($r.Output)) { return $null }
    return $r.Output
}

function Get-StoredCredential {
    # Reads BOTH the local file and, if CLAUDE_USAGE_TRAY_SSH=user@host is set,
    # the server's file - then uses whichever token expires later. Local covers
    # days you work here; the server covers SSH days. Claude Code owns token
    # rotation; this tool never writes credentials anywhere and never reads
    # refreshToken. Sets $script:CredSourceError when a source failed.
    $script:CredSourceError = $null
    $candidates = @()
    try {
        $t = Get-LocalCredentialText
        if ($t) { $candidates += ConvertTo-Credential $t }
    } catch {
        # Log the exception TYPE only - a raw error record can embed fragments
        # of the text being parsed, i.e. the access token.
        Write-TrayLog ('Failed to read local credentials ({0})' -f $_.Exception.GetType().Name)
    }
    $sshHost = $env:CLAUDE_USAGE_TRAY_SSH
    if ($sshHost) {
        try {
            $t = Get-SshCredentialText $sshHost
            if ($t) { $candidates += ConvertTo-Credential $t }
            else    { $script:CredSourceError = "Server unreachable ($sshHost)" }
        } catch {
            Write-TrayLog ('Failed to read SSH credentials ({0})' -f $_.Exception.GetType().Name)
            $script:CredSourceError = "Server unreachable ($sshHost)"
        }
    }
    return (Select-FreshestCredential $candidates)
}

function Invoke-UsageFetch {
    # Updates $script:State in place. Returns nothing.
    # Re-entrancy guard: blocking waits on the STA UI thread still pump some
    # messages, so a timer tick or click can re-enter mid-fetch (observed: three
    # stacked ssh processes). One fetch at a time.
    if ($script:FetchInProgress) { return }
    $script:FetchInProgress = $true
    try { Invoke-UsageFetchCore } finally { $script:FetchInProgress = $false }
}

function Invoke-UsageFetchCore {
    if ((Get-Date) -lt $script:State.BackoffUntil) {
        Write-TrayLog ('Skipping fetch - backing off until {0:HH:mm:ss}' -f $script:State.BackoffUntil)
        return
    }

    $cred = Get-StoredCredential
    if ($null -eq $cred) {
        $script:State.ErrorText = if ($script:CredSourceError) { $script:CredSourceError } else { 'Claude Code not signed in' }
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
