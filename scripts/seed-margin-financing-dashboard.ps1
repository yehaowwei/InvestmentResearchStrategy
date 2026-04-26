$ErrorActionPreference = 'Stop'

$apiBase = 'http://localhost:28637/api'

function S {
  param([int[]]$Codes)
  return -join ($Codes | ForEach-Object { [char]$_ })
}

function Invoke-JsonApi {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [object]$Body
  )

  $params = @{
    Method = $Method
    Uri = $Url
    Headers = @{ Accept = 'application/json' }
  }

  if ($null -ne $Body) {
    $jsonBody = $Body | ConvertTo-Json -Depth 100 -Compress
    if ($null -eq $jsonBody) {
      $jsonBody = '[]'
    }
    $params.ContentType = 'application/json; charset=utf-8'
    $params.Body = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)
  }

  return Invoke-RestMethod @params
}

function New-QueryTableSql {
  param([Parameter(Mandatory = $true)][string[]]$SelectRows)
  return ($SelectRows -join ' union all ')
}

function New-DailyFinancingRows {
  $dates = New-Object System.Collections.Generic.List[datetime]
  $cursor = [datetime]'2024-01-05'
  $endDate = [datetime]'2026-03-13'
  while ($cursor -le $endDate) {
    $dates.Add($cursor)
    $cursor = $cursor.AddDays(7)
  }

  $spikes = @{
    4 = -860.00
    6 = 320.00
    7 = 280.00
    8 = 340.00
    18 = -120.00
    23 = -80.00
    38 = 980.00
    40 = 1120.00
    43 = 260.00
    52 = -380.00
    55 = -260.00
    65 = -960.00
    76 = 240.00
    78 = 360.00
    80 = 780.00
    82 = 920.00
    84 = 610.00
    90 = -310.00
    99 = 180.00
    104 = 260.00
    109 = 980.00
    111 = -520.00
    112 = -760.00
    113 = -180.00
    114 = -140.00
  }

  $balance = 15480.00
  $rows = New-Object System.Collections.Generic.List[object]
  for ($index = 0; $index -lt $dates.Count; $index++) {
    if ($index -lt 18) {
      $base = -15 + ([math]::Sin($index * 0.75) * 95) + ([math]::Cos($index * 0.21) * 35)
    } elseif ($index -lt 36) {
      $base = 18 + ([math]::Sin($index * 0.58) * 80) + ([math]::Cos($index * 0.17) * 25)
    } elseif ($index -lt 50) {
      $base = 135 + ([math]::Sin($index * 0.62) * 145) + ([math]::Cos($index * 0.13) * 55)
    } elseif ($index -lt 70) {
      $base = -5 + ([math]::Sin($index * 0.57) * 150) + ([math]::Cos($index * 0.19) * 40)
    } elseif ($index -lt 90) {
      $base = 125 + ([math]::Sin($index * 0.54) * 165) + ([math]::Cos($index * 0.18) * 50)
    } elseif ($index -lt 106) {
      $base = 25 + ([math]::Sin($index * 0.61) * 90) + ([math]::Cos($index * 0.23) * 30)
    } else {
      $base = 72 + ([math]::Sin($index * 0.66) * 125) + ([math]::Cos($index * 0.16) * 36)
    }

    $netChange = [math]::Round($base, 2)
    if ($spikes.ContainsKey($index)) {
      $netChange = [double]$spikes[$index]
    }

    $balance = [math]::Round($balance + $netChange, 2)
    $rows.Add([pscustomobject]@{
      trade_date = $dates[$index].ToString('yyyy-MM-dd')
      net_change = $netChange
      financing_balance = $balance
    })
  }

  return $rows
}

function New-BoardName {
  param([int]$Index, [string]$Name)
  $prefix = ([string][char]0x200B) * (10 - $Index)
  return "$prefix$Name"
}

$boardLabels = @(
  (S @(0x4E0A,0x8BC1,0x4E3B,0x677F)),
  (S @(0x6DF1,0x8BC1,0x4E3B,0x677F)),
  (S @(0x521B,0x4E1A,0x677F)),
  (S @(0x79D1,0x521B,0x677F)),
  (S @(0x6CAA,0x6DF1,0x0033,0x0030,0x0030)),
  (S @(0x4E2D,0x8BC1,0x0035,0x0030,0x0030)),
  (S @(0x4E2D,0x8BC1,0x0031,0x0030,0x0030,0x0030)),
  (S @(0x4E2D,0x8BC1,0x0032,0x0030,0x0030,0x0030)),
  (S @(0x79D1,0x521B,0x521B,0x4E1A,0x0035,0x0030))
)

