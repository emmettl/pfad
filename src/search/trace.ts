import type { SearchResult } from './contracts.ts'

// Retain the exact event words, without a worst-case buffer plus a full copy.
// Modern browsers grow this backing store only as the search actually records.
const STEP_BYTES = 1024 * 1024
export class EventTrace {
  buffer: ArrayBuffer
  words: Uint32Array
  readonly maximum: number
  private blocks: Uint32Array[] = []
  private readonly resizable: boolean
  constructor(maximum: number, resizable = typeof ArrayBuffer.prototype.resize === 'function' && typeof ArrayBuffer.prototype.transferToFixedLength === 'function') {
    this.maximum = maximum
    this.resizable = resizable
    const maximumBytes = maximum * 4
    this.buffer = resizable ? new ArrayBuffer(Math.min(STEP_BYTES, maximumBytes), { maxByteLength: maximumBytes }) : new ArrayBuffer(Math.min(STEP_BYTES, maximumBytes))
    this.words = new Uint32Array(this.buffer)
    if (!resizable) this.blocks.push(this.words)
  }
  set(index: number, word: number) {
    if (index < 0 || index >= this.maximum) throw new Error('Search exceeded its event bound')
    if (!this.resizable) {
      const block = Math.floor(index / (STEP_BYTES / 4)), offset = index % (STEP_BYTES / 4)
      while (this.blocks.length <= block) this.blocks.push(new Uint32Array(Math.min(STEP_BYTES / 4, this.maximum - this.blocks.length * STEP_BYTES / 4)))
      this.blocks[block][offset] = word
      return
    }
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
    const result = new Uint32Array(length)
    let offset = 0
    while (this.blocks.length && offset < length) {
      const block = this.blocks.shift()!
      const count = Math.min(block.length, length - offset)
      result.set(block.subarray(0, count), offset); offset += count
    }
    this.blocks = []; this.buffer = new ArrayBuffer(0); this.words = new Uint32Array(this.buffer)
    return result
  }
}

export function traceLength(result: Pick<SearchResult, 'trace' | 'traceArchive'>) {
  return result.traceArchive?.count ?? result.trace.length
}
export function traceKind(result: Pick<SearchResult, 'trace' | 'traceArchive'>, event: number) {
  const kinds = result.traceArchive?.kinds
  return kinds ? (kinds[event >>> 2] >>> ((event & 3) * 2)) & 3 : result.trace[event] & 3
}
