import manifest from '../../music/manifest.json'
import plateau from '../audio/plateau.m4a?url'
import contours from '../audio/contours.m4a?url'
import afterglow from '../audio/afterglow.m4a?url'
import type { MusicTrack } from './player.ts'

const urls = { plateau, contours, afterglow }
export const MUSIC: MusicTrack[] = manifest.tracks.map(track => ({ ...track, url: urls[track.id as keyof typeof urls] }))
