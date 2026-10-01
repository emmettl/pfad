// Retain the exact event words, without a worst-case buffer plus a full copy.
// Modern browsers grow this backing store only as the search actually records.
const STEP_BYTES = 1024 * 1024
export class EventTrace {
  buffer: ArrayBuffer
  words: Uint32Array
  readonly maximum: number
  constructor(maximum: number, resizable = typeof ArrayBuffer.prototype.resize === 'function' && typeof ArrayBuffer.prototype.transferToFixedLength === 'function') {
    this.maximum = maximum
    const maximumBytes = maximum * 4
    this.buffer = resizable ? new ArrayBuffer(Math.min(STEP_BYTES, maximumBytes), { maxByteLength: maximumBytes }) : new ArrayBuffer(maximumBytes)
    this.words = new Uint32Array(this.buffer)
  }
  set(index: number, word: number) {
    if (index >= this.maximum) throw new Error('Search exceeded its event bound')
    if (index >= this.words.length) {
      this.buffer.resize(Math.min(this.maximum * 4, this.buffer.byteLength + STEP_BYTES))
      this.words = new Uint32Array(this.buffer)
    }
    this.words[index] = word
  }
  finish(length: number) {
    if (this.buffer.resizable) {
      this.buffer.resize(length * 4)
      return new Uint32Array(this.buffer.transferToFixedLength())
    }
    return this.words.slice(0, length)
  }
}
