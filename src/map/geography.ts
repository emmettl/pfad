import * as THREE from 'three'
import type { MapBoundary } from '@motionstudies/core/domain/boundary'
import type { MapWaterBodies } from '@motionstudies/core/domain/lakes'
import borderData from './data/switzerland-border.json'
import lakeData from './data/switzerland-lakes.json'
import ukBorderData from './data/uk-border.json'
import ukLakeData from './data/uk-lakes.json'

import isBorder from './data/is-border.json'
import isLakes from './data/is-lakes.json'
import nlBorder from './data/nl-border.json'
import nlLakes from './data/nl-lakes.json'
import nzBorder from './data/nz-border.json'
import nzLakes from './data/nz-lakes.json'
import luBorder from './data/lu-border.json'
import luLakes from './data/lu-lakes.json'

export const border = borderData as unknown as MapBoundary
export const lakes = lakeData as unknown as MapWaterBodies

const geography: Record<string, { boundary: unknown; water: unknown }> = {
  ch: { boundary: border, water: lakes }, uk: { boundary: ukBorderData, water: ukLakeData },
  is: { boundary: isBorder, water: isLakes },
  nl: { boundary: nlBorder, water: nlLakes },
  nz: { boundary: nzBorder, water: nzLakes },
  lu: { boundary: luBorder, water: luLakes },
}

// Geographic context has no event times and never participates in routing.
export function createGeography(project: (point: { lon: number; lat: number }) => THREE.Vector3, country = 'ch') {
  const context = geography[country]
  if (!context) throw new Error('No geographic context for country: ' + country)
  const boundary = context.boundary as MapBoundary
  const water = context.water as MapWaterBodies
  const group = new THREE.Group(); group.renderOrder = -2
  function outlines(rings: readonly (readonly (readonly [number, number])[])[], colour: string, opacity: number) {
    const positions: number[] = []
    for (const ring of rings) for (let i = 1; i < ring.length; i++) {
      const a = project({ lon: ring[i - 1][0], lat: ring[i - 1][1] }), b = project({ lon: ring[i][0], lat: ring[i][1] })
      positions.push(a.x, a.y, 0, b.x, b.y, 0)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const material = new THREE.LineBasicMaterial({ color: colour, opacity, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
    const lines = new THREE.LineSegments(geometry, material); lines.frustumCulled = false; group.add(lines)
  }
  outlines(boundary.rings, '#73847e', .10)
  outlines(water.lakes.flatMap(lake => lake.polygons.flatMap(polygon => polygon)), '#648d92', .11)
  return group
}
export function disposeGeography(group: THREE.Group) {
  group.traverse(object => { if (object instanceof THREE.LineSegments) { object.geometry.dispose(); (object.material as THREE.Material).dispose() } })
}
