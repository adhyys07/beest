<#
.SYNOPSIS
  Restore a production Postgres backup into the local dev database.

.DESCRIPTION
  Prod backups in backups/ are pg17-format custom archives (pg_dump -Fc). The dev
  db container is pinned to postgres:17 (docker-compose.dev.yml) so its in-container
  pg_restore can read them. This script does a CLEAN restore: it drops and recreates
  the public schema, then restores the dump, so no stale rows survive.

.PARAMETER DumpPath
  Path to the .dmp to restore. Defaults to the most recent file in backups/.

.EXAMPLE
  ./scripts/restore-db.ps1
  ./scripts/restore-db.ps1 -DumpPath backups/pg-dump-postgres-1779395494.dmp
#>
param(
  [string]$DumpPath
)

$ErrorActionPreference = "Stop"

$RepoRoot   = Split-Path -Parent $PSScriptRoot
$Compose    = Join-Path $RepoRoot "docker-compose.dev.yml"
$Container  = "beest-db-1"
$PgUser     = "postgres"
$PgDb       = "postgres"
$env:PGPASSWORD = "password"   # matches docker-compose.dev.yml

# Resolve the dump (default: newest in backups/)
if (-not $DumpPath) {
  $latest = Get-ChildItem -Path (Join-Path $RepoRoot "backups") -Filter *.dmp |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $latest) { throw "No .dmp files found in backups/" }
  $DumpPath = $latest.FullName
}
if (-not (Test-Path $DumpPath)) { throw "Dump not found: $DumpPath" }
Write-Host "Restoring from: $DumpPath"

# Ensure the db container is up
docker compose -f $Compose up -d | Out-Null

Write-Host "Waiting for Postgres to accept connections..."
for ($i = 0; $i -lt 60; $i++) {
  docker exec $Container pg_isready -U $PgUser -d $PgDb *> $null
  if ($?) { break }
  Start-Sleep -Seconds 1
}

# Copy dump into the container (avoids PowerShell mangling the binary on stdin)
$tmp = "/tmp/restore.dmp"
docker cp $DumpPath "${Container}:${tmp}"

# Clean restore: wipe the schema first so no stale rows survive
Write-Host "Dropping and recreating public schema..."
docker exec -e PGPASSWORD=$env:PGPASSWORD $Container `
  psql -U $PgUser -d $PgDb -v ON_ERROR_STOP=1 `
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

Write-Host "Running pg_restore..."
docker exec -e PGPASSWORD=$env:PGPASSWORD $Container `
  pg_restore -U $PgUser -d $PgDb --no-owner --no-acl $tmp

docker exec $Container rm -f $tmp | Out-Null

# Freshness check: how old is the newest signup?
Write-Host "`nRestore complete. Freshness:"
docker exec -e PGPASSWORD=$env:PGPASSWORD $Container `
  psql -U $PgUser -d $PgDb -x -c @"
SELECT (now() AT TIME ZONE 'UTC')                                     AS now_utc,
       max(created_at)                                                AS latest_signup,
       justify_interval((now() AT TIME ZONE 'UTC') - max(created_at)) AS freshness_age,
       count(*)                                                       AS total_users
FROM users;
"@
