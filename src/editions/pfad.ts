import type { MotionStudyIdentity } from '@motionstudies/core/edition'

export const PFAD_IDENTITY = {
  series: 'Motion Studies',
  catalogueNumber: '', // Unnumbered: catalogue admission remains an authored decision.
  title: 'PFAD',
  placeName: 'Switzerland',
  descriptor: 'A study of time, space, and the paths not taken.',
} as const satisfies MotionStudyIdentity

export const PFAD_EDITION = {
  id: 'pfad',
  identity: PFAD_IDENTITY,
  timezone: 'Europe/Zurich',
  status: 'study',
  manifest: './data/pfad-manifest.json',
} as const
