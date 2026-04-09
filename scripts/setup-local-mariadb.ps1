param(
    [string]$MysqlHost = '127.0.0.1',
    [int]$MysqlPort = 3306,
    [string]$MysqlUser = 'pos_bengkel',
    [string]$MysqlPassword = 'pos_bengkel_password',
    [string]$SqlFile = (Join-Path $PSScriptRoot '..\LOCAL_MARIADB_SETUP.sql')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $SqlFile)) {
    throw "SQL file not found: $SqlFile"
}

$mysqlExe = Get-Command mysql -ErrorAction SilentlyContinue
if (-not $mysqlExe) {
    throw 'mysql client not found in PATH. Install MariaDB/MySQL client and ensure the mysql executable is available from terminal.'
}

try {
    & $mysqlExe.Source --version | Out-Null
} catch {
    throw 'mysql client was found but could not be executed. Check PATH and client installation.'
}

$mysqlArgs = @(
    '--host', $MysqlHost,
    '--port', $MysqlPort,
    '--user', $MysqlUser,
    '--protocol', 'tcp',
    '--default-character-set=utf8mb4'
)

if ($MysqlPassword -ne '') {
    $mysqlArgs += "--password=$MysqlPassword"
}

Get-Content -Raw $SqlFile | & $mysqlExe.Source @mysqlArgs

Write-Host "MariaDB local setup applied successfully using $SqlFile"
