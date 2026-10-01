const key = (country: string) => `pfad-country-warning:${country}`

export function countryWarningAcknowledged(country: string): boolean {
  try { return globalThis.localStorage.getItem(key(country)) === '1' }
  catch { return false }
}

export function rememberCountryWarning(country: string): void {
  try { globalThis.localStorage.setItem(key(country), '1') }
  catch { /* Opening a country must still work when storage is unavailable. */ }
}
