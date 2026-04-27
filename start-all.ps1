$ErrorActionPreference = "Stop"

function Stop-PortProcess {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $connections) {
    if ($processId) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Assert-Command {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [string]$Hint
  )

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    if ($Hint) {
      throw "$Name is required. $Hint"
    }
    throw "$Name is required."
  }
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Join-Path $repoRoot 'backend'
$frontendRoot = Join-Path $repoRoot 'frontend'
$staticRoot = Join-Path $backendRoot 'src\main\resources\static'
$runtimeRoot = Join-Path $backendRoot 'runtime'
$packagedJar = Join-Path $backendRoot 'target\bi-dashboard-engine-1.0.0.jar'
$runtimeJar = Join-Path $runtimeRoot 'bi-dashboard-engine-1.0.0.jar'
$mavenRepo = Join-Path $repoRoot '.m2'
$logsRoot = Join-Path $runtimeRoot 'logs'
$stdoutLog = Join-Path $logsRoot 'backend.out.log'
$stderrLog = Join-Path $logsRoot 'backend.err.log'
$pidFile = Join-Path $runtimeRoot 'backend.pid'
$frontendNodeModules = Join-Path $frontendRoot 'node_modules'
$frontendPackageLock = Join-Path $frontendRoot 'package-lock.json'

Assert-Command -Name 'npm' -Hint 'Please install Node.js 18+ and ensure npm is in PATH.'
Assert-Command -Name 'mvn' -Hint 'Please install Maven 3.9+ and ensure mvn is in PATH.'
Assert-Command -Name 'java' -Hint 'Please install Java 17+ and ensure java is in PATH.'

Stop-PortProcess -Port 28637

Push-Location $frontendRoot
try {
  if (-not (Test-Path $frontendNodeModules)) {
    Write-Host 'Installing frontend dependencies...'
    if (Test-Path $frontendPackageLock) {
      npm ci
    }
    else {
      npm install
    }
    if ($LASTEXITCODE -ne 0) {
      throw 'Frontend dependency installation failed.'
    }
  }

  Write-Host 'Building frontend...'
  npm run build
  if ($LASTEXITCODE -ne 0) {
    throw 'Frontend build failed.'
  }
}
finally {
  Pop-Location
}

if (Test-Path $staticRoot) {
  Remove-Item -LiteralPath $staticRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $staticRoot -Force | Out-Null
Copy-Item -Path (Join-Path $frontendRoot 'dist\*') -Destination $staticRoot -Recurse -Force

Push-Location $backendRoot
try {
  Write-Host 'Packaging backend...'
  mvn "-Dmaven.repo.local=$mavenRepo" package
  if ($LASTEXITCODE -ne 0) {
    throw 'Backend package failed.'
  }

  if (-not (Test-Path $runtimeRoot)) {
    New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
  }
  if (-not (Test-Path $logsRoot)) {
    New-Item -ItemType Directory -Path $logsRoot -Force | Out-Null
  }

  Copy-Item -LiteralPath $packagedJar -Destination $runtimeJar -Force
  if (Test-Path $stdoutLog) {
    Remove-Item -LiteralPath $stdoutLog -Force
  }
  if (Test-Path $stderrLog) {
    Remove-Item -LiteralPath $stderrLog -Force
  }

  $process = Start-Process java `
    -ArgumentList '-jar', $runtimeJar `
    -WorkingDirectory $backendRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru
  Set-Content -LiteralPath $pidFile -Value $process.Id
}
finally {
  Pop-Location
}

Write-Host 'Backend:  http://localhost:28637'
Write-Host 'Frontend: http://localhost:28637/#/designer'
Write-Host "PID File:  $pidFile"
Write-Host "Logs:      $stdoutLog"
