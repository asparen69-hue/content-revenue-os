# Browser UI test for the Winner Library. Drives a hidden (headless) Microsoft Edge through the real UI.
# Start the server first, then run:
#   powershell -ExecutionPolicy Bypass -File tests\ui-test.ps1
# Steps: dashboard loads -> create test record -> edit -> search -> filter -> export CSV/JSON -> delete.
# Screenshots and downloaded exports are written to -OutDir.

param(
    [string]$BaseUrl = 'http://localhost:8787',
    [string]$OutDir = (Join-Path $env:TEMP 'winner-library-ui-test'),
    [string]$EdgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    [int]$DebugPort = 9333
)

$ErrorActionPreference = 'Stop'
$script:Failures = 0
$script:MsgId = 0
$script:BrowserErrors = New-Object 'System.Collections.Generic.List[string]'

function Check([string]$Name, [bool]$Condition, [string]$Info = '') {
    if ($Condition) { Write-Host "  PASS  $Name" -ForegroundColor Green }
    else { Write-Host "  FAIL  $Name $Info" -ForegroundColor Red; $script:Failures++ }
}

if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Path $OutDir | Out-Null
$downloads = Join-Path $OutDir 'downloads'
New-Item -ItemType Directory -Path $downloads | Out-Null
$profileDir = Join-Path $OutDir 'edge-profile'

$edge = Start-Process $EdgePath -PassThru -ArgumentList @(
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    "--remote-debugging-port=$DebugPort", '--remote-allow-origins=*', "--user-data-dir=$profileDir",
    '--window-size=1400,1000', 'about:blank')

$page = $null
for ($i = 0; $i -lt 40 -and -not $page; $i++) {
    Start-Sleep -Milliseconds 250
    try {
        $targets = Invoke-RestMethod "http://127.0.0.1:$DebugPort/json/list"   # assign first (PowerShell 5.1 array quirk)
        $page = $targets | ForEach-Object { $_ } | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
    } catch { }
}
if (-not $page) { throw 'Could not connect to headless Edge.' }

$ws = New-Object System.Net.WebSockets.ClientWebSocket
$ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()