$dailyRows = New-DailyFinancingRows
$dailySqlRows = $dailyRows | ForEach-Object {
  $netValue = (('{0:N2}' -f $_.net_change).Replace(',', ''))
  $balanceValue = (('{0:N2}' -f $_.financing_balance).Replace(',', ''))
  "select cast('$($_.trade_date)' as date) as trade_date, cast($netValue as decimal(12,2)) as net_change, cast($balanceValue as decimal(12,2)) as financing_balance"
}

$sectorRows = @(
  @{ board_name = New-BoardName 1 $boardLabels[0]; d20260213 = -280.00; d20260227 = 240.00; d20260306 = -30.00; d20260313 = -110.00; d20260320 = 10.00; d20260327 = 440.00 },
  @{ board_name = New-BoardName 2 $boardLabels[1]; d20260213 = -200.00; d20260227 = 200.00; d20260306 = -20.00; d20260313 = -90.00; d20260320 = 5.00; d20260327 = 250.00 },
  @{ board_name = New-BoardName 3 $boardLabels[2]; d20260213 = -180.00; d20260227 = 180.00; d20260306 = -140.00; d20260313 = -20.00; d20260320 = 0.00; d20260327 = 300.00 },
  @{ board_name = New-BoardName 4 $boardLabels[3]; d20260213 = -35.00; d20260227 = 120.00; d20260306 = -60.00; d20260313 = -10.00; d20260320 = 8.00; d20260327 = -20.00 },
  @{ board_name = New-BoardName 5 $boardLabels[4]; d20260213 = -270.00; d20260227 = 260.00; d20260306 = -140.00; d20260313 = -30.00; d20260320 = 0.00; d20260327 = 500.00 },
  @{ board_name = New-BoardName 6 $boardLabels[5]; d20260213 = -150.00; d20260227 = 170.00; d20260306 = -20.00; d20260313 = -60.00; d20260320 = 10.00; d20260327 = 150.00 },
  @{ board_name = New-BoardName 7 $boardLabels[6]; d20260213 = -160.00; d20260227 = 170.00; d20260306 = -30.00; d20260313 = -40.00; d20260320 = 5.00; d20260327 = 190.00 },
  @{ board_name = New-BoardName 8 $boardLabels[7]; d20260213 = -110.00; d20260227 = 95.00; d20260306 = -20.00; d20260313 = -30.00; d20260320 = 0.00; d20260327 = 95.00 },
  @{ board_name = New-BoardName 9 $boardLabels[8]; d20260213 = -70.00; d20260227 = 40.00; d20260306 = -85.00; d20260313 = 80.00; d20260320 = 12.00; d20260327 = 30.00 }
)

$sectorSqlRows = $sectorRows | ForEach-Object {
  $v1 = (('{0:N2}' -f $_.d20260213).Replace(',', ''))
  $v2 = (('{0:N2}' -f $_.d20260227).Replace(',', ''))
  $v3 = (('{0:N2}' -f $_.d20260306).Replace(',', ''))
  $v4 = (('{0:N2}' -f $_.d20260313).Replace(',', ''))
  $v5 = (('{0:N2}' -f $_.d20260320).Replace(',', ''))
  $v6 = (('{0:N2}' -f $_.d20260327).Replace(',', ''))
  @(
    "select '$($_.board_name)' as board_name",
    "cast($v1 as decimal(12,2)) as d20260213",
    "cast($v2 as decimal(12,2)) as d20260227",
    "cast($v3 as decimal(12,2)) as d20260306",
    "cast($v4 as decimal(12,2)) as d20260313",
    "cast($v5 as decimal(12,2)) as d20260320",
    "cast($v6 as decimal(12,2)) as d20260327"
  ) -join ', '
}

$dashboardName = S @(0x4E24,0x878D,0x8D44,0x91D1,0x8DDF,0x8E2A)
$title1 = S @(0x5E02,0x573A,0x878D,0x8D44,0x4F59,0x989D,0x53D8,0x5316,0xFF08,0x4EBF,0x5143,0xFF09)
$title2 = S @(0x5206,0x677F,0x5757,0x878D,0x8D44,0x4F59,0x989D,0x5468,0x5EA6,0x53D8,0x5316,0xFF08,0x4EBF,0x5143,0xFF09)
$tag1 = S @(0x4E24,0x878D,0x8D44,0x91D1)
$tag2 = S @(0x677F,0x5757,0x8D44,0x91D1)
$metric1 = S @(0x5F53,0x5468,0x51C0,0x589E)
$metric2 = S @(0x878D,0x8D44,0x4F59,0x989D,0xFF08,0x53F3,0x8F74,0xFF09)
$unit = S @(0x4EBF,0x5143)
$boardFieldName = S @(0x677F,0x5757)
$tradeDateFieldName = S @(0x4EA4,0x6613,0x65E5,0x671F)
$netFieldName = S @(0x5F53,0x5468,0x51C0,0x589E)
$balanceFieldName = S @(0x878D,0x8D44,0x4F59,0x989D)

