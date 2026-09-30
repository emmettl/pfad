import * as THREE from 'three'

export const MEETING_FLASH_MS = 800
export class MeetingFlash {
  elapsed = 0
  active = false
  clear() { this.elapsed = 0; this.active = false }
  cross(previous: number, next: number, meeting: number | undefined, playing: boolean, reducedMotion: boolean) {
    if (!playing || reducedMotion || next < previous) { this.clear(); return }
    if (meeting !== undefined && previous < meeting && next >= meeting) { this.elapsed = 0; this.active = true }
  }
  advance(milliseconds: number) {
    if (!this.active) return
    this.elapsed = Math.min(MEETING_FLASH_MS, this.elapsed + Math.max(0, milliseconds))
    this.active = this.elapsed < MEETING_FLASH_MS
  }
  get progress() { return this.elapsed / MEETING_FLASH_MS }
}

export function createMeetingMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uAge: { value: 0 }, uPixelRatio: { value: 1 } },
    vertexShader: `
      uniform float uPixelRatio;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        gl_PointSize = 40. * uPixelRatio;
      }
    `,
    fragmentShader: `
      uniform float uAge;
      void main() {
        float r = length(gl_PointCoord - .5);
        float fade = pow(1. - uAge, 2.);
        float core = exp(-r * r / .0016) * fade;
        float halo = exp(-r * r / .04) * fade * .35;
        float ring = exp(-pow((r - (.09 + uAge * .29)) / .013, 2.)) * fade * .22;
        float alpha = core + halo + ring;
        if (alpha < .002) discard;
        gl_FragColor = vec4(vec3(1., .91, .7), alpha);
      }
    `,
    transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
  })
}
