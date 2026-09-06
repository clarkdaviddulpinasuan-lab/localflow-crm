# run-multi-business-test.ps1
# Runs the multi-business membership + RLS test against a Supabase database.
#
# Usage:
#   .\supabase\membership\run-multi-business-test.ps1 -ConnectionString "postgresql://..."
#
# The connection string must belong to a role that bypasses RLS (postgres /
# supabase_admin / a superuser) and must run against a database with
# migrations 001-018 applied.
param(
  [Parameter(Mandatory = $true)]
  [string]$ConnectionString
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $scriptDir 'multi_business.test.sql'

Write-Host "Running multi-business membership + RLS test against the target database..."
Write-Host "  psql -v ON_ERROR_STOP=1 -f $script"
& psql "$ConnectionString" -v ON_ERROR_STOP=1 -f "$script"

if ($LASTEXITCODE -eq 0) {
  Write-Host "`nPASS: multi-business test passed (switching, leave, admin-created accounts, ownership guard all hold).`n"
} else {
  Write-Host "`nFAIL: multi-business test failed. Review the exception above; a reject path may be leaking.`n" -ForegroundColor Red
}
exit $LASTEXITCODE