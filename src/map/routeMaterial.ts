import * as THREE from 'three'

export function createRouteMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uProgress: { value: 0 }, uEnergy: { value: 0 }, uWidth: { value: 5 }, uResolution: { value: new THREE.Vector2(1, 1) } },
    vertexShader: `
      attribute vec2 tangent;
      attribute float across;
      attribute float routeDistance;
      uniform vec2 uResolution;
      uniform float uWidth;
      varying float vAcross;
      varying float vDistance;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        vec2 delta = (projectionMatrix * modelViewMatrix * vec4(tangent, 0., 0.)).xy;
        vec2 direction = normalize(delta * uResolution);
        clip.xy += vec2(-direction.y, direction.x) * across * uWidth * 2. / uResolution * clip.w;
        gl_Position = clip;
        vAcross = across;
        vDistance = routeDistance;
      }
    `,
    fragmentShader: `
      uniform float uProgress;
      uniform float uEnergy;
      uniform float uWidth;
      varying float vAcross;
      varying float vDistance;
      void main() {
        if (vDistance > uProgress) discard;
        float transverse = abs(vAcross) * uWidth;
        float core = 1. - smoothstep(.35, 1.25, transverse);
        float halo = exp(-transverse * transverse / 7.);
        float head = uProgress < 1. ? exp(-(uProgress - vDistance) / .025) : 0.;
        float light = core * (.88 + uEnergy * (.16 + head * .5)) + halo * (.06 + uEnergy * (.14 + head * .28));
        vec3 colour = mix(vec3(.76, .98, .81), vec3(1., 1., .88), head * uEnergy);
        gl_FragColor = vec4(colour, light);
      }
    `,
    transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  })
}

export function createRouteGeometry(segments: Float32Array) {
  const count = segments.length // Six vertices per six-value segment.
  const positions = new Float32Array(count * 3), tangents = new Float32Array(count * 2), across = new Float32Array(count), distances = new Float32Array(count)
  const ends = [0, 1, 0, 0, 1, 1], sides = [-1, -1, 1, 1, -1, 1]
  for (let segment = 0; segment < segments.length / 6; segment++) {
    const s = segment * 6
    for (let j = 0; j < 6; j++) {
      const v = s + j, endpoint = ends[j] * 2
      positions[v * 3] = segments[s + endpoint]; positions[v * 3 + 1] = segments[s + endpoint + 1]
      tangents[v * 2] = segments[s + 2] - segments[s]; tangents[v * 2 + 1] = segments[s + 3] - segments[s + 1]
      across[v] = sides[j]; distances[v] = segments[s + 4 + ends[j]]
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('tangent', new THREE.BufferAttribute(tangents, 2))
  geometry.setAttribute('across', new THREE.BufferAttribute(across, 1))
  geometry.setAttribute('routeDistance', new THREE.BufferAttribute(distances, 1))
  return geometry
}
