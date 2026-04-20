$ErrorActionPreference = "Stop"

function Invoke-JsonPost($url, $payload) {
  $json = $payload | ConvertTo-Json -Depth 20 -Compress
  return Invoke-RestMethod -Uri $url -Method Post -ContentType 'application/json; charset=utf-8' -Body $json
}

$dashboardCode = 'volatility_tracking_dashboard'
$modelCode = 'volatility_tracking_pool'

$dslConfig = @{
  queryDsl = @{
    modelCode = $modelCode
    dimensionField = 'trade_date'
    dimensionFields = @('trade_date')
    seriesFields = @()
    metrics = @(
      @{
        fieldCode = 'implied_volatility_median'
        displayName = 'Implied Volatility'
        aggType = 'avg'
        chartType = 'line'
        yAxis = 'left'
        smooth = $true
        stack = $false
        color = '#2563eb'
      },
      @{
        fieldCode = 'stock_volatility_3m_median'
        displayName = 'Stock Volatility 3M'
        aggType = 'avg'
        chartType = 'area'
        yAxis = 'left'
        smooth = $true
        stack = $false
        color = '#0891b2'
      },
      @{
        fieldCode = 'implied_volatility_3y_avg'
        displayName = 'Implied Volatility 3Y Rolling Avg'
        aggType = 'avg'
        chartType = 'line'
        yAxis = 'right'
        smooth = $true
        stack = $false
        color = '#e11d48'
      }
    )
    filters = @()
    orders = @(@{ fieldCode = 'trade_date'; direction = 'asc' })
    limit = 5
  }
  visualDsl = @{
    title = 'Smoke Preview'
    subtitle = ''
    xAxisName = 'Trade Date'
    leftAxisName = 'Volatility'
    rightAxisName = ''
  }
  styleDsl = @{
    showSymbol = $false
    lineWidth = 2
    areaOpacity = 0.22
  }
  interactionDsl = @{
    tooltip = $true
    legend = $true
    dataZoom = $true
  }
  layout = @{ x = 0; y = 0; w = 12; h = 9 }
}

$previewPayload = @{
  modelCode = $modelCode
  dslConfig = $dslConfig
}

$savePayload = @{
  dashboardCode = $dashboardCode
  draft = @{
    dashboardCode = $dashboardCode
    name = 'Volatility Tracking Dashboard'
    status = 'DRAFT'
    publishedVersion = 1
    components = @(@{
      componentCode = 'cmp-volatility-trend'
      componentType = 'chart'
      templateCode = 'mixed'
      modelCode = $modelCode
      title = 'Volatility Tracking'
      dslConfig = $dslConfig
    })
  }
}

$compatibilityPayload = $dslConfig.queryDsl

$tests = @(
  @{ endpoint = "GET /api/dashboard/$dashboardCode"; run = { (Invoke-RestMethod "http://localhost:8080/api/dashboard/$dashboardCode").success } },
  @{ endpoint = "GET /api/design/dashboard/$dashboardCode"; run = { (Invoke-RestMethod "http://localhost:8080/api/design/dashboard/$dashboardCode").success } },
  @{ endpoint = 'GET /api/dataset'; run = { (Invoke-RestMethod 'http://localhost:8080/api/dataset').success } },
  @{ endpoint = "GET /api/dataset/$modelCode"; run = { (Invoke-RestMethod "http://localhost:8080/api/dataset/$modelCode").success } },
  @{ endpoint = 'POST /api/chart/compatibility'; run = { (Invoke-JsonPost 'http://localhost:8080/api/chart/compatibility' $compatibilityPayload).success } },
  @{ endpoint = 'POST /api/chart/preview'; run = { (Invoke-JsonPost 'http://localhost:8080/api/chart/preview' $previewPayload).success } },
  @{ endpoint = 'POST /api/design/dashboard/save'; run = { (Invoke-JsonPost 'http://localhost:8080/api/design/dashboard/save' $savePayload).success } },
  @{ endpoint = 'POST /api/design/dashboard/publish'; run = { (Invoke-JsonPost 'http://localhost:8080/api/design/dashboard/publish' @{ dashboardCode = $dashboardCode; publishNote = 'smoke' }).success } },
  @{ endpoint = "POST /api/runtime/dashboard?dashboardCode=$dashboardCode"; run = { (Invoke-JsonPost "http://localhost:8080/api/runtime/dashboard?dashboardCode=$dashboardCode" @()).success } }
)

$results = [System.Collections.Generic.List[object]]::new()

foreach ($test in $tests) {
  try {
    $ok = & $test.run
    $results.Add([pscustomobject]@{ endpoint = $test.endpoint; ok = [bool]$ok; error = '' })
  } catch {
    $results.Add([pscustomobject]@{ endpoint = $test.endpoint; ok = $false; error = $_.Exception.Message })
  }
}

$results | Format-Table -AutoSize
