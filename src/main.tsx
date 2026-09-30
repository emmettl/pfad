import { createRoot } from 'react-dom/client'
import '@motionstudies/web/fonts.css'
import '@motionstudies/web/tokens.css'
import { App } from './App.tsx'
const root = document.getElementById('root')
if (!root) throw new Error('Missing PFAD mount point')
createRoot(root).render(<App />)
