import assert from 'node:assert/strict'
import test from 'node:test'
import { MeetingFlash, MEETING_FLASH_MS } from '../src/map/meetingFlash.ts'

test('meeting light requires a recorded forward crossing and supports replay, seeking and reduced motion', () => {
  const light = new MeetingFlash()
  light.cross(0, 100, undefined, true, false); assert.equal(light.active, false)
  light.cross(0, 100, 50, false, false); assert.equal(light.active, false)
  light.cross(0, 100, 50, true, true); assert.equal(light.active, false)
  light.cross(49, 50, 50, true, false); assert.equal(light.active, true)
  light.advance(300); const p = light.progress
  light.cross(50, 70, 50, true, false); assert.equal(light.progress, p)
  light.advance(MEETING_FLASH_MS); assert.equal(light.active, false)
  light.cross(100, 49, 50, false, false); assert.equal(light.progress, 0)
  light.cross(49, 51, 50, true, false); assert.equal(light.active, true)
  light.cross(51, 51, 50, false, false); assert.equal(light.active, false)
  light.cross(0, 51, 50, true, false); assert.equal(light.active, true)
  light.cross(51, 52, 50, true, true); assert.equal(light.active, false)
})
