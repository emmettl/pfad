/** Idle interface time never advances the recorded search or the sequence. */
export class AmbientChrome {
  private timer?: ReturnType<typeof setTimeout>
  private disposed = false
  constructor(private retreat: boolean, private changed: (visible: boolean) => void) { this.wake() }
  wake() {
    if (this.disposed) return
    clearTimeout(this.timer)
    this.changed(true)
    if (this.retreat) this.timer = setTimeout(() => this.changed(false), 4000)
  }
  dispose() { this.disposed = true; clearTimeout(this.timer) }
}
