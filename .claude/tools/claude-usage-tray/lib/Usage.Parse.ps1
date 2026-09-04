# Usage.Parse.ps1 - PURE response normalization. No I/O, no WinForms, no network.
# Dot-sourced by both the tray entry script and the test suite.
Set-StrictMode -Version Latest

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
