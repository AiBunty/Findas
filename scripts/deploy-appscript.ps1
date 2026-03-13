param(
  [ValidateSet('content', 'polls', 'all')]
  [string]$Target = 'all',
  [switch]$PushOnly,
  [switch]$UpdateConfigFromDeploy,
  [string]$Description = "Workspace update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

$ErrorActionPreference = 'Stop'

function Invoke-Clasp {
  param(
    [string]$WorkingDir,
    [string[]]$ClaspCommandArgs
  )

  Push-Location $WorkingDir
  try {
    Write-Host ("[clasp] {0} > clasp {1}" -f $WorkingDir, ($ClaspCommandArgs -join ' '))
    $out = & clasp @ClaspCommandArgs
    if ($LASTEXITCODE -ne 0) {
      throw ("clasp command failed in {0}: clasp {1}" -f $WorkingDir, ($ClaspCommandArgs -join ' '))
    }
    return ($out -join "`n")
  }
  finally {
    Pop-Location
  }
}

function Sync-SourceFile {
  param(
    [string]$Source,
    [string]$Destination
  )

  if (-not (Test-Path $Source)) {
    Write-Warning "Source file not found, skipping sync: $Source"
    return
  }

  $resolvedSource = (Get-Item $Source).FullName
  $resolvedDest = if (Test-Path $Destination) { (Get-Item $Destination).FullName } else { [System.IO.Path]::GetFullPath($Destination) }
  if ([string]::Equals($resolvedSource, $resolvedDest, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Host "Sync skipped (same file): $Source"
    return
  }

  Copy-Item -Path $Source -Destination $Destination -Force
  Write-Host "Synced: $Source -> $Destination"
}

function Get-LatestWritableDeploymentId {
  param([string]$DeploymentsText)

  $ids = @()
  foreach ($line in ($DeploymentsText -split "`n")) {
    if ($line -match '^\-\s+([A-Za-z0-9_-]+)\s+@(\d+)') {
      $ids += [PSCustomObject]@{
        Id = $Matches[1]
        Version = [int]$Matches[2]
      }
    }
  }

  if ($ids.Count -eq 0) {
    return $null
  }

  return ($ids | Sort-Object Version -Descending | Select-Object -First 1).Id
}

function Set-ConfigUrl {
  param(
    [string]$ConfigPath,
    [string]$Key,
    [string]$DeploymentId
  )

  $url = "https://script.google.com/macros/s/$DeploymentId/exec"
  $text = Get-Content -Path $ConfigPath -Raw
  $escapedKey = [regex]::Escape($Key)
  $pattern = "(?m)^(\s*${escapedKey}:\s*)'https://script\.google\.com/macros/s/[^']+/exec'"
  $replacement = "`$1'$url'"

  $newText = [regex]::Replace($text, $pattern, $replacement)
  if ($newText -eq $text) {
    Write-Warning "Could not update config key: $Key"
  }
  else {
    Set-Content -Path $ConfigPath -Value $newText -Encoding UTF8
    Write-Host "Updated appscript-config.js: $Key -> $url"
  }
}

function Maybe-SetConfigUrl {
  param(
    [string]$ConfigPath,
    [string]$Key,
    [string]$DeploymentId,
    [bool]$ShouldUpdate
  )

  if (-not $ShouldUpdate) {
    Write-Host "Preserving appscript-config.js as source of truth: skipped $Key update"
    return
  }

  Set-ConfigUrl -ConfigPath $ConfigPath -Key $Key -DeploymentId $DeploymentId
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$configPath = Join-Path $repoRoot 'appscript-config.js'

$projects = @()
if ($Target -eq 'content' -or $Target -eq 'all') {
  $projects += [PSCustomObject]@{
    Name = 'content'
    Dir = Join-Path $repoRoot 'gas-content'
    Source = Join-Path $repoRoot 'gas-content\Code.gs'
    Dest = Join-Path $repoRoot 'gas-content\Code.gs'
    ConfigKey = 'WEBAPP_URL'
  }
}
if ($Target -eq 'polls' -or $Target -eq 'all') {
  $projects += [PSCustomObject]@{
    Name = 'polls'
    Dir = Join-Path $repoRoot 'gas-polls'
    Source = Join-Path $repoRoot 'GOOGLE_APPSCRIPT_CODE.gs'
    Dest = Join-Path $repoRoot 'gas-polls\code.gs'
    ConfigKey = 'POLLS_DEPLOYMENT_URL'
  }
}

foreach ($project in $projects) {
  Write-Host "`n=== Deploying $($project.Name) ==="

  if (-not (Test-Path $project.Dir)) {
    throw "Missing clasp directory: $($project.Dir)"
  }

  Sync-SourceFile -Source $project.Source -Destination $project.Dest
  Invoke-Clasp -WorkingDir $project.Dir -ClaspCommandArgs @('push') | Out-Null

  if ($PushOnly) {
    Write-Host "PushOnly mode: skipped deployment update for $($project.Name)."
    continue
  }

  $deployments = Invoke-Clasp -WorkingDir $project.Dir -ClaspCommandArgs @('deployments')
  $deploymentId = Get-LatestWritableDeploymentId -DeploymentsText $deployments

  if ($deploymentId) {
    Invoke-Clasp -WorkingDir $project.Dir -ClaspCommandArgs @('deploy', '--deploymentId', $deploymentId, '--description', $Description) | Out-Null
  }
  else {
    $deployOut = Invoke-Clasp -WorkingDir $project.Dir -ClaspCommandArgs @('deploy', '--description', $Description)
    if ($deployOut -match 'Deployed\s+([A-Za-z0-9_-]+)') {
      $deploymentId = $Matches[1]
    }
    else {
      throw "Failed to capture deployment ID for $($project.Name)."
    }
  }

  if (-not $deploymentId) {
    throw "No deployment ID resolved for $($project.Name)."
  }

  Maybe-SetConfigUrl -ConfigPath $configPath -Key $project.ConfigKey -DeploymentId $deploymentId -ShouldUpdate $UpdateConfigFromDeploy.IsPresent
}

Write-Host "`nDone. Apps Script deploy flow completed."
