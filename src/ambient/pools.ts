import { AMBIENT_PLACES, POOL_VERSION, type DistanceProfile, type AmbientPlace } from './selector.ts'
export interface AmbientPool { version: string; places: AmbientPlace[]; distance?: DistanceProfile }
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

export const IS_POOL: AmbientPool = { version: 'is-places/1', places: [
  { id: 'reykjavik', name: 'Reykjavík', lon: -21.9426, lat: 64.1466 },
  { id: 'keflavik', name: 'Keflavík', lon: -22.5572, lat: 64.0049 },
  { id: 'selfoss', name: 'Selfoss', lon: -20.9971, lat: 63.9335 },
  { id: 'borgarnes', name: 'Borgarnes', lon: -21.9212, lat: 64.5383 },
  { id: 'akureyri', name: 'Akureyri', lon: -18.0878, lat: 65.6839 },
  { id: 'husavik', name: 'Húsavík', lon: -17.3389, lat: 66.0449 },
  { id: 'egilsstadir', name: 'Egilsstaðir', lon: -14.3948, lat: 65.2669 },
  { id: 'hofn', name: 'Höfn', lon: -15.2082, lat: 64.2539 },
  { id: 'vik', name: 'Vík', lon: -19.006, lat: 63.4186 },
  { id: 'blonduos', name: 'Blönduós', lon: -20.2861, lat: 65.6593 },
  { id: 'isafjordur', name: 'Ísafjörður', lon: -23.124, lat: 66.0755 },
  { id: 'stykkisholmur', name: 'Stykkishólmur', lon: -22.7293, lat: 65.0756 },
] }

export const NL_POOL: AmbientPool = { version: 'nl-places/1', places: [
  { id: 'amsterdam', name: 'Amsterdam', lon: 4.9041, lat: 52.3676 },
  { id: 'rotterdam', name: 'Rotterdam', lon: 4.4777, lat: 51.9244 },
  { id: 'utrecht', name: 'Utrecht', lon: 5.1214, lat: 52.0907 },
  { id: 'the-hague', name: 'Den Haag', lon: 4.3007, lat: 52.0705 },
  { id: 'eindhoven', name: 'Eindhoven', lon: 5.4697, lat: 51.4416 },
  { id: 'groningen', name: 'Groningen', lon: 6.5665, lat: 53.2194 },
  { id: 'maastricht', name: 'Maastricht', lon: 5.6909, lat: 50.8514 },
  { id: 'leeuwarden', name: 'Leeuwarden', lon: 5.7999, lat: 53.2012 },
  { id: 'arnhem', name: 'Arnhem', lon: 5.8987, lat: 51.9851 },
  { id: 'zwolle', name: 'Zwolle', lon: 6.0944, lat: 52.5168 },
  { id: 'middelburg', name: 'Middelburg', lon: 3.613, lat: 51.4988 },
  { id: 'enschede', name: 'Enschede', lon: 6.8937, lat: 52.2215 },
] }

export const NZ_POOL: AmbientPool = { version: 'nz-places/1', places: [
  { id: 'auckland', name: 'Auckland', lon: 174.7633, lat: -36.8485, region: 'north' },
  { id: 'wellington', name: 'Wellington', lon: 174.7762, lat: -41.2865, region: 'north' },
  { id: 'hamilton', name: 'Hamilton', lon: 175.2793, lat: -37.787, region: 'north' },
  { id: 'tauranga', name: 'Tauranga', lon: 176.1651, lat: -37.6878, region: 'north' },
  { id: 'rotorua', name: 'Rotorua', lon: 176.2497, lat: -38.1368, region: 'north' },
  { id: 'taupo', name: 'Taupō', lon: 176.0702, lat: -38.6857, region: 'north' },
  { id: 'napier', name: 'Napier', lon: 176.912, lat: -39.4928, region: 'north' },
  { id: 'palmerston-north', name: 'Palmerston North', lon: 175.6111, lat: -40.3523, region: 'north' },
  { id: 'whanganui', name: 'Whanganui', lon: 175.05, lat: -39.9301, region: 'north' },
  { id: 'new-plymouth', name: 'New Plymouth', lon: 174.0752, lat: -39.0556, region: 'north' },
  { id: 'christchurch', name: 'Christchurch', lon: 172.6362, lat: -43.5321, region: 'south' },
  { id: 'dunedin', name: 'Dunedin', lon: 170.5028, lat: -45.8788, region: 'south' },
  { id: 'queenstown', name: 'Queenstown', lon: 168.6626, lat: -45.0312, region: 'south' },
  { id: 'invercargill', name: 'Invercargill', lon: 168.3538, lat: -46.4132, region: 'south' },
  { id: 'nelson', name: 'Nelson', lon: 173.284, lat: -41.2706, region: 'south' },
  { id: 'blenheim', name: 'Blenheim', lon: 173.9528, lat: -41.5134, region: 'south' },
  { id: 'ashburton', name: 'Ashburton', lon: 171.7512, lat: -43.9038, region: 'south' },
  { id: 'timaru', name: 'Timaru', lon: 171.2514, lat: -44.3967, region: 'south' },
] }

