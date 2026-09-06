#!/usr/bin/env sh
# Runs the adversarial RLS tenant-isolation test against a Supabase database.
#
# Usage:
#   ./supabase/rls/run-tenant-isolation-test.sh "postgresql://..."
#
# The connection string must belong to a role that bypasses RLS (postgres /
# supabase_admin / a superuser).
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$DIR/tenant_isolation.test.sql"

echo "Running RLS tenant-isolation test against the target database..."
echo "  psql -v ON_ERROR_STOP=1 -f $SCRIPT"
psql "$1" -v ON_ERROR_STOP=1 -f "$SCRIPT"

echo
echo "PASS: RLS tenant-isolation test passed (no cross-tenant access found)."
echo