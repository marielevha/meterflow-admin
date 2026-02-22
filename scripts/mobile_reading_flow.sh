#!/usr/bin/env bash

set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required (install with: sudo apt install jq)"
  exit 1
fi

if [ $# -lt 1 ]; then
  cat <<'EOF'
Usage:
  scripts/mobile_reading_flow.sh /home/ssdlv/Images/c1.jpg

Optional environment variables:
  API_BASE=http://localhost:3000
  IDENTIFIER=+221700000008
  PASSWORD=ChangeMe@123
  METER_ID=bd2f14a4-4231-4f42-b547-1de6dfd6277b                    # if omitted: first meter of client is used
  PRIMARY_INDEX=1234.5
  SECONDARY_INDEX=345.6              # required only for dual-index meters
  GPS_LAT=14.75
  GPS_LNG=-17.43
  GPS_ACCURACY=5.0
  IDEMPOTENCY_KEY=reading-001
EOF
  exit 1
fi

FILE_PATH="$1"
if [ ! -f "$FILE_PATH" ]; then
  echo "Error: file not found: $FILE_PATH"
  exit 1
fi

API_BASE="${API_BASE:-http://localhost:3000}"
IDENTIFIER="${IDENTIFIER:-+221700000008}"
PASSWORD="${PASSWORD:-ChangeMe@123}"
PRIMARY_INDEX="${PRIMARY_INDEX:-1234.5}"
SECONDARY_INDEX="${SECONDARY_INDEX:-345.6}"
GPS_LAT="${GPS_LAT:-14.75}"
GPS_LNG="${GPS_LNG:--17.43}"
GPS_ACCURACY="${GPS_ACCURACY:-5.0}"
IDEMPOTENCY_KEY="${IDEMPOTENCY_KEY:-reading-$(date +%s)}"

FILE_NAME="$(basename "$FILE_PATH")"
FILE_SIZE="$(stat -c%s "$FILE_PATH")"
FILE_SHA256="$(sha256sum "$FILE_PATH" | awk '{print $1}')"

case "${FILE_NAME,,}" in
  *.jpg|*.jpeg) MIME_TYPE="image/jpeg" ;;
  *.png) MIME_TYPE="image/png" ;;
  *.webp) MIME_TYPE="image/webp" ;;
  *) MIME_TYPE="application/octet-stream" ;;
esac

echo "== 1) Login =="
LOGIN_JSON="$(curl -sS -X POST "$API_BASE/api/v1/mobile/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$IDENTIFIER\",\"password\":\"$PASSWORD\"}")"

ACCESS_TOKEN="$(echo "$LOGIN_JSON" | jq -r '.accessToken // empty')"
if [ -z "$ACCESS_TOKEN" ]; then
  echo "Login failed:"
  echo "$LOGIN_JSON" | jq .
  exit 1
fi
echo "Login OK"

if [ -z "${METER_ID:-}" ]; then
  echo "== 2) Resolve meter =="
  METERS_JSON="$(curl -sS -X GET "$API_BASE/api/v1/mobile/meters" \
    -H "Authorization: Bearer $ACCESS_TOKEN")"
  METER_ID="$(echo "$METERS_JSON" | jq -r '.meters[0].id // empty')"
  if [ -z "$METER_ID" ]; then
    echo "No meter found for client:"
    echo "$METERS_JSON" | jq .
    exit 1
  fi
  echo "Using meter: $METER_ID"
fi

echo "== 3) Presign =="
PRESIGN_PAYLOAD="$(jq -n \
  --arg fileName "$FILE_NAME" \
  --arg mimeType "$MIME_TYPE" \
  --arg sha256 "$FILE_SHA256" \
  --arg purpose "reading_photo" \
  --argjson sizeBytes "$FILE_SIZE" \
  '{fileName:$fileName,mimeType:$mimeType,sizeBytes:$sizeBytes,sha256:$sha256,purpose:$purpose}')"

PRESIGN_JSON="$(curl -sS -X POST "$API_BASE/api/v1/mobile/uploads/presign" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PRESIGN_PAYLOAD")"

