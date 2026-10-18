# Runs API checks against a disposable copy. Never starts the real data store.
# Windows: powershell -ExecutionPolicy Bypass -File tests\run-isolated.ps1
# Optional: -IncludeUi (requires installed Microsoft Edge).
param([int]$Port = 0, [switch]$IncludeUi, [string]$EdgePath = '')
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('winner-tests-' + [guid]::NewGuid().ToString('N'))
$process = $null
try {
    # Refuse an occupied port before invoking any potentially writing test.
    $probe = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $Port)
    try { $probe.Start(); $Port = $probe.LocalEndpoint.Port } finally { $probe.Stop() }
    New-Item -ItemType Directory -Path $tempRoot | Out-Null
    foreach ($name in @('server.ps1', 'public', 'config', 'tests')) {
        Copy-Item -LiteralPath (Join-Path $project $name) -Destination $tempRoot -Recurse
    }
    $exe = (Get-Process -Id $PID).Path
    $scriptFile = Join-Path $tempRoot 'server.ps1'
    $process = Start-Process $exe -PassThru -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptFile`" -Port $Port -NoBrowser" -RedirectStandardOutput (Join-Path $tempRoot 'server.out') -RedirectStandardError (Join-Path $tempRoot 'server.err')
    $baseUrl = "http://localhost:$Port"
    $ready = $false
    for ($i = 0; $i -lt 50; $i++) {
        if ($process.HasExited) { throw (([IO.File]::ReadAllText((Join-Path $tempRoot 'server.out'))) + ([IO.File]::ReadAllText((Join-Path $tempRoot 'server.err')))) }
        try {
            $null = Invoke-WebRequest "$baseUrl/api/health" -UseBasicParsing
            if (Test-Path (Join-Path $tempRoot 'data/winners.json')) { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 100
    }
    if (-not $ready) { throw 'Temporary server did not start.' }
    # Verify this process owns the temporary store, avoiding tests against another server.
    if (-not (Test-Path (Join-Path $tempRoot 'data/winners.json'))) { throw 'Temporary store missing.' }
    & $exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $tempRoot 'tests/api-smoke-test.ps1') -BaseUrl $baseUrl
    if ($LASTEXITCODE -ne 0) { throw 'API checks failed.' }
    if ($IncludeUi) {
        $uiArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $tempRoot 'tests/ui-test.ps1'), '-BaseUrl', $baseUrl, '-OutDir', (Join-Path $tempRoot 'ui-output'))
        if ($EdgePath) { $uiArgs += @('-EdgePath', $EdgePath) }
        & $exe @uiArgs
        if ($LASTEXITCODE -ne 0) { throw 'UI checks failed.' }
    }
} finally {
    if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
    if (Test-Path $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}
