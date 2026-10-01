import * as THREE from 'three'
import type { MapBoundary } from '@motionstudies/core/domain/boundary'
import type { MapWaterBodies } from '@motionstudies/core/domain/lakes'
import type { Geography } from './geography-loader.ts'

export function createGeographyFill(project: (point: { lon: number; lat: number }) => THREE.Vector3, context: Geography) {
  // These reference rings are country exteriors, independent of road topology.
  const shapes = context.boundary.rings.map(ring => new THREE.Shape(ring.map(([lon, lat]) => {
    const point = project({ lon, lat }); return new THREE.Vector2(point.x, point.y)
  })))
  const material = new THREE.MeshBasicMaterial({ color: '#88bda5', opacity: .045, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(shapes), material)
  fill.frustumCulled = false
  const group = new THREE.Group(); group.renderOrder = -3; group.add(fill)
  return group
}

// Geographic context has no event times and never participates in routing.
export function createGeography(project: (point: { lon: number; lat: number }) => THREE.Vector3, context: Geography) {
  const boundary = context.boundary as MapBoundary
  const water = context.water as MapWaterBodies
  const group = new THREE.Group(); group.renderOrder = -2; group.userData.country = context.country; group.userData.segments = 0
  function outlines(rings: readonly (readonly (readonly [number, number])[])[], colour: string, opacity: number) {
    const positions: number[] = []
    for (const ring of rings) for (let i = 1; i < ring.length; i++) {
      const a = project({ lon: ring[i - 1][0], lat: ring[i - 1][1] }), b = project({ lon: ring[i][0], lat: ring[i][1] })
      positions.push(a.x, a.y, 0, b.x, b.y, 0)
    }
    group.userData.segments += positions.length / 6
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const material = new THREE.LineBasicMaterial({ color: colour, opacity, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
    const lines = new THREE.LineSegments(geometry, material); lines.frustumCulled = false; group.add(lines)
  }
  outlines(boundary.rings, '#73847e', .18)
  outlines(water.lakes.flatMap(lake => lake.polygons.flatMap(polygon => polygon)), '#648d92', .18)
  return group
}
export function disposeGeography(group: THREE.Group) {
  group.traverse(object => { if (object instanceof THREE.LineSegments || object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose() } })
}
