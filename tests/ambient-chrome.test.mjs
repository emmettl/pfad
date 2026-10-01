import { test, expect, vi } from 'vitest'
import { AmbientChrome } from '../src/ambient/chrome.ts'

test('idle chrome waits four seconds, input resets that deadline, and disposal cancels stale work', t => {
  vi.useFakeTimers(); t.onTestFinished(() => vi.useRealTimers())
  const changed = vi.fn(), clock = new AmbientChrome(true, changed)
  t.onTestFinished(() => clock.dispose())
  vi.advanceTimersByTime(3999); expect(changed.mock.calls).toEqual([[true]])
  clock.wake(); vi.advanceTimersByTime(3999); expect(changed.mock.calls).toEqual([[true], [true]])
  vi.advanceTimersByTime(1); expect(changed).toHaveBeenLastCalledWith(false)
  clock.wake(); expect(changed).toHaveBeenLastCalledWith(true)
  clock.dispose(); vi.advanceTimersByTime(60000); clock.wake()
  expect(changed.mock.calls).toEqual([[true], [true], [false], [true]])
  expect(vi.getTimerCount()).toBe(0)
})

test('paused, still, stopped and manual interfaces never acquire an idle timer', t => {
  vi.useFakeTimers(); t.onTestFinished(() => vi.useRealTimers())
  const changed = vi.fn(), active = new AmbientChrome(true, changed)
  active.dispose()
  const paused = new AmbientChrome(false, changed)
  t.onTestFinished(() => paused.dispose())
  vi.advanceTimersByTime(60000); paused.wake()
  expect(changed.mock.calls).toEqual([[true], [true], [true]])
  expect(vi.getTimerCount()).toBe(0)
})
