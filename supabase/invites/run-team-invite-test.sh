#!/usr/bin/env sh
# Runs the team-invite behavior + RLS test against a Supabase database.
#
# Usage:
#   ./supabase/invites/run-team-invite-test.sh "postgresql://..."
#
# The connection string must belong to a role that bypasses RLS (postgres /
# supabase_admin / a superuser) and must run against a database with
# migrations 001-017 applied.
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$DIR/team_invite.test.sql"

echo "Running team-invite behavior + RLS test against the target database..."
echo "  psql -v ON_ERROR_STOP=1 -f $SCRIPT"
psql "$1" -v ON_ERROR_STOP=1 -f "$SCRIPT"

echo
echo "PASS: team-invite test passed (invitees join the inviter's business; all reject paths hold)."
echo