# Read-only preflight for an existing library. Writes only a separate report.
# Windows PowerShell 5.1; no installs, network calls or application startup.
param(
    [string]$LibraryPath = 'D:\CONTENT-REVENUE-OS',
    [string]$ReportDirectory = (Join-Path ([IO.Path]::GetTempPath()) ('winner-preflight-' + [guid]::NewGuid().ToString('N')))
)
$ErrorActionPreference = 'Stop'
$manifestPath = Join-Path $PSScriptRoot 'windows-uebernahme-manifest.json'
$manifest = [IO.File]::ReadAllText($manifestPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
$library = [IO.Path]::GetFullPath($LibraryPath).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
$reportDir = [IO.Path]::GetFullPath($ReportDirectory)
$prefix = $library + [IO.Path]::DirectorySeparatorChar
if ($reportDir.Equals($library, [StringComparison]::OrdinalIgnoreCase) -or $reportDir.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Der Bericht darf nicht im bestehenden Library-Ordner gespeichert werden.'
}
if (-not (Test-Path -LiteralPath $library -PathType Container)) { throw 'Der Library-Ordner wurde nicht gefunden.' }
# Refuse to overwrite a previous report or use an existing directory/junction.
if (Test-Path -LiteralPath $reportDir) { throw 'Bitte einen neuen, noch nicht vorhandenen Berichtsordner verwenden.' }

function Get-NormalizedHash([string]$Path) {
    $text = [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8).Replace("`r`n", "`n")
    $encoding = New-Object Text.UTF8Encoding($false)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash($encoding.GetBytes($text))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

$rows = @()
$blocked = $false
foreach ($entry in $manifest.files) {
    $path = [IO.Path]::GetFullPath((Join-Path $library $entry.path))
    if (-not $path.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Ungueltiger Dateipfad im Manifest.' }
    $hash = $null
    $exists = Test-Path -LiteralPath $path -PathType Leaf
    if ($exists) { $hash = Get-NormalizedHash $path }
    $matchesTarget = $exists -and $hash -eq $entry.targetNormalizedSha256
    $matchesBase = $exists -and $null -ne $entry.baseNormalizedSha256 -and $hash -eq $entry.baseNormalizedSha256
    if ($matchesTarget) { $state = 'Entspricht bereits dem Zielstand' }
    elseif ($entry.role -eq 'runtime' -and $matchesBase) { $state = 'Bekannter Ausgangsstand; Austausch planbar' }
    elseif ($entry.role -eq 'runtime' -and -not $exists -and $null -eq $entry.baseNormalizedSha256 -and -not (Test-Path -LiteralPath $path)) { $state = 'Neue Datei; Anlage planbar' }
    else { $state = 'ABBRUCH: fehlt oder weicht vom bekannten Stand ab'; $blocked = $true }
    $rows += [pscustomobject]@{ path = $entry.path; role = $entry.role; exists = $exists; normalizedSha256 = $hash; state = $state }
}
$dataFile = Join-Path (Join-Path $library 'data') 'winners.json'
$dataExists = Test-Path -LiteralPath $dataFile -PathType Leaf
if (-not $dataExists) { $blocked = $true }
$report = [ordered]@{
    checkedAtUtc = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    libraryPath = $library
    targetCommit = $manifest.targetCommit
    normalization = $manifest.normalization
    blocked = $blocked
    dataFileExists = $dataExists
    note = 'Nur Dateivergleich; keine Sicherung, Installation oder Startfreigabe. Nutzerdaten wurden nicht eingelesen.'
    files = $rows
}
New-Item -ItemType Directory -Path $reportDir | Out-Null
$reportFile = Join-Path $reportDir 'pruefbericht.json'
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText($reportFile, (ConvertTo-Json -InputObject $report -Depth 6), $utf8)
foreach ($row in $rows) { Write-Host "$($row.path): $($row.state)" }
if (-not $dataExists) { Write-Host 'ABBRUCH: data\winners.json fehlt; kein Start mit Beispieldaten erlaubt.' }
Write-Host "Bericht: $reportFile"
if ($blocked) { Write-Host 'Abweichungen zuerst klaeren. Es wurde nichts in der Library veraendert.'; exit 2 }
Write-Host 'Dateistand bekannt. Sicherung und Uebernahme sind weiterhin separat freizugeben.'
exit 0
