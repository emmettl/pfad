import { checkEditionBoundary } from '@motionstudies/data/edition-boundary'

await checkEditionBoundary({ directories: ['src', 'scripts'], additionalPackages: ['@driftbox/rack'] })
console.log('pfad uses pinned npm releases and declared public imports.')
