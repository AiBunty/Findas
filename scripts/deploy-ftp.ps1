param(
  [string]$FtpHost = 'ftp.theboxerp.com',
  [string]$Username = $env:FINDAS_FTP_USER,
  [string]$Password = $env:FINDAS_FTP_PASS,
  [string]$RemoteRoot = '',
  [ValidateSet('Changed', 'All')]
  [string]$Mode = 'Changed',
  [string]$ChangedBase = 'HEAD',
  [switch]$IncludeUntracked,
  [switch]$DryRun,
  [string]$StateFile = '.deploy/ftp-state.json',
  [string[]]$IncludePatterns = @(
    '**/*'
  ),
  [string[]]$ExcludePatterns = @(
    '.git/**',
    '.vscode/**',
    'node_modules/**',
    'backend/node_modules/**'
  )
)

$ErrorActionPreference = 'Stop'

function Get-WorkspaceRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

function Get-WorkspaceSettings {
  param([string]$WorkspaceRoot)

  $settingsPath = Join-Path $WorkspaceRoot '.vscode\settings.json'
  if (-not (Test-Path $settingsPath -PathType Leaf)) {
    return $null
  }

  try {
    return (Get-Content -Path $settingsPath -Raw | ConvertFrom-Json)
  }
  catch {
    throw "Failed to parse VS Code settings: $settingsPath"
  }
}

function Get-SettingValue {
  param(
    [object]$Settings,
    [string]$Name
  )

  if ($null -eq $Settings) { return $null }
  $prop = $Settings.PSObject.Properties[$Name]
  if ($null -eq $prop) { return $null }
  return $prop.Value
}

function Assert-Required {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) {
    throw $Message
  }
}

function Normalize-RelPath {
  param([string]$Path)
  $p = ($Path -replace '\\', '/').Trim()
  while ($p.StartsWith('./')) { $p = $p.Substring(2) }
  return $p
}

function Test-GlobMatch {
  param(
    [string]$Value,
    [string[]]$Patterns
  )

  if (-not $Patterns -or $Patterns.Count -eq 0) {
    return $true
  }

  foreach ($pattern in $Patterns) {
    if ([string]::IsNullOrWhiteSpace($pattern)) { continue }
    $wild = ($pattern -replace '\\', '/').Replace('**', '*')
    if ($Value -like $wild) {
      return $true
    }
  }

  return $false
}

function Get-RepoRoot {
  $root = (& git rev-parse --show-toplevel 2>$null)
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($root)) {
    throw 'Git repository root not found. Run this script inside the repository.'
  }
  return $root.Trim()
}

function Get-ChangedFileList {
  param(
    [string]$Base,
    [switch]$IncludeUntrackedFiles
  )

  $files = New-Object System.Collections.Generic.List[string]

  $diffFiles = (& git diff --name-only --diff-filter=ACMRTUXB $Base)
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to collect changed files from git diff against '$Base'."
  }
  foreach ($f in $diffFiles) {
    if (-not [string]::IsNullOrWhiteSpace($f)) {
      $files.Add((Normalize-RelPath $f))
    }
  }

  $stagedFiles = (& git diff --cached --name-only --diff-filter=ACMRTUXB)
  if ($LASTEXITCODE -eq 0) {
    foreach ($f in $stagedFiles) {
      if (-not [string]::IsNullOrWhiteSpace($f)) {
        $files.Add((Normalize-RelPath $f))
      }
    }
  }

  if ($IncludeUntrackedFiles) {
    $untracked = (& git ls-files --others --exclude-standard)
    if ($LASTEXITCODE -eq 0) {
      foreach ($f in $untracked) {
        if (-not [string]::IsNullOrWhiteSpace($f)) {
          $files.Add((Normalize-RelPath $f))
        }
      }
    }
  }

  return $files | Select-Object -Unique
}

function Get-AllDeployableFiles {
  param([string]$Root)
  $all = Get-ChildItem -Path $Root -Recurse -File | ForEach-Object {
    $full = $_.FullName
    $rel = $full.Substring($Root.Length).TrimStart([char[]]@(92, 47))
    Normalize-RelPath $rel
  }
  return $all
}

