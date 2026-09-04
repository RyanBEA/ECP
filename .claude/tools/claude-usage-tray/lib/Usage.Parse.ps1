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

# Keys that carry a 'utilization' but are not rate-limit buckets. Excluded
# from BOTH bucket discovery and scale detection - if buckets ever arrive 0-1
# while extra_usage stays 0-100, including it would divide every bucket by 100.
$script:NonBucketKeys = @('extra_usage')

function Get-Prop {
    # Safe property read for server-supplied JSON. Under Set-StrictMode Latest,
    # `$obj.missing` THROWS PropertyNotFoundException - and the server dropping
    # fields is this tool's stated threat model. The PSObject.Properties
    # indexer returns $null for a missing name and is also safe on scalars
    # (bool/number/string), where `.Properties.Name -contains` throws.
    param($Obj, [Parameter(Mandatory)][string]$Name)
    if ($null -eq $Obj) { return $null }
    $p = $Obj.PSObject.Properties[$Name]
    if ($null -eq $p) { return $null }
    return $p.Value
}

function Get-UtilizationNodes {
    # Every top-level property whose value is an object carrying a non-null
    # 'utilization'. This is how buckets are discovered without naming them:
    # the server adds and retires bucket keys without notice.
    param($Response)
    if ($null -eq $Response) { return ,@() }
    $nodes = @($Response.PSObject.Properties | Where-Object {
        $null -ne (Get-Prop $_.Value 'utilization')
    })
    return ,$nodes
}

function Get-UtilizationDivisor {
    # 'utilization' may arrive as 0-1 or 0-100. Deciding per value is wrong:
    # a max of exactly 1.0 is ambiguous, and the naive "if >1 divide by 100"
    # rule renders a true 1% reading as 100%. Decide once for the whole
    # response - if ANY bucket value exceeds 1, the response is 0-100.
    param($Response)
    foreach ($p in (Get-UtilizationNodes $Response)) {
        if ($script:NonBucketKeys -contains $p.Name) { continue }
        if ([double](Get-Prop $p.Value 'utilization') -gt 1.0) { return 100.0 }
    }
    return 1.0
}

function ConvertTo-ResetUtc {
    # resets_at is an ISO8601 string in current responses, but accept epoch
    # numbers too rather than trusting one shape.
    param($Raw)
    if ($null -eq $Raw) { return $null }
    if ($Raw -is [int] -or $Raw -is [int64] -or $Raw -is [double]) {
        if ([double]$Raw -le 0) { return $null }
        try { return [DateTimeOffset]::FromUnixTimeSeconds([int64]$Raw).UtcDateTime } catch { return $null }
    }
    $s = [string]$Raw
    if ([string]::IsNullOrWhiteSpace($s)) { return $null }
    try { return ([DateTimeOffset]::Parse($s, [cultureinfo]::InvariantCulture)).UtcDateTime } catch { return $null }
}

function ConvertTo-Limit {
    # Normalize one bucket node to a 0..1 fraction plus a UTC reset time.
    param($Node, [double]$Divisor)
    $raw = Get-Prop $Node 'utilization'
    if ($null -eq $raw) { return $null }
    $u = [double]$raw / $Divisor
    # Clamp so a glitched response cannot paint a 200% bar.
    if ($u -gt 1.0) { $u = 1.0 }
    if ($u -lt 0.0) { $u = 0.0 }
    return @{ Util = $u; ResetsAt = (ConvertTo-ResetUtc (Get-Prop $Node 'resets_at')) }
}
