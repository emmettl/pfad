import { useEffect, useId, useRef, useState } from 'react'
import type { SearchAlgorithm } from './search/contracts.ts'
export const algorithms: [SearchAlgorithm, string][] = [
  ['dijkstra', 'Dijkstra'], ['bidirectional', 'Bidirectional Dijkstra'], ['astar', 'A*'], ['bidirectional-astar', 'Bidirectional A*'], ['greedy', 'Greedy best-first'], ['depth-first', 'Depth-first'], ['breadth-first', 'Breadth-first'], ['spanning-tree', 'Spanning tree'],
]
export function AlgorithmPicker({ value, disabled, onChange }: { value: SearchAlgorithm; disabled: boolean; onChange: (value: SearchAlgorithm) => void }) {
  const [open, setOpen] = useState(false), [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), id = useId()
  const selected = Math.max(0, algorithms.findIndex(([key]) => key === value))
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  useEffect(() => { if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' }) }, [open, active, id])
  const choose = (index: number) => { setOpen(false); trigger.current?.focus(); onChange(algorithms[index][0]) }
  return <div className="algorithm-picker" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <button ref={trigger} type="button" role="combobox" aria-label="Search algorithm" aria-haspopup="listbox" aria-expanded={open && !disabled} aria-controls={id} aria-activedescendant={open ? `${id}-${active}` : undefined} data-value={value} disabled={disabled}
      onClick={() => { setActive(selected); setOpen(!open) }} onKeyDown={event => {
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); setOpen(true)
          setActive(event.key === 'Home' ? 0 : event.key === 'End' ? algorithms.length - 1 : !open ? selected : Math.max(0, Math.min(algorithms.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1))))
        } else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false) }
        else if (open && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); choose(active) }
      }}>{algorithms[selected][1]}<span aria-hidden="true">⌄</span></button>
    {open && !disabled && <div id={id} role="listbox" aria-label="Search algorithms" className="algorithm-menu">{algorithms.map(([key, label], index) => <button type="button" id={`${id}-${index}`} key={key} role="option" aria-selected={key === value} tabIndex={-1} className={index === active ? 'active' : ''} onPointerMove={() => setActive(index)} onClick={() => choose(index)}>{label}<span aria-hidden="true">{key === value ? '✓' : ''}</span></button>)}</div>}
  </div>
}
