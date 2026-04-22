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

$backendRoot = 'c:\develop\BI1\backend'
$frontendRoot = 'c:\develop\BI1\frontend'
$staticRoot = Join-Path $backendRoot 'src\main\resources\static'
$runtimeRoot = Join-Path $backendRoot 'runtime'
$packagedJar = Join-Path $backendRoot 'target\bi-dashboard-engine-1.0.0.jar'
$runtimeJar = Join-Path $runtimeRoot 'bi-dashboard-engine-1.0.0.jar'

Stop-PortProcess -Port 28637

Push-Location $frontendRoot
npm run build
if ($LASTEXITCODE -ne 0) {
  throw 'Frontend build failed.'
}
Pop-Location

if (Test-Path $staticRoot) {
  Remove-Item -LiteralPath $staticRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $staticRoot | Out-Null
Copy-Item -Path (Join-Path $frontendRoot 'dist\*') -Destination $staticRoot -Recurse -Force

Push-Location $backendRoot
mvn "-Dmaven.repo.local=c:/develop/BI/.m2" package
if ($LASTEXITCODE -ne 0) {
  throw 'Backend package failed.'
}
if (-not (Test-Path $runtimeRoot)) {
  New-Item -ItemType Directory -Path $runtimeRoot | Out-Null
}
Copy-Item -LiteralPath $packagedJar -Destination $runtimeJar -Force
Start-Process java -ArgumentList '-jar', $runtimeJar -WorkingDirectory $backendRoot -WindowStyle Hidden | Out-Null
Pop-Location

Write-Host 'Backend:  http://localhost:28637'
Write-Host 'Frontend: http://localhost:28637/#/designer'