$dailyPool = @{
  dataPoolCode = 'market_financing_balance_pool'
  dataPoolName = 'market financing balance pool'
  dataPoolType = 'QUERY_TABLE'
  description = 'simulated weekly market financing balance trend'
  sqlText = (New-QueryTableSql -SelectRows $dailySqlRows)
  fields = @(
    @{ fieldCode = 'trade_date'; fieldName = $tradeDateFieldName; dataType = 'date'; fieldRole = 'dimension'; sourceExpr = 'dp.trade_date' },
    @{ fieldCode = 'net_change'; fieldName = $netFieldName; dataType = 'number'; fieldRole = 'metric'; aggType = 'avg'; sourceExpr = 'dp.net_change' },
    @{ fieldCode = 'financing_balance'; fieldName = $balanceFieldName; dataType = 'number'; fieldRole = 'metric'; aggType = 'avg'; sourceExpr = 'dp.financing_balance' }
  )
}

$sectorPool = @{
  dataPoolCode = 'sector_financing_weekly_pool'
  dataPoolName = 'sector financing weekly pool'
  dataPoolType = 'QUERY_TABLE'
  description = 'simulated weekly financing change by board'
  sqlText = (New-QueryTableSql -SelectRows $sectorSqlRows)
  fields = @(
    @{ fieldCode = 'board_name'; fieldName = $boardFieldName; dataType = 'string'; fieldRole = 'dimension'; sourceExpr = 'dp.board_name' },
    @{ fieldCode = 'd20260213'; fieldName = '2026/2/13'; dataType = 'number'; fieldRole = 'metric'; aggType = 'avg'; sourceExpr = 'dp.d20260213' },
    @{ fieldCode = 'd20260227'; fieldName = '2026/2/27'; dataType = 'number'; fieldRole = 'metric'; aggType = 'avg'; sourceExpr = 'dp.d20260227' },
    @{ fieldCode = 'd20260306'; fieldName = '2026/3/6'; dataType = 'number'; fieldRole = 'metric'; aggType = 'avg'; sourceExpr = 'dp.d20260306' },
    @{ fieldCode = 'd20260313'; fieldName = '2026/3/13'; dataType = 'number'; fieldRole = 'metric'; aggType = 'avg'; sourceExpr = 'dp.d20260313' },
    @{ fieldCode = 'd20260320'; fieldName = '2026/3/20'; dataType = 'number'; fieldRole = 'metric'; aggType = 'avg'; sourceExpr = 'dp.d20260320' },
    @{ fieldCode = 'd20260327'; fieldName = '2026/3/27'; dataType = 'number'; fieldRole = 'metric'; aggType = 'avg'; sourceExpr = 'dp.d20260327' }
  )
}

$existingPools = Invoke-JsonApi -Method 'GET' -Url "$apiBase/data-pool"
$poolCodes = @{}
foreach ($pool in $existingPools.data) {
  $poolCodes[$pool.dataPoolCode] = $true
}

foreach ($poolPayload in @($dailyPool, $sectorPool)) {
  if ($poolCodes.ContainsKey($poolPayload.dataPoolCode)) {
    Invoke-JsonApi -Method 'PUT' -Url "$apiBase/data-pool/$($poolPayload.dataPoolCode)" -Body $poolPayload | Out-Null
  } else {
    Invoke-JsonApi -Method 'POST' -Url "$apiBase/data-pool" -Body $poolPayload | Out-Null
  }
}