UPLOAD_URL="$(echo "$PRESIGN_JSON" | jq -r '.uploadUrl // empty')"
UPLOAD_TOKEN="$(echo "$PRESIGN_JSON" | jq -r '.uploadToken // empty')"
FILE_URL="$(echo "$PRESIGN_JSON" | jq -r '.fileUrl // empty')"

if [ -z "$UPLOAD_URL" ] || [ -z "$UPLOAD_TOKEN" ] || [ -z "$FILE_URL" ]; then
  echo "Presign failed:"
  echo "$PRESIGN_JSON" | jq .
  exit 1
fi
echo "Presign OK"

echo "== 4) Upload file to signed URL =="
HEADER_ARGS=()
while IFS='=' read -r key value; do
  HEADER_ARGS+=(-H "$key: $value")
done < <(echo "$PRESIGN_JSON" | jq -r '.requiredHeaders | to_entries[] | "\(.key)=\(.value)"')

UPLOAD_STATUS="$(curl -sS -o /dev/null -w "%{http_code}" \
  -X PUT "$UPLOAD_URL" \
  "${HEADER_ARGS[@]}" \
  --data-binary @"$FILE_PATH")"

if [ "$UPLOAD_STATUS" != "200" ] && [ "$UPLOAD_STATUS" != "201" ]; then
  echo "Upload failed with HTTP $UPLOAD_STATUS"
  exit 1
fi
echo "Upload OK (HTTP $UPLOAD_STATUS)"

echo "== 5) Complete upload =="
COMPLETE_PAYLOAD="$(jq -n \
  --arg uploadToken "$UPLOAD_TOKEN" \
  --arg sha256 "$FILE_SHA256" \
  --arg mimeType "$MIME_TYPE" \
  --argjson sizeBytes "$FILE_SIZE" \
  '{uploadToken:$uploadToken,sha256:$sha256,mimeType:$mimeType,sizeBytes:$sizeBytes}')"

COMPLETE_JSON="$(curl -sS -X POST "$API_BASE/api/v1/mobile/uploads/complete" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$COMPLETE_PAYLOAD")"

VALIDATED_FILE_URL="$(echo "$COMPLETE_JSON" | jq -r '.file.url // empty')"
if [ -z "$VALIDATED_FILE_URL" ]; then
  echo "Complete failed:"
  echo "$COMPLETE_JSON" | jq .
  exit 1
fi
echo "Complete OK"

echo "== 6) Create reading =="
READING_PAYLOAD="$(jq -n \
  --arg meterId "$METER_ID" \
  --argjson primaryIndex "$PRIMARY_INDEX" \
  --argjson secondaryIndex "$SECONDARY_INDEX" \
  --arg imageUrl "$VALIDATED_FILE_URL" \
  --arg imageHash "$FILE_SHA256" \
  --arg imageMimeType "$MIME_TYPE" \
  --argjson imageSizeBytes "$FILE_SIZE" \
  --argjson gpsLatitude "$GPS_LAT" \
  --argjson gpsLongitude "$GPS_LNG" \
  --argjson gpsAccuracyMeters "$GPS_ACCURACY" \
  --arg idempotencyKey "$IDEMPOTENCY_KEY" \
  '{
    meterId:$meterId,
    primaryIndex:$primaryIndex,
    secondaryIndex:$secondaryIndex,
    imageUrl:$imageUrl,
    imageHash:$imageHash,
    imageMimeType:$imageMimeType,
    imageSizeBytes:$imageSizeBytes,
    gpsLatitude:$gpsLatitude,
    gpsLongitude:$gpsLongitude,
    gpsAccuracyMeters:$gpsAccuracyMeters,
    idempotencyKey:$idempotencyKey
  }')"

READING_JSON="$(curl -sS -X POST "$API_BASE/api/v1/mobile/readings" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$READING_PAYLOAD")"

READING_ID="$(echo "$READING_JSON" | jq -r '.reading.id // empty')"
if [ -z "$READING_ID" ]; then
  echo "Reading creation failed:"
  echo "$READING_JSON" | jq .
  exit 1
fi

echo "Reading created: $READING_ID"
echo "$READING_JSON" | jq .
