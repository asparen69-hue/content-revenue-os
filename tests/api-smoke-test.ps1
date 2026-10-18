# API smoke test for the Winner Library. Start the server first, then run:
#   powershell -ExecutionPolicy Bypass -File tests\api-smoke-test.ps1
# Creates a temporary test record, edits it, checks exports/import/validation and deletes it again.

param([string]$BaseUrl = 'http://localhost:8787')

$ErrorActionPreference = 'Stop'
$script:Failures = 0

function Check([string]$Name, [bool]$Condition, [string]$Info = '') {
    if ($Condition) { Write-Host "  PASS  $Name" -ForegroundColor Green }
    else { Write-Host "  FAIL  $Name $Info" -ForegroundColor Red; $script:Failures++ }
}

function Call([string]$Method, [string]$Path, $Body, [hashtable]$Headers = @{}, [string]$ContentType = 'application/json') {
    $params = @{ Uri = "$BaseUrl$Path"; Method = $Method; UseBasicParsing = $true; Headers = $Headers }
    if ($null -ne $Body) {
        $json = if ($Body -is [string]) { $Body } else { ConvertTo-Json -InputObject $Body -Depth 10 }
        $params.Body = [Text.Encoding]::UTF8.GetBytes($json)
        $params.ContentType = $ContentType
    }
    try {
        $r = Invoke-WebRequest @params
        $text = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
        return @{ status = [int]$r.StatusCode; text = $text; headers = $r.Headers }
    } catch {
        $resp = $_.Exception.Response
        if ($null -eq $resp) { throw }
        # PowerShell 5.1 has already read the error body into ErrorDetails.
        return @{ status = [int]$resp.StatusCode; text = [string]$_.ErrorDetails.Message; headers = $resp.Headers }
    }
}

Write-Host "Winner Library API smoke test against $BaseUrl"

$r = Call GET '/api/health' $null
Check 'server responds' ($r.status -eq 200)

$r = Call GET '/' $null
Check 'dashboard page is served' ($r.status -eq 200 -and $r.text -match 'Winner Library')

$before = (Call GET '/api/items' $null).text | ConvertFrom-Json
$countBefore = @($before | ForEach-Object { $_ }).Count

# --- create
$new = [ordered]@{
    title = 'ZZ TEST RECORD - delete me'; creator = '@test_account'; platform = 'TikTok'; sourceUrl = 'https://example.com/video/1'
    niche = 'Test niche'; contentType = 'Tutorial'; hook = 'Test hook with umlauts: äöü ß and quotes "x"'
    views = '12000'; likes = 340; revenueGenerated = '49,90'
    scorePain = 8; scoreUrgency = 7; scorePurchaseIntent = 6; scoreContentPotential = 9
    scoreDifferentiation = 5; scoreEaseOfProduction = 8; scoreMonetization = 7; scoreEvidence = 6
    unknownField = 'should be dropped'
}
$r = Call POST '/api/items' $new
$created = $r.text | ConvertFrom-Json
Check 'create returns 201' ($r.status -eq 201) $r.text
Check 'overall score = avg(8,7,6,9,5,8,7,6)*10 = 70' ($created.overallScore -eq 70) "got $($created.overallScore)"
Check 'scoredCount = 8' ($created.scoredCount -eq 8)
Check 'defaults applied (status Discovered, source Manual, date today)' ($created.status -eq 'Discovered' -and $created.researchSource -eq 'Manual' -and $created.dateDiscovered -eq (Get-Date).ToString('yyyy-MM-dd'))
Check 'numbers parsed (views 12000, revenue 49.9)' ($created.views -eq 12000 -and $created.revenueGenerated -eq 49.9) "views=$($created.views) revenue=$($created.revenueGenerated)"
Check 'unicode text preserved' ($created.hook -eq $new.hook) $created.hook
Check 'unknown fields dropped' ($null -eq $created.PSObject.Properties['unknownField'])
$id = $created.id

# --- edit (partial update)
$r = Call PUT "/api/items/$id" @{ status = 'Approved for test'; scoreEvidence = 10; adaptationIdea = 'Our version' }
$edited = $r.text | ConvertFrom-Json
Check 'edit returns 200' ($r.status -eq 200) $r.text
Check 'edit changed status + idea' ($edited.status -eq 'Approved for test' -and $edited.adaptationIdea -eq 'Our version')
Check 'edit kept untouched fields' ($edited.title -eq $new.title -and $edited.views -eq 12000)
Check 'score recalculated (avg(8,7,6,9,5,8,7,10) = 7.5 -> 75)' ($edited.overallScore -eq 75) "got $($edited.overallScore)"
$r = Call PUT "/api/items/$id" @{ sourceUrl = '' }
Check 'clearing a field works' ((($r.text | ConvertFrom-Json).sourceUrl) -eq $null)

