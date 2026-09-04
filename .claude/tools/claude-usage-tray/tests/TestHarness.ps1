# Zero-dependency assertion harness. Pester 3.4 (the only version present)
# uses incompatible syntax and does not target PowerShell 7.
$script:TestTotal    = 0
$script:TestFailures = 0

function Assert-Equal {
    param($Expected, $Actual, [Parameter(Mandatory)][string]$Name)
    $script:TestTotal++
    $ok = if ($null -eq $Expected) { $null -eq $Actual } else { $Expected -eq $Actual }
    if ($ok) {
        Write-Host "  PASS  $Name" -ForegroundColor Green
    } else {
        $script:TestFailures++
        Write-Host "  FAIL  $Name" -ForegroundColor Red
        Write-Host "        expected: <$Expected>" -ForegroundColor Red
        Write-Host "        actual:   <$Actual>"   -ForegroundColor Red
    }
}

function Assert-Near {
    param([double]$Expected, $Actual, [Parameter(Mandatory)][string]$Name, [double]$Tolerance = 0.0001)
    $script:TestTotal++
    if ($null -ne $Actual -and [math]::Abs([double]$Actual - $Expected) -le $Tolerance) {
        Write-Host "  PASS  $Name" -ForegroundColor Green
    } else {
        $script:TestFailures++
        Write-Host "  FAIL  $Name (expected ~$Expected, got <$Actual>)" -ForegroundColor Red
    }
}

function Assert-True {
    param($Condition, [Parameter(Mandatory)][string]$Name)
    Assert-Equal -Expected $true -Actual ([bool]$Condition) -Name $Name
}

function Assert-Null {
    param($Value, [Parameter(Mandatory)][string]$Name)
    Assert-Equal -Expected $null -Actual $Value -Name $Name
}

function Get-TestFixture {
    param([Parameter(Mandatory)][string]$Name)
    $path = Join-Path $PSScriptRoot "fixtures/$Name"
    return (Get-Content $path -Raw | ConvertFrom-Json)
}

function Invoke-TestSummary {
    Write-Host ""
    if ($script:TestFailures -eq 0) {
        Write-Host "$script:TestTotal passed, 0 failed" -ForegroundColor Green
    } else {
        Write-Host "$script:TestTotal run, $script:TestFailures FAILED" -ForegroundColor Red
    }
    return $script:TestFailures
}
