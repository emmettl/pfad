import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { MUSIC } from './catalogue.ts'
import { Soundtrack, type MusicStatus } from './player.ts'

export interface SoundHandle { pauseSequence(): void; resumeSequence(): void }
export function SoundControl({ ref, sequencePaused = false }: { ref?: Ref<SoundHandle>; sequencePaused?: boolean }) {
  const player = useRef<Soundtrack | null>(null)
  const [status, setStatus] = useState<MusicStatus>({ state: 'off', title: '' })
  const [volume, setVolume] = useState(50)
  useImperativeHandle(ref, () => ({ pauseSequence: () => player.current?.pauseSequence(), resumeSequence: () => player.current?.resumeSequence() }), [])
  useEffect(() => {
    const hide = () => { if (document.hidden) player.current?.stop(true) }
    const leave = () => player.current?.stop(true)
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', leave)
    return () => {
      document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', leave)
      player.current?.dispose(); player.current = null
    }
  }, [])
  const enabled = status.state === 'on' || status.state === 'loading' || status.state === 'paused'
  return <div className="sound-control" data-sound={status.state}>
    <div className="sound-row">
      <button aria-label="Sound" aria-pressed={enabled} disabled={sequencePaused && !enabled} title={enabled ? 'Turn sound off' : 'Listen to the provisional score'} onClick={() => {
        player.current ??= new Soundtrack(MUSIC, setStatus)
        player.current.setVolume(volume / 100)
        if (player.current.state === 'on' || player.current.state === 'loading' || player.current.state === 'paused') player.current.stop()
        else void player.current.start()
      }}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2 6h3l4-3v10l-4-3H2z" />{enabled ? <path d="M11 5c2 1.5 2 4.5 0 6m2-8c3 2.5 3 7.5 0 10" /> : <path d="m11 6 4 4m0-4-4 4" />}</svg>
        <span>Sound</span>
      </button>
      {enabled && <input type="range" min="0" max="100" step="1" aria-label="Music volume" aria-valuetext={`${volume} percent`} value={volume} onChange={event => { const next = Number(event.target.value); setVolume(next); player.current?.setVolume(next / 100) }} />}
    </div>
    <span className="sound-note" role="status">{status.state === 'loading' ? 'Opening sound…' : status.state === 'error' ? 'Sound unavailable. Tap Sound to retry.' : status.state === 'paused' ? 'Score paused with sequence' : status.state === 'on' ? status.title : ''}</span>
  </div>
}
