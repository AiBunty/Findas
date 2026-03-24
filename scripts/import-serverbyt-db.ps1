param(
    [string]$HostName = 'sdb-87.hosting.stackcp.net',
    [string]$UserName = 'Findas-353131330571',
    [string]$Database = 'findas_db',
    [string]$SchemaFile = '.\backend\sql\serverbyt_mysql_schema.sql'
)

$mysqlCmd = Get-Command mysql -ErrorAction SilentlyContinue
if (-not $mysqlCmd) {
    Write-Error "MySQL client was not found in PATH. Install MySQL client or use phpMyAdmin to import $SchemaFile."
    exit 1
}

if (-not (Test-Path $SchemaFile)) {
    Write-Error "Schema file not found: $SchemaFile"
    exit 1
}

Write-Host "Importing schema to $HostName / $Database as $UserName"
Write-Host "You will be prompted for DB password by mysql."

$schemaAbs = Resolve-Path $SchemaFile
$schemaContent = Get-Content $schemaAbs -Raw
$schemaContent = $schemaContent -replace '\bfindas_db\b', $Database

$schemaContent | & $mysqlCmd.Source -h $HostName -u $UserName -p --default-character-set=utf8mb4

if ($LASTEXITCODE -ne 0) {
    Write-Error "Schema import failed (exit code: $LASTEXITCODE)."
    exit $LASTEXITCODE
}

Write-Host "Schema import completed successfully."
