import { AMBIENT_PLACES, POOL_VERSION, type AmbientPlace } from './selector.ts'
export interface AmbientPool { version: string; places: AmbientPlace[] }
export const SWISS_POOL: AmbientPool = { version: POOL_VERSION, places: AMBIENT_PLACES }
// Authored road regions avoid proposing sea crossings; actual routes still
// determine acceptance. Islands without road connections remain manual studies.
export const UK_POOL: AmbientPool = { version: 'uk-places/1', places: [
  { id: 'london', name: 'London', lon: -.1276, lat: 51.5072 },
  { id: 'edinburgh', name: 'Edinburgh', lon: -3.1883, lat: 55.9533 },
  { id: 'manchester', name: 'Manchester', lon: -2.2426, lat: 53.4808 },
  { id: 'birmingham', name: 'Birmingham', lon: -1.8904, lat: 52.4862 },
  { id: 'cardiff', name: 'Cardiff', lon: -3.1791, lat: 51.4816 },
  { id: 'glasgow', name: 'Glasgow', lon: -4.2518, lat: 55.8642 },
  { id: 'bristol', name: 'Bristol', lon: -2.5879, lat: 51.4545 },
  { id: 'oxford', name: 'Oxford', lon: -1.2577, lat: 51.752 },
  { id: 'cambridge', name: 'Cambridge', lon: .1218, lat: 52.2053 },
  { id: 'york', name: 'York', lon: -1.0827, lat: 53.9583 },
  { id: 'leeds', name: 'Leeds', lon: -1.5491, lat: 53.8008 },
  { id: 'newcastle', name: 'Newcastle', lon: -1.6178, lat: 54.9783 },
  { id: 'exeter', name: 'Exeter', lon: -3.5339, lat: 50.7184 },
  { id: 'plymouth', name: 'Plymouth', lon: -4.1427, lat: 50.3755 },
  { id: 'inverness', name: 'Inverness', lon: -4.2247, lat: 57.4778 },
  { id: 'aberdeen', name: 'Aberdeen', lon: -2.0943, lat: 57.1497 },
  { id: 'swansea', name: 'Swansea', lon: -3.9436, lat: 51.6214 },
  { id: 'bangor', name: 'Bangor', lon: -4.1289, lat: 53.2274 },
].map(place => ({ ...place, region: 'great-britain' })).concat([
  { id: 'belfast', name: 'Belfast', lon: -5.9301, lat: 54.5973, region: 'northern-ireland' },
  { id: 'derry', name: 'Derry', lon: -7.3092, lat: 54.9966, region: 'northern-ireland' },
  { id: 'armagh', name: 'Armagh', lon: -6.6528, lat: 54.3503, region: 'northern-ireland' },
  { id: 'enniskillen', name: 'Enniskillen', lon: -7.6389, lat: 54.3438, region: 'northern-ireland' },
]) }
