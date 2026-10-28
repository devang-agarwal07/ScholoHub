param(
    [int]$Port = 27018,
    [string]$MongodPath = '',
    [string]$MongoshPath = ''
)

$ErrorActionPreference = 'Stop'
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Choose a port between 1024 and 65535.' }

if (!$MongodPath) {
    $command = Get-Command mongod -ErrorAction SilentlyContinue
    if ($command) { $MongodPath = $command.Source }
    else {
        $MongodPath = Get-ChildItem "$env:ProgramFiles\MongoDB\Server" -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            ForEach-Object { Join-Path $_.FullName 'bin\mongod.exe' } |
            Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    }
}
if (!$MongoshPath) {
    $command = Get-Command mongosh -ErrorAction SilentlyContinue
    if ($command) { $MongoshPath = $command.Source }
}
if (!$MongodPath -or !(Test-Path -LiteralPath $MongodPath)) { throw 'Install MongoDB Community Server or pass -MongodPath.' }
if (!$MongoshPath -or !(Test-Path -LiteralPath $MongoshPath)) { throw 'Install MongoDB Shell and add mongosh to PATH, or pass -MongoshPath.' }

function Test-DatabasePort {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $task = $client.ConnectAsync('127.0.0.1', $Port)
        return ($task.Wait(500) -and $client.Connected)
    } catch { return $false }
    finally { $client.Dispose() }
}

$backendDir = Split-Path $PSScriptRoot -Parent
$dataDir = Join-Path $backendDir 'mongodb-data'
$startedHere = $false
if (!(Test-DatabasePort)) {
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
    $logPath = Join-Path $dataDir 'mongod.log'
    $server = Start-Process -FilePath $MongodPath -ArgumentList @(
        '--dbpath', ('"' + $dataDir + '"'), '--port', "$Port",
        '--bind_ip', '127.0.0.1', '--replSet', 'rs0',
        '--logpath', ('"' + $logPath + '"'), '--logappend'
    ) -WindowStyle Hidden -PassThru
    $startedHere = $true
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if (Test-DatabasePort) { break }
        if ($server.HasExited) { throw "MongoDB exited. See $logPath" }
        Start-Sleep -Milliseconds 500
    }
    if (!(Test-DatabasePort)) { throw "MongoDB did not start. See $logPath" }
}

$uri = "mongodb://127.0.0.1:$Port/admin?directConnection=true&serverSelectionTimeoutMS=5000"
# Only initialize a server launched by this script; never reconfigure an existing database.
$allowInit = if ($startedHere) { 'true' } else { 'false' }
$bootstrap = @"
const hello = db.hello();
if (hello.setName && hello.setName !== 'rs0') throw new Error('This port belongs to a different replica set.');
if (!hello.setName && !hello.isreplicaset) throw new Error('This port belongs to a standalone MongoDB server.');
try { rs.status(); } catch (error) {
    if (error.code !== 94 || !$allowInit) throw error;
    const result = rs.initiate({_id:'rs0', members:[{_id:0, host:'127.0.0.1:$Port'}]});
    if (!result.ok) throw new Error(JSON.stringify(result));
}
for (let attempt = 0; attempt < 40; attempt++) {
    if (db.hello().isWritablePrimary) { print('MongoDB replica set rs0 is ready.'); quit(0); }
    sleep(500);
}
throw new Error('MongoDB did not elect a primary.');
"@
& $MongoshPath $uri --quiet --eval $bootstrap
if ($LASTEXITCODE -ne 0) { throw 'MongoDB replica set initialization failed.' }
Write-Host "Database URL: mongodb://127.0.0.1:$Port/scholarship_db?replicaSet=rs0&directConnection=true"
Write-Host 'Next: npm run db:setup (optional demo data: npm run prisma:seed).'