function Build-DeployFileList {
  param(
    [string]$Root,
    [string[]]$Candidates,
    [string[]]$Includes,
    [string[]]$Excludes
  )

  $result = New-Object System.Collections.Generic.List[string]

  foreach ($candidate in $Candidates) {
    $rel = Normalize-RelPath $candidate
    if ([string]::IsNullOrWhiteSpace($rel)) { continue }

    if (-not (Test-GlobMatch -Value $rel -Patterns $Includes)) { continue }
    if (Test-GlobMatch -Value $rel -Patterns $Excludes) { continue }

    $localPath = Join-Path $Root ($rel -replace '/', '\\')
    if (-not (Test-Path $localPath -PathType Leaf)) { continue }

    $result.Add($rel)
  }

  return $result | Select-Object -Unique
}

function Get-FileSha256 {
  param([string]$Path)
  $hash = Get-FileHash -Path $Path -Algorithm SHA256
  return $hash.Hash
}

function Get-DeployState {
  param([string]$Root, [string]$RelativePath)
  $statePath = Join-Path $Root ($RelativePath -replace '/', '\\')
  if (-not (Test-Path $statePath -PathType Leaf)) {
    return [ordered]@{ files = @{} }
  }
  try {
    $raw = Get-Content -Path $statePath -Raw
    $obj = $raw | ConvertFrom-Json -AsHashtable
    if (-not $obj.Contains('files')) {
      $obj['files'] = @{}
    }
    return $obj
  }
  catch {
    return [ordered]@{ files = @{} }
  }
}

function Save-DeployState {
  param([string]$Root, [string]$RelativePath, [hashtable]$State)
  $statePath = Join-Path $Root ($RelativePath -replace '/', '\\')
  $dir = Split-Path -Parent $statePath
  if (-not (Test-Path $dir -PathType Container)) {
    New-Item -Path $dir -ItemType Directory -Force | Out-Null
  }
  ($State | ConvertTo-Json -Depth 8) | Set-Content -Path $statePath -Encoding UTF8
}

function Filter-AlreadyDeployedFiles {
  param(
    [string]$Root,
    [string[]]$Files,
    [hashtable]$State
  )

  $out = New-Object System.Collections.Generic.List[string]
  if (-not $State.Contains('files')) {
    $State['files'] = @{}
  }
  $filesMap = $State['files']

  foreach ($rel in $Files) {
    $local = Join-Path $Root ($rel -replace '/', '\\')
    if (-not (Test-Path $local -PathType Leaf)) { continue }
    $sha = Get-FileSha256 -Path $local
    $prev = $null
    if ($filesMap.Contains($rel)) {
      $prev = [string]$filesMap[$rel]
    }
    if ($prev -ne $sha) {
      $out.Add($rel)
    }
  }

  return $out
}

function New-FtpRequest {
  param(
    [string]$Uri,
    [string]$Method,
    [System.Net.NetworkCredential]$Credentials
  )

  $request = [System.Net.FtpWebRequest]::Create([Uri]$Uri)
  $request.Method = $Method
  $request.Credentials = $Credentials
  $request.UsePassive = $true
  $request.UseBinary = $true
  $request.KeepAlive = $false
  return $request
}

function Ensure-FtpDirectory {
  param(
    [string]$HostName,
    [string]$DirectoryPath,
    [System.Net.NetworkCredential]$Credentials,
    [switch]$NoCreate
  )

  if ([string]::IsNullOrWhiteSpace($DirectoryPath)) { return }

  $parts = $DirectoryPath.Split('/', [System.StringSplitOptions]::RemoveEmptyEntries)
  $current = ''

  foreach ($part in $parts) {
    if ($current) { $current = "$current/$part" } else { $current = $part }

    if ($NoCreate) {
      Write-Host "[dry-run] Ensure remote dir: /$current"
      continue
    }

    $uri = "ftp://$HostName/$current"
    $request = New-FtpRequest -Uri $uri -Method ([System.Net.WebRequestMethods+Ftp]::MakeDirectory) -Credentials $Credentials
    try {
      $response = $request.GetResponse()
      $response.Close()
      Write-Host "Created remote dir: /$current"
    }
    catch {
      $message = $_.Exception.Message
      if ($message -match '550') {
        continue
      }
      throw
    }
  }
}

