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
        $json  = Get-Content $path -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
        $oauth = Get-Prop $json 'claudeAiOauth'
        $tok   = [string](Get-Prop $oauth 'accessToken')
        if ([string]::IsNullOrWhiteSpace($tok)) { return $null }
        return @{ Token = $tok; ExpiresAtUtc = (ConvertTo-ExpiryUtc (Get-Prop $oauth 'expiresAt')) }
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
