$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$goProjectRoot = Join-Path $projectRoot 'go-whatsapp-web-multidevice'
$srcDir = Join-Path $goProjectRoot 'src'
$logDir = Join-Path $projectRoot 'storage\logs'
$logPath = Join-Path $logDir 'whatsapp-go-start.log'
$pidPath = Join-Path $logDir 'whatsapp-go.pid'
$port = 3000

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Write-Log {
    param([string] $Message)

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[$timestamp] $Message"
    Add-Content -Path $logPath -Value $line
    Write-Output $line
}

if (-not (Test-Path $srcDir)) {
    Write-Log "Go source directory not found at $srcDir"
    exit 1
}

$goCommand = Get-Command go -ErrorAction SilentlyContinue
if (-not $goCommand) {
    Write-Log 'Go executable not found in PATH'
    exit 1
}

$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    $existingProcessIds = $existing | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $existingProcessIds) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
        if ($process -and $process.CommandLine -like '*go-whatsapp-web-multidevice*') {
            Write-Log "WhatsApp Go is already running on port $port with PID $processId"
            Set-Content -Path $pidPath -Value $processId -Encoding ASCII
            exit 0
        }
    }

    Write-Log "Port $port is already in use by another process. Stop it first before starting WhatsApp Go."
    exit 1
}

$binaryPath = Join-Path $srcDir 'whatsapp.exe'
$startCommand = 'go'
$startArguments = @('run', '.', 'rest')

if (Test-Path $binaryPath) {
    $startCommand = $binaryPath
    $startArguments = @('rest')
}

$process = Start-Process -FilePath $startCommand -ArgumentList $startArguments -WorkingDirectory $srcDir -WindowStyle Hidden -PassThru
Set-Content -Path $pidPath -Value $process.Id -Encoding ASCII
Write-Log "Starting WhatsApp Go using $startCommand (PID $($process.Id))"

$maxWaitSeconds = 20
$elapsed = 0
while ($elapsed -lt $maxWaitSeconds) {
    Start-Sleep -Seconds 1
    $elapsed += 1

    $started = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($started) {
        Write-Log "WhatsApp Go started successfully on port $port"
        exit 0
    }
}

Write-Log "WhatsApp Go did not open port $port within $maxWaitSeconds seconds"
exit 1
