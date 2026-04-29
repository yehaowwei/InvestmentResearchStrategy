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

function Get-LatestFileWriteTimeUtc {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Paths
  )

  $latest = [datetime]::MinValue
  foreach ($path in $Paths) {
    if (-not (Test-Path $path)) {
      continue
    }

    $item = Get-Item -LiteralPath $path -ErrorAction SilentlyContinue
    if (-not $item) {
      continue
    }

    $candidates = if ($item.PSIsContainer) {
      Get-ChildItem -LiteralPath $path -Recurse -File -ErrorAction SilentlyContinue
    }
    else {
      @($item)
    }

    foreach ($candidate in $candidates) {
      if ($candidate.LastWriteTimeUtc -gt $latest) {
        $latest = $candidate.LastWriteTimeUtc
      }
    }
  }

  return $latest
}

function Test-NeedsRefresh {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$SourcePaths,
    [Parameter(Mandatory = $true)]
    [string]$TargetPath
  )

  if (-not (Test-Path $TargetPath)) {
    return $true
  }

  $latestSourceTime = Get-LatestFileWriteTimeUtc -Paths $SourcePaths
  if ($latestSourceTime -eq [datetime]::MinValue) {
    return $false
  }

  $targetItem = Get-Item -LiteralPath $TargetPath -ErrorAction SilentlyContinue
  if (-not $targetItem) {
    return $true
  }

  return $latestSourceTime -gt $targetItem.LastWriteTimeUtc
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Join-Path $repoRoot 'backend'
$frontendRoot = Join-Path $repoRoot 'frontend'
$staticRoot = Join-Path $backendRoot 'target\generated-resources\static'
$cacheRoot = Join-Path $repoRoot '.cache'
$runtimeRoot = Join-Path $repoRoot '.runtime'
$runtimeDataRoot = Join-Path $runtimeRoot 'data'
$packagedJar = Join-Path $backendRoot 'target\bi-dashboard-engine-1.0.0.jar'
$runtimeJar = Join-Path $runtimeRoot 'bi-dashboard-engine-1.0.0.jar'
$mavenRepo = Join-Path $cacheRoot 'maven'
$logsRoot = Join-Path $runtimeRoot 'logs'
$stdoutLog = Join-Path $logsRoot 'backend.out.log'
$stderrLog = Join-Path $logsRoot 'backend.err.log'
$pidFile = Join-Path $runtimeRoot 'backend.pid'
$demoDbFile = Join-Path $repoRoot 'seed-data\bi-demo.mv.db'
$runtimeDbFile = Join-Path $runtimeDataRoot 'bi-demo.mv.db'
$runtimeDbBase = (Join-Path $runtimeDataRoot 'bi-demo') -replace '\\', '/'
$defaultDbUrl = "jdbc:h2:file:$runtimeDbBase;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1"
$defaultDeepSeekApiKey = 'sk-f48b1892f7e24fd09fca915cf8e35ec9'
$frontendNodeModules = Join-Path $frontendRoot 'node_modules'
$frontendPackageLock = Join-Path $frontendRoot 'package-lock.json'
$frontendDistRoot = Join-Path $frontendRoot 'dist'
$frontendDistIndex = Join-Path $frontendDistRoot 'index.html'
$staticIndex = Join-Path $staticRoot 'index.html'
$frontendSourcePaths = @(
  (Join-Path $frontendRoot 'src'),
  (Join-Path $frontendRoot 'package.json'),
  (Join-Path $frontendRoot 'package-lock.json'),
  (Join-Path $frontendRoot 'vite.config.js'),
  (Join-Path $frontendRoot 'tsconfig.json'),
  (Join-Path $frontendRoot 'index.html')
)
$backendSourcePaths = @(
  (Join-Path $backendRoot 'src'),
  (Join-Path $backendRoot 'pom.xml'),
  $staticRoot
)

Assert-Command -Name 'npm' -Hint 'Please install Node.js 18+ and ensure npm is in PATH.'
Assert-Command -Name 'mvn' -Hint 'Please install Maven 3.9+ and ensure mvn is in PATH.'
Assert-Command -Name 'java' -Hint 'Please install Java 17+ and ensure java is in PATH.'

