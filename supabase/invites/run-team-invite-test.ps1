# run-team-invite-test.ps1
# Runs the team-invite behavior + RLS test against a Supabase database.
#
# Usage:
#   .\supabase\invites\run-team-invite-test.ps1 -ConnectionString "postgresql://..."
#
# The connection string must belong to a role that bypasses RLS (postgres /
# supabase_admin / a superuser) and must run against a database with
# migrations 001-017 applied.
param(
  [Parameter(Mandatory = $true)]
  [string]$ConnectionString
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $scriptDir 'team_invite.test.sql'

Write-Host "Running team-invite behavior + RLS test against the target database..."
Write-Host "  psql -v ON_ERROR_STOP=1 -f $script"
& psql "$ConnectionString" -v ON_ERROR_STOP=1 -f "$script"

if ($LASTEXITCODE -eq 0) {
  Write-Host "`nPASS: team-invite test passed (invitees join the inviter's business; all reject paths hold).`n"
} else {
  Write-Host "`nFAIL: team-invite test failed. Review the exception above; a reject path may be leaking.`n" -ForegroundColor Red
}
exit $LASTEXITCODE