#!/usr/bin/env bash
# Probe the live Firestore project with each query shape the app actually uses,
# and report which ones are rejected for a missing composite index.
# Read-only. Nothing is written.
#
# Firestore checks PERMISSIONS before INDEXES. A collection whose rules are not
# deployed yet answers 403, which says nothing about indexes. So this script
# reports PERMISSION_DENIED as its own outcome rather than as success — the
# earlier version treated any non-400 as "ok" and quietly mislabelled a broken
# collection as a healthy one.

cd /home/dammieoptimus/Documents/starium-app
KEY=$(grep -h VITE_FIREBASE_API_KEY .env* 2>/dev/null | head -1 | cut -d= -f2)
PROJ=$(grep -h VITE_FIREBASE_PROJECT_ID .env* 2>/dev/null | head -1 | cut -d= -f2)
URL="https://firestore.googleapis.com/v1/projects/$PROJ/databases/(default)/documents:runQuery?key=$KEY"

eq() { printf '{"fieldFilter":{"field":{"fieldPath":"%s"},"op":"EQUAL","value":{"stringValue":"__probe__"}}}' "$1"; }
ob() { printf '[{"field":{"fieldPath":"%s"},"direction":"%s"}]' "$1" "$2"; }

probe() {
  local label="$1" coll="$2" where_json="$3" order_json="$4"
  # Build the query in pieces. `${x:+...}` inside ${} is a substitution, not a
  # parameter expansion, so the orderBy clause gets its own variable.
  local where_part="" order_part=""
  [ -n "$where_json" ] && where_part=",\"where\":$where_json"
  [ -n "$order_json" ] && order_part=",\"orderBy\":$order_json"
  local body="{\"structuredQuery\":{\"from\":[{\"collectionId\":\"$coll\"}]$where_part$order_part,\"limit\":1}}"

  local out
  out=$(curl -s --data-raw "$body" -X POST "$URL" -H "Content-Type: application/json")
  # Firestore distinguishes "you never created this index" from "you created it
  # and it is still building". Both are FAILED_PRECONDITION, so a probe that only
  # looks for the phrase "requires an index" reports a perfectly good index as
  # missing, and sends you off creating duplicates.
  if echo "$out" | grep -q "currently building"; then
    printf 'BUILDING         %s\n' "$label"
  elif echo "$out" | grep -q "requires an index"; then
    printf 'MISSING INDEX    %s\n' "$label"
  elif echo "$out" | grep -q "PERMISSION_DENIED\|insufficient permissions"; then
    printf 'PERMISSION       %s  (rules not deployed — index status unknown)\n' "$label"
  elif echo "$out" | grep -q '"code": 400'; then
    printf 'BAD REQUEST      %s -> %s\n' "$label" "$(echo "$out" | tr -d '\n' | head -c 200)"
  else
    printf 'ok               %s\n' "$label"
  fi
}

echo "=== existing modules ==="
probe "carton_records: machineId+shift + roundNumber desc" carton_records \
  "$(printf '{"compositeFilter":{"op":"AND","filters":[%s,%s]}}' "$(eq machineId)" "$(eq shiftApprovalDocId)")" \
  "$(ob roundNumber DESCENDING)"

probe "carton_records: shiftApprovalDocId + roundNumber asc" carton_records \
  "$(eq shiftApprovalDocId)" "$(ob roundNumber ASCENDING)"

probe "laminate_records: machineId+shift + roundNumber desc" laminate_records \
  "$(printf '{"compositeFilter":{"op":"AND","filters":[%s,%s]}}' "$(eq machineId)" "$(eq shiftApprovalDocId)")" \
  "$(ob roundNumber DESCENDING)"

# machineDowntimeOperations.js:22-30. The range and the orderBy are both on
# stoppedAt, so the single-field index covers it. Adding the machineDisplayNumber
# equality filter is what forces a composite index. Both shapes are real — the
# second one is used whenever the page is filtered to a single machine.
probe "stopped_machines: stoppedAt range + orderBy stoppedAt" stopped_machines \
  '{"fieldFilter":{"field":{"fieldPath":"stoppedAt"},"op":"GREATER_THAN_OR_EQUAL","value":{"timestampValue":"2026-01-01T00:00:00Z"}}}' \
  "$(ob stoppedAt ASCENDING)"

probe "stopped_machines: + machineDisplayNumber (filtered view)" stopped_machines \
  "$(printf '{"compositeFilter":{"op":"AND","filters":[%s,{"fieldFilter":{"field":{"fieldPath":"stoppedAt"},"op":"GREATER_THAN_OR_EQUAL","value":{"timestampValue":"2026-01-01T00:00:00Z"}}}]}}' "$(eq machineDisplayNumber)")" \
  "$(ob stoppedAt ASCENDING)"

probe "pallet_transfers: shiftApprovalDocId + stoppedAt asc" pallet_transfers \
  "$(eq shiftApprovalDocId)" "$(ob stoppedAt ASCENDING)"

probe "pallet_transfers: date range + date asc + createdAt asc" pallet_transfers \
  '{"fieldFilter":{"field":{"fieldPath":"date"},"op":"GREATER_THAN_OR_EQUAL","value":{"stringValue":"2026-01-01"}}}' \
  '[{"field":{"fieldPath":"date"},"direction":"ASCENDING"},{"field":{"fieldPath":"createdAt"},"direction":"ASCENDING"}]'

probe "qc_bag_inspection_checks: approvalDocId+machineId + roundNumber" qc_bag_inspection_checks \
  "$(printf '{"compositeFilter":{"op":"AND","filters":[%s,%s]}}' "$(eq approvalDocId)" "$(eq machineId)")" \
  "$(ob roundNumber ASCENDING)"

probe "qc_carton_inspection_checks: approvalDocId+machineId + roundNumber" qc_carton_inspection_checks \
  "$(printf '{"compositeFilter":{"op":"AND","filters":[%s,%s]}}' "$(eq approvalDocId)" "$(eq machineId)")" \
  "$(ob roundNumber ASCENDING)"

probe "qc_string_weight_checks: approvalDocId+machineId + roundNumber" qc_string_weight_checks \
  "$(printf '{"compositeFilter":{"op":"AND","filters":[%s,%s]}}' "$(eq approvalDocId)" "$(eq machineId)")" \
  "$(ob roundNumber ASCENDING)"

probe "employees: fullName asc alone (real query in employeeOperations)" employees "" "$(ob fullName ASCENDING)"

echo
echo "=== new leave_requests queries (Phase 4) ==="

probe "leave_requests: employeeId + requestedAt desc" leave_requests \
  "$(eq employeeId)" "$(ob requestedAt DESCENDING)"

probe "leave_requests: status + requestedAt desc" leave_requests \
  "$(eq status)" "$(ob requestedAt DESCENDING)"

probe "leave_requests: status == approved (single field)" leave_requests \
  "$(eq status)" ""

probe "leave_requests: approved + date range (away-on-date)" leave_requests \
  "$(printf '{"compositeFilter":{"op":"AND","filters":[%s,{"fieldFilter":{"field":{"fieldPath":"leaveCommences"},"op":"LESS_THAN_OR_EQUAL","value":{"timestampValue":"2026-12-31T23:59:59Z"}}},{"fieldFilter":{"field":{"fieldPath":"leaveEnds"},"op":"GREATER_THAN_OR_EQUAL","value":{"timestampValue":"2026-01-01T00:00:00Z"}}}]}}' "$(eq status)")" ""