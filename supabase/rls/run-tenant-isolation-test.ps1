# run-tenant-isolation-test.ps1
# Runs the adversarial RLS tenant-isolation test against a Supabase database.
#
# Usage:
#   .\supabase\rls\run-tenant-isolation-test.ps1 -ConnectionString "postgresql://..."
#
# The connection string must belong to a role that bypasses RLS (postgres /
# supabase_admin / a superuser).
param(
  [Parameter(Mandatory = $true)]
  [string]$ConnectionString
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $scriptDir 'tenant_isolation.test.sql'

Write-Host "Running RLS tenant-isolation test against the target database..."
Write-Host "  psql -v ON_ERROR_STOP=1 -f $script"
& psql "$ConnectionString" -v ON_ERROR_STOP=1 -f "$script"

if ($LASTEXITCODE -eq 0) {
  Write-Host "`nPASS: RLS tenant-isolation test passed (no cross-tenant access found).`n"
} else {
  Write-Host "`nFAIL: RLS tenant-isolation test failed. Review the exception above and fix the flagged policy before any other work.`n" -ForegroundColor Red
}
exit $LASTEXITCODE