# Content Revenue OS - Winner Library V1
# Local web server: Windows PowerShell 5.1 + System.Net.HttpListener, no installs needed.
# Data is stored in data\winners.json. Field definitions live in config\winner-fields.json.
# Keep this file ASCII-only: Windows PowerShell reads BOM-less scripts as ANSI.

param(
    [int]$Port = 8787,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$Root       = $PSScriptRoot
$PublicDir  = [IO.Path]::GetFullPath((Join-Path $Root 'public'))
$DataDir    = Join-Path $Root 'data'
$BackupDir  = Join-Path $DataDir 'backups'
$DataFile   = Join-Path $DataDir 'winners.json'
$SchemaFile = Join-Path $Root 'config\winner-fields.json'
$SeedFile   = Join-Path $Root 'config\seed.json'

$Utf8NoBom  = New-Object System.Text.UTF8Encoding($false)
$Invariant  = [Globalization.CultureInfo]::InvariantCulture
$MaxBodyBytes  = 20MB
$MaxTextLength = 20000
$MaxImportItems = 5000
$AllowedOrigins = @("http://localhost:$Port")

# German umlauts for user-facing messages (this file must stay ASCII-only).
$ae = [char]0x00E4; $oe = [char]0x00F6; $ue = [char]0x00FC

# ---------------------------------------------------------------- file helpers

function Read-TextFile([string]$Path) {
    return [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8)
}

function Write-TextFile([string]$Path, [string]$Text) {
    # Write to a temp file first, then swap, so a crash never leaves a half-written data file.
    $tmp = "$Path.tmp"
    [IO.File]::WriteAllText($tmp, $Text, $Utf8NoBom)
    Move-Item -LiteralPath $tmp -Destination $Path -Force
}

function Get-NowIso { return (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ', $Invariant) }

# ---------------------------------------------------------------- schema

$SchemaText = Read-TextFile $SchemaFile
$Schema     = $SchemaText | ConvertFrom-Json
$Fields     = @($Schema.fields)
$ScoreKeys  = @($Fields | Where-Object { $_.type -eq 'score' } | ForEach-Object { $_.key })

function Test-Blank($Value) {
    return ($null -eq $Value) -or (($Value -is [string]) -and ($Value.Trim() -eq ''))
}

function ConvertTo-NumberValue($Value, [string]$Label, [bool]$WholeOnly, $Errors) {
    $num = $null
    if ($Value -is [int] -or $Value -is [long] -or $Value -is [double] -or $Value -is [decimal]) {
        $num = [double]$Value
    } else {
        $s = ([string]$Value).Trim() -replace '\s', ''
        if ($s -match '^\d+(\.\d+)?$') { $num = [double]::Parse($s, $Invariant) }
        elseif ($s -match '^\d+,\d{1,2}$') { $num = [double]::Parse(($s -replace ',', '.'), $Invariant) }
        else { $Errors.Add("${Label}: '$s' ist keine g${ue}ltige Zahl."); return $null }
    }
    if ([double]::IsNaN($num) -or [double]::IsInfinity($num)) { $Errors.Add("${Label}: keine endliche Zahl."); return $null }
    if ($num -lt 0) { $Errors.Add("${Label}: darf nicht negativ sein."); return $null }
    if ($WholeOnly) {
        if ($num -ne [math]::Floor($num)) { $Errors.Add("${Label}: muss eine ganze Zahl sein."); return $null }
        if ($num -ge 9223372036854775808.0) { $Errors.Add("${Label}: Zahl ist zu gross."); return $null }
        return [long]$num
    }
    return [math]::Round($num, 2)
}

function Get-OverallScore($Item) {
    $vals = @()
    foreach ($k in $ScoreKeys) { if ($null -ne $Item[$k]) { $vals += [double]$Item[$k] } }
    if ($vals.Count -eq 0) { return @{ score = $null; count = 0 } }
    $avg = ($vals | Measure-Object -Average).Average
    $score = [int][math]::Round($avg * 10, 0, [MidpointRounding]::AwayFromZero)
    return @{ score = $score; count = $vals.Count }
}

# Validates and cleans one record. $Source is a parsed JSON object; unknown properties are dropped.
# Returns @{ item = [ordered]...; errors = List[string] }
function ConvertTo-CleanItem($Source, [bool]$IsNew) {
    $errors = New-Object 'System.Collections.Generic.List[string]'
    $props = @{}
    if ($null -ne $Source) {
        foreach ($p in $Source.PSObject.Properties) { $props[$p.Name] = $p.Value }
    }

    $out = [ordered]@{}
    $id = [string]$props['id']
    if ($id -notmatch '^[A-Za-z0-9_-]{1,64}$') { $id = [guid]::NewGuid().ToString() }
    $out['id'] = $id

    foreach ($f in $Fields) {
        $key = $f.key
        $label = $f.label
        if ($f.type -eq 'computed') { $out[$key] = $null; $out['scoredCount'] = 0; continue }

        $v = $props[$key]
        if ((Test-Blank $v) -and $IsNew -and $f.default) {
            if ($f.default -eq 'today') { $v = (Get-Date).ToString('yyyy-MM-dd', $Invariant) } else { $v = $f.default }
        }
        if (Test-Blank $v) {
            $out[$key] = $null
            if ($f.required) { $errors.Add("$label ist ein Pflichtfeld.") }
            continue
        }

        $clean = $null
        switch ($f.type) {
            'select' {
                $s = ([string]$v).Trim()
                $match = @($f.options | Where-Object { $_ -eq $s }) | Select-Object -First 1
                if ($match) { $clean = $match }
                else { $errors.Add("${label}: '$s' ist nicht erlaubt. Erlaubt sind: $($f.options -join ', ').") }
            }
            'url' {
                $s = ([string]$v).Trim()
                if ($s -match '^https?://\S+$' -and $s.Length -le 2000) { $clean = $s }
                else { $errors.Add("${label}: muss eine Webadresse sein, die mit http:// oder https:// beginnt.") }
            }
            'date' {
                $s = ([string]$v).Trim()
                $d = [datetime]::MinValue
                if ($s -match '^\d{4}-\d{2}-\d{2}$' -and [datetime]::TryParseExact($s, 'yyyy-MM-dd', $Invariant, [Globalization.DateTimeStyles]::None, [ref]$d)) { $clean = $s }
                else { $errors.Add("${label}: bitte im Format JJJJ-MM-TT angeben.") }
            }
            'number' { $clean = ConvertTo-NumberValue $v $label $true $errors }
            'money'  { $clean = ConvertTo-NumberValue $v $label $false $errors }
            'score' {
                $n = ConvertTo-NumberValue $v $label $true $errors
                if ($null -ne $n) {
                    if ($n -ge 1 -and $n -le 10) { $clean = [int]$n }
                    else { $errors.Add("${label}: muss zwischen 1 und 10 liegen.") }
                }
            }
            default {
                # text / longtext
                $s = ([string]$v).Trim()
                if ($s.Length -gt $MaxTextLength) { $errors.Add("${label}: zu lang (maximal $MaxTextLength Zeichen).") }
                else { $clean = $s }
            }
        }
        $out[$key] = $clean
    }

    $overall = Get-OverallScore $out
    $out['overallScore'] = $overall.score
    $out['scoredCount']  = $overall.count

    $now = Get-NowIso
    $created = [string]$props['createdAt']
    if ($created -notmatch '^\d{4}-\d{2}-\d{2}T') { $created = $now }
    $out['createdAt'] = $created
    $out['updatedAt'] = $now

    return @{ item = $out; errors = $errors }
}

# ---------------------------------------------------------------- data store (in memory + JSON file)

$script:Items = New-Object 'System.Collections.Generic.List[object]'

function Backup-Daily {
    if (-not (Test-Path -LiteralPath $DataFile)) { return }
    $target = Join-Path $BackupDir ('winners-' + (Get-Date).ToString('yyyy-MM-dd', $Invariant) + '.json')
    if (-not (Test-Path -LiteralPath $target)) { Copy-Item -LiteralPath $DataFile -Destination $target }
}

function Save-Items {
    Backup-Daily
    $json = ConvertTo-Json -InputObject @($script:Items.ToArray()) -Depth 10
    Write-TextFile $DataFile $json
}

function Find-ItemIndex([string]$Id) {
    for ($i = 0; $i -lt $script:Items.Count; $i++) {
        if ($script:Items[$i].id -eq $Id) { return $i }
    }
    return -1
}

function Initialize-Store {
    foreach ($d in @($DataDir, $BackupDir)) {
        if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d | Out-Null }
    }
    if (Test-Path -LiteralPath $DataFile) {
        $text = Read-TextFile $DataFile
        if (-not [string]::IsNullOrWhiteSpace($text)) {
            try { $parsed = $text | ConvertFrom-Json }
            catch {
                Write-Host "FEHLER: $DataFile ist kein g${ue}ltiges JSON. Bitte reparieren oder eine Sicherung aus data\backups wiederherstellen." -ForegroundColor Red
                Write-Host "Der Server wurde NICHT gestartet, damit deine Daten nicht ${ue}berschrieben werden." -ForegroundColor Red
                exit 1
            }
            foreach ($p in @($parsed)) { $script:Items.Add($p) }
        }
        Write-Host "$($script:Items.Count) Eintr${ae}ge aus data\winners.json geladen"
    } else {
        # Assign first: in PowerShell 5.1, @(... | ConvertFrom-Json) would nest the parsed array inside another array.
        $seed = (Read-TextFile $SeedFile) | ConvertFrom-Json
        foreach ($s in @($seed)) {
            $r = ConvertTo-CleanItem $s $true
            if ($r.errors.Count -eq 0) { $script:Items.Add([pscustomobject]$r.item) }
        }
        Save-Items
        Write-Host "data\winners.json mit $($script:Items.Count) Beispiel-Eintrag/Eintr${ae}gen angelegt"
    }
}

# ---------------------------------------------------------------- exports

function Protect-CsvValue([string]$Value) {
    # Stops spreadsheet programs from treating text as a formula (CSV injection).
    if ($Value -match '^[=+\-@\t\r]') { return "'" + $Value }
    return $Value
}

function Get-CsvText {
    $headers = @('ID') + @($Fields | ForEach-Object { $_.label }) + @('Bewertete Kriterien (von 8)', 'Angelegt (UTC)', 'Zuletzt bearbeitet (UTC)')
    if ($script:Items.Count -eq 0) {
        $sep = (Get-Culture).TextInfo.ListSeparator
        return (($headers | ForEach-Object { '"' + $_ + '"' }) -join $sep)
    }
    $rows = foreach ($it in $script:Items) {
        $o = [ordered]@{}
        $o['ID'] = $it.id
        foreach ($f in $Fields) {
            $v = $it.($f.key)
            if ($v -is [string]) { $v = Protect-CsvValue $v }
            $o[$f.label] = $v
        }
        $o['Bewertete Kriterien (von 8)'] = $it.scoredCount
        $o['Angelegt (UTC)'] = $it.createdAt
        $o['Zuletzt bearbeitet (UTC)'] = $it.updatedAt
        [pscustomobject]$o
    }
    # -UseCulture: uses the Windows list separator (';' on German systems) so Excel opens it in columns.
    return (($rows | ConvertTo-Csv -NoTypeInformation -UseCulture) -join "`r`n")
}

function Get-ExportObject {
    return [ordered]@{
        app           = $Schema.name
        schemaVersion = $Schema.schemaVersion
        exportedAt    = Get-NowIso
        scoreFormula  = $Schema.scoreFormula
        itemCount     = $script:Items.Count
        items         = @($script:Items.ToArray())
    }
}

# ---------------------------------------------------------------- HTTP helpers

function Send-Bytes($Ctx, [int]$Status, [string]$ContentType, [byte[]]$Bytes, $Headers) {
    $res = $Ctx.Response
    $res.StatusCode = $Status
    $res.ContentType = $ContentType
    $res.AddHeader('Cache-Control', 'no-store')
    $res.AddHeader('X-Content-Type-Options', 'nosniff')
    if ($Headers) { foreach ($k in $Headers.Keys) { $res.AddHeader($k, $Headers[$k]) } }
    $res.ContentLength64 = $Bytes.Length
    $res.OutputStream.Write($Bytes, 0, $Bytes.Length)
    $res.OutputStream.Close()
}

function Send-Json($Ctx, [int]$Status, $Object) {
    $json = ConvertTo-Json -InputObject $Object -Depth 10
    Send-Bytes $Ctx $Status 'application/json; charset=utf-8' $Utf8NoBom.GetBytes($json)
}

function Send-Error($Ctx, [int]$Status, [string]$Message, $Details) {
    $body = [ordered]@{ error = $Message }
    if ($Details) { $body['details'] = @($Details) }
    Send-Json $Ctx $Status $body
}

function Read-JsonBody($Ctx) {
    $reader = New-Object IO.StreamReader($Ctx.Request.InputStream, [Text.Encoding]::UTF8)
    $text = $reader.ReadToEnd()
    $reader.Close()
    if ([string]::IsNullOrWhiteSpace($text)) { throw 'Die Anfrage ist leer.' }
    try {
        # Validate the original document before wrapping it (prevents sibling-property injection).
        $null = $text | ConvertFrom-Json
        # A property preserves arrays even when ConvertFrom-Json enumerates its top-level result.
        # -NoEnumerate is unavailable in Windows PowerShell 5.1.
        $envelope = ('{"value":' + $text + '}') | ConvertFrom-Json
        $parsed = $envelope.value
        return ,$parsed
    } catch { throw "Die Anfrage enth${ae}lt kein g${ue}ltiges JSON." }
}

$MimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.ico'  = 'image/x-icon'
    '.json' = 'application/json; charset=utf-8'
}

function Send-StaticFile($Ctx, [string]$UrlPath) {
    if ($UrlPath -eq '/') { $UrlPath = '/index.html' }
    $separator = [IO.Path]::DirectorySeparatorChar
    $rel = [Uri]::UnescapeDataString($UrlPath).TrimStart('/') -replace '[/\\]', [string]$separator
    $full = [IO.Path]::GetFullPath((Join-Path $PublicDir $rel))
    if (-not $full.StartsWith($PublicDir + $separator, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
        Send-Error $Ctx 404 'Not found'
        return
    }
    $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
    $type = $MimeTypes[$ext]
    if (-not $type) { $type = 'application/octet-stream' }
    $headers = @{}
    if ($ext -eq '.html') {
        $headers['Content-Security-Policy'] = "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    }
    Send-Bytes $Ctx 200 $type ([IO.File]::ReadAllBytes($full)) $headers
}

# ---------------------------------------------------------------- request handling

function Invoke-Request($Ctx) {
    $req = $Ctx.Request
    $method = $req.HttpMethod
    $path = $req.Url.AbsolutePath

    if ($method -in @('POST', 'PUT', 'DELETE')) {
        # Block other websites open in the browser from changing local data.
        $origin = $req.Headers['Origin']
        if ($origin -and ($AllowedOrigins -notcontains $origin)) { Send-Error $Ctx 403 'Cross-origin requests are not allowed.'; return }
        if ($method -ne 'DELETE' -and ([string]$req.ContentType) -notlike 'application/json*') { Send-Error $Ctx 415 'Content-Type must be application/json.'; return }
        if ($req.ContentLength64 -gt $MaxBodyBytes) { Send-Error $Ctx 413 'Request too large (max 20 MB).'; return }
    }

    if ($path -eq '/api/health' -and $method -eq 'GET') { Send-Json $Ctx 200 @{ ok = $true; items = $script:Items.Count }; return }

    if ($path -eq '/api/schema' -and $method -eq 'GET') {
        Send-Bytes $Ctx 200 'application/json; charset=utf-8' $Utf8NoBom.GetBytes($SchemaText)
        return
    }

    if ($path -eq '/api/items') {
        if ($method -eq 'GET') { Send-Json $Ctx 200 @($script:Items.ToArray()); return }
        if ($method -eq 'POST') {
            $body = Read-JsonBody $Ctx
            if ($null -eq $body -or $body -is [array]) { Send-Error $Ctx 400 'Send one item as a JSON object. Use /api/import for several items.'; return }
            $r = ConvertTo-CleanItem $body $true
            $r.item['id'] = [guid]::NewGuid().ToString()   # server always assigns ids for new items
            $r.item['createdAt'] = $r.item['updatedAt']
            if ($r.errors.Count -gt 0) { Send-Error $Ctx 400 'Bitte Folgendes korrigieren:' $r.errors; return }
            $obj = [pscustomobject]$r.item
            $script:Items.Add($obj)
            Save-Items
            Send-Json $Ctx 201 $obj
            return
        }
    }

    if ($path -match '^/api/items/([A-Za-z0-9_-]{1,64})$') {
        $id = $Matches[1]
        $idx = Find-ItemIndex $id
        if ($idx -lt 0) { Send-Error $Ctx 404 'Eintrag nicht gefunden.'; return }
        $existing = $script:Items[$idx]

        if ($method -eq 'GET') { Send-Json $Ctx 200 $existing; return }
        if ($method -eq 'PUT') {
            # Merge: fields not sent keep their current value, so agents can send partial updates.
            $body = Read-JsonBody $Ctx
            if ($null -eq $body -or $body -is [array]) { Send-Error $Ctx 400 'Send the changes as one JSON object.'; return }
            $merged = [ordered]@{}
            foreach ($p in $existing.PSObject.Properties) { $merged[$p.Name] = $p.Value }
            foreach ($p in $body.PSObject.Properties) { $merged[$p.Name] = $p.Value }
            $merged['id'] = $existing.id
            $merged['createdAt'] = $existing.createdAt
            $r = ConvertTo-CleanItem ([pscustomobject]$merged) $false
            if ($r.errors.Count -gt 0) { Send-Error $Ctx 400 'Bitte Folgendes korrigieren:' $r.errors; return }
            $obj = [pscustomobject]$r.item
            $script:Items[$idx] = $obj
            Save-Items
            Send-Json $Ctx 200 $obj
            return
        }
        if ($method -eq 'DELETE') {
            $script:Items.RemoveAt($idx)
            Save-Items
            Send-Json $Ctx 200 @{ deleted = $id }
            return
        }
    }

    if ($path -eq '/api/export.json' -and $method -eq 'GET') {
        $json = ConvertTo-Json -InputObject (Get-ExportObject) -Depth 10
        $name = 'winner-library-' + (Get-Date).ToString('yyyy-MM-dd', $Invariant) + '.json'
        Send-Bytes $Ctx 200 'application/json; charset=utf-8' $Utf8NoBom.GetBytes($json) @{ 'Content-Disposition' = "attachment; filename=`"$name`"" }
        return
    }

    if ($path -eq '/api/export.csv' -and $method -eq 'GET') {
        # UTF-8 with BOM so Excel shows special characters correctly.
        $bytes = (New-Object System.Text.UTF8Encoding($true)).GetPreamble() + $Utf8NoBom.GetBytes((Get-CsvText))
        $name = 'winner-library-' + (Get-Date).ToString('yyyy-MM-dd', $Invariant) + '.csv'
        Send-Bytes $Ctx 200 'text/csv; charset=utf-8' $bytes @{ 'Content-Disposition' = "attachment; filename=`"$name`"" }
        return
    }

    if ($path -eq '/api/import' -and $method -eq 'POST') {
        # The UI sends this only after the user confirms the selected file.
        if ($req.Headers['X-Winner-Import-Approved'] -cne 'true') { Send-Error $Ctx 403 'Explicit import approval is required.'; return }
        $body = Read-JsonBody $Ctx
        # Accepts our own export format ({ items: [...] }) or a plain array of items.
        if ($null -eq $body) { $incoming = @() }
        elseif ($body -is [array]) { $incoming = @($body) }
        elseif ($null -ne $body.PSObject.Properties['items']) { $incoming = @($body.items) }
        else { $incoming = @($body) }

        if ($incoming.Count -eq 0) { Send-Error $Ctx 400 "Die Datei enth${ae}lt keine Eintr${ae}ge."; return }
        if ($incoming.Count -gt $MaxImportItems) { Send-Error $Ctx 400 "Zu viele Eintr${ae}ge (maximal $MaxImportItems pro Import)."; return }

        # Validate everything first. If anything is wrong, nothing is imported.
        $cleaned = @()
        $allErrors = New-Object 'System.Collections.Generic.List[string]'
        $n = 0
        foreach ($src in $incoming) {
            $n++
            if ($null -eq $src -or $src -is [string] -or $src -is [ValueType] -or $src -is [array]) { $allErrors.Add("Eintrag ${n}: kein g${ue}ltiger Datensatz."); continue }
            $r = ConvertTo-CleanItem $src $true
            if ($null -ne $src.PSObject.Properties['updatedAt'] -and ([string]$src.updatedAt) -match '^\d{4}-\d{2}-\d{2}T') { $r.item['updatedAt'] = [string]$src.updatedAt }
            foreach ($e in $r.errors) { $allErrors.Add("Eintrag $n ($($src.title)): $e") }
            $cleaned += ,$r.item
        }
        if ($allErrors.Count -gt 0) { Send-Error $Ctx 400 "Import abgebrochen. Es wurde nichts ge${ae}ndert. Gefundene Probleme:" $allErrors; return }

        $stamp = (Get-Date).ToString('yyyy-MM-dd_HHmmss', $Invariant)
        if (Test-Path -LiteralPath $DataFile) { Copy-Item -LiteralPath $DataFile -Destination (Join-Path $BackupDir "winners-before-import-$stamp.json") }

        $added = 0; $updated = 0
        foreach ($c in $cleaned) {
            $obj = [pscustomobject]$c
            $idx = Find-ItemIndex $obj.id
            if ($idx -ge 0) { $script:Items[$idx] = $obj; $updated++ } else { $script:Items.Add($obj); $added++ }
        }
        Save-Items
        Send-Json $Ctx 200 @{ added = $added; updated = $updated; backup = "data\backups\winners-before-import-$stamp.json" }
        return
    }

    if ($path.StartsWith('/api/')) { Send-Error $Ctx 404 'Unknown API endpoint or method.'; return }
    if ($method -ne 'GET') { Send-Error $Ctx 405 'Method not allowed.'; return }
    Send-StaticFile $Ctx $path
}

# ---------------------------------------------------------------- main

Initialize-Store

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() }
catch {
    Write-Host "FEHLER: Start auf Port $Port nicht m${oe}glich. L${ae}uft die Winner Library schon in einem anderen Fenster?" -ForegroundColor Red
    Write-Host "Anderen Port w${ae}hlen: powershell -ExecutionPolicy Bypass -File server.ps1 -Port 8788" -ForegroundColor Red
    exit 1
}

$url = "http://localhost:$Port/"
Write-Host ''
Write-Host '  Content Revenue OS - Winner Library V1' -ForegroundColor DarkYellow
Write-Host "  L${ae}uft unter $url" -ForegroundColor Cyan
Write-Host "  Dieses Fenster w${ae}hrend der Nutzung ge${oe}ffnet lassen. Beenden mit Strg+C."
Write-Host ''
if (-not $NoBrowser) { Start-Process $url }

try {
    while ($listener.IsListening) {
        $async = $listener.BeginGetContext($null, $null)
        while (-not $async.AsyncWaitHandle.WaitOne(500)) { }   # short waits keep Ctrl+C responsive
        $ctx = $listener.EndGetContext($async)
        try {
            Invoke-Request $ctx
        } catch {
            $msg = $_.Exception.Message
            Write-Host "Request error ($($ctx.Request.HttpMethod) $($ctx.Request.Url.AbsolutePath)): $msg" -ForegroundColor Yellow
            try { Send-Error $ctx 400 $msg } catch { }
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
    Write-Host 'Server beendet.'
}
