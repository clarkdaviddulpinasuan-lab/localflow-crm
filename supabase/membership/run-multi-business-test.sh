#!/usr/bin/env sh
# Runs the multi-business membership + RLS test against a Supabase database.
#
# Usage:
#   ./supabase/membership/run-multi-business-test.sh "postgresql://..."
#
# The connection string must belong to a role that bypasses RLS (postgres /
# supabase_admin / a superuser) and must run against a database with
# migrations 001-018 applied.
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$DIR/multi_business.test.sql"

echo "Running multi-business membership + RLS test against the target database..."
echo "  psql -v ON_ERROR_STOP=1 -f $SCRIPT"
psql "$1" -v ON_ERROR_STOP=1 -f "$SCRIPT"

echo
echo "PASS: multi-business test passed (switching, leave, admin-created accounts, ownership guard all hold)."
echo