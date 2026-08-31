<#
.SYNOPSIS
    Makes this Windows machine run the HAKKIU stack under the REAL production
    hostnames, so local docker compose == the Hetzner server.

.DESCRIPTION
    Production serves five hostnames from 116.202.8.87 behind Caddy. To reproduce
    that locally the same names must resolve to 127.0.0.1, which means a hosts-file
    entry, which means Administrator. This script owns that block (it is fenced with
    markers, so -Remove never touches anything else in the file).

    -TrustCa additionally exports Caddy's internal root certificate out of the
    running container and installs it into the machine trust store, so
    https://hakkiu.com shows a normal padlock locally instead of a warning.

.PARAMETER Add
    Point the five hakkiu.com hostnames at 127.0.0.1. WHILE THIS IS ACTIVE THIS
    MACHINE CANNOT REACH THE LIVE SITE — every request goes to your containers.

.PARAMETER Remove
    Delete the block and go back to the real, public DNS.

.PARAMETER TrustCa
    Install Caddy's local CA root into Cert:\LocalMachine\Root (run once, after
    `docker compose up` has started caddy at least once).

.PARAMETER Status
    Show what is currently in effect. Does not require Administrator.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\local-parity.ps1 -Add
    docker compose up --build
    powershell -ExecutionPolicy Bypass -File scripts\local-parity.ps1 -TrustCa
#>
[CmdletBinding(DefaultParameterSetName = 'Status')]
param(
    [Parameter(ParameterSetName = 'Add')]     [switch]$Add,
    [Parameter(ParameterSetName = 'Remove')]  [switch]$Remove,
    [Parameter(ParameterSetName = 'TrustCa')] [switch]$TrustCa,
    [Parameter(ParameterSetName = 'Status')]  [switch]$Status
)

$ErrorActionPreference = 'Stop'

$HostsPath  = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
$BeginMark  = '# >>> HAKKIU local parity >>>'
$EndMark    = '# <<< HAKKIU local parity <<<'
$Hostnames  = @('hakkiu.com', 'www.hakkiu.com', 'admin.hakkiu.com', 'api.hakkiu.com', 'admin-api.hakkiu.com')
$RepoRoot   = Split-Path -Parent $PSScriptRoot

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    (New-Object Security.Principal.WindowsPrincipal $id).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Assert-Admin {
    if (-not (Test-Admin)) {
        throw "This needs an elevated shell. Right-click PowerShell -> 'Run as administrator', then re-run."
    }
}

# Returns the hosts file with our fenced block stripped out, preserving everything else.
function Get-HostsWithoutBlock {
    $lines = Get-Content -LiteralPath $HostsPath
    $out = New-Object System.Collections.Generic.List[string]
    $inside = $false
    foreach ($line in $lines) {
        if ($line.Trim() -eq $BeginMark) { $inside = $true; continue }
        if ($line.Trim() -eq $EndMark)   { $inside = $false; continue }
        if (-not $inside) { $out.Add($line) }
    }
    # Trim trailing blank lines so repeated Add/Remove cycles don't grow the file.
    while ($out.Count -gt 0 -and [string]::IsNullOrWhiteSpace($out[$out.Count - 1])) {
        $out.RemoveAt($out.Count - 1)
    }
    # Leading comma stops PowerShell unrolling the List into a fixed-size array,
    # which would make the .Add() calls in Invoke-Add fail.
    return ,$out
}

function Invoke-Add {
    Assert-Admin
    Copy-Item -LiteralPath $HostsPath -Destination "$HostsPath.hakkiu.bak" -Force
    $lines = Get-HostsWithoutBlock
    $lines.Add('')
    $lines.Add($BeginMark)
    $lines.Add('# Added by scripts\local-parity.ps1 so the local docker compose stack answers')
    $lines.Add('# on the production hostnames. Remove with: local-parity.ps1 -Remove')
    foreach ($h in $Hostnames) { $lines.Add("127.0.0.1 $h") }
    $lines.Add($EndMark)
    Set-Content -LiteralPath $HostsPath -Value $lines -Encoding ASCII
    ipconfig /flushdns | Out-Null
    Write-Host "hosts updated - the five hakkiu.com names now resolve to 127.0.0.1." -ForegroundColor Green
    Write-Host "This machine will NOT reach the live site until you run -Remove." -ForegroundColor Yellow
}

function Invoke-Remove {
    Assert-Admin
    $lines = Get-HostsWithoutBlock
    Set-Content -LiteralPath $HostsPath -Value $lines -Encoding ASCII
    ipconfig /flushdns | Out-Null
    Write-Host "hosts block removed - back to public DNS (116.202.8.87)." -ForegroundColor Green
}

function Invoke-TrustCa {
    Assert-Admin
    Push-Location $RepoRoot
    try {
        $tmp = Join-Path $env:TEMP 'hakkiu-caddy-local-root.crt'
        Write-Host "Exporting Caddy's internal root certificate from the caddy container..."
        docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt $tmp
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $tmp)) {
            throw "Could not copy the root cert. Is the caddy container running? Start it with 'docker compose up -d caddy' first."
        }
        Import-Certificate -FilePath $tmp -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
        Remove-Item $tmp -Force
        Write-Host "Caddy's local CA is now trusted machine-wide." -ForegroundColor Green
        Write-Host "Chrome/Edge: restart the browser. Firefox uses its OWN trust store - either" -ForegroundColor Yellow
        Write-Host "set security.enterprise_roots.enabled=true in about:config, or import the cert there." -ForegroundColor Yellow
    }
    finally { Pop-Location }
}

function Invoke-Status {
    $content = Get-Content -LiteralPath $HostsPath -Raw
    $active = $content -match [regex]::Escape($BeginMark)
    Write-Host ""
    Write-Host "hosts override : " -NoNewline
    if ($active) { Write-Host "ACTIVE (hakkiu.com -> 127.0.0.1)" -ForegroundColor Green }
    else         { Write-Host "not active (using public DNS)" -ForegroundColor Gray }

    Write-Host "resolution     :"
    foreach ($h in $Hostnames) {
        $ip = try { (Resolve-DnsName $h -Type A -ErrorAction Stop | Select-Object -First 1).IPAddress } catch { 'unresolved' }
        Write-Host ("  {0,-22} {1}" -f $h, $ip)
    }

    Write-Host "ports 80/443   :"
    foreach ($p in 80, 443) {
        $used = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
        if ($used) {
            $procs = ($used | ForEach-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName } | Sort-Object -Unique) -join ', '
            Write-Host ("  {0,-22} in use by {1}" -f $p, $procs) -ForegroundColor Yellow
        } else {
            Write-Host ("  {0,-22} free" -f $p)
        }
    }

    $ca = Get-ChildItem Cert:\LocalMachine\Root -ErrorAction SilentlyContinue |
          Where-Object { $_.Subject -like '*Caddy Local Authority*' }
    Write-Host "Caddy local CA : " -NoNewline
    if ($ca) { Write-Host "trusted" -ForegroundColor Green }
    else     { Write-Host "not installed (run -TrustCa)" -ForegroundColor Gray }
    Write-Host ""
}

switch ($PSCmdlet.ParameterSetName) {
    'Add'     { Invoke-Add }
    'Remove'  { Invoke-Remove }
    'TrustCa' { Invoke-TrustCa }
    default   { Invoke-Status }
}
