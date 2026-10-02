import * as THREE from 'three'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
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
  function outlines(rings: readonly (readonly (readonly [number, number])[])[], colour: string, opacity: number, width: number) {
    const positions: number[] = []
    for (const ring of rings) for (let i = 1; i < ring.length; i++) {
      const a = project({ lon: ring[i - 1][0], lat: ring[i - 1][1] }), b = project({ lon: ring[i][0], lat: ring[i][1] })
      positions.push(a.x, a.y, 0, b.x, b.y, 0)
    }
    if (!positions.length) return
    group.userData.segments += positions.length / 6
    // Native WebGL lines are one framebuffer pixel wide, which becomes less
    // than one CSS pixel on high-density phones. Screen-space strips preserve
    // a readable reference stroke across pixel ratios, resizing and zooming.
    const geometry = new LineSegmentsGeometry().setPositions(positions)
    const material = new LineMaterial({ color: colour, opacity, linewidth: width, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
    const lines = new LineSegments2(geometry, material); lines.frustumCulled = false; group.add(lines)
  }
  outlines(boundary.rings, '#8ba499', .48, 1.25)
  outlines(water.lakes.flatMap(lake => lake.polygons.flatMap(polygon => polygon)), '#80a8b1', .44, 1.1)
  return group
}
export function disposeGeography(group: THREE.Group) {
  group.traverse(object => { if (object instanceof THREE.LineSegments || object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose() } })
}