Stop-PortProcess -Port 28637

if (-not (Test-Path $runtimeDataRoot)) {
  New-Item -ItemType Directory -Path $runtimeDataRoot -Force | Out-Null
}
if ((-not (Test-Path $runtimeDbFile)) -and (Test-Path $demoDbFile)) {
  Copy-Item -LiteralPath $demoDbFile -Destination $runtimeDbFile -Force
}

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

  $needsFrontendBuild = Test-NeedsRefresh -SourcePaths $frontendSourcePaths -TargetPath $frontendDistIndex
  if ($needsFrontendBuild) {
    Write-Host 'Building frontend...'
    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw 'Frontend build failed.'
    }
  }
  else {
    Write-Host 'Skipping frontend build (no source changes detected).'
  }
}
finally {
  Pop-Location
}

$needsStaticCopy = Test-NeedsRefresh -SourcePaths @($frontendDistRoot) -TargetPath $staticIndex
if ($needsStaticCopy) {
  if (Test-Path $staticRoot) {
    Remove-Item -LiteralPath $staticRoot -Recurse -Force
  }
  New-Item -ItemType Directory -Path $staticRoot -Force | Out-Null
  Copy-Item -Path (Join-Path $frontendRoot 'dist\*') -Destination $staticRoot -Recurse -Force
}
else {
  Write-Host 'Skipping static asset copy (no frontend build changes detected).'
}

Push-Location $backendRoot
try {
  $needsBackendPackage = Test-NeedsRefresh -SourcePaths $backendSourcePaths -TargetPath $packagedJar
  if ($needsBackendPackage) {
    Write-Host 'Packaging backend...'
    mvn "-Dmaven.repo.local=$mavenRepo" package
    if ($LASTEXITCODE -ne 0) {
      throw 'Backend package failed.'
    }
  }
  else {
    Write-Host 'Skipping backend package (no source changes detected).'
  }

  if (-not (Test-Path $runtimeRoot)) {
    New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
  }
  if (-not (Test-Path $logsRoot)) {
    New-Item -ItemType Directory -Path $logsRoot -Force | Out-Null
  }

  if ((-not (Test-Path $runtimeJar)) -or ((Get-Item -LiteralPath $packagedJar).LastWriteTimeUtc -gt (Get-Item -LiteralPath $runtimeJar -ErrorAction SilentlyContinue).LastWriteTimeUtc)) {
    Copy-Item -LiteralPath $packagedJar -Destination $runtimeJar -Force
  }
  if (Test-Path $stdoutLog) {
    Remove-Item -LiteralPath $stdoutLog -Force
  }
  if (Test-Path $stderrLog) {
    Remove-Item -LiteralPath $stderrLog -Force
  }

  $previousDbUrl = $env:BI_DB_URL
  $previousDeepSeekApiKey = $env:DEEPSEEK_API_KEY
  if (-not $previousDbUrl) {
    $env:BI_DB_URL = $defaultDbUrl
  }
  if (-not $previousDeepSeekApiKey) {
    $env:DEEPSEEK_API_KEY = $defaultDeepSeekApiKey
  }
  try {
    $process = Start-Process java `
      -ArgumentList '-jar', $runtimeJar `
      -WorkingDirectory $backendRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput $stdoutLog `
      -RedirectStandardError $stderrLog `
      -PassThru
  }
  finally {
    if ($previousDbUrl) {
      $env:BI_DB_URL = $previousDbUrl
    }
    else {
      Remove-Item Env:\BI_DB_URL -ErrorAction SilentlyContinue
    }
    if ($previousDeepSeekApiKey) {
      $env:DEEPSEEK_API_KEY = $previousDeepSeekApiKey
    }
    else {
      Remove-Item Env:\DEEPSEEK_API_KEY -ErrorAction SilentlyContinue
    }
  }
  Set-Content -LiteralPath $pidFile -Value $process.Id
}
finally {
  Pop-Location
}

Write-Host 'Backend:  http://localhost:28637'
Write-Host 'Frontend: http://localhost:28637/#/designer'
Write-Host "PID File:  $pidFile"
Write-Host "Logs:      $stdoutLog"