$dashboardPayload = @{
  dashboardCode = 'margin_financing_dashboard'
  draft = @{
    dashboardCode = 'margin_financing_dashboard'
    name = $dashboardName
    status = 'DRAFT'
    components = @(
      @{
        componentCode = 'cmp-market-financing-balance'
        componentType = 'chart'
        templateCode = 'mixed'
        modelCode = 'market_financing_balance_pool'
        title = $title1
        dslConfig = @{
          queryDsl = @{
            modelCode = 'market_financing_balance_pool'
            dimensionFields = @('trade_date')
            seriesFields = @()
            metrics = @(
              @{ fieldCode = 'net_change'; displayName = $metric1; aggType = 'avg'; chartType = 'bar'; yAxis = 'left'; color = '#c40000'; negativeColor = '#c40000'; smooth = $false; layerIds = @('chart-layer-1') },
              @{ fieldCode = 'financing_balance'; displayName = $metric2; aggType = 'avg'; chartType = 'line'; yAxis = 'right'; color = '#111111'; negativeColor = '#111111'; smooth = $true; layerIds = @('chart-layer-1') }
            )
            filters = @()
            orders = @(@{ fieldCode = 'trade_date'; direction = 'asc' })
            params = @{}
            limit = 500
          }
          dimensionConfigDsl = @{ stackBySecondDimension = $false; layerIds = @('chart-layer-1') }
          visualDsl = @{ title = $title1; subtitle = ''; indicatorTag = $tag1; xAxisName = ''; leftAxisName = $unit; rightAxisName = $unit }
          styleDsl = @{ showSymbol = $false; lineWidth = 2; areaOpacity = 0 }
          interactionDsl = @{ tooltip = $true; legend = $true; dataZoom = $true; slider = $true }
          chartLayersDsl = @(@{ id = 'chart-layer-1'; layerName = 'Layer 1'; enabled = $true })
          statisticalItemsDsl = @()
          layout = @{ x = 0; y = 0; w = 12; h = 8 }
          layoutDsl = @{ mode = 'list'; frozenLeftCount = 0; frozenRightCount = 0; headerRowCount = 1; bodyRowCount = 12; gridColumns = @(); gridRows = @() }
        }
      },
      @{
        componentCode = 'cmp-sector-financing-weekly'
        componentType = 'chart'
        templateCode = 'mixed'
        modelCode = 'sector_financing_weekly_pool'
        title = $title2
        dslConfig = @{
          queryDsl = @{
            modelCode = 'sector_financing_weekly_pool'
            dimensionFields = @('board_name')
            seriesFields = @()
            metrics = @(
              @{ fieldCode = 'd20260213'; displayName = '2026/2/13'; aggType = 'avg'; chartType = 'bar'; yAxis = 'left'; color = '#f7b500'; negativeColor = '#f7b500'; smooth = $false; layerIds = @('chart-layer-1') },
              @{ fieldCode = 'd20260227'; displayName = '2026/2/27'; aggType = 'avg'; chartType = 'bar'; yAxis = 'left'; color = '#b9bec7'; negativeColor = '#b9bec7'; smooth = $false; layerIds = @('chart-layer-1') },
              @{ fieldCode = 'd20260306'; displayName = '2026/3/6'; aggType = 'avg'; chartType = 'bar'; yAxis = 'left'; color = '#6a88d7'; negativeColor = '#6a88d7'; smooth = $false; layerIds = @('chart-layer-1') },
              @{ fieldCode = 'd20260313'; displayName = '2026/3/13'; aggType = 'avg'; chartType = 'bar'; yAxis = 'left'; color = '#91b84f'; negativeColor = '#91b84f'; smooth = $false; layerIds = @('chart-layer-1') },
              @{ fieldCode = 'd20260320'; displayName = '2026/3/20'; aggType = 'avg'; chartType = 'bar'; yAxis = 'left'; color = '#d9be2f'; negativeColor = '#d9be2f'; smooth = $false; layerIds = @('chart-layer-1') },
              @{ fieldCode = 'd20260327'; displayName = '2026/3/27'; aggType = 'avg'; chartType = 'bar'; yAxis = 'left'; color = '#ff1b1b'; negativeColor = '#ff1b1b'; smooth = $false; layerIds = @('chart-layer-1') }
            )
            filters = @()
            orders = @(@{ fieldCode = 'board_name'; direction = 'asc' })
            params = @{}
            limit = 100
          }
          dimensionConfigDsl = @{ stackBySecondDimension = $false; layerIds = @('chart-layer-1') }
          visualDsl = @{ title = $title2; subtitle = ''; indicatorTag = $tag2; xAxisName = ''; leftAxisName = $unit; rightAxisName = '' }
          styleDsl = @{ showSymbol = $false; lineWidth = 2; areaOpacity = 0 }
          interactionDsl = @{ tooltip = $true; legend = $true; dataZoom = $false; slider = $false }
          chartLayersDsl = @(@{ id = 'chart-layer-1'; layerName = 'Layer 1'; enabled = $true })
          statisticalItemsDsl = @()
          layout = @{ x = 12; y = 0; w = 12; h = 8 }
          layoutDsl = @{ mode = 'list'; frozenLeftCount = 0; frozenRightCount = 0; headerRowCount = 1; bodyRowCount = 12; gridColumns = @(); gridRows = @() }
        }
      }
    )
  }
}

Invoke-JsonApi -Method 'POST' -Url "$apiBase/design/dashboard/save" -Body $dashboardPayload | Out-Null
Invoke-JsonApi -Method 'POST' -Url "$apiBase/design/dashboard/publish" -Body @{ dashboardCode = 'margin_financing_dashboard' } | Out-Null

$runtime = Invoke-JsonApi -Method 'POST' -Url "$apiBase/runtime/dashboard?dashboardCode=margin_financing_dashboard" -Body @()
Write-Output ("Seeded dashboard components: " + ($runtime.data.dashboard.components.Count))