export const LU_POOL: AmbientPool = { version: 'lu-places/1', distance: { minimumKm: 5, regionalBelowKm: 25, interregionalBelowKm: 50 }, places: [
  { id: 'luxembourg', name: 'Luxembourg', lon: 6.1335, lat: 49.6006 },
  { id: 'esch', name: 'Esch-sur-Alzette', lon: 5.9806, lat: 49.4958 },
  { id: 'differdange', name: 'Differdange', lon: 5.8914, lat: 49.5242 },
  { id: 'diekirch', name: 'Diekirch', lon: 6.1558, lat: 49.8678 },
  { id: 'ettelbruck', name: 'Ettelbruck', lon: 6.0948, lat: 49.8475 },
  { id: 'wiltz', name: 'Wiltz', lon: 5.9314, lat: 49.9689 },
  { id: 'clervaux', name: 'Clervaux', lon: 6.0311, lat: 50.0547 },
  { id: 'vianden', name: 'Vianden', lon: 6.2089, lat: 49.935 },
  { id: 'echternach', name: 'Echternach', lon: 6.4214, lat: 49.8117 },
  { id: 'remich', name: 'Remich', lon: 6.3669, lat: 49.545 },
] }

export const IE_POOL: AmbientPool = { version: 'ie-places/1', places: [
  { id: 'dublin', name: 'Dublin', lon: -6.2603, lat: 53.3498 },
  { id: 'belfast', name: 'Belfast', lon: -5.9301, lat: 54.5973 },
  { id: 'cork', name: 'Cork', lon: -8.4756, lat: 51.8985 },
  { id: 'galway', name: 'Galway', lon: -9.0568, lat: 53.2707 },
  { id: 'limerick', name: 'Limerick', lon: -8.6267, lat: 52.6638 },
  { id: 'waterford', name: 'Waterford', lon: -7.1101, lat: 52.2593 },
  { id: 'kilkenny', name: 'Kilkenny', lon: -7.2522, lat: 52.6541 },
  { id: 'athlone', name: 'Athlone', lon: -7.9407, lat: 53.4239 },
  { id: 'sligo', name: 'Sligo', lon: -8.4761, lat: 54.2766 },
  { id: 'derry', name: 'Derry', lon: -7.3092, lat: 54.9966 },
  { id: 'letterkenny', name: 'Letterkenny', lon: -7.733, lat: 54.95 },
  { id: 'enniskillen', name: 'Enniskillen', lon: -7.6389, lat: 54.3438 },
  { id: 'armagh', name: 'Armagh', lon: -6.6528, lat: 54.3503 },
  { id: 'newry', name: 'Newry', lon: -6.337, lat: 54.1751 },
  { id: 'tralee', name: 'Tralee', lon: -9.7026, lat: 52.2713 },
  { id: 'westport', name: 'Westport', lon: -9.5227, lat: 53.8008 },
  { id: 'wexford', name: 'Wexford', lon: -6.4633, lat: 52.3369 },
  { id: 'dingle', name: 'Dingle', lon: -10.2689, lat: 52.1409 },
] }

export const AMBIENT_POOLS: Record<string, AmbientPool> = { ch: SWISS_POOL, uk: UK_POOL, is: IS_POOL, nl: NL_POOL, nz: NZ_POOL, lu: LU_POOL, ie: IE_POOL }
