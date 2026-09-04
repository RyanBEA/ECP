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
    if ($null -eq $Response) { return @() }
    $nodes = @($Response.PSObject.Properties | Where-Object {
        $null -ne (Get-Prop $_.Value 'utilization')
    })
    return $nodes
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
    # ConvertFrom-Json on PS7 turns ISO8601 strings into [DateTime] objects
    # already. Casting one to [string] drops the sub-second fraction, which
    # collapses every reset stamp onto the same value and breaks prefix
    # derivation. Handle the typed forms first.
    if ($Raw -is [DateTimeOffset]) { return $Raw.UtcDateTime }
    if ($Raw -is [DateTime]) {
        if ($Raw.Kind -eq [DateTimeKind]::Unspecified) { return [DateTime]::SpecifyKind($Raw, [DateTimeKind]::Utc) }
        return $Raw.ToUniversalTime()
    }
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

function ConvertTo-ModelSlug {
    # 'Fable' -> 'fable'; 'Claude Opus 5' -> 'claude_opus_5'
    param([Parameter(Mandatory)][string]$DisplayName)
    $chars = $DisplayName.ToLowerInvariant().ToCharArray() |
        ForEach-Object { if ([char]::IsLetterOrDigit($_)) { $_ } else { ' ' } }
    $cleaned = -join $chars
    return (($cleaned -split '\s+' | Where-Object { $_ }) -join '_')
}

function Get-PrettyBucketLabel {
    # Human label for a discovered key. Known periods get proper names; any
    # unknown key (including server codenames) is title-cased from its slug.
    param([Parameter(Mandatory)][string]$Key)
    $ti = [System.Globalization.CultureInfo]::InvariantCulture.TextInfo
    switch ($Key) {
        'five_hour' { return 'Session (5h)' }
        'seven_day' { return 'Weekly (all)' }
        default {
            if ($Key -like 'seven_day_*') {
                $model = ($Key -replace '^seven_day_', '') -replace '_', ' '
                return "Weekly - $($ti.ToTitleCase($model))"
            }
            return $ti.ToTitleCase(($Key -replace '_', ' '))
        }
    }
}

function Get-UsageBuckets {
    <#
      Normalize a usage response into a sorted bucket list. No bucket key and
      no model name is hardcoded: the server versions this schema and changes
      it without notice. As of 2026-09-04 the legacy top-level per-model
      fields (seven_day_sonnet, seven_day_opus) are null and per-model limits
      appear ONLY inside limits[] as entries with scope.model.
    #>
    param($Response)
    if ($null -eq $Response) { return @() }

    $divisor = Get-UtilizationDivisor $Response
    $buckets = [ordered]@{}

    # --- Pass 1: top-level buckets ---
    foreach ($p in (Get-UtilizationNodes $Response)) {
        if ($script:NonBucketKeys -contains $p.Name) { continue }
        $lim = ConvertTo-Limit $p.Value $divisor
        if ($null -eq $lim) { continue }
        $buckets[$p.Name] = @{
            Key      = $p.Name
            Label    = (Get-PrettyBucketLabel $p.Name)
            Util     = $lim.Util
            ResetsAt = $lim.ResetsAt
            IsActive = $false
            Severity = $null
        }
    }

    # Every JSON field below is read via Get-Prop: the server dropping a field
    # is the threat model, and a bare `$l.field` throws under strict mode.
    $limits = @()
    $rawLimits = Get-Prop $Response 'limits'
    if ($null -ne $rawLimits) { $limits = @($rawLimits | Where-Object { $null -ne $_ }) }

    # --- resets_at -> existing top-level field name (the prefix source) ---
    $resetToField = @{}
    foreach ($key in @($buckets.Keys)) {
        $r = $buckets[$key].ResetsAt
        if ($null -ne $r) {
            $stamp = $r.ToString('o')
            if (-not $resetToField.ContainsKey($stamp)) { $resetToField[$stamp] = $key }
        }
    }

    # --- group -> period prefix, via the NON-scoped limit of that group ---
    # Must use the non-scoped sibling: in a real response the weekly group's
    # non-scoped resets_at matches top-level seven_day to the microsecond,
    # while the scoped entry's own timestamp differs. Matching on the scoped
    # entry's timestamp finds nothing.
    $groupPrefix = @{}
    foreach ($l in $limits) {
        if ($null -ne (Get-Prop $l 'scope')) { continue }
        $g = [string](Get-Prop $l 'group')
        $r = ConvertTo-ResetUtc (Get-Prop $l 'resets_at')
        if (-not $g -or $null -eq $r) { continue }
        $stamp = $r.ToString('o')
        if ($resetToField.ContainsKey($stamp) -and -not $groupPrefix.ContainsKey($g)) {
            $groupPrefix[$g] = $resetToField[$stamp]
        }
    }

    # --- Pass 2: model-scoped limits ---
    foreach ($l in $limits) {
        $display = Get-Prop (Get-Prop (Get-Prop $l 'scope') 'model') 'display_name'
        if ([string]::IsNullOrWhiteSpace([string]$display)) { continue }
        $g = [string](Get-Prop $l 'group')
        if (-not $groupPrefix.ContainsKey($g)) { continue }   # prefix not derivable - skip, never guess
        $key = '{0}_{1}' -f $groupPrefix[$g], (ConvertTo-ModelSlug ([string]$display))
        if ($buckets.Contains($key)) { continue }             # top-level data wins - higher precision

        # limits[].percent is always 0-100 by definition of the field name,
        # independent of the 'utilization' scale detected above.
        $u = [double]0
        $pct = Get-Prop $l 'percent'
        if ($null -ne $pct) { $u = [double]$pct / 100.0 }
        if ($u -gt 1.0) { $u = 1.0 }
        if ($u -lt 0.0) { $u = 0.0 }

        $buckets[$key] = @{
            Key      = $key
            Label    = (Get-PrettyBucketLabel $key)
            Util     = $u
            ResetsAt = (ConvertTo-ResetUtc (Get-Prop $l 'resets_at'))
            IsActive = [bool](Get-Prop $l 'is_active')
            Severity = [string](Get-Prop $l 'severity')
        }
    }

    # --- Flag top-level buckets active from their non-scoped limits entry ---
    foreach ($l in $limits) {
        if ($null -ne (Get-Prop $l 'scope')) { continue }
        $g = [string](Get-Prop $l 'group')
        if (-not $groupPrefix.ContainsKey($g)) { continue }
        $key = $groupPrefix[$g]
        if ($buckets.Contains($key)) {
            if ([bool](Get-Prop $l 'is_active')) { $buckets[$key].IsActive = $true }
            $sev = Get-Prop $l 'severity'
            if ($sev) { $buckets[$key].Severity = [string]$sev }
        }
    }

    # Leading comma prevents PowerShell unrolling the array on output, so a
    # one-bucket result is still an array and an empty one is @(), not
    # AutomationNull. Callers wrap in @(...) as well - belt and braces.
    $sorted = @($buckets.Values | Sort-Object -Property @{ Expression = { $_.Util }; Descending = $true })
    return $sorted
}

