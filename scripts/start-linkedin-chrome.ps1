param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 9333,

    [ValidatePattern('^[a-zA-Z0-9._-]+$')]
    [string]$AccountRef = 'liubov-lukina'
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$profilesRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $repoRoot 'data\linkedin_web_state')
)
$profileFolder = "chrome_profile_$($AccountRef -replace '-', '_')"
$profileRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $profilesRoot "$AccountRef\$profileFolder")
)

if (-not $profileRoot.StartsWith($profilesRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Resolved Chrome profile escaped data\linkedin_web_state.'
}

$chromeCandidates = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
)
$chromePath = $chromeCandidates |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
if (-not $chromePath) {
    throw 'Installed Google Chrome was not found.'
}

$endpoint = "http://127.0.0.1:$Port"
try {
    $existing = Invoke-RestMethod -Uri "$endpoint/json/version" -TimeoutSec 2
    Write-Output "Chrome CDP is already reachable at $endpoint"
    Write-Output "Browser: $($existing.Browser)"
    Write-Output 'No new Chrome process was started.'
    exit 0
} catch {
    # No process is listening on this account-specific endpoint.
}

New-Item -ItemType Directory -Force -Path $profileRoot | Out-Null

$arguments = @(
    "--remote-debugging-port=$Port",
    '--remote-debugging-address=127.0.0.1',
    "--user-data-dir=$profileRoot",
    '--no-first-run',
    '--no-default-browser-check',
    'https://www.linkedin.com/login'
)

# The window is intentionally visible so the operator can complete login.
Start-Process -FilePath $chromePath -ArgumentList $arguments

$deadline = [DateTime]::UtcNow.AddSeconds(20)
do {
    Start-Sleep -Milliseconds 250
    try {
        $version = Invoke-RestMethod -Uri "$endpoint/json/version" -TimeoutSec 2
        Write-Output "Chrome CDP ready at $endpoint"
        Write-Output "Browser: $($version.Browser)"
        Write-Output "Profile: $profileRoot"
        Write-Output 'Complete LinkedIn login manually and keep this window open.'
        exit 0
    } catch {
        if ([DateTime]::UtcNow -ge $deadline) {
            throw "Chrome started, but CDP was not reachable at $endpoint within 20 seconds."
        }
    }
} while ($true)
