import { test, expect, vi } from 'vitest'
import { countryWarningAcknowledged, rememberCountryWarning } from '../src/country-warning.ts'

test('acceptance persists for its country and survives a fresh storage read', () => {
  const items = new Map()
  vi.stubGlobal('localStorage', { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) })
  expect(countryWarningAcknowledged('uk')).toBe(false)
  rememberCountryWarning('uk')
  expect(countryWarningAcknowledged('uk')).toBe(true)
  expect(countryWarningAcknowledged('ch')).toBe(false)
  expect(items.get('pfad-country-warning:uk')).toBe('1')
})

test('missing or unrecognised values do not count as acceptance', () => {
  for (const value of [null, '', '0', 'true', 'garbled']) {
    vi.stubGlobal('localStorage', { getItem: () => value })
    expect(countryWarningAcknowledged('uk')).toBe(false)
  }
})

test('blocked or unavailable storage never prevents opening a country', () => {
  for (const storage of [undefined, { getItem() { throw new Error('denied') }, setItem() { throw new Error('full') } }]) {
    vi.stubGlobal('localStorage', storage)
    expect(countryWarningAcknowledged('uk')).toBe(false)
    expect(() => rememberCountryWarning('uk')).not.toThrow()
  }
})
