import type { Point } from './search/contracts.ts'
import { PLACES } from './places.ts'
export interface Country {
  id: string; name: string; manifest: string; identity: string; places: Point[]
  outlines: boolean; large: boolean; downloadMB: number; snapshot: string; deviceNote?: string
}
// An app release selects immutable records. The browser never follows “latest”.
export const COUNTRIES: Country[] = [
  { id: 'ch', name: 'Switzerland', manifest: './data/pfad/ch-20260929-6a17f71de78c/manifest.json', identity: '6a17f71de78c6a9883f333e39ee27c5ddfc1657bded4ede92842549004b0908e', places: PLACES, outlines: true, large: false, downloadMB: 16, snapshot: '29 Sep 2026' },
  { id: 'uk', name: 'United Kingdom', manifest: 'https://motionstudies.app/pfad-data/uk-20260929-0555cf638ba1/manifest.json', identity: '0555cf638ba1cc246e741531c406e9a32a651b3c75b2a842f77f2fdbdfe7f909', outlines: false, large: true, downloadMB: 93, deviceNote: 'The complete graph needs around 1–2 GB of browser memory, plus graphics memory. Tested on desktop; phone support is still unverified.', snapshot: '29 Sep 2026', places: [
    { name: 'London', lon: -.1276, lat: 51.5072 }, { name: 'Edinburgh', lon: -3.1883, lat: 55.9533 },
    { name: 'Manchester', lon: -2.2426, lat: 53.4808 }, { name: 'Birmingham', lon: -1.8904, lat: 52.4862 },
    { name: 'Cardiff', lon: -3.1791, lat: 51.4816 }, { name: 'Glasgow', lon: -4.2518, lat: 55.8642 },
    { name: 'Belfast', lon: -5.9301, lat: 54.5973 }, { name: 'Bristol', lon: -2.5879, lat: 51.4545 },
    { name: "Land's End", lon: -5.714, lat: 50.066 }, { name: "John o’ Groats", lon: -3.069, lat: 58.638 },
  ] },
]
