import { useCallback, useEffect, useRef, useState } from 'react'
import { AmbientChrome } from './chrome.ts'

/** Interface time is independent of the recorded search and sequence clock. */
export function useAmbientChrome(retreat: boolean) {
  const [visible, setVisible] = useState(true)
  const clock = useRef<AmbientChrome | undefined>(undefined)
  const wake = useCallback(() => clock.current?.wake(), [])
  useEffect(() => {
    const next = new AmbientChrome(retreat, setVisible)
    clock.current = next
    return () => { next.dispose(); clock.current = undefined }
  }, [retreat])
  return { visible: !retreat || visible, wake }
}
