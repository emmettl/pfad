import type { StudyLink } from './link.ts'

export function openingReplay(study: Pick<StudyLink, 'progress'> | undefined, reducedMotion: boolean) {
  const progress = reducedMotion ? 1 : study?.progress ?? 0
  return { progress, playing: !reducedMotion && progress < 1 }
}
