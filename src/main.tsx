import { createRoot } from 'react-dom/client'
import '@motionstudies/web/fonts.css'
import '@motionstudies/web/tokens.css'
import { PFAD_EDITION } from './editions/pfad'
import './styles.css'

function App() {
  return (
    <div className="edition">
      <header><a href="https://motionstudies.app/">Motion Studies</a><span>Switzerland · In development</span></header>
      <main>
        <p className="eyebrow">The roads not taken</p>
        <h1>{PFAD_EDITION.identity.title}</h1>
        <p className="subtitle">{PFAD_EDITION.identity.descriptor}</p>
        <div className="description">
          <p>A road network. Two points. An instant stretched until we can see what happened.</p>
          <p>PFAD will reveal a real pathfinding algorithm exploring Switzerland’s roads. Every illuminated connection will belong to the computation. The search is the subject.</p>
        </div>
        <aside aria-label="Edition status"><span className="status-label">Edition in development</span><p>The national dataset has been measured. The search instrument is being built.</p><a href="https://github.com/emmettl/pfad">Follow the work <span aria-hidden="true">↗</span></a></aside>
      </main>
      <footer><a href="https://www.openstreetmap.org/copyright">Road data: © OpenStreetMap contributors · ODbL</a><a href={PFAD_EDITION.manifest}>Edition record</a></footer>
    </div>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('Missing PFAD mount point')
createRoot(root).render(<App />)