function ConvertTo-Money {
    # The API sends money as minor units plus an exponent, with an explicit
    # currency. 5009 with exponent 2 is 50.09. Never assume USD or 2 decimals.
    param($MoneyNode)
    $minor = Get-Prop $MoneyNode 'amount_minor'
    if ($null -eq $minor) { return $null }
    $exp = 0
    $rawExp = Get-Prop $MoneyNode 'exponent'
    if ($null -ne $rawExp) { $exp = [int]$rawExp }
    $amount = [double]$minor / [math]::Pow(10, $exp)
    $cur = [string](Get-Prop $MoneyNode 'currency')
    return @{
        Amount   = $amount
        Currency = $cur
        Text     = ('{0} {1}' -f $amount.ToString("F$exp", [cultureinfo]::InvariantCulture), $cur)
    }
}

function Get-SpendInfo {
    # Extra-usage credits. Returns $null when spend is absent or disabled, so
    # callers can simply omit the line.
    param($Response)
    $s = Get-Prop $Response 'spend'
    if ($null -eq $s -or -not [bool](Get-Prop $s 'enabled')) { return $null }

    $used  = ConvertTo-Money (Get-Prop $s 'used')
    $limit = ConvertTo-Money (Get-Prop $s 'limit')
    if ($null -eq $used -or $null -eq $limit) { return $null }

    $pct = 0.0
    $rawPct = Get-Prop $s 'percent'
    if ($null -ne $rawPct) { $pct = [double]$rawPct / 100.0 }
    if ($pct -gt 1.0) { $pct = 1.0 }
    if ($pct -lt 0.0) { $pct = 0.0 }

    $exp = 0
    $rawExp = Get-Prop (Get-Prop $s 'used') 'exponent'
    if ($null -ne $rawExp) { $exp = [int]$rawExp }
    $inv = [cultureinfo]::InvariantCulture

    return @{
        Used      = $used
        Limit     = $limit
        Percent   = $pct
        Severity  = [string](Get-Prop $s 'severity')
        Exhausted = ($used.Amount -ge $limit.Amount)
        Text      = ('{0} / {1} {2}' -f $used.Amount.ToString("F$exp", $inv),
                                        $limit.Amount.ToString("F$exp", $inv),
                                        $used.Currency)
    }
}