function Receive-CdpMessage {
    $buffer = New-Object byte[] 262144
    $ms = New-Object IO.MemoryStream
    do {
        $seg = New-Object 'ArraySegment[byte]' -ArgumentList @(, $buffer)
        $res = $ws.ReceiveAsync($seg, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
        $ms.Write($buffer, 0, $res.Count)
    } while (-not $res.EndOfMessage)
    return [Text.Encoding]::UTF8.GetString($ms.ToArray())
}

function Send-Cdp([string]$Method, [hashtable]$Params = @{}) {
    $script:MsgId++
    $myId = $script:MsgId
    $json = ConvertTo-Json -InputObject @{ id = $myId; method = $Method; params = $Params } -Depth 10 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $seg = New-Object 'ArraySegment[byte]' -ArgumentList @(, $bytes)
    $ws.SendAsync($seg, [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
    while ($true) {
        $msg = (Receive-CdpMessage) | ConvertFrom-Json
        if ($msg.id -eq $myId) { return $msg }
        switch ($msg.method) {
            'Runtime.exceptionThrown' { $script:BrowserErrors.Add('Exception: ' + $msg.params.exceptionDetails.exception.description) }
            'Runtime.consoleAPICalled' { if ($msg.params.type -eq 'error') { $script:BrowserErrors.Add('console.error: ' + (($msg.params.args | ForEach-Object { $_.value }) -join ' ')) } }
            'Log.entryAdded' { if ($msg.params.entry.level -eq 'error') { $script:BrowserErrors.Add('Log: ' + $msg.params.entry.text) } }
        }
    }
}

function Invoke-Js([string]$Js) {
    $r = Send-Cdp 'Runtime.evaluate' @{ expression = $Js; awaitPromise = $true; returnByValue = $true }
    if ($r.result.exceptionDetails) {
        $d = $r.result.exceptionDetails
        $desc = if ($d.exception.description) { $d.exception.description } else { $d.text }
        throw "Browser JS error: $desc"
    }
    return $r.result.result.value
}

function Save-Screenshot([string]$Name) {
    $r = Send-Cdp 'Page.captureScreenshot' @{ format = 'png'; captureBeyondViewport = $true }
    [IO.File]::WriteAllBytes((Join-Path $OutDir "$Name.png"), [Convert]::FromBase64String($r.result.data))
}

# Small helper library injected into the page.
$helpers = @'
window.__t = {
  sleep: ms => new Promise(r => setTimeout(r, ms)),
  async waitFor(fn, label, timeout = 6000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { try { const v = fn(); if (v) return v; } catch (e) {} await this.sleep(50); }
    throw new Error('Timed out waiting for: ' + label);
  },
  el(id) { const e = document.getElementById(id); if (!e) throw new Error('Missing element #' + id); return e; },
  set(id, value) { const e = this.el(id); e.value = value; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); },
  click(id) { this.el(id).click(); },
  rows() { return [...document.querySelectorAll('#items-body tr[data-id]')].map(r => r.querySelector('.cell-title').textContent); },
  text(id) { const e = document.getElementById(id); return e ? e.textContent.trim() : null; }
};
true;
'@

$TestTitle = 'ZZ UI TEST RECORD - temporary'

try {
    Send-Cdp 'Runtime.enable' | Out-Null
    Send-Cdp 'Log.enable' | Out-Null
    Send-Cdp 'Page.enable' | Out-Null
    Send-Cdp 'Browser.setDownloadBehavior' @{ behavior = 'allow'; downloadPath = $downloads } | Out-Null

    Write-Host "Winner Library UI test against $BaseUrl"

    # 1 + 2. Start / dashboard loads
    Send-Cdp 'Page.navigate' @{ url = "$BaseUrl/" } | Out-Null
    Start-Sleep -Milliseconds 300
    for ($i = 0; $i -lt 40; $i++) { if ((Invoke-Js 'document.readyState') -eq 'complete') { break }; Start-Sleep -Milliseconds 100 }
    Invoke-Js $helpers | Out-Null
    $startTotal = [int](Invoke-Js "(async () => { await __t.waitFor(() => document.getElementById('items-body'), 'dashboard'); return __t.text('kpi-total'); })()")
    $dash = Invoke-Js "({ kpis: [...document.querySelectorAll('.kpi')].length, rows: __t.rows().length, title: document.title, filters: ['flt-q','flt-platform','flt-contentType','flt-status','flt-niche','sort'].every(id => document.getElementById(id)) })"
    Check 'dashboard loads with 4 KPI cards' ($dash.kpis -eq 4)
    Check 'table shows all items' ($dash.rows -eq $startTotal -and $startTotal -ge 1) "rows=$($dash.rows) total=$startTotal"
    Check 'search, 4 filters and sort are present' ([bool]$dash.filters)
    Save-Screenshot '1-dashboard'

    # 3. Create a test record through the form
    Invoke-Js @"
(async () => {
  __t.click('nav-new');
  await __t.waitFor(() => document.getElementById('item-form'), 'add form');
  __t.set('f-title', '$TestTitle');
  __t.set('f-creator', '@ui_test');
  __t.set('f-platform', 'YouTube Shorts');
  __t.set('f-contentType', 'Mistake');
  __t.set('f-niche', 'UI Test Niche');
  __t.set('f-hook', 'Stop doing this one thing');
  __t.set('f-views', '5000');
  ['scorePain','scoreUrgency','scorePurchaseIntent','scoreContentPotential','scoreDifferentiation','scoreEaseOfProduction','scoreMonetization','scoreEvidence']
    .forEach((k, i) => __t.set('f-' + k, String([9,8,7,9,6,8,7,5][i])));
  return true;
})()
"@ | Out-Null
    $preview = Invoke-Js "__t.text('overall-preview')"
    Check 'live score preview shows 74 (avg 7.375 x 10)' ($preview -eq '74') "got $preview"
    Save-Screenshot '2-add-form'
    $created = Invoke-Js @"
(async () => {
  __t.click('save-btn');
  await __t.waitFor(() => location.hash.startsWith('#/item/'), 'detail view after save');
  await __t.waitFor(() => document.getElementById('detail-title'), 'detail title');
  return { hash: location.hash, title: __t.text('detail-title'), score: document.querySelector('.detail-score .big').textContent.trim() };
})()
"@
    Check 'create via form opens detail view' ($created.title -eq $TestTitle) "title=$($created.title)"
    Check 'saved score is 74' ($created.score -eq '74') "got $($created.score)"
    $testId = $created.hash -replace '^#/item/', ''
    Save-Screenshot '3-detail'

    # 4. Edit it
    $edited = Invoke-Js @"
(async () => {
  __t.click('detail-edit');
  await __t.waitFor(() => document.getElementById('f-status'), 'edit form');
  const titleInForm = document.getElementById('f-title').value;
  __t.set('f-status', 'Approved for test');
  __t.set('f-adaptationIdea', 'Edited adaptation idea');
  __t.set('f-scoreEvidence', '9');
  __t.click('save-btn');
  await __t.waitFor(() => location.hash.startsWith('#/item/') && document.getElementById('detail-title'), 'detail after edit');
  return { titleInForm, body: document.getElementById('app').textContent, score: document.querySelector('.detail-score .big').textContent.trim() };
})()
"@
    Check 'edit form pre-filled with existing values' ($edited.titleInForm -eq $TestTitle)
    Check 'edited values shown in detail view' ($edited.body -match 'F.r Tests freigegeben' -and $edited.body -match 'Edited adaptation idea')
    Check 'score recalculated after edit (avg 7.875 -> 79)' ($edited.score -eq '79') "got $($edited.score)"

    # 5. Search for it
    $search = Invoke-Js @"
(async () => {
  location.hash = '#/';
  await __t.waitFor(() => document.getElementById('flt-q'), 'dashboard');
  __t.click('flt-reset');
  await __t.sleep(50);
  const approvedKpi = __t.text('kpi-approved');
  __t.set('flt-q', 'zz ui test');
  const hit = __t.rows();
  __t.set('flt-q', 'stop doing this');
  const hookHit = __t.rows();
  __t.set('flt-q', 'no-such-text-xyz');
  const miss = __t.rows();
  const emptyMsg = document.querySelector('#items-body .empty')?.textContent || '';
  __t.set('flt-q', '');
  return { hit, hookHit, miss, emptyMsg, approvedKpi };
})()
"@
    Check 'search by title finds only the test record' (@($search.hit).Count -eq 1 -and $search.hit[0] -eq $TestTitle) ($search.hit -join ', ')
    Check 'search also matches hook text' (@($search.hookHit).Count -eq 1)
    Check 'search with no match shows empty message' (@($search.miss).Count -eq 0 -and $search.emptyMsg -match 'Keine Eintr.ge passen')
    Check 'KPI "Approved tests" counts the edited record' ([int]$search.approvedKpi -ge 1)

    # 6. Filter it (+ sort)
    $filter = Invoke-Js @"
(async () => {
  const r = {};
  __t.set('flt-platform', 'YouTube Shorts'); r.platform = __t.rows();
  __t.set('flt-contentType', 'Mistake'); r.platformType = __t.rows();
  __t.set('flt-status', 'Approved for test'); r.platformTypeStatus = __t.rows();
  __t.set('flt-niche', 'UI Test Niche'); r.all4 = __t.rows();
  r.count = __t.text('result-count');
  __t.set('flt-status', 'Winner'); r.noMatch = __t.rows();
  __t.click('flt-reset'); await __t.sleep(50);
  __t.set('flt-niche', 'Cross-niche pattern'); r.seedNiche = __t.rows();
  __t.click('flt-reset'); await __t.sleep(50);
  __t.set('sort', 'score-desc'); r.sortedDesc = __t.rows();
  __t.set('sort', 'score-asc'); r.sortedAsc = __t.rows();
  __t.set('flt-platform', 'YouTube Shorts');
  return r;
})()
"@
    Check 'platform filter' (@($filter.platform) -contains $TestTitle)
    Check 'platform + type + status + niche filters combined' (@($filter.all4).Count -eq 1 -and $filter.all4[0] -eq $TestTitle) ($filter.all4 -join ', ')
    Check 'filters exclude non-matching items' (@($filter.noMatch).Count -eq 0)
    Check 'niche filter finds seed item, not test record' (@($filter.seedNiche).Count -ge 1 -and @($filter.seedNiche) -notcontains $TestTitle)
    $descScores = Invoke-Js "(() => { __t.click('flt-reset'); __t.set('sort', 'score-desc'); const s = [...document.querySelectorAll('#items-body .score')].map(e => e.textContent.trim()); __t.set('flt-platform', 'YouTube Shorts'); return s; })()"
    $nums = @($descScores | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ })
    $sortedOk = ($nums.Count -ge 1) -and (($nums -join ',') -eq (($nums | Sort-Object -Descending) -join ','))
    $dashIdx = [array]::IndexOf(@($descScores), [string][char]0x2013)
    $unscoredLast = ($dashIdx -lt 0) -or (@($descScores)[$dashIdx..(@($descScores).Count - 1)] | Where-Object { $_ -match '^\d+$' }).Count -eq 0
    Check 'sort by opportunity score (high to low, unscored at bottom)' ($sortedOk -and $unscoredLast) ($descScores -join ', ')
    Save-Screenshot '4-dashboard-filtered'

    # 7. Export data (real downloads through the Data menu)
    Invoke-Js "(async () => { __t.click('menu-data'); await __t.sleep(100); __t.click('export-csv'); await __t.sleep(300); __t.click('menu-data'); await __t.sleep(100); __t.click('export-json'); return true; })()" | Out-Null
    $csvFile = $null; $jsonFile = $null
    for ($i = 0; $i -lt 40 -and (-not $csvFile -or -not $jsonFile); $i++) {
        Start-Sleep -Milliseconds 250
        $csvFile = Get-ChildItem $downloads -Filter '*.csv' | Select-Object -First 1
        $jsonFile = Get-ChildItem $downloads -Filter '*.json' | Select-Object -First 1
    }
    Check 'CSV file downloaded' ($null -ne $csvFile)
    Check 'JSON file downloaded' ($null -ne $jsonFile)
    if ($csvFile) {
        $csvText = [IO.File]::ReadAllText($csvFile.FullName, [Text.Encoding]::UTF8)
        Check 'CSV contains test record and seed' ($csvText -match [regex]::Escape($TestTitle) -and $csvText -match 'Keyword Comment')
    }
    if ($jsonFile) {
        $exp = [IO.File]::ReadAllText($jsonFile.FullName, [Text.Encoding]::UTF8) | ConvertFrom-Json
        Check 'JSON export contains test record' (@($exp.items | Where-Object { $_.id -eq $testId }).Count -eq 1)
    }

    # 8. Delete the temporary test record (with confirmation dialog)
    $del = Invoke-Js @"
(async () => {
  location.hash = '#/item/$testId';
  await __t.waitFor(() => document.getElementById('detail-delete'), 'detail view');
  __t.click('detail-delete');
  await __t.waitFor(() => !document.getElementById('modal').classList.contains('hidden'), 'confirm dialog');
  const dialogText = document.getElementById('modal').textContent;
  __t.click('modal-cancel');
  await __t.sleep(100);
  const stillThere = location.hash === '#/item/$testId';
  __t.click('detail-delete');
  await __t.waitFor(() => !document.getElementById('modal').classList.contains('hidden'), 'confirm dialog 2');
  __t.click('modal-confirm');
  await __t.waitFor(() => (location.hash === '#/' || location.hash === '') && document.getElementById('items-body'), 'dashboard after delete');
  __t.click('flt-reset'); await __t.sleep(50);
  return { dialogText, stillThere, rows: __t.rows(), total: __t.text('kpi-total') };
})()
"@
    Check 'delete asks for confirmation' ($del.dialogText -match 'Diesen Eintrag l.schen' -and $del.dialogText -match [regex]::Escape($TestTitle))
    Check 'cancel keeps the record' ([bool]$del.stillThere)
    Check 'confirmed delete removes the record from the table' (@($del.rows) -notcontains $TestTitle)
    Check 'total back to starting count' ([int]$del.total -eq $startTotal) "total=$($del.total) start=$startTotal"
    Save-Screenshot '5-dashboard-after-delete'

    # Browser console / CSP errors collected during the run (checked before the deliberate 404 below)
    Send-Cdp 'Runtime.evaluate' @{ expression = '1' } | Out-Null
    Check 'no browser console or CSP errors' ($script:BrowserErrors.Count -eq 0) ($script:BrowserErrors -join ' || ')

    $serverCheck = Invoke-Js "fetch('/api/items/$testId').then(r => r.status)"
    Check 'record is gone on the server (404)' ($serverCheck -eq 404)
}
catch {
    Write-Host "  FAIL  $($_.Exception.Message)" -ForegroundColor Red
    $script:Failures++
    try { Save-Screenshot 'error' } catch { }
}
finally {
    try { Send-Cdp 'Browser.close' | Out-Null } catch { }
    Start-Sleep -Milliseconds 500
    if (-not $edge.HasExited) { Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue }
}

Write-Host ''
Write-Host "Screenshots and downloads: $OutDir"
if ($script:Failures -eq 0) { Write-Host 'ALL UI CHECKS PASSED' -ForegroundColor Green; exit 0 }
else { Write-Host "$script:Failures UI CHECK(S) FAILED" -ForegroundColor Red; exit 1 }
