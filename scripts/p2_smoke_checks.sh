#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
LOGIN_IDENTIFIER="${LOGIN_IDENTIFIER:-admin}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-ChangeMe@123}"

echo "[1/3] Health check: ${BASE_URL}/api/health"
HEALTH_BODY="$(mktemp)"
HEALTH_STATUS="$(curl -sS -o "${HEALTH_BODY}" -w "%{http_code}" "${BASE_URL}/api/health")"
if [[ "${HEALTH_STATUS}" != "200" ]]; then
  echo "Health check failed (HTTP ${HEALTH_STATUS})"
  cat "${HEALTH_BODY}"
  rm -f "${HEALTH_BODY}"
  exit 1
fi
if ! grep -q '"status":"ok"' "${HEALTH_BODY}"; then
  echo "Health payload is unexpected"
  cat "${HEALTH_BODY}"
  rm -f "${HEALTH_BODY}"
  exit 1
fi
echo "Health check OK"
rm -f "${HEALTH_BODY}"

echo "[2/3] Web login check: ${BASE_URL}/api/v1/auth/login"
LOGIN_BODY="$(mktemp)"
LOGIN_HEADERS="$(mktemp)"
LOGIN_STATUS="$(
  curl -sS -D "${LOGIN_HEADERS}" -o "${LOGIN_BODY}" -w "%{http_code}" \
    -H "Content-Type: application/json" \
    -X POST "${BASE_URL}/api/v1/auth/login" \
    -d "{\"identifier\":\"${LOGIN_IDENTIFIER}\",\"password\":\"${LOGIN_PASSWORD}\"}"
)"
if [[ "${LOGIN_STATUS}" != "200" ]]; then
  echo "Login failed (HTTP ${LOGIN_STATUS})"
  cat "${LOGIN_BODY}"
  rm -f "${LOGIN_BODY}" "${LOGIN_HEADERS}"
  exit 1
fi
if ! grep -qi '^x-request-id:' "${LOGIN_HEADERS}"; then
  echo "Missing x-request-id on login response"
  rm -f "${LOGIN_BODY}" "${LOGIN_HEADERS}"
  exit 1
fi

ACCESS_TOKEN="$(grep -o '"accessToken":"[^"]*"' "${LOGIN_BODY}" | head -n1 | cut -d '"' -f4)"
if [[ -z "${ACCESS_TOKEN}" ]]; then
  echo "Unable to read accessToken from login payload"
  cat "${LOGIN_BODY}"
  rm -f "${LOGIN_BODY}" "${LOGIN_HEADERS}"
  exit 1
fi
echo "Login OK"
rm -f "${LOGIN_BODY}" "${LOGIN_HEADERS}"

echo "[3/3] Protected endpoint check: ${BASE_URL}/api/v1/dashboard/kpis"
KPIS_BODY="$(mktemp)"
KPIS_HEADERS="$(mktemp)"
KPIS_STATUS="$(
  curl -sS -D "${KPIS_HEADERS}" -o "${KPIS_BODY}" -w "%{http_code}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    "${BASE_URL}/api/v1/dashboard/kpis"
)"
if [[ "${KPIS_STATUS}" != "200" ]]; then
  echo "Protected endpoint failed (HTTP ${KPIS_STATUS})"
  cat "${KPIS_BODY}"
  rm -f "${KPIS_BODY}" "${KPIS_HEADERS}"
  exit 1
fi
if ! grep -qi '^x-request-id:' "${KPIS_HEADERS}"; then
  echo "Missing x-request-id on KPI response"
  rm -f "${KPIS_BODY}" "${KPIS_HEADERS}"
  exit 1
fi
echo "Protected endpoint OK"
rm -f "${KPIS_BODY}" "${KPIS_HEADERS}"

echo "P2 smoke checks passed."
