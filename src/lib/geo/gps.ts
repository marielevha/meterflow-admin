export function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusMeters = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

export function gpsThresholdMeters() {
  const raw = Number(process.env.GPS_MAX_DISTANCE_METERS ?? "200");
  if (!Number.isFinite(raw) || raw <= 0) return 200;
  return raw;
}

export function resolveGpsThresholdMeters(value: unknown) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return gpsThresholdMeters();
  return raw;
}