# --- validation
$r = Call POST '/api/items' @{ title = '' }
Check 'missing title rejected (400)' ($r.status -eq 400)
$r = Call POST '/api/items' @{ title = 'x'; platform = 'MySpace'; scorePain = 11; views = -5; sourceUrl = 'javascript:alert(1)'; dateDiscovered = '07.10.2026' }
$err = $r.text | ConvertFrom-Json
Check 'invalid values rejected with 5 messages' ($r.status -eq 400 -and @($err.details).Count -eq 5) $r.text

# --- security guards
$r = Call POST '/api/items' @{ title = 'cross-site' } @{ Origin = 'http://evil.example' }
Check 'foreign Origin blocked (403)' ($r.status -eq 403)
$r = Call POST '/api/items' '{"title":"form post"}' @{} 'text/plain'
Check 'non-JSON content type blocked (415)' ($r.status -eq 415)
$r = Call GET '/..%2fserver.ps1' $null
Check 'path traversal blocked' ($r.status -in @(400, 403, 404)) "status $($r.status)"

# --- exports
$r = Call GET '/api/export.json' $null
$export = $r.text | ConvertFrom-Json
Check 'JSON export contains test record' ($r.status -eq 200 -and @($export.items | Where-Object { $_.id -eq $id }).Count -eq 1)
Check 'JSON export documents score formula' ([string]$export.scoreFormula -match 'Durchschnitt')
$r = Call GET '/api/export.csv' $null
Check 'CSV export contains test record + header' ($r.status -eq 200 -and $r.text -match 'ZZ TEST RECORD' -and $r.text -match 'Opportunity Score \(0-100\)')
Check 'CSV download header set' ([string]$r.headers['Content-Disposition'] -match 'attachment')

# --- import approval and malformed input: no writes, even for valid data
$r = Call POST '/api/import' @(@{ title = 'must not be imported' })
Check 'import without explicit approval blocked (403)' ($r.status -eq 403)
foreach ($raw in @('[]', '[null]', '[[{"title":"nested"}]]', '{"items":[]}', '{"items":[null]}')) {
    $r = Call POST '/api/import' $raw @{ 'X-Winner-Import-Approved' = 'true' }
    Check "invalid import shape rejected: $raw" ($r.status -eq 400) $r.text
}
$r = Call POST '/api/items' '[{"title":"array is not an object"}]'
Check 'single-item array rejected by create endpoint' ($r.status -eq 400)
$r = Call POST '/api/items' '{"title":"overflow","views":1e100}'
Check 'numeric overflow rejected' ($r.status -eq 400)
$r = Call POST '/api/items' '{"title":"infinity","offerPrice":1e309}'
Check 'non-finite money rejected' ($r.status -eq 400)
$r = Call GET '/assistant.html' $null
Check 'assistant served with external CSP-compatible scripts' ($r.status -eq 200 -and $r.text -match 'src="/assistant.js"' -and $r.text -notmatch '<script>')

# --- import (atomic validation + update by id)
$bad = @{ items = @(@{ title = 'ok item' }, @{ title = 'bad item'; status = 'Nope' }) }
$r = Call POST '/api/import' $bad @{ 'X-Winner-Import-Approved' = 'true' }
$countMid = @(((Call GET '/api/items' $null).text | ConvertFrom-Json) | ForEach-Object { $_ }).Count
Check 'invalid import rejected, nothing changed' ($r.status -eq 400 -and $countMid -eq ($countBefore + 1)) $r.text
$r = Call POST '/api/import' @(@{ id = $id; title = 'ZZ TEST RECORD - delete me'; notes = 'updated via import' }) @{ 'X-Winner-Import-Approved' = 'true' }
$imp = $r.text | ConvertFrom-Json
Check 'valid import updates existing id' ($r.status -eq 200 -and $imp.updated -eq 1 -and $imp.added -eq 0) $r.text
$after = (Call GET "/api/items/$id" $null).text | ConvertFrom-Json
Check 'import result stored' ($after.notes -eq 'updated via import')

# --- delete
$r = Call DELETE "/api/items/$id" $null
Check 'delete returns 200' ($r.status -eq 200)
$r = Call GET "/api/items/$id" $null
Check 'deleted record is gone (404)' ($r.status -eq 404)
$countAfter = @(((Call GET '/api/items' $null).text | ConvertFrom-Json) | ForEach-Object { $_ }).Count
Check 'item count back to original' ($countAfter -eq $countBefore) "before=$countBefore after=$countAfter"

Write-Host ''
if ($script:Failures -eq 0) { Write-Host 'ALL CHECKS PASSED' -ForegroundColor Green; exit 0 }
else { Write-Host "$script:Failures CHECK(S) FAILED" -ForegroundColor Red; exit 1 }
