import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export function useWatchMode(surface: RefObject<HTMLDivElement | null>) {
  const [active, setActive] = useState(false)
  const [awake, setAwake] = useState(true)
  const watching = useRef(false)
  const fullscreen = useRef(false)
  const trigger = useRef<HTMLElement | null>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const reveal = useCallback(() => {
    if (!watching.current) return
    setAwake(true)
    clearTimeout(timeout.current)
    timeout.current = setTimeout(() => setAwake(false), 3500)
  }, [])

  const exit = useCallback(() => {
    if (!watching.current) return
    watching.current = false
    setActive(false)
    clearTimeout(timeout.current)
    if (fullscreen.current && document.fullscreenElement === surface.current) void document.exitFullscreen().catch(() => {})
    fullscreen.current = false
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }, [surface])

  const enter = useCallback((button: HTMLElement) => {
    const element = surface.current
    if (!element || watching.current) return
    trigger.current = button
    watching.current = true
    setActive(true)
    reveal()
    element.focus({ preventScroll: true })
    if (!document.fullscreenElement && element.requestFullscreen) {
      void element.requestFullscreen().then(() => {
        if (watching.current) fullscreen.current = document.fullscreenElement === element
        else if (document.fullscreenElement === element) void document.exitFullscreen().catch(() => {})
      }).catch(() => {})
    }
  }, [surface, reveal])

  useEffect(() => {
    const changed = () => {
      if (document.fullscreenElement === surface.current) fullscreen.current = true
      else if (fullscreen.current) exit()
    }
    document.addEventListener('fullscreenchange', changed)
    return () => { clearTimeout(timeout.current); document.removeEventListener('fullscreenchange', changed) }
  }, [surface, exit])

  return { active, awake, enter, exit, reveal }
}
