import { useCallback, useEffect, useRef, useState } from 'react'

/** Interface time is independent of the recorded search and sequence clock. */
export function useAmbientChrome(retreat: boolean) {
  const [visible, setVisible] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const wake = useCallback(() => {
    clearTimeout(timer.current)
    setVisible(true)
    if (retreat) timer.current = setTimeout(() => setVisible(false), 4000)
  }, [retreat])
  useEffect(() => {
    wake()
    return () => clearTimeout(timer.current)
  }, [wake])
  return { visible: !retreat || visible, wake }
}
