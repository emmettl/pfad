// Only drawing longitude wraps. OSM coordinates, connectivity and events stay
// in their original coordinate system. Normal differences retain exact bytes.
export function longitudeOffset(lon: number, centre: number, wrap = false) {
  const delta = lon - centre
  return wrap ? delta > 180 ? delta - 360 : delta < -180 ? delta + 360 : delta : delta
}
export function normaliseLongitude(lon: number) {
  return lon > 180 ? lon - 360 : lon < -180 ? lon + 360 : lon
}