function Upload-FtpFile {
  param(
    [string]$HostName,
    [string]$LocalPath,
    [string]$RemotePath,
    [System.Net.NetworkCredential]$Credentials,
    [switch]$NoUpload
  )

  if ($NoUpload) {
    Write-Host "[dry-run] Upload: $RemotePath"
    return
  }

  $uri = "ftp://$HostName/$RemotePath"
  $request = New-FtpRequest -Uri $uri -Method ([System.Net.WebRequestMethods+Ftp]::UploadFile) -Credentials $Credentials

  $bytes = [System.IO.File]::ReadAllBytes($LocalPath)
  $request.ContentLength = $bytes.Length

  $stream = $request.GetRequestStream()
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Close()

  $response = $request.GetResponse()
  $status = $response.StatusDescription.Trim()
  $response.Close()

  Write-Host "Uploaded: $RemotePath ($($bytes.Length) bytes) :: $status"
}

$workspaceRoot = Get-WorkspaceRoot
$workspaceSettings = Get-WorkspaceSettings -WorkspaceRoot $workspaceRoot

if ([string]::IsNullOrWhiteSpace($FtpHost)) {
  $FtpHost = [string](Get-SettingValue -Settings $workspaceSettings -Name 'findas.ftp.host')
}
if ([string]::IsNullOrWhiteSpace($Username)) {
  $Username = [string](Get-SettingValue -Settings $workspaceSettings -Name 'findas.ftp.username')
}
if ([string]::IsNullOrWhiteSpace($Password)) {
  $Password = [string](Get-SettingValue -Settings $workspaceSettings -Name 'findas.ftp.password')
}
if ([string]::IsNullOrWhiteSpace($RemoteRoot)) {
  $RemoteRoot = [string](Get-SettingValue -Settings $workspaceSettings -Name 'findas.ftp.remoteRoot')
}

Assert-Required -Condition (-not [string]::IsNullOrWhiteSpace($Username)) -Message 'FTP username is required. Set findas.ftp.username in .vscode/settings.json or pass -Username.'
Assert-Required -Condition (-not [string]::IsNullOrWhiteSpace($Password)) -Message 'FTP password is required. Set findas.ftp.password in .vscode/settings.json or pass -Password.'

$repoRoot = Get-RepoRoot
$credentials = New-Object System.Net.NetworkCredential($Username, $Password)
$remoteRootNormalized = (Normalize-RelPath $RemoteRoot).Trim('/')

$candidates = @()
if ($Mode -eq 'Changed') {
  $candidates = Get-ChangedFileList -Base $ChangedBase -IncludeUntrackedFiles:$IncludeUntracked
}
else {
  $candidates = Get-AllDeployableFiles -Root $repoRoot
}

$deployFiles = Build-DeployFileList -Root $repoRoot -Candidates $candidates -Includes $IncludePatterns -Excludes $ExcludePatterns

$deployState = Get-DeployState -Root $repoRoot -RelativePath $StateFile
$deployFiles = Filter-AlreadyDeployedFiles -Root $repoRoot -Files $deployFiles -State $deployState

if (-not $deployFiles -or $deployFiles.Count -eq 0) {
  Write-Host 'No matching files to deploy.'
  exit 0
}

Write-Host "Mode: $Mode"
Write-Host "Host: $FtpHost"
Write-Host "Remote root: /$remoteRootNormalized"
Write-Host "Files to upload: $($deployFiles.Count)"

$createdDirs = New-Object System.Collections.Generic.HashSet[string]

foreach ($rel in $deployFiles) {
  $local = Join-Path $repoRoot ($rel -replace '/', '\\')
  $remote = if ($remoteRootNormalized) { "$remoteRootNormalized/$rel" } else { $rel }
  $remote = Normalize-RelPath $remote

  $dir = [System.IO.Path]::GetDirectoryName($remote)
  if ($dir) {
    $dir = Normalize-RelPath $dir
    if (-not $createdDirs.Contains($dir)) {
      Ensure-FtpDirectory -HostName $FtpHost -DirectoryPath $dir -Credentials $credentials -NoCreate:$DryRun
      [void]$createdDirs.Add($dir)
    }
  }

  Upload-FtpFile -HostName $FtpHost -LocalPath $local -RemotePath $remote -Credentials $credentials -NoUpload:$DryRun

  if (-not $DryRun) {
    if (-not $deployState.Contains('files')) {
      $deployState['files'] = @{}
    }
    $deployState['files'][$rel] = Get-FileSha256 -Path $local
  }
}

if (-not $DryRun) {
  Save-DeployState -Root $repoRoot -RelativePath $StateFile -State $deployState
}

Write-Host 'FTP deployment completed.'
